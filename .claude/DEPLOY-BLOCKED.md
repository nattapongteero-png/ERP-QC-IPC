# Deploy blocked — HERBAL-BUILD-i18n-ap-tax-exempt

**บล็อกเมื่อ:** 2026-07-28
**สถานะ:** build เสร็จ อิมเมจพร้อมส่ง แต่ deploy ไม่ได้

## ติดตรงไหน

ไม่มีรหัสผ่าน SSH ของ `bms@10.95.10.105` — ต้องขอจากผู้ใช้

- `.claude/DEPLOY.md` และไฟล์ memory ทุกไฟล์เขียนไว้เป็น `<pw>` (placeholder)
- ไม่มี SSH key ที่ `~/.ssh`
- ไม่มี saved PuTTY session (`HKCU:\Software\SimonTatham\PuTTY\Sessions` ว่าง)

ยืนยันแล้วว่าไม่ใช่ปัญหาเน็ตหรือเซิร์ฟเวอร์ล่ม:

```
Test-NetConnection 10.95.10.105 -Port 22   → TcpTestSucceeded: True
plink (ไม่ใส่ -batch, ผ่าน PowerShell)      → "Access denied"
                                              "bms@10.95.10.105's password:"
```

⚠️ `plink -batch` จะ **exit 0 พร้อม stdout และ stderr ว่างเปล่า** เมื่อไม่มีรหัส —
ดูเหมือนคำสั่งสำเร็จที่บังเอิญไม่ปริ้นอะไร ห้ามตีความว่าต่อติด

## พร้อมแล้วอะไรบ้าง

| ขั้นตอน | สถานะ |
|---|---|
| build | ✅ `docker build -f docker/Dockerfile -t herbal-erp-uat-app-uat:latest .` |
| grep marker ในอิมเมจ | ✅ `HERBAL-BUILD-i18n-ap-tax-exempt` อยู่ในอิมเมจจริง |
| save + gzip | ✅ `herbal-app-uat.tar.gz` 482 MB |
| commit + push gitlab/github | ✅ `c8ee72b9f`, `3381f17f5` |

## ทำต่อยังไงเมื่อได้รหัสแล้ว

ตาม `.claude/DEPLOY.md` ข้อ 2-4: tag rollback → `pscp` (~6 นาที, Wi-Fi MTU ต้อง 1300)
→ `gunzip -t` → `docker load` → `docker compose -f docker-compose.uat.yml up -d
--no-build --no-deps --force-recreate app-uat` → `curl /api/health` ยืนยัน marker
→ แคปหน้าจอ AP invoices ทั้ง TH และ EN

**ลบไฟล์นี้ทิ้งทันทีที่ deploy สำเร็จ** — ถ้ายังอยู่ done-gate จะไม่บล็อก deploy ของ
marker นี้ (แต่ marker อื่นยังบล็อกตามปกติ)
