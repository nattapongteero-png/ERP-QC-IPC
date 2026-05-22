# คู่มือ Deploy ระบบ UAT / Test

Deploy โค้ดจาก GitLab ขึ้น server เพื่อรันที่:

| รายการ | ค่า |
|---|---|
| Domain | https://herbal-erp-test-uat.bmscloud.in.th |
| Host port | `6809` |
| โฟลเดอร์บน server | `/home/bms/docker-compose-bms-herbal` |
| Git repo | `https://gitlab.bgs.co.th/ERPHerbal/herbalerp.git` (branch `main`) |
| Database | `herbal_erp_uat` (แยกจาก production) |

ชุดนี้รันแยกอิสระจาก production 100% — รันบน server เดียวกับ production ได้โดยไม่กระทบกัน

---

## สิ่งที่ต้องมีก่อน

- **สิทธิ์ SSH เข้า server** ที่มีโฟลเดอร์ `/home/bms/docker-compose-bms-herbal`
- บน server ต้องมี **Docker** + **Docker Compose v2** (ปกติมีอยู่แล้ว เพราะ production รันอยู่)
- **GitLab Personal Access Token** (scope `read_repository`) สำหรับ clone โค้ด

> ❗ ถ้าไม่มีสิทธิ์ SSH เข้า server — ต้องส่งคู่มือนี้ให้ทีม IT/DevOps ที่ดูแล server ดำเนินการแทน

---

## ขั้นตอน Deploy

### 1. SSH เข้า server

```bash
ssh bms@<server-ip>
cd /home/bms/docker-compose-bms-herbal
```

### 2. ดึงโค้ดจาก GitLab

```bash
# clone ลงโฟลเดอร์ย่อยชื่อ herbal-erp-uat (กันชนกับของเดิมในโฟลเดอร์)
git clone https://gitlab.bgs.co.th/ERPHerbal/herbalerp.git herbal-erp-uat
cd herbal-erp-uat
```

ตอน clone จะถาม Username + Password → ใส่ **token** แทน password

### 3. สร้างไฟล์ `.env`

```bash
nano .env
```

วางเนื้อหานี้ (⚠️ **เปลี่ยนรหัสผ่านทุกตัวให้เป็นของจริง**):

```env
MYSQL_ROOT_PASSWORD=เปลี่ยนรหัสนี้
MYSQL_USER=herbal_user
MYSQL_PASSWORD=เปลี่ยนรหัสนี้
JWT_SECRET=เปลี่ยนเป็นสตริงสุ่มยาว ๆ
VMI_ENCRYPTION_KEY=2e3292276eae29d38b49c5e332688212e6ddac0dc3c776408a436de6c1b9fc42
```

> สร้าง JWT_SECRET แบบสุ่ม: `openssl rand -hex 32`

บันทึก: กด `Ctrl+O` → `Enter` → `Ctrl+X`

### 4. Build และรัน

```bash
docker compose -f docker-compose.uat.yml up -d --build
```

ครั้งแรกใช้เวลา build ~5–15 นาที (build แอป Next.js + reporting .NET)

### 5. ตรวจสอบ

```bash
# ดูสถานะ container (ควรขึ้น healthy/running ทั้ง 3 ตัว)
docker compose -f docker-compose.uat.yml ps

# ดู log แอป
docker compose -f docker-compose.uat.yml logs -f app-uat

# ทดสอบ health endpoint
curl http://localhost:6809/api/health
```

ได้ `{"status":"healthy",...}` = แอปรันสำเร็จ

> ตารางฐานข้อมูลจะถูกสร้างอัตโนมัติ (schema-sync) ตอนแอปบูตครั้งแรก — เริ่มจาก DB ว่างได้เลย

### 6. ตั้งค่า Reverse Proxy (งานของทีม IT)

ให้ reverse proxy ของ `bmscloud.in.th` ชี้:

```
https://herbal-erp-test-uat.bmscloud.in.th  ->  http://<server-ip>:6809
```

(ทำแบบเดียวกับ herbal-erp-arjaro / herbal-erp ตัวอื่น ๆ ที่มีอยู่แล้ว)

---

## (ทางเลือก) คัดลอกข้อมูลจาก Production มาใส่ UAT

ถ้าต้องการให้ UAT มีข้อมูลจริงเหมือน production (แนะนำสำหรับการทดสอบ):

```bash
# 1. dump ข้อมูลจาก production (รันที่ server production / container mysql ของ production)
docker exec herbal-erp-mysql \
  mysqldump -uherbal_user -p<รหัส> --single-transaction herbal_erp > prod-dump.sql

# 2. import เข้า DB ของ UAT
docker exec -i herbal-erp-uat-mysql \
  mysql -uherbal_user -p<รหัส> herbal_erp_uat < prod-dump.sql

# 3. restart แอป UAT ให้ sync schema
docker compose -f docker-compose.uat.yml restart app-uat
```

> ⚠️ ข้อมูล production อาจมีข้อมูลจริง/ข้อมูลส่วนบุคคล — ใช้กับ UAT ที่เข้าถึงได้เฉพาะภายในเท่านั้น

---

## คำสั่งใช้บ่อย

```bash
# อัปเดตโค้ดเวอร์ชันใหม่จาก GitLab แล้ว deploy ใหม่
cd /home/bms/docker-compose-bms-herbal/herbal-erp-uat
git pull
docker compose -f docker-compose.uat.yml up -d --build

# หยุด UAT (ไม่ลบข้อมูล)
docker compose -f docker-compose.uat.yml down

# หยุด + ลบข้อมูล DB ทิ้งทั้งหมด
docker compose -f docker-compose.uat.yml down -v

# ดู log
docker compose -f docker-compose.uat.yml logs -f
```

---

## หมายเหตุ

- ระบบ UAT นี้ใช้ container/network/volume ชุดของตัวเอง (prefix `herbal-erp-uat-`) — ปลอดภัยต่อ production
- ข้อมูล DB เก็บใน `./uat_mysql_data` ภายในโฟลเดอร์ที่ clone — backup โฟลเดอร์นี้ = backup ข้อมูล UAT
- ไฟล์ `.env` มีรหัสผ่าน — **ห้าม commit ขึ้น git** (มี `.gitignore` คุมอยู่แล้ว)
