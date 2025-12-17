import { NextRequest } from 'next/server';
import { eq, like, sql } from 'drizzle-orm';
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

// GET /api/warehouses - List warehouses
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const type = searchParams.get('type') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const warehousesTable = useSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;
      
      let query = (db as any).select().from(warehousesTable);
      
      const conditions = [];
      if (search) {
        conditions.push(like(warehousesTable.name, `%${search}%`));
      }
      if (type) {
        conditions.push(eq(warehousesTable.type, type));
      }
      
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, cond, i) => 
          i === 0 ? cond : sql`${acc} AND ${cond}`
        );
        query = query.where(whereClause);
      }
      
      const countResult = await (db as any)
        .select({ count: sql`count(*)` })
        .from(warehousesTable);
      const total = Number(countResult[0]?.count || 0);
      
      const offset = (pagination.page - 1) * pagination.limit;
      const warehouses = await query.limit(pagination.limit).offset(offset);
      
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
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const warehousesTable = useSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;
      
      // Check if code exists
      const existing = await (db as any)
        .select()
        .from(warehousesTable)
        .where(eq(warehousesTable.code, code))
        .limit(1);
      
      if (existing.length > 0) {
        return errorResponse('Warehouse code already exists');
      }
      
      const result = await (db as any).insert(warehousesTable).values({
        code,
        name,
        type,
        location,
      });
      
      const warehouseId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
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
