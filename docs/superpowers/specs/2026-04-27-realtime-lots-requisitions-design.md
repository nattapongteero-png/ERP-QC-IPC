# Realtime Sync — Lots Requisitions Tab Design

**Date:** 2026-04-27
**Scope:** `/inventory/lots` page, `requisitions` tab only
**Goal:** Prevent duplicate approval and auto-update UI when other users approve work order requisitions.

## Problem

When two users (e.g., admin@herbal-erp.com and kook_sl@hotmail.com) open `/inventory/lots` simultaneously and both see a pending requisition (status = `requested`):

1. User A clicks "อนุมัติปล่อยของ" → row moves to "อนุมัติแล้ว" tab in A's view
2. User B's UI is stale → still sees row in "รออนุมัติ" with active approve button
3. User B clicks approve → **duplicate approval at DB level** (current code has SELECT-then-UPDATE race condition)
4. Result: wrong stock movements, duplicate audit entries

## Goals

1. **Prevent duplicate approval at DB level** — atomic check-and-update
2. **Auto-sync UI** — User B sees status change within < 1 second (no refresh needed)
3. **Visual feedback** — Highlight changed rows briefly so users notice
4. **Extensible foundation** — Infrastructure reusable for other pages later

## Non-Goals

- Realtime sync for `/production/work-orders/[id]` pages (future Phase 2)
- Realtime sync for "lots" tab (future Phase 2)
- Cross-container event delivery via Redis (single-container per tenant is sufficient)
- Bidirectional communication (server → client only; SSE not WebSocket)

## Architecture

### High-Level Flow

```
┌─────────────────┐                ┌──────────────────┐
│  Browser A      │                │  Browser B       │
│  /inventory/lots│                │  /inventory/lots │
│                 │                │                  │
│  [Click Approve]│                │  [Receive Event] │
└────────┬────────┘                └──────────▲───────┘
         │                                    │
         │ POST /requisition (action:approve) │ SSE stream
         ▼                                    │
┌──────────────────────────────────────────────┴──────┐
│              Next.js Server (per tenant)            │
│                                                     │
│  1. Approve API                                     │
│     ├─► db.transaction:                             │
│     │    - UPDATE WHERE status='requested' (guard)  │
│     │    - Verify affectedRows > 0                  │
│     │    - Insert stock snapshot                    │
│     │    - Commit                                   │
│     │                                               │
│     └─► realtimeBus.publish('requisition-changed')  │
│                       │                             │
│  2. SSE endpoint ◄────┘                             │
│     /api/realtime/requisition-changed/events        │
│     └─► Stream event to all connected clients       │
└─────────────────────────────────────────────────────┘
```

### Components

#### Generic Infrastructure (reusable)

1. **EventBus** (`src/lib/realtime/event-bus.ts`)
   - In-memory `EventEmitter` singleton, one instance per Node process (per container)
   - Methods: `publish(topic, data)`, `subscribe(topic, listener) => unsubscribe`
   - Type-safe via `TopicName` union

2. **SSE Endpoint** (`src/app/api/realtime/[topic]/events/route.ts`)
   - Validates topic against allowlist
   - Authenticates via `withAuth`
   - Streams events from EventBus to client
   - Sends heartbeat every 30s
   - Cleans up on disconnect

3. **React Hook** (`src/hooks/use-realtime-topic.ts`)
   - Wraps `EventSource` for given topic
   - Calls callback on each event
   - Cleans up on unmount
   - Browser-native auto-reconnect

#### Page-Specific Changes

4. **Approve API** (`src/app/api/production/work-orders/[id]/requisition/route.ts`)
   - Wrap multi-step approval in transaction
   - UPDATE with `WHERE status='requested'` guard
   - Return error if affected rows = 0
   - Publish `requisition-changed` event after commit

5. **Lots Page** (`src/app/inventory/lots/page.tsx`)
   - Subscribe to `requisition-changed` topic
   - Invalidate `inventory-requisitions` query on event
   - Track recently-changed IDs in state
   - Apply `animate-flash-green` class for 1.5s

### Data Flow

```
T+0ms       User A clicks approve button
T+5-20ms    POST /api/production/work-orders/178/requisition arrives at server
T+10-50ms   Transaction:
              - SELECT work order
              - Validate material availability
              - Save stock snapshot
              - UPDATE WHERE status='requested'
              - affectedRows = 1, commit
T+1ms       realtimeBus.publish('requisition-changed', {workOrderId: 178, status: 'approved'})
T+0ms       SSE listeners (User A and B) receive event synchronously in process
T+5-30ms    Stream traverses network to User B's browser
T+5-15ms    EventSource fires 'change' event, callback invokes
T+1-5ms     React: setState(recentlyChangedIds + 178), invalidate query
T+30-100ms  TanStack Query refetches /api/inventory/requisitions
T+5-20ms    Browser re-renders: row 178 now in "อนุมัติแล้ว" tab with green flash

Total latency: ~70-300ms (typically < 200ms)
```

## Server-Side Validation

### Layer 1: Status Guard (atomic at DB level)

```typescript
const result = await tx
  .update(workOrdersTable)
  .set({
    requisitionStatus: 'approved',
    requisitionApprovedBy: session.userId,
    requisitionApprovedAt: getNow(),
  })
  .where(and(
    eq(workOrdersTable.id, workOrderId),
    eq(workOrdersTable.requisitionStatus, 'requested'),  // ← guard
  ));

if (getAffectedRows(result) === 0) {
  throw new ApprovalConflictError('ใบเบิกนี้ถูกอนุมัติไปแล้ว — กรุณา refresh หน้าจอ');
}
```

