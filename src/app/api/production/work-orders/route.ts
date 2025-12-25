import { NextRequest } from 'next/server';
import { eq, like, or, sql, and, type SQL } from 'drizzle-orm';
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

// Generate work order number
function generateWONumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WO${year}${month}${day}${random}`;
}

// GET /api/production/work-orders - List work orders
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';

      const workOrdersTable = getTableRef('workOrders');
      const itemsTable = getTableRef('items');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(
          or(
            like(workOrdersTable.woNumber, `%${search}%`),
            like(workOrdersTable.batchNumber, `%${search}%`)
          )
        );
      }
      if (status) {
        conditions.push(eq(workOrdersTable.status, status));
      }

      // Count query
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(workOrdersTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Data query with product join
      const offset = (pagination.page - 1) * pagination.limit;
      const workOrders = await executeDbOperation(async (db) => {
        let query = db
          .select({
            id: workOrdersTable.id,
            woNumber: workOrdersTable.woNumber,
            batchNumber: workOrdersTable.batchNumber,
            plannedQuantity: workOrdersTable.plannedQuantity,
            actualQuantity: workOrdersTable.actualQuantity,
            unit: workOrdersTable.unit,
            status: workOrdersTable.status,
            priority: workOrdersTable.priority,
            plannedStartDate: workOrdersTable.plannedStartDate,
            plannedEndDate: workOrdersTable.plannedEndDate,
            actualStartDate: workOrdersTable.actualStartDate,
            actualEndDate: workOrdersTable.actualEndDate,
            yieldPercentage: workOrdersTable.yieldPercentage,
            productId: workOrdersTable.productId,
            productCode: itemsTable.code,
            productName: itemsTable.nameTh,
            createdAt: workOrdersTable.createdAt,
          })
          .from(workOrdersTable)
          .leftJoin(itemsTable, eq(workOrdersTable.productId, itemsTable.id));

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(workOrders, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/work-orders - Create work order
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        bomId,
        productId,
        batchNumber,
        plannedQuantity,
        unit,
        priority,
        plannedStartDate,
        plannedEndDate,
        notes,
      } = body;

      if (!bomId || !productId || !batchNumber || !plannedQuantity || !unit) {
        return errorResponse('BOM ID, product ID, batch number, planned quantity, and unit are required');
      }

      const workOrdersTable = getTableRef('workOrders');
      const bomTable = getTableRef('bOM');
      const bomLinesTable = getTableRef('bOMLines');
      const workOrderMaterialsTable = getTableRef('workOrderMaterials');
      const woNumber = generateWONumber();

      // Fetch BOM to get batch size for scaling
      const bomResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: bomTable.id,
            batchSize: bomTable.batchSize,
            status: bomTable.status,
          })
          .from(bomTable)
          .where(eq(bomTable.id, bomId));
      });

      if (bomResult.length === 0) {
        return errorResponse('BOM not found', 404);
      }

      const bom = bomResult[0];

      // Validate BOM status - only approved BOMs can be used for production
      if (bom.status !== 'approved' && bom.status !== 'active') {
        return errorResponse(`Cannot create work order from BOM with status '${bom.status}'. Only approved BOMs can be used.`);
      }

      const bomBatchSize = Number(bom.batchSize) || 1;

      // Fetch BOM lines (materials)
      const bomLines = await executeDbOperation(async (db) => {
        return db
          .select({
            itemId: bomLinesTable.itemId,
            quantity: bomLinesTable.quantity,
            unit: bomLinesTable.unit,
            sequence: bomLinesTable.sequence,
            isOptional: bomLinesTable.isOptional,
          })
          .from(bomLinesTable)
          .where(eq(bomLinesTable.bomId, bomId))
          .orderBy(bomLinesTable.sequence);
      });

      // Create work order
      const result = await executeDbOperation(async (db) => {
        return db.insert(workOrdersTable).values({
          woNumber,
          bomId,
          productId,
          batchNumber,
          plannedQuantity,
          unit,
          status: 'planned',
          priority: priority || 5,
          plannedStartDate: parseDbDate(plannedStartDate),
          plannedEndDate: parseDbDate(plannedEndDate),
          notes,
          createdBy: session.userId,
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const workOrderId = getInsertId(result);

      // Auto-populate materials from BOM lines (scaled to planned quantity)
      const scalingFactor = Number(plannedQuantity) / bomBatchSize;
      let materialsCreated = 0;

      for (const line of bomLines) {
        // Skip optional materials - they can be added manually if needed
        if (line.isOptional) continue;

        const scaledQuantity = Number(line.quantity) * scalingFactor;

        await executeDbOperation(async (db) => {
          return db.insert(workOrderMaterialsTable).values({
            workOrderId: Number(workOrderId),
            itemId: line.itemId,
            lotId: null, // Lot to be selected later during material issuance
            plannedQuantity: scaledQuantity,
            actualQuantity: null,
            unit: line.unit,
            status: 'pending',
          });
        });

        materialsCreated++;
      }

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'work_orders',
        recordId: Number(workOrderId),
        newValue: { woNumber, batchNumber, plannedQuantity, status: 'planned', materialsFromBom: materialsCreated },
        ipAddress: getClientIP(request),
      });

      return successResponse(
        { id: Number(workOrderId), woNumber, materialsCreated },
        `Work order created successfully with ${materialsCreated} materials from BOM`
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
