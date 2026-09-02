#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'RO Rebuild Pure.js'), 'utf8');
const published = fs.readFileSync(path.join(root, 'ro-rebuild-pure.user.js'), 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');

function grabFunction(name) {
  const from = source.indexOf('  function ' + name + '(');
  const to = source.indexOf('\n  function ', from + 1);
  assert(from >= 0 && to > from, 'unable to extract ' + name);
  return source.slice(from, to);
}

const handleCloakingStatus = grabFunction('handleTargetCloakingStatusPacket');
const revealWithSight = grabFunction('tryRevealHiddenTargetWithSight');
const hasFreshCloakingEvidence = grabFunction('hasFreshCloakingEvidence');
const beginHiddenWait = grabFunction('beginHiddenWait');
const acquireTarget = grabFunction('acquireTarget');

// A target's own 0x3d Cloaking status must be enough to hold the target and
// send Sight right away, even if its last known position is outside 3 cells.
const runCloakingStatusReaction = Function('state', `
  const CLOAKING_STATUS_ID = 0x1c;
  const CLOAKING_EVIDENCE_WINDOW_MS = 2000;
  const SIGHT_SKILL_ID = 22;
  const SIGHT_SP_COST = 10;
  const SIGHT_CONFIRM_MS = 5000;
  const CFG = { hiddenSightEnabled: true, hiddenWaitSec: 4 };
  let target = state.target;
  let sightPendingUntil = 0;
  const entities = new Map([[target.id, state.monster]]);
  const manualSkillQueue = [];
  const manualSkillQueueTimer = null;
  const player = state.player;
  const sp = { cur: 99 };
  function nowMs() { return state.now; }
  function u32(u, offset) { return (u[offset] | (u[offset + 1] << 8) | (u[offset + 2] << 16) | (u[offset + 3] << 24)) >>> 0; }
  function isHiddenWaitTarget() { return true; }
  function hiddenWaitTimeoutMs() { return 4000; }
  function hasActiveSight() { return false; }
  function sendSkill(id, level, targetId, groundX, groundY) {
    state.sent.push({ id, level, targetId, groundX, groundY });
    return true;
  }
  function log() {}
  ${handleCloakingStatus}
  ${revealWithSight}
  ${hasFreshCloakingEvidence}
  ${beginHiddenWait}
  handleTargetCloakingStatusPacket(new Uint8Array([0, 7, 0, 0, 0, 0x1c, 0]), 0x3d);
  return {
    hiddenWaitAt: target.hiddenWaitAt,
    reason: target.hiddenWaitReason,
    evidenceAt: target.cloakingEvidenceAt,
    sightAttemptedAt: target.sightAttemptedAt,
    sent: state.sent,
  };
`);

const now = 100000;
const cloakingReaction = runCloakingStatusReaction({
  now,
  player: { x: 10, y: 10 },
  monster: { id: 7, name: 'Sleeper', x: 20, y: 10, alive: true },
  target: { id: 7, name: 'Sleeper', x: 20, y: 10, hiddenWaitAt: 0, cloakingEvidenceAt: 0 },
  sent: [],
});
assert.deepStrictEqual(cloakingReaction, {
  hiddenWaitAt: now,
  reason: 'Cloaking',
  evidenceAt: now,
  sightAttemptedAt: now,
  sent: [{ id: 22, level: 1, targetId: null, groundX: null, groundY: null }],
});
assert.doesNotMatch(source, /if \(gridDistance > SIGHT_RADIUS\)/,
  'Sight reaction must not be blocked by the former 3-cell range guard');

// Target re-acquisition must not be held by a second, hidden target-switch timer.
const runAcquireTarget = Function('state', `
  const CFG = { targetLowestHpFirst: false, searchRadii: [20], maxAcquireDistance: 20, maxChaseDistance: 20 };
  const player = { x: 10, y: 10 };
  let target = null;
  let lastWalkToTargetAt = 0;
  const skillUsesOnTarget = new Map();
  function getMobAttackerCount() { return 0; }
  function findNearestMonster() { return { m: state.monster, dist: 1 }; }
  function findLowestHpMonster() { return { m: state.monster, dist: 1, hpPct: 1 }; }
  function log() {}
  function resetWalkProgress() {}
  function resetCombatGatChase() {}
  ${acquireTarget}
  return acquireTarget(state.now);
`);

const immediatelyAvailable = runAcquireTarget({
  now: 10001,
  monster: { id: 8, name: 'Sleeper', sub: 117, x: 11, y: 10 },
});
assert.strictEqual(immediatelyAvailable.id, 8);
assert.doesNotMatch(source, /lastTargetSwitchAt/,
  'target re-acquisition must rely on existing abandon cooldowns, not a hidden 1.5s delay');

console.log('Sleeper Cloaking flow regression: PASS');
