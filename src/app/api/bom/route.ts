import { NextRequest } from 'next/server';
import { eq, like, or, sql, and, inArray, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId, parseDbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/bom - List BOMs
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || ''; // Empty string means no filter

      const bomTable = getTableRef('bOM');
      const itemsTable = getTableRef('items');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(
          or(
            like(bomTable.code, `%${search}%`),
            like(bomTable.name, `%${search}%`)
          )
        );
      }
      if (status) {
        // Support comma-separated statuses (e.g., "active,approved")
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
          conditions.push(eq(bomTable.status, statuses[0]));
        } else if (statuses.length > 1) {
          conditions.push(inArray(bomTable.status, statuses));
        }
      }

      // Count query
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(bomTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Data query with product join
      const offset = (pagination.page - 1) * pagination.limit;
      const boms = await executeDbOperation(async (db) => {
        let query = db
          .select({
            id: bomTable.id,
            code: bomTable.code,
            name: bomTable.name,
            productId: bomTable.productId,
            productCode: itemsTable.code,
            productName: itemsTable.nameTh,
            productUnit: itemsTable.primaryUnit,
            version: bomTable.version,
            status: bomTable.status,
            standardBatchSize: bomTable.batchSize,
            batchUnit: bomTable.batchUnit,
            createdAt: bomTable.createdAt,
          })
          .from(bomTable)
          .leftJoin(itemsTable, eq(bomTable.productId, itemsTable.id));

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(boms, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/bom - Create BOM
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        code,
        name,
        productId,
        version,
        batchSize,
        batchUnit,
        yieldTarget,
        lossAllowance,
        effectiveDate,
        expiryDate,
        lines,
      } = body;

      if (!code || !name || !productId || !batchSize || !batchUnit) {
        return errorResponse('Code, name, product ID, batch size, and batch unit are required');
      }

      const bomTable = getTableRef('bOM');
      const bomLinesTable = getTableRef('bOMLines');

      // Check if code already exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(bomTable)
          .where(eq(bomTable.code, code))
          .limit(1);
      });

      if (existing.length > 0) {
        return errorResponse('BOM code already exists');
      }

      // Create BOM
      const result = await executeDbOperation(async (db) => {
        return db.insert(bomTable).values({
          code,
          name,
          productId,
          version: version || '1.0',
          status: 'draft',
          batchSize,
          batchUnit,
          yieldTarget: yieldTarget || null,
          lossAllowance: lossAllowance || null,
          effectiveDate: parseDbDate(effectiveDate),
          expiryDate: parseDbDate(expiryDate),
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const bomId = getInsertId(result);

      // Create BOM lines if provided
      if (lines && Array.isArray(lines) && lines.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await executeDbOperation(async (db) => {
            return db.insert(bomLinesTable).values({
              bomId: Number(bomId),
              itemId: line.itemId,
              quantity: line.quantity,
              unit: line.unit,
              sequence: line.sequence || i + 1,
              isOptional: line.isOptional || false,
              notes: line.notes || null,
              createdAt: dbDate(),
            });
          });
        }
      }

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'bom',
        recordId: Number(bomId),
        newValue: { code, name, productId, batchSize, batchUnit },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(bomId) }, 'BOM created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
