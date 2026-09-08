#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createAutomationOrchestrator } = require('../RO Rebuild Pure.js');

const collectorSnapshot = (active = true) => ({
  dead: false,
  collector: active ? { active: true, phase: 'pickup', jobId: 'job-1' } : { active: false },
  combat: { active: false },
  loot: { atomic: false },
  rest: { active: false },
  storage: { urgent: false },
  abBuff: { pending: false, active: false },
});

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.enabled = false;
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'PAUSED', phase: 'paused', mode: 'IDLE', blockedBy: null,
    pendingIntent: null, effects: [],
  }, 'Master Bot OFF must not report a runnable owner');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.connected = false;
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'DISCONNECTED', phase: 'socket', mode: 'IDLE', blockedBy: null,
    pendingIntent: null, effects: [],
  }, 'a disconnected Game WebSocket must not report SEARCH as an active owner');
}

{
  const orchestrator = createAutomationOrchestrator();
  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot()), {
    owner: 'COLLECTOR',
    phase: 'pickup',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'Collector must own the action lane when no higher-priority intent exists');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_WHITELIST', playerName: 'TrustedFriend' });

  const combatDrainSnapshot = collectorSnapshot();
  combatDrainSnapshot.combat = { active: true, phase: 'attacking', targetId: 9001 };
  assert.deepStrictEqual(orchestrator.tick(combatDrainSnapshot), {
    owner: 'COMBAT',
    phase: 'attacking',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'PLAYER_WHITELIST',
    effects: [{ type: 'HOLD_NEW_COLLECTOR_CLAIMS', reason: 'PLAYER_WHITELIST' }],
  }, 'Whitelist must preserve Combat → Collector drain ordering when both were already active');

  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot()), {
    owner: 'COLLECTOR',
    phase: 'pickup',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'PLAYER_WHITELIST',
    effects: [{ type: 'HOLD_NEW_COLLECTOR_CLAIMS', reason: 'PLAYER_WHITELIST' }],
  }, 'Whitelist must let the claimed Collector job drain while blocking new claims');

  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot(false)), {
    owner: 'PLAYER_WHITELIST',
    phase: 'conversation',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: 'PLAYER_WHITELIST',
    effects: [],
  }, 'Whitelist must own the action lane after the current Collector job drains');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_FLEE', playerName: 'Troublemaker' });

  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot()), {
    owner: 'PLAYER_FLEE',
    phase: 'preempt',
    mode: 'ACTIVE',
    blockedBy: 'COLLECTOR',
    pendingIntent: 'PLAYER_FLEE',
    effects: [{ type: 'RELEASE_COLLECTOR', reason: 'PLAYER_FLEE' }],
  }, 'Flee must preempt Collector instead of waiting behind it');

  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot(false)), {
    owner: 'PLAYER_FLEE',
    phase: 'flee',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: 'PLAYER_FLEE',
    effects: [],
  }, 'Flee intent must remain pending until the caller confirms completion');

  orchestrator.submit({ type: 'FLOW_COMPLETED', flow: 'PLAYER_FLEE' });
  assert.strictEqual(orchestrator.status().pendingIntent, null,
    'a completed safety flow must release its persistent intent');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_WHITELIST', playerName: 'TrustedFriend' });
  orchestrator.submit({ type: 'PLAYER_FLEE', playerName: 'Troublemaker' });
  orchestrator.submit({ type: 'PLAYER_WHITELIST', playerName: 'TrustedFriend' });
  assert.strictEqual(orchestrator.status().pendingIntent, 'PLAYER_FLEE',
    'a lower-priority Whitelist arrival must not replace an active safety intent');

  orchestrator.submit({ type: 'PLAYER_RETREAT', playerName: 'RepeatChaser' });
  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot()), {
    owner: 'PLAYER_RETREAT',
    phase: 'preempt',
    mode: 'ACTIVE',
    blockedBy: 'COLLECTOR',
    pendingIntent: 'PLAYER_RETREAT',
    effects: [{ type: 'RELEASE_COLLECTOR', reason: 'PLAYER_RETREAT' }],
  }, 'the third-arrival retreat must supersede normal Flee and preempt Collector');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'AB_BUFF_PENDING' });
  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot()), {
    owner: 'AB_BUFF',
    phase: 'preempt',
    mode: 'ACTIVE',
    blockedBy: 'COLLECTOR',
    pendingIntent: 'AB_BUFF_PENDING',
    effects: [{ type: 'RELEASE_COLLECTOR', reason: 'AB_BUFF_PENDING' }],
  }, 'AB Buff pending must release Collector instead of waiting indefinitely');

  orchestrator.submit({ type: 'PLAYER_FLEE', playerName: 'Troublemaker' });
  assert.strictEqual(orchestrator.status().pendingIntent, 'PLAYER_FLEE',
    'player safety must supersede AB Buff while still on the farm map');

  orchestrator.submit({ type: 'FLOW_COMPLETED', flow: 'PLAYER_FLEE' });
  assert.strictEqual(orchestrator.status().pendingIntent, 'AB_BUFF_PENDING',
    'completing a higher-priority flow must resume the older AB Buff intent instead of losing it');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_WHITELIST', playerName: 'TrustedFriend' });
  orchestrator.submit({ type: 'AB_BUFF_PENDING' });
  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot()), {
    owner: 'AB_BUFF',
    phase: 'preempt',
    mode: 'ACTIVE',
    blockedBy: 'COLLECTOR',
    pendingIntent: 'AB_BUFF_PENDING',
    effects: [{ type: 'RELEASE_COLLECTOR', reason: 'AB_BUFF_PENDING' }],
  }, 'AB Buff must release Collector while preserving the lower-priority Whitelist conversation');
  assert.strictEqual(orchestrator.status().pendingIntent, 'AB_BUFF_PENDING');
  orchestrator.submit({ type: 'FLOW_COMPLETED', flow: 'AB_BUFF_PENDING' });
  assert.deepStrictEqual(orchestrator.tick(collectorSnapshot(false)), {
    owner: 'PLAYER_WHITELIST',
    phase: 'conversation',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: 'PLAYER_WHITELIST',
    effects: [],
  }, 'Whitelist intent must survive a temporary higher-priority AB Buff lifecycle');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_WHITELIST', playerName: 'TrustedFriend' });
  const snapshot = collectorSnapshot();
  snapshot.storage = { urgent: true, active: false, phase: 'full' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'STORAGE',
    phase: 'preempt',
    mode: 'ACTIVE',
    blockedBy: 'COLLECTOR',
    pendingIntent: 'PLAYER_WHITELIST',
    effects: [{ type: 'RELEASE_COLLECTOR', reason: 'STORAGE_URGENT' }],
  }, 'hard-full Storage must break a Whitelist drain cycle when Collector cannot finish pickup');
  assert.strictEqual(orchestrator.status().pendingIntent, 'PLAYER_WHITELIST',
    'releasing Collector for hard-full Storage must not discard the Whitelist lifecycle');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.combat = { active: true, phase: 'target-active' };
  snapshot.storage = { urgent: true, active: false, phase: 'full' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'STORAGE',
    phase: 'preempt-combat',
    mode: 'ACTIVE',
    blockedBy: 'COMBAT',
    pendingIntent: null,
    effects: [{ type: 'ABANDON_COMBAT', reason: 'STORAGE_URGENT' }],
  }, 'hard-full Storage must clear a Combat target before teleporting to Kafra');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot();
  snapshot.combat.active = true;
  snapshot.combat.phase = 'attacking';
  snapshot.combat.targetId = 9001;
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'COMBAT',
    phase: 'attacking',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'COLLECTOR',
    effects: [],
  }, 'Collector must let the current Combat target finish without acquiring a new target');

  snapshot.combat.active = false;
  snapshot.loot = { atomic: true, phase: 'pickup-wait' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'NORMAL_LOOT',
    phase: 'pickup-wait',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'COLLECTOR',
    effects: [],
  }, 'Collector must wait for the defeated target\'s normal Loot lifecycle');

  snapshot.loot.atomic = false;
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'COLLECTOR',
    phase: 'pickup',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'Collector must take ownership immediately after current Combat and normal Loot drain');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot();
  snapshot.loot.atomic = true;
  snapshot.loot.phase = 'pickup-wait';
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'NORMAL_LOOT',
    phase: 'pickup-wait',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'COLLECTOR',
    effects: [],
  }, 'an existing normal Loot action must drain before Collector can use the action lane');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_WHITELIST', playerName: 'TrustedFriend' });
  const snapshot = collectorSnapshot();
  snapshot.loot = { atomic: true, phase: 'pickup-wait' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'NORMAL_LOOT',
    phase: 'pickup-wait',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'PLAYER_WHITELIST',
    effects: [{ type: 'HOLD_NEW_COLLECTOR_CLAIMS', reason: 'PLAYER_WHITELIST' }],
  }, 'Whitelist drain must finish normal Loot before resuming the claimed Collector job');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'AB_BUFF_PENDING' });
  const snapshot = collectorSnapshot(false);
  snapshot.loot = { atomic: true, phase: 'settle' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'NORMAL_LOOT',
    phase: 'settle',
    mode: 'DRAINING',
    blockedBy: null,
    pendingIntent: 'AB_BUFF_PENDING',
    effects: [],
  }, 'AB Buff must preserve an atomic normal Loot action after Collector has been released');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot();
  snapshot.rest = { active: true, postRespawn: false };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'COLLECTOR',
    phase: 'prepare-rest-exit',
    mode: 'ACTIVE',
    blockedBy: 'REST',
    pendingIntent: null,
    effects: [{ type: 'EXIT_REST', reason: 'COLLECTOR' }],
  }, 'Collector must stand and clear Rest lifecycle before issuing its next action');
}

