#!/usr/bin/env node
'use strict';

// Regression guard: these controls decide whether the automatic Storage loop
// can ever start.  They must persist across reload/profile switching; manual
// deposit is intentionally allowed to work even while auto Storage is off.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

function methodBody(name) {
  const match = new RegExp('\\n    ' + name + '\\s*\\(').exec(source);
  const start = match ? match.index : -1;
  assert.notStrictEqual(start, -1, 'missing ASSIST.' + name + '()');
  const end = source.indexOf('\n    },', start);
  assert.notStrictEqual(end, -1, 'could not delimit ASSIST.' + name + '()');
  return source.slice(start, end);
}

for (const name of ['storageOn', 'storageOff', 'toggleDepositOnFull', 'toggleDepositAfterSell']) {
  const body = methodBody(name);
  assert.match(body, /saveConfigDebounced\(\)/, name + ' must persist its automatic-storage setting');
}

assert.match(source, /storageStatus\(\)\s*\{/, 'missing ASSIST.storageStatus() diagnostic API');
assert.match(source, /function storageAutoBlockers\(/, 'missing a single diagnostic source for auto-storage blockers');

console.log('storage-auto-settings regression: PASS');
