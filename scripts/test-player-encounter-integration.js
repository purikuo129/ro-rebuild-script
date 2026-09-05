#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

for (const key of [
  'fleePlayerIgnorePatterns',
  'fleePlayerConversationDelaySec',
  'fleePlayerRepeatWindowSec',
  'fleePlayerRepeatTownRestSec',
  'fleePlayerWhitelistTownRestSec',
]) {
  assert.match(source, new RegExp("'" + key + "'"), key + ' must be persisted and profile-aware');
}
assert.match(source, /fleePlayerRepeatWindowSec:\s*10,/);
assert.match(source, /fleePlayerRepeatTownRestSec:\s*300,/);
assert.match(source, /fleePlayerIgnorePatterns:\s*\[\],/);
assert.match(source, /fleePlayerConversationDelaySec:\s*4,/);
assert.match(source, /matchesPlayerWhitelist\(entity\?\.name, CFG\.fleePlayerExceptions\)/,
  'the live player flow must use the tested Regex whitelist matcher');
assert.match(source, /matchesPlayerWhitelist\(entity\?\.name, CFG\.fleePlayerIgnorePatterns\)/,
  'the live player flow must use the tested Regex ignore matcher');
assert.match(source, /conversationDelaySec:\s*CFG\.fleePlayerConversationDelaySec/,
  'conversation flow must use its own delay setting');
assert.doesNotMatch(source, /whitelistDelaySec:\s*CFG\.fleeOnPlayerDelaySec/,
  'normal Flee delay must not control the conversation flow');
assert.match(source, /Math\.min\(300, Number\(CFG\.fleeOnPlayerDelaySec\)/,
  'the runtime delay must honor the full range exposed by the UI');
assert.match(source, /if \(!CFG\.fleeOnPlayerCount \|\| CFG\.fleeOnPlayerCount <= 0\) return;/,
  'the repeat encounter flow must remain controlled by the Flee Player toggle');
assert.match(source, /function fleePlayersIfNeeded\(reasonSuffix = ''\) \{[\s\S]{0,300}shouldHoldPlayerFleeForEncounter\(playerEncounter\.status\(\)\.state\)/,
  'the shared Flee Player decision path must hold while Player Encounter owns the town/rest flow');
assert.match(source, /playerEncounter = RO_PURE_CORE\.createPlayerEncounterController\(/,
  'the live userscript must use the behavior-tested encounter interface');
assert.match(source, /playerEncounter\.observePlayer\(/, 'fresh player packets must cross the encounter interface');
assert.match(source, /const ignored = isFleePlayerIgnored\(e\);[\s\S]{0,220}ignored,/,
  'fresh player packets must pass Ignore precedence into the encounter interface');
assert.match(source, /if \(isFleePlayerIgnored\(e\) \|\| isFleePlayerException\(e\)\) continue;/,
  'periodic Flee scans must exclude both Ignore and Conversation lists');
assert.match(source, /getVerifiedAiReplyPlayer[\s\S]{0,700}isFleePlayerIgnored\(other\)/,
  'Ignore players must not enter AI/template conversation through another path');
assert.match(source, /playerEncounter\.tick\(/, 'the automation loop must let the encounter flow own work');
assert.match(source, /playerEncounter\?\.clearPresence\(\)/, 'confirmed teleports must re-arm arrival detection');
assert.match(source, /playerEncounter\.status\(\)\.state !== 'IDLE'/, 'farm-map guard must yield while encounter flow owns the map');

for (const id of [
  '__assist_fleeplayerignorepatterns',
  '__assist_fleeplayerconversationdelay',
  '__assist_fleeplayerrepeatwindow',
  '__assist_fleeplayerrepeattownrest',
  '__assist_fleeplayerwhitelisttownrest',
  '__assist_playerencounterskiprest',
  '__assist_playerencounterstatus',
]) assert.match(source, new RegExp(id), id + ' must be exposed on the HUD');

assert.match(source, /playerEncounterStatus\(\)/, 'console interface must expose encounter state');
assert.match(source, /skipPlayerEncounterRest\(\)/, 'console interface must expose the same skip-rest action as the HUD');
assert.match(source, /เมืองพัก:.*CFG\.kafraMap/,
  'the Flee UI must identify the configured Kafra town used by Player Encounter');

console.log('player encounter integration regression: PASS');
