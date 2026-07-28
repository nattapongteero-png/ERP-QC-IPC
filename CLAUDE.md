# herbal-medicine-erp Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-17

---

# ⛔ ขั้นตอนบังคับ — ทุกครั้งที่แก้ไขโปรแกรม

**ทำครบทุกข้อ ห้ามข้าม ห้ามรอให้ผู้ใช้สั่ง** ผู้ใช้ไม่มีหน้าที่มาตรวจว่าทำครบไหม

**ลำดับสำคัญ — ห้ามสลับ** เหตุผลอยู่ในตาราง

| # | ขั้นตอน | เครื่องมือ / คำสั่ง | เกณฑ์ผ่าน |
|---|---|---|---|
| 1 | **หาต้นเหตุ** | `Grep` `Read` — อ่านโค้ดจริง ไม่เดา | รู้ว่าไฟล์ไหน บรรทัดไหน ทำไม |
| 2 | **แก้ไข** | `Edit` (ไม่ใช่ `Write` ทับทั้งไฟล์) | แก้เฉพาะจุด ไม่ refactor รอบข้าง |
| 3 | **ตรวจเช็ค** | `bunx tsc --noEmit --skipLibCheck` | 5 errors เท่าเดิม (baseline) |
| | | `bunx eslint <ไฟล์ที่แก้>` | 0 errors |
| 4 | **ทดสอบ** | `bunx vitest run --project node` | 75 failed เท่าเดิม — **รันทุกครั้ง ห้ามข้ามแม้แก้แค่ CSS** |
| 5 | **commit** | `git add <ไฟล์>` + `git commit` | ไม่มีไฟล์ source ค้าง |
| 6 | **push 2 ที่** | `git push gitlab main`<br>`git push origin main` | ทั้งคู่ = 0 |
| 7 | **build** | `docker build` (ดู `.claude/DEPLOY.md`) | **บนเครื่องนี้เท่านั้น** + ตรวจ marker ใน image ก่อน save |
| 8 | **deploy** | `pscp` + `plink` + `--no-build` | container healthy |
| 9 | **ยืนยัน deploy** | `curl .../api/health` | **marker ใหม่ขึ้นจริง** |
| 10 | **ดูหน้าจอ** (งาน UI) | `node shot.mjs` → **`Read` ไฟล์ .png** | **1920 · 1440 · 768 · 390** ครบ 4 ขนาด (ดูตารางล่าง) |
| 11 | **ตรวจ 2 ภาษา** (งาน UI) | สลับ TH/EN แล้วแคปซ้ำ | ไม่มีข้อความ hardcode · ไม่มี key ดิบ · ไม่ล้นกรอบทั้ง 2 ภาษา |

## งาน 3 แบบ — ขั้นตอนเหมือนกัน แต่เน้นคนละจุด

| แบบ | ตัวอย่าง | ขั้นที่ห้ามพลาด |
|---|---|---|
| **1. แก้ error / บั๊ก** | WHT รหัสบัญชีผิด · สต็อกไม่ถูกตัด · recall หาไม่เจอ | **พิสูจน์ด้วยข้อมูลจริง** — query DB ก่อน/หลัง หรือเขียนเทสที่ fail ก่อนแก้ แล้ว pass หลังแก้ |
| **2. UX/UI** | ปุ่มถูกตัด · คอลัมน์ล้น · key ดิบโผล่ | **แคปหน้าจอ 1920 + 1440 แล้วดูเอง** (ขั้น 10) — เทสจับไม่ได้ |
| **3. พัฒนาระบบใหม่** | รวมบิล · บัญชีคุมใบกำกับ · ออกใบรับรอง WHT | **เขียนเทสใหม่ที่พิสูจน์ว่าทำงาน** + ทดสอบ E2E บน UAT จริง |
| **4. เพิ่มหน้า / เมนู / ปุ่ม** | เพิ่มเมนูใหม่ในแถบซ้าย · เพิ่มปุ่มในหน้าเดิม | **ต้องต่อสายให้ครบทุกจุด** (ดูตารางล่าง) — ลืมจุดใดจุดหนึ่ง = คลิกแล้ว 404 หรือหาเมนูไม่เจอ |

### เพิ่มหน้า / เมนู / ปุ่ม — ต้องแตะครบทุกจุด

