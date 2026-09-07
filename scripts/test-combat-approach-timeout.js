const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');

const timeoutMatch = source.match(/(function combatApproachTimeoutMs\([\s\S]*?\n  \})\n  function combatApproachTimedOut/);
assert(timeoutMatch, 'หา combatApproachTimeoutMs ไม่พบ');
const timedOutMatch = source.match(/(function combatApproachTimedOut\([\s\S]*?\n  \})\n  function/);
assert(timedOutMatch, 'หา combatApproachTimedOut ไม่พบ');

function makeHelpers(CFG) {
  return Function('CFG', timeoutMatch[1] + '; ' + timedOutMatch[1] + '; return { combatApproachTimeoutMs, combatApproachTimedOut };')(CFG);
}

{
  const helpers = makeHelpers({ warpToMonsterApproachTimeoutSec: 5 });
  assert.strictEqual(helpers.combatApproachTimeoutMs(), 5000);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 0 }, 5999), false);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 0 }, 6000), true);
  assert.strictEqual(helpers.combatApproachTimedOut({ approachStartedAt: 1000, lastAttackSignalAt: 5500 }, 7000), false,
    'เมื่อเริ่มตีจริงแล้ว timer เข้าหาเป้าต้องหยุด');
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
