#!/usr/bin/env node
'use strict';

// An unobserved drop after a map transition is ambiguous: the ITEM_DROP
// stream may merely be late.  The Collector must release that job, drain one
// different job if available, and only then make the ambiguous job eligible
// again.  This keeps a missing packet from becoming either a discard or a
// claim/release loop.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /const deferActiveForVisibility = \(reason\) => \{[\s\S]{0,700}deferredVisibilityJobIds\.add\(stale\.job\.id\);[\s\S]{0,700}send\(\{ type: 'nack', id: stale\.job\.id, claimToken: stale\.claimToken, reason \}\);/,
  'an ambiguous job must be released with nack and marked deferred before it can be claimed again');
assert.match(source, /const markDeferredVisibilityPass = \(job\) => \{[\s\S]{0,360}deferredVisibilityJobIds\.has\(job\.id\)[\s\S]{0,240}deferredVisibilityPassReady = true;/,
  'only a different terminal job may open the next visibility pass');

const selectorStart = source.indexOf('const nextOpenJob = (job, now) =>');
const selectorEnd = source.indexOf('const offerPending = () =>', selectorStart);
assert(selectorStart >= 0 && selectorEnd > selectorStart, 'deferred job selector seam not found');
const selectorSource = source.slice(selectorStart, selectorEnd);

const now = 1000;
const jobA = { id: 'A', map: 'slow_map', x: 10, y: 10, createdAt: 1, expiresAt: 9000 };
const jobB = { id: 'B', map: 'next_map', x: 20, y: 20, createdAt: 2, expiresAt: 9000 };
const state = {
  availableJobs: new Map([[jobA.id, jobA], [jobB.id, jobB]]),
  deferredVisibilityJobIds: new Set([jobA.id]),
  deferredVisibilityPassReady: false,
};
const selector = Function('state', `
  const availableJobs = state.availableJobs;
  const deferredVisibilityJobIds = state.deferredVisibilityJobIds;
  let deferredVisibilityPassReady = state.deferredVisibilityPassReady;
  ${selectorSource}
  return {
    nextOpenJob,
    passReady: () => deferredVisibilityPassReady,
  };
`)(state);

assert.strictEqual(selector.nextOpenJob(null, now).id, jobB.id,
  'while a different open job exists, the deferred ambiguous job must be skipped');
state.availableJobs.delete(jobB.id);
assert.strictEqual(selector.nextOpenJob(null, now), null,
  'a deferred job by itself must not cause a claim/release loop while returning home');
state.deferredVisibilityPassReady = true; // model terminal completion of job B
// The selector owns this flag in the live closure, so rebuild the small seam
// with the completed pass state before observing the deferred retry.
const retrySelector = Function('state', `
  const availableJobs = state.availableJobs;
  const deferredVisibilityJobIds = state.deferredVisibilityJobIds;
  let deferredVisibilityPassReady = state.deferredVisibilityPassReady;
  ${selectorSource}
  return { nextOpenJob, passReady: () => deferredVisibilityPassReady };
`)(state);
assert.strictEqual(retrySelector.nextOpenJob(null, now).id, jobA.id,
  'one different terminal job must make the deferred job eligible again');
assert.strictEqual(state.deferredVisibilityJobIds.size, 0,
  'claiming a deferred visibility pass must clear its deferral markers');
assert.strictEqual(retrySelector.passReady(), false,
  'a consumed visibility pass must not re-enable an immediate loop');

const pickupStart = source.indexOf('const sendPickupAttempt = (label) =>');
const pickupEnd = source.indexOf('status() {', pickupStart);
assert(pickupStart >= 0 && pickupEnd > pickupStart, 'pickup retry seam not found');
const pickupFlow = source.slice(pickupStart, pickupEnd);
assert.match(pickupFlow, /if \(!observedDrop\) \{[\s\S]{0,180}deferActiveForVisibility\('ไม่พบ drop บนพื้นก่อน pickup รอบ ' \+ attempt\);/,
  'a late or absent ITEM_DROP packet must defer instead of discard');
assert.match(pickupFlow, /itemId ไม่ตรงกับ job ก่อน pickup รอบ ' \+ attempt\);/,
  'positive evidence of the wrong item must remain a terminal discard');

const warpStart = source.indexOf('if (currentMap !== job.map) {');
const warpEnd = source.indexOf('// อยู่แมปเดียวกันแต่ drop ไกลกว่า', warpStart);
assert(warpStart >= 0 && warpEnd > warpStart, 'cross-map retry seam not found');
assert.match(source.slice(warpStart, warpEnd), /if \(activeJob\.warpAttempts >= MAX_WARP_ATTEMPTS\) \{[\s\S]{0,220}deferActiveForVisibility\('ยืนยันการวาร์ปไป ' \+ job\.map/,
  'an unconfirmed MAP_NAME after bounded retries must defer, not discard');

const availableStart = source.indexOf("if (message.type === 'available' && role() === 'collector')");
const availableEnd = source.indexOf("} else if (message.type === 'claimed'", availableStart);
assert(availableStart >= 0 && availableEnd > availableStart, 'available-message seam not found');
const availableFlow = source.slice(availableStart, availableEnd);
assert.match(availableFlow, /const next = nextOpenJob\(null, nowMs\(\)\);[\s\S]{0,240}claim\(next\)/,
  'available messages must use the same deferred-aware selector as tick');
assert.doesNotMatch(availableFlow, /claim\(jobsFrom\(message\)\[0\]\)/,
  'available messages must not immediately reclaim the job that was just deferred');
assert.match(source, /pause\(\) \{[\s\S]{0,600}deferredVisibilityJobIds\.clear\(\);[\s\S]{0,180}lootQueueTransport\.close\(\);/,
  'pausing Collector must discard local deferral state with the rest of its queue state');

console.log('loot-queue-deferred-visibility regression: PASS');
