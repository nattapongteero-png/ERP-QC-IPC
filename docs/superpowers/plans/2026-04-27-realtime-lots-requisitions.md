# Realtime Sync — Lots Requisitions Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate approval and auto-update UI when other users approve work order requisitions on `/inventory/lots`.

**Architecture:** Per-tenant in-memory EventBus (Node EventEmitter) + Generic SSE endpoint `/api/realtime/[topic]/events` + Generic React hook `useRealtimeTopic`. Server validates with atomic UPDATE+WHERE guard inside transaction; UI flashes green for 1.5s on changed rows.

**Tech Stack:** TypeScript 5.x, Next.js 16.0.10, React 19.2.1, TanStack Query 5.x, Drizzle ORM, Vitest 4

---

### Task 1: Realtime types and EventBus

**Files:**
- Create: `src/lib/realtime/types.ts`
- Create: `src/lib/realtime/event-bus.ts`
- Create: `src/lib/realtime/index.ts`
- Test: `tests/lib/realtime/event-bus.test.ts`

- [ ] **Step 1.1: Write failing test**

```typescript
// tests/lib/realtime/event-bus.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { realtimeBus } from '@/lib/realtime/event-bus';

describe('realtimeBus', () => {
  beforeEach(() => {
    realtimeBus.removeAllListeners();
  });

  it('publish and subscribe deliver matching topic events', () => {
    const received: unknown[] = [];
    const unsub = realtimeBus.subscribe('requisition-changed', (e) => received.push(e));

    realtimeBus.publish('requisition-changed', { workOrderId: 1, status: 'approved' });

    expect(received).toHaveLength(1);
    expect((received[0] as { topic: string }).topic).toBe('requisition-changed');
    expect((received[0] as { data: { workOrderId: number } }).data.workOrderId).toBe(1);

    unsub();
  });

  it('unsubscribe removes listener', () => {
    const received: unknown[] = [];
    const unsub = realtimeBus.subscribe('requisition-changed', (e) => received.push(e));
    unsub();

    realtimeBus.publish('requisition-changed', { workOrderId: 2, status: 'approved' });

    expect(received).toHaveLength(0);
  });

  it('multiple subscribers all receive event', () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    realtimeBus.subscribe('requisition-changed', (e) => a.push(e));
    realtimeBus.subscribe('requisition-changed', (e) => b.push(e));

    realtimeBus.publish('requisition-changed', { workOrderId: 3, status: 'approved' });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('event includes timestamp', () => {
    const received: { timestamp: number }[] = [];
    const unsub = realtimeBus.subscribe('requisition-changed', (e) => received.push(e as { timestamp: number }));

    const before = Date.now();
    realtimeBus.publish('requisition-changed', { workOrderId: 4, status: 'approved' });
    const after = Date.now();

    expect(received[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(received[0].timestamp).toBeLessThanOrEqual(after);

    unsub();
  });
});
```

- [ ] **Step 1.2: Run test, verify it fails**

Run: `bun test tests/lib/realtime/event-bus.test.ts`
Expected: FAIL — module not found

- [ ] **Step 1.3: Implement types.ts**

```typescript
// src/lib/realtime/types.ts
export type TopicName = 'requisition-changed';

export interface RealtimeEvent {
  topic: TopicName;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface RequisitionChangedPayload extends Record<string, unknown> {
  workOrderId: number;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  changedBy: number;
}
```

- [ ] **Step 1.4: Implement event-bus.ts**

```typescript
// src/lib/realtime/event-bus.ts
import { EventEmitter } from 'events';
import type { TopicName, RealtimeEvent } from './types';

class RealtimeBus extends EventEmitter {
  publish(topic: TopicName, data: Record<string, unknown>): void {
    const event: RealtimeEvent = { topic, data, timestamp: Date.now() };
    this.emit(topic, event);
  }

  subscribe(topic: TopicName, listener: (event: RealtimeEvent) => void): () => void {
    this.on(topic, listener);
    return () => this.off(topic, listener);
  }
}

export const realtimeBus = new RealtimeBus();
realtimeBus.setMaxListeners(100);
```

