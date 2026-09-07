const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const attackBlock = source.match(/    \/\/ === 3\. Attack ===[\s\S]*?(?=    \/\/ === 4\. Acquire new target ===)/);
assert(attackBlock, 'หา Combat Attack flow ไม่พบ');

function makeCombatStep(CFG, player, entities, commands) {
  return Function(
    'CFG', 'player', 'entities', 'commands',
    `
      const yieldUnclaimedTargetToOtherPlayer = () => false;
      const combatApproachTimedOut = () => false;
      const combatApproachTimeoutMs = () => 0;
      const handleUnreachable = () => commands.push('WARP');
      const resetWalkProgress = () => {};
      const resetCombatGatChase = () => {};
      const sendAttack = () => { commands.push('ATTACK'); return true; };
      const continueCombatApproach = () => { commands.push('MOVE'); return 'WALKING'; };
      const abandonTarget = () => commands.push('ABANDON');
      const log = () => {};
      const FOLLOW_NO_COMBAT_STALL_MS = 0;
      const FOLLOW_NO_COMBAT_MAX_MS = 0;
      let target = null;
      function step(nextTarget, now) {
        target = nextTarget;
${attackBlock[0]}
      }
      return step;
    `,
  )(CFG, player, entities, commands);
}

function runDistance(distance) {
  const commands = [];
  const player = { x: 0, y: 0 };
  const entity = { id: 1, name: 'mob', x: distance, y: 0 };
  const step = makeCombatStep(
    { maxAcquireDistance: 15, maxChaseDistance: 40, attackRange: 2, rangedAttackRange: 0, warpToMonster: true, attackProbeMs: 2000 },
    player,
    new Map([[entity.id, entity]]),
    commands,
  );
  step({ id: entity.id, approachStartedAt: 1000, lastAttackAt: 0, lastAttackSignalAt: 0, followObservedAt: 0, forceApproachWalk: false }, 1001);
  return commands;
}

assert.deepStrictEqual(runDistance(15), ['ATTACK'], 'ในระยะ Attack-follow ต้องส่ง ATTACK ทันที');
assert.deepStrictEqual(runDistance(16), ['MOVE'], 'เกินระยะ Attack-follow ต้องส่ง MOVE ไม่ใช่ยืนนิ่งหรือวาร์ป');
assert.deepStrictEqual(runDistance(19), ['MOVE'], 'ระยะ 15–19 ต้องยังเข้า Movement Planner ได้');

assert(/maxAcquireDistance:\s*15,/.test(source), 'ค่าเริ่มต้นต้องมาจาก config เดิม ไม่บังคับเป็นค่าใหม่ใน logic');
assert(!source.includes('roPureCombatAcquireDistance16V1'), 'ห้ามแก้ config/profile ผู้ใช้ด้วย migration ระยะโจมตี');

console.log('combat acquire command flow regression: PASS');
