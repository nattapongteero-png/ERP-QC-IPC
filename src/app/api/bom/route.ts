import { NextRequest } from 'next/server';
import { eq, like, or, sql, and } from 'drizzle-orm';
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

// GET /api/bom - List BOMs
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || ''; // Empty string means no filter

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const bomTable = useSqlite ? schema.sqliteBOM : schema.mysqlBOM;
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            like(bomTable.code, `%${search}%`),
            like(bomTable.name, `%${search}%`)
          )
        );
      }
      if (status) {
        conditions.push(eq(bomTable.status, status));
      }

      // Count query
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(bomTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);

      // Data query with product join
      let query = (db as any)
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

      const offset = (pagination.page - 1) * pagination.limit;
      const boms = await query.limit(pagination.limit).offset(offset);

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

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const bomTable = useSqlite ? schema.sqliteBOM : schema.mysqlBOM;
      const bomLinesTable = useSqlite ? schema.sqliteBOMLines : schema.mysqlBOMLines;

      // Check if code already exists
      const existing = await (db as any)
        .select()
        .from(bomTable)
        .where(eq(bomTable.code, code))
        .limit(1);

      if (existing.length > 0) {
        return errorResponse('BOM code already exists');
      }

      // Parse dates for MySQL (needs Date objects) vs SQLite (needs strings)
      const now = new Date();
      const parsedEffectiveDate = effectiveDate
        ? (useSqlite ? effectiveDate : new Date(effectiveDate))
        : null;
      const parsedExpiryDate = expiryDate
        ? (useSqlite ? expiryDate : new Date(expiryDate))
        : null;

      // Create BOM
      const result = await (db as any).insert(bomTable).values({
        code,
        name,
        productId,
        version: version || '1.0',
        status: 'draft',
        batchSize,
        batchUnit,
        yieldTarget: yieldTarget || null,
        lossAllowance: lossAllowance || null,
        effectiveDate: parsedEffectiveDate,
        expiryDate: parsedExpiryDate,
        createdAt: useSqlite ? now.toISOString() : now,
        updatedAt: useSqlite ? now.toISOString() : now,
      });

      const bomId = useSqlite ? result.lastInsertRowid : result[0].insertId;

      // Create BOM lines if provided
      if (lines && Array.isArray(lines) && lines.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await (db as any).insert(bomLinesTable).values({
            bomId: Number(bomId),
            itemId: line.itemId,
            quantity: line.quantity,
            unit: line.unit,
            sequence: line.sequence || i + 1,
            isOptional: line.isOptional || false,
            notes: line.notes || null,
            createdAt: useSqlite ? now.toISOString() : now,
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
