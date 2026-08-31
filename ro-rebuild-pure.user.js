// ==UserScript==
// @name         RO Rebuild Pure
// @namespace    ro-rebuild-pure
// @version      1.1.1
// @description  ผู้ช่วยเล่นเว็บ client RO — auto-loot, auto-heal, auto-combat, auto-rest (Unity WebGL / WebSocket)
// @match        *://*.rayrag.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/purikuo129/ro-rebuild-script/main/ro-rebuild-pure.user.js
// @downloadURL  https://raw.githubusercontent.com/purikuo129/ro-rebuild-script/main/ro-rebuild-pure.user.js
// ==/UserScript==

/* ==========================================================================
   RO REBUILD WEB ASSIST  —  ผู้ช่วยเล่นสำหรับเว็บ client (Unity WebGL)
   ==========================================================================

   มี 2 ระบบทำงานแยกกัน (เปิด/ปิดเป็นอิสระ):

     1) AUTO-LOOT  — เก็บของที่ตกจากมอนที่เราฆ่าเอง
     2) AUTO-HEAL  — ใช้ขวดยาอัตโนมัติเมื่อเลือดต่ำกว่า % ที่ตั้ง

   --------------------------------------------------------------------------
   วิธีติดตั้ง
   --------------------------------------------------------------------------
   ทางเลือก A — Tampermonkey (แนะนำ)
     1. ติดตั้งส่วนเสริม "Tampermonkey"
     2. คลิกไอคอน Tampermonkey → Create a new script
     3. ลบเนื้อหาเดิม → วางสคริปต์นี้ทั้งหมด → Ctrl+S บันทึก
     4. รีเฟรชหน้าเว็บเกม (ต้องติดตั้งก่อนเข้าเกม เพราะต้องดัก WebSocket ตั้งแต่ต้น)

   ทางเลือก B — Console (ชั่วคราว)
     1. เปิดหน้าเว็บเกม แต่ "ยังไม่คลิกเข้าเกม"
     2. กด F12 → แท็บ Console
     3. วางสคริปต์นี้ทั้งหมด → Enter
     4. ค่อยคลิกเข้าเกม/เลือกตัวละคร
     (หมายเหตุ: ใช้วิธีนี้ต้องวางใหม่ทุกครั้งที่รีเฟรช)

   --------------------------------------------------------------------------
   ⭐ ที่ใช้บ่อย (พิมพ์ใน console)
   --------------------------------------------------------------------------
     ASSIST.status()           // ดูสถานะทั้งหมด (HP%, คิวของ, ค่าที่ตั้งไว้)
     ASSIST.help()             // ดูคำสั่งทั้งหมด
     ASSIST.setFpsCap(30)      // จำกัด render ของเกม: 0,15,30,45,60 (0 = Unlimited)

     // Auto-Loot (เปิดอยู่ default)
     ASSIST.lootOn()  /  ASSIST.lootOff()

     // Auto-Heal ★ DEFAULT = OFF (ยังไม่สมบูรณ์)
     //   ต้องตั้ง item ก่อน แล้วเปิดเอง:
     ASSIST.setHealItems(501,502,503)   // ตั้งไอเทม (จะเปิด auto-heal ให้อัตโนมัติ)
     ASSIST.setHealAt(50)               // เลือดต่ำกว่า 50% → ใช้ยา
     ASSIST.healOn()  /  ASSIST.healOff()

     // Warp-to-Loot ★ DEFAULT = OFF (ส่ง packet วาร์ปจริง)
     //   เก็บไม่ได้ครบ 6 ครั้ง → วาร์ปไปที่ไอเท็ม (กรณีติดกำแพง/หน้าผา)
     ASSIST.warpLootOn() / ASSIST.warpLootOff()

   ==========================================================================
   ส่วนที่ 1 — AUTO-HEAL
   ==========================================================================

   ทำงานยังไง?
     • อ่าน HP จาก packet ของตัวเอง (opcode 0x25 STAT)
     • พอ HP% ต่ำกว่าค่าที่ตั้ง (เช่น 50%) → สั่งใช้ item ที่กำหนด (packet 0x2f)
     • เลือก item 2 โหมด:
         'order'   = ใช้ item ตัวเดิมซ้ำจนกว่าจะหมด แล้วค่อยไปตัวถัดไป
         'random'  = สุ่มเลือก item ใหม่ทุกครั้ง
     • ★ วิธีรู้ว่า item "หมด": ใช้แล้ว HP ไม่ขยับเลย → ถือว่าหมด → ใช้ตัวถัดไป "ทันที"
       (ไม่ mark ว่าอันไหนหมดถาวร เพราะผู้เล่นอาจไปเก็บ/ซื้อเพิ่มมาแล้ว → รอบถัดไปที่วนกลับมาจะลองใหม่)
     • มีดีเลย์ระหว่างการใช้แต่ละครั้ง (ตั้งได้)

   คำสั่ง console (พิมพ์ได้เลย มีผลทันที):
     ASSIST.setHealAt(50)              // เปิด auto-heal + ตั้ง threshold 50%
     ASSIST.setHealItems(501, 502)     // เซ็ตรายการ item id ที่จะใช้ (ทับของเดิม)
     ASSIST.addHealItem(503)           // เพิ่ม item เข้ารายการ
     ASSIST.setHealMode('order')       // 'order' = ใช้ตัวเดิมจนหมดแล้วข้าม, 'random' = สุ่ม
     ASSIST.setHealDelay(800)          // ดีเลย์ 800ms ระหว่างการใช้แต่ละครั้ง
     ASSIST.healOn() / ASSIST.healOff()    // เปิด/ปิด

   ==========================================================================
   ส่วนที่ 2 — AUTO-LOOT
   ==========================================================================

   ทำงานยังไง?
     • ตรวจจับของที่ตกจากมอนที่ "เราฆ่าเอง" (สัญญาณ EXP + ระยะใกล้ตัว)
     • ส่งคำสั่งเก็บของ (packet 0x52)
     • เก็บไม่ได้ → ลองใหม่สูงสุด 6 ครั้ง ห่างกัน 1.2 วิ พร้อมสลับไปเก็บชิ้นอื่นก่อน
     • ครบ 6 ครั้งยังไม่ได้ → ปล่อยทิ้ง
     • ★ server ทำ walk-and-pickup เอง: ส่ง packet เดียว server เดินตัวละครไปเก็บเอง (รองรับนักธนูฆ่าไกล)
     • มีระบบกรอง: เก็บทั้งหมด / เก็บเฉพาะบางชิ้น / ไม่เก็บบางชิ้น

   คำสั่ง console:
     ASSIST.setLootMode('all')         // 'all' = เก็บหมด, 'only' = เก็บเฉพาะ, 'except' = ยกเว้น
     ASSIST.addLootOnly(909, 512)      // เพิ่ม item สำหรับโหมด 'only'
     ASSIST.addLootExcept(909)         // เพิ่ม item สำหรับโหมด 'except'
     ASSIST.clearLootOnly()            // ล้างรายการ 'only'
     ASSIST.clearLootExcept()          // ล้างรายการ 'except'
     ASSIST.name(935, 'Feather')       // ตั้งชื่อ item ให้อ่าน log ง่าย
     ASSIST.lootOn() / ASSIST.lootOff()    // เปิด/ปิด

   Loot Queue (เลือก Localhost หรือ Cloudflare ใน UI):
     ASSIST.setLootQueueConfig({role:'farm', group:'party-a'})
     ASSIST.setLootQueueConfig({role:'collector', group:'party-a', homeMap:'prontera', homeX:150, homeY:150})
     ASSIST.lootQueueStatus()          // ดูการเชื่อมต่อ/งานที่กำลังทำ
     ASSIST.teleportStatus()           // ดูคำสั่งวาร์ปที่กำลังรอยืนยัน
     ASSIST.lootQueueNext()            // ทิ้งงานปัจจุบัน (เมื่อ drop หาย/บอทค้าง) แล้วไปงานถัดไป

   --------------------------------------------------------------------------
   เคล็ดลับหา "item id"
   --------------------------------------------------------------------------
   พิมพ์ ASSIST.status() ตอนมีของ/เลือด → จะเห็นชื่อแบบ "item_935" หรือเปิด inventory
   ในเกมแล้วเอา id มาใส่ในคำสั่งด้านบน

   ตัวอย่าง item id ทั่วไป (อ้างอิง RO มาตรฐาน — อาจต่างในแต่ละเซิร์ฟ):
     501 = Red Potion,    502 = Yellow Potion,   503 = White Potion
     504 = Blue Potion,   505 = Wing of Fly,     601 = Wing of Butterfly
     909 = Jellopy,       512 = Apple
   ========================================================================== */

(function () {
  if (window.__ASSIST) { console.warn('[ASSIST] รันอยู่แล้ว'); return; }
  window.__ASSIST = true;

  // ============================================================
  //  VERSION + config persistence (localStorage)
  // ============================================================
  const VERSION = '1.1.1';
  const GITHUB_RAW = 'https://raw.githubusercontent.com/purikuo129/ro-rebuild-script/main/ro-rebuild-pure.user.js';
  const CFG_STORAGE_KEY = 'roPureConfig_v1';
  // Master switch is intentionally not part of a Profile/export.  Moving a
  // profile to another machine must never silently start its automation.
  const MASTER_BOT_STORAGE_KEY = 'roPureMasterBotEnabled_v1';
  // keys ที่บันทึก/โหลด (boolean/number/array/string — ไม่เก็บ function หรือ object ซ้อน)
  const PERSIST_KEYS = [
    'healEnabled', 'healAtPercent', 'healItems', 'healMode', 'healDelayMs', 'healAtMax',
    'buffEnabled', 'buffItems', 'buffRebuffDelayMs', 'autoClearConsoleMin', 'monitorServerEnabled', 'monitorServerUrl', 'monitorSendIntervalMs',
    'skillEnabled', 'skills', 'disabledSkillIds', 'skillCommandGapMs',
    'lootEnabled', 'lootDelayAfterDropMs', 'lootPostKillSettleMs', 'lootUseKillPos', 'pickRadiusKill', 'filter', 'sendThrottleMs', 'lootQueueRole', 'lootQueueUrl', 'lootQueueTransport', 'lootQueueLocalUrl', 'lootQueueCloudflareUrl', 'lootQueueGroup', 'lootQueueHomeMap', 'lootQueueHomeX', 'lootQueueHomeY', 'lootQueueItemIds', 'lootQueueSendAll', 'lootQueueClaimDelayMs', 'lootQueueNearbySettleMs', 'lootQueueActionTimeoutMs', 'lootQueueWarpCooldownMs', 'lootQueuePickupRetryCount',
    'warpLootEnabled',
    'combatEnabled', 'targetWhitelist', 'targetBlacklist', 'attackRange', 'rangedAttackRange', 'attackProbeMs', 'hiddenWaitMonsters', 'hiddenWaitSec', 'hiddenSightEnabled',
    'maxAcquireDistance', 'searchRadii', 'maxChaseDistance', 'antiKS', 'antiKSCooldownMs', 'avoidOtherPlayers', 'playerProximityRadius', 'postWarpTargetSettleMs', 'combatGatProgressTimeoutMs', 'targetLowestHpFirst',
    'weaponSetEnabled', 'weaponSets', 'weaponDefaultSetId', 'weaponMonsterRules',
    'fleeOnMobCount', 'fleeOnAggroCount', 'fleeOnProximityCount', 'fleeOnProximityRadius', 'fleeMonsters', 'fleeMonsterRadius', 'fleeOnPlayerCount', 'fleeOnPlayerRadius', 'fleeOnPlayerDelaySec', 'fleePlayerExceptions', 'fleeOnMvp', 'fleeOnMvpRadius', 'maxEngageSecSlow', 'slowMonsterSubIds',
    'wanderEnabled', 'warpFindEnabled', 'noMonsterWarpSec', 'warpToMonster', 'warpToMonsterMaxPerEntity', 'stuckWarpOnAbandon', 'warpToBoss',
    'restEnabled', 'restHpPercent', 'restUntilPercent', 'restMaxSec', 'postCombatDelayMs', 'autoRespawnEnabled', 'autoRespawnDelayMs', 'telegramAlertCard', 'telegramAlertFlee', 'telegramAlertBotMention', 'telegramAlertNearby', 'telegramAlertWhisper', 'telegramBotToken', 'telegramChatId',
    'sellEnabled', 'sellNpcName', 'sellNpcMap', 'sellNpcX', 'sellNpcY', 'sellIntervalMin', 'sellOnFull', 'sellItemIds',
    'storageEnabled', 'kafraName', 'kafraMap', 'kafraMapX', 'kafraMapY', 'kafraChoice', 'depositOnFull', 'depositWeightPercent', 'depositAfterSell', 'storageDepositMode', 'depositItemIds', 'storageReserveItems',
    'oreRefineMap', 'oreRefineHubX', 'oreRefineHubY', 'oreRefineKafraName', 'oreRefineKafraX', 'oreRefineKafraY', 'oreRefineKafraChoice', 'oreRefineKafraNextCount', 'oreRefineNpcName', 'oreRefineNpcX', 'oreRefineNpcY', 'oreRefineTradeChoice', 'oreRefineTradeEntry', 'oreRefineSellChoice', 'oreRefineBatchSize', 'oreRefineSourceItemId', 'oreRefineResultItemId',
    'farmMap', 'farmMapX', 'farmMapY', 'warpBackToFarm',
    'abBuffEnabled', 'abBuffMap', 'abBuffX', 'abBuffY', 'abBuffCommandIntervalMs', 'abBuffReturnDelayMs', 'abBuffTimeoutSec',
    'autoLoginEnabled', 'autoLoginUser', 'autoLoginPass', 'autoLoginSlot', 'autoRefreshEnabled', 'autoRefreshStallSec', 'autoRefreshMovementStallSec',
    'aiReplyEnabled', 'aiReplyMode', 'aiReplyTemplates', 'aiReplyApiUrl', 'aiReplyApiKey', 'aiReplyModel', 'aiReplyRadius', 'aiReplyAllowedNames', 'aiReplyDelayMinSec', 'aiReplyDelayMaxSec', 'aiReplyCooldownSec', 'aiReplyMaxPerMin', 'aiReplyMaxTokens', 'aiReplyPrompt', 'aiReplyRequireNameMention',
    'navRecording', 'navMergeRadius', 'navWanderUseNav', 'navWanderMode', 'gatWanderEnabled', 'settingsFontScale', 'renderFpsCap',
    'itemNames',
  ];
  function persistedConfig() {
    const out = {};
    for (const k of PERSIST_KEYS) if (k in CFG) out[k] = CFG[k];
    // ★ sort item ID arrays ตามเลขไอดี (เวลาเขียน localStorage/export จะได้มองง่าย)
    const sortNum = (arr) => Array.isArray(arr) ? [...arr].sort((a, b) => a - b) : arr;
    if (out.healItems) out.healItems = sortNum(out.healItems);
    if (out.lootQueueItemIds) out.lootQueueItemIds = sortNum(out.lootQueueItemIds);
    if (out.sellItemIds) out.sellItemIds = sortNum(out.sellItemIds);
    if (out.depositItemIds) out.depositItemIds = sortNum(out.depositItemIds);
    if (out.storageReserveItems && Array.isArray(out.storageReserveItems)) out.storageReserveItems = [...out.storageReserveItems].sort((a, b) => a.itemId - b.itemId);
    if (out.buffItems && Array.isArray(out.buffItems)) out.buffItems = [...out.buffItems].sort((a, b) => a.itemId - b.itemId);
    return out;
  }
  function saveConfig() {
    try {
      localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(persistedConfig()));
      return true;
    } catch (e) { return false; } // localStorage อาจถูกบล็อก/เต็ม
  }
  function applyPersistedConfig(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return 0;
    let count = 0;
    for (const k of PERSIST_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(saved, k)) continue;
      CFG[k] = cloneConfigValue(saved[k]);
      count++;
    }
    return count;
  }
  function loadConfig() {
    try {
      const raw = localStorage.getItem(CFG_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const count = applyPersistedConfig(saved);
      log('💾 โหลดค่าที่บันทึกไว้จากเครื่อง (' + count + ' รายการ)');
    } catch (e) { /* parse fail — ใช้ default */ }
  }
  // debounce save (กันเขียนถี่เกินไป)
  let saveTimer = null;
  function saveConfigDebounced() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveConfig, 800);
  }

  // ============================================================
  //  AUTO-BUFF session timer
  //    countdown เริ่มใหม่ทุกครั้งที่โหลดสคริปต์/เข้า session ใหม่
  //    ห้ามใช้ timestamp เก่าจาก localStorage เพราะอาจทำให้บัพไม่ถูกใช้
  // ============================================================
  const lastBuffUse = new Map();   // itemId → timestamp (ms) ใช้ครั้งล่าสุด
  // migration: ล้างเวลา Auto-Buff รุ่นเก่าหนึ่งครั้ง แล้วไม่นำมาใช้อีก
  try { localStorage.removeItem('roPureBuffTimes_v1'); } catch (e) { /* ignore */ }

  // ============================================================
  //  Item database (โหลดจาก GitHub raw + cache localStorage)
  // ============================================================
  const ITEMS_CSV_URL = GITHUB_RAW.replace('/ro-rebuild-pure.user.js', '/items.csv');
  const ITEMS_META_URL = GITHUB_RAW.replace('/ro-rebuild-pure.user.js', '/items/meta.json');
  const ITEMS_ICON_URL = GITHUB_RAW.replace('/ro-rebuild-pure.user.js', '/items/small/');
  const ITEMDB_CACHE_KEY = 'roPureItemDB_v1';
  const itemDB = { names: {}, prices: {}, loaded: false };
  async function loadItemDB() {
    if (itemDB.loaded) return;
    // ลอง cache ก่อน
    try {
      const cached = localStorage.getItem(ITEMDB_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.names && parsed.prices) {
          itemDB.names = parsed.names;
          itemDB.prices = parsed.prices;
          itemDB.loaded = true;
          log('🗃️ โหลด item DB จาก cache (' + Object.keys(parsed.names).length + ' รายการ)');
          refreshWeaponEditorAfterItemDbLoad();
          return;
        }
      }
    } catch (e) {}
    // โหลดจาก GitHub
    try {
      log('🗃️ กำลังโหลด item DB จาก GitHub...');
      const [csvRes, metaRes] = await Promise.all([fetch(ITEMS_CSV_URL), fetch(ITEMS_META_URL)]);
      if (csvRes.ok) {
        const csv = await csvRes.text();
        for (const line of csv.split('\n')) {
          const c = line.indexOf(',');
          if (c > 0) { const id = line.slice(0, c).trim(); const nm = line.slice(c + 1).trim(); if (id && nm) itemDB.names[id] = nm; }
        }
      }
      if (metaRes.ok) {
        const meta = await metaRes.json();
        for (const [id, info] of Object.entries(meta)) {
          if (info && info.buyPrice != null) itemDB.prices[id] = info.buyPrice;
        }
      }
      itemDB.loaded = true;
      // cache ลง localStorage (กันโหลดใหม่ทุกครั้ง)
      try { localStorage.setItem(ITEMDB_CACHE_KEY, JSON.stringify({ names: itemDB.names, prices: itemDB.prices })); } catch (e) {}
      log('🗃️ โหลด item DB สำเร็จ: ' + Object.keys(itemDB.names).length + ' ชื่อ, ' + Object.keys(itemDB.prices).length + ' ราคา');
      refreshWeaponEditorAfterItemDbLoad();
    } catch (e) {
      log('⚠️ โหลด item DB ล้มเหลว (offline?) — ใช้ชื่อเริ่มต้น');
      itemDB.loaded = true;   // ไม่ลองใหม่
    }
  }
  // ชื่อ item จาก DB (fallback ไป CFG.itemNames หรือ item_<id>)
  function itemDisplayName(id) {
    const k = String(id);
    if (itemDB.names[k]) return itemDB.names[k];
    if (CFG.itemNames[id]) return CFG.itemNames[id];
    return 'item_' + id;
  }
  function refreshWeaponEditorAfterItemDbLoad() {
    const root = document.getElementById('__assist_root');
    if (root && root.querySelector('#__assist_weaponeditor')) renderWeaponEditor(root);
  }
  // ราคา item (buyPrice) — 0 ถ้าไม่มีข้อมูล
  function itemPrice(id) { return itemDB.prices[String(id)] || 0; }
  // URL รูป item (lazy-load จาก GitHub raw)
  function itemIconUrl(id) {
    // ★ Card ใช้ card.gif แทนรูปตามไอดี (การ์ดทุดใบเหมือนกัน)
    const name = itemDisplayName(id);
    if (name.endsWith(' Card') || (id >= 4001 && id <= 4520)) return ITEMS_ICON_URL + 'card.gif';
    return ITEMS_ICON_URL + id + '.gif';
  }
  // ยอด zeny รวม session (จาก inventory จริง × buyPrice)
  function sessionZeny() {
    let total = 0;
    for (const [id, count] of inventory) total += (itemPrice(Number(id)) || 0) * count;
    return total;
  }

  // ============================================================
  //  ตั้งค่าเริ่มต้น — แก้ได้ที่นี่ หรือใช้คำสั่ง ASSIST.* จาก console
  // ============================================================
  const CFG = {
    // ---------- AUTO-HEAL ----------
    //  ★★ DEFAULT = OFF — ระบบยังไม่สมบูรณ์ อาจส่ง packet แปลกปลอมถ้าไม่มี item heal
    //     เปิดใช้เองด้วย ASSIST.healOn() หรือ ASSIST.setHealItems(...) (จะเปิดให้อัตโนมัติ)
    healEnabled: false,           // เปิดใช้ตอนเริ่มหรือไม่
    healAtPercent: 60,            // HP% ที่จะเริ่มใช้ยา (เช่น 60 = ต่ำกว่า 60% ใช้ยา)
    healItems: [501,502],          // รายการยาเริ่มต้น; ยังไม่ใช้จนกว่า healEnabled จะเปิด
    healMode: 'order',            // 'order' = ใช้ตัวเดิมจนหมดแล้วค่อยข้าม, 'random' = สุ่มทุกครั้ง
    healDelayMs: 200,             // ดีเลย์ขั้นต่ำระหว่างการใช้ item แต่ละครั้ง
    healCheckMs: 100,             // ความถี่ในการเช็ค HP
    healAtMax: false,             // true = ใช้ยาจนเต็มก่อนหยุด (ไม่ใช่แค่พ้น threshold)
    healExhaustedMs: 3000,        // ★ item ที่ "หมด" จะรออีก N ms ก่อนลองใหม่ (เผื่อเก็บ/ซื้อมาเพิ่ม)
    healItemEffectCheckMs: 1000,  // fallback: รอ HP update 1s หลังใช้ item; ปกติใช้ 0x32 decrement ยืนยันก่อน

    // ---------- AUTO-BUFF (ใช้ไอเทมบัพเป็นระยะ — countdown) ----------
    //  mirror บอทหลัก autoBuff (config.json:402-441) — timer mode
    //  เวลาใช้ล่าสุดอยู่เฉพาะ session นี้; reload แล้วพร้อมใช้ใหม่
    buffEnabled: false,           // เปิดใช้ตอนเริ่มหรือไม่
    // ★ รายการ buff: [{itemId, intervalMin}] — intervalMin = ทุกกี่นาทีจะใช้ซ้ำ
    //   ตัวอย่าง: [{itemId:656, intervalMin:30}] = Awakening Potion ทุก 30 นาที
    buffItems: [{itemId:656, intervalMin:30}], // Awakening Potion ทุก 30 นาทีเมื่อ buffEnabled เปิด
    buffCheckMs: 20000,            // ความถี่ในการเช็ค (20 วิ)
    buffRebuffDelayMs: 5000,      // รออย่างน้อย N ms ก่อนใช้ buff ตัวเดิมซ้ำ (กัน spurious)

    // ---------- AUTO-SKILL (ใช้สกิลตามเงื่อนไข — mirror bot.js autoSkill) ----------
    //  3 mode: targeted (Bash/Charge), AoE (Magnum Break), self-cast (Two-Hand Quicken)
    //  แต่ละ skill: {name, skillId, level, targeted, selfCast, intervalMin, mobCountMin,
    //                 maxUsesPerTarget, maxDistance, minDistance, spMin, cooldownMs}
    skillEnabled: true,          // ★ default ON
    skills: [{
    "name": "Steal",
    "skillId": 61,
    "level": 10,
    "targeted": true,
    "selfCast": false,
    "intervalMin": 0,
    "mobCountMin": 0,
    "maxUsesPerTarget": 3,
    "maxDistance": 2,
    "minDistance": 0,
    "spMin": 10,
    "cooldownMs": 800
    }],                   // รายการ skill config
    disabledSkillIds: [],         // skillId ที่ toggle ปิดชั่วคราว
    skillCommandGapMs: 1500,      // เว้นเฉพาะระหว่างสกิลคนละชนิด (รวมปุ่ม “ใช้ skill เดี๋ยวนี้”)

    // ---------- AB BUFF (รับ Increase Agility + Blessing จาก Acolyte) ----------
    abBuffEnabled: false,
    abBuffMap: 'prontera',
    abBuffX: 148,
    abBuffY: 28,
    abBuffCommandIntervalMs: 5000, // /hp, /hp, /lv, /lv ในรอบเดียว ห่างกัน 5 วิ
    abBuffReturnDelayMs: 3000,     // ได้บัพครบแล้วรอก่อนวาร์ปกลับฟาร์ม
    abBuffTimeoutSec: 180,         // รอรับบัพสูงสุด 3 นาที; ล้มเหลวแล้วกลับฟาร์มและปิด AB Buff

    // ---------- AUTO LOGIN / RECOVERY ----------
    // เปิดเองเท่านั้น: เมื่อหน้า refresh แล้วให้ส่ง login packet และเลือกตัวละครตาม slot
    // รหัสถูกเก็บใน localStorage ของ browser นี้แบบ plain text — ห้ามใช้เครื่องส่วนรวม
    autoLoginEnabled: false,
    autoLoginUser: '',
    autoLoginPass: '',
    autoLoginSlot: 0,              // slot แรก = 0
    autoRefreshEnabled: false,
    autoRefreshStallSec: 180,      // ไม่มี packet นานเท่านี้ → refresh หน้าเพื่อ reconnect/relogin
    autoRefreshMovementStallSec: 600, // ไม่ขยับนานเท่านี้ → refresh (0=ปิด; default 10 นาที)

    // ---------- AI CHAT REPLY ----------
    // endpoint แบบ OpenAI-compatible; key เก็บใน localStorage ของ browser เครื่องนี้
    // เปิดเองเท่านั้น และตอบเฉพาะ nearby chat ของผู้เล่นที่อยู่ในรัศมีที่กำหนด
    aiReplyEnabled: false,
    // ai = เรียก OpenAI-compatible API, template = สุ่มตอบจากข้อความที่ผู้ใช้ตั้งเอง (ไม่ใช้เครดิต API)
    aiReplyMode: 'ai',
    aiReplyTemplates: ['dddd', 'ดีคับ', 'คับบบบบ', 'kubbbb', 'คับบ'],
    aiReplyApiUrl: 'https://api.openai.com/v1/chat/completions',
    aiReplyApiKey: '',
    aiReplyModel: 'gpt-4.1-mini',
    aiReplyRadius: 10,
    // ชื่อผู้เล่นทดสอบที่อนุญาตให้ตอบ; ว่าง = ผู้เล่นทุกคนที่ยืนยันตำแหน่งในระยะได้
    aiReplyAllowedNames: ['Puriku', 'TEST1150'],
    // หน่วงแบบสุ่มให้ดูเป็นธรรมชาติ โดยเริ่มนับหลังจบ target ปัจจุบันแล้ว
    aiReplyDelayMinSec: 4,
    aiReplyDelayMaxSec: 8,
    aiReplyCooldownSec: 6,
    aiReplyMaxPerMin: 10,
    aiReplyMaxTokens: 60,
    aiReplyRequireNameMention: false,
    aiReplyPrompt: 'ตอบภาษาไทยแบบสุภาพ สั้น เป็นธรรมชาติ ไม่เกิน 1 ประโยค อย่าอ้างว่าเป็น AI หรือบอท และอย่าเปิดเผยข้อมูลส่วนตัว',

    // ---------- MISC ----------
    autoClearConsoleMin: 5,       // ★ 0=off, >0=clear browser console ทุก N นาที (กัน log เยอะค้างหน่วย)

    // ---------- REMOTE MONITOR ----------
    monitorServerEnabled: false,  // ★ เปิดส่งข้อมูลไป relay server (ดูจากมือถือ/เครื่องอื่นได้)
    monitorServerUrl: 'wss://rayro.catgg.net',  // URL relay server
    monitorSendIntervalMs: 5000,  // ★ ส่งข้อมูลทุก 5 วิ

    // ---------- NAVIGATION (บันทึกเส้นทางเดิน + waypoint graph) ----------
    //  เก็บตำแหน่งที่ผู้เล่นคลิกเดิน → สร้าง waypoint graph → bot เดินตามเส้นทางจริง
    //  ★ ข้อมูลเก็บ localStorage (roPureNav_<map>) + export/import + sync GitHub
    navRecording: false,          // ★ default OFF — เปิดเพื่อบันทึกตอนเดินเก็บข้อมูล
    navMergeRadius: 3,            // จุดที่อยู่ใกล้กัน <= N ช่อง = รวมเป็น node เดียว (dedup)
    navWanderUseNav: true,        // wander ใช้ nav แทนสุ่ม (ถ้ามีข้อมูลแมปนั้น)
    gatWanderEnabled: true,       // wander ใช้ตารางเดินได้ GAT ก่อน Nav (เฉพาะแมปที่มีข้อมูล)
    navWanderMode: 'patrol',      // ★ 'patrol' = เดินตามลำดับ route ครบแล้วย้อนกลับ, 'graph' = wander สุ่มตาม graph

    // ---------- AUTO-REST (★ default OFF — นั่งพักเสี่ยงถ้ามีมอนรอบตัว) ----------
    //  เมื่อ HP ต่ำกว่า restHpPercent และไม่โดนรุม → นั่งพัก
    //  ฟื้นถึง restUntilPercent หรือหมดเวลา restMaxSec → ลุกยืนกลับฟาร์ม
    //  ★ โดนรุมระหว่างนั่ง → ลุกทันทีเพื่อตีตอบ
    restEnabled: false,
    restHpPercent: 40,            // HP ต่ำกว่า 40% → นั่งพัก
    restUntilPercent: 90,         // ฟื้นถึง 90% → ลุก
    restMaxSec: 40,               // นั่งนานสุด 40 วิ (กันค้าง — HP ไม่ขยับ = มีปัญหา)

    // ---------- AUTO-RESPAWN ----------
    //  ตาย (0x24 DEATH) → ส่ง respawn packet (0x29) → กลับจุด save
    //  หลัง respawn → บังคับนั่งพักจนเลือดเต็ม → กลับฟาร์ม
    autoRespawnEnabled: true,
    autoRespawnDelayMs: 3000,     // รอ N ms หลังตายก่อนส่ง respawn (กันสแปม — ถ้า server lag)

    // ---------- TELEGRAM ALERT FILTERS ----------
    //   ★ ควบคุมว่าจะส่ง alert ประเภทไหนไป Telegram บ้าง
    telegramAlertCard: true,       // 🃏 ดรอปการ์ด (logImportant type=card)
    telegramAlertFlee: true,       // 🚨 หนีมอน/ตาย (logImportant type=flee)
    telegramAlertBotMention: true, // 💬 แชทที่พูดถึง bot/บอท/บอต (logImportant type=chat)
    telegramAlertNearby: true,    // 💬 แชท nearby ทุกข้อความ
    telegramAlertWhisper: false,    // 💬 แชทกระซิบ (whisper) ทุกข้อความ
    telegramBotToken: '',           // ★ Bot Token (จาก @BotFather) — persist ในเครื่อง + ส่งไป relay
    telegramChatId: '',             // ★ Chat ID (จาก @userinfobot)

    // ---------- AUTO-SELL (★ default OFF) ----------
    //  trigger: ของเต็ม (0x20 'too full') OR ครบเวลา sellIntervalMin
    //  เลือก NPC + แมป เอง + เลือก item ที่จะขายเอง (default ไม่ขายอะไร)
    sellEnabled: false,
    sellNpcName: 'Tool Dealer',   // ชื่อ NPC (หาจาก entities kind=2)
    sellNpcMap: 'izlude_in',     // แมปที่ NPC อยู่ (วาร์ปไปแมปนี้)
    sellNpcX: 116,                // ★ พิกัด X ที่จะวาร์ปไป (ใกล้ NPC ที่สุด, mirror บอทหลัก npcMapX)
    sellNpcY: 55,                 // ★ พิกัด Y ที่จะวาร์ปไป (-999 = random spawn, แต่อาจไกล NPC)
    sellIntervalMin: 0,           // 0=off, >0=ขายทุก N นาที
    sellOnFull: true,             // ขายเมื่อของเต็ม (server ส่ง 'too full')
    sellItemIds: [908,909,910,911,918,919,920,921,924,926,928,940,943,946,949,950,951,955,960,961,962,1024,1052,7033,935,915,913,957,7032,902,1068,1067,948,907,1021,906,937,945,705,1023,1050,956,1057,963,914,905,511,711,721,1051,1054,1053,901,1094,1020,1019,7054,1022,7013,7094,7356,7317,7004,7049,1055,7064,967,912,1027,1096,7070,7358,7357,942,7359,953,1501,2221,1035,1032,1031,1013,1402,1916,1026,947,1014,1040,1034,1012,737,904,7031,1056,7007,903,7041,930,958,934,1059,1099,1098,7174,1025,1042,1017,7318,1028,1041,1061,1405,1408,2220,7119,923,7012,1063,7009,7002,931,7005,1095,1097,938,2297,1301,932,1505,1060,734,7069,7072,7066,7068,954,7156,7053,7158,7157,7106,7107,7001,7159,7124,7063,7111,7112,1038,7015,713,936,2303,1016,2304,1202,7154,7155,7153,7152,7126,1044,922,1116,1064,1201,1039,1602,1033,7067,1048,1062,944,7003,7006,1036,7123,1037,941,7030,7150,7149,7151,959],              // ★ item id ที่ติ๊กว่าจะขาย (default ว่าง = ไม่ขายอะไร)

    // ---------- AUTO-STORAGE (ฝากของเข้า Kafra) ----------
    //  ★ default OFF — เปิดเองใน config tab หรือ ASSIST.storageOn()
    //  mirror บอทหลัก config.bot.autoStorage (config.json:743-924)
    storageEnabled: false,        // เปิดใช้ตอนเริ่มหรือไม่
    kafraName: 'Kafra Staff',     // ชื่อ NPC Kafra (หาจาก entities kind=2)
    kafraMap: 'prontera',         // แมปที่ Kafra อยู่
    kafraMapX: 151,               // พิกัด Kafra จริง (วาร์ปข้าง ๆ ที่ +1,+1)
    kafraMapY: 29,                // พิกัด Kafra จริง (วาร์ปข้าง ๆ ที่ +1,+1)
    kafraChoice: 1,               // index เมนู "Use Storage" (0=Save, 1=Use Storage, 2=Teleport)
    depositOnFull: true,          // ฝากเมื่อ server แจ้งเต็ม หรือ น้ำหนักถึง depositWeightPercent
    depositWeightPercent: 90,     // น้ำหนักถึง N% → เริ่มไปฝาก (0 = ปิด trigger น้ำหนัก)
    depositAfterSell: true,       // ★ chain: ฝากต่อทันทีหลังขายเสร็จ
    // all = default: ฝากทุกอย่างที่ไม่ใช่อุปกรณ์สวม/Weapon Set, selected = ใช้รายการด้านล่าง
    storageDepositMode: 'all',
    depositItemIds: [],           // ใช้เมื่อ storageDepositMode='selected'
    // กันยอดติดตัวขั้นต่ำก่อนฝาก; เช่น [{itemId:509, amount:50}]
    storageReserveItems: [{ itemId: 509, amount: 50 }, { itemId: 656, amount: 10 }],

    // ---------- ORE REFINE + SELL (manual tool) ----------
    // Flow: warp จุดเริ่มเพียงครั้งเดียว → Kafra ถอน Great Nature → Master Scholar Trade → Sell Green Live → วนจน Kafra หมด
    // หลังถึงจุดเริ่ม ส่ง NpcClick ตรงตามพิกัดเท่านั้น — ไม่มี MOVE และไม่มีวาร์ปตาม NPC ใน flow นี้
    oreRefineMap: 'prt_fild08',
    oreRefineHubX: 149,
    oreRefineHubY: 361,
    oreRefineKafraName: 'Kafra Staff',
    // Kafra Staff ของ Milestone camp อยู่ prt_fild08 (158,362).
    // 146,89 คือ Kafra Defolty ในแมป prontera ไม่ใช่ prt_fild08.
    oreRefineKafraX: 158,
    oreRefineKafraY: 362,
    oreRefineKafraChoice: 1,
    oreRefineKafraNextCount: 1,
    oreRefineNpcName: 'Master Scholar',
    oreRefineNpcX: 141,
    oreRefineNpcY: 370,
    oreRefineTradeChoice: 2,
    oreRefineTradeEntry: 9,
    oreRefineSellChoice: 1,
    oreRefineBatchSize: 99,
    oreRefineSourceItemId: 997,      // Great Nature
    oreRefineResultItemId: 993,      // Green Live — ขายยอดทั้งหมดที่ server ยืนยันว่ามีใน Inventory

    // ---------- FARM MAP (แมปฟาร์ม) ----------
    //  ใช้สำหรับ: (1) เผลอเดินเข้าวาร์ป → เปลี่ยนแมป → วาร์ปกลับอัตโนมัติ
    //             (2) กดปุ่ม "วาร์ปไปแมปฟาร์ม" เพื่อกลับทันที (manual)
    //  ★ farmMap ว่าง = ปิดฟีเจอร์ทั้งคู่ (mirror บอทหลัก autoTeleport.mapName)
    farmMap: 'mjolnir_03',                  // ชื่อแมปฟาร์ม (เช่น 'cmd_fild01') — ว่าง = ไม่ใช้
    farmMapX: -999,               // พิกัด X ที่จะวาร์ปไป (-999 = random spawn ในแมปนั้น)
    farmMapY: -999,               // พิกัด Y
    warpBackToFarm: true,         // ถ้า currentMap เปลี่ยนจาก farmMap → วาร์ปกลับอัตโนมัติ

    // ---------- HUD SETTINGS ----------
    // ขยายเฉพาะ panel Settings ที่ฝังอยู่บน HUD; ไม่กระทบปุ่ม HUD หรือ WebGL ทั้งหน้า.
    settingsFontScale: 1.15,
    // 0 = ไม่จำกัด FPS; ค่าอื่นต้องเป็นหนึ่งใน FPS_CAP_OPTIONS.
    // จำกัดเฉพาะ render loop ผ่าน requestAnimationFrame — ไม่แตะ timer/WebSocket ของบอท.
    renderFpsCap: 0,

    // ---------- AUTO-LOOT ----------
    lootEnabled: true,
    pickRadius: 2,                // ระยะ (ช่อง) จากตัวเรา ที่จะถือว่าของเป็นของเรา
    combatWindowMs: 2500,         // ของตกต้องมาภายในเวลานี้หลังเราตี/ฆ่า
    lootDelayAfterDropMs: 0,      // ★ รอ N ms หลังของตก แล้วค่อยเริ่มเก็บ (0 = เก็บทันที, กันดูเป็นบอท)
    lootPostKillSettleMs: 1000,   // ★ หลังฆ่ามอน รอรับ packet drop ให้ครบก่อนค่อยเลือกเป้าใหม่ (0 = ปิด)
    lootUseKillPos: true,         // ★ เช็ค item ใกล้พิกัดมอนที่เราฆ่า (นักธนูฆ่าไกล → ของตกไกล)
    pickRadiusKill: 5,            // ★ ระยะ (ช่อง) จากพิกัดมอนที่ตาย ที่จะถือว่าของเป็นของเรา
    attemptIntervalMs: 500,       // ห่างระหว่างการลองเก็บชิ้นเดิม (0.5 วิ)
    sendThrottleMs: 100,          // ห่างระหว่างคำสั่งเก็บทุกชิ้น (กันสแปม)
    maxAttempts: 3,               // เก็บไม่ได้ครบจำนวนครั้ง → ปล่อย
    itemMaxAgeMs: 30000,          // ของเก่ากว่านี้ → ทิ้งออกจากคิว
    lootTickMs: 300,

    // ---------- LOOT QUEUE (Localhost / Cloudflare) ----------
    // role=farm: special item จะไม่เก็บเองและส่งงานเข้า queue
    // role=collector: รับงาน, วาร์ป/เดินไปเก็บ, แล้วกลับ home ที่ตั้งไว้
    lootQueueRole: 'off',        // 'off' | 'farm' | 'collector'
    // lootQueueUrl เก็บไว้เพื่อย้ายค่าจากรุ่นเก่าเท่านั้น; ห้ามใช้เป็น endpoint runtime ใหม่
    lootQueueUrl: 'ws://127.0.0.1:8787',
    lootQueueTransport: 'local', // 'local' | 'cloudflare' — เลือกเอง ไม่เดาจาก URL
    lootQueueLocalUrl: 'ws://127.0.0.1:8787',
    lootQueueCloudflareUrl: '',  // wss://...workers.dev/?token=... (เก็บใน browser เครื่องนี้)
    lootQueueGroup: 'default',   // ทั้งสองไอดีต้องใช้ชื่อเดียวกัน
    lootQueueHomeMap: '',
    lootQueueHomeX: -999,
    lootQueueHomeY: -999,
    lootQueueItemIds: [],        // item ที่ให้ไอดีฟาร์มส่งต่อไป collector
    lootQueueSendAll: false,     // farm only: ส่งทุก drop โดยไม่ต้องอยู่ในรายการพิเศษ
    lootQueueClaimDelayMs: 5000, // รอก่อนออกจากจุดรอ/เมืองเพื่อรวม drop (0=ทันที)
    lootQueueNearbySettleMs: 1000, // ทิ้งงานแล้วรอก่อนหา job ถัดไป (0=ทันที)
    lootQueueActionTimeoutMs: 1000, // รอผลของ pickup แต่ละครั้งก่อน retry/ทิ้งงาน (ms)
    lootQueueWarpCooldownMs: 0, // ดีเลย์ก่อนวาร์ป job ถัดไป (0=ทันที); WARP_CONFIRM ยังกันคำสั่งซ้ำของ job เดิม
    lootQueuePickupRetryCount: 2, // server ตอบ FAIL/เงียบหลังวาร์ป → retry เพิ่มหลังคำสั่งแรกกี่ครั้ง

    // ---------- WARP-TO-LOOT (ฟีเจอร์รุนแรง — default OFF) ----------
    //  เมื่อเก็บของไม่ได้ครบ maxAttempts (server เงียบ = ติดกำแพง/หน้าผา)
    //  → วาร์ปไปที่พิกัดของไอเท็ม แล้วส่ง pickup อีกครั้ง
    //  ★ default OFF เพราะส่ง packet warp จริง — เปิดเองด้วย ASSIST.warpLootOn()
    warpLootEnabled: false,
    warpLootMaxOffsets: 3,        // ลองกี่ offset รอบไอเท็ม (กลาง + ±3 รอบข้าง) ก่อนปล่อยทิ้ง
    warpLootCooldownMs: 2000,     // ห่างขั้นต่ำระหว่างการวาร์ป (กันสแปม)
    warpLootPickupDelayMs: 1000,   // รอ server ย้ายตัวละครหลังวาร์ป ก่อนส่ง pickup

    // ---------- AUTO-COMBAT (★ default OFF — ส่ง attack packet จริง) ----------
    //  เปิดเองด้วย ASSIST.combatOn()
    //  targetWhitelist: [] = ตีทุกมอน kind=1; ['Poring', 4000] = ตีเฉพาะ (รองรับชื่อ + sprite id)
    //  ⚠️ ว่าง = ตีทุกมอน รวม MVP/มอนแรง → แนะนำให้ตั้ง whitelist หรือใช้ blacklist กันตาย
    combatEnabled: false,
    targetWhitelist: ["Sky Petit"],          // [] = ตีมอน kind=1 ทุกตัว; ['Poring', 4000] = เฉพาะ (รองรับชื่อ + sprite id)
    targetBlacklist: ["Bigfoot", "Poporing", "Willow","Martin"],          // ไม่ตีมอนเหล่านี้ (ชื่อหรือ sprite id)
    attackRange: 2,               // ระยะโจมตี (ช่อง) — ใช้กับเงื่อนไขสกิลระยะประชิด
    rangedAttackRange: 0,         // 0 = ใช้ attackRange; >0 = นักธนูตีไกลได้ N ช่อง
    maxAcquireDistance: 15,       // ★ ระยะที่ส่ง ATTACK แล้วให้ game client เดินไล่ตีเอง
    searchRadii: [1,3,5, 10, 15, 20, 30], // ★ ระยะหาเป้า; เกิน acquire ได้ แต่ต้องไม่เกิน maxChaseDistance
    maxChaseDistance: 40,         // ★ เดินไล่ตามมอนได้สูงสุด N ช่อง (ไกลกว่านี้ abandon หาตัวอื่น)
    walkStepDistance: 20,         // ★ สั่งเดินทีละ N ช่อง (game click-walk cap ~20)
    combatTickMs: 200,            // tick loop (มี jitter ±25% เหมือนบอทหลัก)
    postCombatDelayMs: 800,      // ★ รอ N ms หลังสู้เสร็จ/เก็บของเสร็จ ก่อนทำอย่างอื่น (ดูเป็นธรรมชาติ)
    attackProbeMs: 2000,          // Attack แล้วไม่มีทั้ง hit/miss และ player movement → unreachable
    combatGatProgressTimeoutMs: 3500, // Combat GAT เดินแล้ว route/ระยะไม่คืบ → unreachable
    // มอนบางตัว (เช่น Sleeper) อาจซ่อนตัวชั่วคราว: รอ entity กลับมาแล้ว Attack ซ้ำ แทน abandon ทันที
    hiddenWaitMonsters: ['Sleeper'],
    hiddenWaitSec: 4,
    // เมื่อมอนใน hiddenWaitMonsters ใช้ Cloaking จริง: ใช้ Sight เฉพาะเมื่อยังไม่มีบัพ Sight
    // ไม่ใช่การกดทุกครั้งที่พบมอนในรายการ
    hiddenSightEnabled: true,
    aggroKeepAliveMs: 15000,      // ★ มอน aggro เรา → ถือว่ายังสู้อยู่ N ms (กัน abandon ตอนมอนเดินมาหา)
    maxEngageSec: 120,            // abandon target ถ้า engage นานกว่านี้ (2 นาที)
    maxEngageSecSlow: 600,        // ★ abandon มอน "ตีช้า/เจาะไม่เข้า" (เห็ด/พืช) ถ้านานกว่านี้ (3 นาที)
    slowMonsterSubIds: [4010, 4011, 4013, 4017, 4041, 4030, 4106, 4153],  // ★ sub-ID ที่ตี damage 1
    // flee (วาร์ปหนี)
    fleeOnMobCount: 4,            // มอนรุม N ตัว (ที่ตีเรา) → วาร์ปหนี (0=off)
    fleeOnAggroCount: 0,          // มอนจับเราเป็นเป้า N ตัว → วาร์ปหนี (0=off)
    fleeOnProximityCount: 0,      // มอนอยู่รอบ N ตัวในระยะ → วาร์ปหนี (0=off)
    fleeOnProximityRadius: 8,
    fleeMobWindowMs: 5000,        // ช่วงเวลาที่นับว่ามอน "กำลังตีเรา"
    fleeCooldownMs: 1000,
    fleeMonsters: [],             // ★ มอนที่ต้องหนี (ชื่อหรือ sub-ID) — เจอในระยะ → วาร์ปหนีทันที
    fleeMonsterRadius: 20,        // ★ ระยะ (ช่อง) ที่ถ้าเจอมอนใน fleeMonsters → วาร์ปหนี
    fleeOnPlayerCount: 1,         // พบผู้เล่นอื่น N คนในระยะ → วาร์ปหนี (0=off)
    fleeOnPlayerRadius: 30,       // รัศมีตรวจผู้เล่นอื่น (ช่อง)
    fleeOnPlayerDelaySec: 4,      // พบผู้เล่นแล้วรอก่อนวาร์ป (0=ทันที)
    fleePlayerExceptions: [],     // ชื่อผู้เล่นที่ไม่นับใน Flee Player (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    fleeOnMvp: false,             // ตรวจพบ MVP/Boss บน minimap ในระยะ → วาร์ปหนี
    fleeOnMvpRadius: 20,          // รัศมีตรวจ MVP/Boss (ช่อง)
    // KS avoidance + ป้องกันแย่ง
    antiKS: false,                 // ไม่ตีมอนที่คนอื่นกำลังสู้ (default ON)
    antiKSCooldownMs: 5000,       // มอนที่ถูกตีโดยคนอื่น จะถูกข้ามไป N ms
    avoidOtherPlayers: false,      // ไม่ตีมอนที่อยู่ใกล้ผู้เล่นคนอื่น
    playerProximityRadius: 10,
    // หลังวาร์ปรอ packet SPAWN/ATTACK รอบตัวสั้น ๆ ก่อนหาเป้าครั้งแรก
    // กันล็อกมอนที่มีผู้เล่นคนอื่นตีอยู่ แต่ packet ของอีกฝ่ายยังมาไม่ทัน
    postWarpTargetSettleMs: 600,
    // target selection
    targetLowestHpFirst: false,    // ถูกรุม ≥2 ตัว → ตีเลือดน้อยสุดก่อน

    // ---------- WEAPON SET ----------
    // bagId คือไอเท็มชิ้นจริงในกระเป๋า (ไม่ใช่ itemId) เพราะอาวุธชนิดเดียวกันอาจตีบวก/ใส่การ์ดต่างกัน
    weaponSetEnabled: false,
    weaponSets: [
      { id: 'default', name: 'Default', rightBagId: null, leftMode: 'keep', leftBagId: null },
    ],
    weaponDefaultSetId: 'default',
    // rule เรียงจากบนลงล่าง: monster รองรับชื่อหรือ sub-ID เช่น { monster: 'Marse', setId: 'katar' }
    weaponMonsterRules: [],
    // stuck
    warpToMonster: true,         // ติดกำแพง → วาร์ปไปหามอน (toggle, default OFF)
    warpToMonsterMaxPerEntity: 2, // วาร์ปตรงหามอนอย่างมาก 2 ครั้งต่อ entity
    stuckWarpOnAbandon: 2,        // unreachable 2 ครั้งใน 60s → วาร์ปสุ่ม
    warpToBoss: false,            // ★ วาร์ปไปสู้ mini-boss เมื่อตรวจจับได้ (toggle, default OFF)
    // หามอน
    wanderEnabled: true,          // ไม่เจอมอน → สุ่มเดิน
    wanderMaxStep: 20,            // สุ่มระยะ ≤20 ช่อง
    wanderCooldownMs: 3000,
    warpFindEnabled: true,       // ไม่เจอมอนนาน → วาร์ปสุ่ม (default ON)
    noMonsterWarpSec: 2,          // ไม่เจอมอนต่อเนื่อง N วินาที → วาร์ปสุ่ม

    // โหมดกรองของ: 'all' = เก็บหมด, 'only' = เก็บเฉพาะ, 'except' = ยกเว้น
    filter: { mode: 'except', onlyItems: [], exceptItems: [909,916,1302,1602,2302,1750,517,1701,1702,1010,935,917,938,949,519,507,512,516,1501,511] },

    // ---------- ทั่วไป ----------
    verbose: true,
    itemNames: {
      501: 'Red Potion', 502: 'Yellow Potion', 503: 'White Potion',
      504: 'Blue Potion', 505: 'Wing of Fly', 601: 'Wing of Butterfly',
      909: 'Jellopy', 916: 'Bird Feather', 512: 'Apple',
    },
  };

  // ============================================================
  //  PROFILE — ชุด config แยกตามงาน/ตัวละคร
  //  เก็บเฉพาะ CFG ที่ persist; Nav/GAT cache, log และ runtime state ใช้ร่วมกัน
  // ============================================================
  const PROFILES_STORAGE_KEY = 'roPureProfiles_v1';
  const PROFILE_ACTIVE_STORAGE_KEY = 'roPureActiveProfile_v1';
  // snapshot ก่อน loadConfig: สลับ profile แล้ว key ที่ไม่มีต้องกลับ default จริง
  const CFG_DEFAULTS = JSON.parse(JSON.stringify(CFG));
  const cloneConfigValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function loadProfilesStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILES_STORAGE_KEY));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      let migrated = false;
      for (const snapshot of Object.values(parsed)) migrated = normalizeStorageDepositMode(snapshot) || migrated;
      if (migrated) localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(parsed));
      return parsed;
    } catch (_) { return {}; }
  }
  function saveProfilesStore(profiles) {
    try { localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles)); return true; }
    catch (_) { return false; }
  }
  function activeProfileName() {
    try { return localStorage.getItem(PROFILE_ACTIVE_STORAGE_KEY) || 'default'; }
    catch (_) { return 'default'; }
  }
  function setActiveProfileName(name) {
    try { localStorage.setItem(PROFILE_ACTIVE_STORAGE_KEY, name); } catch (_) {}
  }
  function notifyProfilesChanged() {
    // UI สร้าง dropdown ตอนเปิด HUD; Import/console API จึงต้องบอกให้มันอ่าน localStorage ใหม่
    try { window.dispatchEvent(new Event('assist:profiles-changed')); } catch (_) {}
  }
  function normalizeProfileName(name) {
    const value = String(name || '').trim().replace(/\s+/g, ' ');
    if (!value || value.length > 80 || ['__proto__', 'prototype', 'constructor'].includes(value)) return '';
    return value;
  }
  function profileSnapshot() { return cloneConfigValue(persistedConfig()); }
  function normalizeProfilesPayload(rawProfiles) {
    if (!rawProfiles || typeof rawProfiles !== 'object' || Array.isArray(rawProfiles)) return {};
    const clean = {};
    for (const [rawName, snapshot] of Object.entries(rawProfiles)) {
      const name = normalizeProfileName(rawName);
      if (!name || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue;
      clean[name] = {};
      for (const key of PERSIST_KEYS) {
        if (Object.prototype.hasOwnProperty.call(snapshot, key)) clean[name][key] = cloneConfigValue(snapshot[key]);
      }
      normalizeStorageDepositMode(clean[name]);
    }
    return clean;
  }
  function shouldMigrateNoMonsterWarpDefault(data) {
    const version = String(data && data._version || '').trim();
    // v4.x คือ userscript ต้นทางก่อนชื่อ Pure; v1.0.0–1.0.4 ยังมี default เก่า 5s.
    if (/^4\./.test(version)) return true;
    const match = version.match(/^1\.0\.(\d+)$/);
    return !!match && Number(match[1]) < 5;
  }
  function migrateNoMonsterWarpDefault(data, config) {
    if (!shouldMigrateNoMonsterWarpDefault(data) || !config) return false;
    if (Number(config.noMonsterWarpSec) !== 5) return false;
    config.noMonsterWarpSec = 2;
    return true;
  }
  // Storage รุ่นก่อน 1.1.0 ไม่มี mode. ถ้าเคยเลือกรายการฝากไว้แล้ว
  // ให้คงเจตนาเดิมเป็น selected; รายการว่างจึงเปลี่ยนเป็น all.
  function normalizeStorageDepositMode(config) {
    if (!config || typeof config !== 'object') return false;
    if (config.storageDepositMode === 'all' || config.storageDepositMode === 'selected') return false;
    config.storageDepositMode = Array.isArray(config.depositItemIds) && config.depositItemIds.length ? 'selected' : 'all';
    return true;
  }
  // Import เก่าบางรุ่นมี config ไม่ครบ แต่มีค่าเต็มอยู่ใน active profile.
  // profile เติมเฉพาะ key ที่หาย ส่วน config สดจากเครื่องต้นทางต้องมีสิทธิ์ทับเสมอ.
  function buildImportConfig(data, importedProfiles, requestedActive) {
    const merged = {};
    const activeSnapshot = requestedActive && importedProfiles[requestedActive];
    if (activeSnapshot && typeof activeSnapshot === 'object') {
      for (const key of PERSIST_KEYS) {
        if (Object.prototype.hasOwnProperty.call(activeSnapshot, key)) merged[key] = cloneConfigValue(activeSnapshot[key]);
      }
    }
    if (data.config && typeof data.config === 'object' && !Array.isArray(data.config)) {
      for (const key of PERSIST_KEYS) {
        if (Object.prototype.hasOwnProperty.call(data.config, key)) merged[key] = cloneConfigValue(data.config[key]);
      }
    }
    migrateNoMonsterWarpDefault(data, merged);
    normalizeStorageDepositMode(merged);
    return merged;
  }
  function backupQueueSummary(data) {
    const countItems = (config) => Array.isArray(config && config.lootQueueItemIds) ? config.lootQueueItemIds.length : 0;
    const profiles = data && data.profiles && typeof data.profiles === 'object' ? data.profiles : {};
    return {
      configKeys: data && data.config && typeof data.config === 'object' ? Object.keys(data.config).length : 0,
      configQueueItems: countItems(data && data.config),
      profileCount: Object.keys(profiles).length,
      profileQueueItems: Object.fromEntries(Object.entries(profiles).map(([name, config]) => [name, countItems(config)])),
      activeProfile: data && data.activeProfile || 'default',
    };
  }
  function profileNames() {
    const active = activeProfileName();
    const names = Object.keys(loadProfilesStore());
    if (!names.includes(active)) names.unshift(active);
    return names.sort((a, b) => (a === active ? -1 : b === active ? 1 : a.localeCompare(b)));
  }

  // ★ โหลดค่าที่บันทึกไว้จาก localStorage (ทับ default)
  loadConfig();
  if (normalizeStorageDepositMode(CFG)) saveConfig();
  // Master Bot is a deep module: every autonomous loop only checks enabled(),
  // while release/reset behaviour is owned here through one pause handler.
  // Packet decoding and explicit manual buttons are deliberately outside it.
  const masterBot = (() => {
    let isEnabled = true;
    let handlers = { pause: null, resume: null };
    try { isEnabled = localStorage.getItem(MASTER_BOT_STORAGE_KEY) !== '0'; } catch (_) {}
    const persist = () => { try { localStorage.setItem(MASTER_BOT_STORAGE_KEY, isEnabled ? '1' : '0'); } catch (_) {} };
    return {
      enabled() { return isEnabled; },
      setEnabled(next) {
        next = !!next;
        if (isEnabled === next) return isEnabled;
        isEnabled = next;
        persist();
        try { (next ? handlers.resume : handlers.pause)?.(); } catch (error) { log('⚠️ Master Bot transition:', error.message); }
        log(next ? '⏻ Master Bot: ON — กลับมาทำ automation ตามค่ารายระบบ' : '⏻ Master Bot: PAUSED — หยุด automation ทั้งหมด');
        return isEnabled;
      },
      setHandlers(nextHandlers) { handlers = { ...handlers, ...(nextHandlers || {}) }; },
      status() { return { enabled: isEnabled, label: isEnabled ? 'ON' : 'PAUSED' }; },
    };
  })();
  // เปลี่ยนค่าเริ่มต้น 5s → 2s เพียงครั้งเดียว; ไม่ทับคนที่ตั้งค่าอื่นเอง.
  try {
    const migrationKey = 'roPureNoMonsterWarpDefaultV2';
    if (!localStorage.getItem(migrationKey)) {
      if (Number(CFG.noMonsterWarpSec) === 5) { CFG.noMonsterWarpSec = 2; saveConfig(); }
      localStorage.setItem(migrationKey, '1');
    }
  } catch (_) {}
  // ย้ายค่าจากรุ่นที่มี URL queue ช่องเดียวไปเป็น Localhost/Cloudflare แบบแยกกันหนึ่งครั้ง.
  // เก็บ lootQueueUrl เดิมไว้เสมอเพื่อให้ย้อนกลับไปใช้ script รุ่นเก่าได้โดยไม่เสียค่า endpoint.
  function lootQueueTransportMode() {
    return CFG.lootQueueTransport === 'cloudflare' ? 'cloudflare' : 'local';
  }
  function lootQueueTransportLabel(mode = lootQueueTransportMode()) {
    return mode === 'cloudflare' ? 'Cloudflare' : 'Localhost';
  }
  function lootQueueEndpoint(mode = lootQueueTransportMode()) {
    return String((mode === 'cloudflare' ? CFG.lootQueueCloudflareUrl : CFG.lootQueueLocalUrl) || '').trim();
  }
  function isLocalQueueEndpoint(url) {
    return /^ws:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(String(url || '').trim());
  }
  function migrateLootQueueTransportConfig() {
    const legacy = String(CFG.lootQueueUrl || '').trim();
    let changed = false;
    if (legacy) {
      if (isLocalQueueEndpoint(legacy) && !CFG.lootQueueLocalUrl) { CFG.lootQueueLocalUrl = legacy; changed = true; }
      if (!isLocalQueueEndpoint(legacy) && !CFG.lootQueueCloudflareUrl) { CFG.lootQueueCloudflareUrl = legacy; changed = true; }
      // ค่าเก่าที่เป็น wss:// ถือเป็น Cloudflare/remote; รุ่นใหม่จะจำ mode ไว้ชัดเจนหลังจากนี้.
      if (!isLocalQueueEndpoint(legacy) && CFG.lootQueueTransport !== 'cloudflare') { CFG.lootQueueTransport = 'cloudflare'; changed = true; }
    }
    const active = lootQueueEndpoint();
    if (active && CFG.lootQueueUrl !== active) { CFG.lootQueueUrl = active; changed = true; }
    if (changed) saveConfig();
  }
  migrateLootQueueTransportConfig();
  // Migration ของค่า ore-refine รุ่นแรก: พิกัด 146,89 เป็น Kafra ใน prontera
  // แต่ flow นี้ทำงานบน prt_fild08 จึงหา NPC ไม่เจอและ timeout เสมอ.
  if (CFG.oreRefineMap === 'prt_fild08' && Number(CFG.oreRefineKafraX) === 146 && Number(CFG.oreRefineKafraY) === 89
      && /kafra/i.test(String(CFG.oreRefineKafraName || ''))) {
    CFG.oreRefineKafraName = 'Kafra Staff';
    CFG.oreRefineKafraX = 158;
    CFG.oreRefineKafraY = 362;
    saveConfig();
  }
  // ผู้ใช้เลือกไม่ใช้ Warp-to-Loot: ปิดทับค่าที่อาจค้างอยู่ใน localStorage ทุกครั้งที่เริ่ม script
  CFG.warpLootEnabled = false;
  loadSkillTimes();  // ★ โหลดเวลา skill ล่าสุดข้าม session

  // ---------- state ทั่วไป ----------
  let activeWS = null;                 // game socket (ใช้ส่งคำสั่ง)
  let gameServerUrl = '';              // ★ URL ของเซิร์ฟเวอร์เกม (เช่น wss://gamesea01.rayrag.com/ws)
  // ---------- AUTO LOGIN / RECOVERY state ----------
  let autoLoginPhase = 'idle';         // idle | awaitLoginResult | acctOk | charSent | done | failed
  let autoLoginToken = null;
  let autoLoginAttemptAt = 0;
  let autoLoginBootstrapStarted = false;
  let autoLoginSplashTimer = null;
  let autoLoginEnterTimer = null;
  let lastGamePacketAt = Date.now();
  let wsOpenedAt = 0;
  let autoRefreshScheduled = false;
  let autoRefreshTimer = null;
  function autoRefreshMovementStallMs() {
    const sec = Number(CFG.autoRefreshMovementStallSec);
    return Number.isFinite(sec) ? Math.max(0, Math.min(3600, Math.round(sec))) * 1000 : 600000;
  }
  let playerId = null;                 // ไอดีตัวเรา
  let playerName = null;               // ★ ชื่อตัวเรา — guard กัน false ID change (mirror world.js:1235)
  let hpStatGraceUntil = 0;            // ★ grace period หลัง ID เปลี่ยน (ข้าม STAT HP ที่อาจผิด)
  const player = { x: null, y: null }; // ตำแหน่งตัวเรา
  let lastPlayerPositionChangedAt = 0; // เวลา player ขยับจริงล่าสุด (สำหรับ lock สกิลระหว่างเดิน)
  let lastPlayerPositionPacketAt = 0;  // packet ตำแหน่งล่าสุด (ใช้จับ action ของ Loot Queue)
  let teleportCoordinator = null;      // สร้างหลัง state วาร์ปพร้อม; setPlayerPosition แจ้งการยืนยันพิกัดสดได้
  function setPlayerPosition(x, y) {
    lastPlayerPositionPacketAt = nowMs();
    if (player.x !== x || player.y !== y) lastPlayerPositionChangedAt = nowMs();
    player.x = x;
    player.y = y;
    teleportCoordinator?.onPlayerPosition(x, y, lastPlayerPositionPacketAt);
  }

  // ============================================================
  //  ACTIVITY JOURNAL — activity/debug/important ในที่เดียว
  //  UI อ่านผ่าน module นี้เท่านั้น เพื่อให้ formatting, scroll และ selection อยู่จุดเดียว
  // ============================================================
  const activityJournal = (() => {
    const limits = { activity: 200, debug: 300, important: 200 };
    const entries = { activity: [], debug: [], important: [] };
    const sourceLabel = { activity: '', debug: 'Debug ', important: 'สำคัญ' };
    const stringify = (args) => args.map(x => (typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x))).join(' ');
    const time = (t) => {
      const d = new Date(t);
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') + ':' + d.getSeconds().toString().padStart(2, '0');
    };
    const normalizeSource = (source) => entries[source] ? source : 'activity';
    const hasSelectionIn = (box) => {
      const selection = window.getSelection && window.getSelection();
      return !!(selection && !selection.isCollapsed && ((selection.anchorNode && box.contains(selection.anchorNode)) || (selection.focusNode && box.contains(selection.focusNode))));
    };
    const renderLine = (entry, source) => {
      const line = document.createElement('div');
      line.className = 'logline';
      if (source === 'important') line.style.color = entry.type === 'card' ? '#f1c40f' : (entry.type === 'chat' ? '#ef5350' : '#e8e8e8');
      const ts = document.createElement('span');
      ts.className = 'ts'; ts.textContent = time(entry.t);
      line.append(ts, document.createTextNode(' ' + entry.msg));
      return line;
    };
    return {
      record(source, message, type = null) {
        const list = entries[normalizeSource(source)];
        list.push({ t: Date.now(), msg: String(message), ...(type ? { type } : {}) });
        while (list.length > limits[normalizeSource(source)]) list.shift();
      },
      message(args) { return stringify(args); },
      read(source) { return entries[normalizeSource(source)].slice(); },
      clear(source) { entries[normalizeSource(source)].length = 0; },
      copyText(source) {
        return entries[normalizeSource(source)].map(entry => '[' + time(entry.t) + '] ' + entry.msg).join('\n');
      },
      invalidate(box) { if (box) delete box.dataset.journalSig; },
      render(box, source) {
        if (!box || hasSelectionIn(box)) return; // ห้ามล้าง node ที่ผู้ใช้กำลังลากเลือกเพื่อ copy
        source = normalizeSource(source);
        const list = entries[source];
        const sig = source + ':' + list.length + ':' + (list[0] ? list[0].t : 0) + ':' + (list.length ? list[list.length - 1].t : 0);
        if (box.dataset.journalSig === sig) return;
        const wasNearBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
        box.dataset.journalSig = sig;
        const fragment = document.createDocumentFragment();
        if (list.length) list.forEach(entry => fragment.appendChild(renderLine(entry, source)));
        else {
          const empty = document.createElement('div');
          empty.className = 'logline';
          empty.style.color = source === 'important' ? '#5f6368' : '#9aa0a6';
          empty.textContent = source === 'important' ? '(ยังไม่มี log สำคัญ)' : '(ยังไม่มี ' + sourceLabel[source] + 'log)';
          fragment.appendChild(empty);
        }
        box.replaceChildren(fragment);
        if (wasNearBottom) box.scrollTop = box.scrollHeight;
      },
    };
  })();
  function log(...a) {
    activityJournal.record('activity', activityJournal.message(a));
    if (CFG.verbose) console.log('[ASSIST]', ...a);
  }
  function dbg(...a) {
    activityJournal.record('debug', activityJournal.message(a));
    if (CFG.verbose) console.debug('[ASSIST][DEBUG]', ...a);
  }
  function logImportant(type, msg, { relay = true } = {}) {
    activityJournal.record('important', msg, type);
    log(msg);   // ส่งไป log ปกติด้วย
    if (!relay) return;
    // ★ ส่ง alert ไป relay server → forward ไป Telegram (ถ้ามี config + เปิด toggle ประเภทนี้)
    let category = null;
    if (type === 'card') category = 'telegramAlertCard';
    else if (type === 'flee') category = 'telegramAlertFlee';
    else if (type === 'chat') category = 'telegramAlertBotMention';
    else category = 'telegramAlertCard';   // default = ส่ง
    if (CFG[category] !== false) sendRelayAlert(msg);
  }

  // ============================================================
  //  FPS CAP — จำกัด requestAnimationFrame หลัง Unity boot สำเร็จเท่านั้น
  //  - ส่ง callback ที่รอในรอบเดียวกันทั้งหมด เพื่อรักษา semantics ของ rAF
  //  - ไม่แตะ setInterval/setTimeout/WebSocket: bot loop ยังทำงานตามเวลาปกติ
  //  - 0 = native rAF (ไม่จำกัด); ค่าอื่นผ่าน whitelist เท่านั้น
  // ============================================================
  const FPS_CAP_OPTIONS = Object.freeze([0, 15, 30, 45, 60]);
  const createFpsCap = () => {
    const originalRAF = window.requestAnimationFrame;
    const originalCAF = window.cancelAnimationFrame;
    if (typeof originalRAF !== 'function' || typeof originalCAF !== 'function') {
      return {
        set() { return null; },
        status() { return { supported: false, enabled: false, targetFps: 0, pendingCallbacks: 0 }; },
      };
    }

    const nativeRAF = originalRAF.bind(window);
    const nativeCAF = originalCAF.bind(window);
    let enabled = false;
    let targetFps = 0;
    let intervalMs = 0;
    let lastFrameAt = -Infinity;
    let nextCallbackId = 1;
    let nativeFrameId = null;
    let deliveredFrames = 0;
    let skippedVsyncs = 0;
    const pending = new Map();

    const schedule = () => {
      if (!enabled || nativeFrameId != null || !pending.size) return;
      nativeFrameId = nativeRAF(tick);
    };

    const cappedRAF = (callback) => {
      const id = nextCallbackId++;
      pending.set(id, callback);
      schedule();
      return id;
    };

    const cappedCAF = (id) => { pending.delete(id); };

    function tick(now) {
      nativeFrameId = null;
      if (!enabled || !pending.size) return;
      if (now - lastFrameAt < intervalMs) {
        skippedVsyncs++;
        schedule();
        return;
      }

      lastFrameAt = now;
      const callbacks = [...pending.values()];
      pending.clear();
      deliveredFrames += callbacks.length;
      for (const callback of callbacks) {
        try { callback(now); }
        catch (error) { setTimeout(() => { throw error; }, 0); }
      }
    }

    const enable = (fps) => {
      targetFps = fps;
      intervalMs = 1000 / fps;
      lastFrameAt = -Infinity;
      if (enabled) return;
      enabled = true;
      window.requestAnimationFrame = cappedRAF;
      window.cancelAnimationFrame = cappedCAF;
    };

    const disable = () => {
      if (!enabled) { targetFps = 0; return; }
      enabled = false;
      targetFps = 0;
      lastFrameAt = -Infinity;
      if (nativeFrameId != null) nativeCAF(nativeFrameId);
      nativeFrameId = null;
      if (window.requestAnimationFrame === cappedRAF) window.requestAnimationFrame = originalRAF;
      if (window.cancelAnimationFrame === cappedCAF) window.cancelAnimationFrame = originalCAF;

      // ห้ามทิ้ง loop ของเกมที่กำลังรออยู่ตอนผู้ใช้เลือก Unlimited.
      for (const callback of pending.values()) nativeRAF(callback);
      pending.clear();
    };

    return {
      set(value) {
        const fps = Number(value);
        if (!FPS_CAP_OPTIONS.includes(fps)) return null;
        if (fps === 0) disable();
        else enable(fps);
        return fps;
      },
      status() {
        return {
          supported: true,
          enabled,
          targetFps,
          pendingCallbacks: pending.size,
          deliveredFrames,
          skippedVsyncs,
        };
      },
    };
  };
  const fpsCap = createFpsCap();
  // Unity ใช้ requestAnimationFrame ระหว่างโหลด/compile WASM ด้วย จึงห้าม
  // patch มันตั้งแต่ document-start แม้ผู้ใช้เคยเลือก FPS cap ไว้. รอจน
  // loading bar แสดงแล้วถูกซ่อน (createUnityInstance สำเร็จ) ก่อนค่อยเปิด.
  let unityBootCompleted = false;
  // การเปลี่ยนแมปใช้ Unity main loop เพื่อคลาย/activate scene จึงปลด cap
  // ก่อนส่ง warp ข้ามแมป และคืนเมื่อ MAP_NAME ของแมปใหม่เข้ามาแล้ว 3 วินาที.
  const MAP_LOAD_CAP_SETTLE_MS = 3000;
  const MAP_LOAD_CAP_MAX_SUSPEND_MS = 15000;
  let fpsCapMapLoadActive = false;
  let fpsCapMapRestoreTimer = null;
  let fpsCapMapRestoreAt = 0;
  function clearFpsCapMapRestoreTimer() {
    if (fpsCapMapRestoreTimer) clearTimeout(fpsCapMapRestoreTimer);
    fpsCapMapRestoreTimer = null;
    fpsCapMapRestoreAt = 0;
  }
  function resumeFpsCapAfterMapLoad() {
    clearFpsCapMapRestoreTimer();
    if (!fpsCapMapLoadActive) return;
    fpsCapMapLoadActive = false;
    setConfiguredFpsCap(CFG.renderFpsCap);
  }
  function scheduleFpsCapAfterMapLoad(delayMs) {
    clearFpsCapMapRestoreTimer();
    fpsCapMapRestoreAt = Date.now() + delayMs;
    fpsCapMapRestoreTimer = setTimeout(resumeFpsCapAfterMapLoad, delayMs);
  }
  function suspendFpsCapForMapLoad() {
    if (!unityBootCompleted || !CFG.renderFpsCap) return false;
    fpsCapMapLoadActive = true;
    fpsCap.set(0);
    // เผื่อ server ไม่ยืนยัน MAP_NAME หรือวาร์ปถูกปฏิเสธ: ห้ามปลด cap ค้างถาวร.
    scheduleFpsCapAfterMapLoad(MAP_LOAD_CAP_MAX_SUSPEND_MS);
    return true;
  }
  function settleFpsCapAfterMapLoad() {
    if (!unityBootCompleted || !CFG.renderFpsCap) return false;
    // Server-forced map changes may not have an outgoing 0x40 for us to see.
    // We cannot release before that scene starts, but still keep the new map's
    // spawn/activation frames uncapped once MAP_NAME confirms the transition.
    if (!fpsCapMapLoadActive) {
      fpsCapMapLoadActive = true;
      fpsCap.set(0);
    }
    scheduleFpsCapAfterMapLoad(MAP_LOAD_CAP_SETTLE_MS);
    return true;
  }
  function setConfiguredFpsCap(value) {
    const fps = Number(value);
    if (!FPS_CAP_OPTIONS.includes(fps)) {
      CFG.renderFpsCap = 0;
      if (unityBootCompleted) fpsCap.set(0);
      return null;
    }
    CFG.renderFpsCap = fps;
    if (unityBootCompleted && !fpsCapMapLoadActive) fpsCap.set(fps);
    return fps;
  }
  function completeUnityBoot() {
    if (unityBootCompleted) return;
    unityBootCompleted = true;
    setConfiguredFpsCap(CFG.renderFpsCap);
  }
  function armFpsCapAfterUnityBoot() {
    let loadingBarSeenVisible = false;
    let barObserver = null;
    const bindLoadingBar = () => {
      const loadingBar = document.querySelector('#unity-loading-bar');
      if (!loadingBar) return false;
      const check = () => {
        const visible = window.getComputedStyle(loadingBar).display !== 'none';
        if (visible) loadingBarSeenVisible = true;
        if (!loadingBarSeenVisible || visible) return;
        if (barObserver) barObserver.disconnect();
        completeUnityBoot();
      };
      if (typeof MutationObserver === 'function') {
        barObserver = new MutationObserver(check);
        barObserver.observe(loadingBar, { attributes: true, attributeFilter: ['style', 'class'] });
      }
      check();
      return true;
    };
    if (bindLoadingBar() || typeof MutationObserver !== 'function') return;
    const documentObserver = new MutationObserver(() => {
      if (!bindLoadingBar()) return;
      documentObserver.disconnect();
    });
    documentObserver.observe(document, { childList: true, subtree: true });
  }
  setConfiguredFpsCap(CFG.renderFpsCap);
  armFpsCapAfterUnityBoot();

  // ★ chat history buffer — เก็บแชทล่าสุดสำหรับ monitor
  const CHAT_BUF_MAX = 50;
  const chatBuf = [];

  // ---------- AI CHAT REPLY ----------
  // ใช้ fetch จาก page context เพื่อไม่เปลี่ยน @grant (script นี้ต้อง patch WebSocket ของเกม)
  // endpoint ต้องตอบรูปแบบ OpenAI-compatible: { choices:[{ message:{ content } }] }
  let aiReplyPending = false;
  const aiReplyLastAtBySender = new Map();
  const aiReplySentAt = [];
  let aiReplyLastTemplate = '';
  // ลำดับสนทนา: จบ target เดิม → รอหน่วง → ตอบ → เก็บของใกล้เท้า → hold จนผู้พูดออกนอกระยะ
  // ไม่ผูกกับข้อความล้วน ๆ: sender ต้องมี entity player เดียวกันและอยู่ในรัศมีจริงเสมอ
  let aiInteraction = null;
  function aiReplyTrim(text, maxBytes = 190) {
    let out = String(text || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    const encoder = new TextEncoder();
    while (out && encoder.encode(out).length > maxBytes) out = out.slice(0, -1);
    return out;
  }
  function aiReplyAllowedNameSet() {
    return new Set((Array.isArray(CFG.aiReplyAllowedNames) ? CFG.aiReplyAllowedNames : [])
      .map(n => String(n || '').trim().toLowerCase()).filter(Boolean));
  }
  function aiReplyTemplateList() {
    return (Array.isArray(CFG.aiReplyTemplates) ? CFG.aiReplyTemplates : [])
      .map(reply => aiReplyTrim(reply, 190)).filter(Boolean);
  }
  function aiReplyUsesTemplates() { return CFG.aiReplyMode === 'template'; }
  function aiReplyIsConfigured() {
    return aiReplyUsesTemplates()
      ? aiReplyTemplateList().length > 0
      : !!(CFG.aiReplyApiUrl && CFG.aiReplyApiKey && CFG.aiReplyModel);
  }
  function getVerifiedAiReplyPlayer(sender, name, message, chatType) {
    if (!CFG.aiReplyEnabled || chatType !== 0) return null;
    if (!aiReplyIsConfigured()) return false;
    if (sender === playerId || (playerName && name === playerName)) return false;
    const other = entities.get(sender);
    if (!other || other.kind !== 0 || other.x == null || other.y == null || player.x == null || player.y == null) return null;
    // packet chat มีชื่อ และ entity มีชื่อ: ถ้าทั้งคู่มี ต้องตรงกัน เพื่อกัน sender/id mapping เก่าหรือผิดตัว
    if (name && other.name && String(name).trim().toLowerCase() !== String(other.name).trim().toLowerCase()) return null;
    const radius = Math.max(1, Math.min(50, Number(CFG.aiReplyRadius) || 10));
    if (dist(player, other) > radius) return null;
    const allowedNames = aiReplyAllowedNameSet();
    const verifiedName = String(other.name || name || '').trim();
    if (allowedNames.size && !allowedNames.has(verifiedName.toLowerCase())) return null;
    if (CFG.aiReplyRequireNameMention) {
      if (!playerName || !String(message || '').toLowerCase().includes(playerName.toLowerCase())) return null;
    }
    return { entity: other, name: verifiedName || 'ผู้เล่นใกล้ตัว' };
  }
  function aiInteractionStillNearby(interaction = aiInteraction) {
    if (!interaction || !CFG.aiReplyEnabled) return false;
    const other = entities.get(interaction.sender);
    if (!other || other.kind !== 0 || other.x == null || other.y == null || player.x == null || player.y == null) return false;
    if (interaction.name && other.name && String(interaction.name).trim().toLowerCase() !== String(other.name).trim().toLowerCase()) return false;
    const radius = Math.max(1, Math.min(50, Number(CFG.aiReplyRadius) || 10));
    return dist(player, other) <= radius;
  }
  function isAiReplyInteractionActive() { return !!aiInteraction && CFG.aiReplyEnabled; }
  function clearAiInteraction(reason = '') {
    if (!aiInteraction) return;
    const name = aiInteraction.name;
    aiInteraction = null;
    if (reason) { log('🤖 จบ AI Reply hold:', reason); dbg('🤖 AI interaction release:', name, reason); }
  }
  function aiReplyCanSend(sender) {
    if (aiReplyPending || !CFG.aiReplyEnabled) return false;
    const now = Date.now();
    const cooldownMs = Math.max(0, Number(CFG.aiReplyCooldownSec) || 0) * 1000;
    if (now - (aiReplyLastAtBySender.get(sender) || 0) < cooldownMs) return false;
    while (aiReplySentAt.length && now - aiReplySentAt[0] >= 60000) aiReplySentAt.shift();
    return aiReplySentAt.length < Math.max(1, Math.min(20, Number(CFG.aiReplyMaxPerMin) || 1));
  }
  function randomAiReplyDelayMs() {
    let min = Math.max(0, Math.min(10, Number(CFG.aiReplyDelayMinSec) || 0));
    let max = Math.max(0, Math.min(10, Number(CFG.aiReplyDelayMaxSec) || 0));
    if (max < min) [min, max] = [max, min];
    return Math.round((min + Math.random() * (max - min)) * 1000);
  }
  function queueAiReplyInteraction(sender, name, message, chatType) {
    const verified = getVerifiedAiReplyPlayer(sender, name, message, chatType);
    const receivedMessage = aiReplyTrim(message, 500);
    if (!verified || !receivedMessage) return false;
    const now = nowMs();
    if (aiInteraction && aiInteraction.sender !== sender) return false; // ไม่ขัดบทสนทนาคนเดิม
    const delayMs = randomAiReplyDelayMs();
    if (aiInteraction) {
      aiInteraction.message = receivedMessage;
      aiInteraction.replyNotBeforeAt = now + delayMs;
      aiInteraction.phase = target ? 'FINISH_COMBAT' : 'WAIT_REPLY';
      aiInteraction.replyRequested = false;
      log('🤖 AI Reply: ได้ข้อความใหม่จาก', verified.name, '→ รีเซ็ตเวลารอ');
    } else {
      aiInteraction = { sender, name: verified.name, message: receivedMessage, startedAt: now,
        replyNotBeforeAt: now + delayMs, phase: target ? 'FINISH_COMBAT' : 'WAIT_REPLY', replyRequested: false };
      log('🤖 AI Reply: ยืนยัน', verified.name, 'ในระยะ ' + dist(player, verified.entity).toFixed(1) + ' ช่อง → '
        + (target ? 'จบมอนตัวปัจจุบันก่อนตอบ' : 'รอตอบ'));
      dbg('🤖 AI interaction start:', verified.name, 'sender=' + sender.toString(16), 'phase=' + aiInteraction.phase, 'delay=' + delayMs + 'ms');
    }
    return true;
  }
  async function requestAiReply(interaction) {
    if (!interaction || !aiReplyCanSend(interaction.sender) || !aiInteractionStillNearby(interaction)) return null;
    aiReplyPending = true;
    const senderName = aiReplyTrim(interaction.name || 'ผู้เล่นใกล้ตัว', 60);
    const receivedMessage = aiReplyTrim(interaction.message, 500);
    dbg('🤖 AI Reply request:', senderName, 'distance=', Math.round(dist(player, entities.get(interaction.sender)) * 10) / 10);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => { try { controller && controller.abort(); } catch (_) {} }, 15000);
    try {
      const response = await fetch(CFG.aiReplyApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CFG.aiReplyApiKey },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          model: CFG.aiReplyModel,
          messages: [
            { role: 'system', content: aiReplyTrim(CFG.aiReplyPrompt, 900) },
            { role: 'user', content: 'ผู้เล่นชื่อ ' + senderName + ' พูดใกล้ตัวว่า: ' + receivedMessage + '\nตอบกลับเป็นข้อความเดียวสั้น ๆ เท่านั้น' },
          ],
          max_tokens: Math.max(16, Math.min(200, Number(CFG.aiReplyMaxTokens) || 60)),
          temperature: 0.7,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + response.status));
      const reply = aiReplyTrim(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
      if (!reply) throw new Error('AI ไม่ส่งข้อความตอบกลับ');
      return reply;
    } catch (e) {
      log('⚠️ AI Reply ล้มเหลว:', e && e.message ? e.message : String(e));
      dbg('🤖 AI Reply error:', e && e.stack ? e.stack : String(e));
      return null;
    } finally {
      clearTimeout(timeout);
      aiReplyPending = false;
    }
  }
  function requestTemplateReply(interaction) {
    if (!interaction || !aiReplyCanSend(interaction.sender) || !aiInteractionStillNearby(interaction)) return null;
    const choices = aiReplyTemplateList();
    if (!choices.length) return null;
    // หลีกเลี่ยงประโยคเดิมติดกันเมื่อมีตัวเลือกมากกว่า 1 ข้อความ
    const alternatives = choices.length > 1 ? choices.filter(reply => reply !== aiReplyLastTemplate) : choices;
    const reply = alternatives[Math.floor(Math.random() * alternatives.length)] || choices[0];
    aiReplyLastTemplate = reply;
    dbg('🤖 Template Reply selected:', interaction.name, reply);
    return reply;
  }
  async function requestConfiguredReply(interaction) {
    return aiReplyUsesTemplates() ? requestTemplateReply(interaction) : requestAiReply(interaction);
  }
  function processAiReplyInteraction(now = nowMs()) {
    const interaction = aiInteraction;
    if (!interaction) return false;
    if (!aiInteractionStillNearby(interaction)) { clearAiInteraction('ผู้พูดออกนอกระยะ'); return false; }
    if (interaction.phase === 'FINISH_COMBAT') {
      if (target) return false; // ปล่อย combat เดิมฆ่าเป้านี้ต่อ ห้าม acquire เป้าใหม่
      interaction.phase = 'WAIT_REPLY';
      log('🤖 AI Reply: จบเป้าปัจจุบันแล้ว → รอเวลาตอบ');
    }
    if (interaction.phase === 'WAIT_REPLY') {
      if (now < interaction.replyNotBeforeAt || aiReplyPending) return true;
      interaction.phase = 'THINKING';
      interaction.replyRequested = true;
      const token = interaction.startedAt;
      void requestConfiguredReply(interaction).then(reply => {
        if (!aiInteraction || aiInteraction.startedAt !== token) return;
        if (!aiInteractionStillNearby(aiInteraction)) { clearAiInteraction('ผู้พูดออกนอกระยะก่อนตอบ'); return; }
        if (reply && sendChat(reply, 0)) {
          const sentAt = nowMs();
          aiReplyLastAtBySender.set(aiInteraction.sender, sentAt);
          aiReplySentAt.push(sentAt);
          log(aiReplyUsesTemplates() ? '💬 Template ตอบ' : '🤖 AI ตอบ', aiInteraction.name + ':', reply);
          dbg(aiReplyUsesTemplates() ? '💬 Template Reply sent:' : '🤖 AI Reply sent:', aiInteraction.name, reply);
        }
        // ตอบสำเร็จหรือ API ล้มเหลวก็ปล่อยให้เก็บของใกล้ตัว แล้ว hold ต่อจนผู้พูดออกระยะ
        if (aiInteraction) aiInteraction.phase = 'LOOT';
      });
      return true;
    }
    if (interaction.phase === 'THINKING') return true;
    if (interaction.phase === 'LOOT') {
      // รอ quiet window ของ drop หลังฆ่าด้วย จึงไม่เปลี่ยนเป็น hold ก่อนของเข้าคิว
      const hasNearbyLoot = [...queue.values()].some(shouldAllowAiReplyPickup);
      if (hasNearbyLoot || pickupPending || now < lootSettleUntil) return true;
      interaction.phase = 'HOLD';
      log('🤖 AI Reply: เก็บของใกล้ตัวเสร็จ → hold รอ', interaction.name, 'ออกนอกระยะ');
    }
    return true; // HOLD: หยุด acquire / move / attack / wander / warp ทุกอย่าง
  }
  function shouldAllowAiReplyPickup(it) {
    if (!aiInteraction || aiInteraction.phase !== 'LOOT') return false;
    if (!aiInteractionStillNearby(aiInteraction) || player.x == null || player.y == null) return false;
    return Math.hypot(it.x - player.x, it.y - player.y) <= Math.max(0, Number(CFG.pickRadius) || 0);
  }
  const nameOf = (id) => {
    const db = itemDisplayName(id);
    return db !== 'item_' + id ? `${db}(${id})` : (CFG.itemNames[id] ? `${CFG.itemNames[id]}(${id})` : `item_${id}`);
  };

  // ★ per-item action: 'keep' | 'sell' | 'deposit' (เก็บ/ขาย/ฝาก — เลือกได้อย่างเดียว)
  //   เก็บไว้ใน sellItemIds/depositItemIds ที่มีอยู่แล้ว (deposit สำคัญกว่า sell ถ้าซ้ำ)
  function getItemAction(id) {
    if (CFG.depositItemIds.includes(id)) return 'deposit';
    if (CFG.sellItemIds.includes(id)) return 'sell';
    return 'keep';
  }
  // ★ วน toggle: keep → sell → deposit → keep (สำหรับปุ่มใน UI)
  function cycleItemAction(id) {
    const cur = getItemAction(id);
    // ลบจากทั้งสองก่อน
    CFG.sellItemIds = CFG.sellItemIds.filter(x => x !== id);
    CFG.depositItemIds = CFG.depositItemIds.filter(x => x !== id);
    if (cur === 'keep') { CFG.sellItemIds.push(id); log('💰', nameOf(id), '→ ขาย'); }
    else if (cur === 'sell') { CFG.depositItemIds.push(id); CFG.storageDepositMode = 'selected'; log('🏦', nameOf(id), '→ ฝากเฉพาะรายการ'); }
    else { log('📦', nameOf(id), '→ เก็บ'); }
    return getItemAction(id);
  }

  // ---------- สถิติการฟาร์ม ----------
  const stats = {
    startTime: Date.now(),
    kills: 0,              // จำนวนที่ฆ่าได้ (นับจาก EXP gain)
    itemsLooted: 0,        // จำนวนชิ้นที่เก็บได้
    expGained: 0,          // EXP รวมที่ได้ (base+job delta)
    baseExpGained: 0,      // ★ Base EXP delta (session) — แยกจาก job
    jobExpGained: 0,       // ★ Job EXP delta (session)
    itemsByCount: new Map(), // itemId -> จำนวนที่เก็บได้
    pickupFails: 0,        // ครั้งที่พยายามเก็บแล้วล้มเหลว
    deaths: 0,             // ครั้งที่ตาย
    // ★ rolling windows (mirror world.js:66-67, bot.js:401-422)
    dealtWindow: [],       // [{t, damage}] — 10s rolling for DPS
    attackWindow: [],      // [{t}] — 10s rolling for ASPD (รวม miss)
    goldWindow: [],        // [{t, gold}] — 5min rolling for zeny/hour
    sessionDamageDealt: 0, // cumulative total damage (session)
    sessionAttacks: 0,     // cumulative total attacks (session)
    sessionGold: 0,        // cumulative total gold value (session)
  };
  function resetStats() {
    stats.startTime = Date.now();
    stats.kills = 0; stats.itemsLooted = 0; stats.expGained = 0; stats.baseExpGained = 0; stats.jobExpGained = 0;
    stats.itemsByCount = new Map(); stats.pickupFails = 0; stats.deaths = 0;
    sessionLootItems.clear();
    stats.dealtWindow = []; stats.attackWindow = []; stats.goldWindow = [];
    stats.sessionDamageDealt = 0; stats.sessionAttacks = 0; stats.sessionGold = 0;
  }

  // ---------- HP tracking ----------
  //  ★★★ ทุก STAT(0x25) packet ของ player = HP update (หลักฐานจากบอทหลัก world.js:1605-1643)
  //    statType เป็นแค่ label วนๆ (83 ค่าต่อ session) ทุก packet มี (cur,max) อยู่ในช่วง HP เดียวกัน
  //    → รับทุกตัวเลย แค่ sanity check (0 ≤ cur ≤ max)
  //    (ก่อนหน้านี้ใช้เทคนิค "เก็บ max สูงสุด" → ผิด! ถ้า server ส่ง sub-stat ที่ max=6774 → ทับ hp.max
  //     → แสดง 549/6774 ทั้งที่ HP จริง 408)
  const hp = { cur: null, max: null };
  const sp = { cur: null, max: null };   // ★ SP สำหรับ autoSkill — ตรวจ spMin
  function applyStat(id, cur, m) {
    if (id !== playerId) return;
    if (!(m > 0) || cur < 0 || cur > m) return;          // sanity check
    const now = nowMs();
    // ★★ grace period หลัง ID เปลี่ยน — ข้าม STAT HP ที่อาจผิด (mirror world.js:1620-1626)
    if (hpStatGraceUntil && now < hpStatGraceUntil && hp.cur != null) {
      return;   // ยังอยู่ใน grace + มี HP เก่า → ข้าม (รอค่าจริง)
    }
    if (hpStatGraceUntil && now >= hpStatGraceUntil) hpStatGraceUntil = 0;   // หมด grace → consume
    // ★ respawn detection: HP จาก 0/ตาย → กลับมา > 0 = เกิดใหม่แล้ว
    if (isDead && cur > 0) {
      isDead = false;
      heal.clearExhausted();                            // ล้าง mark "หมด" ทั้งหมด เริ่มนับใหม่
      heal.allExhaustedLogged = false;
    }
    hp.cur = cur;
    hp.max = m;
  }
  const hpPct = () => (hp.cur != null && hp.max > 0) ? (hp.cur / hp.max) * 100 : null;

  // ============================================================
  //  AUTO-HEAL
  // ============================================================
  //  ★ logic การเลือก item:
  //   - แต่ละ item มี "exhaustedUntil" = เวลาที่จะลองใช้ใหม่ได้
  //     (= 0 หรือ ผ่านไปแล้ว = ใช้ได้ปกติ)
  //   - 'order'  : เลือก item แรกสุดที่ "ใช้ได้" (ตามลำดับที่ตั้ง) → ใช้ซ้ำจนกว่าจะหมด
  //                พอหมด → mark exhaustedUntil = now + healExhaustedMs → ข้ามไปตัวถัดไปทันที
  //                พอหมดเวลา → ลองใหม่ → ถ้าเก็บมาเพิ่มก็ใช้ได้ทันที (ไม่ mark ถาวร)
  //   - 'random' : สุ่มเลือกเฉพาะ item ที่ "ใช้ได้" ตอนนั้น
  //   - ทุกครั้งที่ใช้ item → จำ HP ก่อนใช้ → รอ healItemEffectCheckMs → เช็คผล
  //     ถ้า HP ไม่ขยับ = หมด → mark exhaustedUntil + ข้าม delay → ใช้ตัวถัดไปทันที
  //   - ตอนตาย (isDead) → หยุด heal ทั้งหมด (กันนึกว่ายาหมดทั้งหมด)
  let isDead = false;
  let lastRespawnAt = 0;          // ★ timestamp ที่ส่ง respawn ล่าสุด (throttle)
  let postRespawnRest = false;    // ★ บังคับนั่งพักหลัง respawn จนกว่า HP จะเต็ม

  // ---------- AUTO-REST state ----------
  let isResting = false;          // กำลังนั่งพักอยู่
  let restUntil = 0;              // timestamp ที่จะลุก (กันค้าง — restMaxSec)
  const heal = {
    exhaustedUntil: new Map(),    // itemId -> timestamp ที่จะลองใช้ใหม่ได้
    depletedItemIds: new Set(),   // itemId ที่ inventory ยืนยันแล้วว่าเหลือ 0
    lastUseAt: 0,                 // เวลาที่ใช้ item ครั้งล่าสุด
    pendingCheckAt: 0,            // เวลาที่ใช้ item ล่าสุด (รอเช็คผล)
    pendingItemId: null,          // item ที่รอเช็คผลอยู่
    pendingHpBefore: null,        // HP ก่อนใช้ item ล่าสุด
    pendingItemConsumed: false,   // 0x32 ยืนยันว่า item ที่ pending ถูกใช้ไปแล้ว
    commandLockUntil: 0,          // ระหว่างส่งยา ให้ Heal มีสิทธิ์เหนือ Attack/Skill ชั่วครู่

    // item นี้ "ใช้ได้" ไหม (ไม่ได้ถูก mark ว่าเพิ่งหมด)
    isAvailable(id, now) {
      if (this.depletedItemIds.has(id)) return false;
      const t = this.exhaustedUntil.get(id) || 0;
      return now >= t;
    },
    // mark ว่า item หมด → รอ healExhaustedMs แล้วค่อยลองใหม่
    markExhausted(id, now) {
      this.exhaustedUntil.set(id, now + CFG.healExhaustedMs);
    },
    markDepleted(id) {
      this.depletedItemIds.add(id);
      this.exhaustedUntil.delete(id);
    },
    // 0x32 / full inventory snapshot เรียกจุดนี้: ได้ของเพิ่มให้ Heal กลับมาลองได้เอง
    updateInventoryStock(id, count) {
      if (!CFG.healItems.includes(id) || !Number.isFinite(count)) return;
      if (count > 0) {
        this.depletedItemIds.delete(id);
        this.allExhaustedLogged = false;
      } else {
        // 0x32 เป็นยอดจาก server โดยตรง จึงยืนยัน item หมดได้แม้ full snapshot 0x38 อ่านไม่สำเร็จ
        this.markDepleted(id);
      }
    },
    syncKnownInventory() {
      if (!inventorySnapshotAt) return;
      for (const id of CFG.healItems) this.updateInventoryStock(id, inventory.get(id) || 0);
    },
    // ใช้เฉพาะ safety flow: รู้แน่จาก inventory ว่ายาฮีลทุกชนิดหมดจริง
    // ไม่ใช้ exhaustedUntil เพราะนั่นเป็นเพียงการพักลองใหม่ชั่วคราว ไม่ควรตัดสินว่ายาหมด
    isEmergency() {
      const pct = hpPct();
      if (!CFG.healEnabled || !CFG.healItems.length || pct == null || pct >= CFG.healAtPercent) return false;
      if (!inventorySnapshotAt) return false;
      return CFG.healItems.every(id => this.depletedItemIds.has(id) || (inventory.get(id) || 0) <= 0);
    },
    // เลือก item ถัดไปที่จะใช้ (ตามโหมด)
    pickNext(now) {
      const ids = CFG.healItems;
      if (!ids.length) return null;
      const avail = ids.filter(id => {
        // เมื่อมี full inventory snapshot แล้ว count=0 เป็นหลักฐานที่ดีกว่าการลองยิง packet
        if (inventorySnapshotAt > 0 && (inventory.get(id) || 0) <= 0) {
          this.markDepleted(id);
          return false;
        }
        return this.isAvailable(id, now);
      });
      if (!avail.length) return null;                // ทุกตัว mark ว่าหมดอยู่
      if (CFG.healMode === 'random') {
        return avail[Math.floor(Math.random() * avail.length)];
      }
      return avail[0];                               // 'order' = ตัวแรกที่ใช้ได้
    },
    // ล้าง mark "หมด" ทั้งหมด (ใช้ตอน respawn / reset)
    clearExhausted() { this.exhaustedUntil.clear(); },
  };

  // ส่งคำสั่งใช้ item: packet 0x2f, [2f][item_id:4 LE][target:4 LE], target=FFFFFFFF (self)
  function sendUseItem(itemId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(9);
    b[0] = 0x2f;
    b[1] = itemId & 0xff; b[2] = (itemId >> 8) & 0xff;
    b[3] = (itemId >> 16) & 0xff; b[4] = (itemId >>> 24) & 0xff;
    b[5] = 0xff; b[6] = 0xff; b[7] = 0xff; b[8] = 0xff;   // target = FFFFFFFF (self)
    activeWS.send(b);
    return true;
  }

  // ตัวเช็ค HP และใช้ยา
  const healLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.healEnabled) return;
    if (isAbBuffActive()) return;
    // ห้ามคำสั่งใช้ยาไปทับ dialog/packet ของ NPC ระหว่างขายหรือฝากของ
    if (sellState !== 'IDLE' || storageState !== 'IDLE' || isOreRefineActive()) return;
    // sendTeleport ตั้ง guard อยู่แล้ว; Heal รอ guard เดียวกันโดยไม่สร้าง timeout ใหม่
    if (isWarpGuardActive()) return;
    // ★★ GUARD สำคัญ: ถ้าไม่มี item heal เลย → ห้ามทำอะไร (กันส่ง packet 0x2f ปลอม → ถูกตรวจจับเป็นบอท)
    if (!CFG.healItems.length) return;
    const now = Date.now();
    const pct = hpPct();
    if (pct == null || hp.cur == null) return;            // ยังไม่รู้ HP
    if (isDead) return;                                   // ★ ตายอยู่ → ห้าม heal
    if (isResting) return;                                // ★ กำลังนั่งพัก → ข้าม heal (ใช้ regen แทน ประหยัดยา)

    // ★ ระหว่างรอผล ห้ามส่งยาใหม่ทับ pending เดิมเด็ดขาด
    // 0x32 ที่จำนวน item ลดลงยืนยันว่า server รับคำสั่งแล้ว → ปลด pending ทันที
    // เพื่อให้ยาเม็ดถัดไปใช้ตาม healDelayMs ได้ ไม่ต้องรอ HP update ซึ่งมักมาช้า.
    // ถ้าไม่มี 0x32 ค่อยใช้ timeout เป็น fallback เพื่อตรวจของหมด/คำสั่งไม่ติด.
    if (heal.pendingItemId != null && heal.pendingHpBefore != null) {
      // HP อาจมาก่อน packet 0x32: เมื่อ HP เพิ่มแล้วถือว่าคำสั่งก่อนหน้าติดทันที
      // อย่ารอ fallback timeout เต็มรอบ ไม่เช่นนั้นใช้ยาได้แค่ราว 1 เม็ด/วินาที
      const pendingHpIncreased = hp.cur > heal.pendingHpBefore + 1;
      if (!heal.pendingItemConsumed && !pendingHpIncreased && now - heal.pendingCheckAt < CFG.healItemEffectCheckMs) return;
      const pendingId = heal.pendingItemId;
      if (!heal.pendingItemConsumed && !pendingHpIncreased) {
        const stock = inventory.get(pendingId);
        if (heal.depletedItemIds.has(pendingId) || (inventorySnapshotAt > 0 && (!Number.isFinite(stock) || stock <= 0))) {
          log('💊', nameOf(pendingId), 'หมดจาก inventory → หยุดใช้จนกว่าจะมีเพิ่ม');
          heal.markDepleted(pendingId);
        } else {
          log('💊', nameOf(pendingId), 'ใช้แล้ว HP ไม่ขยับ → พักลองใหม่');
          heal.markExhausted(pendingId, now);
        }
        heal.lastUseAt = 0;                              // ถ้ามียาตัวอื่นให้ข้ามไปลองทันที
      }
      heal.pendingItemId = null;
      heal.pendingHpBefore = null;
      heal.pendingCheckAt = 0;
      heal.pendingItemConsumed = false;
    }

    // เงื่อนไขการใช้ยา — ใช้ได้เลยถ้า HP ยังต่ำ + ผ่าน delay (ไม่ต้องรอ pending เคลียร์)
    const belowThreshold = pct < CFG.healAtPercent;
    const notFull = CFG.healAtMax ? (hp.cur < hp.max) : belowThreshold;
    if (!notFull) return;
    if (now - heal.lastUseAt < CFG.healDelayMs) return;   // throttle ดีเลย์เท่านั้น

    const id = heal.pickNext(now);
    if (id == null) {
      // ทุกตัว mark ว่าหมดอยู่ → log ครั้งเดียวเมื่อเริ่มหมด (กัน spam)
      if (!heal.allExhaustedLogged) {
        log('⚠️ item heal ทุกตัวหมด/ไม่ได้ผล — รอเก็บ/ซื้อเพิ่ม');
        heal.allExhaustedLogged = true;
      }
      return;
    }
    heal.allExhaustedLogged = false;
    if (sendUseItem(id)) {
      heal.lastUseAt = now;
      // คำสั่ง Heal ต้องไม่ถูก Attack/Skill packet รอบถัดไปแทรกทันที
      // ใช้ delay เดียวกับที่ผู้ใช้ตั้งไว้ จึงไม่มี magic timing เพิ่ม
      heal.commandLockUntil = now + Math.max(0, Number(CFG.healDelayMs) || 0);
      heal.pendingItemId = id;
      heal.pendingHpBefore = hp.cur;                      // จำ HP ก่อนใช้ เพื่อเช็คผล
      heal.pendingCheckAt = now;
      heal.pendingItemConsumed = false;
      log('💉 ใช้', nameOf(id), `@ HP ${hp.cur}/${hp.max} (${pct.toFixed(0)}%)`);
    }
  }, CFG.healCheckMs);

  // ============================================================
  //  AUTO-BUFF — ใช้ไอเทมบัพเป็นระยะ (session timer)
  //    แต่ละ item มี intervalMin ของตัวเอง → ใช้ซ้ำเมื่อครบเวลาใน session นี้
  // ============================================================
  const buffLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.buffEnabled) return;
    if (isAbBuffActive()) return;
    if (!CFG.buffItems || !CFG.buffItems.length) return;
    if (isDead) return;
    if (!activeWS || activeWS.readyState !== 1) return;
    const now = nowMs();
    for (const item of CFG.buffItems) {
      if (!item || !item.itemId || !item.intervalMin) continue;
      const intervalMs = item.intervalMin * 60 * 1000;
      const last = lastBuffUse.get(item.itemId) || 0;
      // ★ rebuffDelay: รออย่างน้อย N ms ก่อนใช้ซ้ำ (กัน spurious ถ้า server ล้าง buff)
      if (last > 0 && (now - last) < Math.min(intervalMs, CFG.buffRebuffDelayMs)) continue;
      // ★ ยังไม่ครบ interval → skip
      if (last > 0 && (now - last) < intervalMs) continue;
      if (sendUseItem(item.itemId)) {
        lastBuffUse.set(item.itemId, now);
        const remainMin = item.intervalMin;
        log('✨ ใช้ buff', nameOf(item.itemId), '(ทุก', remainMin + 'นาที)');
      }
    }
  }, CFG.buffCheckMs);

  // ★ auto clear browser console — กัน log เยอะค้างหน่วย (0=off)
  let lastConsoleClearAt = Date.now();
  const consoleClearLoop = setInterval(() => {
    if (!CFG.autoClearConsoleMin || CFG.autoClearConsoleMin <= 0) return;
    if (Date.now() - lastConsoleClearAt >= CFG.autoClearConsoleMin * 60 * 1000) {
      try { console.clear(); } catch (_) {}
      lastConsoleClearAt = Date.now();
      log('🧹 clear console (ทุก ' + CFG.autoClearConsoleMin + ' นาที)');
    }
  }, 30000);   // เช็คทุก 30s

  // ============================================================
  //  AUTO-LOOT
  // ============================================================
  let lastCombatAt = 0, lastExpAt = 0, lastSendAt = 0;
  let pickupPending = null;       // {dropId, sentAt} — server รับ pickup พร้อมกันได้ไม่เสถียร
  let lootSettleUntil = 0;        // หลัง kill รอ packet drop; ระหว่างนี้ห้ามเลือก/ตีเป้าใหม่
  const recentDrops = new Map();       // dropId -> {dropId,x,y,itemId,t}
  const queue = new Map();             // dropId -> {dropId,itemId,x,y,attempts,lastAttemptAt,addedAt}
  // ★ recent kill positions — จดพิกัดมอนที่เราฆ่า เพื่อเช็ค item drop ใกล้หรือไม่
  //   สำคัญสำหรับนักธนู: ยิงมอนตายไกล → ของตกที่พิกัดมอน ไม่ใช่ที่ตัวเรา
  const recentKillPos = [];            // [{x, y, t}] — ล่าสุด 20 ตำแหน่ง, TTL 15 วินาที
  const KILL_POS_TTL_MS = 15000;
  const KILL_POS_MAX = 20;

  // ---------- WARP-TO-LOOT state ----------
  let currentMap = null;               // ชื่อแมปปัจจุบัน (จาก opcode 0x12) — จำเป็นสำหรับ warp
  let playerZeny = null;              // ★ เงินปัจจุบัน (จาก 0x38 MAP_DATA offset 9 — ส่งตอนเข้าแมป/วาร์ป)
  let lastFarmWarpBackAt = 0;          // ★ throttle retry วาร์ปกลับแมปฟาร์ม (กันติดแมปผิด)
  let bossAlertedIds = new Set();       // ★ entity IDs ที่ alert boss ไปแล้ว (กันสแปม)
  let lastBossWarpAt = 0;              // ★ throttle วาร์ปไปหา boss
  const warpQueue = new Map();         // dropId -> {dropId,itemId,x,y,offsetIdx,warpAt,pickupSentAt}
  let lastWarpAt = 0;                  // throttle การวาร์ป
  let warpGuardUntil = 0;              // Date.now(): รอ player pos อัปเดตก่อนคำนวณ dist
  let lastWarpPlayerPos = null;        // ★ player.x/y ก่อนวาร์ป (เช็คว่า pos เปลี่ยนไหม)
  let postWarpFleeScanPending = false; // หลังยืนยันตำแหน่งใหม่: ตรวจผู้เล่นที่ server ส่งเข้ามาหลังวาร์ป
  let postWarpTargetSettlePending = false; // หลัง guard: เริ่มรอ packet รอบตัวก่อน acquire เป้าแรก
  let postWarpTargetSettleUntil = 0;       // Date.now(): สิ้นสุดช่วงรอ packet SPAWN/ATTACK หลังวาร์ป
  let lastWarpTargetId = null;         // dropId ที่กำลังวาร์ปไป (เช็คผลจาก 0x2a)

  // ---------- AB BUFF state ----------
  // 0x10=Blessing, 0x11=Increase Agility; packet 0x3d apply, 0x3e remove.
  const AB_BUFF_STATUS_NAMES = { 0x10: 'Blessing', 0x11: 'Increase Agility' };
  const abBuffEffects = new Map();     // statusId -> { expiresAt } (Date.now)
  // Auto support uses the server's authoritative status rather than a guessed
  // rebuff interval.  These IDs come from GameConfig StatusEffects.toml.
  const SELF_SUPPORT_STATUS_BY_SKILL = new Map([[42, 0x11], [44, 0x10], [82, 0x32]]);
  const SELF_SUPPORT_SKILL_BY_STATUS = new Map([...SELF_SUPPORT_STATUS_BY_SKILL].map(([skillId, statusId]) => [statusId, skillId]));
  const selfSupportEffects = new Map(); // statusId -> { expiresAt }
  const selfSupportPendingUntil = new Map(); // skillId -> confirmation deadline; not a rebuff timer
  const SELF_SUPPORT_CONFIRM_MS = 5000;
  // Sight เป็น Combat reaction แยกจาก Auto-Skill: server ยืนยัน duration ผ่าน status 0x1e.
  // Rebuild enum: CharacterSkill.Sight=22, CharacterStatusEffect.Sight=30 (0x1e), AoE 7x7 = radius 3.
  const SIGHT_SKILL_ID = 22;
  const SIGHT_STATUS_ID = 0x1e;
  const SIGHT_SP_COST = 10;
  const SIGHT_RADIUS = 3;
  const SIGHT_CONFIRM_MS = 5000;
  let sightEffectUntil = 0;
  let sightPendingUntil = 0;
  let abBuffState = 'IDLE';            // IDLE → WARP_TO_AB → HP1 → HP2 → LV1 → LV2 → WAIT_BUFF → BUFF_COMPLETE_DELAY → RETURN_FARM
  let abBuffNextAt = 0;
  // timer ของ AB ใช้ Date.now() ให้สอดคล้องกับทุก flow ของเกม; reload แล้วเริ่มรอบใหม่ตามปกติ
  let abBuffPendingStartedAt = 0;       // Date.now(): เริ่มรอให้งาน combat/loot รอบปัจจุบันจบ
  let abBuffAttemptStartedAt = 0;      // Date.now(): เริ่มนับเมื่อเริ่มเดินทางไปรับบัพจริง
  let abBuffDisableAfterReturn = false; // timeout: ต้องวาร์ปกลับฟาร์มก่อน จึงค่อยปิด controller
  let abBuffWaitBlockerTag = '';       // log blocker เฉพาะเมื่อเหตุผลเปลี่ยน (กัน log รัวทุก 200ms)

  const u16 = (u, o) => u[o] | (u[o + 1] << 8);
  const u32 = (u, o) => ((u[o]) | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24)) >>> 0;
  const i16 = (u, o) => { const v = u16(u, o); return v >= 0x8000 ? v - 0x10000 : v; };   // signed int16 LE (พิกัดติดลบได้)
  const dv = new DataView(new ArrayBuffer(4));
  const f32 = (u, o) => { dv.setUint32(0, u32(u, o), true); return dv.getFloat32(0, true); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const FAIL = 0xffffffff;

  function shouldLoot(itemId) {
    const f = CFG.filter;
    if (f.mode === 'only')   return f.onlyItems.includes(itemId);
    if (f.mode === 'except') return !f.exceptItems.includes(itemId);
    return true;
  }

  function syncU8(d) {
    if (d instanceof ArrayBuffer) return new Uint8Array(d);
    if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
    return null;
  }
  async function toU8(d) {
    const u = syncU8(d);
    if (u) return u;
    if (typeof Blob !== 'undefined' && d instanceof Blob) return new Uint8Array(await d.arrayBuffer());
    return null;
  }

  // ส่งคำสั่งเก็บของ: packet 0x52, [52][drop_id:4 LE]
  function sendPickup(dropId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5);
    b[0] = 0x52;
    b[1] = dropId & 0xff; b[2] = (dropId >> 8) & 0xff;
    b[3] = (dropId >> 16) & 0xff; b[4] = (dropId >>> 24) & 0xff;
    activeWS.send(b);
    return true;
  }

  // ★ เขียน signed int16 LE ลง Uint8Array ที่ offset (รองรับค่าติดลบ เช่น -999)
  function writeI16LE(b, off, v) {
    const x = v & 0xffff;
    b[off] = x & 0xff; b[off + 1] = (x >> 8) & 0xff;
  }

  // ★ ฟังก์ชันล้าง State ข้อมูลรอบตัวเมื่อเกิดการวาร์ป
  function clearWarpState() {
    // 1. ล้างคิวเก็บของ (ยกเว้นกรณีตั้งใจวาร์ปไปเก็บของ warpLoot)
      queue.clear();
      recentDrops.clear();
      warpQueue.clear();
      pickupPending = null;
      lootSettleUntil = 0;

    // 2. ล้าง Entities และเป้าหมายทั้งหมด รวม self entity เก่าด้วย.
    // playerId/player.x/y เป็น state คนละชุดและยังอยู่เพื่อให้ warp guard เปรียบเทียบ
    // แต่ entity เก่ามาจากแมปเดิม ห้ามคืนเข้า map ใหม่: รอ SPAWN/MOVE/self marker สดเท่านั้น.
    entities.clear();
    radarPlayerIds.clear();
    warpToMonsterCount.clear(); // entity ID อาจถูก server นำกลับมาใช้หลังวาร์ป

    monsterAggro.clear();
    mobAttackers.clear();
    target = null;
    resetCombatGatChase();
    resetWeaponSwap('วาร์ป');

    // 3. รีเซ็ตระบบเดิน/สำรวจ
    movementPlanner.reset();
  }

  // ★ ส่ง packet วาร์ปจริงเท่านั้น — caller ทุกจุดต้องผ่าน Teleport coordinator ด้านล่าง
  //   x/y เป็น signed int16 (-999 = random) — format ยืนยันจากบอทหลักแล้ว
  function sendTeleportPacket(mapName, x, y) {
    const mapBytes = new TextEncoder().encode(mapName);
    const b = new Uint8Array(1 + 2 + mapBytes.length + 2 + 2 + 1);
    let p = 0;
    b[p++] = 0x40;
    b[p++] = mapBytes.length & 0xff; b[p++] = (mapBytes.length >> 8) & 0xff;
    b.set(mapBytes, p); p += mapBytes.length;
    writeI16LE(b, p, Math.round(x)); p += 2;
    writeI16LE(b, p, Math.round(y)); p += 2;
    b[p] = 0x00;
    activeWS.send(b);
  }

  // ============================================================
  //  TELEPORT COORDINATOR — มีสิทธิ์ส่ง cross-map/exact teleport เพียงงานเดียว
  //  interface: request(map, x, y, reason?) -> true เฉพาะเมื่อ packet ถูกส่งจริง
  //  caller เดิมมี retry/state machine ของตัวเองอยู่แล้ว จึงคืน false ระหว่าง hold
  //  เพื่อไม่ให้ caller เริ่ม timeout นับก่อน server ได้รับคำสั่งจริง.
  // ============================================================
  const TELEPORT_CROSS_MAP_GAP_MS = 3000;
  const TELEPORT_CONFIRM_TIMEOUT_MS = 6000;
  teleportCoordinator = (() => {
    let active = null;
    let lastCrossMapSentAt = 0;
    let lastHoldKey = '';
    let lastHoldLogAt = 0;
    const isSameMapRandom = (request) => request.map === currentMap && request.x === -999 && request.y === -999;
    const sameDestination = (a, b) => a && b && a.map === b.map && a.x === b.x && a.y === b.y;
    const logHold = (request, why, now) => {
      const key = request.map + ':' + request.x + ':' + request.y + ':' + why;
      if (key === lastHoldKey && now - lastHoldLogAt < 1000) return;
      lastHoldKey = key; lastHoldLogAt = now;
      log('🌀 Teleport: hold', request.map, '@(', request.x, request.y + ')', '—', why);
    };
    const confirm = (why) => {
      if (!active) return false;
      log('🌀 Teleport: ยืนยัน', active.map, '@(', active.x, active.y + ')', '—', why);
      active = null;
      return true;
    };
    const request = (mapName, x, y, reason = 'system') => {
      if (!activeWS || activeWS.readyState !== WebSocket.OPEN) {
        log('⚠️ ส่งวาร์ปไม่ได้: game socket ยังไม่พร้อม');
        return false;
      }
      if (!mapName) {
        log('⚠️ ส่งวาร์ปไม่ได้: ยังไม่รู้ชื่อแมป');
        return false;
      }
      const now = nowMs();
      const next = { map: String(mapName), x: Math.round(x), y: Math.round(y), reason, requestedAt: now };
      if (active) {
        logHold(next, sameDestination(active, next) ? 'รอยืนยันคำสั่งเดิม' : 'คำสั่งวาร์ปอื่นกำลังทำงาน', now);
        return false;
      }
      const crossMap = !currentMap || next.map !== currentMap;
      if (crossMap && now - lastCrossMapSentAt < TELEPORT_CROSS_MAP_GAP_MS) {
        logHold(next, 'เว้นระยะ cross-map ' + TELEPORT_CROSS_MAP_GAP_MS + 'ms', now);
        return false;
      }

      // clear state เฉพาะเมื่อส่ง packet จริง ไม่ใช่แค่ caller ขอวาร์ประหว่าง hold.
      clearWarpState();
      if (crossMap) suspendFpsCapForMapLoad();
      sendTeleportPacket(next.map, next.x, next.y);
      startTeleportGuard();
      if (crossMap) lastCrossMapSentAt = now;
      // วาร์ปสุ่มในแมปเดิมไม่ต้องรอ MAP_NAME และห้าม block safety flee/warp-find รอบถัดไป.
      if (!isSameMapRandom(next)) {
        active = { ...next, crossMap, sentAt: now, positionAt: lastPlayerPositionPacketAt, fromMap: currentMap };
      }
      log('🌀 Teleport: ส่ง', next.map, '@(', next.x, next.y + ')', '—', reason);
      return true;
    };
    return {
      request,
      onMapChanged(mapName) {
        if (active && active.crossMap && mapName === active.map && mapName !== active.fromMap) confirm('MAP_NAME');
      },
      onPlayerPosition(_x, _y, packetAt) {
        // exact warp ในแมปเดิมไม่มี MAP_NAME; รับตำแหน่งสดหลังส่งเป็น confirmation.
        if (active && !active.crossMap && currentMap === active.map && packetAt > active.positionAt) confirm('พิกัดสด');
      },
      onWarpFail() {
        if (!active) return false;
        log('⚠️ Teleport: server ปฏิเสธ', active.map, '@(', active.x, active.y + ')');
        active = null;
        return true;
      },
      tick(now = nowMs()) {
        if (active && now - active.sentAt >= TELEPORT_CONFIRM_TIMEOUT_MS) {
          log('⚠️ Teleport: รอยืนยันเกิน ' + (TELEPORT_CONFIRM_TIMEOUT_MS / 1000).toFixed(0) + 's → ปล่อยให้ flow เจ้าของ retry', active.map);
          active = null;
        }
      },
      status() {
        const now = nowMs();
        return {
          active: active && { map: active.map, x: active.x, y: active.y, reason: active.reason, crossMap: active.crossMap, remainingMs: Math.max(0, TELEPORT_CONFIRM_TIMEOUT_MS - (now - active.sentAt)) },
          crossMapGapRemainingMs: Math.max(0, TELEPORT_CROSS_MAP_GAP_MS - (now - lastCrossMapSentAt)),
        };
      },
    };
  })();

  function sendTeleport(mapName, x, y, reason) {
    return teleportCoordinator.request(mapName, x, y, reason);
  }

  function tickTeleportCoordinator(now) {
    teleportCoordinator?.tick(now);
  }

  function confirmTeleportMapChange(mapName) {
    teleportCoordinator?.onMapChanged(mapName);
  }

  function rejectActiveTeleport() {
    teleportCoordinator?.onWarpFail();
  }

  function startTeleportGuard() {
    // ★ ตั้ง warp guard — หลังวาร์ป player.x/y จะค้างจนกว่า server จะส่ง MOVE_UPDATE ใหม่
    //   combatLoop จะรอจนกว่า player pos จะเปลี่ยนจากก่อนวาร์ป ก่อนคำนวณ dist/ตี
    warpGuardUntil = nowMs() + 3000;          // หมดเวลา 3s กันค้าง (ถ้า server ไม่ส่ง pos ใหม่)
    lastWarpPlayerPos = (player.x != null) ? { x: player.x, y: player.y } : null;
    postWarpFleeScanPending = true;
    postWarpTargetSettlePending = true;
    postWarpTargetSettleUntil = 0;
  }

  // ============================================================
  //  LOOT QUEUE TRANSPORT — seam ระหว่าง queue core กับ WebSocket จริง
  //  adapter แต่ละ mode รู้เฉพาะ endpoint/reconnect policy; ไม่รู้ flow เก็บของ
  // ============================================================
  const lootQueueTransport = (() => {
    const adapters = Object.freeze({
      local: { label: 'Localhost', reconnectMs: 1000, errorReconnectMs: 2000 },
      cloudflare: { label: 'Cloudflare', reconnectMs: 5000, errorReconnectMs: 8000 },
    });
    let socket = null, reconnectAt = 0, reconnectCount = 0;
    let connectedAt = 0, lastMessageAt = 0, lastCloseReason = '';
    let activeMode = '', activeEndpoint = '', handlers = null;
    const adapter = () => adapters[lootQueueTransportMode()] || adapters.local;
    const endpoint = () => lootQueueEndpoint();
    const sameEndpoint = (left, right) => {
      try {
        const a = new URL(left, location.href), b = new URL(right, location.href);
        // token ไม่ใช่ identity ของ endpoint และห้ามนำไป log
        return a.origin === b.origin && a.pathname === b.pathname;
      } catch (_) { return String(left || '') === String(right || ''); }
    };
    const notify = (name, ...args) => {
      try { handlers?.[name]?.(...args); } catch (error) { log('⚠️ Loot Queue transport callback:', error.message); }
    };
    const close = () => {
      const old = socket;
      socket = null;
      if (old) try { old.close(); } catch (_) {}
    };
    const connect = (nextHandlers) => {
      handlers = nextHandlers || handlers;
      const mode = lootQueueTransportMode();
      const url = endpoint();
      if (!url) return false;
      if (socket && activeMode === mode && sameEndpoint(activeEndpoint, url)
          && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return true;
      if (socket) close();
      if (nowMs() < reconnectAt) return false;
      let next;
      try { next = new WebSocket(url); }
      catch (error) {
        reconnectAt = nowMs() + adapter().errorReconnectMs;
        lastCloseReason = error.message || 'สร้าง WebSocket ไม่ได้';
        notify('error', error);
        return false;
      }
      socket = next; activeMode = mode; activeEndpoint = url;
      next.onopen = () => {
        if (socket !== next) return;
        reconnectAt = 0; connectedAt = nowMs(); lastCloseReason = '';
        notify('open');
      };
      next.onmessage = (event) => {
        if (socket !== next) return;
        lastMessageAt = nowMs();
        notify('message', event.data);
      };
      next.onclose = (event) => {
        if (socket !== next) return;
        socket = null; reconnectCount++;
        reconnectAt = nowMs() + adapter().reconnectMs;
        lastCloseReason = event.reason || ('close ' + event.code);
        notify('close', event);
      };
      next.onerror = () => {
        if (socket !== next) return;
        reconnectAt = nowMs() + adapter().errorReconnectMs;
        notify('error', new Error('WebSocket error'));
      };
      return true;
    };
    return {
      connect,
      close() { close(); },
      reconnect(nextHandlers) { close(); reconnectAt = 0; return connect(nextHandlers); },
      send(message) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return false;
        try { socket.send(JSON.stringify(message)); return true; }
        catch (error) { lastCloseReason = error.message || 'send ไม่สำเร็จ'; notify('error', error); return false; }
      },
      isQueueSocket(url) { return !!endpoint() && sameEndpoint(endpoint(), url); },
      status() {
        return {
          mode: lootQueueTransportMode(), label: adapter().label,
          connected: !!socket && socket.readyState === WebSocket.OPEN,
          reconnectCount, connectedAt, lastMessageAt, lastCloseReason,
        };
      },
    };
  })();

  // ============================================================
  //  LOCAL LOOT QUEUE — interface: offer(drop), special(itemId), pickup(dropId), tick(), status()
  //  implementation ซ่อน WebSocket/reconnect/claim/ack และ flow collector ไว้ที่เดียว
  // ============================================================
  const lootQueue = (() => {
    // วาร์ปพิกัด drop โดยตรงเร็วที่สุด แต่ server อาจปฏิเสธได้เมื่อพิกัดนั้นเป็น cell ที่เดินไม่ได้
    // จึงรอ MAP_NAME ยืนยันช่วงสั้น ๆ แล้ว fallback เป็น -999,-999 ให้ server เลือก cell เดินได้เอง
    const WARP_CONFIRM_MS = 3500;
    const WARP_RETRY_AFTER_FAIL_MS = 500;
    const MAX_WARP_ATTEMPTS = 3;
    const SAME_MAP_WARP_SETTLE_MS = 1000;
    const PICKUP_RETRY_INTERVAL_MS = 650;
    let lastWarpAt = 0;
    let activeJob = null; // { job, claimToken, pickupAt, lastActionAt, stage }
    let homeReturn = null; // { requestedAt, attempts, retryAt, fromMap } — รอ MAP_NAME/พิกัดยืนยันการกลับจุดรอ
    let claimPendingId = null, claimPendingAt = 0, lastClaimRttMs = null;
    let idleReturnAt = 0;
    let nextClaimAt = 0;
    const pendingOffers = new Map();
    const availableJobs = new Map(); // งาน open ที่มาถึงระหว่าง collector กำลังเก็บชิ้นก่อนหน้า
    const clientId = 'assist-' + Math.random().toString(36).slice(2, 10);
    const role = () => ['farm', 'collector'].includes(CFG.lootQueueRole) ? CFG.lootQueueRole : 'off';
    const collectorGameReady = () => !!playerId && !!currentMap && !!activeWS && activeWS.readyState === WebSocket.OPEN;
    const claimResponseTimeoutMs = () => lootQueueTransportMode() === 'cloudflare' ? 8000 : 2000;
    // Localhost ตอบงานแทบไม่มี latency; Cloudflare ให้ map transition settle สั้น ๆ
    // ก่อน pickup เพื่อไม่ยิง packet ใน frame เดียวกับ MAP_NAME. ไม่เกี่ยวกับ timeout ของ item.
    const postWarpPickupReadyMs = () => lootQueueTransportMode() === 'cloudflare' ? 500 : 0;
    const special = (itemId) => Array.isArray(CFG.lootQueueItemIds) && CFG.lootQueueItemIds.includes(itemId);
    // Farmer-only decision seam. The selected list remains intact while
    // send-all is ON, so disabling it restores the old behaviour immediately.
    function shouldOfferLootQueueItem(itemId) {
      return role() === 'farm' && (CFG.lootQueueSendAll || special(itemId));
    }
    const claimDelayMs = () => {
      const delay = Number(CFG.lootQueueClaimDelayMs);
      return Number.isFinite(delay) ? Math.max(0, Math.min(30000, Math.round(delay))) : 5000;
    };
    const failureNextJobDelayMs = () => {
      const delay = Number(CFG.lootQueueNearbySettleMs);
      return Number.isFinite(delay) ? Math.max(0, Math.min(10000, Math.round(delay))) : 1000;
    };
    const pickupResponseWaitMs = () => {
      const delay = Number(CFG.lootQueueActionTimeoutMs);
      return Number.isFinite(delay) ? Math.max(1000, Math.min(30000, Math.round(delay))) : 1000;
    };
    const warpCooldownMs = () => {
      const delay = Number(CFG.lootQueueWarpCooldownMs);
      return Number.isFinite(delay) ? Math.max(0, Math.min(10000, Math.round(delay))) : 0;
    };
    const pickupRetryCount = () => {
      const count = Number(CFG.lootQueuePickupRetryCount);
      return Number.isFinite(count) ? Math.max(0, Math.min(5, Math.round(count))) : 2;
    };
    const send = (message) => lootQueueTransport.send(message);
    const sendHello = () => send({ type: 'hello', role: role(), group: CFG.lootQueueGroup || 'default', clientId });
    const stage = (name, text) => {
      if (!activeJob || activeJob.stage === name) return;
      activeJob.stage = name;
      log('📮 Loot Queue:', text);
    };
    const jobsFrom = (message) => message.job ? [message.job] : (Array.isArray(message.jobs) ? message.jobs : []);
    const claim = (job) => {
      if (!job || claimPendingId || nowMs() < nextClaimAt || !collectorGameReady() || !send({ type: 'claim', id: job.id })) return false;
      claimPendingId = job.id;
      claimPendingAt = nowMs();
      idleReturnAt = 0;
      log('📮 Loot Queue: claim งาน', job.itemName, 'id=' + job.dropId);
      return true;
    };
    // Drain the queue before returning home. Prefer the current map (and then
    // its nearest drop) to reduce teleports; a different-map job is still a
    // valid immediate follow-up and the normal active-job flow will warp to it.
    const nextOpenJob = (job, now) => [...availableJobs.values()]
      .filter(next => next.id !== job.id && next.expiresAt > now)
      .sort((a, b) => {
        const aSameMap = a.map === job.map, bSameMap = b.map === job.map;
        if (aSameMap !== bSameMap) return aSameMap ? -1 : 1;
        if (aSameMap) return Math.hypot(a.x - job.x, a.y - job.y) - Math.hypot(b.x - job.x, b.y - job.y);
        return (a.createdAt || 0) - (b.createdAt || 0);
      })[0] || null;
    const offerPending = () => {
      const now = nowMs();
      for (const record of pendingOffers.values()) {
        if (record.offerAt && now - record.offerAt < 3000) continue;
        if (send({ type: 'offer', record, ttlMs: 60000 })) record.offerAt = now;
      }
    };
    const onTransportMessage = (raw) => {
      if (!masterBot.enabled()) return;
      let message; try { message = JSON.parse(raw); } catch (_) { return; }
      if (message.type === 'available' && role() === 'collector') {
        for (const job of jobsFrom(message)) if (job && job.id) availableJobs.set(job.id, job);
        // AB Buff เริ่มรอ/ทำงานแล้ว: เก็บงานไว้ให้ server ถือ TTL แต่ไม่รับงานใหม่มาตัด flow AB
        if (!activeJob && !claimPendingId && !isAbBuffPending() && !isAbBuffActive() && !shouldHoldLootQueueForStorage()) claim(jobsFrom(message)[0]);
      } else if (message.type === 'claimed' && role() === 'collector') {
        const replacingSettledJob = activeJob && activeJob.settleUntil && claimPendingId === message.job.id;
        if (activeJob && !replacingSettledJob) {
          if (activeJob.job.id !== message.job.id) log('⚠️ Loot Queue: ข้าม claimed ซ้ำระหว่างทำงาน', message.job.itemName);
          return;
        }
        if (claimPendingId === message.job.id && claimPendingAt) lastClaimRttMs = nowMs() - claimPendingAt;
        claimPendingId = null; claimPendingAt = 0;
        availableJobs.delete(message.job.id);
        const claimedAt = nowMs();
        // อยู่แมปเดียวกับ drop แล้วไม่ต้องรอรวมงาน: ส่ง pickup รอบ tick ถัดไปทันที
        // ส่วนงานข้ามแมปยังรอตามค่า UI เพื่อให้ฟาร์มมีเวลาส่ง drop ใกล้กันเข้าคิว
        const sameMap = currentMap === message.job.map;
        // รอรวม drop เฉพาะตอน collector อยู่จุดรอ/เมืองและต้องวาร์ปข้ามแมป.
        // งานที่ chain จากการเก็บสำเร็จ หรือรับระหว่างอยู่แมปอื่น ต้องเดินต่อทันที.
        const delayMs = (!replacingSettledJob && !sameMap && currentMap === CFG.lootQueueHomeMap) ? claimDelayMs() : 0;
        activeJob = { job: message.job, claimToken: message.claimToken, pickupAt: 0, claimDelayUntil: claimedAt + delayMs, stage: '', warpAttempts: 0, warpRequestedAt: 0, forceRandomWarp: false, crossMapExactTarget: false };
        log('📮 Loot Queue: รับงาน', message.job.itemName, '@', message.job.map, '(' + Math.round(message.job.x) + ',' + Math.round(message.job.y) + ')');
        if (lastClaimRttMs != null && lootQueueTransportMode() === 'cloudflare') log('📮 Loot Queue: Cloudflare claim RTT', lastClaimRttMs + 'ms');
        if (delayMs) log('📮 Loot Queue: รอรวม drop ' + (delayMs / 1000).toFixed(1) + 's ก่อนวาร์ป');
        else if (sameMap) log('📮 Loot Queue: อยู่แมปเดียวกับ drop → ส่ง pickup ทันที');
      } else if (message.type === 'offered') {
        pendingOffers.delete(message.id);
      } else if (message.type === 'error' && message.reason === 'job not found' && activeJob) {
        // ACK deletes the completed job. A delayed renew can race a successor claim.
        if (activeJob.settleUntil || claimPendingId) {
          log('📮 Loot Queue: ข้าม job not found ของงานเก่าระหว่างรับงานถัดไป');
          return;
        }
        log('⚠️ Loot Queue: งานไม่มีบน server แล้ว → ปล่อยเพื่อหา job คิวถัดไป');
        activeJob = null; claimPendingId = null; claimPendingAt = 0; idleReturnAt = nowMs();
      } else if (message.type === 'unavailable') {
        if (message.id) availableJobs.delete(message.id);
        claimPendingId = null; claimPendingAt = 0;
      } else if (message.type === 'expired') {
        availableJobs.delete(message.id);
      }
    };
    const connect = () => {
      if (role() === 'off' || !lootQueueEndpoint()) return;
      lootQueueTransport.connect({
        open() { sendHello(); offerPending(); log('📮 Loot Queue: เชื่อมแล้ว (' + role() + ' · ' + lootQueueTransportLabel() + ')'); },
        message: onTransportMessage,
        close() { claimPendingId = null; claimPendingAt = 0; },
        error(error) { log('⚠️ Loot Queue transport:', error.message); },
      });
    };
    const returnHome = () => {
      if (!CFG.lootQueueHomeMap) { activeJob = null; idleReturnAt = nowMs(); return; }
      if (currentMap === CFG.lootQueueHomeMap && player.x != null && Math.hypot(player.x - CFG.lootQueueHomeX, player.y - CFG.lootQueueHomeY) <= 3) {
        activeJob = null; idleReturnAt = nowMs(); return;
      }
      if (homeReturn) { activeJob = null; return; }
      if (sendTeleport(CFG.lootQueueHomeMap, CFG.lootQueueHomeX, CFG.lootQueueHomeY, 'loot-queue-home')) {
        homeReturn = { requestedAt: nowMs(), attempts: 1, retryAt: 0, fromMap: currentMap };
        activeJob = null;
        idleReturnAt = 0;
        log('📮 Loot Queue: กลับจุดรอ', CFG.lootQueueHomeMap, '(รอยืนยัน 1/' + MAX_WARP_ATTEMPTS + ')');
      }
    };
    // sendTeleport() สำเร็จเพียงแปลว่าส่ง packet ออกได้ ไม่ได้ยืนยันว่า server วาร์ปให้จริง
    // จึงเก็บ state รอ MAP_NAME และ retry แบบจำกัดครั้ง เพื่อไม่ให้ collector ค้างแมปฟาร์ม
    const tickHomeReturn = (now) => {
      if (!homeReturn) return false;
      const homeMap = CFG.lootQueueHomeMap;
      if (!homeMap) { homeReturn = null; idleReturnAt = now; return true; }
      const atHomePosition = currentMap === homeMap && player.x != null && player.y != null
        && Math.hypot(player.x - CFG.lootQueueHomeX, player.y - CFG.lootQueueHomeY) <= 3;
      // วาร์ปข้ามแมปใช้ MAP_NAME ยืนยันได้; วาร์ปในแมปต้องเห็นพิกัดถึงจุดรอจริง
      if (currentMap === homeMap && (homeReturn.fromMap !== homeMap || atHomePosition)) {
        log('📮 Loot Queue: ถึงจุดรอแล้ว', homeMap);
        homeReturn = null;
        idleReturnAt = now;
        return true;
      }
      if (now - homeReturn.requestedAt < WARP_CONFIRM_MS || now < homeReturn.retryAt) return true;
      if (homeReturn.attempts >= MAX_WARP_ATTEMPTS) {
        log('⚠️ Loot Queue: กลับจุดรอไม่สำเร็จหลังลอง ' + MAX_WARP_ATTEMPTS + ' ครั้ง → รอ retry รอบใหม่ 5s');
        homeReturn = null;
        idleReturnAt = now + 5000;
        return true;
      }
      if (sendTeleport(homeMap, CFG.lootQueueHomeX, CFG.lootQueueHomeY, 'loot-queue-home-retry')) {
        homeReturn.attempts++;
        homeReturn.requestedAt = now;
        homeReturn.retryAt = 0;
        log('📮 Loot Queue: retry กลับจุดรอ', homeMap, '(' + homeReturn.attempts + '/' + MAX_WARP_ATTEMPTS + ')');
      } else {
        homeReturn.retryAt = now + WARP_RETRY_AFTER_FAIL_MS;
        log('⚠️ Loot Queue: ส่งวาร์ปกลับจุดรอไม่ได้ → ลองใหม่เมื่อ socket พร้อม');
      }
      return true;
    };
    const discardActive = (reason) => {
      if (!activeJob) return false;
      const stale = activeJob;
      send({ type: 'discard', id: stale.job.id, claimToken: stale.claimToken, reason });
      log('🚫 Loot Queue: ทิ้ง', stale.job.itemName, '—', reason);
      activeJob = null;
      claimPendingId = null;
      // FAIL ครบแล้วจึงทิ้ง job นี้; เว้นช่วงเดียวก่อน claim งานใหม่หรือกลับจุดรอ.
      nextClaimAt = nowMs() + failureNextJobDelayMs();
      idleReturnAt = nextClaimAt;
      return true;
    };
    // กระเป๋าเต็มจริง: ห้าม discard เพราะ drop อาจยังอยู่บนพื้น ให้ปล่อยกลับเป็น open job
    // เพื่อรับใหม่หลังฝากของ หรือให้ collector ตัวอื่นรับไปเก็บต่อได้
    const releaseActiveForStorage = () => {
      if (!activeJob) return false;
      const stale = activeJob;
      activeJob = null;
      claimPendingId = null;
      idleReturnAt = 0;
      nextClaimAt = 0;
      if (stale.settleUntil) {
        log('🏦 Loot Queue: งานก่อนหน้าจบแล้ว → ไปฝากของ');
        return true;
      }
      send({ type: 'nack', id: stale.job.id, claimToken: stale.claimToken });
      log('🏦 Loot Queue: กระเป๋าเต็ม → ปล่อยงานกลับคิวก่อนฝาก', stale.job.itemName);
      return true;
    };
    return {
      isSpecial: special,
      handlesSpecial: (itemId) => role() !== 'off' && (role() === 'farm' ? shouldOfferLootQueueItem(itemId) : (CFG.lootQueueSendAll || special(itemId))),
      isCollectorBusy: () => role() === 'collector' && !!activeJob,
      // ระหว่าง claim/รอเลือกงาน/วาร์ปกลับ ห้าม warp-back-to-farm แทรก flow ของ collector
      isCollectorActive: () => role() === 'collector' && (!!activeJob || !!homeReturn || !!claimPendingId || nextClaimAt > nowMs() || idleReturnAt > nowMs()),
      // Profile ต้องไม่เปลี่ยน endpoint/role ระหว่างยังถือ claim หรือยังมี offer รอส่ง
      isProfileBusy: () => !!activeJob || !!homeReturn || !!claimPendingId || pendingOffers.size > 0,
      skipCurrent() {
        if (!activeJob || activeJob.settleUntil) {
          log('⚠️ Loot Queue: ไม่มี drop ที่กำลังเก็บให้ข้าม');
          return false;
        }
        return discardActive('ผู้ใช้กดข้ามงาน (drop หาย/บอทค้าง)');
      },
      offer(drop) {
        if (!masterBot.enabled() || role() !== 'farm' || !shouldOfferLootQueueItem(drop.itemId)) return false;
        const record = { key: `${CFG.lootQueueGroup || 'default'}:${currentMap || ''}:${drop.dropId}`, dropId: drop.dropId, itemId: drop.itemId, itemName: nameOf(drop.itemId), map: currentMap, x: drop.x, y: drop.y, offerAt: 0 };
        if (!record.map) return true;
        pendingOffers.set(record.key, record);
        offerPending();
        log('📮 ส่งงาน Loot Queue:', record.itemName, '@', record.map, '(' + Math.round(record.x) + ',' + Math.round(record.y) + ')');
        return true;
      },
      pickup(dropId) {
        if (!activeJob || activeJob.job.dropId !== dropId) return null;
        const done = activeJob;
        send({ type: 'ack', id: done.job.id, claimToken: done.claimToken });
        // Happy path ต้องมองงานถัดไปทันที เพื่อใช้ nextOpenJob() เลือกแมป/ระยะที่เหมาะที่สุด.
        done.settleUntil = nowMs();
        log('📮 Loot Queue: เก็บสำเร็จ → มอง job คิวถัดไปทันที', done.job.itemName);
        return done.job;
      },
      // 0x52 FAIL ไม่มีเลข attempt จึงรับผลได้เฉพาะเมื่อยังรอคำสั่ง pickup เดียวอยู่.
      // การ serialize นี้กัน FAIL เก่ามาตัดสิน retry ใหม่ของ collector เอง.
      onPickupFail(dropId) {
        if (!activeJob || activeJob.settleUntil || activeJob.job.dropId !== dropId || !activeJob.waitingPickupResult) return false;
        const now = nowMs();
        activeJob.waitingPickupResult = false;
        const attempts = activeJob.pickupAttempts || 0;
        const limit = pickupRetryCount();
        activeJob.lastActionAt = now; // server ตอบแล้ว จึงไม่ใช่ timeout แบบไม่มี action
        if (attempts >= 1 + limit) {
          discardActive('server ตอบ pickup FAIL ครบ ' + limit + ' retry');
          return true;
        }
        activeJob.nextPickupAt = now + PICKUP_RETRY_INTERVAL_MS;
        stage('pickup-fail', 'server ตอบ pickup FAIL → retry ' + attempts + '/' + limit);
        log('⚠️ Loot Queue: server ตอบ pickup FAIL', activeJob.job.itemName, '→ retry ' + attempts + '/' + limit + ' ใน ' + PICKUP_RETRY_INTERVAL_MS + 'ms');
        return true;
      },
      onPickupTakenByOther(dropId) {
        if (!activeJob || activeJob.settleUntil || activeJob.job.dropId !== dropId) return false;
        return discardActive('ผู้เล่นอื่นเก็บ drop นี้ไปแล้ว');
      },
      // รับ WARP_FAIL (0x2a) เฉพาะงาน collector ที่กำลังรอข้ามแมปอยู่
      // คืน true เพื่อบอก packet router ว่าไม่ต้องส่งต่อให้ Warp-to-Loot flow เดิม
      onWarpFail() {
        if (!activeJob || activeJob.settleUntil) return false;
        // Same-map long-distance warp is an optimisation only.  If its exact
        // drop coordinate is not warpable, continue with the normal server
        // pickup/pathing flow rather than retrying or discarding the job.
        if (currentMap === activeJob.job.map) {
          if (!activeJob.intraMapWarpRequestedAt) return false;
          activeJob.intraMapWarpRequestedAt = 0;
          activeJob.intraMapWarpFailed = true;
          stage('map-ready', 'วาร์ปในแมปไปพิกัด drop ไม่ได้ → ส่ง pickup ตามปกติ');
          return true;
        }
        activeJob.forceRandomWarp = true;
        activeJob.crossMapExactTarget = false;
        activeJob.warpRequestedAt = 0;
        activeJob.warpRetryAt = nowMs() + WARP_RETRY_AFTER_FAIL_MS;
        stage('warp-invalid:' + activeJob.job.map, 'พิกัด drop วาร์ปไม่ได้ → re-check แล้วใช้จุดเดินได้ในแมป');
        return true;
      },
      // MAP_NAME คือการยืนยันจาก server ว่าวาร์ปถึงจริง; ไม่ยึดแค่คำสั่งที่ส่งออกไป
      onMapChanged(mapName) {
        if (activeJob && mapName === activeJob.job.map) activeJob.warpRequestedAt = 0;
        if (homeReturn && mapName === CFG.lootQueueHomeMap) {
          const atHomePosition = player.x != null && player.y != null
            && Math.hypot(player.x - CFG.lootQueueHomeX, player.y - CFG.lootQueueHomeY) <= 3;
          if (homeReturn.fromMap !== mapName || atHomePosition) {
            log('📮 Loot Queue: MAP_NAME ยืนยันถึงจุดรอ', mapName);
            homeReturn = null;
            idleReturnAt = nowMs();
          }
        }
      },
      pause() {
        if (activeJob && !activeJob.settleUntil) send({ type: 'nack', id: activeJob.job.id, claimToken: activeJob.claimToken });
        activeJob = null; homeReturn = null; claimPendingId = null; claimPendingAt = 0; idleReturnAt = 0; nextClaimAt = 0;
        pendingOffers.clear(); availableJobs.clear();
        lootQueueTransport.close();
      },
      resume() { connect(); },
      tick() {
        if (!masterBot.enabled()) return;
        connect(); offerPending();
        if (role() !== 'collector') return;
        // hard-full = เก็บต่อไม่ได้แล้ว จึงคืนงานให้ queue ก่อนให้ Storage เป็นเจ้าของการวาร์ป
        const storageTrigger = getStorageDepositTrigger();
        if (storageTrigger && storageTrigger.urgent && activeJob) {
          releaseActiveForStorage();
          return;
        }
        if (!activeJob) {
          // เมื่อ AB Buff เข้าคิวหรือเริ่มเดินทางแล้ว collector ห้าม claim งานใหม่
          // งานที่ claim ก่อนหน้านั้นจะถูกปล่อยให้จบก่อน AB เริ่มเองจาก PENDING_IDLE
          if (isAbBuffPending() || isAbBuffActive() || shouldHoldLootQueueForStorage()) {
            if (homeReturn) log('📮 Loot Queue: ยกเลิกกลับจุดรอ เพราะ flow ลำดับสูงกำลังทำงาน');
            homeReturn = null;
            return;
          }
          if (nowMs() < nextClaimAt) return;
          nextClaimAt = 0;
          if (homeReturn) {
            const nextWhileReturning = [...availableJobs.values()].filter(job => job.expiresAt > nowMs()).sort((a, b) => a.createdAt - b.createdAt)[0];
            if (nextWhileReturning) {
              homeReturn = null;
              log('📮 Loot Queue: มีงานใหม่ระหว่างกลับจุดรอ → ยกเลิกการกลับและรับงาน', nextWhileReturning.itemName);
              if (claim(nextWhileReturning)) return;
            }
            tickHomeReturn(nowMs());
            return;
          }
          const next = [...availableJobs.values()].filter(job => job.expiresAt > nowMs()).sort((a, b) => a.createdAt - b.createdAt)[0];
          if (claimPendingId) {
            if (nowMs() - claimPendingAt < claimResponseTimeoutMs()) return;
            log('⚠️ Loot Queue: รอ claimed จาก ' + lootQueueTransportLabel() + ' เกิน ' + (claimResponseTimeoutMs() / 1000) + 's → รอ server ปล่อยงานใหม่');
            availableJobs.delete(claimPendingId);
            claimPendingId = null; claimPendingAt = 0;
            return;
          }
          if (next && claim(next)) return;
          if (!idleReturnAt || nowMs() < idleReturnAt) return;
          idleReturnAt = 0;
          if (CFG.lootQueueHomeMap && currentMap !== CFG.lootQueueHomeMap && sendTeleport(CFG.lootQueueHomeMap, CFG.lootQueueHomeX, CFG.lootQueueHomeY, 'loot-queue-idle-home')) {
            homeReturn = { requestedAt: nowMs(), attempts: 1, retryAt: 0, fromMap: currentMap };
            log('📮 Loot Queue: ไม่มีงานถัดไป → กลับจุดรอ (รอยืนยัน 1/' + MAX_WARP_ATTEMPTS + ')');
          }
          return;
        }
        const job = activeJob.job, now = nowMs();
        if (now > job.expiresAt) { log('⌛ Loot Queue: งานหมดอายุก่อนเก็บ', job.itemName); send({ type: 'nack', id: job.id, claimToken: activeJob.claimToken }); activeJob = null; return; }
        if (isDead) { stage('dead', 'ตายอยู่ — พักงานจนกว่าจะ respawn'); return; }
        // pickup() ACKs and deletes this job at the local queue. Never renew
        // it while settling or while its successor claim is in flight.
        if (!activeJob.settleUntil && !claimPendingId && (!activeJob.renewAt || now - activeJob.renewAt > 8000)) {
          if (send({ type: 'renew', id: job.id, claimToken: activeJob.claimToken })) activeJob.renewAt = now;
        }
        // รับงานแรกแล้วพักสั้น ๆ เพื่อรวม drop ที่ฟาร์มเพิ่งฆ่าต่อเนื่อง ก่อนวาร์ปออกจากเมือง
        if (now < activeJob.claimDelayUntil) {
          activeJob.stage = 'claim-delay';
          return;
        }
        if (activeJob.settleUntil) {
          if (now < activeJob.settleUntil) return;
          // AB Buff ที่อยู่ PENDING_IDLE ต้องได้เริ่มหลังงานปัจจุบันจบจริง
          // จึงห้าม Queue chain งานต่อเนื่อง เช่นเดียวกับกรณีต้องไปฝากของ
          const holdForAbBuff = isAbBuffPending();
          const next = (holdForAbBuff || shouldHoldLootQueueForStorage()) ? null : nextOpenJob(job, now);
          if (next && claim(next)) {
            activeJob.stage = next.map === job.map ? 'claim-same-map' : 'claim-next-map';
            log('📮 Loot Queue: พบงานคิวถัดไป' + (next.map === job.map ? ' ในแมปเดียวกัน' : ' คนละแมป') + ' → เก็บต่อ', next.itemName);
            return;
          }
          // Cloudflare อาจตอบ claimed หลัง tick ถัดไป: ห้าม return-home จนกว่าจะตอบหรือ timeout.
          if (claimPendingId) return;
          if (holdForAbBuff) log('📮 Loot Queue: งานปัจจุบันจบแล้ว → ไม่ต่อคิว เพราะ AB Buff รออยู่');
          returnHome();
          return;
        }
        if (currentMap !== job.map) {
          stage('warp:' + currentMap, 'เตรียมวาร์ป ' + (currentMap || '(ยังไม่รู้แมป)') + ' → ' + job.map);
          // หลังส่งวาร์ปต้องรอ MAP_NAME ยืนยันก่อน; ห้ามยิงพิกัดเดิมซ้ำรัว ๆ เมื่อ server ปฏิเสธ
          if (activeJob.warpRequestedAt && now - activeJob.warpRequestedAt < WARP_CONFIRM_MS) return;
          if (activeJob.warpAttempts >= MAX_WARP_ATTEMPTS) {
            discardActive('ยืนยันการวาร์ปไป ' + job.map + ' ไม่สำเร็จหลังลอง ' + MAX_WARP_ATTEMPTS + ' ครั้ง');
            return;
          }
          const useRandomSpawn = activeJob.forceRandomWarp || activeJob.warpAttempts > 0;
          const retryAt = activeJob.warpRetryAt || 0;
          const cooldownMs = useRandomSpawn ? WARP_RETRY_AFTER_FAIL_MS : warpCooldownMs();
          if (now >= retryAt && now - lastWarpAt > cooldownMs) {
            const warpX = useRandomSpawn ? -999 : job.x;
            const warpY = useRandomSpawn ? -999 : job.y;
            if (sendTeleport(job.map, warpX, warpY, 'loot-queue-job')) {
              activeJob.warpAttempts++;
              activeJob.warpRequestedAt = now;
              activeJob.warpRetryAt = 0;
              activeJob.forceRandomWarp = false;
              activeJob.crossMapExactTarget = !useRandomSpawn;
              activeJob.warpPositionAt = lastPlayerPositionPacketAt;
              lastWarpAt = now;
              log(useRandomSpawn
                ? '📮 Loot Queue: re-check แล้ววาร์ปจุดเดินได้ใน ' + job.map + ' (server เลือกจุด)'
                : '📮 Loot Queue: วาร์ปไปรับ ' + job.itemName);
            } else stage('warp-failed:' + currentMap, 'วาร์ปไปรับไม่สำเร็จ — รอ game socket');
          }
          return;
        }
        // อยู่แมปเดียวกันแต่ drop ไกลกว่า click-walk cap: วาร์ปตรงพิกัดก่อน
        // แล้วค่อย pickup.  ลองเพียงครั้งเดียว; พิกัด drop อาจเป็น cell เดินไม่ได้
        // จึงต้อง fallback ไปให้ server pathing ตามปกติเสมอ.
        const hasKnownPosition = player.x != null && player.y != null && Number.isFinite(Number(job.x)) && Number.isFinite(Number(job.y));
        const sameMapDistance = hasKnownPosition ? Math.hypot(Number(job.x) - player.x, Number(job.y) - player.y) : null;
        if (!activeJob.pickupAt && sameMapDistance != null && sameMapDistance > MOVE_MAX_DIST && !activeJob.intraMapWarpAttempted && !activeJob.crossMapExactTarget) {
          const cooldownMs = warpCooldownMs();
          if (cooldownMs > 0 && now - lastWarpAt < cooldownMs) {
            stage('same-map-warp-wait', 'ของไกล ' + sameMapDistance.toFixed(1) + ' ช่อง → รอ cooldown วาร์ป');
            return;
          }
          if (sendTeleport(job.map, job.x, job.y, 'loot-queue-same-map')) {
            activeJob.intraMapWarpAttempted = true;
            activeJob.intraMapWarpRequestedAt = now;
            activeJob.intraMapWarpPositionAt = lastPlayerPositionPacketAt;
            lastWarpAt = now;
            stage('same-map-warp', 'ของไกล ' + sameMapDistance.toFixed(1) + ' ช่อง → วาร์ปไปเก็บ ' + job.itemName);
            log('📮 Loot Queue: อยู่แมปเดียวกันแต่ไกล ' + sameMapDistance.toFixed(1) + ' ช่อง → วาร์ปไปพิกัด drop');
            return;
          }
        }
        if (!activeJob.pickupAt && activeJob.intraMapWarpRequestedAt) {
          const movedAfterWarp = lastPlayerPositionPacketAt > (activeJob.intraMapWarpPositionAt || 0);
          if (!movedAfterWarp && now - activeJob.intraMapWarpRequestedAt < SAME_MAP_WARP_SETTLE_MS) return;
          activeJob.intraMapWarpRequestedAt = 0;
          stage('map-ready', movedAfterWarp ? 'วาร์ปในแมปแล้ว → ส่ง pickup' : 'ยังไม่เห็นพิกัดหลังวาร์ป → ส่ง pickup ตามปกติ');
        }
        // Server มี pathing ของ ground item อยู่แล้ว: pickup จะสั่งให้ server เดินหา item จริง
        // จึงไม่ใช้ player.x/y ที่อาจค้างจากแมปเก่าหลังวาร์ปมาคิดระยะหรือเดิน GAT ผิดจุด
        if (!activeJob.mapReachedAt) {
          activeJob.mapReachedAt = now;
          activeJob.mapReachedPositionAt = activeJob.warpPositionAt || lastPlayerPositionPacketAt;
          stage('map-ready', 'ถึงแมปแล้ว → ให้ server เดินหา ' + job.itemName);
        }
        const movedAfterMapChange = lastPlayerPositionPacketAt > (activeJob.mapReachedPositionAt || 0);
        // ใช้ warp guard เดียวกับ Combat/AB: รอพิกัดใหม่ แล้วรอ packet รอบตัวตาม
        // CFG.postWarpTargetSettleMs ก่อนส่ง pickup. แก้ความต่างเครื่องที่ MAP_NAME มาก่อน state จริง.
        if (!activeJob.pickupAt && isWarpGuardActive(now)) {
          stage('warp-guard', 'รอข้อมูลหลังวาร์ป (พิกัด/packet รอบตัว) ก่อน pickup');
          return;
        }
        const mapReadyWaitMs = postWarpPickupReadyMs();
        if (!activeJob.pickupAt && !movedAfterMapChange && now - activeJob.mapReachedAt < mapReadyWaitMs) {
          stage('map-settle', 'รอ map-ready ' + mapReadyWaitMs + 'ms ก่อน pickup (' + lootQueueTransportLabel() + ')');
          return;
        }
        const sendPickupAttempt = (label) => {
          if (!sendPickup(job.dropId)) return false;
          activeJob.pickupAt = activeJob.pickupAt || now;
          activeJob.pickupAttempts = (activeJob.pickupAttempts || 0) + 1;
          activeJob.waitingPickupResult = true;
          activeJob.pickupResponseDueAt = now + pickupResponseWaitMs();
          activeJob.lastActionAt = now;
          activeJob.positionPacketAt = lastPlayerPositionPacketAt;
          activeJob.nextPickupAt = 0;
          log('📮 Loot Queue: ' + label, job.itemName, '(' + activeJob.pickupAttempts + '/' + (1 + pickupRetryCount()) + ')');
          return true;
        };
        if (!activeJob.pickupAt) {
          sendPickupAttempt('ส่ง pickup หลังถึงแมป');
          return;
        }
        // ถ้า server กำลังเดินให้ รอผลคำสั่งเดิมต่อไปและขยายเวลารอจาก movement จริง.
        if (lastPlayerPositionPacketAt > activeJob.positionPacketAt) {
          activeJob.positionPacketAt = lastPlayerPositionPacketAt;
          activeJob.lastActionAt = now;
          if (activeJob.waitingPickupResult) activeJob.pickupResponseDueAt = now + pickupResponseWaitMs();
          return;
        }
        if (activeJob.waitingPickupResult) {
          if (now < activeJob.pickupResponseDueAt) return;
          activeJob.waitingPickupResult = false;
          if ((activeJob.pickupAttempts || 0) >= 1 + pickupRetryCount()) {
            discardActive('server เงียบหลัง pickup ครบ ' + pickupRetryCount() + ' retry');
            return;
          }
          activeJob.nextPickupAt = now + PICKUP_RETRY_INTERVAL_MS;
          stage('pickup-timeout', 'รอผล pickup ไม่ทัน → retry แบบไม่ซ้อนคำสั่ง');
          return;
        }
        if (now >= (activeJob.nextPickupAt || 0)) {
          sendPickupAttempt('retry pickup หลังถึงแมป');
          return;
        }
      },
      status() {
        const canSkip = !!activeJob && !activeJob.settleUntil;
        const transport = lootQueueTransport.status();
        return { role: role(), connected: transport.connected, transportMode: transport.mode, transportLabel: transport.label,
          transportReconnectCount: transport.reconnectCount, transportLastCloseReason: transport.lastCloseReason,
          lastClaimRttMs, claimPendingId, claimPendingRemainingMs: claimPendingId ? Math.max(0, claimResponseTimeoutMs() - (nowMs() - claimPendingAt)) : 0,
          pendingOffers: pendingOffers.size,
          activeJob: activeJob && activeJob.job, activeStage: activeJob?.stage || (homeReturn ? 'return-home ' + homeReturn.attempts + '/' + MAX_WARP_ATTEMPTS : ''),
          claimDelayRemainingMs: activeJob ? Math.max(0, (activeJob.claimDelayUntil || 0) - nowMs()) : 0,
          nearbySettleRemainingMs: activeJob ? Math.max(0, (activeJob.settleUntil || 0) - nowMs()) : 0,
          nextClaimRemainingMs: Math.max(0, nextClaimAt - nowMs()),
          canSkip, availableJobs: availableJobs.size, returningHome: !!homeReturn };
      },
      reconnect() { lootQueueTransport.reconnect(); connect(); },
    };
  })();
  setInterval(() => {
    try { lootQueue.tick(); }
    catch (error) { log('⚠️ Loot Queue tick error:', error && error.message ? error.message : String(error)); }
  }, 150);

  function beginPostWarpTargetSettle(now = nowMs()) {
    if (!postWarpTargetSettlePending) return;
    postWarpTargetSettlePending = false;
    const settleMs = Math.max(0, Math.min(3000, Number(CFG.postWarpTargetSettleMs) || 0));
    postWarpTargetSettleUntil = now + settleMs;
    if (settleMs > 0) dbg('🌀 หลังวาร์ป: รอ packet รอบตัว', settleMs + 'ms ก่อนหาเป้า');
  }

  // ใช้ guard ชุดเดียวหลังวาร์ปทุก flow: รอ MOVE_UPDATE ที่เปลี่ยนตำแหน่ง
  // ก่อนส่งคำสั่งที่อาศัย state/ตำแหน่งหลังวาร์ป (เช่น Attack หรือ AB emote)
  // แล้วรอ packet SPAWN/ATTACK เพิ่มอีกสั้น ๆ เพื่อให้ AntiKS/AvoidPlayer เห็นข้อมูลจริงก่อน acquire
  function isWarpGuardActive(now = nowMs()) {
    if (now >= warpGuardUntil || !lastWarpPlayerPos) {
      warpGuardUntil = 0;
      lastWarpPlayerPos = null;
      beginPostWarpTargetSettle(now);
      if (postWarpFleeScanPending && runPostWarpFleeScan()) return true;
      return now < postWarpTargetSettleUntil;
    }
    if (player.x === lastWarpPlayerPos.x && player.y === lastWarpPlayerPos.y) return true;
    // ได้ตำแหน่งใหม่แล้ว → ปล่อย flow ต่อได้ทันที
    warpGuardUntil = 0;
    lastWarpPlayerPos = null;
    beginPostWarpTargetSettle(now);
    // หลังวาร์ป server จะทยอยส่ง SPAWN/marker; ตรวจซ้ำหนึ่งครั้งทันทีที่ยืนยันตำแหน่งใหม่
    // เพื่อให้ Player Flee มาก่อนการหาเป้าหมายหรือส่ง Attack แรก
    if (postWarpFleeScanPending && runPostWarpFleeScan()) return true;
    return now < postWarpTargetSettleUntil;
  }

  // packet ตำแหน่งอย่างเดียว (MOVE / ENTITY_POS) ไม่ได้บอก CharacterType
  // จึงห้ามเดาเป็นมอนสเตอร์: รอ SPAWN หรือ marker ที่ยืนยันชนิดก่อน
  function updateKnownEntityPosition(id, x, y, now = nowMs()) {
    if (id === FAIL) return;  // sentinel จาก protocol ไม่ใช่ entity ที่เดิน/ตีได้
    if (id === playerId) {
      setPlayerPosition(x, y);
      const self = entities.get(id);
      if (self) { self.x = x; self.y = y; self.kind = 0; self.alive = true; self._lastSeenAt = now; }
      else entities.set(id, { id, kind: 0, x, y, alive: true, _lastSeenAt: now });
      return;
    }
    if (isStaleId(id, now)) return;
    const entity = entities.get(id);
    if (entity) {
      entity.x = x;
      entity.y = y;
      entity._lastSeenAt = now;
      if (entity.kind === 0) instantFleeCheck(entity);
      return;
    }
    entities.set(id, { id, kind: null, x, y, alive: true, _lastSeenAt: now, _provisional: true });
  }

  // 0x3c marker flag=1 คือ radar ที่ยืนยันว่า id นี้เป็นผู้เล่น แม้ entity เก่าจะเคย
  // ถูก parse เป็น monster มาก่อนก็ตาม. เก็บ TTL เพื่อกัน ID reuse ที่ไม่มี despawn.
  function rememberRadarPlayer(id, x, y, now = nowMs()) {
    if (!id || id === FAIL) return;
    radarPlayerIds.set(id, now + RADAR_PLAYER_TTL_MS);
    let entity = entities.get(id);
    if (entity) {
      entity.kind = 0;
      entity.x = x;
      entity.y = y;
      entity.alive = true;
      entity._lastSeenAt = now;
      entity._radarPlayer = true;
    } else {
      entity = { id, kind: 0, x, y, alive: true, _lastSeenAt: now, _radarPlayer: true, name: '' };
      entities.set(id, entity);
    }
    if (id === playerId) setPlayerPosition(x, y);
    else instantFleeCheck(entity);
  }

  function tryClaim(d) {
    if (!masterBot.enabled()) return;
    if (queue.has(d.dropId)) return;
    const now = Date.now();
    if (now - lastCombatAt > CFG.combatWindowMs) return;
    // ★ เช็คว่า item อยู่ใกล้เราหรือใกล้พิกัดมอนที่เราฆ่า
    const nearPlayer = (player.x != null && dist(player, d) <= CFG.pickRadius);
    // ★ nearKillPos: เช็คว่า item อยู่ใกล้พิกัดมอนที่เราฆ่าล่าสุดหรือไม่ (นักธนูยิงไกล)
    let nearKillPos = false;
    if (CFG.lootUseKillPos) {
      // cleanup expired entries
      while (recentKillPos.length > 0 && now - recentKillPos[0].t > KILL_POS_TTL_MS) recentKillPos.shift();
      const r = CFG.pickRadiusKill || 5;
      for (const k of recentKillPos) {
        if (Math.hypot(k.x - d.x, k.y - d.y) <= r) { nearKillPos = true; break; }
      }
    }
    // ★ เก็บเฉพาะของที่อยู่ใกล้เรา หรือใกล้พิกัดมอนที่เราฆ่าเท่านั้น
    // ห้ามใช้เพียง EXP ล่าสุดเป็นหลักฐาน เพราะของคนอื่นอาจตกในช่วงเดียวกันและอยู่ไกลออกไป
    if (!(nearPlayer || nearKillPos)) return;
    // ของใน Loot Queue เป็นหน้าที่ collector เท่านั้น: farmer ไม่ส่ง pickup
    // และ collector ไม่แย่งเก็บ special drop ที่ไม่ได้ claim เป็นงานของตน
    if (lootQueue.offer(d)) return;
    if (lootQueue.handlesSpecial(d.itemId)) return;
    // Loot Queue is an independent farm/collector channel. The master
    // Auto-Loot toggle applies only to the normal pickup queue below.
    if (!CFG.lootEnabled) return;
    if (!shouldLoot(d.itemId)) {
      log('⛔ ข้าม', nameOf(d.itemId), '(ตัวกรอง mode=' + CFG.filter.mode + ') drop', d.dropId);
      return;
    }
    queue.set(d.dropId, { dropId: d.dropId, itemId: d.itemId, x: d.x, y: d.y, attempts: 0, lastAttemptAt: 0, addedAt: now });
    // drop มาช้าหลัง kill ได้: หาก combat เผลอเลือกมอนใหม่ในช่วงรอ drop
    // ให้ทิ้งเป้านั้นก่อน เพื่อเก็บของรอบเดิมให้เสร็จจริง ๆ
    if (now < lootSettleUntil) {
      // รับ drop หลายชิ้นเป็นชุด: เริ่มนับ quiet window ใหม่จากชิ้นล่าสุด
      lootSettleUntil = now + getLootPostKillSettleMs();
      if (target) {
        log('📦 loot lock → ชะลอเป้าใหม่จนเก็บของรอบก่อนเสร็จ');
        target = null;
      }
    }
    log('🎯 คิวเก็บ', nameOf(d.itemId), 'drop', d.dropId, '@(', d.x.toFixed(1), d.y.toFixed(1) + ')');
  }
  function markCombat() { lastCombatAt = Date.now(); }
  function getLootPostKillSettleMs() {
    return Math.max(0, Number(CFG.lootPostKillSettleMs) || 0);
  }
  function beginLootSettlement(now = nowMs()) {
    if (!CFG.lootEnabled) return;
    const waitMs = getLootPostKillSettleMs();
    lootSettleUntil = now + waitMs;
  }
  // Loot queue, pickup ที่รอผล หรือช่วงรอ drop หลัง kill ล้วนห้ามส่ง Attack/Skill/MOVE ไปเป้าใหม่
  function isLootCommandLocked(now = nowMs()) {
    return CFG.lootEnabled && (now < lootSettleUntil || queue.size > 0 || pickupPending != null || warpQueue.size > 0);
  }
  // Rest ไม่ควรตัด normal auto-loot ที่อยู่ตรงหน้า: ต่างจาก warpQueue ซึ่งอาจใช้เวลานาน
  // จึงรอเฉพาะ drop ปกติ, ผล pickup และ quiet window หลังฆ่า แล้วค่อยกลับไปนั่งพัก.
  function shouldDeferRestForNormalLoot(now = nowMs()) {
    return CFG.lootEnabled && (now < lootSettleUntil || queue.size > 0 || pickupPending != null);
  }

  // PENDING_IDLE ยังอยู่แมปฟาร์มและปล่อยงานเดิมให้จบ จึงยังไม่ hold Flee Player
  function isAbBuffPending() { return CFG.abBuffEnabled && abBuffState === 'PENDING_IDLE'; }
  function isAbBuffActive() { return CFG.abBuffEnabled && abBuffState !== 'IDLE' && abBuffState !== 'PENDING_IDLE'; }
  // เริ่ม hold ตั้งแต่ตัดสินใจไปรับบัพ (WARP_TO_AB) เพื่อไม่ให้ Flee Player
  // วาร์ปตัด flow ระหว่างกำลังเปลี่ยนแมป; ปล่อยเมื่อ AB Buff จบและกลับฟาร์มแล้ว
  function shouldHoldFleePlayerForAbBuff() {
    return isAbBuffActive();
  }
  // Storage ต้องไม่ให้ Flee Player ตัดบทสนทนา Kafra หรือยกเลิกการวาร์ปกลับ
  function shouldHoldFleePlayerForStorage() {
    return storageState !== 'IDLE';
  }
  // งานย่อย/ขายแร่มี dialog และวาร์ปหลายช่วง จึงห้าม Flee Player หรือ combat ตัด packet กลางงาน
  function isOreRefineActive() { return oreRefineState !== 'IDLE'; }
  function shouldHoldFleePlayer() {
    return shouldHoldFleePlayerForAbBuff() || shouldHoldFleePlayerForStorage() || isOreRefineActive() || isAiReplyInteractionActive();
  }
  function hasAbBuffStatus(statusId, now = nowMs()) {
    const effect = abBuffEffects.get(statusId);
    return !!effect && effect.expiresAt > now;
  }
  function selfSupportStatusId(skill) {
    return skill ? SELF_SUPPORT_STATUS_BY_SKILL.get(Number(skill.skillId)) : null;
  }
  function hasSelfSupportStatus(skill, now = nowMs()) {
    const statusId = selfSupportStatusId(skill);
    if (statusId == null) return false;
    const effect = selfSupportEffects.get(statusId);
    return !!effect && effect.expiresAt > now;
  }
  function isSelfSupportStatusPending(skill, now = nowMs()) {
    const pendingUntil = selfSupportPendingUntil.get(Number(skill && skill.skillId)) || 0;
    if (pendingUntil <= now) {
      if (pendingUntil) selfSupportPendingUntil.delete(Number(skill && skill.skillId));
      return false;
    }
    return true;
  }
  function handleSelfSupportStatusPacket(u, op) {
    if (playerId == null || u.length < 7 || u32(u, 1) !== playerId) return;
    const statusId = u[5];
    const skillId = SELF_SUPPORT_SKILL_BY_STATUS.get(statusId);
    if (skillId == null) return;
    if (op === 0x3d && u.length >= 10) {
      const durationSec = f32(u, 6);
      if (!Number.isFinite(durationSec) || durationSec < 0) return;
      selfSupportEffects.set(statusId, { expiresAt: nowMs() + durationSec * 1000 });
      selfSupportPendingUntil.delete(skillId);
    } else if (op === 0x3e && u[6] === 0) {
      selfSupportEffects.delete(statusId);
      selfSupportPendingUntil.delete(skillId);
    }
  }
  function hasActiveSight(now = nowMs()) { return sightEffectUntil > now; }
  function handleSightStatusPacket(u, op) {
    if (playerId == null || u.length < 7 || u32(u, 1) !== playerId || u[5] !== SIGHT_STATUS_ID) return;
    if (op === 0x3d && u.length >= 10) {
      const durationSec = f32(u, 6);
      if (!Number.isFinite(durationSec) || durationSec < 0) return;
      sightEffectUntil = nowMs() + durationSec * 1000;
      sightPendingUntil = 0;
      log('👁️ Sight ทำงาน', '(' + durationSec.toFixed(1) + 's)');
    } else if (op === 0x3e && u[6] === 0) {
      sightEffectUntil = 0;
      sightPendingUntil = 0;
      if (CFG.verbose) log('👁️ Sight หมดแล้ว');
    }
  }
  function hasAllAbBuffs(now = nowMs()) {
    return hasAbBuffStatus(0x10, now) && hasAbBuffStatus(0x11, now);
  }
  function missingAbBuffNames(now = nowMs()) {
    return [0x10, 0x11].filter(id => !hasAbBuffStatus(id, now)).map(id => AB_BUFF_STATUS_NAMES[id]);
  }
  function abBuffTravelBlockers(now = nowMs()) {
    const blockers = [];
    if (target) blockers.push('combat=' + (target.name || target.id.toString(16)));
    if (CFG.lootEnabled) {
      if (queue.size) {
        const first = queue.values().next().value;
        blockers.push('loot queue=' + queue.size + (first ? ' (' + nameOf(first.itemId) + ')' : ''));
      }
      if (warpQueue.size) blockers.push('warp loot=' + warpQueue.size);
      if (pickupPending) blockers.push('รอผล pickup');
      if (now < lootSettleUntil) blockers.push('รอ drop ' + Math.ceil((lootSettleUntil - now) / 1000) + 's');
    }
    if (isResting) blockers.push('กำลังนั่งพัก');
    if (postRespawnRest) blockers.push('พักหลังเกิด');
    if (sellState !== 'IDLE') blockers.push('ขายของ=' + sellState);
    if (storageState !== 'IDLE') blockers.push('ฝากของ=' + storageState);
    if (isOreRefineActive()) blockers.push('ย่อยแร่=' + oreRefineState);
    // Loot Queue มี packet วาร์ป/เก็บของของตัวเอง ต้อง drain งานที่ claim แล้วก่อน
    if (lootQueue.isCollectorActive()) blockers.push('Loot Queue collector');
    return blockers;
  }
  function isAbBuffTravelIdle(now = nowMs()) {
    return abBuffTravelBlockers(now).length === 0;
  }
  function handleAbBuffStatusPacket(u, op) {
    if (playerId == null || u.length < 7 || u32(u, 1) !== playerId) return;
    const statusId = u[5];
    const statusName = AB_BUFF_STATUS_NAMES[statusId];
    if (!statusName) return;
    if (op === 0x3d && u.length >= 10) {
      const durationSec = f32(u, 6);
      if (!Number.isFinite(durationSec) || durationSec < 0) return;
      abBuffEffects.set(statusId, { expiresAt: nowMs() + durationSec * 1000 });
      log('⛪ ได้', statusName, '(' + durationSec.toFixed(0) + 's)');
    } else if (op === 0x3e) {
      const isRefresh = u[6] !== 0;
      if (!isRefresh) {
        abBuffEffects.delete(statusId);
        log('⛪', statusName, 'หมดแล้ว');
      }
    }
  }
  // Cloaking ของมอนถูก broadcast ให้คนรอบข้าง: 0x3d=เริ่ม, 0x3e=ยกเลิก
  // ใช้ 0x3e เป็นสัญญาณหลักให้ HIDDEN_WAIT กลับไป Attack ไม่ต้องรอ timeout ปกติ
  function handleTargetCloakingStatusPacket(u, op) {
    if (!target || u.length < 7 || u32(u, 1) !== target.id || u[5] !== CLOAKING_STATUS_ID) return;
    if (!isHiddenWaitTarget(entities.get(target.id) || target)) return;
    const now = nowMs();
    if (op === 0x3d) {
      target.cloakingActiveAt = now;
      target.cloakingRemovedAt = 0;
      return;
    }
    if (op === 0x3e) {
      target.cloakingRemovedAt = now;
      if (target.hiddenWaitAt) log('👁️', target.name || target.id.toString(16), 'เลิก Cloaking → เตรียมตีเป้าเดิม');
    }
  }

  // ---------- AUTO LOGIN / RECOVERY ----------
  // UI Login รุ่นใหม่ของ Unity: พิกัดสัมพันธ์จาก trace จริง (รองรับ canvas ทุกขนาด)
  const AUTO_LOGIN_UI = {
    splash: { x: 0.534, y: 0.592 },
    savedAccountButton: { x: 0.513, y: 0.368 },
    firstAccount: { x: 0.389, y: 0.338 },
    // slot 0 มาจาก trace; slot 1/2 เป็น card กลาง/ขวาใน layout เดียวกัน
    characterCards: [{ x: 0.283, y: 0.323 }, { x: 0.500, y: 0.323 }, { x: 0.717, y: 0.323 }],
  };
  const AUTO_LOGIN_UI_STEP_WAIT_MS = 2800;
  const AUTO_LOGIN_UI_CHARACTER_WAIT_MS = 1800;
  const AUTO_LOGIN_UI_LOGIN_TIMEOUT_MS = 12000;
  const AUTO_LOGIN_UI_CHARACTER_TIMEOUT_MS = 9000;
  const AUTO_LOGIN_UI_MAX_ATTEMPTS = 3;

  // Legacy login flow (server UI rollback): ใช้บัญชีที่เกมจำไว้ + Enter + packet เลือกตัวละครเดิม.
  function sendSelectCharPacket(token, slot) {
    if (!activeWS || activeWS.readyState !== 1 || !token) return false;
    const b = new Uint8Array(1 + token.length + 1);
    b[0] = 0x03;
    b.set(token, 1);
    b[b.length - 1] = Math.max(0, Math.min(2, Number(slot) || 0)) & 0xff;
    activeWS.send(b);
    return true;
  }
  function clearAutoLoginBootstrap() {
    if (autoLoginSplashTimer) { clearInterval(autoLoginSplashTimer); autoLoginSplashTimer = null; }
    if (autoLoginEnterTimer) { clearInterval(autoLoginEnterTimer); autoLoginEnterTimer = null; }
  }
  function autoLoginCanvas() { return document.querySelector('canvas') || null; }
  function dispatchAutoLoginPointer(point, detail = 1) {
    const canvas = autoLoginCanvas();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const clientX = rect.left + rect.width * point.x;
    const clientY = rect.top + rect.height * point.y;
    const pointer = (type, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
      clientX, clientY, button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true,
    }));
    const mouse = (type, buttons, clickDetail) => canvas.dispatchEvent(new MouseEvent(type, {
      clientX, clientY, button: 0, buttons, detail: clickDetail, bubbles: true, cancelable: true,
    }));
    pointer('pointerdown', 1); mouse('mousedown', 1, detail);
    pointer('pointerup', 0); mouse('mouseup', 0, detail); mouse('click', 0, detail);
    return true;
  }
  function dispatchAutoLoginDoubleClick(point, runId) {
    if (!dispatchAutoLoginPointer(point, 1)) return false;
    // Unity ต้องเห็น click สองครั้งแยกกัน ไม่ใช่เพียง event dblclick เดี่ยว.
    setTimeout(() => {
      if (!autoLoginBootstrapStarted || autoLoginUiRunId !== runId) return;
      const canvas = autoLoginCanvas();
      if (!canvas || !dispatchAutoLoginPointer(point, 2)) return;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('dblclick', {
        clientX: rect.left + rect.width * point.x, clientY: rect.top + rect.height * point.y,
        button: 0, detail: 2, bubbles: true, cancelable: true,
      }));
    }, 110);
    return true;
  }
  function dispatchAutoLoginArrowRight() {
    const canvas = autoLoginCanvas();
    if (!canvas) return false;
    const options = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true };
    canvas.dispatchEvent(new KeyboardEvent('keydown', options));
    setTimeout(() => canvas.dispatchEvent(new KeyboardEvent('keyup', options)), 45);
    return true;
  }
  function failAutoLoginUi(reason) {
    autoLoginPhase = 'failed';
    clearAutoLoginBootstrap();
    log('⚠️ Auto-Login UI: ' + reason + ' — หยุดเพื่อไม่ให้คลิกข้ามหน้า');
  }
  function runAutoLoginUi() {
    if (!masterBot.enabled()) return;
    if (!CFG.autoLoginEnabled) { clearAutoLoginBootstrap(); return; }
    const now = Date.now();
    if (now < autoLoginUiNextAt) return;
    if (autoLoginPhase === 'ui-splash') {
      if (!dispatchAutoLoginPointer(AUTO_LOGIN_UI.splash)) {
        if (++autoLoginUiAttempts >= 10) { failAutoLoginUi('ไม่พบ canvas หน้า splash'); return; }
        autoLoginUiNextAt = now + 500;
        return;
      }
      autoLoginPhase = 'ui-saved-account';
      autoLoginUiAttempts = 0;
      autoLoginUiNextAt = now + AUTO_LOGIN_UI_STEP_WAIT_MS;
      log('🖱️ Auto-Login UI: แตะหน้าเริ่มเกม → รอเมนูบัญชี');
      return;
    }
    if (autoLoginPhase === 'ui-saved-account') {
      if (!dispatchAutoLoginPointer(AUTO_LOGIN_UI.savedAccountButton)) { failAutoLoginUi('คลิก Saved Account ไม่ได้'); return; }
      autoLoginPhase = 'ui-account-row';
      autoLoginUiNextAt = now + AUTO_LOGIN_UI_STEP_WAIT_MS;
      log('🖱️ Auto-Login UI: คลิก Saved Account → รอรายชื่อบัญชี');
      return;
    }
    if (autoLoginPhase === 'ui-account-row') {
      if (!dispatchAutoLoginDoubleClick(AUTO_LOGIN_UI.firstAccount, autoLoginUiRunId)) { failAutoLoginUi('double-click บัญชีแรกไม่ได้'); return; }
      autoLoginPhase = 'awaitLoginResult';
      autoLoginUiAttempts = 1;
      autoLoginUiDeadlineAt = now + AUTO_LOGIN_UI_LOGIN_TIMEOUT_MS;
      autoLoginUiNextAt = now + 3500;
      log('🖱️ Auto-Login UI: double-click บัญชีแรก → รอ LOGIN_RESULT');
      return;
    }
    if (autoLoginPhase === 'awaitLoginResult') {
      if (now >= autoLoginUiDeadlineAt) { failAutoLoginUi('ไม่ได้รับ LOGIN_RESULT หลังเลือกบัญชี'); return; }
      if (now < autoLoginUiNextAt) return;
      if (autoLoginUiAttempts >= AUTO_LOGIN_UI_MAX_ATTEMPTS) { failAutoLoginUi('เลือกบัญชี ' + AUTO_LOGIN_UI_MAX_ATTEMPTS + ' ครั้งแล้วยังไม่ตอบ'); return; }
      if (dispatchAutoLoginDoubleClick(AUTO_LOGIN_UI.firstAccount, autoLoginUiRunId)) {
        autoLoginUiAttempts++;
        autoLoginUiNextAt = now + 3500;
        log('🖱️ Auto-Login UI: ยังรอ LOGIN_RESULT → double-click บัญชีซ้ำ (' + autoLoginUiAttempts + '/' + AUTO_LOGIN_UI_MAX_ATTEMPTS + ')');
      }
      return;
    }
    if (autoLoginPhase === 'ui-character-ready') {
      const slot = Math.max(0, Math.min(2, Number(CFG.autoLoginSlot) || 0));
      if (autoLoginUiAttempts < slot) {
        if (!dispatchAutoLoginArrowRight()) { failAutoLoginUi('ส่ง ArrowRight ไปหน้าเลือกตัวละครไม่ได้'); return; }
        autoLoginUiAttempts++;
        autoLoginUiNextAt = now + 350;
        log('⌨️ Auto-Login UI: เลื่อนเลือกตัวละคร → slot ' + autoLoginUiAttempts);
        return;
      }
      autoLoginPhase = 'ui-character-confirm';
      autoLoginUiNextAt = now + 500;
      return;
    }
    if (autoLoginPhase === 'ui-character-confirm') {
      const slot = Math.max(0, Math.min(2, Number(CFG.autoLoginSlot) || 0));
      if (!dispatchAutoLoginDoubleClick(AUTO_LOGIN_UI.characterCards[slot], autoLoginUiRunId)) { failAutoLoginUi('double-click ตัวละคร slot ' + slot + ' ไม่ได้'); return; }
      autoLoginPhase = 'ui-await-character';
      autoLoginUiAttempts = 1;
      autoLoginUiDeadlineAt = now + AUTO_LOGIN_UI_CHARACTER_TIMEOUT_MS;
      autoLoginUiNextAt = now + 3000;
      log('🖱️ Auto-Login UI: double-click ตัวละคร slot ' + slot + ' → รอเข้าเกม');
      return;
    }
    if (autoLoginPhase === 'ui-await-character' || autoLoginPhase === 'clientSelect') {
      if (now >= autoLoginUiDeadlineAt) { failAutoLoginUi('เลือกตัวละครแล้ว แต่ยังไม่ได้เข้าเกม'); return; }
      // ไม่ double-click ซ้ำ: server อาจกำลังเปลี่ยนแมปอยู่ และ packet 0x03 คือผลยืนยันที่ต้องรอ.
      return;
    }
  }
  function startAutoLoginBootstrap() {
    if (!masterBot.enabled() || !CFG.autoLoginEnabled || autoLoginBootstrapStarted) return;
    autoLoginBootstrapStarted = true;
    const startedAt = Date.now();
    let splashTries = 0, enterTries = 0;
    const isConnected = () => !!(activeWS && activeWS.readyState === 1) || playerId != null;
    const stopIfConnected = () => {
      if (!isConnected()) return false;
      clearAutoLoginBootstrap();
      return true;
    };
    // Unity หน้า splash ต้องได้รับ pointer event ก่อนจึงจะโหลดถึงหน้า Login
    autoLoginSplashTimer = setInterval(() => {
      if (!masterBot.enabled()) { clearAutoLoginBootstrap(); return; }
      if (stopIfConnected()) return;
      if (Date.now() - startedAt > 180000) { clearAutoLoginBootstrap(); return; }
      splashTries++;
      try {
        const canvas = document.querySelector('canvas') || document.body;
        const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click']) {
          const EventType = type.startsWith('pointer') ? PointerEvent : MouseEvent;
          canvas.dispatchEvent(new EventType(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }));
        }
        if (splashTries <= 2 || splashTries % 5 === 0) log('🖱️ Auto-Login: ยังไม่มี WS → คลิกกลางจอปลุกหน้าเกม (' + splashTries + ')');
      } catch (_) {}
    }, 8000);
    // Unity canvas ไม่รับ synthetic text input ที่เชื่อถือได้ แต่รับ Enter ได้
    autoLoginEnterTimer = setInterval(() => {
      if (!masterBot.enabled()) { clearAutoLoginBootstrap(); return; }
      if (stopIfConnected()) return;
      if (enterTries >= 8) { clearAutoLoginBootstrap(); return; }
      enterTries++;
      try {
        const canvas = document.querySelector('canvas') || document.body;
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        setTimeout(() => canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })), 45);
        log('⌨️ Auto-Login: กด Enter ที่หน้า Login (บัญชีที่เกมจำไว้) ' + enterTries + '/8');
      } catch (_) {}
    }, 20000);
  }
  function scheduleAutoRefresh(reason) {
    if (autoRefreshScheduled) return;
    autoRefreshScheduled = true;
    logImportant('flee', '🔄 [Auto-Refresh] ' + reason + ' → refresh หน้าเพื่อ reconnect/login ใหม่');
    autoRefreshTimer = setTimeout(() => {
      autoRefreshTimer = null;
      if (masterBot.enabled()) location.reload();
      else autoRefreshScheduled = false;
    }, 1500);
  }

  // ---------- inbound protocol implementation (เรียกผ่าน Game Packet runtime ด้านล่าง) ----------
  function handleInboundProtocol(u) {
    const op = u[0];
    // 0x00 LOGIN_RESULT: token สำหรับเลือกตัวละคร
    if (op === 0x00 && CFG.autoLoginEnabled && (autoLoginPhase === 'idle' || autoLoginPhase === 'awaitLoginResult') && u.length >= 29) {
      if (u[1] === 0x02) {
        autoLoginToken = u.slice(5, 29);
        autoLoginPhase = 'acctOk';
        clearAutoLoginBootstrap();
        log('🤖 Auto-Login: เกม login ผ่าน → จะเลือกตัวละคร slot', CFG.autoLoginSlot, 'ใน 2.5s');
        setTimeout(() => {
          if (!masterBot.enabled() || autoLoginPhase !== 'acctOk' || !activeWS || activeWS.readyState !== 1) return;
          // ตั้ง phase ก่อน send เพราะ ws.send จะผ่าน handleOut แบบ synchronous
          // → แยก packet ที่บอทยิงเองออกจาก client ที่กดเลือกผ่าน UI ได้ถูกต้อง
          autoLoginPhase = 'charSent';
          if (sendSelectCharPacket(autoLoginToken, CFG.autoLoginSlot)) {
            log('🤖 Auto-Login: ส่งเลือกตัวละครแล้ว');
          } else {
            autoLoginPhase = 'acctOk';
          }
        }, 2500);
      }
    }
    if (op === 0x38) parseLiveInventorySnapshot(u);
    if (op === 0x54) parseStorageInventorySnapshot(u);
    // 0x30 EQUIP_CONFIRM: [30][bagId:4][slot:1][isEquip:1]
    // ยืนยันจาก live capture: server ตอบหลังสวม/ถอดอาวุธประมาณ 40ms
    if (op === 0x30 && u.length >= 7) handleWeaponEquipPacket(u);
    if (op === 0x3d || op === 0x3e) {
      handleAbBuffStatusPacket(u, op);
      handleSelfSupportStatusPacket(u, op);
      handleSightStatusPacket(u, op);
      handleTargetCloakingStatusPacket(u, op);
    }

    // 0x25 STAT: HP/SP ของ entity → [25][eid:4][statType:4][cur:4][max:4][flag:1]
    //   ★★ ห้ามตั้ง playerId จากที่นี่! STAT ส่งมาให้หลาย entity (player + monster)
    //      entityId แรกที่ส่ง STAT อาจเป็น monster → playerId ผิด → player position ไม่อัปเดต
    //      playerId ต้องมาจาก SELECT_CHAR(0x03) หรือ SPAWN(flag=1) เท่านั้น
    if (op === 0x25 && u.length >= 18) {
      const id = u32(u, 1);
      const cur = u32(u, 9), m = u32(u, 13);
      applyStat(id, cur, m);
    }
    // 0x27 SP_UPDATE: SP ปัจจุบัน + max ของ player (regen ทุก 6s)
    //   ★ mirror world.js:468-477 — STAT (0x25) ส่งแค่ HP ไม่มี SP → SP ต้องอ่านจาก 0x27 เท่านั้น
    //   [27][sp:4][spMax:4] (9 bytes)
    else if (op === 0x27 && u.length >= 9) {
      sp.cur = u32(u, 1);
      sp.max = u32(u, 5);
    }
    // 0x07 MOVE: ตำแหน่ง entity (ทั้ง player + monster/NPC)
    //   ★ player ใช้ i16 (offset 5/7) เหมือน monster เพื่อให้ระบบพิกัดตรงกัน (combat คำนวณระยะ/ทิศได้แม่น)
    //   ★ VALID_COORD: พิกัด Ragnarok อยู่ในช่วง [-500, 1000] — ค่านอกนี้ = parse ผิด → ปฏิเสธ
    else if (op === 0x07 && u.length >= 9) {
      const id = u32(u, 1);
      const x = i16(u, 5), y = i16(u, 7);
      // sanity check: พิกัดต้องอยู่ในช่วงแผนที่ (-500 ถึง 1000) — กัน garbage จาก parse ผิด
      const valid = (x >= -500 && x <= 1000 && y >= -500 && y <= 1000);
      if (!valid) return;   // พิกัดผิดปกติ → ข้ามทั้ง packet
      // ★ (D) stalePlayerIds check — กัน phantom entity จาก oldPlayerId (mirror world.js:1562)
      updateKnownEntityPosition(id, x, y, nowMs());
    }
    // 0x22 EXP: ได้รับ EXP (solo/party/event ใช้ opcode เดียวกัน)
    //   format: [22][baseTotal:4][baseDelta:4][jobTotal:4][jobDelta:4] (17 bytes)
    //   ★ delta=0 = zone-in sync → ไม่นับ session EXP (mirror world.js:985)
    //   ★★ ไม่นับ kills ที่นี่ — 0x22 มาทุกครั้งที่ได้ EXP (รวม party/event)
    //      kills นับใน 0x0f ENTITY_ACTION action=3 (มอนตายจริง) เท่านั้น
    else if (op === 0x22) {
      lastExpAt = Date.now(); markCombat();
      if (u.length >= 17) {
        const baseDelta = u32(u, 5);    // offset 5 = baseDelta (unsigned — mirror protocol.js:726)
        const jobDelta  = u32(u, 13);   // offset 13 = jobDelta
        const gain = (baseDelta > 0 ? baseDelta : 0) + (jobDelta > 0 ? jobDelta : 0);
        if (gain > 0) stats.expGained += gain;
        // ★ แยก Base/Job EXP (สำหรับ monitor) — mirror world.js:990-991
        if (baseDelta > 0) stats.baseExpGained += baseDelta;
        if (jobDelta > 0) stats.jobExpGained += jobDelta;
      }
      // ★ จดพิกัดมอนที่เราฆ่า — ใช้ target หรือ entity ล่าสุดที่เราตี
      //   สำคัญสำหรับนักธนู: ยิงมอนตายไกล → ของตกที่พิกัดมอน ไม่ใช่ที่ตัวเรา
      let killX = null, killY = null;
      if (target && target.x != null) { killX = target.x; killY = target.y; }
      else if (target) {
        // target อาจถูก abandon แล้ว → หาจาก entity ล่าสุดที่เราตี (_lastEngagedByMeAt)
        let bestT = 0;
        for (const e of entities.values()) {
          if (e._lastEngagedByMeAt && e._lastEngagedByMeAt > bestT && e.x != null) {
            bestT = e._lastEngagedByMeAt; killX = e.x; killY = e.y;
          }
        }
      }
      if (killX != null && killY != null) {
        recentKillPos.push({ x: killX, y: killY, t: Date.now() });
        while (recentKillPos.length > KILL_POS_MAX) recentKillPos.shift();
      }
      for (const d of recentDrops.values()) tryClaim(d);
    }
    // 0x51 ITEM_DROP: ของตก
    else if (op === 0x51 && u.length >= 15) {
      const d = { dropId: u32(u, 1), x: f32(u, 5), y: f32(u, 9), itemId: u16(u, 13), t: Date.now() };
      recentDrops.set(d.dropId, d);
      tryClaim(d);
    }
    // 0x52 PICKUP result (เช็คทั้ง queue ปกติ + warpQueue)
    else if (op === 0x52 && u.length >= 9) {
      const picker = u32(u, 1), dropId = u32(u, 5);
      // 0x52 FAIL ไม่มี player id ของผู้ส่งคำสั่ง จึงห้ามถือว่าเป็นผลของ
      // Auto-Loot เพียงเพราะ dropId อยู่ใน queue: packet ของผู้เล่นอื่นอาจทำให้
      // เรา log retry ทั้งที่ยังไม่ได้ส่ง pickup (เช่น "0/3") ได้.
      const normalPickupPending = !!pickupPending && pickupPending.dropId === dropId;
      if (normalPickupPending) pickupPending = null;
      const it = queue.get(dropId);
      const wit = warpQueue.get(dropId);   // ★ อาจมาจาก warpQueue หลังวาร์ปไปเก็บ
      // ★★ เช็คว่า "เรา" เป็นคนเก็บ (picker === playerId) ไม่ใช่แค่ "ใครบางคนเก็บ"
      //   ปัญหา: คนอื่นเก็บการ์ด → server ส่ง picker = คนอื่น → บอทเข้าใจว่าเก็บได้เอง!
      if (picker !== FAIL && picker === playerId) {
        const qit = lootQueue.pickup(dropId);
        if (it) { queue.delete(dropId); }
        if (wit) { warpQueue.delete(dropId); log('✨ วาร์ปไปเก็บสำเร็จ:', nameOf(wit.itemId), 'drop', dropId); }
        const picked = it || wit || qit;
        // packet ของผู้เล่นคนอื่น/ของที่เราเก็บมือเอง: ไม่ใช่คิวของบอท จึงไม่แตะ stats
        if (!picked) return;
        const itemId = picked.itemId;
        stats.itemsLooted++;
        stats.itemsByCount.set(itemId, (stats.itemsByCount.get(itemId) || 0) + 1);
        // ★ zeny/hour tracking — buyPrice × count (mirror bot.js:401-422)
        const price = itemPrice(itemId);
        if (price > 0) {
          stats.goldWindow.push({ t: nowMs(), gold: price });
          stats.sessionGold += price;
        }
        log('✅ เก็บได้', nameOf(itemId), 'drop', dropId);
        dbg('📦 Loot success:', nameOf(itemId), 'drop=' + dropId, 'queue=' + queue.size, 'warpQueue=' + warpQueue.size);
        // ★ Card detection — เก็บการ์ดได้ → log สำคัญ
        const itemName = itemDisplayName(itemId);
        if (itemName.endsWith(' Card') || (itemId >= 4001 && itemId <= 4520)) {
          logImportant('card', '🃏 เก็บการ์ดได้! ' + itemName + ' (' + itemId + ')');
        }
        // ★ ถ้าเก็บหมดแล้ว (queue ว่าง) → trigger cooldown ก่อน combatLoop acquire ใหม่
        if (queue.size === 0 && warpQueue.size === 0) {
          combatCooldownUntil = nowMs() + CFG.postCombatDelayMs;
        }
      } else if (picker !== FAIL) {
        // มี entity อื่นเก็บ drop นี้ไปแล้ว (เช่น Porporing loot หรือผู้เล่นอื่น)
        // ไม่ใช่ FAIL ของเรา จึงไม่มีประโยชน์ที่จะ retry ต่อจนคิวค้าง
        const lootQueueTaken = lootQueue.onPickupTakenByOther(dropId);
        if (it) {
          queue.delete(dropId);
          log('🗑️ ของถูกเก็บไปแล้ว:', nameOf(it.itemId), 'drop', dropId, '(picker', picker.toString(16) + ')');
          dbg('📦 Loot lost to other picker:', nameOf(it.itemId), 'drop=' + dropId, 'picker=' + picker.toString(16));
        }
        if (wit) warpQueue.delete(dropId);
        recentDrops.delete(dropId);
        if (lootQueueTaken) log('🗑️ Loot Queue: drop ถูกเก็บโดย entity อื่น → ทิ้งงานนี้');
      } else {
        // FAIL ไม่ได้แปลว่าของหายเสมอไป: อาจยังเดินไปไม่ถึงหรือ server sync ช้า
        // จึงเก็บไว้ลองซ้ำจนถึง maxAttempts; ถ้าครบแล้วค่อยปล่อย.  แต่ต้อง
        // ยืนยันก่อนว่าเป็นคำสั่ง normal/warp ของเราเอง ไม่ใช่ FAIL ของคนอื่น.
        const ownNormalPickup = !!it && normalPickupPending;
        const ownWarpPickup = !!wit && wit.pickupSentAt !== 0;
        const ownLootQueuePickup = lootQueue.onPickupFail(dropId);
        if (!ownNormalPickup && !ownWarpPickup && !ownLootQueuePickup) return;
        stats.pickupFails++;
        if (ownLootQueuePickup) return;
        if (ownNormalPickup) {
          if (it.attempts >= CFG.maxAttempts) {
            queue.delete(dropId);
            log('🚫 ปล่อย', nameOf(it.itemId), 'drop', dropId, '(server ตอบ FAIL ครบ', it.attempts, 'ครั้ง)');
            dbg('📦 Loot give up:', nameOf(it.itemId), 'drop=' + dropId, 'attempts=' + it.attempts, 'reason=server_FAIL');
          } else {
            log('↻ เก็บไม่สำเร็จ', nameOf(it.itemId), 'drop', dropId, '→ รอลองใหม่', '(' + it.attempts + '/' + CFG.maxAttempts + ')');
          }
        }
        // wit ไม่ delete ที่นี่ → warpLoop จะจัดการ offset ถัดไป
      }
    }
    // 0x24 DEATH: player ตาย → ล็อค isDead (ห้าม heal ตอนตาย) + รีเซ็ต HP
    else if (op === 0x24 && u.length >= 5 && playerId != null && u32(u, 1) === playerId) {
      isDead = true;
      hp.cur = 0;
      stats.deaths++;
      // ★ ล้างเวลา buff — ตายแล้ว buff หายหมด → ใช้ใหม่ได้ทันทีหลัง respawn
      if (lastBuffUse.size > 0) lastBuffUse.clear();
      // ★ ล้างเวลา skill + per-target uses (mirror bot.js:744-747)
      if (lastSkillUse.size > 0) { lastSkillUse.clear(); saveSkillTimesDebounced(); }
      skillUsesOnTarget.clear();
      selfSupportEffects.clear();
      selfSupportPendingUntil.clear();
      resetAutoSupportQueue();
      log('☠️ ตัวละครตาย — หยุด heal จนกว่าจะ respawn');
    }
    // 0x12 MAP_NAME: ชื่อแมปปัจจุบัน → เก็บไว้ใช้สำหรับ warp
    //   format: [12][len:2 LE][mapname UTF-8]
    //   ★ ตรวจ "ออกจากแมปฟาร์ม" → วาร์ปกลับอัตโนมัติ (mirror bot.js:1226-1235)
    else if (op === 0x12 && u.length >= 3) {
      const len = u16(u, 1);
      if (u.length >= 3 + len) {
        const name = new TextDecoder().decode(u.slice(3, 3 + len));
        if (name && name !== currentMap) {
          const prevMap = currentMap;
          currentMap = name;
          settleFpsCapAfterMapLoad();
          confirmTeleportMapChange(name);
          lootQueue.onMapChanged(name);
          log('🗺️ แมป:', name);
          // ★★★ clear entities ของแมปเก่า — กัน monster ค้างติดมาแมปใหม่ (mirror world.js:293-306)
          //   ปัญหา: ไม่ clear → Merman/Strouf จากแมปเก่ายังค้าง → บอทพยายามตีมอนที่ไม่มีจริง
          entities.clear();
          radarPlayerIds.clear();
          // self entity ของแมปเก่าก็ห้ามค้างข้ามมา: playerId ยังอยู่ และ packet สดจะสร้างใหม่.
          warpToMonsterCount.clear(); // เปลี่ยนแมป = entity ชุดใหม่ ห้าม inherit quota วาร์ป
          monsterAggro.clear(); mobAttackers.clear();
          target = null;
          log('🧹 ล้าง entities แมปเก่า (เปลี่ยนแมป)');
          bossAlertedIds.clear();   // ★ ล้าง boss alert cache (เริ่มนับใหม่ในแมปใหม่)
          movementPlanner.reset(); // ★ เปลี่ยนแมป → ล้าง state ของ GAT/Nav/fallback log tag
          // ★ warp-back-to-farm: ออกจากแมปฟาร์ม → วาร์ปกลับ
          //   เงื่อนไข: warpBackToFarm=on AND farmMap ไม่ว่าง AND ตอนนี้ไม่ใช่ farmMap
          //   ★★ ไม่จำกัดแค่ "มาจาก farmMap" — ถ้าอยู่แมปผิดก็วาร์ปกลับเสมอ (กันติดแมปอื่น)
          //   ยกเว้น: อยู่ใน sell/storage/ore-refine routine — ไม่วาร์ปกลับ
          if (masterBot.enabled() && CFG.warpBackToFarm && CFG.farmMap && name !== CFG.farmMap && !lootQueue.isCollectorActive() && !isAbBuffActive()
              && name !== CFG.sellNpcMap && name !== CFG.kafraMap
              && !(isOreRefineActive() && name === CFG.oreRefineMap)) {
            log('🌀 อยู่แมปผิด (' + name + '≠' + CFG.farmMap + ') → วาร์ปกลับ');
            sendTeleport(CFG.farmMap, CFG.farmMapX, CFG.farmMapY, 'farm-map-guard');
            lastFarmWarpBackAt = nowMs();
          }
        }
      }
    }
    // 0x03 SELECT_CHAR: server ตอบหลังเลือกตัวละคร — ★ ฝัง mapName (MAP_NAME ไม่ส่งตอน login ครั้งแรก)
    //   format: [03][eid:4][len:2][mapname null-terminated]
    else if (op === 0x03 && u.length >= 7) {
      const eid = u32(u, 1);
      if (playerId == null && eid) { playerId = eid; log('👤 player_id =', eid.toString(16), '(จาก SELECT_CHAR)'); relayRegisterPlayer(); }
      if (autoLoginPhase === 'charSent' || autoLoginPhase === 'acctOk' || autoLoginPhase === 'charSelectNudging' || autoLoginPhase === 'clientSelect') {
        autoLoginPhase = 'done';
        log('🤖 Auto-Login: เข้าเกมสำเร็จ');
      }
      const mapLen = u16(u, 5);
      if (u.length >= 7 + mapLen && mapLen > 0) {
        let name = new TextDecoder().decode(u.slice(7, 7 + mapLen));
        name = name.split('\0')[0];   // ตัดที่ null terminator
        if (name && name !== currentMap) { currentMap = name; confirmTeleportMapChange(name); lootQueue.onMapChanged(name); movementPlanner.reset(); log('🗺️ แมป:', name, '(จาก SELECT_CHAR)'); }
      }
    }
    // 0x2a WARP_FAIL: server บอกว่าพิกัดวาร์ป invalid (กำแพง/น้ำ) → warpLoop จะลอง offset ถัดไป
    //   format: [2a][02]
    else if (op === 0x2a && u.length >= 2) {
      rejectActiveTeleport();
      if (lootQueue.onWarpFail()) return;
      if (lastWarpTargetId != null) {
        const wit = warpQueue.get(lastWarpTargetId);
        if (wit) {
          log('⚠️ วาร์ป fail (พิกัด invalid) → ลอง offset ถัดไป:', nameOf(wit.itemId));
          wit.offsetIdx++;              // บังคับ offset ถัดไปใน warpLoop
          wit.warpAt = 0;               // ให้ warpLoop วาร์ปใหม่ได้เลย (ผ่าน cooldown)
        }
        lastWarpTargetId = null;
      }
    }
    // 0x36 DESPAWN_REASON: [36][eid:4][reason:4] — reason=2 = entity ถูกเก็บไป (โดย player หรือมอน loot)
    //   ★ สำคัญ: ถ้าของที่เรารอเก็บถูกมอน loot (เช่น Poring กินของ) → ลบออกจาก queue ทันที ไม่ต้องลองเก็บเปล่าๆ
    else if (op === 0x36 && u.length >= 9) {
      const eid = u32(u, 1);
      const reason = u32(u, 5);
      if (reason === 2) {
        // ของถูกเก็บไป → ลบจาก queue/recentDrops/warpQueue
        if (queue.has(eid)) {
          const it = queue.get(eid);
          queue.delete(eid);
          log('🗑️ ของหายไป:', nameOf(it.itemId), 'drop', eid, '(ถูกเก็บไปแล้ว — อาจโดยมอน loot)');
        }
        recentDrops.delete(eid);
        warpQueue.delete(eid);
      }
    }
    // ============== SELL / INVENTORY packets ==============
    // 0x32 INVENTORY_UPDATE (IN) — live capture + server source AddItemToInventory
    //   โครงสร้างจริง (19B): [32][03][invId:4=itemId×2][change_enc:2][bagWeight_enc:4][invId:4][count_enc:2][flag:1]
    //   offset: 0=op 1=sub 2..5=invId 6..7=change_enc 8..11=น้ำหนักดิบ×2 (bit 0=flag) 12..15=invId repeat 16..17=count_enc 18=flag
    //   itemId = invId >>> 1   (bit-packed: bit 0 = identified flag)
    //   count  = count_enc >>> 1  (bit-packed: bit 0 = flag; real = count_enc/2)
    //   หลักฐาน: Heart of Mermaid 160 → 0x0140=320; Meat 11 → 0x0016=22; Poison Spore 18 → 0x0024=36
    else if (op === 0x32 && u.length >= 6) {
      const sub = u[1];
      if (sub === 3 && u.length >= 18) {
        // Live 0x32 bit-packs BagWeight just like item/count IDs: divide by 2.
        // Example: 32688 >>> 1 = 16344 → 1,634.4 displayed weight.
        updateInventoryWeight(u32(u, 8) >>> 1, null, '0x32');
        // ★ stackable: set count ตรงจาก server (รองรับทั้งเพิ่ม/ลด/ใช้)
        const invId = u32(u, 2);
        const itemId = invId >>> 1;
        // ★ count_enc อยู่ offset 16-17 (protocol.js:1270-1278)
        const countEnc = u16(u, 16);
        const count = countEnc >>> 1;
        if (itemId > 0 && itemId < 50000) {
          const previousCount = inventory.get(itemId) || 0;
          // 0x32 ลดจำนวนของ item ที่กำลังรอผล = server รับคำสั่ง Heal แล้ว
          // อย่าตัดสินว่าใช้ไม่สำเร็จเพียงเพราะ HP packet มาช้ากว่า.
          if (heal.pendingItemId === itemId && count < previousCount) heal.pendingItemConsumed = true;
          if (count > previousCount) recordSessionLoot(itemId, count - previousCount);
          inventory.set(itemId, count);   // SET ตรงจาก server (แม่นยำเสมอ)
          heal.updateInventoryStock(itemId, count);
          // Ore refine ต้องรอจำนวน Green Live ที่ 0x32 ยืนยันก่อนส่ง Sell
          // เพื่อไม่ส่งยอดเดาจากจำนวน Great Nature ที่ย่อย.
          observeOreRefineInventory(itemId, count, '0x32');
        }
      } else if (sub === 5 && u.length >= 15) {
        // ★ equipment add (sub=5): itemId @ offset 12 (2B LE) bit-packed >>> 1
        //   slotId @ offset 2 (4B LE) bit-packed >>> 1 — mirror protocol.js:1237-1248
        //   ★★ track slotId สำหรับฝากเข้า storage (storage ต้องการ slotId ไม่ใช่ itemId)
        const itemId = u16(u, 12) >>> 1;
        const slotId = u32(u, 2) >>> 1;   // เช่น Bow(1701) slot 20010 → offset2 = 40020
        if (itemId > 0 && itemId < 50000) {
          inventory.set(itemId, (inventory.get(itemId) || 0) + 1);
          heal.updateInventoryStock(itemId, inventory.get(itemId));
          recordSessionLoot(itemId, 1);
          // ★ track slot id ของแต่ละชิ้น (mirror world.js:773-777)
          if (slotId > 0) {
            const slots = equipmentSlots.get(itemId) || [];
            if (!slots.includes(slotId)) slots.push(slotId);
            equipmentSlots.set(itemId, slots);
          }
        }
      } else if (sub !== 3 && sub !== 5 && u.length >= 7 && u.length <= 14) {
        // ★★ equipment removal (drop/sell/move to storage) — 12B packet
        //   โครงสร้าง: [32][sub][slotId×2:4][02 00][...] (protocol.js:1256-1264)
        //   ใช้ล้าง slot id ออกจาก equipmentSlots กัน stale slot
        const rawSlot = u32(u, 1);
        if (rawSlot > 0) {
          const slotId = rawSlot >>> 1;
          if (slotId > 0 && slotId < 100000) {
            for (const [itemId, slots] of equipmentSlots) {
              const idx = slots.indexOf(slotId);
              if (idx >= 0) {
                slots.splice(idx, 1);
                const cur = inventory.get(itemId) || 0;
                if (cur > 1) inventory.set(itemId, cur - 1);
                else inventory.delete(itemId);
                if (slots.length === 0) equipmentSlots.delete(itemId);
                break;
              }
            }
          }
        }
      }
      // ★ ยืนยันผล Steal เฉพาะเมื่อ inventory เพิ่มหลัง parse packet นี้แล้ว
      confirmStealInventoryIncrease();
      // ★ sub อื่น ๆ → ไม่ track (protocol.js:1265 ทิ้ง)
    }
    // 0x20 SYS_MESSAGE: detect "too full" → inventoryFull (mirror world.js:264-279)
    else if (op === 0x20 && u.length >= 2) {
      try {
        const msg = new TextDecoder('utf8', { fatal: false }).decode(u.slice(1)).toLowerCase();
        if (msg.includes('too full') || msg.includes('inventory is full') || msg.includes('cannot carry') || msg.includes('กระเป๋าเต็ม')) {
          if (!inventoryFull) log('🎒 ของเต็ม! (inventory full)');
          inventoryFull = true;
        }
        if (msg.includes('could not complete sale') || msg.includes('do not match')) {
          // sell failed signal
          if (sellState === 'SELL') { log('⚠️ ขายของล้มเหลว (server ปฏิเสธ)'); }
        }
      } catch (e) {}
    }
    // 0x2c CHAT: [2c][sender:4][msg_len:2][msg][name_len:2][name][chat_type:1]
    //   chatType: 0=nearby, 1=shout, 2=whisper (mirror protocol.js:1113-1128)
    //   ★ ตรวจคำว่า bot/บอท/บอต → log สำคัญ
    else if (op === 0x2c && u.length >= 7) {
      try {
        let p = 1;
        const sender = u32(u, p); p += 4;
        const msgLen = u16(u, p); p += 2;
        if (p + msgLen > u.length) return;
        const message = new TextDecoder('utf8', { fatal: false }).decode(u.slice(p, p + msgLen));
        p += msgLen;
        let name = '';
        if (p + 2 <= u.length) {
          const nameLen = u16(u, p); p += 2;
          if (p + nameLen <= u.length) {
            name = new TextDecoder('utf8', { fatal: false }).decode(u.slice(p, p + nameLen));
            p += nameLen;
          }
        }
        let chatType = -1;
        if (p < u.length) chatType = u[p];
        const typeNames = { 0: 'ใกล้', 1: 'ตะโกน', 2: 'กระซิบ' };
        const typeName = typeNames[chatType] || ('type' + chatType);
        // ★ เก็บลง chat history buffer (สำหรับ monitor)
        chatBuf.push({ t: Date.now(), type: typeName, chatType, sender: name || '?', message });
        while (chatBuf.length > CHAT_BUF_MAX) chatBuf.shift();
        // ★ AI ตอบเฉพาะ nearby chat ที่ sender ID ผูกกับ player entity ในระยะจริง
        //     จัดคิวไว้ก่อน เพื่อให้ target ปัจจุบันตาย → ตอบ → เก็บของใกล้เท้า → hold
        const isAiReplyChat = queueAiReplyInteraction(sender, name, message, chatType);
        const alertMsg = '💬 [' + typeName + '] ' + (name || '?') + ': ' + message;
        // ★ Log สำคัญเก็บเฉพาะบทสนทนาที่ผ่านเงื่อนไข AI/Template Reply จริง
        //    ส่วนแชทอื่นยังลง Activity Log และส่ง Telegram ตาม toggle เดิม แต่ไม่ทำให้ Log สำคัญรก
        if (isAiReplyChat) logImportant('chat', alertMsg, { relay: false });
        else log(alertMsg);
        // ★ Telegram: ใช้เงื่อนไขเดิม แยกออกจาก Log สำคัญ
        const lower = message.toLowerCase();
        if (lower.includes('bot') || message.includes('บอท') || message.includes('บอต')) {
          if (CFG.telegramAlertBotMention !== false) sendRelayAlert(alertMsg);
        }
        else {
          // ★ ส่งแชท nearby/whisper ทุกข้อความไป Telegram (ถ้าเปิด toggle)
          if (chatType === 0 && CFG.telegramAlertNearby !== false) sendRelayAlert(alertMsg);
          else if (chatType === 2 && CFG.telegramAlertWhisper !== false) sendRelayAlert(alertMsg);
        }
      } catch (e) {}
    }
    // 0x38 MAP_DATA: zone-enter data — ★ มี zeny ที่ offset 9 (u32LE)
    //   format: [38][u32:?][u32:?][u32:ZENY][...rest...] (mirror protocol.js:1415-1421)
    //   ★ ส่งตอนเข้าแมป/วาร์ป — เป็นแหล่งเดียวที่บอก zeny ปัจจุบัน
    else if (op === 0x38 && u.length >= 13) {
      const zeny = u32(u, 9);
      if (zeny != null && zeny !== playerZeny) {
        playerZeny = zeny;
      }
    }
    // ★ 0x3c MINIMAP_MARKER: 2 โหมด
    //   sub=1: [3c][0100][id:4][x:2][y:2][flag:1] — boss/player position (single, 12 bytes)
    //   sub=7: [3c][0700][id:4][x:2][y:2][flag:1] × N — warp portals + entities (multi)
    //   flag=1/3 = boss/player, flag=5 = warp portal
    else if (op === 0x3c && u.length >= 3) {
      const sub = u16(u, 1);
      const now = nowMs();
      if (sub === 7 && u.length >= 5) {
        // ★ sub=7: multi-entity list (warp portals + positions)
        //   format: [3c][0700] then repeating [id:4][x:2][y:2][flag:1] (9 bytes each)
        let p = 3;
        while (p + 9 <= u.length) {
          const eid = u32(u, p); p += 4;
          const ex = i16(u, p), ey = i16(u, p + 2); p += 4;
          const eflag = u[p]; p += 1;
          if (!eid || ex < -500 || ex > 1000 || ey < -500 || ey > 1000) continue;
          if (eflag === 5) {
            // ★ warp portal → track as entity kind=2 (NPC) + _isWarp flag
            entities.set(eid, { id: eid, kind: 2, x: ex, y: ey, alive: true, _lastSeenAt: now, _isWarp: true, name: 'Warp' });
          } else if (eflag === 4) {
            // ★ flag=4 = Boss (จริง) → track as _isBoss
            let m = entities.get(eid);
            if (m) { m.x = ex; m.y = ey; m._lastSeenAt = now; m._isBoss = true; }
            else { entities.set(eid, { id: eid, kind: 1, x: ex, y: ey, alive: true, _lastSeenAt: now, _isBoss: true, name: 'Boss' }); }
          } else if (eflag === 3) {
            // ★ flag=3 = Mini Boss
            let m = entities.get(eid);
            if (m) { m.x = ex; m.y = ey; m._lastSeenAt = now; m._isMiniBoss = true; }
            else { entities.set(eid, { id: eid, kind: 1, x: ex, y: ey, alive: true, _lastSeenAt: now, _isMiniBoss: true, name: 'Mini Boss' }); }
          } else if (eflag === 1) {
            // ★ flag=1 = ผู้เล่นบนแมป (รวมตัวเรา) → track เป็น kind=0
            // Self beacon มักมาแทน MOVE_UPDATE หลังวาร์ป/เดิน จึงต้อง sync
            // ตัวแปรกลางด้วย ไม่เช่น combat/wander จะใช้พิกัดเก่าจน server เมิน 0x07.
            rememberRadarPlayer(eid, ex, ey, now);
          }
        }
      } else if (sub === 1 && u.length >= 12) {
        // ★ sub=1: single boss/player position
        const id = u32(u, 3);
        const x = i16(u, 7), y = i16(u, 9);
        const flag = u[11];
        if (id && x >= -500 && x <= 1000 && y >= -500 && y <= 1000 && (flag === 1 || flag === 3 || flag === 4)) {
          if (flag === 1) {
            // ★ flag=1 = ผู้เล่นบนแมป (รวมตัวเรา) → track เป็น kind=0
            rememberRadarPlayer(id, x, y, now);
          } else {
            // ★ flag=3 = Mini Boss, flag=4 = Boss
            const isRealBoss = (flag === 4);
            let m = entities.get(id);
            if (isRealBoss) {
              if (m) { m.x = x; m.y = y; m._lastSeenAt = now; m._isBoss = true; }
              else { m = { id, kind: 1, x, y, alive: true, _lastSeenAt: now, _isBoss: true, name: 'Boss' }; entities.set(id, m); }
            } else {
              if (m) { m.x = x; m.y = y; m._lastSeenAt = now; m._isMiniBoss = true; }
              else { m = { id, kind: 1, x, y, alive: true, _lastSeenAt: now, _isMiniBoss: true, name: 'Mini Boss' }; entities.set(id, m); }
            }
            // ★ alert (ครั้งเดียวต่อ entity ID)
            if (!bossAlertedIds.has(id)) {
              bossAlertedIds.add(id);
              const dist = (player.x != null) ? Math.hypot(x - player.x, y - player.y).toFixed(0) : '?';
              const label = isRealBoss ? '👑 Boss' : '👹 Mini Boss';
              log(label + '! entity', id.toString(16), '@(', x, y, ') ห่าง', dist, 'ช่อง');
              logImportant('card', label + ' ที่ (' + x + ', ' + y + ') ห่าง ' + dist + ' ช่อง');
            }
            // ★ auto-warp (ถ้าเปิด toggle)
            if (masterBot.enabled() && CFG.warpToBoss && player.x != null && now - lastBossWarpAt > 10000) {
              const d = Math.hypot(x - player.x, y - player.y);
              if (d > 10) {
                const label = isRealBoss ? '👑 Boss' : '👹 Mini Boss';
                log(label + ' → วาร์ปไปสู้ @(', x, y, ') ห่าง', d.toFixed(0), 'ช่อง');
                sendTeleport(currentMap, x, y, 'boss-engage');
                lastBossWarpAt = now;
              }
            }
          }
        }
      }
    }
    // 0x4d NPC_DIALOG (mirror world.js:441-449)
    //   sub=1 = บทพูด (text) → กด Next ไปต่อ
    //   sub=2 = choice list (menu) → เลือก choice
    //   ★ ใช้ร่วมกับทั้ง sell (Tool Dealer) และ storage (Kafra)
    else if (op === 0x4d && u.length >= 6) {
      const sub = u[1];
      // --- ORE REFINE: owns Kafra/Scholar dialogs while the manual tool is active ---
      if (handleOreRefineNpcDialog(sub)) return;
      // --- SELL: TALK → เลือก Sell (choice 1) ---
      if (sub === 2 && sellState === 'TALK') {
        log('💰 ได้ NPC dialog choices → เลือก Sell');
        sendNpcSelect(1);
        sellState = 'SELECT_SELL'; sellStateAt = nowMs();
      }
      // --- STORAGE: TALK_KAFRA (บทพูด) → กด Next ---
      else if (storageState === 'TALK_KAFRA') {
        if (sub === 1) {
          log('🏦 Kafra บทพูด → กด Next');
          sendNpcNext();
          setStorageState('SELECT_STORAGE');
        } else if (sub === 2) {
          // Kafra ส่ง menu ตรงๆ (ไม่มี intro) → เลือก Use Storage
          const choice = CFG.kafraChoice != null ? CFG.kafraChoice : 1;
          log('🏦 Kafra menu → เลือก Use Storage (choice', choice + ')');
          sendNpcSelect(choice);
          setStorageState('STORAGE_OPENED');
        }
      }
      // --- STORAGE: SELECT_STORAGE (menu) → เลือก Use Storage ---
      else if (sub === 2 && storageState === 'SELECT_STORAGE') {
        const choice = CFG.kafraChoice != null ? CFG.kafraChoice : 1;
        log('🏦 Kafra menu → เลือก Use Storage (choice', choice + ')');
        sendNpcSelect(choice);
        setStorageState('STORAGE_OPENED');
      }
    }
    // 0x55 TRADE_OPEN: รายการ trade ของ NPC เปิดแล้ว → ส่ง entry/จำนวนที่ยืนยันจาก capture
    else if (op === 0x55 && handleOreRefineTradeOpen()) {
      return;
    }
    // 0x53 SELL_OPEN: sell menu opened → ส่ง sellItems
    else if (op === 0x53 && handleOreRefineSellOpen()) {
      return;
    }
    else if (op === 0x53 && sellState === 'SELECT_SELL') {
      // ★ สร้างรายการขาย — แยก equipment vs stackable (mirror bot.js _buildSellItems:1141-1171)
      //   equipment: ส่ง slot ID (20000+) count=1 ทีละชิ้น — เหมือน storageMove
      //   stackable: ส่ง itemId + count ปกติ
      const items = [];
      let eqCount = 0;
      for (const id of CFG.sellItemIds) {
        const stock = inventory.get(id) || 0;
        if (stock <= 0) continue;
        const eqSlots = equipmentSlots.get(id);
        if (eqSlots && eqSlots.length > 0) {
          // ★ equipment — ฝากจาก slot สูง→ต่ำ (กัน index shift เหมือน storage)
          const sorted = [...eqSlots].sort((a, b) => b - a);
          for (const slotId of sorted) { items.push({ itemId: slotId, count: 1 }); eqCount++; }
        } else {
          // ★ stackable — itemId + count จริง (server ปฏิเสธถ้า count ไม่ตรง)
          items.push({ itemId: id, count: stock });
        }
      }
      if (items.length === 0) {
        log('⚠️ ไม่มีของที่จะขาย (sellItemIds ว่าง หรือ inventory ไม่มี)');
        sellState = 'WARP_BACK'; sellStateAt = nowMs();
      } else {
        log('💰 ขายของ', items.length, 'รายการ' + (eqCount ? ' (' + eqCount + ' equipment)' : '') + ':',
            items.map(i => nameOf(i.itemId) + '×' + i.count).join(', '));
        sendSellItems(items);
        sellState = 'SELL'; sellStateAt = nowMs();
      }
    }
    // 0x5b SELL_RESULT: [5b][flag:1] flag>0 = success
    else if (op === 0x5b && u.length >= 2 && handleOreRefineResult(u[1] > 0)) {
      return;
    }
    else if (op === 0x5b && u.length >= 2 && sellState === 'SELL') {
      if (u[1] > 0) {
        log('✅ ขายของสำเร็จ!');
        // ล้าง inventory tracking ของ sold items (mirror bot.js:1767)
        for (const id of CFG.sellItemIds) inventory.delete(id);
        inventoryFull = false;
        lastSellAt = nowMs();
        // ★ chain → storage: ถ้าเปิด depositAfterSell และมีของฝาก → ฝากต่อ (mirror bot.js:1773-1781)
        //   ใช้ sellReturnTo เป็นจุดกลับของ storage ด้วย (เพราะอยู่ในเมืองอยู่แล้ว → วาร์ปไป Kafra ใกล้ ๆ)
        if (CFG.storageEnabled && CFG.depositAfterSell) {
          const hasDeposit = hasDepositableInventory();
          if (hasDeposit) {
            const retTo = sellReturnTo;   // จดก่อน sell clear
            sellState = 'IDLE'; sellReturnTo = null;   // clear sell ก่อนเริ่ม storage
            startStorage('หลังขาย', retTo);
            return;
          }
        }
      } else {
        log('⚠️ ขายของล้มเหลว (SELL_RESULT flag=0)');
      }
      sellState = 'WARP_BACK'; sellStateAt = nowMs();
    }
    // ============== COMBAT packets ==============
    // 0x06 SPAWN: สร้าง/อัปเดต entity (kind=0 player/1 monster/2 NPC)
    //   layout: [06][flag:1][type:4][0f][id:4][sub:4][?:4][z:i32][nameLen:4][name][kind:1][class:2][x:i32][y:i32][hp:u32][hpMax:u32]
    //   ★ name เริ่มที่ offset 27 (หลัง z@19-22 + nameLen@23-26) ไม่ใช่ 19!
    //   nameLen (u32 @23) ใช้ได้สำหรับ ASCII แต่ผิดสำหรับ UTF-8 ไทย → scan สำรอง
    else if (op === 0x06 && u.length >= 27) {
      try {
        const flag = u[1];
        const id = u32(u, 7);            // offset 7 (ข้าม marker 0x0f @6)
        const sub = u32(u, 11);          // offset 11
        // z @ 19-22 (i32 signed) — ข้าม
        const nameLenField = u32(u, 23); // nameLen @ 23 (u32 — น่าเชื่อถือไม่ได้สำหรับ UTF-8 ไทย)
        // หา nameEnd: เริ่มจาก 27+nameLenField ถ้าดูเหมือน ASCII, ไม่งั้น scan จาก offset 27
        let nameEnd = 27 + nameLenField;
        let name = '';
        if (nameLenField > 0 && nameLenField < 32) {
          const candidate = u.slice(27, 27 + nameLenField);
          const lastByte = candidate[candidate.length - 1];
          const looksTruncated = (lastByte >= 0x80);   // ถ้า byte สุดท้ายเป็น UTF-8 continuation → ตัดกลางคัน
          if (looksTruncated) {
            // scan หา [00 00][kind<=2] จาก offset 27 (ข้าม z + nameLen)
            for (let i = 27; i < u.length - 2; i++) {
              if (u[i] === 0 && u[i + 1] === 0 && u[i + 2] <= 2) { nameEnd = i; break; }
            }
          }
          try { name = new TextDecoder('utf8', { fatal: false }).decode(u.slice(27, nameEnd)); } catch (e) { name = ''; }
        } else {
          // nameLen ผิดปกติ → scan หา [00 00][kind<=2] จาก offset 27
          nameEnd = -1;
          for (let i = 27; i < u.length - 2; i++) {
            if (u[i] === 0 && u[i + 1] === 0 && u[i + 2] <= 2) { nameEnd = i; break; }
          }
          if (nameEnd < 0) nameEnd = u.length;   // ไม่เจอ → ใช้ท้าย packet
          try { name = new TextDecoder('utf8', { fatal: false }).decode(u.slice(27, nameEnd)); } catch (e) { name = ''; }
        }
        // kind @ nameEnd + 2 (หลัง 00 00 ตัวที่ 2) — เหมือนบอทหลักที่ scan pattern หา kind
        // จริงๆ nameEnd ใน path scan = index ของ 00 ตัวแรก → kind อยู่ที่ nameEnd+2
        // ใน path nameLen (ไม่ scan) → nameEnd = 27+nameLenField → kind @ nameEnd ตรงๆ
        // แก้โดยใช้ logic เดียวกับบอทหลัก: kind = byte หลัง name
        let kind = -1;
        // ถ้า nameEnd มาจาก scan (มี 00 00 ก่อน) → kind @ nameEnd+2
        if (u[nameEnd] === 0 && u[nameEnd + 1] === 0) kind = u[nameEnd + 2];
        else kind = u[nameEnd];   // nameEnd = จุดสิ้นสุดชื่อ (path nameLen)
        if (kind < 0 || kind > 2) {
          // kind ไม่ valid → scan ใหม่หา pattern [00 00][0-2]
          for (let i = 27; i < u.length - 2; i++) {
            if (u[i] === 0 && u[i + 1] === 0 && u[i + 2] <= 2) { nameEnd = i; kind = u[i + 2]; break; }
          }
        }
        if (kind >= 0 && kind <= 2) {
          // flag=1 ของ packet SPAWN ใช้ identify ตัวเราได้ แต่ต้อง parse ชื่อก่อน
          // มิฉะนั้นการอ้าง `name` ก่อนประกาศจะ throw และทิ้ง packet SPAWN ทั้งก้อน
          if (flag === 1 && kind === 0) {
            if (playerId == null) {
              playerId = id; log('👤 player_id =', id.toString(16), '(จาก SPAWN flag=1)'); relayRegisterPlayer();
            } else if (playerId !== id) {
              if (playerName && name && name !== playerName) {
                log('⚠️ flag=1 แต่ชื่อ "' + name + '" ≠ "' + playerName + '" → ไม่ใช่เรา → ข้าม');
              } else {
                log('🔄 player_id เปลี่ยน:', playerId.toString(16), '→', id.toString(16));
                stalePlayerIds.set(playerId, nowMs() + 300000);
                entities.clear();
                radarPlayerIds.clear();
                monsterAggro.clear(); mobAttackers.clear();
                warpToMonsterCount.clear();
                playerId = id; relayRegisterPlayer();
                hpStatGraceUntil = nowMs() + 3000;
                hp.cur = null; hp.max = null;
              }
            }
          }
          // marker radar ระบุว่าเป็นผู้เล่นแล้ว: อย่าให้ SPAWN ที่ parse ผิดแปลงกลับเป็น monster
          if (kind === 1 && isRadarPlayerId(id, nowMs())) {
            dbg('🛡️ Entity guard: ข้าม SPAWN monster ของ radar player', id.toString(16));
            return;
          }
          let x = null, y = null, hp = null, hpMax = null;
          // x/y/hp/hpMax relative to nameEnd (kind @ nameEnd+2 → data เริ่ม nameEnd+3)
          // ★ บอทหลัก: x @ nameEnd+3, y @ nameEnd+7 (i32 signed), hp @ +12, hpMax @ +16
          if (u.length >= nameEnd + 20) {
            let rx = u32(u, nameEnd + 3); rx = rx > 0x7fffffff ? rx - 0x100000000 : rx;
            let ry = u32(u, nameEnd + 7); ry = ry > 0x7fffffff ? ry - 0x100000000 : ry;
            // ★ VALID_COORD: พิกัดต้องอยู่ในช่วงแผนที่ [-500, 1000] — ถ้าไม่ใช่ = nameEnd ผิด → ไม่รับ
            if (rx >= -500 && rx <= 1000 && ry >= -500 && ry <= 1000) { x = rx; y = ry; }
            const v3 = u32(u, nameEnd + 12);
            const v4 = u32(u, nameEnd + 16);
            if (v3 > 0 && v3 <= v4) { hp = v3; hpMax = v4; }
          }
          const existing = entities.get(id) || {};
          entities.set(id, {
            id, kind, sub, name,
            x: x != null ? x : (existing.x != null ? existing.x : null),
            y: y != null ? y : (existing.y != null ? existing.y : null),
            hp: hp != null ? hp : existing.hp,
            hpMax: hpMax != null ? hpMax : existing.hpMax,
            alive: true, _lastSeenAt: nowMs(), _provisional: false,
            _lastEngagedByOtherAt: existing._lastEngagedByOtherAt || 0,
            _lastDamageAt: existing._lastDamageAt || 0,
          });
          // ★ (C) SPAWN อัปเดต player.x/y ด้วย (mirror world.js:1289-1292) — กัน stale หลังวาร์ป
          if (id === playerId && x != null) setPlayerPosition(x, y);
          // ★ เก็บ playerName — ใช้เป็น guard กัน false ID change (mirror world.js:1235)
          if (id === playerId && name && !playerName) { playerName = name; log('👤 player_name =', name); }
          // ➕ แทรกตรงนี้ ดักจับตอนผู้เล่นคนอื่นถูก Spawn ขึ้นมาในหน้าจอครั้งแรก
          if (kind === 0 && id !== playerId) {
             const newE = entities.get(id);
             if (newE) instantFleeCheck(newE);
          }
        }
      } catch (e) { /* SPAWN parse error ข้าม */ }
    }
    // 0x07 MOVE_UPDATE: อัปเดตตำแหน่ง entity — merge แล้วใน handler 0x07 ด้านบน (player + entity)
    // 0x3c ENTITY_LIST: batch ตำแหน่ง [3c][count:2][eid:4][x:2][y:2][flag:1]...
    else if (op === 0x3c && u.length >= 3) {
      const count = u16(u, 1);
      const now = nowMs();
      let p = 3;
      for (let i = 0; i < count && p + 9 <= u.length; i++) {
        const id = u32(u, p);
        const x = i16(u, p + 4), y = i16(u, p + 6);
        // sanity check พิกัด (กัน garbage)
        if (x >= -500 && x <= 1000 && y >= -500 && y <= 1000) {
          updateKnownEntityPosition(id, x, y, now);
        }
        p += 9;
      }
    }
    // 0x14 ENTITY_POS: [14][id:4][x:2][y:2][flag:1]
    else if (op === 0x14 && u.length >= 9) {
      const id = u32(u, 1);
      const x = i16(u, 5), y = i16(u, 7);
      if (x >= -500 && x <= 1000 && y >= -500 && y <= 1000) {   // sanity
        updateKnownEntityPosition(id, x, y, nowMs());
      }
    }
    // 0x0b ATTACK_RESULT IN: [0b][attacker:4][target:4]...[damage:4 @17 ถ้ามี]
    //   + 0x26 variant: [26][attacker:4][damage:4] (มอนตี player)
    //   ★ บอทหลักรับแค่ 8 bytes (attacker+target) damage เป็น optional — กันเคส packet สั้น
    else if ((op === 0x0b || op === 0x26) && playerId != null) {
      let attacker, victimId, damage;
      if (op === 0x26 && u.length >= 9) { attacker = u32(u, 1); victimId = 0; damage = u32(u, 5); }
      else if (op === 0x0b && u.length >= 9) {   // ★ ลดจาก 21 → 9 (รับ packet สั้น)
        attacker = u32(u, 1); victimId = u32(u, 5);
        damage = u.length >= 21 ? u32(u, 17) : 0;   // damage optional (offset 17 ถ้ามี)
      }
      else return;
      const now = nowMs();
      // ★ DEBUG: ถ้ากำลังตี target อยู่ → log packet จริงเพื่อหาสาเหตุ reset ไม่ทำงาน
      if (target) {
        const isOur = (attacker === playerId);
        const isTgt = (victimId === target.id);
        if (!isOur && !isTgt && victimId !== playerId && victimId !== 0) {
          // packet ไม่ match ทั้ง playerId ทั้ง target.id → น่าสงสัย
          dbg('⚔️ ATTACK_RESULT ไม่ match:', 'attacker=' + attacker.toString(16), 'victim=' + victimId.toString(16), 'target=' + target.id.toString(16), 'playerId=' + playerId.toString(16), 'len=' + u.length, 'dmg=' + damage);
        }
      }
      // เราตีมอน → ลด HP มอน + reset pending + mark combat
      //   ★ reset pending เฉพาะ damage > 0 (miss ไม่ reset — กันค้างตีมอนที่ตีไม่ได้)
      //   ★ reset pending ถ้า victimId = target ปัจจุบัน (แม้ attacker ไม่ตรง playerId — กัน playerId ผิด)
      //   ★ ถ้าไม่มี entity ใน map → สร้างเลย (กัน _lastDamageAt ไม่ถูก stamp)
      const isOurAttack = (attacker === playerId && victimId !== playerId && victimId !== 0);
      // fallback กรณี playerId จับไม่ตรง: ยอมรับเฉพาะผลที่ตามหลัง ATTACK ที่เราส่งมาไม่นาน
      const isTargetHit = (target && victimId === target.id && victimId !== 0 && victimId !== playerId
        && lastAttackSentTarget === victimId && (now - lastAttackSentAt) < 2000);
      if (isOurAttack || isTargetHit) {
        let m = entities.get(victimId);
        if (!m) { m = { id: victimId, kind: 1, alive: true }; entities.set(victimId, m); }   // สร้างถ้าไม่มี
        m._lastDamageAt = now;
        if (target && target.id === victimId) target.lastAttackSignalAt = now; // hit หรือ miss ก็ยืนยันว่า server รับคำสั่ง
        if (damage > 0 && m.hp != null && m.hpMax != null) m.hp = Math.max(0, m.hp - damage);
        // hit หรือ miss คือ server ตอบรับ Attack-follow แล้ว
        if (damage > 0 && target && target.id === victimId) { target.lastAttackResultAt = now; stuckAbandonCount = 0; stuckAbandonHistory = []; }
        markCombat();
        // ★ DPS/ASPD tracking — นับทุกครั้งที่เราตี (isOurAttack หรือ target โดน)
        //   isOurAttack = server ส่ง 0x0b บอกว่าเราตี, isTargetHit = target ของเราโดน damage
        //   (server บางตัวส่ง 0x17 แทน 0x0b → isOurAttack ไม่เป็น true → ใช้ isTargetHit ด้วย)
        if (isOurAttack || isTargetHit) {
          const t = nowMs();
          stats.attackWindow.push({ t });
          stats.sessionAttacks++;
          if (damage > 0) {
            stats.dealtWindow.push({ t, damage });
            stats.sessionDamageDealt += damage;
          }
          // ★ claim: เราตีมอนตัวนี้ → ยึดสิทธิ์ (mirror world.js:825-836)
          if (!m._claimedByMe && !m._lastEngagedByOtherAt) {
            m._claimedByMe = true; m._claimedAt = t;
          } else if (m._claimedByMe) {
            // renew claim
          }
          m._lastEngagedByMeAt = t;
        }
      }
      // มอนตีเรา → mark mobAttacker
      else if (victimId === playerId || (victimId === 0 && attacker !== playerId)) {
        const wasAlreadyAttacking = mobAttackers.has(attacker);
        mobAttackers.set(attacker, now);
        markCombat();
        if (CFG.verbose && !wasAlreadyAttacking) log('🐺 มอนตีเรา:', attacker.toString(16), '→ รุม', getMobAttackerCount(), 'ตัว');
      }
      // คนอื่นตีมอน → mark engaged (KS avoidance)
      else if (attacker !== playerId && victimId !== playerId && victimId !== 0) {
        const m = entities.get(victimId);
        if (m && m.kind === 1) m._lastEngagedByOtherAt = now;
      }
    }
    // 0x17 DAMAGE_V2: [17][victimId:4][damage:4][x:2][y:2][flag:1] (14 bytes)
    //   ★ server ส่ง damage ของมอนที่เราตีผ่าน packet นี้ (ไม่ใช่ 0x0b!)
    //   ★★ อ่านเฉพาะ damage + victimId เท่านั้น — ไม่อัปเดต x/y (กัน bug ตำแหน่งมอนเสีย)
    //   heuristic: victim เป็นมอน = เราตี (mirror world.js:889-946)
    else if (op === 0x17 && u.length >= 9 && playerId != null) {
      const victimId = u32(u, 1);
      const damage = u32(u, 5);
      // victim = player → ข้าม (โดนตี จัดการใน 0x0b แล้ว)
      if (victimId !== playerId && victimId !== 0) {
        const now = nowMs();
        let m = entities.get(victimId);
        if (!m) { m = { id: victimId, kind: 1, alive: true }; entities.set(victimId, m); }
        m._lastDamageAt = now;
        // ★★ ลด HP มอนตาม damage (server นี้ส่ง damage ผ่าน 0x17 เท่านั้น — ไม่มี 0x0b)
        //   ต่างจากบอทหลักที่ไม่ลดใน 0x17 เพราะกัน double-count กับ 0x0b
        //   แต่ server rayrag ส่งแค่ 0x17 → ต้องลดที่นี่
        if (damage > 0 && m.hp != null && m.hpMax != null) {
          m.hp = Math.max(0, m.hp - damage);
        }
        // เป้าปัจจุบันมี damage packet แล้ว = combat ยังดำเนินอยู่
        // ห้ามผูกกับเวลา ATTACK packet 2 วินาที เพราะเกมอาจเดินตามเป้านานกว่านั้น
        // ก่อนเริ่ม auto-attack จึงเคยทำให้ abandon ทั้งที่กำลังตีจริงอยู่
        if (target && target.id === victimId) {
          target.lastAttackSignalAt = now;
        }
        // ★★ heuristic: เราเป็นคนตีหรือคนอื่น?
        //   0x17 ไม่มี attacker field → ใช้ "เราส่ง ATTACK ใส่มอนตัวนี้ภายใน 2 วินาทีไหม?" เป็นตัววัด
        //   ถ้าใช่ = เราตี (DPS/claim/reset pending)
        //   ถ้าไม่ใช่ = คนอื่นตี → stamp _lastEngagedByOtherAt (anti-KS)
        const weAttackedThis = (lastAttackSentTarget === victimId && (now - lastAttackSentAt) < 2000);
        if (weAttackedThis) {
          // ★ เราตี — DPS/ASPD tracking + claim
          stats.attackWindow.push({ t: now });
          stats.sessionAttacks++;
          if (damage > 0) {
            stats.dealtWindow.push({ t: now, damage });
            stats.sessionDamageDealt += damage;
            if (target && target.id === victimId) {
              target.lastAttackResultAt = now;
              stuckAbandonCount = 0; stuckAbandonHistory = [];
            }
          }
          // ★ claim: ถ้าเราตีมอนตัวนี้ก่อนคนอื่น → claim (mirror world.js:825-836)
          if (!m._claimedByMe && !m._lastEngagedByOtherAt) {
            m._claimedByMe = true; m._claimedAt = now;
          } else if (m._claimedByMe) {
            // มี claim อยู่แล้ว → renew
          } else if (m._lastEngagedByOtherAt && (now - m._lastEngagedByOtherAt > CFG.antiKSCooldownMs)) {
            // anti-KS cooldown หมดแล้ว → claim ใหม่ได้
            m._claimedByMe = true; m._claimedAt = now;
          }
          m._lastEngagedByMeAt = now;
        } else {
          // ★ คนอื่นตีมอนตัวนี้ → stamp anti-KS (mirror world.js:864-872)
          m._lastEngagedByOtherAt = now;
          if (!m._claimedByMe) m._claimedByMe = false;   // คนอื่นตีก่อน → เราไม่ claim
        }
        markCombat();
      }
    }
    // 0x18 MONSTER_SKILL: [18][srcId:4][dstId:4][skillId:2]... → aggro tracking
    //   ★ mirror world.js:988-1004 — aggro tracking (dstId=player)
    //   ★★ ไม่อัปเดต x/y (offset ไม่แน่นอน → เคยทำให้ตำแหน่งมอนเสีย → dist กระโดด)
    //      ตำแหน่งมอนอัปเดตจาก 0x07 MOVE / 0x06 SPAWN / 0x14 ENTITY_POS เท่านั้น
    else if (op === 0x18 && u.length >= 11 && playerId != null) {
      const srcId = u32(u, 1), dstId = u32(u, 5);
      if (dstId === playerId) { monsterAggro.set(srcId, nowMs()); markCombat(); }
    }
    // 0x1d SKILL (IN): success event ของ Steal มี target ที่ offset 10 และ skillId ที่ offset 14
    //   ★ ไม่อัปเดต x/y (offset ไม่แน่นอน — เหมือน 0x18)
    else if (op === 0x1d && u.length >= 10 && playerId != null) {
      const skillTargetType = u[1]; // SkillTarget: Self = 5 (ยืนยันจาก RebuildSharedData/Enum/SkillType.cs)
      const srcId = u32(u, 2), dstId = u32(u, 6);
      // self-cast format จาก server: [1d][target=5][sourceId:4][skillId][level]...
      if (target && srcId === target.id && isHiddenWaitTarget(entities.get(srcId) || target)) {
        const selfCast = skillTargetType === 5;
        const skillId = selfCast && u.length >= 8 ? u[6] : (u.length >= 16 ? u[14] : null);
        if (selfCast && skillId === CLOAKING_SKILL_ID) {
          const cloakingAt = nowMs();
          target.cloakingCastAt = cloakingAt;
          target.cloakingRemovedAt = 0;
          const cloakingTarget = entities.get(srcId) || target;
          log('🫥', (cloakingTarget.name || target.name || srcId.toString(16)), 'ใช้ Cloaking → เข้าโหมดรอเลิก Cloaking');
          // 0x1b ไม่ได้มาทุกรอบ จึงใช้ self-cast Cloaking ที่ยืนยันแล้วเป็นจุดเริ่ม HIDDEN_WAIT
          beginHiddenWait(cloakingTarget, 'Cloaking', cloakingAt);
        }
      }
      if (u.length >= 16) {
        const skillTargetId = u32(u, 10);
        const skillId = u[14];
        if (skillId === 61 && srcId === playerId && target && skillTargetId === target.id) {
          confirmStealSuccessBySkill();
        }
      }
      if (srcId !== playerId && dstId !== playerId && dstId !== 0) {
        const m = entities.get(dstId);
        if (m && m.kind === 1) m._lastEngagedByOtherAt = nowMs();
      }
    }
    // 0x0f ENTITY_ACTION: action=3 = มอนตายจริง (authoritative)
    //   ★ นับ kills ที่นี่ ไม่ใช่ใน 0x22 EXP (mirror world.js:964 — sessionKills++ ที่นี่)
    else if (op === 0x0f && u.length >= 6 && u[5] === 3) {
      const id = u32(u, 1);
      const e = entities.get(id);
      if (e) {
        e.alive = false;
        // ★ ถ้าเป็น boss/mini boss ที่ตาย → ล้าง bossAlertedIds เพื่อ alert ใหม่ตอนเกิดใหม่
        if (e._isMiniBoss || e._isBoss) { bossAlertedIds.delete(id); log((e._isBoss ? '👑 Boss' : '👹 Mini Boss') + ' ตาย — จะ alert ใหม่เมื่อเกิดใหม่'); }
      }
      entities.delete(id);
      radarPlayerIds.delete(id);
      warpToMonsterCount.delete(id); // มอนตายแล้ว ID นี้อาจถูกนำไป spawn ตัวใหม่ได้
      // ★ นับ kill — ถ้าเป็นมอน (kind=1) และเรามี target หรือ mobAttacker ตัวนี้
      if (e && e.kind === 1) {
        stats.kills++;
      }
      if (target && target.id === id) {
        abandonTarget('ฆ่าได้', false); target = null;
        // ล็อกคำสั่ง combat ชั่วคราว รอ packet drop ของ kill นี้ก่อน
        beginLootSettlement(nowMs());
        // ★ trigger post-combat cooldown (รอก่อน acquire ใหม่ — ถ้ามีของ loot-blocking จะเก็บก่อน)
        combatCooldownUntil = nowMs() + CFG.postCombatDelayMs;
      }
    }
    // 0x1b DESPAWN: เป็น soft signal เท่านั้น — server อาจส่งระหว่างเป้ายังอยู่ใน AOI/combat
    // 0x0f action=3 คือหลักฐานตายจริงเพียงตัวเดียวสำหรับ target ปัจจุบัน
    else if (op === 0x1b && u.length >= 5) {
      const id = u32(u, 1);
      const e = entities.get(id);
      if (e) {
        const now = nowMs();
        e._despawnPendingAt = now;
        // เป้าปัจจุบันเข้าสู่ state รอตรวจสอบ: อย่าตัดทันที แต่ก็ห้ามปล่อย ghost ค้าง
        if (target && target.id === id) {
          if (beginHiddenWait(e, '0x1b', now)) return;
          target.despawnCheckAt ||= now;
          if (CFG.verbose) log('👁️ 0x1b ของ target → ตรวจสอบก่อน abandon (3s)');
          return;
        }
        // entity อื่นที่ไม่ใช่เป้า: รอให้เงียบจริงก่อนค่อยล้าง กัน ghost ในรายการหาเป้า
        const token = (e._despawnToken || 0) + 1;
        e._despawnToken = token;
        setTimeout(() => {
          const current = entities.get(id);
          if (!current || current._despawnToken !== token) return;
          const lastActivity = Math.max(
            current._lastSeenAt || 0,
            current._lastDamageAt || 0,
            monsterAggro.get(id) || 0,
            mobAttackers.get(id) || 0
          );
          if (lastActivity > now) {
            current._despawnToken = 0;
            return;
          }
          entities.delete(id);
          radarPlayerIds.delete(id);
          warpToMonsterCount.delete(id);
          monsterAggro.delete(id);
          mobAttackers.delete(id);
        }, 10000);
      }
    }
  }
  function handleOutboundProtocol(u) {
    // 0x40 TELEPORT: ดักทั้งคำสั่งจากบอทและการวาร์ปที่ผู้เล่นกดเอง เพื่อปลด
    // FPS cap ก่อน Unity เริ่มโหลด scene ถัดไป. coordinator ด้านบนอาจเรียกซ้ำ
    // ได้อย่างปลอดภัย เพราะเป็นเพียงการรีเซ็ต timeout ของการปลด cap เดิม.
    if (u[0] === 0x40 && u.length >= 3) {
      const mapLen = u16(u, 1);
      if (mapLen > 0 && u.length >= 3 + mapLen) {
        const destinationMap = new TextDecoder().decode(u.slice(3, 3 + mapLen));
        if (destinationMap && destinationMap !== currentMap) suspendFpsCapForMapLoad();
      }
    }
    if (u[0] === 0x0b) markCombat();
    // หน้าเลือกตัวละครของ Unity ส่ง 0x03 เองหลังรับปุ่ม Enter
    // → ยกเลิกแผนส่ง packet ของเรา เพื่อไม่ให้ SELECT_CHAR ซ้อนกัน
    if (u[0] === 0x03 && (autoLoginPhase === 'acctOk' || autoLoginPhase === 'charSelectNudging')) {
      autoLoginPhase = 'clientSelect';
      log('🤖 Auto-Login: client ส่งเลือกตัวละครแล้ว → รอเข้าเกม');
    }
    // ★ ดัก click-move (0x07) ของผู้เล่น → บันทึก trail (ถ้า navRecording=on)
    //   บอทสั่งเอง (sendMove) จะตั้ง navBotMoving=true ก่อน → ข้ามไม่บันทึก
    if (u[0] === 0x07 && u.length >= 5) {
      if (!navBotMoving && CFG.navRecording) {
        navRecordMove(i16(u, 1), i16(u, 3));
      }
      navBotMoving = false;   // reset flag (บอทสั่งครั้งเดียว)
    }
  }

  // ============================================================
  //  GAME PACKET RUNTIME — ingress เดียวสำหรับ packet เกม
  //  observation/capture แยกจาก protocol implementation เพื่อเพิ่ม handler ได้โดยไม่แตะ WebSocket hook
  // ============================================================
  const gamePacketRuntime = (() => {
    const inboundObservers = [captureWeaponInbound, captureInventoryInbound, captureStorageInbound, captureOreRefineInbound, captureStatInbound];
    const outboundObservers = [captureWeaponPacket, captureOreRefineOutbound];
    const observe = (observers, packet) => observers.forEach(observer => observer(packet));
    return {
      receiveInbound(packet) {
        if (!packet || !packet.length) return;
        lastGamePacketAt = Date.now();
        observe(inboundObservers, packet);
        return handleInboundProtocol(packet);
      },
      receiveOutbound(packet) {
        if (!packet || !packet.length) return;
        observe(outboundObservers, packet);
        return handleOutboundProtocol(packet);
      },
    };
  })();
  function handleIn(u) { return gamePacketRuntime.receiveInbound(u); }
  function handleOut(u) { return gamePacketRuntime.receiveOutbound(u); }

  // ---------- STAT (0x25) capture — observation only, before changing the HP router ----------
  // เซิร์ฟเวอร์อาจเปลี่ยน layout/ความหมายของ statType ได้ จึงเก็บ raw live packet ก่อน
  // ห้ามใช้ capture นี้ตัดสิน HP ใน runtime; ผู้ใช้เปิดเองเฉพาะช่วงตรวจสอบเท่านั้น.
  let statCaptureUntil = 0;
  const statCaptureEvents = [];
  const STAT_CAPTURE_MAX_EVENTS = 40;
  function stopStatCapture(reason) {
    if (!statCaptureUntil) return;
    statCaptureUntil = 0;
    console.log('[ASSIST][STATCAP] STOP' + (reason ? ' — ' + reason : ''), statCaptureEvents.map(({ rawHex, ...event }) => event));
  }
  function captureStatInbound(u) {
    if (!statCaptureUntil) return;
    const now = nowMs();
    if (now >= statCaptureUntil) { stopStatCapture('หมดเวลา'); return; }
    if (u[0] !== 0x25) return;
    const event = {
      atMs: now,
      bytes: u.length,
      entityId: u.length >= 5 ? u32(u, 1).toString(16) : null,
      statType: u.length >= 9 ? u32(u, 5) : null,
      curAt9: u.length >= 13 ? u32(u, 9) : null,
      maxAt13: u.length >= 17 ? u32(u, 13) : null,
      flagAt17: u.length >= 18 ? u[17] : null,
      isSelf: u.length >= 5 && u32(u, 1) === playerId,
      rawHex: packetHex(u),
    };
    statCaptureEvents.push(event);
    while (statCaptureEvents.length > STAT_CAPTURE_MAX_EVENTS) statCaptureEvents.shift();
    console.log('[ASSIST][STATCAP]', { ...event, rawHex: undefined });
  }
  function startStatCapture(seconds = 15) {
    const sec = Math.max(3, Math.min(60, Number(seconds) || 15));
    statCaptureEvents.length = 0;
    statCaptureUntil = nowMs() + sec * 1000;
    console.log('[ASSIST][STATCAP] START — รอ packet 0x25 ' + sec + 's; ยืนเฉย ๆ แล้วรับดาเมจ/ฮีล 1 ครั้งถ้าทำได้');
    setTimeout(() => {
      if (statCaptureUntil && nowMs() >= statCaptureUntil) stopStatCapture('หมดเวลา');
    }, sec * 1000 + 50);
  }
  function getStatCaptureDump() {
    return JSON.stringify(statCaptureEvents, null, 2);
  }

  // ---------- WEAPON packet capture (temporary investigation tool) ----------
  // Server source says equip/unequip is [op][bagId:4 LE][isEquip:1].
  // The deployed web protocol may use different opcodes, so capture the live packet
  // from a manual equipment click before implementing auto weapon sets.
  let weaponCaptureUntil = 0;
  let weaponCaptureStartedAt = 0;
  let weaponCaptureCandidate = null;
  const weaponCaptureEvents = [];
  const WEAPON_CAPTURE_MAX_EVENTS = 20;
  function packetHex(u) {
    return Array.from(u, b => b.toString(16).padStart(2, '0')).join(' ');
  }
  function stopWeaponCapture(reason) {
    if (!weaponCaptureUntil) return;
    weaponCaptureUntil = 0;
    console.log('[ASSIST][WPNCAP] STOP' + (reason ? ' — ' + reason : ''), weaponCaptureEvents.slice());
  }
  function captureWeaponPacket(u) {
    if (!weaponCaptureUntil) return;
    const now = nowMs();
    if (now >= weaponCaptureUntil) {
      stopWeaponCapture('หมดเวลา');
      return;
    }
    // Candidate format is intentionally structural, not opcode-based: live server version
    // may not match the cloned server's PacketType enum.
    if (u.length !== 6 || (u[5] !== 0 && u[5] !== 1)) return;
    const event = {
      afterMs: now - weaponCaptureStartedAt,
      op: '0x' + u[0].toString(16).padStart(2, '0'),
      len: u.length,
      bagId: u32(u, 1),
      action: u[5] ? 'equip' : 'unequip',
      hex: packetHex(u),
    };
    weaponCaptureEvents.push(event);
    while (weaponCaptureEvents.length > WEAPON_CAPTURE_MAX_EVENTS) weaponCaptureEvents.shift();
    console.log('[ASSIST][WPNCAP] CANDIDATE', event);
    weaponCaptureCandidate = event;
    // รอ packet ขาเข้ายืนยันอีกสั้น ๆ เพื่อหา slot มือขวา/ซ้ายจากเกมจริง
    weaponCaptureUntil = now + 2000;
    console.log('[ASSIST][WPNCAP] รอ IN confirm ของ bagId=' + event.bagId + ' อีก 2s');
  }
  function captureWeaponInbound(u) {
    if (!weaponCaptureUntil || !weaponCaptureCandidate) return;
    const now = nowMs();
    if (now >= weaponCaptureUntil) {
      stopWeaponCapture('หมดเวลารอ IN confirm');
      return;
    }
    // Server source response: [op][bagId:4 LE][slot:1][isEquip:1].
    // Match by bagId, not opcode, because the deployed protocol revision differs.
    if (u.length < 7 || u32(u, 1) !== weaponCaptureCandidate.bagId) return;
    const event = {
      direction: 'IN',
      afterMs: now - weaponCaptureStartedAt,
      op: '0x' + u[0].toString(16).padStart(2, '0'),
      len: u.length,
      bagId: u32(u, 1),
      slot: u[5],
      action: u[6] ? 'equip' : 'unequip',
      hex: packetHex(u),
    };
    weaponCaptureEvents.push(event);
    console.log('[ASSIST][WPNCAP] IN CONFIRM', event);
    stopWeaponCapture('ได้ OUT + IN confirm แล้ว');
  }

  // ---------- INVENTORY packet capture (temporary investigation tool) ----------
  // Inventory เต็มก้อนถูกส่งตอนเข้าเกม แต่ opcode/format ของ live server อาจต่างจาก repo
  // จึงจับเฉพาะ packet ขาเข้าขนาดใหญ่ช่วงสั้น ๆ เพื่อเขียน parser จากข้อมูลจริง
  const INVENTORY_CAPTURE_STORAGE_KEY = '__assist_weapon_inventory_capture_until';
  const INVENTORY_CAPTURE_MAX_EVENTS = 12;
  const INVENTORY_CAPTURE_MAX_BYTES = 4096;
  let inventoryCaptureUntil = (() => {
    try { return Number(sessionStorage.getItem(INVENTORY_CAPTURE_STORAGE_KEY)) || 0; } catch (e) { return 0; }
  })();
  let inventoryCaptureStartedAt = inventoryCaptureUntil > nowMs() ? nowMs() : 0;
  const inventoryCaptureEvents = [];
  const inventoryCaptureSeen = new Set();

  function setInventoryCaptureUntil(until) {
    inventoryCaptureUntil = until;
    try {
      if (until > nowMs()) sessionStorage.setItem(INVENTORY_CAPTURE_STORAGE_KEY, String(until));
      else sessionStorage.removeItem(INVENTORY_CAPTURE_STORAGE_KEY);
    } catch (e) {}
  }
  function stopInventoryCapture(reason) {
    if (!inventoryCaptureUntil) return;
    setInventoryCaptureUntil(0);
    console.log('[ASSIST][INVCAP] STOP' + (reason ? ' — ' + reason : ''), inventoryCaptureEvents.map(({ rawHex, ...event }) => event));
  }
  function captureInventoryInbound(u) {
    if (!inventoryCaptureUntil) return;
    const now = nowMs();
    if (now >= inventoryCaptureUntil) {
      stopInventoryCapture('หมดเวลา');
      return;
    }
    // packet สั้นเป็น movement/stat ปกติ ไม่ใช่ inventory snapshot
    if (u.length < 80) return;
    const key = u[0] + ':' + u.length;
    if (inventoryCaptureSeen.has(key)) return;
    inventoryCaptureSeen.add(key);
    const byteCount = Math.min(u.length, INVENTORY_CAPTURE_MAX_BYTES);
    const event = {
      afterMs: now - inventoryCaptureStartedAt,
      op: '0x' + u[0].toString(16).padStart(2, '0'),
      len: u.length,
      previewHex: packetHex(u.slice(0, Math.min(u.length, 48))),
      rawHex: packetHex(u.slice(0, byteCount)),
      truncated: u.length > byteCount,
    };
    inventoryCaptureEvents.push(event);
    while (inventoryCaptureEvents.length > INVENTORY_CAPTURE_MAX_EVENTS) inventoryCaptureEvents.shift();
    console.log('[ASSIST][INVCAP] CANDIDATE', { ...event, rawHex: undefined });
    console.log('[ASSIST][INVCAP] ใช้ ASSIST.weaponInventoryCaptureResult() เพื่อคัดลอก raw packet สำหรับวิเคราะห์');
  }
  function startInventoryCapture(seconds = 30) {
    const sec = Math.max(10, Math.min(90, Number(seconds) || 30));
    inventoryCaptureEvents.length = 0;
    inventoryCaptureSeen.clear();
    inventoryCaptureStartedAt = nowMs();
    setInventoryCaptureUntil(inventoryCaptureStartedAt + sec * 1000);
    console.log('[ASSIST][INVCAP] START — รีโหลดหน้าเกมภายใน ' + sec + 's แล้วรอจนเข้าเกมครบ');
  }
  function getInventoryCaptureResult() {
    const result = inventoryCaptureEvents.map(event => ({ ...event }));
    console.log('[ASSIST][INVCAP] RESULT', result);
    return result;
  }
  function getInventoryCaptureDump() {
    return JSON.stringify(inventoryCaptureEvents, null, 2);
  }

  // ---------- STORAGE open capture (temporary investigation tool) ----------
  // Withdrawal requires the storage-side bagId.  The deployed protocol revision
  // differs from the cloned server, so capture only plausible Storage packets
  // while the user manually opens Kafra Storage.
  let storageCaptureUntil = 0;
  let storageCaptureStartedAt = 0;
  let storageCaptureToken = 0;
  const storageCaptureEvents = [];
  const STORAGE_CAPTURE_MAX_BYTES = 12288;
  function stopStorageCapture(reason) {
    if (!storageCaptureUntil) return;
    storageCaptureUntil = 0;
    console.log('[DEBUG-STORCAP] STOP' + (reason ? ' — ' + reason : ''), storageCaptureEvents.map(({ rawHex, ...event }) => event));
  }
  function isStorageCaptureCandidate(u) {
    const op = u[0];
    // 0x54–0x5f is the live NPC/inventory family around the known outgoing
    // Storage command 0x56.  Exclude 0x4d: it is only Kafra dialogue text.
    // The large-packet fallback catches a revision shift without accepting dialogue.
    return (u.length >= 8 && op >= 0x54 && op <= 0x5f) || (u.length >= 120 && op !== 0x38 && op !== 0x4d);
  }
  function captureStorageInbound(u) {
    if (!storageCaptureUntil) return;
    const now = nowMs();
    if (now >= storageCaptureUntil) { stopStorageCapture('หมดเวลา'); return; }
    if (!isStorageCaptureCandidate(u)) return;
    const byteCount = Math.min(u.length, STORAGE_CAPTURE_MAX_BYTES);
    const event = {
      afterMs: now - storageCaptureStartedAt,
      op: '0x' + u[0].toString(16).padStart(2, '0'),
      len: u.length,
      previewHex: packetHex(u.slice(0, Math.min(u.length, 48))),
      rawHex: packetHex(u.slice(0, byteCount)),
      truncated: u.length > byteCount,
    };
    storageCaptureEvents.push(event);
    console.log('[DEBUG-STORCAP] CANDIDATE', { ...event, rawHex: undefined });
    // Only the known storage opcode family closes the short window.  A large
    // fallback packet must not stop the capture before the user reaches the menu.
    if (storageCaptureEvents.length === 1 && u[0] >= 0x54 && u[0] <= 0x5f) {
      storageCaptureUntil = now + 2000;
      const token = storageCaptureToken;
      setTimeout(() => {
        if (token === storageCaptureToken && storageCaptureUntil && nowMs() >= storageCaptureUntil) stopStorageCapture('จบช่วง packet Storage');
      }, 2050);
    }
  }
  function startStorageCapture(seconds = 30) {
    const sec = Math.max(10, Math.min(90, Number(seconds) || 30));
    storageCaptureEvents.length = 0;
    storageCaptureStartedAt = nowMs();
    storageCaptureUntil = storageCaptureStartedAt + sec * 1000;
    storageCaptureToken++;
    console.log('[DEBUG-STORCAP] START — เปิด Kafra Storage ด้วยมือภายใน ' + sec + 's (อย่าใช้ปุ่ม auto-storage รอบนี้)');
  }
  function getStorageCaptureDump() {
    return JSON.stringify(storageCaptureEvents, null, 2);
  }

  // ---------- ORE REFINE NPC capture (temporary investigation tool) ----------
  // ฟีเจอย่อย Great Nature ต้องรู้ choice/menu และ packet ผลของ Trade จากเซิร์ฟเวอร์จริง
  // จึงจับเฉพาะช่วงที่ผู้ใช้ทำ flow ด้วยมือ: Kafra ถอน 1 ชิ้น → Trade 1 ครั้ง → Sell 1 ครั้ง.
  // ขาออกเก็บทุก command ยกเว้น movement/attack/pickup เพื่อไม่พลาด opcode เฉพาะของ NPC
  // ขาเข้าเก็บ dialog, storage/sell family, inventory delta และข้อความระบบเท่านั้น.
  let oreRefineCaptureUntil = 0;
  let oreRefineCaptureStartedAt = 0;
  let oreRefineCaptureToken = 0;
  let oreRefineCaptureTimer = null;
  const oreRefineCaptureEvents = [];
  const ORE_REFINE_CAPTURE_MAX_EVENTS = 120;
  const ORE_REFINE_CAPTURE_MAX_BYTES = 12288;
  const ORE_REFINE_CAPTURE_LABELS = {
    0x2c: 'CHAT', 0x32: 'INVENTORY_UPDATE', 0x4c: 'NPC_TALK',
    0x4d: 'NPC_DIALOG', 0x4e: 'NPC_NEXT', 0x4f: 'NPC_SELECT',
    0x53: 'SELL_OPEN', 0x54: 'STORAGE_SNAPSHOT', 0x55: 'TRADE_OPEN',
    0x56: 'STORAGE_MOVE', 0x57: 'SELL_ITEMS', 0x58: 'TRADE_EXECUTE',
    0x5b: 'ACTION_RESULT',
  };
  function oreRefineCaptureLabel(op) {
    return ORE_REFINE_CAPTURE_LABELS[op] || 'OP';
  }
  function stopOreRefineCapture(reason) {
    if (!oreRefineCaptureUntil) return;
    oreRefineCaptureUntil = 0;
    if (oreRefineCaptureTimer) { clearTimeout(oreRefineCaptureTimer); oreRefineCaptureTimer = null; }
    console.log('[ASSIST][ORECAP] STOP' + (reason ? ' — ' + reason : ''), oreRefineCaptureEvents.map(({ rawHex, ...event }) => event));
  }
  function isOreRefineCapturePacket(direction, u) {
    const op = u[0];
    if (direction === 'OUT') {
      // normal field traffic is noise; leave all other commands so an unknown NPC opcode is preserved.
      return ![0x07, 0x0b, 0x52].includes(op);
    }
    return op === 0x2c || op === 0x32 || op === 0x4d || (op >= 0x53 && op <= 0x5f);
  }
  function captureOreRefinePacket(direction, u) {
    if (!oreRefineCaptureUntil) return;
    const now = nowMs();
    if (now >= oreRefineCaptureUntil) { stopOreRefineCapture('หมดเวลา'); return; }
    if (!isOreRefineCapturePacket(direction, u)) return;
    const byteCount = Math.min(u.length, ORE_REFINE_CAPTURE_MAX_BYTES);
    const event = {
      direction,
      afterMs: now - oreRefineCaptureStartedAt,
      op: '0x' + u[0].toString(16).padStart(2, '0'),
      label: oreRefineCaptureLabel(u[0]),
      len: u.length,
      previewHex: packetHex(u.slice(0, Math.min(u.length, 48))),
      rawHex: packetHex(u.slice(0, byteCount)),
      truncated: u.length > byteCount,
    };
    oreRefineCaptureEvents.push(event);
    while (oreRefineCaptureEvents.length > ORE_REFINE_CAPTURE_MAX_EVENTS) oreRefineCaptureEvents.shift();
    console.log('[ASSIST][ORECAP][' + direction + ']', { ...event, rawHex: undefined });
  }
  function captureOreRefineInbound(u) { captureOreRefinePacket('IN', u); }
  function captureOreRefineOutbound(u) { captureOreRefinePacket('OUT', u); }
  function startOreRefineCapture(seconds = 120) {
    const sec = Math.max(30, Math.min(300, Number(seconds) || 120));
    oreRefineCaptureEvents.length = 0;
    oreRefineCaptureStartedAt = nowMs();
    oreRefineCaptureUntil = oreRefineCaptureStartedAt + sec * 1000;
    oreRefineCaptureToken++;
    if (oreRefineCaptureTimer) clearTimeout(oreRefineCaptureTimer);
    const token = oreRefineCaptureToken;
    oreRefineCaptureTimer = setTimeout(() => {
      if (token === oreRefineCaptureToken) stopOreRefineCapture('หมดเวลา');
    }, sec * 1000 + 100);
    console.log('[ASSIST][ORECAP] START — ภายใน ' + sec + 's: ถอน Great Nature หลายชิ้น (แนะนำ 3) → Trade ให้หมดในคำสั่งเดียว → Sell ให้หมด แล้วใช้ ASSIST.oreRefineCaptureDump()');
  }
  function getOreRefineCaptureDump() {
    return JSON.stringify(oreRefineCaptureEvents, null, 2);
  }

  // ---------- WEIGHT from the full player snapshot ----------
  function liveWeightFromPlayerData(u) {
    // Verified from live 0x38 snapshot: 12 player values, then 21 stats.
    // WeightCapacity is stat #20; CurrentWeight follows AttackDelay.
    if (u[0] !== 0x38 || u.length < 145) return null;
    const maxWeightRaw = u32(u, 129);
    const currentWeightRaw = u32(u, 137);
    if (!maxWeightRaw || currentWeightRaw > maxWeightRaw * 4) return null;
    return {
      currentWeightRaw,
      maxWeightRaw,
      percent: Number((currentWeightRaw * 100 / maxWeightRaw).toFixed(2)),
    };
  }
  // 0x38 snapshot จาก live server ใช้จำนวน/ID แบบ bit-packed (value × 4).
  // โครงสร้างช่วง inventory อาจขยับตาม skill data ของ server จึงหา layout จากท้าย packet
  // และตรวจสอบทุก record แทนการ fix offset เช่น 198/562 ไว้ตายตัว.
  function findLiveInventorySnapshotLayout(u) {
    if (u[0] !== 0x38 || u.length < 240) return null;
    // Packet live มี checksum 1 byte ต่อท้าย; เผื่อ protocol เปลี่ยน ให้ลองทั้งสองแบบ.
    for (const tailBytes of [45, 44]) { // equipped 10 slots + ammo, with/without checksum
      const equipStart = u.length - tailBytes;
      if (equipStart <= 150) continue;
      const equipValues = [];
      let validEquipTail = true;
      for (let i = 0; i < 11; i++) {
        const raw = u32(u, equipStart + i * 4);
        if (raw !== 0 && (raw & 3) !== 0) { validEquipTail = false; break; }
        equipValues.push(raw >>> 2);
      }
      if (!validEquipTail) continue;

      let best = null;
      // ก่อน inventory เป็น player stat/skill data ที่ความยาวแปรผัน; inventory เริ่มหลัง byte 145 เสมอ.
      for (let countAt = 145; countAt + 8 < equipStart; countAt++) {
        const rawRegularCount = u32(u, countAt);
        if ((rawRegularCount & 3) !== 0) continue;
        const regularCount = rawRegularCount >>> 2;
        if (regularCount < 1 || regularCount > 200) continue;
        const regularAt = countAt + 4;
        const uniqueCountAt = regularAt + regularCount * 6;
        if (uniqueCountAt + 4 > equipStart) continue;
        const rawUniqueCount = u32(u, uniqueCountAt);
        if ((rawUniqueCount & 3) !== 0) continue;
        const uniqueCount = rawUniqueCount >>> 2;
        if (uniqueCount < 1 || uniqueCount > 200) continue;
        const uniqueAt = uniqueCountAt + 4;
        const uniqueEnd = uniqueAt + uniqueCount * 44;
        // หลัง unique list เหลือ flag/cart data ก่อน equipment เพียงเล็กน้อยเท่านั้น.
        if (uniqueEnd > equipStart || equipStart - uniqueEnd > 8) continue;

        let valid = true;
        for (let i = 0; i < regularCount; i++) {
          const at = regularAt + i * 6;
          const rawId = u32(u, at), rawCount = u16(u, at + 4);
          if (!rawId || (rawId & 3) || !rawCount || (rawCount & 3)) { valid = false; break; }
        }
        if (!valid) continue;
        for (let i = 0; i < uniqueCount; i++) {
          const at = uniqueAt + i * 44;
          const rawBagId = u32(u, at), rawItemId = u32(u, at + 4), rawCount = u16(u, at + 8);
          if (!rawBagId || !rawItemId || !rawCount || (rawBagId & 3) || (rawItemId & 3) || (rawCount & 3)) { valid = false; break; }
        }
        if (!valid) continue;
        const candidate = { regularCount, regularAt, uniqueCount, uniqueAt, equipValues, tailBytes };
        // เลือก candidate ที่มีรายการมากสุด เผื่อมีเลขบังเอิญเหมือน count ในส่วน skill data.
        if (!best || candidate.regularCount + candidate.uniqueCount > best.regularCount + best.uniqueCount) best = candidate;
      }
      if (best) return best;
    }
    return null;
  }
  function parseLiveInventorySnapshot(u) {
    // Full player snapshot supplies both current weight and capacity.  Subsequent
    // 0x32 inventory updates keep currentWeightRaw fresh between snapshots.
    const snapshotWeight = liveWeightFromPlayerData(u);
    if (snapshotWeight) updateInventoryWeight(snapshotWeight.currentWeightRaw, snapshotWeight.maxWeightRaw, '0x38');
    const layout = findLiveInventorySnapshotLayout(u);
    if (!layout) return false;

    const nextInventory = new Map();
    const nextEquipmentSlots = new Map();
    for (let i = 0; i < layout.regularCount; i++) {
      const at = layout.regularAt + i * 6;
      const itemId = u32(u, at) >>> 2;
      const count = u16(u, at + 4) >>> 2;
      nextInventory.set(itemId, count);
    }
    for (let i = 0; i < layout.uniqueCount; i++) {
      const at = layout.uniqueAt + i * 44;
      const bagId = u32(u, at) >>> 2;
      const itemId = u32(u, at + 4) >>> 2;
      const count = u16(u, at + 8) >>> 2;
      nextInventory.set(itemId, (nextInventory.get(itemId) || 0) + count);
      const slots = nextEquipmentSlots.get(itemId) || [];
      slots.push(bagId);
      nextEquipmentSlots.set(itemId, slots);
    }

    inventory.clear();
    for (const [itemId, count] of nextInventory) inventory.set(itemId, count);
    inventorySnapshotAt = nowMs();
    const oreResultItemId = Math.round(Number(CFG.oreRefineResultItemId) || 0);
    if (oreResultItemId > 0) observeOreRefineInventory(oreResultItemId, inventory.get(oreResultItemId) || 0, '0x38');
    heal.syncKnownInventory();
    equipmentSlots.clear();
    for (const [itemId, slots] of nextEquipmentSlots) equipmentSlots.set(itemId, slots);
    // source/live capture ยืนยัน: equipment slot 4=มือขวา, 5=มือซ้าย
    equippedBagIds.clear();
    for (let slot = 0; slot < 10; slot++) {
      const bagId = layout.equipValues[slot] || 0;
      if (bagId) equippedBagIds.set(slot, bagId);
    }
    const root = document.getElementById('__assist_root');
    if (root) renderWeaponEditor(root);
    log('🎒 อ่าน inventory ตอนเข้าเกม:', layout.regularCount, 'ของซ้อน /', layout.uniqueCount, 'อุปกรณ์');
    return true;
  }

  // ---------- loop เก็บของ ----------
  const lootLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.lootEnabled) return;
    if (lootQueue.isCollectorBusy()) return;
    if (isAbBuffActive()) return;
    // ระหว่างสนทนา AI ต้องตอบก่อน: หลังตอบอนุญาตเก็บเฉพาะ drop ที่อยู่ใกล้เท้า
    if (isAiReplyInteractionActive() && (!aiInteraction || aiInteraction.phase !== 'LOOT')) return;
    const now = Date.now();
    // ส่ง pickup ทีละคำสั่งและรอผลก่อน: การสลับหลาย drop เร็วเกินไปทำให้ server เงียบได้
    if (pickupPending) {
      const responseWaitMs = Math.max(1, Number(CFG.attemptIntervalMs) || 1);
      if (now - pickupPending.sentAt < responseWaitMs) return;
      pickupPending = null; // ไม่มีผลตอบกลับตามเวลา → เปิดให้ retry ตามรอบปกติ
    }
    for (const [id, it] of queue) {
      if (now - it.addedAt > CFG.itemMaxAgeMs) { queue.delete(id); log('⌛ หมดอายุ drop', id); }
    }
    for (const [id, d] of recentDrops) if (now - d.t > 4000) recentDrops.delete(id);

    // ทิ้งชิ้นที่ครบ maxAttempts — ถ้าเปิด warpLoot ให้ย้ายไป warpQueue แทนที่จะปล่อยทิ้ง
    for (const [id, it] of queue) {
      if (it.attempts >= CFG.maxAttempts) {
        // คำสั่งสุดท้ายอาจยังรอผลจาก server อยู่ อย่าลบทิ้งก่อนมีเวลาได้รับ 0x52
        if (now - it.lastAttemptAt < CFG.attemptIntervalMs) continue;
        queue.delete(id);
        if (CFG.warpLootEnabled && currentMap) {
          // ★ ย้ายไป warpQueue เพื่อวาร์ปไปเก็บ (น่าจะติดกำแพง/หน้าผา)
          warpQueue.set(id, { dropId: id, itemId: it.itemId, x: it.x, y: it.y, offsetIdx: 0, warpAt: 0, pickupSentAt: 0 });
          log('🌀 เก็บไม่ได้ครบ', it.attempts, 'ครั้ง → วาร์ปไปเก็บ:', nameOf(it.itemId), 'drop', id);
        } else {
          log('🚫 ปล่อย', nameOf(it.itemId), 'drop', id, '(ล้มเหลว', it.attempts, 'ครั้ง ไม่มีผลจาก server)');
        }
      }
    }

    const eligible = [];
    for (const it of queue.values()) {
      if (it.attempts >= CFG.maxAttempts) continue;
      if (now - it.lastAttemptAt < CFG.attemptIntervalMs) continue;
      if (isAiReplyInteractionActive() && !shouldAllowAiReplyPickup(it)) continue;
      // ★ รอ lootDelayAfterDropMs หลังของตก ก่อนเริ่มเก็บ (addedAt = ตอนของตกเข้าคิว)
      //   ★★ แต่ละ drop จะมี delay ต่างกันเล็กน้อย (±200ms jitter — กันดูเป็นบอท)
      if (it.delayAfterDrop == null) it.delayAfterDrop = CFG.lootDelayAfterDropMs + (Math.random() * 400 - 200);
      if (now - it.addedAt < it.delayAfterDrop) continue;
      eligible.push(it);
    }
    if (!eligible.length) return;
    // ใช้ config โดยตรง; ห้าม jitter จนค่าติดลบแล้วสแปม server
    const globalPickupInterval = Math.max(0, Number(CFG.sendThrottleMs) || 0);
    if (now - lastSendAt < globalPickupInterval) return;

    eligible.sort((a, b) => a.lastAttemptAt - b.lastAttemptAt);
    const it = eligible[0];
    if (sendPickup(it.dropId)) {
      it.lastAttemptAt = now; it.attempts++; lastSendAt = now;
      pickupPending = { dropId: it.dropId, sentAt: now };
      log('📨 ลองเก็บ', nameOf(it.itemId), 'drop', it.dropId, '(ครั้ง', it.attempts + '/' + CFG.maxAttempts + ')');
      dbg('📦 Loot send:', nameOf(it.itemId), 'drop=' + it.dropId, 'attempt=' + it.attempts + '/' + CFG.maxAttempts, 'queue=' + queue.size);
    }
  }, CFG.lootTickMs);

  // ============================================================
  //  WARP-TO-LOOT loop — วาร์ปไปเก็บของที่เก็บไม่ได้ (ติดกำแพง/หน้าผา)
  // ============================================================
  //  offset pattern: กลาง → เหนือ3 → ตอ3 → ใต้3 → ตต3 (เหมือนบอทหลัก)
  const WARP_OFFSETS = [[0,0,'กลาง'], [0,-3,'เหนือ3'], [3,0,'ตอ3'], [0,3,'ใต้3'], [-3,0,'ตต3']];
  const warpLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.warpLootEnabled) return;
    if (isAbBuffActive()) return;
    if (isAiReplyInteractionActive()) return;
    if (!currentMap) return;                          // ไม่รู้แมป → ไม่วาร์ป (กัน packet ผิด)
    const now = Date.now();

    for (const [id, wit] of warpQueue) {
      // ครบ offset ทั้งหมดแล้วยัง fail → ปล่อยทิ้ง
      if (wit.offsetIdx >= Math.min(CFG.warpLootMaxOffsets, WARP_OFFSETS.length)) {
        warpQueue.delete(id);
        log('🚫 ปล่อย', nameOf(wit.itemId), 'drop', id, '(วาร์ปครบ', wit.offsetIdx, 'offset แล้วยังไม่ได้)');
        continue;
      }

      // ถ้ายังไม่ได้วาร์ปในรอบนี้ และผ่าน cooldown แล้ว → วาร์ป
      if (wit.warpAt === 0 && now - lastWarpAt >= CFG.warpLootCooldownMs) {
        const off = WARP_OFFSETS[wit.offsetIdx] || [0, 0, '?'];
        const tx = Math.round(wit.x + off[0]);
        const ty = Math.round(wit.y + off[1]);
        if (sendTeleport(currentMap, tx, ty, 'warp-to-loot')) {
          wit.warpAt = now;
          wit.pickupSentAt = 0;
          lastWarpAt = now;
          lastWarpTargetId = id;
          log('🌀 วาร์ปไปเก็บ', nameOf(wit.itemId), '@(', tx, ty, ') offset', off[2]);
        }
        return;   // วาร์ปทีละชิ้นต่อรอบ
      }

      // หลังวาร์ปแล้วรอ warpLootPickupDelayMs → ส่ง pickup อีกครั้ง
      if (wit.warpAt !== 0 && wit.pickupSentAt === 0 && now - wit.warpAt >= CFG.warpLootPickupDelayMs) {
        if (sendPickup(id)) {
          wit.pickupSentAt = now;
          log('📨 ลองเก็บหลังวาร์ป', nameOf(wit.itemId), 'drop', id);
        }
        return;
      }

      // ถ้าส่ง pickup ไปแล้ว แต่รอนานเกินไป (server เงียบ = วาร์ปไปที่ไม่ดี) → offset ถัดไป
      if (wit.pickupSentAt !== 0 && now - wit.pickupSentAt > 3000) {
        wit.offsetIdx++;
        wit.warpAt = 0;
        wit.pickupSentAt = 0;
        log('⏭️', nameOf(wit.itemId), 'ยังไม่ได้หลังวาร์ป → offset ถัดไป');
        return;
      }
    }
  }, CFG.lootTickMs);

  // ============================================================
  //  AUTO-SELL — state machine (IDLE → WARP → MOVE → TALK → SELECT → SELL → WARP_BACK)
  // ============================================================
  // หา NPC จาก entities (kind=2 + ชื่อตรง) — mirror world.js:1948-1959
  function findSellNpc() {
    const target = (CFG.sellNpcName || '').toLowerCase();
    for (const e of entities.values()) {
      if (e.kind === 2 && e.alive && e.x != null && e.name && e.name.toLowerCase().includes(target)) return e;
    }
    return null;
  }
  function setSellState(s) { sellState = s; sellStateAt = nowMs(); }
  function abortSell(reason) {
    log('⚠️ ยกเลิกขาย:', reason);
    sellState = 'IDLE'; sellStateAt = 0;
    // พยายามวาร์ปกลับถ้ามี returnTo
    if (sellReturnTo && sellReturnTo.map) { sendTeleport(sellReturnTo.map, sellReturnTo.x, sellReturnTo.y, 'sell-abort-return'); }
    sellReturnTo = null;
  }
  // สร้าง trigger check + state machine ใน loop เดียว
  const sellLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.sellEnabled) return;
    if (isAbBuffActive()) return;
    if (isOreRefineActive()) return;
    if (!activeWS || activeWS.readyState !== 1) return;
    if (isDead) return;
    // ★ กัน race: ถ้า storage กำลังทำอยู่ → รอก่อน
    if (storageState !== 'IDLE') return;
    const now = nowMs();

    // === trigger (เฉพาะ IDLE) ===
    if (sellState === 'IDLE') {
      let shouldSell = false; let reason = '';
      // trigger 1: ของเต็ม
      if (CFG.sellOnFull && inventoryFull && CFG.sellItemIds.length > 0) { shouldSell = true; reason = 'ของเต็ม'; }
      // trigger 2: ครบเวลา
      if (CFG.sellIntervalMin > 0 && CFG.sellItemIds.length > 0 && lastSellAt > 0 && (now - lastSellAt >= CFG.sellIntervalMin * 60000)) {
        shouldSell = true; reason = 'ครบ ' + CFG.sellIntervalMin + ' นาที';
      }
      if (shouldSell && currentMap && player.x != null) {
        sellReturnTo = { map: currentMap, x: Math.round(player.x), y: Math.round(player.y) };
        log('💰 เริ่มขายของ (' + reason + ') → วาร์ปไป', CFG.sellNpcMap, '@(', CFG.sellNpcX, CFG.sellNpcY + ')');
        if (sendTeleport(CFG.sellNpcMap, CFG.sellNpcX, CFG.sellNpcY, 'sell-to-npc')) {
          setSellState('WARP_TO_NPC');
        }
      }
      return;
    }

    // === watchdog: stuck >60s → abort ===
    if (now - sellStateAt > 60000) { abortSell('timeout (' + sellState + ' 60s)'); return; }

    // === state machine ===
    if (sellState === 'WARP_TO_NPC') {
      // รอ 3s หลังวาร์ป ให้ entities โหลด → หา NPC
      if (now - sellStateAt > 3000) {
        const npc = findSellNpc();
        if (npc) { sellNpcId = npc.id; setSellState('MOVE_TO_NPC'); log('💰 พบ', npc.name, '@(', npc.x, npc.y + ')'); }
        else { setSellState('MOVE_TO_NPC'); log('⚠️ ไม่พบ NPC', CFG.sellNpcName, '→ ลองเดินหา'); }
      }
      return;
    }
    if (sellState === 'MOVE_TO_NPC') {
      const npc = sellNpcId ? entities.get(sellNpcId) : null;
      if (!npc || !npc.alive || npc.x == null) {
        // NPC หาย → ลองหาใหม่
        const found = findSellNpc();
        if (found) { sellNpcId = found.id; }
        else { abortSell('ไม่พบ NPC ' + CFG.sellNpcName); return; }
      }
      if (player.x != null) {
        const d = Math.hypot(npc.x - player.x, npc.y - player.y);
        if (d <= 3) {
          // ใกล้แล้ว → คุย NPC
          if (now - sellStateAt > 1500) { sendNpcTalk(sellNpcId); setSellState('TALK'); log('💰 คุย NPC', npc.name); }
        } else {
          // เดินไปหา (throttle 1s)
          if (now - (sellState._lastMove || 0) > 1000) { sellState._lastMove = now; sendMove(npc.x, npc.y); }
        }
      }
      return;
    }
    if (sellState === 'TALK') {
      // รอ 0x4d sub=2 (handler จะเปลี่ยน state) — ถ้า 5s ไม่มา → คุยใหม่
      if (now - sellStateAt > 5000) { sendNpcTalk(sellNpcId); sellStateAt = now; log('💰 รอ dialog นาน → คุยใหม่'); }
      return;
    }
    if (sellState === 'SELECT_SELL') {
      // รอ 0x53 SELL_OPEN (handler จะเปลี่ยน state) — ถ้า 5s ไม่มา → abort
      if (now - sellStateAt > 5000) { abortSell('ไม่ได้รับ SELL_OPEN'); }
      return;
    }
    if (sellState === 'SELL') {
      // รอ 0x5b SELL_RESULT (handler จะเปลี่ยน state) — ถ้า 15s ไม่มา → abort
      if (now - sellStateAt > 15000) { abortSell('ไม่ได้รับ SELL_RESULT'); }
      return;
    }
    if (sellState === 'WARP_BACK') {
      // รอ 2s แล้ววาร์ปกลับ
      if (now - sellStateAt > 2000 && sellReturnTo) {
        if (sendTeleport(sellReturnTo.map, sellReturnTo.x, sellReturnTo.y, 'sell-return')) {
          log('💰 วาร์ปกลับ', sellReturnTo.map);
          sellReturnTo = null;
          setSellState('IDLE');
        }
      }
      return;
    }
  }, 1000);

  // ============================================================
  //  AUTO-STORAGE — state machine (mirror bot.js:1816-2047)
  //  IDLE → WARP_TO_KAFRA → MOVE_TO_KAFRA → TALK_KAFRA → SELECT_STORAGE
  //       → STORAGE_OPENED → MOVE_ITEMS → CLOSE_STORAGE → WARP_BACK → IDLE
  // ============================================================
  const STORAGE_WARP_RETRY_MS = 5000;
  const STORAGE_WARP_TIMEOUT_MS = 20000;
  const STORAGE_NPC_SPAWN_WAIT_MS = 10000;
  const STORAGE_ABORT_RETRY_MS = 10000;
  const STORAGE_STATE_TIMEOUT_MS = 60000;
  // ฝากทุกอย่างอาจมี item/slot เกิน 60 รายการ จึง timeout เฉพาะเมื่อไม่มี
  // packet ย้ายของออกไปจริง ๆ ต่อเนื่อง—not by the total duration of the run.
  const STORAGE_TRANSFER_STALL_TIMEOUT_MS = 15000;
  const STORAGE_KAFRA_WARP_OFFSET = 1;

  function storageKafraPoint() {
    const x = (CFG.kafraMapX && CFG.kafraMapX > 0) ? Number(CFG.kafraMapX) : Number(CFG.sellNpcX);
    const y = (CFG.kafraMapY && CFG.kafraMapY > 0) ? Number(CFG.kafraMapY) : Number(CFG.sellNpcY);
    return { x, y, warpX: x + STORAGE_KAFRA_WARP_OFFSET, warpY: y + STORAGE_KAFRA_WARP_OFFSET };
  }
  function findKafraNpc() {
    // Entities มี scope ตามแมปปัจจุบันเท่านั้น: ห้ามใช้ NPC จากแมปเก่าระหว่างรอวาร์ป.
    if (currentMap !== CFG.kafraMap) return null;
    const target = (CFG.kafraName || '').trim().toLowerCase();
    const point = storageKafraPoint();
    const matches = [...entities.values()].filter(e => e.kind === 2 && e.alive && e.x != null && e.y != null
      && e.name && (!target || e.name.toLowerCase().includes(target)));
    if (!matches.length) return null;
    // เลือกตัวที่พิกัด configured ก่อน; ถ้าชื่อซ้ำ ให้ตัวที่ใกล้จุด Kafra ที่สุดเป็น fallback.
    matches.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));
    return matches[0];
  }
  function setStorageState(s) {
    if (storageState !== s) dbg('🏦 Storage:', storageState, '→', s);
    storageState = s;
    storageStateAt = nowMs();
    if (s === 'MOVE_ITEMS' || s === 'WITHDRAW_ITEMS') storageTransferProgressAt = storageStateAt;
  }
  function abortStorage(reason) {
    log('⚠️ ยกเลิกฝาก:', reason);
    // ถ้า Kafra เปิด Storage อยู่ ต้องปิดก่อนออกจาก flow ไม่เช่นนั้น UI เกมค้าง
    // แม้เราจะวาร์ปกลับแล้วก็ตาม.
    const storageDialogOpen = ['STORAGE_OPENED', 'MOVE_ITEMS', 'WITHDRAW_ITEMS', 'CLOSE_STORAGE'].includes(storageState);
    if (storageDialogOpen) sendStorageClose();
    storageMoveQueue = []; storageMoveIdx = 0; storageNpcId = null;
    // น้ำหนักเดิมยังเต็มอยู่ จึงต้องพักก่อนลองใหม่ มิฉะนั้นจะ WARP_TO_KAFRA → RETURN_FARM ไม่สิ้นสุด.
    storageRetryAt = nowMs() + STORAGE_ABORT_RETRY_MS;
    log('🏦 จะลองฝากใหม่อีกครั้งหลัง', (STORAGE_ABORT_RETRY_MS / 1000).toFixed(0) + 's');
    if (storageReturnTo && storageReturnTo.map) {
      sendTeleport(storageReturnTo.map, storageReturnTo.x, storageReturnTo.y, 'storage-abort-return');
      setStorageState('RETURN_FARM');
      log('🏦 ยกเลิกแล้ว → วาร์ปกลับ', storageReturnTo.map);
    } else {
      setStorageState('IDLE');
      storageStateAt = 0;
    }
  }
  // ★ เริ่มฝากของ — จด returnTo แล้ววาร์ปไปแมป Kafra
  function startStorage(reason, returnTo) {
    const point = storageKafraPoint();
    storageReturnTo = returnTo || { map: currentMap, x: Math.round(player.x), y: Math.round(player.y) };
    storageNpcId = null;
    storageWarpAttempts = 1;
    storageWarpLastSentAt = nowMs();
    storageKafraMapReadyAt = 0;
    log('🏦 เริ่มฝากของ (' + reason + ') → วาร์ปไป', CFG.kafraMap, '@(', point.warpX, point.warpY + ')', '(ข้าง Kafra ' + point.x + ',' + point.y + ')');
    if (!sendTeleport(CFG.kafraMap, point.warpX, point.warpY, 'storage-to-kafra')) {
      storageRetryAt = nowMs() + STORAGE_ABORT_RETRY_MS;
      log('⚠️ เริ่มฝากไม่ได้: ส่งวาร์ปไม่สำเร็จ → รอ retry');
      return false;
    }
    setStorageState('WARP_TO_KAFRA');
    return true;
  }
  function storageDepositMode() { return CFG.storageDepositMode === 'selected' ? 'selected' : 'all'; }
  function storageDepositItemIds() {
    if (storageDepositMode() === 'selected') return [...new Set(Array.isArray(CFG.depositItemIds) ? CFG.depositItemIds : [])];
    return [...inventory.keys()];
  }
  function storageReserveAmount(itemId) {
    return getStorageReserveItems().find(item => item.itemId === Number(itemId))?.amount || 0;
  }
  function isEquippedBagId(bagId) { return [...equippedBagIds.values()].includes(Number(bagId)); }
  // A full 0x38 snapshot is the only moment we know every equipped bag ID.
  // Until then, all unique equipment stays protected rather than risking it.
  function hasEquipmentSnapshot() { return inventorySnapshotAt > 0; }
  // ★ สร้าง queue ของที่จะฝาก — แยก equipment vs stackable (mirror bot.js:1947-1987)
  function buildDepositQueue() {
    const queue = [];
    // "ฝากทุกอย่าง" ต้องรอ 0x38 ก่อนเสมอ: ถ้ารายการ inventory ยังมาไม่ครบ
    // เราไม่อาจแยกของสวมใส่ออกจาก stackable ได้อย่างปลอดภัย.
    if (storageDepositMode() === 'all' && !hasEquipmentSnapshot()) return queue;
    for (const itemId of storageDepositItemIds()) {
      const stock = inventory.get(itemId) || 0;
      if (stock <= 0) continue;
      const eqSlots = equipmentSlots.get(itemId);
      if (eqSlots && eqSlots.length > 0) {
        if (!hasEquipmentSnapshot()) continue; // safe default before we know worn slots
        // ★★ equipment — ฝากจาก slot สูง→ต่ำ (กัน index shift) ทีละชิ้น amount=1
        const sorted = [...eqSlots].sort((a, b) => b - a);
        for (const slotId of sorted) {
          if (isEquippedBagId(slotId) || isWeaponBagProtected(slotId)) {
            continue;
          }
          queue.push({ itemId, amount: 1, invId: slotId, isEquipment: true });
        }
      } else {
        // ★ stackable — เก็บยอด reserve ติดตัวไว้ ไม่ต้องฝากแล้วถอนกลับในรอบเดียว
        const amount = Math.max(0, stock - storageReserveAmount(itemId));
        if (amount > 0) queue.push({ itemId, amount, invId: itemId, isEquipment: false });
      }
    }
    return queue;
  }
  // 0x54 STORAGE_OPEN snapshot (live verified):
  // [54][hasStorage:1][regularCount:u32][itemId:u32,count:u16 × N][uniqueCount:u32][unique:44 × N]
  // Regular/stack items use itemId itself as the storage-side bagId.
  function parseStorageInventorySnapshot(u) {
    if (u.length < 10 || u[0] !== 0x54 || u[1] !== 1) return false;
    const regularCount = u32(u, 2);
    const regularAt = 6;
    const uniqueAt = regularAt + regularCount * 6;
    if (uniqueAt + 4 > u.length) return false;
    const uniqueCount = u32(u, uniqueAt);
    if (uniqueAt + 4 + uniqueCount * 44 !== u.length) return false;
    storageRegularItems.clear();
    for (let i = 0; i < regularCount; i++) {
      const at = regularAt + i * 6;
      const itemId = u32(u, at);
      const amount = u16(u, at + 4);
      if (itemId > 0 && amount > 0) storageRegularItems.set(itemId, amount);
    }
    storageSnapshotAt = nowMs();
    return true;
  }
  function normalizeStorageReserveItems(items) {
    const byId = new Map();
    for (const raw of (Array.isArray(items) ? items : [])) {
      const itemId = Math.round(Number(raw && raw.itemId));
      const amount = Math.max(0, Math.round(Number(raw && raw.amount)) || 0);
      if (itemId > 0 && itemId < 50000 && amount > 0) byId.set(itemId, amount);
    }
    return [...byId.entries()].map(([itemId, amount]) => ({ itemId, amount }));
  }
  function getStorageReserveItems() { return normalizeStorageReserveItems(CFG.storageReserveItems); }
  function parseStorageReserveItems(text) {
    const list = [];
    for (const token of String(text || '').split(/[\s,;]+/)) {
      if (!token) continue;
      const [itemId, amount] = token.split(/[:=x×]/i).map(Number);
      if (!Number.isFinite(itemId) || !Number.isFinite(amount)) return null;
      list.push({ itemId, amount });
    }
    return normalizeStorageReserveItems(list);
  }
  function storageReserveItemsText() {
    return getStorageReserveItems().map(i => i.itemId + ':' + i.amount).join(', ');
  }
  // ถอนเฉพาะส่วนที่ขาด เพื่อให้ยอดติดตัวจบที่ reserve amount (ไม่ถอนเกิน stock ใน Kafra)
  function buildWithdrawQueue() {
    const queue = [];
    for (const reserve of getStorageReserveItems()) {
      const carried = inventory.get(reserve.itemId) || 0;
      const available = storageRegularItems.get(reserve.itemId) || 0;
      const amount = Math.min(Math.max(0, reserve.amount - carried), available);
      if (amount > 0) queue.push({ itemId: reserve.itemId, amount });
      else if (reserve.amount > carried && available <= 0) log('⚠️ Kafra ไม่มี', nameOf(reserve.itemId), 'สำหรับหยิบกลับ');
    }
    return queue;
  }
  const storageLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.storageEnabled) return;
    if (isAbBuffActive()) return;
    if (isOreRefineActive()) return;
    if (!activeWS || activeWS.readyState !== 1) return;
    if (isDead) return;
    // ★ กัน race: ถ้า sell กำลังทำอยู่ → รอก่อน (storage จะ trigger หลัง sell เสร็จผ่าน depositAfterSell chain)
    if (sellState !== 'IDLE') return;
    const now = nowMs();

    // === trigger (IDLE เท่านั้น) ===
    if (storageState === 'IDLE') {
      if (now < storageRetryAt) return;
      const trigger = getStorageDepositTrigger();
      if (trigger && lootQueue.isCollectorActive()) {
        // Soft threshold: collector จะหยุดรับงานใหม่จาก shouldHoldLootQueueForStorage()
        // Hard full: tick ของ collector จะ nack งานภายใน 150ms แล้วกลับมาที่นี่เพื่อเริ่มฝาก
        return;
      }
      if (trigger && currentMap && player.x != null) startStorage(trigger.reason, null);
      return;
    }

    // === watchdog: state ทั่วไป 60s, แต่ช่วงย้ายของวัดเฉพาะเวลาที่ไม่มี progress ===
    const storageTransferActive = storageState === 'MOVE_ITEMS' || storageState === 'WITHDRAW_ITEMS';
    const storageLastProgressAt = storageTransferActive ? storageTransferProgressAt : storageStateAt;
    const storageTimeoutMs = storageTransferActive ? STORAGE_TRANSFER_STALL_TIMEOUT_MS : STORAGE_STATE_TIMEOUT_MS;
    if (now - storageLastProgressAt > storageTimeoutMs) {
      abortStorage((storageTransferActive ? 'ไม่มี progress ย้ายของ' : 'timeout') + ' (' + storageState + ' ' + (storageTimeoutMs / 1000) + 's)');
      return;
    }

    if (storageState === 'WARP_TO_KAFRA') {
      const elapsed = now - storageStateAt;
      if (currentMap !== CFG.kafraMap) {
        if (elapsed >= STORAGE_WARP_TIMEOUT_MS) { abortStorage('วาร์ปไป ' + CFG.kafraMap + ' ไม่สำเร็จใน ' + (STORAGE_WARP_TIMEOUT_MS / 1000) + 's'); return; }
        if (now - storageWarpLastSentAt >= STORAGE_WARP_RETRY_MS) {
          const point = storageKafraPoint();
          if (sendTeleport(CFG.kafraMap, point.warpX, point.warpY, 'storage-kafra-retry')) {
            storageWarpAttempts++;
            storageWarpLastSentAt = now;
            log('🏦 ยังไม่ถึง', CFG.kafraMap, '→ ลองวาร์ปอีกครั้ง (' + storageWarpAttempts + ')');
          }
        }
        return;
      }
      if (!storageKafraMapReadyAt) {
        storageKafraMapReadyAt = now;
        log('🏦 ถึงแมป', CFG.kafraMap, 'แล้ว → รอ NPC spawn');
        return;
      }
      const npc = findKafraNpc();
      if (npc) {
        storageNpcId = npc.id;
        storageRetryAt = 0;
        setStorageState('MOVE_TO_KAFRA');
        log('🏦 พบ', npc.name, '@(', npc.x, npc.y + ')');
      } else if (now - storageKafraMapReadyAt >= STORAGE_NPC_SPAWN_WAIT_MS) {
        abortStorage('ถึง ' + CFG.kafraMap + ' แล้ว แต่ไม่พบ Kafra ' + CFG.kafraName + ' ใกล้พิกัดที่ตั้ง');
      }
      return;
    }
    if (storageState === 'MOVE_TO_KAFRA') {
      const npc = storageNpcId ? entities.get(storageNpcId) : null;
      if (!npc || !npc.alive || npc.x == null) {
        const found = findKafraNpc();
        if (found) { storageNpcId = found.id; }
        else { abortStorage('ไม่พบ Kafra ' + CFG.kafraName); return; }
      }
      if (player.x != null) {
        const d = Math.hypot(npc.x - player.x, npc.y - player.y);
        if (d <= 3) {
          if (now - storageStateAt > 1500) { sendNpcTalk(storageNpcId); setStorageState('TALK_KAFRA'); log('🏦 คุย Kafra', npc.name); }
        } else {
          if (now - storageLastMoveAt > 1000) { storageLastMoveAt = now; sendMove(npc.x, npc.y); }
        }
      }
      return;
    }
    // TALK_KAFRA / SELECT_STORAGE จัดการโดย 0x4d handler (packet-driven)
    if (storageState === 'TALK_KAFRA') {
      // รอ dialog — ถ้านานเกินไป คุยใหม่
      if (now - storageStateAt > 5000) { sendNpcTalk(storageNpcId); storageStateAt = now; log('🏦 รอ dialog นาน → คุยใหม่'); }
      return;
    }
    if (storageState === 'SELECT_STORAGE') {
      // รอ menu — ถ้านานเกินไป คุยใหม่
      if (now - storageStateAt > 5000) { abortStorage('ไม่ได้รับเมนู Kafra'); }
      return;
    }
    if (storageState === 'STORAGE_OPENED') {
      // ต้องรอ snapshot 0x54 ก่อนเสมอ: ใช้ทั้งยืนยันว่า UI Storage เปิดจริง
      // และอ่าน stock สำหรับคำนวณจำนวนที่จะหยิบกลับหลังฝาก.
      if (storageSnapshotAt < storageStateAt) {
        if (now - storageStateAt > 6000) abortStorage('ไม่ได้รับข้อมูล Storage (0x54)');
        return;
      }
      // ★ build queue + เริ่มฝาก
      storageMoveQueue = buildDepositQueue();
      storageMoveIdx = 0;
      if (storageMoveQueue.length === 0) {
        log('🏦 ไม่มีของที่จะฝาก → ตรวจไอเท็มสำรอง');
        storageMoveQueue = []; storageMoveIdx = 0;
        setStorageState('WITHDRAW_ITEMS');
      } else {
        const total = storageMoveQueue.length;
        const types = storageMoveQueue.filter(q => q.isEquipment).length;
        log('🏦 เปิด storage แล้ว → ฝาก', total, 'รายการ' + (types ? ' (' + types + ' equipment)' : ''));
        setStorageState('MOVE_ITEMS');
      }
      return;
    }
    if (storageState === 'MOVE_ITEMS') {
      // ★ ส่งของทีละชิ้น (รอ 800ms ระหว่างชิ้น กัน server บล็อก)
      if (now - storageLastMoveAt < 800) return;
      if (storageMoveIdx >= storageMoveQueue.length) {
        // ฝากครบแล้ว → ตรวจจำนวนสำรองที่จะหยิบกลับ
        log('🏦 ฝากครบแล้ว → ตรวจไอเท็มสำรอง');
        // The live removal packet layout is not yet decoded.  Do not retain a
        // pre-deposit weight/full flag, or it would immediately re-trigger after
        // returning to the farm map.  The next 0x32 pickup refreshes it.
        inventoryFull = false;
        currentWeightRaw = null;
        lastWeightSource = '';
        storageMoveQueue = []; storageMoveIdx = 0;
        setStorageState('WITHDRAW_ITEMS');
        return;
      }
      const item = storageMoveQueue[storageMoveIdx];
      const moveId = item.isEquipment ? item.invId : item.itemId;
      log('🏦 ฝาก', nameOf(item.itemId) + (item.isEquipment ? ' (slot ' + item.invId + ')' : ' ×' + item.amount));
      if (!sendStorageMove(moveId, item.amount)) {
        log('⚠️ ส่งคำสั่งฝากไม่สำเร็จ → จะลองใหม่');
        return;
      }
      // ★ optimistic: ลบ slot + ลด inventory count (server จะส่ง 0x32 removal ยืนยัน)
      if (item.isEquipment) {
        const slots = equipmentSlots.get(item.itemId);
        if (slots) {
          const i = slots.indexOf(item.invId);
          if (i >= 0) slots.splice(i, 1);
          if (slots.length === 0) equipmentSlots.delete(item.itemId);
        }
        const cur = inventory.get(item.itemId) || 0;
        if (cur > 1) inventory.set(item.itemId, cur - 1);
        else inventory.delete(item.itemId);
      } else {
        inventory.delete(item.itemId);   // stackable ทั้งกอง
        storageRegularItems.set(item.itemId, (storageRegularItems.get(item.itemId) || 0) + item.amount);
      }
      storageMoveIdx++;
      storageLastMoveAt = now;
      storageTransferProgressAt = now;
      return;
    }
    if (storageState === 'WITHDRAW_ITEMS') {
      if (storageMoveQueue.length === 0 && storageMoveIdx === 0) {
        storageMoveQueue = buildWithdrawQueue();
        storageMoveIdx = 0;
        if (storageMoveQueue.length > 0) log('🏦 หยิบไอเท็มสำรอง', storageMoveQueue.map(i => nameOf(i.itemId) + ' ×' + i.amount).join(', '));
      }
      if (now - storageLastMoveAt < 800) return;
      if (storageMoveIdx >= storageMoveQueue.length) {
        log('🏦 Storage ครบแล้ว → ปิด storage');
        sendStorageClose();
        setStorageState('CLOSE_STORAGE');
        return;
      }
      const item = storageMoveQueue[storageMoveIdx];
      log('🏦 หยิบกลับ', nameOf(item.itemId) + ' ×' + item.amount);
      if (!sendStorageWithdraw(item.itemId, item.amount)) {
        log('⚠️ ส่งคำสั่งหยิบกลับไม่สำเร็จ → จะลองใหม่');
        return;
      }
      inventory.set(item.itemId, (inventory.get(item.itemId) || 0) + item.amount);
      heal.updateInventoryStock(item.itemId, inventory.get(item.itemId));
      storageRegularItems.set(item.itemId, Math.max(0, (storageRegularItems.get(item.itemId) || 0) - item.amount));
      storageMoveIdx++;
      storageLastMoveAt = now;
      storageTransferProgressAt = now;
      return;
    }
    if (storageState === 'CLOSE_STORAGE') {
      // รอ 1.5s หลัง close แล้ววาร์ปกลับ และ hold Flee Player จน MAP_NAME ยืนยันว่ากลับถึง
      if (now - storageStateAt > 1500 && storageReturnTo) {
        if (sendTeleport(storageReturnTo.map, storageReturnTo.x, storageReturnTo.y, 'storage-return')) {
          log('🏦 วาร์ปกลับ', storageReturnTo.map);
          setStorageState('RETURN_FARM');
        }
      }
      return;
    }
    if (storageState === 'RETURN_FARM') {
      if (!storageReturnTo || currentMap === storageReturnTo.map) {
        storageReturnTo = null;
        setStorageState('IDLE');
        log('🏦 กลับแมพฟาร์มแล้ว → Storage จบ');
      } else if (now - storageStateAt > 5000) {
        // server ยังไม่เปลี่ยนแมป → ลองวาร์ปกลับซ้ำโดยยัง hold Flee Player อยู่
        sendTeleport(storageReturnTo.map, storageReturnTo.x, storageReturnTo.y, 'storage-return-retry');
        storageStateAt = now;
        log('🏦 ยังไม่กลับ', storageReturnTo.map, '→ ลองวาร์ปกลับอีกครั้ง');
      }
      return;
    }
  }, 1000);

  // ============================================================
  //  ORE REFINE + SELL — manual state machine, no MOVE commands
  // ============================================================
  function setOreRefineState(state) {
    if (oreRefineState !== state) dbg('⛏️ Ore refine:', oreRefineState, '→', state);
    oreRefineState = state;
    oreRefineStateAt = nowMs();
    oreRefineNpcWaitLogged = false;
  }
  function oreRefineAtMap() { return currentMap === CFG.oreRefineMap; }
  function findOreNpc(name, x, y) {
    const expected = String(name || '').trim().toLowerCase();
    let coordinateMatch = null;
    for (const entity of entities.values()) {
      if (entity.kind !== 2 || entity._isWarp || !entity.alive || entity.x == null || entity.y == null) continue;
      if (Math.abs(entity.x - Number(x)) > 1 || Math.abs(entity.y - Number(y)) > 1) continue;
      // ชื่อที่ client ส่งอาจเป็น "Kafra Defolty - Kafra Employee" ขณะที่ UI ใช้ "Kafra Staff".
      // ตำแหน่ง NPC เป็นตัวระบุตรงที่สุดสำหรับ tool นี้; ชื่อที่ตรงจึงเป็นเพียง preference.
      if (!coordinateMatch) coordinateMatch = entity;
      if (!expected || (entity.name || '').toLowerCase().includes(expected)) return entity;
    }
    return coordinateMatch;
  }
  function oreRefineBatchLimit() {
    // Server validates Trade request count at <=99. Keep this cap even if UI has a larger value.
    return Math.min(99, Math.max(1, Math.round(Number(CFG.oreRefineBatchSize) || 1)));
  }
  function oreRefineAbort(reason) {
    log('⚠️ ยกเลิกย่อย/ขายแร่:', reason);
    if (oreRefineState === 'STORAGE_OPENED' || oreRefineState === 'WITHDRAW_SENT') sendStorageClose();
    oreRefineBatch = 0;
    oreRefineResultBeforeTrade = 0;
    oreRefineResultServerCount = null;
    oreRefineKafraId = null;
    oreRefineNpcId = null;
    setOreRefineState('IDLE');
  }
  function startOreRefine() {
    if (isOreRefineActive()) { log('⚠️ กำลังย่อย/ขายแร่อยู่แล้ว (' + oreRefineState + ')'); return false; }
    if (sellState !== 'IDLE' || storageState !== 'IDLE') { log('⚠️ รอ Sell/Storage ปกติให้จบก่อน'); return false; }
    // Do not discard a verified drop or interrupt an already-engaged monster just because this is a manual tool.
    if (target || isLootCommandLocked()) { log('⚠️ รอฆ่า/เก็บของรอบปัจจุบันให้จบก่อน แล้วค่อยเริ่มย่อยแร่'); return false; }
    if (!activeWS || activeWS.readyState !== 1 || !currentMap || player.x == null) { log('⚠️ ยังไม่พร้อมเริ่มย่อยแร่ (รอเข้าเกม/พิกัดตัวละคร)'); return false; }
    oreRefineBatch = 0;
    oreRefineResultBeforeTrade = 0;
    oreRefineResultServerCount = null;
    oreRefineKafraId = null;
    oreRefineNpcId = null;
    log('⛏️ เริ่มย่อย Great Nature → Green Live → Sell; ไปจุดเริ่ม', CFG.oreRefineMap, '@(', CFG.oreRefineHubX, CFG.oreRefineHubY + ')');
    if (!sendTeleport(CFG.oreRefineMap, CFG.oreRefineHubX, CFG.oreRefineHubY, 'ore-refine-start')) return false;
    setOreRefineState('WARP_HUB');
    return true;
  }
  function finishOreRefine() {
    oreRefineBatch = 0;
    oreRefineResultBeforeTrade = 0;
    oreRefineResultServerCount = null;
    oreRefineKafraId = null;
    oreRefineNpcId = null;
    setOreRefineState('IDLE');
    log('✅ ย่อย/ขาย Great Nature ครบแล้ว');
  }
  function handleOreRefineNpcDialog(sub) {
    if (!isOreRefineActive()) return false;
    if (oreRefineState === 'KAFRA_DIALOG') {
      if (sub === 1 && oreRefineKafraNextRemaining > 0) {
        oreRefineKafraNextRemaining--;
        sendNpcNext();
        setOreRefineState('KAFRA_MENU');
        return true;
      }
      if (sub === 2) {
        sendNpcSelect(Math.max(0, Math.round(Number(CFG.oreRefineKafraChoice) || 0)));
        setOreRefineState('STORAGE_OPENED');
        return true;
      }
    }
    if (oreRefineState === 'KAFRA_MENU' && sub === 2) {
      sendNpcSelect(Math.max(0, Math.round(Number(CFG.oreRefineKafraChoice) || 0)));
      setOreRefineState('STORAGE_OPENED');
      return true;
    }
    if (oreRefineState === 'REFINER_TRADE_DIALOG' && sub === 2) {
      sendNpcSelect(Math.max(0, Math.round(Number(CFG.oreRefineTradeChoice) || 0)));
      setOreRefineState('WAIT_TRADE_LIST');
      return true;
    }
    if (oreRefineState === 'REFINER_SELL_DIALOG' && sub === 2) {
      sendNpcSelect(Math.max(0, Math.round(Number(CFG.oreRefineSellChoice) || 0)));
      setOreRefineState('WAIT_SELL_OPEN');
      return true;
    }
    return false;
  }
  function handleOreRefineTradeOpen() {
    if (oreRefineState !== 'WAIT_TRADE_LIST') return false;
    const entry = Math.max(0, Math.round(Number(CFG.oreRefineTradeEntry) || 0));
    oreRefineResultBeforeTrade = inventory.get(Math.round(Number(CFG.oreRefineResultItemId) || 0)) || 0;
    oreRefineResultServerCount = null;
    if (!sendNpcTrade(entry, oreRefineBatch)) { oreRefineAbort('ส่ง Trade ไม่ได้'); return true; }
    log('⛏️ ย่อย', nameOf(CFG.oreRefineSourceItemId), '×' + oreRefineBatch, '→', nameOf(CFG.oreRefineResultItemId));
    setOreRefineState('WAIT_TRADE_RESULT');
    return true;
  }
  function handleOreRefineSellOpen() {
    if (oreRefineState !== 'WAIT_SELL_OPEN') return false;
    const resultId = Math.round(Number(CFG.oreRefineResultItemId) || 0);
    const count = inventory.get(resultId) || 0;
    if (count <= 0) { oreRefineAbort('ไม่พบ ' + nameOf(resultId) + ' ในกระเป๋าก่อนขาย'); return true; }
    if (!sendSellItems([{ itemId: resultId, count }])) { oreRefineAbort('ส่ง Sell ไม่ได้'); return true; }
    log('⛏️ ขาย', nameOf(resultId), '×' + count);
    setOreRefineState('WAIT_SELL_RESULT');
    return true;
  }
  function handleOreRefineResult(success) {
    if (oreRefineState === 'WAIT_TRADE_RESULT') {
      if (!success) { oreRefineAbort('Trade ไม่สำเร็จ'); return true; }
      // ห้ามเดายอดจาก batch: packet 0x5b บอกเพียงว่า Trade สำเร็จ ไม่ได้บอกจำนวนจริง.
      // รอ 0x32/0x38 ของ Green Live จาก server ก่อน แล้วจึงขายยอดที่ยืนยันเท่านั้น.
      if (oreRefineResultServerCount != null && oreRefineResultServerCount > oreRefineResultBeforeTrade) {
        setOreRefineState('PREPARE_SELL');
      } else {
        setOreRefineState('WAIT_TRADE_INVENTORY');
      }
      return true;
    }
    if (oreRefineState === 'WAIT_SELL_RESULT') {
      if (!success) { oreRefineAbort('Sell ไม่สำเร็จ'); return true; }
      inventory.delete(Math.round(Number(CFG.oreRefineResultItemId) || 0));
      // อยู่ที่จุดเริ่มเดิมตลอด: คุย Kafra ตรงพิกัดด้วย NPC packet ไม่วาร์ปตาม NPC
      setOreRefineState('WARP_KAFRA');
      return true;
    }
    return false;
  }
  function observeOreRefineInventory(itemId, count, source) {
    if (oreRefineState !== 'WAIT_TRADE_RESULT' && oreRefineState !== 'WAIT_TRADE_INVENTORY') return;
    const resultId = Math.round(Number(CFG.oreRefineResultItemId) || 0);
    if (Number(itemId) !== resultId || Number(count) <= oreRefineResultBeforeTrade) return;
    oreRefineResultServerCount = Number(count);
    if (oreRefineState === 'WAIT_TRADE_INVENTORY') {
      log('⛏️ server ยืนยัน', nameOf(resultId), '×' + oreRefineResultServerCount, 'จาก', source, '→ เตรียมขาย');
      setOreRefineState('PREPARE_SELL');
    }
  }
  const oreRefineLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!isOreRefineActive()) return;
    if (!activeWS || activeWS.readyState !== 1 || isDead) return;
    const now = nowMs();
    if (now - oreRefineStateAt > ORE_REFINE_STATE_TIMEOUT_MS) {
      oreRefineAbort('timeout (' + oreRefineState + ')');
      return;
    }
    if (oreRefineState === 'WARP_HUB') {
      if (!oreRefineAtMap() || isWarpGuardActive(now)) return;
      // วาร์ปครั้งเดียวมาที่ hub; จากนี้ส่ง NPC_TALK ตรงตามพิกัดโดยไม่เดิน/ไม่วาร์ปอีก
      setOreRefineState('WARP_KAFRA');
      return;
    }
    if (oreRefineState === 'WARP_KAFRA') {
      if (!oreRefineAtMap() || isWarpGuardActive(now)) return;
      const kafra = findOreNpc(CFG.oreRefineKafraName, CFG.oreRefineKafraX, CFG.oreRefineKafraY);
      if (!kafra) {
        if (!oreRefineNpcWaitLogged && now - oreRefineStateAt >= 3000) {
          oreRefineNpcWaitLogged = true;
          log('⛏️ รอ Kafra', CFG.oreRefineKafraName, '@(', CFG.oreRefineKafraX, CFG.oreRefineKafraY + ') — ยังไม่มี entity รอบตัว');
        }
        return;
      }
      oreRefineKafraId = kafra.id;
      oreRefineKafraNextRemaining = Math.max(0, Math.round(Number(CFG.oreRefineKafraNextCount) || 0));
      sendNpcTalk(kafra.id);
      log('⛏️ คุย Kafra', kafra.name, 'ตรงพิกัด โดยไม่เดิน');
      setOreRefineState('KAFRA_DIALOG');
      return;
    }
    if (oreRefineState === 'STORAGE_OPENED') {
      if (storageSnapshotAt < oreRefineStateAt) return;
      const sourceId = Math.round(Number(CFG.oreRefineSourceItemId) || 0);
      const available = storageRegularItems.get(sourceId) || 0;
      if (available <= 0) {
        log('⛏️ Kafra ไม่มี', nameOf(sourceId), 'แล้ว → ปิด storage');
        sendStorageClose();
        setOreRefineState('FINISH_CLOSE_STORAGE');
        return;
      }
      oreRefineBatch = Math.min(available, oreRefineBatchLimit());
      sendStorageWithdraw(sourceId, oreRefineBatch);
      storageRegularItems.set(sourceId, Math.max(0, available - oreRefineBatch));
      // ไม่เดา inventory หลัง withdraw: server เป็นผู้ยืนยันยอดจริงด้วย 0x32/0x38.
      log('⛏️ หยิบ', nameOf(sourceId), '×' + oreRefineBatch, 'จาก Kafra');
      setOreRefineState('WITHDRAW_SENT');
      return;
    }
    if (oreRefineState === 'WITHDRAW_SENT') {
      if (now - oreRefineStateAt < 500) return;
      sendStorageClose();
      setOreRefineState('WARP_REFINER');
      return;
    }
    if (oreRefineState === 'WARP_REFINER') {
      if (!oreRefineAtMap() || isWarpGuardActive(now)) return;
      const refiner = findOreNpc(CFG.oreRefineNpcName, CFG.oreRefineNpcX, CFG.oreRefineNpcY);
      if (!refiner) {
        if (!oreRefineNpcWaitLogged && now - oreRefineStateAt >= 3000) {
          oreRefineNpcWaitLogged = true;
          log('⛏️ รอ NPC ย่อยแร่', CFG.oreRefineNpcName, '@(', CFG.oreRefineNpcX, CFG.oreRefineNpcY + ') — ยังไม่มี entity รอบตัว');
        }
        return;
      }
      oreRefineNpcId = refiner.id;
      sendNpcTalk(refiner.id);
      log('⛏️ คุย NPC ย่อยแร่', refiner.name, 'ตรงพิกัด โดยไม่เดิน');
      setOreRefineState('REFINER_TRADE_DIALOG');
      return;
    }
    if (oreRefineState === 'PREPARE_SELL') {
      if (now - oreRefineStateAt < 500) return;
      const refiner = oreRefineNpcId ? entities.get(oreRefineNpcId) : findOreNpc(CFG.oreRefineNpcName, CFG.oreRefineNpcX, CFG.oreRefineNpcY);
      if (!refiner) { oreRefineAbort('ไม่พบ NPC ย่อยแร่ก่อนขาย'); return; }
      oreRefineNpcId = refiner.id;
      sendNpcTalk(refiner.id);
      setOreRefineState('REFINER_SELL_DIALOG');
      return;
    }
    if (oreRefineState === 'FINISH_CLOSE_STORAGE') {
      if (now - oreRefineStateAt < 500) return;
      setOreRefineState('FINISH_HUB');
      return;
    }
    if (oreRefineState === 'FINISH_HUB' && oreRefineAtMap()) finishOreRefine();
  }, 250);

  // ---------- entity tracker ----------
  //  kind: 0=player, 1=monster, 2=NPC (จาก SPAWN)
  const entities = new Map();    // id -> {id,kind,sub,name,x,y,hp,hpMax,alive,_lastEngagedByOtherAt,_lastDamageAt}
  const monsterAggro = new Map(); // monsterId -> timestamp (มอนจับเราเป็นเป้า)
  const stalePlayerIds = new Map(); // oldPlayerId -> expireAt (กัน phantom entity จาก ID เก่า, 5 นาที)
  const radarPlayerIds = new Map(); // id -> expiry timestamp จาก 0x3c flag=1 (radar ยืนยันผู้เล่น)
  const RADAR_PLAYER_TTL_MS = 30000;
  function isRadarPlayerId(id, now = nowMs()) {
    const expiresAt = radarPlayerIds.get(id);
    if (!expiresAt) return false;
    if (now >= expiresAt) { radarPlayerIds.delete(id); return false; }
    return true;
  }
  function isStaleId(id, now) {
    const exp = stalePlayerIds.get(id);
    if (!exp) return false;
    if (now >= exp) { stalePlayerIds.delete(id); return false; }
    return true;
  }
  const mobAttackers = new Map(); // monsterId -> timestamp (มอนตีเรา)

  // ---------- AUTO-SELL + AUTO-STORAGE state + inventory ----------
  const inventory = new Map();    // itemId -> count (authoritative from 0x32, mirror world.js:34)
  let inventorySnapshotAt = 0;    // full 0x38 inventory ที่ตรวจได้สำเร็จ; ใช้ยืนยัน count=0 สำหรับ Heal
  const equipmentSlots = new Map(); // ★ itemId -> [slotId, slotId, ...] (mirror world.js:773-777)
  // ไอเท็มที่เพิ่มหลัง script เริ่มทำงานเท่านั้น — แยกจาก inventory จริง
  // เพื่อให้หน้า "ของที่เก็บได้" ไม่แสดงของติดตัวตั้งแต่เข้าเกม.
  const sessionLootItems = new Map(); // itemId -> จำนวนที่ได้ใน session
  let inventoryFull = false;      // true เมื่อ server ส่ง "too full" (0x20)
  let currentWeightRaw = null;    // server value; UI displays value / 10
  let maxWeightRaw = null;        // server value; UI displays value / 10
  let lastWeightSource = '';
  function inventoryWeightPercent() {
    if (!Number.isFinite(currentWeightRaw) || !Number.isFinite(maxWeightRaw) || maxWeightRaw <= 0) return null;
    return currentWeightRaw * 100 / maxWeightRaw;
  }
  function updateInventoryWeight(currentRaw, maxRaw, source) {
    const oldPercent = inventoryWeightPercent();
    if (Number.isFinite(currentRaw) && currentRaw >= 0) currentWeightRaw = currentRaw;
    if (Number.isFinite(maxRaw) && maxRaw > 0) maxWeightRaw = maxRaw;
    lastWeightSource = source || lastWeightSource;
    const percent = inventoryWeightPercent();
    const threshold = Math.max(0, Math.min(100, Number(CFG.depositWeightPercent) || 0));
    // Log only when crossing the configured storage threshold; each 0x32 updates weight.
    if (percent != null && threshold > 0 && (oldPercent == null || oldPercent < threshold) && percent >= threshold) {
      log('🎒 น้ำหนัก', (currentWeightRaw / 10).toFixed(1) + '/' + (maxWeightRaw / 10).toFixed(1), '(' + percent.toFixed(1) + '%) → ถึงเกณฑ์ฝาก');
    }
  }
  function hasDepositableInventory() {
    if (storageDepositMode() === 'all' && !hasEquipmentSnapshot()) return false;
    return storageDepositItemIds().some(itemId => {
      const stock = inventory.get(itemId) || 0;
      if (stock <= 0) return false;
      const eqSlots = equipmentSlots.get(itemId);
      if (eqSlots && eqSlots.length) {
        return hasEquipmentSnapshot() && eqSlots.some(slotId => !isEquippedBagId(slotId) && !isWeaponBagProtected(slotId));
      }
      return stock > storageReserveAmount(itemId);
    });
  }
  function isDepositWeightReached() {
    const threshold = Math.max(0, Math.min(100, Number(CFG.depositWeightPercent) || 0));
    const percent = inventoryWeightPercent();
    return threshold > 0 && percent != null && percent >= threshold;
  }
  // Storage กับ Loot Queue ใช้ trigger เดียวกัน เพื่อไม่ให้ทั้งคู่ส่งวาร์ปในรอบเดียวกัน
  // urgent=true เฉพาะ server แจ้ง "เก็บต่อไม่ได้"; น้ำหนักถึงเกณฑ์ยังรอ job ที่ claim แล้วจบได้
  function getStorageDepositTrigger() {
    if (!CFG.storageEnabled || !CFG.depositOnFull || !hasDepositableInventory()) return null;
    if (inventoryFull) return { reason: 'ของเต็ม', urgent: true };
    if (isDepositWeightReached()) {
      const pct = inventoryWeightPercent();
      return { reason: 'น้ำหนัก ' + pct.toFixed(1) + '%', urgent: false };
    }
    return null;
  }
  // เหตุผลเดียวที่ auto-storage ยังไม่เริ่ม: ใช้ทั้ง console diagnostics และ HUD
  // เพื่อไม่ให้ปุ่ม "ฝากเดี๋ยวนี้" ใช้ได้ แต่ auto เงียบจนหาสาเหตุไม่พบ.
  function storageAutoBlockers(now = nowMs()) {
    const blockers = [];
    if (!CFG.storageEnabled) blockers.push('Storage: OFF');
    if (!CFG.depositOnFull) blockers.push('ปิด trigger ฝากเมื่อน้ำหนักเต็ม');
    if (storageDepositMode() === 'selected' && !storageDepositItemIds().length) blockers.push('ยังไม่มีรายการของที่จะฝาก');
    else if (!hasDepositableInventory()) blockers.push(storageDepositMode() === 'all' ? 'ไม่มีของที่ฝากได้ (ของสวม/Weapon Set/Reserve จะถูกกันไว้)' : 'ไม่มีรายการฝากอยู่ใน inventory');
    if (!activeWS || activeWS.readyState !== 1) blockers.push('WebSocket เกมยังไม่เชื่อมต่อ');
    if (isDead) blockers.push('ตัวละครตาย');
    if (isAbBuffActive()) blockers.push('AB Buff=' + abBuffState);
    if (isOreRefineActive()) blockers.push('Ore Refine=' + oreRefineState);
    if (sellState !== 'IDLE') blockers.push('Sell=' + sellState);
    if (storageState !== 'IDLE') blockers.push('Storage=' + storageState);
    if (now < storageRetryAt) blockers.push('รอ retry อีก ' + Math.ceil((storageRetryAt - now) / 1000) + 's');
    if (!currentMap) blockers.push('ยังไม่รู้แมป');
    if (player.x == null || player.y == null) blockers.push('ยังไม่รู้พิกัดตัวละคร');

    const trigger = getStorageDepositTrigger();
    if (!trigger && CFG.storageEnabled && CFG.depositOnFull && hasDepositableInventory()) {
      const threshold = Math.max(0, Math.min(100, Number(CFG.depositWeightPercent) || 0));
      const percent = inventoryWeightPercent();
      if (inventoryFull) blockers.push('รอข้อมูล inventory หลังเต็ม');
      else if (threshold <= 0) blockers.push('เกณฑ์น้ำหนักเป็น 0%');
      else if (percent == null) blockers.push('ยังไม่รู้ค่าน้ำหนัก/น้ำหนักสูงสุดจาก Game Packet');
      else blockers.push('น้ำหนัก ' + percent.toFixed(1) + '% < เกณฑ์ ' + threshold + '%');
    }
    if (trigger && lootQueue.isCollectorActive()) blockers.push('Loot Queue collector กำลังทำงาน');
    return { trigger, blockers };
  }
  function shouldHoldLootQueueForStorage() {
    return storageState !== 'IDLE' || !!getStorageDepositTrigger();
  }
  function recordSessionLoot(itemId, amount) {
    if (!(itemId > 0) || !(amount > 0)) return;
    sessionLootItems.set(itemId, (sessionLootItems.get(itemId) || 0) + amount);
  }
  const STEAL_MAX_RANGE = 2;
  const STEAL_STABLE_MS = 400;
  // Rebuild: Skill.Cloaking = 127, self-cast packet เป็นหลักฐานก่อนเข้า HIDDEN_WAIT
  const CLOAKING_SKILL_ID = 127;
  const CLOAKING_STATUS_ID = 0x1c;
  const CLOAKING_EVIDENCE_WINDOW_MS = 2000;
  // Steal ใช้ cooldown ที่ตั้งจาก UI เป็นเวลารอผลและก่อน retry โดยตรง.
  // 250ms เป็น lower bound ความปลอดภัยของ command lane ไม่ใช่ delay ซ่อนของ Steal.
  function stealResultWaitMs(skill) {
    const cooldown = Number(skill && skill.cooldownMs);
    return Number.isFinite(cooldown) ? Math.max(250, Math.min(10000, Math.round(cooldown))) : 800;
  }
  function confirmStealInventoryIncrease() {
    if (!target || !target.stealPending || !target.stealInventorySnapshot) return;
    if (nowMs() > (target.stealResultDueAt || target.stealPendingAt)) return;
    for (const [itemId, count] of inventory) {
      if (count > (target.stealInventorySnapshot.get(itemId) || 0)) {
        // 0x32 ไม่ได้บอก source ของไอเท็ม จึงเก็บไว้แค่ชื่อสำหรับ log; 0x1d จะเป็นตัวตัดสิน success
        target.stealLootName = nameOf(itemId);
        return;
      }
    }
  }
  function confirmStealSuccessBySkill() {
    if (!target || !target.stealPending) return;
    target.stealSuccess = true;
    target.stealPending = false;
    target.stealResultDueAt = 0;
    target.stealSuccessAt = nowMs();
    target.stealInventorySnapshot = null;
    // Skill packet อาจตัด auto-attack เดิม: resume Attack หนึ่งครั้งใน tick ถัดไป
    target.lastAttackAt = 0;
    log('✨ Steal สำเร็จ!' + (target.stealLootName ? ' ได้ ' + target.stealLootName + ' เข้ากระเป๋าแล้ว' : ' (รอ inventory update)'));
  }
  let sellState = 'IDLE';         // IDLE|WARP_TO_NPC|MOVE_TO_NPC|TALK|SELECT_SELL|SELL|WARP_BACK
  let sellStateAt = 0;            // timestamp เข้า state (watchdog)
  let sellReturnTo = null;        // {map,x,y} ที่จะวาร์ปกลับหลังขาย
  let sellNpcId = null;           // NPC entity id (หาจาก entities)
  let lastSellAt = 0;             // throttle interval
  // ---------- AUTO-STORAGE state (mirror bot.js:1817-1824) ----------
  let storageState = 'IDLE';      // IDLE|WARP_TO_KAFRA|MOVE_TO_KAFRA|TALK_KAFRA|SELECT_STORAGE|STORAGE_OPENED|MOVE_ITEMS|WITHDRAW_ITEMS|CLOSE_STORAGE|WARP_BACK
  let storageStateAt = 0;         // timestamp เข้า state (watchdog)
  let storageReturnTo = null;     // {map,x,y} ที่จะวาร์ปกลับหลังฝาก
  let storageNpcId = null;        // Kafra entity id
  let storageMoveQueue = [];      // [{itemId, amount, invId, isEquipment}]
  let storageMoveIdx = 0;         // index ใน queue ที่กำลังส่ง
  let storageLastMoveAt = 0;      // throttle MOVE_TO_KAFRA + MOVE_ITEMS
  let storageTransferProgressAt = 0; // packet ย้าย item ล่าสุดที่ส่งได้สำเร็จ
  let storageWarpLastSentAt = 0;  // เวลา warp ไป Kafra ครั้งล่าสุด (retry แบบมีจังหวะ)
  let storageWarpAttempts = 0;    // จำนวนครั้งที่ลอง warp ใน storage run นี้
  let storageKafraMapReadyAt = 0; // MAP_NAME ยืนยันแล้ว รอ NPC spawn ตั้งแต่เวลาใด
  let storageRetryAt = 0;         // backoff หลัง abort กัน loop น้ำหนักเต็ม
  const storageRegularItems = new Map(); // itemId -> count จาก 0x54 (เฉพาะ stackable)
  let storageSnapshotAt = 0;      // เวลาที่ได้รับ 0x54 ล่าสุด

  // ---------- ORE REFINE + SELL (independent manual workflow) ----------
  // Owns only its dialog/warp sequence.  It deliberately never issues MOVE.
  let oreRefineState = 'IDLE';
  let oreRefineStateAt = 0;
  let oreRefineKafraId = null;
  let oreRefineNpcId = null;
  let oreRefineKafraNextRemaining = 0;
  let oreRefineBatch = 0;
  let oreRefineResultBeforeTrade = 0;
  let oreRefineResultServerCount = null; // ยอด Green Live ที่ server ยืนยันหลัง Trade
  let oreRefineNpcWaitLogged = false;
  const ORE_REFINE_STATE_TIMEOUT_MS = 15000;
  let noMonsterSince = 0;        // timestamp ที่เริ่มไม่เจอมอน
  let lastWanderAt = 0;
  let lastNavLogTag = '';   // ★ track last nav log target (กัน spam log)
  let lastFleeAt = 0;
  let fleePlayerDeferredForLoot = false; // เจอผู้เล่นระหว่างยังมี pickup queue → เก็บให้จบก่อนค่อยวาร์ป
  let fleePlayerDetectedAt = 0;          // Date.now(): เริ่มนับ delay ก่อนวาร์ปจากผู้เล่น
  let lastWarpFindAt = 0;        // throttle warpFind กัน spam
  let lastTargetSwitchAt = 0;    // throttle การสลับ target (กันสลับบ่อย)

  // ---------- combat target state ----------
  let target = null;             // {id, x, y, acquiredAt, engageAt, attackProbeAt, lastAttackSignalAt, ...}

  // ---------- WEAPON SET CONTROLLER ----------
  // Interface: ensureWeaponSetForTarget(monster, now) returns true only when combat
  // may proceed. Its implementation owns packet order, acknowledgement and timeout.
  const EQUIP_SLOT_RIGHT = 4;
  const EQUIP_SLOT_LEFT = 5;
  const WEAPON_SWAP_ACK_MS = 700;
  const equippedBagIds = new Map(); // equipSlot -> bagId, updated only by 0x30 IN
  let weaponSwap = null;            // { targetId, setId, setName, actions, pending, startedAt }
  let weaponActiveSetName = '—';

  function weaponSetList() {
    return Array.isArray(CFG.weaponSets) ? CFG.weaponSets : [];
  }
  function getWeaponSetById(id) {
    return weaponSetList().find(s => s && s.id === id) || null;
  }
  function normalizeWeaponSet(set) {
    if (!set) return null;
    const leftMode = ['equip', 'clear', 'keep'].includes(set.leftMode) ? set.leftMode : 'keep';
    return {
      id: String(set.id || ''),
      name: String(set.name || set.id || 'Set'),
      rightBagId: Number(set.rightBagId) > 0 ? Math.round(Number(set.rightBagId)) : null,
      leftMode,
      leftBagId: Number(set.leftBagId) > 0 ? Math.round(Number(set.leftBagId)) : null,
    };
  }
  function weaponRuleMatchesMonster(rule, m) {
    if (!rule || !m) return false;
    const wanted = String(rule.monster ?? '').trim();
    if (!wanted) return false;
    if (/^\d+$/.test(wanted) && Number(wanted) === Number(m.sub)) return true;
    return String(m.name || '').trim().toLowerCase() === wanted.toLowerCase();
  }
  function desiredWeaponSetForMonster(m) {
    if (!CFG.weaponSetEnabled) return null;
    const rules = Array.isArray(CFG.weaponMonsterRules) ? CFG.weaponMonsterRules : [];
    for (const rule of rules) {
      if (!weaponRuleMatchesMonster(rule, m)) continue;
      const matched = normalizeWeaponSet(getWeaponSetById(rule.setId));
      if (matched) return matched;
    }
    return normalizeWeaponSet(getWeaponSetById(CFG.weaponDefaultSetId));
  }
  function weaponBagLabel(bagId) {
    const id = Number(bagId);
    for (const [itemId, slots] of equipmentSlots) {
      if (Array.isArray(slots) && slots.includes(id)) return itemDisplayName(Number(itemId)) + ' (bag ' + id + ')';
    }
    return 'bag ' + id;
  }
  function getWeaponInventoryItems() {
    const out = [];
    const rightBagId = equippedBagIds.get(EQUIP_SLOT_RIGHT);
    const leftBagId = equippedBagIds.get(EQUIP_SLOT_LEFT);
    for (const [itemId, slots] of equipmentSlots) {
      for (const bagId of (slots || [])) {
        const id = Number(bagId);
        out.push({
          bagId: id,
          itemId: Number(itemId),
          name: itemDisplayName(Number(itemId)),
          equipped: id === rightBagId ? 'มือขวา' : id === leftBagId ? 'มือซ้าย' : null,
        });
      }
    }
    return out.sort((a, b) => Number(!!b.equipped) - Number(!!a.equipped) || a.name.localeCompare(b.name) || a.bagId - b.bagId);
  }
  function isWeaponBagProtected(bagId) {
    const id = Number(bagId);
    if (!id) return false;
    if ([...equippedBagIds.values()].includes(id)) return true;
    for (const set of weaponSetList()) {
      const s = normalizeWeaponSet(set);
      if (s && (s.rightBagId === id || (s.leftMode === 'equip' && s.leftBagId === id))) return true;
    }
    return false;
  }
  function resetWeaponSwap(reason) {
    if (weaponSwap && reason) log('⚔️ Weapon set ยกเลิก:', reason);
    weaponSwap = null;
  }
  function completeWeaponSwap(swap) {
    weaponActiveSetName = swap.setName;
    if (target && target.id === swap.targetId) target.weaponSetReadyId = swap.setId;
    weaponSwap = null;
    log('⚔️ Weapon set พร้อม:', weaponActiveSetName);
  }
  function buildWeaponActions(set) {
    const actions = [];
    const rightNow = equippedBagIds.get(EQUIP_SLOT_RIGHT);
    const leftNow = equippedBagIds.get(EQUIP_SLOT_LEFT);
    // clear ก่อนใส่อาวุธสองมือ เช่น Katar: ไม่ให้ server auto-unequip ซ้อนกับคำสั่งเรา
    if (set.leftMode === 'clear' && leftNow) {
      actions.push({ type: 'unequip', bagId: leftNow, hand: 'ซ้าย', slot: EQUIP_SLOT_LEFT });
    }
    // ถ้ายังไม่รู้ state หลัง reload ให้ส่ง equip หนึ่งครั้ง; server จะ silent ถ้าใส่อยู่แล้ว
    if (set.rightBagId && rightNow !== set.rightBagId) {
      actions.push({ type: 'equip', bagId: set.rightBagId, hand: 'ขวา', slot: EQUIP_SLOT_RIGHT });
    }
    if (set.leftMode === 'equip' && set.leftBagId && leftNow !== set.leftBagId) {
      actions.push({ type: 'equip', bagId: set.leftBagId, hand: 'ซ้าย', slot: EQUIP_SLOT_LEFT });
    }
    return actions;
  }
  function advanceWeaponSwap(now) {
    const swap = weaponSwap;
    if (!swap) return true;
    if (swap.pending) {
      if (!swap.pending.confirmed && now - swap.pending.sentAt < WEAPON_SWAP_ACK_MS) return false;
      if (!swap.pending.confirmed) {
        // AlreadyEquipped ได้รับการตอบกลับเงียบจาก server; อย่า lock combat ตลอดไป
        log('⚔️ Weapon set ไม่มี confirm สำหรับ', weaponBagLabel(swap.pending.bagId), '→ ถือว่าใส่อยู่แล้ว');
        if (swap.pending.type === 'equip') equippedBagIds.set(swap.pending.slot, swap.pending.bagId);
        else equippedBagIds.delete(swap.pending.slot);
      }
      swap.pending = null;
    }
    const action = swap.actions.shift();
    if (!action) { completeWeaponSwap(swap); return true; }
    if (!sendEquipItem(action.bagId, action.type === 'equip')) {
      log('⚠️ Weapon set ส่งคำสั่งไม่ได้:', weaponBagLabel(action.bagId));
      completeWeaponSwap(swap); // ไม่ block combat ถ้า socket เปลี่ยนสถานะพอดี
      return true;
    }
    swap.pending = { ...action, sentAt: now, confirmed: false };
    log('⚔️ Weapon set', action.type === 'equip' ? 'สวม' : 'ถอด', action.hand, weaponBagLabel(action.bagId));
    return false;
  }
  function ensureWeaponSetForTarget(m, now) {
    const set = desiredWeaponSetForMonster(m);
    if (!set) return true; // feature off หรือไม่มี default set → combat flow เดิม 100%
    if (target && target.weaponSetReadyId === set.id) return true;
    if (!weaponSwap || weaponSwap.targetId !== target?.id || weaponSwap.setId !== set.id) {
      const actions = buildWeaponActions(set);
      if (!actions.length) {
        weaponActiveSetName = set.name;
        if (target) target.weaponSetReadyId = set.id;
        return true;
      }
      weaponSwap = { targetId: target?.id, setId: set.id, setName: set.name, actions, pending: null, startedAt: now };
      log('⚔️ Weapon set →', set.name, 'ก่อนตี', m.name || m.id.toString(16));
    }
    return advanceWeaponSwap(now);
  }
  function handleWeaponEquipPacket(u) {
    const bagId = u32(u, 1);
    const slot = u[5];
    const isEquip = u[6] !== 0;
    if (slot === EQUIP_SLOT_RIGHT || slot === EQUIP_SLOT_LEFT) {
      if (isEquip) equippedBagIds.set(slot, bagId);
      else if (equippedBagIds.get(slot) === bagId || !equippedBagIds.has(slot)) equippedBagIds.delete(slot);
    }
    const pending = weaponSwap?.pending;
    if (pending && pending.bagId === bagId && ((pending.type === 'equip') === isEquip)) {
      pending.confirmed = true;
    }
  }
  function weaponBagOptions(selected, allowKeep = true) {
    const current = Number(selected) || 0;
    const opts = [];
    if (allowKeep) opts.push('<option value="">ไม่เปลี่ยน</option>');
    for (const it of getWeaponInventoryItems()) {
      const isSelected = it.bagId === current ? ' selected' : '';
      const equipped = it.equipped ? ' — สวม' + it.equipped : '';
      opts.push('<option value="' + it.bagId + '"' + isSelected + '>' + it.name + equipped + ' (bag ' + it.bagId + ')</option>');
    }
    if (current && !getWeaponInventoryItems().some(it => it.bagId === current)) {
      opts.push('<option value="' + current + '" selected>⚠️ bag ' + current + ' (ไม่พบในกระเป๋า)</option>');
    }
    return opts.join('');
  }
  function weaponSetOptions(selected) {
    return weaponSetList().map(s => '<option value="' + String(s.id).replace(/"/g, '&quot;') + '"' + (s.id === selected ? ' selected' : '') + '>' + String(s.name || s.id) + '</option>').join('');
  }
  // Unity/WebGL บังคับให้เราดัก keyboard เอง แต่ input[type=number] อ่านตำแหน่ง cursor ไม่ได้
  // แปลงเป็น text ที่เรียก numeric keypad แทน; ทุก consumer จะ clamp ค่าอีกครั้งเมื่อบันทึก
  function normalizeWebGlNumericInputs(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('input[type="number"]').forEach(inp => {
      const allowsDecimal = String(inp.step || '').toLowerCase() === 'any' || String(inp.step || '').includes('.');
      inp.type = 'text';
      inp.inputMode = allowsDecimal ? 'decimal' : 'numeric';
      inp.autocomplete = 'off';
    });
  }
  function renderWeaponEditor(root) {
    const host = root?.querySelector('#__assist_weaponeditor');
    if (!host) return;
    const sets = weaponSetList();
    const rules = Array.isArray(CFG.weaponMonsterRules) ? CFG.weaponMonsterRules : [];
    const setRows = sets.map((set, index) => {
      const s = normalizeWeaponSet(set) || { id: 'set_' + index, name: 'Set ' + (index + 1), rightBagId: null, leftMode: 'keep', leftBagId: null };
      const removable = s.id !== 'default';
      return `<div data-weapon-set-row data-set-id="${s.id}" style="border:1px solid #3a3f4b;border-radius:6px;padding:7px;margin-top:6px">
        <div class="field"><label>${s.id === 'default' ? 'Default Set (มอนทั่วไป)' : 'Weapon Set'}</label><input data-wset-name value="${s.name.replace(/"/g, '&quot;')}" placeholder="ชื่อ Set"></div>
        <div class="field"><label>มือขวา</label><select data-wset-right title="รายการอุปกรณ์ที่สคริปต์ตรวจพบ">${weaponBagOptions(s.rightBagId)}</select><input data-wset-right-id type="number" min="1" step="1" value="${s.rightBagId || ''}" placeholder="หรือใส่ bagId เอง เช่น 20011" style="margin-top:4px"></div>
        <div class="field"><label>มือซ้าย</label><select data-wset-leftmode><option value="keep"${s.leftMode === 'keep' ? ' selected' : ''}>ไม่เปลี่ยนมือซ้าย</option><option value="clear"${s.leftMode === 'clear' ? ' selected' : ''}>ล้างมือซ้าย</option><option value="equip"${s.leftMode === 'equip' ? ' selected' : ''}>สวมไอเท็มนี้</option></select><select data-wset-left style="margin-top:4px" title="รายการอุปกรณ์ที่สคริปต์ตรวจพบ">${weaponBagOptions(s.leftBagId)}</select><input data-wset-left-id type="number" min="1" step="1" value="${s.leftBagId || ''}" placeholder="หรือใส่ bagId เอง เช่น 20009" style="margin-top:4px"></div>
        ${removable ? '<div class="btns"><button data-weapon-remove-set="' + s.id + '" class="danger">ลบ Set</button></div>' : ''}
      </div>`;
    }).join('');
    const ruleRows = rules.map((rule, index) => `<div data-weapon-rule-row style="display:flex;gap:5px;margin-top:5px">
      <input data-wrule-monster value="${String(rule.monster ?? '').replace(/"/g, '&quot;')}" placeholder="ชื่อมอน หรือ sub-ID" style="min-width:0;flex:1">
      <select data-wrule-set style="min-width:0;flex:1">${weaponSetOptions(rule.setId)}</select>
      <button data-weapon-remove-rule="${index}" class="danger">×</button>
    </div>`).join('');
    host.innerHTML = `
      <div class="btns"><button id="__assist_weaponbtn" class="${CFG.weaponSetEnabled ? 'on' : 'off'}">Weapon Set: ${CFG.weaponSetEnabled ? 'ON' : 'OFF'}</button><button id="__assist_weaponrefresh">↻ รีเฟรชรายการอุปกรณ์</button></div>
      <div style="font-size:10px;color:#9aa0a6;margin-top:5px">ถ้ารายการเลือกว่าง ให้ใส่ <b>bagId</b> จาก WPNCAP ได้โดยตรง (เช่น มีดขวา 20011, มีดซ้าย 20009, กาต้า 20013)</div>
      <div class="field"><label>Default Set — ใช้เมื่อมอนไม่มี Rule</label><select id="__assist_weapondefault">${weaponSetOptions(CFG.weaponDefaultSetId)}</select></div>
      <h4>Weapon Sets</h4>${setRows || '<div style="color:#9aa0a6">ยังไม่มี Set</div>'}
      <div class="btns"><button id="__assist_weaponaddset">+ เพิ่ม Set</button><button id="__assist_weaponsave" class="primary">บันทึก Weapon Set</button></div>
      <h4>Monster Rules</h4>
      <div style="font-size:10px;color:#9aa0a6">เรียงจากบนลงล่าง; ใช้ชื่อมอน เช่น Marse หรือ sub-ID เช่น 1021</div>
      <div id="__assist_weaponrules">${ruleRows}</div>
      <div class="btns"><button id="__assist_weaponaddrule">+ เพิ่ม Rule</button></div>`;
    normalizeWebGlNumericInputs(host);
    host.querySelector('#__assist_weaponbtn').onclick = () => { CFG.weaponSetEnabled = !CFG.weaponSetEnabled; saveConfigDebounced(); renderWeaponEditor(root); log('⚔️ Weapon Set:', CFG.weaponSetEnabled ? 'ON' : 'OFF'); };
    host.querySelector('#__assist_weaponrefresh').onclick = () => { renderWeaponEditor(root); log('⚔️ รีเฟรชรายการอุปกรณ์:', getWeaponInventoryItems().length, 'ชิ้น'); };
    host.querySelectorAll('[data-wset-right]').forEach(select => select.onchange = () => {
      const input = select.parentElement.querySelector('[data-wset-right-id]');
      if (input && select.value) input.value = select.value;
    });
    host.querySelectorAll('[data-wset-left]').forEach(select => select.onchange = () => {
      const input = select.parentElement.querySelector('[data-wset-left-id]');
      if (input && select.value) input.value = select.value;
    });
    host.querySelector('#__assist_weaponaddset').onclick = () => {
      const id = 'set_' + Date.now().toString(36);
      CFG.weaponSets = [...weaponSetList(), { id, name: 'Set ' + weaponSetList().length, rightBagId: null, leftMode: 'keep', leftBagId: null }];
      renderWeaponEditor(root);
    };
    host.querySelector('#__assist_weaponaddrule').onclick = () => {
      CFG.weaponMonsterRules = [...rules, { monster: '', setId: CFG.weaponDefaultSetId || 'default' }];
      renderWeaponEditor(root);
    };
    host.querySelectorAll('[data-weapon-remove-set]').forEach(btn => btn.onclick = () => {
      const id = btn.getAttribute('data-weapon-remove-set');
      CFG.weaponSets = weaponSetList().filter(s => s.id !== id);
      CFG.weaponMonsterRules = rules.filter(r => r.setId !== id);
      if (CFG.weaponDefaultSetId === id) CFG.weaponDefaultSetId = 'default';
      renderWeaponEditor(root);
    });
    host.querySelectorAll('[data-weapon-remove-rule]').forEach(btn => btn.onclick = () => {
      const idx = Number(btn.getAttribute('data-weapon-remove-rule'));
      CFG.weaponMonsterRules = rules.filter((_, i) => i !== idx);
      renderWeaponEditor(root);
    });
    host.querySelector('#__assist_weaponsave').onclick = () => {
      const nextSets = [...host.querySelectorAll('[data-weapon-set-row]')].map(row => ({
        id: row.getAttribute('data-set-id'),
        name: row.querySelector('[data-wset-name]').value.trim() || row.getAttribute('data-set-id'),
        rightBagId: Number(row.querySelector('[data-wset-right-id]').value) || Number(row.querySelector('[data-wset-right]').value) || null,
        leftMode: row.querySelector('[data-wset-leftmode]').value,
        leftBagId: Number(row.querySelector('[data-wset-left-id]').value) || Number(row.querySelector('[data-wset-left]').value) || null,
      }));
      const validIds = new Set(nextSets.map(s => s.id));
      const nextRules = [...host.querySelectorAll('[data-weapon-rule-row]')].map(row => ({
        monster: row.querySelector('[data-wrule-monster]').value.trim(),
        setId: row.querySelector('[data-wrule-set]').value,
      })).filter(r => r.monster && validIds.has(r.setId));
      CFG.weaponSets = nextSets;
      CFG.weaponDefaultSetId = host.querySelector('#__assist_weapondefault').value;
      if (!validIds.has(CFG.weaponDefaultSetId)) CFG.weaponDefaultSetId = 'default';
      CFG.weaponMonsterRules = nextRules;
      saveConfigDebounced();
      resetWeaponSwap('แก้ config');
      renderWeaponEditor(root);
      log('⚔️ บันทึก Weapon Set:', nextSets.length, 'set /', nextRules.length, 'rule');
    };
  }
  // Attack-follow ที่ยังไม่มี hit/miss ไม่ใช่ combat จริง: กันยืนรอ maxEngageSec ทั้งที่ไปไม่ถึง
  const FOLLOW_NO_COMBAT_STALL_MS = 3000;
  const FOLLOW_NO_COMBAT_MAX_MS = 8000;
  let lastWalkPos = null;        // พิกัด player ล่าสุดที่ server ยืนยัน สำหรับ stuck detection
  let lastWalkProgressAt = 0;    // เวลาที่ player ขยับจริงล่าสุด
  let stuckRecoveryAt = 0;       // เวลาเริ่มส่ง MOVE แก้ทางหลัง player นิ่งนาน
  let stuckRecoveryUsed = false; // แก้ทางได้สูงสุดหนึ่งครั้งต่อเป้าหมาย
  let stuckWalkCount = 0;
  let stuckAbandonCount = 0;
  let stuckAbandonHistory = [];  // timestamps ใน 60s
  const warpToMonsterCount = new Map(); // entityId -> count

  // ---------- combat helpers ----------
  function nowMs() { return Date.now(); }
  // whitelist/blacklist matching (รองรับทั้งชื่อ + sprite id แบบ number)
  function matchList(entity, list) {
    if (!list || !list.length) return false;
    return list.some(e => {
      if (typeof e === 'number') return entity.sub === e;
      return entity.name && entity.name.toLowerCase() === String(e).toLowerCase();
    });
  }

  // คืน player คนอื่นที่อยู่ใกล้มอนพอจะถือว่าเป็นพื้นที่ของเขา
  // ใช้ helper เดียวกับ isTargetable และการ re-check เป้าปัจจุบัน เพื่อไม่ให้สอง flow ตัดสินไม่ตรงกัน
  function findOtherPlayerNearMonster(m, now) {
    if (!m || m.x == null || m.y == null) return null;
    const radius = Math.max(0, Number(CFG.playerProximityRadius) || 0);
    for (const e of entities.values()) {
      // ต้องมี name กัน ghost/provisional entity ที่ยังไม่ยืนยันว่าเป็นผู้เล่น
      if (e.kind !== 0 || !e.alive || e.id === playerId || e.x == null || !e.name || isStaleId(e.id, now)) continue;
      if (Math.hypot(e.x - m.x, e.y - m.y) <= radius) return e;
    }
    return null;
  }

  // ใช้เฉพาะก่อนที่ server จะยืนยันว่าเราเริ่มสู้มอนตัวนี้จริง (_claimedByMe)
  // เมื่อเราตีติดแล้ว ผู้เล่นอื่นมาแจมภายหลังไม่ทำให้ bot ทิ้งเป้าปัจจุบัน
  function targetYieldReason(m, now) {
    if (!m || m._claimedByMe) return '';
    const antiKsWindowMs = Math.max(0, Number(CFG.antiKSCooldownMs) || 0);
    if (CFG.antiKS && m._lastEngagedByOtherAt && now - m._lastEngagedByOtherAt < antiKsWindowMs) {
      return 'antiKS: คนอื่นกำลังตีอยู่';
    }
    if (CFG.avoidOtherPlayers) {
      const other = findOtherPlayerNearMonster(m, now);
      if (other) return 'avoidPlayers: ใกล้ผู้เล่น ' + other.name;
    }
    return '';
  }

  // target อาจถูกเลือกก่อน packet ของผู้เล่น/การโจมตีอีกฝ่ายจะมาถึง โดยเฉพาะหลังวาร์ป
  // จึง re-check ทุก tick ก่อน Weapon/Skill/Attack/MOVE และปล่อยเป้าได้เฉพาะตอนที่เรายังไม่ claim
  function yieldUnclaimedTargetToOtherPlayer(m, now) {
    if (!target || target.id !== m?.id || m?._claimedByMe) return false;
    const reason = targetYieldReason(m, now);
    if (!reason) return false;
    const cooldownMs = Math.max(0, Number(CFG.antiKSCooldownMs) || 0);
    abandonTarget('หลบมอนคนอื่น — ' + reason, false, cooldownMs);
    return true;
  }

  function isTargetable(m, now) {
    if (!m || !m.alive) return false;
    if (m.id === FAIL || m.id === 0) return false;        // sentinel / invalid entity IDs
    if (isRadarPlayerId(m.id, now)) return false;          // minimap ยืนยันว่าเป็นผู้เล่น
    if (m.kind !== 1) return false;                       // ตีเฉพาะ monster
    if (m.x == null || m.y == null) return false;
    if (isStaleId(m.id, now)) return false;               // ★ skip stale player IDs (phantom)
    // ★ ข้ามมอนที่เพิ่ง abandon (กันเลือกตัวเดิมซ้ำทันที → วนลูป)
    const ab = abandonCooldown.get(m.id);
    if (ab && now < ab) return false;
    if (ab && now >= ab) abandonCooldown.delete(m.id);    // หมดอายุ → ล้าง
    // ★ ผ่อน guard: ต้องเคยเห็น SPAWN (มี sub) หรืออยู่ใกล้ตัวเรามาก (≤12 ช่อง — NPC มักนิ่ง ไม่ใช่อันตราย)
    //   กัน ghost entity ไกลๆ แต่ยอมรับมอนใกล้ที่อาจยังไม่ได้ SPAWN
    if (m.sub == null) {
      if (player.x == null) return false;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > 12) return false;                           // ghost ไกล → ข้าม (รอ SPAWN)
    }
    if (matchList(m, CFG.targetBlacklist)) return false;
    if (CFG.targetWhitelist.length && !matchList(m, CFG.targetWhitelist)) return false;
    // anti-KS: ข้ามมอนที่คนอื่นตีอยู่ — ★ ยกเว้นถ้าเรา claim แล้ว (mirror world.js:1855 !e._claimedByMe)
    if (CFG.antiKS && !m._claimedByMe && m._lastEngagedByOtherAt && now - m._lastEngagedByOtherAt < CFG.antiKSCooldownMs) return false;
    // avoid players: ข้ามมอนที่อยู่ใกล้ผู้เล่นคนอื่น — ★ ยกเว้นถ้าเรา claim (mirror world.js:1851 !e._claimedByMe)
    if (CFG.avoidOtherPlayers && !m._claimedByMe) {
      if (findOtherPlayerNearMonster(m, now)) return false;
    }
    return true;
  }
  function getMonsters(now) {
    const out = [];
    for (const m of entities.values()) {
      if (isTargetable(m, now || nowMs())) out.push(m);
    }
    return out;
  }
  function countMonsters(radius) {
    if (player.x == null) return 0;
    const now = nowMs();
    let n = 0;
    for (const m of entities.values()) {
      if (m.kind !== 1 || !m.alive || m.x == null) continue;
      if (isStaleId(m.id, now)) continue;   // ★ skip stale player IDs (mirror world.js:1904)
      if (Math.hypot(m.x - player.x, m.y - player.y) <= radius) n++;
    }
    return n;
  }
  const normalizedPlayerName = (name) => String(name || '').split('\0')[0].trim().toLocaleLowerCase();
  function isFleePlayerException(entity) {
    const name = normalizedPlayerName(entity?.name);
    if (!name || !Array.isArray(CFG.fleePlayerExceptions)) return false;
    return CFG.fleePlayerExceptions.some(exception => normalizedPlayerName(exception) === name);
  }
  // ผู้เล่นจาก minimap marker อาจไม่มีชื่อ จึงห้ามใช้ชื่อเป็นเงื่อนไข
  function countOtherPlayers(radius) {
    if (player.x == null) return 0;
    const now = nowMs();
    let n = 0;
    for (const e of entities.values()) {
      if (e.kind !== 0 || !e.alive || e.id === playerId || e.x == null || e.y == null) continue;
      if (isStaleId(e.id, now)) continue;
      if (isFleePlayerException(e)) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) <= radius) n++;
    }
    return n;
  }
  function findNearbyMvp(radius) {
    if (player.x == null) return null;
    const now = nowMs();
    for (const e of entities.values()) {
      if (!e.alive || (!e._isBoss && !e._isMiniBoss) || e.x == null || e.y == null) continue;
      if (isStaleId(e.id, now)) continue;
      const distance = Math.hypot(e.x - player.x, e.y - player.y);
      if (distance <= radius) return { entity: e, distance };
    }
    return null;
  }
  // นับมอนที่ aggro เรา (MONSTER_SKILL dstId=player) ที่ยังมีอยู่จริง — สำหรับ UI/แสดงผล
  function getAggroCount(radius) {
    const now = nowMs();
    let n = 0;
    for (const [id, t] of monsterAggro) {
      if (now - t > (CFG.aggroKeepAliveMs || 10000)) { monsterAggro.delete(id); continue; }
      const m = entities.get(id);
      if (!m || !m.alive || m.x == null) { monsterAggro.delete(id); continue; }
      if (isStaleId(id, now)) { monsterAggro.delete(id); continue; }
      if (player.x != null && radius && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
      n++;
    }
    return n;
  }
  // ★ getThreatCount = max(aggro, nearby) — สำหรับ flee logic (mirror world.js:1018-1044)
  function getThreatCount(radius) {
    return Math.max(getAggroCount(radius), radius ? countMonsters(radius) : 0);
  }
  function getMobAttackerCount(radius) {
    const now = nowMs();
    let n = 0;
    for (const [id, t] of mobAttackers) {
      if (now - t >= CFG.fleeMobWindowMs) { mobAttackers.delete(id); continue; }   // หมดอายุ → ลบ
      if (isStaleId(id, now)) { mobAttackers.delete(id); continue; }              // stale player ID → ลบ
      const m = entities.get(id);
      if (!m || !m.alive || m.x == null) { mobAttackers.delete(id); continue; }   // entity หาย → ลบ
      // ถ้าระบุ radius → นับเฉพาะในรัศมี (เหมือน aggro)
      if (radius && player.x != null && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
      n++;
    }
    return n;
  }
  // คำนวณ HP% (default 1.0 ถ้าไม่รู้)
  function monsterHpPct(m) { return (m.hpMax && m.hpMax > 0 && m.hp != null) ? m.hp / m.hpMax : 1.0; }
  // เลือกมอนใกล้สุด ในรัศมีที่กำหนด (default = maxAcquireDistance)
  function findNearestMonster(now, radius) {
    if (player.x == null) return null;
    const cap = (radius != null) ? radius : CFG.maxAcquireDistance;
    let best = null, bestD = Infinity;
    for (const m of getMonsters(now)) {
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > cap) continue;   // ★ เกินรัศมีที่กำหนด → ข้าม
      if (d < bestD) { bestD = d; best = m; }
    }
    return best ? { m: best, dist: bestD } : null;
  }
  // เลือกมอน HP% ต่ำสุด (tiebreak = ระยะ) ในรัศมีที่กำหนด
  function findLowestHpMonster(now, radius) {
    if (player.x == null) return null;
    const cap = (radius != null) ? radius : CFG.maxAcquireDistance;
    let best = null, bestHp = 2, bestD = Infinity;
    for (const m of getMonsters(now)) {
      const hp = monsterHpPct(m);
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d > cap) continue;   // ★ เกินรัศมีที่กำหนด → ข้าม
      if (hp < bestHp || (hp === bestHp && d < bestD)) { bestHp = hp; bestD = d; best = m; }
    }
    return best ? { m: best, dist: bestD, hpPct: bestHp } : null;
  }

  // ---------- combat encoders ----------
  // ATTACK OUT: [0b][target_id:4]
  let lastAttackSentAt = 0;        // ★ timestamp ที่เราส่ง ATTACK ล่าสุด
  let lastAttackSentTarget = null; // ★ targetId ที่เราส่ง ATTACK ใส่
  function sendAttack(targetId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5);
    b[0] = 0x0b;
    b[1] = targetId & 0xff; b[2] = (targetId >> 8) & 0xff;
    b[3] = (targetId >> 16) & 0xff; b[4] = (targetId >>> 24) & 0xff;
    activeWS.send(b);
    lastAttackSentAt = nowMs();    // ★ track เพื่อ heuristic anti-KS ใน 0x17
    lastAttackSentTarget = targetId;
    return true;
  }
  // EQUIP/UNEQUIP OUT (live capture): [30][bagId:4 LE][isEquip:1]
  function sendEquipItem(bagId, isEquip = true) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const id = Math.round(Number(bagId));
    if (!Number.isInteger(id) || id <= 0) return false;
    const b = new Uint8Array(6);
    b[0] = 0x30;
    b[1] = id & 0xff; b[2] = (id >> 8) & 0xff;
    b[3] = (id >> 16) & 0xff; b[4] = (id >>> 24) & 0xff;
    b[5] = isEquip ? 1 : 0;
    activeWS.send(b);
    return true;
  }
  // ★ SKILL OUT (mirror protocol.js:223-248):
  //   targeted (sub=01): [1d][01][targetId:4][skillId:1][level:1]  — Bash, Charge Attack
  //   AoE/self (sub=05): [1d][05][skillId:2 LE][level:1]           — Magnum Break, Two-Hand Quicken
  // ★ SKILL OUT (mirror protocol.js:223-248 + capture Arrow Shower):
  //   targeted (sub=01): [1d][01][targetId:4][skillId:1][level:1]  — Bash, Charge Arrow
  //   ground (sub=04):   [1d][04][x:2][y:2][skillId:1][level:1]    — Arrow Shower (เลือกพื้นที่)
  //   AoE/self (sub=05): [1d][05][skillId:2 LE][level:1]           — Magnum Break, Quicken
  let lastSkillPacketAt = 0, lastSkillPacketId = null; // global cast lane — ต่างจาก cooldown ที่เป็นราย skill
  let manualSkillQueue = [];
  let manualSkillQueueTimer = null;
  let autoSupportQueue = [];      // snapshot คิว self/ally เพื่อไม่ scan แล้วสลับลำดับทุก tick
  function skillCommandGapMs() {
    return Math.max(250, Number(CFG.skillCommandGapMs) || 1500);
  }
  function skillCommandWaitMs(nextSkillId, now = nowMs()) {
    // Retry สกิลเดิม (โดยเฉพาะ Steal) ใช้ cooldown ของตัวเอง; global gap มีไว้กันสกิลคนละชนิดชนกัน.
    if (lastSkillPacketId === Number(nextSkillId)) return 0;
    return Math.max(0, lastSkillPacketAt + skillCommandGapMs() - now);
  }

  function sendSkill(skillId, level, targetId, groundX, groundY) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    // Serialise only transitions between different skills.  Repeating one
    // skill is paced by that skill's own cooldown/result lifecycle.
    if (skillCommandWaitMs(skillId) > 0) return false;
    if (targetId != null) {
      // ★ targeted: [1d][01][targetId:4][skillId:1][level:1]
      const b8 = new Uint8Array(8);
      b8[0] = 0x1d; b8[1] = 0x01;
      b8[2] = targetId & 0xff; b8[3] = (targetId >> 8) & 0xff;
      b8[4] = (targetId >> 16) & 0xff; b8[5] = (targetId >>> 24) & 0xff;
      b8[6] = skillId & 0xff;
      b8[7] = level & 0xff;
      activeWS.send(b8);
    } else if (groundX != null && groundY != null) {
      // ★ ground-targeted: [1d][04][x:2 LE][y:2 LE][skillId:1][level:1]
      const b = new Uint8Array(8);
      b[0] = 0x1d; b[1] = 0x04;
      b[2] = groundX & 0xff; b[3] = (groundX >> 8) & 0xff;
      b[4] = groundY & 0xff; b[5] = (groundY >> 8) & 0xff;
      b[6] = skillId & 0xff;
      b[7] = level & 0xff;
      activeWS.send(b);
    } else {
      // ★ AoE/self-cast: [1d][05][skillId:2 LE][level:1]
      const b = new Uint8Array(5);
      b[0] = 0x1d; b[1] = 0x05;
      b[2] = skillId & 0xff; b[3] = (skillId >> 8) & 0xff;
      b[4] = level & 0xff;
      activeWS.send(b);
    }
    lastSkillPacketAt = nowMs();
    lastSkillPacketId = Number(skillId);
    return true;
  }
  // ★ Auto-Skill tracking (mirror bot.js:48-56)
  const lastSkillUse = new Map();        // skillId → timestamp (cooldown)
  const skillUsesOnTarget = new Map();   // skillId → Map<targetId, count> (maxUsesPerTarget)
  // persist skill times ข้าม session
  const SKILL_TIMES_KEY = 'roPureSkillTimes_v1';
  function loadSkillTimes() {
    try {
      const raw = localStorage.getItem(SKILL_TIMES_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const [id, ts] of Object.entries(obj)) lastSkillUse.set(Number(id), Number(ts) || 0);
      log('✨ โหลดเวลา skill ล่าสุด:', lastSkillUse.size, 'รายการ');
    } catch (e) {}
  }
  function saveSkillTimes() {
    try {
      const obj = {};
      for (const [id, ts] of lastSkillUse) obj[id] = ts;
      localStorage.setItem(SKILL_TIMES_KEY, JSON.stringify(obj));
    } catch (e) {}
  }
  let skillSaveTimer = null;
  function saveSkillTimesDebounced() {
    if (skillSaveTimer) clearTimeout(skillSaveTimer);
    skillSaveTimer = setTimeout(saveSkillTimes, 1000);
  }

  // Manual “use skills now” is intentionally a queue, never a burst.  It
  // bypasses the per-skill timing rules by user request, but shares the same
  // global cast lane as Auto-Skill so the two flows cannot collide.
  function queueSkillsNow() {
    if (!CFG.skills.length) { log('⚠️ ยังไม่ได้ตั้ง skills'); return; }
    if (!activeWS || activeWS.readyState !== 1) { log('⚠️ ใช้ skill ไม่ได้: ยังไม่ได้ต่อ WebSocket'); return; }

    const jobs = [];
    for (const skill of CFG.skills) {
      if (!skill || skill.skillId == null) continue;
      if (skill.ally && playerId == null) {
        log('⚠️ ข้าม', skill.name || ('skill_' + skill.skillId), ': ยังไม่รู้ player_id');
        continue;
      }
      if ((skill.targeted || skill.ground) && !skill.selfCast && !skill.ally && !target) {
        log('⚠️ ข้าม', skill.name || ('skill_' + skill.skillId), ': ไม่มีมอนเป้าหมาย');
        continue;
      }
      let groundX = null, groundY = null;
      if (skill.ground) {
        const monster = target && entities.get(target.id);
        if (!monster || monster.x == null || monster.y == null) {
          log('⚠️ ข้าม', skill.name || ('skill_' + skill.skillId), ': ไม่มีพิกัดมอนเป้าหมาย');
          continue;
        }
        groundX = Math.round(monster.x); groundY = Math.round(monster.y);
      }
      jobs.push({
        skill,
        targetId: skill.ally ? playerId : ((skill.targeted && !skill.selfCast && !skill.ground) ? target.id : null),
        groundX, groundY,
      });
    }
    manualSkillQueue = jobs; // a second click replaces the old manual request, never doubles it
    if (manualSkillQueueTimer) { clearTimeout(manualSkillQueueTimer); manualSkillQueueTimer = null; }
    if (!manualSkillQueue.length) return;
    log('✨ เข้าคิวใช้ skill', manualSkillQueue.length, 'รายการ · เว้น', (skillCommandGapMs() / 1000).toFixed(1) + 's');
    drainManualSkillQueue();
  }

  function drainManualSkillQueue() {
    manualSkillQueueTimer = null;
    if (!manualSkillQueue.length) return;
    if (!activeWS || activeWS.readyState !== 1) {
      log('⚠️ ยกเลิกคิว skill: WebSocket หลุด');
      manualSkillQueue = [];
      return;
    }
    const wait = skillCommandWaitMs(manualSkillQueue[0].skill.skillId);
    if (wait > 0) {
      manualSkillQueueTimer = setTimeout(drainManualSkillQueue, wait + 10);
      return;
    }
    const job = manualSkillQueue.shift();
    const skill = job.skill;
    if (sendSkill(skill.skillId, skill.level || 1, job.targetId, job.groundX, job.groundY)) {
      lastSkillUse.set(skill.skillId, nowMs());
      saveSkillTimesDebounced();
      log('✨ ใช้ skill จากคิว', skill.name || ('id=' + skill.skillId), '(' + manualSkillQueue.length + ' คิวเหลือ)');
    } else {
      // A packet may race another sender in the shared lane.  Do not mark an
      // unsent skill as used; retry it after the normal inter-cast gap.
      manualSkillQueue.unshift(job);
    }
    if (manualSkillQueue.length) {
      const next = manualSkillQueue[0];
      manualSkillQueueTimer = setTimeout(drainManualSkillQueue, skillCommandWaitMs(next.skill.skillId) + 10);
    }
  }

  // Self/ally support skills must not depend on Combat being ON.  Unlike the
  // old scanner, this creates a snapshot of every eligible support skill and
  // drains it in list order.  A short cooldown on Heal can therefore never
  // jump ahead of Blessing → Agility → Kyrie midway through a buff round.
  function isIdleSupportSkillReady(skill, now) {
    if (!skill || skill.skillId == null || skill.buffMode || !CFG.skills.includes(skill)) return false;
    if ((!skill.selfCast && !skill.ally) || skill.ground) return false;
    const disabled = Array.isArray(CFG.disabledSkillIds) ? CFG.disabledSkillIds : [];
    if (disabled.includes(skill.skillId) || (skill.ally && playerId == null)) return false;
    // Blessing / Agility / Kyrie are status-backed: re-cast only when the
    // server says their status is absent.  A short acknowledgement guard is
    // needed solely while a cast is in flight; it is not a rebuff countdown.
    if (selfSupportStatusId(skill) != null) {
      if (hasSelfSupportStatus(skill, now) || isSelfSupportStatusPending(skill, now)) return false;
    } else {
      // Skills without a known persistent status retain the existing safe
      // cooldown fallback so they cannot fire every auto-loop tick.
      const lastUse = lastSkillUse.get(skill.skillId) || 0;
      const intervalMin = Number(skill.intervalMin) || 0;
      if (intervalMin > 0 ? (lastUse > 0 && now - lastUse < intervalMin * 60 * 1000) : (now - lastUse < (skill.cooldownMs ?? 2000))) return false;
    }
    const spMin = skill.spMin ?? 0;
    if (spMin > 0 && sp.cur != null && sp.cur < spMin) return false;
    const hpBelow = Number(skill.hpBelowPct) || 0;
    return !(hpBelow > 0 && (hpPct() == null || hpPct() >= hpBelow));
  }
  function resetAutoSupportQueue() { autoSupportQueue = []; }
  function tryIdleSelfSupportSkill(now) {
    if (!CFG.skillEnabled || !Array.isArray(CFG.skills) || !CFG.skills.length) { resetAutoSupportQueue(); return false; }
    if (!activeWS || activeWS.readyState !== 1 || isDead || isResting || postRespawnRest) return false;
    if (isAbBuffActive() || storageState !== 'IDLE' || isOreRefineActive()) return false;
    // เป้ากำลัง Cloaking: กัน Auto-Support แย่ง global skill lane ก่อน Sight ได้ทำงาน.
    if (target?.hiddenWaitAt && target.hiddenWaitReason === 'Cloaking') return false;
    // A click on “ใช้ skill เดี๋ยวนี้” is an explicit user request; finish it
    // first so the automatic queue cannot interleave with it.
    if (manualSkillQueue.length || manualSkillQueueTimer) return false;

    while (autoSupportQueue.length && !isIdleSupportSkillReady(autoSupportQueue[0], now)) autoSupportQueue.shift();
    if (!autoSupportQueue.length) {
      autoSupportQueue = CFG.skills.filter(skill => isIdleSupportSkillReady(skill, now));
      if (autoSupportQueue.length > 1) log('🔮 Auto Skill: เข้าคิว', autoSupportQueue.map(skill => skill.name || ('id=' + skill.skillId)).join(' → '));
    }
    const skill = autoSupportQueue[0];
    if (!skill) return false;
    const skillTarget = skill.ally ? playerId : null;
    if (!sendSkill(skill.skillId, skill.level || 1, skillTarget, null, null)) return false;

    autoSupportQueue.shift();
    lastSkillUse.set(skill.skillId, now);
    if (selfSupportStatusId(skill) != null) selfSupportPendingUntil.set(skill.skillId, now + SELF_SUPPORT_CONFIRM_MS);
    saveSkillTimesDebounced();
    const spInfo = sp.cur != null ? (sp.max ? ` ${sp.cur}/${sp.max}` : ` ${sp.cur}`) : ' ?';
    log('✨ ใช้สกิล', skill.name || ('id=' + skill.skillId), skill.ally ? ' (ally→ตัวเอง · Auto queue)' : ' (self · Auto queue)', '(sp' + spInfo + ' เหลือคิว=' + autoSupportQueue.length + ')');
    return true;
  }
  // MOVE OUT (click-move): [07][x:i16][y:i16] (signed)
  // game รับ click-move ได้จริงไม่เกิน 16 ช่อง; สั่งไกลกว่านี้ถูกตัดและเป็น fingerprint ของบอท
  const MOVE_MAX_DIST = 16;
  function sendMove(x, y) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    if (player.x != null && player.y != null) {
      const dx = x - player.x, dy = y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > MOVE_MAX_DIST) { x = player.x + dx / d * MOVE_MAX_DIST; y = player.y + dy / d * MOVE_MAX_DIST; }
    }
    const b = new Uint8Array(5);
    b[0] = 0x07;
    writeI16LE(b, 1, Math.round(x));
    writeI16LE(b, 3, Math.round(y));
    navBotMoving = true;   // ★ flag: บอทสั่งเอง → handleOut ข้ามไม่บันทึก trail
    activeWS.send(b);
    return true;
  }
  // วาร์ปสุ่มในแมปปัจจุบัน (x=y=-999)
  function sendRandomWarp() {
    // หลัง reload userscript ระหว่างอยู่ในเกม อาจพลาด MAP_NAME packet ทำให้ currentMap ยังว่าง
    // สำหรับ safety flee ใช้ farmMap ที่ผู้ใช้ตั้งไว้เป็น fallback แทนการยืนค้างต่อหน้าผู้เล่น
    const mapName = currentMap || CFG.farmMap;
    if (!mapName) { log('⚠️ วาร์ปหนีไม่ได้: ยังไม่รู้แมปปัจจุบันและไม่ได้ตั้ง farmMap'); return false; }
    if (!currentMap) log('ℹ️ วาร์ปหนี: ยังไม่รู้แมปปัจจุบัน → ใช้ farmMap', mapName);
    return sendTeleport(mapName, -999, -999, 'safety-flee');
  }
  // SIT/STAND OUT: [0e][state:1] (1=นั่ง, 0=ยืน) — format ยืนยันจากบอทหลัก protocol.js:381
  function sendSit() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x0e, 0x01]));
    return true;
  }
  function sendStand() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x0e, 0x00]));
    return true;
  }
  // ★ RESPAWN OUT: [29][00] — respawn กลับจุด save หลังตาย (2 bytes)
  //   format ยืนยันจากบอทหลัก protocol.js:356-360 (enc.respawn() = Buffer.from([0x29, 0x00]))
  function sendRespawn() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x29, 0x00]));
    return true;
  }
  // ★ CHAT OUT: [2c][msg_len:2 LE][msg UTF-8][chat_type:1]
  //   chatType: 0=nearby, 1=shout, 2=whisper (mirror protocol.js:362-369 enc.chat)
  function sendChat(message, chatType) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    if (!message) return false;
    const msgBytes = new TextEncoder().encode(message);
    if (msgBytes.length > 200) return false;   // cap 200 (mirror bot_server.js:1740)
    const b = new Uint8Array(1 + 2 + msgBytes.length + 1);
    b[0] = 0x2c;
    b[1] = msgBytes.length & 0xff; b[2] = (msgBytes.length >> 8) & 0xff;
    b.set(msgBytes, 3);
    b[3 + msgBytes.length] = chatType || 0;
    activeWS.send(b);
    return true;
  }
  // EMOTE OUT: [36][emote_id:4 LE]
  // source server mapping: /lv = 3 (heart), /hp = 47 (HP bubble)
  function sendEmote(emoteId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const id = Number(emoteId);
    if (!Number.isInteger(id) || id < 0 || id > 100) return false;
    const b = new Uint8Array(5);
    b[0] = 0x36;
    b[1] = id & 0xff; b[2] = (id >>> 8) & 0xff;
    b[3] = (id >>> 16) & 0xff; b[4] = (id >>> 24) & 0xff;
    activeWS.send(b);
    return true;
  }

  // ---------- AB BUFF controller ----------
  function setAbBuffState(next, reason = '') {
    if (abBuffState !== next) dbg('⛪ AB Buff:', abBuffState, '→', next, reason ? '(' + reason + ')' : '');
    if (abBuffState !== next) abBuffWaitBlockerTag = '';
    abBuffState = next;
  }
  function stopAbBuff(reason) {
    if (abBuffState !== 'IDLE') log('⛪ AB Buff หยุด:', reason);
    setAbBuffState('IDLE', reason);
    abBuffNextAt = 0;
    abBuffPendingStartedAt = 0;
    abBuffAttemptStartedAt = 0;
    abBuffDisableAfterReturn = false;
    abBuffWaitBlockerTag = '';
  }
function abBuffTimeoutMs() {
  // ค่า config เป็น "วินาที" จึง clamp ขั้นต่ำที่ 30 วินาทีก่อนแปลงเป็น ms
  const configuredSec = Number(CFG.abBuffTimeoutSec);
  return Math.max(30, Number.isFinite(configuredSec) && configuredSec > 0 ? configuredSec : 180) * 1000;
}
  function abBuffTimerNow() { return nowMs(); }
  // กัน timestamp เก่าจาก userscript instance ก่อนหน้า/clock ที่ไม่สอดคล้องกัน
  // ไม่ปล่อยให้เวลาที่เริ่มอยู่ "อนาคต" จน AB timeout รอไม่จบ
  function normalizeAbBuffTimerStart(startedAt, timerNow, label) {
    const started = Number(startedAt);
    if (Number.isFinite(started) && started > 0 && started <= timerNow) return started;
    if (startedAt) log('⚠️ AB Buff reset timer ' + label + ' ที่ไม่ถูกต้อง');
    return timerNow;
  }
  function abBuffRemainingMs(startedAt, timerNow) {
    const started = Number(startedAt);
    if (!Number.isFinite(started) || started <= 0) return null;
    // status ต้องไม่แสดงเวลาหลายชั่วโมงเมื่อ start จาก instance/clock เก่า
    if (started > timerNow) return abBuffTimeoutMs();
    return Math.max(0, abBuffTimeoutMs() - (timerNow - started));
  }
  // อยู่แมพเดียวกันอย่างเดียวไม่พอ: respawn อาจกลับ prontera แต่คนละจุดรับบัพ
  function isAtAbBuffLocation() {
    const x = Number(CFG.abBuffX), y = Number(CFG.abBuffY);
    return currentMap === CFG.abBuffMap
      && player.x != null && player.y != null
      && Number.isFinite(x) && Number.isFinite(y)
      && Math.round(player.x) === Math.round(x)
      && Math.round(player.y) === Math.round(y);
  }
  function beginAbBuffTravel() {
    const timerNow = abBuffTimerNow();
    if (!CFG.abBuffMap || !CFG.farmMap) {
      CFG.abBuffEnabled = false;
      saveConfigDebounced();
      stopAbBuff('ยังไม่ได้ตั้ง AB map หรือ farm map');
      log('⚠️ AB Buff ปิดเอง: ต้องตั้งทั้งแผนที่รับบัพและแมปฟาร์ม');
      return;
    }
    abBuffPendingStartedAt = 0;
    if (!abBuffAttemptStartedAt) abBuffAttemptStartedAt = timerNow;
    setAbBuffState('WARP_TO_AB', 'เริ่มเดินทางรับบัพ');
    if (isAtAbBuffLocation()) {
      if (isWarpGuardActive()) return;
      setAbBuffState('HP1', 'อยู่ที่จุดรับบัพแล้ว');
      abBuffNextAt = timerNow;
      log('⛪ อยู่ที่จุดรับบัพแล้ว → เริ่มส่ง /hp');
      return;
    }
    abBuffNextAt = timerNow + 5000; // ถ้าวาร์ปไม่เปลี่ยนแมป ให้ลองใหม่ภายหลัง ไม่ spam packet
    if (sendTeleport(CFG.abBuffMap, CFG.abBuffX, CFG.abBuffY, 'ab-buff-to-source')) {
      log('⛪ บัพไม่ครบ (' + missingAbBuffNames(timerNow).join(', ') + ') → วาร์ปไป', CFG.abBuffMap, '@(', CFG.abBuffX, CFG.abBuffY + ')');
    } else {
      abBuffNextAt = timerNow + 1000;
      log('⚠️ AB Buff วาร์ปไม่ได้: socket ไม่พร้อม');
    }
  }
  function resumeAbBuffAfterSafetyFlee() {
    if (!isAbBuffActive()) return;
    setAbBuffState('WARP_TO_AB', 'flee ระหว่างรับบัพ');
    abBuffNextAt = abBuffTimerNow() + 1500;
    log('⛪ flee ฉุกเฉินระหว่างรับบัพ → กลับไปจุด AB ใหม่');
  }
  function beginAbBuffReturnDelay() {
    if (abBuffState === 'BUFF_COMPLETE_DELAY' || abBuffState === 'RETURN_FARM') return;
    const configuredDelay = Number(CFG.abBuffReturnDelayMs);
    const delay = Number.isFinite(configuredDelay) ? Math.max(0, configuredDelay) : 3000;
    setAbBuffState('BUFF_COMPLETE_DELAY', 'ได้รับบัพครบ');
    abBuffNextAt = abBuffTimerNow() + delay;
    log('⛪ ได้ Increase Agility + Blessing ครบ → รอ ' + (delay / 1000).toFixed(1) + 's ก่อนวาร์ปกลับฟาร์ม');
  }
  // เส้นทางกลับฟาร์มมีทั้งกรณีอยู่แมปฟาร์มอยู่แล้ว และกรณีวาร์ปกลับมาภายหลัง
  // ต้องปิด config ก่อน reset state เสมอเมื่อรอบนี้จบเพราะ timeout
  function finishAbBuffReturn(reason) {
    const disableAfterReturn = abBuffDisableAfterReturn;
    if (disableAfterReturn) {
      CFG.abBuffEnabled = false;
      saveConfigDebounced();
      log('⛪ AB Buff: OFF (timeout)');
    }
    stopAbBuff(reason);
  }
  function returnFromAbBuff(doneReason = 'ได้ Buff ครบแล้ว → กลับฟาร์ม') {
    const timerNow = abBuffTimerNow();
    if (!CFG.farmMap) {
      finishAbBuffReturn('ไม่พบ farm map');
      return;
    }
    setAbBuffState('RETURN_FARM', doneReason);
    if (currentMap === CFG.farmMap) {
      finishAbBuffReturn(doneReason);
      return;
    }
    abBuffNextAt = timerNow + 5000;
    if (sendTeleport(CFG.farmMap, CFG.farmMapX, CFG.farmMapY, 'ab-buff-return')) {
      log(abBuffDisableAfterReturn
        ? '⛪ AB Buff timeout → วาร์ปกลับแมปฟาร์ม'
        : '⛪ ได้ Increase Agility + Blessing ครบ → วาร์ปกลับแมปฟาร์ม');
    } else {
      abBuffNextAt = timerNow + 1000;
      log('⚠️ AB Buff วาร์ปกลับฟาร์มไม่ได้: socket ไม่พร้อม');
    }
  }
  function failAbBuffAndReturn() {
    const timeoutMs = abBuffTimeoutMs();
    abBuffDisableAfterReturn = true;
    log('⚠️ AB Buff รอครบ ' + Math.round(timeoutMs / 60000) + ' นาทีแล้วยังขาด (' + missingAbBuffNames(abBuffTimerNow()).join(', ') + ') → กลับฟาร์ม แล้วปิด AB Buff');
    returnFromAbBuff('AB Buff timeout → กลับฟาร์มและปิดระบบ');
  }
  const abBuffLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    const timerNow = abBuffTimerNow();      // timer ภายใน AB ต้องเป็น clock เดียวกันทั้งหมด
    for (const [statusId, effect] of abBuffEffects) {
      if (effect.expiresAt <= timerNow) abBuffEffects.delete(statusId);
    }
    if (!CFG.abBuffEnabled) {
      if (abBuffState !== 'IDLE') stopAbBuff('ผู้ใช้ปิดระบบ');
      return;
    }
    if (!activeWS || activeWS.readyState !== 1 || isDead) return;
    if (abBuffState === 'IDLE') {
      if (hasAllAbBuffs(timerNow)) return;
      setAbBuffState('PENDING_IDLE', 'รอ combat/loot จบ');
      abBuffPendingStartedAt = timerNow;
      log('⛪ บัพไม่ครบ (' + missingAbBuffNames(timerNow).join(', ') + ') → รอให้ตี/เก็บของรอบปัจจุบันจบก่อน');
      return;
    }
    if (abBuffState === 'PENDING_IDLE') {
      if (hasAllAbBuffs(timerNow)) {
        stopAbBuff('บัพกลับมาครบระหว่างรอ');
        return;
      }
      // รอนานเกินค่ารับบัพ = ยกเลิกเฉพาะ AB Buff; ไม่ส่งวาร์ปและไม่ตัด combat/loot กลางคัน
      const pendingTimeoutMs = abBuffTimeoutMs();
      abBuffPendingStartedAt = normalizeAbBuffTimerStart(abBuffPendingStartedAt, timerNow, 'PENDING_IDLE');
      if (timerNow - abBuffPendingStartedAt >= pendingTimeoutMs) {
        CFG.abBuffEnabled = false;
        saveConfigDebounced();
        stopAbBuff('รอให้ combat/loot จบนานเกิน ' + (pendingTimeoutMs / 1000).toFixed(0) + 's → ปิด AB Buff');
        return;
      }
      // ยาฮีลหมดจริงและ HP ยังต่ำ: ไม่ควรรอให้สู้จนตายเพื่อหา idle ตามปกติ
      // รอ pickup/loot ที่ได้รับสิทธิ์แล้วให้หมดก่อนเสมอ แต่ยกเลิกเป้ามอนปัจจุบันและลุกไปจุด AB ได้
      if (heal.isEmergency() && !isLootCommandLocked() && sellState === 'IDLE' && storageState === 'IDLE') {
        if (isResting) {
          sendStand();
          isResting = false;
          restUntil = 0;
        }
        if (target) abandonTarget('ยาฮีลหมด → ไปขอ AB Buff', false);
        log('⚠️ ยาฮีลหมดขณะ HP ต่ำ → ไปจุด AB Buff ทันที');
        beginAbBuffTravel();
        return;
      }
      const blockers = abBuffTravelBlockers(timerNow);
      const blockerTag = blockers.join('|');
      if (blockerTag) {
        if (blockerTag !== abBuffWaitBlockerTag) {
          abBuffWaitBlockerTag = blockerTag;
          log('⛪ AB Buff รอ:', blockers.join(' · '));
        }
        return;
      }
      if (abBuffWaitBlockerTag) {
        abBuffWaitBlockerTag = '';
        log('⛪ AB Buff: งานก่อนหน้าจบแล้ว → เดินทางไปรับบัพ');
      }
      beginAbBuffTravel();
      return;
    }
    // ครบเวลานับตั้งแต่เริ่มเดินทาง/รับบัพ แต่ยังไม่ครบทั้งสองสถานะ → จบรอบโดยไม่ส่ง emote ซ้ำ
    if (abBuffAttemptStartedAt) {
      abBuffAttemptStartedAt = normalizeAbBuffTimerStart(abBuffAttemptStartedAt, timerNow, 'รับบัพ');
    }
    if (abBuffState !== 'RETURN_FARM' && !hasAllAbBuffs(timerNow)
      && abBuffAttemptStartedAt && timerNow - abBuffAttemptStartedAt >= abBuffTimeoutMs()) {
      failAbBuffAndReturn();
      return;
    }
    if (abBuffState === 'WARP_TO_AB') {
      if (hasAllAbBuffs(timerNow)) {
        beginAbBuffReturnDelay();
      } else if (currentMap === CFG.abBuffMap && isWarpGuardActive()) {
        // MAP_NAME อาจมาก่อนตำแหน่งหลังวาร์ป: รอ guard เดิมก่อนส่ง emote แรก
        return;
      } else if (isAtAbBuffLocation()) {
        setAbBuffState('HP1', 'ถึงจุดรับบัพ');
        abBuffNextAt = timerNow;
        log('⛪ ถึงจุดรับบัพและพร้อมแล้ว → เริ่มส่ง /hp');
      } else if (timerNow >= abBuffNextAt) {
        beginAbBuffTravel();
      }
      return;
    }
    if (abBuffState === 'RETURN_FARM') {
      if (currentMap === CFG.farmMap) {
        finishAbBuffReturn(abBuffDisableAfterReturn
          ? 'AB Buff timeout → กลับฟาร์มและปิดระบบ'
          : 'กลับแมปฟาร์มแล้ว');
      }
      else if (timerNow >= abBuffNextAt) returnFromAbBuff();
      return;
    }
    if (abBuffState === 'BUFF_COMPLETE_DELAY') {
      if (!hasAllAbBuffs(timerNow)) {
        setAbBuffState('WAIT_BUFF', 'บัพหายระหว่างรอกลับฟาร์ม');
        abBuffNextAt = timerNow;
      } else if (timerNow >= abBuffNextAt) {
        returnFromAbBuff();
      }
      return;
    }
    if (hasAllAbBuffs(timerNow)) {
      beginAbBuffReturnDelay();
      return;
    }
    // ส่ง /hp, /hp, /lv, /lv ครบเพียงหนึ่งรอบแล้วรอ status packet เฉย ๆ
    // ไม่ส่ง /lv ซ้ำระหว่างรอ เพื่อไม่รบกวนผู้ให้บัพหรือสแปม emote.
    if (abBuffState === 'WAIT_BUFF') return;
    if (timerNow < abBuffNextAt) return;
    const delay = Math.max(1000, Number(CFG.abBuffCommandIntervalMs) || 5000);
    let emoteId = null, emoteName = '';
    let nextState = abBuffState;
    if (abBuffState === 'HP1') { emoteId = 47; emoteName = '/hp'; nextState = 'HP2'; }
    else if (abBuffState === 'HP2') { emoteId = 47; emoteName = '/hp'; nextState = 'LV1'; }
    else if (abBuffState === 'LV1') { emoteId = 3; emoteName = '/lv'; nextState = 'LV2'; }
    else if (abBuffState === 'LV2') { emoteId = 3; emoteName = '/lv'; nextState = 'WAIT_BUFF'; }
    if (emoteId == null) return;
    if (sendEmote(emoteId)) {
      setAbBuffState(nextState, 'ส่ง emote ' + emoteName);
      abBuffNextAt = timerNow + delay;
      log('⛪ AB Buff ส่ง emote', emoteName, abBuffState === 'WAIT_BUFF' ? '→ รอ Buff ครบ' : '');
    } else {
      abBuffNextAt = timerNow + 1000;
    }
  }, 200);
  // SELL encoders (mirror protocol.js:367,386,394)
  function sendNpcTalk(npcId) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5); b[0] = 0x4c;
    b[1] = npcId & 0xff; b[2] = (npcId >> 8) & 0xff; b[3] = (npcId >> 16) & 0xff; b[4] = (npcId >>> 24) & 0xff;
    activeWS.send(b); return true;
  }
  function sendNpcSelect(idx) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(5); b[0] = 0x4f;
    b[1] = idx & 0xff; b[2] = (idx >> 8) & 0xff; b[3] = (idx >> 16) & 0xff; b[4] = (idx >>> 24) & 0xff;
    activeWS.send(b); return true;
  }
  // [57][count:4][itemId:4][count:4] × N
  function sendSellItems(items) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(1 + 4 + items.length * 8);
    let p = 0; b[p++] = 0x57;
    b[p++] = items.length & 0xff; b[p++] = (items.length >> 8) & 0xff; b[p++] = (items.length >> 16) & 0xff; b[p++] = (items.length >>> 24) & 0xff;
    for (const it of items) {
      const id = it.itemId, c = it.count;
      b[p++] = id & 0xff; b[p++] = (id >> 8) & 0xff; b[p++] = (id >> 16) & 0xff; b[p++] = (id >>> 24) & 0xff;
      b[p++] = c & 0xff; b[p++] = (c >> 8) & 0xff; b[p++] = (c >> 16) & 0xff; b[p++] = (c >>> 24) & 0xff;
    }
    activeWS.send(b); return true;
  }
  // [58][tradeEntry:i32][count:i32][suppliedItemCount:i32][suppliedBagId:i32 × N]
  // Captured for Master Scholar: entry=9, count=N, suppliedItemCount=0 (Great Nature is consumed by server recipe).
  function sendNpcTrade(tradeEntry, count, suppliedBagIds = []) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const ids = Array.isArray(suppliedBagIds) ? suppliedBagIds : [];
    const b = new Uint8Array(13 + ids.length * 4);
    const putU32 = (at, value) => {
      const v = Math.max(0, Math.round(Number(value) || 0));
      b[at] = v & 0xff; b[at + 1] = (v >>> 8) & 0xff; b[at + 2] = (v >>> 16) & 0xff; b[at + 3] = (v >>> 24) & 0xff;
    };
    b[0] = 0x58;
    putU32(1, tradeEntry);
    putU32(5, count);
    putU32(9, ids.length);
    ids.forEach((id, index) => putU32(13 + index * 4, id));
    activeWS.send(b);
    return true;
  }
  // ============== STORAGE encoders (mirror protocol.js:371-415) ==============
  // [4e] NPC_NEXT — ไปหน้า dialog ถัดไป (Kafra มีหน้า intro ก่อนเมนู)
  function sendNpcNext() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x4e]));
    return true;
  }
  // [56][01][invId:4][amount:4] — ย้ายของจาก inventory → storage
  //   invId = itemId (stackable) หรือ slotId (equipment)
  //   หลักฐาน: 56 01 f4020000 08000000 → invId=756(Rough Oridecon) amount=8
  function sendStorageMove(invId, amount) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(10); let p = 0;
    b[p++] = 0x56; b[p++] = 0x01;
    b[p++] = invId & 0xff; b[p++] = (invId >> 8) & 0xff; b[p++] = (invId >> 16) & 0xff; b[p++] = (invId >>> 24) & 0xff;
    b[p++] = amount & 0xff; b[p++] = (amount >> 8) & 0xff; b[p++] = (amount >> 16) & 0xff; b[p++] = (amount >>> 24) & 0xff;
    activeWS.send(b); return true;
  }
  // [56][02][storageBagId:4][amount:4] — ย้ายของจาก storage → inventory
  // regular/stack item ใช้ storageBagId = itemId (ยืนยันจาก 0x54 ที่จับได้จริง)
  function sendStorageWithdraw(storageBagId, amount) {
    if (!activeWS || activeWS.readyState !== 1) return false;
    const b = new Uint8Array(10); let p = 0;
    b[p++] = 0x56; b[p++] = 0x02;
    b[p++] = storageBagId & 0xff; b[p++] = (storageBagId >> 8) & 0xff; b[p++] = (storageBagId >> 16) & 0xff; b[p++] = (storageBagId >>> 24) & 0xff;
    b[p++] = amount & 0xff; b[p++] = (amount >> 8) & 0xff; b[p++] = (amount >> 16) & 0xff; b[p++] = (amount >>> 24) & 0xff;
    activeWS.send(b); return true;
  }
  // [56][00] — ปิดหน้าต่าง storage
  function sendStorageClose() {
    if (!activeWS || activeWS.readyState !== 1) return false;
    activeWS.send(new Uint8Array([0x56, 0x00]));
    return true;
  }
  function clearCombatThreat() { monsterAggro.clear(); mobAttackers.clear(); }

  // ---------- combat state machine ----------
  // abandon target + (ถ้าเป็น stuck/ล้มเหลว) ตั้ง cooldown กันเลือกตัวเดิมซ้ำทันที
  //   cooldownMs: 0 = ไม่ตั้ง (เช่น ฆ่าได้/defensive ที่เป็นการเปลี่ยนเป้าปกติ)
  //   stuck ซ้ำหลายเป้าในพื้นที่เดียวกัน = ทางขาด/หน้าผา → วาร์ปทันทีเมื่อครบ threshold
  function recordUnreachable() {
    stuckAbandonHistory.push(nowMs());
    stuckAbandonHistory = stuckAbandonHistory.filter(t => nowMs() - t < 60000);
    stuckAbandonCount = stuckAbandonHistory.length;
    if (CFG.stuckWarpOnAbandon > 0 && stuckAbandonCount >= CFG.stuckWarpOnAbandon) {
      log('🌀 unreachable', stuckAbandonCount, 'ครั้งใน 60s → วาร์ปสุ่ม');
      if (sendRandomWarp()) {
        stuckAbandonCount = 0;
        stuckAbandonHistory = [];
        return true;
      }
    }
    return false;
  }
  function handleUnreachable(m, reason) {
    const targetId = target && target.id;
    // เมื่อเปิด warpToMonster ให้ลองแก้ปัญหาด้วยการวาร์ปไปหาเป้าก่อน
    // การวาร์ปสำเร็จถือว่าแก้ได้ จึงยังไม่นับเป็น unreachable เพื่อไม่ให้ข้ามไปวาร์ปสุ่มทันที
    const used = targetId != null ? (warpToMonsterCount.get(targetId) || 0) : 0;
    if (CFG.warpToMonster && targetId != null && used < CFG.warpToMonsterMaxPerEntity) {
      // reload userscript ระหว่างอยู่ในเกมอาจทำให้ยังไม่ได้รับ 0x12/0x03 ที่บอกชื่อแมป
      // รอชื่อแมปก่อน เพราะไม่มี mapName แล้วส่งวาร์ปตรงไม่ได้ และไม่ควร abandon เป้าทันที
      if (!currentMap) {
        const waitStartedAt = target.unreachableMapWaitAt || 0;
        if (!waitStartedAt) {
          target.unreachableMapWaitAt = nowMs();
          log('⏳ ติดทาง แต่ยังไม่รู้ชื่อแมป → รอวาร์ปไปหา', m.name || targetId.toString(16), '(สูงสุด 5s)');
          return 'WAIT_MAP';
        }
        const waitMs = nowMs() - waitStartedAt;
        if (waitMs < 5000) return 'WAIT_MAP';
        log('⚠️ วาร์ปไปหา', m.name || targetId.toString(16), 'ไม่ได้: ยังไม่รู้ชื่อแมปหลังรอ 5s');
      } else if (sendTeleport(currentMap, m.x, m.y, 'combat-unreachable')) {
        warpToMonsterCount.set(targetId, used + 1);
        log('🌀 unreachable → วาร์ปไปหา', m.name || targetId.toString(16), '@(', m.x, m.y + ')', '(warp', used + 1 + ')');
        return 'TARGET_WARP';
      } else {
        log('⚠️ วาร์ปไปหา', m.name || targetId.toString(16), 'ไม่สำเร็จ: socket ไม่พร้อม');
      }
    }
    if (!CFG.warpToMonster) {
      log('ℹ️ ข้ามวาร์ปไปหามอน: warpToMonster ปิดอยู่');
    } else if (targetId == null) {
      log('ℹ️ ข้ามวาร์ปไปหามอน: target หายก่อนเริ่ม recovery');
    } else if (used >= CFG.warpToMonsterMaxPerEntity) {
      log('ℹ️ ข้ามวาร์ปไปหา', m.name || targetId.toString(16), ': ใช้ครบ', used + '/' + CFG.warpToMonsterMaxPerEntity, 'ครั้งแล้ว');
    }
    // วาร์ปตรงใช้ไม่ได้/ครบโควตาแล้ว จึงนับ failure; ครบ threshold ค่อยเปลี่ยนพื้นที่ด้วยวาร์ปสุ่ม
    if (recordUnreachable()) return 'RANDOM_WARP';
    abandonTarget(reason, false, 15000); // recordUnreachable ไปแล้ว จึงไม่ให้นับซ้ำ
    return 'ABANDONED';
  }
  function abandonTarget(reason, stuck, cooldownMs = 0) {
    if (target) {
      log('🚫 abandon target', target.id, '(' + reason + ')');
      dbg('⚔️ abandon target', target.id, 'reason=' + reason, 'stuck=' + !!stuck, 'cooldown=' + cooldownMs + 'ms');
      if (cooldownMs > 0) abandonCooldown.set(target.id, nowMs() + cooldownMs);
      // ★ เคลียร์ claim (mirror bot.js:3914-3916) — กันมอนที่ abandon ดึงกลับมาวนลูป
      const e = entities.get(target.id);
      if (e && e._claimedByMe) e._claimedByMe = false;
      if (stuck) {
        recordUnreachable();
      }
    }
    target = null;
    resetWeaponSwap('abandon');
    stuckWalkCount = 0;
    resetWalkProgress();
    resetCombatGatChase();
  }
  function doFlee(reason) {
    if (!masterBot.enabled()) return false;
    const now = nowMs();
    if (now - lastFleeAt < CFG.fleeCooldownMs) return false;
    log('🏃 วาร์ปหนี:', reason);
    if (sendRandomWarp()) {
      lastFleeAt = now;
      clearCombatThreat();
      abandonTarget('flee', false);
      resumeAbBuffAfterSafetyFlee();
      return true;
    }
    // ใช้ cooldown เดิมกัน retry/log รัวเมื่อ socket หรือ map state ยังไม่พร้อม
    lastFleeAt = now;
    log('⚠️ วาร์ปหนีไม่สำเร็จ — จะลองใหม่หลัง cooldown');
    return false;
  }

  function resetFleePlayerDelay() {
    fleePlayerDetectedAt = 0;
    fleePlayerDeferredForLoot = false;
  }

  // Player Flee มีทางตัดสินใจเดียว: packet event, post-warp scan และ combat loop เรียกที่นี่ร่วมกัน
  // คืน true ระหว่างนับ delay/เก็บของ/cooldown เพื่อห้าม flow อื่น (พัก/เดิน/ตี) แทรก
  function fleePlayersIfNeeded(reasonSuffix = '') {
    if (!masterBot.enabled()) return false;
    // AI Reply ต้อง hold การวาร์ปจนสนทนาจบ แต่ห้ามล้างเวลาที่เริ่มพบผู้เล่นแล้ว
    // เมื่อผู้พูดออกจากระยะตอบ หากยังมีคนอยู่ใน Flee radius จะวาร์ปได้ทันที
    // หาก delay ครบไปก่อนแล้ว แทนที่จะเริ่มนับ delay ใหม่อีกรอบ
    if (isAiReplyInteractionActive()) return false;
    if (shouldHoldFleePlayer() || !CFG.fleeOnPlayerCount || CFG.fleeOnPlayerCount <= 0) {
      resetFleePlayerDelay();
      return false;
    }
    if (player.x == null || player.y == null) {
      resetFleePlayerDelay();
      return false;
    }
    const radius = CFG.fleeOnPlayerRadius || 10;
    const playerCount = countOtherPlayers(radius);
    if (playerCount < CFG.fleeOnPlayerCount) {
      resetFleePlayerDelay();
      return false;
    }
    const now = nowMs();
    const delaySec = Math.max(0, Math.min(10, Number(CFG.fleeOnPlayerDelaySec) || 0));
    const delayMs = Math.round(delaySec * 1000);
    if (!fleePlayerDetectedAt) {
      fleePlayerDetectedAt = now;
      dbg('👤 Flee Player พบผู้เล่น:', playerCount + ' คน', 'radius=' + radius, 'delay=' + delaySec.toFixed(1) + 's');
      if (delayMs > 0) log('👤 เจอผู้เล่นอื่น ' + playerCount + ' คน → รอ ' + delaySec.toFixed(1) + 's ก่อนวาร์ป');
    }
    // ของที่เข้า queue แล้วเป็นของที่เรามีสิทธิ์เก็บ: อย่าวาร์ปตัดทิ้งกลางคัน
    // ไม่รอ warpQueue เพราะเป็นฟีเจอร์วาร์ปไปเก็บของแยก และอาจยืด flow ออกไปไม่สิ้นสุด
    if (CFG.lootEnabled && (queue.size > 0 || pickupPending != null)) {
      if (!fleePlayerDeferredForLoot) {
        fleePlayerDeferredForLoot = true;
        dbg('👤 Flee Player defer: รอ loot queue', 'queue=' + queue.size, 'pickup=' + (pickupPending ? 1 : 0));
        log('📦 เจอผู้เล่น → เก็บของในคิวให้เสร็จก่อน แล้วค่อยวาร์ปหนี');
      }
      return true; // lock combat/rest/wander ระหว่างรอ loot loop ทำงาน
    }
    fleePlayerDeferredForLoot = false;
    if (now - fleePlayerDetectedAt < delayMs) return true;
    isResting = false;
    postRespawnRest = false;
    if (doFlee('เจอผู้เล่นอื่น ' + playerCount + ' คน ในระยะ ' + radius + ' ช่อง' + reasonSuffix)) resetFleePlayerDelay();
    return true;
  }

  // ดักทันทีเมื่อ packet ยืนยันผู้เล่นเข้ามา โดยไม่รอ combat tick
  function instantFleeCheck(e) {
    if (!masterBot.enabled()) return;
    if (!e || e.kind !== 0 || !e.alive || e.id === playerId || e.x == null || e.y == null) return;
    const radius = CFG.fleeOnPlayerRadius || 10;
    if (player.x == null || Math.hypot(e.x - player.x, e.y - player.y) > radius) return;
    fleePlayersIfNeeded(' (⚡ ทันที)');
  }

  // ตรวจซ้ำเพียงรอบเดียวหลังวาร์ปสำเร็จ ใช้ count/doFlee เดียวกับ combat loop
  // ไม่มี path Flee แยก และยังเคารพ hold ของ AB Buff / Storage ตามเดิม
  function runPostWarpFleeScan() {
    if (!masterBot.enabled()) return false;
    postWarpFleeScanPending = false;
    return fleePlayersIfNeeded(' (หลังวาร์ป)');
  }
  function acquireTarget(now) {
    // ★ cooldown: กันสลับ target บ่อยเกินไป (สลับได้ทุก 1.5s)
    if (now - lastTargetSwitchAt < 1500) return null;
    // whitelist ว่าง = ตีทุกมอน kind=1 (ตามความหมายของ whitelist); ตั้งค่า = ตีเฉพาะที่ match
    const mobCount = getMobAttackerCount();
    const useLowestHp = CFG.targetLowestHpFirst && mobCount >= 2;
    // ★ progressive search — ค้นจากรัศมีเล็กก่อน ถ้าเจอใช้เลย
    //   searchRadii หาเป้าได้ไกลกว่า acquire ได้ แต่ห้ามเกิน maxChaseDistance
    const radii = (Array.isArray(CFG.searchRadii) && CFG.searchRadii.length > 0)
      ? [...CFG.searchRadii].sort((a, b) => a - b)
      : [CFG.maxAcquireDistance];
    let found = null;
    let usedRadius = 0;
    for (const r of radii) {
      const radius = Math.min(Math.max(0, Number(r) || 0), CFG.maxChaseDistance);
      if (radius <= 0) continue;
      found = useLowestHp ? findLowestHpMonster(now, radius) : findNearestMonster(now, radius);
      if (found) { usedRadius = radius; break; }   // ★ เจอแล้วใช้เลย ไม่ขยายรัศมี
    }
    if (!found) return null;
    if (useLowestHp) {
      log('🎯 เลือกเป้า HP ต่ำสุด (รุม', mobCount, 'ตัว):', found.m.name, (found.hpPct * 100).toFixed(0) + '%', '@', found.dist.toFixed(1), '(r≤' + usedRadius + ')');
    } else {
      log('🎯 เลือกเป้าใกล้สุด:', found.m.name, '@', found.dist.toFixed(1), '(r≤' + usedRadius + ')');
    }
    const m = found.m;
    target = {
      id: m.id, name: m.name, sub: m.sub, x: m.x, y: m.y, acquiredAt: now, engageAt: 0,
      lastAttackAt: 0, lastAttackResultAt: 0, lastAttackSignalAt: 0,
      attackProbeAt: 0, attackProbePos: null, followObservedAt: 0, lastFollowPos: null, lastFollowMoveAt: 0,
      hiddenWaitAt: 0, hiddenWaitReason: '', cloakingCastAt: 0, cloakingActiveAt: 0, cloakingRemovedAt: 0,
      stuckCount: 0, warpCount: 0, lastDist: null,
    };
    lastWalkToTargetAt = 0;
    resetWalkProgress();
    resetCombatGatChase();

    lastTargetSwitchAt = now;
    skillUsesOnTarget.clear();   // ★ reset per-target skill uses (mirror bot.js:4083)
    return target;
  }
  function isHiddenWaitTarget(m) {
    if (!m || !Array.isArray(CFG.hiddenWaitMonsters) || !CFG.hiddenWaitMonsters.length) return false;
    return matchList(m, CFG.hiddenWaitMonsters);
  }
  function hiddenWaitTimeoutMs() {
    return Math.max(1, Number(CFG.hiddenWaitSec) || 4) * 1000;
  }
  // Sight ต้องเป็น reaction ของ Cloaking ที่ยืนยันแล้วเท่านั้น: ไม่ปนกับ Auto-Skill
  // และไม่ยิงซ้ำเพียงเพราะ entity เดิมส่ง 0x1b/0x3d หลายรอบ.
  function tryRevealHiddenTargetWithSight(m, now = nowMs()) {
    if (!CFG.hiddenSightEnabled || !target || !isHiddenWaitTarget(m || target)) return false;
    if (target.sightAttemptedAt) return false;
    // คำสั่ง “ใช้ skill เดี๋ยวนี้” ของผู้ใช้มี priority สูงกว่า reaction อัตโนมัติ.
    if (manualSkillQueue.length || manualSkillQueueTimer) return false;
    if (hasActiveSight(now)) {
      if (!target.sightActiveLogged) {
        target.sightActiveLogged = true;
        log('👁️', target.name || target.id.toString(16), 'ซ่อน แต่ Sight ยังทำงาน → ไม่ใช้ซ้ำ');
      }
      return false;
    }
    // sendSkill ใช้ lane กลางร่วมกับ Auto-Skill/Manual Skill; tick ถัดไปจะลองอีกครั้งถ้า lane ยังไม่ว่าง.
    if (sightPendingUntil > now) return false;
    const mobX = m?.x ?? target.x, mobY = m?.y ?? target.y;
    if (player.x == null || player.y == null || mobX == null || mobY == null) return false;
    const gridDistance = Math.max(Math.abs(mobX - player.x), Math.abs(mobY - player.y));
    if (gridDistance > SIGHT_RADIUS) {
      if (!target.sightRangeLogged) {
        target.sightRangeLogged = true;
        log('👁️', target.name || target.id.toString(16), 'ซ่อน อยู่นอกระยะ Sight', gridDistance + '/' + SIGHT_RADIUS, 'ช่อง → รอเข้าระยะ');
      }
      return false;
    }
    if (sp.cur != null && sp.cur < SIGHT_SP_COST) {
      if (!target.sightSpLogged) {
        target.sightSpLogged = true;
        log('⚠️ Sight ไม่พอ SP', sp.cur + '/' + SIGHT_SP_COST, '→ รอมอนกลับตาม hidden wait');
      }
      return false;
    }
    if (!sendSkill(SIGHT_SKILL_ID, 1, null, null, null)) return false;
    target.sightAttemptedAt = now;
    sightPendingUntil = now + SIGHT_CONFIRM_MS;
    log('👁️ ใช้ Sight เปิด', target.name || target.id.toString(16), '(Cloaking ยืนยันแล้ว)');
    return true;
  }
  function hasFreshCloakingEvidence(now = nowMs()) {
    if (!target?.cloakingCastAt) return false;
    const age = now - target.cloakingCastAt;
    return age >= 0 && age <= CLOAKING_EVIDENCE_WINDOW_MS;
  }
  // คืน true เมื่อเป้าควรเข้า HIDDEN_WAIT แทน flow unreachable/despawn ปกติ
  function beginHiddenWait(m, reason, now = nowMs()) {
    if (!target || !isHiddenWaitTarget(m || target) || !hasFreshCloakingEvidence(now)) return false;
    if (!target.hiddenWaitAt) {
      target.hiddenWaitAt = now;
      target.hiddenWaitReason = reason;
      target.despawnCheckAt = 0;
      target.stealPending = false;
      target.stealInventorySnapshot = null;
      log('🫥', m?.name || target.name || target.id.toString(16), 'ซ่อน/หาย → รอ', (hiddenWaitTimeoutMs() / 1000).toFixed(1) + 's', 'ก่อน abandon');
    }
    return true;
  }
  function targetActivityAfter(m, at) {
    return Math.max(
      m?._lastSeenAt || 0,
      m?._lastDamageAt || 0,
      target?.lastAttackSignalAt || 0,
      monsterAggro.get(target?.id) || 0,
      mobAttackers.get(target?.id) || 0
    ) > at;
  }
  // ส่ง Attack ใหม่หลัง target กลับจาก HIDDEN_WAIT; ไม่ reuse probe เก่าที่อาจค้างจากตอน Cloaking
  function resumeAttackAfterHiddenWait(m, now) {
    if (!target || !sendAttack(target.id)) return false;
    target.hiddenWaitAt = 0;
    target.hiddenWaitReason = '';
    target.cloakingCastAt = 0;
    target.cloakingActiveAt = 0;
    target.cloakingRemovedAt = 0;
    target.despawnCheckAt = 0;
    target.lastAttackAt = now;
    target.attackProbeAt = now;
    target.attackProbePos = { x: player.x, y: player.y };
    target.followObservedAt = 0;
    target.lastFollowPos = { x: player.x, y: player.y };
    target.lastFollowMoveAt = 0;
    if (!target.engageAt) target.engageAt = now;
    log('👁️', m.name || target.name || target.id.toString(16), 'กลับมา → Attack ใหม่');
    return true;
  }
  // เดินไปหามอน — ใช้ GAT A* เมื่อพร้อม; ปิด/ยังไม่มี GAT จึง fallback เป็นเส้นตรงเดิม
  let lastWalkToTargetAt = 0;
  const STUCK_NO_MOVE_MS = 5000;
  const STUCK_RECOVERY_GRACE_MS = 3000;
  const abandonCooldown = new Map();   // entityId → timestamp ที่ abandon (กันเลือกตัวเดิมซ้ำเลย)
  function resetWalkProgress() {
    lastWalkPos = null;
    lastWalkProgressAt = 0;
    stuckRecoveryAt = 0;
    stuckRecoveryUsed = false;
  }
  function walkToTarget(now, m, desiredDistance = CFG.maxAcquireDistance) {
    if (player.x == null) return false;
    const gatResult = combatGatChaseStep(now, m, desiredDistance);
    if (gatResult !== null) return gatResult;
    const dist = Math.hypot(m.x - player.x, m.y - player.y);

    // state นี้พึ่งพาเฉพาะพิกัด player ที่ server ยืนยัน—not จำนวน MOVE ที่เราส่ง
    const playerMoved = lastWalkPos && (player.x !== lastWalkPos.x || player.y !== lastWalkPos.y);
    if (!lastWalkPos) {
      lastWalkPos = { x: player.x, y: player.y };
      lastWalkProgressAt = now;
      lastWalkToTargetAt = 0;
    } else if (playerMoved) {
      lastWalkPos = { x: player.x, y: player.y };
      lastWalkProgressAt = now;
      stuckRecoveryAt = 0;
    }

    const noMoveMs = now - lastWalkProgressAt;
    // เปิด warpToMonster แล้ว: ไม่ต้องสุ่มแก้ทาง เพราะวาร์ปตรงไปพิกัดมอนเร็วและแน่นอนกว่า
    if (CFG.warpToMonster && noMoveMs >= CFG.attackProbeMs) {
      log('🚧 ไม่มี player position update ' + (noMoveMs / 1000).toFixed(1) + 's → ตรวจพบติดทาง');
      return 'STUCK';
    }
    let recoveryMove = false;
    if (noMoveMs >= STUCK_NO_MOVE_MS) {
      if (stuckRecoveryAt && now - stuckRecoveryAt >= STUCK_RECOVERY_GRACE_MS) {
        log('🚧 stuck: ไม่มี player position update ' + (noMoveMs / 1000).toFixed(1) + 's @ dist ' + dist.toFixed(1));
        return 'STUCK';
      }
      // เคยแก้ทางแล้วแต่กลับมาติดอีก: อย่าวน MOVE แก้ทางซ้ำไม่จำกัด
      if (stuckRecoveryUsed) {
        log('🚧 stuck: ยังไปต่อไม่ได้หลังแก้ทาง @ dist ' + dist.toFixed(1));
        return 'STUCK';
      }
      if (!stuckRecoveryAt) {
        stuckRecoveryAt = now;
        stuckRecoveryUsed = true;
        recoveryMove = true;  // ส่ง MOVE แก้ทางเพียงครั้งเดียว แล้วรอพิกัดใหม่
      } else {
        return false;
      }
    } else if (!playerMoved && lastWalkToTargetAt > 0) {
      return false; // ส่ง MOVE แล้วรอ server ยืนยันการขยับก่อน ไม่ spam ทุก 800ms
    } else if (now - lastWalkToTargetAt < 800) {
      return false;
    }

    lastWalkToTargetAt = now;

    // เดินเฉพาะให้กลับเข้า acquire range; เมื่อเข้าแล้วให้ ATTACK ของเกมเดินตามมอนเอง
    const distanceToWalk = Math.max(0, dist - desiredDistance);
    if (!recoveryMove && distanceToWalk < 0.5) return false;
    let angle = Math.atan2(m.y - player.y, m.x - player.x);
    // รอบ recovery เดินออกด้านข้างเพื่อหาทางอ้อม; รอบปกติเดินเข้าหาเป้าโดยมี jitter เล็กน้อย
    if (recoveryMove) angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
    else angle += (Math.random() * 2 - 1) * (Math.PI / 12);
    const step = recoveryMove
      ? Math.min(6, Math.max(3, distanceToWalk))  // ก้าวหลบสั้น ๆ ไม่วิ่งออกนอกเส้นทางไกลเกินไป
      : Math.min(distanceToWalk, CFG.walkStepDistance);
    const tx = player.x + Math.cos(angle) * step;
    const ty = player.y + Math.sin(angle) * step;
    if (sendMove(tx, ty)) { log(recoveryMove ? '🚶 แก้ทางไปหา' : '🚶 เดินไปหา', m.name || m.id.toString(16), '@(', Math.round(tx), Math.round(ty) + ') dist=' + dist.toFixed(1) + ' step=' + Math.round(step)); return 'WALKING'; }
    return false;
  }

  let combatCooldownUntil = 0;   // ★ หยุด combat ชั่วคราวจนกว่าจะถึงเวลานี้ (post-combat delay)
  const combatLoop = setInterval(() => {
    if (!masterBot.enabled()) return;
    const now = nowMs();
    tickTeleportCoordinator(now);
    // Auto-Respawn ต้องมาก่อนทุก flow รวมถึง Loot Queue: collector อาจตายระหว่างไปรับ drop
    // หาก return เพราะ activeJob ก่อนถึงจุดนี้ ตัวละครจะค้างตายและไม่มี packet 0x29 ออกไป
    if (isDead) {
      if (CFG.autoRespawnEnabled && activeWS && activeWS.readyState === 1) {
        if (now - lastRespawnAt >= CFG.autoRespawnDelayMs) {
          if (sendRespawn()) {
            lastRespawnAt = now;
            target = null; monsterAggro.clear(); mobAttackers.clear();
            postRespawnRest = true;   // ★ บังคับนั่งพักหลัง respawn
            log('💀 ตาย! → respawn กลับจุด save');
            logImportant('flee', '💀 ตาย → respawn กลับจุด save');
          }
        }
      }
      return;
    }
    // collector มี movement/pickup flow ของ Loot Queue เป็นเจ้าของอยู่
    if (lootQueue.isCollectorBusy()) return;
    // Player Flee เป็น safety flow อิสระจาก Combat: OFF ก็ยังต้องหนีผู้เล่นที่ยืนนิ่งอยู่ได้
    // AB Buff / Storage hold อยู่ภายใน fleePlayersIfNeeded แล้ว
    if (!isDead && activeWS && activeWS.readyState === 1 && fleePlayersIfNeeded()) return;
    // Self/ally support has its own ordered queue and is independent from
    // target acquisition.  It runs before either Combat branch so two skill
    // controllers can never select the same buff concurrently.
    if (tryIdleSelfSupportSkill(now)) return;
    // AI Reply เป็น flow สนทนา ไม่ควรผูกกับ toggle Combat
    // แต่ถ้ามี target ค้างอยู่ จะยังไม่ตอบจนกว่า combat จะจัดการ target นั้นได้
    if (!CFG.combatEnabled) {
      processAiReplyInteraction(now);
      return;
    }
    if (!activeWS || activeWS.readyState !== 1) return;
    // ★ POST-RESPAWN REST — หลัง respawn บังคับนั่งพักจนเลือดเต็ม (restUntilPercent)
    //   เหมือน auto-rest ปกติ แต่ trigger จาก flag postRespawnRest ไม่ใช่ HP%
    if (!isAbBuffActive() && postRespawnRest && CFG.restEnabled && hp.cur != null) {
      const pct = hpPct();
      if (shouldDeferRestForNormalLoot(now)) {
        if (isResting && sendStand()) {
          isResting = false;
          restUntil = 0;
          log('📦 มีของปกติค้าง → ลุกเก็บก่อนพักหลังเกิด');
        }
        return;
      }
      if (!isResting && pct != null && pct < CFG.restUntilPercent) {
        if (sendSit()) {
          isResting = true;
          restUntil = now + CFG.restMaxSec * 1000;
          log('🪑 [post-respawn] นั่งพักจนเลือดเต็ม: HP', pct.toFixed(0) + '% → ' + CFG.restUntilPercent + '%');
        }
        return;
      }
      if (isResting) {
        if (pct != null && pct >= CFG.restUntilPercent || now >= restUntil) {
          if (sendStand()) { log('🪑 [post-respawn] ลุกยืน: HP', pct.toFixed(0) + '% → กลับฟาร์ม'); }
          isResting = false;
          postRespawnRest = false;   // ★ เคลียร์ flag — กลับสู่ฟาร์มปกติ
          combatCooldownUntil = now + CFG.postCombatDelayMs;
        }
        return;   // ยังนั่งอยู่ → หยุดทุกอย่าง
      }
    }
    // AI conversation มี priority เหนือ farm-map guard: เมื่อยืนยันผู้พูดใกล้ตัวแล้ว
    // ห้าม guard วาร์ป/เดินตัดก่อนถึงเวลาตอบ หรือก่อนผู้พูดออกนอกระยะ
    // ถ้ายังต้องฆ่า target เดิม ฟังก์ชันจะคืน false เพื่อปล่อย combat เดิมทำงานต่อ
    if (isAiReplyInteractionActive() && processAiReplyInteraction(now)) return;
    // ★ farm map guard: ถ้าตั้ง farmMap ไว้ และตอนนี้ไม่ได้อยู่แมปฟาร์ม → ไม่ฟาร์ม
    //   + retry วาร์ปกลับทุก 5s (กันติดแมปผิดถ้าวาร์ปครั้งแรกไม่สำเร็จ)
    //   ★★ ยกเว้น sellNpcMap/kafraMap เฉพาะตอนกำลังขาย/ฝากอยู่ (state ≠ IDLE)
    //      ถ้า abort แล้ว (state = IDLE) ต้องวาร์ปกลับฟาร์ม ไม่งั้นติดในเมือง
    const inSellRoutine = sellState !== 'IDLE';
    const inStorageRoutine = storageState !== 'IDLE';
    const inOreRefineRoutine = isOreRefineActive();
    if (!isAbBuffActive() && CFG.farmMap && currentMap && currentMap !== CFG.farmMap
        && !(inSellRoutine && currentMap === CFG.sellNpcMap)
        && !(inStorageRoutine && currentMap === CFG.kafraMap)
        && !(inOreRefineRoutine && currentMap === CFG.oreRefineMap)) {
      const now2 = nowMs();
      if (now2 - (lastFarmWarpBackAt || 0) > 5000) {
        log('🌀 ยังอยู่แมปผิด (' + currentMap + ') → วาร์ปกลับอีกครั้ง');
        sendTeleport(CFG.farmMap, CFG.farmMapX, CFG.farmMapY, 'farm-map-guard-retry');
        lastFarmWarpBackAt = now2;
      }
      return;
    }
    const pct = hpPct();
    const mobCount = getMobAttackerCount();

    // === -1. AUTO-REST (ก่อน flee แต่รองจาก normal auto-loot) ===
    //   ถ้า HP ต่ำ + ไม่โดนรุม → นั่งพัก; แต่หากมี drop ปกติค้าง ให้ลุกเก็บก่อน
    if (!isAbBuffActive() && CFG.restEnabled && pct != null && hp.cur != null) {
      const deferRestForLoot = shouldDeferRestForNormalLoot(now);
      if (deferRestForLoot && isResting) {
        if (sendStand()) {
          isResting = false;
          restUntil = 0;
          log('📦 มีของปกติค้าง → ลุกเก็บก่อนพัก');
        }
      } else if (!deferRestForLoot && !isResting && pct < CFG.restHpPercent && mobCount === 0) {
        // เริ่มนั่งพัก
        if (sendSit()) {
          isResting = true;
          restUntil = now + CFG.restMaxSec * 1000;
          log('🪑 นั่งพัก: HP', pct.toFixed(0) + '% < ' + CFG.restHpPercent + '% (นานสุด ' + CFG.restMaxSec + 's หรือจนถึง ' + CFG.restUntilPercent + '%)');
        }
        return;
      }
      if (isResting) {
        // โดนรุมระหว่างนั่ง → ลุกทันทีเพื่อตีตอบ (ไม่ return — ให้ flee/defensive ทำงานต่อ)
        if (mobCount > 0) {
          if (sendStand()) { log('⚠️ โดนรุมระหว่างนั่ง → ลุกทันที'); }
          isResting = false;
        }
        // ฟื้นถึง restUntilPercent หรือหมดเวลา → ลุก
        else if (pct >= CFG.restUntilPercent || now >= restUntil) {
          if (sendStand()) { log('🪑 ลุกยืน: HP', pct.toFixed(0) + '% (≥ ' + CFG.restUntilPercent + '%)'); }
          isResting = false;
          combatCooldownUntil = now + CFG.postCombatDelayMs;   // พักเล็กน้อยก่อนเริ่ม
        }
        else { return; }   // ยังนั่งอยู่ → หยุดทุกอย่าง
      }
    }

    // === 0. post-combat cooldown — รอหลังสู้เสร็จ/เก็บของเสร็จ ก่อนทำอย่างอื่น ===
    //   ยกเว้น flee (ต้องทำทันทีเสมอเพื่อความปลอดภัย)
    const inCooldown = now < combatCooldownUntil;
    // ★ Flee MVP/Boss, ผู้เล่น และมอนที่ระบุ: ใช้ doFlee เดียวกันเพื่อคุม cooldown/ล้าง target ให้เหมือนกัน
    if (CFG.fleeOnMvp && player.x != null) {
      const threat = findNearbyMvp(CFG.fleeOnMvpRadius || 20);
      if (threat) {
        const label = threat.entity._isBoss ? 'MVP/Boss' : 'Mini Boss';
        doFlee('เจอ ' + label + ' ในระยะ ' + threat.distance.toFixed(1) + ' ช่อง');
        return;
      }
    }
    // ★ flee from specific monsters — เจอมอนอันตรายในระยะ → วาร์ปหนีทันที (mirror bot.js:3241-3281)
    if (CFG.fleeMonsters && CFG.fleeMonsters.length > 0 && player.x != null) {
      const fleeR = CFG.fleeMonsterRadius || 20;
      for (const e of entities.values()) {
        if (!e.alive || e.kind !== 1 || e.x == null) continue;
        if (isStaleId(e.id, now)) continue;
        const name = (e.name || '').toLowerCase();
        const subId = e.sub != null ? String(e.sub) : null;
        const isDanger = CFG.fleeMonsters.some(n => {
          const ns = String(n).toLowerCase();
          if (name && name === ns) return true;
          if (subId && subId === ns) return true;
          return false;
        });
        if (isDanger) {
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d <= fleeR) {
            log('🚨 เจอ', e.name || e.id.toString(16), 'ในระยะ', d.toFixed(1), 'ช่อง → วาร์ปหนี!');
            logImportant('flee', '🚨 หนีมอน! เจอ ' + (e.name || e.id.toString(16)) + ' ในระยะ ' + d.toFixed(0) + ' ช่อง');
            doFlee('เจอ ' + (e.name || e.id.toString(16)) + ' ในระยะ ' + d.toFixed(1) + ' ช่อง');
            return;
          }
        }
      }
    }
    // รุม = มอนโจมตีเราแล้วจริง ๆ; ไม่นำรัศมีมอนรอบมาจำกัด เพราะ ranged attacker ก็ยังเป็นภัย
    const mobAttackCount = getMobAttackerCount();
    if (CFG.fleeOnMobCount > 0 && mobAttackCount >= CFG.fleeOnMobCount) { doFlee('รุม ' + mobAttackCount + ' ตัว'); return; }
    // aggro = มอน lock/ใช้ skill มาที่เรา (0x18) เท่านั้น; ไม่รวมมอนที่แค่เดินผ่านในรัศมี
    const aggroCount = getAggroCount(CFG.fleeOnProximityRadius);
    if (CFG.fleeOnAggroCount > 0 && aggroCount >= CFG.fleeOnAggroCount) { doFlee('aggro ' + aggroCount + ' ตัว'); return; }
    if (CFG.fleeOnProximityCount > 0 && countMonsters(CFG.fleeOnProximityRadius) >= CFG.fleeOnProximityCount) { doFlee('มอนรอบ ' + countMonsters(CFG.fleeOnProximityRadius) + ' ตัว'); return; }
    // AB Buff / Storage / ย่อยแร่ มีสิทธิ์ผ่านเฉพาะ flee เพื่อความปลอดภัยเท่านั้น
    // ห้าม combat, wander และ no-monster warp ส่งคำสั่งทับการวาร์ปไป Kafra/กลับฟาร์ม
    if (isAbBuffActive() || storageState !== 'IDLE' || isOreRefineActive()) return;
    // Heal มี priority เหนือ Attack/Skill ชั่วครู่หลังส่ง item
    // แต่ Flee ทุกชนิดถูกตรวจไปแล้วด้านบน จึงยังหนีภัยได้ทันที
    if (now < heal.commandLockUntil) return;
    // AI interaction: ถ้ามีเป้าค้างอยู่ ให้ฆ่าเป้านั้นให้จบก่อนแม้มี loot เก่ารออยู่
    // หลัง target หาย state นี้จะหยุด acquire/move/warp จนตอบและเก็บเฉพาะของใกล้เท้าเสร็จ
    const aiFinishingCurrentTarget = !!(aiInteraction && aiInteraction.phase === 'FINISH_COMBAT' && target);
    if (!aiFinishingCurrentTarget && processAiReplyInteraction(now)) return;
    // Buff หมดระหว่างฟาร์ม: เป้าปัจจุบันยังเล่นต่อได้ แต่ห้ามเลือกเป้าใหม่
    // เพื่อให้เกิดจุด idle หลังฆ่าและเก็บของรอบนี้เสร็จ แล้ว ABbuff จึงค่อยวาร์ป
    if (isAbBuffPending() && !target) return;
    // หลังฆ่า: รอ packet drop → เก็บจนคิว/คำสั่ง pickup ว่างก่อนเสมอ
    // Flee อยู่ก่อน block นี้แล้ว จึงยังหนีภัยได้ทันที แต่ห้าม Attack/Skill/MOVE เป้าใหม่
    if (!aiFinishingCurrentTarget && isLootCommandLocked(now)) return;
    if (inCooldown && mobCount === 0) return;   // อยู่ใน cooldown + ไม่โดนรุม → รอ

    // === 1c. ★ warp guard — รอ MOVE_UPDATE หลังวาร์ปก่อนคำนวณ dist/Attack
    if (isWarpGuardActive()) return;

    // AI Reply ต้องตรวจซ้ำตรงก่อนเลือกเป้า defensive ด้วย เพราะ target อาจถูกล้าง
    // ระหว่าง lifecycle ของ tick เดียวกัน (เช่น 0x1b/hidden wait/abandon) หลังการตรวจด้านบน
    // ห้ามย้ายไปตีตัวที่สองก่อนเข้าสู่ WAIT_REPLY
    if (isAiReplyInteractionActive()
      && !(aiInteraction.phase === 'FINISH_COMBAT' && target)
      && processAiReplyInteraction(now)) return;

    // === 1b. Defensive target acquire === เลือกมอนที่กำลังตีเราเฉพาะเมื่อยังไม่มีเป้า
    // เป้าปัจจุบันเป็น sticky: ห้ามสลับกลางคัน จนกว่าเป้าจะตาย/หาย หรือเข้าเงื่อนไข abandon อื่น
    if (player.x != null && !target) {
      let attacker = null, attackerDist = Infinity;
      for (const [aid, at] of mobAttackers) {
        if (now - at > CFG.fleeMobWindowMs) { mobAttackers.delete(aid); continue; }
        if (target && aid === target.id) continue;   // ตัวที่กำลังตีอยู่แล้ว → ข้าม
        const am = entities.get(aid);
        if (!am || !am.alive || am.x == null) continue;
        if (!isTargetable(am, now)) continue;         // ตัวที่ตีเราต้อง targetable ด้วย
        const d = Math.hypot(am.x - player.x, am.y - player.y);
        if (d < attackerDist) { attackerDist = d; attacker = am; }
      }
      if (attacker) {
        target = { id: attacker.id, name: attacker.name, sub: attacker.sub, x: attacker.x, y: attacker.y, acquiredAt: now, engageAt: 0, lastAttackAt: 0, lastAttackResultAt: 0, lastAttackSignalAt: 0, attackProbeAt: 0, attackProbePos: null, followObservedAt: 0, lastFollowPos: null, lastFollowMoveAt: 0, hiddenWaitAt: 0, hiddenWaitReason: '', cloakingCastAt: 0, cloakingActiveAt: 0, cloakingRemovedAt: 0, stuckCount: 0, warpCount: 0 };
        resetCombatGatChase();
        lastTargetSwitchAt = now;
        log('🛡️ เลือกเป้า: มอนที่กำลังตีเรา', attacker.name || attacker.id.toString(16));
        return;
      }
    }
    // === 2. HIDDEN_WAIT ===
    // Sleeper ที่ Cloaking อาจส่ง 0x1b หรือหายจาก entity list ชั่วคราว
    // ระหว่างนี้ lock combat command ทั้งหมด; ถ้าได้รับ activity ใหม่จึง Attack target เดิมใหม่ทันที
    if (target && target.hiddenWaitAt) {
      const hiddenMob = entities.get(target.id);
      const cloakingEnded = (target.cloakingRemovedAt || 0) >= target.hiddenWaitAt;
      const waitForCloakingEnd = target.hiddenWaitReason === 'Cloaking';
      // ใช้ Sight เฉพาะเมื่อ server ยืนยัน Cloaking ของเป้าปัจจุบันแล้ว; ไม่ข้าม lane ของสกิลอื่น.
      if (waitForCloakingEnd) tryRevealHiddenTargetWithSight(hiddenMob || target, now);
      // Cloaking ต้องรอ 0x3e จริงเท่านั้น: packet movement/activity ระหว่างซ่อนห้ามปลุก flow Attack
      if (hiddenMob && hiddenMob.alive && (cloakingEnded || (!waitForCloakingEnd && targetActivityAfter(hiddenMob, target.hiddenWaitAt)))) {
        resumeAttackAfterHiddenWait(hiddenMob, now);
        return;
      }
      const waitedMs = now - target.hiddenWaitAt;
      if (waitedMs >= hiddenWaitTimeoutMs()) {
        abandonTarget('ซ่อน/หายเกิน ' + (hiddenWaitTimeoutMs() / 1000).toFixed(1) + 's', false);
        target = null;
      }
      return;
    }

    // === 2. Target validation / abandon ===
    if (target) {
      const m = entities.get(target.id);
      if (!m || !m.alive) {
        if (beginHiddenWait(m, 'target หาย', now)) return;
        abandonTarget('ตาย/หาย', false); target = null;
      }
      else {
        // เป้ายังไม่เคยมีผลโจมตีของเรา: ถ้า packet ของคนอื่นเพิ่งมาถึงตอนเราเดินหา
        // ให้เลิกก่อนถึง Weapon/Skill/Attack/MOVE — ไม่ถือว่าเป็นการทิ้งมอนที่เราตีอยู่จริง
        if (yieldUnclaimedTargetToOtherPlayer(m, now)) return;
        target.x = m.x; target.y = m.y;
        // เก็บระยะไว้สำหรับ debug เท่านั้น: ระยะลดลงไม่ใช่ packet ตอบรับ Attack
        const curDist = (player.x != null) ? Math.hypot(m.x - player.x, m.y - player.y) : Infinity;
        target._lastDist = curDist;
        // abandon เฉพาะเคสจริง: engage นานเกิน; Attack-follow timeout อยู่ใน block Attack ด้านล่าง
        const engageAge = target.engageAt ? (now - target.engageAt) / 1000 : 0;
        const acquireAge = (now - target.acquiredAt) / 1000;
        // ★ มอนยัง "กำลังสู้กับเรา" → ยกเลิก abandon จาก pending/server เงียบ
        //   สัญญาณ 3 อย่าง (อย่างน้อย 1 อย่างล่าสุด):
        //   1. monsterAggro (0x18) — มอนเลือกเราเป็นเป้า
        //   2. mobAttackers — มอนตีเรา
        //   3. _lastDamageAt — เราสร้าง damage ให้มอนได้จริง (สำคัญสำหรับมอนนิ่ง เช่น ไข่/เห็ด ที่ไม่ตีกลับ)
        const targetAggro = monsterAggro.get(target.id);
        const targetHitUs = mobAttackers.get(target.id);
        const targetDamaged = m._lastDamageAt;   // ★ เราตีมอนแล้วโดน (HP ลด)
        const lastCombatSignal = Math.max(targetAggro || 0, targetHitUs || 0, targetDamaged || 0);
        const isTargetStillEngaged = lastCombatSignal && (now - lastCombatSignal < CFG.aggroKeepAliveMs);
        // ★ มอน "ตีช้า" (mushroom/plant/เจาะไม่เข้า) → ใช้ maxEngageSecSlow (ยาวกว่า) กัน abandon ก่อนฆ่าทัน
        const isSlowMonster = m.sub != null && Array.isArray(CFG.slowMonsterSubIds) && CFG.slowMonsterSubIds.includes(m.sub);
        const engageLimit = isSlowMonster ? (CFG.maxEngageSecSlow || 180) : CFG.maxEngageSec;
        if (target.engageAt && engageAge > engageLimit && !isTargetStillEngaged) {
          abandonTarget('engage นาน ' + engageAge.toFixed(0) + 's' + (isSlowMonster ? ' (slow)' : ''), true, 10000); target = null;
        }
        else if (!target.engageAt && acquireAge > engageLimit && !isTargetStillEngaged) {
          abandonTarget('ไม่ได้ตี ' + acquireAge.toFixed(0) + 's', true, 10000); target = null;
        }
      }
    }

    // === 2.5 Despawn check ===
    // 0x1b อาจเป็น transient ระหว่างเดินตามเป้า จึงรอ packet ใหม่ก่อนตัดสิน
    // ระหว่างนี้ lock คำสั่งทั้งหมด เพื่อไม่ให้ Steal/Attack/MOVE ไปทับสถานะของเกม
    if (target && target.despawnCheckAt) {
      const m = entities.get(target.id);
      const checkedAt = target.despawnCheckAt;
      const lastTargetActivity = Math.max(
        m?._lastSeenAt || 0,
        m?._lastDamageAt || 0,
        target.lastAttackSignalAt || 0,
        monsterAggro.get(target.id) || 0,
        mobAttackers.get(target.id) || 0
      );
      if (lastTargetActivity > checkedAt) {
        // มีข้อมูลใหม่ของ target กลับมา: 0x1b รอบนี้เป็น transient
        target.despawnCheckAt = 0;
        if (m) m._despawnPendingAt = 0;
        target.stealPending = false;
        target.stealInventorySnapshot = null;
        target.lastAttackAt = 0;
        target.attackProbeAt = 0;
        target.followObservedAt = 0;
        target.lastFollowPos = null;
        log('✅ target กลับมา after 0x1b → เริ่ม Attack ใหม่');
        return;
      }
      if (now - checkedAt >= 3000) {
        if (m) {
          entities.delete(target.id);
          warpToMonsterCount.delete(target.id);
          monsterAggro.delete(target.id);
          mobAttackers.delete(target.id);
        }
        abandonTarget('despawn confirmed (เงียบ 3s)', false);
        return;
      }
      return;
    }

    // === 2.7 Weapon Set ===
    // ต้องจบการสวม/ถอดและรอ 0x30 confirm ก่อนเท่านั้น จึงให้ Skill/Attack เดินต่อ
    // ป้องกัน Steal หรือ Attack-follow ตัดคำสั่งเปลี่ยนอาวุธกลางทาง
    if (target) {
      const m = entities.get(target.id);
      if (m && !ensureWeaponSetForTarget(m, now)) return;
    }

    // === 2.8 Auto-Skill (ใช้สกิลตามเงื่อนไข — ก่อน attack) ===
    //   mirror bot.js _maybeSkill:3440-3538 — ทีละสกิลต่อ tick
    //   mode: targeted, ground, AoE, self-cast และ ally→ตัวเอง
    //   self/ally ไม่ต้องมีมอนเป้าหมาย จึงยังทำงานได้เมื่อยืนเฉย ๆ
    if (CFG.skillEnabled && CFG.skills && CFG.skills.length) {
      const mobCount = getMobAttackerCount();
      const curSP = sp.cur;
      const curSPmax = sp.max;
      const curHpPct = hpPct();
      const disabled = Array.isArray(CFG.disabledSkillIds) ? CFG.disabledSkillIds : [];
      for (const skill of CFG.skills) {
        if (!skill || skill.skillId == null) continue;
        if (skill.buffMode) continue; // buff ให้คนอื่นมี controller แยกและ default OFF
        if (skill.selfCast || skill.ally) continue; // คิว support ด้านบนเป็นเจ้าของ self/ally ทั้งหมด
        if (disabled.includes(skill.skillId)) continue;
        const needsTarget = (skill.targeted || skill.ground) && !skill.selfCast && !skill.ally;
        if (needsTarget && !target) continue;
        if (skill.ally && playerId == null) continue;
        // Steal: สำเร็จแล้วไม่ใช้ซ้ำ; ไม่สำเร็จให้ลองตาม maxUsesPerTarget (default 3)
        if (skill.skillId === 61) {
          if (target.stealSuccess) continue;
          if (target.stealPending) {
            if (now < (target.stealResultDueAt || target.stealPendingAt)) continue; // รอผลตาม cooldown ของ Steal ก่อน
            target.stealPending = false;
            target.stealResultDueAt = 0;
            target.stealInventorySnapshot = null;
          }
          const maxTries = skill.maxUsesPerTarget || 3;
          if ((target.stealAttempts || 0) >= maxTries) {
            // ครบจำนวนครั้งแล้ว ไม่ว่าได้หรือไม่ได้: ส่ง Attack ต่อทันที ไม่รอ timeout 7s
            if (!target.stealFinished) {
              target.stealFinished = true;
              target.lastAttackAt = 0;
            }
            continue;
          }
        }
        const lastUse = lastSkillUse.get(skill.skillId) || 0;
        // ★ timer mode (intervalMin > 0) — self-cast buff
        const intervalMin = Number(skill.intervalMin) || 0;
        if (intervalMin > 0) {
          if (lastUse > 0 && (now - lastUse) < intervalMin * 60 * 1000) continue;
        } else {
          const cooldown = skill.cooldownMs ?? 2000;
          if (now - lastUse < cooldown) continue;
        }
        // ★ SP gate
        const spMin = skill.spMin ?? 0;
        if (spMin > 0 && curSP != null && curSP < spMin) continue;
        const hpBelow = Number(skill.hpBelowPct) || 0;
        if (hpBelow > 0 && (curHpPct == null || curHpPct >= hpBelow)) continue;
        // ★ mob count gate (AoE skill)
        const mobMin = skill.mobCountMin ?? 0;
        if (mobCount < mobMin) continue;
        // ★ targeted/ground skill: ต้องมี target + ในระยะ + ไม่เกิน maxUses
        //   selfCast=true ข้ามเงื่อนไขนี้ทั้งหมด
        if ((skill.targeted || skill.ground) && !skill.selfCast && !skill.ally) {
          const m = entities.get(target.id);
          if (!m || m.x == null || player.x == null) continue;
          const dist = Math.hypot(m.x - player.x, m.y - player.y);
          if (skill.skillId === 61) {
            // Steal ห้ามตัด path ระหว่าง Attack-follow: ต้องเข้าใกล้จริงและยืนนิ่งก่อน
            const attackStarted = target.attackProbeAt > 0;
            const attackResponded = target.lastAttackSignalAt >= target.attackProbeAt;
            const approachConfirmed = !!target.followObservedAt && target.lastFollowMoveAt > 0;
            const playerStable = lastPlayerPositionChangedAt > 0 && now - lastPlayerPositionChangedAt >= STEAL_STABLE_MS;
            if (!attackStarted || !playerStable || (!attackResponded && !approachConfirmed)) continue;
          }
          const minDist = skill.minDistance ?? 0;
          // Steal เป็นสกิลประชิด: ต่อให้ localStorage เก่าตั้ง 0/3 ก็ไม่ให้ยิงเกิน 2 ช่อง
          const maxDist = skill.skillId === 61
            ? Math.min(STEAL_MAX_RANGE, Math.max(1, Number(skill.maxDistance) || STEAL_MAX_RANGE))
            : (skill.maxDistance ?? 0);
          if (maxDist > 0 && dist > maxDist) continue;
          if (minDist > 0 && dist < minDist) continue;
          const maxUses = skill.skillId === 61 ? (skill.maxUsesPerTarget || 3) : (skill.maxUsesPerTarget ?? 1);
          const targetUses = skillUsesOnTarget.get(skill.skillId) || new Map();
          const used = targetUses.get(target.id) || 0;
          if (used >= maxUses) continue;
        }
        // ★ ผ่านเงื่อนไข → ใช้สกิล!
        let skillGround = !!skill.ground;
        if (!skillGround && !skill.targeted && !skill.selfCast && !skill.ally && target && GROUND_SKILL_IDS.has(skill.skillId)) {
          skillGround = true;
          log('🔧 สกิล', skill.name || ('id=' + skill.skillId), 'เป็นแบบพื้นที่ → ส่งพิกัดมอนเป้าหมาย');
        }
        const skillTarget = skill.ally ? playerId : ((skill.targeted && !skill.selfCast && !skill.ground) ? target.id : null);
        // ★ ground-targeted (Arrow Shower): ส่งพิกัดของมอนเป้าหมาย
        let groundX = null, groundY = null;
        if (skillGround && target) {
          const tm = entities.get(target.id);
          if (tm && tm.x != null) { groundX = Math.round(tm.x); groundY = Math.round(tm.y); }
        }
        if (sendSkill(skill.skillId, skill.level || 1, skillTarget, groundX, groundY)) {
          lastSkillUse.set(skill.skillId, now);
          saveSkillTimesDebounced();
          if (skill.skillId === 61) {
            target.stealAttempts = (target.stealAttempts || 0) + 1;
            target.stealPending = true;
            target.stealPendingAt = now;
            target.stealResultDueAt = now + stealResultWaitMs(skill);
            target.stealInventorySnapshot = new Map(inventory);
          }
          if (skill.targeted && !skill.selfCast && !skill.ally) {
            const tu = skillUsesOnTarget.get(skill.skillId) || new Map();
            tu.set(target.id, (tu.get(target.id) || 0) + 1);
            skillUsesOnTarget.set(skill.skillId, tu);
          }
          const spInfo = curSP != null ? (curSPmax ? ` ${curSP}/${curSPmax}` : ` ${curSP}`) : ' ?';
          const modeTag = skill.ally ? ' (ally→ตัวเอง)' : (skill.selfCast ? ' (self)' : (skill.targeted ? '' : (skillGround ? ' (พื้น)' : ' (AoE)')));
          log('✨ ใช้สกิล', skill.name || ('id=' + skill.skillId), modeTag, '(sp' + spInfo + ' mob=' + mobCount + ')');
          break;   // ทีละสกิลต่อ tick
        }
      }
    }

    // === 3. Attack ===
    //   ★ server ทำ walk-and-attack เอง: ส่ง ATTACK ในระยะ maxAcquireDistance → server เดินตัวละครเข้าไปตี
    //     dist > maxAcquireDistance → บอทเดินเข้าไปเอง (MOVE) จนถึง ≤maxAcquireDistance แล้วค่อยส่ง ATTACK
    if (target) {
      const m = entities.get(target.id);
      if (m && player.x != null && m.x != null && m.y != null) {
        // safeguard สุดท้ายก่อนส่ง Attack/MOVE: packet อาจเข้ามาหลัง validation ของ tick ก่อนหน้า
        if (yieldUnclaimedTargetToOtherPlayer(m, now)) return;
        const dist = Math.hypot(m.x - player.x, m.y - player.y);
        target.lastDist = dist;
        // ระหว่างรอผล Steal ห้ามส่ง Attack ซ้ำ เพราะอาจตัดคำสั่ง Steal ก่อน server ตอบ
        if (target.stealPending) return;
        // ส่ง ATTACK แล้ว = client เป็นเจ้าของการเดินตาม/โจมตีจนกว่าจะพิสูจน์ว่าไม่ตอบรับ
        // ห้ามดูระยะปัจจุบันแล้วส่ง MOVE แทรก เพราะมอนอาจเดินหนีข้าม acquire range ระหว่างทาง
        if (target.lastAttackAt) {
          const hasAttackSignal = target.lastAttackSignalAt >= target.attackProbeAt;
          const lastFollowPos = target.lastFollowPos;
          const playerMoved = lastFollowPos && (player.x !== lastFollowPos.x || player.y !== lastFollowPos.y);
          if (playerMoved) {
            target.followObservedAt ||= now;
            target.lastFollowMoveAt = now;
            target.lastFollowPos = { x: player.x, y: player.y };
          }

          // hit/miss/damage ของ target = เริ่ม combat จริงแล้ว; หลังจากนี้ใช้ lifecycle combat ปกติ
          // แต่ signal เดิมห้ามล็อก state ไปตลอด: ถ้าเงียบเกิน attackProbeMs
          // ให้ส่ง Attack probe ใหม่หนึ่งครั้ง แล้วใช้ flow unreachable เดิมหากยังไม่ตอบ
          if (hasAttackSignal) {
            const signalSilenceMs = now - target.lastAttackSignalAt;
            if (signalSilenceMs < CFG.attackProbeMs) return;
            if (sendAttack(target.id)) {
              target.lastAttackAt = now;
              target.attackProbeAt = now;
              target.attackProbePos = { x: player.x, y: player.y };
              target.followObservedAt = 0;
              target.lastFollowPos = { x: player.x, y: player.y };
              target.lastFollowMoveAt = 0;
              log('↻ Attack response เงียบ ' + (signalSilenceMs / 1000).toFixed(1) + 's → ทดลองตีใหม่');
            }
            return;
          }
          if (!target.followObservedAt) {
            if (now - target.attackProbeAt >= CFG.attackProbeMs) {
              handleUnreachable(m, 'Attack ไม่มี response/ไม่มี movement ' + (CFG.attackProbeMs / 1000).toFixed(1) + 's');
            }
            return;
          }
          // เดินตามแล้วแต่ยังไม่มี combat signal: ห้ามรอ maxEngageSec (120s)
          // หยุดนิ่ง = ไปต่อไม่ได้; เดินนานเกินเพดาน = ไล่ไม่สำเร็จ → ใช้ warp/unreachable flow
          const followIdleMs = now - target.lastFollowMoveAt;
          const followNoCombatMs = now - target.attackProbeAt;
          if (followIdleMs >= FOLLOW_NO_COMBAT_STALL_MS) {
            handleUnreachable(m, 'เดินตามแล้วหยุด ไม่มี combat response ' + (FOLLOW_NO_COMBAT_STALL_MS / 1000).toFixed(1) + 's');
            return;
          }
          if (followNoCombatMs >= FOLLOW_NO_COMBAT_MAX_MS) {
            handleUnreachable(m, 'เดินตามนาน ไม่มี combat response ' + (FOLLOW_NO_COMBAT_MAX_MS / 1000).toFixed(1) + 's');
            return;
          }
          return;
        }
        // ยังไม่ได้เริ่ม Attack-follow: เข้า acquire range แล้วส่ง ATTACK หนึ่งครั้ง
        if (dist <= CFG.maxAcquireDistance) {
          if (sendAttack(target.id)) {
            target.lastAttackAt = now;
            target.attackProbeAt = now;
            target.attackProbePos = { x: player.x, y: player.y };
            target.followObservedAt = 0;
            target.lastFollowPos = { x: player.x, y: player.y };
            target.lastFollowMoveAt = 0;
            if (!target.engageAt) target.engageAt = now;
            log('⚔️ ตี', m.name || m.id.toString(16), target.id.toString(16), '@ dist', dist.toFixed(1), '(Attack-follow)');
          }
          return;
        }
        // ★ dist > maxChaseDistance → abandon ทันที (มอนไกลเกินไป ไม่สมควรไล่ตาม)
        if (dist > CFG.maxChaseDistance) {
          log('📏 abandon: มอนไกล', dist.toFixed(0), 'ช่อง (เกิน maxChase ' + CFG.maxChaseDistance + ')');
          abandonTarget('ไกลเกิน ' + CFG.maxChaseDistance, false, 10000);
          target = null;
          return;
        }
        // dist > maxAcquireDistance → เดินเองเฉพาะจนกลับเข้า acquire range แล้วหยุดส่ง MOVE
        //   จากนั้น ATTACK จะให้เกมเดินตามมอนต่อเอง
        const stuck = walkToTarget(now, m, CFG.maxAcquireDistance);
        if (stuck === 'NO_PATH') {
          handleUnreachable(m, 'GAT หาเส้นทางไปหาเป้าไม่ได้');
        } else if (stuck === 'STUCK') {
          handleUnreachable(m, 'ติดกำแพง/ระยะไม่คืบ (stuck)');
        }
        return;
      }
    }

    // === 4. Acquire new target ===
    // target อาจเพิ่งถูก abandon ใน hidden/engage flow ด้านบน จึงต้อง re-check
    // ก่อน acquire ปกติอีกครั้ง ไม่เช่นนั้น AI Reply จะถูกข้ามและ bot เดินหามอนต่อ
    if (isAiReplyInteractionActive()
      && !(aiInteraction.phase === 'FINISH_COMBAT' && target)
      && processAiReplyInteraction(now)) return;
    if (!target) {
      const t = acquireTarget(now);
      if (t) { target = t; noMonsterSince = 0; return; }
      // ไม่เจอมอน
      if (!noMonsterSince) noMonsterSince = now;
      const noMonSec = (now - noMonsterSince) / 1000;
      // warp-find — มี cooldown กัน spam (วาร์ป fail ก็ต้องรอ ไม่ยิงทุก tick)
      if (CFG.warpFindEnabled && noMonSec >= CFG.noMonsterWarpSec && now - lastWarpFindAt > 3000) {
        lastWarpFindAt = now;
        if (currentMap) {
          log('🌀 ไม่เจอมอน', noMonSec.toFixed(0) + 's → วาร์ปสุ่ม');
          if (sendRandomWarp()) noMonsterSince = now;   // สำเร็จ → reset (เริ่มนับใหม่ในแมปใหม่)
          // fail → ไม่ reset noMonsterSince แต่ lastWarpFindAt คุม cooldown แล้ว ไม่ spam
        } else {
          log('⚠️ warpFind: ยังไม่รู้ชื่อแมป — รอ SELECT_CHAR/MAP_NAME');
        }
        return;
      }
      // wander — สุ่มเดิน ≤ walkStepDistance ช่องจากตำแหน่งปัจจุบัน
      //   ★ ถ้าเปิด navWanderUseNav และมีข้อมูลแมป → ใช้ waypoint graph (เดินต่อเนื่อง stateful)
      //   ★ navWander เป็น stateful: track target + arrival → เดินต่อทันทีไม่รอ cooldown
      //     ใช้ cooldown สั้น 1s แทน wanderCooldownMs (3s) เพื่อความต่อเนื่อง
      // GAT (ground truth) → Nav ที่เรียนรู้ → สุ่มเดิน fallback
      if (CFG.wanderEnabled && now - lastWanderAt > movementPlanner.cooldownMs() && player.x != null) {
        lastWanderAt = now;
        movementPlanner.move(now);
      }
    }
  }, CFG.combatTickMs);

  // ============================================================
  //  GAT WALKABILITY — ตารางเดินได้จริงจากไฟล์ .gat ของแมป
  //  GRAT 1.2: cell ละ 20 bytes; type 0 = เดินได้, ค่าอื่น = กันเดิน/น้ำ
  //  JSON ใช้ RLE เพื่อให้ cache และการโหลด 168 แมปมีขนาดเล็กลง
  // ============================================================
  const GAT_KEY_PREFIX = 'roPureGat_';
  // ข้อมูล GAT ทุกแมปโหลดจาก maps-gat บน GitHub แล้ว cache ใน localStorage

  const gatCache = new Map();       // mapName -> {w, h, cells: Uint8Array}; cells=0 คือเดินได้
  const gatFetchTried = new Set();
  function gatDecode(w, h, rle) {
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || !rle) return null;
    const cells = new Uint8Array(w * h);
    let i = 0;
    for (const part of String(rle).split(',')) {
      const xi = part.indexOf('x');
      const type = Number(part.slice(0, xi)), count = Number(part.slice(xi + 1));
      if (xi < 1 || !Number.isInteger(type) || !Number.isInteger(count) || count <= 0 || i + count > cells.length) return null;
      cells.fill(type, i, i + count);
      i += count;
    }
    return i === cells.length ? cells : null;
  }
  function gatRegister(mapName, data) {
    if (!mapName || !data) return false;
    const cells = gatDecode(data.w, data.h, data.rle);
    if (!cells) return false;
    gatCache.set(mapName, { w: data.w, h: data.h, cells });
    return true;
  }
  async function gatLoad(mapName) {
    if (!mapName || gatCache.has(mapName) || gatFetchTried.has(mapName)) return;
    gatFetchTried.add(mapName);
    try {
      const cached = localStorage.getItem(GAT_KEY_PREFIX + mapName);
      if (cached && gatRegister(mapName, JSON.parse(cached))) return;
      const response = await fetch(GITHUB_RAW.replace('ro-rebuild-pure.user.js', 'maps-gat/' + encodeURIComponent(mapName) + '.json'));
      if (!response.ok) return;
      const data = await response.json();
      if (!gatRegister(mapName, data)) { dbg('🗺️ GAT data ไม่ถูกต้อง:', mapName); return; }
      try { localStorage.setItem(GAT_KEY_PREFIX + mapName, JSON.stringify(data)); } catch (e) {}
      log('🗺️ GAT:', mapName, 'โหลดแล้ว (' + data.w + '×' + data.h + ')');
    } catch (e) { dbg('🗺️ GAT load ล้มเหลว:', mapName, e.message); }
  }
  setInterval(() => { if (masterBot.enabled() && currentMap && !gatCache.has(currentMap)) gatLoad(currentMap); }, 5000);

  // ตำแหน่งเกมบาง build กลับแกน y จากข้อมูล .gat; เก็บ 20 ตัวอย่างแล้วล็อกผลที่ตรงช่องเดินได้มากกว่า
  let gatFlipY = false, gatFlipLocked = false, gatCalN = 0, gatCalNormal = 0, gatCalFlip = 0;
  function gatCalibrationReset() { gatFlipY = false; gatFlipLocked = false; gatCalN = 0; gatCalNormal = 0; gatCalFlip = 0; }
  setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!currentMap || player.x == null || player.y == null) return;
    const g = gatCache.get(currentMap);
    if (!g || gatFlipLocked) return;
    const gx = Math.round(player.x), gy = Math.round(player.y);
    if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return;
    if (g.cells[gy * g.w + gx] === 0) gatCalNormal++;
    if (g.cells[(g.h - 1 - gy) * g.w + gx] === 0) gatCalFlip++;
    gatCalN++;
    if (gatCalN >= 20) {
      gatFlipLocked = true;
      gatFlipY = gatCalFlip > gatCalNormal;
      log('🗺️ GAT calibration:', gatFlipY ? 'แกน y กลับด้าน' : 'พิกัดตรงปกติ', '(ตำแหน่งตรงช่องเดินได้', Math.max(gatCalNormal, gatCalFlip) + '/' + gatCalN + ')');
    }
  }, 2000);
  function gatWalkable(x, y) {
    const g = currentMap && gatCache.get(currentMap);
    if (!g) return null;
    const gx = Math.round(x), gy = Math.round(y);
    if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return false;
    return g.cells[(gatFlipY ? g.h - 1 - gy : gy) * g.w + gx] === 0;
  }
  function gatLineWalkable(x0, y0, x1, y1) {
    const count = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= count; i++) if (!gatWalkable(x0 + (x1 - x0) * i / count, y0 + (y1 - y0) * i / count)) return false;
    return true;
  }
  // A* 8 ทิศ พร้อมกัน diagonal corner-cut
  function gatFindPath(tx, ty, maxExpand = 15000) {
    const g = currentMap && gatCache.get(currentMap);
    if (!g || player.x == null || player.y == null) return null;
    const sx = Math.round(player.x), sy = Math.round(player.y), W = g.w, H = g.h;
    const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g.cells[(gatFlipY ? H - 1 - y : y) * W + x] === 0;
    if (!walk(sx, sy) || !walk(tx, ty)) return null;
    const index = (x, y) => y * W + x, start = index(sx, sy), goal = index(tx, ty);
    const came = new Int32Array(W * H).fill(-1), scores = new Float64Array(W * H).fill(Infinity), closed = new Uint8Array(W * H), heap = [];
    const push = (f, i) => { heap.push([f, i]); for (let c = heap.length - 1; c > 0;) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let c = 0;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const dirs = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
    scores[start] = 0; push(Math.hypot(tx - sx, ty - sy), start);
    let expanded = 0, found = false;
    while (heap.length && expanded++ < maxExpand) {
      const ci = pop()[1]; if (closed[ci]) continue; closed[ci] = 1;
      if (ci === goal) { found = true; break; }
      const cx = ci % W, cy = (ci / W) | 0;
      for (const [dx, dy, cost] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!walk(nx, ny) || (dx && dy && (!walk(cx + dx, cy) || !walk(cx, cy + dy)))) continue;
        const ni = index(nx, ny), score = scores[ci] + cost;
        if (!closed[ni] && score < scores[ni]) { scores[ni] = score; came[ni] = ci; push(score + Math.hypot(tx - nx, ty - ny), ni); }
      }
    }
    if (!found) return null;
    const points = []; for (let cur = goal; cur !== -1; cur = came[cur]) points.push({ x: cur % W, y: (cur / W) | 0 }); points.reverse();
    const simplified = [points[0]];
    for (let i = 1; i < points.length; i++) { const a = simplified[simplified.length - 1], b = points[i - 1], c = points[i]; if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) !== 0) simplified.push(c); }
    return simplified;
  }

  // ============================================================
  //  COMBAT GAT CHASE — state แยกจาก GAT Wander โดยเด็ดขาด
  //  ใช้เมื่อมี target เท่านั้น: หาเส้นทางไปยังช่องเดินได้ในระยะโจมตี
  //  หากหา path ไม่ได้หรือเส้นทางไม่คืบ → combat state machine จะเลือก warp
  // ============================================================
  const COMBAT_GAT_REPATH_MS = 1000;
  const COMBAT_GAT_ARRIVE_RADIUS = 2.5;
  let combatGatPath = null;
  let combatGatPathIdx = 0;
  let combatGatTargetPos = null;
  let combatGatLastPlanAt = 0;
  let combatGatLastMoveAt = 0;
  let combatGatLastProgressAt = 0;
  let combatGatBestDistance = Infinity;

  function resetCombatGatChase() {
    combatGatPath = null;
    combatGatPathIdx = 0;
    combatGatTargetPos = null;
    combatGatLastPlanAt = 0;
    combatGatLastMoveAt = 0;
    combatGatLastProgressAt = 0;
    combatGatBestDistance = Infinity;
  }

  function combatGatChaseEnabled() {
    return CFG.gatWanderEnabled !== false && !!currentMap && gatCache.has(currentMap) && player.x != null && player.y != null;
  }

  function combatGatProgressTimeoutMs() {
    const value = Number(CFG.combatGatProgressTimeoutMs);
    return Number.isFinite(value) ? Math.max(500, Math.min(15000, Math.round(value))) : 3500;
  }

  function combatGatPathToRange(m, desiredDistance) {
    const reach = Math.max(1, Number(desiredDistance) || 1);
    const radius = Math.ceil(reach);
    const cx = Math.round(m.x), cy = Math.round(m.y);
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.hypot(dx, dy) > reach + 0.01) continue;
        const x = cx + dx, y = cy + dy;
        if (!gatWalkable(x, y)) continue;
        candidates.push({ x, y, d: Math.hypot(x - player.x, y - player.y) });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const candidate of candidates) {
      const path = gatFindPath(candidate.x, candidate.y);
      if (path && path.length) return { path, destination: candidate };
    }
    return null;
  }

  // null = GAT ไม่พร้อม จึงให้ caller ใช้ direct-walk เดิม
  // WALKING / STUCK / NO_PATH = Combat Chase เป็นเจ้าของการตัดสินใจแล้ว
  function combatGatChaseStep(now, m, desiredDistance) {
    if (!combatGatChaseEnabled()) {
      if (combatGatPath) resetCombatGatChase();
      return null;
    }
    const targetMoved = !combatGatTargetPos || Math.hypot(m.x - combatGatTargetPos.x, m.y - combatGatTargetPos.y) > 2;
    if (!combatGatPath || (targetMoved && now - combatGatLastPlanAt >= COMBAT_GAT_REPATH_MS)) {
      const next = combatGatPathToRange(m, desiredDistance);
      if (!next) {
        resetCombatGatChase();
        log('🗺️ Combat GAT: ไม่มีเส้นทางไปหา', m.name || m.id.toString(16), '→ ใช้ unreachable flow');
        return 'NO_PATH';
      }
      combatGatPath = next.path;
      combatGatPathIdx = 0;
      combatGatTargetPos = { x: m.x, y: m.y };
      combatGatLastPlanAt = now;
      combatGatLastProgressAt = now;
      combatGatBestDistance = Math.hypot(m.x - player.x, m.y - player.y);
      log('🗺️ Combat GAT: path ไปหา', m.name || m.id.toString(16), '→ (', next.destination.x + ',', next.destination.y + ')', combatGatPath.length, 'จุด');
    }

    const distance = Math.hypot(m.x - player.x, m.y - player.y);
    if (distance < combatGatBestDistance - 0.5) {
      combatGatBestDistance = distance;
      combatGatLastProgressAt = now;
    }
    const oldIdx = combatGatPathIdx;
    while (combatGatPathIdx < combatGatPath.length - 1
      && Math.hypot(combatGatPath[combatGatPathIdx].x - player.x, combatGatPath[combatGatPathIdx].y - player.y) <= COMBAT_GAT_ARRIVE_RADIUS) {
      combatGatPathIdx++;
    }
    if (combatGatPathIdx > oldIdx) combatGatLastProgressAt = now;
    const progressTimeoutMs = combatGatProgressTimeoutMs();
    if (now - combatGatLastProgressAt >= progressTimeoutMs) {
      log('🚧 Combat GAT: เส้นทางไม่คืบ', (progressTimeoutMs / 1000).toFixed(1) + 's', '@ dist', distance.toFixed(1));
      return 'STUCK';
    }
    if (now - combatGatLastMoveAt < 800) return 'WALKING';

    let best = combatGatPathIdx;
    for (let i = combatGatPath.length - 1; i > best; i--) {
      if (Math.hypot(combatGatPath[i].x - player.x, combatGatPath[i].y - player.y) <= MOVE_MAX_DIST
        && gatLineWalkable(player.x, player.y, combatGatPath[i].x, combatGatPath[i].y)) {
        best = i;
        break;
      }
    }
    const waypoint = combatGatPath[best];
    if (!waypoint) return 'NO_PATH';
    if (sendMove(waypoint.x, waypoint.y)) {
      combatGatLastMoveAt = now;
      dbg('🗺️ Combat GAT stride @(', Math.round(waypoint.x), Math.round(waypoint.y) + ') wp', best + 1 + '/' + combatGatPath.length, 'dist', distance.toFixed(1));
    }
    return 'WALKING';
  }

  let gatWTarget = null, gatWPath = null, gatWPathIdx = 0, gatWTargetAt = 0, gatWLastPos = null, gatWStuckSince = 0, gatWLastMoveAt = 0, gatWLogTag = '', gatWDir = null, gatWDirDist = 0;
  function gatNewHeading() {
    const old = gatWDir == null ? Math.floor(Math.random() * 8) : ((Math.round(gatWDir / (Math.PI / 4)) % 8) + 8) % 8;
    const turn = [1, -1, 2, -2, 3, -3][Math.floor(Math.random() * 6)];
    gatWDir = (((old + turn) % 8 + 8) % 8) * (Math.PI / 4); gatWDirDist = 60 + Math.random() * 90;
  }
  function gatWanderReset() { gatWTarget = null; gatWPath = null; gatWPathIdx = 0; gatWTargetAt = 0; gatWLastPos = null; gatWStuckSince = 0; gatWLastMoveAt = 0; gatWLogTag = ''; gatWDir = null; gatWDirDist = 0; }
  function gatMapReset() { gatWanderReset(); gatCalibrationReset(); if (currentMap) gatLoad(currentMap); }
  function gatPickTarget() {
    if (gatWDir == null || gatWDirDist <= 0) gatNewHeading();
    for (let tries = 0; tries < 20; tries++) {
      const angle = tries < 12 ? gatWDir + (Math.random() * 2 - 1) * 0.7 : Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 45, tx = Math.round(player.x + Math.cos(angle) * radius), ty = Math.round(player.y + Math.sin(angle) * radius);
      if (!gatWalkable(tx, ty)) continue;
      const path = gatFindPath(tx, ty);
      if (path && path.length > 1) { gatWTarget = { x: tx, y: ty }; gatWPath = path; gatWPathIdx = 0; gatWTargetAt = nowMs(); gatWLogTag = ''; gatWDirDist -= radius; return true; }
    }
    gatNewHeading(); return false;
  }
  function gatWanderStep(now) {
    if (!currentMap || player.x == null || player.y == null || !gatCache.has(currentMap)) return false;
    const arrive = 2.5;
    if (gatWLastPos && gatWTarget) {
      const dx = player.x - gatWLastPos.x, dy = player.y - gatWLastPos.y;
      if (dx * dx + dy * dy < 4) { if (!gatWStuckSince) gatWStuckSince = now; else if (now - gatWStuckSince > 6000) { log('🗺️ GAT stuck 6s @(', Math.round(player.x), Math.round(player.y) + ') → เป้าใหม่'); gatWanderReset(); } } else gatWStuckSince = 0;
    }
    gatWLastPos = { x: player.x, y: player.y };
    if (gatWTarget) {
      const remain = Math.hypot(gatWTarget.x - player.x, gatWTarget.y - player.y), timeout = now - gatWTargetAt > 25000;
      if (timeout) log('🗺️ GAT timeout 25s @(', Math.round(player.x), Math.round(player.y) + ') เหลือ', remain.toFixed(0), 'ช่อง → ขาใหม่');
      if (remain <= 10 || timeout) if (!gatPickTarget() && remain <= arrive) { gatWanderReset(); return false; }
    }
    if (!gatWTarget && !gatPickTarget()) return false;
    if (now - gatWLastMoveAt < 900) return true;
    while (gatWPathIdx < gatWPath.length - 1 && Math.hypot(gatWPath[gatWPathIdx].x - player.x, gatWPath[gatWPathIdx].y - player.y) <= arrive) gatWPathIdx++;
    let best = gatWPathIdx;
    for (let i = gatWPath.length - 1; i > best; i--) if (Math.hypot(gatWPath[i].x - player.x, gatWPath[i].y - player.y) <= MOVE_MAX_DIST && gatLineWalkable(player.x, player.y, gatWPath[i].x, gatWPath[i].y)) { best = i; break; }
    const waypoint = gatWPath[best];
    if (sendMove(waypoint.x, waypoint.y)) {
      gatWLastMoveAt = now;
      dbg('🗺️ GAT stride @(', Math.round(waypoint.x), Math.round(waypoint.y) + ') wp', best + 1 + '/' + gatWPath.length, 'player(', Math.round(player.x), Math.round(player.y) + ')');
      const tag = Math.round(gatWTarget.x) + ',' + Math.round(gatWTarget.y);
      if (tag !== gatWLogTag) { gatWLogTag = tag; log('🗺️ GAT เดินหามอน @(', Math.round(waypoint.x), Math.round(waypoint.y) + ') → เป้า(', tag + ') เส้นทาง', gatWPath.length, 'จุดเลี้ยว'); }
    }
    return true;
  }

  // ============================================================
  //  NAVIGATION — บันทึกเส้นทางเดิน + สร้าง waypoint graph
  //    Trail (ตามเวลา) → merge nodes (ใกล้กัน) + edges (เชื่อมต่อกัน)
  //    localStorage per-map (roPureNav_<map>) + export/import + sync GitHub
  // ============================================================
  // ★ flag แยก: บอทสั่งเดิน (sendMove) vs ผู้เล่นคลิกเอง — บันทึกเฉพาะผู้เล่น
  let navBotMoving = false;
  const NAV_KEY_PREFIX = 'roPureNav_';
  // cache ของแต่ละแมปที่โหลดแล้ว: mapName → { nodes: [{x,y}], edges: [[i,j],...] }
  const navCache = new Map();
  // load nav data ของแมปจาก localStorage (cache ไว้)
  function navLoadMap(mapName) {
    if (!mapName) return null;
    if (navCache.has(mapName)) return navCache.get(mapName);
    try {
      const raw = localStorage.getItem(NAV_KEY_PREFIX + mapName);
      const data = raw ? JSON.parse(raw) : { nodes: [], edges: [], trail: [] };
      // ★ migrate: ข้อมูลเก่าอาจไม่มี route → rebuild จาก trail
      if (data.trail && data.trail.length && !data.route) navRebuildGraph(data);
      navCache.set(mapName, data);
      return data;
    } catch (e) { const d = { nodes: [], edges: [], trail: [] }; navCache.set(mapName, d); return d; }
  }
  function navSaveMap(mapName) {
    if (!mapName) return;
    const data = navCache.get(mapName);
    if (!data) return;
    try { localStorage.setItem(NAV_KEY_PREFIX + mapName, JSON.stringify(data)); } catch (e) {}
  }
  let navSaveTimer = null;
  function navSaveDebounced(mapName) {
    if (navSaveTimer) clearTimeout(navSaveTimer);
    navSaveTimer = setTimeout(() => navSaveMap(mapName), 1500);
  }
  // ★ rebuild graph จาก trail — merge nodes ใกล้กัน + สร้าง edges ตามลำดับเวลา
  function navRebuildGraph(data) {
    const r = CFG.navMergeRadius || 3;
    const r2 = r * r;
    const nodes = [];   // [{x, y}]
    const nodeMap = []; // trail index → node index
    // ★ pass 1: assign trail points ไปยัง node (merge ถ้าใกล้ node เดิม)
    for (let i = 0; i < data.trail.length; i++) {
      const p = data.trail[i];
      let found = -1;
      for (let j = 0; j < nodes.length; j++) {
        const dx = nodes[j].x - p.x, dy = nodes[j].y - p.y;
        if (dx * dx + dy * dy <= r2) { found = j; break; }
      }
      if (found < 0) { found = nodes.length; nodes.push({ x: p.x, y: p.y }); }
      nodeMap[i] = found;
    }
    // ★ pass 2: edges จาก trail ติดกัน (ข้าม node ตัวเอง) + dedup
    const edgeSet = new Set();
    const edges = [];
    for (let i = 1; i < nodeMap.length; i++) {
      const a = nodeMap[i - 1], b = nodeMap[i];
      if (a === b) continue;
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push([a, b]);
    }
    data.nodes = nodes;
    data.edges = edges;
    // ★ build route: ลำดับ node ตามที่เดินจริง (compact nodeMap — เอาซ้ำติดกันออก)
    //   ใช้สำหรับ patrol mode (เดินตามลำดับ → ครบแล้วย้อนกลับ)
    const route = [];
    let lastNode = -1;
    for (let i = 0; i < nodeMap.length; i++) {
      if (nodeMap[i] !== lastNode) { route.push(nodeMap[i]); lastNode = nodeMap[i]; }
    }
    data.route = route;
  }
  // ★ บันทึกการคลิกเดินของผู้เล่น → trail
  function navRecordMove(x, y) {
    if (!CFG.navRecording || !currentMap) return;
    const data = navLoadMap(currentMap);
    if (!data) return;
    const now = nowMs();
    const last = data.trail[data.trail.length - 1];
    // ★ dedup: ข้ามถี่เกิน (เดินที่เดิม)
    if (last) {
      const dx = last.x - x, dy = last.y - y;
      if (dx * dx + dy * dy < 1) return;   // ขยับ < 1 ช่อง → ข้าม
    }
    data.trail.push({ x, y, t: now });
    // ★ จำกัดขนาด trail (กัน localStorage เต็ม) — เก็บสูงสุด 2000 จุด/แมป
    if (data.trail.length > 2000) data.trail = data.trail.slice(-2000);
    navRebuildGraph(data);
    navSaveDebounced(currentMap);
  }
  // ★ Navigation: หา node ที่ใกล้ (x,y) ที่สุด
  function navFindNearestNode(data, x, y) {
    if (!data || !data.nodes || !data.nodes.length) return -1;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < data.nodes.length; i++) {
      const dx = data.nodes[i].x - x, dy = data.nodes[i].y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  // ★ Build adjacency list จาก edges
  function navAdjacency(data) {
    const adj = data.nodes.map(() => []);
    for (const [a, b] of data.edges) { adj[a].push(b); adj[b].push(a); }
    return adj;
  }
  // ★ BFS pathfinding: shortest path from node A → node B
  //   return [nodeIndex, ...] หรือ null ถ้าไม่ถึง
  function navFindPath(data, fromNode, toNode) {
    if (fromNode < 0 || toNode < 0 || fromNode >= data.nodes.length || toNode >= data.nodes.length) return null;
    if (fromNode === toNode) return [fromNode];
    const adj = navAdjacency(data);
    const visited = new Set([fromNode]);
    const queue = [[fromNode]];
    while (queue.length) {
      const path = queue.shift();
      const cur = path[path.length - 1];
      for (const next of adj[cur]) {
        if (visited.has(next)) continue;
        visited.add(next);
        const newPath = [...path, next];
        if (next === toNode) return newPath;
        queue.push(newPath);
      }
    }
    return null;
  }
  // ★ navigateTo(x, y): หา path จากตำแหน่งปัจจุบัน → (x,y) แล้วคืนจุดถัดไปที่ควรคลิกเดิน
  //   return {x, y} ของ waypoint ถัดไป หรือ null ถ้าไม่มี path / ไม่มีข้อมูลแมป
  function navNavigateTo(targetX, targetY) {
    if (!currentMap || player.x == null) return null;
    const data = navLoadMap(currentMap);
    if (!data || !data.nodes.length) return null;
    const startNode = navFindNearestNode(data, player.x, player.y);
    const endNode = navFindNearestNode(data, targetX, targetY);
    const path = navFindPath(data, startNode, endNode);
    if (!path || path.length < 2) return null;
    // ★ คืน node ถัดไป (path[1]) — bot จะคลิกเดินไปที่นั่น
    return { x: data.nodes[path[1]].x, y: data.nodes[path[1]].y };
  }
  // ★ PATROL MODE — เดินตามลำดับ route (ลำดับที่บันทึก) ครบแล้วย้อนกลับ
  //   ง่าย + เป็นธรรมชาติที่สุด เพราะเดินตามเส้นทางที่มนุษย์เคยเดินจริง
  //   state: patrolIdx = index ใน route ปัจจุบัน, patrolDir = 1 (ไป) | -1 (กลับ)
  let patrolIdx = -1;       // index ใน route ของ node ที่กำลังเดินไป
  let patrolDir = 1;        // ทิศทาง: 1 = ไปข้างหน้า, -1 = ย้อนกลับ
  let patrolTargetAt = 0;   // timestamp ที่ตั้ง target (timeout)
  function navPatrol() {
    if (!currentMap || player.x == null) return null;
    const data = navLoadMap(currentMap);
    if (!data || !data.route || data.route.length < 2) return null;
    const now = nowMs();
    const ARRIVAL_RADIUS = (CFG.navMergeRadius || 3);
    const MAX_STEP = MOVE_MAX_DIST;
    const TARGET_TIMEOUT_MS = 10000;

    // ★ เริ่มต้น: หา index ใน route ที่ใกล้ player สุด
    if (patrolIdx < 0) {
      let bestDist = Infinity;
      for (let i = 0; i < data.route.length; i++) {
        const n = data.nodes[data.route[i]];
        const dx = n.x - player.x, dy = n.y - player.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; patrolIdx = i; }
      }
      patrolTargetAt = now;
    }

    // ★ หา target node ปัจจุบัน
    const targetNodeIdx = data.route[patrolIdx];
    if (targetNodeIdx == null) { patrolIdx = -1; return null; }
    const tx = data.nodes[targetNodeIdx].x, ty = data.nodes[targetNodeIdx].y;
    const dx = tx - player.x, dy = ty - player.y;
    const dist2 = dx * dx + dy * dy;

    // ★ arrival check: ถึงแล้ว → เลื่อนไป node ถัดไปใน route
    if (dist2 <= ARRIVAL_RADIUS * ARRIVAL_RADIUS) {
      patrolIdx += patrolDir;
      // ★ ครบ route → ย้อนกลับ (ping-pong ไม่วนกลับจุดเริ่มต้น เพราะเสียเวลา)
      if (patrolIdx >= data.route.length) { patrolIdx = data.route.length - 2; patrolDir = -1; }
      else if (patrolIdx < 0) { patrolIdx = 1; patrolDir = 1; }
      // กัน index ออกนอก (route สั้น)
      if (patrolIdx < 0) patrolIdx = 0;
      if (patrolIdx >= data.route.length) patrolIdx = data.route.length - 1;
      patrolTargetAt = now;
      const nextNodeIdx = data.route[patrolIdx];
      return { x: data.nodes[nextNodeIdx].x, y: data.nodes[nextNodeIdx].y };
    }

    // ★ target timeout: ถ้าเกิน 10 วิ ยังไม่ถึง → ข้ามไป node ถัดไป
    if (now - patrolTargetAt > TARGET_TIMEOUT_MS) {
      patrolIdx += patrolDir;
      if (patrolIdx >= data.route.length) { patrolIdx = data.route.length - 2; patrolDir = -1; }
      else if (patrolIdx < 0) { patrolIdx = 1; patrolDir = 1; }
      if (patrolIdx < 0) patrolIdx = 0;
      if (patrolIdx >= data.route.length) patrolIdx = data.route.length - 1;
      patrolTargetAt = now;
      const nextNodeIdx = data.route[patrolIdx];
      log('🗺️ patrol timeout → ข้ามไป node', patrolIdx);
      return { x: data.nodes[nextNodeIdx].x, y: data.nodes[nextNodeIdx].y };
    }

    // ★ ยังอยู่ระหว่างทาง → คืน target ปัจจุบัน (cap ระยะ ≤ MAX_STEP)
    if (dist2 > MAX_STEP * MAX_STEP) {
      // ไกลเกิน → หา node ถัดไปที่อยู่ใกล้ player บน route
      //   ง่ายสุด: หา index ใน route ที่ใกล้ player สุด แล้วเริ่มจากตรงนั้น
      let bestI = patrolIdx, bestD = dist2;
      for (let i = 0; i < data.route.length; i++) {
        const n = data.nodes[data.route[i]];
        const ddx = n.x - player.x, ddy = n.y - player.y;
        const d = ddx * ddx + ddy * ddy;
        if (d < bestD) { bestD = d; bestI = i; }
      }
      patrolIdx = bestI;
      patrolTargetAt = now;
      const nn = data.nodes[data.route[patrolIdx]];
      return { x: nn.x, y: nn.y };
    }
    return { x: tx, y: ty };
  }
  function navPatrolReset() { patrolIdx = -1; patrolDir = 1; patrolTargetAt = 0; }

  // ★ wander แบบใช้ nav — stateful: track current target + arrival → เดินต่อเนื่อง
  //   ★ หลีกเลี่ยง ping-pong: track node ที่เพิ่งมาจาก (prevNode) → ไม่สุ่มกลับ
  //     ถ้าเหลือทางเดียว (dead-end 2 node) → ขยายหา node ที่ไกลขึ้นผ่าน BFS
  let navWanderTarget = null;     // {x, y} เป้าหมายปัจจุบัน (null = ต้องเลือกใหม่)
  let navWanderNodeIdx = -1;      // index ของ node ที่กำลังเดินไป
  let navWanderPrevNode = -1;     // ★ index ของ node ที่เพิ่งจากมา (กันย้อนกลับ)
  let navWanderStuckSince = 0;    // timestamp ที่เริ่ม stuck (ไม่ถึง target)
  let navWanderLastPos = null;    // {x,y,t} ตำแหน่งก่อนหน้า (เช็ค stuck)
  let navWanderTargetAt = 0;      // ★ timestamp ที่ตั้ง target (timeout ถ้าไม่ถึง)
  // ★ helper: เลือก neighbor ถัดไป หลีกเลี่ยง prevNode — ถ้าเหลือแค่ prevNode ให้ BFS หา node ไกลขึ้น
  function navPickNextNode(data, curIdx) {
    const adj = navAdjacency(data);
    const neighbors = (adj[curIdx] || []).filter(n => n !== curIdx && n !== navWanderPrevNode);
    if (neighbors.length) {
      // ★ สุ่ม แต่ถ้ามีหลายทาง → เบนไปทางที่ไกลจาก prevNode (น้ำหนักมากกว่า)
      //   เพื่อให้เดินออกไกลแทนวนในจุดเดิม
      const px = data.nodes[navWanderPrevNode] || data.nodes[curIdx];
      // เลือกแบบสุ่มจาก neighbors ทั้งหมด (เท่ากัน) — ping-pong กันด้วย prevNode filter แล้ว
      return neighbors[Math.floor(Math.random() * neighbors.length)];
    }
    // ★ dead-end (มีแค่ prevNode ทางเดียว) → BFS หา node ที่ไกลสุดในรัศมี 3-5 hop
    //   เพื่อหลุดจากการวน แทนการย้อนกลับ
    const visited = new Set([curIdx]);
    let frontier = [curIdx];
    const dist = new Map([[curIdx, 0]]);
    let farthest = -1, farthestDist = 0;
    for (let hop = 0; hop < 5 && frontier.length; hop++) {
      const next = [];
      for (const n of frontier) {
        for (const m of adj[n] || []) {
          if (visited.has(m)) continue;
          visited.add(m);
          dist.set(m, hop + 1);
          if (hop + 1 > farthestDist) { farthestDist = hop + 1; farthest = m; }
          next.push(m);
        }
      }
      frontier = next;
    }
    return farthest >= 0 ? farthest : null;
  }
  function navWander() {
    if (!currentMap || player.x == null) return null;
    const data = navLoadMap(currentMap);
    if (!data || data.nodes.length < 2) return null;
    const now = nowMs();
    const ARRIVAL_RADIUS = CFG.navMergeRadius || 3;
    const MAX_STEP = MOVE_MAX_DIST;
    const TARGET_TIMEOUT_MS = 8000;   // ★ ทิ้ง target ถ้าไม่ถึงใน 8 วิ (ติดกำแพง)

    // ★ target timeout: ถ้ามี target และเกิน 8 วิยังไม่ถึง → ทิ้ง เลือกใหม่
    //   (กันค้างที่ target เดิม เพราะติดกำแพง/สิ่งกีดขวาง)
    if (navWanderTarget && navWanderTargetAt && (now - navWanderTargetAt > TARGET_TIMEOUT_MS)) {
      const tdx = navWanderTarget.x - player.x, tdy = navWanderTarget.y - player.y;
      if (tdx * tdx + tdy * tdy > ARRIVAL_RADIUS * ARRIVAL_RADIUS) {
        // ยังไม่ถึง + เกินเวลา → ทิ้ง target + ล้าง prevNode (กันติดต่อ)
        navWanderTarget = null; navWanderPrevNode = -1;
      }
    }

    // ★ เช็ค arrival: ถ้ามี target และอยู่ใกล้แล้ว → เลือก neighbor ถัดไปทันที
    if (navWanderTarget) {
      const dx = navWanderTarget.x - player.x, dy = navWanderTarget.y - player.y;
      if (dx * dx + dy * dy <= ARRIVAL_RADIUS * ARRIVAL_RADIUS) {
        // ★ ถึงแล้ว — prevNode = node ที่เพิ่งจาก (curNode เดิม), curNode = target ที่ถึง
        navWanderPrevNode = navWanderNodeIdx >= 0 ? navFindNearestNode(data, player.x, player.y) : navWanderPrevNode;
        const curIdx = navWanderNodeIdx >= 0 ? navWanderNodeIdx : navFindNearestNode(data, player.x, player.y);
        const next = navPickNextNode(data, curIdx);
        if (next != null) {
          navWanderNodeIdx = next;
          const nx = data.nodes[next].x, ny = data.nodes[next].y;
          const sdx = nx - player.x, sdy = ny - player.y;
          if (sdx * sdx + sdy * sdy > MAX_STEP * MAX_STEP) {
            navWanderTarget = navNavigateTo(nx, ny) || { x: nx, y: ny };
          } else {
            navWanderTarget = { x: nx, y: ny };
          }
          navWanderTargetAt = now;   // ★ ตั้ง timeout ใหม่
          return navWanderTarget;
        }
        navWanderTarget = null;
      }
    }

    // ★ stuck detection: ตำแหน่งไม่ขยับ > 5s → reset
    if (navWanderLastPos) {
      const pdx = player.x - navWanderLastPos.x, pdy = player.y - navWanderLastPos.y;
      if (pdx * pdx + pdy * pdy < 4) {
        if (!navWanderStuckSince) navWanderStuckSince = now;
        else if (now - navWanderStuckSince > 5000) {
          navWanderTarget = null; navWanderPrevNode = -1; navWanderStuckSince = 0;
        }
      } else { navWanderStuckSince = 0; }
    }
    navWanderLastPos = { x: player.x, y: player.y, t: now };

    // ★ เลือก target ใหม่ (ไม่มี target หรือ reset)
    if (!navWanderTarget) {
      const curIdx = navFindNearestNode(data, player.x, player.y);
      const next = navPickNextNode(data, curIdx);
      if (next != null) {
        navWanderNodeIdx = next;
        const nx = data.nodes[next].x, ny = data.nodes[next].y;
        const sdx = nx - player.x, sdy = ny - player.y;
        if (sdx * sdx + sdy * sdy > MAX_STEP * MAX_STEP) {
          navWanderTarget = navNavigateTo(nx, ny) || { x: nx, y: ny };
        } else {
          navWanderTarget = { x: nx, y: ny };
        }
      } else {
        // ★ ไม่ได้อยู่ใกล้ node ไหน → เดินไป node ใกล้สุด (≤ MAX_STEP)
        if (curIdx >= 0) {
          const nx = data.nodes[curIdx].x, ny = data.nodes[curIdx].y;
          const sdx = nx - player.x, sdy = ny - player.y;
          if (sdx * sdx + sdy * sdy <= MAX_STEP * MAX_STEP) {
            navWanderNodeIdx = curIdx;
            navWanderTarget = { x: nx, y: ny };
          }
        }
      }
      navWanderTargetAt = now;   // ★ ตั้ง timeout ใหม่
      return navWanderTarget;
    }
    return navWanderTarget;
  }
  // ★ reset wander state (เรียกตอนเปลี่ยนแมป/วาร์ป)
  function navWanderReset() {
    navWanderTarget = null;
    navWanderNodeIdx = -1;
    navWanderPrevNode = -1;
    navWanderStuckSince = 0;
    navWanderLastPos = null;
    navWanderTargetAt = 0;
  }
  // ★ เช็คว่าแมปปัจจุบันมีข้อมูล nav หรือไม่ (ใช้ใน combatLoop เพื่อเลือก cooldown)
  function navHasData() {
    if (!currentMap) return false;
    const data = navCache.get(currentMap);
    if (!data || !data.nodes || data.nodes.length < 2) return false;
    if (CFG.navWanderMode === 'patrol') return !!(data.route && data.route.length >= 2);
    return true;   // graph mode ใช้แค่ nodes
  }
  // ★ export ข้อมูล nav ทั้งหมด (สำหรับ download/backup)
  function navExportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(NAV_KEY_PREFIX)) {
        try { out[key.slice(NAV_KEY_PREFIX.length)] = JSON.parse(localStorage.getItem(key)); } catch (e) {}
      }
    }
    return out;
  }
  // ★ import ข้อมูล nav (merge — ถ้ามีแมปซ้ำ = ทับ)
  function navImportAll(data) {
    if (!data || typeof data !== 'object') return 0;
    let count = 0;
    for (const [mapName, navData] of Object.entries(data)) {
      if (!mapName || !navData || !Array.isArray(navData.nodes)) continue;
      localStorage.setItem(NAV_KEY_PREFIX + mapName, JSON.stringify(navData));
      navCache.set(mapName, navData);
      count++;
    }
    return count;
  }
  // ★ clear nav ของแมปที่ระบุ (หรือทั้งหมดถ้าไม่ระบุ)
  function navClear(mapName) {
    if (mapName) {
      localStorage.removeItem(NAV_KEY_PREFIX + mapName);
      navCache.delete(mapName);
      log('🗺️ ล้างข้อมูล nav แมป', mapName);
    } else {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(NAV_KEY_PREFIX)) keys.push(key);
      }
      keys.forEach(k => localStorage.removeItem(k));
      navCache.clear();
      log('🗺️ ล้างข้อมูล nav ทั้งหมด (' + keys.length + ' แมป)');
    }
  }

  // ============================================================
  //  MOVEMENT PLANNER — GAT → recorded Nav → random fallback
  //  combat loop รู้เพียงว่าให้ planner เดิน; priority และ state reset อยู่ที่นี่
  // ============================================================
  const movementPlanner = (() => {
    const hasGat = () => CFG.gatWanderEnabled !== false && !!currentMap && gatCache.has(currentMap);
    const hasNav = () => CFG.navWanderUseNav && navHasData();
    const randomFallback = () => {
      const angle = Math.random() * Math.PI * 2;
      const step = 3 + Math.random() * Math.min(CFG.wanderMaxStep, CFG.walkStepDistance) - 3;
      const tx = player.x + Math.cos(angle) * step;
      const ty = player.y + Math.sin(angle) * step;
      if (!sendMove(tx, ty)) return false;
      log('🚶 สุ่มเดิน @(', Math.round(tx), Math.round(ty) + ') | จาก player(', player.x.toFixed(0), player.y.toFixed(0) + ') step=' + Math.round(step));
      return true;
    };
    const navStep = () => {
      if (!CFG.navWanderUseNav) return false;
      const waypoint = CFG.navWanderMode === 'patrol' ? navPatrol() : navWander();
      if (!waypoint || !sendMove(waypoint.x, waypoint.y)) return false;
      const tag = Math.round(waypoint.x) + ',' + Math.round(waypoint.y);
      if (tag !== lastNavLogTag) {
        lastNavLogTag = tag;
        log(CFG.navWanderMode === 'patrol' ? '🔄 patrol @(' : '🗺️ nav wander @(', waypoint.x, waypoint.y + ')');
      }
      return true;
    };
    return {
      cooldownMs() { return (hasGat() || hasNav()) ? 1000 : CFG.wanderCooldownMs; },
      move(now) {
        if (hasGat() && gatWanderStep(now)) return true;
        if (navStep()) return true;
        return randomFallback();
      },
      reset() {
        navWanderReset();
        navPatrolReset();
        gatMapReset();
        lastNavLogTag = '';
      },
    };
  })();

  // ---------- patch WebSocket ----------
  function attach(ws) {
    if (ws.__loot) return; ws.__loot = true;
    // ★★ กัน relay WS แทนที่ game WS — เช็ค URL ว่าตรงกับ monitorServerUrl ไหม
    //   ถ้าใช่ → ไม่ตั้ง activeWS ไม่ hook (relay เป็น text JSON ไม่ใช่ binary game protocol)
    //   ★★ อย่าใช้ includes('rayrag') — เพราะเกมเชื่อมที่ gamesea01.rayrag.com!
    const relayUrl = CFG.monitorServerUrl || '';
    let wsUrl = '';
    try { wsUrl = ws.url || ''; } catch (_) {}
    // local POC/queue ไม่ใช่ game socket — ห้ามยึด activeWS หรือ parse ข้อความ hello เป็น packet เกม
    if (/^ws:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(wsUrl)) {
      log('🧪 ข้าม attach local WebSocket:', wsUrl);
      return;
    }
    // Queue adapter เป็น text WebSocket ไม่ใช่เกม: ต้องกันไม่ให้มันเขียนทับ activeWS.
    if (wsUrl && lootQueueTransport.isQueueSocket(wsUrl)) {
      try {
        const endpoint = new URL(wsUrl, location.href);
        log('📮 ข้าม attach Loot Queue WebSocket (' + lootQueueTransportLabel() + ' · ไม่ใช่เกม):', endpoint.origin + endpoint.pathname);
      } catch (_) { log('📮 ข้าม attach Loot Queue WebSocket (ไม่ใช่เกม)'); }
      return;
    }
    // ★ เช็คแบบตรงไปตรงมา: ตัด scheme ออกแล้วเทียบ host
    if (relayUrl && wsUrl) {
      const relayHost = relayUrl.replace(/^wss?:\/\//, '').split('/')[0];
      const wsHost = wsUrl.replace(/^wss?:\/\//, '').split('/')[0];
      if (relayHost && wsHost && relayHost === wsHost) {
        log('🌐 ข้าม attach relay WebSocket (ไม่ใช่เกม):', wsUrl.slice(0, 60));
        return;
      }
    }
    activeWS = ws; log('🔌 ต่อ WebSocket แล้ว');
    try { gameServerUrl = ws.url || ''; } catch (_) {}   // ★ เก็บ URL เซิร์ฟเวอร์เกม
    ws.addEventListener('open', () => {
      // reset ต่อ connection เท่านั้น — ไม่กระทบ Combat/AB Buff/Storage state
      wsOpenedAt = Date.now();
      lastGamePacketAt = wsOpenedAt;
      autoLoginAttemptAt = 0;
      autoLoginToken = null;
      autoLoginPhase = CFG.autoLoginEnabled ? 'awaitLoginResult' : 'idle';
      csNudgeTries = 0;
      csNudgeRunning = false;
      autoRefreshScheduled = false;
      clearAutoLoginBootstrap();
    });
    ws.addEventListener('close', () => {
      if (activeWS === ws) log('🔌 WebSocket เกมปิดแล้ว');
    });
    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      try { const u = syncU8(data); if (u) handleOut(u); } catch (e) {}
      return origSend(data);
    };
    ws.addEventListener('message', async (e) => {
      try { const u = await toU8(e.data); if (u) handleIn(u); } catch (err) {}
    });
  }
  const NativeWS = window.WebSocket;
  window.WebSocket = function (...a) { const ws = new NativeWS(...a); attach(ws); return ws; };
  window.WebSocket.prototype = NativeWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(k => window.WebSocket[k] = NativeWS[k]);

  // เกมที่ใช้บัญชีที่จำไว้ อาจเปิด WS และแสดงหน้าเลือกตัวละครโดยไม่ส่ง token 0x00
  // CharacterSelectWindow ของ client รองรับ ←/→ เพื่อเลือก slot 0..2 และ Enter เพื่อยืนยัน
  // จึงควบคุมด้วยคีย์ตาม slot ที่ตั้งไว้ แทนการคลิกสุ่มตำแหน่งบน canvas
  let csNudgeTries = 0;
  let csNudgeRunning = false;
  const autoLoginSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function sendAutoLoginKey(canvas, key, code, keyCode) {
    const options = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true };
    canvas.dispatchEvent(new KeyboardEvent('keydown', options));
    await autoLoginSleep(45);
    canvas.dispatchEvent(new KeyboardEvent('keyup', options));
  }
  async function selectConfiguredCharacter() {
    const canvas = document.querySelector('canvas') || document.body;
    // CharacterSelectWindow ใช้ AddAndWrapValue(..., 0, 2): กด ← 3 ครั้งจะ reset เป็น slot 0 จากทุก slot
    const slot = Math.max(0, Math.min(2, parseInt(CFG.autoLoginSlot, 10) || 0));
    autoLoginPhase = 'charSelectNudging';
    for (let i = 0; i < 3; i++) {
      await sendAutoLoginKey(canvas, 'ArrowLeft', 'ArrowLeft', 37);
      await autoLoginSleep(90);
    }
    for (let i = 0; i < slot; i++) {
      await sendAutoLoginKey(canvas, 'ArrowRight', 'ArrowRight', 39);
      await autoLoginSleep(90);
    }
    // หยุดทันทีถ้า client เลือกตัวละครไปแล้วระหว่างลำดับคีย์
    if (playerId != null || autoLoginPhase === 'clientSelect' || autoLoginPhase === 'done') return;
    await sendAutoLoginKey(canvas, 'Enter', 'Enter', 13);
    log('🎯 Auto-Login: เลือก slot ' + slot + ' (←×3 →×' + slot + ' + Enter) — รอเข้าเกม');
  }
  const csNudgeTimer = setInterval(async () => {
    if (!masterBot.enabled()) return;
    const wsOpen = activeWS && activeWS.readyState === 1;
    if (!CFG.autoLoginEnabled || !wsOpen || playerId != null || autoLoginPhase === 'clientSelect' || autoLoginPhase === 'done') {
      if (playerId != null || autoLoginPhase === 'done') csNudgeTries = 0;
      return;
    }
    if (csNudgeRunning || !wsOpenedAt || Date.now() - wsOpenedAt < 12000 || csNudgeTries >= 12) return;
    csNudgeTries++;
    csNudgeRunning = true;
    try {
      await selectConfiguredCharacter();
    } catch (e) {
      log('⚠️ Auto-Login: เลือกตัวละครผ่าน UI ไม่สำเร็จ:', e && e.message ? e.message : 'unknown error');
    } finally {
      csNudgeRunning = false;
    }
  }, 8000);

  // เฝ้าระวัง recovery เท่านั้น: ไม่สั่ง teleport/attack และไม่เข้าไปยุ่ง flow ในเกม
  const autoRefreshWatchdog = setInterval(() => {
    if (!masterBot.enabled()) return;
    if (!CFG.autoRefreshEnabled || autoRefreshScheduled) return;
    const now = Date.now();
    const stallMs = Math.max(60, Number(CFG.autoRefreshStallSec) || 180) * 1000;
    const movementStallMs = autoRefreshMovementStallMs();
    const wsOpen = activeWS && activeWS.readyState === 1;
    const silentMs = now - lastGamePacketAt;
    if (playerId != null && silentMs > stallMs) {
      scheduleAutoRefresh('ไม่มี packet ' + Math.round(silentMs / 1000) + 's');
    } else if (playerId != null && movementStallMs > 0 && lastPlayerPositionChangedAt > 0 && now - lastPlayerPositionChangedAt > movementStallMs) {
      scheduleAutoRefresh('ตัวละครไม่ขยับ ' + Math.round((now - lastPlayerPositionChangedAt) / 1000) + 's');
    } else if (wsOpen && playerId == null && CFG.autoLoginEnabled && wsOpenedAt && now - wsOpenedAt > stallMs) {
      scheduleAutoRefresh('ค้างหน้า login/เลือกตัวละครเกิน ' + Math.round(stallMs / 1000) + 's');
    }
  }, 10000);

  // One cleanup owner for Master Bot.  It never sends another game command on
  // pause: any active NPC window is harmless, while stale route/claim state is
  // not.  Resume starts from fresh packet state and the existing per-feature
  // settings remain untouched.
  masterBot.setHandlers({
    pause() {
      lootQueue.pause();
      queue.clear();
      warpQueue.clear();
      pickupPending = null;
      recentDrops.clear();
      lootSettleUntil = 0;
      target = null;
      resetCombatGatChase();
      resetWeaponSwap('Master Bot paused');
      movementPlanner.reset();
      navPatrolReset(); navWanderReset(); gatWanderReset();
      resetAutoSupportQueue();
      clearAiInteraction('Master Bot paused');
      stopAbBuff('Master Bot paused');
      sellState = 'IDLE'; sellReturnTo = null; sellNpcId = null;
      storageState = 'IDLE'; storageReturnTo = null; storageNpcId = null; storageMoveQueue = []; storageMoveIdx = 0;
      oreRefineState = 'IDLE'; oreRefineBatch = 0; oreRefineKafraId = null; oreRefineNpcId = null;
      clearAutoLoginBootstrap();
      if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
      autoRefreshTimer = null; autoRefreshScheduled = false;
    },
    resume() {
      if (CFG.autoLoginEnabled) startAutoLoginBootstrap();
      lootQueue.resume();
    },
  });

  // Profile switch เป็นจุดเปลี่ยน config ใหญ่ จึงรอให้ action ที่ถือสิทธิ์/ส่ง packet ต่อเนื่องจบก่อน
  // การ block ดีกว่าตัด state กลางทาง เพราะอาจทิ้ง claim Loot Queue หรือคุย NPC ผิด flow ได้.
  function profileSwitchBlockers() {
    const blockers = [];
    if (lootQueue.isProfileBusy()) blockers.push('Loot Queue กำลังมีงาน/offer');
    if (queue.size || warpQueue.size || pickupPending) blockers.push('กำลังเก็บของปกติ');
    if (sellState !== 'IDLE') blockers.push('กำลังขายของ');
    if (storageState !== 'IDLE') blockers.push('กำลังฝาก Kafra');
    if (isOreRefineActive()) blockers.push('กำลังแปรรูปแร่');
    if (isAbBuffActive()) blockers.push('กำลังรับ AB Buff');
    if (target || weaponSwap) blockers.push('กำลังสู้/สลับอาวุธ');
    return blockers;
  }
  function resetProfileRuntimeState() {
    // state เหล่านี้ไม่ใช่ค่า setting และไม่ควรติดจากงานเก่าไปใช้กับ profile ใหม่
    target = null;
    weaponSwap = null;
    resetAutoSupportQueue();
    combatCooldownUntil = 0;
    postWarpFleeScanPending = false;
    postWarpTargetSettlePending = false;
    postWarpTargetSettleUntil = 0;
    clearAiInteraction();
    navPatrolReset();
    navWanderReset();
    gatWanderReset();
  }
  function saveProfileAs(name) {
    // ไม่กรอกชื่อ = บันทึกทับ profile ที่กำลังใช้อยู่; กรอกชื่อจึงสร้าง/ทับชื่อนั้น
    const requestedName = String(name == null ? '' : name).trim();
    name = requestedName ? normalizeProfileName(requestedName) : activeProfileName();
    if (!name) { log('⚠️ Profile: ชื่อยาวเกิน 80 ตัว หรือเป็นชื่อสงวน'); return false; }
    const profiles = loadProfilesStore();
    const existed = Object.prototype.hasOwnProperty.call(profiles, name);
    profiles[name] = profileSnapshot();
    if (!saveProfilesStore(profiles)) { log('⚠️ Profile: บันทึกลง browser ไม่สำเร็จ'); return false; }
    notifyProfilesChanged();
    log(existed ? '💾 Profile: บันทึกทับ "' + name + '"' : '💾 Profile: สร้าง "' + name + '"', '(' + Object.keys(profiles[name]).length + ' ค่า)');
    return true;
  }
  function switchProfile(name) {
    name = normalizeProfileName(name);
    const profiles = loadProfilesStore();
    const targetProfile = profiles[name];
    if (!name || !targetProfile || typeof targetProfile !== 'object') { log('⚠️ Profile: ไม่พบ "' + String(name || '') + '" — บันทึกเป็นก่อน'); return false; }
    const current = activeProfileName();
    if (name === current) { log('ℹ️ Profile: กำลังใช้ "' + name + '" อยู่แล้ว'); return false; }
    const blockers = profileSwitchBlockers();
    if (blockers.length) { log('⚠️ Profile: ยังสลับไม่ได้ — รอ ' + blockers.join(', ') + ' จบก่อน'); return false; }

    // save current ก่อน แล้ว restore เต็มชุด; key ที่ target ไม่มีกลับ default ไม่ค้างจาก profile เดิม
    profiles[current] = profileSnapshot();
    for (const key of PERSIST_KEYS) {
      CFG[key] = Object.prototype.hasOwnProperty.call(targetProfile, key)
        ? cloneConfigValue(targetProfile[key])
        : cloneConfigValue(CFG_DEFAULTS[key]);
    }
    const profileFpsCap = setConfiguredFpsCap(CFG.renderFpsCap);
    CFG.renderFpsCap = profileFpsCap == null ? 0 : profileFpsCap;
    saveProfilesStore(profiles);
    setActiveProfileName(name);
    notifyProfilesChanged();
    saveConfig();
    resetProfileRuntimeState();

    // endpoint/role และ relay อาจเปลี่ยนตาม profile; reconnect หลัง state เก่าถูกยืนยันว่า idle แล้วเท่านั้น
    lootQueue.reconnect();
    if (relayWs) { try { relayWs.close(); } catch (_) {} relayWs = null; }
    relayReconnectAt = 0;
    relayConnectedAt = 0;
    if (CFG.monitorServerEnabled) { connectRelay(); relayRegisterPlayer(); }
    log('🔄 Profile: ' + current + ' → ' + name + ' (' + Object.keys(targetProfile).length + ' ค่า)');
    return true;
  }
  function deleteProfile(name) {
    name = normalizeProfileName(name);
    const profiles = loadProfilesStore();
    if (!name || !Object.prototype.hasOwnProperty.call(profiles, name)) { log('⚠️ Profile: ไม่พบ "' + String(name || '') + '"'); return false; }
    if (name === activeProfileName()) { log('⚠️ Profile: ห้ามลบชุดที่กำลังใช้อยู่ — สลับไปชุดอื่นก่อน'); return false; }
    delete profiles[name];
    if (!saveProfilesStore(profiles)) { log('⚠️ Profile: ลบจาก browser ไม่สำเร็จ'); return false; }
    notifyProfilesChanged();
    log('🗑 Profile: ลบ "' + name + '" แล้ว');
    return true;
  }

  // ============================================================
  //  API ควบคุมจาก console — พิมพ์ ASSIST.<method>()
  // ============================================================
  window.ASSIST = {
    // ---------- Master Bot ----------
    masterBotOn() { return masterBot.setEnabled(true); },
    masterBotOff() { return masterBot.setEnabled(false); },
    toggleMasterBot() { return masterBot.setEnabled(!masterBot.enabled()); },
    masterBotStatus() { return masterBot.status(); },

    // ---------- Profile ----------
    activeProfile() { return activeProfileName(); },
    listProfiles() { return profileNames(); },
    profileStatus() {
      const profiles = loadProfilesStore();
      return {
        active: activeProfileName(),
        names: profileNames(),
        savedCount: Object.keys(profiles).length,
        blockers: profileSwitchBlockers(),
      };
    },
    saveProfileAs(name) { return saveProfileAs(name); },
    switchProfile(name) { return switchProfile(name); },
    deleteProfile(name) { return deleteProfile(name); },

    // ---------- สถานะ ----------
    status() {
      const pct = hpPct();
      console.table([{
        version: VERSION,
        loot: CFG.lootEnabled ? 'ON' : 'off',
        heal: CFG.healEnabled ? 'ON' : 'off',
        dead: isDead ? '☠️ YES' : 'no',
        HP: hp.cur != null ? `${hp.cur}/${hp.max} (${pct != null ? pct.toFixed(0) : '?'}%)` : '?',
        healAt: CFG.healAtPercent + '%',
        healItems: CFG.healItems.map(nameOf).join(', '),
        healMode: CFG.healMode,
        lootMode: CFG.filter.mode,
        lootQueue: queue.size,
        fpsCap: CFG.renderFpsCap === 0 ? 'Unlimited' : CFG.renderFpsCap + ' FPS',
        player_id: playerId ? playerId.toString(16) : '?',
      }]);
      const now = Date.now();
      const healStatus = CFG.healItems.map(id => ({
        id,
        name: nameOf(id),
        available: heal.isAvailable(id, now),
        retryInMs: heal.isAvailable(id, now) ? 0 : (heal.exhaustedUntil.get(id) - now),
      }));
      return {
        hp: { ...hp }, hpPct: pct, isDead,
        heal: { enabled: CFG.healEnabled, mode: CFG.healMode, threshold: CFG.healAtPercent + '%', items: healStatus },
        loot: { ...CFG.filter, queue: [...queue.values()].map(it => ({ item: nameOf(it.itemId), ...it })) },
        fpsCap: fpsCap.status(),
      };
    },
    setFpsCap(value) {
      const fps = setConfiguredFpsCap(value);
      if (fps == null) {
        log('⚠️ FPS Cap ต้องเป็น ' + FPS_CAP_OPTIONS.join(', ') + ' เท่านั้น (0 = Unlimited)');
        return false;
      }
      CFG.renderFpsCap = fps;
      saveConfigDebounced();
      log('🎞 FPS Cap: ' + (fps === 0 ? 'Unlimited' : fps + ' FPS'));
      return true;
    },
    fpsCapStatus() {
      return {
        ...fpsCap.status(), bootCompleted: unityBootCompleted,
        mapLoadUncapped: fpsCapMapLoadActive,
        mapLoadRestoreRemainingMs: Math.max(0, fpsCapMapRestoreAt - Date.now()),
        options: [...FPS_CAP_OPTIONS],
      };
    },
    help() {
      console.log(`%c ASSIST — คำสั่ง `, 'background:#4caf50;color:#fff;padding:2px 6px;border-radius:3px');
      console.log(`%c Auto-Heal `, 'color:#e91e63;font-weight:bold');
      console.log('  ASSIST.healOn() / ASSIST.healOff()');
      console.log('  ASSIST.setHealAt(50)              // เลือดต่ำกว่า 50% → ใช้ยา');
      console.log('  ASSIST.setHealItems(501,502,503)  // เซ็ตรายการ item id');
      console.log('  ASSIST.addHealItem(503)           // เพิ่ม item');
      console.log('  ASSIST.setHealMode("order")       // "order"=ใช้ตัวเดิมจนหมดแล้วข้าม, "random"=สุ่ม');
      console.log('  ASSIST.setHealDelay(800)          // ดีเลย์ ms');
      console.log('  ASSIST.setHealExhausted(3000)     // item หมด→รอ N ms แล้วลองใหม่ (default 3000)');
      console.log('  ASSIST.clearHealExhausted()       // บังคับลองใช้ item ทุกตัวใหม่ (ล้าง mark หมด)');
      console.log('  ASSIST.setHealToFull(true)        // true=ใช้ยาจนเต็ม, false=พ้น threshold หยุด');
      console.log(`%c Auto-Buff `, 'color:#9b59b6;font-weight:bold');
      console.log('  ASSIST.buffOn() / ASSIST.buffOff()');
      console.log('  ASSIST.addBuffItem(656, 30)        // Awakening Potion ทุก 30 นาที');
      console.log('  ASSIST.setBuffItems([{itemId:656,intervalMin:30}])');
      console.log('  ASSIST.removeBuffItem(656)         ASSIST.buffNow()');
      console.log('  ASSIST.getBuffCountdowns()         // ดู countdown แต่ละตัว');
      console.log(`%c Auto-Loot `, 'color:#2196f3;font-weight:bold');
      console.log('  ASSIST.lootOn() / ASSIST.lootOff()');
      console.log('  ASSIST.setLootMode("all")         // "all" | "only" | "except"');
      console.log('  ASSIST.addLootOnly(909,512)       ASSIST.addLootExcept(909)');
      console.log('  ASSIST.clearLootOnly()            ASSIST.clearLootExcept()');
      console.log('  ASSIST.setLootDelay(500)         // รอ 500ms หลังของตกแล้วค่อยเก็บ (0=ทันที)');
      console.log('  ASSIST.setFpsCap(30)             // 0, 15, 30, 45 หรือ 60 FPS (0 = Unlimited)');
      console.log(`%c Profile `, 'color:#ffb74d;font-weight:bold');
      console.log('  ASSIST.listProfiles() / ASSIST.activeProfile()');
      console.log('  ASSIST.saveProfileAs("ฟาร์ม Sleeper")');
      console.log('  ASSIST.switchProfile("ฟาร์ม Sleeper") / ASSIST.deleteProfile("...")');
      console.log(`%c อื่นๆ `, 'color:#9c27b0;font-weight:bold');
      console.log(`%c Navigation `, 'color:#26a69a;font-weight:bold');
      console.log('  ASSIST.navRecordOn() / navRecordOff()   // บันทึกเส้นทางเดิน');
      console.log('  ASSIST.navGetAllStats()                  // ดูข้อมูลทุกแมป');
      console.log('  ASSIST.navExport() / navImport(json)     // export/import ไฟล์');
      console.log('  ASSIST.name(935,"Feather")        // ตั้งชื่อ item');
      console.log('%c AI Chat Reply ', 'color:#42a5f5;font-weight:bold');
      console.log('  ASSIST.aiReplyOn() / ASSIST.aiReplyOff()');
      console.log('  ASSIST.templateReplyOn() / ASSIST.setReplyTemplates(["สวัสดีครับ"])');
      console.log('  ASSIST.aiReplyStatus()             // ดูการตั้งค่า/การตอบในรอบ 1 นาที');
      console.log('  ASSIST.status()  ASSIST.config()  ASSIST.stopAll()');
    },

    // ---------- AI Chat Reply ----------
    aiReplyOn() {
      if (!CFG.aiReplyApiUrl || !CFG.aiReplyApiKey || !CFG.aiReplyModel) {
        log('⚠️ AI Reply: ตั้ง endpoint, API key และ model ให้ครบก่อน');
        return false;
      }
      CFG.aiReplyMode = 'ai';
      CFG.aiReplyEnabled = true;
      saveConfigDebounced();
      log('🤖 AI Reply: ON (ระยะ ' + CFG.aiReplyRadius + ' ช่อง)');
      return true;
    },
    templateReplyOn() {
      if (!aiReplyTemplateList().length) {
        log('⚠️ Template Reply: เพิ่มคำตอบอย่างน้อย 1 ข้อความก่อน');
        return false;
      }
      CFG.aiReplyMode = 'template';
      CFG.aiReplyEnabled = true;
      saveConfigDebounced();
      log('💬 Template Reply: ON (' + aiReplyTemplateList().length + ' ข้อความ)');
      return true;
    },
    setReplyTemplates(templates) {
      if (!Array.isArray(templates)) { log('⚠️ Template Reply: ต้องส่ง array ของข้อความ'); return false; }
      CFG.aiReplyTemplates = templates.map(reply => aiReplyTrim(reply, 190)).filter(Boolean).slice(0, 50);
      saveConfigDebounced();
      log('💬 บันทึก Template Reply:', CFG.aiReplyTemplates.length + ' ข้อความ');
      return true;
    },
    aiReplyOff() { CFG.aiReplyEnabled = false; clearAiInteraction(); saveConfigDebounced(); log('🤖 AI Reply: OFF'); },
    aiReplyStatus() {
      const now = Date.now();
      while (aiReplySentAt.length && now - aiReplySentAt[0] >= 60000) aiReplySentAt.shift();
      return {
        enabled: CFG.aiReplyEnabled,
        mode: aiReplyUsesTemplates() ? 'template' : 'ai',
        pending: aiReplyPending,
        apiUrl: CFG.aiReplyApiUrl,
        model: CFG.aiReplyModel,
        keyConfigured: !!CFG.aiReplyApiKey,
        templates: aiReplyTemplateList(),
        radius: CFG.aiReplyRadius,
        allowedNames: [...aiReplyAllowedNameSet()],
        delayRangeSec: [CFG.aiReplyDelayMinSec, CFG.aiReplyDelayMaxSec],
        cooldownSec: CFG.aiReplyCooldownSec,
        sentLastMinute: aiReplySentAt.length,
        maxPerMin: CFG.aiReplyMaxPerMin,
        requireNameMention: CFG.aiReplyRequireNameMention,
        interaction: aiInteraction && { name: aiInteraction.name, phase: aiInteraction.phase, startedAt: aiInteraction.startedAt },
      };
    },
    clearAIReplyKey() {
      CFG.aiReplyApiKey = '';
      if (!aiReplyUsesTemplates()) { CFG.aiReplyEnabled = false; clearAiInteraction(); }
      saveConfigDebounced();
      log('🗑 ล้าง API key แล้ว' + (aiReplyUsesTemplates() ? ' (Template Reply ยังเปิดได้)' : ' และปิด AI Reply แล้ว'));
    },

    // ---------- Auto-Login / Auto-Refresh ----------
    setAutoLogin(user, pass, slot = 0) {
      CFG.autoLoginUser = String(user || '').trim();
      CFG.autoLoginPass = String(pass || '');
      CFG.autoLoginSlot = Math.max(0, Math.min(2, parseInt(slot, 10) || 0));
      saveConfigDebounced();
      log('🤖 บันทึก Auto-Login: user=' + (CFG.autoLoginUser || '(ว่าง)') + ', slot=' + CFG.autoLoginSlot);
    },
    autoLoginOn() { CFG.autoLoginEnabled = true; saveConfigDebounced(); startAutoLoginBootstrap(); log('🤖 Auto-Login: ON (ใช้บัญชีที่เกมจำไว้ + Enter)'); },
    autoLoginOff() { CFG.autoLoginEnabled = false; clearAutoLoginBootstrap(); saveConfigDebounced(); log('🤖 Auto-Login: OFF'); },
    autoRefreshOn() { CFG.autoRefreshEnabled = true; saveConfigDebounced(); log('🔄 Auto-Refresh: ON'); },
    autoRefreshOff() { CFG.autoRefreshEnabled = false; saveConfigDebounced(); log('🔄 Auto-Refresh: OFF'); },
    setAutoRefresh(sec) {
      CFG.autoRefreshStallSec = Math.max(60, Math.min(1800, parseInt(sec, 10) || 180));
      saveConfigDebounced();
      log('🔄 Auto-Refresh: ไม่มี packet ' + CFG.autoRefreshStallSec + 's → refresh');
    },
    setAutoRefreshMovementStall(sec) {
      const parsed = Number(sec);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 3600) {
        log('⚠️ Auto-Refresh: เวลาตัวละครไม่ขยับต้องอยู่ระหว่าง 0–3600 วินาที');
        return false;
      }
      CFG.autoRefreshMovementStallSec = Math.round(parsed);
      saveConfigDebounced();
      log('🔄 Auto-Refresh: ตัวละครไม่ขยับ ' + (CFG.autoRefreshMovementStallSec ? CFG.autoRefreshMovementStallSec + 's' : 'ปิดเงื่อนไขนี้') + ' → refresh');
      return true;
    },
    autoLoginStatus() {
      const now = Date.now();
      return {
        loginEnabled: CFG.autoLoginEnabled, refreshEnabled: CFG.autoRefreshEnabled,
        usesGameSavedLogin: true,
        slot: CFG.autoLoginSlot, phase: autoLoginPhase,
        wsOpen: !!(activeWS && activeWS.readyState === 1),
        lastPacketAgoMs: Math.max(0, now - lastGamePacketAt),
        lastMovementAgoMs: lastPlayerPositionChangedAt ? Math.max(0, now - lastPlayerPositionChangedAt) : null,
        stallSec: CFG.autoRefreshStallSec,
        movementStallSec: Math.round(autoRefreshMovementStallMs() / 1000),
      };
    },

    // ---------- Auto-Heal ----------
    healOn() {
      if (!CFG.healItems.length) {
        console.warn('⚠️ ยังไม่มี item heal — ตั้งก่อนด้วย ASSIST.setHealItems(...) ไม่งั้นจะไม่ทำงาน');
      }
      CFG.healEnabled = true; log('💉 Auto-Heal: ON');
    },
    healOff() { CFG.healEnabled = false; log('💉 Auto-Heal: OFF'); },
    setHealAt(pct) {
      if (typeof pct !== 'number' || pct < 1 || pct > 100) { console.warn('ต้องเป็นเลข 1-100'); return; }
      CFG.healAtPercent = pct;
      log('💉 threshold =', pct + '%');
    },
    setHealItems(...ids) {
      CFG.healItems = ids.filter(x => typeof x === 'number');
      heal.clearExhausted();
      heal.depletedItemIds.clear();
      heal.syncKnownInventory();
      // ★ ตั้ง item = เจตนาเปิดใช้ → เปิด auto-heal ให้อัตโนมัติ (default ปิดอยู่)
      CFG.healEnabled = true;
      log('💉 healItems =', CFG.healItems.map(nameOf).join(', '), '→ auto-heal ON');
    },
    addHealItem(...ids) {
      for (const id of ids) if (!CFG.healItems.includes(id)) CFG.healItems.push(id);
      heal.syncKnownInventory();
      log('💉 healItems =', CFG.healItems.map(nameOf).join(', '));
    },
    setHealMode(mode) {
      if (!['order', 'random'].includes(mode)) { console.warn('โหมดต้องเป็น order/random'); return; }
      CFG.healMode = mode; log('💉 healMode =', mode);
    },
    setHealDelay(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.healDelayMs = ms; log('💉 delay =', ms + 'ms');
    },
    // ตั้งระยะเวลาที่ item ที่ "หมด" จะรอก่อนลองใหม่ (ms) — default 3000
    setHealExhausted(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.healExhaustedMs = ms; log('💉 item หมด → รอ', ms + 'ms แล้วลองใหม่');
    },
    // ล้าง mark "หมด" ทั้งหมดทันที (บังคับลองใช้ item ทุกตัวอีกครั้ง)
    clearHealExhausted() {
      heal.clearExhausted();
      log('💉 ล้าง mark "หมด" ทั้งหมด → ลองใช้ item ทุกตัวใหม่');
    },
    setHealToFull(on) { CFG.healAtMax = !!on; log('💉 ใช้ยาจนเต็ม =', CFG.healAtMax); },

    // ---------- Auto-Buff ----------
    //  buffItems: [{itemId, intervalMin}] — intervalMin = ทุกกี่นาทีจะใช้ซ้ำ
    //  เก็บเวลาใช้ล่าสุดข้าม session (localStorage) กัน buff หายเมื่อ refresh
    buffOn()  { CFG.buffEnabled = true;  log('✨ Auto-Buff: ON'); },
    buffOff() { CFG.buffEnabled = false; log('✨ Auto-Buff: OFF'); },
    // ★ setBuffItems([{itemId:656, intervalMin:30}, ...]) — แทนที่ทั้งรายการ
    setBuffItems(items) {
      CFG.buffItems = (items || []).filter(x => x && x.itemId && x.intervalMin > 0)
        .map(x => ({ itemId: Number(x.itemId), intervalMin: Number(x.intervalMin) }));
      CFG.buffEnabled = true;
      log('✨ buffItems =', CFG.buffItems.map(x => nameOf(x.itemId) + '(ทุก' + x.intervalMin + 'นาที)').join(', '));
    },
    // ★ addBuffItem(itemId, intervalMin) — เพิ่ม 1 รายการ (ถ้ามี itemId อยู่แล้ว = update interval)
    addBuffItem(itemId, intervalMin) {
      itemId = Number(itemId); intervalMin = Number(intervalMin);
      if (!itemId || intervalMin <= 0) { log('⚠️ itemId และ intervalMin ต้อง > 0'); return; }
      const existing = CFG.buffItems.find(x => x.itemId === itemId);
      if (existing) { existing.intervalMin = intervalMin; log('✨ แก้', nameOf(itemId), '→ ทุก', intervalMin + 'นาที'); }
      else { CFG.buffItems.push({ itemId, intervalMin }); log('✨ เพิ่ม', nameOf(itemId), 'ทุก', intervalMin + 'นาที'); }
    },
    removeBuffItem(itemId) {
      itemId = Number(itemId);
      CFG.buffItems = CFG.buffItems.filter(x => x.itemId !== itemId);
      lastBuffUse.delete(itemId);
      log('✨ ลบ buff', nameOf(itemId));
    },
    // ★ ใช้ buff ทั้งหมดทันที (reset countdown) — เผื่ออยากใช้เลยไม่รอ
    buffNow() {
      if (!CFG.buffItems.length) { log('⚠️ ยังไม่ได้ตั้ง buffItems'); return; }
      if (!activeWS || activeWS.readyState !== 1) { log('⚠️ ยังไม่ได้เชื่อมต่อ'); return; }
      const now = nowMs();
      let used = 0;
      for (const item of CFG.buffItems) {
        if (sendUseItem(item.itemId)) { lastBuffUse.set(item.itemId, now); used++; }
      }
      log('✨ ใช้ buff ทั้งหมด', used, 'รายการทันที');
    },
    // ★ ดู countdown ของแต่ละ buff (สำหรับ UI + debug)
    getBuffCountdowns() {
      const now = nowMs();
      return CFG.buffItems.map(item => {
        const last = lastBuffUse.get(item.itemId) || 0;
        const intervalMs = item.intervalMin * 60 * 1000;
        if (!last) return {
          itemId: item.itemId,
          name: itemDisplayName(item.itemId),
          intervalMin: item.intervalMin,
          lastUsed: null,
          nextUseAt: null,
          remainingMs: 0,
        };
        const nextUseAt = last + intervalMs;
        return {
          itemId: item.itemId,
          name: itemDisplayName(item.itemId),
          intervalMin: item.intervalMin,
          lastUsed: last,
          nextUseAt,
          remainingMs: Math.max(0, nextUseAt - now),
        };
      });
    },
    clearBuffTimes() { lastBuffUse.clear(); log('✨ ล้าง countdown buff ของ session นี้ → จะใช้ใหม่ทันที'); },

    // ---------- AB Buff ----------
    abBuffOn() { CFG.abBuffEnabled = true; saveConfigDebounced(); log('⛪ AB Buff: ON'); },
    abBuffOff() { CFG.abBuffEnabled = false; stopAbBuff('ผู้ใช้ปิดระบบ'); saveConfigDebounced(); log('⛪ AB Buff: OFF'); },
    setAbBuffLocation(map, x, y) {
      const mapName = String(map || '').trim();
      const posX = Math.round(Number(x));
      const posY = Math.round(Number(y));
      if (!mapName || !Number.isFinite(posX) || !Number.isFinite(posY)) {
        log('⚠️ AB Buff: map/x/y ไม่ถูกต้อง'); return;
      }
      CFG.abBuffMap = mapName;
      CFG.abBuffX = posX;
      CFG.abBuffY = posY;
      saveConfigDebounced();
      log('⛪ จุดรับ AB Buff:', CFG.abBuffMap, '@(', CFG.abBuffX, CFG.abBuffY + ')');
    },
    setAbBuffTimeoutSec(seconds) {
      const sec = Math.round(Number(seconds));
      if (!Number.isFinite(sec) || sec < 30 || sec > 900) {
        log('⚠️ AB Buff timeout ต้องอยู่ระหว่าง 30–900 วินาที');
        return false;
      }
      CFG.abBuffTimeoutSec = sec;
      saveConfigDebounced();
      log('⛪ AB Buff timeout =', sec, 'วินาที (timeout แล้วกลับฟาร์มและปิด)');
      return true;
    },
    setAbBuffReturnDelaySec(seconds) {
      const sec = Number(seconds);
      if (!Number.isFinite(sec) || sec < 0 || sec > 60) {
        log('⚠️ เวลารอกลับหลังได้บัพต้องอยู่ระหว่าง 0–60 วินาที');
        return false;
      }
      CFG.abBuffReturnDelayMs = Math.round(sec * 1000);
      saveConfigDebounced();
      log('⛪ รอหลังได้บัพครบ =', sec + ' วินาที');
      return true;
    },
    abBuffNow() {
      CFG.abBuffEnabled = true;
      abBuffEffects.clear(); // ปุ่ม manual = บังคับรับใหม่ แม้เพิ่งเห็น status เดิม
      const timerNow = abBuffTimerNow();
      // Manual มีเจตนาเริ่ม AB ทันที แต่ไม่ตัดงาน special drop ที่ collector รับสิทธิ์มาแล้ว
      // เมื่อ Queue ว่าง abBuffLoop จะเริ่ม WARP_TO_AB ในรอบถัดไปเอง
      if (lootQueue.isCollectorActive()) {
        setAbBuffState('PENDING_IDLE', 'manual รอ Loot Queue จบ');
        abBuffPendingStartedAt = timerNow;
        abBuffAttemptStartedAt = 0;
        log('⛪ AB Buff manual: รอ Loot Queue ที่ claim แล้วจบก่อน');
      } else {
        setAbBuffState('WARP_TO_AB', 'เริ่มรับบัพด้วยปุ่ม manual');
        abBuffPendingStartedAt = 0;
        abBuffAttemptStartedAt = timerNow;
        log('⛪ เริ่มรับ AB Buff ตอนนี้');
      }
      abBuffDisableAfterReturn = false;
      abBuffNextAt = 0;
      saveConfigDebounced();
    },
    abBuffStatus() {
      const timerNow = abBuffTimerNow();
      const hasAll = hasAllAbBuffs(timerNow);
      const attemptActive = !hasAll && abBuffState !== 'IDLE' && abBuffState !== 'PENDING_IDLE';
      return { enabled: CFG.abBuffEnabled, state: abBuffState, map: CFG.abBuffMap, x: CFG.abBuffX, y: CFG.abBuffY,
        blessing: hasAbBuffStatus(0x10, timerNow), increaseAgi: hasAbBuffStatus(0x11, timerNow),
        missing: missingAbBuffNames(timerNow),
        pendingRemainingMs: abBuffRemainingMs(abBuffPendingStartedAt, timerNow),
        attemptRemainingMs: attemptActive ? abBuffRemainingMs(abBuffAttemptStartedAt, timerNow) : null };
    },

    // ---------- Auto-Skill ----------
    skillOn()  { CFG.skillEnabled = true; resetAutoSupportQueue(); log('✨ Auto-Skill: ON'); },
    skillOff() { CFG.skillEnabled = false; resetAutoSupportQueue(); log('✨ Auto-Skill: OFF'); },
    setSkillCommandGap(ms) {
      const value = Math.max(250, Math.min(5000, Math.round(Number(ms) || 1500)));
      CFG.skillCommandGapMs = value;
      saveConfigDebounced();
      log('✨ เว้นระหว่างสกิลคนละชนิด =', value + 'ms');
    },
    // ★ setSkills([{skillId:3, level:10, targeted:true, maxUsesPerTarget:2, maxDistance:2, spMin:15, cooldownMs:2000}, ...])
    setSkills(skills) {
      CFG.skills = (skills || []).filter(s => s && s.skillId != null).map(s => ({
        name: s.name || ('skill_' + s.skillId),
        skillId: Number(s.skillId),
        level: Number(s.level) || 1,
        targeted: !!s.targeted,
        ground: !!s.ground,
        selfCast: !!s.selfCast,
        ally: !!s.ally,
        buffMode: !!s.buffMode,
        intervalMin: Number(s.intervalMin) || 0,
        mobCountMin: Number(s.mobCountMin) || 0,
        maxUsesPerTarget: Number(s.maxUsesPerTarget) || 1,
        maxDistance: Number(s.maxDistance) || 0,
        minDistance: Number(s.minDistance) || 0,
        spMin: Number(s.spMin) || 0,
        cooldownMs: Number(s.cooldownMs) || 2000,
        hpBelowPct: Math.max(0, Math.min(100, Number(s.hpBelowPct) || 0)),
      }));
      resetAutoSupportQueue();
      log('✨ skills =', CFG.skills.length, 'รายการ');
    },
    addSkill(skill) {
      if (!skill || skill.skillId == null) { log('⚠️ ต้องมี skillId'); return; }
      const modeKey = (s) => s.buffMode ? 'buff' : (s.ally ? 'ally' : (s.selfCast ? 'self' : (s.ground ? 'ground' : (s.targeted ? 'targeted' : 'aoe'))));
      const existing = CFG.skills.find(s => s.skillId === skill.skillId && modeKey(s) === modeKey(skill));
      if (existing) { Object.assign(existing, skill); log('✨ แก้ skill', skill.skillId, '(' + modeKey(skill) + ')'); }
      else { CFG.skills.push(skill); log('✨ เพิ่ม skill', skill.skillId, '(' + modeKey(skill) + ')'); }
      resetAutoSupportQueue();
    },
    removeSkill(skillId) {
      CFG.skills = CFG.skills.filter(s => s.skillId !== skillId);
      resetAutoSupportQueue();
      log('✨ ลบ skill', skillId);
    },
    skillNow() {
      queueSkillsNow();
    },
    clearSkillTimes() { lastSkillUse.clear(); selfSupportPendingUntil.clear(); resetAutoSupportQueue(); saveSkillTimes(); log('✨ ล้างเวลา skill ทั้งหมด'); },
    getSkillCooldowns() {
      const now = nowMs();
      return CFG.skills.map(s => {
        const last = lastSkillUse.get(s.skillId) || 0;
        const cd = (s.intervalMin > 0) ? s.intervalMin * 60 * 1000 : (s.cooldownMs || 2000);
        return { skillId: s.skillId, name: s.name, lastUsed: last, nextUseAt: last + cd, remainingMs: Math.max(0, last + cd - now) };
      });
    },
    getSkillStates() {
      const now = nowMs();
      return CFG.skills.map(s => {
        const statusId = selfSupportStatusId(s);
        if (statusId != null) return {
          skillId: s.skillId, name: s.name, statusBacked: true, statusId,
          active: hasSelfSupportStatus(s, now), pending: isSelfSupportStatusPending(s, now),
        };
        const last = lastSkillUse.get(s.skillId) || 0;
        const cd = (s.intervalMin > 0) ? s.intervalMin * 60 * 1000 : (s.cooldownMs || 2000);
        return { skillId: s.skillId, name: s.name, statusBacked: false, active: false, pending: false, remainingMs: Math.max(0, last + cd - now) };
      });
    },
    restOn()  { CFG.restEnabled = true;  log('🪑 Auto-Rest: ON (HP < ' + CFG.restHpPercent + '% → นั่งพัก)'); },
    restOff() { CFG.restEnabled = false; if (isResting) { sendStand(); isResting = false; } log('🪑 Auto-Rest: OFF'); },
    setRestHp(pct) { CFG.restHpPercent = pct; log('🪑 นั่งพักตอน HP <', pct + '%'); },
    setRestUntil(pct) { CFG.restUntilPercent = pct; log('🪑 ลุกยืนตอน HP ≥', pct + '%'); },
    setRestMaxSec(sec) { CFG.restMaxSec = sec; log('🪑 นั่งนานสุด', sec + 's'); },
    isResting() { return isResting; },

    // ---------- Auto-Sell ----------
    sellOn()  { CFG.sellEnabled = true;  log('💰 Auto-Sell: ON'); },
    sellOff() { CFG.sellEnabled = false; log('💰 Auto-Sell: OFF'); },
    setSellNpc(name, map) { CFG.sellNpcName = name; if (map) CFG.sellNpcMap = map; log('💰 NPC:', name, '@', CFG.sellNpcMap); },
    setSellNpcPos(x, y) { CFG.sellNpcX = Math.round(Number(x)); CFG.sellNpcY = Math.round(Number(y)); log('💰 พิกัดวาร์ป NPC:', CFG.sellNpcX, CFG.sellNpcY); },
    useCurrentPosAsSellWarp() { if (player.x != null && player.y != null) { CFG.sellNpcX = Math.round(player.x); CFG.sellNpcY = Math.round(player.y); log('💰 ใช้พิกัดปัจจุบันเป็นจุดวาร์ป:', CFG.sellNpcMap, '@(', CFG.sellNpcX, CFG.sellNpcY + ')'); } else { log('⚠️ ยังไม่รู้พิกัดตัวละคร'); } },
    setSellInterval(min) { CFG.sellIntervalMin = min; log('💰 ขายทุก', min, 'นาที (0=off)'); },
    toggleSellOnFull(on) { CFG.sellOnFull = !!on; log('💰 ขายตอนเต็ม =', CFG.sellOnFull); },
    setSellItems(...ids) { CFG.sellItemIds = ids; log('💰 ขาย item:', ids.map(nameOf).join(', ')); },
    addSellItem(id) { if (!CFG.sellItemIds.includes(id)) CFG.sellItemIds.push(id); log('💰 เพิ่มขาย:', nameOf(id)); },
    removeSellItem(id) { CFG.sellItemIds = CFG.sellItemIds.filter(x => x !== id); log('💰 เลิกขาย:', nameOf(id)); },
    sellNow() { if (sellState === 'IDLE' && currentMap && player.x != null) { sellReturnTo = { map: currentMap, x: Math.round(player.x), y: Math.round(player.y) }; if (sendTeleport(CFG.sellNpcMap, CFG.sellNpcX, CFG.sellNpcY, 'sell-manual')) { setSellState('WARP_TO_NPC'); log('💰 ขายทันที! → วาร์ป', CFG.sellNpcMap, '@(', CFG.sellNpcX, CFG.sellNpcY + ')'); } } else { log('⚠️ ไม่สามารถขายได้ตอนนี้ (state:', sellState + ')'); } },
    getInventory() { return [...inventory.entries()].map(([id, c]) => ({ id, name: itemDisplayName(id), count: c, action: getItemAction(Number(id)) })).sort((a, b) => b.count - a.count); },

    // ---------- Auto-Storage (ฝากเข้า Kafra) ----------
    storageOn()  { CFG.storageEnabled = true; saveConfigDebounced(); log('🏦 Auto-Storage: ON'); },
    storageOff() { CFG.storageEnabled = false; saveConfigDebounced(); log('🏦 Auto-Storage: OFF'); },
    setKafra(name, map) { CFG.kafraName = name; if (map) CFG.kafraMap = map; saveConfigDebounced(); log('🏦 Kafra:', name, '@', CFG.kafraMap); },
    setKafraPos(x, y) { CFG.kafraMapX = Math.round(Number(x)); CFG.kafraMapY = Math.round(Number(y)); saveConfigDebounced(); log('🏦 พิกัดวาร์ป Kafra:', CFG.kafraMapX, CFG.kafraMapY); },
    useCurrentPosAsKafra() { if (player.x != null && player.y != null) { CFG.kafraMapX = Math.round(player.x); CFG.kafraMapY = Math.round(player.y); if (currentMap) CFG.kafraMap = currentMap; saveConfigDebounced(); log('🏦 ใช้พิกัดปัจจุบันเป็นจุดวาร์ป Kafra:', CFG.kafraMap, '@(', CFG.kafraMapX, CFG.kafraMapY + ')'); } else { log('⚠️ ยังไม่รู้พิกัดตัวละคร'); } },
    toggleDepositOnFull(on) { CFG.depositOnFull = !!on; saveConfigDebounced(); log('🏦 Trigger ฝากเมื่อเต็ม/ถึงน้ำหนัก =', CFG.depositOnFull); },
    setDepositWeightPercent(pct) {
      CFG.depositWeightPercent = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      saveConfigDebounced();
      log('🏦 เริ่มฝากเมื่อน้ำหนัก ≥', CFG.depositWeightPercent ? CFG.depositWeightPercent + '%' : 'ปิด');
    },
    getWeight() {
      const percent = inventoryWeightPercent();
      return {
        currentRaw: currentWeightRaw,
        maxRaw: maxWeightRaw,
        current: currentWeightRaw == null ? null : currentWeightRaw / 10,
        max: maxWeightRaw == null ? null : maxWeightRaw / 10,
        percent: percent == null ? null : Number(percent.toFixed(2)),
        source: lastWeightSource || null,
      };
    },
    toggleDepositAfterSell(on) { CFG.depositAfterSell = !!on; saveConfigDebounced(); log('🏦 ฝากหลังขาย =', CFG.depositAfterSell); },
    setStorageDepositMode(mode) {
      CFG.storageDepositMode = mode === 'selected' ? 'selected' : 'all';
      saveConfigDebounced();
      log('🏦 Storage mode:', CFG.storageDepositMode === 'all' ? 'ฝากทุกอย่าง (กันของสวม/Weapon Set/Reserve)' : 'ฝากเฉพาะรายการ');
    },
    setDepositItems(...ids) { CFG.depositItemIds = ids; CFG.storageDepositMode = 'selected'; saveConfigDebounced(); log('🏦 ฝากเฉพาะ item:', ids.map(nameOf).join(', ')); },
    addDepositItem(id) { if (!CFG.depositItemIds.includes(id)) CFG.depositItemIds.push(id); CFG.storageDepositMode = 'selected'; saveConfigDebounced(); log('🏦 เพิ่มฝาก:', nameOf(id)); },
    removeDepositItem(id) { CFG.depositItemIds = CFG.depositItemIds.filter(x => x !== id); saveConfigDebounced(); log('🏦 เลิกฝาก:', nameOf(id)); },
    setStorageReserveItems(items) {
      CFG.storageReserveItems = normalizeStorageReserveItems(items);
      saveConfigDebounced();
      log('🏦 ไอเท็มสำรองหลังฝาก:', CFG.storageReserveItems.length ? CFG.storageReserveItems.map(i => nameOf(i.itemId) + ' ×' + i.amount).join(', ') : 'ไม่มี');
    },
    getStorageReserveItems() { return getStorageReserveItems().map(i => ({ ...i, name: nameOf(i.itemId), inStorage: storageRegularItems.get(i.itemId) || 0 })); },
    storageStatus() {
      const auto = storageAutoBlockers();
      const weight = inventoryWeightPercent();
      return {
        state: storageState,
        enabled: CFG.storageEnabled,
        triggerEnabled: CFG.depositOnFull,
        trigger: auto.trigger ? { ...auto.trigger } : null,
        blockers: auto.blockers,
        weight: { percent: weight == null ? null : Number(weight.toFixed(2)), current: currentWeightRaw == null ? null : currentWeightRaw / 10, max: maxWeightRaw == null ? null : maxWeightRaw / 10, source: lastWeightSource || null },
        depositMode: storageDepositMode(),
        depositItemsConfigured: CFG.depositItemIds.length,
        depositItemsInInventory: storageDepositItemIds().filter(id => (inventory.get(id) || 0) > 0),
        retryRemainingMs: Math.max(0, storageRetryAt - nowMs()),
      };
    },
    depositNow() {
      if (storageState !== 'IDLE') { log('⚠️ กำลังฝากอยู่แล้ว (state:', storageState + ')'); return; }
      if (storageDepositMode() === 'selected' && !CFG.depositItemIds.length && !getStorageReserveItems().length) { log('⚠️ ยังไม่ได้เลือกของฝากหรือไอเท็มสำรอง'); return; }
      if (!currentMap || player.x == null) { log('⚠️ ยังไม่รู้พิกัดตัวละคร'); return; }
      const hasDeposit = hasDepositableInventory();
      if (!hasDeposit && !getStorageReserveItems().length) { log('⚠️ ไม่มีของที่จะฝากใน inventory'); return; }
      startStorage('กดฝากเดี๋ยวนี้', null);
    },

    // ---------- Ore Refine + Sell (Great Nature → Green Live) ----------
    oreRefineNow() { return startOreRefine(); },
    oreRefineStop() { if (isOreRefineActive()) oreRefineAbort('ผู้ใช้สั่งหยุด'); },
    oreRefineStatus() {
      const sourceId = Math.round(Number(CFG.oreRefineSourceItemId) || 0);
      const resultId = Math.round(Number(CFG.oreRefineResultItemId) || 0);
      return {
        state: oreRefineState,
        map: CFG.oreRefineMap,
        hub: { x: CFG.oreRefineHubX, y: CFG.oreRefineHubY },
        kafra: { name: CFG.oreRefineKafraName, x: CFG.oreRefineKafraX, y: CFG.oreRefineKafraY },
        refiner: { name: CFG.oreRefineNpcName, x: CFG.oreRefineNpcX, y: CFG.oreRefineNpcY },
        batch: oreRefineBatch,
        source: { id: sourceId, name: nameOf(sourceId), inStorage: storageRegularItems.get(sourceId) || 0 },
        result: { id: resultId, name: nameOf(resultId), inInventory: inventory.get(resultId) || 0 },
      };
    },
    setOreRefineConfig(values = {}) {
      const allowed = new Set(['oreRefineMap', 'oreRefineHubX', 'oreRefineHubY', 'oreRefineKafraName', 'oreRefineKafraX', 'oreRefineKafraY', 'oreRefineKafraChoice', 'oreRefineKafraNextCount', 'oreRefineNpcName', 'oreRefineNpcX', 'oreRefineNpcY', 'oreRefineTradeChoice', 'oreRefineTradeEntry', 'oreRefineSellChoice', 'oreRefineBatchSize', 'oreRefineSourceItemId', 'oreRefineResultItemId']);
      for (const [key, value] of Object.entries(values || {})) if (allowed.has(key)) CFG[key] = value;
      CFG.oreRefineBatchSize = oreRefineBatchLimit();
      saveConfigDebounced();
      log('⛏️ บันทึกค่า Ore Refine:', CFG.oreRefineMap, 'Kafra@(' + CFG.oreRefineKafraX + ',' + CFG.oreRefineKafraY + ')', 'NPC@(' + CFG.oreRefineNpcX + ',' + CFG.oreRefineNpcY + ')');
    },

    // ---------- Farm Map ----------
    //  setFarmMap(name, x, y): ตั้งแมปฟาร์ม + พิกัด (x/y optional, default -999=random)
    //  useCurrentPosAsFarm(): ดึงพิกัดตัวละครปัจจุบันเป็นจุดวาร์ปของแมปฟาร์ม
    //  warpToFarm(): วาร์ปไปแมปฟาร์มทันที (manual — เผื่อผู้เล่นควบคุมเองแล้วอยากกลับ)
    //  toggleWarpBack(on): เปิด/ปิด auto warp-back เมื่อออกจากแมปฟาร์ม
    setFarmMap(name, x, y) {
      CFG.farmMap = String(name || '');
      CFG.farmMapX = (x != null) ? Math.round(Number(x)) : -999;
      CFG.farmMapY = (y != null) ? Math.round(Number(y)) : -999;
      log('🗺️ แมปฟาร์ม:', CFG.farmMap || '(ยกเลิก)', '@(', CFG.farmMapX, CFG.farmMapY + ')');
    },
    useCurrentPosAsFarm() {
      if (player.x != null && player.y != null) {
        CFG.farmMapX = Math.round(player.x); CFG.farmMapY = Math.round(player.y);
        if (currentMap) CFG.farmMap = currentMap;
        log('🗺️ ใช้พิกัดปัจจุบันเป็นแมปฟาร์ม:', CFG.farmMap, '@(', CFG.farmMapX, CFG.farmMapY + ')');
      } else { log('⚠️ ยังไม่รู้พิกัดตัวละคร'); }
    },
    warpToFarm() {
      if (!CFG.farmMap) { log('⚠️ ยังไม่ได้ตั้งแมปฟาร์ม (ASSIST.setFarmMap หรือกด "ใช้พิกัดตัวละคร")'); return; }
      if (!activeWS || activeWS.readyState !== 1) { log('⚠️ ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์'); return; }
      sendTeleport(CFG.farmMap, CFG.farmMapX, CFG.farmMapY, 'farm-manual');
      log('🌀 วาร์ปไปแมปฟาร์ม:', CFG.farmMap, '@(', CFG.farmMapX, CFG.farmMapY + ')');
    },
    toggleWarpBack(on) { CFG.warpBackToFarm = !!on; log('🗺️ วาร์ปกลับแมปฟาร์มอัตโนมัติ =', CFG.warpBackToFarm); },
    lootQueueStatus() { return lootQueue.status(); },
    teleportStatus() { return teleportCoordinator.status(); },
    lootQueueNext() { return lootQueue.skipCurrent(); },
    setLootQueueConfig(values = {}) {
      const role = ['off', 'farm', 'collector'].includes(values.role) ? values.role : CFG.lootQueueRole;
      CFG.lootQueueRole = role;
      if ('sendAll' in values) CFG.lootQueueSendAll = !!values.sendAll;
      const transport = ['local', 'cloudflare'].includes(values.transport) ? values.transport : lootQueueTransportMode();
      CFG.lootQueueTransport = transport;
      if ('localUrl' in values && values.localUrl) CFG.lootQueueLocalUrl = String(values.localUrl).trim();
      if ('cloudflareUrl' in values && values.cloudflareUrl) CFG.lootQueueCloudflareUrl = String(values.cloudflareUrl).trim();
      // รองรับ ASSIST.setLootQueueConfig({url}) ของรุ่นก่อน โดยบันทึกไปยัง mode ที่เลือกอยู่.
      if ('url' in values && values.url) {
        if (transport === 'cloudflare') CFG.lootQueueCloudflareUrl = String(values.url).trim();
        else CFG.lootQueueLocalUrl = String(values.url).trim();
      }
      const activeQueueUrl = lootQueueEndpoint();
      if (activeQueueUrl) CFG.lootQueueUrl = activeQueueUrl;
      if ('group' in values) CFG.lootQueueGroup = String(values.group || 'default');
      if ('homeMap' in values) CFG.lootQueueHomeMap = String(values.homeMap || '');
      if ('homeX' in values && Number.isFinite(values.homeX)) CFG.lootQueueHomeX = Math.round(values.homeX);
      if ('homeY' in values && Number.isFinite(values.homeY)) CFG.lootQueueHomeY = Math.round(values.homeY);
      if ('claimDelayMs' in values && Number.isFinite(values.claimDelayMs)) CFG.lootQueueClaimDelayMs = Math.max(0, Math.min(30000, Math.round(values.claimDelayMs)));
      if ('nearbySettleMs' in values && Number.isFinite(values.nearbySettleMs)) CFG.lootQueueNearbySettleMs = Math.max(0, Math.min(10000, Math.round(values.nearbySettleMs)));
      if ('warpCooldownMs' in values && Number.isFinite(values.warpCooldownMs)) CFG.lootQueueWarpCooldownMs = Math.max(0, Math.min(10000, Math.round(values.warpCooldownMs)));
      if ('actionTimeoutMs' in values && Number.isFinite(values.actionTimeoutMs)) CFG.lootQueueActionTimeoutMs = Math.max(1000, Math.min(30000, Math.round(values.actionTimeoutMs)));
      if ('pickupRetryCount' in values && Number.isFinite(values.pickupRetryCount)) CFG.lootQueuePickupRetryCount = Math.max(0, Math.min(5, Math.round(values.pickupRetryCount)));
      saveConfigDebounced();
      lootQueue.reconnect();
      log('📮 Loot Queue:', CFG.lootQueueRole, 'mode=' + lootQueueTransportLabel(), 'group=' + CFG.lootQueueGroup, 'home=' + (CFG.lootQueueHomeMap || '-'));
    },
    useCurrentPosAsLootQueueHome() {
      if (!currentMap || player.x == null || player.y == null) { log('⚠️ Loot Queue: ยังไม่รู้แมปหรือพิกัดปัจจุบัน'); return; }
      CFG.lootQueueHomeMap = currentMap;
      CFG.lootQueueHomeX = Math.round(player.x);
      CFG.lootQueueHomeY = Math.round(player.y);
      saveConfigDebounced();
      log('📮 Loot Queue: จุดรอ =', currentMap, '@(', CFG.lootQueueHomeX, CFG.lootQueueHomeY + ')');
    },
    openMonitor() { openMonitor(); },
    getSellState() { return { state: sellState, full: inventoryFull, returnTo: sellReturnTo }; },

    // ---------- Navigation (บันทึกเส้นทางเดิน + waypoint graph) ----------
    navRecordOn()  { CFG.navRecording = true;  log('🗺️ บันทึกเส้นทาง: ON — เดินเก็บข้อมูลในแมปที่ต้องการ'); },
    navRecordOff() { CFG.navRecording = false; log('🗺️ บันทึกเส้นทาง: OFF'); },
    navSetMergeRadius(r) { CFG.navMergeRadius = Math.max(1, Number(r) || 3); log('🗺️ รัศมีรวมจุด =', CFG.navMergeRadius, 'ช่อง'); },
    navToggleWander(on) { CFG.navWanderUseNav = !!on; log('🗺️ wander ใช้ nav =', CFG.navWanderUseNav); },
    gatStatus() {
      const g = currentMap && gatCache.get(currentMap);
      let walkable = null;
      if (g) { let count = 0; for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === 0) count++; walkable = { cells: count, total: g.cells.length, percent: Number((count / g.cells.length * 100).toFixed(1)) }; }
      const status = { map: currentMap, loaded: !!g, size: g ? { w: g.w, h: g.h } : null, calibration: gatFlipLocked ? (gatFlipY ? 'y-flip' : 'normal') : 'collecting ' + gatCalN + '/20', walkable };
      log('🗺️ GAT:', status.map || '(ยังไม่รู้แมป)', status.loaded ? status.size.w + '×' + status.size.h : 'ยังไม่มีข้อมูล', '· calibration:', status.calibration, walkable ? '· เดินได้ ' + walkable.cells + '/' + walkable.total + ' ช่อง (' + walkable.percent + '%)' : '');
      return status;
    },
    navGetStats(mapName) {
      const data = navLoadMap(mapName || currentMap);
      if (!data) return { maps: 0 };
      return { map: mapName || currentMap, nodes: (data.nodes||[]).length, edges: (data.edges||[]).length, trail: (data.trail||[]).length };
    },
    navGetAllStats() {
      const maps = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(NAV_KEY_PREFIX)) {
          try {
            const d = JSON.parse(localStorage.getItem(key));
            maps[key.slice(NAV_KEY_PREFIX.length)] = { nodes: (d.nodes||[]).length, edges: (d.edges||[]).length, trail: (d.trail||[]).length };
          } catch (e) {}
        }
      }
      return maps;
    },
    navNavigateTo(x, y) { return navNavigateTo(x, y); },   // ทดสอบ path
    navClearMap(mapName) { navClear(mapName); },
    navClearAll() { navClear(); },
    navExport() {
      const data = navExportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ro-nav-data.json'; a.click();
      URL.revokeObjectURL(url);
      log('🗺️ export nav data:', Object.keys(data).length, 'แมป');
    },
    navImport(json) {
      try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        const count = navImportAll(data);
        log('🗺️ import nav data:', count, 'แมป');
        return count;
      } catch (e) { log('⚠️ import nav ล้มเหลว:', e.message); return 0; }
    },

    // ---------- Auto-Loot ----------
    lootOn()  { CFG.lootEnabled = true;  log('📦 Auto-Loot: ON'); },
    lootOff() {
      CFG.lootEnabled = false;
      // Auto-Loot และ Warp-to-Loot ใช้ queue ภายในชุดเดียวกัน: เมื่อผู้ใช้ปิด
      // Loot แล้วต้องตัดงานเก่าทั้งหมด ไม่ให้ retry/warp ต่อหรือขวาง AB Buff.
      const discarded = queue.size + warpQueue.size;
      queue.clear();
      warpQueue.clear();
      recentDrops.clear();
      pickupPending = null;
      lootSettleUntil = 0;
      lastWarpTargetId = null;
      log('📦 Auto-Loot: OFF' + (discarded ? ' · ยกเลิกงานค้าง ' + discarded + ' ชิ้น' : ''));
    },
    setLootMode(mode) {
      if (!['all', 'only', 'except'].includes(mode)) { console.warn('โหมดต้องเป็น all/only/except'); return; }
      CFG.filter.mode = mode; log('📦 loot mode =', mode);
    },
    // ---------- Warp-to-Loot (ฟีเจอร์รุนแรง) ----------
    warpLootOn() {
      CFG.warpLootEnabled = false;
      warpQueue.clear();
      log('🌀 Warp-to-Loot ถูกปิดไว้ตามการตั้งค่านี้');
    },
    warpLootOff() {
      CFG.warpLootEnabled = false;
      warpQueue.clear();
      log('🌀 Warp-to-Loot: OFF');
    },
    warpLootQueue() {
      return [...warpQueue.values()].map(w => ({ item: nameOf(w.itemId), x: w.x, y: w.y, offsetIdx: w.offsetIdx }));
    },
    addLootOnly(...ids) {
      for (const id of ids) if (!CFG.filter.onlyItems.includes(id)) CFG.filter.onlyItems.push(id);
      log('📦 onlyItems =', CFG.filter.onlyItems);
    },
    addLootExcept(...ids) {
      for (const id of ids) if (!CFG.filter.exceptItems.includes(id)) CFG.filter.exceptItems.push(id);
      log('📦 exceptItems =', CFG.filter.exceptItems);
    },
    clearLootOnly()   { CFG.filter.onlyItems = [];   log('📦 ล้าง onlyItems'); },
    clearLootExcept() { CFG.filter.exceptItems = []; log('📦 ล้าง exceptItems'); },
    // ตั้งดีเลย์ก่อนเริ่มเก็บ (ms หลังของตก) — 0 = เก็บทันที
    setLootDelay(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.lootDelayAfterDropMs = ms;
      log('📦 ดีเลย์ก่อนเก็บ =', ms + 'ms' + (ms ? ' (รอหลังของตก)' : ' (เก็บทันที)'));
    },
    setLootPostKillSettle(ms) {
      if (typeof ms !== 'number' || ms < 0) { console.warn('ต้องเป็นเลข ≥ 0'); return; }
      CFG.lootPostKillSettleMs = ms;
      saveConfigDebounced();
      log('📦 รอรับ drop หลังฆ่า =', ms + 'ms' + (ms ? ' (ล็อกการตีเป้าใหม่)' : ' (ปิดช่วงรอ drop)'));
    },

    // ---------- Auto-Combat ----------
    weaponSetOn() { CFG.weaponSetEnabled = true; saveConfigDebounced(); log('⚔️ Weapon Set: ON'); },
    weaponSetOff() { CFG.weaponSetEnabled = false; resetWeaponSwap('ผู้ใช้ปิด'); saveConfigDebounced(); log('⚔️ Weapon Set: OFF'); },
    getWeaponSets() {
      return {
        enabled: CFG.weaponSetEnabled,
        defaultSetId: CFG.weaponDefaultSetId,
        sets: weaponSetList().map(normalizeWeaponSet),
        rules: Array.isArray(CFG.weaponMonsterRules) ? [...CFG.weaponMonsterRules] : [],
        equipped: { rightBagId: equippedBagIds.get(EQUIP_SLOT_RIGHT) || null, leftBagId: equippedBagIds.get(EQUIP_SLOT_LEFT) || null },
        active: weaponActiveSetName,
        switching: weaponSwap ? { set: weaponSwap.setName, pending: weaponSwap.pending } : null,
      };
    },
    getWeaponInventory() { return getWeaponInventoryItems(); },
    weaponInventoryCaptureOn(seconds = 30) { startInventoryCapture(seconds); },
    weaponInventoryCaptureOff() { stopInventoryCapture('ปิดโดยผู้ใช้'); },
    weaponInventoryCaptureStatus() {
      const remainingMs = inventoryCaptureUntil ? Math.max(0, inventoryCaptureUntil - nowMs()) : 0;
      if (!remainingMs && inventoryCaptureUntil) stopInventoryCapture('หมดเวลา');
      return { active: remainingMs > 0, remainingMs, events: inventoryCaptureEvents.map(({ rawHex, ...event }) => event) };
    },
    weaponInventoryCaptureResult() { return getInventoryCaptureResult(); },
    weaponInventoryCaptureDump() { return getInventoryCaptureDump(); },
    storageCaptureOn(seconds = 30) { startStorageCapture(seconds); },
    storageCaptureOff() { stopStorageCapture('ปิดโดยผู้ใช้'); },
    storageCaptureDump() { return getStorageCaptureDump(); },
    // ---------- Great Nature / Ore Refine debug capture ----------
    oreRefineCaptureOn(seconds = 120) { startOreRefineCapture(seconds); },
    oreRefineCaptureOff() { stopOreRefineCapture('ปิดโดยผู้ใช้'); },
    oreRefineCaptureDump() { return getOreRefineCaptureDump(); },
    setWeaponSets(sets, defaultSetId) {
      const list = Array.isArray(sets) ? sets.map(normalizeWeaponSet).filter(s => s && s.id) : [];
      if (!list.some(s => s.id === 'default')) list.unshift({ id: 'default', name: 'Default', rightBagId: null, leftMode: 'keep', leftBagId: null });
      CFG.weaponSets = list;
      CFG.weaponDefaultSetId = list.some(s => s.id === defaultSetId) ? defaultSetId : 'default';
      saveConfigDebounced();
      const root = document.getElementById('__assist_root'); if (root) renderWeaponEditor(root);
      log('⚔️ Weapon Sets =', list.length, 'set');
    },
    setWeaponRules(rules) {
      CFG.weaponMonsterRules = Array.isArray(rules) ? rules.map(r => ({ monster: String(r?.monster || '').trim(), setId: String(r?.setId || '') })).filter(r => r.monster && getWeaponSetById(r.setId)) : [];
      saveConfigDebounced();
      const root = document.getElementById('__assist_root'); if (root) renderWeaponEditor(root);
      log('⚔️ Weapon Rules =', CFG.weaponMonsterRules.length, 'รายการ');
    },
    combatOn() {
      CFG.combatEnabled = true;
      if (!CFG.targetWhitelist.length && !CFG.targetBlacklist.length) console.warn('⚠️ whitelist + blacklist ว่าง = ตีทุกมอน (รวม MVP/มอนแรง) — ควรตั้ง whitelist หรือ blacklist กันตาย');
      log('⚔️ Auto-Combat: ON');
    },
    combatOff() { CFG.combatEnabled = false; target = null; resetWeaponSwap('combat off'); log('⚔️ Auto-Combat: OFF'); },
    setTargetWhitelist(...namesOrIds) {
      CFG.targetWhitelist = namesOrIds;
      log('⚔️ whitelist =', namesOrIds.join(', ') || '(ว่าง = ตีทุกมอน)');
    },
    addTargetWhitelist(...x) { for (const e of x) if (!CFG.targetWhitelist.includes(e)) CFG.targetWhitelist.push(e); log('⚔️ whitelist =', CFG.targetWhitelist.join(', ')); },
    clearTargetWhitelist() { CFG.targetWhitelist = []; log('⚔️ ล้าง whitelist = ตีทุกมอน'); },
    setTargetBlacklist(...namesOrIds) { CFG.targetBlacklist = namesOrIds; log('⚔️ blacklist =', namesOrIds.join(', ')); },
    addTargetBlacklist(...x) { for (const e of x) if (!CFG.targetBlacklist.includes(e)) CFG.targetBlacklist.push(e); log('⚔️ blacklist =', CFG.targetBlacklist.join(', ')); },
    clearTargetBlacklist() { CFG.targetBlacklist = []; log('⚔️ ล้าง blacklist'); },
    setFleeMob(n) { CFG.fleeOnMobCount = n; log('🏃 flee รุม', n, 'ตัว' + (n ? '' : ' (off)')); },
    setFleeAggro(n) { CFG.fleeOnAggroCount = n; log('🏃 flee aggro', n, 'ตัว' + (n ? '' : ' (off)')); },
    setFleeProximity(n, radius) { CFG.fleeOnProximityCount = n; if (radius != null) CFG.fleeOnProximityRadius = radius; log('🏃 flee มอนรอบ', n, 'ตัวในระยะ', CFG.fleeOnProximityRadius); },
    setFleePlayers(n, radius) { CFG.fleeOnPlayerCount = Math.max(0, Number(n) || 0); if (radius != null) CFG.fleeOnPlayerRadius = Math.max(1, Number(radius) || 10); saveConfigDebounced(); log('🏃 flee ผู้เล่น', CFG.fleeOnPlayerCount, 'คนในระยะ', CFG.fleeOnPlayerRadius, 'ช่อง'); },
    setFleePlayerDelay(seconds) {
      const value = Number(seconds);
      if (!Number.isFinite(value)) return false;
      CFG.fleeOnPlayerDelaySec = Math.max(0, Math.min(10, value));
      saveConfigDebounced();
      log('🏃 Flee Player delay =', CFG.fleeOnPlayerDelaySec + 's');
      return true;
    },
    setFleePlayerExceptions(...names) {
      CFG.fleePlayerExceptions = [...new Set(names.map(normalizedPlayerName).filter(Boolean))];
      resetFleePlayerDelay();
      saveConfigDebounced();
      log('🏃 Flee Player exceptions =', CFG.fleePlayerExceptions.length ? CFG.fleePlayerExceptions.join(', ') : '(ไม่มี)');
      return CFG.fleePlayerExceptions;
    },
    toggleFleePlayers(on) { CFG.fleeOnPlayerCount = on ? 1 : 0; if (!on) resetFleePlayerDelay(); saveConfigDebounced(); log('🏃 flee ผู้เล่น', CFG.fleeOnPlayerCount ? 'ON' : 'OFF', '(ระยะ ' + CFG.fleeOnPlayerRadius + ' ช่อง)'); },
    setFleeMvp(on, radius) { CFG.fleeOnMvp = !!on; if (radius != null) CFG.fleeOnMvpRadius = Math.max(1, Number(radius) || 20); saveConfigDebounced(); log('🏃 flee MVP/Boss:', CFG.fleeOnMvp ? 'ON' : 'OFF', '(ระยะ ' + CFG.fleeOnMvpRadius + ' ช่อง)'); },
    setRanged(range) { CFG.rangedAttackRange = range; log('🏹 ranged range =', range, range ? '' : '(ใช้ attackRange)'); },
    setAttackRange(r) { CFG.attackRange = r; log('⚔️ attackRange =', r); },
    setAttackProbe(ms) { CFG.attackProbeMs = Math.max(1000, Number(ms) || 3000); log('⚔️ Attack probe =', CFG.attackProbeMs + 'ms'); },
    setHiddenWaitMonsters(...namesOrIds) {
      CFG.hiddenWaitMonsters = namesOrIds.filter(x => x !== '' && x != null);
      saveConfigDebounced();
      log('🫥 hidden wait monsters =', CFG.hiddenWaitMonsters.join(', ') || '(ปิด)');
    },
    setHiddenWaitSec(sec) {
      CFG.hiddenWaitSec = Math.max(1, Math.min(30, Number(sec) || 4));
      saveConfigDebounced();
      log('🫥 hidden wait timeout =', CFG.hiddenWaitSec + 's');
    },
    setHiddenSightEnabled(on) {
      CFG.hiddenSightEnabled = !!on;
      saveConfigDebounced();
      log('👁️ Sight เมื่อมอนซ่อน:', CFG.hiddenSightEnabled ? 'ON' : 'OFF');
    },
    hiddenSightStatus() {
      const now = nowMs();
      return {
        enabled: !!CFG.hiddenSightEnabled,
        active: hasActiveSight(now),
        remainingMs: Math.max(0, sightEffectUntil - now),
        pending: sightPendingUntil > now,
        monsters: Array.isArray(CFG.hiddenWaitMonsters) ? [...CFG.hiddenWaitMonsters] : [],
        skillId: SIGHT_SKILL_ID,
        radius: SIGHT_RADIUS,
      };
    },
    setPostCombatDelay(ms) { CFG.postCombatDelayMs = ms; log('⚔️ รอ', ms + 'ms หลังสู้เสร็จ/เก็บของเสร็จ'); },
    // toggle helpers สำหรับ UI
    toggleAntiKS(on) { CFG.antiKS = !!on; log('⚔️ antiKS =', CFG.antiKS); },
    toggleAvoidPlayers(on) { CFG.avoidOtherPlayers = !!on; log('⚔️ avoidOtherPlayers =', CFG.avoidOtherPlayers); },
    toggleLowestHpFirst(on) { CFG.targetLowestHpFirst = !!on; log('⚔️ targetLowestHpFirst =', CFG.targetLowestHpFirst); },
    toggleWander(on) { CFG.wanderEnabled = !!on; log('⚔️ wander =', CFG.wanderEnabled); },
    toggleWarpFind(on) { CFG.warpFindEnabled = !!on; saveConfigDebounced(); log('⚔️ warpFind =', CFG.warpFindEnabled); },
    setNoMonsterWarpSec(sec) { CFG.noMonsterWarpSec = Math.max(1, Number(sec) || 5); saveConfigDebounced(); log('🌀 noMonsterWarpSec =', CFG.noMonsterWarpSec + 's'); },
    toggleWarpToMonster(on) { CFG.warpToMonster = !!on; saveConfigDebounced(); log('⚔️ warpToMonster =', CFG.warpToMonster); },
    // debug
    weaponCaptureOn(seconds = 15) {
      const sec = Math.max(3, Math.min(60, Number(seconds) || 15));
      weaponCaptureEvents.length = 0;
      weaponCaptureCandidate = null;
      weaponCaptureStartedAt = nowMs();
      weaponCaptureUntil = weaponCaptureStartedAt + sec * 1000;
      console.log('[ASSIST][WPNCAP] START — สวม/ถอดอาวุธด้วยมือ 1 ครั้ง ภายใน ' + sec + 's');
      setTimeout(() => {
        if (weaponCaptureUntil && nowMs() >= weaponCaptureUntil) stopWeaponCapture('หมดเวลา');
      }, sec * 1000 + 50);
    },
    weaponCaptureOff() { stopWeaponCapture('ปิดโดยผู้ใช้'); },
    statCaptureOn(seconds = 15) { startStatCapture(seconds); },
    statCaptureOff() { stopStatCapture('ปิดโดยผู้ใช้'); },
    statCaptureStatus() { return { active: statCaptureUntil > nowMs(), remainingMs: Math.max(0, statCaptureUntil - nowMs()), events: statCaptureEvents.map(({ rawHex, ...event }) => event) }; },
    statCaptureDump() { return getStatCaptureDump(); },
    weaponCaptureStatus() {
      return {
        active: !!weaponCaptureUntil,
        remainingMs: weaponCaptureUntil ? Math.max(0, weaponCaptureUntil - nowMs()) : 0,
        candidate: weaponCaptureCandidate,
        events: weaponCaptureEvents.slice(),
      };
    },
    getEntities() {
      const now = nowMs();
      return [...entities.values()].filter(e => e.kind === 1 && e.alive).slice(0, 30).map(e => ({
        id: e.id.toString(16), name: e.name || '?', sub: e.sub, x: e.x, y: e.y,
        hp: e.hp != null && e.hpMax ? (e.hp + '/' + e.hpMax + ' ' + monsterHpPct(e).toFixed(0) + '%') : '?',
        engaged: e._lastEngagedByOtherAt && (now - e._lastEngagedByOtherAt) < 5000,
      }));
    },
    getTarget() { return target ? { id: target.id.toString(16), following: !!target.followObservedAt, engageSec: target.engageAt ? ((nowMs()-target.engageAt)/1000).toFixed(0) : 0 } : null; },
    getAggro() { return { mobAttackers: getMobAttackerCount(CFG.fleeOnProximityRadius), aggro: getAggroCount(CFG.fleeOnProximityRadius), threat: getThreatCount(CFG.fleeOnProximityRadius), monstersNearby: countMonsters(CFG.fleeOnProximityRadius) }; },
    // ★ debug: ดู entities ทั้งหมดเพื่อหาสาเหตุ acquire ไม่ติด
    debugEntities() {
      const now = nowMs();
      let spawnCount = 0, ghostCount = 0, monsterCount = 0, targetableCount = 0;
      const sample = [];
      for (const e of entities.values()) {
        if (e.sub != null) spawnCount++; else ghostCount++;
        if (e.kind === 1 && e.alive) {
          monsterCount++;
          if (sample.length < 8) sample.push({ id: e.id.toString(16), name: e.name, sub: e.sub, x: e.x, y: e.y, hp: e.hp, hpMax: e.hpMax, targetable: isTargetable(e, now) });
          if (isTargetable(e, now)) targetableCount++;
        }
      }
      console.log('entities total:', entities.size, '| fromSPAWN:', spawnCount, '| ghost:', ghostCount, '| monsters:', monsterCount, '| targetable:', targetableCount);
      // ★ debug playerId vs entity: ดูว่า player entity มีพิกัดตรงกับ player.x/y ไหม
      const playerEntity = playerId ? entities.get(playerId) : null;
      console.log('playerId:', playerId ? playerId.toString(16) : 'NULL', '| player.x/y:', player.x, player.y,
        '| playerEntity:', playerEntity ? `{x:${playerEntity.x}, y:${playerEntity.y}, kind:${playerEntity.kind}, name:${playerEntity.name}}` : 'NOT IN ENTITIES');
      // ★ debug target ปัจจุบัน (แม้อยู่นอก 8 ตัวแรก)
      if (target) {
        const tm = entities.get(target.id);
        console.log('TARGET:', target.id.toString(16), '| following:', !!target.followObservedAt, '| lastAttack:', target.lastAttackAt ? ((now-target.lastAttackAt)/1000).toFixed(1)+'s ago' : 'none', '| lastSignal:', target.lastAttackSignalAt ? ((now-target.lastAttackSignalAt)/1000).toFixed(1)+'s ago' : 'none',
          '| inEntities:', !!tm, tm ? `{name:${tm.name}, hp:${tm.hp}/${tm.hpMax}, _lastDamageAt:${tm._lastDamageAt ? ((now-tm._lastDamageAt)/1000).toFixed(1)+'s ago' : 'NEVER'}}` : '');
      }
      console.table(sample);
      return { total: entities.size, spawnCount, ghostCount, monsterCount, targetableCount, sample, player: { ...player }, playerId: playerId ? playerId.toString(16) : null };
    },

    // ---------- ทั่วไป ----------
    name(id, label) { CFG.itemNames[id] = label; log('🏷️', id, '=', label); },
    config() { return CFG; },
    // ---------- สถิติ + log (สำหรับ panel) ----------
    getStats() {
      const elapsed = Math.max(1, Date.now() - stats.startTime);
      const elapsedMin = elapsed / 60000;
      const now = Date.now();
      // ★ rolling window cleanup + calc (mirror world.js:1699-1721, bot.js:4439-4443)
      const dpsWindow = stats.dealtWindow.filter(d => d.t >= now - 10000);
      const atkWindow = stats.attackWindow.filter(a => a.t >= now - 10000);
      const goldWin = stats.goldWindow.filter(g => g.t >= now - 300000);
      // trim old entries (กัน array โตไม่หยุด)
      if (stats.dealtWindow.length > 500) stats.dealtWindow = dpsWindow;
      if (stats.attackWindow.length > 500) stats.attackWindow = atkWindow;
      if (stats.goldWindow.length > 500) stats.goldWindow = goldWin;
      return {
        ...stats,
        itemsByCount: [...stats.itemsByCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => ({ id, name: nameOf(id), count: n })),
        elapsedMs: elapsed,
        expPerMin: elapsedMin > 0 ? Math.round(stats.expGained / elapsedMin) : 0,
        killsPerMin: elapsedMin > 0 ? +(stats.kills / elapsedMin).toFixed(1) : 0,
        dps: dpsWindow.length > 0 ? Math.round(dpsWindow.reduce((s, d) => s + d.damage, 0) / 10) : 0,
        aspd: atkWindow.length > 0 ? +((atkWindow.length / 10)).toFixed(1) : 0,
        goldRatePerHour: goldWin.length > 0 ? Math.round(goldWin.reduce((s, g) => s + g.gold, 0) / 5 * 60) : 0,
      };
    },
    resetStats() { resetStats(); log('📊 รีเซ็ตสถิติแล้ว'); },
    getLogs() { return activityJournal.read('activity'); },
    clearLogs() { activityJournal.clear('activity'); log('🧹 ล้าง log'); },
    getDebugLogs() { return activityJournal.read('debug'); },
    clearDebugLogs() { activityJournal.clear('debug'); },
    getImportantLogs() { return activityJournal.read('important'); },
    clearImportantLogs() { activityJournal.clear('important'); log('🧹 ล้าง log สำคัญ'); },
    stopAll() {
      clearInterval(healLoop); clearInterval(lootLoop); clearInterval(warpLoop); clearInterval(combatLoop); clearInterval(sellLoop); clearInterval(storageLoop); clearInterval(oreRefineLoop); clearInterval(buffLoop); clearInterval(abBuffLoop); clearInterval(consoleClearLoop);
      if (typeof uiLoop !== 'undefined') clearInterval(uiLoop);
      log('⏹ หยุดระบบทั้งหมดแล้ว');
    },
    version() { return { current: VERSION }; },
    saveConfig() { saveConfig(); log('💾 บันทึกการตั้งค่าลงเครื่องแล้ว'); },

    // ---------- Local loot-queue POC ----------
    // ทดสอบจากหน้าเกมจริงว่า Tampermonkey เปิด WebSocket ไป process ในเครื่องได้หรือไม่
    testLocalWs(url = 'ws://127.0.0.1:8787') {
      return new Promise((resolve) => {
        const timeoutMs = 5000;
        let socket;
        let finished = false;
        const finish = (result) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          try { socket?.close(); } catch (_) {}
          resolve(result);
        };
        const timeout = setTimeout(() => {
          log('🧪 Local queue POC: หมดเวลารอเชื่อม', url, `(${timeoutMs / 1000}s)`);
          finish({ ok: false, reason: 'timeout', url });
        }, timeoutMs);
        try {
          socket = new WebSocket(url);
          socket.onopen = () => log('🧪 Local queue POC: เชื่อมได้', url);
          socket.onmessage = (event) => {
            log('✅ Local queue POC: ได้รับคำตอบ', String(event.data));
            finish({ ok: true, url, response: String(event.data) });
          };
          socket.onerror = () => {
            log('❌ Local queue POC: browser หรือหน้าเกมบล็อกการเชื่อมต่อ', url);
            finish({ ok: false, reason: 'connection-blocked', url });
          };
        } catch (error) {
          log('❌ Local queue POC: สร้าง WebSocket ไม่ได้', error.message);
          finish({ ok: false, reason: error.message, url });
        }
      });
    },

    // ---------- Full export/import (ย้ายเครื่อง) ----------
    //  รวม: config + skill times + nav data (buff countdown เป็น session-only)
    exportAll() {
      const data = { _version: VERSION, _exportedAt: new Date().toISOString() };
      data.config = cloneConfigValue(persistedConfig());
      data.profiles = normalizeProfilesPayload(loadProfilesStore());
      data.activeProfile = activeProfileName();
      const skill = {};
      for (const [id, ts] of lastSkillUse) skill[id] = ts;
      data.skillTimes = skill;
      data.nav = navExportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ro-assist-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
      URL.revokeObjectURL(url);
      const summary = backupQueueSummary(data);
      log('📤 export ข้อมูลทั้งหมด: config ' + summary.configKeys + ' ค่า · Profile ' + summary.profileCount + ' ชุด · Loot Queue special ' + summary.configQueueItems + ' ชิ้น');
      return summary;
    },
    importAll(json) {
      try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (!data || typeof data !== 'object') throw new Error('รูปแบบผิด');
        let count = 0;
        const importedProfiles = normalizeProfilesPayload(data.profiles);
        let migratedNoMonsterProfiles = 0;
        for (const profile of Object.values(importedProfiles)) {
          if (migrateNoMonsterWarpDefault(data, profile)) migratedNoMonsterProfiles++;
        }
        const requestedActive = normalizeProfileName(data.activeProfile);
        // Import ต้องใช้ config สดเป็นหลัก แต่เติม key ที่ backup รุ่นเก่าหายจาก active profile.
        // จึงย้าย special-item list และค่า profile ได้แม้ config ในไฟล์มีไม่ครบ.
        const importConfig = buildImportConfig(data, importedProfiles, requestedActive);
        if (Object.keys(importConfig).length) {
          count += applyPersistedConfig(importConfig);
          const importedFpsCap = setConfiguredFpsCap(CFG.renderFpsCap);
          CFG.renderFpsCap = importedFpsCap == null ? 0 : importedFpsCap;
          if (!saveConfig()) throw new Error('บันทึก config ลง browser ไม่สำเร็จ');
        }
        if (Object.keys(importedProfiles).length) {
          // merge เพื่อไม่ลบ profile ที่มีเฉพาะในเครื่องปลายทาง; ชื่อซ้ำใช้ค่าจาก backup.
          const profiles = loadProfilesStore();
          Object.assign(profiles, importedProfiles);
          if (!saveProfilesStore(profiles)) throw new Error('บันทึก Profile ลง browser ไม่สำเร็จ');
          if (requestedActive && (requestedActive === 'default' || Object.prototype.hasOwnProperty.call(profiles, requestedActive))) setActiveProfileName(requestedActive);
          notifyProfilesChanged();
          count += Object.keys(importedProfiles).length;
        }
        // buffTimes จาก backup รุ่นเก่าถูกละเว้น: countdown เป็น session-only
        if (data.skillTimes) {
          lastSkillUse.clear();
          for (const [id, ts] of Object.entries(data.skillTimes)) lastSkillUse.set(Number(id), Number(ts) || 0);
          saveSkillTimes();
        }
        if (data.nav) { count += navImportAll(data.nav); }
        lootQueue.reconnect();
        const summary = backupQueueSummary({ ...data, config: importConfig, profiles: importedProfiles, activeProfile: requestedActive || activeProfileName() });
        log('📥 import สำเร็จ: ' + count + ' รายการ · Loot Queue special ' + summary.configQueueItems + ' ชิ้น · Profile ' + summary.profileCount + ' ชุด' + (requestedActive ? ' · ใช้ ' + requestedActive : '') + (migratedNoMonsterProfiles ? ' · no-monster default 5s→2s ' + migratedNoMonsterProfiles + ' Profile' : ''));
        return summary;
      } catch (e) { log('⚠️ import ล้มเหลว:', e.message); }
    },
    backupStatus() { return backupQueueSummary({ config: persistedConfig(), profiles: loadProfilesStore(), activeProfile: activeProfileName() }); },
  };

  // ============================================================
  //  UI — mini-bar + popup panel (ฝังในหน้าเกม)
  // ============================================================
  let uiLoop;          // render interval (clear ใน stopAll)
  // ★ editing input tracking (module-level — ใช้ได้ทั้ง buildUI + renderUI)
  //   Unity แย่ง focus ทุกเฟรม → document.activeElement ไม่เชื่อถือได้
  //   track ด้วย focusin/focusout แทน
  const editingInputs = new WeakSet();
  const isEditing = (el) => el && editingInputs.has(el);
  // ============================================================
  //  ITEM-LIST POPUP — จัดการรายการ item (only/except) แบบ visual
  //    listType: 'only' | 'except' (สำหรับ loot filter)
  // ============================================================
  // ★ source ของรายการที่จะแสดงในช่องค้นหา:
  //   (1) ของที่ได้ใน session นี้ก่อน → เลือกเพิ่มเข้าตัวกรองได้สะดวก
  //   (2) ของใน inventory ที่เหลือ → รองรับตั้งค่าจากของติดตัว
  //   (3) item DB ทั้งหมด
  function itemDBEntries() {
    const entries = [];
    const seen = new Set();
    // ★ sessionLootItems ต้องมาก่อน inventory: inventory มี full snapshot ตั้งแต่เข้าเกม
    //   และไม่ใช่ความหมายเดียวกับ "ของที่เพิ่งเก็บได้" อีกแล้ว
    for (const [id, count] of sessionLootItems.entries()) {
      const numId = Number(id);
      if (count > 0 && numId > 0) {
        entries.push({ id: numId, name: itemDisplayName(numId), count, src: 'session' });
        seen.add(numId);
      }
    }
    // ★ inventory ปัจจุบันที่ไม่ได้มาจาก session
    for (const [id, count] of inventory.entries()) {
      const numId = Number(id);
      if (count > 0 && !seen.has(numId)) {
        entries.push({ id: numId, name: itemDisplayName(numId), count, src: 'inv' });
        seen.add(numId);
      }
    }
    // ★ itemDB ทั้งหมด (ถ้าโหลดแล้ว)
    if (itemDB.loaded) {
      for (const id of Object.keys(itemDB.names)) {
        const numId = Number(id);
        if (!seen.has(numId)) entries.push({ id: numId, name: itemDB.names[id], src: 'db' });
      }
    }
    return entries;
  }
  // ============================================================
  //  SKILL PRESETS — ฐานข้อมูลสกิลสำเร็จรูป (เลือกใช้ได้เลย)
  //    แต่ละสกิลมีค่า default ที่ทดสอบแล้ว — ผู้ใช้ปรับแต่งเพิ่มเติมได้หลังเพิ่ม
  //    skillId จาก packet capture: targeted=1 byte, AoE/self=2 bytes LE
  // ============================================================
  // ★ SKILL_PRESETS — เฉพาะสกิลที่ทดลองแล้ว (verify จาก packet capture)
  //    ถ้ายังไม่ได้ทดลอง = ไม่ใส่ (กันค่าผิด)
  const SKILL_PRESETS = [
    // ---- Swordsman/Knight (จากบอทหลัก config + packet capture) ----
    { name: 'Bash', skillId: 3, level: 10, targeted: true, maxUsesPerTarget: 1, maxDistance: 2, spMin: 15, cooldownMs: 72, job: 'Swordsman/Knight', desc: 'ตีแรง + สตัน' },
    { name: 'Magnum Break', skillId: 6, level: 10, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 30, cooldownMs: 90, job: 'Knight', desc: 'AoE รอบตัว' },
    { name: 'Provoke', skillId: 7, level: 10, targeted: true, maxUsesPerTarget: 1, maxDistance: 10, spMin: 5, cooldownMs: 3, job: 'Swordsman', desc: 'ลด def มอน' },
    { name: 'Endure', skillId: 4, level: 10, selfCast: true, intervalMin: 3, spMin: 10, cooldownMs: 1, job: 'Swordsman', desc: 'บัพ ไม่กระตุก' },
    { name: 'Twohand Quicken', skillId: 30, level: 10, selfCast: true, intervalMin: 3, spMin: 50, cooldownMs: 1, job: 'Knight', desc: 'บัพ ASPD ดาบสองมือ' },
    { name: 'Bowling Bash', skillId: 32, level: 10, targeted: true, mobCountMin: 2, maxUsesPerTarget: 1, maxDistance: 2, spMin: 22, cooldownMs: 84, job: 'Knight Lord', desc: 'ตีกระแทก' },
    { name: 'Charge Attack', skillId: 40, level: 1, targeted: true, maxUsesPerTarget: 1, maxDistance: 10, minDistance: 5, spMin: 30, cooldownMs: 114, job: 'Knight', desc: 'พุ่งเข้าหามอน' },
    // ---- Archer/Hunter (ทดลองครบ) ----
    { name: 'Double Strafe', skillId: 24, level: 10, targeted: true, maxUsesPerTarget: 2, maxDistance: 15, spMin: 20, cooldownMs: 60000, job: 'Archer/Hunter', desc: 'ยิง 2 ลูก' },
    { name: 'Improve Concentration', skillId: 27, level: 10, selfCast: true, intervalMin: 4.3, spMin: 70, cooldownMs: 1, job: 'Archer/Hunter', desc: 'บัพ DEX+AGI' },
    { name: 'Charge Arrow', skillId: 25, level: 1, targeted: true, maxUsesPerTarget: 1, maxDistance: 10, spMin: 20, cooldownMs: 60000, job: 'Archer/Hunter', desc: 'ดันมอนออกไกล' },
    { name: 'Arrow Shower', skillId: 26, level: 5, ground: true, maxUsesPerTarget: 1, maxDistance: 10, mobCountMin: 2, spMin: 20, cooldownMs: 60000, job: 'Hunter', desc: 'AoE ธนู (เลือกพื้นที่)' },
    // ---- Thief/Assassin/Rogue (จาก packet capture) ----
    { name: 'Steal', skillId: 61, level: 10, targeted: true, maxUsesPerTarget: 3, maxDistance: 2, spMin: 10, cooldownMs: 800, job: 'Thief', desc: 'ขโมยไอเทมจากมอนสเตอร์; cooldown คือเวลารอผล/retry' },
    { name: 'Sonic Blow', skillId: 126, level: 10, targeted: true, maxUsesPerTarget: 1, maxDistance: 2, spMin: 40, cooldownMs: 120000, job: 'Assassin/SinX', desc: 'ฟัน 8 ครั้งรวด (ดาเมจหนัก)' },
    // ============================================================
    // ★★ สกิลทั้งหมดจาก Skills.toml ของ RagnarokRebuildTcp (server ตัวจริงของเกมนี้)
    //   ID = ลำดับในไฟล์ (None=0) — ยืนยันแน่นอน: preset 13 ตัวที่ capture จริงตรง 100%
    //   ข้อมูล: ชื่อ/เป้าหมาย/MaxLevel/SP ต่อเลเวล/ปรับเลเวลได้ มาจาก server โดยตรง
    //   ⚠️ สกิลที่ไม่ได้ capture ยืนยัน = ค่า default (cooldown/ระยะ) — ปรับตามจำเป็น
    // ============================================================
    { name: "First Aid", skillId: 2, level: 1, selfCast: true, intervalMin: 4, spMin: 4, cooldownMs: 2000, job: "Novice", desc: "ตัวเอง · SP 4 · ยังไม่ทดสอบ" },
    { name: "Fire Bolt", skillId: 11, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 30, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 12/14/16/18/20/22/24/26/28/30 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Cold Bolt", skillId: 12, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 30, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 12/14/16/18/20/22/24/26/28/30 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Fireball", skillId: 13, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 25, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 25/25/25/25/25/25/25/25/25/25 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Fire Wall", skillId: 14, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 40, cooldownMs: 2000, job: "Mage", desc: "AoEพื้น · SP 40/40/40/40/40/40/40/40/40/40 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Frost Diver", skillId: 15, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 25, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 25/24/23/22/21/20/19/18/17/16 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Lightning Bolt", skillId: 16, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 30, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 12/14/16/18/20/22/24/26/28/30 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Napalm Beat", skillId: 17, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 18, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 9/9/9/12/12/12/15/15/15/18 · ยังไม่ทดสอบ" },
    { name: "Soul Strike", skillId: 18, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 42, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 18/14/24/20/30/26/36/32/42/38 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Thunderstorm", skillId: 19, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 74, cooldownMs: 2000, job: "Mage", desc: "AoEพื้น · SP 29/34/39/44/49/54/59/64/69/74 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Safety Wall", skillId: 20, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 40, cooldownMs: 2000, job: "Mage", desc: "AoEพื้น · SP 30/30/30/35/35/35/40/40/40/40 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Stone Curse", skillId: 21, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 25, cooldownMs: 2000, job: "Mage", desc: "โจมตี · SP 25/24/23/22/21/20/19/18/17/16 · ยังไม่ทดสอบ" },
    { name: "Sight", skillId: 22, level: 1, selfCast: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Mage", desc: "ตัวเอง · SP 10 · ยังไม่ทดสอบ" },
    { name: "Energy Coat", skillId: 23, level: 1, selfCast: true, intervalMin: 4, spMin: 30, cooldownMs: 2000, job: "Mage", desc: "ตัวเอง · SP 30 · ยังไม่ทดสอบ" },
    { name: "Counter Attack", skillId: 31, level: 5, selfCast: true, intervalMin: 4, spMin: 3, cooldownMs: 2000, job: "Knight", desc: "ตัวเอง · SP 3 · ยังไม่ทดสอบ" },
    { name: "Pierce", skillId: 36, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 7, cooldownMs: 2000, job: "Knight", desc: "โจมตี · SP 7 · ยังไม่ทดสอบ" },
    { name: "Spear Stab", skillId: 37, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 9, cooldownMs: 2000, job: "Knight", desc: "โจมตี · SP 9 · ยังไม่ทดสอบ" },
    { name: "Brandish Spear", skillId: 38, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 12, cooldownMs: 2000, job: "Knight", desc: "โจมตี · SP 12/12/12/12/12/12/12/12/12/12 · ยังไม่ทดสอบ" },
    { name: "Spear Boomerang", skillId: 39, level: 5, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Knight", desc: "โจมตี · SP 10 · ยังไม่ทดสอบ" },
    { name: "Heal", skillId: 41, level: 10, ally: true, hpBelowPct: 50, spMin: 40, cooldownMs: 2500, job: "Acolyte", desc: "Ally→ใช้กับตัวเอง · ใช้เมื่อ HP<50% · SP 13/16/19/22/25/28/31/34/37/40 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Heal (รักษาผู้เล่นอื่น)", skillId: 41, level: 10, buffMode: true, buffAll: true, targetHpBelowPct: 90, repeatSec: 30, maxDistance: 9, spMin: 40, cooldownMs: 2500, job: "Acolyte/Priest", desc: "บอทรักษา · ให้ทุกคนที่ HP<90% ในรัศมี 9 ช่อง · ซ้ำ/คนทุก 30 วิ · SP 13-40 · ยังไม่ทดสอบ" },
    { name: "Blessing (บัพให้คน)", skillId: 44, level: 10, buffMode: true, buffAll: true, repeatSec: 300, maxDistance: 9, spMin: 64, cooldownMs: 3000, job: "Acolyte/Priest", desc: "บอทบัพ · ให้ทุกคนในรัศมี 9 ช่อง · ซ้ำ/คนทุก 5 นาที · SP 28-64 · ยังไม่ทดสอบ" },
    { name: "Increase Agility (บัพให้คน)", skillId: 42, level: 10, buffMode: true, buffAll: true, repeatSec: 300, maxDistance: 9, spMin: 45, cooldownMs: 3000, job: "Acolyte/Priest", desc: "บอทบัพ · ให้ทุกคนในรัศมี 9 ช่อง · ซ้ำ/คนทุก 5 นาที · SP 18-45 · ยังไม่ทดสอบ" },
    { name: "Increase Agility", skillId: 42, level: 10, ally: true, intervalMin: 4, spMin: 45, cooldownMs: 2000, job: "Acolyte", desc: "Ally→ใช้กับตัวเอง · SP 18/21/24/27/30/33/36/39/42/45 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Decrease Agility", skillId: 43, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 33, cooldownMs: 2000, job: "Acolyte", desc: "โจมตี · SP 15/17/19/21/23/25/27/29/31/33 · ยังไม่ทดสอบ" },
    { name: "Blessing", skillId: 44, level: 10, ally: true, intervalMin: 4, spMin: 64, cooldownMs: 2000, job: "Acolyte", desc: "Ally→ใช้กับตัวเอง · SP 28/32/36/40/44/48/52/56/60/64 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Angelus", skillId: 47, level: 10, selfCast: true, intervalMin: 4, spMin: 50, cooldownMs: 2000, job: "Acolyte", desc: "ตัวเอง · SP 23/26/29/32/35/38/41/44/47/50 · ยังไม่ทดสอบ" },
    { name: "Signum Crusis", skillId: 48, level: 10, selfCast: true, intervalMin: 4, spMin: 35, cooldownMs: 2000, job: "Acolyte", desc: "ตัวเอง · SP 35/35/35/35/35/35/35/35/35/35 · ยังไม่ทดสอบ" },
    { name: "Cure", skillId: 49, level: 1, ally: true, intervalMin: 4, spMin: 15, cooldownMs: 2000, job: "Acolyte", desc: "Ally→ใช้กับตัวเอง · SP 15 · ยังไม่ทดสอบ" },
    { name: "Aqua Benedicta", skillId: 50, level: 1, selfCast: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Acolyte", desc: "ตัวเอง · SP 10 · ยังไม่ทดสอบ" },
    { name: "Pneuma", skillId: 51, level: 1, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Acolyte", desc: "AoEพื้น · SP 10 · ยังไม่ทดสอบ" },
    { name: "Ruwach", skillId: 52, level: 1, selfCast: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Acolyte", desc: "ตัวเอง · SP 10 · ยังไม่ทดสอบ" },
    { name: "Teleport", skillId: 53, level: 1, selfCast: true, intervalMin: 4, spMin: 30, cooldownMs: 2000, job: "Acolyte", desc: "ตัวเอง · SP 30 · ยังไม่ทดสอบ" },
    { name: "Return", skillId: 54, level: 1, selfCast: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Acolyte", desc: "ตัวเอง · SP 10 · ยังไม่ทดสอบ" },
    { name: "Warp Portal", skillId: 55, level: 4, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 35, cooldownMs: 2000, job: "Acolyte", desc: "AoEพื้น · SP 35/32/29/26 · ยังไม่ทดสอบ" },
    { name: "Holy Light", skillId: 56, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 15, cooldownMs: 2000, job: "Acolyte", desc: "โจมตี · SP 15 · ยังไม่ทดสอบ" },
    { name: "Envenom", skillId: 58, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 12, cooldownMs: 2000, job: "Thief", desc: "โจมตี · SP 12/12/12/12/12/12/12/12/12/12 · ยังไม่ทดสอบ" },
    { name: "Detoxify", skillId: 59, level: 1, ally: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Thief", desc: "Ally→ใช้กับตัวเอง · SP 10 · ยังไม่ทดสอบ" },
    { name: "Back Slide", skillId: 60, level: 1, selfCast: true, intervalMin: 4, spMin: 5, cooldownMs: 2000, job: "Thief", desc: "ตัวเอง · SP 5 · ยังไม่ทดสอบ" },
    { name: "Sand Attack", skillId: 62, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 9, cooldownMs: 2000, job: "Thief", desc: "โจมตี · SP 9 · ยังไม่ทดสอบ" },
    { name: "Stone Fling", skillId: 63, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 2, cooldownMs: 2000, job: "Thief", desc: "โจมตี · SP 2 · ยังไม่ทดสอบ" },
    { name: "Find Stone", skillId: 64, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 2, cooldownMs: 2000, job: "Thief", desc: "โจมตี · SP 2 · ยังไม่ทดสอบ" },
    { name: "Hiding", skillId: 65, level: 10, selfCast: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Thief", desc: "ตัวเอง · SP 10/10/10/10/10/10/10/10/10/10 · ยังไม่ทดสอบ" },
    { name: "Vending", skillId: 70, level: 10, selfCast: true, intervalMin: 4, spMin: 0, cooldownMs: 2000, job: "Merchant", desc: "ตัวเอง · SP 0/0/0/0/0/0/0/0/0/0 · ยังไม่ทดสอบ" },
    { name: "Mammonite", skillId: 72, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 5, cooldownMs: 2000, job: "Merchant", desc: "โจมตี · SP 5/5/5/5/5/5/5/5/5/5 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Crazy Uproar", skillId: 74, level: 1, selfCast: true, intervalMin: 4, spMin: 8, cooldownMs: 2000, job: "Merchant", desc: "ตัวเอง · SP 8 · ยังไม่ทดสอบ" },
    { name: "Cart Revolution", skillId: 75, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 12, cooldownMs: 2000, job: "Merchant", desc: "โจมตี · SP 12 · ยังไม่ทดสอบ" },
    { name: "Aspersio", skillId: 76, level: 5, ally: true, intervalMin: 4, spMin: 20, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 12/14/16/18/20 · ยังไม่ทดสอบ" },
    { name: "Benedictio Sanctissimi Sacramenti", skillId: 77, level: 5, ally: true, intervalMin: 4, spMin: 20, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Sanctuary", skillId: 78, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 42, cooldownMs: 2000, job: "Priest", desc: "AoEพื้น · SP 15/18/21/24/27/30/33/36/39/42 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Gloria", skillId: 79, level: 5, selfCast: true, intervalMin: 4, spMin: 20, cooldownMs: 2000, job: "Priest", desc: "ตัวเอง · SP 20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Magnificat", skillId: 80, level: 5, selfCast: true, intervalMin: 4, spMin: 40, cooldownMs: 2000, job: "Priest", desc: "ตัวเอง · SP 40/40/40/40/40 · ยังไม่ทดสอบ" },
    { name: "Impositio Manus", skillId: 81, level: 5, ally: true, intervalMin: 4, spMin: 24, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 13/16/19/21/24 · ยังไม่ทดสอบ" },
    { name: "Kyrie Eleison", skillId: 82, level: 10, ally: true, intervalMin: 4, spMin: 35, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 20/20/20/25/25/25/30/30/30/35 · ยังไม่ทดสอบ" },
    { name: "Lex Aeterna", skillId: 83, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Priest", desc: "โจมตี · SP 10 · ยังไม่ทดสอบ" },
    { name: "Lex Divina", skillId: 84, level: 5, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 20, cooldownMs: 2000, job: "Priest", desc: "โจมตี · SP 20/20/20/20/20/18/16/14/12/10 · ยังไม่ทดสอบ" },
    { name: "Magnus Exorcismus", skillId: 85, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 58, cooldownMs: 2000, job: "Priest", desc: "AoEพื้น · SP 40/42/44/46/48/50/52/54/56/58 · ยังไม่ทดสอบ" },
    { name: "Resurrection", skillId: 86, level: 4, ally: true, intervalMin: 4, spMin: 60, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 60/60/60/60 · ยังไม่ทดสอบ" },
    { name: "Status Recovery", skillId: 87, level: 1, ally: true, intervalMin: 4, spMin: 5, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 5 · ยังไม่ทดสอบ" },
    { name: "Suffragium", skillId: 88, level: 3, ally: true, intervalMin: 4, spMin: 8, cooldownMs: 2000, job: "Priest", desc: "Ally→ใช้กับตัวเอง · SP 8 · ยังไม่ทดสอบ" },
    { name: "Turn Undead", skillId: 89, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 20, cooldownMs: 2000, job: "Priest", desc: "โจมตี · SP 20/20/20/20/20/20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Earth Spike", skillId: 91, level: 5, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 20, cooldownMs: 2000, job: "Wizard", desc: "โจมตี · SP 12/14/16/18/20 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Heaven's Drive", skillId: 92, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 44, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 28/32/36/40/44 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Fire Pillar", skillId: 93, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 75, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 75/75/75/75/75/75/75/75/75/75 · ยังไม่ทดสอบ" },
    { name: "Frost Nova", skillId: 94, level: 10, selfCast: true, intervalMin: 4, spMin: 45, cooldownMs: 2000, job: "Wizard", desc: "ตัวเอง · SP 45/43/41/39/37/35/33/31/29/27 · ยังไม่ทดสอบ" },
    { name: "Ice Wall", skillId: 95, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 20, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 20/20/20/20/20/20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Jupitel Thunder", skillId: 96, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 47, cooldownMs: 2000, job: "Wizard", desc: "โจมตี · SP 20/23/26/29/36/35/38/41/44/47 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Lord of Vermilion", skillId: 97, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 96, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 60/64/68/72/76/80/84/88/92/96 · ยังไม่ทดสอบ" },
    { name: "Meteor Storm", skillId: 98, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 64, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 20/24/30/34/40/44/50/54/60/64 · ยังไม่ทดสอบ" },
    { name: "Quagmire", skillId: 99, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 25, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 5/10/15/20/25 · ยังไม่ทดสอบ" },
    { name: "Sense", skillId: 100, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Wizard", desc: "โจมตี · SP 10 · ยังไม่ทดสอบ" },
    { name: "Sightrasher", skillId: 101, level: 10, selfCast: true, intervalMin: 4, spMin: 53, cooldownMs: 2000, job: "Wizard", desc: "ตัวเอง · SP 35/37/39/41/43/45/47/49/51/53 · ยังไม่ทดสอบ" },
    { name: "Storm Gust", skillId: 102, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 78, cooldownMs: 2000, job: "Wizard", desc: "AoEพื้น · SP 78/78/78/78/78/78/78/78/78/78 · ปรับเลเวลได้ · ยังไม่ทดสอบ" },
    { name: "Water Ball", skillId: 103, level: 5, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 25, cooldownMs: 2000, job: "Wizard", desc: "โจมตี · SP 15/20/20/25/25/25/25/25/25/25 · ยังไม่ทดสอบ" },
    { name: "Detect", skillId: 106, level: 1, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 8, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 8 · ยังไม่ทดสอบ" },
    { name: "Blitz Beat", skillId: 107, level: 5, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 22, cooldownMs: 2000, job: "Hunter", desc: "โจมตี · SP 10/13/16/19/22 · ยังไม่ทดสอบ" },
    { name: "Land Mine", skillId: 109, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 20, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Remove Trap", skillId: 110, level: 1, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 5, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 5 · ยังไม่ทดสอบ" },
    { name: "Spring Trap", skillId: 111, level: 1, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 10 · ยังไม่ทดสอบ" },
    { name: "Skid Trap", skillId: 112, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 10/10/10/10/10 · ยังไม่ทดสอบ" },
    { name: "Ankle Snare", skillId: 113, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 12, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 12/12/12/12/12 · ยังไม่ทดสอบ" },
    { name: "Flasher", skillId: 114, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 12, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 12/12/12/12/12 · ยังไม่ทดสอบ" },
    { name: "Freezing Trap", skillId: 115, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 10/10/10/10/10 · ยังไม่ทดสอบ" },
    { name: "Sandman", skillId: 116, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 12, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 12/12/12/12/12 · ยังไม่ทดสอบ" },
    { name: "Blast Mine", skillId: 117, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 10/10/10/10/10 · ยังไม่ทดสอบ" },
    { name: "Claymore Trap", skillId: 118, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 15, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 15/15/15/15/15 · ยังไม่ทดสอบ" },
    { name: "Shockwave Trap", skillId: 119, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 45, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 45/45/45/45/45 · ยังไม่ทดสอบ" },
    { name: "Talkie Box", skillId: 120, level: 1, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 1, cooldownMs: 2000, job: "Hunter", desc: "AoEพื้น · SP 1 · ยังไม่ทดสอบ" },
    { name: "Phantasmic Arrow", skillId: 121, level: 1, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Hunter", desc: "โจมตี · SP 10 · ยังไม่ทดสอบ" },
    { name: "Grimtooth", skillId: 125, level: 5, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 3, cooldownMs: 2000, job: "Assassin", desc: "โจมตี · SP 3/3/3/3/3 · ยังไม่ทดสอบ" },
    { name: "Cloaking", skillId: 127, level: 10, selfCast: true, intervalMin: 4, spMin: 15, cooldownMs: 2000, job: "Assassin", desc: "ตัวเอง · SP 15/15/15/15/15/15/15/15/15/15 · ยังไม่ทดสอบ" },
    { name: "Enchant Poison", skillId: 128, level: 10, ally: true, intervalMin: 4, spMin: 20, cooldownMs: 2000, job: "Assassin", desc: "Ally→ใช้กับตัวเอง · SP 20/20/20/20/20/20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Poison React", skillId: 129, level: 10, selfCast: true, intervalMin: 4, spMin: 60, cooldownMs: 2000, job: "Assassin", desc: "ตัวเอง · SP 25/30/35/40/45/50/55/60/45/45 · ยังไม่ทดสอบ" },
    { name: "Venom Dust", skillId: 130, level: 10, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 20, cooldownMs: 2000, job: "Assassin", desc: "AoEพื้น · SP 20/20/20/20/20/20/20/20/20/20 · ยังไม่ทดสอบ" },
    { name: "Venom Splasher", skillId: 131, level: 10, targeted: true, maxDistance: 9, maxUsesPerTarget: 1, spMin: 30, cooldownMs: 2000, job: "Assassin", desc: "โจมตี · SP 12/14/16/18/20/22/24/26/28/30 · ยังไม่ทดสอบ" },
    { name: "Adrenaline Rush", skillId: 135, level: 10, selfCast: true, intervalMin: 4, spMin: 47, cooldownMs: 2000, job: "Blacksmith", desc: "ตัวเอง · SP 20/23/26/29/32/35/38/41/44/47 · ยังไม่ทดสอบ" },
    { name: "Hammer Fall", skillId: 136, level: 5, ground: true, maxDistance: 9, mobCountMin: 2, maxUsesPerTarget: 1, spMin: 10, cooldownMs: 2000, job: "Blacksmith", desc: "AoEพื้น · SP 10/10/10/10/10 · ยังไม่ทดสอบ" },
    { name: "Weapon Perfection", skillId: 139, level: 5, selfCast: true, intervalMin: 4, spMin: 18, cooldownMs: 2000, job: "Blacksmith", desc: "ตัวเอง · SP 18/16/14/12/10 · ยังไม่ทดสอบ" },
    { name: "Power Thrust", skillId: 141, level: 5, selfCast: true, intervalMin: 4, spMin: 18, cooldownMs: 2000, job: "Blacksmith", desc: "ตัวเอง · SP 18/16/14/12/10 · ยังไม่ทดสอบ" },
    { name: "Maximize Power", skillId: 142, level: 5, selfCast: true, intervalMin: 4, spMin: 10, cooldownMs: 2000, job: "Blacksmith", desc: "ตัวเอง · SP 10/10/10/10/10 · ยังไม่ทดสอบ" },
  ];
  // Guard ค่า config เก่า/แก้มือ: skill ที่กำหนดเป้าหมายบนพื้นต้องส่ง packet ground เสมอ
  const GROUND_SKILL_IDS = new Set(SKILL_PRESETS.filter(preset => preset.ground).map(preset => preset.skillId));
  function skillPresetGroups() {
    const groups = {};
    for (const s of SKILL_PRESETS) { (groups[s.job] = groups[s.job] || []).push(s); }
    return groups;
  }
  function openItemListPopup(listType) {
    // ★ สร้าง popup ใหม่ทุกครั้ง (กัน closure/listener ค้างจากครั้งก่อน)
    const old = document.getElementById('__assist_itempopup');
    if (old) old.remove();
    const popup = document.createElement('div');
    popup.id = '__assist_itempopup';
    document.body.appendChild(popup);

    const getList = () => listType === 'only' ? CFG.filter.onlyItems : listType === 'queue' ? CFG.lootQueueItemIds : listType === 'deposit' ? CFG.depositItemIds : CFG.filter.exceptItems;
    const setList = (arr) => {
      if (listType === 'only') CFG.filter.onlyItems = arr;
      else if (listType === 'queue') CFG.lootQueueItemIds = arr;
      else if (listType === 'deposit') { CFG.depositItemIds = arr; CFG.storageDepositMode = 'selected'; }
      else CFG.filter.exceptItems = arr;
      saveConfigDebounced();
    };
    const titleTxt = listType === 'only' ? 'เก็บเฉพาะ (only)' : listType === 'queue' ? 'ส่งให้ Loot Queue' : listType === 'deposit' ? 'ฝากเฉพาะรายการ' : 'ยกเว้น (except)';

    function render(search) {
      const current = getList();
      const s = (search || '').trim().toLowerCase();
      const all = itemDBEntries();
      // ★ แบ่ง 2 ส่วน: (1) ในรายการแล้ว (2) ค้นหาเพิ่ม
      const inList = current.map(id => {
        const e = all.find(x => x.id === id) || { id, name: nameOf(id) };
        return e;
      });
      const searchable = all.filter(e => !current.includes(e.id));
      let searchRes = searchable;
      if (s) {
        searchRes = searchable.filter(e =>
          e.name.toLowerCase().includes(s) || String(e.id).includes(s));
      }
      searchRes = searchRes.slice(0, 200);   // limit กัน lag

      const renderItem = (e, inCurrent) => {
        const icon = `<img src="${itemIconUrl(e.id)}" onerror="this.style.visibility='hidden'">`;
        const price = itemPrice(e.id);
        const priceStr = price ? `<span class="price">${(price).toLocaleString()}z</span>` : '';
        const countStr = e.count ? ` <span style="color:#27ae60">×${e.count}</span>` : '';
        const btn = inCurrent
          ? `<button class="rmbtn" data-rm="${e.id}">✕ ลบ</button>`
          : `<button class="addbtn" data-add="${e.id}">+ เพิ่ม</button>`;
        return `<div class="itemrow">${icon}<span class="nm">${e.name}${countStr}</span>${priceStr}<span class="id">${e.id}</span>${btn}</div>`;
      };

      let html = '';
      html += `<div style="padding:6px 8px;color:#8ab4f8;font-size:11px;font-weight:600;border-bottom:1px solid #2a2d35">📋 ในรายการ (${inList.length})</div>`;
      html += inList.length ? inList.map(e => renderItem(e, true)).join('')
        : `<div class="empty">(ยังว่าง — ค้นหาแล้วกด + เพิ่ม ด้านล่าง)</div>`;
      html += `<div style="padding:6px 8px;color:#8ab4f8;font-size:11px;font-weight:600;border-bottom:1px solid #2a2d35;margin-top:6px">🔍 ทั้งหมด${s ? ` (${searchRes.length}${searchable.length>200?'+':''})` : ''}</div>`;
      html += searchRes.length ? searchRes.map(e => renderItem(e, false)).join('')
        : `<div class="empty">${s ? 'ไม่พบ — ลองคำอื่น หรือ id เลข' : 'พิมพ์เพื่อค้นหา...'}</div>`;
      return html;
    }

    popup.innerHTML = `
      <div class="modal">
        <div class="hdr">
          <span class="ttl">📦 จัดการรายการ — ${titleTxt}</span>
          <span class="x" id="__assist_itempopup_x">✕</span>
        </div>
        <div class="searchbar">
          <input type="text" id="__assist_itempopup_search" placeholder="ค้นหาชื่อหรือ id..." autocomplete="off" style="flex:1">
          <input type="text" id="__assist_itempopup_addid" placeholder="id" autocomplete="off" style="width:54px;flex:0 0 auto">
          <button id="__assist_itempopup_addbtn" style="flex:0 0 auto;padding:5px 10px">+ id</button>
        </div>
        <div class="body" id="__assist_itempopup_body"></div>
      </div>`;
    const bodyEl = popup.querySelector('#__assist_itempopup_body');
    const searchInput = popup.querySelector('#__assist_itempopup_search');
    const addIdInput = popup.querySelector('#__assist_itempopup_addid');
    let searchVal = '';
    const refresh = () => { bodyEl.innerHTML = render(searchVal); wireButtons(); };
    // ★ เพิ่ม id แบบ manual (รองรับหลาย id คั่นจุลภาค) — สำหรับ item ที่ไม่อยู่ใน DB
    const addManualIds = () => {
      const ids = addIdInput.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      if (!ids.length) return;
      const cur = getList();
      let added = 0;
      for (const id of ids) if (!cur.includes(id)) { cur.push(id); added++; }
      setList(cur);
      if (added) { log('📦 เพิ่ม id', ids.join(','), 'เข้า', listType); addIdInput.value = ''; refresh(); }
    };
    popup.querySelector('#__assist_itempopup_addbtn').addEventListener('click', addManualIds);
    addIdInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addManualIds(); } });
    function wireButtons() {
      bodyEl.querySelectorAll('[data-add]').forEach(b => {
        b.onclick = () => {
          const id = parseInt(b.getAttribute('data-add'), 10);
          const cur = getList();
          if (!cur.includes(id)) { setList([...cur, id]); log('📦 เพิ่ม', nameOf(id), 'เข้า', listType); }
          refresh();
        };
      });
      bodyEl.querySelectorAll('[data-rm]').forEach(b => {
        b.onclick = () => {
          const id = parseInt(b.getAttribute('data-rm'), 10);
          setList(getList().filter(x => x !== id));
          log('📦 ลบ', nameOf(id), 'ออกจาก', listType);
          refresh();
        };
      });
    }
    const closePopup = () => { popup.classList.remove('open'); setTimeout(() => popup.remove(), 200); };
    searchInput.addEventListener('input', () => { searchVal = searchInput.value; refresh(); });
    popup.querySelector('#__assist_itempopup_x').addEventListener('click', closePopup);
    popup.addEventListener('click', (ev) => { if (ev.target === popup) closePopup(); });
    // ★ คลิก input ใน popup → focus ทันที (กัน Unity ขโมย focus เหมือน main panel)
    popup.addEventListener('mousedown', (e) => {
      if (e.target.matches && e.target.matches('input, select, textarea')) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setTimeout(() => { try { e.target.focus(); } catch (_) {} }, 0);
      }
    }, true);
    refresh();
    searchInput.focus();
    popup.classList.add('open');
  }

  // ============================================================
  //  SKILL POPUP — จัดการรายการ skill (เพิ่ม/แก้/ลบ)
  // ============================================================
  function openSkillPopup() {
    const old = document.getElementById('__assist_skillpopup');
    if (old) old.remove();
    const popup = document.createElement('div');
    popup.id = '__assist_skillpopup';
    document.body.appendChild(popup);

    let editingSkillIdx = -1;   // index ของ skill ที่กำลังแก้ (-1 = ไม่มี)
    function render() {
      const skills = CFG.skills || [];
      let html = '';
      html += `<div style="padding:6px 8px;color:#8ab4f8;font-size:11px;font-weight:600;border-bottom:1px solid #2a2d35">🔮 skill list (${skills.length})</div>`;
      html += `<div style="padding:5px 8px;color:#9aa0a6;font-size:9px;border-bottom:1px solid #2a2d35">⏱️ คิวสกิลเว้น ${(skillCommandGapMs() / 1000).toFixed(1)}s ทุกคำสั่ง · Blessing / Agility / Kyrie เช็ค status จาก server; สกิลอื่นใช้ cooldown fallback</div>`;
      html += skills.length ? skills.map((s, i) => {
        const mode = s.selfCast ? 'self' : (s.ally ? 'ally' : (s.targeted ? 'target' : (s.ground ? 'ground' : 'AoE')));
        const modeColor = s.ally ? '#29b6f6' : (s.selfCast ? '#27ae60' : (s.targeted ? '#e67e22' : '#8e44ad'));
        const spStr = s.spMin ? ` SP≥${s.spMin}` : '';
        const cdStr = selfSupportStatusId(s) != null ? ' เช็ค status' : (s.intervalMin > 0 ? ` ทุก${s.intervalMin}นาที` : (s.cooldownMs ? ` cd${(s.cooldownMs/1000).toFixed(0)}s` : ''));
        const distStr = s.maxDistance ? ` ≤${s.maxDistance}ช่อง` : '';
        let row = `<div style="padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.04)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="flex:1;font-size:11px;color:#e8e8e8">${s.name || 'skill_'+s.skillId} <span style="color:#5f6368">(#${s.skillId} Lv${s.level})</span></span>
            <span style="font-size:10px;color:${modeColor};background:${modeColor}22;padding:1px 6px;border-radius:3px">${mode}</span>
            <span style="font-size:10px;color:#9aa0a6">${spStr}${cdStr}${distStr}</span>
            <button data-editskill="${i}" style="background:#2a3441;border:1px solid #3a3f4b;border-radius:4px;color:#8ab4f8;cursor:pointer;font-size:11px;padding:3px 8px">✎</button>
            <button class="rmbtn" data-rmskill="${i}" style="background:#4a2020;border:1px solid #6a3030;border-radius:4px;color:#e8e8e8;cursor:pointer;font-size:11px;padding:3px 8px">✕</button>
          </div>`;
        // ★ ฟอร์มแก้ไข (แสดงเมื่อกด ✎)
        if (editingSkillIdx === i) {
          const modeVal = s.selfCast ? 'self' : (s.ally ? 'ally' : (s.ground ? 'ground' : (s.targeted ? 'targeted' : 'aoe')));
          const fld = (label, inner, title) => `<label style="display:flex;flex-direction:column;gap:1px;font-size:9px;color:#9aa0a6" title="${title}">${label}${inner}</label>`;
          const inp = (key, val, w) => `<input data-edit="${key}" type="number" value="${val}" style="width:${w};background:#15171c;border:1px solid #3a3f4b;border-radius:4px;color:#e8e8e8;padding:4px 6px;font-size:10px;font-family:inherit">`;
          row += `<div style="padding:8px;background:rgba(0,0,0,.2);border-radius:4px;margin-top:4px">
            <div style="display:flex;gap:6px;margin-bottom:6px">
              ${fld('ชื่อ', `<input data-edit="name" value="${s.name||''}" placeholder="ชื่อสกิล" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:4px;color:#e8e8e8;padding:4px 6px;font-size:10px;font-family:inherit">`, 'ชื่อสกิล (แสดงใน log)')}
              ${fld('skillId', inp('skillId', s.skillId, '60px'), 'เลข ID ของสกิล (จาก packet capture)')}
              ${fld('เลเวล', inp('level', s.level, '45px'), 'เลเวลสกิลที่จะส่ง (1-10)')}
            </div>
            <div style="margin-bottom:6px">
              ${fld('โหมดการใช้งาน', `<select data-edit="mode" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:4px;color:#e8e8e8;padding:4px 6px;font-size:10px;font-family:inherit">
                <option value="targeted"${modeVal==='targeted'?' selected':''}>targeted — เลือกเป้า (Bash, Double Strafe)</option>
                <option value="ground"${modeVal==='ground'?' selected':''}>ground — เลือกพื้นที่ (Arrow Shower)</option>
                <option value="aoe"${modeVal==='aoe'?' selected':''}>AoE — รอบตัว (Magnum Break)</option>
                <option value="self"${modeVal==='self'?' selected':''}>self-cast — ใช้กับตัวเอง (Quicken, Blessing)</option>
                <option value="ally"${modeVal==='ally'?' selected':''}>ally — สกิล Ally ใช้กับตัวเอง (Heal, Kyrie)</option>
              </select>`, 'targeted=ต้องมีมอนเป้าหมาย, AoE=ใช้รอบตัว, self=ใช้กับตัวเอง')}
            </div>
            <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
              ${fld('SP ขั้นต่ำ', inp('spMin', s.spMin||0, '55px'), 'SP ต้องมากกว่าหรือเท่ากับค่านี้ถึงจะใช้')}
              ${fld('Cooldown (วินาที)', `<input data-edit="cooldownSec" type="text" inputmode="decimal" value="${((s.cooldownMs||2000)/1000).toFixed(1)}" style="width:60px;background:#15171c;border:1px solid #3a3f4b;border-radius:4px;color:#e8e8e8;padding:4px 6px;font-size:10px;font-family:inherit">`, 'รอใช้สกิลเดิมซ้ำ เช่น 2 = 2 วินาที; ใช้เมื่อระยะเวลา (นาที) เป็น 0 เท่านั้น')}
              ${fld('ระยะสูงสุด', inp('maxDistance', s.maxDistance||0, '55px'), 'ต้องอยู่ใกล้ไม่เกินกี่ช่อง (0=ไม่จำกัด)')}
              ${fld('ครั้ง/มอน', inp('maxUsesPerTarget', s.maxUsesPerTarget||1, '55px'), 'ใช้สกิลนี้ได้กี่ครั้งต่อมอน 1 ตัว')}
              ${fld('มอนขั้นต่ำ', inp('mobCountMin', s.mobCountMin||0, '55px'), 'ใช้เมื่อมอนรุมมากกว่าหรือเท่ากับ N ตัว')}
            </div>
            <div style="display:flex;gap:6px;margin-bottom:6px">
              ${fld('ระยะเวลา (นาที) — ใช้ซ้ำ', `<input data-edit="intervalMin" type="number" step="0.5" value="${s.intervalMin||0}" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:4px;color:#e8e8e8;padding:4px 6px;font-size:10px;font-family:inherit">`, 'รอใช้สกิลเดิมทุก N นาที; มากกว่า 0 จะใช้แทน Cooldown (วินาที), 0 จึงใช้ Cooldown')}
              ${fld('ระยะต่ำสุด (ช่อง)', `<input data-edit="minDistance" type="number" value="${s.minDistance||0}" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:4px;color:#e8e8e8;padding:4px 6px;font-size:10px;font-family:inherit">`, 'ต้องอยู่ไกลอย่างน้อย N ช่อง (เช่น Charge Attack)')}
              ${fld('ใช้เมื่อ HP < %', inp('hpBelowPct', s.hpBelowPct||0, '60px'), '0=ไม่สน HP; เช่น Heal ตั้ง 50 จะใช้เมื่อ HP ต่ำกว่า 50%')}
            </div>
            <div style="display:flex;gap:4px">
              <button data-saveedit="${i}" style="flex:1;background:#1b5e20;border:1px solid #2e7d32;border-radius:4px;color:#a5d6a7;cursor:pointer;font-size:10px;padding:5px;font-family:inherit">✓ บันทึก</button>
              <button data-canceledit style="flex:1;background:#4a2020;border:1px solid #6a3030;border-radius:4px;color:#ef9a9a;cursor:pointer;font-size:10px;padding:5px;font-family:inherit">ยกเลิก</button>
            </div>
          </div>`;
        }
        row += `</div>`;
        return row;
      }).join('') : `<div class="empty">(ยังว่าง — เพิ่มด้านล่าง)</div>`;

      // ★ preset dropdown — เลือกสกิลสำเร็จรูปจาก database
      const groups = skillPresetGroups();
      const presetOpts = Object.entries(groups).map(([job, skills]) => {
        const skillOpts = skills.map((s, i) => {
          const idx = SKILL_PRESETS.indexOf(s);
          const mode = s.selfCast ? 'self' : (s.ally ? 'ally' : (s.targeted ? 'target' : (s.ground ? 'ground' : 'AoE')));
          return `<option value="${idx}">${s.name} (Lv${s.level}, ${mode}) — ${s.desc || ''}</option>`;
        }).join('');
        return `<optgroup label="${job}">${skillOpts}</optgroup>`;
      }).join('');
      html += `<div style="padding:6px 8px;color:#27ae60;font-size:11px;font-weight:600;border-bottom:1px solid #2a2d35;margin-top:6px">⚡ เลือกจาก preset (แนะนำ)</div>`;
      html += `<div style="padding:8px">
        <select id="__assist_skill_preset" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit;margin-bottom:6px">
          <option value="">— เลือกสกิลที่จะเพิ่ม —</option>
          ${presetOpts}
        </select>
        <button id="__assist_skill_presetbtn" style="width:100%;background:#1b5e20;border:1px solid #2e7d32;border-radius:5px;color:#a5d6a7;cursor:pointer;font-size:11px;padding:6px;font-family:inherit;margin-bottom:4px">+ เพิ่มจาก preset</button>
      </div>`;
      html += `<div style="padding:6px 8px;color:#8ab4f8;font-size:11px;font-weight:600;border-bottom:1px solid #2a2d35;margin-top:6px">➕ เพิ่ม skill ใหม่ (กำหนดเอง)</div>`;
      html += `<div style="padding:8px">
        <input id="__assist_skill_name" placeholder="ชื่อ (เช่น Bash)" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit;margin-bottom:4px">
        <div style="display:flex;gap:4px;margin-bottom:4px">
          <input id="__assist_skill_id" type="number" placeholder="skillId" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
          <input id="__assist_skill_lvl" type="number" placeholder="Lv" value="1" style="width:50px;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
        </div>
        <select id="__assist_skill_mode" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit;margin-bottom:4px">
          <option value="targeted">targeted (Bash/Double Strafe — เลือกเป้า)</option>
          <option value="ground">ground (Arrow Shower — เลือกพื้นที่)</option>
          <option value="aoe">AoE (Magnum Break — รอบตัว)</option>
          <option value="self">self-cast (Quicken — บัพตัวเอง)</option>
          <option value="ally">ally (Heal/Kyrie — สกิล Ally ใช้กับตัวเอง)</option>
        </select>
        <div style="display:flex;gap:4px;margin-bottom:4px">
          <input id="__assist_skill_sp" type="number" placeholder="spMin" value="0" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
          <input id="__assist_skill_cd" type="number" placeholder="cd ms" value="2000" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
        </div>
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <input id="__assist_skill_maxdist" type="number" placeholder="maxDist" value="2" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
          <input id="__assist_skill_maxuse" type="number" placeholder="maxUse/target" value="1" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
          <input id="__assist_skill_mobmin" type="number" placeholder="mobMin" value="0" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
        </div>
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <input id="__assist_skill_interval" type="number" placeholder="intervalMin (0=cooldown)" value="0" step="0.5" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
          <input id="__assist_skill_mindist" type="number" placeholder="minDist" value="0" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
          <input id="__assist_skill_hpbelow" type="number" placeholder="HP<% (0=off)" value="0" min="0" max="100" style="flex:1;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit">
        </div>
        <button id="__assist_skill_addbtn" style="width:100%;background:#1b5e20;border:1px solid #2e7d32;border-radius:5px;color:#a5d6a7;cursor:pointer;font-size:11px;padding:6px;font-family:inherit">+ เพิ่ม skill</button>
      </div>`;
      return html;
    }

    popup.innerHTML = `
      <div class="modal" style="background:rgba(20,22,28,.98);border:1px solid #3a3f4b;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.7);width:420px;max-width:92vw;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;color:#e8e8e8;font-family:'Segoe UI',system-ui,sans-serif;font-size:12px">
        <div class="hdr" style="padding:10px 14px;background:#15171c;border-bottom:1px solid #3a3f4b;display:flex;justify-content:space-between;align-items:center">
          <span style="color:#8ab4f8;font-weight:600;font-size:13px">🔮 จัดการ skill list</span>
          <span id="__assist_skillpopup_x" style="cursor:pointer;color:#9aa0a6;font-size:18px;line-height:1">✕</span>
        </div>
        <div id="__assist_skillpopup_body" style="overflow-y:auto;flex:1;padding:6px 8px"></div>
      </div>`;
    const bodyEl = popup.querySelector('#__assist_skillpopup_body');
    const refresh = () => { bodyEl.innerHTML = render(); wireButtons(); };
    function wireButtons() {
      bodyEl.querySelectorAll('[data-rmskill]').forEach(b => {
        b.onclick = () => {
          const i = parseInt(b.getAttribute('data-rmskill'), 10);
          CFG.skills.splice(i, 1);
          saveConfigDebounced();
          editingSkillIdx = -1;
          refresh();
        };
      });
      // ★ แก้ไข skill — ขยายฟอร์ม
      bodyEl.querySelectorAll('[data-editskill]').forEach(b => {
        b.onclick = () => {
          editingSkillIdx = parseInt(b.getAttribute('data-editskill'), 10);
          refresh();
        };
      });
      // ★ บันทึกการแก้ไข
      bodyEl.querySelectorAll('[data-saveedit]').forEach(b => {
        b.onclick = () => {
          const i = parseInt(b.getAttribute('data-saveedit'), 10);
          const s = CFG.skills[i];
          if (!s) return;
          const getVal = (key) => {
            const el = bodyEl.querySelector(`[data-edit="${key}"]`);
            return el ? el.value : '';
          };
          s.name = getVal('name').trim() || s.name;
          s.skillId = parseInt(getVal('skillId'), 10) || s.skillId;
          s.level = parseInt(getVal('level'), 10) || 1;
          const mode = getVal('mode');
          s.targeted = mode === 'targeted';
          s.ground = mode === 'ground';
          s.selfCast = mode === 'self';
          s.ally = mode === 'ally';
          s.spMin = parseInt(getVal('spMin'), 10) || 0;
          const cdSec = parseFloat(getVal('cooldownSec'));
          s.cooldownMs = isNaN(cdSec) ? (s.cooldownMs || 2000) : Math.round(cdSec * 1000);
          s.maxDistance = parseInt(getVal('maxDistance'), 10) || 0;
          s.maxUsesPerTarget = parseInt(getVal('maxUsesPerTarget'), 10) || 1;
          s.mobCountMin = parseInt(getVal('mobCountMin'), 10) || 0;
          s.intervalMin = parseFloat(getVal('intervalMin')) || 0;
          s.minDistance = parseInt(getVal('minDistance'), 10) || 0;
          s.hpBelowPct = Math.max(0, Math.min(100, parseInt(getVal('hpBelowPct'), 10) || 0));
          saveConfigDebounced();
          editingSkillIdx = -1;
          log('✎ แก้ไข skill', s.name);
          refresh();
        };
      });
      // ★ ยกเลิกการแก้ไข
      bodyEl.querySelectorAll('[data-canceledit]').forEach(b => {
        b.onclick = () => { editingSkillIdx = -1; refresh(); };
      });
      const addBtn = bodyEl.querySelector('#__assist_skill_addbtn');
      // ★ preset button — เพิ่มจาก database สำเร็จรูป
      const presetBtn = bodyEl.querySelector('#__assist_skill_presetbtn');
      if (presetBtn) {
        presetBtn.onclick = () => {
          const sel = bodyEl.querySelector('#__assist_skill_preset');
          const idx = parseInt(sel.value, 10);
          if (isNaN(idx) || !SKILL_PRESETS[idx]) return;
          const p = SKILL_PRESETS[idx];
          ASSIST.addSkill({
            name: p.name, skillId: p.skillId, level: p.level,
            targeted: !!p.targeted, ground: !!p.ground, selfCast: !!p.selfCast, ally: !!p.ally,
            intervalMin: p.intervalMin || 0, mobCountMin: p.mobCountMin || 0,
            maxUsesPerTarget: p.maxUsesPerTarget || 1, maxDistance: p.maxDistance || 0,
            minDistance: p.minDistance || 0, spMin: p.spMin || 0, cooldownMs: p.cooldownMs || 2000, hpBelowPct: p.hpBelowPct || 0,
          });
          saveConfigDebounced();
          log('⚡ เพิ่ม preset:', p.name, '(#' + p.skillId + ')');
          refresh();
        };
      }
      if (addBtn) {
        addBtn.onclick = () => {
          const name = bodyEl.querySelector('#__assist_skill_name').value.trim() || undefined;
          const skillId = parseInt(bodyEl.querySelector('#__assist_skill_id').value, 10);
          const level = parseInt(bodyEl.querySelector('#__assist_skill_lvl').value, 10) || 1;
          const mode = bodyEl.querySelector('#__assist_skill_mode').value;
          const spMin = parseInt(bodyEl.querySelector('#__assist_skill_sp').value, 10) || 0;
          const cooldownMs = parseInt(bodyEl.querySelector('#__assist_skill_cd').value, 10) || 2000;
          const maxDistance = parseInt(bodyEl.querySelector('#__assist_skill_maxdist').value, 10) || 0;
          const maxUsesPerTarget = parseInt(bodyEl.querySelector('#__assist_skill_maxuse').value, 10) || 1;
          const mobCountMin = parseInt(bodyEl.querySelector('#__assist_skill_mobmin').value, 10) || 0;
          const intervalMin = parseFloat(bodyEl.querySelector('#__assist_skill_interval').value) || 0;
          const minDistance = parseInt(bodyEl.querySelector('#__assist_skill_mindist').value, 10) || 0;
          const hpBelowPct = Math.max(0, Math.min(100, parseInt(bodyEl.querySelector('#__assist_skill_hpbelow').value, 10) || 0));
          if (isNaN(skillId)) { return; }
          ASSIST.addSkill({
            name, skillId, level,
            targeted: mode === 'targeted',
            ground: mode === 'ground',
            selfCast: mode === 'self',
            ally: mode === 'ally',
            intervalMin, mobCountMin, maxUsesPerTarget, maxDistance, minDistance, spMin, cooldownMs, hpBelowPct,
          });
          saveConfigDebounced();
          refresh();
        };
      }
    }
    const closePopup = () => { popup.classList.remove('open'); setTimeout(() => popup.remove(), 200); };
    popup.querySelector('#__assist_skillpopup_x').addEventListener('click', closePopup);
    popup.addEventListener('click', (ev) => { if (ev.target === popup) closePopup(); });
    // ★ focus tracking (เหมือน item popup)
    popup.addEventListener('mousedown', (e) => {
      if (e.target.matches && e.target.matches('input, select, textarea')) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setTimeout(() => { try { e.target.focus(); } catch (_) {} }, 0);
      }
    }, true);
    refresh();
    popup.classList.add('open');
  }

  // Settings remains owned by the HUD document because its controls and live
  // render loop are already bound there.  The browser window below is a view
  // proxy: it clones the form into an about:blank child, mirrors edits/clicks
  // back to the real controls, and therefore never lays an overlay on WebGL.
  let detachedSettingsWindow = null;
  let detachedSettingsSyncTimer = null;
  // The detached document is rebuilt when it closes, so navigation state has
  // to live outside that document in order to survive the next open.
  const detachedSettingsViewState = { page: 'stats', subtab: 'loot' };
  const DETACHED_SETTINGS_ZOOM_KEY = 'roPureDetachedSettingsZoom_v1';
  function openDetachedSettingsWindow(root, requestedPage = '', requestedSubtab = '') {
    const sourcePopup = root && root.querySelector('#__assist_popup');
    if (!sourcePopup) return false;
    if (detachedSettingsWindow && !detachedSettingsWindow.closed) {
      if (typeof detachedSettingsWindow.__roPureSelectPage === 'function') {
        detachedSettingsWindow.__roPureSelectPage(requestedPage, requestedSubtab);
      }
      detachedSettingsWindow.focus();
      return true;
    }

    const child = window.open('', 'ROAssistSettings', 'popup=yes,width=620,height=820,resizable=yes,scrollbars=yes');
    if (!child) {
      log('⚠️ เปิดหน้าต่าง Settings ไม่ได้ — อนุญาต popup ของเว็บเกมก่อน');
      return false;
    }
    detachedSettingsWindow = child;
    const copiedStyles = Array.from(document.querySelectorAll('style')).map(style => style.textContent).join('\n');
    child.document.open();
    child.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>RO Rebuild Pure Settings</title><style>${copiedStyles}
      html,body{margin:0;background:#101217;color:#e8e8e8;font-family:'Segoe UI','Segoe UI Emoji',system-ui,sans-serif}
      body{padding:10px;min-width:390px}.settings-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:8px 10px;margin:-10px -10px 10px;background:#15171c;border-bottom:1px solid #3a3f4b}
      .settings-head strong{color:#8ab4f8;font-size:14px;margin-right:auto}.settings-head button{background:#2a3441;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 9px;cursor:pointer}
      .settings-head button:hover{background:#34465a}#__assist_popup.detached-settings{display:flex!important;position:static!important;margin:0 auto!important;width:min(720px,100%)!important;max-height:calc(100vh - 76px)!important}
      .detached-settings .__assist_subpage{padding-bottom:12px}.detached-settings .__assist_subtabs{position:sticky;top:0;z-index:1;background:#101217;padding-top:4px}
      #settings-font-size{min-width:42px;text-align:center;color:#9aa0a6;font-variant-numeric:tabular-nums}
    </style></head><body><div class="settings-head"><strong>⚙️ RO Rebuild Pure Settings</strong><span id="settings-state">เชื่อมต่อกับเกม</span><button id="settings-font-down" title="ลดขนาดตัวอักษร">A−</button><span id="settings-font-size">115%</span><button id="settings-font-up" title="เพิ่มขนาดตัวอักษร">A+</button><button id="settings-close">ปิด</button></div><main id="settings-host"></main></body></html>`);
    child.document.close();

    let zoom = 1.15;
    try { zoom = Math.max(0.9, Math.min(1.6, Number(localStorage.getItem(DETACHED_SETTINGS_ZOOM_KEY)) || 1.15)); } catch (_) {}
    const applyZoom = () => {
      child.document.body.style.zoom = String(zoom);
      child.document.getElementById('settings-font-size').textContent = Math.round(zoom * 100) + '%';
      try { localStorage.setItem(DETACHED_SETTINGS_ZOOM_KEY, String(zoom)); } catch (_) {}
    };
    child.document.getElementById('settings-font-down').addEventListener('click', () => { zoom = Math.max(0.9, Math.round((zoom - 0.1) * 10) / 10); applyZoom(); });
    child.document.getElementById('settings-font-up').addEventListener('click', () => { zoom = Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10); applyZoom(); });
    applyZoom();

    const view = sourcePopup.cloneNode(true);
    view.classList.add('active', 'detached-settings');
    child.document.getElementById('settings-host').appendChild(view);
    const setSubtab = (name) => {
      const wanted = name || detachedSettingsViewState.subtab || view.querySelector('.__assist_subtabs .subtab.active')?.getAttribute('data-sub') || 'loot';
      detachedSettingsViewState.subtab = wanted;
      view.querySelectorAll('.__assist_subtabs .subtab').forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-sub') === wanted));
      view.querySelectorAll('.__assist_subpage').forEach(page => page.classList.toggle('active', page.getAttribute('data-sub') === wanted));
    };
    const setPage = (page, subtab = '') => {
      const wanted = (page || detachedSettingsViewState.page) === 'config' ? 'config' : 'stats';
      detachedSettingsViewState.page = wanted;
      view.querySelectorAll('#__assist_tabs .tab').forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-page') === wanted));
      view.querySelectorAll('.__assist_page').forEach(viewPage => viewPage.classList.toggle('active', viewPage.getAttribute('data-page') === wanted));
      if (wanted === 'config') setSubtab(subtab);
    };
    child.__roPureSelectPage = setPage;
    setPage(requestedPage, requestedSubtab);

    // The source form refreshes from CFG continuously, but focus inside this
    // child document is invisible to the source's focus tracker. Keep source
    // fields marked as editing while their cloned values are uncommitted.
    const detachedSettingsDirtyFields = new Set();
    const releaseDirtyFields = () => {
      detachedSettingsDirtyFields.forEach(id => {
        const source = root.querySelector('#' + id);
        if (source) editingInputs.delete(source);
      });
      detachedSettingsDirtyFields.clear();
    };
    const copyValueToSource = (field, eventType) => {
      if (!field.id) return;
      const source = root.querySelector('#' + field.id);
      if (!source || !('value' in source)) return;
      detachedSettingsDirtyFields.add(field.id);
      editingInputs.add(source);
      source.value = field.value;
      source.dispatchEvent(new Event(eventType, { bubbles: true }));
    };
    const copyAllValuesToSource = () => {
      view.querySelectorAll('input[id], select[id], textarea[id]').forEach(field => copyValueToSource(field, 'change'));
    };
    // A live output is intentionally leaf-like: copying it cannot replace a
    // form, tab structure, or a field the user may currently be editing.
    // This covers every current settings status panel (Skill/Buff/AB/Storage/
    // Nav/Telegram/Loot Queue) without a growing list of special cases.
    const isLiveOutput = (element) => {
      if (!element || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(element.tagName)) return false;
      if (element.matches('#__assist_popup, #__assist_tabs, .__assist_page, .__assist_subpage, .__assist_subtabs, .tab, .subtab')) return false;
      return !element.querySelector('input,select,textarea,button,.tab,.subtab,.__assist_page,.__assist_subpage');
    };
    const syncFromSource = () => {
      if (child.closed) return;
      // Statistics is display-only, so replacing just that page is safe and
      // keeps all live counters in the detached window current.
      const sourceStats = root.querySelector('.__assist_page[data-page="stats"]');
      const viewStats = view.querySelector('.__assist_page[data-page="stats"]');
      if (sourceStats && viewStats) viewStats.innerHTML = sourceStats.innerHTML;
      view.querySelectorAll('[id]').forEach(viewEl => {
        const sourceEl = root.querySelector('#' + viewEl.id);
        if (!sourceEl) return;
        const keepPendingValue = detachedSettingsDirtyFields.has(viewEl.id) || child.document.activeElement === viewEl;
        if ('value' in viewEl && 'value' in sourceEl && !keepPendingValue) viewEl.value = sourceEl.value;
        if (viewEl.tagName === 'BUTTON') { viewEl.textContent = sourceEl.textContent; viewEl.className = sourceEl.className; }
        if (isLiveOutput(viewEl) && isLiveOutput(sourceEl)) {
          viewEl.innerHTML = sourceEl.innerHTML;
          viewEl.className = sourceEl.className;
          viewEl.style.cssText = sourceEl.style.cssText;
        }
      });
    };
    view.addEventListener('input', event => copyValueToSource(event.target, 'input'));
    view.addEventListener('change', event => copyValueToSource(event.target, 'change'));
    view.addEventListener('click', event => {
      const pageTab = event.target.closest('#__assist_tabs .tab');
      if (pageTab) { event.preventDefault(); setPage(pageTab.getAttribute('data-page')); return; }
      const subtab = event.target.closest('.subtab');
      if (subtab) { event.preventDefault(); setSubtab(subtab.getAttribute('data-sub')); return; }
      const button = event.target.closest('button[id]');
      if (!button) return;
      event.preventDefault();
      copyAllValuesToSource();
      const sourceButton = root.querySelector('#' + button.id);
      if (sourceButton) sourceButton.click();
      setTimeout(() => { releaseDirtyFields(); syncFromSource(); }, 120);
    });
    child.document.getElementById('settings-close').addEventListener('click', () => child.close());
    if (detachedSettingsSyncTimer) clearInterval(detachedSettingsSyncTimer);
    detachedSettingsSyncTimer = setInterval(syncFromSource, 400);
    child.addEventListener('beforeunload', () => {
      if (detachedSettingsSyncTimer) clearInterval(detachedSettingsSyncTimer);
      detachedSettingsSyncTimer = null;
      releaseDirtyFields();
      detachedSettingsWindow = null;
    }, { once: true });
    syncFromSource();
    child.focus();
    log('⚙️ เปิด Settings ในหน้าต่างแยก');
    return true;
  }

  function buildUI() {
    const existing = document.getElementById('__assist_root');
    if (existing) return existing;   // สร้างแล้ว

    // ---------- CSS ----------
    const css = `
      #__assist_root, #__assist_root * { box-sizing: border-box; margin: 0; padding: 0; }
      #__assist_root {
        position: fixed; top: 10px; right: 10px; z-index: 2147483647;
        display: flex; flex-direction: column; align-items: flex-end;
        font-family: 'Segoe UI', 'Segoe UI Emoji', system-ui, 'Apple Color Emoji', sans-serif; font-size: 12px;
        color: #e8e8e8; user-select: none;
      }
      /* mini-bar */
      #__assist_bar {
        background: rgba(20,22,28,.92); border: 1px solid #3a3f4b; border-radius: 8px;
        padding: 5px 8px; display: flex; align-items: center; gap: 4px;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.4); transition: opacity .15s;
        max-width: 900px; flex-wrap: wrap; justify-content: flex-end;
      }
      #__assist_bar:hover { opacity: .85; }
      #__assist_bar .hpbar { width: 60px; height: 8px; background: #2a2d35; border-radius: 4px; overflow: hidden; }
      #__assist_bar .hpfill { height: 100%; background: linear-gradient(90deg,#e53935,#ef5350); transition: width .3s; }
      #__assist_bar .hpfill.warn { background: linear-gradient(90deg,#fb8c00,#ffa726); }
      #__assist_bar .hpfill.good { background: linear-gradient(90deg,#43a047,#66bb6a); }
      #__assist_bar .pill { font-size: 9px; padding: 1px 5px; border-radius: 8px; font-weight: 600; white-space: nowrap; }
      #__assist_bar .pill.on  { background: #1b5e20; color: #a5d6a7; }
      #__assist_bar .pill.off { background: #4a2020; color: #ef9a9a; }
      #__assist_bar .expand { color: #8ab4f8; font-weight: 700; }
      #__assist_bar .hud-action {
        background: #252b3a; border: 1px solid #3a3f4b; border-radius: 7px; color: #cdd3de;
        cursor: pointer; font-size: 13px; line-height: 1; padding: 4px 6px;
      }
      #__assist_bar .hud-action:hover { background: #34465a; color: #fff; }
      /* popup */
      #__assist_popup {
        display: none; margin-top: 6px; width: 340px; max-height: 70vh;
        background: rgba(20,22,28,.97); border: 1px solid #3a3f4b; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6); overflow: hidden; flex-direction: column;
      }
      #__assist_popup.open { display: flex; }
      #__assist_popup .popup-head {
        display:flex; align-items:center; gap:5px; padding:6px 8px;
        background:#15171c; border-bottom:1px solid #3a3f4b;
      }
      #__assist_popup .popup-head strong { color:#8ab4f8; font-size:12px; margin-right:auto; }
      #__assist_popup .popup-head button {
        min-width:26px; background:#2a3441; border:1px solid #3a3f4b; border-radius:5px;
        color:#e8e8e8; padding:3px 5px; cursor:pointer; font-size:10px; font-family:inherit;
      }
      #__assist_popup .popup-head button:hover { background:#34465a; }
      #__assist_popup .popup-head .zoom-value { min-width:36px; text-align:center; color:#9aa0a6; font-size:10px; font-variant-numeric:tabular-nums; }
      /* log window — เปิดจาก icon บน HUD */
      #__assist_logpopup {
        display: none; margin-top: 6px; width: 440px; height: 350px; min-width: 320px; min-height: 220px;
        max-width: calc(100vw - 20px); max-height: calc(100vh - 30px); resize: both;
        background: rgba(20,22,28,.97); border: 1px solid #3a3f4b; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6); overflow: hidden; flex-direction: column;
      }
      #__assist_logpopup.open { display: flex; }
      #__assist_logpopup .hdr {
        display: flex; align-items: center; gap: 5px; padding: 7px 9px;
        background: #15171c; border-bottom: 1px solid #3a3f4b;
      }
      #__assist_logpopup .ttl { color: #8ab4f8; font-size: 12px; font-weight: 700; margin-right: auto; }
      #__assist_logpopup button {
        background: #2a3441; border: 1px solid #3a3f4b; border-radius: 5px; color: #e8e8e8;
        padding: 4px 7px; cursor: pointer; font-size: 11px; font-family: inherit;
      }
      #__assist_logpopup button:hover { background: #34465a; }
      #__assist_logpopup button.on { background: #1b5e20; border-color: #2e7d32; }
      /* log popup อยู่นอก .__assist_page จึงต้องประกาศ scroll/selection เอง
         (root ตั้ง user-select:none ไว้เพื่อ HUD แต่ log ต้องลาก copy ได้) */
      #__assist_logpopup .logbox, #__assist_alertpopup .logbox {
        flex: 1; min-height: 0; margin: 8px; padding: 6px;
        background: #0f1115; border: 1px solid #2a2d35; border-radius: 5px;
        overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
        font-family: 'Consolas', monospace; font-size: 10.5px; line-height: 1.5;
        user-select: text; -webkit-user-select: text; cursor: text; touch-action: pan-y;
      }
      #__assist_logpopup .logline, #__assist_alertpopup .logline {
        color: #b0b0b0; padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,.03);
        white-space: pre-wrap; word-break: break-word; user-select: text; -webkit-user-select: text;
      }
      #__assist_logpopup .logline .ts, #__assist_alertpopup .logline .ts { color: #5f6368; }
      #__assist_logpopup .btns { display: flex; gap: 6px; padding: 0 8px 8px; }
      #__assist_logpopup .btns button { flex: 1; }
      #__assist_logpopup.expanded { width: 820px; height: 72vh; }
      /* important-alert window — เปิดจาก icon บน HUD */
      #__assist_alertpopup {
        display: none; margin-top: 6px; width: 440px; height: 320px; min-width: 320px; min-height: 200px;
        max-width: calc(100vw - 20px); max-height: calc(100vh - 30px); resize: both;
        background: rgba(20,22,28,.97); border: 1px solid #3a3f4b; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6); overflow: hidden; flex-direction: column;
      }
      #__assist_alertpopup.open { display: flex; }
      #__assist_alertpopup .hdr {
        display: flex; align-items: center; padding: 7px 9px;
        background: #15171c; border-bottom: 1px solid #3a3f4b;
      }
      #__assist_alertpopup .ttl { color: #f1c40f; font-size: 12px; font-weight: 700; margin-right: auto; }
      #__assist_alertpopup button {
        background: #2a3441; border: 1px solid #3a3f4b; border-radius: 5px; color: #e8e8e8;
        padding: 4px 7px; cursor: pointer; font-size: 11px; font-family: inherit;
      }
      #__assist_alertpopup button:hover { background: #34465a; }
      #__assist_alertpopup .btns { display: flex; padding: 0 8px 8px; }
      #__assist_alertpopup .btns button { flex: 1; }
      #__assist_tabs { display: flex; background: #15171c; border-bottom: 1px solid #3a3f4b; }
      #__assist_tabs .tab {
        flex: 1; padding: 8px 4px; text-align: center; cursor: pointer; font-size: 11px;
        color: #9aa0a6; border-bottom: 2px solid transparent;
      }
      #__assist_tabs .tab:hover { background: rgba(255,255,255,.04); }
      #__assist_tabs .tab.active { color: #8ab4f8; border-bottom-color: #8ab4f8; }
      .__assist_page { display: none; padding: 10px; overflow-y: auto; }
      .__assist_page.active { display: block; }
      .__assist_page .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
      .__assist_page .row .k { color: #9aa0a6; }
      .__assist_page .row .v { color: #e8e8e8; font-weight: 600; }
      .__assist_page h4 { margin: 8px 0 4px; color: #8ab4f8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
      .__assist_page .field { margin: 6px 0; }
      .__assist_page .field label { display: block; color: #9aa0a6; font-size: 10px; margin-bottom: 2px; }
      .__assist_page .field input, .__assist_page .field select {
        width: 100%; background: #15171c; border: 1px solid #3a3f4b; border-radius: 5px;
        color: #e8e8e8; padding: 5px 7px; font-size: 12px; font-family: inherit;
      }
      .__assist_page .field input:focus, .__assist_page .field select:focus { outline: none; border-color: #8ab4f8; }
      .__assist_page .btns { display: flex; gap: 6px; margin-top: 8px; }
      .__assist_page button {
        flex: 1; background: #2a3441; border: 1px solid #3a3f4b; border-radius: 5px;
        color: #e8e8e8; padding: 6px; cursor: pointer; font-size: 11px; font-family: inherit;
      }
      .__assist_page button:hover { background: #34465a; }
      .__assist_page button.on  { background: #1b5e20; border-color: #2e7d32; }
      .__assist_page button.off { background: #4a2020; border-color: #6a3030; }
      .__assist_page button.danger { background: #4a2020; }
      .__assist_page .logbox {
        background: #0f1115; border: 1px solid #2a2d35; border-radius: 5px; padding: 6px;
        height: 240px; overflow-y: auto; font-family: 'Consolas', monospace; font-size: 10.5px; line-height: 1.5;
      }
      .__assist_page .logline { color: #b0b0b0; padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,.03); white-space: pre-wrap; word-break: break-word; }
      .__assist_page .logline .ts { color: #5f6368; }
      /* ===== sub-tabs (ใน config page) ===== */
      .__assist_subtabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid #3a3f4b; margin-bottom: 8px; padding-bottom: 0; }
      .__assist_subtabs .subtab { padding: 7px 12px; font-size: 11px; cursor: pointer; color: #9aa0a6; border-bottom: 2px solid transparent; border-radius: 3px 3px 0 0; white-space: nowrap; }
      .__assist_subtabs .subtab:hover { background: rgba(255,255,255,.04); color: #cdd3de; }
      .__assist_subtabs .subtab.active { color: #8ab4f8; border-bottom-color: #8ab4f8; }
      .__assist_subpage { display: none; }
      .__assist_subpage.active { display: block; }
      .__assist_dead { animation: __assist_blink 1s infinite; }
      @keyframes __assist_blink { 50% { opacity: .4; } }
      /* ===== item-list popup + skill popup (รวม CSS) ===== */
      #__assist_itempopup, #__assist_skillpopup {
        position: fixed; inset: 0; z-index: 2147483648;
        background: rgba(0,0,0,.5); display: none; align-items: center; justify-content: center;
      }
      #__assist_itempopup.open, #__assist_skillpopup.open { display: flex; }
      #__assist_itempopup .modal, #__assist_skillpopup .modal {
        background: rgba(20,22,28,.98); border: 1px solid #3a3f4b; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.7); width: 480px; max-width: 92vw; max-height: 80vh;
        display: flex; flex-direction: column; overflow: hidden; color: #e8e8e8;
        font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px;
      }
      #__assist_itempopup .modal .hdr {
        padding: 10px 14px; background: #15171c; border-bottom: 1px solid #3a3f4b;
        display: flex; justify-content: space-between; align-items: center;
      }
      #__assist_itempopup .modal .hdr .ttl { color: #8ab4f8; font-weight: 600; font-size: 13px; }
      #__assist_itempopup .modal .hdr .x { cursor: pointer; color: #9aa0a6; font-size: 18px; line-height: 1; padding: 0 4px; }
      #__assist_itempopup .modal .hdr .x:hover { color: #ef5350; }
      #__assist_itempopup .modal .searchbar { padding: 8px 14px; border-bottom: 1px solid #2a2d35; display: flex; gap: 8px; }
      #__assist_itempopup .modal .searchbar input {
        flex: 1; background: #15171c; border: 1px solid #3a3f4b; border-radius: 5px;
        color: #e8e8e8; padding: 5px 8px; font-size: 12px; font-family: inherit;
      }
      #__assist_itempopup .modal .searchbar input:focus { outline: none; border-color: #8ab4f8; }
      #__assist_itempopup .modal .body { overflow-y: auto; flex: 1; padding: 6px 8px; }
      #__assist_itempopup .itemrow {
        display: flex; align-items: center; gap: 8px; padding: 5px 6px;
        border-bottom: 1px solid rgba(255,255,255,.04); border-radius: 4px;
      }
      #__assist_itempopup .itemrow:hover { background: rgba(255,255,255,.04); }
      #__assist_itempopup .itemrow img { width: 22px; height: 22px; flex-shrink: 0; }
      #__assist_itempopup .itemrow .nm { flex: 1; font-size: 11px; color: #e8e8e8; }
      #__assist_itempopup .itemrow .id { font-size: 10px; color: #5f6368; font-family: 'Consolas', monospace; }
      #__assist_itempopup .itemrow .price { font-size: 10px; color: #f1c40f; }
      #__assist_itempopup .itemrow .addbtn, #__assist_itempopup .itemrow .rmbtn {
        background: #2a3441; border: 1px solid #3a3f4b; border-radius: 4px; color: #e8e8e8;
        cursor: pointer; font-size: 11px; padding: 3px 10px; font-family: inherit; flex-shrink: 0;
      }
      #__assist_itempopup .itemrow .addbtn:hover { background: #1b5e20; border-color: #2e7d32; }
      #__assist_itempopup .itemrow .rmbtn { background: #4a2020; border-color: #6a3030; }
      #__assist_itempopup .itemrow .rmbtn:hover { background: #6a3030; }
      #__assist_itempopup .empty { padding: 20px; text-align: center; color: #5f6368; font-size: 11px; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ---------- DOM ----------
    const root = document.createElement('div');
    root.id = '__assist_root';
    root.innerHTML = `
      <div id="__assist_bar">
        <span class="hptext">HP ?</span>
        <div class="hpbar"><div class="hpfill" style="width:0%"></div></div>
        <span class="pill on" data-masterbot title="หยุด/เริ่ม automation ทั้งหมด โดยไม่เปลี่ยนค่ารายระบบ">⏻ BOT: ON</span>
        <span class="pill off" data-loot>📦 Loot</span>
        <span class="pill off" data-heal>💉 Heal</span>
        <span class="pill off" data-rest>🪑 Rest</span>
        <span class="pill off" data-combat>⚔️ Combat</span>
        <span class="pill off" data-weapon title="Weapon Set">🗡️ Weapon</span>
        <span class="pill off" data-skill>🔮 Skill</span>
        <span class="pill off" data-buff>✨ Buff</span>
        <span class="pill off" data-abbuff title="คลิกเพื่อเปิด/ปิดระบบ AB Buff">⛪ AB Buff</span>
        <span class="pill off" data-sell>💰 Sell</span>
        <span class="pill off" data-storage>🏦 Kafra</span>
        <span class="pill off" data-auto title="เปิดแท็บ Auto Login / Auto Refresh">🤖 Auto</span>
        <span class="pill" data-teleport style="background:#4a2c6a;color:#d1b3ff">🌀</span>
        <span class="pill" data-monitor style="background:#1a237e;color:#90caf9">🖥️</span>
        <span class="pill" data-remote style="background:#1a3a1a;color:#81c784;display:none">🌐</span>
        <span class="hud-action" data-alert title="เปิด Log สำคัญ">🔔</span>
        <span class="hud-action" data-log title="เปิด Activity Log">📋</span>
        <span class="hud-action" data-debug title="เปิด Debug Log">🔍</span>
        <span class="expand" data-settingswindow title="เปิด Settings บน HUD">⚙</span>
      </div>
      <div id="__assist_popup">
        <div class="popup-head">
          <strong>⚙ RO Rebuild Pure</strong>
          <button id="__assist_fontdown" title="ลดขนาดตัวอักษร">A−</button>
          <span class="zoom-value" id="__assist_fontvalue">115%</span>
          <button id="__assist_fontup" title="เพิ่มขนาดตัวอักษร">A+</button>
          <button id="__assist_popupclose" title="ปิด Settings">✕</button>
        </div>
        <div id="__assist_tabs">
          <div class="tab active" data-page="stats">📊 สถิติ</div>
          <div class="tab" data-page="config">⚙️ ตั้งค่า</div>
        </div>
        <div class="__assist_page active" data-page="stats">
          <div class="row" style="border-bottom:2px solid #3a3f4b;">
            <span class="k">RO Rebuild Pure</span>
            <span class="v" data-version>v?</span>
          </div>
          <div class="row"><span class="k">HP</span><span class="v" data-hp>?</span></div>
          <div class="row"><span class="k">ตำแหน่ง</span><span class="v" data-pos>?</span></div>
          <div class="row"><span class="k">🗺️ แมป / ฟาร์ม</span><span class="v" data-farmmap>?</span></div>
          <div class="row"><span class="k">player_id</span><span class="v" data-pid>?</span></div>
          <div class="row"><span class="k">สถานะ</span><span class="v" data-state>?</span></div>
          <div class="row"><span class="k">🌐 Remote Monitor</span><span class="v" data-relay style="color:#9aa0a6">?</span></div>
          <h4>การฟาร์ม</h4>
          <div class="row"><span class="k">ฆ่าได้</span><span class="v" data-kills>0</span></div>
          <div class="row"><span class="k">เก็บของได้</span><span class="v" data-looted>0</span></div>
          <div class="row"><span class="k">💰 ยอด zeny (session)</span><span class="v" data-zeny style="color:#f1c40f">0z</span></div>
          <div class="row"><span class="k">EXP รวม</span><span class="v" data-exp>0</span></div>
          <div class="row"><span class="k">EXP/นาที</span><span class="v" data-expmin>0</span></div>
          <div class="row"><span class="k">⚔️ Damage/วิ (10วิ)</span><span class="v" data-dps style="color:#e67e22">0</span></div>
          <div class="row"><span class="k">⚡ โจมตี/วิ (ASPD)</span><span class="v" data-aspd style="color:#3498db">0</span></div>
          <div class="row"><span class="k">💰 Zeny/ชม. (5นาที)</span><span class="v" data-goldrate style="color:#f1c40f">0z</span></div>
          <div class="row"><span class="k">เวลาทำงาน</span><span class="v" data-elapsed>0s</span></div>
          <div class="row"><span class="k">ตาย</span><span class="v" data-deaths>0</span></div>
          <h4>Combat</h4>
          <div class="row"><span class="k">เป้าหมาย</span><span class="v" data-combat-target>(none)</span></div>
          <div class="row"><span class="k">มอน (ตี/aggro/รอบ)</span><span class="v" data-combat-aggro>0 / 0 / 0</span></div>
          <div class="row"><span class="k">🗡️ Weapon Set</span><span class="v" data-weaponstate>OFF</span></div>
          <div class="row"><span class="k">🎒 Inventory</span><span class="v" data-inventory>?</span></div>
          <div class="row"><span class="k">💰 Sell</span><span class="v" data-sellstate>OFF</span></div>
          <div class="row"><span class="k">🏦 Storage</span><span class="v" data-storagestate>OFF</span></div>
          <h4>ของที่เก็บได้ (ล่าสุด)</h4>
          <div data-items style="font-size:11px;color:#9aa0a6">(ยังไม่มี)</div>
          <div class="btns"><button class="primary" id="__assist_sellnow2">💰 ไปขายของ</button><button class="danger" id="__assist_clearinv">ล้างรายการของ</button><button class="danger" id="__assist_resetstats">รีเซ็ตสถิติ</button></div>
        </div>
        <div class="__assist_page" data-page="config">
          <div class="__assist_subtabs">
            <div class="subtab" data-sub="farm">🗺️ Farm</div>
            <div class="subtab" data-sub="combat">⚔️ Combat</div>
            <div class="subtab" data-sub="weapon">🗡️ Weapon</div>
            <div class="subtab active" data-sub="loot">📦 Loot</div>
            <div class="subtab" data-sub="skill">🔮 Skill</div>
            <div class="subtab" data-sub="buff">✨ Buff</div>
            <div class="subtab" data-sub="abbuff">⛪ AB Buff</div>
            <div class="subtab" data-sub="heal">💉 Heal</div>
            <div class="subtab" data-sub="flee">🏃 Flee</div>
            <div class="subtab" data-sub="rest">🪑 Rest</div>
            <div class="subtab" data-sub="sell">💰 Sell</div>
            <div class="subtab" data-sub="storage">🏦 Storage</div>
            <div class="subtab" data-sub="auto">🤖 Auto</div>
            <div class="subtab" data-sub="aireply">💬 AI Chat</div>
            <div class="subtab" data-sub="replytemplates">📝 Template</div>
            <div class="subtab" data-sub="misc">⚙️ อื่นๆ</div>
            <div class="subtab" data-sub="telegram">📨 Telegram</div>
          </div>
          <!-- 🗺️ Farm -->
          <div class="__assist_subpage" data-sub="farm">
            <div class="btns">
              <button id="__assist_warptofarm" class="primary">🌀 วาร์ปไปแมปฟาร์ม</button>
              <button id="__assist_t_warpback" class="on">วาร์ปกลับอัตโนมัติ</button>
            </div>
            <div class="field"><label>ชื่อแมปฟาร์ม</label><input type="text" id="__assist_farmmap" placeholder="เช่น cmd_fild01 (ว่าง=ปิด)"></div>
            <div class="field"><label>พิกัดวาร์ป X</label><input type="number" id="__assist_farmx" placeholder="-999"><label style="margin-left:8px">Y</label><input type="number" id="__assist_farmy" placeholder="-999"><button id="__assist_usefarmpos" style="margin-left:8px;font-size:10px">ใช้พิกัดตัวละคร</button></div>
            <div class="btns"><button id="__assist_applyfarm">ใช้ค่า farm map</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ วิธีใช้: ยืนในแมปฟาร์ม → กด 'ใช้พิกัดตัวละคร' → ใช้ค่า farm map<br>★ ว่างช่องชื่อแมป = ปิดฟีเจอร์</div>
          </div>
          <!-- ⚔️ Combat -->
          <div class="__assist_subpage" data-sub="combat">
            <div class="btns"><button id="__assist_combatbtn" class="off">Combat: ?</button></div>
            <div class="field"><label>มอนที่จะตี — whitelist (ชื่อหรือ sprite id, คั่นจุลภาค) — ว่าง = ตีทุกมอน</label><input type="text" id="__assist_whitelist" placeholder="เช่น Poring,Lunatic หรือ 4000,1010"></div>
            <div class="field"><label>มอนที่จะไม่ตี — blacklist</label><input type="text" id="__assist_blacklist" placeholder="เช่น MVP,Boss"></div>
            <div class="btns"><button id="__assist_applywhitelist">ตั้ง whitelist</button><button id="__assist_applyblacklist">ตั้ง blacklist</button></div>
            <div class="field"><label>มอนที่รอเมื่อซ่อน/หาย — hidden wait (ชื่อหรือ sprite id, คั่นจุลภาค)</label><input type="text" id="__assist_hiddenwaitmonsters" placeholder="เช่น Sleeper"></div>
            <div class="field"><label>รอมอนกลับมาก่อน abandon (วินาที)</label><input type="number" id="__assist_hiddenwaitsec" min="1" max="30" step="0.5"></div>
            <div class="btns"><button id="__assist_t_hiddensight" class="on">👁️ Sight เมื่อมอนซ่อน</button></div>
            <div id="__assist_hiddensightstatus" style="font-size:10px;color:#9aa0a6;margin-top:-3px;line-height:1.45">ใช้ Sight เฉพาะเมื่อมอนใน hidden wait ใช้ Cloaking จริง · ระยะ 3 ช่อง</div>
            <div class="field"><label>ระยะโจมตี (ช่อง) — นักธนูตั้ง >2 เพื่อตีไกล</label><input type="number" id="__assist_attackrange" min="0" max="15"></div>
            <div class="btns">
              <button id="__assist_t_antiks" class="on">antiKS</button>
              <button id="__assist_t_avoidp" class="on">avoidPlayers</button>
              <button id="__assist_t_lowhp" class="on">lowestHP</button>
            </div>
            <div class="field"><label>antiKS จำการตีของคนอื่น (ms) / ระยะกันผู้เล่นใกล้มอน (ช่อง)</label><input type="number" id="__assist_antikswindow" min="0" max="30000" step="100"><input type="number" id="__assist_avoidplayerradius" min="0" max="30" step="1"></div>
            <div class="field"><label>หลังวาร์ปรอข้อมูลรอบตัวก่อนหาเป้า (ms)</label><input type="number" id="__assist_postwarpsettle" min="0" max="3000" step="100"></div>
            <div class="field"><label>Combat GAT route ไม่คืบ (ms) — ครบเวลาแล้ววาร์ปไปหามอน (500–15000)</label><input type="number" id="__assist_combatgatprogresstimeout" min="500" max="15000" step="100"></div>
            <div class="btns">
              <button id="__assist_t_wander" class="on">เดินหามอน</button>
              <button id="__assist_t_warpfind" class="off">วาร์ปหามอน</button>
              <button id="__assist_t_warptomon" class="off">วาร์ปไปหามอนที่ตี</button>
            </div>
            <div class="field"><label>stuck abandon N ครั้งใน 60s → วาร์ปสุ่ม (0=ปิด)</label><input type="number" id="__assist_stuckwarp" min="0" max="20"></div>
            <div class="btns">
              <button id="__assist_t_warptoboss" class="off">👹 วาร์ปไปสู้ Mini Boss</button>
            </div>
            <div class="btns"><button id="__assist_applycombat">ใช้ค่า combat</button></div>
          </div>
          <!-- 🗡️ Weapon Set -->
          <div class="__assist_subpage" data-sub="weapon">
            <div id="__assist_weaponeditor" style="font-size:11px;color:#e8e8e8"></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:7px;line-height:1.5">★ บอทจะเปลี่ยน Set ก่อนส่ง Attack และรอ packet 0x30 จาก server ก่อนจึงอนุญาต Skill/Steal/Attack<br>★ Default Set ใช้กับมอนที่ไม่ตรง Rule; left hand เลือกได้: ไม่เปลี่ยน / ล้าง / สวม</div>
          </div>
          <!-- 📦 Loot -->
          <div class="__assist_subpage active" data-sub="loot">
            <div class="btns">
              <button id="__assist_lootbtn" class="on">Loot: ?</button>
            </div>
            <div class="field"><label>โหมด loot</label><select id="__assist_lootmode"><option value="all">all (เก็บหมด)</option><option value="only">only (เก็บเฉพาะ)</option><option value="except">except (ยกเว้น)</option></select></div>
            <div class="btns">
              <button id="__assist_manageonly">📋 จัดการ 'เก็บเฉพาะ'</button>
              <button id="__assist_manageexcept">📋 จัดการ 'ยกเว้น'</button>
            </div>
            <div class="field"><label>ดีเลย์ก่อนเก็บ (ms หลังของตก) — 0 = เก็บทันที</label><input type="number" id="__assist_lootdelay" min="0" step="100"></div>
            <div class="field"><label>รอรับ drop หลังฆ่า (ms) — ระหว่างนี้เก็บของก่อน ไม่ตีเป้าใหม่</label><input type="number" id="__assist_lootsettle" min="0" step="100"></div>
            <div class="field"><label>ดีเลย์ระหว่างเก็บชิ้นต่อไป (ms) — ห่างระหว่าง pickup แต่ละครั้ง</label><input type="number" id="__assist_lootthrottle" min="100" step="100"></div>
            <div class="field"><label>เช็คของใกล้พิกัดมอนที่ฆ่า (ช่อง) — นักธนูยิงไกล → ของตกที่มอน</label><input type="number" id="__assist_pickradiuskill" min="1" max="20" placeholder="5"></div>
            <div class="btns"><button id="__assist_applylootdelay">ตั้งดีเลย์</button><button id="__assist_t_lootkillpos" class="on">เช็คพิกัดมอนที่ฆ่า</button></div>
            <h4>📮 Loot Queue <span id="__assist_lootqueuestatus" style="font-size:10px;font-weight:400;color:#9aa0a6"></span></h4>
            <div class="field"><label>หน้าที่ไอดีนี้</label><select id="__assist_lootqueuerole"><option value="off">ปิด</option><option value="farm">ฟาร์ม — ส่ง drop เข้าคิว</option><option value="collector">เก็บ — รับงานจากคิว</option></select></div>
            <div class="field"><label>เส้นทางคิว</label><select id="__assist_lootqueuetransport"><option value="local">Localhost — 2 ไอดีบนเครื่องเดียวกัน (แนะนำ)</option><option value="cloudflare">Cloudflare — ใช้ข้ามเครื่อง</option></select></div>
            <div class="btns"><button id="__assist_lootqueuesendall" class="off">📦 ส่งทุกอย่าง: OFF</button><button id="__assist_managequeueitems">📋 รายการไอเทมพิเศษ</button><button id="__assist_lootqueuereconnect">🔌 ต่อใหม่</button></div>
            <div class="field" data-lootqueue-transport="local"><label>Localhost WebSocket URL</label><input type="text" id="__assist_lootqueuelocalurl" placeholder="ws://127.0.0.1:8787"></div>
            <div class="field" data-lootqueue-transport="cloudflare"><label>Cloudflare WebSocket URL (เก็บใน browser นี้ · ไม่แสดงใน log)</label><input type="password" id="__assist_lootqueuecloudflareurl" placeholder="wss://...workers.dev/?token=..."></div>
            <div class="field"><label>กลุ่มคิว (ทั้ง 2 ไอดีต้องตรงกัน)</label><input type="text" id="__assist_lootqueuegroup" placeholder="default"></div>
            <div class="field"><label>จุดรอ collector: map / X / Y</label><div style="display:flex;gap:6px"><input type="text" id="__assist_lootqueuehomemap" placeholder="prontera"><input type="number" id="__assist_lootqueuehomex" placeholder="150"><input type="number" id="__assist_lootqueuehomey" placeholder="150"></div></div>
            <div class="field"><label>รอหลังรับงานก่อนวาร์ป (ms) — ใช้เฉพาะเมื่ออยู่จุดรอ/เมือง (0=ทันที)</label><input type="number" id="__assist_lootqueueclaimdelay" min="0" max="30000" step="500" placeholder="5000"></div>
            <div class="field"><label>รอหลังทิ้งงานก่อนหา job ถัดไป (ms) — FAIL/เงียบครบ retry; เก็บสำเร็จจะต่อคิวทันที</label><input type="number" id="__assist_lootqueuesettle" min="0" max="10000" step="250" placeholder="1000"></div>
            <div class="field"><label>ดีเลย์ก่อนวาร์ป job ถัดไป (ms) — 0=วาร์ปทันที; ใช้เฉพาะ loot queue</label><input type="number" id="__assist_lootqueuewarpcooldown" min="0" max="10000" step="100" placeholder="0"></div>
            <div class="field"><label>retry pickup หลังวาร์ป (ครั้ง) — รอผลทีละคำสั่งก่อน retry; นับเพิ่มจากคำสั่งแรก</label><input type="number" id="__assist_lootqueuepickupretries" min="0" max="5" step="1" placeholder="2"></div>
            <div class="field"><label>รอผล pickup แต่ละครั้ง (ms) — ครบเวลาแล้ว retry; retry ครบจึงทิ้งงาน</label><input type="number" id="__assist_lootqueuetimeout" min="1000" max="30000" step="500" placeholder="1000"></div>
            <div class="btns"><button id="__assist_applylootqueue">บันทึก Loot Queue</button><button id="__assist_lootqueuehomecurrent">ใช้พิกัดปัจจุบันเป็นจุดรอ</button></div>
            <div id="__assist_lootqueuecurrent" style="font-size:10px;color:#9aa0a6;margin:5px 0 4px">ไม่มีงานที่กำลังเก็บ</div>
            <div class="btns"><button id="__assist_lootqueuenext" class="off" disabled title="ไม่มี drop ที่กำลังเก็บ">⏭ ข้ามงานปัจจุบัน</button></div>
            <h4>🌀 Warp-to-Loot (วาร์ปไปเก็บของที่ติดกำแพง)</h4>
            <div class="btns"><button id="__assist_warpbtn" class="off">วาร์ปไปเก็บของ: ?</button></div>
          </div>
          <!-- 🔮 Skill -->
          <div class="__assist_subpage" data-sub="skill">
            <div class="btns">
              <button id="__assist_skillbtn" class="off">Skill: ?</button>
              <button id="__assist_skillnow" class="primary">ใช้ skill เดี๋ยวนี้</button>
              <button id="__assist_manageskill">📋 จัดการ skill</button>
            </div>
            <div class="field"><label>เว้นระหว่างสกิลคนละชนิด (ms) — Steal ซ้ำใช้ cooldown ของ Steal เอง</label><input type="number" id="__assist_skillgap" min="250" max="5000" step="50" placeholder="1500"></div>
            <div class="btns"><button id="__assist_applyskillgap">บันทึก Skill Gap</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ บัพตัวเอง Blessing / Agility / Kyrie เช็ค status จาก server และใช้เรียงตาม list; สกิลอื่นใช้ cooldown fallback</div>
            <div id="__assist_skillcountdown" style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.6">(ยังไม่ตั้ง skill)</div>
          </div>
          <!-- ✨ Buff -->
          <div class="__assist_subpage" data-sub="buff">
            <div class="btns">
              <button id="__assist_buffbtn" class="off">Buff: ?</button>
              <button id="__assist_buffnow" class="primary">ใช้ buff เดี๋ยวนี้</button>
            </div>
            <div class="field"><label>buff: itemId,ทุกกี่นาที (คั่นบรรทัด เช่น 656,30) — เพิ่มได้หลายตัว</label><textarea id="__assist_buffitems" rows="3" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:'Consolas',monospace;resize:vertical" placeholder="656,30&#10;645,30"></textarea></div>
            <div class="btns"><button id="__assist_applybuff">ใช้ค่า buff</button><button id="__assist_clearbufftimes">รีเซ็ต countdown</button></div>
            <div id="__assist_buffcountdown" style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.6">(ยังไม่ตั้ง buff)</div>
          </div>
          <!-- ⛪ AB Buff -->
          <div class="__assist_subpage" data-sub="abbuff">
            <div class="btns"><button id="__assist_abbuffbtn" class="off">AB Buff: OFF</button></div>
            <div class="field"><label>แผนที่รับ Increase Agility + Blessing</label><input type="text" id="__assist_abbuffmap" placeholder="prontera"></div>
            <div class="field"><label>พิกัดรับบัพ X / Y</label><div style="display:flex;gap:6px"><input type="number" id="__assist_abbuffx" placeholder="148"><input type="number" id="__assist_abbuffy" placeholder="28"></div></div>
            <div class="field"><label>รอรับบัพสูงสุด (วินาที)</label><input type="number" id="__assist_abbufftimeout" min="30" max="900" placeholder="180"></div>
            <div class="field"><label>ยืนรอหลังได้บัพครบ (วินาที)</label><input type="number" id="__assist_abbuffreturndelay" min="0" max="60" step="0.5" placeholder="3"><small>0 = วาร์ปกลับทันที</small></div>
            <div class="btns"><button id="__assist_applyabbuff">ใช้ค่ารับบัพ</button><button id="__assist_abbuffnow" class="primary">รับบัพทันที</button></div>
            <div class="row"><span class="k">สถานะ AB Buff</span><span class="v" data-abbuffstate>?</span></div>
            <div class="row"><span class="k">Increase Agility</span><span class="v" data-abbuffagi>?</span></div>
            <div class="row"><span class="k">Blessing</span><span class="v" data-abbuffblessing>?</span></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.5">เมื่อบัพขาด → ไปจุดนี้, ส่ง emote /hp ×2 แล้ว /lv ×2 ห่างกัน 5 วิหนึ่งรอบ จากนั้นรอ status; ถ้ายังไม่ครบจน timeout จะกลับฟาร์มและปิด AB Buff</div>
          </div>
          <!-- 💉 Heal -->
          <div class="__assist_subpage" data-sub="heal">
            <div class="btns">
              <button id="__assist_healbtn" class="off">Heal: ?</button>
            </div>
            <div class="field"><label>HP% เริ่มใช้ยา (healAt)</label><input type="number" id="__assist_healat" min="1" max="100"></div>
            <div class="field"><label>item id ที่จะใช้ heal (คั่นด้วยจุลภาค)</label><input type="text" id="__assist_healitems" placeholder="เช่น 501,502,503"></div>
            <div class="btns"><button id="__assist_applyheal">ใช้ค่า heal</button></div>
            <div class="field"><label>โหมด heal</label><select id="__assist_healmode"><option value="order">order (ใช้ตัวเดิมจนหมด)</option><option value="random">random (สุ่ม)</option></select></div>
          </div>
          <!-- 🏃 Flee -->
          <div class="__assist_subpage" data-sub="flee">
            <div class="field"><label>flee: รุม N ตัว (0=off)</label><input type="number" id="__assist_fleemob" min="0" max="20"></div>
            <div class="field"><label>flee: aggro N ตัว (0=off)</label><input type="number" id="__assist_fleeaggro" min="0" max="20"></div>
            <div class="field"><label>flee: มอนรอบ N ตัว ในระยะ (0=off)</label><input type="number" id="__assist_fleeprox" min="0" max="20"></div>
            <h4>👤 Flee ผู้เล่น</h4>
            <div class="btns"><button id="__assist_t_fleeplayer" class="off">Flee Player: OFF</button></div>
            <div class="field"><label>ระยะตรวจผู้เล่น (ช่อง)</label><input type="number" id="__assist_fleeplayerradius" min="1" max="50" placeholder="30"></div>
            <div class="field"><label>รอก่อนวาร์ปเมื่อเจอผู้เล่น (วินาที, 0=ทันที)</label><input type="number" id="__assist_fleeplayerdelay" min="0" max="10" step="0.5" placeholder="3"></div>
            <div class="field"><label>ชื่อผู้เล่นที่ไม่ต้องหนี (คั่นด้วยจุลภาค)</label><input type="text" id="__assist_fleeplayerexceptions" placeholder="เช่น FriendA, PartyMember"></div>
            <h4>👑 Flee MVP / Boss</h4>
            <div class="btns"><button id="__assist_t_fleemvp" class="off">Flee MVP/Boss: OFF</button></div>
            <div class="field"><label>ระยะตรวจ MVP/Boss (ช่อง)</label><input type="number" id="__assist_fleemvpradius" min="1" max="100" placeholder="20"></div>
            <div class="field"><label>🚨 มอนที่ต้องหนี (ชื่อหรือ sub-ID คั่นจุลภาค) — เจอในระยะ → วาร์ปหนี</label><input type="text" id="__assist_fleemonsters" placeholder="เช่น MVP,Boss,1234"></div>
            <div class="field"><label>ระยะหนีมอนอันตราย (ช่อง)</label><input type="number" id="__assist_fleemonsterradius" min="1" max="50" placeholder="20"></div>
            <div class="btns"><button id="__assist_applyflee">ใช้ค่า flee</button></div>
          </div>
          <!-- 🪑 Rest -->
          <div class="__assist_subpage" data-sub="rest">
            <div class="btns"><button id="__assist_restbtn" class="off">Rest: ?</button></div>
            <div class="field"><label>HP% ที่จะนั่งพัก (ต่ำกว่านี้ → นั่ง)</label><input type="number" id="__assist_resthp" min="1" max="99"></div>
            <div class="field"><label>HP% ที่จะลุกยืน (ฟื้นถึงนี้ → ลุก)</label><input type="number" id="__assist_restuntil" min="1" max="100"></div>
            <div class="field"><label>นั่งนานสุด (วินาที) — กันค้าง</label><input type="number" id="__assist_restmaxsec" min="5" max="300"></div>
            <div class="btns"><button id="__assist_applyrest">ใช้ค่า rest</button></div>
            <h4>💀 Auto-Respawn (เกิดใหม่อัตโนมัติเมื่อตาย)</h4>
            <div class="btns"><button id="__assist_respawnbtn" class="on">Respawn: ?</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ ตาย → respawn กลับจุด save → นั่งพักจนเลือดเต็ม → กลับฟาร์ม</div>
          </div>
          <!-- 💰 Sell -->
          <div class="__assist_subpage" data-sub="sell">
            <div class="btns">
              <button id="__assist_sellbtn" class="off">Sell: ?</button>
              <button id="__assist_sellnow" class="danger">ขายเดี๋ยวนี้</button>
            </div>
            <div class="field"><label>ชื่อ NPC ขายของ</label><input type="text" id="__assist_sellnpc" placeholder="เช่น Tool Dealer"></div>
            <div class="field"><label>แมปที่ NPC อยู่</label><input type="text" id="__assist_sellmap" placeholder="เช่น izlude_in"></div>
            <div class="field"><label>พิกัดวาร์ป X</label><input type="number" id="__assist_sellx" placeholder="114"><label style="margin-left:8px">Y</label><input type="number" id="__assist_selly" placeholder="49"><button id="__assist_useselfpos" style="margin-left:8px;font-size:10px">ใช้พิกัดตัวละคร</button></div>
            <div class="field"><label>ขายทุก N นาที (0=off)</label><input type="number" id="__assist_sellinterval" min="0" max="999"></div>
            <div class="btns"><button id="__assist_applysell">ใช้ค่า sell</button><button id="__assist_t_sellfull" class="on">ขายตอนเต็ม</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ เลือก item ที่จะขาย/ฝาก: กดปุ่มสีที่รายการของในสถิติ — วน เก็บ(เทา)→ขาย(ส้ม)→ฝาก(เขียว)→เก็บ</div>
            <h4>⛏️ ย่อย Great Nature แล้วขาย Green Live</h4>
            <div class="btns"><button id="__assist_orerefinenow" class="primary">เริ่มย่อย/ขายเดี๋ยวนี้</button><button id="__assist_orerefinestop" class="danger">หยุดงาน</button></div>
            <div id="__assist_orerefinestate" style="font-size:10px;color:#9aa0a6;margin:3px 0 6px">สถานะ: IDLE</div>
            <div class="field"><label>แมปงาน / จุดยืนเริ่มงาน X / Y</label><input type="text" id="__assist_oremap" placeholder="prt_fild08"><input type="number" id="__assist_orehubx" placeholder="149"><input type="number" id="__assist_orehuby" placeholder="361"></div>
            <div class="field"><label>ชื่อ Kafra / X / Y (ใช้คุยตรงพิกัด ไม่ใช่จุดวาร์ป)</label><input type="text" id="__assist_orekafra" placeholder="Kafra Staff"><input type="number" id="__assist_orekafrax" placeholder="158"><input type="number" id="__assist_orekafray" placeholder="362"></div>
            <div class="field"><label>Kafra: กด Next กี่ครั้ง / เลือก Storage choice</label><input type="number" id="__assist_orekafranext" min="0" max="9"><input type="number" id="__assist_orekafrachoice" min="0" max="9"></div>
            <div class="field"><label>ชื่อ NPC ย่อย–ขาย / X / Y</label><input type="text" id="__assist_orenpc" placeholder="Master Scholar"><input type="number" id="__assist_orenpcx" placeholder="141"><input type="number" id="__assist_orenpcy" placeholder="370"></div>
            <div class="field"><label>NPC: Trade choice / recipe entry / Sell choice</label><input type="number" id="__assist_oretradechoice" min="0" max="9"><input type="number" id="__assist_oretradeentry" min="0" max="99"><input type="number" id="__assist_oresellchoice" min="0" max="9"></div>
            <div class="field"><label>จำนวน Great Nature ต่อรอบ (สูงสุด 99)</label><input type="number" id="__assist_orebatch" min="1" max="99"></div>
            <div class="btns"><button id="__assist_applyorerefine">ใช้ค่าการย่อยแร่</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ วาร์ปเฉพาะจุดยืนเริ่มงานครั้งเดียว ไม่ส่ง MOVE; จากนั้นคุย Kafra/Scholar ตรงพิกัด → ถอน Great Nature → Trade → รอ server ยืนยันจำนวน Green Live ก่อน Sell</div>
          </div>
          <!-- 🏦 Storage -->
          <div class="__assist_subpage" data-sub="storage">
            <div class="btns">
              <button id="__assist_storagebtn" class="off">Storage: ?</button>
              <button id="__assist_depositnow" class="primary">ฝากเดี๋ยวนี้</button>
            </div>
            <div class="field"><label>ชื่อ NPC Kafra</label><input type="text" id="__assist_kafra" placeholder="เช่น Kafra Staff"></div>
            <div class="field"><label>แมปที่ Kafra อยู่</label><input type="text" id="__assist_kaframap" placeholder="เช่น izlude"></div>
            <div class="field"><label>พิกัด Kafra X (ระบบวาร์ปข้าง ๆ +1)</label><input type="number" id="__assist_kafrax" placeholder="0=ใช้ sell"><label style="margin-left:8px">Y</label><input type="number" id="__assist_kafray" placeholder="0=ใช้ sell"><button id="__assist_usekafrapos" style="margin-left:8px;font-size:10px">ใช้พิกัดตัวละคร</button></div>
            <div class="field"><label>เมนู Kafra choice (เริ่มที่ 0 — ตั้งตาม NPC)</label><input type="number" id="__assist_kafrachoice" min="0" max="9" placeholder="0"></div>
            <div class="field"><label>เริ่มฝากเมื่อน้ำหนักถึง % (0=ปิด)</label><input type="number" id="__assist_depositweight" min="0" max="100" step="1" placeholder="90"></div>
            <div class="field"><label>โหมดฝากของ</label><select id="__assist_storagedepositmode"><option value="all">ฝากทุกอย่าง — กันของสวม/Weapon Set/Reserve</option><option value="selected">ฝากเฉพาะรายการ</option></select><small>โหมดฝากทุกอย่างจะฝาก stackable ทุกชิ้นที่เกินยอดสำรอง และอุปกรณ์ที่ไม่สวมอยู่เท่านั้น</small></div>
            <div class="field"><label>ไอเท็มสำรองติดตัว (Item ID:จำนวน)</label><input type="text" id="__assist_storagereserve" placeholder="509:50, 656:10"><small>ระบบจะกันยอดนี้ไว้ก่อนฝาก เช่น White Herb 50, Awakening Potion 10</small></div>
            <div class="btns"><button id="__assist_applykafra">ใช้ค่า storage</button><button id="__assist_managedeposititems">📋 รายการฝากเฉพาะ</button><button id="__assist_t_depfull" class="on">ฝากเมื่อเต็ม/ถึงน้ำหนัก</button><button id="__assist_t_depaftersell" class="on">ฝากหลังขาย</button></div>
          </div>
          <!-- 🤖 Auto Login / Recovery -->
          <div class="__assist_subpage" data-sub="auto">
            <h4>🤖 Auto Login / Recovery</h4>
            <div class="btns">
              <button id="__assist_autologinbtn" class="off">Auto-Login: ?</button>
              <button id="__assist_autorefreshbtn" class="off">Auto-Refresh: ?</button>
            </div>
            <div class="field"><label>Username <small>เกมจะใช้บัญชีที่จำไว้เอง</small></label><input type="text" id="__assist_aluser" autocomplete="username" disabled></div>
            <div class="field"><label>Password <small>ล็อกอินผ่านเกมเอง 1 ครั้งเพื่อให้เกมจำรหัส</small></label><input type="password" id="__assist_alpass" autocomplete="current-password" disabled></div>
            <div class="field"><label>Character slot (เริ่มจาก 0)</label><input type="number" id="__assist_alslot" min="0" max="2"></div>
            <div class="field"><label>ค้าง/ไม่มี packet เกิน (วินาที)</label><input type="number" id="__assist_arstall" min="60" max="1800"></div>
            <div class="field"><label>ตัวละครไม่ขยับเกิน (วินาที) <small>default 600 = 10 นาที, 0 = ปิดเงื่อนไขนี้</small></label><input type="number" id="__assist_armovementstall" min="0" max="3600" step="10"></div>
            <div class="btns"><button id="__assist_applyauto">💾 บันทึก Auto Login</button><button id="__assist_applyrefresh">💾 บันทึก Auto Refresh</button></div>
            <div id="__assist_autostatus" style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.5">(รอสถานะ)</div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.6;">★ เกมต้องจำบัญชี/รหัสไว้ก่อน แล้ว Auto Login จะปลุกหน้าเกม กด Enter และเลือก slot ที่ตั้งไว้<br>★ Auto Refresh ตรวจ packet เงียบตามเวลาที่ตั้ง และตรวจตัวละครไม่ขยับตามค่าด้านบนเมื่ออยู่ในเกมแล้ว</div>
          </div>
          <!-- 💬 AI Chat Reply -->
          <div class="__assist_subpage" data-sub="aireply">
            <h4>💬 AI Chat Reply</h4>
            <div class="btns"><button id="__assist_aireplybtn" class="off">AI Reply: OFF</button><button id="__assist_t_aireplymention" class="off">ตอบเมื่อเรียกชื่อ: OFF</button></div>
            <div class="field"><label>API endpoint (OpenAI-compatible)</label><input type="text" id="__assist_aiurl" placeholder="https://api.openai.com/v1/chat/completions" autocomplete="off"></div>
            <div class="field"><label>API key <small>เก็บ plain text ใน localStorage ของ browser เครื่องนี้</small></label><input type="password" id="__assist_aikey" placeholder="sk-..." autocomplete="off"></div>
            <div class="field"><label>Model</label><input type="text" id="__assist_aimodel" placeholder="gpt-4.1-mini" autocomplete="off"></div>
            <div class="field"><label>ตอบเฉพาะชื่อตัวละคร <small>คั่นด้วย comma; ว่าง = ผู้เล่นทุกคนที่ยืนยันตำแหน่งได้</small></label><input type="text" id="__assist_ainames" placeholder="เช่น TEST1150"></div>
            <div class="field"><label>ระยะตอบ (ช่อง)</label><input type="number" id="__assist_airadius" min="1" max="50"></div>
            <div class="field"><label>หน่วงก่อนตอบแบบสุ่ม min / max (วินาที)</label><div style="display:flex;gap:6px"><input type="number" id="__assist_aidelaymin" min="0" max="10" step="0.1"><input type="number" id="__assist_aidelaymax" min="0" max="10" step="0.1"></div></div>
            <div class="field"><label>cooldown ต่อผู้เล่น (วินาที) / ตอบสูงสุดต่อนาที</label><div style="display:flex;gap:6px"><input type="number" id="__assist_aicooldown" min="0" max="300"><input type="number" id="__assist_aimaxpermin" min="1" max="20"></div></div>
            <div class="field"><label>คำตอบยาวสุด (token)</label><input type="number" id="__assist_aimaxTokens" min="16" max="200"></div>
            <div class="field"><label>คำสั่งให้ AI ตอบ</label><textarea id="__assist_aiprompt" rows="3" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit;resize:vertical"></textarea></div>
            <div class="btns"><button id="__assist_applyaireply" class="primary">💾 บันทึก AI Reply</button><button id="__assist_clearaikey" class="danger">🗑 ล้าง API key</button></div>
            <div id="__assist_aistatus" style="font-size:10px;color:#9aa0a6;margin-top:5px;line-height:1.6">ยืนยัน sender ID + entity player + ระยะจริงก่อนตอบ: จบมอนเดิม → ตอบ → เก็บเฉพาะของใกล้เท้า → hold จนผู้พูดออกระยะ</div>
          </div>
          <!-- 📝 Template Reply (ไม่เรียก API) -->
          <div class="__assist_subpage" data-sub="replytemplates">
            <h4>📝 Template Reply <small>ไม่ใช้ API หรือเครดิต</small></h4>
            <div class="btns"><button id="__assist_templatereplybtn" class="off">Template Reply: OFF</button></div>
            <div class="field"><label>คำตอบสำเร็จรูป <small>1 บรรทัด = 1 คำตอบ; ระบบจะสุ่ม และไม่เลือกประโยคเดิมติดกัน</small></label><textarea id="__assist_aitemplates" rows="8" placeholder="สวัสดีครับ\nครับผม\nกำลังทำธุระอยู่ครับ" style="width:100%;background:#15171c;border:1px solid #3a3f4b;border-radius:5px;color:#e8e8e8;padding:5px 7px;font-size:11px;font-family:inherit;resize:vertical"></textarea></div>
            <div class="btns"><button id="__assist_applyaitemplates" class="primary">💾 บันทึก Template</button></div>
            <div id="__assist_templatestatus" style="font-size:10px;color:#9aa0a6;margin-top:5px;line-height:1.6">ตั้งค่าเงื่อนไขชื่อผู้เล่น ระยะ หน่วง และ cooldown ร่วมกันที่แท็บ 💬 AI Chat</div>
          </div>
          <!-- ⚙️ อื่นๆ -->
          <div class="__assist_subpage" data-sub="misc">
            <h4>🎞 Performance</h4>
            <div class="field"><label>FPS Cap <small>ลดงาน render ของ WebGL; ไม่แตะ timer หรือ WebSocket ของบอท</small></label><select id="__assist_fpscap"><option value="0">Unlimited</option><option value="15">15 FPS</option><option value="30">30 FPS (แนะนำ)</option><option value="45">45 FPS</option><option value="60">60 FPS</option></select></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.5">★ มีผลทันทีในแท็บนี้ · ค่าเดียวกันจะถูกใช้เมื่อเปิดหน้าเกมใหม่</div>
            <h4>🌐 Remote Monitor (ส่งข้อมูลไป relay server — ดูจากมือถือ/เครื่องอื่น)</h4>
            <div class="btns">
              <button id="__assist_relaybtn" class="off">Relay: ?</button>
              <button id="__assist_relayreconnect" class="primary">🔄 เชื่อมใหม่</button>
            </div>
            <div class="field"><label>URL relay server (wss:// = SSL, ws:// = ไม่มี SSL)</label><input type="text" id="__assist_relayurl" placeholder="wss://rayro.catgg.net"></div>
            <div class="btns"><button id="__assist_applyrelay">ใช้ค่า relay</button></div>
            <div class="btns"><button id="__assist_openremote" class="primary" style="display:none">🌐 เปิดดูข้อมูลที่เว็บ</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ เปิดแล้วสคริปต์จะส่งข้อมูลไป relay server ทุก 1 วินาที<br>★ ดูสถานะการเชื่อมต่อได้ที่แท็บ "📊 สถิติ" บรรทัด "🌐 Remote Monitor"<br>★ ตั้งค่า relay server ที่ <code>relay-server.js</code> ฝั่งเซิร์ฟเวอร์</div>
            <h4>🗺️ Navigation (บันทึกเส้นทางเดิน + waypoint graph)</h4>
            <div class="btns">
              <button id="__assist_navrecbtn" class="off">บันทึก: ?</button>
              <button id="__assist_navwanderbtn" class="on">เดินตาม nav</button>
              <button id="__assist_gatwanderbtn" class="on" title="wander ใช้ตารางเดินได้จากไฟล์ .gat ก่อน nav — เลี่ยงกำแพง/น้ำบนแมปที่มีข้อมูล">เดินตาม GAT</button>
            </div>
            <div class="field"><label>โหมดเดินตาม nav</label><select id="__assist_navmode"><option value="patrol">patrol (เดินตามลำดับ route ครบแล้วย้อนกลับ)</option><option value="graph">graph (wander สุ่มตามกราฟ)</option></select></div>
            <div class="field"><label>รัศมีรวมจุด (ช่อง) — จุดที่อยู่ใกล้กัน <= N ช่อง = รวม node เดียว</label><input type="number" id="__assist_navradius" min="1" max="20"></div>
            <div class="btns">
              <button id="__assist_applynav">ใช้ค่า nav</button>
              <button id="__assist_navexport">export</button>
              <button id="__assist_navimport">import</button>
              <button id="__assist_navclear" class="danger">ล้าง</button>
            </div>
            <div id="__assist_navstats" style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.6">(ยังไม่มีข้อมูล)</div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ เปิด 'บันทึก' แล้วเดินเก็บข้อมูลในแมปที่ต้องการ ปิดเมื่อเสร็จ<br>★ wander จะใช้ waypoint graph แทนสุ่ม (ถ้ามีข้อมูลแมปนั้น)</div>
            <h4>👤 Profile การตั้งค่า</h4>
            <div class="field"><label>เลือก profile <small>● = ชุดที่กำลังใช้</small></label><select id="__assist_profile_sel"></select></div>
            <div class="field"><label>ชื่อ Profile ใหม่ <small>เว้นว่าง = บันทึกทับชุดที่กำลังใช้</small></label><input type="text" id="__assist_profile_name" maxlength="80" placeholder="เช่น Assassin – Sleeper Farm"></div>
            <div class="btns">
              <button id="__assist_profile_save">💾 บันทึก Profile</button>
              <button id="__assist_profile_use" class="primary">🔄 ใช้ชุดที่เลือก</button>
              <button id="__assist_profile_del" class="danger">🗑 ลบ</button>
            </div>
            <div id="__assist_profile_status" style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.6">กำลังโหลด Profile…</div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.6">★ Profile เก็บค่า Farm / Combat / Loot / Queue / Skill / Storage / Auto Login ทั้งชุด<br>★ Nav/GAT รายแมป, log และ runtime state ใช้ร่วมกัน · สลับได้เมื่อไม่มีงานเก็บของ/คุย NPC/สู้ค้างอยู่</div>
            <h4 style="color:#e74c3c">⚠️ Reset</h4>
            <div class="btns"><button id="__assist_resetconfig" class="danger">🔄 รีเซ็ตค่าตั้งค่ากลับเป็น Default</button></div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;line-height:1.5">★ ล้างเฉพาะค่าที่บันทึกใน <code>roPureConfig_v1</code> แล้วรีเฟรชหน้า<br>★ ไม่ลบ Nav, สถิติ session, รายการไอเท็ม หรือข้อมูลของตัวเกม</div>
            <h4>📤 สำรอง / ย้ายเครื่อง</h4>
            <div class="btns">
              <button id="__assist_exportall">📤 export ทั้งหมด</button>
              <button id="__assist_importall">📥 import</button>
            </div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ export รวม config + Profile + รายการ Loot Queue + skill times + nav data<br>★ import = ทับค่าปัจจุบัน, เติมค่าเก่าที่ขาดจาก active Profile และทับเฉพาะ Profile ที่ชื่อซ้ำ</div>
          </div>
          <!-- 📨 Telegram -->
          <div class="__assist_subpage" data-sub="telegram">
            <h4>📨 Telegram Alerts</h4>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;margin-bottom:8px;line-height:1.6;">
              ★ แจ้งเตือน Log สำคัญ (การ์ด/ตาย/หนีมอน) ไป Telegram<br>
              ★ สร้าง Bot Token: คุย <code>@BotFather</code> → /newbot<br>
              ★ หา Chat ID: คุย <code>@userinfobot</code><br>
              ★ บอทต้องเชื่อม relay server ก่อน (ดูสถานะที่แท็บ สถิติ)
            </div>
            <div class="field"><label>Bot Token (จาก @BotFather)</label><input type="text" id="__assist_tg_token" placeholder="เช่น 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" autocomplete="off"></div>
            <div class="field"><label>Chat ID (จาก @userinfobot)</label><input type="text" id="__assist_tg_chatid" placeholder="เช่น 123456789" autocomplete="off"></div>
            <div class="btns">
              <button id="__assist_tg_save" class="primary">💾 บันทึก</button>
              <button id="__assist_tg_test">📨 ทดสอบ</button>
              <button id="__assist_tg_clear" class="danger">🗑 ล้าง</button>
            </div>
            <div id="__assist_tg_status" style="font-size:10px;color:#9aa0a6;margin-top:6px;line-height:1.6">(ยังไม่ได้ตั้งค่า)</div>
            <h4>🔔 ประเภทการแจ้งเตือน</h4>
            <div class="btns">
              <button id="__assist_t_tgcard" class="on">🃏 การ์ด</button>
              <button id="__assist_t_tgflee" class="on">🚨 หนี/ตาย</button>
              <button id="__assist_t_tgbot" class="on">💬 พูดถึง bot</button>
            </div>
            <div class="btns">
              <button id="__assist_t_tgnearby" class="off">💬 แชทใกล้</button>
              <button id="__assist_t_tgwhisper" class="on">💭 กระซิบ</button>
            </div>
            <div style="font-size:10px;color:#9aa0a6;margin-top:4px;">★ เปิด/ปิดการส่งแต่ละประเภทไป Telegram</div>
          </div>
        </div>
      </div>
      <div id="__assist_alertpopup">
        <div class="hdr"><span class="ttl">🔔 Log สำคัญ</span><button id="__assist_alertclose" title="ปิด Log สำคัญ">✕</button></div>
        <div class="logbox" id="__assist_alertbox"></div>
        <div class="btns"><button id="__assist_clearalert">ล้าง log สำคัญ</button></div>
      </div>
      <div id="__assist_logpopup">
        <div class="hdr">
          <span class="ttl">📋 Log</span>
          <button id="__assist_logsrc_act" class="on">กิจกรรม</button>
          <button id="__assist_logsrc_dbg">🔍 Debug</button>
          <button id="__assist_logexpand" title="ขยาย/ย่อหน้าต่าง">⛶</button>
          <button id="__assist_logclose" title="ปิด Log">✕</button>
        </div>
        <div class="logbox" id="__assist_logbox"></div>
        <div class="btns"><button id="__assist_copylog">📋 คัดลอก log</button><button id="__assist_clearlog">ล้าง log</button></div>
      </div>
    `;
    document.body.appendChild(root);
    renderWeaponEditor(root);

    normalizeWebGlNumericInputs(root);

    // ★★ track "กำลังแก้ input" ด้วย focusin/focusout (แทน document.activeElement)
    //   Unity เรียก canvas.focus() ทุกเฟรม → activeElement เปลี่ยนเป็น canvas ตลอด
    //   → syncInput ที่เช็ค activeElement จะเขียนทับค่าที่กำลังพิมพ์อยู่
    //   แก้: track ด้วย focusin/focusout (จับก่อน Unity แย่ง focus)
    //   ★ editingInputs + isEditing ประกาศที่ module-level (ใช้ได้ทั้ง buildUI + renderUI)
    root.addEventListener('focusin', (e) => {
      if (e.target.matches && e.target.matches('input, select, textarea')) editingInputs.add(e.target);
    });
    root.addEventListener('focusout', (e) => {
      if (e.target.matches && e.target.matches('input, select, textarea')) {
        // ★ delay 100ms ก่อนล้าง — กัน Unity แย่ง focus ชั่วขณะ แล้ว browser คืน focus กลับ
        setTimeout(() => { try { editingInputs.delete(e.target); } catch (_) {} }, 100);
      }
    });

    // ---------- wire events ----------
    // ★★ Unity WebGL (Emscripten) ดัก keyboard ที่ window ใน capture phase เหมือนกัน
    //   + เรียก preventDefault ทำให้ input ไม่รับ key → พิมพ์ไม่ติด
    //   วิธีแก้: intercept keydown ใน capture phase (ดักก่อน Unity) ถ้ามี input ของเรา active
    //   → หยุด propagation + จัดการ input เอง (แทรก/ลบตัวอักษรตรงๆ)
    const ASSIST_INPUT_SEL = 'input, select, textarea';
    // ★ รองรับทั้ง main panel (root) และ item-list popup (append ที่ body แยก)
    function isOurField(t) {
      if (!t || !t.closest || !t.matches || !t.matches(ASSIST_INPUT_SEL)) return false;
      const isOurs = root.contains(t)
        || (t.closest && t.closest('#__assist_itempopup'))
        || (t.closest && t.closest('#__assist_skillpopup'));
      if (isOurs && String(t.tagName).toLowerCase() === 'input' && t.type === 'number') normalizeWebGlNumericInputs(t.parentElement || t);
      return isOurs;
    }
    function ourActiveInput() {
      const ae = document.activeElement;
      return (ae && isOurField(ae)) ? ae : null;
    }
    // ดัก keyboard events ใน capture phase — ถ้ามี input ของเรา active ให้หยุดทุกอย่าง + จัดการเอง
    window.addEventListener('keydown', (e) => {
      const inp = ourActiveInput();
      if (!inp) return;
      // หยุด Unity รับ key นี้
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.preventDefault();
      // จัดการ input เอง (Unity กลืน key หมด แม้ input focus)
      handleInputKey(inp, e);
    }, true);
    // ดัก paste ด้วย
    window.addEventListener('paste', (e) => {
      const inp = ourActiveInput();
      if (!inp) return;
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const s = inp.selectionStart, en = inp.selectionEnd;
      inp.value = inp.value.slice(0, s) + text + inp.value.slice(en);
      const pos = s + text.length;
      inp.selectionStart = inp.selectionEnd = pos;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);
    // จัดการ key ให้ input เอง (เพราะ Unity กลืน keydown)
    function handleInputKey(inp, e) {
      const k = e.key;
      const tag = String(inp.tagName).toLowerCase();
      if (tag === 'select') {
        const direction = k === 'ArrowDown' ? 1 : (k === 'ArrowUp' ? -1 : 0);
        if (direction) {
          inp.selectedIndex = Math.max(0, Math.min(inp.options.length - 1, inp.selectedIndex + direction));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      const s = inp.selectionStart, en = inp.selectionEnd;
      // ปุ่มลัดของ browser: อย่างน้อย Ctrl/Cmd+A และ Ctrl/Cmd+V ต้องไม่ถูกตีเป็นตัวอักษร a/v
      if (e.ctrlKey || e.metaKey) {
        if (String(k).toLowerCase() === 'a') inp.selectionStart = 0, inp.selectionEnd = inp.value.length;
        // paste ถูกจัดการใน listener paste ด้านบน; copy/cut ปล่อยให้ผู้ใช้ใช้เมนู browser ได้
        return;
      }
      if (k === 'Backspace') {
        if (s === en && s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(en); inp.selectionStart = inp.selectionEnd = s - 1; }
        else if (s !== en) { inp.value = inp.value.slice(0, s) + inp.value.slice(en); inp.selectionStart = inp.selectionEnd = s; }
      } else if (k === 'Delete') {
        if (s === en && s < inp.value.length) { inp.value = inp.value.slice(0, s) + inp.value.slice(en + 1); inp.selectionStart = inp.selectionEnd = s; }
        else if (s !== en) { inp.value = inp.value.slice(0, s) + inp.value.slice(en); inp.selectionStart = inp.selectionEnd = s; }
      } else if (k === 'ArrowLeft') { inp.selectionStart = inp.selectionEnd = Math.max(0, s - 1); }
      else if (k === 'ArrowRight') { inp.selectionStart = inp.selectionEnd = Math.min(inp.value.length, s + 1); }
      else if (k === 'Home') { inp.selectionStart = inp.selectionEnd = 0; }
      else if (k === 'End') { inp.selectionStart = inp.selectionEnd = inp.value.length; }
      else if (k === 'Enter') {
        // input เดี่ยวใช้ Enter เพื่อจบการแก้ไข; textarea ต้องรับ newline ตามปกติ
        if (tag === 'textarea') {
          inp.value = inp.value.slice(0, s) + '\n' + inp.value.slice(en);
          inp.selectionStart = inp.selectionEnd = s + 1;
        } else {
          inp.blur();
        }
      }
      else if (k.length === 1) {   // ตัวอักษร 1 ตัว (รวมตัวเลข ภาษาอังกฤษ)
        inp.value = inp.value.slice(0, s) + k + inp.value.slice(en);
        inp.selectionStart = inp.selectionEnd = s + 1;
      }
      // อื่นๆ (Shift/Ctrl/Alt/Tab ฯลฯ) ไม่ต้องทำอะไร
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // ★ คลิก input → focus ทันที (กัน Unity ขโมย)
    root.addEventListener('mousedown', (e) => {
      if (isOurField(e.target)) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        // อย่า select ทั้งข้อความทุกคลิก: ให้ browser วาง cursor ตำแหน่งที่ผู้ใช้คลิกตามปกติ
        setTimeout(() => { try { e.target.focus(); } catch (_) {} }, 0);
      }
    }, true);

    const bar = root.querySelector('#__assist_bar');
    const popup = root.querySelector('#__assist_popup');
    const logPopup = root.querySelector('#__assist_logpopup');
    const alertPopup = root.querySelector('#__assist_alertpopup');
    const logBox = root.querySelector('#__assist_logbox');
    const applySettingsFontScale = () => {
      const scale = Math.max(0.9, Math.min(1.6, Number(CFG.settingsFontScale) || 1.15));
      CFG.settingsFontScale = scale;
      popup.style.zoom = String(scale);
      root.querySelector('#__assist_fontvalue').textContent = Math.round(scale * 100) + '%';
    };
    root.querySelector('#__assist_fontdown').addEventListener('click', () => {
      CFG.settingsFontScale = Math.max(0.9, Math.round(((Number(CFG.settingsFontScale) || 1.15) - 0.1) * 10) / 10);
      applySettingsFontScale(); saveConfigDebounced();
    });
    root.querySelector('#__assist_fontup').addEventListener('click', () => {
      CFG.settingsFontScale = Math.min(1.6, Math.round(((Number(CFG.settingsFontScale) || 1.15) + 0.1) * 10) / 10);
      applySettingsFontScale(); saveConfigDebounced();
    });
    root.querySelector('#__assist_popupclose').addEventListener('click', () => popup.classList.remove('open'));
    applySettingsFontScale();
    const setLogSource = (isDebug) => {
      logBox.dataset.dbg = isDebug ? '1' : '0';
      activityJournal.invalidate(logBox);
      root.querySelector('#__assist_logsrc_act').className = isDebug ? '' : 'on';
      root.querySelector('#__assist_logsrc_dbg').className = isDebug ? 'on' : '';
      root.querySelector('#__assist_logpopup .ttl').textContent = isDebug ? '🔍 Debug Log' : '📋 Activity Log';
      root.querySelector('#__assist_clearlog').textContent = isDebug ? 'ล้าง Debug' : 'ล้าง log';
    };
    const openLogPopup = (isDebug) => {
      popup.classList.remove('open');
      alertPopup.classList.remove('open');
      logPopup.classList.add('open');
      setLogSource(isDebug);
    };
    const openAlertPopup = () => {
      popup.classList.remove('open');
      logPopup.classList.remove('open');
      alertPopup.classList.add('open');
    };
    root.querySelector('#__assist_logsrc_act').addEventListener('click', () => setLogSource(false));
    root.querySelector('#__assist_logsrc_dbg').addEventListener('click', () => setLogSource(true));
    root.querySelector('#__assist_logexpand').addEventListener('click', () => logPopup.classList.toggle('expanded'));
    root.querySelector('#__assist_logclose').addEventListener('click', () => logPopup.classList.remove('open'));
    root.querySelector('#__assist_alertclose').addEventListener('click', () => alertPopup.classList.remove('open'));
    bar.addEventListener('click', (e) => {
      if (e.target.closest('[data-settingswindow]')) {
        logPopup.classList.remove('open');
        alertPopup.classList.remove('open');
        popup.classList.add('open');
        return;
      }
      const hudAction = e.target.closest('.hud-action');
      if (hudAction) {
        if (hudAction.hasAttribute('data-alert')) openAlertPopup();
        if (hudAction.hasAttribute('data-log')) openLogPopup(false);
        if (hudAction.hasAttribute('data-debug')) openLogPopup(true);
        return;
      }
      // กดที่ pill loot/heal ใน mini-bar = toggle ทันที (ไม่เปิด popup)
      const pill = e.target.closest('.pill');
      if (pill) {
        if (pill.hasAttribute('data-masterbot')) { masterBot.setEnabled(!masterBot.enabled()); return; }
        if (pill.hasAttribute('data-loot')) CFG.lootEnabled ? ASSIST.lootOff() : ASSIST.lootOn();
        if (pill.hasAttribute('data-heal')) CFG.healEnabled ? ASSIST.healOff() : ASSIST.healOn();
        if (pill.hasAttribute('data-rest')) CFG.restEnabled ? ASSIST.restOff() : ASSIST.restOn();
        if (pill.hasAttribute('data-combat')) {
          if (!CFG.combatEnabled && !confirm('เปิด Auto-Combat?\n\nส่ง packet โจมตีจริง — ตั้ง whitelist ก่อน (เช่น ASSIST.setTargetWhitelist("Poring"))\nใช้ในความรับผิดชอบของคุณ')) return;
          CFG.combatEnabled ? ASSIST.combatOff() : ASSIST.combatOn();
        }
        if (pill.hasAttribute('data-skill')) CFG.skillEnabled ? ASSIST.skillOff() : ASSIST.skillOn();
        if (pill.hasAttribute('data-buff')) CFG.buffEnabled ? ASSIST.buffOff() : ASSIST.buffOn();
        if (pill.hasAttribute('data-weapon')) {
          popup.classList.add('open');
          root.querySelectorAll('#__assist_tabs .tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-page') === 'config'));
          root.querySelectorAll('.__assist_page').forEach(p => p.classList.toggle('active', p.getAttribute('data-page') === 'config'));
          root.querySelectorAll('.__assist_subtabs .subtab').forEach(t => t.classList.toggle('active', t.getAttribute('data-sub') === 'weapon'));
          root.querySelectorAll('.__assist_subpage').forEach(p => p.classList.toggle('active', p.getAttribute('data-sub') === 'weapon'));
          renderWeaponEditor(root);
        }
        if (pill.hasAttribute('data-auto')) {
          popup.classList.add('open');
          root.querySelectorAll('#__assist_tabs .tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-page') === 'config'));
          root.querySelectorAll('.__assist_page').forEach(p => p.classList.toggle('active', p.getAttribute('data-page') === 'config'));
          root.querySelectorAll('.__assist_subtabs .subtab').forEach(t => t.classList.toggle('active', t.getAttribute('data-sub') === 'auto'));
          root.querySelectorAll('.__assist_subpage').forEach(p => p.classList.toggle('active', p.getAttribute('data-sub') === 'auto'));
        }
        if (pill.hasAttribute('data-abbuff')) {
          CFG.abBuffEnabled ? ASSIST.abBuffOff() : ASSIST.abBuffOn();
        }
        if (pill.hasAttribute('data-sell')) CFG.sellEnabled ? ASSIST.sellOff() : ASSIST.sellOn();
        if (pill.hasAttribute('data-storage')) CFG.storageEnabled ? ASSIST.storageOff() : ASSIST.storageOn();
        if (pill.hasAttribute('data-teleport')) {
          if (sendRandomWarp()) log('🌀 วาร์ปสุ่ม (กดจาก mini-bar)');
        }
        if (pill.hasAttribute('data-monitor')) { openMonitor(); }
        if (pill.hasAttribute('data-remote')) { openRemoteMonitor(); }
        return;
      }
      popup.classList.toggle('open');
    });

    // tab switching
    root.querySelectorAll('#__assist_tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.getAttribute('data-page');
        root.querySelectorAll('#__assist_tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
        root.querySelectorAll('.__assist_page').forEach(p => p.classList.toggle('active', p.getAttribute('data-page') === page));
      });
    });
    // ★ sub-tab switching (ใน config page)
    root.querySelectorAll('.__assist_subtabs .subtab').forEach(sub => {
      sub.addEventListener('click', () => {
        const s = sub.getAttribute('data-sub');
        root.querySelectorAll('.__assist_subtabs .subtab').forEach(t => t.classList.toggle('active', t === sub));
        root.querySelectorAll('.__assist_subpage').forEach(p => p.classList.toggle('active', p.getAttribute('data-sub') === s));
      });
    });

    // config tab buttons
    root.querySelector('#__assist_lootbtn').addEventListener('click', () => CFG.lootEnabled ? ASSIST.lootOff() : ASSIST.lootOn());
    root.querySelector('#__assist_healbtn').addEventListener('click', () => CFG.healEnabled ? ASSIST.healOff() : ASSIST.healOn());
    root.querySelector('#__assist_warpbtn').addEventListener('click', () => {
      if (!CFG.warpLootEnabled && !confirm('เปิด Warp-to-Loot?\n\nส่ง packet วาร์ปจริง — เก็บไม่ได้ครบ ' + CFG.maxAttempts + ' ครั้งจะวาร์ปไปที่ไอเท็ม\nใช้ในความรับผิดชอบของคุณ')) return;
      CFG.warpLootEnabled ? ASSIST.warpLootOff() : ASSIST.warpLootOn();
    });
    root.querySelector('#__assist_fpscap').addEventListener('change', event => ASSIST.setFpsCap(Number(event.target.value)));

    root.querySelector('#__assist_applyheal').addEventListener('click', () => {
      const pct = parseInt(root.querySelector('#__assist_healat').value, 10);
      if (!isNaN(pct)) ASSIST.setHealAt(pct);
      const ids = root.querySelector('#__assist_healitems').value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      if (ids.length) ASSIST.setHealItems(...ids);
    });
    root.querySelector('#__assist_healmode').addEventListener('change', e => ASSIST.setHealMode(e.target.value));
    // ---- buff wires ----
    root.querySelector('#__assist_buffbtn').addEventListener('click', () => CFG.buffEnabled ? ASSIST.buffOff() : ASSIST.buffOn());
    root.querySelector('#__assist_buffnow').addEventListener('click', () => ASSIST.buffNow());
    root.querySelector('#__assist_applybuff').addEventListener('click', () => {
      const raw = root.querySelector('#__assist_buffitems').value;
      const items = raw.split('\n').map(line => {
        const parts = line.split(',').map(s => s.trim());
        const itemId = parseInt(parts[0], 10);
        const intervalMin = parseFloat(parts[1]);
        return (!isNaN(itemId) && !isNaN(intervalMin) && intervalMin > 0) ? { itemId, intervalMin } : null;
      }).filter(x => x);
      ASSIST.setBuffItems(items);
    });
    root.querySelector('#__assist_clearbufftimes').addEventListener('click', () => ASSIST.clearBuffTimes());
    // ---- AB buff wires ----
    root.querySelector('#__assist_abbuffbtn').addEventListener('click', () => CFG.abBuffEnabled ? ASSIST.abBuffOff() : ASSIST.abBuffOn());
    root.querySelector('#__assist_applyabbuff').addEventListener('click', () => {
      const map = root.querySelector('#__assist_abbuffmap').value.trim();
      const x = parseInt(root.querySelector('#__assist_abbuffx').value, 10);
      const y = parseInt(root.querySelector('#__assist_abbuffy').value, 10);
      ASSIST.setAbBuffLocation(map, x, y);
      ASSIST.setAbBuffTimeoutSec(parseInt(root.querySelector('#__assist_abbufftimeout').value, 10));
      ASSIST.setAbBuffReturnDelaySec(parseFloat(root.querySelector('#__assist_abbuffreturndelay').value));
    });
    root.querySelector('#__assist_abbuffnow').addEventListener('click', () => ASSIST.abBuffNow());
    // ---- skill wires ----
    root.querySelector('#__assist_skillbtn').addEventListener('click', () => CFG.skillEnabled ? ASSIST.skillOff() : ASSIST.skillOn());
    root.querySelector('#__assist_skillnow').addEventListener('click', () => ASSIST.skillNow());
    root.querySelector('#__assist_manageskill').addEventListener('click', () => openSkillPopup());
    root.querySelector('#__assist_applyskillgap').addEventListener('click', () => {
      ASSIST.setSkillCommandGap(root.querySelector('#__assist_skillgap').value);
    });
    root.querySelector('#__assist_lootmode').addEventListener('change', e => ASSIST.setLootMode(e.target.value));
    root.querySelector('#__assist_manageonly').addEventListener('click', () => openItemListPopup('only'));
    root.querySelector('#__assist_manageexcept').addEventListener('click', () => openItemListPopup('except'));
    root.querySelector('#__assist_managequeueitems').addEventListener('click', () => openItemListPopup('queue'));
    root.querySelector('#__assist_lootqueuesendall').addEventListener('click', () => {
      CFG.lootQueueSendAll = !CFG.lootQueueSendAll;
      saveConfigDebounced();
      log('📮 Loot Queue farm:', CFG.lootQueueSendAll ? 'ส่งทุกอย่าง' : 'ส่งเฉพาะรายการพิเศษ');
    });
    root.querySelector('#__assist_lootqueuereconnect').addEventListener('click', () => lootQueue.reconnect());
    root.querySelector('#__assist_lootqueuenext').addEventListener('click', () => lootQueue.skipCurrent());
    root.querySelector('#__assist_lootqueuetransport').addEventListener('change', (event) => {
      const mode = event.target.value;
      root.querySelectorAll('[data-lootqueue-transport]').forEach(el => {
        el.style.display = el.getAttribute('data-lootqueue-transport') === mode ? '' : 'none';
      });
    });
    root.querySelector('#__assist_applylootqueue').addEventListener('click', () => {
      ASSIST.setLootQueueConfig({
        role: root.querySelector('#__assist_lootqueuerole').value,
        sendAll: CFG.lootQueueSendAll,
        transport: root.querySelector('#__assist_lootqueuetransport').value,
        localUrl: root.querySelector('#__assist_lootqueuelocalurl').value.trim(),
        cloudflareUrl: root.querySelector('#__assist_lootqueuecloudflareurl').value.trim(),
        group: root.querySelector('#__assist_lootqueuegroup').value.trim(),
        homeMap: root.querySelector('#__assist_lootqueuehomemap').value.trim(),
        homeX: parseInt(root.querySelector('#__assist_lootqueuehomex').value, 10),
        homeY: parseInt(root.querySelector('#__assist_lootqueuehomey').value, 10),
        claimDelayMs: parseInt(root.querySelector('#__assist_lootqueueclaimdelay').value, 10),
        nearbySettleMs: parseInt(root.querySelector('#__assist_lootqueuesettle').value, 10),
        warpCooldownMs: parseInt(root.querySelector('#__assist_lootqueuewarpcooldown').value, 10),
        pickupRetryCount: parseInt(root.querySelector('#__assist_lootqueuepickupretries').value, 10),
        actionTimeoutMs: parseInt(root.querySelector('#__assist_lootqueuetimeout').value, 10),
      });
    });
    root.querySelector('#__assist_lootqueuehomecurrent').addEventListener('click', () => ASSIST.useCurrentPosAsLootQueueHome());
    root.querySelector('#__assist_applylootdelay').addEventListener('click', () => {
      const ms = parseInt(root.querySelector('#__assist_lootdelay').value, 10);
      if (!isNaN(ms)) ASSIST.setLootDelay(ms);
      const settle = parseInt(root.querySelector('#__assist_lootsettle').value, 10);
      if (!isNaN(settle)) ASSIST.setLootPostKillSettle(settle);
      const th = parseInt(root.querySelector('#__assist_lootthrottle').value, 10);
      if (!isNaN(th) && th >= 100) { CFG.sendThrottleMs = th; log('📦 ดีเลย์ระหว่างเก็บ =', th, 'ms'); }
      const rk = parseInt(root.querySelector('#__assist_pickradiuskill').value, 10);
      if (!isNaN(rk)) { CFG.pickRadiusKill = rk; log('📦 ระยะเช็คพิกัดมอน =', rk, 'ช่อง'); }
    });
    root.querySelector('#__assist_t_lootkillpos').addEventListener('click', () => {
      CFG.lootUseKillPos = !CFG.lootUseKillPos;
      log('📦 เช็คพิกัดมอนที่ฆ่า =', CFG.lootUseKillPos);
    });

    // ---- combat wires ----
    const parseList = (sel) => root.querySelector(sel).value.split(',').map(s => {
      const t = s.trim(); if (!t) return null;
      const n = parseInt(t, 10); return isNaN(n) ? t : n;     // ตัวเลข → number, อื่น → ชื่อ
    }).filter(x => x !== null);
    root.querySelector('#__assist_combatbtn').addEventListener('click', () => {
      if (!CFG.combatEnabled && !confirm('เปิด Auto-Combat?\n\nส่ง packet โจมตีจริง — ตั้ง whitelist ก่อน\nใช้ในความรับผิดชอบของคุณ')) return;
      CFG.combatEnabled ? ASSIST.combatOff() : ASSIST.combatOn();
    });
    root.querySelector('#__assist_applywhitelist').addEventListener('click', () => ASSIST.setTargetWhitelist(...parseList('#__assist_whitelist')));
    root.querySelector('#__assist_applyblacklist').addEventListener('click', () => ASSIST.setTargetBlacklist(...parseList('#__assist_blacklist')));
    root.querySelector('#__assist_applycombat').addEventListener('click', () => {
      const r = parseInt(root.querySelector('#__assist_attackrange').value, 10);
      if (!isNaN(r)) { if (r > 2) ASSIST.setRanged(r); else ASSIST.setAttackRange(r || 2); }
      ASSIST.setHiddenWaitMonsters(...parseList('#__assist_hiddenwaitmonsters'));
      const hws = parseFloat(root.querySelector('#__assist_hiddenwaitsec').value);
      if (!isNaN(hws)) ASSIST.setHiddenWaitSec(hws);
      const akWindow = parseInt(root.querySelector('#__assist_antikswindow').value, 10);
      if (!isNaN(akWindow)) CFG.antiKSCooldownMs = Math.max(0, Math.min(30000, akWindow));
      const avoidRadius = parseFloat(root.querySelector('#__assist_avoidplayerradius').value);
      if (!isNaN(avoidRadius)) CFG.playerProximityRadius = Math.max(0, Math.min(30, avoidRadius));
      const postWarpSettle = parseInt(root.querySelector('#__assist_postwarpsettle').value, 10);
      if (!isNaN(postWarpSettle)) CFG.postWarpTargetSettleMs = Math.max(0, Math.min(3000, postWarpSettle));
      const combatGatProgressTimeout = parseInt(root.querySelector('#__assist_combatgatprogresstimeout').value, 10);
      if (!isNaN(combatGatProgressTimeout)) CFG.combatGatProgressTimeoutMs = Math.max(500, Math.min(15000, combatGatProgressTimeout));
      const sw = parseInt(root.querySelector('#__assist_stuckwarp').value, 10);
      if (!isNaN(sw)) { CFG.stuckWarpOnAbandon = sw; log('⚔️ stuck abandon → วาร์ปสุ่ม =', sw === 0 ? 'ปิด' : sw + 'ครั้ง'); }
      saveConfigDebounced();
    });
    root.querySelector('#__assist_t_warptoboss').addEventListener('click', () => { CFG.warpToBoss = !CFG.warpToBoss; saveConfigDebounced(); log('👹 วาร์ปไปสู้ Mini Boss:', CFG.warpToBoss ? 'เปิด' : 'ปิด'); });
    // ---- flee wires (แยกจาก combat) ----
    root.querySelector('#__assist_applyflee').addEventListener('click', () => {
      const fm = parseInt(root.querySelector('#__assist_fleemob').value, 10);
      const fa = parseInt(root.querySelector('#__assist_fleeaggro').value, 10);
      const fp = parseInt(root.querySelector('#__assist_fleeprox').value, 10);
      if (!isNaN(fm)) ASSIST.setFleeMob(fm);
      if (!isNaN(fa)) ASSIST.setFleeAggro(fa);
      if (!isNaN(fp)) ASSIST.setFleeProximity(fp);
      const fpr = parseInt(root.querySelector('#__assist_fleeplayerradius').value, 10);
      if (!isNaN(fpr)) ASSIST.setFleePlayers(CFG.fleeOnPlayerCount, fpr);
      const fpd = parseFloat(root.querySelector('#__assist_fleeplayerdelay').value);
      if (!isNaN(fpd)) ASSIST.setFleePlayerDelay(fpd);
      const fpeList = root.querySelector('#__assist_fleeplayerexceptions').value;
      ASSIST.setFleePlayerExceptions(...fpeList.split(',').map(s => s.trim()).filter(Boolean));
      const fmvpR = parseInt(root.querySelector('#__assist_fleemvpradius').value, 10);
      if (!isNaN(fmvpR)) ASSIST.setFleeMvp(CFG.fleeOnMvp, fmvpR);
      const fmList = root.querySelector('#__assist_fleemonsters').value.trim();
      if (fmList !== '') CFG.fleeMonsters = fmList.split(',').map(s => s.trim()).filter(Boolean);
      const fmr = parseInt(root.querySelector('#__assist_fleemonsterradius').value, 10);
      if (!isNaN(fmr)) CFG.fleeMonsterRadius = fmr;
    });
    root.querySelector('#__assist_t_fleeplayer').addEventListener('click', () => ASSIST.toggleFleePlayers(CFG.fleeOnPlayerCount === 0));
    root.querySelector('#__assist_t_fleemvp').addEventListener('click', () => ASSIST.setFleeMvp(!CFG.fleeOnMvp, CFG.fleeOnMvpRadius));
    // ---- rest wires ----
    root.querySelector('#__assist_restbtn').addEventListener('click', () => CFG.restEnabled ? ASSIST.restOff() : ASSIST.restOn());
    root.querySelector('#__assist_respawnbtn').addEventListener('click', () => { CFG.autoRespawnEnabled = !CFG.autoRespawnEnabled; saveConfigDebounced(); log('💀 Auto-Respawn:', CFG.autoRespawnEnabled ? 'เปิด' : 'ปิด'); });
    root.querySelector('#__assist_applyrest').addEventListener('click', () => {
      const hp = parseInt(root.querySelector('#__assist_resthp').value, 10);
      const until = parseInt(root.querySelector('#__assist_restuntil').value, 10);
      const sec = parseInt(root.querySelector('#__assist_restmaxsec').value, 10);
      if (!isNaN(hp)) ASSIST.setRestHp(hp);
      if (!isNaN(until)) ASSIST.setRestUntil(until);
      if (!isNaN(sec)) ASSIST.setRestMaxSec(sec);
    });
    // ---- sell wires ----
    root.querySelector('#__assist_sellbtn').addEventListener('click', () => CFG.sellEnabled ? ASSIST.sellOff() : ASSIST.sellOn());
    root.querySelector('#__assist_sellnow').addEventListener('click', () => ASSIST.sellNow());
    root.querySelector('#__assist_applysell').addEventListener('click', () => {
      const npcName = root.querySelector('#__assist_sellnpc').value.trim();
      const npcMap = root.querySelector('#__assist_sellmap').value.trim();
      const interval = parseInt(root.querySelector('#__assist_sellinterval').value, 10);
      const sx = parseInt(root.querySelector('#__assist_sellx').value, 10);
      const sy = parseInt(root.querySelector('#__assist_selly').value, 10);
      if (npcName) ASSIST.setSellNpc(npcName, npcMap);
      if (!isNaN(sx) && !isNaN(sy)) ASSIST.setSellNpcPos(sx, sy);
      if (!isNaN(interval)) ASSIST.setSellInterval(interval);
    });
    root.querySelector('#__assist_useselfpos').addEventListener('click', () => { ASSIST.useCurrentPosAsSellWarp(); });
    root.querySelector('#__assist_t_sellfull').addEventListener('click', () => { CFG.sellOnFull = !CFG.sellOnFull; ASSIST.toggleSellOnFull(CFG.sellOnFull); });
    root.querySelector('#__assist_orerefinenow').addEventListener('click', () => ASSIST.oreRefineNow());
    root.querySelector('#__assist_orerefinestop').addEventListener('click', () => ASSIST.oreRefineStop());
    root.querySelector('#__assist_applyorerefine').addEventListener('click', () => {
      const text = id => root.querySelector(id).value.trim();
      const number = id => parseInt(root.querySelector(id).value, 10);
      const values = {
        oreRefineMap: text('#__assist_oremap'),
        oreRefineHubX: number('#__assist_orehubx'),
        oreRefineHubY: number('#__assist_orehuby'),
        oreRefineKafraName: text('#__assist_orekafra'),
        oreRefineKafraX: number('#__assist_orekafrax'),
        oreRefineKafraY: number('#__assist_orekafray'),
        oreRefineKafraNextCount: number('#__assist_orekafranext'),
        oreRefineKafraChoice: number('#__assist_orekafrachoice'),
        oreRefineNpcName: text('#__assist_orenpc'),
        oreRefineNpcX: number('#__assist_orenpcx'),
        oreRefineNpcY: number('#__assist_orenpcy'),
        oreRefineTradeChoice: number('#__assist_oretradechoice'),
        oreRefineTradeEntry: number('#__assist_oretradeentry'),
        oreRefineSellChoice: number('#__assist_oresellchoice'),
        oreRefineBatchSize: number('#__assist_orebatch'),
      };
      for (const [key, value] of Object.entries(values)) if (value === '' || Number.isNaN(value)) delete values[key];
      ASSIST.setOreRefineConfig(values);
    });
    // ---- storage wires ----
    root.querySelector('#__assist_storagebtn').addEventListener('click', () => CFG.storageEnabled ? ASSIST.storageOff() : ASSIST.storageOn());
    root.querySelector('#__assist_depositnow').addEventListener('click', () => ASSIST.depositNow());
    root.querySelector('#__assist_managedeposititems').addEventListener('click', () => openItemListPopup('deposit'));
    root.querySelector('#__assist_applykafra').addEventListener('click', () => {
      const kn = root.querySelector('#__assist_kafra').value.trim();
      const km = root.querySelector('#__assist_kaframap').value.trim();
      const kx = parseInt(root.querySelector('#__assist_kafrax').value, 10);
      const ky = parseInt(root.querySelector('#__assist_kafray').value, 10);
      const kc = parseInt(root.querySelector('#__assist_kafrachoice').value, 10);
      const weightPct = parseInt(root.querySelector('#__assist_depositweight').value, 10);
      const reserveText = root.querySelector('#__assist_storagereserve').value;
      ASSIST.setStorageDepositMode(root.querySelector('#__assist_storagedepositmode').value);
      if (kn) ASSIST.setKafra(kn, km);
      if (!isNaN(kx) && !isNaN(ky)) ASSIST.setKafraPos(kx, ky);
      if (!isNaN(kc)) CFG.kafraChoice = kc;
      if (!isNaN(weightPct)) ASSIST.setDepositWeightPercent(weightPct);
      const reserves = parseStorageReserveItems(reserveText);
      if (reserves == null) log('⚠️ รูปแบบไอเท็มสำรองไม่ถูกต้อง — ใช้ ItemID:จำนวน เช่น 509:50, 656:10');
      else ASSIST.setStorageReserveItems(reserves);
    });
    root.querySelector('#__assist_usekafrapos').addEventListener('click', () => { ASSIST.useCurrentPosAsKafra(); });
    root.querySelector('#__assist_t_depfull').addEventListener('click', () => { CFG.depositOnFull = !CFG.depositOnFull; ASSIST.toggleDepositOnFull(CFG.depositOnFull); });
    root.querySelector('#__assist_t_depaftersell').addEventListener('click', () => { CFG.depositAfterSell = !CFG.depositAfterSell; ASSIST.toggleDepositAfterSell(CFG.depositAfterSell); });
    // ---- relay/remote monitor wires ----
    // ---- auto login / recovery wires ----
    root.querySelector('#__assist_autologinbtn').addEventListener('click', () => {
      CFG.autoLoginEnabled ? ASSIST.autoLoginOff() : ASSIST.autoLoginOn();
    });
    root.querySelector('#__assist_autorefreshbtn').addEventListener('click', () => {
      CFG.autoRefreshEnabled ? ASSIST.autoRefreshOff() : ASSIST.autoRefreshOn();
    });
    root.querySelector('#__assist_applyauto').addEventListener('click', () => {
      ASSIST.setAutoLogin(
        root.querySelector('#__assist_aluser').value,
        root.querySelector('#__assist_alpass').value,
        root.querySelector('#__assist_alslot').value
      );
    });
    root.querySelector('#__assist_applyrefresh').addEventListener('click', () => {
      ASSIST.setAutoRefresh(root.querySelector('#__assist_arstall').value);
      ASSIST.setAutoRefreshMovementStall(root.querySelector('#__assist_armovementstall').value);
    });
    // ---- AI chat reply wires ----
    root.querySelector('#__assist_aireplybtn').addEventListener('click', () => {
      if (CFG.aiReplyEnabled && !aiReplyUsesTemplates()) {
        ASSIST.aiReplyOff();
        return;
      }
      if (!CFG.aiReplyApiUrl || !CFG.aiReplyApiKey || !CFG.aiReplyModel) {
        log('⚠️ AI Reply: ตั้ง endpoint, API key และ model ให้ครบก่อน');
        return;
      }
      CFG.aiReplyMode = 'ai';
      CFG.aiReplyEnabled = true;
      clearAiInteraction();
      saveConfigDebounced();
      log('🤖 AI Reply: ON');
    });
    root.querySelector('#__assist_t_aireplymention').addEventListener('click', () => {
      CFG.aiReplyRequireNameMention = !CFG.aiReplyRequireNameMention;
      saveConfigDebounced();
      log('🤖 AI Reply ตอบเมื่อเรียกชื่อ =', CFG.aiReplyRequireNameMention ? 'ON' : 'OFF');
    });
    root.querySelector('#__assist_applyaireply').addEventListener('click', () => {
      const url = root.querySelector('#__assist_aiurl').value.trim();
      const key = root.querySelector('#__assist_aikey').value.trim();
      const model = root.querySelector('#__assist_aimodel').value.trim();
      const num = (selector, min, max, fallback) => {
        const value = Number(root.querySelector(selector).value);
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
      };
      if (url) CFG.aiReplyApiUrl = url;
      if (key) CFG.aiReplyApiKey = key;
      if (model) CFG.aiReplyModel = model;
      CFG.aiReplyAllowedNames = root.querySelector('#__assist_ainames').value
        .split(',').map(n => n.trim()).filter(Boolean);
      CFG.aiReplyRadius = num('#__assist_airadius', 1, 50, CFG.aiReplyRadius);
      CFG.aiReplyDelayMinSec = num('#__assist_aidelaymin', 0, 10, CFG.aiReplyDelayMinSec);
      CFG.aiReplyDelayMaxSec = num('#__assist_aidelaymax', 0, 10, CFG.aiReplyDelayMaxSec);
      if (CFG.aiReplyDelayMaxSec < CFG.aiReplyDelayMinSec) {
        [CFG.aiReplyDelayMinSec, CFG.aiReplyDelayMaxSec] = [CFG.aiReplyDelayMaxSec, CFG.aiReplyDelayMinSec];
      }
      CFG.aiReplyCooldownSec = num('#__assist_aicooldown', 0, 300, CFG.aiReplyCooldownSec);
      CFG.aiReplyMaxPerMin = Math.round(num('#__assist_aimaxpermin', 1, 20, CFG.aiReplyMaxPerMin));
      CFG.aiReplyMaxTokens = Math.round(num('#__assist_aimaxTokens', 16, 200, CFG.aiReplyMaxTokens));
      const prompt = root.querySelector('#__assist_aiprompt').value.trim();
      if (prompt) CFG.aiReplyPrompt = prompt;
      saveConfigDebounced();
      log('🤖 บันทึก AI Reply: radius', CFG.aiReplyRadius + ' ช่อง, หน่วง', CFG.aiReplyDelayMinSec + '-' + CFG.aiReplyDelayMaxSec + 's');
    });
    root.querySelector('#__assist_clearaikey').addEventListener('click', () => {
      ASSIST.clearAIReplyKey();
      root.querySelector('#__assist_aikey').value = '';
    });
    // ---- template chat reply wires (ใช้ flow สนทนาเดียวกับ AI แต่ไม่เรียก API) ----
    root.querySelector('#__assist_templatereplybtn').addEventListener('click', () => {
      if (CFG.aiReplyEnabled && aiReplyUsesTemplates()) {
        ASSIST.aiReplyOff();
        return;
      }
      ASSIST.templateReplyOn();
    });
    root.querySelector('#__assist_applyaitemplates').addEventListener('click', () => {
      const templates = root.querySelector('#__assist_aitemplates').value
        .split(/\r?\n/).map(reply => reply.trim()).filter(Boolean);
      ASSIST.setReplyTemplates(templates);
    });
    // ---- relay wires ----
    root.querySelector('#__assist_relaybtn').addEventListener('click', () => {
      CFG.monitorServerEnabled = !CFG.monitorServerEnabled;
      saveConfigDebounced();
      log('🌐 Remote Monitor:', CFG.monitorServerEnabled ? 'เปิด' : 'ปิด');
      if (CFG.monitorServerEnabled) {
        connectRelay();             // พยายามเชื่อมทันที
        relayRegisterPlayer();      // ส่ง register ทันทีถ้ามี playerId แล้ว
      } else {
        // ปิด → ตัดการเชื่อมต่อปัจจุบัน
        if (relayWs) { try { relayWs.close(); } catch (_) {} relayWs = null; }
        setRelayStatus('disabled', 'ปิด');
      }
    });
    root.querySelector('#__assist_relayreconnect').addEventListener('click', () => {
      log('🔄 บังคับเชื่อม relay ใหม่');
      if (relayWs) { try { relayWs.close(); } catch (_) {} relayWs = null; }
      relayReconnectAt = 0;          // reset cooldown
      relayConnectedAt = 0;
      if (CFG.monitorServerEnabled) { connectRelay(); relayRegisterPlayer(); }
    });
    root.querySelector('#__assist_applyrelay').addEventListener('click', () => {
      const url = root.querySelector('#__assist_relayurl').value.trim();
      if (url) {
        const prevUrl = CFG.monitorServerUrl;
        CFG.monitorServerUrl = url;
        saveConfigDebounced();
        log('🌐 relay URL =', url);
        // ถ้า URL เปลี่ยน → ตัดขาวเชื่อมใหม่
        if (url !== prevUrl && relayWs) { try { relayWs.close(); } catch (_) {} relayWs = null; relayReconnectAt = 0; relayConnectedAt = 0; }
        if (CFG.monitorServerEnabled) { connectRelay(); relayRegisterPlayer(); }
      }
    });
    root.querySelector('#__assist_openremote').addEventListener('click', () => openRemoteMonitor());
    // ---- telegram wires ----
    root.querySelector('#__assist_tg_save').addEventListener('click', () => {
      const token = root.querySelector('#__assist_tg_token').value.trim();
      const chatId = root.querySelector('#__assist_tg_chatid').value.trim();
      if (!token || !chatId) { updateTelegramStatus('❌ กรุณากรอก Bot Token + Chat ID ให้ครบ', '#e74c3c'); return; }
      // ★ บันทึกลงเครื่อง (localStorage) — persist ข้าม session
      CFG.telegramBotToken = token;
      CFG.telegramChatId = chatId;
      saveConfigDebounced();
      if (playerName == null) { updateTelegramStatus('⚠️ บันทึกในเครื่องแล้ว — จะส่งไป relay เมื่อเข้าเกม + เชื่อม relay', '#f39c12'); return; }
      if (!relayWs || relayWs.readyState !== 1) { updateTelegramStatus('⚠️ บันทึกในเครื่องแล้ว — จะส่งไป relay เมื่อเชื่อมต่อ', '#f39c12'); return; }
      updateTelegramStatus('⏳ กำลังบันทึก...', '#f39c12');
      if (sendSetTelegram(token, chatId)) log('📨 บันทึก Telegram config...');
    });
    root.querySelector('#__assist_tg_test').addEventListener('click', () => {
      if (!relayWs || relayWs.readyState !== 1) { updateTelegramStatus('❌ ยังไม่ได้เชื่อม relay server', '#e74c3c'); return; }
      updateTelegramStatus('⏳ กำลังส่งทดสอบ...', '#f39c12');
      sendRelayAlert('📨 ทดสอบแจ้งเตือนจาก RO Rebuild Pure — หากคุณเห็นข้อความนี้ = ใช้งานได้แล้ว!');
      log('📨 ส่งข้อความทดสอบไป Telegram');
    });
    root.querySelector('#__assist_tg_clear').addEventListener('click', () => {
      if (sendClearTelegram()) {
        root.querySelector('#__assist_tg_token').value = '';
        root.querySelector('#__assist_tg_chatid').value = '';
        updateTelegramStatus('🗑 ล้างการตั้งค่าแล้ว', '#9aa0a6');
        log('📨 ล้าง Telegram config');
      }
    });
    // ---- telegram alert toggle wires ----
    const tgToggles = [
      ['#__assist_t_tgcard', 'telegramAlertCard', '🃏 การ์ด'],
      ['#__assist_t_tgflee', 'telegramAlertFlee', '🚨 หนี/ตาย'],
      ['#__assist_t_tgbot', 'telegramAlertBotMention', '💬 พูดถึง bot'],
      ['#__assist_t_tgnearby', 'telegramAlertNearby', '💬 แชทใกล้'],
      ['#__assist_t_tgwhisper', 'telegramAlertWhisper', '💭 กระซิบ'],
    ];
    tgToggles.forEach(([sel, key, label]) => {
      const btn = root.querySelector(sel);
      if (btn) btn.addEventListener('click', () => {
        CFG[key] = !CFG[key]; saveConfigDebounced();
        log('📨 Telegram alert', label, CFG[key] ? 'เปิด' : 'ปิด');
      });
    });
    // ---- nav wires ----
    root.querySelector('#__assist_navrecbtn').addEventListener('click', () => CFG.navRecording ? ASSIST.navRecordOff() : ASSIST.navRecordOn());
    root.querySelector('#__assist_navwanderbtn').addEventListener('click', () => { CFG.navWanderUseNav = !CFG.navWanderUseNav; ASSIST.navToggleWander(CFG.navWanderUseNav); });
    root.querySelector('#__assist_gatwanderbtn').addEventListener('click', () => { CFG.gatWanderEnabled = !(CFG.gatWanderEnabled !== false); saveConfigDebounced(); log('🗺️ GAT wander:', CFG.gatWanderEnabled !== false ? 'เปิด (เดินหามอนตามตาราง .gat)' : 'ปิด'); });
    root.querySelector('#__assist_navmode').addEventListener('change', e => { CFG.navWanderMode = e.target.value; navPatrolReset(); log('🗺️ nav mode =', CFG.navWanderMode); });
    root.querySelector('#__assist_applynav').addEventListener('click', () => {
      const r = parseInt(root.querySelector('#__assist_navradius').value, 10);
      if (!isNaN(r)) ASSIST.navSetMergeRadius(r);
    });
    root.querySelector('#__assist_navexport').addEventListener('click', () => ASSIST.navExport());
    root.querySelector('#__assist_navimport').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const file = inp.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => ASSIST.navImport(reader.result);
        reader.readAsText(file);
      };
      inp.click();
    });
    root.querySelector('#__assist_navclear').addEventListener('click', () => {
      if (confirm('ล้างข้อมูล nav ทั้งหมด? (ทุกแมป)')) ASSIST.navClearAll();
    });
    // ---- profile wires ----
    const profileSel = root.querySelector('#__assist_profile_sel');
    const profileName = root.querySelector('#__assist_profile_name');
    const profileEsc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const refreshProfileSelect = (selectActive = false) => {
      if (!profileSel) return;
      const active = ASSIST.activeProfile();
      const previous = profileSel.value;
      profileSel.innerHTML = ASSIST.listProfiles().map(name =>
        '<option value="' + profileEsc(name) + '">' + (name === active ? '● ' : '') + profileEsc(name) + '</option>'
      ).join('');
      profileSel.value = selectActive ? active : (ASSIST.listProfiles().includes(previous) ? previous : active);
    };
    refreshProfileSelect(true);
    window.addEventListener('assist:profiles-changed', () => refreshProfileSelect(true));
    root.querySelector('#__assist_profile_save').addEventListener('click', () => {
      const name = ((profileName && profileName.value) || '').trim();
      if (ASSIST.saveProfileAs(name)) {
        if (profileName) profileName.value = '';
        refreshProfileSelect(true);
      }
    });
    root.querySelector('#__assist_profile_use').addEventListener('click', () => {
      if (profileSel && ASSIST.switchProfile(profileSel.value)) refreshProfileSelect(true);
    });
    root.querySelector('#__assist_profile_del').addEventListener('click', () => {
      if (!profileSel) return;
      const name = profileSel.value;
      if (confirm('ลบ Profile "' + name + '"?')) {
        if (ASSIST.deleteProfile(name)) refreshProfileSelect(true);
      }
    });
    root.querySelector('#__assist_resetconfig').addEventListener('click', () => {
      if (!confirm('รีเซ็ตค่าตั้งค่ากลับเป็น Default?\n\nFarm, Combat, Heal, Storage, Weapon Set, Auto Login และค่าอื่นที่บันทึกไว้จะหายไป\nแต่จะไม่ลบ Nav / สถิติ / ข้อมูลเกม')) return;
      try { localStorage.removeItem(CFG_STORAGE_KEY); } catch (_) {}
      log('🔄 ล้าง roPureConfig_v1 แล้ว — กำลังรีเฟรชหน้า');
      setTimeout(() => location.reload(), 500);
    });
    // ---- farm map wires ----
    root.querySelector('#__assist_warptofarm').addEventListener('click', () => ASSIST.warpToFarm());
    root.querySelector('#__assist_t_warpback').addEventListener('click', () => { CFG.warpBackToFarm = !CFG.warpBackToFarm; ASSIST.toggleWarpBack(CFG.warpBackToFarm); });
    root.querySelector('#__assist_usefarmpos').addEventListener('click', () => { ASSIST.useCurrentPosAsFarm(); });
    root.querySelector('#__assist_applyfarm').addEventListener('click', () => {
      const fm = root.querySelector('#__assist_farmmap').value.trim();
      const fx = parseInt(root.querySelector('#__assist_farmx').value, 10);
      const fy = parseInt(root.querySelector('#__assist_farmy').value, 10);
      ASSIST.setFarmMap(fm, !isNaN(fx) ? fx : -999, !isNaN(fy) ? fy : -999);
    });
    const tBtn = (sel, fn, cfgKey) => root.querySelector(sel).addEventListener('click', () => { CFG[cfgKey] = !CFG[cfgKey]; fn(CFG[cfgKey]); });
    tBtn('#__assist_t_antiks', (v) => ASSIST.toggleAntiKS(v), 'antiKS');
    tBtn('#__assist_t_avoidp', (v) => ASSIST.toggleAvoidPlayers(v), 'avoidOtherPlayers');
    tBtn('#__assist_t_lowhp', (v) => ASSIST.toggleLowestHpFirst(v), 'targetLowestHpFirst');
    tBtn('#__assist_t_hiddensight', (v) => ASSIST.setHiddenSightEnabled(v), 'hiddenSightEnabled');
    tBtn('#__assist_t_wander', (v) => ASSIST.toggleWander(v), 'wanderEnabled');
    tBtn('#__assist_t_warpfind', (v) => ASSIST.toggleWarpFind(v), 'warpFindEnabled');
    tBtn('#__assist_t_warptomon', (v) => ASSIST.toggleWarpToMonster(v), 'warpToMonster');

    root.querySelector('#__assist_resetstats').addEventListener('click', () => ASSIST.resetStats());
    root.querySelector('#__assist_sellnow2').addEventListener('click', () => ASSIST.sellNow());
    root.querySelector('#__assist_clearinv').addEventListener('click', () => {
      // ห้ามล้าง inventory จริง เพราะ Weapon Set และ Storage ใช้ข้อมูลชุดนี้.
      sessionLootItems.clear();
      log('🎒 ล้างรายการของที่เก็บได้แล้ว');
    });
    root.querySelector('#__assist_exportall').addEventListener('click', () => ASSIST.exportAll());
    root.querySelector('#__assist_importall').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const file = inp.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => ASSIST.importAll(reader.result);
        reader.readAsText(file);
      };
      inp.click();
    });
    root.querySelector('#__assist_clearlog').addEventListener('click', () => {
      const box = root.querySelector('#__assist_logbox');
      if (box && box.dataset.dbg === '1') ASSIST.clearDebugLogs();
      else ASSIST.clearLogs();
      activityJournal.invalidate(box);
    });
    root.querySelector('#__assist_copylog').addEventListener('click', () => {
      const box = root.querySelector('#__assist_logbox');
      const isDebug = !!box && box.dataset.dbg === '1';
      const source = isDebug ? 'debug' : 'activity';
      const text = activityJournal.copyText(source);
      if (!text) { log('⚠️ ไม่มี ' + (isDebug ? 'Debug ' : '') + 'log ให้คัดลอก'); return; }
      const fallbackCopy = () => {
        const area = document.createElement('textarea');
        area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select();
        try { document.execCommand('copy'); log('📋 คัดลอก ' + (isDebug ? 'Debug ' : '') + 'log แล้ว'); }
        finally { area.remove(); }
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => log('📋 คัดลอก ' + (isDebug ? 'Debug ' : '') + 'log แล้ว')).catch(fallbackCopy);
      } else fallbackCopy();
    });
    root.querySelector('#__assist_clearalert')?.addEventListener('click', () => ASSIST.clearImportantLogs());
    log('🖥️ แสดง panel แล้ว (คลิกที่แถบมุมขวาบนเพื่อเปิด)');
    return root;
  }

  // ★ MONITOR_HTML — HTML สำหรับ popup window (embed ในสคริปต์ → ไม่ต้องเปิดไฟล์แยก)
  const MONITOR_HTML = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RO Monitor</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0d1117;color:#e8e8e8;font-family:'Segoe UI',system-ui,sans-serif;font-size:14px}.c{max-width:480px;margin:0 auto;padding:12px}.s{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#15171c;border-radius:8px;margin-bottom:10px}.d{width:8px;height:8px;border-radius:50%}.d.on{background:#27ae60;box-shadow:0 0 6px #27ae60}.d.off{background:#e74c3c}.card{background:#15171c;border:1px solid #2a2d35;border-radius:8px;padding:10px;margin-bottom:8px}.card h3{color:#8ab4f8;font-size:11px;text-transform:uppercase;margin-bottom:6px}.g{display:grid;grid-template-columns:1fr 1fr;gap:6px}.st{display:flex;justify-content:space-between;padding:3px 6px;background:#0d1117;border-radius:4px}.st .k{color:#9aa0a6;font-size:11px}.st .v{font-weight:600;font-size:12px}.hb{background:#2a2d35;height:16px;border-radius:8px;overflow:hidden;position:relative;margin-bottom:3px}.hf{height:100%;transition:width .3s;border-radius:8px}.hf.hp{background:linear-gradient(90deg,#e53935,#ef5350)}.hf.sp{background:linear-gradient(90deg,#1976d2,#42a5f5)}.ht{position:absolute;top:0;left:0;right:0;text-align:center;line-height:16px;font-size:10px;color:#fff;font-weight:600;text-shadow:0 0 3px rgba(0,0,0,.8)}.tg{display:flex;flex-wrap:wrap;gap:3px}.tg span{font-size:10px;padding:2px 6px;border-radius:6px;font-weight:600}.on{background:#1b5e20;color:#a5d6a7}.off{background:#4a2020;color:#ef9a9a}.cd{display:flex;justify-content:space-between;padding:2px 6px;font-size:11px;border-radius:3px;background:#0d1117;margin-bottom:2px}.cd.r{color:#27ae60}.cd.w{color:#f39c12}.disc{text-align:center;padding:40px;color:#5f6368}</style></head>
<body><div class="c">
<div class="s"><div class="d off" id="dot"></div><span id="st">รอข้อมูล...</span><span style="margin-left:auto;color:#5f6368;font-size:11px" id="ver"></span></div>
<div id="dash" style="display:none">
<div class="card"><h3>HP / SP</h3><div class="hb"><div class="hf hp" id="hpf" style="width:0"></div><div class="ht" id="hpt">?</div></div><div class="hb"><div class="hf sp" id="spf" style="width:0"></div><div class="ht" id="spt">?</div></div></div>
<div class="card"><h3>ตำแหน่ง</h3><div class="g"><div class="st"><span class="k">พิกัด</span><span class="v" id="pos">?</span></div><div class="st"><span class="k">แมป</span><span class="v" id="map">?</span></div><div class="st"><span class="k">ฟาร์ม</span><span class="v" id="fm">-</span></div><div class="st"><span class="k">สถานะ</span><span class="v" id="state">?</span></div></div></div>
<div class="card"><h3>Combat</h3><div class="g"><div class="st"><span class="k">เป้า</span><span class="v" id="tgt">-</span></div><div class="st"><span class="k">รุม</span><span class="v" id="mob">0</span></div><div class="st"><span class="k">DPS</span><span class="v" id="dps" style="color:#e67e22">0</span></div><div class="st"><span class="k">ASPD</span><span class="v" id="aspd" style="color:#3498db">0</span></div></div></div>
<div class="card"><h3>สถิติ</h3><div class="g"><div class="st"><span class="k">ฆ่า</span><span class="v" id="kills">0</span></div><div class="st"><span class="k">เก็บ</span><span class="v" id="loot">0</span></div><div class="st"><span class="k">EXP/นาที</span><span class="v" id="expmin">0</span></div><div class="st"><span class="k">Zeny/ชม</span><span class="v" id="gr" style="color:#f1c40f">0</span></div><div class="st"><span class="k">เวลา</span><span class="v" id="el">0s</span></div><div class="st"><span class="k">ตาย</span><span class="v" id="dth">0</span></div></div></div>
<div class="card"><h3>ระบบ</h3><div class="tg" id="tg"></div></div>
<div class="card" id="cdcard" style="display:none"><h3>Buff / Skill</h3><div id="cds"></div></div>
</div>
<div id="disc" class="disc"><p style="font-size:36px">🔌</p><p style="margin-top:8px">ยังไม่ได้รับข้อมูล</p></div>
</div>
<script>
function fmt(ms){const s=Math.floor(ms/1000);if(s<60)return s+'s';const m=Math.floor(s/60);if(m<60)return m+'m '+(s%60)+'s';const h=Math.floor(m/60);return h+'h '+(m%60)+'m'}
function N(n){return(n||0).toLocaleString()}
let last=null;
function update(d){last=d;document.getElementById('disc').style.display='none';document.getElementById('dash').style.display='';document.getElementById('dot').className='d on';document.getElementById('st').textContent='🟢 '+new Date(d.t).toLocaleTimeString();document.getElementById('ver').textContent='v'+(d.version||'?');
const hp=d.hpMax>0?(d.hp/d.hpMax*100):0;document.getElementById('hpf').style.width=Math.max(0,Math.min(100,hp))+'%';document.getElementById('hpt').textContent=(d.hp??'?')+' / '+(d.hpMax||'?')+' ('+(hp?hp.toFixed(0):'?')+'%)';
const sp=d.spMax>0?(d.sp/d.spMax*100):0;document.getElementById('spf').style.width=Math.max(0,Math.min(100,sp))+'%';document.getElementById('spt').textContent=(d.sp??'?')+' / '+(d.spMax||'?');
document.getElementById('pos').textContent=d.player?.x!=null?'('+d.player.x.toFixed(0)+','+d.player.y.toFixed(0)+')':'?';document.getElementById('map').textContent=d.map||'?';document.getElementById('fm').textContent=d.farmMap||'-';
let st=d.isDead?'☠️ ตาย':(d.isResting?'🪑 นั่ง':'🟢 ปกติ');if(d.sellState&&d.sellState!=='IDLE')st+=' | 💰'+d.sellState;if(d.storageState&&d.storageState!=='IDLE')st+=' | 🏦'+d.storageState;document.getElementById('state').textContent=st;
const t=d.target;document.getElementById('tgt').textContent=t?t.name+' ('+(t.dist?t.dist.toFixed(1):'?')+')':'-';document.getElementById('mob').textContent=d.mobAttackers||0;
document.getElementById('dps').textContent=d.stats?.dps>0?N(d.stats.dps):'—';document.getElementById('aspd').textContent=d.stats?.aspd>0?d.stats.aspd.toFixed(1):'—';
document.getElementById('kills').textContent=N(d.stats?.kills);document.getElementById('loot').textContent=N(d.stats?.itemsLooted);document.getElementById('expmin').textContent=N(d.stats?.expPerMin);
document.getElementById('gr').textContent=d.stats?.goldRatePerHour>0?N(d.stats.goldRatePerHour)+'z':'—';document.getElementById('el').textContent=fmt(d.stats?.elapsedMs||0);document.getElementById('dth').textContent=d.stats?.deaths||0;
const T=d.toggles||{};const tl=[['loot','📦'],['heal','💉'],['rest','🪑'],['combat','⚔️'],['skill','🔮'],['buff','✨'],['sell','💰'],['storage','🏦']];document.getElementById('tg').innerHTML=tl.map(([k,l])=>'<span class="'+(T[k]?'on':'off')+'">'+l+'</span>').join('');
const cd=[...(d.buffs||[]).map(b=>({n:'✨ '+b.name,r:b.remainingMs})),...(d.skills||[]).map(s=>({n:'🔮 '+s.name,r:s.remainingMs}))];const cc=document.getElementById('cdcard');if(cd.length>0){cc.style.display='';document.getElementById('cds').innerHTML=cd.map(c=>{const rd=c.r<=0;const rs=Math.ceil(c.r/1000);const str=rd?'พร้อม':(rs>=60?Math.floor(rs/60)+'นาที '+(rs%60)+'s':rs+'s');return '<div class="cd '+(rd?'r':'w')+'"><span>'+c.n+'</span><span>'+str+'</span></div>'}).join('')}else cc.style.display='none'}
window.onData=update;
setInterval(()=>{if(last&&Date.now()-last.t>5000){document.getElementById('dot').className='d off';document.getElementById('st').textContent='🔴 ขาดการเชื่อมต่อ';document.getElementById('dash').style.opacity='.4'}else{document.getElementById('dash').style.opacity='1'}},2000);
</script></body></html>`;

  // ★ Monitor — ส่งข้อมูลไป popup window (origin เดียวกับเกม → ไม่มีปัญหา file://)
  let monitorWin = null;   // popup window reference
  let monitorChannel = null;
  try { monitorChannel = new BroadcastChannel('ro-pure-monitor'); } catch (_) {}
  const MONITOR_STORAGE_KEY = 'roPureMonitorData';
  let lastMonitorSendAt = 0;
  function openMonitor() {
    if (monitorWin && !monitorWin.closed) { monitorWin.focus(); return; }
    monitorWin = window.open('', 'roMonitor', 'width=500,height=700,scrollbars=yes,resizable=yes');
    if (!monitorWin) { log('⚠️ popup ถูกบล็อก — อนุญาต popup สำหรับเว็บนี้'); return; }
    monitorWin.document.write(MONITOR_HTML);
    monitorWin.document.close();
    log('🖥️ เปิด Monitor แล้ว');
  }
  // ★ เปิด remote monitor ในแท็บใหม่ — ใช้ relay server URL + player_id ปัจจุบัน
  //   แสดงเฉพาะเมื่อ relay เชื่อมต่อแล้ว (เช็คใน renderUI)
  function openRemoteMonitor() {
    if (!playerId) { log('⚠️ ยังไม่รู้ player_id — รอ SPAWN ก่อน'); return; }
    const url = CFG.monitorServerUrl
      .replace(/^wss?:\/\//, '')   // ตัด ws/wss prefix → เหลือ host
      .replace(/\/.*$/, '');        // ตัด path ถ้ามี
    // protocol ตามหน้าเกม (https → https, http → http)
    const proto = location.protocol;
    const pidHex = playerId.toString(16);
    const fullUrl = proto + '//' + url + '/#pid=' + pidHex;
    log('🌐 เปิด Remote Monitor:', fullUrl);
    window.open(fullUrl, '_blank');
  }
  // ★ Remote relay WebSocket state (ประกาศก่อนใช้ — กัน TDZ)
  let relayWs = null;
  let relayReconnectAt = 0;
  let relayStatus = 'disabled';        // 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  let relayStatusText = 'ปิด';          // ข้อความสั้น
  let relayConnectedAt = 0;             // เวลาที่เชื่อมต่อสำเร็จ
  let relayLastDataAt = 0;              // เวลาส่งข้อมูลล่าสุด
  let relayDataCount = 0;               // จำนวนครั้งที่ส่งข้อมูลแล้ว
  function sendMonitorData() {
    const now = nowMs();
    const interval = CFG.monitorSendIntervalMs || 3000;
    if (now - lastMonitorSendAt < interval) return;
    lastMonitorSendAt = now;
    const s = ASSIST.getStats();
    const tgt = ASSIST.getTarget();
    const cds = ASSIST.getBuffCountdowns ? ASSIST.getBuffCountdowns() : [];
    const skCds = ASSIST.getSkillCooldowns ? ASSIST.getSkillCooldowns() : [];
    const payload = {
      t: now, version: VERSION,
      hp: hp.cur, hpMax: hp.max, hpPct: hpPct(),
      sp: sp.cur, spMax: sp.max,
      player: { x: player.x, y: player.y, name: playerName, id: playerId },
      map: currentMap, farmMap: CFG.farmMap, zeny: playerZeny, gameServer: gameServerUrl,
      target: (() => {
        if (!tgt) return null;
        // ★ resolve entity จริงเพื่อเอา name/hp/hpMax (tgt จาก ASSIST.getTarget() มีแค่ id hex string)
        const tid = parseInt(tgt.id, 16);
        const m = entities.get(tid);
        return { name: (m && m.name) || tgt.id, dist: target ? target.lastDist : null, hp: m ? m.hp : null, hpMax: m ? m.hpMax : null, id: tid };
      })(),
      stats: { kills: s.kills, itemsLooted: s.itemsLooted, expPerMin: s.expPerMin, expGained: s.expGained, baseExpGained: s.baseExpGained, jobExpGained: s.jobExpGained, dps: s.dps, aspd: s.aspd, goldRatePerHour: s.goldRatePerHour, deaths: s.deaths, elapsedMs: s.elapsedMs },
      toggles: { loot: CFG.lootEnabled, heal: CFG.healEnabled, rest: CFG.restEnabled, combat: CFG.combatEnabled, skill: CFG.skillEnabled, buff: CFG.buffEnabled, sell: CFG.sellEnabled, storage: CFG.storageEnabled },
      mobAttackers: getMobAttackerCount(),
      // ★ mobAttackerList — สำหรับแสดงรูปมอน + HP bar ใน monitor (mirror dashboard mobAttackerList)
      mobAttackerList: (() => {
        const nowA = nowMs();
        const out = [];
        const seen = new Set();
        // เป้าหมายปัจจุบันก่อน
        if (tgt) { out.push({ id: tgt.id, name: tgt.name || tgt.id?.toString(16), hp: tgt.hp, hpMax: tgt.hpMax, isTarget: true }); seen.add(tgt.id); }
        for (const [id, t] of mobAttackers) {
          if (seen.has(id)) continue;
          if (nowA - t >= CFG.fleeMobWindowMs) continue;
          const m = entities.get(id);
          if (!m || !m.alive || m.x == null) continue;
          out.push({ id, name: m.name || id.toString(16), hp: m.hp, hpMax: m.hpMax, isTarget: false });
          if (out.length >= 6) break;
        }
        return out;
      })(),
      buffs: cds.map(b => ({ name: b.name, remainingMs: b.remainingMs, itemId: b.itemId })),
      skills: skCds.map(sk => ({ name: sk.name, remainingMs: sk.remainingMs })),
      // ★ inventory — สำหรับแสดงรูป item + ชื่อ + จำนวนใน monitor
      inventory: [...inventory.entries()].filter(([id, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, count]) => ({ itemId: Number(id), name: itemDisplayName(Number(id)), count })),
      isDead: isDead, isResting: isResting,
      sellState: sellState, storageState: storageState,
      // ★ relay server status (ส่งไปแสดงใน remote monitor ด้วย)
      relay: { ...relayStatusInfo(), url: CFG.monitorServerUrl, enabled: CFG.monitorServerEnabled },
      // ★ chat history — ส่งแชทล่าสุด 30 ข้อความ
      chatHistory: chatBuf.slice(-30),
      // ★ important log — ส่ง log สำคัญล่าสุด 30 รายการ
      alerts: activityJournal.read('important').slice(-30),
      // ★ map entities — สำหรับแสดง dots บนแผนที่ใน remote monitor
      mapEntities: (() => {
        const now = nowMs(); const out = [];
        const STALE_MS = 60000;
        // ★★ prioritize: boss > mini boss > monster > warp > NPC > player
        //   เพื่อให้ entities สำคัญโผล่ในแผนที่ก่อน (กันผู้เล่นเยอะกิน slot)
        const priority = (e) => {
          if (e._isBoss) return 0;
          if (e._isMiniBoss) return 1;
          if (e.kind === 1) return 2;       // monster
          if (e._isWarp) return 3;          // warp
          if (e.kind === 2) return 4;       // NPC
          return 5;                         // player (lowest)
        };
        const valid = [];
        for (const e of entities.values()) {
          if (e.id === playerId) continue;
          if (e.x == null || !e.alive) continue;
          if (isStaleId(e.id, now)) continue;
          if (e.kind !== 2) {
            if (!e._lastSeenAt) e._lastSeenAt = now;
            if (now - e._lastSeenAt > STALE_MS) {
              if ((e._isMiniBoss || e._isBoss) && bossAlertedIds.has(e.id)) {
                bossAlertedIds.delete(e.id);
                entities.delete(e.id);
                log('👹 Mini Boss หายไป (ไม่ได้รับตำแหน่ง 60s) — จะ alert ใหม่เมื่อเกิดใหม่');
              }
              continue;
            }
          }
          valid.push(e);
        }
        // ★ sort by priority → important entities first
        valid.sort((a, b) => priority(a) - priority(b));
        for (const e of valid) {
          if (out.length >= 50) break;
          out.push({ id: e.id.toString(16), kind: e.kind || 0, x: e.x, y: e.y, name: e.name || '', hp: e.hp, hpMax: e.hpMax, isBoss: !!e._isBoss, isMiniBoss: !!e._isMiniBoss, isWarp: !!e._isWarp });
        }
        return out;
      })(),
      targetId: target ? target.id.toString(16) : null,
      // ★ ground items — ของที่ตกอยู่บนพื้น (สำหรับแสดงบนแผนที่)
      groundItems: (() => {
        const out = [];
        const now = nowMs();
        for (const d of recentDrops.values()) {
          if (d.x == null) continue;
          // ข้ามของที่เก็บไปแล้ว (ถ้าไม่อยู่ใน queue = เก็บแล้ว)
          if (!queue.has(d.dropId) && !warpQueue.has(d.dropId)) continue;
          out.push({ dropId: d.dropId, itemId: d.itemId, name: itemDisplayName(d.itemId), x: d.x, y: d.y });
          if (out.length >= 30) break;
        }
        return out;
      })(),
    };
    // ★ ส่งผ่าน BroadcastChannel (ถ้ามี) + localStorage (fallback)
    if (monitorChannel) try { monitorChannel.postMessage(payload); } catch (_) {}
    try { localStorage.setItem(MONITOR_STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
    // ★ ส่งตรงเข้า popup window (origin เดียวกัน — ทำงานเสมอ)
    if (monitorWin && !monitorWin.closed) {
      try { if (monitorWin.onData) monitorWin.onData(payload); } catch (_) {}
    }
    // ★ ส่งไป relay server (ดูจากมือถือ/เครื่องอื่นได้)
    if (relayWs && relayWs.readyState === 1 && playerId != null) {
      try { relayWs.send(JSON.stringify({ type: 'data', payload })); relayLastDataAt = nowMs(); relayDataCount++; } catch (_) {}
    }
  }
  function setRelayStatus(status, text) {
    relayStatus = status;
    relayStatusText = text;
    if (status === 'connected' && relayConnectedAt === 0) relayConnectedAt = nowMs();
  }
  function relayStatusInfo() {
    if (!CFG.monitorServerEnabled) return { status: 'disabled', text: 'ปิด', color: '#9aa0a6' };
    if (relayStatus === 'connected') {
      const uptime = relayConnectedAt > 0 ? fmtMs(nowMs() - relayConnectedAt) : '—';
      const sinceData = relayLastDataAt > 0 ? Math.round((nowMs() - relayLastDataAt) / 1000) + 'วิที่แล้ว' : '—';
      return { status: 'connected', text: `🟢 เชื่อมแล้ว ${uptime} • ${relayDataCount}ครั้ง • ${sinceData}`, color: '#2ecc71' };
    }
    if (relayStatus === 'connecting')  return { status: 'connecting',  text: '🟡 กำลังเชื่อม...', color: '#f1c40f' };
    if (relayStatus === 'reconnecting') {
      const wait = relayReconnectAt > 0 ? Math.max(0, Math.ceil((relayReconnectAt - nowMs()) / 1000)) : 0;
      return { status: 'reconnecting', text: `🔄 รอเชื่อมใหม่ใน ${wait}วิ`, color: '#e67e22' };
    }
    if (relayStatus === 'error')       return { status: 'error',       text: '🔴 ผิดพลาด (รอเชื่อมใหม่)', color: '#e74c3c' };
    return { status: 'idle', text: '⚪ ยังไม่เชื่อม', color: '#9aa0a6' };
  }
  function connectRelay() {
    if (!CFG.monitorServerEnabled || !CFG.monitorServerUrl) { setRelayStatus('disabled', 'ปิด'); return; }
    if (relayWs && (relayWs.readyState === 0 || relayWs.readyState === 1)) return;  // กำลังเชื่อมหรือเชื่อมแล้ว
    if (nowMs() < relayReconnectAt) {
      // แสดงสถานะ "รอเชื่อมใหม่" ถ้ายังอยู่ใน cooldown
      if (relayStatus !== 'connected' && relayStatus !== 'connecting') setRelayStatus('reconnecting', 'รอเชื่อมใหม่');
      return;
    }
    setRelayStatus('connecting', 'กำลังเชื่อม...');
    try {
      log('🌐 กำลังเชื่อม relay server:', CFG.monitorServerUrl);
      relayWs = new WebSocket(CFG.monitorServerUrl);
      relayWs.onopen = () => {
        setRelayStatus('connected', 'เชื่อมแล้ว');
        relayConnectedAt = nowMs();
        log('✅ เชื่อม relay server แล้ว:', CFG.monitorServerUrl);
        // ส่ง register
        if (playerId != null) {
          try { relayWs.send(JSON.stringify({ type: 'register', playerId: playerId.toString(16), playerName: playerName || '' })); } catch (_) {}
          // ★ ส่ง telegram config ทันที (ถ้ามี) — sync ไป relay server
          if (CFG.telegramBotToken && CFG.telegramChatId) {
            try { relayWs.send(JSON.stringify({ type: 'setTelegram', botToken: CFG.telegramBotToken, chatId: CFG.telegramChatId })); } catch (_) {}
            log('📨 ส่ง Telegram config ไป relay แล้ว');
          }
          // ★ ส่งแจ้งเตือนยืนยันการเชื่อมต่อ
          sendRelayAlert('🌐 เชื่อมต่อระบบ Remote Monitor แล้ว');
        } else {
          log('⚠️ ยังไม่มี player_id — ระบบจะ register ทันทีเมื่อ SPAWN มา');
        }
      };
      relayWs.onclose = (ev) => {
        const wasConnected = relayStatus === 'connected';
        relayWs = null;
        relayConnectedAt = 0;
        relayReconnectAt = nowMs() + 5000;   // reconnect ใน 5s
        setRelayStatus('reconnecting', 'รอเชื่อมใหม่ใน 5วิ');
        log(`🔌 หลุดจาก relay server (code=${ev.code}) — เชื่อมใหม่ใน 5วิ`, CFG.monitorServerUrl);
        if (ev.code === 1006 && !wasConnected) {
          log('💡 หมายเหตุ: code=1006 มักเกิดจากเซิร์ฟเวอร์ตอบกลับไม่ได้/proxy ผิด/SSL ไม่ตรง — ตรวจสอบว่า relay server รันอยู่และ nginx ส่ง WS ผ่าน');
        }
      };
      relayWs.onerror = () => {
        setRelayStatus('error', 'ผิดพลาด');
        log('❌ relay server error:', CFG.monitorServerUrl);
        try { relayWs.close(); } catch (_) {}
      };
      relayWs.onmessage = (ev) => {
        // ★ รับ message จาก relay server (telegramSaved, telegramConfig)
        let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.type === 'telegramSaved') {
          if (m.ok) {
            log('📨 บันทึก Telegram config แล้ว');
            updateTelegramStatus('✅ บันทึกแล้ว — แจ้งเตือนจะส่งไป Telegram เมื่อมี log สำคัญ', '#2ecc71');
          } else {
            log('⚠️ บันทึก Telegram config ล้มเหลว:', m.error || '?');
            updateTelegramStatus('❌ บันทึกไม่สำเร็จ: ' + (m.error || '?'), '#e74c3c');
          }
        } else if (m.type === 'telegramConfig') {
          // relay บอกว่ามี config อยู่แล้วหรือไม่
          if (m.configured) {
            updateTelegramStatus('✅ ตั้งค่าแล้ว (Chat ID: ' + m.chatId + ') — แจ้งเตือนจะส่งไป Telegram', '#2ecc71');
          } else {
            updateTelegramStatus('⚠️ ยังไม่ได้ตั้งค่า — กรอก Bot Token + Chat ID แล้วกด บันทึก', '#f39c12');
          }
        }
        // ★ command จาก remote monitor → toggle on/off หรือ action (sellNow, depositNow)
        else if (m.type === 'command' && m.system && m.action) {
          // ★ action พิเศษ (ไม่ใช่ toggle): sellNow, depositNow, buffNow, skillNow
          if (m.action === 'now') {
            const actionMethod = m.system + 'Now';
            if (typeof ASSIST[actionMethod] === 'function') {
              ASSIST[actionMethod]();
              log('🎮 Remote action:', m.system, 'now');
              try { relayWs.send(JSON.stringify({ type: 'commandAck', system: m.system, action: m.action, ok: true })); } catch (_) {}
            } else {
              try { relayWs.send(JSON.stringify({ type: 'commandAck', system: m.system, action: m.action, ok: false, error: 'unknown action' })); } catch (_) {}
            }
          } else {
            const method = m.system + (m.action === 'off' ? 'Off' : 'On');
            if (typeof ASSIST[method] === 'function') {
              ASSIST[method]();
              log('🎮 Remote command:', m.system, m.action);
              try { relayWs.send(JSON.stringify({ type: 'commandAck', system: m.system, action: m.action, ok: true })); } catch (_) {}
            } else {
              log('⚠️ Remote command: method "' + method + '" ไม่มี');
              try { relayWs.send(JSON.stringify({ type: 'commandAck', system: m.system, action: m.action, ok: false, error: 'unknown method' })); } catch (_) {}
            }
          }
        }
        // ★ chat จาก remote monitor → ส่งไป game server
        else if (m.type === 'chat' && m.message != null) {
          if (sendChat(m.message, m.chatType || 0)) {
            log('💬 Remote chat (' + (m.chatType === 1 ? 'shout' : 'nearby') + '):', m.message);
            try { relayWs.send(JSON.stringify({ type: 'chatAck', ok: true })); } catch (_) {}
          } else {
            log('⚠️ Remote chat: ส่งไม่ได้ (activeWS ไม่พร้อม?)');
            try { relayWs.send(JSON.stringify({ type: 'chatAck', ok: false, error: 'not connected' })); } catch (_) {}
          }
        }
      };
    } catch (e) {
      setRelayStatus('error', 'สร้าง WS ไม่ได้');
      log('❌ สร้าง relay WebSocket ไม่ได้:', e.message);
      relayReconnectAt = nowMs() + 5000;
    }
  }
  // ★ ส่ง register ทันทีเมื่อได้ player_id (เรียกจาก SPAWN/SELECT_CHAR handler)
  function relayRegisterPlayer() {
    if (relayWs && relayWs.readyState === 1 && playerId != null) {
      try {
        relayWs.send(JSON.stringify({ type: 'register', playerId: playerId.toString(16), playerName: playerName || '' }));
        log('📡 ลงทะเบียน (register) player_id ' + playerId.toString(16) + ' ไปยัง relay แล้ว');
        // ★ ส่ง telegram config ทันที (ถ้ามี) — sync ไป relay server
        if (CFG.telegramBotToken && CFG.telegramChatId) {
          relayWs.send(JSON.stringify({ type: 'setTelegram', botToken: CFG.telegramBotToken, chatId: CFG.telegramChatId }));
          log('📨 ส่ง Telegram config ไป relay แล้ว');
        }
        // ★ ขอ telegram config status หลัง register (เพื่อแสดงใน UI ว่าตั้งไว้แล้วหรือยัง)
        relayWs.send(JSON.stringify({ type: 'getTelegram' }));
        // ★ ส่งแจ้งเตือนยืนยันการเชื่อมต่อ
        sendRelayAlert('🌐 เชื่อมต่อระบบ Remote Monitor แล้ว');
      } catch (_) {}
    }
  }
  // ★ ส่ง alert ไป relay server (relay จะ forward ไป Telegram ถ้ามี config)
  function sendRelayAlert(msg) {
    if (relayWs && relayWs.readyState === 1 && playerId != null) {
      try { relayWs.send(JSON.stringify({ type: 'alert', msg })); } catch (_) {}
    }
  }
  // ★ บันทึก telegram config (botToken + chatId) ที่ relay server
  function sendSetTelegram(botToken, chatId) {
    if (relayWs && relayWs.readyState === 1) {
      try { relayWs.send(JSON.stringify({ type: 'setTelegram', botToken, chatId: String(chatId) })); return true; } catch (_) {}
    }
    return false;
  }
  // ★ ลบ telegram config (ส่งค่าว่างไป)
  function sendClearTelegram() {
    if (relayWs && relayWs.readyState === 1) {
      try { relayWs.send(JSON.stringify({ type: 'setTelegram', botToken: '', chatId: '' })); return true; } catch (_) {}
    }
    return false;
  }
  // ★ อัปเดตสถานะ Telegram ใน UI
  function updateTelegramStatus(text, color) {
    const el = document.getElementById('__assist_tg_status');
    if (el) { el.innerHTML = text; el.style.color = color || '#9aa0a6'; }
  }

  // ---------- render loop ----------
  function fmtMs(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ' + (s % 60) + 's';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }
  function renderUI(root = document.getElementById('__assist_root')) {
    if (!root) return;
    const pct = hpPct();
    const pctNum = pct == null ? null : pct;
    const hpText = hp.cur != null ? `${hp.cur}/${hp.max} (${pctNum != null ? pctNum.toFixed(0) : '?'}%)` : 'HP ?';

    // mini-bar
    const hpEl = root.querySelector('.hptext');
    const fill = root.querySelector('.hpfill');
    // version
    const verEl = root.querySelector('[data-version]');
    if (verEl) verEl.textContent = 'v' + VERSION;
    if (hpEl) hpEl.textContent = hpText;
    if (fill) {
      const w = pctNum != null ? Math.max(0, Math.min(100, pctNum)) : 0;
      fill.style.width = w + '%';
      fill.className = 'hpfill' + (w < 25 ? '' : w < 50 ? ' warn' : ' good');
    }
    root.querySelectorAll('.pill').forEach(p => {
      let on, label;
      if (p.hasAttribute('data-masterbot')) { on = masterBot.enabled(); label = '⏻ BOT'; }
      else if (p.hasAttribute('data-loot')) { on = CFG.lootEnabled; label = '📦 Loot'; }
      else if (p.hasAttribute('data-heal')) { on = CFG.healEnabled; label = '💉 Heal'; }
      else if (p.hasAttribute('data-rest')) { on = CFG.restEnabled; label = '🪑 Rest'; }
      else if (p.hasAttribute('data-combat')) { on = CFG.combatEnabled; label = '⚔️ Combat'; }
      else if (p.hasAttribute('data-weapon')) {
        on = CFG.weaponSetEnabled;
        label = weaponSwap ? ('🗡️ ' + weaponSwap.setName + ' ⏳') : ('🗡️ ' + weaponActiveSetName);
      }
      else if (p.hasAttribute('data-skill')) { on = CFG.skillEnabled; label = '🔮 Skill'; }
      else if (p.hasAttribute('data-buff')) { on = CFG.buffEnabled; label = '✨ Buff'; }
      else if (p.hasAttribute('data-abbuff')) {
        on = CFG.abBuffEnabled;
        label = '⛪ AB Buff';
      }
      else if (p.hasAttribute('data-sell')) { on = CFG.sellEnabled; label = '💰 Sell'; }
      else if (p.hasAttribute('data-storage')) { on = CFG.storageEnabled; label = '🏦 Kafra'; }
      else if (p.hasAttribute('data-auto')) {
        on = CFG.autoLoginEnabled || CFG.autoRefreshEnabled;
        if (CFG.autoLoginEnabled && CFG.autoRefreshEnabled) label = '🤖 Auto';
        else if (CFG.autoLoginEnabled) label = '🤖 Login';
        else if (CFG.autoRefreshEnabled) label = '🤖 Refresh';
        else label = '🤖 Auto';
      }
      else return;
      p.className = 'pill ' + (on ? 'on' : 'off');
      if (p.hasAttribute('data-masterbot')) {
        p.textContent = label + ': ' + (on ? 'ON' : 'PAUSED');
        p.title = on ? 'คลิกเพื่อหยุด automation ทั้งหมด' : 'คลิกเพื่อเริ่ม automation ตามค่าระบบเดิม';
      } else if (p.hasAttribute('data-weapon')) {
        p.textContent = label;
        p.title = weaponSwap ? 'กำลังเปลี่ยน Weapon Set' : 'คลิกเพื่อตั้ง Weapon Set';
      } else {
        p.textContent = label + ': ' + (on ? 'ON' : 'OFF');
        if (p.hasAttribute('data-abbuff')) p.title = 'คลิกเพื่อ' + (on ? 'ปิด' : 'เปิด') + 'ระบบ AB Buff · สถานะ: ' + abBuffState;
        if (p.hasAttribute('data-auto')) p.title = 'Auto-Login: ' + (CFG.autoLoginEnabled ? 'ON' : 'OFF') + ' · Auto-Refresh: ' + (CFG.autoRefreshEnabled ? 'ON' : 'OFF') + ' · คลิกเพื่อเปิดแท็บ Auto';
      }
    });
    if (isDead) root.querySelector('#__assist_bar').classList.add('__assist_dead');
    else root.querySelector('#__assist_bar').classList.remove('__assist_dead');

    // stats page
    const s = ASSIST.getStats();
    const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = val; };
    set('[data-hp]', hpText);
    set('[data-pos]', player.x != null ? `(${player.x.toFixed(1)}, ${player.y.toFixed(1)})` : '?');
    // ★ farm map status: แสดงแมปปัจจุบัน + เตือนถ้าอยู่ผิดแมปฟาร์ม
    {
      const farmInfo = CFG.farmMap
        ? (currentMap === CFG.farmMap ? `${currentMap} ✅` : `${currentMap || '?'} ⚠️ (ฟาร์ม: ${CFG.farmMap})`)
        : (currentMap || '?');
      set('[data-farmmap]', farmInfo);
    }
    set('[data-pid]', playerId ? playerId.toString(16) : '?');
    set('[data-state]', isDead ? '☠️ ตาย' : (isResting ? '🪑 นั่งพัก' : (activeWS && activeWS.readyState === 1 ? '🟢 เชื่อมต่อ' : '🔴 ไม่ได้ต่อ')));
    // ★ Remote Monitor status (relay server) + แสดง/ซ่อนปุ่ม 🌐 ใน mini-bar
    {
      const r = relayStatusInfo();
      const el = root.querySelector('[data-relay]');
      if (el) { el.textContent = r.text; el.style.color = r.color; }
      // ★ ปุ่ม 🌐 แสดงเฉพาะเมื่อ relay เชื่อมต่อแล้ว + มี player_id
      const showRemote = (r.status === 'connected' && playerId);
      const remoteBtn = root.querySelector('[data-remote]');
      if (remoteBtn) remoteBtn.style.display = showRemote ? '' : 'none';
      // ★ ปุ่มเปิด remote monitor ใน sub-tab อื่นๆ ก็แสดงเมื่อเชื่อมต่อแล้วเช่นกัน
      const openRemoteBtn = root.querySelector('#__assist_openremote');
      if (openRemoteBtn) openRemoteBtn.style.display = showRemote ? '' : 'none';
    }
    set('[data-kills]', s.kills);
    set('[data-looted]', s.itemsLooted);
    set('[data-exp]', s.expGained.toLocaleString());
    set('[data-expmin]', s.expPerMin.toLocaleString());
    set('[data-dps]', s.dps > 0 ? s.dps.toLocaleString() : '—');
    set('[data-aspd]', s.aspd > 0 ? s.aspd.toFixed(1) : '—');
    set('[data-goldrate]', s.goldRatePerHour > 0 ? s.goldRatePerHour.toLocaleString() + 'z' : '—');
    set('[data-elapsed]', fmtMs(s.elapsedMs));
    set('[data-deaths]', s.deaths);
    set('[data-zeny]', sessionZeny().toLocaleString() + 'z');
    const itemsEl = root.querySelector('[data-items]');
    if (itemsEl) {
      // inventory จริงมีทุกชิ้นตั้งแต่ 0x38 ตอนเข้าเกมเพื่อ Weapon/Storage;
      // สถิติจึงใช้เฉพาะจำนวนที่เพิ่มเข้ากระเป๋าหลัง script เริ่มทำงาน.
      const sessionLoot = [...sessionLootItems.entries()].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
      itemsEl.innerHTML = sessionLoot.length ? sessionLoot.map(([id, count]) => {
        const numId = Number(id);
        const price = itemPrice(numId);
        const zeny = price ? ` <span style="color:#f1c40f">${(price * count).toLocaleString()}z</span>` : '';
        const icon = itemDB.loaded ? `<img src="${itemIconUrl(numId)}" style="width:16px;height:16px;vertical-align:middle" onerror="this.style.display='none'"> ` : '';
        // ★ toggle 3-state: เก็บ(เทา) / ขาย(ส้ม) / ฝาก(เขียว) — กดวน
        const action = getItemAction(numId);
        const actionLabel = action === 'sell' ? 'ขาย' : (action === 'deposit' ? 'ฝาก' : 'เก็บ');
        const actionColor = action === 'sell' ? '#e67e22' : (action === 'deposit' ? '#27ae60' : '#6b7280');
        const bgColor = action === 'sell' ? 'rgba(230,126,34,.12)' : (action === 'deposit' ? 'rgba(39,174,96,.12)' : 'transparent');
        return `<div style="background:${bgColor};border-radius:3px;padding:2px 4px">${icon}${itemDisplayName(numId)} ×${count}${zeny} <button data-itemaction="${numId}" style="float:right;font-size:10px;color:#fff;background:${actionColor};border:none;border-radius:3px;padding:1px 6px;cursor:pointer;font-family:inherit">${actionLabel}</button></div>`;
      }).join('') : '(ยังไม่มี)';
      // wire toggle buttons (วน keep→sell→deposit→keep)
      itemsEl.querySelectorAll('button[data-itemaction]').forEach(btn => {
        btn.onclick = () => { const id = parseInt(btn.getAttribute('data-itemaction'), 10); cycleItemAction(id); };
      });
    }
    // combat stats
    const tgt = ASSIST.getTarget();
    const agg = ASSIST.getAggro();
    set('[data-combat-target]', tgt ? (tgt.id + ' pending:' + tgt.pending) : '(none)');
    set('[data-combat-aggro]', agg.mobAttackers + ' ตี / ' + agg.aggro + ' aggro / ' + agg.threat + ' threat / ' + agg.monstersNearby + ' รอบ');
    set('[data-weaponstate]', CFG.weaponSetEnabled ? (weaponSwap ? 'กำลังเปลี่ยน: ' + weaponSwap.setName : weaponActiveSetName) : 'OFF');
    // inventory + sell state
    set('[data-inventory]', inventory.size + ' ชนิด' + (inventoryFull ? ' ⚠️เต็ม' : ''));
    set('[data-sellstate]', CFG.sellEnabled ? (sellState === 'IDLE' ? 'ON (รอ trigger)' : sellState) : 'OFF');
    set('[data-storagestate]', CFG.storageEnabled ? (storageState === 'IDLE' ? 'ON (รอ trigger)' : storageState) : 'OFF');

    // config page — ซิงค์ค่าปัจจุบันเข้า input (กันเขียนทับเวลา user กำลังพิมพ์)
    const lootBtn = root.querySelector('#__assist_lootbtn');
    const healBtn = root.querySelector('#__assist_healbtn');
    const warpBtn = root.querySelector('#__assist_warpbtn');
    if (lootBtn) { lootBtn.textContent = 'Loot: ' + (CFG.lootEnabled ? 'ON' : 'OFF'); lootBtn.className = CFG.lootEnabled ? 'on' : 'off'; }
    if (healBtn) { healBtn.textContent = 'Heal: ' + (CFG.healEnabled ? 'ON' : 'OFF'); healBtn.className = CFG.healEnabled ? 'on' : 'off'; }
    if (warpBtn) { warpBtn.textContent = 'วาร์ปไปเก็บของ: ' + (CFG.warpLootEnabled ? 'ON' : 'OFF') + (warpQueue.size ? ` (${warpQueue.size})` : ''); warpBtn.className = CFG.warpLootEnabled ? 'on' : 'off'; }
    const lootQueueRole = root.querySelector('#__assist_lootqueuerole');
    if (lootQueueRole && !isEditing(lootQueueRole)) lootQueueRole.value = CFG.lootQueueRole;
    const lootQueueSendAllBtn = root.querySelector('#__assist_lootqueuesendall');
    if (lootQueueSendAllBtn) {
      const enabled = !!CFG.lootQueueSendAll;
      const farmer = CFG.lootQueueRole === 'farm';
      lootQueueSendAllBtn.textContent = '📦 ส่งทุกอย่าง: ' + (enabled ? 'ON' : 'OFF');
      lootQueueSendAllBtn.className = enabled ? 'on' : 'off';
      lootQueueSendAllBtn.disabled = !farmer;
      lootQueueSendAllBtn.style.opacity = farmer ? '' : '.55';
      lootQueueSendAllBtn.title = farmer
        ? 'เปิดแล้วส่ง drop ทุกชนิดเข้าคิว; รายการพิเศษจะยังถูกเก็บไว้'
        : 'มีผลเมื่อเลือกหน้าที่เป็น ฟาร์ม เท่านั้น';
    }
    const lootQueueTransportSelect = root.querySelector('#__assist_lootqueuetransport');
    if (lootQueueTransportSelect && !isEditing(lootQueueTransportSelect)) lootQueueTransportSelect.value = lootQueueTransportMode();
    root.querySelectorAll('[data-lootqueue-transport]').forEach(el => {
      el.style.display = el.getAttribute('data-lootqueue-transport') === lootQueueTransportMode() ? '' : 'none';
    });
    for (const [sel, value] of [
      ['#__assist_lootqueuelocalurl', CFG.lootQueueLocalUrl], ['#__assist_lootqueuecloudflareurl', CFG.lootQueueCloudflareUrl], ['#__assist_lootqueuegroup', CFG.lootQueueGroup],
      ['#__assist_lootqueuehomemap', CFG.lootQueueHomeMap], ['#__assist_lootqueuehomex', CFG.lootQueueHomeX], ['#__assist_lootqueuehomey', CFG.lootQueueHomeY], ['#__assist_lootqueueclaimdelay', CFG.lootQueueClaimDelayMs], ['#__assist_lootqueuesettle', CFG.lootQueueNearbySettleMs], ['#__assist_lootqueuewarpcooldown', CFG.lootQueueWarpCooldownMs], ['#__assist_lootqueuepickupretries', CFG.lootQueuePickupRetryCount], ['#__assist_lootqueuetimeout', CFG.lootQueueActionTimeoutMs],
    ]) syncInput(sel, value);
    const lootQueueStatusEl = root.querySelector('#__assist_lootqueuestatus');
    if (lootQueueStatusEl) {
      const status = lootQueue.status();
      const transportInfo = status.transportLabel + (status.lastClaimRttMs != null ? ' · claim ' + status.lastClaimRttMs + 'ms' : '')
        + (status.transportReconnectCount ? ' · reconnect ' + status.transportReconnectCount : '');
      lootQueueStatusEl.textContent = status.role === 'off' ? '(ปิด)' : (status.connected ? '● เชื่อมแล้ว' : '○ กำลังรอ queue server') + ' · ' + transportInfo
        + (status.activeJob ? ' · ' + status.activeJob.itemName : '') + (status.returningHome ? ' · กำลังกลับจุดรอ' : '') + (status.pendingOffers ? ' · รอส่ง ' + status.pendingOffers : '');
      lootQueueStatusEl.style.color = status.connected ? '#7fdb8c' : '#f2ba6d';
      const currentEl = root.querySelector('#__assist_lootqueuecurrent');
      if (currentEl) {
        const job = status.activeJob;
        const phase = status.claimPendingId ? 'รอ claimed ' + Math.ceil(status.claimPendingRemainingMs / 1000) + 's'
          : status.claimDelayRemainingMs > 0 ? 'รอรวม drop ' + Math.ceil(status.claimDelayRemainingMs / 1000) + 's'
          : status.nearbySettleRemainingMs > 0 ? 'กำลังต่อ job คิวถัดไป' : status.activeStage;
        currentEl.textContent = job
          ? 'กำลังเก็บ: ' + job.itemName + '(#' + job.itemId + ') @ ' + job.map + ' (' + Math.round(job.x) + ',' + Math.round(job.y) + ')' + (phase ? ' · ' + phase : '')
          : status.returningHome ? 'กำลังกลับจุดรอ: ' + CFG.lootQueueHomeMap + (phase ? ' · ' + phase : '')
            : status.nextClaimRemainingMs > 0 ? 'ทิ้งงานแล้ว · รอ ' + Math.ceil(status.nextClaimRemainingMs / 1000) + 's ก่อนมองคิวถัดไป'
              : 'ไม่มีงานที่กำลังเก็บ' + (status.availableJobs ? ' · รอในคิว ' + status.availableJobs : '');
        currentEl.style.color = job || status.returningHome ? '#f2ba6d' : '#9aa0a6';
      }
      const nextBtn = root.querySelector('#__assist_lootqueuenext');
      if (nextBtn) {
        nextBtn.disabled = !status.canSkip;
        nextBtn.className = status.canSkip ? 'danger' : 'off';
        nextBtn.title = status.canSkip ? 'ทิ้งงานนี้เมื่อ drop หายหรือ collector ค้าง' : 'ไม่มี drop ที่กำลังเก็บให้ข้าม';
      }
    }
    const ha = root.querySelector('#__assist_healat');
    if (ha && !isEditing(ha)) ha.value = CFG.healAtPercent;
    const hi = root.querySelector('#__assist_healitems');
    if (hi && !isEditing(hi)) hi.value = CFG.healItems.join(',');
    const hm = root.querySelector('#__assist_healmode');
    if (hm && !isEditing(hm)) hm.value = CFG.healMode;
    // buff config sync + countdown display
    const buffBtn = root.querySelector('#__assist_buffbtn');
    if (buffBtn) { buffBtn.textContent = 'Buff: ' + (CFG.buffEnabled ? 'ON' : 'OFF'); buffBtn.className = CFG.buffEnabled ? 'on' : 'off'; }
    const bi = root.querySelector('#__assist_buffitems');
    if (bi && !isEditing(bi)) bi.value = (CFG.buffItems || []).map(x => x.itemId + ',' + x.intervalMin).join('\n');
    const cdEl = root.querySelector('#__assist_buffcountdown');
    if (cdEl) {
      if (!CFG.buffItems || !CFG.buffItems.length) {
        cdEl.textContent = '(ยังไม่ตั้ง buff)';
      } else {
        const cds = ASSIST.getBuffCountdowns();
        cdEl.innerHTML = cds.map(c => {
          const icon = itemDB.loaded ? `<img src="${itemIconUrl(c.itemId)}" style="width:14px;height:14px;vertical-align:middle" onerror="this.style.display='none'"> ` : '';
          const remSec = Math.ceil(c.remainingMs / 1000);
          const remStr = remSec >= 60 ? Math.floor(remSec/60) + 'นาที' + (remSec%60 ? ' '+(remSec%60)+'s' : '') : remSec + 's';
          const state = c.remainingMs <= 0 ? '<span style="color:#27ae60">พร้อมใช้</span>' : '<span style="color:#f39c12">' + remStr + '</span>';
          return `<div>${icon}${c.name} <span style="color:#5f6368">(ทุก ${c.intervalMin}นาที)</span> → ${state}</div>`;
        }).join('');
      }
    }
    // AB Buff config + live status
    const abBtn = root.querySelector('#__assist_abbuffbtn');
    if (abBtn) { abBtn.textContent = 'AB Buff: ' + (CFG.abBuffEnabled ? 'ON' : 'OFF'); abBtn.className = CFG.abBuffEnabled ? 'on' : 'off'; }
    for (const [sel, value] of [['#__assist_abbuffmap', CFG.abBuffMap], ['#__assist_abbuffx', CFG.abBuffX], ['#__assist_abbuffy', CFG.abBuffY], ['#__assist_abbufftimeout', CFG.abBuffTimeoutSec], ['#__assist_abbuffreturndelay', CFG.abBuffReturnDelayMs / 1000]]) {
      const input = root.querySelector(sel);
      if (input && !isEditing(input)) input.value = value;
    }
    const abAgiEl = root.querySelector('[data-abbuffagi]');
    const abBlessingEl = root.querySelector('[data-abbuffblessing]');
    const abStateEl = root.querySelector('[data-abbuffstate]');
    const agi = hasAbBuffStatus(0x11);
    const blessing = hasAbBuffStatus(0x10);
    if (abAgiEl) { abAgiEl.textContent = agi ? 'อยู่' : 'หมด'; abAgiEl.style.color = agi ? '#27ae60' : '#e74c3c'; }
    if (abBlessingEl) { abBlessingEl.textContent = blessing ? 'อยู่' : 'หมด'; abBlessingEl.style.color = blessing ? '#27ae60' : '#e74c3c'; }
    if (abStateEl) {
      abStateEl.textContent = abBuffState + (shouldHoldFleePlayerForAbBuff() ? ' · Flee Player: hold' : '');
      abStateEl.style.color = abBuffState === 'IDLE' ? '#9aa0a6' : '#8ab4f8';
    }
    // skill config sync + countdown display
    const skillBtn = root.querySelector('#__assist_skillbtn');
    if (skillBtn) { skillBtn.textContent = 'Skill: ' + (CFG.skillEnabled ? 'ON' : 'OFF'); skillBtn.className = CFG.skillEnabled ? 'on' : 'off'; }
    const skillGapInput = root.querySelector('#__assist_skillgap');
    if (skillGapInput && !isEditing(skillGapInput)) skillGapInput.value = skillCommandGapMs();
    const skCdEl = root.querySelector('#__assist_skillcountdown');
    if (skCdEl) {
      if (!CFG.skills || !CFG.skills.length) {
        skCdEl.textContent = '(ยังไม่ตั้ง skill — กด "📋 จัดการ skill")';
      } else {
        const states = ASSIST.getSkillStates();
        const spStr = sp.cur != null ? (sp.max ? ` | SP ${sp.cur}/${sp.max}` : ` | SP ${sp.cur}`) : '';
        skCdEl.innerHTML = states.map(c => {
          let state;
          if (c.statusBacked) {
            state = c.active ? '<span style="color:#27ae60">มีบัพ</span>'
              : c.pending ? '<span style="color:#8ab4f8">รอยืนยัน server</span>'
              : '<span style="color:#f39c12">ไม่มีบัพ</span>';
          } else {
            state = c.remainingMs <= 0 ? '<span style="color:#27ae60">พร้อม</span>' : '<span style="color:#f39c12">รอ cooldown</span>';
          }
          return `<div>🔮 ${c.name} <span style="color:#5f6368">(#${c.skillId})</span> → ${state}</div>`;
        }).join('') + `<div style="color:#5f6368;margin-top:2px">${spStr}</div>`;
      }
    }
    const lm = root.querySelector('#__assist_lootmode');
    if (lm && !isEditing(lm)) lm.value = CFG.filter.mode;
    const ld = root.querySelector('#__assist_lootdelay');
    if (ld && !isEditing(ld)) ld.value = CFG.lootDelayAfterDropMs;
    const ls = root.querySelector('#__assist_lootsettle');
    if (ls && !isEditing(ls)) ls.value = CFG.lootPostKillSettleMs;
    const lt = root.querySelector('#__assist_lootthrottle');
    if (lt && !isEditing(lt)) lt.value = CFG.sendThrottleMs;
    const fpsCapSelect = root.querySelector('#__assist_fpscap');
    if (fpsCapSelect && !isEditing(fpsCapSelect)) fpsCapSelect.value = String(CFG.renderFpsCap);

    // combat config sync
    const combatBtn = root.querySelector('#__assist_combatbtn');
    if (combatBtn) { combatBtn.textContent = 'Combat: ' + (CFG.combatEnabled ? 'ON' : 'OFF'); combatBtn.className = CFG.combatEnabled ? 'on' : 'off'; }
    // function declaration ถูก hoist: ใช้ได้กับ Loot Queue ที่ sync ก่อนส่วน combat
    function syncInput(sel, val) {
      const el = root.querySelector(sel);
      if (el && !isEditing(el)) el.value = val;
    }
    const syncToggle = (sel, on) => { const el = root.querySelector(sel); if (el) el.className = on ? 'on' : 'off'; };
    syncInput('#__assist_whitelist', CFG.targetWhitelist.join(','));
    syncInput('#__assist_blacklist', CFG.targetBlacklist.join(','));
    syncInput('#__assist_hiddenwaitmonsters', (CFG.hiddenWaitMonsters || []).join(','));
    syncInput('#__assist_hiddenwaitsec', CFG.hiddenWaitSec);
    syncToggle('#__assist_t_hiddensight', CFG.hiddenSightEnabled !== false);
    const hiddenSightStatus = root.querySelector('#__assist_hiddensightstatus');
    if (hiddenSightStatus) {
      const sightRemaining = Math.max(0, sightEffectUntil - nowMs());
      hiddenSightStatus.textContent = CFG.hiddenSightEnabled === false
        ? 'ปิดอยู่ — ไม่ใช้ Sight เมื่อมอนใน hidden wait ซ่อนตัว'
        : (sightRemaining > 0
          ? '👁️ Sight ทำงานอยู่ · เหลือ ' + (sightRemaining / 1000).toFixed(1) + 's · มอนตัวใหม่จะไม่ใช้ซ้ำ'
          : 'ใช้ Sight เมื่อมอนใน hidden wait ใช้ Cloaking จริง · ระยะ 3 ช่อง · SP 10');
      hiddenSightStatus.style.color = CFG.hiddenSightEnabled === false ? '#9aa0a6' : (sightRemaining > 0 ? '#27ae60' : '#8ab4f8');
    }
    syncInput('#__assist_attackrange', CFG.rangedAttackRange > 0 ? CFG.rangedAttackRange : CFG.attackRange);
    syncInput('#__assist_antikswindow', CFG.antiKSCooldownMs);
    syncInput('#__assist_avoidplayerradius', CFG.playerProximityRadius);
    syncInput('#__assist_postwarpsettle', CFG.postWarpTargetSettleMs);
    syncInput('#__assist_combatgatprogresstimeout', combatGatProgressTimeoutMs());
    syncInput('#__assist_fleemob', CFG.fleeOnMobCount);
    syncInput('#__assist_fleeaggro', CFG.fleeOnAggroCount);
    // rest config sync
    const restBtn = root.querySelector('#__assist_restbtn');
    if (restBtn) { restBtn.textContent = 'Rest: ' + (CFG.restEnabled ? 'ON' : 'OFF') + (isResting ? ' 🪑' : ''); restBtn.className = CFG.restEnabled ? 'on' : 'off'; }
    syncInput('#__assist_resthp', CFG.restHpPercent);
    syncInput('#__assist_restuntil', CFG.restUntilPercent);
    syncInput('#__assist_restmaxsec', CFG.restMaxSec);
    // ★ auto-respawn toggle sync
    const respawnBtn = root.querySelector('#__assist_respawnbtn');
    if (respawnBtn) { respawnBtn.textContent = 'Respawn: ' + (CFG.autoRespawnEnabled ? 'ON' : 'OFF'); respawnBtn.className = CFG.autoRespawnEnabled ? 'on' : 'off'; }
    syncInput('#__assist_fleeprox', CFG.fleeOnProximityCount);
    syncInput('#__assist_fleeplayerradius', CFG.fleeOnPlayerRadius);
    syncInput('#__assist_fleeplayerdelay', CFG.fleeOnPlayerDelaySec);
    syncInput('#__assist_fleeplayerexceptions', (CFG.fleePlayerExceptions || []).join(','));
    syncInput('#__assist_fleemvpradius', CFG.fleeOnMvpRadius);
    syncInput('#__assist_stuckwarp', CFG.stuckWarpOnAbandon);
    syncToggle('#__assist_t_warptoboss', CFG.warpToBoss === true);
    syncInput('#__assist_fleemonsters', (CFG.fleeMonsters || []).join(','));
    syncInput('#__assist_fleemonsterradius', CFG.fleeMonsterRadius);
    const fleePlayerBtn = root.querySelector('#__assist_t_fleeplayer');
    if (fleePlayerBtn) { fleePlayerBtn.textContent = 'Flee Player: ' + (CFG.fleeOnPlayerCount > 0 ? 'ON' : 'OFF'); fleePlayerBtn.className = CFG.fleeOnPlayerCount > 0 ? 'on' : 'off'; }
    const fleeMvpBtn = root.querySelector('#__assist_t_fleemvp');
    if (fleeMvpBtn) { fleeMvpBtn.textContent = 'Flee MVP/Boss: ' + (CFG.fleeOnMvp ? 'ON' : 'OFF'); fleeMvpBtn.className = CFG.fleeOnMvp ? 'on' : 'off'; }
    syncToggle('#__assist_t_antiks', CFG.antiKS);
    syncInput('#__assist_pickradiuskill', CFG.pickRadiusKill);
    syncToggle('#__assist_t_lootkillpos', CFG.lootUseKillPos);
    syncToggle('#__assist_t_avoidp', CFG.avoidOtherPlayers);
    syncToggle('#__assist_t_lowhp', CFG.targetLowestHpFirst);
    syncToggle('#__assist_t_wander', CFG.wanderEnabled);
    syncToggle('#__assist_t_warpfind', CFG.warpFindEnabled);
    syncToggle('#__assist_t_warptomon', CFG.warpToMonster);
    // sell config sync
    const sellBtn = root.querySelector('#__assist_sellbtn');
    if (sellBtn) { sellBtn.textContent = 'Sell: ' + (CFG.sellEnabled ? 'ON' : 'OFF') + (sellState !== 'IDLE' ? ' (' + sellState + ')' : ''); sellBtn.className = CFG.sellEnabled ? 'on' : 'off'; }
    syncInput('#__assist_sellnpc', CFG.sellNpcName);
    syncInput('#__assist_sellmap', CFG.sellNpcMap);
    syncInput('#__assist_sellx', CFG.sellNpcX);
    syncInput('#__assist_selly', CFG.sellNpcY);
    syncInput('#__assist_sellinterval', CFG.sellIntervalMin);
    syncToggle('#__assist_t_sellfull', CFG.sellOnFull);
    // ore refine tool config sync
    const oreRefineStatus = root.querySelector('#__assist_orerefinestate');
    if (oreRefineStatus) {
      const source = nameOf(CFG.oreRefineSourceItemId);
      const result = nameOf(CFG.oreRefineResultItemId);
      oreRefineStatus.textContent = 'สถานะ: ' + oreRefineState + (oreRefineBatch ? ' · รอบนี้ ' + source + ' ×' + oreRefineBatch + ' → ' + result : '');
    }
    syncInput('#__assist_oremap', CFG.oreRefineMap);
    syncInput('#__assist_orehubx', CFG.oreRefineHubX);
    syncInput('#__assist_orehuby', CFG.oreRefineHubY);
    syncInput('#__assist_orekafra', CFG.oreRefineKafraName);
    syncInput('#__assist_orekafrax', CFG.oreRefineKafraX);
    syncInput('#__assist_orekafray', CFG.oreRefineKafraY);
    syncInput('#__assist_orekafranext', CFG.oreRefineKafraNextCount);
    syncInput('#__assist_orekafrachoice', CFG.oreRefineKafraChoice);
    syncInput('#__assist_orenpc', CFG.oreRefineNpcName);
    syncInput('#__assist_orenpcx', CFG.oreRefineNpcX);
    syncInput('#__assist_orenpcy', CFG.oreRefineNpcY);
    syncInput('#__assist_oretradechoice', CFG.oreRefineTradeChoice);
    syncInput('#__assist_oretradeentry', CFG.oreRefineTradeEntry);
    syncInput('#__assist_oresellchoice', CFG.oreRefineSellChoice);
    syncInput('#__assist_orebatch', CFG.oreRefineBatchSize);
    // storage config sync
    const storageBtn = root.querySelector('#__assist_storagebtn');
    if (storageBtn) { storageBtn.textContent = 'Storage: ' + (CFG.storageEnabled ? 'ON' : 'OFF') + (storageState !== 'IDLE' ? ' (' + storageState + ')' : ''); storageBtn.className = CFG.storageEnabled ? 'on' : 'off'; }
    syncInput('#__assist_kafra', CFG.kafraName);
    syncInput('#__assist_kaframap', CFG.kafraMap);
    syncInput('#__assist_kafrax', CFG.kafraMapX);
    syncInput('#__assist_kafray', CFG.kafraMapY);
    syncInput('#__assist_kafrachoice', CFG.kafraChoice);
    syncInput('#__assist_depositweight', CFG.depositWeightPercent);
    const storageMode = root.querySelector('#__assist_storagedepositmode');
    if (storageMode && !isEditing(storageMode)) storageMode.value = storageDepositMode();
    syncInput('#__assist_storagereserve', storageReserveItemsText());
    syncToggle('#__assist_t_depfull', CFG.depositOnFull);
    syncToggle('#__assist_t_depaftersell', CFG.depositAfterSell);
    // auto login / recovery config sync
    const autoLoginBtn = root.querySelector('#__assist_autologinbtn');
    if (autoLoginBtn) { autoLoginBtn.textContent = 'Auto-Login: ' + (CFG.autoLoginEnabled ? 'ON' : 'OFF'); autoLoginBtn.className = CFG.autoLoginEnabled ? 'on' : 'off'; }
    const autoRefreshBtn = root.querySelector('#__assist_autorefreshbtn');
    if (autoRefreshBtn) { autoRefreshBtn.textContent = 'Auto-Refresh: ' + (CFG.autoRefreshEnabled ? 'ON' : 'OFF'); autoRefreshBtn.className = CFG.autoRefreshEnabled ? 'on' : 'off'; }
    syncInput('#__assist_aluser', CFG.autoLoginUser);
    syncInput('#__assist_alpass', CFG.autoLoginPass);
    syncInput('#__assist_alslot', CFG.autoLoginSlot);
    syncInput('#__assist_arstall', CFG.autoRefreshStallSec);
    syncInput('#__assist_armovementstall', Math.round(autoRefreshMovementStallMs() / 1000));
    const autoStatus = root.querySelector('#__assist_autostatus');
    if (autoStatus) {
      const ageSec = Math.max(0, Math.floor((Date.now() - lastGamePacketAt) / 1000));
      const movementAgeSec = lastPlayerPositionChangedAt ? Math.max(0, Math.floor((Date.now() - lastPlayerPositionChangedAt) / 1000)) : null;
      autoStatus.textContent = 'WS: ' + (activeWS && activeWS.readyState === 1 ? 'เชื่อมต่อ' : 'ไม่เชื่อมต่อ')
        + ' · phase: ' + autoLoginPhase + ' · packet ล่าสุด: ' + ageSec + 's'
        + ' · ขยับล่าสุด: ' + (movementAgeSec == null ? '?' : movementAgeSec + 's')
        + ' · limit ขยับ: ' + (autoRefreshMovementStallMs() ? Math.round(autoRefreshMovementStallMs() / 1000) + 's' : 'ปิด')
        + ' · slot: ' + CFG.autoLoginSlot;
    }
    // AI Chat Reply config + runtime status
    const aiReplyBtn = root.querySelector('#__assist_aireplybtn');
    const aiModeActive = CFG.aiReplyEnabled && !aiReplyUsesTemplates();
    if (aiReplyBtn) { aiReplyBtn.textContent = 'AI Reply: ' + (aiModeActive ? 'ON' : 'OFF'); aiReplyBtn.className = aiModeActive ? 'on' : 'off'; }
    syncToggle('#__assist_t_aireplymention', CFG.aiReplyRequireNameMention);
    syncInput('#__assist_aiurl', CFG.aiReplyApiUrl);
    const aiKey = root.querySelector('#__assist_aikey');
    if (aiKey && !isEditing(aiKey) && CFG.aiReplyApiKey) aiKey.value = CFG.aiReplyApiKey;
    syncInput('#__assist_aimodel', CFG.aiReplyModel);
    syncInput('#__assist_ainames', (Array.isArray(CFG.aiReplyAllowedNames) ? CFG.aiReplyAllowedNames : []).join(', '));
    syncInput('#__assist_airadius', CFG.aiReplyRadius);
    syncInput('#__assist_aidelaymin', CFG.aiReplyDelayMinSec);
    syncInput('#__assist_aidelaymax', CFG.aiReplyDelayMaxSec);
    syncInput('#__assist_aicooldown', CFG.aiReplyCooldownSec);
    syncInput('#__assist_aimaxpermin', CFG.aiReplyMaxPerMin);
    syncInput('#__assist_aimaxTokens', CFG.aiReplyMaxTokens);
    syncInput('#__assist_aiprompt', CFG.aiReplyPrompt);
    const aiStatus = root.querySelector('#__assist_aistatus');
    if (aiStatus) {
      const now = Date.now();
      while (aiReplySentAt.length && now - aiReplySentAt[0] >= 60000) aiReplySentAt.shift();
      const interactionText = aiInteraction ? (' · hold: ' + aiInteraction.name + ' (' + aiInteraction.phase + ')') : '';
      aiStatus.textContent = 'สถานะ: ' + (aiModeActive ? (aiReplyPending ? 'กำลังคิดคำตอบ…' : 'พร้อมตอบ') : (CFG.aiReplyEnabled ? 'ใช้ Template Reply' : 'ปิด'))
        + ' · ใช้แล้ว ' + aiReplySentAt.length + '/' + CFG.aiReplyMaxPerMin + ' ครั้งใน 1 นาที'
        + ' · key: ' + (CFG.aiReplyApiKey ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้ง') + interactionText;
      aiStatus.style.color = aiModeActive ? '#8ab4f8' : '#9aa0a6';
    }
    // Template Reply config + runtime status
    const templateReplyBtn = root.querySelector('#__assist_templatereplybtn');
    const templateModeActive = CFG.aiReplyEnabled && aiReplyUsesTemplates();
    if (templateReplyBtn) { templateReplyBtn.textContent = 'Template Reply: ' + (templateModeActive ? 'ON' : 'OFF'); templateReplyBtn.className = templateModeActive ? 'on' : 'off'; }
    syncInput('#__assist_aitemplates', aiReplyTemplateList().join('\n'));
    const templateStatus = root.querySelector('#__assist_templatestatus');
    if (templateStatus) {
      templateStatus.textContent = 'มี ' + aiReplyTemplateList().length + ' คำตอบ · '
        + (templateModeActive ? 'กำลังใช้งาน (ไม่เรียก API)' : 'ปิด')
        + (aiInteraction ? (' · hold: ' + aiInteraction.name + ' (' + aiInteraction.phase + ')') : '');
      templateStatus.style.color = templateModeActive ? '#8ab4f8' : '#9aa0a6';
    }
    // ★ relay/remote monitor config sync
    const relayBtn = root.querySelector('#__assist_relaybtn');
    if (relayBtn) {
      const r = relayStatusInfo();
      relayBtn.textContent = 'Relay: ' + (CFG.monitorServerEnabled ? 'ON' : 'OFF') + ' — ' + r.text;
      relayBtn.className = CFG.monitorServerEnabled ? 'on' : 'off';
    }
    syncInput('#__assist_relayurl', CFG.monitorServerUrl);
    // ★ telegram alert toggle sync
    syncToggle('#__assist_t_tgcard', CFG.telegramAlertCard !== false);
    syncToggle('#__assist_t_tgflee', CFG.telegramAlertFlee !== false);
    syncToggle('#__assist_t_tgbot', CFG.telegramAlertBotMention !== false);
    syncToggle('#__assist_t_tgnearby', CFG.telegramAlertNearby === true);
    syncToggle('#__assist_t_tgwhisper', CFG.telegramAlertWhisper !== false);
    // ★ sync telegram token/chatId จาก CFG ลง input fields
    const tgToken = root.querySelector('#__assist_tg_token');
    if (tgToken && !isEditing(tgToken) && CFG.telegramBotToken) tgToken.value = CFG.telegramBotToken;
    const tgChatId = root.querySelector('#__assist_tg_chatid');
    if (tgChatId && !isEditing(tgChatId) && CFG.telegramChatId) tgChatId.value = CFG.telegramChatId;
    // nav config sync + stats display
    const navRecBtn = root.querySelector('#__assist_navrecbtn');
    if (navRecBtn) { navRecBtn.textContent = 'บันทึก: ' + (CFG.navRecording ? 'ON 🔴' : 'OFF'); navRecBtn.className = CFG.navRecording ? 'on' : 'off'; }
    syncToggle('#__assist_navwanderbtn', CFG.navWanderUseNav);
    syncToggle('#__assist_gatwanderbtn', CFG.gatWanderEnabled !== false);
    const gatWanderBtn = root.querySelector('#__assist_gatwanderbtn');
    if (gatWanderBtn) gatWanderBtn.textContent = 'เดินตาม GAT' + (currentMap && gatCache.has(currentMap) ? ' ✅' : '');
    const nm = root.querySelector('#__assist_navmode');
    if (nm && !isEditing(nm)) nm.value = CFG.navWanderMode;
    syncInput('#__assist_navradius', CFG.navMergeRadius);
    const navStatsEl = root.querySelector('#__assist_navstats');
    if (navStatsEl) {
      const all = ASSIST.navGetAllStats();
      const mapNames = Object.keys(all);
      if (!mapNames.length) {
        navStatsEl.textContent = '(ยังไม่มีข้อมูล — เปิด "บันทึก" แล้วเดินเก็บข้อมูลในแมปที่ต้องการ)';
      } else {
        navStatsEl.innerHTML = mapNames.map(m => {
          const s = all[m];
          const cur = m === currentMap ? ' ✅' : '';
          return `<div>📦 ${m}${cur}: ${s.nodes} nodes, ${s.edges} edges (${s.trail} trail)</div>`;
        }).join('');
      }
    }
    // profile status — ไม่เขียนทับ select ระหว่างผู้ใช้เปิด dropdown เลือกอยู่
    const profileStatusEl = root.querySelector('#__assist_profile_status');
    if (profileStatusEl) {
      const profileState = ASSIST.profileStatus();
      const blockers = profileState.blockers;
      profileStatusEl.textContent = 'กำลังใช้: ' + profileState.active + ' · บันทึกแล้ว ' + profileState.savedCount + ' ชุด'
        + (blockers.length ? ' · รอสลับ: ' + blockers.join(', ') : ' · พร้อมสลับ');
      profileStatusEl.style.color = blockers.length ? '#f2ba6d' : '#7fdb8c';
    }
    // farm map config sync
    syncInput('#__assist_farmmap', CFG.farmMap);
    syncInput('#__assist_farmx', CFG.farmMapX);
    syncInput('#__assist_farmy', CFG.farmMapY);
    syncToggle('#__assist_t_warpback', CFG.warpBackToFarm);

    // Activity Journal windows — render module เดียวกัน และไม่แทน DOM ระหว่างผู้ใช้เลือกข้อความ
    const logPopup = root.querySelector('#__assist_logpopup');
    if (logPopup && logPopup.classList.contains('open')) {
      const box = root.querySelector('#__assist_logbox');
      activityJournal.render(box, box && box.dataset.dbg === '1' ? 'debug' : 'activity');
    }
    const alertPopup = root.querySelector('#__assist_alertpopup');
    if (alertPopup && alertPopup.classList.contains('open')) {
      activityJournal.render(root.querySelector('#__assist_alertbox'), 'important');
    }
  }

  let lastConfigSnapshot = null;
  let lastAutoSaveAt = 0;
  // ============================================================
  //  HUD — ownership ของ mount/render loop และ root element
  //  buildUI/renderUI เป็น implementation ภายใน; caller ไม่ต้องจัดการ selector หรือ root เอง
  // ============================================================
  const hud = (() => {
    let root = null;
    const currentRoot = () => root && root.isConnected ? root : document.getElementById('__assist_root');
    const render = () => { root = currentRoot(); if (root) renderUI(root); };
    return {
      mount() { root = buildUI(); return root; },
      render,
      startRenderLoop(afterRender) {
        if (uiLoop) clearInterval(uiLoop);
        uiLoop = setInterval(() => { render(); afterRender(); }, 400);
      },
      root() { return currentRoot(); },
    };
  })();
  // ---------- bootstrap UI (รอ DOM ready) ----------
  function startUI() {
    hud.mount();
    // เริ่มจากหน้า splash/login ได้เลย แม้เกมยังไม่เปิด WebSocket
    startAutoLoginBootstrap();
    hud.startRenderLoop(() => {
      sendMonitorData();   // ★ ส่งไป monitor.html
      connectRelay();      // ★ เชื่อม relay server (auto-reconnect)
      // auto-save config ทุก ~5 วิ ถ้าค่าเปลี่ยน
      const now = Date.now();
      if (now - lastAutoSaveAt > 5000) {
        lastAutoSaveAt = now;
        const snap = JSON.stringify(PERSIST_KEYS.map(k => CFG[k]));
        if (snap !== lastConfigSnapshot) { lastConfigSnapshot = snap; saveConfig(); }
      }
    });
    setTimeout(loadItemDB, 2000);   // โหลด item DB หลังเข้าเกม 2s
  }
  if (document.body) startUI();
  else document.addEventListener('DOMContentLoaded', startUI, { once: true });

  log('✅ ติดตั้งแล้ว — เล่นเกมตามปกติ ระบบจะเก็บของและใช้ยาให้เอง');
  log('   พิมพ์ ASSIST.help() เพื่อดูคำสั่งทั้งหมด, ASSIST.status() เพื่อดูสถานะ');
})();