**เพิ่มหน้าใหม่:**
1. `src/app/<module>/<page>/page.tsx` — **ห้ามครอบ `MainLayout`** ถ้าอยู่ใต้ module ที่มี `layout.tsx` อยู่แล้ว (accounting/master-data/production/quality) จะซ้อนกัน
2. `src/components/layout/sidebar.tsx` — เพิ่มรายการเมนู
3. **ถ้าอยู่ใต้ `/master-data`** ต้องเพิ่มใน `masterDataModules` array ของหน้า hub ด้วย ไม่งั้นเมนูมีแต่การ์ดไม่มี
4. **เช็ค `next.config.ts` → `redirects()` ก่อนสร้าง** — เช่น `/quality` ถูก redirect ไป `/quality/qc-entry` แล้ว สร้างหน้า `/quality` ไปก็ไม่มีใครเห็น
5. i18n: เพิ่ม key ทั้ง `src/locales/th/*.json` และ `en/*.json` แล้วรัน `bun run i18n:check`
6. เมนูแม่ที่มีลูก (parent) จะเป็นปุ่มพับ/กาง ไม่ต้องมีหน้าจริง แต่ **ถ้ามี `href` จะ prefetch แล้ว 404**

**เพิ่มปุ่มในหน้าเดิม:**
1. ปุ่มต้องมี `aria-label` และกด Tab ถึงได้
2. ปุ่มที่ใช้ไม่ได้ตามสถานะ → `disabled` + บอกเหตุผล **ห้ามซ่อน**
3. ข้อความปุ่มต้องแสดงเต็ม ไม่ถูกตัด — **แคปดูยืนยัน**
4. ถ้าปุ่มเรียก API ที่ยังไม่มี → สร้าง route ด้วย และเช็คสิทธิ์ที่ฝั่ง server ไม่ใช่แค่ซ่อนปุ่ม
5. ปุ่มที่เขียนข้อมูล → กันกดซ้ำ + toast บอกผลสำเร็จ/ล้มเหลว

**ตรวจก่อนบอกเสร็จ:** เปิดหน้าจริงผ่าน `shot.mjs` แล้วดูว่าเมนูโผล่ · กดแล้วไม่ 404 · ปุ่มกดได้จริง

**ทั้ง 3 แบบต้องผ่านครบ 10 ขั้นเหมือนกัน** ต่างกันแค่ว่า "หลักฐานว่าสำเร็จ" คืออะไร:
- แบบ 1 → ตัวเลขใน DB เปลี่ยนถูก
- แบบ 2 → ภาพหน้าจอถูกต้อง
- แบบ 3 → เทสใหม่ผ่าน + ใช้งานจริงได้

## ⚠️ ต้องทดสอบใน Google Chrome — ไม่ใช่แค่แคปภาพ

**ลูกค้าส่วนใหญ่ใช้ Chrome** และมีบั๊กที่เจอเฉพาะ Chrome: กดปุ่มแล้วไม่มีอะไรเกิดขึ้น ·
คลิกแล้วไม่แสดง · dialog ไม่เปิด — Firefox ไม่เจอ

**แคปภาพอย่างเดียวไม่พอ** เพราะภาพบอกได้แค่ว่า "หน้าตาถูก" ไม่ได้บอกว่า "กดแล้วทำงาน"

`shot.mjs` ใช้ Chromium (= Chrome engine) อยู่แล้ว แต่ต้อง **กดจริง** ไม่ใช่แค่ถ่ายรูป:

```js
// หลังโหลดหน้า — กดปุ่มแล้วเช็คว่าเกิดอะไรขึ้นจริง
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
page.on('pageerror', e => console.log('JS ERROR:', e.message));

await page.click('[data-testid="receive-payment-btn"]');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'after-click.png' });   // dialog เปิดไหม
```

**ต้องเช็ค 3 อย่าง:**
1. **console error / JS error** — ถ้ามี = ปุ่มพังแน่นอน
2. **กดแล้วเกิดอะไร** — dialog เปิด? หน้าเปลี่ยน? toast ขึ้น?
3. **ปุ่มถูกบังไหม** — element อื่นทับอยู่จะกดไม่โดน (Playwright จะ error ว่า element not clickable)

> ผู้ใช้แจ้ง 2026-07-28: "คลิกแล้วไม่แสดงใน Chrome หรือ กดไม่ได้ใน Chrome
> ผมเปิด Firefox เลยไม่ค่อยเจอ แต่ลูกค้าส่วนใหญ่ใช้ Chrome"

## ขนาดหน้าจอที่ต้องแคปตรวจ

