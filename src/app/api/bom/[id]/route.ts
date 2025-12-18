import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/bom/[id] - Get BOM details with lines
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const bomTable = useSqlite ? schema.sqliteBOM : schema.mysqlBOM;
      const bomLinesTable = useSqlite ? schema.sqliteBOMLines : schema.mysqlBOMLines;
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;

      // Get BOM header with product info
      const bomResult = await (db as any)
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
          batchSize: bomTable.batchSize,
          batchUnit: bomTable.batchUnit,
          yieldTarget: bomTable.yieldTarget,
          lossAllowance: bomTable.lossAllowance,
          effectiveDate: bomTable.effectiveDate,
          expiryDate: bomTable.expiryDate,
          createdAt: bomTable.createdAt,
          updatedAt: bomTable.updatedAt,
        })
        .from(bomTable)
        .leftJoin(itemsTable, eq(bomTable.productId, itemsTable.id))
        .where(eq(bomTable.id, bomId));

      if (bomResult.length === 0) {
        return errorResponse('BOM not found', 404);
      }

      const bom = bomResult[0];

      // Get BOM lines with item details
      const linesResult = await (db as any)
        .select({
          id: bomLinesTable.id,
          bomId: bomLinesTable.bomId,
          itemId: bomLinesTable.itemId,
          itemCode: itemsTable.code,
          itemName: itemsTable.nameTh,
          itemUnit: itemsTable.primaryUnit,
          itemType: itemsTable.type,
          quantity: bomLinesTable.quantity,
          unit: bomLinesTable.unit,
          sequence: bomLinesTable.sequence,
          isOptional: bomLinesTable.isOptional,
          notes: bomLinesTable.notes,
        })
        .from(bomLinesTable)
        .leftJoin(itemsTable, eq(bomLinesTable.itemId, itemsTable.id))
        .where(eq(bomLinesTable.bomId, bomId))
        .orderBy(bomLinesTable.sequence);

      return successResponse({
        ...bom,
        lines: linesResult,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// PUT /api/bom/[id] - Update BOM
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);
      const body = await request.json();
      const {
        name,
        version,
        status,
        batchSize,
        batchUnit,
        yieldTarget,
        lossAllowance,
        effectiveDate,
        expiryDate,
        lines,
      } = body;

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const bomTable = useSqlite ? schema.sqliteBOM : schema.mysqlBOM;
      const bomLinesTable = useSqlite ? schema.sqliteBOMLines : schema.mysqlBOMLines;

      // Check if BOM exists
      const [existing] = await (db as any)
        .select()
        .from(bomTable)
        .where(eq(bomTable.id, bomId));

      if (!existing) {
        return errorResponse('BOM not found', 404);
      }

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: useSqlite ? new Date().toISOString() : new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (version !== undefined) updateData.version = version;
      if (status !== undefined) updateData.status = status;
      if (batchSize !== undefined) updateData.batchSize = batchSize;
      if (batchUnit !== undefined) updateData.batchUnit = batchUnit;
      if (yieldTarget !== undefined) updateData.yieldTarget = yieldTarget;
      if (lossAllowance !== undefined) updateData.lossAllowance = lossAllowance;
      if (effectiveDate !== undefined) {
        updateData.effectiveDate = effectiveDate ? (useSqlite ? effectiveDate : new Date(effectiveDate)) : null;
      }
      if (expiryDate !== undefined) {
        updateData.expiryDate = expiryDate ? (useSqlite ? expiryDate : new Date(expiryDate)) : null;
      }

      // Update BOM header
      await (db as any)
        .update(bomTable)
        .set(updateData)
        .where(eq(bomTable.id, bomId));

      // Update lines if provided
      if (lines && Array.isArray(lines)) {
        // Delete existing lines
        await (db as any)
          .delete(bomLinesTable)
          .where(eq(bomLinesTable.bomId, bomId));

        // Insert new lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await (db as any).insert(bomLinesTable).values({
            bomId,
            itemId: line.itemId,
            quantity: line.quantity,
            unit: line.unit,
            sequence: line.sequence || i + 1,
            isOptional: line.isOptional || false,
            notes: line.notes || null,
          });
        }
      }

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'bom',
        recordId: bomId,
        oldValue: existing,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: bomId }, 'BOM updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

// DELETE /api/bom/[id] - Delete BOM
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const bomTable = useSqlite ? schema.sqliteBOM : schema.mysqlBOM;
      const bomLinesTable = useSqlite ? schema.sqliteBOMLines : schema.mysqlBOMLines;

      // Check if BOM exists
      const [existing] = await (db as any)
        .select()
        .from(bomTable)
        .where(eq(bomTable.id, bomId));

      if (!existing) {
        return errorResponse('BOM not found', 404);
      }

      // Only allow deletion of draft BOMs
      if (existing.status !== 'draft') {
        return errorResponse('Only draft BOMs can be deleted. Change status to draft first or set to obsolete.');
      }

      // Delete BOM lines first
      await (db as any)
        .delete(bomLinesTable)
        .where(eq(bomLinesTable.bomId, bomId));

      // Delete BOM
      await (db as any)
        .delete(bomTable)
        .where(eq(bomTable.id, bomId));

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'bom',
        recordId: bomId,
        oldValue: existing,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: bomId }, 'BOM deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
