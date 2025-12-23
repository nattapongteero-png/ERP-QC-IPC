import { NextRequest } from 'next/server';
import { eq, like, sql, type SQL } from 'drizzle-orm';
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

// GET /api/warehouses - List warehouses
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const type = searchParams.get('type') || '';

      const warehousesTable = getTableRef('warehouses');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(like(warehousesTable.name, `%${search}%`));
      }
      if (type) {
        conditions.push(eq(warehousesTable.type, type));
      }

      const whereClause = conditions.length > 0
        ? conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))
        : undefined;

      // Get total count
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(warehousesTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const warehouses = await executeDbOperation(async (db) => {
        let query = db.select().from(warehousesTable);
        if (whereClause) {
          query = query.where(whereClause);
        }
        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(warehouses, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}

// POST /api/warehouses - Create warehouse
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const { code, name, type, location } = body;

      if (!code || !name || !type) {
        return errorResponse('Code, name, and type are required');
      }

      const validTypes = ['raw_material', 'finished_goods', 'quarantine', 'rejected', 'wip'];
      if (!validTypes.includes(type)) {
        return errorResponse(`Type must be one of: ${validTypes.join(', ')}`);
      }

      const warehousesTable = getTableRef('warehouses');

      // Check if code exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(warehousesTable)
          .where(eq(warehousesTable.code, code))
          .limit(1);
      });

      if (existing.length > 0) {
        return errorResponse('Warehouse code already exists');
      }

      const result = await executeDbOperation(async (db) => {
        return db.insert(warehousesTable).values({
          code,
          name,
          type,
          location,
        });
      });

      const warehouseId = getInsertId(result);

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'warehouses',
        recordId: Number(warehouseId),
        newValue: { code, name, type },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(warehouseId) }, 'Warehouse created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}
