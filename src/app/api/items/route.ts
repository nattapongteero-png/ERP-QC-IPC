import { NextRequest } from 'next/server';
import { eq, like, or, sql, type SQL } from 'drizzle-orm';
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

// GET /api/items - List items
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const type = searchParams.get('type') || '';
      const category = searchParams.get('category') || '';

      const itemsTable = getTableRef('items');

      // Apply filters
      const conditions: (SQL | undefined)[] = [];
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

      const whereClause = conditions.length > 0
        ? conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))
        : undefined;

      // Get total count
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(itemsTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const items = await executeDbOperation(async (db) => {
        let query = db.select().from(itemsTable);
        if (whereClause) {
          query = query.where(whereClause);
        }
        return query.limit(pagination.limit).offset(offset);
      });

      // onHand is now stored in items table, no need to calculate from lots
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
        tppCode,
        tppName,
        ttmtCode,
        ttmtName,
      } = body;

      if (!code || !nameTh || !type || !primaryUnit) {
        return errorResponse('Code, name (Thai), type, and primary unit are required');
      }

      const itemsTable = getTableRef('items');

      // Check if code exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(itemsTable)
          .where(eq(itemsTable.code, code))
          .limit(1);
      });

      if (existing.length > 0) {
        return errorResponse('Item code already exists');
      }

      // Create item
      const result = await executeDbOperation(async (db) => {
        return db.insert(itemsTable).values({
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
          tppCode: tppCode || null,
          tppName: tppName || null,
          ttmtCode: ttmtCode || null,
          ttmtName: ttmtName || null,
        });
      });

      const itemId = getInsertId(result);

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
