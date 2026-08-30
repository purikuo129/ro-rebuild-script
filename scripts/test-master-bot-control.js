#!/usr/bin/env node
'use strict';

// Master control is deliberately a small interface: loops only ask whether
// automation is enabled; cleanup/release stays inside the module.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /const MASTER_BOT_STORAGE_KEY = 'roPureMasterBotEnabled_v1';/);
assert.match(source, /const masterBot = \(\(\) => \{/);
assert.match(source, /enabled\(\)/, 'master module needs a read interface');
assert.match(source, /setEnabled\(next\)/, 'master module needs one state transition interface');
assert.match(source, /lootQueue\.pause\(\)/, 'pause must release Loot Queue ownership');
assert.match(source, /queue\.clear\(\);[\s\S]*warpQueue\.clear\(\);/, 'pause must clear stale normal-loot actions');
assert.match(source, /if \(!masterBot\.enabled\(\)\) return;/, 'automation loops must use the central gate');
assert.match(source, /data-masterbot/, 'HUD needs the master control');

console.log('master-bot-control regression: PASS');
