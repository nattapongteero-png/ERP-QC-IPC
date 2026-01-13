# Quickstart: Workflow Test Page

**Feature**: 013-workflow-test | **Date**: 2026-01-01

## Overview

This guide provides step-by-step instructions for implementing the workflow test page feature.

---

## Prerequisites

- Node.js 18+
- pnpm installed
- Development server running on port 33021
- Existing ERP modules functional (inventory, HR, BOM, purchasing, production, QC, sales, accounting, VMI)

---

## Quick Setup

### 1. Create Types

Create `/src/types/workflow-test.ts`:

```typescript
export type WorkflowStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
export type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed'
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed'

export interface WorkflowTestSession {
  id: string
  status: WorkflowStatus
  startedAt: string | null
  completedAt: string | null
  totalDuration: number
  phases: WorkflowPhase[]
  currentPhase: number | null
  currentStep: number | null
  config: TestConfiguration
  cleanup: CleanupStatus
  createdBy: number
}

export interface WorkflowPhase {
  id: number
  name: string
  description: string
  status: PhaseStatus
  steps: WorkflowTestStep[]
  stepCount: number
  completedCount: number
  passedCount: number
  failedCount: number
  startedAt: string | null
  completedAt: string | null
  duration: number
}

export interface WorkflowTestStep {
  id: number
  phaseId: number
  stepNumber: number
  name: string
  description: string
  status: StepStatus
  startedAt: string | null
  completedAt: string | null
  duration: number
  apiCall: ApiCallDetails | null
  createdEntities: CreatedEntity[]
  error: StepError | null
  activityMessage: string | null
}

// ... rest of interfaces from data-model.md
```

### 2. Create Step Definitions

Create `/src/lib/services/workflow-test/workflow-steps.ts`:

```typescript
export interface StepDefinition {
  id: number
  phaseId: number
  name: string
  description: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  activityMessage: string
  execute: (context: ExecutionContext) => Promise<StepResult>
}

export const PHASE_DEFINITIONS = [
  { id: 1, name: 'Master Data Setup', description: 'Foundation data', stepCount: 4 },
  { id: 2, name: 'BOM & Production Planning', description: 'Product structure', stepCount: 2 },
  { id: 3, name: 'Purchasing Flow', description: 'Procurement process', stepCount: 6 },
  { id: 4, name: 'Production Flow', description: 'Manufacturing process', stepCount: 7 },
  { id: 5, name: 'Finished Goods QC', description: 'Quality verification', stepCount: 2 },
  { id: 6, name: 'Sales Flow', description: 'Order to delivery', stepCount: 4 },
  { id: 7, name: 'Accounting Verification', description: 'Financial validation', stepCount: 4 },
  { id: 8, name: 'VMI Integration', description: 'External sync', stepCount: 2 },
]

export const STEP_DEFINITIONS: StepDefinition[] = [
  // Phase 1: Master Data Setup
  {
    id: 1,
    phaseId: 1,
    name: 'Setup warehouse and storage locations',
    description: 'Create main warehouse and storage locations',
    endpoint: '/api/warehouses',
    method: 'POST',
    activityMessage: 'Creating warehouse...',
    execute: async (ctx) => {
      // Implementation
    },
  },
  // ... 30 more steps
]
```

### 3. Create SSE Endpoint

Create `/src/app/api/workflow-test/run/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { executeWorkflowTest } from '@/lib/services/workflow-test/workflow-test.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    const body = await request.json().catch(() => ({}))

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (msg: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`))
        }

        try {
          await executeWorkflowTest({
            config: body,
            userId: session.userId,
            onMessage: send,
          })
        } catch (error) {
          send({ type: 'error', message: String(error) })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  }, ['admin:write'])
}
```

### 4. Create Main Page

Create `/src/app/settings/workflow-test/page.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { DxButton } from '@/components/ui/dx-button'
import { WorkflowPathway } from '@/components/workflow-test/WorkflowPathway'
import { WorkflowLogPanel } from '@/components/workflow-test/WorkflowLogPanel'
import { WorkflowStepDetail } from '@/components/workflow-test/WorkflowStepDetail'
import { useWorkflowTest } from '@/hooks/useWorkflowTest'

