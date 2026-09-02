#!/usr/bin/env node
'use strict';

// Deposits and reserve withdrawals must be paced by one visible, persisted
// setting.  The generic Storage heartbeat may service map/NPC/watchdog states,
// but must never add a second transfer throttle.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /'storageEnabled',[\s\S]{0,240}'storageTransferGapMs'/,
  'the Storage transfer gap must persist with the rest of Storage config');
assert.match(source, /storageTransferGapMs:\s*300,\s*\/\/ ระยะห่างส่งคำสั่งย้ายของ Kafra/,
  'new installs need a visible 300ms transfer-gap default');
assert.match(source, /function storageTransferGapMs\(\) \{[\s\S]{0,220}CFG\.storageTransferGapMs/,
  'one helper must own the effective transfer gap');
assert.match(source, /function storageLoopDelayMs\(\) \{[\s\S]{0,300}storageTransferGapMs\(\)/,
  'MOVE_ITEMS and WITHDRAW_ITEMS must schedule from that single gap');
assert.match(source, /id="__assist_storagetransfergap"/,
  'the transfer gap must be editable in the Storage UI');
assert.match(source, /setStorageTransferGapMs\(/,
  'the UI needs a persisted setter for the transfer gap');
assert.doesNotMatch(source, /now - storageLastMoveAt < 800/,
  'the obsolete hidden 800ms transfer throttle must be removed');
assert.doesNotMatch(source, /const storageLoop = setInterval\([\s\S]{0,2000}MOVE_ITEMS/,
  'a fixed one-second interval must not cap active Storage transfers');

const storageLoopStarts = [...source.matchAll(/^  scheduleStorageLoop\(\);$/gm)].map(match => match.index);
assert.strictEqual(storageLoopStarts.length, 1,
  'Storage scheduler must have exactly one initial start point');
assert(storageLoopStarts[0] > source.indexOf("let storageState = 'IDLE';"),
  'Storage state must initialise before the scheduler reads it');

console.log('storage transfer gap regression: PASS');
