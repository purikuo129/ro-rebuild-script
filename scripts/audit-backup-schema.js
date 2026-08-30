#!/usr/bin/env node
// ตรวจว่า key ใน backup ถูก PERSIST_KEYS ของ userscript ปัจจุบันครอบคลุมหรือไม่
// รัน: node scripts/audit-backup-schema.js "/path/to/ro-assist-backup.json"
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const backupPath = process.argv[2];
assert(backupPath, 'ต้องระบุ path ของ backup JSON');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'RO Rebuild Pure.js'), 'utf8');
const keysMatch = source.match(/const PERSIST_KEYS = (\[[\s\S]*?\n  \]);/);
assert(keysMatch, 'หา PERSIST_KEYS ไม่พบ');
const persistedKeys = new Set(Function('return ' + keysMatch[1])()); // source-controlled array literal
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const listCount = (value) => Array.isArray(value) ? value.length : null;
const describeConfig = (config) => ({
  keyCount: isObject(config) ? Object.keys(config).length : 0,
  filter: isObject(config && config.filter) ? Object.keys(config.filter).sort() : [],
  lootQueueItemIds: listCount(config && config.lootQueueItemIds),
  healItems: listCount(config && config.healItems),
  buffItems: listCount(config && config.buffItems),
  sellItemIds: listCount(config && config.sellItemIds),
  depositItemIds: listCount(config && config.depositItemIds),
  storageReserveItems: listCount(config && config.storageReserveItems),
  skills: listCount(config && config.skills),
});

const config = isObject(backup.config) ? backup.config : {};
const profiles = isObject(backup.profiles) ? backup.profiles : {};
const omittedConfigKeys = Object.keys(config).filter((key) => !persistedKeys.has(key)).sort();
const profileOmissions = Object.fromEntries(Object.entries(profiles).map(([name, profile]) => [
  name,
  isObject(profile) ? Object.keys(profile).filter((key) => !persistedKeys.has(key)).sort() : ['<invalid-profile>'],
]));
const report = {
  backupVersion: backup._version || null,
  activeProfile: backup.activeProfile || 'default',
  persistKeyCount: persistedKeys.size,
  config: describeConfig(config),
  profiles: Object.fromEntries(Object.entries(profiles).map(([name, profile]) => [name, describeConfig(profile)])),
  omittedConfigKeys,
  profileOmissions,
};

console.log(JSON.stringify(report, null, 2));
if (omittedConfigKeys.length || Object.values(profileOmissions).some((keys) => keys.length)) process.exitCode = 2;
