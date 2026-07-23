import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/items/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      const itemsTable = getTableRef('items');

      const items = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(itemsTable)
          .where(eq(itemsTable.id, itemId))
          .limit(1);
      });

      if (items.length === 0) {
        return notFoundResponse('Item not found');
      }

      // Map DB field name to frontend field name
      const item: any = { ...items[0] };

      // Auto-correct conversion rate for standard unit pairs on read
      const STANDARD_CONVERSIONS: Record<string, number> = {
        'kg:g': 1000, 'g:mg': 1000, 'kg:mg': 1000000,
        'l:ml': 1000, 'ml:µl': 1000, 'l:µl': 1000000,
        't:kg': 1000,
      };
      const pairKey = `${(item.primaryUnit || '').toLowerCase()}:${(item.secondaryUnit || '').toLowerCase()}`;
      if (STANDARD_CONVERSIONS[pairKey] != null) {
        item.conversionFactor = STANDARD_CONVERSIONS[pairKey];
      } else if (item.conversionRate != null) {
        item.conversionFactor = Number(item.conversionRate);
      }

      // MySQL returns DECIMAL as a string — hand back a real number.
      item.sellingPrice =
        item.sellingPrice == null || item.sellingPrice === ''
          ? null
          : Number(item.sellingPrice);

      return successResponse(item);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:read']);
}

// PUT /api/items/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      const body = await request.json();

      const itemsTable = getTableRef('items');

      // Get existing item
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(itemsTable)
          .where(eq(itemsTable.id, itemId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Item not found');
      }

      const oldItem = existing[0];

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
      };

      const allowedFields = [
        'code', 'nameTh', 'nameEn', 'type', 'category', 'primaryUnit',
        'secondaryUnit', 'conversionRate', 'shelfLifeDays', 'storageCondition',
        'minStock', 'maxStock', 'reorderPoint', 'isLotControlled', 'isFEFO', 'isActive',
        'tppCode', 'tppName', 'ttmtCode', 'ttmtName', 'drugCode24', 'vmiSyncEnabled',
        'confidentialityLevel', 'defaultConfidential', 'strength', 'gRegNumber',
        // Structured strength (value + unit) + per-unit net weight for BOM/WO
        'strengthValue', 'strengthUnit', 'unitWeightMg',
        // 3-level unit conversion (PU → SU → WU)
        'weightUnit', 'secondaryToWeightRate', 'weightTrackingEnabled',
        // ราคาขาย — prefill for quotation / sales-order lines
        'sellingPrice'
      ];

      // Map frontend field names to DB column names
      if (body.conversionFactor !== undefined) {
        body.conversionRate = body.conversionFactor;
      }

      // Auto-correct conversion rate for standard unit pairs
      const STANDARD_CONVERSIONS: Record<string, number> = {
        'kg:g': 1000, 'g:mg': 1000, 'kg:mg': 1000000,
        'l:ml': 1000, 'ml:µl': 1000, 'l:µl': 1000000,
        't:kg': 1000,
      };
      const pUnit = (body.primaryUnit || oldItem.primaryUnit || '').toLowerCase();
      const sUnit = (body.secondaryUnit || oldItem.secondaryUnit || '').toLowerCase();
      const pairKey = `${pUnit}:${sUnit}`;
      if (STANDARD_CONVERSIONS[pairKey] != null) {
        body.conversionRate = STANDARD_CONVERSIONS[pairKey];
        updateData.conversionRate = STANDARD_CONVERSIONS[pairKey];
      }

      // strengthValue is a numeric column — coerce '' / null to null and
      // strings to numbers so an empty form field doesn't break the write.
      if (body.strengthValue !== undefined) {
        body.strengthValue =
          body.strengthValue === '' || body.strengthValue === null
            ? null
            : Number(body.strengthValue);
      }
      if (body.unitWeightMg !== undefined) {
        body.unitWeightMg =
          body.unitWeightMg === '' || body.unitWeightMg === null
            ? null
            : Number(body.unitWeightMg);
      }
      // ราคาขาย — numeric column; '' / null → null, negatives rejected.
      if (body.sellingPrice !== undefined) {
        const sp =
          body.sellingPrice === '' || body.sellingPrice === null
            ? null
            : Number(body.sellingPrice);
        if (sp !== null && (isNaN(sp) || sp < 0)) {
          return errorResponse('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ');
        }
        body.sellingPrice = sp;
      }

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Update item
      await executeDbOperation(async (db) => {
        return db
          .update(itemsTable)
          .set(updateData)
          .where(eq(itemsTable.id, itemId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'items',
        recordId: itemId,
        oldValue: { code: oldItem.code, nameTh: oldItem.nameTh, type: oldItem.type },
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: itemId }, 'Item updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']);
}

// DELETE /api/items/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }

      const itemsTable = getTableRef('items');

      // Get existing item
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(itemsTable)
          .where(eq(itemsTable.id, itemId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Item not found');
      }

      // Soft delete
      await executeDbOperation(async (db) => {
        return db
          .update(itemsTable)
          .set({ isActive: false, updatedAt: dbDate() })
          .where(eq(itemsTable.id, itemId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'items',
        recordId: itemId,
        oldValue: { code: existing[0].code, nameTh: existing[0].nameTh },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: itemId }, 'Item deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:delete']);
}
