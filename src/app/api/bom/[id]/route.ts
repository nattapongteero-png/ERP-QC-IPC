import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, parseDbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import {
  canViewConfidentialItems,
  filterBOMLines,
} from '@/lib/services/confidentiality.service';

// GET /api/bom/[id] - Get BOM details with lines
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const bomTable = getTableRef('bOM');
      const bomLinesTable = getTableRef('bOMLines');
      const itemsTable = getTableRef('items');

      // Get BOM header with product info
      const bomResult = await executeDbOperation(async (db) => {
        return db
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
            theoreticalYield: bomTable.theoreticalYield,
            effectiveDate: bomTable.effectiveDate,
            expiryDate: bomTable.expiryDate,
            createdAt: bomTable.createdAt,
            updatedAt: bomTable.updatedAt,
          })
          .from(bomTable)
          .leftJoin(itemsTable, eq(bomTable.productId, itemsTable.id))
          .where(eq(bomTable.id, bomId));
      });

      if (bomResult.length === 0) {
        return errorResponse('BOM not found', 404);
      }

      const bom = bomResult[0];

      // Get BOM lines with item details including confidentiality fields
      const linesResult = await executeDbOperation(async (db) => {
        return db
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
            // Confidentiality fields
            confidentialityOverride: bomLinesTable.confidentialityOverride,
            defaultConfidential: itemsTable.defaultConfidential,
            confidentialityLevel: itemsTable.confidentialityLevel,
          })
          .from(bomLinesTable)
          .leftJoin(itemsTable, eq(bomLinesTable.itemId, itemsTable.id))
          .where(eq(bomLinesTable.bomId, bomId))
          .orderBy(bomLinesTable.sequence);
      });

      // Check confidentiality access
      const canViewConfidential = await canViewConfidentialItems(
        session.userId,
        bomId,
        session.role
      );

      // Map lines to include item confidentiality info for filtering
      const linesWithItems = linesResult.map((line: typeof linesResult[number]) => ({
        ...line,
        item: {
          defaultConfidential: line.defaultConfidential,
          confidentialityLevel: line.confidentialityLevel,
        },
      }));

      // Filter lines based on access
      const { lines: filteredLines, info: confidentialityInfo } = filterBOMLines(
        linesWithItems,
        canViewConfidential
      );

      return successResponse({
        ...bom,
        lines: filteredLines,
        confidentialityInfo,
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
        theoreticalYield,
        effectiveDate,
        expiryDate,
        lines,
      } = body;

      const bomTable = getTableRef('bOM');
      const bomLinesTable = getTableRef('bOMLines');

      // Check if BOM exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(bomTable)
          .where(eq(bomTable.id, bomId));
      });

      if (existing.length === 0) {
        return errorResponse('BOM not found', 404);
      }

      const oldBom = existing[0];

      // Validate status transition if status is being changed
      if (status !== undefined && status !== oldBom.status) {
        const validTransitions: Record<string, string[]> = {
          draft: ['approved'],           // Draft can only go to approved
          active: ['approved', 'obsolete'], // Legacy: active can go to approved or obsolete
          approved: ['obsolete'],         // Approved can only go to obsolete
          obsolete: ['approved'],         // Obsolete can be reactivated to approved
        };

        const allowedNextStatuses = validTransitions[oldBom.status] || [];
        if (!allowedNextStatuses.includes(status)) {
          return errorResponse(
            `Invalid status transition: ${oldBom.status} → ${status}. ` +
            `Allowed transitions from '${oldBom.status}': ${allowedNextStatuses.join(', ') || 'none'}`
          );
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
      };

      if (name !== undefined) updateData.name = name;
      if (version !== undefined) updateData.version = version;
      if (status !== undefined) updateData.status = status;
      if (batchSize !== undefined) updateData.batchSize = batchSize;
      if (batchUnit !== undefined) updateData.batchUnit = batchUnit;
      if (yieldTarget !== undefined) updateData.yieldTarget = yieldTarget;
      if (lossAllowance !== undefined) updateData.lossAllowance = lossAllowance;
      if (theoreticalYield !== undefined) updateData.theoreticalYield = theoreticalYield;
      if (effectiveDate !== undefined) {
        updateData.effectiveDate = parseDbDate(effectiveDate);
      }
      if (expiryDate !== undefined) {
        updateData.expiryDate = parseDbDate(expiryDate);
      }

      // Update BOM header
      await executeDbOperation(async (db) => {
        return db
          .update(bomTable)
          .set(updateData)
          .where(eq(bomTable.id, bomId));
      });

      // Update lines if provided
      if (lines && Array.isArray(lines)) {
        // Delete existing lines
        await executeDbOperation(async (db) => {
          return db
            .delete(bomLinesTable)
            .where(eq(bomLinesTable.bomId, bomId));
        });

        // Insert new lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await executeDbOperation(async (db) => {
            return db.insert(bomLinesTable).values({
              bomId,
              itemId: line.itemId,
              quantity: line.quantity,
              unit: line.unit,
              sequence: line.sequence || i + 1,
              isOptional: line.isOptional || false,
              notes: line.notes || null,
            });
          });
        }
      }

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'bom',
        recordId: bomId,
        oldValue: oldBom,
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

      const bomTable = getTableRef('bOM');
      const bomLinesTable = getTableRef('bOMLines');

      // Check if BOM exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(bomTable)
          .where(eq(bomTable.id, bomId));
      });

      if (existing.length === 0) {
        return errorResponse('BOM not found', 404);
      }

      const oldBom = existing[0];

      // Only allow deletion of draft BOMs
      if (oldBom.status !== 'draft') {
        return errorResponse('Only draft BOMs can be deleted. Change status to draft first or set to obsolete.');
      }

      // Delete BOM lines first
      await executeDbOperation(async (db) => {
        return db
          .delete(bomLinesTable)
          .where(eq(bomLinesTable.bomId, bomId));
      });

      // Delete BOM
      await executeDbOperation(async (db) => {
        return db
          .delete(bomTable)
          .where(eq(bomTable.id, bomId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'bom',
        recordId: bomId,
        oldValue: oldBom,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: bomId }, 'BOM deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
