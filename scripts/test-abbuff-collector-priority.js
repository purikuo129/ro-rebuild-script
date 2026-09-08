const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const releaseMatch = source.match(/(const releaseActiveForAbBuff = \(\) => \{[\s\S]*?\n    \};)\n    const setActiveJobTimer/);
assert(releaseMatch, 'ต้องมีทางคืน claim ของ Collector เมื่อ AB Buff มี priority');

function makeRelease(activeJob) {
  const sent = [];
  const release = Function('initialJob', 'sent', `
    let activeJob = initialJob;
    let claimPendingId = 'claim-in-flight';
    let claimPendingAt = 123;
    let homeReturn = { requestedAt: 50 };
    let idleReturnAt = 99;
    const nowMs = () => 1000;
    const send = message => { sent.push(message); return true; };
    const log = () => {};
    ${releaseMatch[1]}
    return () => ({ released: releaseActiveForAbBuff(), activeJob, claimPendingId, claimPendingAt, homeReturn, idleReturnAt });
  `)(activeJob, sent);
  return { result: release(), sent };
}

{
  const { result, sent } = makeRelease({ job: { id: 'drop-1', itemName: 'Jellopy' }, claimToken: 'token-1' });
  assert.strictEqual(result.released, true, 'AB Buff ต้องยึดงาน Collector ที่กำลังเก็บได้');
  assert.strictEqual(result.activeJob, null, 'หลังคืนงาน AB Buff ต้องไม่ถูก Collector block');
  assert.strictEqual(result.claimPendingId, null, 'ต้องล้าง claim ที่ยังรอตอบ');
  assert.strictEqual(result.homeReturn, null, 'ต้องยกเลิกการกลับจุดรอของ Collector');
  assert.deepStrictEqual(sent, [{ type: 'nack', id: 'drop-1', claimToken: 'token-1', reason: 'AB Buff priority' }],
    'งานที่ยังเก็บไม่จบต้องถูกคืน Queue พร้อมเหตุผลที่ตรวจสอบได้');
}

{
  const { result, sent } = makeRelease({ job: { id: 'drop-2', itemName: 'Apple' }, claimToken: 'token-2', settleUntil: 2000 });
  assert.strictEqual(result.released, true);
  assert.strictEqual(result.activeJob, null);
  assert.deepStrictEqual(sent, [], 'งานที่ pickup สำเร็จและอยู่ช่วง settle ห้าม NACK ซ้ำ');
}

const tickStart = source.indexOf('tick() {', source.indexOf('const lootQueue = (() => {'));
const activeJobBranch = source.indexOf('if (!activeJob) {', tickStart);
const abPriorityBranch = source.indexOf('releaseActiveForAbBuff();', tickStart);
assert(abPriorityBranch >= 0 && abPriorityBranch < activeJobBranch,
  'Collector ต้องปล่อยงานให้ AB ก่อนเข้าสู่ active-job flow');
assert.match(source, /message\.type === 'claimed'[\s\S]{0,1800}isAbBuffPending\(\) \|\| isAbBuffActive\(\)/,
  'claimed ที่ตอบกลับช้าหลัง AB เริ่ม ต้องถูกคืน Queue ไม่ใช่ยึด AB อีกครั้ง');

console.log('AB Buff Collector priority regression: PASS');
