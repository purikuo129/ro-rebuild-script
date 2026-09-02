#!/usr/bin/env node
'use strict';

// Player-support skills must reuse the existing Auto Skill queue.  Their
// recipient selection is profile data on the skill itself, while packet order
// remains owned by the one global skill lane.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /let autoSupportQueue = \[\];\s*\/\/ \[\{ skill, kind, targetId, targetName \}\]/,
  'Self/Ally and player-support work must share one Auto Skill queue');
assert.match(source, /function buildSupportJobForRecipient\(recipient, skill, now\) \{[\s\S]{0,1800}kind: 'buff-other'/,
  'the support module must create named-player work as queue jobs');
assert.match(source, /function buildAutoSupportJobs\(now, allowOtherPlayers\) \{[\s\S]{0,1200}collectSupportRecipients\(\)[\s\S]{0,900}for \(const recipient of recipients\)[\s\S]{0,900}for \(const skill of CFG\.skills\)/,
  'support jobs must be recipient-major: finish one player’s Skill Set before moving to the next player');
assert.match(source, /function collectSupportRecipients\(\) \{[\s\S]{0,1800}recipients\.push\(recipient\)/,
  'the recipient list must be snapshotted before a Support batch begins');
assert.match(source, /function findNamedSupportTarget\(name, skill, now\) \{[\s\S]{0,700}normalizedPlayerName\(entity\.name\) !== name/,
  'configured support names must use exact normalized matching, not partial matching');
assert.match(source, /function isConfiguredSupportName\(skill, name\) \{[\s\S]{0,380}normalizedPlayerName\(configured\) === normalized/,
  'a queued support target must be revalidated against the same exact-name rule');
assert.match(source, /buffMode: !!s\.buffMode,[\s\S]{0,260}buffNames: Array\.isArray\(s\.buffNames\)[\s\S]{0,180}buffIncludeSelf: !!s\.buffIncludeSelf/,
  'support recipient settings must survive the public Skill configuration interface');
assert.match(source, /s\.buffMode = mode === 'buff';[\s\S]{0,360}s\.buffNames = supportNames;[\s\S]{0,180}s\.buffIncludeSelf = getVal\('buffIncludeSelf'\) === '1';/,
  'the Skill editor must save named Support recipients and self inclusion');
assert.match(source, /<option value="buff"[^>]*>support — บัพตัวเอง\/ผู้เล่นตามชื่อ<\/option>/,
  'the Skill editor must expose a distinct player-support mode');
assert.match(source, /กดชื่อสกิลเพื่อเพิ่มหรือเปิดแก้ไข[\s\S]{0,500}data-open-support="\$\{s\.skillId\}"/,
  'the Skill popup must expose direct buttons for player-support skills');
assert.match(source, /const supportTargetUse = new Map\(\);[\s\S]{0,1800}const supportRepeatMs = \(skill\) =>/,
  'per-target repetition belongs to the support module rather than a parallel timer');
assert.match(source, /if \(!allowOtherPlayers && autoSupportQueue\.length\) \{[\s\S]{0,220}job\.kind !== 'buff-other'/,
  'Collector may keep only self-oriented support work and must release external support jobs');
assert.doesNotMatch(source, /const supportCastGapMs\b|now - \(lastSkillUse\.get\(job\.skill\.skillId\) \|\| 0\) < supportCastGapMs/,
  'a Skill cooldown must not block a different named player; support repetition is per Skill + recipient');
assert.match(source, /function supportQueueCommandWaitMs\(now = nowMs\(\)\) \{[\s\S]{0,180}lastSkillPacketAt \+ skillCommandGapMs\(\) - now/,
  'every support packet must use the existing Global Skill Gap for ordered sends');
assert.match(source, /if \(supportQueueCommandWaitMs\(now\) > 0\) return true;[\s\S]{0,180}sendSkill\(job\.skill\.skillId, job\.skill\.level \|\| 1, job\.targetId, null, null\)/,
  'the support queue must wait for the shared lane before sending its next recipient');
assert.match(source, /function getSupportSkillState\(skill, now\) \{[\s\S]{0,1500}supportTargetLastUse\(skill\.skillId, targetEntity\.id\)/,
  'Support HUD state must read the per-recipient timer rather than a skill-wide cooldown');
assert.match(source, /function getIdleSupportSkillState\(skill, now\) \{[\s\S]{0,1800}รอรอบใช้ซ้ำของ Skill/,
  'Self/Ally readiness must expose the exact reason when its timer blocks a Skill');
assert.match(source, /skillQueueStatus\(\) \{[\s\S]{0,3000}getAutoSupportBlockers\(now\)[\s\S]{0,1200}getIdleSupportSkillState\(skill, now\)/,
  'the public diagnostic must report queue blockers and per-Skill readiness');
assert.match(source, /if \(c\.support\) \{[\s\S]{0,1200}รอรายชื่อ:[\s\S]{0,300}ไม่เห็น\/ไกล:/,
  'Support HUD must distinguish each recipient’s cooldown from a missing or distant player');
assert.match(source, /const remainingSec = Math\.ceil\(c\.remainingMs \/ 1000\);[\s\S]{0,350}รอ ' \+ remaining/,
  'ordinary Auto-Skill HUD state must show the actual remaining time, not an unexplained cooldown label');
assert.match(source, /sendSkill\(job\.skill\.skillId, job\.skill\.level \|\| 1, job\.targetId, null, null\)/,
  'the queued job must send the selected player entity id');
assert.match(source, /function confirmPendingSupportSkillByPacket\(skillId, targetId, now = nowMs\(\)\) \{[\s\S]{0,900}markSupportTargetUse\(job\.skill\.skillId, job\.targetId, now\)/,
  'Support rebuff time must start only after the server confirms the targeted Skill packet');
assert.match(source, /if \(u\.length >= 16\) \{[\s\S]{0,500}confirmPendingSupportSkillByPacket\(skillId, skillTargetId, nowMs\(\)\)/,
  'the inbound targeted Skill event must be used as the server-side Support confirmation');
assert.match(source, /function supportConfirmationWaitMs\(skill\) \{[\s\S]{0,260}skill\.cooldownMs/,
  'Support confirmation must reuse the Skill cooldown setting rather than a hidden timeout');
assert.match(source, /if \(isPendingSupportJob\(job\)\) \{[\s\S]{0,700}now - job\.pendingAt < supportConfirmationWaitMs\(job\.skill\)[\s\S]{0,600}deferSupportRecipient\(job, now\)[\s\S]{0,180}dropSupportRecipientJobSet\(job\)/,
  'a missing server confirmation must release the whole recipient Skill Set instead of blocking the queue indefinitely');
assert.match(source, /for \(const recipient of recipients\) \{[\s\S]{0,240}isSupportRecipientDeferred\(recipient, now\)/,
  'a failed recipient must wait through the existing Skill cooldown before beginning another Skill Set');
assert.match(source, /if \(supportQueueCommandWaitMs\(now\) > 0\) return true;[\s\S]{0,280}if \(isServerConfirmedSupportJob\(job\)\) \{[\s\S]{0,220}job\.pendingAt = now/,
  'a newly sent Support job must enter pending state instead of completing optimistically');
assert.doesNotMatch(source, /if \(!sendSkill\(job\.skill\.skillId, job\.skill\.level \|\| 1, job\.targetId, null, null\)\) return true;\s*autoSupportQueue\.shift\(\);[\s\S]{0,250}markSupportTargetUse\(job\.skill\.skillId, job\.targetId, now\)/,
  'sending a Support packet alone must never start that target\'s rebuff interval');
assert.match(source, /function applyObservedPlayerHp\(id, cur, m\) \{[\s\S]{0,500}entity\.hp = cur;[\s\S]{0,120}entity\.hpMax = m;/,
  'Heal support must use the observed HP of a named player');

const supportStart = source.indexOf('const supportTargetUse = new Map();');
const supportEnd = source.indexOf('// MOVE OUT', supportStart);
assert(supportStart >= 0 && supportEnd > supportStart, 'support queue seam not found');
const supportModule = source.slice(supportStart, supportEnd);
assert.doesNotMatch(supportModule, /setInterval\(/,
  'player support must not create a second packet-sending loop');

console.log('support-skill-queue regression: PASS');
