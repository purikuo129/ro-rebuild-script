#!/usr/bin/env node
'use strict';

// The editable Loot Queue warp delay is the only allowed timing source for
// the successful-pickup → return-home transition.  A newly available job must
// still win before that delay so the collector drains its queue first.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const settledStart = source.indexOf('if (activeJob.settleUntil) {');
const settledEnd = source.indexOf('if (currentMap !== job.map)', settledStart);
assert(settledStart >= 0 && settledEnd > settledStart, 'settled-job flow seam not found');
const settledFlow = source.slice(settledStart, settledEnd);

assert.match(source, /lootQueueWarpCooldownMs: 0, \/\/ ดีเลย์ก่อนวาร์ป job ถัดไปหรือกลับจุดรอ/,
  'the existing editable warp delay must document both next-job and home-return use');
assert.match(settledFlow, /const next = .*nextOpenJob\(job, now\);[\s\S]{0,500}if \(next && claim\(next\)\) \{[\s\S]{0,280}return;/,
  'a queued successor must be claimed before considering a return-home delay');
assert.match(settledFlow, /activeJob\.returnHomeNotBefore = now \+ warpCooldownMs\(\);/,
  'successful return-home delay must reuse the editable Loot Queue warp delay');
assert.match(settledFlow, /if \(now < activeJob\.returnHomeNotBefore\) \{[\s\S]{0,260}return;[\s\S]{0,100}\}[^]*?returnHome\(\);/,
  'collector must wait before home only after finding no successor');

console.log('loot-queue-return-home-delay regression: PASS');
