#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.match(source, /botActivityStatus\(\) \{ return botActivityStatus\(\); \}/,
  'the current activity must be available through the public ASSIST interface');
assert.match(source, /data-botactivity/, 'the HUD must expose an always-visible activity bar');
for (const field of ['activity-main', 'activity-detail', 'activity-blocker', 'activity-since', 'activity-progress', 'activity-packet']) {
  assert.match(source, new RegExp('data-' + field), 'statistics must show ' + field);
}
assert.match(source, /lastGamePacketAgoMs/, 'diagnostics must expose the age of the latest Game Packet');
assert.match(source, /status\.code !== lastBotActivityLogCode/,
  'Activity Journal entries must be emitted only when the main activity changes');

console.log('bot activity integration regression: PASS');
