const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { shouldHandoffGatToAttackFollow } = require('../RO Rebuild Pure.js');

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
      const COMBAT_GAT_ARRIVE_RADIUS = 2.5;
      const combatGatChaseEnabled = () => true;
      const RO_PURE_CORE = {
        shouldHandoffGatToAttackFollow: ({ distance, acquireDistance, gatEnabled, gatArriveRadius }) => {
          if (distance <= acquireDistance) return true;
          return acquireDistance > 0 && gatEnabled && distance <= acquireDistance + gatArriveRadius;
        },
      };
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
assert.deepStrictEqual(runDistance(16), ['ATTACK'], 'ใน GAT arrival tolerance ต้อง handoff เป็น Attack-follow ทันที');
assert.deepStrictEqual(runDistance(19), ['MOVE'], 'ระยะ 15–19 ต้องยังเข้า Movement Planner ได้');

assert.strictEqual(typeof shouldHandoffGatToAttackFollow, 'function',
  'Combat must expose its GAT-to-Attack handoff decision for regression coverage');
assert.strictEqual(shouldHandoffGatToAttackFollow({ distance: 10.8, acquireDistance: 10, gatEnabled: true, gatArriveRadius: 2.5 }), true,
  'GAT ที่เข้ามาถึงขอบ 10.8/10 ต้อง handoff เป็น Attack-follow แทนส่ง waypoint เดิมซ้ำ');
assert.strictEqual(shouldHandoffGatToAttackFollow({ distance: 4, acquireDistance: 2, gatEnabled: true, gatArriveRadius: 2.5 }), true,
  'GAT ที่เข้ามาถึงขอบ 4/2 ต้อง handoff เป็น Attack-follow');
assert.strictEqual(shouldHandoffGatToAttackFollow({ distance: 12.6, acquireDistance: 10, gatEnabled: true, gatArriveRadius: 2.5 }), false,
  'นอก GAT arrival tolerance ต้องเดินต่อ ไม่ส่ง Attack-follow เร็วเกินไป');
assert.strictEqual(shouldHandoffGatToAttackFollow({ distance: 10.8, acquireDistance: 10, gatEnabled: false, gatArriveRadius: 2.5 }), false,
  'direct-walk ที่ไม่มี GAT ต้องยังเคารพระยะ Attack-follow ที่ผู้ใช้ตั้งไว้');
assert.match(source, /shouldHandoffGatToAttackFollow\(/,
  'Combat runtime must use the behavior-tested GAT-to-Attack handoff');

assert(/maxAcquireDistance:\s*15,/.test(source), 'ค่าเริ่มต้นต้องมาจาก config เดิม ไม่บังคับเป็นค่าใหม่ใน logic');
assert(!source.includes('roPureCombatAcquireDistance16V1'), 'ห้ามแก้ config/profile ผู้ใช้ด้วย migration ระยะโจมตี');

console.log('combat acquire command flow regression: PASS');
