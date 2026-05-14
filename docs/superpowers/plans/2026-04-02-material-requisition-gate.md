# Material Requisition Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a material requisition gate so warehouse must approve before production can weigh materials.

**Architecture:** Add 5 columns to `work_orders` table for requisition status tracking. Production sends requisition from WO Execution page, warehouse approves from a new Tab in the Lots page. Material Weighing is blocked until approved.

**Tech Stack:** Next.js API Routes, Drizzle ORM (dual SQLite/MySQL), React, DevExtreme, TanStack Query, Tailwind CSS

---

### Task 1: Add requisition fields to work_orders schema + migrate MySQL

**Files:**
- Modify: `src/lib/db/schema.ts` (lines 350-357 and 1731-1738)

- [ ] **Step 1: Add fields to SQLite schema**

In `src/lib/db/schema.ts`, add these lines after `lineClearanceChecklistId` (line 355) and before `createdAt` (line 356) in `sqliteWorkOrders`:

```typescript
  // Material requisition gate
  requisitionStatus: text('requisition_status').notNull().default('none'), // none, requested, approved
  requisitionRequestedBy: integer('requisition_requested_by').references(() => sqliteUsers.id),
  requisitionRequestedAt: text('requisition_requested_at'),
  requisitionApprovedBy: integer('requisition_approved_by').references(() => sqliteUsers.id),
  requisitionApprovedAt: text('requisition_approved_at'),
```

- [ ] **Step 2: Add fields to MySQL schema**

In `mysqlWorkOrders`, add these lines after `lineClearanceChecklistId` (line 1736) and before `createdAt` (line 1737):

```typescript
  // Material requisition gate
  requisitionStatus: varchar('requisition_status', { length: 20 }).notNull().default('none'),
  requisitionRequestedBy: int('requisition_requested_by').references(() => mysqlUsers.id),
  requisitionRequestedAt: datetime('requisition_requested_at'),
  requisitionApprovedBy: int('requisition_approved_by').references(() => mysqlUsers.id),
  requisitionApprovedAt: datetime('requisition_approved_at'),
```

- [ ] **Step 3: Run ALTER TABLE on production MySQL**

```sql
ALTER TABLE work_orders ADD COLUMN requisition_status VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE work_orders ADD COLUMN requisition_requested_by INT NULL;
ALTER TABLE work_orders ADD COLUMN requisition_requested_at DATETIME NULL;
ALTER TABLE work_orders ADD COLUMN requisition_approved_by INT NULL;
ALTER TABLE work_orders ADD COLUMN requisition_approved_at DATETIME NULL;
```

- [ ] **Step 4: Verify with type check**

