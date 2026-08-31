#!/usr/bin/env node
'use strict';

// A direct "use skill now" request used to bypass the Collector ownership
// gate.  It could therefore send 0x1d while the collector was waiting for a
// pickup result.  The request must stay queued, without a new retry timer,
// until the existing combat loop observes that the collector job is over.
const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('RO Rebuild Pure.js', 'utf8');

const manualStart = source.indexOf('function drainManualSkillQueue()');
const manualEnd = source.indexOf('// Self/ally support skills must not depend on Combat being ON.', manualStart);
assert(manualStart >= 0 && manualEnd > manualStart, 'manual skill queue seam not found');
const manualDrain = source.slice(manualStart, manualEnd);
assert.match(manualDrain, /if \(lootQueue\.isCollectorBusy\(\)\) return;/,
  'manual skill packets must wait while Collector owns an active loot job');
assert.match(manualDrain, /if \(lootQueue\.isCollectorBusy\(\)\) return;[\s\S]{0,300}const wait = skillCommandWaitMs/,
  'the collector check must happen before the manual queue can dequeue/send a skill');

const combatStart = source.indexOf('const combatLoop = setInterval(() => {');
const combatEnd = source.indexOf('// Player Flee เป็น safety flow', combatStart);
assert(combatStart >= 0 && combatEnd > combatStart, 'combat-loop prelude seam not found');
const combatPrelude = source.slice(combatStart, combatEnd);
assert.match(combatPrelude, /if \(!lootQueue\.isCollectorBusy\(\) && manualSkillQueue\.length && !manualSkillQueueTimer\) drainManualSkillQueue\(\);/,
  'the existing combat loop must resume a deferred manual queue as soon as Collector is idle');
assert.doesNotMatch(manualDrain, /setTimeout\(drainManualSkillQueue,\s*(?:150|200|250|500|1000)\)/,
  'Collector priority must not introduce a hidden manual-skill polling delay');

console.log('manual-skill-after-loot-queue regression: PASS');
