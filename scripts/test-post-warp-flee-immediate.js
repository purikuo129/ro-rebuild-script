const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const fleeMatch = source.match(/(function fleePlayersIfNeeded\([\s\S]*?\n  \})\n\n  \/\/ ดักทันที/);
const scanMatch = source.match(/(function runPostWarpFleeScan\([\s\S]*?\n  \})\n  function acquireTarget/);
assert(fleeMatch && scanMatch, 'หา Player Flee post-warp flow ไม่พบ');

let now = 1000;
let fleeCalls = 0;
const harness = Function(
  'CFG', 'nowMs', 'onFlee',
  `let fleePlayerDetectedAt = 0;
   let fleePlayerDeferredForLoot = false;
   let postWarpFleeScanPending = true;
   let isResting = false;
   let postRespawnRest = false;
   const masterBot = { enabled: () => true };
   const RO_PURE_CORE = { shouldHoldPlayerFleeForEncounter: () => false };
   const playerEncounter = { status: () => ({ state: 'IDLE' }) };
   const player = { x: 10, y: 10 };
   const queue = new Map();
   const pickupPending = null;
   const resetFleePlayerDelay = () => { fleePlayerDetectedAt = 0; fleePlayerDeferredForLoot = false; };
   const isAiReplyInteractionActive = () => false;
   const shouldHoldFleePlayer = () => false;
   const countOtherPlayers = () => 1;
   const dbg = () => {};
   const log = () => {};
   const doFlee = reason => { onFlee(reason); return true; };
   ${fleeMatch[1]}
   ${scanMatch[1]}
   return { runPostWarpFleeScan };`,
)({ fleeOnPlayerCount: 1, fleeOnPlayerRadius: 20, fleeOnPlayerDelaySec: 4, lootEnabled: false }, () => now, () => { fleeCalls++; });

assert.strictEqual(harness.runPostWarpFleeScan(), true, 'post-warp scan ต้องถือ flow ไว้');
assert.strictEqual(fleeCalls, 1, 'พบผู้เล่นทันทีหลังลงวาร์ปต้องสั่ง Flee ทันที ไม่รอดีเลย์ทั่วไป 4 วินาที');

const loopStart = source.indexOf('const combatLoop = setInterval(() => {');
const loopEnd = source.indexOf('// === 1b. Defensive target acquire ===', loopStart);
const combatLoop = source.slice(loopStart, loopEnd);
const postWarpPriority = combatLoop.indexOf('postWarpFleeScanPending && isWarpGuardActive(now)');
const normalFlee = combatLoop.indexOf('fleePlayersIfNeeded(', postWarpPriority);
assert(postWarpPriority >= 0 && normalFlee >= 0 && postWarpPriority < normalFlee,
  'combat loop ต้องยืนยันตำแหน่งและทำ post-warp safety scan ก่อนเข้า Flee delay ปกติ');
assert(source.includes('lastPlayerPositionPacketAt > warpGuardPositionPacketAt'),
  'Game Packet ตำแหน่งสดต้องปลด warp guard ได้ แม้ว่าวาร์ปสุ่มกลับมาพิกัดเลขเดิม');
assert(source.includes('const postWarpImmediate = nowMs() < postWarpTargetSettleUntil;')
  && source.includes("{ immediate: postWarpImmediate }"),
  'ผู้เล่นที่ SPAWN ระหว่าง post-warp settle ต้องข้ามดีเลย์ทั่วไปเช่นกัน');
assert(combatLoop.includes("fleePlayersIfNeeded('', { immediate: now < postWarpTargetSettleUntil })"),
  'periodic Flee scan ระหว่าง post-warp settle ต้องข้ามดีเลย์ แม้ไม่มี SPAWN callback');

console.log('post-warp immediate Player Flee regression: PASS');
