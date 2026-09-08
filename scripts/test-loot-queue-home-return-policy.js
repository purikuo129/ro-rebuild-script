#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const { decideLootQueueHomeReturn } = require('../RO Rebuild Pure.js');

assert.strictEqual(typeof decideLootQueueHomeReturn, 'function',
  'Loot Queue must expose one home-return policy seam');

assert.deepStrictEqual(decideLootQueueHomeReturn({
  combatEnabled: true,
  farmMap: 'mjolnir_03',
  currentMap: 'mjolnir_03',
  homeMap: 'mjolnir_03',
  homeX: -999,
  homeY: -999,
  playerX: 120,
  playerY: 80,
}), { action: 'RESUME_COMBAT', randomHome: true },
'Collector + Combat on the farm map must release Collector instead of teleporting home');

assert.deepStrictEqual(decideLootQueueHomeReturn({
  combatEnabled: false,
  farmMap: 'mjolnir_03',
  currentMap: 'mjolnir_03',
  homeMap: 'mjolnir_03',
  homeX: -999,
  homeY: -999,
  playerX: 120,
  playerY: 80,
}), { action: 'TELEPORT_RELEASE', randomHome: true },
'same-map random home teleport cannot be confirmed by measuring distance to -999,-999');

assert.deepStrictEqual(decideLootQueueHomeReturn({
  combatEnabled: false,
  farmMap: 'mjolnir_03',
  currentMap: 'mjolnir_03',
  homeMap: 'mjolnir_03',
  homeX: 100,
  homeY: 100,
  playerX: 102,
  playerY: 101,
}), { action: 'AT_HOME', randomHome: false },
'an exact same-map home point must still use its existing three-cell arrival rule');

assert.deepStrictEqual(decideLootQueueHomeReturn({
  combatEnabled: false,
  farmMap: 'mjolnir_03',
  currentMap: 'mjolnir_03',
  homeMap: 'mjolnir_03',
  homeX: 0,
  homeY: 0,
  playerX: null,
  playerY: null,
}), { action: 'TELEPORT_CONFIRM', randomHome: false },
'missing player coordinates must not be coerced to zero and mistaken for home');

assert.deepStrictEqual(decideLootQueueHomeReturn({
  combatEnabled: false,
  farmMap: 'mjolnir_03',
  currentMap: 'prontera',
  homeMap: 'mjolnir_03',
  homeX: -999,
  homeY: -999,
  playerX: 120,
  playerY: 80,
}), { action: 'TELEPORT_CONFIRM', randomHome: true },
'cross-map random home teleport must still wait for MAP_NAME confirmation');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const returnStart = source.indexOf('const returnHome = () => {');
const returnEnd = source.indexOf('const tickHomeReturn', returnStart);
assert(returnStart >= 0 && returnEnd > returnStart, 'returnHome runtime seam not found');
const returnFlow = source.slice(returnStart, returnEnd);
const decisionStart = source.indexOf('const lootQueueHomeReturnDecision = () =>');
assert(decisionStart >= 0 && decisionStart < returnStart, 'home-return decision adapter not found');
const decisionAdapter = source.slice(decisionStart, returnStart);
assert.match(decisionAdapter, /RO_PURE_CORE\.decideLootQueueHomeReturn\(/,
  'the userscript returnHome flow must use the behavior-tested policy');
assert.match(returnFlow, /decision\.action === 'RESUME_COMBAT'[\s\S]{0,260}activeJob = null;[\s\S]{0,160}return;/,
  'hybrid farm-map completion must release Collector without teleporting');
assert.match(returnFlow, /decision\.action === 'TELEPORT_RELEASE'[\s\S]{0,320}activeJob = null;[\s\S]{0,160}return;/,
  'same-map random teleport must release Collector without entering confirmation retries');

const settledStart = source.indexOf('if (activeJob.settleUntil) {');
const settledEnd = source.indexOf('if (currentMap !== job.map)', settledStart);
assert(settledStart >= 0 && settledEnd > settledStart, 'settled-job flow seam not found');
const settledFlow = source.slice(settledStart, settledEnd);
const hybridReleaseAt = settledFlow.indexOf("lootQueueHomeReturnDecision().action === 'RESUME_COMBAT'");
const homeDelayAt = settledFlow.indexOf("setActiveJobTimer('returnHomeNotBefore'");
assert(hybridReleaseAt >= 0 && homeDelayAt >= 0 && hybridReleaseAt < homeDelayAt,
  'Hybrid must release Collector before the configurable warp delay because no home teleport will occur');

console.log('loot-queue home-return policy regression: PASS');
