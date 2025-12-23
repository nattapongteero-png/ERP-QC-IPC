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

// GET /api/quality/specs - List quality specifications
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const itemId = searchParams.get('itemId');
      const isActive = searchParams.get('isActive');

      const specsTable = getTableRef('qualitySpecs');
      const itemsTable = getTableRef('items');

      const conditions: (SQL | undefined)[] = [];
      if (itemId) {
        conditions.push(eq(specsTable.itemId, parseInt(itemId)));
      }
      if (isActive !== null && isActive !== '') {
        conditions.push(eq(specsTable.isActive, isActive === 'true'));
      } else {
        // Default to only active specs
        conditions.push(eq(specsTable.isActive, true));
      }

      // Count query
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(specsTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Data query with item info
      const offset = (pagination.page - 1) * pagination.limit;
      const specs = await executeDbOperation(async (db) => {
        let query = db
          .select({
            id: specsTable.id,
            itemId: specsTable.itemId,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            testName: specsTable.testName,
            testMethod: specsTable.testMethod,
            specification: specsTable.specification,
            minValue: specsTable.minValue,
            maxValue: specsTable.maxValue,
            unit: specsTable.unit,
            isCritical: specsTable.isCritical,
            isActive: specsTable.isActive,
            createdAt: specsTable.createdAt,
          })
          .from(specsTable)
          .leftJoin(itemsTable, eq(specsTable.itemId, itemsTable.id));

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(specs, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:read']);
}

// POST /api/quality/specs - Create quality specification
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        itemId,
        testName,
        testMethod,
        specification,
        minValue,
        maxValue,
        unit,
        isCritical,
      } = body;

      if (!itemId || !testName) {
        return errorResponse('Item ID and test name are required');
      }

      const specsTable = getTableRef('qualitySpecs');

      const result = await executeDbOperation(async (db) => {
        return db.insert(specsTable).values({
          itemId,
          testName,
          testMethod: testMethod || null,
          specification: specification || null,
          minValue: minValue !== undefined ? minValue : null,
          maxValue: maxValue !== undefined ? maxValue : null,
          unit: unit || null,
          isCritical: isCritical || false,
          isActive: true,
        });
      });

      const specId = getInsertId(result);

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'quality_specs',
        recordId: Number(specId),
        newValue: { itemId, testName },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(specId) }, 'Quality specification created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
