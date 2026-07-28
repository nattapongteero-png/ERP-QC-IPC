# คู่มือ build / deploy / ดูหน้าจอ — UAT

ปลายทาง: https://herbal-erp-test-uat.bmscloud.in.th (พอร์ต 6809 บน `10.95.10.105`)
DB: `herbal_erp_uat` · container: `herbal-erp-uat-app` / `-mysql` / `-reporting`

> ⚠️ เซิร์ฟเวอร์นี้โฮสต์ระบบ BMS อีก 7 ตัว **ห้าม build บนเซิร์ฟเวอร์** (RAM ~8GB, OOM แล้วรีบูตทั้งเครื่อง)
> `docker compose ... up` ต้องมี `--no-build` เสมอ เพราะ compose ใช้ `build:` ไม่ใช่ `image:`

---

## 1. Build (บนเครื่องนี้)

อัปเดต marker ก่อน เพื่อพิสูจน์ทีหลังว่า deploy ขึ้นจริง:
```bash
# src/app/api/health/route.ts → buildMarker: 'HERBAL-BUILD-<ชื่อสั้น>'
docker build -f docker/Dockerfile -t herbal-erp-uat-app-uat:latest .
```

**ตรวจ marker ใน image ก่อน save** — กันส่ง image เก่า (เคยพลาดมาแล้ว 3 ครั้ง):
```bash
docker run --rm --entrypoint sh herbal-erp-uat-app-uat:latest \
  -c "grep -c 'HERBAL-BUILD-<ชื่อ>' /app/.next/server/app/api/health/route.js"
# ต้องได้ 1
```

## 2. ส่งขึ้นเซิร์ฟเวอร์

```bash
# เก็บ rollback ก่อนทับ
plink -ssh -batch -pw '<pw>' bms@10.95.10.105 \
  'docker tag herbal-erp-uat-app-uat:latest herbal-erp-uat-app-uat:rollback-<ชื่อเดิม>'

docker save herbal-erp-uat-app-uat:latest | gzip -1 > herbal-app-uat.tar.gz   # 1.8GB→482MB
pscp -batch -pw '<pw>' herbal-app-uat.tar.gz \
  bms@10.95.10.105:/home/bms/docker-compose-bms-herbal/herbal-erp-uat/
```
⚠️ Wi-Fi MTU ต้อง = 1300 ไม่งั้นค้างที่ 4kB · ใช้เวลา ~6 นาที

## 3. Deploy

```bash
plink -ssh -batch -pw '<pw>' bms@10.95.10.105 \
  'cd /home/bms/docker-compose-bms-herbal/herbal-erp-uat && \
   gunzip -t herbal-app-uat.tar.gz && \
   gunzip -c herbal-app-uat.tar.gz | docker load && \
   docker compose -f docker-compose.uat.yml up -d --no-build --no-deps --force-recreate app-uat'
```

## 4. ยืนยันว่าขึ้นจริง

```bash
curl -s https://herbal-erp-test-uat.bmscloud.in.th/api/health
```
ต้องเห็น **marker ใหม่** — `healthy` อย่างเดียวไม่ใช่หลักฐาน (image เก่าก็ healthy)

## 5. ดูหน้าจอ (บังคับสำหรับงาน UI)

`shot.mjs` อยู่ที่ราก repo:
```bash
MSYS_NO_PATHCONV=1 node shot.mjs "/accounting/ar/invoices" "shot.png" 1920
```
แล้ว **Read ไฟล์ .png** — ต้องแคป **1920 และ 1440** เพราะความกว้างเดียวเคยทำให้เข้าใจผิดว่าคอลัมน์หาย

## 6. ล้างไฟล์ชั่วคราว

```bash
rm -f herbal-app-uat.tar.gz shot*.png
plink ... 'cd .../herbal-erp-uat && rm -f herbal-app-uat.tar.gz'
```

---

## Rollback

```bash
plink -ssh -batch -pw '<pw>' bms@10.95.10.105 \
  'cd /home/bms/docker-compose-bms-herbal/herbal-erp-uat && \
   docker tag herbal-erp-uat-app-uat:rollback-<ชื่อ> herbal-erp-uat-app-uat:latest && \
   docker compose -f docker-compose.uat.yml up -d --no-build --no-deps --force-recreate app-uat'
```
`docker images herbal-erp-uat-app-uat` ดูรายการ rollback ที่มี

## Query ฐานข้อมูล UAT

MCP mysql tool ชี้ไป **local** ไม่ใช่ UAT — ต้องผ่านเซิร์ฟเวอร์ และส่ง SQL เป็นไฟล์
(ภาษาไทยผ่าน shell จะพังเป็น `EFBFBD`):
```bash
pscp -batch -pw '<pw>' q.sql bms@10.95.10.105:/tmp/q.sql
plink -ssh -batch -pw '<pw>' bms@10.95.10.105 \
  'cd /home/bms/docker-compose-bms-herbal/herbal-erp-uat && \
   U=$(grep "^MYSQL_USER=" .env | cut -d= -f2-) && P=$(grep "^MYSQL_PASSWORD=" .env | cut -d= -f2-) && \
   docker cp /tmp/q.sql herbal-erp-uat-mysql:/tmp/ && \
   docker exec -e MP="$P" -e MU="$U" herbal-erp-uat-mysql \
     sh -c "mysql -u\"\$MU\" -p\"\$MP\" --default-character-set=utf8mb4 -t herbal_erp_uat < /tmp/q.sql"'
```

## Backup ก่อนแตะข้อมูล

รันเป็น script บนเซิร์ฟเวอร์แบบ detached (SSH หลุดบ่อย) และ**ตรวจว่ามี CREATE TABLE ≥ 100 จริง**
— เคยได้ไฟล์เปล่า 20 bytes ที่ exit code = 0