{
  const orchestrator = createAutomationOrchestrator();
  orchestrator.submit({ type: 'PLAYER_FLEE' });
  const snapshot = collectorSnapshot();
  snapshot.dead = true;
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'DEAD_RESPAWN',
    phase: 'dead',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: 'PLAYER_FLEE',
    effects: [],
  }, 'Death/Respawn must own every action lane without discarding a pending safety intent');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot();
  snapshot.storage = { urgent: true, phase: 'full' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'STORAGE',
    phase: 'preempt',
    mode: 'ACTIVE',
    blockedBy: 'COLLECTOR',
    pendingIntent: null,
    effects: [{ type: 'RELEASE_COLLECTOR', reason: 'STORAGE_URGENT' }],
  }, 'urgent Storage must release Collector before taking the action lane');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.storage = { urgent: false, active: true, phase: 'MOVE_ITEMS' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'STORAGE',
    phase: 'MOVE_ITEMS',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'an active Storage lifecycle must remain visible after its urgent trigger is consumed');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.storage = { requested: true, urgent: false, active: false, phase: 'weight-threshold' };
  snapshot.combat = { active: true, phase: 'attacking' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'COMBAT',
    phase: 'attacking',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'soft-threshold Storage must let the current Combat target finish');

  snapshot.combat.active = false;
  snapshot.rest = { active: true, phase: 'recover' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'STORAGE',
    phase: 'prepare-rest-exit',
    mode: 'ACTIVE',
    blockedBy: 'REST',
    pendingIntent: null,
    effects: [{ type: 'EXIT_REST', reason: 'STORAGE' }],
  }, 'Storage must stand before beginning its teleport lifecycle');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.combat = { active: true, phase: 'walking' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'COMBAT',
    phase: 'walking',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'Combat must be the reported owner when no higher-priority flow is active');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.rest = { active: true, phase: 'recover' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'REST',
    phase: 'recover',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'Rest must be the reported owner when it is not being preempted');
}

{
  const orchestrator = createAutomationOrchestrator();
  const snapshot = collectorSnapshot(false);
  snapshot.search = { active: true, phase: 'find-monster' };
  assert.deepStrictEqual(orchestrator.tick(snapshot), {
    owner: 'SEARCH',
    phase: 'find-monster',
    mode: 'ACTIVE',
    blockedBy: null,
    pendingIntent: null,
    effects: [],
  }, 'monster search must be visible as the action-lane owner instead of IDLE');
}

console.log('automation orchestrator tracer regression: PASS');