| ขนาด | อุปกรณ์จริง | ต้องเห็นอะไร |
|---|---|---|
| **1920** | จอ desktop ทั่วไป | ตารางเต็ม ปุ่มมีข้อความ ไม่มีที่ว่างเกิน |
| **1440** | โน้ตบุ๊ก | ยังครบ ไม่ต้องเลื่อนแนวนอน |
| **768** | แท็บเล็ต | ซ่อนคอลัมน์รองได้ แต่ปุ่มหลักต้องกดถึง |
| **390** | **มือถือยุคนี้** (iPhone 14/15, Galaxy S23) | **การ์ด ไม่ใช่ตาราง · ห้าม scroll แนวนอน · ปุ่มสูง ≥44px** |

> 375px คือ iPhone SE/8 (2016-2020) เก่าเกินไปสำหรับเป็นเกณฑ์หลัก
> มือถือปัจจุบันกว้าง **390-430px** — ถ้าผ่านที่ 390 ก็ผ่านที่กว้างกว่า

## ⚠️ ระบบนี้มี 2 ภาษา — ห้าม hardcode ข้อความลงโค้ด

ทุกข้อความที่ผู้ใช้เห็นต้องผ่าน `useTranslations` และมี key **ทั้ง `th` และ `en`**

```tsx
// ❌ ผิด — กด EN แล้วยังเป็นไทย
<button>ส่งออก Excel</button>
text="ชำระครบแล้ว"
hint="พิมพ์ใบกำกับภาษี"

// ✅ ถูก
const t = useTranslations('accounting');
<button>{t('actions.exportExcel')}</button>
```

**ขั้นตอน:** เพิ่ม key ที่ `src/locales/th/*.json` → เพิ่มที่ `en/*.json` → `bun run i18n:check`

**ตรวจก่อนบอกเสร็จ:** แคปหน้าจอ **ทั้ง TH และ EN** — ภาษาอังกฤษมักยาวกว่าไทย ปุ่มที่พอดีในไทยอาจล้นในอังกฤษ

> เมื่อ 2026-07-28 ผม hardcode ไทยไป ~56 จุด (`'ต้นฉบับ (Original)'` `'สำนักงานใหญ่'` `'ค้าง'` `'ลองใหม่'`)
> ทั้งที่กฎนี้เขียนอยู่ใน CLAUDE.md อยู่แล้ว — ผลคือกด EN แล้วยังเป็นไทย

## ⚠️ ก่อนแตะข้อมูลใน DB — backup ทุกครั้ง

1. รัน `mysqldump` เป็น **script บนเซิร์ฟเวอร์แบบ detached** (SSH หลุดบ่อย)
2. **ตรวจว่ามี `CREATE TABLE` ≥ 100 จริง** — เคยได้ไฟล์เปล่า 20 bytes ที่ exit code = 0
3. ตรวจ footer `-- Dump completed`

**ห้ามเชื่อ exit code** — คำสั่งสำเร็จไม่ได้แปลว่าได้ข้อมูล

## ⚠️ ก่อน deploy — tag rollback ทุกครั้ง

```bash
docker tag herbal-erp-uat-app-uat:latest herbal-erp-uat-app-uat:rollback-<ชื่อเดิม>
```
ทำทุกครั้ง ไม่ต้องประเมินว่างานใหญ่พอไหม — การเดาว่า "งานนี้เล็ก ไม่ต้อง rollback" คือจุดที่พลาด

## ⚠️ เทส กับ แคปหน้าจอ ตรวจคนละเรื่อง — ต้องทำทั้งคู่

เทส `.tsx` ในโปรเจกต์นี้ตรวจแค่ว่า **element มีอยู่ไหม** (`renders data grid`,
`displays status badges`) ไม่ได้ตรวจว่าหน้าตาถูกต้อง เทสพวกนี้**ผ่านหมด**ตอนที่
ปุ่มถูกตัดเป็น `อนุ...` และตอนที่ action ถูกซ่อนใต้เมนู `⋯`

| ตรวจอะไร | เทส vitest | แคปหน้าจอ |
|---|---|---|
| element มีอยู่ไหม | ✅ | ✅ |
| **ข้อความถูกตัดไหม** | ❌ | ✅ |
| **คอลัมน์ล้นกรอบไหม** | ❌ | ✅ |
| **ปุ่มทับกัน / เมนูบัง** | ❌ | ✅ |
| **key แปลภาษาโผล่ดิบ** | ❌ | ✅ |
| logic คำนวณถูกไหม | ✅ | ❌ |
| ไม่พังไฟล์อื่นที่ไม่ได้แก้ | ✅ | ❌ |

