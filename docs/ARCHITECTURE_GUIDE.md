# คู่มือสถาปัตยกรรม — Herbal Medicine ERP

> เอกสารนี้อธิบายว่าระบบ **เชื่อมต่อ frontend ↔ backend ↔ database แบบไหน** และมี **รูปแบบ (pattern) อะไรบ้าง** เพื่อให้ทีมพัฒนาอื่นเข้ามาอ่านแล้วพัฒนาต่อได้ทันที
>
> อัปเดตล่าสุด: 2026-06-04 · สแกนจากซอร์สโค้ดจริง (ไม่ใช่เอกสารเก่า)

---

## สารบัญ

1. [ภาพรวมสถาปัตยกรรม](#1-ภาพรวมสถาปัตยกรรม)
2. [Tech Stack](#2-tech-stack)
3. [การไหลของข้อมูล (Request Flow)](#3-การไหลของข้อมูล-request-flow)
4. [ชั้นที่ 1 — Frontend (UI → API)](#4-ชั้นที่-1--frontend-ui--api)
5. [ชั้นที่ 2 — API Routes (Backend)](#5-ชั้นที่-2--api-routes-backend)
6. [ชั้นที่ 3 — Service Layer (Business Logic)](#6-ชั้นที่-3--service-layer-business-logic)
7. [ชั้นที่ 4 — Database (Dual-Schema Drizzle)](#7-ชั้นที่-4--database-dual-schema-drizzle)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Audit Logging](#9-audit-logging)
10. [Internationalization (i18n)](#10-internationalization-i18n)
11. [โครงสร้างโฟลเดอร์](#11-โครงสร้างโฟลเดอร์)
12. [วิธีเพิ่มโมดูลใหม่ (Step-by-step)](#12-วิธีเพิ่มโมดูลใหม่-step-by-step)
13. [คำสั่งที่ใช้บ่อย & การตั้งค่า Environment](#13-คำสั่งที่ใช้บ่อย--การตั้งค่า-environment)
14. [กฎสำคัญ (Gotchas) ที่ต้องรู้](#14-กฎสำคัญ-gotchas-ที่ต้องรู้)

---

## 1. ภาพรวมสถาปัตยกรรม

ระบบนี้เป็น **Next.js Full-Stack Monolith** — frontend และ backend อยู่ในโปรเจกต์เดียวกัน **ไม่มี server แยกต่างหาก** (ไม่มี Express / NestJS / Spring) ตัว **Next.js App Router API Routes** ทำหน้าที่เป็น backend ทั้งหมด

| คุณสมบัติ | รายละเอียด |
|-----------|-----------|
| รูปแบบ API | **REST** (ไม่ใช่ tRPC / GraphQL) |
| Backend | Next.js 16 API Routes (`src/app/api/**/route.ts`) |
| State / Data fetching | **TanStack Query (React Query)** + `fetch()` |
| ORM | **Drizzle ORM** |
| Database | **MySQL (production) / SQLite (testing/dev)** — สลับด้วย env `DB_TYPE` |
| Auth | **Custom JWT** ใน httpOnly cookie (มี `next-auth` ติดตั้งไว้แต่ระบบหลักใช้ JWT เอง) |
| Validation | **Zod** |

หลักการแบ่งชั้น (layered) ที่ต้องยึด:

```
UI (React Client Component)
   │   useQuery / useMutation → fetch('/api/...')
   ▼
API Route (route.ts)         ← เช็ค auth, validate (Zod), จัดการ HTTP status
   │   เรียก service function
   ▼
Service (*.service.ts)       ← business logic ทั้งหมดอยู่ที่นี่
   │   executeDbOperation / getTableRef
   ▼
Database (Drizzle ORM)       ← MySQL หรือ SQLite
```

> **กฎเหล็ก:** business logic **ต้องอยู่ใน service layer** เท่านั้น — API route เป็นแค่ "ทางผ่าน" (validate + เรียก service + แปลง error เป็น HTTP status) อย่าเขียน query หรือ logic หนักๆ ใน route.ts

---

## 2. Tech Stack

อ้างอิงจาก [package.json](../package.json):

**Runtime / Framework**
- Next.js `16.0.10` (App Router) · React `19.2.1` · TypeScript `5.x`
- Build/dev ใช้ **Webpack** (`next dev --webpack`, `next build --webpack`)

**Data / Backend**
- Drizzle ORM `0.45.1` + drizzle-kit `0.31.8`
- `mysql2` (production) · `better-sqlite3` (testing)
- `zod 4.x` (validation)
- `bcryptjs` (password hash) · `jsonwebtoken` (JWT)

**UI**
- DevExtreme React `25.2.3` (DataGrid, Form, SelectBox) + DevExpress Reporting
- Radix UI + Tailwind CSS 4 (`src/components/ui/*` — shadcn-style)
- `recharts` (กราฟ) · `lucide-react` (ไอคอน) · `sonner` (toast)
- `next-intl 4.x` (i18n ไทย/อังกฤษ)

**Testing**
- Vitest `4.x` + Testing Library + jsdom · Playwright (E2E)

**Dev server รันที่ port `33021`**

---

## 3. การไหลของข้อมูล (Request Flow)

ตัวอย่างจริง: การโหลดรายการ "Template Items"

```
┌─ Browser ─────────────────────────────────────────────────────────┐
│ Page (Client Component)                                            │
│   useQuery(['template-items'], () =>                               │
│     fetch('/api/template/items?status=active').then(r => r.json()))│
└───────────────────────────────┬───────────────────────────────────┘
                                 │ HTTP GET (พร้อม cookie auth-token)
┌─ Next.js Server ───────────────▼───────────────────────────────────┐
│ src/app/api/template/items/route.ts  → export async function GET   │
│   withAuth(request, async (session) => {                           │
│      validate query params                                         │
│      const result = await listTemplateItems({...})  ◄── service    │
│      return successResponse(result)                                │
│   }, [])                                                           │
└───────────────────────────────┬───────────────────────────────────┘
                                 │
┌─ Service Layer ────────────────▼───────────────────────────────────┐
│ src/lib/services/template.service.ts → listTemplateItems()         │
│   executeDbOperation(async (db) => {                               │
│      const tables = getTemplateTables()  // getTableRef(...)       │
│      return db.select()...leftJoin()...where()...limit()           │
│   })                                                               │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ Drizzle ORM
┌─ Database ─────────────────────▼───────────────────────────────────┐
│  MySQL (prod)  /  SQLite (test)  — เลือกอัตโนมัติด้วย DB_TYPE       │
└────────────────────────────────────────────────────────────────────┘
```

**Response envelope มาตรฐาน** (ทุก endpoint คืนรูปแบบนี้):

```jsonc
// สำเร็จ
{ "success": true, "data": { ... }, "message": "optional" }

// ผิดพลาด
{ "success": false, "error": "ข้อความ", "debug": { ... } /* dev เท่านั้น */ }
```

---

## 4. ชั้นที่ 1 — Frontend (UI → API)

หน้าเพจเป็น **Client Component** (`'use client'`) ใช้ **TanStack Query** เรียก API ผ่าน `fetch()` โดยตรง — **ไม่ได้ใช้ Server Actions**

### อ่านข้อมูล — `useQuery`

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, refetch } = useQuery({
  queryKey: ['template-items'],
  queryFn: async () => {
    const res = await fetch('/api/template/items?status=active');
    if (!res.ok) throw new Error('Failed');
    return res.json(); // { success, data: {...} }
  },
});
```

### เขียนข้อมูล — `useMutation`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const qc = useQueryClient();
const createMut = useMutation({
  mutationFn: async (payload) => {
    const res = await fetch('/api/template/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!body.success) throw new Error(body.error);
    return body.data;
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['template-items'] }),
});
```

### ตัวช่วยกลาง — `api` client (ทางเลือก)

มี wrapper ที่ [src/lib/api-client.ts](../src/lib/api-client.ts) ซึ่งจัดการ error อัตโนมัติ (ส่งเข้า global error context):

```typescript
import { api } from '@/lib/api-client';

const res = await api.get('/api/template/items');     // GET
await api.post('/api/template/items', payload);       // POST + JSON header
await api.patch('/api/template/items/5', patch);
await api.delete('/api/template/items/5');
// ทุกตัวคืน { success, data?, error?, debug? }
```

> Cookie `auth-token` ถูกแนบอัตโนมัติเพราะเป็น same-origin request — ไม่ต้องใส่ Authorization header เอง

---

## 5. ชั้นที่ 2 — API Routes (Backend)

ทุก endpoint คือไฟล์ `route.ts` ใต้ [src/app/api/](../src/app/api/) โดย export ฟังก์ชันตาม HTTP method (`GET`, `POST`, `PATCH`, `DELETE`)

ตัวอย่างจริงจาก [src/app/api/template/items/route.ts](../src/app/api/template/items/route.ts):

```typescript
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { listTemplateItems, createTemplateItem } from '@/lib/services/template.service';
import { templateItemCreateSchema } from '@/lib/validation/template';

// GET /api/template/items
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const result = await listTemplateItems({
        status: searchParams.get('status') ?? undefined,
        page: Number(searchParams.get('page') ?? 1),
        limit: Number(searchParams.get('limit') ?? 50),
      });
      return successResponse(result);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, []); // [] = ผู้ใช้ที่ login แล้วทุกคนเข้าได้
}

// POST /api/template/items
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const parsed = templateItemCreateSchema.safeParse(body);   // ◄── Zod validate
      if (!parsed.success) {
        const errors = parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
        return errorResponse('Validation failed', 400, { errors });
      }
      const item = await createTemplateItem(parsed.data, session.userId);  // ◄── เรียก service
      return successResponse(item, 'Item created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']); // ◄── ต้องมี permission นี้
}
```

### หน้าที่ของ route (3 อย่างเท่านั้น)

1. **ตรวจสิทธิ์** ผ่าน `withAuth(request, handler, requiredPermissions)`
2. **validate input** ด้วย Zod (`schema.safeParse`)
3. **เรียก service** แล้วแปลงผลเป็น HTTP response helper

### Response helpers — [src/lib/api-utils.ts](../src/lib/api-utils.ts)

| Helper | Status | ใช้เมื่อ |
|--------|--------|---------|
| `successResponse(data, msg?)` | 200 | สำเร็จ |
| `errorResponse(msg, status, extra?)` | กำหนดเอง (400 ปกติ) | input/validation ผิด |
| `unauthorizedResponse()` | 401 | ยังไม่ login |
| `forbiddenResponse()` | 403 | สิทธิ์ไม่พอ |
| `notFoundResponse()` | 404 | ไม่พบข้อมูล |
| `serverErrorResponse(error, ctx?)` | 500 | exception ที่ไม่คาดคิด (แนบ stack ใน dev) |

นอกจากนี้มี pagination helper: `getPaginationParams(searchParams)` และ `createPaginatedResponse(items, total, params)`

---

## 6. ชั้นที่ 3 — Service Layer (Business Logic)

อยู่ที่ [src/lib/services/](../src/lib/services/) — เป็นที่รวม **business logic ทั้งหมด** (~97 ไฟล์) ตามหลัก DRY ใน CLAUDE.md

แพทเทิร์นมาตรฐาน (จาก [template.service.ts](../src/lib/services/template.service.ts)):

```typescript
import { eq, and, like, desc, count } from 'drizzle-orm';
import { getNow, toDbDate } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';

// 1) รวม table refs ไว้ที่เดียว — getTableRef เลือก SQLite/MySQL ให้อัตโนมัติ
function getTemplateTables() {
  return {
    categories: getTableRef('templateCategories'),
    items: getTableRef('templateItems'),
  };
}

// 2) ทุก operation ห่อด้วย executeDbOperation (inject db ที่ถูกต้องให้)
export async function createTemplateItem(data: TemplateItemCreate, userId?: number) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // ตรวจ business rule (เช่น ห้าม code ซ้ำ)
    const existing = await db.select().from(tables.items)
      .where(eq(tables.items.code, data.code)).limit(1);
    if (existing.length > 0) throw new Error(`Item with code "${data.code}" already exists`);

    const now = getNow();                       // ◄── ใช้ helper จัดการวันที่ MySQL/SQLite
    const result = await db.insert(tables.items).values({
      ...data,
      dueDate: data.dueDate ? toDbDate(data.dueDate) : null,
      createdAt: now, updatedAt: now,
    });
    const insertId = getInsertId(result);       // ◄── helper อ่าน id ทั้ง 2 DB
    return insertId;
  });
}
```

### Utilities สำคัญใน [db-helper.ts](../src/lib/db/db-helper.ts)

| ฟังก์ชัน | หน้าที่ |
|---------|--------|
| `getTableRef('camelCaseName')` | คืน table ref ของ DB ปัจจุบัน (map `xxx` → `sqliteXxx` หรือ `mysqlXxx`) |
| `executeDbOperation(fn)` | inject `db` ที่ถูกต้อง (await `getDb()`) เข้า callback |
| `getInsertId(result)` | อ่าน id ที่เพิ่ง insert (SQLite `lastInsertRowid` vs MySQL `insertId`) |
| `getAffectedRows(result)` | อ่านจำนวนแถวที่กระทบ (ใช้ตรวจ optimistic-lock ใน UPDATE) |
| `dbOperations` / `db` | shortcut CRUD สำเร็จรูป (`db.selectById`, `db.updateById`, `db.count`, …) |

---

## 7. ชั้นที่ 4 — Database (Dual-Schema Drizzle)

### หัวใจของระบบ: หนึ่ง schema สองฐานข้อมูล

ทุกตารางถูกประกาศ **สองชุด** ในไฟล์ schema เดียวกัน — ชุด SQLite (`sqliteXxx`) สำหรับ test/dev และชุด MySQL (`mysqlXxx`) สำหรับ production ดูตัวอย่างที่ [schema-template.ts](../src/lib/db/schema-template.ts):

```typescript
// ── SQLite (testing) ──
export const sqliteTemplateItems = sqliteTable('template_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  quantity: real('quantity').notNull().default(0),
  dueDate: text('due_date'),                       // เก็บเป็น string
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ── MySQL (production) — ชื่อตาราง/คอลัมน์เดียวกัน แต่ type ของ DB ต่างกัน ──
export const mysqlTemplateItems = mysqlTable('template_items', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  dueDate: date('due_date'),                        // เก็บเป็น Date
  createdAt: datetime('created_at').notNull().default(new Date()),
});
```

จากนั้น **export type จากฝั่ง SQLite** เป็น single source of truth:

```typescript
export type TemplateItem = typeof sqliteTemplateItems.$inferSelect;
export type NewTemplateItem = typeof sqliteTemplateItems.$inferInsert;
```

> ทุก schema ย่อย (`schema-template.ts`, `schema-goods-receipt.ts`, …) ต้อง **re-export ผ่าน [schema.ts](../src/lib/db/schema.ts)** เพื่อให้ `getTableRef()` และ schema-sync มองเห็น

### การเลือก DB และ connection — [src/lib/db/index.ts](../src/lib/db/index.ts)

```typescript
export function isSqlite(): boolean {
  return process.env.DB_TYPE === 'sqlite';   // ไม่มี DB_TYPE=sqlite → ใช้ MySQL
}

export async function getDb(): Promise<Db> {
  return isSqlite() ? getSqliteDb() : getMysqlDb();
}
```

- **MySQL**: connection pool (`mysql2`), อ่าน config จาก `DATABASE_URL` หรือ `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`
- **SQLite**: ไฟล์เดียว + WAL mode, path จาก `SQLITE_DB_PATH`

### Schema Sync — ไม่ต้องเขียน migration เอง

ตอน server start ไฟล์ [src/instrumentation.ts](../src/instrumentation.ts) จะเรียก `initializeDatabaseWithSync()` ใน [schema-sync.ts](../src/lib/db/schema-sync.ts) ซึ่ง **เทียบ schema กับ DB จริงแล้วสร้างตาราง/คอลัมน์ที่ขาดให้อัตโนมัติ**

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabaseWithSync } = await import('./lib/db/schema-sync');
    await initializeDatabaseWithSync();   // สร้างตารางที่ขาด ไม่ทำลายข้อมูลเดิม
  }
}
```

> ยังมีคำสั่ง drizzle-kit (`db:generate`, `db:push`, `db:migrate`, `db:studio`) สำรองไว้ แต่ flow ปกติพึ่ง schema-sync ตอน startup

### การจัดการวันที่ (สำคัญมาก) — [date-utils.ts](../src/lib/db/date-utils.ts)

MySQL กับ SQLite จัดการ datetime ต่างกัน **ห้ามใส่ ISO string ลง MySQL datetime ตรงๆ** ให้ใช้ helper เสมอ:

```typescript
import { getNow, toDbDate, getTodayStr, toQueryDate, formatDateFromDb } from '@/lib/db/date-utils';

createdAt: getNow(),                    // เขียน datetime
dueDate: toDbDate(data.dueDate),        // เขียน date จาก user input
.where(gte(t.createdAt, toQueryDate(dateFrom)))  // ใช้ใน query condition
const str = formatDateFromDb(row.createdAt);     // อ่านออกมาเป็น YYYY-MM-DD
```

---

## 8. Authentication & Authorization

### Session = JWT ใน httpOnly cookie — [src/lib/auth/index.ts](../src/lib/auth/index.ts)

```typescript
// login สำเร็จ → setSession() เซ็น JWT แล้วเก็บใน cookie 'auth-token' (อายุ 7 วัน)
await setSession({ userId, email, role, name });

// อ่าน session ใน API route / server
const session = await getSession();   // คืน JWTPayload | null
```

- password hash ด้วย `bcrypt` (cost 12)
- JWT เซ็นด้วย `JWT_SECRET` (env) อายุ `JWT_EXPIRES_IN` (default `7d`)
- cookie เป็น `httpOnly` + `secure` (เฉพาะ production) + `sameSite: lax`

### RBAC — Role + Permission

มี role หลัก เช่น `admin, manager, production, qc, warehouse, purchasing, sales, finance, accountant, hr, …` และ permission ละเอียดเป็นร้อยรายการ (เช่น `items:write`, `quality:approve`, `accounting:journal_entries:post`)

**บังคับสิทธิ์ผ่าน `withAuth()`** — argument ที่ 3 คือ permission ที่ต้องมี:

```typescript
withAuth(request, handler, ['items:write']);  // ต้องมี items:write
withAuth(request, handler, []);               // login แล้วทุกคนเข้าได้
```

ภายใน `withAuth` ([api-utils.ts](../src/lib/api-utils.ts)) ใช้ **two-source authorization**:

1. **Static map** ใน `PERMISSIONS` (hardcode ใน `auth/index.ts`)
2. **DB-backed** `hr_role_permissions` (admin แก้ผ่านหน้า `/hr/roles` ได้โดยไม่ต้องแก้โค้ด)

> ผ่านถ้า **ฝั่งใดฝั่งหนึ่งอนุญาต** · `admin` (และ role ที่ expand เป็น admin) **bypass ทุก permission** · ถ้าสิทธิ์ไม่พอจะคืน 403 พร้อมข้อความไทยบอกว่าขาด permission ตัวไหน

---

## 9. Audit Logging

**ไม่มี trigger อัตโนมัติ** — ต้องเรียก audit function เองที่ service layer ผ่าน [src/lib/db/audit-wrapper.ts](../src/lib/db/audit-wrapper.ts):

```typescript
import { auditedInsert, auditedUpdate, auditedDelete } from '../db/audit-wrapper';

// จับ old/new value แล้วบันทึกลงตาราง audit_trail ให้อัตโนมัติ
const id = await auditedInsert({ table: 'templateItems', data, userId });
await auditedUpdate({ table: 'templateItems', id, data, userId });
await auditedDelete({ table: 'templateItems', id, userId });
```

ดู log ในหน้า UI ได้ผ่าน `<AuditLogViewerDialog entityType="templateItems" entityId={id} />`

---

## 10. Internationalization (i18n)

ใช้ **next-intl** รองรับไทย/อังกฤษ (ไทยเป็น primary)

- ไฟล์แปล: `src/locales/th/*.json`, `src/locales/en/*.json`
- ใช้งานใน component:

```typescript
'use client';
import { useTranslations } from 'next-intl';
const t = useTranslations('common');
<button>{t('actions.save')}</button>
```

- เพิ่ม key ใหม่ → ใส่ฝั่งไทยก่อน แล้วฝั่งอังกฤษ → รัน `bun run i18n:check`
- คู่มือเต็ม: `docs/i18n-developer-guide.md`

---

## 11. โครงสร้างโฟลเดอร์

```
src/
├── app/
│   ├── api/                      # ★ Backend — REST endpoints (route.ts)
│   │   ├── auth/                 #   login, logout, session
│   │   ├── template/             #   โมดูลตัวอย่าง (อ้างอิงมาตรฐาน)
│   │   ├── inventory/  production/  quality/  accounting/  hr/ ...
│   │   └── ...                   #   40+ โมดูล
│   ├── (หน้าเพจ)/                # Client Components: page.tsx, layout.tsx
│   │   └── template/items/[id]/page.tsx
│   └── ...
├── components/
│   ├── ui/                       # ปุ่ม/ฟอร์ม/ตาราง (Radix + Tailwind)
│   ├── layout/                   # sidebar.tsx, main-layout.tsx
│   └── <module>/                 # component เฉพาะโมดูล
├── lib/
│   ├── services/                 # ★ Business logic (*.service.ts)
│   ├── db/
│   │   ├── index.ts              #   connection + getDb/isSqlite
│   │   ├── db-helper.ts          #   getTableRef/executeDbOperation/getInsertId
│   │   ├── schema.ts             #   รวม + re-export ทุก schema ย่อย
│   │   ├── schema-<module>.ts    #   schema คู่ SQLite+MySQL ต่อโมดูล
│   │   ├── schema-sync.ts        #   auto-create ตาราง/คอลัมน์ตอน startup
│   │   ├── date-utils.ts         #   getNow/toDbDate/toQueryDate/...
│   │   └── audit-wrapper.ts      #   auditedInsert/Update/Delete
│   ├── auth/                     # JWT, password, ROLES, PERMISSIONS
│   ├── validation/               # Zod schemas (ต่อโมดูล)
│   ├── api-utils.ts              # withAuth + response helpers (ฝั่ง server)
│   └── api-client.ts             # api.get/post/... (ฝั่ง client)
├── types/                        # shared TypeScript types
├── locales/{th,en}/*.json        # คำแปล i18n
└── instrumentation.ts            # รัน schema-sync ตอน server start

tests/                            # Vitest + Testing Library
docs/                             # เอกสาร (ไฟล์นี้อยู่ที่นี่)
drizzle/                          # migration files (สำรอง)
```

---

## 12. วิธีเพิ่มโมดูลใหม่ (Step-by-step)

ใช้ **Template Module (`/template`)** เป็นแม่แบบ — คัดลอกแพทเทิร์นทั้งหมดได้เลย ทำตามลำดับนี้:

**1) Types** → `src/types/<module>.ts`
กำหนด interface/enum (เช่น `XxxItem`, `XxxItemCreate`, `XxxListFilters`)

**2) Database schema** → `src/lib/db/schema-<module>.ts`
ประกาศตาราง **ทั้ง SQLite และ MySQL** (`sqliteXxx` + `mysqlXxx`), export type จากฝั่ง SQLite
→ จากนั้น **re-export ใน `src/lib/db/schema.ts`** (สำคัญ! ไม่งั้น `getTableRef` หาไม่เจอ)

**3) Validation** → `src/lib/validation/<module>.ts`
สร้าง Zod schema (`xxxCreateSchema`, `xxxUpdateSchema`)

**4) Service** → `src/lib/services/<module>.service.ts`
- `getXxxTables()` รวม `getTableRef(...)`
- ทุกฟังก์ชันห่อด้วย `executeDbOperation`
- ใช้ `getNow/toDbDate`, `getInsertId`, และ `auditedInsert/Update/Delete`

**5) API routes** → `src/app/api/<module>/...`
- `route.ts` (list + create), `[id]/route.ts` (get/update/delete)
- ทุก handler ห่อ `withAuth(request, fn, [permissions])` + Zod validate + เรียก service

**6) Permissions** → เพิ่มใน `PERMISSIONS` ที่ [src/lib/auth/index.ts](../src/lib/auth/index.ts)

**7) Frontend** → `src/app/<module>/`
- `page.tsx` (dashboard/list ด้วย DevExtreme DataGrid), `items/new/page.tsx`, `items/[id]/page.tsx`
- ใช้ `useQuery/useMutation` เรียก API
- **อย่า** wrap `MainLayout` ซ้ำถ้าอยู่ใต้ layout ที่ wrap ให้แล้ว (เช่น `master-data/*`, `accounting/*`)

**8) Sidebar** → เพิ่มเมนูใน `src/components/layout/sidebar.tsx`
(ถ้าเป็นหน้า `/master-data/*` ต้องอัปเดต array `masterDataModules` + คำแปล TH/EN ด้วย)

**9) i18n** → เพิ่ม key ใน `src/locales/th/*.json` แล้ว `en/*.json`

**10) Tests** → `tests/...` render หน้า + mock fetch + assert UI ไม่ crash

**11) ตรวจ type** → `bunx tsc --noEmit --skipLibCheck` (บังคับก่อนปิดงาน)

---

## 13. คำสั่งที่ใช้บ่อย & การตั้งค่า Environment

> หมายเหตุ: package.json scripts เขียนด้วย `DB_TYPE=...` (bash). บน **Windows PowerShell** ให้ตั้ง env ก่อน เช่น `$env:DB_TYPE='sqlite'; <command>`

| คำสั่ง | หน้าที่ |
|--------|--------|
| `bun run dev` / `npm run dev` | dev server (port **33021**) |
| `bun run build` | build production (Webpack) |
| `bun run start` | รัน production build |
| `bun run lint` | ESLint |
| `bun run test` / `test:run` | Vitest (auto ตั้ง `DB_TYPE=sqlite`) |
| `bunx tsc --noEmit --skipLibCheck` | ★ ตรวจ type — **ต้องรันก่อนปิดงานเสมอ** |
| `bun run db:push` | push schema ขึ้น DB (drizzle-kit) |
| `bun run db:studio` | เปิด Drizzle Studio |
| `bun run db:seed` | seed ข้อมูลตัวอย่าง (SQLite) |
| `bun run i18n:check` | ตรวจคำแปลครบไหม |

### Environment variables

```bash
# เลือกฐานข้อมูล
DB_TYPE=sqlite                 # ใส่ค่านี้ = ใช้ SQLite (dev/test); ไม่ใส่ = MySQL (prod)

# MySQL (production) — ใช้ DATABASE_URL หรือแยกตัวแปร
DATABASE_URL=mysql://user:pass@host:3306/herbal_erp
# หรือ
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=secret
MYSQL_DATABASE=herbal_erp

# SQLite
SQLITE_DB_PATH=./data/herbal-erp.db

# Auth
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
```

---

## 14. กฎสำคัญ (Gotchas) ที่ต้องรู้

1. **business logic อยู่ใน service เท่านั้น** — route.ts ห้ามมี query/logic หนัก
2. **schema ต้องมีคู่ SQLite + MySQL** และต้อง **re-export ผ่าน `schema.ts`** ไม่งั้น `getTableRef()` throw "Table not found"
3. **วันที่ต้องผ่าน date-utils เสมอ** — MySQL datetime ปฏิเสธ ISO string (`...T...Z`); ใช้ `getNow/toDbDate/toQueryDate`
4. **อ่านวันที่จาก DB ใช้ `formatDateFromDb/toDateSafe`** — SQLite คืน string, MySQL คืน Date object
5. **`getTableRef('camelCaseName')`** ใช้ camelCase ของชื่อ export (ไม่ใช่ชื่อตารางใน DB เช่น `template_items`)
6. **`getInsertId` / `getAffectedRows`** — อย่าอ่าน `insertId`/`changes` เองตรงๆ เพราะ 2 DB ต่างกัน
7. **i18n: เพิ่ม key ฝั่งไทยก่อน** เสมอ แล้วค่อยอังกฤษ
8. **หน้าเพจใต้ layout ที่ wrap `MainLayout` แล้ว ห้าม wrap ซ้ำ** (master-data/accounting/production/quality/…)
9. **audit ไม่อัตโนมัติ** — ต้องเรียก `auditedInsert/Update/Delete` เองเมื่อต้องการ trail
10. **ก่อนปิดงานทุกครั้ง รัน `bunx tsc --noEmit --skipLibCheck`** — ESLint/Vitest จับ type error ไม่ครบ

---

### ไฟล์อ้างอิงหลัก (Key Files)

| หน้าที่ | ไฟล์ |
|--------|------|
| Connection + เลือก DB | [src/lib/db/index.ts](../src/lib/db/index.ts) |
| DB helpers | [src/lib/db/db-helper.ts](../src/lib/db/db-helper.ts) |
| Schema รวม | [src/lib/db/schema.ts](../src/lib/db/schema.ts) |
| Schema sync | [src/lib/db/schema-sync.ts](../src/lib/db/schema-sync.ts) |
| Date helpers | [src/lib/db/date-utils.ts](../src/lib/db/date-utils.ts) |
| Audit | [src/lib/db/audit-wrapper.ts](../src/lib/db/audit-wrapper.ts) |
| Auth + RBAC | [src/lib/auth/index.ts](../src/lib/auth/index.ts) |
| Server response/withAuth | [src/lib/api-utils.ts](../src/lib/api-utils.ts) |
| Client API wrapper | [src/lib/api-client.ts](../src/lib/api-client.ts) |
| Startup hook | [src/instrumentation.ts](../src/instrumentation.ts) |
| โมดูลแม่แบบ (service) | [src/lib/services/template.service.ts](../src/lib/services/template.service.ts) |
| โมดูลแม่แบบ (route) | [src/app/api/template/items/route.ts](../src/app/api/template/items/route.ts) |
| โมดูลแม่แบบ (schema) | [src/lib/db/schema-template.ts](../src/lib/db/schema-template.ts) |

---

*เอกสารนี้สร้างจากการสแกนซอร์สโค้ดจริง — หากโครงสร้างเปลี่ยน กรุณาอัปเดตให้ตรงกับโค้ด*