export default function WorkflowTestPage() {
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const { session, isRunning, logs, startTest, cancelTest } = useWorkflowTest()

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Workflow Test"
          description="End-to-end ERP process testing"
          actions={
            <div className="flex gap-2">
              <DxButton
                text={isRunning ? 'Running...' : 'Run Basic Workflow Test'}
                icon={isRunning ? 'runner' : 'video'}
                type="success"
                onClick={startTest}
                disabled={isRunning}
              />
              {isRunning && (
                <DxButton
                  text="Cancel"
                  icon="close"
                  type="danger"
                  onClick={cancelTest}
                />
              )}
            </div>
          }
        />

        <div className="grid grid-cols-3 gap-6">
          {/* Pathway (2 columns) */}
          <div className="col-span-2">
            <WorkflowPathway
              session={session}
              onStepClick={setSelectedStep}
            />
          </div>

          {/* Log Panel (1 column) */}
          <div>
            <WorkflowLogPanel logs={logs} />
          </div>
        </div>

        {/* Step Detail Dialog */}
        {selectedStep && (
          <WorkflowStepDetail
            step={session?.phases
              .flatMap((p) => p.steps)
              .find((s) => s.id === selectedStep)}
            onClose={() => setSelectedStep(null)}
          />
        )}
      </div>
    </MainLayout>
  )
}
```

### 5. Create Visual Pathway Component

Create `/src/components/workflow-test/WorkflowPathway.tsx`:

```typescript
'use client'

import { WorkflowPhaseGroup } from './WorkflowPhaseGroup'
import { WorkflowTestSession } from '@/types/workflow-test'

interface Props {
  session: WorkflowTestSession | null
  onStepClick: (stepId: number) => void
}

export function WorkflowPathway({ session, onStepClick }: Props) {
  if (!session) {
    return <EmptyPathway />
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {session.phases.map((phase, index) => (
          <WorkflowPhaseGroup
            key={phase.id}
            phase={phase}
            isLast={index === session.phases.length - 1}
            onStepClick={onStepClick}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Key Implementation Notes

### SSE Connection Management

```typescript
// hooks/useWorkflowTest.ts
export function useWorkflowTest() {
  const [session, setSession] = useState<WorkflowTestSession | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const startTest = useCallback(async () => {
    const es = new EventSource('/api/workflow-test/run')
    eventSourceRef.current = es

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      // Update session state based on message type
    }

    es.onerror = () => {
      es.close()
    }
  }, [])

  const cancelTest = useCallback(() => {
    eventSourceRef.current?.close()
  }, [])

  useEffect(() => {
    return () => eventSourceRef.current?.close()
  }, [])

  return { session, startTest, cancelTest }
}
```

### Step Status Colors

```typescript
const STATUS_STYLES = {
  pending: 'bg-gray-200 border-gray-300 text-gray-700',
  running: 'bg-blue-500 border-blue-600 text-white animate-pulse',
  passed: 'bg-green-500 border-green-600 text-white',
  failed: 'bg-red-500 border-red-600 text-white',
}
```

### Test Data Cleanup

```typescript
const TEST_PREFIX = 'WFTEST_'

async function cleanupTestData() {
  // Delete in reverse dependency order
  const tables = ['salesOrders', 'purchaseOrders', 'vendors', 'items', ...]

  for (const table of tables) {
    await executeDbOperation(async (db) => {
      const tableRef = getTableRef(table)
      await db.delete(tableRef).where(
        like(tableRef.code, `${TEST_PREFIX}%`)
      )
    })
  }
}
```

---

## Testing

### Run UI Tests

```bash
pnpm test tests/app/settings/workflow-test/page.test.tsx
```

### Run Type Check

```bash
pnpm tsc --noEmit
```

### Run Lint

```bash
pnpm lint
```

---

## File Structure Created

```
src/
├── app/
│   ├── settings/
│   │   └── workflow-test/
│   │       └── page.tsx
│   └── api/
│       └── workflow-test/
│           ├── run/route.ts
│           ├── cleanup/route.ts
│           ├── status/[sessionId]/route.ts
│           └── history/route.ts
├── components/
│   └── workflow-test/
│       ├── WorkflowPathway.tsx
│       ├── WorkflowPhaseGroup.tsx
│       ├── WorkflowStepNode.tsx
│       ├── WorkflowStepConnector.tsx
│       ├── WorkflowStepDetail.tsx
│       ├── WorkflowLogPanel.tsx
│       └── WorkflowTestConfig.tsx
├── hooks/
│   └── useWorkflowTest.ts
├── lib/
│   └── services/
│       └── workflow-test/
│           ├── workflow-test.service.ts
│           ├── workflow-steps.ts
│           └── test-data-cleanup.ts
├── types/
│   └── workflow-test.ts
└── lib/
    └── validation/
        └── workflow-test.ts

tests/
└── app/
    └── settings/
        └── workflow-test/
            └── page.test.tsx
```

---

## Verification Checklist

- [ ] Page loads at `/settings/workflow-test`
- [ ] 31 steps visible across 8 phases
- [ ] "Run Basic Workflow Test" button works
- [ ] Real-time updates as steps execute
- [ ] Step details viewable on click
- [ ] Errors displayed with API details
- [ ] Test data cleanup works
- [ ] All tests pass: `pnpm test:run`
- [ ] Type check passes: `pnpm tsc --noEmit`
- [ ] Lint passes: `pnpm lint`
