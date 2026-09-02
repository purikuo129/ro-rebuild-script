#!/usr/bin/env node
'use strict';

// Collector owns one job and one outstanding pickup command at a time.  This
// locks the intended ordering: city-only claim delay, post-warp pickup,
// immediate happy-path chaining, and delayed next claim only after discard.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.match(source, /lootQueueClaimDelayMs: 5000, \/\/ รอก่อนออกจากจุดรอ\/เมืองเพื่อรวม drop/);
assert.doesNotMatch(source, /lootQueueNearbySettleMs|nearbySettleMs|failureNextJobDelayMs|nextClaimAt|nextClaimRemainingMs|lootqueuesettle/,
  'discard must not have a second configuration/state delay');
assert.match(source, /lootQueuePickupRetryCount: 3, \/\/ จำนวนคำสั่ง pickup รวมทั้งหมด/);
assert.match(source, /const delayMs = \(!replacingSettledJob && !sameMap && currentMap === CFG\.lootQueueHomeMap\) \? claimDelayMs\(\) : 0;/,
  'claim delay must apply only from the configured home map when a warp is needed');
assert.match(source, /done\.settleUntil = nowMs\(\);[\s\S]{0,160}เก็บสำเร็จ → มอง job คิวถัดไปทันที/,
  'a successful pickup must chain immediately');
assert.match(source, /const pickupResponseWaitMs = \(\) => \{[\s\S]{0,180}CFG\.lootQueueActionTimeoutMs[\s\S]{0,180}\};/,
  'the configured pickup response wait must control each attempt');
