#!/usr/bin/env node
'use strict';

// A terminal pickup failure must release its claim and immediately be able to
// claim the next open job.  Returning home, if no successor exists, is paced
// only by the existing editable warp-delay setting.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.doesNotMatch(source, /lootQueueNearbySettleMs|nearbySettleMs|failureNextJobDelayMs|nextClaimAt|nextClaimRemainingMs|lootqueuesettle/,
  'discard-delay config, state, UI, and setter must be removed completely');
assert.match(source, /const discardActive = \(reason\) => \{[\s\S]{0,500}idleReturnAt = nowMs\(\) \+ warpCooldownMs\(\);/,
  'discard must reuse the existing warp delay only for a possible return home');
assert.match(source, /const claim = \(job\) => \{[\s\S]{0,240}if \(!job \|\| claimPendingId \|\| !collectorGameReady\(\)/,
  'a discard must not block the next claim with a separate timer');

console.log('loot-queue-no-discard-delay regression: PASS');
