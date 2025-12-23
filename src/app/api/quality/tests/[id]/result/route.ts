import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/quality/tests/[id]/result - Submit test result
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const testId = parseInt(id);
      
      if (isNaN(testId)) {
        return errorResponse('Invalid test ID');
      }
      
      const body = await request.json();
      const { result, numericResult, notes } = body;
      
      if (result === undefined && numericResult === undefined) {
        return errorResponse('Result or numeric result is required');
      }

      const testsTable = getTableRef('qualityTests');
      const specsTable = getTableRef('qualitySpecs');

      // Get existing test with spec
      const existing = await executeDbOperation(async (db) => {
        return db
          .select({
            test: testsTable,
            spec: specsTable,
          })
          .from(testsTable)
          .leftJoin(specsTable, eq(testsTable.specId, specsTable.id))
          .where(eq(testsTable.id, testId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Test not found');
      }

      const { test: oldTest, spec } = existing[0];

      // Determine pass/fail status
      let status = 'pass';
      if (numericResult !== undefined && spec) {
        if (spec.minValue !== null && numericResult < spec.minValue) {
          status = 'fail';
        }
        if (spec.maxValue !== null && numericResult > spec.maxValue) {
          status = 'fail';
        }
      }

      // Update test
      await executeDbOperation(async (db) => {
        return db
          .update(testsTable)
          .set({
            result,
            numericResult,
            status,
            testDate: dbDate(),
            testedBy: session.userId,
            notes,
            updatedAt: dbDate(),
          })
          .where(eq(testsTable.id, testId));
      });
      
      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'quality_tests',
        recordId: testId,
        oldValue: { status: oldTest.status },
        newValue: { result, numericResult, status },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: testId, status }, `Test result submitted - ${status.toUpperCase()}`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
