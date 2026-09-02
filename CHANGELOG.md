# Changelog

บันทึกนี้สรุปเฉพาะพฤติกรรมและค่าตั้งที่ผู้ใช้เห็นของ **RO Rebuild Pure**
โดยรายละเอียด refactor หรือทุกไฟล์ที่เปลี่ยน ให้ดูจาก Git history เพิ่มเติม

## [1.1.10] — 2026-09-02

### Changed

- Sleeper ที่ใช้ Cloaking จะเข้าโหมดรอทันทีเมื่อได้รับทั้ง Game Packet self-cast หรือสถานะ Cloaking ของเป้าหมายโดยตรง; ระบบลองใช้ Sight ทันทีโดยไม่บล็อกด้วยระยะพิกัดล่าสุด 3 ช่อง แล้วรอ packet เลิก Cloaking ก่อนกลับไป Attack เป้าเดิม
- หลังเป้าตาย/หาย บอทหาเป้ามอนใหม่ได้ทันที โดยยังใช้ cooldown ของเป้าที่ abandon เป็นตัวกันวนซ้ำ แทนการหน่วงสลับเป้าแบบตายตัว 1.5 วินาที
- Support Skill queue ใช้ Global Skill Gap เพื่อเรียง packet ทุกคำสั่ง; cooldown/รอบบัพซ้ำแยกตาม Skill + ตัวละครเป้าหมาย ไม่ให้ชื่อหนึ่งบล็อกอีกชื่อ และ HUD แสดงสถานะต่อรายชื่อแทน cooldown รวมของ Skill
- Support Skill จะเริ่มนับรอบบัพซ้ำหลังได้รับ Game Packet ยืนยันการใช้ Skill จาก server เท่านั้น; คำสั่งที่ส่งออกแต่ server ยังไม่ทำจะรอไม่เกินค่า Cooldown ของ Skill แล้วปล่อยทั้ง Skill Set ของชื่อนั้นให้คิวถัดไปทำงาน ก่อนลองชื่อนั้นใหม่ตามค่าเดิม
- Support Skill queue ทำ batch แบบผู้เล่นละหนึ่ง Skill Set: ทำ Skill ที่พร้อมของผู้เล่น A ให้ครบตามลำดับรายการก่อนเริ่มผู้เล่น B; ผู้เล่นที่เพิ่งเข้ามารอ batch ถัดไปและไม่แทรกระหว่างชุด
- Manual Skill ที่กดระหว่าง Support Skill Set จะเข้าคิวรอให้ผู้เล่นปัจจุบันจบก่อน เพื่อไม่ตัดชุดบัพกลางทาง
- Loot Queue ใช้ค่า `ดีเลย์ก่อนวาร์ป job ถัดไป/กลับจุดรอ` ค่าเดียวกันทั้งก่อนวาร์ปงานถัดไปและก่อนกลับจุดรอ; ตัด delay หลัง discard ที่ซ้ำซ้อนออก
- Manual Skill (เฉพาะ self/ally ระหว่าง Collector) และ Auto Support ใช้ก่อน Collector ได้ โดยพักเฉพาะ timer ภายในงาน Loot Queue ตามเวลาที่คิว Skill ทับกับ deadline จริง; TTL/lease/การยืนยันวาร์ปของ server ยังเดินตามปกติ และ Flee ยังมาก่อน Auto Support เมื่อไม่มี job Collector
- Collector หลังวาร์ปจะลอง Pickup สองรอบแรกก่อน แล้วจึงตรวจ drop ก่อน retry รอบถัดไป; จำนวน Pickup รวมตั้งจาก UI และครบจำนวนแล้วยังไม่สำเร็จจึง discard
- หาก Collector ยังไม่เห็น Game Packet ของ drop หลังวาร์ป, หรือยืนยันการวาร์ปข้ามแมปไม่สำเร็จภายในจำนวนครั้งที่กำหนด จะคืนงานเป็น `nack` แบบรอตรวจข้อมูลก่อน แทน discard; Collector จะทำงานอื่นหนึ่งรอบก่อนจึงลองงานเดิมใหม่ เพื่อไม่ให้วน claim/release ซ้ำ
- Global Skill Gap ปรับได้จาก UI และบันทึกไว้ในโปรไฟล์ ส่วน Steal ใช้ cooldown ของ Steal ที่ตั้งจาก UI เป็นเวลารอผลและ retry
- ระยะห่างการย้ายของ Kafra ปรับได้จาก UI และใช้ค่าเดียวกันทั้งฝากเข้า/ถอนของสำรอง โดยไม่ถูกจำกัดด้วยรอบ Storage loop เดิม
- แก้การเริ่ม Storage scheduler ให้หลัง state ถูก initialize เพื่อไม่ให้ userscript หยุดโหลดด้วย `ReferenceError`
- แก้หน้า Loot Queue ให้แสดงจำนวนคำสั่ง Pickup ได้โดยใช้ helper กลางที่ UI เรียกถึง; ไม่ทำให้หน้า UI ล่มจาก `pickupAttemptLimit is not defined`
- การเช็ก drop หลังวาร์ปยึดข้อมูล drop ที่ได้รับจากเซิร์ฟเวอร์ และไม่เพิ่ม gate `player ready` หรือ delay แฝงแยกจากค่า Combat หลังวาร์ป