**ห้ามข้ามเทสเพราะ "แก้แค่ CSS"** — การแก้ layout ทำไฟล์อื่นพังได้
(เคยทำ JSX syntax error ใน chart component มาแล้ว) เทสตรวจว่า *ไม่พังของเดิม*
ไม่ใช่ตรวจว่าสวย

**ทำไมลำดับนี้:**
- **ตรวจเช็ค+ทดสอบ ก่อน commit** — ไม่ commit โค้ดที่พัง
- **push ก่อน build** — ไม่งั้น image ที่รันบน UAT มีโค้ดที่ไม่มีใน remote (Docker build จาก working tree ไม่ใช่ HEAD)
- **ยืนยัน marker ก่อนดูหน้าจอ** — ไม่งั้นอาจแคปภาพของ image เก่า
- **ดูหน้าจอก่อนบอกเสร็จ** — ขั้นที่เคยข้ามแล้วผู้ใช้ต้องมาเจอเอง

**หลังทำครบ** รายงานผู้ใช้พร้อม: ผลแต่ละขั้น · marker ที่ live · ลิงก์หน้าจอ · **ภาพที่แคป** · สิ่งที่ยังไม่ได้ตรวจ

## กฎที่ห้ามฝ่าฝืน

- **ห้ามบอกว่า "เสร็จแล้ว"** ถ้ายังไม่ได้ดูภาพหน้าจอ (สำหรับงาน UI)
- **ห้าม build บนเซิร์ฟเวอร์** — RAM ไม่พอ จะ OOM กระทบ 8 ระบบที่รันอยู่
- **ห้าม push แค่ที่เดียว** — repo นี้มี 2 remote (`gitlab` + `origin`=GitHub)
- **ห้ามเชื่อว่า deploy สำเร็จ** เพราะ container healthy — ต้อง curl ดู marker
- **ห้ามออกแบบ UI เอง** — แก้เฉพาะข้อบกพร่องที่วัดได้ (ข้อความถูกตัด, คอลัมน์ล้น, key ดิบ) เรื่องความสวยต้องถามผู้ใช้
- **ห้ามส่งภาษาไทยผ่าน shell** — ใช้ไฟล์ `.sql` แล้วตรวจด้วย `HEX()` (`E0B8xx` = ถูก, `EFBFBD` = พัง)
- **ห้าม query โดยไม่เช็ค `SELECT DATABASE()`** — MCP tool ชี้ไป local ไม่ใช่ UAT

## ตัวช่วยอัตโนมัติ

`scripts/claude-done-gate.mjs` รันเป็น Stop hook ทุกครั้งที่จบงาน — บล็อกถ้าขาด commit / push / deploy / screenshot / typecheck


## Active Technologies
- TypeScript  with Next.js , React , DevExpress / DevExtreme React 25.x
- TypeScript 5.x with Next.js 14+ + Drizzle ORM, DevExtreme React 25.x, TanStack Query, Zod (009-gmp-compliance-gap-analysis)
- MySQL (production), SQLite (testing) via Drizzle dual-schema (009-gmp-compliance-gap-analysis)
- MySQL (production), SQLite (testing) via dual-schema pattern (010-accounting-module-integration)
- TypeScript 5.x with Next.js 16.0.10 + Drizzle ORM, DevExtreme React 25.2.3, TanStack Query 5.x, Zod 4.x (011-accounting-spec-gap)
- MySQL (production), SQLite (testing) via Drizzle dual-schema pattern (012-vmi-webhook)
- TypeScript 5.x with Next.js 16.0.10 + React 19, DevExtreme React 25.2.3, TanStack Query 5.x, Lucide React (icons) (013-workflow-test)
- MySQL (production), SQLite (testing) via Drizzle ORM (013-workflow-test)
- TypeScript 5.x with Next.js 16.0.10 + React 19, DevExtreme React 25.2.3, Drizzle ORM, TanStack Query 5.x, Zod 4.x (014-unit-cost)
- TypeScript 5.x with Next.js 16.0.10 + React 19.2.1 + next-intl (i18n), DevExtreme React 25.2.3 (UI components), js-cookie (persistence) (015-i18n)
- Browser localStorage for preference, optional user profile sync (015-i18n)

## Always do E2E test using React Testing Library + Jest/Vitest

- Render a page/component