assert.match(source, /const pickupResponseWaitMs = \(\) => \{[\s\S]{0,180}Math\.max\(100, Math\.min\(30000, Math\.round\(delay\)\)\)/,
  'pickup response wait must allow a user-configured 100ms minimum');
assert.match(source, /'actionTimeoutMs' in values[\s\S]{0,180}CFG\.lootQueueActionTimeoutMs = Math\.max\(100, Math\.min\(30000, Math\.round\(values\.actionTimeoutMs\)\)\);/,
  'the public Loot Queue config setter must preserve values below 1000ms');
assert.match(source, /id="__assist_lootqueuetimeout" min="100" max="30000" step="50"/,
  'the Loot Queue UI must accept values below 1000ms');
assert.match(source, /setActiveJobTimer\('pickupResponseDueAt', now \+ pickupResponseWaitMs\(\), now\);/,
  'each pickup attempt must use the configured response wait');
assert.match(source, /รอผล Pickup แต่ละครั้ง \(ms\) — ครบเวลาแล้วจึง retry; ครบจำนวนคำสั่งจึงทิ้งงาน/,
  'the UI must describe the configured per-attempt response wait');
assert.match(source, /activeJob\.waitingPickupResult = true;/,
  'only one pickup command may be awaiting its result');
assert.match(source, /if \(activeJob\.waitingPickupResult\) \{[\s\S]{0,320}return;/,
  'collector must wait for a pickup result before retrying');
assert.match(source, /function lootQueuePickupAttemptLimit\(value\) \{[\s\S]{0,180}Math\.round\(Number\(value\)\)[\s\S]{0,180}Math\.max\(3, Math\.min\(6, count\)\)/,
  'the configured retry value must be normalized by a shared total-attempt helper');
assert.match(source, /const pickupAttemptLimit = \(\) => lootQueuePickupAttemptLimit\(CFG\.lootQueuePickupRetryCount\);/,
  'Collector must use the shared total-attempt helper');
assert.match(source, /\['#__assist_lootqueuepickupretries', lootQueuePickupAttemptLimit\(CFG\.lootQueuePickupRetryCount\)\]/,
  'the UI must use the same in-scope total-attempt helper as Collector');
assert.doesNotMatch(source, /\['#__assist_lootqueuepickupretries', pickupAttemptLimit\(\)\]/,
  'the UI must not call Collector-private helpers outside their module scope');
assert.match(source, /id="__assist_lootqueuepickupretries" min="3" max="6" step="1" placeholder="3"/,
  'the UI must make the total-attempt minimum explicit');
assert.match(source, /จำนวนคำสั่ง Pickup รวม \(ครั้ง\)/,
  'the UI must no longer describe retry count as extra commands');
assert.match(source, /if \(attempts >= limit\) \{[\s\S]{0,160}discardActive\('server ตอบ pickup FAIL ครบ '/,
  'discard happens only after the configured total number of pickup commands');
assert.match(source, /const discardActive = \(reason\) => \{[\s\S]{0,500}idleReturnAt = nowMs\(\) \+ warpCooldownMs\(\);/,
  'discard may delay only a possible return home through the existing warp-delay setting');
assert.match(source, /const claim = \(job\) => \{[\s\S]{0,240}if \(!job \|\| claimPendingId \|\| !collectorGameReady\(\)/,
  'discard must permit the next job claim immediately');
assert.match(source, /onPickupTakenByOther\(dropId\)/,
  'a confirmed pickup by another entity must retire the stale collector job');
assert.match(source, /onDropDespawn\(dropId\)/,
  'a drop despawn observed after warp must retire the stale collector job');
assert.match(source, /warpPresenceCheckPending = true;/,
  'every collector warp must still schedule the shared post-warp settle');
assert.doesNotMatch(source, /pickupWithoutObservedDrop/,
  'an unseen post-warp drop must not trigger an immediate one-attempt discard path');
assert.doesNotMatch(source, /PICKUP_RETRY_INTERVAL_MS/,
  'the configured pickup-result wait must be the only retry pacing value');
const collectorPostWarpSection = source.slice(
  source.indexOf("if (!activeJob.mapReachedAt)"),
  source.indexOf('const sendPickupAttempt = (label)')
);
assert.doesNotMatch(collectorPostWarpSection, /isWarpGuardActive\(now\)/,
  'collector pickup must not inherit Combat\'s 3s fresh-position guard; it waits only the shared configured post-warp settle value');
assert.match(collectorPostWarpSection, /collectorPostWarpSettleMs\(\)/,
  'collector must use the Combat post-warp settle setting directly from MAP_NAME arrival');
assert.match(collectorPostWarpSection, /collector-post-warp-settle/,
  'collector must expose the dedicated post-warp settle stage');
assert.doesNotMatch(collectorPostWarpSection, /recentDrops\.get\(job\.dropId\)/,
  'post-warp settle must not discard based on a ground-item check before two pickup commands');
assert.doesNotMatch(collectorPostWarpSection, /awaitingPlayerReady|map-await-player-ready/,
  'Collector must start its configured post-warp wait at MAP_NAME; PlayerReady must not add an unbounded hidden gate');
assert.doesNotMatch(source, /lootQueue\.onPlayerReady\(\)/,
  'outbound PlayerReady must not gate Collector timing');
const pickupStart = source.indexOf('const sendPickupAttempt = (label) =>');
const pickupSection = source.slice(pickupStart, source.indexOf('status() {', pickupStart));
assert.match(pickupSection, /const attempt = \(activeJob\.pickupAttempts \|\| 0\) \+ 1;[\s\S]{0,400}if \(attempt >= 3\) \{[\s\S]{0,400}const observedDrop = recentDrops\.get\(job\.dropId\);/,
  'only the third and later pickup commands may verify the ground drop');
assert.match(pickupSection, /if \(!observedDrop\) \{[\s\S]{0,180}deferActiveForVisibility\('ไม่พบ drop บนพื้นก่อน pickup รอบ ' \+ attempt\);/,
  'the delayed entity check must release an unseen drop for one queue rotation before retrying it');
assert.match(pickupSection, /setActiveJobTimer\('nextPickupAt', now, now\);/,
  'after the configured result wait, retries must not add another hidden delay');

console.log('loot-queue-collector-flow regression: PASS');
