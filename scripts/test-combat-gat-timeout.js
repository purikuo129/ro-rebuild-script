#!/usr/bin/env node
// Regression: Combat GAT timeout รับ/เปรียบเทียบเป็น milliseconds ไม่ใช่วินาที
// รัน: node scripts/test-combat-gat-timeout.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const fnMatch = source.match(/(function combatGatProgressTimeoutMs\([\s\S]*?\n  \})\n\n  function combatGatPathToRange/);
assert(fnMatch, 'หา combatGatProgressTimeoutMs ไม่พบ');
const makeTimeout = (CFG) => Function('CFG', fnMatch[1] + '; return combatGatProgressTimeoutMs;')(CFG)();

assert.strictEqual(makeTimeout({ combatGatProgressTimeoutMs: 500 }), 500, '500 ต้องหมายถึง 500ms');
assert.strictEqual(makeTimeout({ combatGatProgressTimeoutMs: '3500' }), 3500, 'ค่าจาก input ต้องคงหน่วย ms');
assert.strictEqual(makeTimeout({ combatGatProgressTimeoutMs: 0 }), 500, 'ค่าต่ำกว่าขอบต้อง clamp เป็น 500ms');
assert.strictEqual(makeTimeout({ combatGatProgressTimeoutMs: 20000 }), 15000, 'ค่ามากกว่าขอบต้อง clamp เป็น 15000ms');
assert(/now - combatGatLastProgressAt >= progressTimeoutMs/.test(source), 'route ต้องเทียบ elapsed ms กับ timeout โดยตรง');

console.log('combat-gat-timeout regression: PASS (milliseconds)');