MySQL UPDATE provides row-level locking automatically — no explicit lock needed.

### Layer 2: Database Transaction

All multi-step writes (material check, stock snapshot, status update) wrapped in single transaction. If status guard fails, transaction rolls back, no partial state.

### Layer 3: SSE UI Sync (UX, not security)

Even if SSE fails to deliver, Layer 1+2 still prevent duplicate. SSE is for **user experience** (auto-update), not for correctness.

## Type Definitions

```typescript
// src/lib/realtime/types.ts

export type TopicName = 'requisition-changed';
// Future: | 'work-order-changed' | 'lot-changed' | ...

export interface RealtimeEvent {
  topic: TopicName;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface RequisitionChangedPayload {
  workOrderId: number;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  changedBy: number;
}
```

## Public API

```typescript
// Server-side
import { realtimeBus } from '@/lib/realtime';
realtimeBus.publish('requisition-changed', { workOrderId, status, changedBy });

// Client-side
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
useRealtimeTopic('requisition-changed', (data) => {
  queryClient.invalidateQueries({ queryKey: ['inventory-requisitions'] });
});
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| User A and B click approve simultaneously | A succeeds, B gets `400 "ใบเบิกนี้ถูกอนุมัติไปแล้ว"` |
| SSE connection lost | EventSource auto-reconnects (browser native) |
| Server crash during transaction | Transaction rolls back, user retries |
| Network proxy buffers SSE | `X-Accel-Buffering: no` header + 30s heartbeat |
| User closes tab | EventSource closes, server cleans up listener |
| EventBus listener leak | `setMaxListeners(100)`, cleanup on disconnect |
| Multi-tenant isolation | Each container has separate Node process and EventBus |

## UI Feedback: Flash Highlight

```css
@keyframes flash-green {
  0%   { background-color: rgb(34 197 94 / 0.3); }
  100% { background-color: transparent; }
}
.animate-flash-green {
  animation: flash-green 1.5s ease-out;
}
```

```typescript
const [recentlyChangedIds, setRecentlyChangedIds] = useState<Set<number>>(new Set());

useRealtimeTopic('requisition-changed', (data) => {
  const id = (data as RequisitionChangedPayload).workOrderId;
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

// In render:
<tr className={cn(recentlyChangedIds.has(req.workOrderId) && 'animate-flash-green')}>
```

## Testing Strategy

### Unit Tests
- `event-bus.test.ts` — pub/sub semantics, multiple subscribers, unsubscribe

### Integration Tests
- `sse.test.ts` — SSE endpoint streams events, auth, invalid topic, heartbeat
- `requisition-approve.test.ts` — duplicate prevention via concurrent calls

### E2E Tests (Playwright)
- Two browser sessions, simulate the duplicate approval scenario
- Verify status guard rejects second approval
- Verify B's UI updates within < 1s
- Verify flash animation visible

## File Structure

```
src/
├── lib/realtime/
│   ├── event-bus.ts          [NEW] ~50 lines
│   ├── types.ts              [NEW] ~20 lines
│   └── index.ts              [NEW] ~5 lines (public exports)
├── app/
│   ├── api/realtime/[topic]/events/
│   │   └── route.ts          [NEW] ~60 lines
│   ├── api/production/work-orders/[id]/requisition/
│   │   └── route.ts          [MODIFY] +30 lines (transaction + guard + publish)
│   └── inventory/lots/
│       └── page.tsx          [MODIFY] +40 lines (hook + flash state)
├── hooks/
│   └── use-realtime-topic.ts [NEW] ~40 lines
└── styles/globals.css        [MODIFY] +6 lines (flash animation)

tests/
├── lib/realtime/
│   └── event-bus.test.ts                          [NEW]
├── app/api/realtime/
│   └── sse.test.ts                                [NEW]
├── app/api/production/work-orders/
│   └── requisition-approve.test.ts                [NEW]
└── e2e/
    └── realtime-approve.spec.ts                   [NEW]
```

**Total:** ~220 lines new infrastructure + ~70 lines page-specific changes + ~150 lines tests = ~440 lines

## Future Extension (Phase 2+)

To add realtime sync to a new page (e.g., work-order detail), only 2 things are needed:

```typescript
// 1. Add topic to TopicName union (1 line in types.ts)
export type TopicName = 'requisition-changed' | 'work-order-changed';

// 2. In any service that mutates the entity:
realtimeBus.publish('work-order-changed', { id, status });

// 3. In the consuming page/component:
useRealtimeTopic('work-order-changed', (data) => {
  if (data.id === currentWorkOrderId) {
    queryClient.invalidateQueries({ queryKey: ['work-order', data.id] });
  }
});
```

No new SSE endpoint, no new hook — infrastructure reused.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Memory leak from EventEmitter listeners | Explicit unsubscribe in SSE cleanup, `setMaxListeners(100)` |
| Browser SSE 6-connection limit per origin | Only 1 SSE connection per topic per page; not all pages have realtime |
| HMR breaks dev event-bus state | Use module-level singleton (Node module cache survives HMR) |
| Container restart loses subscribers | Acceptable — clients auto-reconnect via EventSource |
| Network proxy buffers SSE | `X-Accel-Buffering: no` + heartbeat |
| User experience confusion (row disappears) | Flash highlight + tab badge updates |
