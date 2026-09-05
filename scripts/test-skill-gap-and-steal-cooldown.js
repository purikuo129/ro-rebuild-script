#!/usr/bin/env node
'use strict';

// Global gap serialises different skills.  A Steal retry is a repeat of the
// same skill, so it must be paced by Steal's editable cooldown/result wait.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.match(source, /@version\s+1\.3\.0/);
assert.match(source, /const VERSION = '1\.3\.0';/);
assert.match(source, /'skillEnabled', 'skills', 'disabledSkillIds', 'skillCommandGapMs'/,
  'the global gap must persist');
assert.match(source, /skillCommandGapMs: 1500,\s*\/\/ เว้นเฉพาะระหว่างสกิลคนละชนิด/,
  'the 1.5s global gap remains the safe default');
assert.match(source, /function skillCommandWaitMs\(nextSkillId, now = nowMs\(\)\) \{[\s\S]{0,300}lastSkillPacketId === Number\(nextSkillId\)[\s\S]{0,80}return 0;/,
  'repeating the same skill must not be blocked by the cross-skill gap');
assert.match(source, /let lastSkillPacketAt = 0, lastSkillPacketId = null;/);
assert.match(source, /lastSkillPacketId = Number\(skillId\);/);
assert.doesNotMatch(source, /STEAL_RESULT_WAIT_MS/,
  'Steal must not have a hidden retry timer');
assert.match(source, /function stealResultWaitMs\(skill\) \{[\s\S]{0,300}skill\.cooldownMs/,
  'Steal result wait must use its editable cooldown');
assert.match(source, /cooldownMs: 800, job: 'Thief'/,
  'new Steal presets must default to an 800ms result/retry wait');
assert.match(source, /target\.stealResultDueAt = now \+ stealResultWaitMs\(skill\);/,
  'each Steal attempt must capture its configured result deadline');
assert.match(source, /เว้นระหว่างสกิลคนละชนิด \(ms\)/,
  'the UI must expose the cross-skill gap');

console.log('skill-gap and Steal cooldown regression: PASS');
