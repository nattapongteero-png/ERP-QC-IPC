import { NextRequest } from 'next/server';
import { eq, sql, and, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/quality/tests - List quality tests
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const lotId = searchParams.get('lotId') || '';
      const testType = searchParams.get('testType') || '';
      const status = searchParams.get('status') || '';

      const testsTable = getTableRef('qualityTests');
      const specsTable = getTableRef('qualitySpecs');
      const lotsTable = getTableRef('inventoryLots');
      const itemsTable = getTableRef('items');

      const conditions: (SQL | undefined)[] = [];
      if (lotId) {
        conditions.push(eq(testsTable.lotId, parseInt(lotId)));
      }
      if (testType) {
        conditions.push(eq(testsTable.testType, testType));
      }
      if (status) {
        conditions.push(eq(testsTable.status, status));
      }

      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(testsTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      const offset = (pagination.page - 1) * pagination.limit;
      const tests = await executeDbOperation(async (db) => {
        let query = db
          .select({
            id: testsTable.id,
            lotId: testsTable.lotId,
            lotNumber: lotsTable.lotNumber,
            itemId: lotsTable.itemId,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            specId: testsTable.specId,
            testName: specsTable.testName,
            testMethod: specsTable.testMethod,
            specification: specsTable.specification,
            minValue: specsTable.minValue,
            maxValue: specsTable.maxValue,
            testType: testsTable.testType,
            sampleNumber: testsTable.sampleNumber,
            testDate: testsTable.testDate,
            result: testsTable.result,
            numericResult: testsTable.numericResult,
            status: testsTable.status,
            createdAt: testsTable.createdAt,
          })
          .from(testsTable)
          .leftJoin(specsTable, eq(testsTable.specId, specsTable.id))
          .leftJoin(lotsTable, eq(testsTable.lotId, lotsTable.id))
          .leftJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id));

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(tests, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:read']);
}

// POST /api/quality/tests - Create quality test
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        lotId,
        specId,
        testType,
        sampleNumber,
      } = body;
      
      if (!lotId || !specId || !testType) {
        return errorResponse('Lot ID, spec ID, and test type are required');
      }
      
      const validTestTypes = ['incoming', 'in_process', 'final'];
      if (!validTestTypes.includes(testType)) {
        return errorResponse(`Test type must be one of: ${validTestTypes.join(', ')}`);
      }

      const testsTable = getTableRef('qualityTests');

      const result = await executeDbOperation(async (db) => {
        return db.insert(testsTable).values({
          lotId,
          specId,
          testType,
          sampleNumber: sampleNumber ?? null, // nullable column — coerce undefined to null
          status: 'pending',
        });
      });

      const testId = getInsertId(result);
      
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'quality_tests',
        recordId: Number(testId),
        newValue: { lotId, specId, testType },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: Number(testId) }, 'Quality test created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
