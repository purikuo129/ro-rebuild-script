const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');

const walkMatch = source.match(/(function walkToTarget\([\s\S]*?\n  \})\n\n  \/\/ STUCK/);
assert(walkMatch, 'หา walkToTarget ไม่พบ');

{
  const player = { x: 0, y: 0 };
  const moves = [];
  const walkToTarget = Function('CFG', 'player', 'moves', `
    let lastWalkPos = null, lastWalkProgressAt = 0, stuckRecoveryAt = 0;
    let stuckRecoveryUsed = false, lastWalkToTargetAt = 0;
    const COMBAT_MOVE_RETRY_MS = 800;
    const STUCK_NO_MOVE_MS = 5000, STUCK_RECOVERY_GRACE_MS = 3000;
    const combatGatChaseStep = () => null;
    const sendMove = (x, y) => { moves.push({ x, y }); return true; };
    const log = () => {};
    ${walkMatch[1]}
    return walkToTarget;
  `)({ maxAcquireDistance: 15, walkStepDistance: 20 }, player, moves);
  const result = walkToTarget(1000, { id: 1, name: 'mob', x: 15, y: 1 }, 15);
  assert.strictEqual(Math.hypot(15, 1) > 15, true, 'fixture ต้องอยู่นอก acquire range');
  assert.strictEqual(result, 'WALKING', 'เกิน 15 ช่องแม้เพียงเล็กน้อยต้องเริ่มเดิน ไม่ยืนรอ timeout');
  assert.strictEqual(moves.length, 1, 'direct fallback ต้องส่ง MOVE ก่อนวาร์ป');
}

const timeoutMatch = source.match(/(function combatApproachTimeoutMs\([\s\S]*?\n  \})\n  function combatApproachTimedOut/);
assert(timeoutMatch, 'หา combatApproachTimeoutMs ไม่พบ');
const timedOutMatch = source.match(/(function combatApproachTimedOut\([\s\S]*?\n  \})\n  function/);
assert(timedOutMatch, 'หา combatApproachTimedOut ไม่พบ');

function makeHelpers(CFG) {
  return Function('CFG', timeoutMatch[1] + '; ' + timedOutMatch[1] + '; return { combatApproachTimeoutMs, combatApproachTimedOut };')(CFG);
}

// Full direct-walk timeline when GAT is unavailable. A MOVE packet can be lost
// or rejected without producing a player-position packet; Combat must keep
// issuing the existing throttled walk command while the overall warp timer runs.
{
  const player = { x: 0, y: 0 };
  const moves = [];
  let tickNow = 0;
  const walkToTarget = Function('CFG', 'player', 'moves', 'clock', `
    let lastWalkPos = null, lastWalkProgressAt = 0, stuckRecoveryAt = 0;
    let stuckRecoveryUsed = false, lastWalkToTargetAt = 0;
    const COMBAT_MOVE_RETRY_MS = 800;
    const STUCK_NO_MOVE_MS = 5000, STUCK_RECOVERY_GRACE_MS = 3000;
    const combatGatChaseStep = () => null;
    const sendMove = (x, y) => { moves.push({ at: clock(), x, y }); return true; };
    const log = () => {};
    ${walkMatch[1]}
    return walkToTarget;
  `)({ maxAcquireDistance: 15, walkStepDistance: 20 }, player, moves, () => tickNow);
  const helpers = makeHelpers({ warpToMonsterApproachTimeoutSec: 5 });
  const target = { approachStartedAt: 1000, lastAttackSignalAt: 0, followObservedAt: 0 };
  const monster = { id: 1, name: 'mob', x: 19, y: 0 };
  let warpAt = 0;
  for (tickNow = 1000; tickNow <= 6000; tickNow += 200) {
    if (helpers.combatApproachTimedOut(target, tickNow)) { warpAt = tickNow; break; }
    walkToTarget(tickNow, monster, 15);
  }
  assert.strictEqual(warpAt, 6000, 'fixture ต้องไปถึง overall approach timeout');
  assert(moves.length >= 5,
    'ก่อนวาร์ป direct-walk ต้องส่ง MOVE ต่อเนื่องตาม throttle เดิม ไม่ใช่ส่งครั้งเดียวแล้วยืนรอ');
  const largestGap = Math.max(...moves.slice(1).map((move, index) => move.at - moves[index].at));
  assert(largestGap <= 1000, 'ห้ามมีช่วงเงียบเกิน 1s ระหว่าง MOVE ขณะยังจับเวลาวาร์ป');
}

{
  const helpers = makeHelpers({ warpToMonsterApproachTimeoutSec: 5 });
  assert.strictEqual(helpers.combatApproachTimeoutMs(), 5000);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 0 }, 5999), false);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 0 }, 6000), true);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 5500 }, 7000), false,
    'เมื่อเริ่มตีจริงแล้ว timer เข้าหาเป้าต้องหยุด');
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 0, followObservedAt: 2000 }, 7000), false,
    'เมื่อ Attack-follow ทำให้ตัวละครเดินแล้วต้องไม่วาร์ปแทรก');
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 5000, lastAttackSignalAt: 4000 }, 10000), true,
    'signal เก่าจากรอบก่อนต้องไม่ปิด timer ของการเข้าหาเป้ารอบใหม่');
}

{
  const helpers = makeHelpers({ warpToMonsterApproachTimeoutSec: 0 });
  assert.strictEqual(helpers.combatApproachTimeoutMs(), 0);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 0 }, 999999), false,
    '0 ต้องปิด timed warp');
}

assert(source.includes("'warpToMonsterApproachTimeoutSec'"), 'ค่าต้องถูก persist/profile');
assert.match(source, /maxAcquireDistance:\s*15,/,
  'ระยะ Attack-follow ต้องใช้ค่าเริ่มต้นเดิม จนกว่าผู้ใช้จะปรับใน UI');
assert(source.includes('id="__assist_maxacquiredistance"'),
  'ระยะส่ง Attack-follow ต้องปรับได้บน Combat UI');
assert(!source.includes("roPureCombatAcquireDistance16V1"),
  'ห้าม migrate หรือบังคับเปลี่ยนระยะ Attack-follow ของผู้ใช้');
assert(source.includes('id="__assist_warptomonapproachtimeout"'), 'ต้องมีช่องตั้งค่าใน Combat UI');
assert(!source.includes('CFG.warpToMonster && noMoveMs >= CFG.attackProbeMs'),
  'attackProbeMs ห้ามชิงสั่ง warp จาก direct walk');
assert(source.includes("target.forceApproachWalk = true"),
  'Attack-follow ที่ไม่ตอบต้องเปลี่ยนไปเดินต่อ ไม่ยืนนิ่งรอ warp');
assert(source.includes("approachResult === 'STUCK'"),
  'GAT/direct STUCK ต้องเข้า replan flow แยกจาก timed warp');
assert(source.includes("handleUnreachable(m, 'เข้าหาเป้าเกิน"),
  'ครบเวลารวมต้องเข้า warp/unreachable flow');
assert(source.includes("handleUnreachable(m, 'GAT หาเส้นทางไปหาเป้าไม่ได้')"),
  'NO_PATH ต้องยังวาร์ปได้ทันที');

console.log('combat approach timeout regression tests passed');
