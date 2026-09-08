#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolveDefeatedTargetPosition } = require('../RO Rebuild Pure.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');

// Reproduction: the authoritative death packet can arrive before EXP.  The
// runtime must preserve the dead target's coordinates before clearing target,
// otherwise a drop outside pickRadius can never qualify via pickRadiusKill.
assert.strictEqual(typeof resolveDefeatedTargetPosition, 'function',
  'Auto-Loot must expose the death-position resolver used by the packet flow');

const activeTarget = { id: 77, x: 10, y: 0 };
const deadEntity = { id: 77, x: 10, y: 0, kind: 1 };
assert.deepStrictEqual(resolveDefeatedTargetPosition(deadEntity, activeTarget), { x: 10, y: 0 },
  'death packet must retain the active monster position before target is cleared');

const drop = { x: 10, y: 0 };
const player = { x: 0, y: 0 };
const killPosition = resolveDefeatedTargetPosition(deadEntity, activeTarget);
const nearPlayer = Math.hypot(player.x - drop.x, player.y - drop.y) <= 2;
const nearKill = Math.hypot(killPosition.x - drop.x, killPosition.y - drop.y) <= 5;
assert.strictEqual(nearPlayer || nearKill, true,
  'drop 10 ช่องจากตัว แต่ตรงพิกัดมอนที่ฆ่า ต้องเข้าคิวเก็บผ่าน pickRadiusKill');

const deathBlock = source.match(/    \/\/ 0x0f ENTITY_ACTION:[\s\S]*?(?=    \/\/ 0x1b DESPAWN:)/);
assert(deathBlock, 'หา flow packet ยืนยันมอนตายไม่พบ');
assert.match(deathBlock[0], /const killedTarget = !!target && target\.id === id;/,
  'ต้องระบุว่า entity ที่ตายคือ target ปัจจุบันก่อนผูก drop');
assert.match(deathBlock[0], /resolveDefeatedTargetPosition\(e, target\)/,
  'ต้อง resolve พิกัดจาก packet ตายก่อน target ถูกล้าง');
assert.match(deathBlock[0], /rememberRecentKillPosition\(killedTargetPosition\)[\s\S]{0,900}target = null;/,
  'ต้องบันทึกพิกัดมอนตายก่อนล้าง target');

console.log('auto-loot death-position regression: PASS');
