#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createBotActivityReporter } = require('../RO Rebuild Pure.js');

const reporter = createBotActivityReporter();
const paused = reporter.update({ now: 1000, masterEnabled: false });
assert.deepStrictEqual(paused, {
  code: 'PAUSED',
  label: 'Bot หยุดชั่วคราว',
  detail: 'กด BOT: ON เพื่อเริ่ม automation',
  blocker: '',
  tone: 'idle',
  sinceMs: 0,
  progressAgoMs: 0,
});

const dead = reporter.update({
  now: 2000,
  masterEnabled: true,
  socketConnected: true,
  dead: true,
  autoRespawnEnabled: true,
  respawnRemainingMs: 2500,
  collector: { busy: true, stage: 'pickup', itemName: 'Jellopy' },
});
assert.deepStrictEqual(dead, {
  code: 'DEAD_RESPAWN',
  label: 'ตัวละครตาย',
  detail: 'รอเกิดใหม่ 2.5s',
  blocker: 'ทุกงานหยุดรอ Auto-Respawn',
  tone: 'danger',
  sinceMs: 0,
  progressAgoMs: 0,
}, 'death and respawn must be reported ahead of queued collection work');

const collecting = reporter.update({
  now: 4000,
  masterEnabled: true,
  socketConnected: true,
  collector: { busy: true, stage: 'pickup-wait', itemName: 'Jellopy', attempts: 2, limit: 6, progressKey: 'job-9:2' },
  playerEncounter: { state: 'TOWN_REST', remainingMs: 10000 },
});
assert.deepStrictEqual(collecting, {
  code: 'LOOT_QUEUE',
  label: 'กำลังไปเก็บของจาก Loot Queue',
  detail: 'Jellopy · รอผลเก็บของ · ครั้งที่ 2/6',
  blocker: 'Combat และงานรองรอ Loot Queue',
  tone: 'active',
  sinceMs: 0,
  progressAgoMs: 0,
}, 'collector work must use the same priority as the combat loop');

const restingFromPlayer = reporter.update({
  now: 6000,
  masterEnabled: true,
  socketConnected: true,
  playerEncounter: { state: 'TOWN_REST', playerName: 'Chaser', count: 3, remainingMs: 72500, progressKey: 'town-rest:72' },
});
assert.deepStrictEqual(restingFromPlayer, {
  code: 'PLAYER_ENCOUNTER',
  label: 'พักในเมืองหลังพบผู้เล่น',
  detail: 'Chaser · ครั้งที่ 3/3 · เหลือ 72.5s',
  blocker: 'ระบบฟาร์มรอ Player Encounter',
  tone: 'waiting',
  sinceMs: 0,
  progressAgoMs: 0,
});

const walking = reporter.update({
  now: 10000,
  masterEnabled: true,
  socketConnected: true,
  combatEnabled: true,
  target: { phase: 'walking', name: 'Poring', distance: 12.4, progressKey: 'poring:20,20' },
});
assert.deepStrictEqual(walking, {
  code: 'COMBAT_WALK',
  label: 'กำลังเดินไปหามอน',
  detail: 'Poring · ระยะ 12.4 ช่อง',
  blocker: '',
  tone: 'active',
  sinceMs: 0,
  progressAgoMs: 0,
});
assert.deepStrictEqual(reporter.update({
  now: 12500,
  masterEnabled: true,
  socketConnected: true,
  combatEnabled: true,
  target: { phase: 'walking', name: 'Poring', distance: 12.4, progressKey: 'poring:20,20' },
}), { ...walking, sinceMs: 2500, progressAgoMs: 2500 }, 'an unchanged task must expose how long it has made no progress');

const searching = reporter.update({
  now: 15000,
  masterEnabled: true,
  socketConnected: true,
  combatEnabled: true,
  search: { elapsedMs: 8200, mode: 'gat', nextWarpMs: 1800, progressKey: 'gat:44,51' },
});
assert.deepStrictEqual(searching, {
  code: 'SEARCH_MONSTER',
  label: 'กำลังค้นหามอน',
  detail: 'เดินด้วย GAT · ไม่เจอมอน 8.2s · วาร์ปค้นหาใน 1.8s',
  blocker: '',
  tone: 'active',
  sinceMs: 0,
  progressAgoMs: 0,
});

const lootWait = reporter.update({
  now: 18000,
  masterEnabled: true,
  socketConnected: true,
  combatEnabled: true,
  loot: { queueSize: 3, itemName: 'Apple', attempts: 2, limit: 6, waitingResult: true, progressKey: 'drop-77:2' },
  target: { phase: 'attacking', name: 'Lunatic' },
});
assert.deepStrictEqual(lootWait, {
  code: 'LOOT',
  label: 'กำลังเก็บของ',
  detail: 'Apple · รอผลเก็บของ · ครั้งที่ 2/6 · คิวเหลือ 3',
  blocker: 'Combat รอให้เก็บของเสร็จ',
  tone: 'waiting',
  sinceMs: 0,
  progressAgoMs: 0,
}, 'normal loot must be visible ahead of the current combat target');

const warpLoot = reporter.update({
  now: 20000,
  masterEnabled: true,
  socketConnected: true,
  combatEnabled: true,
  loot: { queueSize: 0, warpQueueSize: 1, itemName: 'Card', warpStage: 'offset 2/5', progressKey: 'warp-drop-88:2' },
});
assert.deepStrictEqual(warpLoot, {
  code: 'LOOT_WARP',
  label: 'กำลังวาร์ปไปเก็บของ',
  detail: 'Card · offset 2/5 · คิววาร์ป 1',
  blocker: 'Combat รอให้เก็บของเสร็จ',
  tone: 'active',
  sinceMs: 0,
  progressAgoMs: 0,
});

console.log('bot activity status regression: PASS');
