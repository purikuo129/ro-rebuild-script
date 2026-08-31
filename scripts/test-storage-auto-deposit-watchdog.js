#!/usr/bin/env node
'use strict';

// A deposit-all run may contain far more than 60 inventory slots.  It must be
// allowed to continue while packets keep being sent; only a lack of transfer
// progress should abort it.  An abort after Storage opened must close Kafra.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.match(source, /const STORAGE_TRANSFER_STALL_TIMEOUT_MS = 15000;/,
  'transfer timeout must measure a stall, not cap the whole deposit run');
assert.match(source, /const storageTransferActive = storageState === 'MOVE_ITEMS' \|\| storageState === 'WITHDRAW_ITEMS';/,
  'the watchdog must recognise active deposit/withdraw phases');
assert.match(source, /const storageLastProgressAt = storageTransferActive \? storageTransferProgressAt : storageStateAt;/,
  'active transfer phases must use their latest progress timestamp');
assert.match(source, /const storageDialogOpen = \['STORAGE_OPENED', 'MOVE_ITEMS', 'WITHDRAW_ITEMS', 'CLOSE_STORAGE'\]\.includes\(storageState\);[\s\S]{0,180}if \(storageDialogOpen\) sendStorageClose\(\);/,
  'abort must close an open Kafra Storage UI before returning');
assert.match(source, /if \(!sendStorageMove\(moveId, item\.amount\)\) \{[\s\S]{0,200}return;[\s\S]{0,80}\}/,
  'a failed transfer send must stop before mutating its queue');
assert.match(source, /storageMoveIdx\+\+;\s+storageLastMoveAt = now;\s+storageTransferProgressAt = now;/,
  'a successful transfer must refresh the progress watchdog');

console.log('storage auto-deposit watchdog regression: PASS');
