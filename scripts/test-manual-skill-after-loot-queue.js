#!/usr/bin/env node
'use strict';

// Skill commands may run before an active Collector job, but Collector must
// freeze only its local deadlines for exactly the time its existing skill
// queues remain active. Server-owned lease/expiry/warp confirmation stays live.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

const manualStart = source.indexOf('function drainManualSkillQueue()');
const manualEnd = source.indexOf('// เก็บเวลาใช้ต่อ "สกิล + เป้าหมาย"', manualStart);
assert(manualStart >= 0 && manualEnd > manualStart, 'manual skill queue seam not found');
const manualDrain = source.slice(manualStart, manualEnd);
assert.doesNotMatch(manualDrain, /lootQueue\.isCollectorBusy\(\)/,
  'manual skill packets must not be blocked by an active Collector job');
assert.match(source, /function isCollectorSafeManualSkill\(skill\) \{[\s\S]{0,120}skill\.selfCast \|\| skill\.ally/,
  'only self/ally Manual Skills may run while Collector owns a job');
assert.match(source, /function isSkillQueueHoldingLootQueue\(\) \{[\s\S]{0,240}manualSkillQueue\.some\(job => isCollectorSafeManualSkill\(job\.skill\)\)[\s\S]{0,240}autoSupportQueue\.length/,
  'the pause owner must derive its state from Collector-safe manual and auto-support queues');
assert.match(source, /function skipUnsafeManualSkillsDuringCollector\(\) \{[\s\S]{0,240}lootQueue\.isCollectorBusy\(\)[\s\S]{0,500}isCollectorSafeManualSkill\(job\.skill\)/,
  'one helper must remove unsafe Manual Skill jobs only while Collector is active');
assert.match(source, /function queueSkillsNow\(\) \{[\s\S]{0,1800}manualSkillQueue = jobs;[\s\S]{0,180}skipUnsafeManualSkillsDuringCollector\(\);/,
  'building a Manual queue must filter targeted/ground skills while Collector is active');
assert.match(manualDrain, /skipUnsafeManualSkillsDuringCollector\(\);[\s\S]{0,120}if \(!manualSkillQueue\.length\) return;/,
  'draining a Manual queue must revalidate safety if Collector claims after the click');

const collectorTickStart = source.indexOf('      tick() {', source.indexOf('const lootQueue = (() =>'));
const collectorTickEnd = source.indexOf('      status() {', collectorTickStart);
assert(collectorTickStart >= 0 && collectorTickEnd > collectorTickStart, 'collector tick seam not found');
const collectorTick = source.slice(collectorTickStart, collectorTickEnd);
assert.match(source, /const pauseActiveJobTimersForSkill = \(now\) => \{[\s\S]{0,160}isSkillQueueHoldingLootQueue\(\)[\s\S]{0,180}activeJob\.skillTimerPausedAt = now;/,
  'Collector must begin a local timer pause while an existing skill queue has work');
assert.match(source, /const setActiveJobTimer = \(key, dueAt, setAt = nowMs\(\)\) => \{[\s\S]{0,240}deadlineSetAt\[key\] = setAt;/,
  'every mutable Collector deadline must record when it was last created');
assert.match(source, /const pausedFrom = Math\.max\(pausedAt, Number\(deadlineSetAt\[key\]\) \|\| 0\);[\s\S]{0,220}activeJob\[key\] = dueAt \+ Math\.max\(0, now - pausedFrom\);/,
  'each deadline must be paused only for the portion of time that overlaps the skill queue');
assert.match(collectorTick, /if \(pauseActiveJobTimersForSkill\(now\)\) return;/,
  'Collector must not advance pickup/retry timers while skills are pending');
assert.doesNotMatch(collectorTick, /job\.expiresAt\s*\+=|activeJob\.renewAt\s*\+=|activeJob\.warpRequestedAt\s*\+=/,
  'server-owned expiry, renew, and warp-confirmation timing must never be paused');

const timerHelperStart = source.indexOf('const setActiveJobTimer = (key, dueAt, setAt = nowMs()) =>');
const pauseStart = source.indexOf('const pauseActiveJobTimersForSkill = (now) =>');
const pauseEnd = source.indexOf('    return {', pauseStart);
assert(timerHelperStart >= 0 && pauseStart > timerHelperStart && pauseEnd > pauseStart, 'collector pause helper seam not found');
const timerHelperSource = source.slice(timerHelperStart, pauseEnd);
const state = {
  activeJob: {
    claimDelayUntil: 1200,
    collectorPostWarpSettleUntil: 1250,
    pickupResponseDueAt: 1300,
    nextPickupAt: 0,
    returnHomeNotBefore: 1400,
    warpRetryAt: 1500,
    expiresAt: 5000,
    renewAt: 900,
    warpRequestedAt: 800,
  },
};
let skillQueueActive = true;
const { setActiveJobTimer, pauseActiveJobTimersForSkill } = Function('state', 'isSkillQueueHoldingLootQueue', 'stage', 'log', 'nowMs', `
  let activeJob = state.activeJob;
  ${timerHelperSource}
  return { setActiveJobTimer, pauseActiveJobTimersForSkill };
`)(state, () => skillQueueActive, () => {}, () => {}, () => 0);

assert.strictEqual(pauseActiveJobTimersForSkill(1000), true, 'an active skill queue must pause Collector locally');
assert.strictEqual(state.activeJob.pickupResponseDueAt, 1300, 'pausing must not mutate deadlines yet');
setActiveJobTimer('nextPickupAt', 1300, 1300);
skillQueueActive = false;
assert.strictEqual(pauseActiveJobTimersForSkill(1600), false, 'Collector must resume once the existing skill queue empties');
assert.deepStrictEqual(
  {
    claimDelayUntil: state.activeJob.claimDelayUntil,
    collectorPostWarpSettleUntil: state.activeJob.collectorPostWarpSettleUntil,
    pickupResponseDueAt: state.activeJob.pickupResponseDueAt,
    nextPickupAt: state.activeJob.nextPickupAt,
    returnHomeNotBefore: state.activeJob.returnHomeNotBefore,
    warpRetryAt: state.activeJob.warpRetryAt,
  },
  {
    claimDelayUntil: 1800,
    collectorPostWarpSettleUntil: 1850,
    pickupResponseDueAt: 1900,
    nextPickupAt: 1600,
    returnHomeNotBefore: 2000,
    warpRetryAt: 2100,
  },
  'pre-existing deadlines must move 600ms, while a deadline created at 1300ms pauses only its 300ms overlap',
);
assert.deepStrictEqual(
  {
    expiresAt: state.activeJob.expiresAt,
    renewAt: state.activeJob.renewAt,
    warpRequestedAt: state.activeJob.warpRequestedAt,
  },
  { expiresAt: 5000, renewAt: 900, warpRequestedAt: 800 },
  'server-owned timers must remain unchanged after resuming Collector',
);

const combatStart = source.indexOf('const combatLoop = setInterval(() => {');
const combatEnd = source.indexOf('// AI Reply เป็น flow สนทนา', combatStart);
assert(combatStart >= 0 && combatEnd > combatStart, 'combat-loop prelude seam not found');
const combatPrelude = source.slice(combatStart, combatEnd);
const collectorBusyIndex = combatPrelude.indexOf('if (lootQueue.isCollectorBusy()) {');
const collectorSupportIndex = combatPrelude.indexOf('if (tryIdleSupportSkill(now)) return;', collectorBusyIndex);
const fleeIndex = combatPrelude.indexOf('fleePlayersIfNeeded()', collectorBusyIndex);
const normalSupportIndex = combatPrelude.lastIndexOf('if (tryIdleSupportSkill(now)) return;');
const manualDrainAfterSupportSetIndex = combatPrelude.indexOf('if (manualSkillQueue.length && !manualSkillQueueTimer && !autoSupportQueue.length) drainManualSkillQueue();');
assert(manualDrainAfterSupportSetIndex >= 0 && collectorBusyIndex > manualDrainAfterSupportSetIndex && collectorSupportIndex > collectorBusyIndex
  && fleeIndex > collectorSupportIndex && normalSupportIndex > fleeIndex,
  'Auto Support gets priority only while Collector is busy; otherwise Flee keeps its former safety priority');
assert.match(source, /function queueSkillsNow\(\) \{[\s\S]{0,2200}if \(autoSupportQueue\.length\) \{[\s\S]{0,180}รอ Support Skill Set ปัจจุบันจบก่อน/,
  'a Manual Skill request must wait rather than split an active recipient Support Set');
assert.match(source, /if \(\(manualSkillQueue\.length \|\| manualSkillQueueTimer\) && !autoSupportQueue\.length\) return false;/,
  'an active Support Set must continue even if a Manual Skill request arrives mid-set');

console.log('manual-skill-after-loot-queue regression: PASS');