Run: `bunx tsc --noEmit --skipLibCheck 2>&1 | grep -i "schema\|work.order"`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add requisition gate fields to work_orders schema"
```

---

### Task 2: Create requisition API endpoint

**Files:**
- Create: `src/app/api/production/work-orders/[id]/requisition/route.ts`

- [ ] **Step 1: Create the POST endpoint**

Create `src/app/api/production/work-orders/[id]/requisition/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getNow } from '@/lib/db/date-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);
      const { action } = await request.json();

      if (!['request', 'approve'].includes(action)) {
        return errorResponse('Invalid action. Must be "request" or "approve"');
      }

      const workOrders = getTableRef('workOrders');

      // Get current WO
      const woResult = await executeDbOperation(async (db) =>
        db.select({
          id: workOrders.id,
          status: workOrders.status,
          requisitionStatus: workOrders.requisitionStatus,
          woNumber: workOrders.woNumber,
        }).from(workOrders).where(eq(workOrders.id, workOrderId))
      );

      if (woResult.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      const wo = woResult[0];

      if (action === 'request') {
        // Validate: WO must be released or in_progress, requisition must be 'none'
        if (!['released', 'in_progress'].includes(wo.status as string)) {
          return errorResponse('Work order must be released or in progress to request requisition');
        }
        if (wo.requisitionStatus !== 'none') {
          return errorResponse('Requisition already submitted');
        }

        await executeDbOperation(async (db) =>
          db.update(workOrders).set({
            requisitionStatus: 'requested',
            requisitionRequestedBy: session.userId,
            requisitionRequestedAt: getNow(),
          }).where(eq(workOrders.id, workOrderId))
        );

        return successResponse({ requisitionStatus: 'requested' }, 'Requisition submitted successfully');
      }

      if (action === 'approve') {
        // Validate: requisition must be 'requested'
        if (wo.requisitionStatus !== 'requested') {
          return errorResponse('No pending requisition to approve');
        }

        await executeDbOperation(async (db) =>
          db.update(workOrders).set({
            requisitionStatus: 'approved',
            requisitionApprovedBy: session.userId,
            requisitionApprovedAt: getNow(),
          }).where(eq(workOrders.id, workOrderId))
        );

        return successResponse({ requisitionStatus: 'approved' }, 'Requisition approved successfully');
      }

      return errorResponse('Invalid action');
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
```

- [ ] **Step 2: Verify with type check**

Run: `bunx tsc --noEmit --skipLibCheck 2>&1 | grep requisition`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/production/work-orders/[id]/requisition/route.ts
git commit -m "feat: add material requisition request/approve API"
```

---

### Task 3: Create inventory requisitions list API

**Files:**
- Create: `src/app/api/inventory/requisitions/route.ts`

- [ ] **Step 1: Create the GET endpoint**

Create `src/app/api/inventory/requisitions/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { eq, or, inArray, desc } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const statusFilter = searchParams.get('status') || 'all';

      const workOrders = getTableRef('workOrders');
      const workOrderMaterials = getTableRef('workOrderMaterials');
      const items = getTableRef('items');
      const users = getTableRef('users');

      // Build status condition
      const statusConditions = statusFilter === 'all'
        ? or(eq(workOrders.requisitionStatus, 'requested'), eq(workOrders.requisitionStatus, 'approved'))
        : eq(workOrders.requisitionStatus, statusFilter);

      // Get WOs with requisition data
      const woRows = await executeDbOperation(async (db) =>
        db.select({
          workOrderId: workOrders.id,
          woNumber: workOrders.woNumber,
          batchNumber: workOrders.batchNumber,
          productId: workOrders.productId,
          productName: items.nameTh,
          productCode: items.code,
          plannedQuantity: workOrders.plannedQuantity,
          unit: workOrders.unit,
          requisitionStatus: workOrders.requisitionStatus,
          requestedBy: workOrders.requisitionRequestedBy,
          requestedAt: workOrders.requisitionRequestedAt,
          approvedBy: workOrders.requisitionApprovedBy,
          approvedAt: workOrders.requisitionApprovedAt,
        })
        .from(workOrders)
        .leftJoin(items, eq(workOrders.productId, items.id))
        .where(statusConditions)
        .orderBy(desc(workOrders.id))
      );

      if (woRows.length === 0) {
        return successResponse([]);
      }

      // Resolve user names
      const userIds = new Set<number>();
      for (const wo of woRows) {
        if (wo.requestedBy) userIds.add(wo.requestedBy as number);
        if (wo.approvedBy) userIds.add(wo.approvedBy as number);
      }

      const userMap = new Map<number, string>();
      if (userIds.size > 0) {
        const userRows = await executeDbOperation(async (db) =>
          db.select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, Array.from(userIds)))
        );
        for (const u of userRows) {
          userMap.set(u.id, u.name);
        }
      }

      // Get materials for all relevant WOs
      const woIds = woRows.map((w: Record<string, unknown>) => w.workOrderId as number);
      const materialsRows = await executeDbOperation(async (db) =>
        db.select({
          id: workOrderMaterials.id,
          workOrderId: workOrderMaterials.workOrderId,
          itemId: workOrderMaterials.itemId,
          itemCode: items.code,
          itemName: items.nameTh,
          plannedQuantity: workOrderMaterials.plannedQuantity,
          unit: workOrderMaterials.unit,
        })
        .from(workOrderMaterials)
        .leftJoin(items, eq(workOrderMaterials.itemId, items.id))
        .where(inArray(workOrderMaterials.workOrderId, woIds))
      );

      // Group materials by WO
      const materialsByWo = new Map<number, typeof materialsRows>();
      for (const m of materialsRows) {
        const woId = (m as Record<string, unknown>).workOrderId as number;
        if (!materialsByWo.has(woId)) materialsByWo.set(woId, []);
        materialsByWo.get(woId)!.push(m);
      }

      // Build response
      const data = woRows.map((wo: Record<string, unknown>) => ({
        workOrderId: wo.workOrderId,
        woNumber: wo.woNumber,
        batchNumber: wo.batchNumber,
        productName: wo.productName,
        productCode: wo.productCode,
        plannedQuantity: wo.plannedQuantity,
        unit: wo.unit,
        requisitionStatus: wo.requisitionStatus,
        requestedBy: wo.requestedBy ? userMap.get(wo.requestedBy as number) || null : null,
        requestedAt: wo.requestedAt,
        approvedBy: wo.approvedBy ? userMap.get(wo.approvedBy as number) || null : null,
        approvedAt: wo.approvedAt,
        materials: (materialsByWo.get(wo.workOrderId as number) || []).map((m: Record<string, unknown>) => ({
          itemCode: m.itemCode,
          itemName: m.itemName,
          plannedQuantity: m.plannedQuantity,
          unit: m.unit,
        })),
      }));

      return successResponse(data);
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/inventory/requisitions/route.ts
git commit -m "feat: add inventory requisitions list API"
```

---

### Task 4: Add requisition status to execution summary + Material Weighing gate

**Files:**
- Modify: `src/app/api/production/work-orders/[id]/execution-summary/route.ts`
- Modify: `src/app/api/production/work-orders/[id]/material-weighing/route.ts`

- [ ] **Step 1: Add requisitionStatus to execution summary API**

In `src/app/api/production/work-orders/[id]/execution-summary/route.ts`, after the WO detail fetch, add a query to get `requisitionStatus`:

```typescript
// Add to the WO query (or fetch separately):
const woReqResult = await executeDbOperation(async (db) => {
  const workOrders = getTableRef('workOrders');
  return db.select({
    requisitionStatus: workOrders.requisitionStatus,
    requisitionRequestedBy: workOrders.requisitionRequestedBy,
    requisitionRequestedAt: workOrders.requisitionRequestedAt,
    requisitionApprovedBy: workOrders.requisitionApprovedBy,
    requisitionApprovedAt: workOrders.requisitionApprovedAt,
  }).from(workOrders).where(eq(workOrders.id, workOrderId));
});
```

Add to the response summary object:

```typescript
materialRequisition: {
  status: woReqResult[0]?.requisitionStatus || 'none',
  requestedBy: woReqResult[0]?.requisitionRequestedBy || null,
  requestedAt: woReqResult[0]?.requisitionRequestedAt || null,
  approvedBy: woReqResult[0]?.requisitionApprovedBy || null,
  approvedAt: woReqResult[0]?.requisitionApprovedAt || null,
},
```

Resolve user names for requestedBy/approvedBy using the same pattern as other user name resolution in the file.

- [ ] **Step 2: Add requisitionStatus to material-weighing API response**

In `src/app/api/production/work-orders/[id]/material-weighing/route.ts` GET handler, add:

```typescript
// After getting materials, fetch requisition status
const workOrders = getTableRef('workOrders');
const woReqResult = await executeDbOperation(async (db) =>
  db.select({ requisitionStatus: workOrders.requisitionStatus })
    .from(workOrders)
    .where(eq(workOrders.id, parseInt(id)))
);
const requisitionStatus = woReqResult[0]?.requisitionStatus || 'none';
```

Include `requisitionStatus` in the response:

```typescript
return successResponse({ materials, requisitionStatus });
```

- [ ] **Step 3: Type check and commit**

Run: `bunx tsc --noEmit --skipLibCheck 2>&1 | grep -i "execution-summary\|material-weighing"`
Expected: No errors

```bash
git add src/app/api/production/work-orders/[id]/execution-summary/route.ts src/app/api/production/work-orders/[id]/material-weighing/route.ts
git commit -m "feat: add requisition status to execution summary and material weighing APIs"
```

---

### Task 5: Add Material Requisition section to WO Execution page

**Files:**
- Modify: `src/app/production/work-orders/[id]/execution/page.tsx`

- [ ] **Step 1: Add materialRequisition to ExecutionSummary interface**

Add to the `ExecutionSummary` interface (after `ipc`):

```typescript
materialRequisition: {
  status: 'none' | 'requested' | 'approved';
  requestedBy: number | null;
  requestedAt: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  requestedByName?: string;
  approvedByName?: string;
};
```

Add default value to both fallback summary objects:

```typescript
materialRequisition: { status: 'none', requestedBy: null, requestedAt: null, approvedBy: null, approvedAt: null },
```

- [ ] **Step 2: Add Material Requisition section to executionSections array**

Insert as the **first item** in the `executionSections` array (before material-weighing), so it appears first in pre_production phase:

```typescript
{
  id: 'material-requisition',
  title: 'ใบเบิกวัตถุดิบ',
  icon: <ClipboardList className="h-5 w-5" />,
  href: '', // No separate page — handled inline
  phase: 'pre_production',
  description: 'ส่งใบเบิกวัตถุดิบให้คลังอนุมัติก่อนชั่ง',
  getStatus: (s) => ({
    completed: s.materialRequisition.status === 'approved' ? 1 : 0,
    total: 1,
    status: s.materialRequisition.status === 'approved'
      ? 'verified'
      : s.materialRequisition.status === 'requested'
      ? 'in_progress'
      : 'pending',
  }),
},
```

Add `ClipboardList` to the lucide-react imports.

- [ ] **Step 3: Add inline requisition UI in the section render**

In the section rendering area (where each section card is rendered), add special handling for the `material-requisition` section. When clicked (or inline), show:

- List of materials from the WO (fetch from execution summary or a separate query)
- Status-dependent UI:
  - `none`: Green button "ส่งใบเบิกวัตถุดิบ" that calls `POST /api/production/work-orders/{id}/requisition` with `{ action: 'request' }`
  - `requested`: Yellow badge "รอคลังอนุมัติ" + date + requester name
  - `approved`: Green badge "คลังอนุมัติแล้ว" + date + approver name

Use `useMutation` from TanStack Query to handle the requisition request, and invalidate the `wo-execution-summary` query on success.

- [ ] **Step 4: Type check and commit**

Run: `bunx tsc --noEmit --skipLibCheck 2>&1 | grep execution`
Expected: No errors

```bash
git add src/app/production/work-orders/[id]/execution/page.tsx
git commit -m "feat: add material requisition section to WO execution page"
```

---

### Task 6: Add Material Weighing gate check

**Files:**
- Modify: `src/app/production/work-orders/[id]/material-weighing/page.tsx`

- [ ] **Step 1: Add gate check banner**

After the data fetch, extract `requisitionStatus` from the API response. If `requisitionStatus !== 'approved'`, render a warning banner at the top and disable all weighing buttons:

```tsx
{requisitionStatus !== 'approved' && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
    <div>
      <p className="font-medium text-amber-800">ยังไม่สามารถชั่งวัตถุดิบได้</p>
      <p className="text-sm text-amber-700">
        {requisitionStatus === 'none'
          ? 'กรุณาส่งใบเบิกวัตถุดิบก่อนที่หน้า Execution Dashboard'
          : 'รอคลังอนุมัติใบเบิกวัตถุดิบ'}
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 2: Disable weigh/verify buttons when not approved**

Pass `disabled={requisitionStatus !== 'approved'}` to all weighing action buttons (Weigh, Verify). The existing button components should accept a `disabled` prop.

- [ ] **Step 3: Type check and commit**

```bash
git add src/app/production/work-orders/[id]/material-weighing/page.tsx
git commit -m "feat: block material weighing until requisition is approved"
```

---

### Task 7: Add "ใบเบิกวัตถุดิบ" Tab to Inventory Lots page

**Files:**
- Modify: `src/app/inventory/lots/page.tsx`

- [ ] **Step 1: Add Tab imports and state**

Add imports for `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`. Add state for active tab:

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Inside component:
const [activeTab, setActiveTab] = useState('lots');
```

- [ ] **Step 2: Wrap existing content in Tabs structure**

Wrap the existing lots page content inside a `<Tabs>` component:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="lots">รายการ Lot</TabsTrigger>
    <TabsTrigger value="requisitions">ใบเบิกวัตถุดิบ</TabsTrigger>
  </TabsList>
  <TabsContent value="lots">
    {/* existing lots content here */}
  </TabsContent>
  <TabsContent value="requisitions">
    <RequisitionTab />
  </TabsContent>
</Tabs>
```

- [ ] **Step 3: Create RequisitionTab component inline**

Add a `RequisitionTab` component in the same file (or extracted to a separate component file). It should:

1. Fetch from `GET /api/inventory/requisitions?status={filter}`
2. Show filter buttons: รอ / อนุมัติแล้ว / ทั้งหมด
3. For each WO requisition, show a card/row with:
   - WO Number, Batch Number, Product Name
   - วันที่ขอ, ผู้ขอ
   - Expandable materials list (item code, name, qty, unit)
   - ปุ่ม **"อนุมัติปล่อยของ"** (only for status = 'requested')
4. Approve button calls `POST /api/production/work-orders/{woId}/requisition` with `{ action: 'approve' }`
5. On success, invalidate and refetch the requisitions list

```tsx
function RequisitionTab() {
  const [filter, setFilter] = useState('requested');
  const queryClient = useQueryClient();

  const { data: requisitions, isLoading } = useQuery({
    queryKey: ['inventory-requisitions', filter],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/requisitions?status=${filter}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (workOrderId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-requisitions'] });
      // Show success toast
    },
  });

  // Render filter buttons + requisition cards with expand/collapse for materials
  // Each card shows: WO#, Batch, Product, Date, Requester, Materials list, Approve button
}
```

- [ ] **Step 4: Type check and commit**

```bash
git add src/app/inventory/lots/page.tsx
git commit -m "feat: add material requisition tab to inventory lots page"
```

---

### Task 8: Type check, build verify, and deploy

**Files:** None (verification only)

- [ ] **Step 1: Full type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: No new errors from requisition gate changes

- [ ] **Step 2: Test on MySQL**

Verify the new columns exist:
```sql
SELECT requisition_status, requisition_requested_by, requisition_requested_at, requisition_approved_by, requisition_approved_at FROM work_orders LIMIT 1;
```

- [ ] **Step 3: Deploy**

```bash
docker compose up -d --build app-prd-metaherb
```

- [ ] **Step 4: End-to-end verification**

1. Open a WO in Execution Dashboard → verify "ใบเบิกวัตถุดิบ" section appears
2. Click "ส่งใบเบิกวัตถุดิบ" → status changes to "รอคลังอนุมัติ"
3. Go to Material Weighing → verify warning banner and buttons disabled
4. Go to /inventory/lots → click "ใบเบิกวัตถุดิบ" tab → verify requisition shows
5. Click "อนุมัติปล่อยของ" → status changes to approved
6. Go back to Material Weighing → verify buttons enabled, weighing works normally
