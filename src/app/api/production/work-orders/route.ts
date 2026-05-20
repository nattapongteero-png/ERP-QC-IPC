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

// External API Key — same key used across APIs for IoT/sensor
const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

// GET /api/production/work-orders - List work orders
// Supports both session cookie (internal) and X-API-Key (external/IoT)
export async function GET(request: NextRequest) {
  const handleGet = async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';

      const workOrdersTable = getTableRef('workOrders');
      const itemsTable = getTableRef('items');
      const bomTable = getTableRef('bOM');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(
          or(
            like(workOrdersTable.woNumber, `%${search}%`),
            like(workOrdersTable.batchNumber, `%${search}%`),
            like(bomTable.code, `%${search}%`)
          )
        );
      }
      if (status) {
        conditions.push(eq(workOrdersTable.status, status));
      }

      // Count query (must join bom if search references it)
      const total = await executeDbOperation(async (db) => {
        let countQuery = db
          .select({ count: sql`count(*)` })
          .from(workOrdersTable)
          .leftJoin(bomTable, eq(workOrdersTable.bomId, bomTable.id));
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Data query with product + BOM join
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
            deliveryDate: workOrdersTable.deliveryDate,
            yieldPercentage: workOrdersTable.yieldPercentage,
            productId: workOrdersTable.productId,
            productCode: itemsTable.code,
            productName: itemsTable.nameTh,
            bomId: workOrdersTable.bomId,
            bomCode: bomTable.code,
            bomName: bomTable.name,
            bomVersion: bomTable.version,
            notes: workOrdersTable.notes,
            createdAt: workOrdersTable.createdAt,
          })
          .from(workOrdersTable)
          .leftJoin(itemsTable, eq(workOrdersTable.productId, itemsTable.id))
          .leftJoin(bomTable, eq(workOrdersTable.bomId, bomTable.id));

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(workOrders, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  };

  // API Key auth (external/IoT)
  if (validateApiKey(request)) {
    return handleGet();
  }

  // Session auth (internal)
  return withAuth(request, handleGet, ['production:read']);
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
        deliveryDate,
        notes,
        assignees,
      } = body;

      if (!bomId || !productId || !batchNumber || !plannedQuantity || !unit) {
        return errorResponse('BOM ID, product ID, batch number, planned quantity, and unit are required');
      }

      const VALID_ROLES = ['operator', 'supervisor', 'qa_verifier', 'ipc_checker', 'pharmacist'];
      if (assignees !== undefined) {
        if (!Array.isArray(assignees)) {
          return errorResponse('assignees must be an array');
        }
        for (const a of assignees) {
          if (!a?.employeeId || !a?.role) {
            return errorResponse('Each assignee requires employeeId and role');
          }
          if (!VALID_ROLES.includes(a.role)) {
            return errorResponse(`Invalid role '${a.role}'. Must be one of: ${VALID_ROLES.join(', ')}`);
          }
        }
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

      // Create work order with auto-requisition (status: requested)
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
          deliveryDate: parseDbDate(deliveryDate),
          notes,
          requisitionStatus: 'requested',
          requisitionRequestedBy: session.userId,
          requisitionRequestedAt: dbDate(),
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

      // Persist assignees if provided. Each row links employee+role to the WO;
      // positionId is optional snapshot — service can read live position from hr_employees later.
      let assigneesCreated = 0;
      if (Array.isArray(assignees) && assignees.length > 0) {
        const assigneesTable = getTableRef('workOrderAssignees');
        for (const a of assignees) {
          await executeDbOperation(async (db) => {
            return db.insert(assigneesTable).values({
              workOrderId: Number(workOrderId),
              employeeId: Number(a.employeeId),
              positionId: a.positionId ? Number(a.positionId) : null,
              role: a.role,
              notes: a.notes || null,
              assignedBy: session.userId,
              assignedAt: dbDate(),
            });
          });
          assigneesCreated++;
        }
      }

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'work_orders',
        recordId: Number(workOrderId),
        newValue: { woNumber, batchNumber, plannedQuantity, status: 'planned', materialsFromBom: materialsCreated, assignees: assigneesCreated },
        ipAddress: getClientIP(request),
      });

      return successResponse(
        { id: Number(workOrderId), woNumber, materialsCreated, assigneesCreated },
        `Work order created successfully with ${materialsCreated} materials${assigneesCreated > 0 ? ` and ${assigneesCreated} assignees` : ''}`
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
