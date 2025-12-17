import { NextRequest } from 'next/server';
import { eq, like, or, sql } from 'drizzle-orm';
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

// GET /api/items - List items
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const type = searchParams.get('type') || '';
      const category = searchParams.get('category') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      
      // Build query
      let baseQuery = (db as any).select().from(itemsTable);
      
      // Apply filters
      const conditions = [];
      if (search) {
        conditions.push(
          or(
            like(itemsTable.code, `%${search}%`),
            like(itemsTable.nameTh, `%${search}%`),
            like(itemsTable.nameEn, `%${search}%`)
          )
        );
      }
      if (type) {
        conditions.push(eq(itemsTable.type, type));
      }
      if (category) {
        conditions.push(eq(itemsTable.category, category));
      }
      
      // Get total count
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(itemsTable);
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, cond, i) => 
          i === 0 ? cond : sql`${acc} AND ${cond}`
        );
        baseQuery = baseQuery.where(whereClause);
        countQuery = countQuery.where(whereClause);
      }
      
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      // Apply pagination
      const offset = (pagination.page - 1) * pagination.limit;
      const items = await baseQuery.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(items, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:read']);
}

// POST /api/items - Create item
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        code,
        nameTh,
        nameEn,
        type,
        category,
        primaryUnit,
        secondaryUnit,
        conversionRate,
        shelfLifeDays,
        storageCondition,
        minStock,
        maxStock,
        reorderPoint,
        isLotControlled,
        isFEFO,
      } = body;
      
      if (!code || !nameTh || !type || !primaryUnit) {
        return errorResponse('Code, name (Thai), type, and primary unit are required');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      
      // Check if code exists
      const existing = await (db as any)
        .select()
        .from(itemsTable)
        .where(eq(itemsTable.code, code))
        .limit(1);
      
      if (existing.length > 0) {
        return errorResponse('Item code already exists');
      }
      
      // Create item
      const result = await (db as any).insert(itemsTable).values({
        code,
        nameTh,
        nameEn,
        type,
        category,
        primaryUnit,
        secondaryUnit,
        conversionRate,
        shelfLifeDays,
        storageCondition,
        minStock: minStock || 0,
        maxStock,
        reorderPoint,
        isLotControlled: isLotControlled !== false,
        isFEFO: isFEFO !== false,
      });
      
      const itemId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'items',
        recordId: Number(itemId),
        newValue: { code, nameTh, type, category },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: Number(itemId) }, 'Item created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']);
}
