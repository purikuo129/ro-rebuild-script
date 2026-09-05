#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  matchesPlayerWhitelist,
  shouldHoldPlayerFleeForEncounter,
  createPlayerEncounterTracker,
  createPlayerEncounterController,
} = require('../RO Rebuild Pure.js');

assert.strictEqual(shouldHoldPlayerFleeForEncounter('IDLE'), false);
assert.strictEqual(shouldHoldPlayerFleeForEncounter('WHITELIST_WORK'), false,
  'dangerous players may still interrupt while the whitelist flow finishes current work');
for (const state of ['WHITELIST_DELAY', 'WARP_TOWN', 'TOWN_REST', 'RETURN_FARM']) {
  assert.strictEqual(shouldHoldPlayerFleeForEncounter(state), true,
    'normal Flee Player must be held during ' + state);
}

assert.strictEqual(matchesPlayerWhitelist('testPlayer42', ['^test.*']), true,
  'whitelist patterns must support case-insensitive Regex');
assert.strictEqual(matchesPlayerWhitelist('SomebodyElse', ['^test.*']), false);
assert.strictEqual(matchesPlayerWhitelist('[Friend', ['[Friend']), true,
  'an invalid Regex must remain usable as an exact-name fallback');

const tracker = createPlayerEncounterTracker();
const observe = (name, now, distance = 4, whitelisted = false) => tracker.observe({
  id: 101,
  name,
  distance,
  whitelisted,
  now,
  windowMs: 10000,
});

assert.deepStrictEqual(observe('Troublemaker', 0), { action: 'flee', name: 'Troublemaker', count: 1 });
assert.deepStrictEqual(observe('Troublemaker', 100), { action: 'none' }, 'repeated packets in one nearby episode must not count');
assert.deepStrictEqual(observe('Troublemaker', 200, 6), { action: 'none' });
assert.deepStrictEqual(observe('Troublemaker', 1000), { action: 'flee', name: 'Troublemaker', count: 2 });
assert.deepStrictEqual(observe('Troublemaker', 1100, 6), { action: 'none' });
assert.deepStrictEqual(observe('Troublemaker', 2000), { action: 'retreat', name: 'Troublemaker', count: 3 },
  'the third nearby arrival inside the rolling window must retreat to town');

const rolling = createPlayerEncounterTracker();
const seeRolling = (now, distance = 4) => rolling.observe({
  id: 202,
  name: 'SlowFollower',
  distance,
  whitelisted: false,
  now,
  windowMs: 10000,
});
assert.strictEqual(seeRolling(0).count, 1);
seeRolling(100, 6);
assert.strictEqual(seeRolling(11000).count, 1, 'arrivals older than the editable rolling window must expire');
seeRolling(11100, 6);
assert.strictEqual(seeRolling(12000).count, 2);
seeRolling(12100, 6);
assert.strictEqual(seeRolling(13000).action, 'retreat');

const whitelist = createPlayerEncounterTracker();
assert.deepStrictEqual(whitelist.observe({
  id: 303,
  name: 'TrustedFriend',
  distance: 2,
  whitelisted: true,
  now: 0,
  windowMs: 10000,
}), { action: 'whitelist', name: 'TrustedFriend' }, 'whitelisted players must enter the conversation flow');

const afterWarp = createPlayerEncounterTracker();
assert.strictEqual(afterWarp.observe({ id: 404, name: 'Chaser', distance: 3, now: 0, windowMs: 10000 }).count, 1);
afterWarp.clearPresence();
assert.strictEqual(afterWarp.observe({ id: 404, name: 'Chaser', distance: 3, now: 1000, windowMs: 10000 }).count, 2,
  'a confirmed player teleport must re-arm nearby arrival detection without losing history');
afterWarp.forgetEntity(404);
assert.strictEqual(afterWarp.observe({ id: 404, name: 'Chaser', distance: 3, now: 2000, windowMs: 10000 }).action, 'retreat',
  'despawn followed by respawn must count as a new arrival');

const lateName = createPlayerEncounterTracker();
assert.deepStrictEqual(lateName.observe({ id: 405, name: '', distance: 3, now: 0, windowMs: 10000 }),
  { action: 'flee', name: '', count: null });
assert.deepStrictEqual(lateName.observe({ id: 405, name: 'NamedLater', distance: 3, now: 50, windowMs: 10000 }),
  { action: 'none', name: 'NamedLater', count: 1 },
  'a name learned later must preserve the arrival without issuing a second flee for the same episode');
assert.deepStrictEqual(lateName.observe({ id: 405, name: 'NamedLater', distance: 3, now: 60, windowMs: 10000 }), { action: 'none' });

