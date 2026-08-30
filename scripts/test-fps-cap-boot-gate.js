#!/usr/bin/env node
'use strict';

// Unity also relies on requestAnimationFrame while it downloads and initializes
// its WASM runtime. A persisted cap must therefore wait until the loading bar
// was visible and is subsequently hidden by a successful Unity boot.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');
const published = fs.readFileSync('ro-rebuild-pure.user.js', 'utf8');

assert.strictEqual(published, source, 'published userscript must match the source copy');
assert.match(source, /let unityBootCompleted = false;/, 'missing Unity boot gate state');
assert.match(source, /function setConfiguredFpsCap\(value\)/, 'FPS config must defer activation until the gate opens');
assert.match(source, /if \(unityBootCompleted && !fpsCapMapLoadActive\) fpsCap\.set\(fps\);/, 'configured cap must stay released during a map load');
assert.match(source, /let loadingBarSeenVisible = false;/, 'must not mistake the initial hidden loading bar for a completed boot');
assert.match(source, /if \(!loadingBarSeenVisible \|\| visible\) return;/, 'cap must wait for visible → hidden transition');
assert.match(source, /new MutationObserver\(check\)/, 'loading-bar transition must be observed without a polling loop');
assert.match(source, /const profileFpsCap = setConfiguredFpsCap\(CFG\.renderFpsCap\);/, 'profile changes must use the gate');
assert.match(source, /const importedFpsCap = setConfiguredFpsCap\(CFG\.renderFpsCap\);/, 'imports must use the gate');
assert.match(source, /setFpsCap\(value\) \{\s*const fps = setConfiguredFpsCap\(value\);/, 'manual FPS changes must use the gate');
assert.doesNotMatch(source, /const initialFpsCap = fpsCap\.set\(CFG\.renderFpsCap\);/, 'must not patch rAF during document-start');
assert.match(source, /function suspendFpsCapForMapLoad\(/, 'cross-map loads must temporarily release the FPS cap');
assert.match(source, /function settleFpsCapAfterMapLoad\(/, 'the configured cap must return after the new map settles');
assert.match(source, /if \(crossMap\) suspendFpsCapForMapLoad\(/, 'release the cap before a cross-map teleport packet is sent');
assert.match(source, /currentMap = name;\s*settleFpsCapAfterMapLoad\(/, 'start the restore delay only after MAP_NAME confirms the new map');
assert.match(source, /if \(u\[0\] === 0x40 && u\.length >= 3\)/, 'manual cross-map teleport packets must also release the cap');

console.log('fps-cap-boot-gate regression: PASS');
