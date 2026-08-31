#!/usr/bin/env node
'use strict';

// A teleport in flight is serialised by the active-request guard.  No global
// cooldown should delay a different, valid cross-map flow after confirmation.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.doesNotMatch(source, /TELEPORT_CROSS_MAP_GAP_MS/,
  'cross-map requests must not inherit a global cooldown after confirmation');
assert.match(source, /if \(active\) \{[\s\S]{0,260}return false;/,
  'an outstanding teleport confirmation must remain serialised independently of the short gap');

console.log('teleport coordinator gap regression: PASS');