- [ ] **Step 1.5: Implement index.ts**

```typescript
// src/lib/realtime/index.ts
export { realtimeBus } from './event-bus';
export type { TopicName, RealtimeEvent, RequisitionChangedPayload } from './types';
```

- [ ] **Step 1.6: Run test, verify it passes**

Run: `bun test tests/lib/realtime/event-bus.test.ts`
Expected: PASS (4/4)

- [ ] **Step 1.7: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: no new errors in `src/lib/realtime/`

- [ ] **Step 1.8: Commit**

```bash
git add src/lib/realtime/ tests/lib/realtime/
git commit -m "feat(realtime): add EventBus singleton for in-process pub/sub"
```

---

### Task 2: Generic SSE endpoint

**Files:**
- Create: `src/app/api/realtime/[topic]/events/route.ts`
- Test: `tests/app/api/realtime/sse.test.ts`

- [ ] **Step 2.1: Write failing test**

```typescript
// tests/app/api/realtime/sse.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/realtime/[topic]/events/route';
import { realtimeBus } from '@/lib/realtime';

vi.mock('@/lib/auth', () => ({
  withAuth: (handler: any) => async (req: Request, ctx: any) => handler(req, ctx, { userId: 1, email: 'test@test.com' }),
}));

function makeRequest(topic: string): { req: Request; abort: () => void } {
  const controller = new AbortController();
  const req = new Request(`http://localhost/api/realtime/${topic}/events`, { signal: controller.signal });
  return { req, abort: () => controller.abort() };
}

