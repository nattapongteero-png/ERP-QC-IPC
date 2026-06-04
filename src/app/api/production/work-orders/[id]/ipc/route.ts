import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOIPCTests,
  initializeWOIPCTests,
  recordIPCTestResult,
  approveIPCTest,
  getBOMIPCConfig,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { publishWorkOrderChanged } from '@/lib/realtime';

// GET /api/production/work-orders/[id]/ipc - Get IPC tests for a work order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      // Return BOM IPC config if requested
      if (action === 'bom-config') {
        const workOrders = getTableRef('workOrders');
        const wo = await executeDbOperation(async (db) => {
          const result = await db
            .select({ bomId: workOrders.bomId })
            .from(workOrders)
            .where(eq(workOrders.id, workOrderId));
          return result[0];
        });

        if (!wo?.bomId) {
          return successResponse([], 'No BOM linked to this work order');
        }

        const config = await getBOMIPCConfig(wo.bomId);
        return successResponse(config);
      }

      // Default: return IPC tests with samples
      const tests = await getWOIPCTests(workOrderId);
      return successResponse(tests);
    } catch (error) {
      console.error('Error fetching IPC tests:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/ipc - Initialize or record IPC tests
//
// Per-action authorization (GMP roles):
//   - initialize  → production:write   (admin/manager/production sets up tests)
//   - record      → no extra perm      (matches inline SOP-step recording — any
//                                       authenticated shop-floor user can record
//                                       what they actually measured)
//   - approve     → quality:approve    (QA confirms — dual-control)
function permsForAction(action: string): Array<'production:write' | 'quality:approve'> {
  if (action === 'approve') return ['quality:approve'];
  if (action === 'record') return []; // auth only, parity with sop-execution record_ipc
  return ['production:write']; // initialize (and unknown) require shop-floor write perm
}

interface IPCPostBody {
  action?: string;
  qualityTestId?: number;
  numericResult?: number;
  result?: string;
  notes?: string;
  testRound?: number;
  disposition?: string;
  samples?: Array<{
    sampleNumber: number;
    numericValue?: number;
    textValue?: string;
    result?: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Peek the action before delegating to withAuth so the permission gate
  // reflects what the caller is actually trying to do. The body is consumed
  // here and forwarded to the handler to avoid re-parsing.
  let data: IPCPostBody;
  try {
    data = (await request.json()) as IPCPostBody;
  } catch {
    return errorResponse('Invalid JSON body');
  }
  const action = data.action ?? '';

  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      // Action: Initialize IPC tests from BOM config
      if (action === 'initialize') {
        const { created, rephased } = await initializeWOIPCTests(workOrderId, session.userId);

        await createAuditLog({
          userId: session.userId,
          action: 'CREATE',
          tableName: 'quality_tests',
          recordId: workOrderId,
          newValue: { action: 'initialize_ipc', count: created.length, rephased },
          ipAddress: getClientIP(request),
        });

        publishWorkOrderChanged(workOrderId, 'ipc', session.userId, 'init');
        const msg =
          rephased > 0
            ? `Initialized ${created.length} IPC tests from BOM (re-synced ${rephased} phase${rephased > 1 ? 's' : ''})`
            : `Initialized ${created.length} IPC tests from BOM`;
        return successResponse(created, msg);
      }

      // Action: Record test result
      if (action === 'record') {
        if (!data.qualityTestId) {
          return errorResponse('Missing qualityTestId');
        }

        // Backend validation: prevent skipping samples
        if (data.samples && Array.isArray(data.samples) && data.samples.length > 0) {
          // Sort by sampleNumber
          const sorted = [...data.samples].sort((a: { sampleNumber: number }, b: { sampleNumber: number }) => a.sampleNumber - b.sampleNumber);
          // Check sequential: all samples from 1..N must be present
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].sampleNumber !== i + 1) {
              return errorResponse(`ข้อมูลตัวอย่างไม่ครบลำดับ — ต้องกรอกเรียงตั้งแต่ #1 ถึง #${sorted.length} (Sample sequence must be sequential starting from #1)`);
            }
          }
          // Check all have a value (numeric or result)
          for (const s of sorted) {
            const hasValue = s.numericValue != null || (s.result && s.result !== '');
            if (!hasValue) {
              return errorResponse(`ตัวอย่าง #${s.sampleNumber} ไม่มีค่าผลตรวจ — ต้องกรอกครบทุกตัวอย่าง (Sample #${s.sampleNumber} is missing a value)`);
            }
          }
        }

        const result = await recordIPCTestResult({
          qualityTestId: data.qualityTestId,
          numericResult: data.numericResult,
          result: data.result,
          notes: data.notes,
          testedBy: session.userId,
          testRound: data.testRound,
          samples: data.samples,
        });

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'quality_tests',
          recordId: data.qualityTestId,
          newValue: { action: 'record_ipc', result: result.status },
          ipAddress: getClientIP(request),
        });

        publishWorkOrderChanged(workOrderId, 'ipc', session.userId, 'record');
        return successResponse(result, 'IPC test result recorded');
      }

      // Action: Approve test
      if (action === 'approve') {
        if (!data.qualityTestId) {
          return errorResponse('Missing qualityTestId');
        }

        const result = await approveIPCTest(
          data.qualityTestId,
          session.userId,
          data.disposition || 'accept',
          data.testRound
        );

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'quality_tests',
          recordId: data.qualityTestId,
          newValue: { action: 'approve_ipc', disposition: data.disposition, testRound: data.testRound },
          ipAddress: getClientIP(request),
        });

        publishWorkOrderChanged(workOrderId, 'ipc', session.userId, 'approve');
        return successResponse(result, 'IPC test approved');
      }

      return errorResponse('Invalid action. Use: initialize, record, approve');
    } catch (error) {
      console.error('Error in IPC operation:', error);
      return serverErrorResponse(error);
    }
  }, permsForAction(action));
}
