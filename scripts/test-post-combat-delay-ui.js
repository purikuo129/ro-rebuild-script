#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /postCombatDelayMs:\s*200,/,
  'new and reset profiles must default post-combat delay to 200ms');
assert.match(source, /id="__assist_postcombatdelay"/,
  'Combat UI must expose the existing post-combat delay setting');
assert.match(source, /ASSIST\.setPostCombatDelay\(postCombatDelay\)/,
  'Combat Apply must save the post-combat delay through its existing API');
assert.match(source, /syncInput\('#__assist_postcombatdelay', CFG\.postCombatDelayMs\)/,
  'Combat UI must show the active profile value');
assert.match(source, /setPostCombatDelay\(ms\)\s*\{[\s\S]{0,350}saveConfigDebounced\(\)/,
  'the setter used by the UI must persist the value');

console.log('post-combat delay UI regression: PASS');
