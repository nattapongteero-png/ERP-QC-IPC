import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// Generate QC test code
function generateTestCode(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QC${year}${month}${day}${random}`;
}

// GET /api/production/work-orders/[id]/qc-tests - List QC tests for a work order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      const workOrders = getTableRef('workOrders');
      const qualityTests = getTableRef('qualityTests');
      const inventoryLots = getTableRef('inventoryLots');

      // Get work order to find the batch number
      const workOrderResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
      });

      if (workOrderResult.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      const workOrder = workOrderResult[0];

      // Find lot by batch number (the produced lot)
      const lots = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(inventoryLots)
          .where(eq(inventoryLots.batchNumber, workOrder.batchNumber));
      });

      if (lots.length === 0) {
        return successResponse([]);
      }

      // Get QC tests for these lots
      const allTests: Record<string, unknown>[] = [];
      for (const lot of lots) {
        const tests = await executeDbOperation(async (db) => {
          return db
            .select()
            .from(qualityTests)
            .where(eq(qualityTests.lotId, lot.id));
        });
        allTests.push(...tests);
      }

      return successResponse(allTests);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read', 'quality:read']);
}

// POST /api/production/work-orders/[id]/qc-tests - Add QC test for work order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);
      const body = await request.json();
      const { testType, testMethod, parameters, notes, lotId } = body;

      if (!testType) {
        return errorResponse('Test type is required');
      }

      const workOrders = getTableRef('workOrders');
      const qualityTests = getTableRef('qualityTests');
      const inventoryLots = getTableRef('inventoryLots');

      // Check work order exists
      const workOrderResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
      });

      if (workOrderResult.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      const workOrder = workOrderResult[0];

      // Determine which lot to use
      let targetLotId = lotId;
      if (!targetLotId) {
        // Find lot by batch number
        const lotResult = await executeDbOperation(async (db) => {
          return db
            .select()
            .from(inventoryLots)
            .where(eq(inventoryLots.batchNumber, workOrder.batchNumber));
        });

        if (lotResult.length > 0) {
          targetLotId = lotResult[0].id;
        }
      }

      if (!targetLotId) {
        return errorResponse('No lot found for this work order. Create a lot first or specify lotId.');
      }

      const testCode = generateTestCode();

      // Create QC test
      const result = await executeDbOperation(async (db) => {
        return db.insert(qualityTests).values({
          lotId: targetLotId,
          testType,
          testMethod: testMethod || null,
          parameters: parameters ? JSON.stringify(parameters) : null,
          status: 'pending',
          result: null,
          notes: notes || null,
          createdBy: session.userId,
          createdAt: dbDate(),
        });
      });

      const testId = getInsertId(result);

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'quality_tests',
        recordId: Number(testId),
        newValue: { testCode, testType, lotId: targetLotId, workOrderId },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(testId), testCode }, 'QC test created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write', 'quality:write']);
}