### Added

- Skill mode `support` สำหรับ Heal, Blessing, Increase Agility, Kyrie Eleison และ Impositio Manus: เลือกบัพตัวเองและ/หรือรายชื่อผู้เล่นแบบตรงตัวได้ในแต่ละ Skill, ใช้ Auto Skill queue กับ Global Skill Gap เส้นเดิม และไม่ส่งคำสั่งบัพผู้เล่นอื่นระหว่าง Collector มีงาน
- Packet capture สำหรับตรวจสอบคำสั่งคลิกขวาลบ Status โดยยังเป็นโหมดสังเกตการณ์ ไม่ส่งคำสั่งลบ Status อัตโนมัติ
- Regression checks สำหรับ flow Sleeper Cloaking, Collector (รวมกรณี drop ยังไม่ปรากฏ), return-home, Skill gap/Steal, manual skill และ teleport coordinator

### Removed

- ถอน cross-map teleport gap แบบ hard-code และการรอหลัง discard ของ Loot Queue ที่ทับซ้อนกับ flow เดิม

## [1.1.4] — 2026-08-31

- ทำให้เวลารอผลของ Pickup ปรับได้จากหน้า Loot Queue แทนการบังคับใช้ค่าเดิม

## [1.1.2] — 2026-08-31

- เมื่อ Collector วาร์ปถึงแมพเป้าหมาย จะตรวจว่า drop ที่พื้นยังมีและตรงกับงานก่อนสั่ง Pickup; หากไม่พบจะ discard แล้วไปคิวถัดไป

## [1.1.1] — 2026-08-31

- ปรับ flow Storage และ retry ของ Skill ให้รอ packet ผลลัพธ์อย่างเป็นลำดับ ลดคำสั่งซ้อนกัน

## [1.1.0] — 2026-08-30

- ทำให้ Loot Queue และการเริ่ม WebGL ทนต่อสภาวะ reconnect/เริ่มต้นมากขึ้น

## [1.0.4] — 2026-08-30

- ปรับความทนทานของ movement, entity tracking และการจัดการเป้าหมาย

## [1.0.3] — 2026-08-30

- ซิงก์ตำแหน่งผู้เล่นบน minimap ให้แม่นขึ้น และลดเวลาค้นหาหลังวาร์ปโดยอิง flow ที่มีอยู่

## [1.0.1] — 2026-08-30

- เพิ่มความชัดเจนของ log และสถานะการทำงาน Loot Queue

## [1.0.0] — 2026-08-30

- เปลี่ยนชื่อ userscript เป็น **RO Rebuild Pure**
