#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

assert.match(source, /'noMonsterWarpSec'/, 'no-monster warp timeout must remain profile-persisted');
assert.match(source, /id="__assist_nomonsterwarpsec"/, 'Combat UI must expose the no-monster warp timeout');
assert.match(source, /ASSIST\.setNoMonsterWarpSec\(noMonsterWarpSec\)/,
  'Combat Apply must save the UI timeout through the existing setting API');
assert.match(source, /syncInput\('#__assist_nomonsterwarpsec', CFG\.noMonsterWarpSec\)/,
  'Combat UI must show the current no-monster warp timeout');
assert.match(source, /if \(CFG\.warpFindEnabled && noMonSec >= CFG\.noMonsterWarpSec/,
  'runtime must continue to use the same configured timeout');

console.log('no-monster warp UI regression: PASS');
