const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const findPathMatch = source.match(/(function gatFindPath\([\s\S]*?\n  \})\n\n  \/\/ =+\n  \/\/  COMBAT GAT CHASE/);
assert(findPathMatch, 'หา gatFindPath ไม่พบ');
const match = source.match(/(function combatGatPathToRange\([\s\S]*?\n  \})\n\n  \/\/ null = GAT/);
assert(match, 'หา combatGatPathToRange ไม่พบ');

{
  const width = 30, height = 5;
  const currentMap = 'test';
  const gatCache = new Map([[currentMap, { w: width, h: height, cells: new Uint8Array(width * height) }]]);
  const player = { x: 1, y: 2 };
  const gatFindPath = Function(
    'currentMap', 'gatCache', 'gatFlipY', 'player',
    findPathMatch[1] + '; return gatFindPath;',
  )(currentMap, gatCache, false, player);
  const straightPath = gatFindPath(20, 2);
  assert(straightPath && straightPath.length > 1, 'A* เส้นตรงต้องไม่ถูก simplify เหลือแค่จุดเริ่ม');
  assert.deepStrictEqual(straightPath.at(-1), { x: 20, y: 2 }, 'A* ต้องเก็บ destination เป็น waypoint สุดท้าย');
}

// ตำแหน่งจริงห่างเกิน acquire range เล็กน้อย แต่การ round ลงช่อง GAT ทำให้
// ช่องที่ยืนอยู่ดูเหมือนอยู่ในระยะแล้ว. Path หนึ่งจุดนี้จะส่ง MOVE มายังจุดเดิม
// จน approach timeout แล้ววาร์ป ทั้งที่มีช่องถัดไปให้เดินได้.
const player = { x: 0.51, y: 0 };
const gatWalkable = () => true;
const gatFindPath = (x, y) => (x === 1 && y === 0
  ? [{ x: 1, y: 0 }]
  : [{ x: 1, y: 0 }, { x, y }]);
const combatGatPathToRange = Function(
  'player', 'gatWalkable', 'gatFindPath',
  match[1] + '; return combatGatPathToRange;',
)(player, gatWalkable, gatFindPath);

const result = combatGatPathToRange({ x: 15.6, y: 0 }, 15);
assert(result, 'ควรหาเส้นทางได้');
assert(result.path.length > 1, 'ระยะจริงเกิน 15 ช่องต้องได้ path ที่เดินออกจากช่องปัจจุบัน');
assert(Math.hypot(result.destination.x - player.x, result.destination.y - player.y) >= 0.5,
  'destination ต้องไม่ใช่ตำแหน่งเดิมที่เกิดจากการปัดเศษ GAT');

console.log('combat GAT acquire-boundary regression: PASS');
