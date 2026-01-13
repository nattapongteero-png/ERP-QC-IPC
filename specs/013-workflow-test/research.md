# Research: Workflow Test Page

**Feature**: 013-workflow-test | **Date**: 2026-01-01

## Research Questions Resolved

### 1. Real-Time Updates: SSE vs WebSocket

**Decision**: Server-Sent Events (SSE)

**Rationale**:
- Workflow execution is sequential and one-directional (server → client)
- SSE has built-in automatic reconnection
- Simpler implementation (standard HTTP, no special protocol)
- Better firewall/proxy compatibility
- Native ordering of events (no need to track sequence)

**Alternatives Considered**:
- WebSocket: Rejected - bidirectional not needed, adds complexity
- Polling: Rejected - inefficient for 31 sequential updates

**Implementation Pattern**:
```typescript
// API: /api/workflow-test/stream/route.ts
export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2-minute timeout

export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      // Send step updates as they complete
      const send = (msg: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`))
      }
      // Execute steps sequentially, streaming results
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
```

**Client Pattern**:
```typescript
// Custom hook for SSE consumption
export function useWorkflowSSE(url: string, onMessage: (msg: SSEMessage) => void) {
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    const es = new EventSource(url)
    es.onmessage = (e) => onMessage(JSON.parse(e.data))
    es.onerror = () => { /* Built-in reconnection */ }
    eventSourceRef.current = es
  }, [url, onMessage])

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close()
  }, [])

  return { connect, disconnect }
}
```

---

### 2. Visual Pathway Diagram Approach

**Decision**: Custom SVG-based pathway (not DevExtreme Diagram)

**Rationale**:
- 31 nodes across 8 phases needs optimized layout
- Real-time animations require fine-grained control
- DevExtreme Diagram is designed for org charts/editable flows, not status tracking
- Lighter weight for streaming updates

**Alternatives Considered**:
- DevExtreme Diagram (`devextreme-react/diagram`): Already used in codebase (`OrgChartDiagram.tsx`) but overkill for status display
- Recharts: Not suitable for workflow/step visualization

**Existing Patterns to Leverage**:
- `/src/components/shared/ApprovalChain.tsx` - Vertical timeline with status icons
- `/src/components/shared/WorkflowStatusBadge.tsx` - Status color mapping
- Lucide React icons for status indicators

**Component Structure**:
```
src/components/workflow-test/
├── WorkflowPathway.tsx         # Main container, horizontal layout
├── WorkflowPhaseGroup.tsx      # Phase column/group with header
├── WorkflowStepNode.tsx        # Individual step circle with icon
├── WorkflowStepConnector.tsx   # Animated arrow between steps
├── WorkflowStepDetail.tsx      # Detail panel on click
├── WorkflowLogPanel.tsx        # Real-time execution log
└── WorkflowTestConfig.tsx      # Optional config form
```

**Visual States**:
```typescript
const STEP_STATUS_COLORS = {
  pending: { bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-300' },
  running: { bg: 'bg-blue-500', text: 'text-white', animation: 'pulse' },
  passed: { bg: 'bg-green-500', text: 'text-white' },
  failed: { bg: 'bg-red-500', text: 'text-white' },
}
```

---

### 3. API Orchestration Pattern

**Decision**: Service layer with sequential execution, fail-fast

**Rationale**:
- Follows existing patterns in `/src/lib/services/`
- Each step captures details for debugging
- Stop on first error to preserve failure state

**Key Patterns from Codebase**:

1. **Database Operations**:
```typescript
import { executeDbOperation, getTableRef, getInsertId } from '@/lib/db/db-helper'
import { getNow, toDbDate } from '@/lib/db/date-utils'

// Always use these helpers for MySQL/SQLite compatibility
const result = await executeDbOperation(async (db) => {
  return db.insert(tables.items).values({ ... })
})
const itemId = getInsertId(result)
```

2. **API Response Helpers**:
```typescript
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils'

// Standard pattern
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      // ... operation
      return successResponse({ id }, 'Created successfully')
    } catch (error) {
      return serverErrorResponse(error)
    }
  }, ['admin:write'])
}
```

3. **Sequential Multi-Step Pattern** (from inventory lots route):
```typescript
// Step 1: Create main record
const result = await executeDbOperation(async (db) => {
  return db.insert(lotsTable).values({ ... })
})
const lotId = getInsertId(result)

