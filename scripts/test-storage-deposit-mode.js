#!/usr/bin/env node
'use strict';

// Regression guard for the safe default Storage mode.  This is intentionally
// source-level: the userscript runs inside the game browser and its inventory
// maps are populated by live packets, so the contract is verified at the
// module seam rather than reimplementing packet state in Node.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /storageDepositMode/, 'Storage needs an explicit all/selected mode');
assert.match(source, /storageDepositMode:\s*'all'/, 'new installs must default to deposit-all');
assert.match(source, /function storageDepositItemIds\(/, 'one helper must choose all vs selected candidates');
assert.match(source, /function hasDepositableInventory\(/, 'missing Storage inventory eligibility helper');
assert.match(source, /storageDepositItemIds\(\).*some\(/s, 'auto trigger must use the shared candidate helper');
assert.match(source, /function buildDepositQueue\(/, 'missing deposit queue builder');
assert.match(source, /hasEquipmentSnapshot\(\)/, 'deposit-all must not move equipment until a full inventory snapshot is known');
assert.match(source, /function isEquippedBagId\(/, 'equipped items must be protected from deposit');
assert.match(source, /isWeaponBagProtected\(slotId\)/, 'Weapon Set items must remain protected');
assert.match(source, /storageReserveAmount\(itemId\)/, 'reserve counts must be kept before deposit');

console.log('storage-deposit-mode regression: PASS');
