#!/usr/bin/env node
'use strict';

// The farmer's offer decision has one seam.  A collector must never become a
// sender merely because a shared profile snapshot contains the send-all flag.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /lootQueueSendAll/, 'missing persisted send-all setting');
assert.match(source, /function shouldOfferLootQueueItem\(/, 'offer eligibility must be centralised');
assert.match(source, /role\(\)\s*===\s*'farm'/, 'send-all is farmer-only');
assert.match(source, /CFG\.lootQueueSendAll\s*\|\|\s*special\(itemId\)/, 'send-all must preserve selected-item fallback');
assert.match(source, /role\(\) !== 'farm' \|\| !shouldOfferLootQueueItem\(drop\.itemId\)/, 'offer() must use the shared decision');

console.log('loot-queue-send-all regression: PASS');