const commands = [];
const controller = createPlayerEncounterController({
  getConfig: () => ({
    repeatWindowSec: 10,
    repeatTownRestSec: 300,
    whitelistDelaySec: 4,
    whitelistTownRestSec: 30,
    townMap: 'prontera',
    farmMap: 'mjolnir_03',
  }),
  actions: {
    flee: result => commands.push(['flee', result.name, result.count]),
    warpTown: () => commands.push(['warpTown']),
    warpFarm: () => commands.push(['warpFarm']),
    sit: () => commands.push(['sit']),
    stand: () => commands.push(['stand']),
  },
});
const encounter = (now, distance = 3) => controller.observePlayer({ id: 505, name: 'RepeatChaser', distance, now, whitelisted: false });
encounter(0); encounter(10, 8); encounter(1000); encounter(1010, 8); encounter(2000);
assert.deepStrictEqual(commands, [
  ['flee', 'RepeatChaser', 1],
  ['flee', 'RepeatChaser', 2],
  ['warpTown'],
], 'the third arrival must replace the normal flee with a town warp');
assert.strictEqual(controller.status(2000).state, 'WARP_TOWN');
controller.tick({ now: 2400, currentMap: 'prontera', workPending: false, conversationActive: false, teleportActive: true });
assert.strictEqual(controller.status(2400).state, 'WARP_TOWN',
  'rest must not begin until the teleport coordinator confirms even when town and farm share a map name');
controller.tick({ now: 2500, currentMap: 'prontera', workPending: false, conversationActive: false, teleportActive: false });
assert.strictEqual(controller.status(2500).state, 'TOWN_REST');
assert.strictEqual(controller.status(2500).remainingMs, 300000);
controller.skipRest();
assert.strictEqual(controller.status(2500).state, 'RETURN_FARM');
assert.deepStrictEqual(commands.slice(-2), [['stand'], ['warpFarm']], 'skip rest must return to farm immediately');
controller.tick({ now: 2900, currentMap: 'mjolnir_03', workPending: false, conversationActive: false, teleportActive: true });
assert.strictEqual(controller.status(2900).state, 'RETURN_FARM', 'farm arrival must wait for teleport confirmation');
controller.tick({ now: 3000, currentMap: 'mjolnir_03', workPending: false, conversationActive: false, teleportActive: false });
assert.strictEqual(controller.status(3000).state, 'IDLE');

const whitelistCommands = [];
const whitelistController = createPlayerEncounterController({
  getConfig: () => ({ repeatWindowSec: 10, repeatTownRestSec: 300, whitelistDelaySec: 4, whitelistTownRestSec: 30, townMap: 'prontera', farmMap: 'mjolnir_03' }),
  actions: {
    flee: () => whitelistCommands.push(['flee']),
    warpTown: () => whitelistCommands.push(['warpTown']),
    warpFarm: () => whitelistCommands.push(['warpFarm']),
    sit: () => whitelistCommands.push(['sit']),
    stand: () => whitelistCommands.push(['stand']),
  },
});
whitelistController.observePlayer({ id: 606, name: 'TrustedFriend', distance: 2, now: 0, whitelisted: true });
assert.strictEqual(whitelistController.tick({ now: 0, currentMap: 'mjolnir_03', workPending: true, conversationActive: false }).owned, false,
  'whitelist flow must allow existing combat and loot to finish');
assert.strictEqual(whitelistController.tick({ now: 1000, currentMap: 'mjolnir_03', workPending: false, conversationActive: false }).owned, true);
assert.deepStrictEqual(whitelistCommands, [['sit']]);
assert.strictEqual(whitelistController.status(1000).state, 'WHITELIST_DELAY');
whitelistController.tick({ now: 4999, currentMap: 'mjolnir_03', workPending: false, conversationActive: false });
assert.deepStrictEqual(whitelistCommands, [['sit']], 'whitelist delay must use the editable setting');
whitelistController.tick({ now: 5000, currentMap: 'mjolnir_03', workPending: false, conversationActive: false });
assert.deepStrictEqual(whitelistCommands.slice(-2), [['stand'], ['warpTown']]);
whitelistController.tick({ now: 5100, currentMap: 'prontera', workPending: false, conversationActive: false, teleportActive: false });
assert.strictEqual(whitelistController.status(5100).remainingMs, 30000, 'whitelist town rest must use its separate editable value');
whitelistController.tick({ now: 35099, currentMap: 'prontera', workPending: false, conversationActive: false, teleportActive: false });
assert.notDeepStrictEqual(whitelistCommands.slice(-1), [['warpFarm']], 'town rest must hold until the configured duration expires');
whitelistController.tick({ now: 35100, currentMap: 'prontera', workPending: false, conversationActive: false, teleportActive: false });
assert.deepStrictEqual(whitelistCommands.slice(-2), [['stand'], ['warpFarm']]);

console.log('player encounter threshold regression: PASS');
