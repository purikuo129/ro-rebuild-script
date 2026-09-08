#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /const automationOrchestrator = RO_PURE_CORE\.createAutomationOrchestrator\(\);/,
  'the userscript runtime must use the behavior-tested Orchestrator interface');
assert.match(source, /enabled:\s*masterBot\.enabled\(\),\s*connected:\s*!!activeWS/,
  'the runtime snapshot must prevent PAUSED or disconnected bots from reporting an active owner');
assert.match(source, /workPending:\s*!!target \|\| shouldDeferRestForNormalLoot\(now\) \|\| lootQueue\.isCollectorActive\(\)/,
  'Whitelist drain must treat the current Collector lifecycle as existing work');
assert.match(source, /workPending:[^\n]+\|\| isAbBuffPending\(\) \|\| isAbBuffActive\(\)/,
  'Whitelist drain must wait for an already pending/active AB Buff lifecycle');
assert.match(source, /workPending:[^\n]+\|\| storageState !== 'IDLE'/,
  'Whitelist drain must wait for an already active Storage lifecycle');
assert.match(source, /function shouldDrainCollectorForWhitelist\(\)/,
  'Collector must have an explicit Whitelist drain policy');
assert.match(source, /if \(homeReturn\) \{\s*if \(shouldDrainCollectorForWhitelist\(\)\) \{[\s\S]{0,180}homeReturn = null;/,
  'Whitelist must cancel Collector return-home without opening a new claim window');
assert.match(source, /if \(isPlayerEncounterActive\(\) && !shouldDrainCollectorForWhitelist\(\)\) return;/,
  'Player Encounter must not freeze a Collector lifecycle that Whitelist is draining');
assert.match(source, /function storageLoopTick\(\) \{[\s\S]{0,220}if \(isPlayerEncounterActive\(\) && !\(shouldDrainCollectorForWhitelist\(\) && storageState !== 'IDLE'\)\) return;/,
  'Whitelist must let an already active Storage lifecycle drain instead of deadlocking both flows');
assert.match(source, /const abBuffLoop = setInterval\(\(\) => \{[\s\S]{0,220}if \(isPlayerEncounterActive\(\) && !\(shouldDrainCollectorForWhitelist\(\) && abBuffState !== 'IDLE'\)\) return;/,
  'Whitelist must let an already pending/active AB Buff lifecycle drain instead of deadlocking both flows');
assert.match(source, /submitAutomationIntent\(\{ type: 'PLAYER_WHITELIST'/,
  'a Whitelist arrival must persist an Orchestrator intent');
assert.match(source, /releaseForOrchestrator\(reason\)/,
  'the runtime adapter must expose an idempotent Collector preemption effect');
assert.match(source, /combat:\s*\{\s*active:\s*!!target/,
  'the runtime snapshot must report an active Combat target to the Orchestrator');
assert.match(source, /search:\s*\{\s*active:\s*CFG\.combatEnabled/,
  'the runtime snapshot must report monster search for truthful HUD ownership');
assert.doesNotMatch(source, /abandonTarget\('Collector priority'/,
  'Collector must never discard the current Combat target');
assert.match(source, /const automationDecision = applyAutomationDecision\(automationOrchestrator\.tick\(automationSnapshot\(\)\)\);[\s\S]{0,180}lootQueue\.isCollectorActive\(\) && automationDecision\.owner !== 'COMBAT'/,
  'Combat loop must continue only the current target while Orchestrator reports COMBAT draining');
assert.match(source, /if \(lootQueue\.isCollectorActive\(\) && !target\) return;/,
  'Combat must not acquire a replacement target after the draining target disappears');
assert.match(source, /function shouldDrainNormalLootForCollector\(now = nowMs\(\)\)/,
  'normal Loot must expose one atomic-drain decision to Collector and Loot adapters');
assert.match(source, /loot:\s*\{\s*atomic:\s*shouldDrainNormalLootForCollector\(\)/,
  'the runtime snapshot must report normal Loot ownership to the Orchestrator');
assert.match(source, /if \(lootQueue\.isCollectorBusy\(\) && !shouldDrainNormalLootForCollector\(\)\) return;/,
  'normal Loot must continue draining an existing queue while Collector waits');
assert.match(source, /const warpLoop = setInterval\([\s\S]{0,260}if \(lootQueue\.isCollectorActive\(\)\) return;/,
  'Warp-to-Loot must not run while Collector owns or is acquiring the action lane');
assert.match(source, /rest:\s*\{\s*active:\s*isResting \|\| postRespawnRest/,
  'the runtime snapshot must report the complete Rest lifecycle');
assert.match(source, /effect\.type === 'EXIT_REST'[\s\S]{0,180}exitRestForOrchestrator\(effect\.reason\)/,
  'the runtime adapter must execute the Orchestrator Rest-exit transition with the owning flow');
assert.match(source, /if \(isResting \|\| postRespawnRest\) \{\s*exitRestForCollector\(\);\s*return;\s*\}/,
  'Collector must finish Stand/reset in one tick before sending its next action');
assert.match(source, /function setAbBuffState\(next, reason = ''\)[\s\S]{0,420}submitAutomationIntent\(\{ type: 'AB_BUFF_PENDING'/,
  'AB Buff must submit its persistent intent when entering PENDING_IDLE');
assert.match(source, /function stopAbBuff\(reason\)[\s\S]{0,420}completeAutomationFlow\('AB_BUFF_PENDING'\)/,
  'AB Buff must release its Orchestrator intent when the lifecycle stops');
assert.match(source, /abBuff:\s*\{\s*pending:\s*isAbBuffPending\(\),\s*active:\s*isAbBuffActive\(\)/,
  'the runtime snapshot must expose AB Buff state through the Orchestrator seam');
assert.match(source, /storage:\s*\{[^\n]*urgent:\s*!!storageTrigger\?\.urgent/,
  'the runtime snapshot must expose urgent Storage ownership');
assert.match(source, /storage:\s*\{[^\n]*requested:\s*!!storageTrigger/,
  'the runtime snapshot must expose a soft Storage request without inventing another intent flow');
assert.match(source, /if \(reason === 'STORAGE_URGENT'\) return releaseActiveForStorage\(\);/,
  'the Collector adapter must reuse the existing Storage release flow');
assert.match(source, /orchestrator:\s*automationOrchestrator\.tick\(automationSnapshot\(\)\)/,
  'Bot Activity must project the latest Orchestrator owner and transition state');
assert.match(source, /data-orchestrator-owner/,
  'the Stats UI must expose the current Orchestrator owner');
assert.match(source, /orchestratorStatus\(\)\s*\{\s*return automationOrchestrator\.status\(\);\s*\}/,
  'the console API must expose Orchestrator diagnostics');
assert.doesNotMatch(source, /if \(sent && result\) completeAutomationFlow\('PLAYER_RETREAT'\);/,
  'Player Retreat ownership must persist through town rest and return-farm, not end when teleport is merely sent');
assert.match(source, /const collectorDecision = applyAutomationDecision\(automationOrchestrator\.tick\(automationSnapshot\(\)\)\);/,
  'Collector must pass through the Orchestrator before issuing a movement or pickup action');
{
  const collectorTick = source.slice(source.indexOf('      tick() {', source.indexOf('const lootQueue = (() => {')), source.indexOf('      releaseForOrchestrator(reason)'));
  const renewAt = collectorTick.indexOf("send({ type: 'renew'");
  const ownershipAt = collectorTick.indexOf('const collectorDecision = applyAutomationDecision');
  assert(renewAt >= 0 && ownershipAt >= 0 && renewAt < ownershipAt,
    'Collector must renew its claimed job while Combat/normal Loot are draining');
}
assert.match(source, /const buffLoop = setInterval\([\s\S]{0,300}if \(lootQueue\.isCollectorActive\(\) \|\| isWarpGuardActive\(\)\) return;/,
  'Auto Buff must not inject an item command into Collector or teleport transitions');
assert.match(source, /effect\.type === 'ABANDON_COMBAT'[\s\S]{0,180}abandonTarget\([^,]+, false\)/,
  'the Combat preemption adapter must use the Orchestrator effect reason');
assert.match(source, /if \(storageState === 'IDLE'\) \{[\s\S]{0,420}applyAutomationDecision\(automationOrchestrator\.tick\(automationSnapshot\(\)\)\)/,
  'Storage must acquire ownership and clear conflicting Combat before starting its teleport lifecycle');
assert.match(source, /const storageDecision = applyAutomationDecision\(automationOrchestrator\.tick\(automationSnapshot\(\)\)\);[\s\S]{0,160}storageDecision\.owner !== 'STORAGE'/,
  'Storage must not start while a higher-priority owner or a draining Combat target still holds the lane');

console.log('orchestrator runtime integration regression: PASS');