// Step 2: Create related record using lotId
await executeDbOperation(async (db) => {
  return db.insert(transactionsTable).values({ lotId, ... })
})

// Step 3: Audit log
await createAuditLog({ ... })
```

---

### 4. Test Data Cleanup Strategy

**Decision**: Marker-based cleanup with prefix pattern

**Rationale**:
- Test data clearly identifiable
- Safe deletion without affecting production data
- Pattern used in existing test files

**Implementation**:
```typescript
const TEST_DATA_PREFIX = 'WFTEST_'

// Cleanup function before each test run
async function cleanupTestData() {
  const tables = ['items', 'vendors', 'purchaseOrders', ...]

  for (const tableName of tables) {
    const table = getTableRef(tableName)
    await executeDbOperation(async (db) => {
      // Delete records with test prefix in code/name field
      await db.delete(table).where(
        or(
          like(table.code, `${TEST_DATA_PREFIX}%`),
          like(table.name, `${TEST_DATA_PREFIX}%`)
        )
      )
    })
  }
}
```

**Test Data Naming**:
- Items: `WFTEST_RM001`, `WFTEST_FG001`
- Vendors: `WFTEST_VENDOR_001`
- Customers: `WFTEST_CUSTOMER_001`
- Lots: `WFTEST_LOT_001`

---

### 5. Test Structure for Workflow Test Page

**Decision**: React Testing Library + Vitest for UI, integration tests for API

**Test Files**:
```
tests/
├── app/settings/workflow-test/page.test.tsx    # UI rendering tests
└── integration/api/workflow-test.test.ts       # API integration tests
```

**UI Test Pattern**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import WorkflowTestPage from '@/app/settings/workflow-test/page'

// Mock SSE
vi.mock('@/hooks/useWorkflowSSE', () => ({
  useWorkflowSSE: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
  }),
}))

describe('WorkflowTestPage', () => {
  it('renders pathway with 31 steps in 8 phases', () => {
    render(<WorkflowTestPage />)

    // All 8 phases visible
    expect(screen.getByText('Phase 1: Master Data Setup')).toBeInTheDocument()
    expect(screen.getByText('Phase 8: VMI Integration')).toBeInTheDocument()

    // Run button
    expect(screen.getByRole('button', { name: /run basic workflow test/i })).toBeEnabled()
  })
})
```

---

## Technology Decisions Summary

| Area | Decision | Alternative Rejected | Reason |
|------|----------|---------------------|--------|
| Real-time updates | SSE | WebSocket | One-directional, simpler, auto-reconnect |
| Visual pathway | Custom SVG | DevExtreme Diagram | Better control, lighter, real-time friendly |
| Step execution | Sequential fail-fast | Parallel | Dependencies between steps |
| Test data cleanup | Prefix marker | Transaction rollback | Multi-request operations |
| Testing | Vitest + RTL | Jest | Project standard |

---

## References

**Codebase Patterns**:
- `/src/components/shared/ApprovalChain.tsx` - Timeline visualization
- `/src/components/shared/WorkflowStatusBadge.tsx` - Status colors
- `/src/lib/services/approval-workflow.service.ts` - Service pattern
- `/src/lib/db/db-helper.ts` - Database utilities
- `/src/lib/api-utils.ts` - Response helpers

**External Resources**:
- Next.js 16 SSE: Route handler streaming
- DevExtreme 25.2 documentation
- React Testing Library best practices