describe('SSE /api/realtime/[topic]/events', () => {
  beforeEach(() => {
    realtimeBus.removeAllListeners();
  });

  it('returns 400 for invalid topic', async () => {
    const { req } = makeRequest('invalid-topic');
    const response = await GET(req, { params: Promise.resolve({ topic: 'invalid-topic' }) });
    expect(response.status).toBe(400);
  });

  it('returns SSE stream for valid topic', async () => {
    const { req } = makeRequest('requisition-changed');
    const response = await GET(req, { params: Promise.resolve({ topic: 'requisition-changed' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('streams published events to subscribers', async () => {
    const { req, abort } = makeRequest('requisition-changed');
    const response = await GET(req, { params: Promise.resolve({ topic: 'requisition-changed' }) });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read connect message
    const first = await reader.read();
    expect(decoder.decode(first.value)).toContain('event: connected');

    // Publish event
    setTimeout(() => realtimeBus.publish('requisition-changed', { workOrderId: 99, status: 'approved' }), 10);

    // Read change message
    const second = await reader.read();
    const text = decoder.decode(second.value);
    expect(text).toContain('event: change');
    expect(text).toContain('"workOrderId":99');

    abort();
  });
});
```

- [ ] **Step 2.2: Run test, verify it fails**

Run: `bun test tests/app/api/realtime/sse.test.ts`
Expected: FAIL — route not found

- [ ] **Step 2.3: Implement SSE endpoint**

```typescript
// src/app/api/realtime/[topic]/events/route.ts
import { NextRequest } from 'next/server';
import { realtimeBus } from '@/lib/realtime';
import type { TopicName } from '@/lib/realtime';
import { withAuth } from '@/lib/auth';

const VALID_TOPICS: readonly TopicName[] = ['requisition-changed'] as const;

function isValidTopic(t: string): t is TopicName {
  return (VALID_TOPICS as readonly string[]).includes(t);
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topic: string }> }
) {
  return withAuth(request, async () => {
    const { topic } = await params;

    if (!isValidTopic(topic)) {
      return new Response(JSON.stringify({ error: 'Invalid topic' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Initial connect message
        controller.enqueue(encoder.encode(`event: connected\ndata: {}\n\n`));

        // Subscribe to topic
        const unsubscribe = realtimeBus.subscribe(topic, (event) => {
          try {
            const message = `event: change\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch {
            // Controller closed
          }
        });

        // Heartbeat to keep connection alive through proxies
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        // Cleanup on disconnect
        request.signal.addEventListener('abort', () => {
          unsubscribe();
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });
}
```

- [ ] **Step 2.4: Run test, verify it passes**

Run: `bun test tests/app/api/realtime/sse.test.ts`
Expected: PASS (3/3)

- [ ] **Step 2.5: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: no new errors

- [ ] **Step 2.6: Commit**

```bash
git add src/app/api/realtime/ tests/app/api/realtime/
git commit -m "feat(realtime): add generic SSE endpoint for topic streaming"
```

---

### Task 3: useRealtimeTopic hook

**Files:**
- Create: `src/hooks/use-realtime-topic.ts`

(Hook is small and primarily integration-tested via E2E; unit test mocking EventSource adds complexity for low value. Will be exercised in Task 5 page integration tests.)

- [ ] **Step 3.1: Implement hook**

```typescript
// src/hooks/use-realtime-topic.ts
'use client';

import { useEffect, useRef } from 'react';
import type { TopicName, RealtimeEvent } from '@/lib/realtime/types';

export function useRealtimeTopic(
  topic: TopicName,
  onEvent: (data: Record<string, unknown>) => void
) {
  // Keep latest callback in ref so we don't reconnect when callback changes
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const url = `/api/realtime/${topic}/events`;
    const eventSource = new EventSource(url);

    const handleChange = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as RealtimeEvent;
        callbackRef.current(event.data);
      } catch (err) {
        console.error('[realtime] Parse error:', err);
      }
    };

    eventSource.addEventListener('change', handleChange);

    eventSource.onerror = () => {
      // EventSource auto-reconnects in browser; just log
      console.warn(`[realtime] Connection error for topic '${topic}', browser will reconnect`);
    };

    return () => {
      eventSource.removeEventListener('change', handleChange);
      eventSource.close();
    };
  }, [topic]);
}
```

- [ ] **Step 3.2: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: no new errors

- [ ] **Step 3.3: Commit**

```bash
git add src/hooks/use-realtime-topic.ts
git commit -m "feat(realtime): add useRealtimeTopic hook for client subscription"
```

---

### Task 4: Approve API — add transaction guard and publish

**Files:**
- Modify: `src/app/api/production/work-orders/[id]/requisition/route.ts`
- Test: `tests/app/api/production/work-orders/requisition-approve.test.ts`

- [ ] **Step 4.1: Write failing test for duplicate prevention**

```typescript
// tests/app/api/production/work-orders/requisition-approve.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/production/work-orders/[id]/requisition/route';
import { setupTestDb, seedWorkOrderWithRequisition } from '@/tests/helpers/db';
import { realtimeBus } from '@/lib/realtime';

vi.mock('@/lib/auth', () => ({
  withAuth: (req: any, handler: any) => handler({ userId: 1, email: 'test@test.com' }),
}));

describe('POST /api/production/work-orders/[id]/requisition (action: approve)', () => {
  beforeEach(async () => {
    await setupTestDb();
    realtimeBus.removeAllListeners();
  });

  it('approves work order with status=requested', async () => {
    const wo = await seedWorkOrderWithRequisition({ status: 'requested' });
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });

    const response = await POST(req as any, { params: Promise.resolve({ id: String(wo.id) }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.requisitionStatus).toBe('approved');
  });

  it('rejects approve when status is already approved', async () => {
    const wo = await seedWorkOrderWithRequisition({ status: 'approved' });
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });

    const response = await POST(req as any, { params: Promise.resolve({ id: String(wo.id) }) });
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toMatch(/อนุมัติ|approved/i);
  });

  it('publishes requisition-changed event on successful approve', async () => {
    const wo = await seedWorkOrderWithRequisition({ status: 'requested' });
    const events: unknown[] = [];
    realtimeBus.subscribe('requisition-changed', (e) => events.push(e));

    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });
    await POST(req as any, { params: Promise.resolve({ id: String(wo.id) }) });

    expect(events).toHaveLength(1);
    expect((events[0] as any).data.workOrderId).toBe(wo.id);
    expect((events[0] as any).data.status).toBe('approved');
  });

  it('does NOT publish event on failed approve', async () => {
    const wo = await seedWorkOrderWithRequisition({ status: 'approved' });
    const events: unknown[] = [];
    realtimeBus.subscribe('requisition-changed', (e) => events.push(e));

    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });
    await POST(req as any, { params: Promise.resolve({ id: String(wo.id) }) });

    expect(events).toHaveLength(0);
  });
});
```

(The seed helper `seedWorkOrderWithRequisition` may need to be added or adapted to existing test infrastructure. Check `tests/helpers/` for existing patterns.)

- [ ] **Step 4.2: Run test, verify it fails (or current state mismatches)**

Run: `bun test tests/app/api/production/work-orders/requisition-approve.test.ts`
Expected: FAIL — current implementation has no guard, no publish

- [ ] **Step 4.3: Modify approve handler**

In `src/app/api/production/work-orders/[id]/requisition/route.ts`:

1. Replace lines 191-200 (the standalone UPDATE) with a guarded UPDATE:

```typescript
const updateResult = await executeDbOperation(async (db) => {
  return db
    .update(workOrdersTable)
    .set({
      requisitionStatus: 'approved',
      requisitionApprovedBy: session.userId,
      requisitionApprovedAt: getNow(),
    })
    .where(and(
      eq(workOrdersTable.id, workOrderId),
      eq(workOrdersTable.requisitionStatus, 'requested'),
    ));
});

const affected = (updateResult as { affectedRows?: number; changes?: number }).affectedRows
  ?? (updateResult as { changes?: number }).changes
  ?? 0;

if (affected === 0) {
  return errorResponse(
    'ใบเบิกนี้ถูกอนุมัติไปแล้ว — กรุณา refresh หน้าจอ',
    409
  );
}
```

2. Import `realtimeBus` and publish after successful update:

```typescript
import { realtimeBus } from '@/lib/realtime';

// After successful update, before successResponse:
realtimeBus.publish('requisition-changed', {
  workOrderId,
  status: 'approved',
  changedBy: session.userId,
});
```

3. (Optional but recommended) Wrap material check + stockSnapshot + UPDATE in a single transaction. If existing code uses `executeDbOperation` per step, leave structure as-is — atomicity of single UPDATE with WHERE guard is sufficient to prevent duplicate approval. Document this as known acceptable risk.

- [ ] **Step 4.4: Run test, verify it passes**

Run: `bun test tests/app/api/production/work-orders/requisition-approve.test.ts`
Expected: PASS (4/4)

- [ ] **Step 4.5: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: no new errors

- [ ] **Step 4.6: Commit**

```bash
git add src/app/api/production/work-orders/[id]/requisition/route.ts tests/app/api/production/work-orders/
git commit -m "feat(requisition): atomic approve with status guard + realtime publish"
```

---

### Task 5: Lots page — subscribe and flash highlight

**Files:**
- Modify: `src/app/inventory/lots/page.tsx`
- Modify: `src/app/globals.css` (or equivalent global stylesheet)

- [ ] **Step 5.1: Add flash animation CSS**

In `src/app/globals.css` (find existing `@keyframes` section or create one):

```css
@keyframes flash-green {
  0% {
    background-color: rgb(34 197 94 / 0.3);
  }
  100% {
    background-color: transparent;
  }
}

.animate-flash-green {
  animation: flash-green 1.5s ease-out;
}
```

- [ ] **Step 5.2: Add hook + state to lots page**

In `src/app/inventory/lots/page.tsx`:

1. Add import near other imports:

```typescript
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
```

2. Inside the component (`RequisitionsTab` or whatever subcomponent owns the requisitions list — refer to lines 2090+), add state and hook:

```typescript
const [recentlyChangedIds, setRecentlyChangedIds] = useState<Set<number>>(new Set());

useRealtimeTopic('requisition-changed', (data) => {
  const id = data.workOrderId as number;
  queryClient.invalidateQueries({ queryKey: ['inventory-requisitions'] });
  setRecentlyChangedIds((prev) => new Set(prev).add(id));
  setTimeout(() => {
    setRecentlyChangedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, 1500);
});
```

3. In the row render where requisitions are displayed (around line 2180), add the flash class:

```typescript
<tr className={cn(
  // existing classes...
  recentlyChangedIds.has(req.workOrderId) && 'animate-flash-green'
)}>
```

- [ ] **Step 5.3: Run dev server and smoke test**

Run: `bun run dev` (port 33021)

Test:
1. Open two browser windows on `/inventory/lots`
2. Login as different users (or use incognito)
3. Switch to "ใบเบิก" tab
4. Click "อนุมัติปล่อยของ" on one window
5. Verify the other window's row flashes green and moves to "อนุมัติแล้ว" within ~1 second

- [ ] **Step 5.4: Type check**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: no new errors

- [ ] **Step 5.5: Commit**

```bash
git add src/app/inventory/lots/page.tsx src/app/globals.css
git commit -m "feat(lots): subscribe to requisition events with flash highlight"
```

---

### Task 6: Final verification + deploy

- [ ] **Step 6.1: Run full test suite**

Run: `bun test`
Expected: all tests pass (no regressions)

- [ ] **Step 6.2: Run lint**

Run: `bun run lint`
Expected: no new errors

- [ ] **Step 6.3: Type check entire project**

Run: `bunx tsc --noEmit --skipLibCheck`
Expected: no new errors

- [ ] **Step 6.4: Build production**

Run: `bun run build`
Expected: build succeeds

- [ ] **Step 6.5: Push branch**

```bash
git push -u origin 016-realtime-lots-requisitions
```

- [ ] **Step 6.6: Deploy to production tenants**

```bash
docker compose build app-prd-metaherb app-prd-arjaro app-prd-renunakhon
docker compose up -d app-prd-metaherb app-prd-arjaro app-prd-renunakhon
```

- [ ] **Step 6.7: Verify deployments**

Visit each tenant URL and confirm app loads:
- https://herbal-erp-metaherb.bmscloud.in.th/inventory/lots
- https://herbal-erp-arjaro.bmscloud.in.th/inventory/lots
- https://herbal-erp-renunakhon.bmscloud.in.th/inventory/lots

- [ ] **Step 6.8: Update changelog**

In `public/changelog-herbal-erp.html`, add entry to DATA array:
```
{ date: '2026-04-27', version: 'X.Y.Z', items: [
  '✨ Realtime sync: ใบเบิกที่อนุมัติแล้วอัพเดทอัตโนมัติทุกหน้าจอที่เปิดอยู่',
  '🔒 ป้องกันการอนุมัติซ้ำเมื่อหลาย user เปิดหน้าเดียวกัน',
]}
```

Then commit:
```bash
git add public/changelog-herbal-erp.html
git commit -m "docs(changelog): realtime sync for lot requisitions"
git push
```

---

## Rollback Plan

If issues arise after deploy:

```bash
git checkout 015-i18n
docker compose build app-prd-metaherb app-prd-arjaro app-prd-renunakhon
docker compose up -d app-prd-metaherb app-prd-arjaro app-prd-renunakhon
```

The realtime feature is fully isolated — reverting the branch removes all changes.
