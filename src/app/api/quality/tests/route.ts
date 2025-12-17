import { NextRequest } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
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
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const testsTable = useSqlite ? schema.sqliteQualityTests : schema.mysqlQualityTests;
      const specsTable = useSqlite ? schema.sqliteQualitySpecs : schema.mysqlQualitySpecs;
      const lotsTable = useSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
      
      const conditions = [];
      if (lotId) {
        conditions.push(eq(testsTable.lotId, parseInt(lotId)));
      }
      if (testType) {
        conditions.push(eq(testsTable.testType, testType));
      }
      if (status) {
        conditions.push(eq(testsTable.status, status));
      }
      
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(testsTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      let query = (db as any)
        .select({
          id: testsTable.id,
          lotId: testsTable.lotId,
          lotNumber: lotsTable.lotNumber,
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
        .leftJoin(lotsTable, eq(testsTable.lotId, lotsTable.id));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const offset = (pagination.page - 1) * pagination.limit;
      const tests = await query.limit(pagination.limit).offset(offset);
      
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
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const testsTable = useSqlite ? schema.sqliteQualityTests : schema.mysqlQualityTests;
      
      const result = await (db as any).insert(testsTable).values({
        lotId,
        specId,
        testType,
        sampleNumber,
        status: 'pending',
      });
      
      const testId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
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