- Mock fetch/data

- Assert that it renders without crashing and key UI is present

## Always check for coding error

Run `bunx tsc --noEmit --skipLibCheck` before finishing tasks. ESLint and Vitest don't catch all type errors.

## Project Structure

```text
src/
tests/
```

## Commands

bun test && bun run lint

## Code Style

TypeScript  (Next.js  project): Follow standard conventions


<!-- MANUAL ADDITIONS START -->

## Reusable Code Policy

When implementing features, follow the DRY (Don't Repeat Yourself) principle:

1. **Check for existing utilities first** - Before creating new functions, search the codebase for existing implementations in:
   - `src/lib/utils/` - General utilities
   - `src/lib/db/` - Database utilities
   - `src/lib/services/` - Shared service logic
   - `src/components/` - Reusable UI components

2. **Extract common patterns** - When you find yourself writing similar code in multiple places:
   - Extract to a shared utility function
   - Place in the appropriate `src/lib/` subdirectory
   - Export from an index file for easy imports

3. **Service layer abstraction** - Business logic should be in service files (`src/lib/services/`), not duplicated across API routes or components.

4. **Component reusability** - Create reusable components for UI patterns used in 2+ places. Place in `src/components/` with clear prop interfaces.

5. **Type sharing** - Define shared types in `src/types/` and import them where needed. Avoid redefining the same interfaces.

**Location for new utilities:**
- Date/time helpers → `src/lib/db/date-utils.ts`
- Validation helpers → `src/lib/validation/`
- API response helpers → `src/lib/utils/`
- Database queries → `src/lib/services/`

## MySQL/SQLite Date Handling

When writing service code that uses datetime fields with the dual-database pattern (MySQL production, SQLite testing), import from the shared utility:

```typescript
import { getNow, toDbDate, getTodayStr } from '../db/date-utils';

// Usage:
createdAt: getNow(),                    // For datetime fields
updatedAt: getNow(),
dueDate: toDbDate(data.dueDate),        // For date strings from user input
closedDate: toDbDate(getTodayStr()),    // For today's date
```

**Why:** MySQL datetime columns reject ISO 8601 format (`2024-12-23T10:30:00.000Z`). Use `Date` objects for MySQL and ISO strings for SQLite.

**Location:** `src/lib/db/date-utils.ts`

### Reading dates from database

When reading date fields from the database, always use safe conversion:

```typescript
import { toDateSafe, formatDateFromDb, formatMonthFromDb } from '../db/date-utils';

// Convert DB value to Date object safely
const date = toDateSafe(record.dateField);

// Format DB value to YYYY-MM-DD string
const dateStr = formatDateFromDb(record.dateField);

// Format DB value to YYYY-MM month string
const monthStr = formatMonthFromDb(record.dateField);
```

**Why:** SQLite returns date fields as strings, MySQL returns Date objects. These utilities handle both.

### Dates in Query Conditions

When using dates in Drizzle ORM comparison operators (`gte`, `lte`, `eq`, etc.), use `toQueryDate()`:

```typescript
import { toQueryDate, getTodayStr } from '../db/date-utils';

// For today's date in queries
const today = toQueryDate(getTodayStr());
.where(lte(table.dueDate, today))

// For date parameters from API
.where(gte(table.createdAt, toQueryDate(dateFrom)))
.where(lte(table.createdAt, toQueryDate(dateTo)))
```

**Why:** MySQL datetime columns require Date objects in query conditions. SQLite uses text comparison. `toQueryDate()` handles both.

## Template Module - ERP Module Reference

When creating a new ERP module, use the **Template Module** (`/template`) as the standard reference implementation. It demonstrates the correct patterns for:

### File Structure
```
src/
├── types/template.ts                    # Type definitions (interfaces, enums)
├── lib/
│   ├── validation/template.ts           # Zod validation schemas
│   ├── db/schema-template.ts            # Database schema (SQLite + MySQL)
│   └── services/template.service.ts     # Business logic with db-helper utilities
├── app/
│   ├── template/
│   │   ├── layout.tsx                   # MainLayout wrapper for sidebar
│   │   ├── page.tsx                     # Dashboard with KPIs and charts
│   │   └── items/
│   │       ├── page.tsx                 # List page with DataGrid
│   │       ├── new/page.tsx             # Create form
│   │       └── [id]/page.tsx            # Edit form (reuses form component)
│   └── api/template/                    # API routes
├── components/template/                 # Reusable UI components
└── tests/app/template/page.test.tsx     # UI tests
```

### Key Patterns to Follow

1. **Service Layer** - Use `executeDbOperation()`, `getTableRef()`, `getInsertId()` from `db-helper.ts`
2. **Database Schema** - Define both SQLite and MySQL tables, export from `schema.ts` for auto-sync
3. **Validation** - Use Zod schemas in `src/lib/validation/`
4. **UI Components** - DevExtreme React (DataGrid, Form, SelectBox), Recharts for charts
5. **Sidebar Navigation** - Add module to `src/components/layout/sidebar.tsx`
6. **Tests** - React Testing Library with mocked fetch

### Service Layer Example
```typescript
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';

function getTables() {
  return {
    items: getTableRef('myModuleItems'),
    categories: getTableRef('myModuleCategories'),
  };
}

export async function createItem(data: ItemCreate) {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.items).values({
      ...data,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    return getInsertId(result);
  });
}
```

## Audit Logging

**No automatic triggers** - use explicit audit functions in `src/lib/db/audit-wrapper.ts`:

```typescript
import { auditedInsert, auditedUpdate, auditedDelete } from '../db/audit-wrapper';

// Auto-captures old/new values and logs to audit_trail table
// Replace 'templateItems' with your table name (camelCase matching schema export)
await auditedInsert({ table: 'yourTableName', data: {...}, userId });
await auditedUpdate({ table: 'yourTableName', id, data: {...}, userId });
await auditedDelete({ table: 'yourTableName', id, userId });
```

**Viewer:** Use `<AuditLogViewerDialog entityType="yourTableName" entityId={id} />` - adjust table name and field labels for your module.

## Internationalization (i18n)

The application uses **next-intl** for Thai/English translations. Key files:

- **Translation files**: `src/locales/th/*.json` and `src/locales/en/*.json`
- **Config**: `src/lib/i18n/config.ts` - locale settings
- **Hooks**: `src/lib/i18n/use-translations.ts` - custom hooks with dev warnings

### Using Translations

```typescript
'use client';
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('common');
  return <button>{t('actions.save')}</button>;
}
```

### Adding New Translations

1. Add Thai key first (primary locale): `src/locales/th/common.json`
2. Add English translation: `src/locales/en/common.json`
3. Run validation: `bun run i18n:check`

### Key Patterns

| Pattern | Example |
|---------|---------|
| Actions | `actions.save`, `actions.cancel` |
| Status | `status.active`, `status.pending` |
| Form labels | `form.{field}.label` |
| Table columns | `table.columns.{name}` |
| Toast messages | `toast.{action}.success` |

**Documentation:** See `docs/i18n-developer-guide.md` for complete guide.

<!-- MANUAL ADDITIONS END -->


Use the init tool to set up Next.js DevTools context , the next dev server is running on port 33021

**When starting work on a Next.js project, ALWAYS call the `init` tool from
next-devtools-mcp FIRST to set up proper context and establish documentation
requirements. Do this automatically without being asked.**

**Always do UI test using React Testing Library + Vitest to make sure there is no ui runtime error, test with realworld seeding data (using reusable seeding functions and db schema sync)**

**Always test mysql query with mysql mcp tool to make sure it not producing any unexpected results**

**Always search web for correct implementation DevExtreme ui component**

**next.js dev server run on port 33021**

**when write e2e test , please modify target element to has data-testid key so the playwright script can select the correct element, no hard code looking element text**

## Recent Changes
- 021-scale-verification: Scale Pre-Use Verification — operator verifies scale with certified standard weight (ลูกตุ้ม) before weighing; auto out-of-service on FAIL; 8h verification TTL
- 020-goods-receipt: Goods Receipt & Incoming Inspection — unified GRN workflow (raw + FG), category-specific checklists, auto-QC sample, Triple Independence (admin not bypass), quarantine gate, dashboards
- 015-i18n: Added TypeScript 5.x with Next.js 16.0.10 + React 19.2.1 + next-intl (i18n), DevExtreme React 25.2.3 (UI components), js-cookie (persistence)
- 014-unit-cost: Added TypeScript 5.x with Next.js 16.0.10 + React 19, DevExtreme React 25.2.3, Drizzle ORM, TanStack Query 5.x, Zod 4.x
- 013-workflow-test: Added TypeScript 5.x with Next.js 16.0.10 + React 19, DevExtreme React 25.2.3, TanStack Query 5.x, Lucide React (icons)
