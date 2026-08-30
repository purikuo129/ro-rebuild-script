#!/usr/bin/env node
// Regression: backup รุ่นเก่าที่ config ไม่ครบ ต้องเติมค่าจาก active profile ได้
// รัน: node scripts/test-backup-transfer.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const keysMatch = source.match(/const PERSIST_KEYS = (\[[\s\S]*?\n  \]);/);
assert(keysMatch, 'หา PERSIST_KEYS ไม่พบ');
const PERSIST_KEYS = Function('return ' + keysMatch[1])(); // source-controlled array literal
assert(PERSIST_KEYS.includes('lootQueueItemIds'), 'lootQueueItemIds ต้องอยู่ใน PERSIST_KEYS');

const fnMatch = source.match(/(function shouldMigrateNoMonsterWarpDefault\([\s\S]*?\n  \}\n  function migrateNoMonsterWarpDefault\([\s\S]*?\n  \}\n  \/\/ Import เก่าบางรุ่น[\s\S]*?function buildImportConfig\([\s\S]*?\n  \})\n  function backupQueueSummary/);
assert(fnMatch, 'หา import migration/buildImportConfig ไม่พบ');
const cloneConfigValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const buildImportConfig = Function('PERSIST_KEYS', 'cloneConfigValue', fnMatch[1] + '; return buildImportConfig;')(PERSIST_KEYS, cloneConfigValue);

const legacyProfile = {
  PecoEgg: { lootQueueRole: 'collector', lootQueueItemIds: [7124, 997], lootQueueHomeMap: 'prontera' },
};
const legacyPartialConfig = { config: { lootQueueRole: 'farm' } };
const restoredLegacy = buildImportConfig(legacyPartialConfig, legacyProfile, 'PecoEgg');
assert.deepStrictEqual(restoredLegacy.lootQueueItemIds, [7124, 997], 'ต้องเติม special list จาก active profile เมื่อ config เก่าขาด key');
assert.strictEqual(restoredLegacy.lootQueueRole, 'farm', 'config สดต้องทับค่าเดียวกันจาก profile');

const explicitEmptyList = buildImportConfig({ config: { lootQueueItemIds: [] } }, legacyProfile, 'PecoEgg');
assert.deepStrictEqual(explicitEmptyList.lootQueueItemIds, [], 'ลิสต์ว่างที่ตั้งใจ export ต้องไม่ถูก profile เติมทับ');

const pre105Backup = buildImportConfig(
  { _version: '1.0.4', config: { noMonsterWarpSec: 5 } },
  { SkyPetit: { noMonsterWarpSec: 5 } },
  'SkyPetit',
);
assert.strictEqual(pre105Backup.noMonsterWarpSec, 2, 'backup ก่อน v1.0.5 ที่ค้าง default 5s ต้อง migrate เป็น 2s ตอน Import');

console.log('backup-transfer regression: PASS');
