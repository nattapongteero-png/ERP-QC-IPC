import { NextRequest } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { getDb, useSqlite } from '@/lib/db';
import {
  sqliteQualitySpecs,
  sqliteItems,
  mysqlQualitySpecs,
  mysqlItems,
} from '@/lib/db/schema';
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

      const db = await getDb();
      const isSqlite = useSqlite();
      const specsTable = isSqlite ? sqliteQualitySpecs : mysqlQualitySpecs;
      const itemsTable = isSqlite ? sqliteItems : mysqlItems;

      const conditions = [];
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
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(specsTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);

      // Data query with item info
      let query = (db as any)
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

      const offset = (pagination.page - 1) * pagination.limit;
      const specs = await query.limit(pagination.limit).offset(offset);

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

      const db = await getDb();
      const isSqlite = useSqlite();
      const specsTable = isSqlite ? sqliteQualitySpecs : mysqlQualitySpecs;

      const result = await (db as any).insert(specsTable).values({
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

      const specId = isSqlite ? result.lastInsertRowid : result[0].insertId;

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
