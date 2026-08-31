#!/usr/bin/env node
'use strict';

// Status cleansing has an unknown server protocol.  The capture must observe
// a self status application, then retain outgoing packets for the manual
// right-click window without sending an automatic cleanse command.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.match(source, /function startStatusCleanseCapture\(seconds = 300\)/,
  'capture needs an explicit, bounded start function');
assert.match(source, /if \(op !== 0x3d && op !== 0x3e\) return;/,
  'only self status lifecycle packets should arm the capture');
assert.match(source, /STATUS_CLEANSE_CAPTURE_OUTBOUND_WINDOW_MS = 8000/,
  'outbound capture must be limited to the manual right-click window');
assert.match(source, /statusCleanseCaptureOn\(seconds = 300\)/,
  'the console API must expose capture start');
assert.match(source, /statusCleanseCaptureDump\(\)/,
  'the console API must expose a shareable capture dump');
assert.match(source, /captureStatusCleanseInbound/, 'inbound status packets must reach the capture');
assert.match(source, /captureStatusCleanseOutbound/, 'outbound packets must reach the capture');
assert.doesNotMatch(source, /sendStatusCleanse\(/,
  'the capture must not send an unknown status-cleanse packet');

console.log('status-cleanse capture regression: PASS');
