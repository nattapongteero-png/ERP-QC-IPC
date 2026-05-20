import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth, errorResponse } from '@/lib/api-utils';

const VALID_ROLES = ['operator', 'supervisor', 'qa_verifier', 'ipc_checker', 'pharmacist'];

// GET /api/production/work-orders/[id]/assignees
// Returns the team assigned to a work order, joined with employee + position details
// so the UI can render names and titles without separate lookups.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id, 10);
      if (Number.isNaN(workOrderId)) {
        return errorResponse('Invalid work order id');
      }

      const assigneesTable = getTableRef('workOrderAssignees');
      const employeesTable = getTableRef('HREmployees');
      const positionsTable = getTableRef('HRPositions');

      const rows = await executeDbOperation(async (db) => {
        return db
          .select({
            id: assigneesTable.id,
            workOrderId: assigneesTable.workOrderId,
            employeeId: assigneesTable.employeeId,
            employeeCode: employeesTable.employeeCode,
            employeeFirstName: employeesTable.firstName,
            employeeLastName: employeesTable.lastName,
            positionId: assigneesTable.positionId,
            positionTitle: positionsTable.title,
            role: assigneesTable.role,
            notes: assigneesTable.notes,
            assignedAt: assigneesTable.assignedAt,
          })
          .from(assigneesTable)
          .leftJoin(employeesTable, eq(assigneesTable.employeeId, employeesTable.id))
          .leftJoin(positionsTable, eq(assigneesTable.positionId, positionsTable.id))
          .where(eq(assigneesTable.workOrderId, workOrderId));
      });

      return successResponse(rows);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// PUT /api/production/work-orders/[id]/assignees
// Replaces the entire assignees list for a WO. Simpler than per-row CRUD —
// matches how the edit dialog re-saves the whole list on Save.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id, 10);
      if (Number.isNaN(workOrderId)) {
        return errorResponse('Invalid work order id');
      }

      const body = await request.json().catch(() => ({}));
      const list = Array.isArray(body?.assignees) ? body.assignees : null;
      if (!list) {
        return errorResponse('Body must contain assignees array');
      }

      // Validate every row before any DB write
      for (const a of list) {
        if (!a?.employeeId || !a?.role) {
          return errorResponse('Each assignee requires employeeId and role');
        }
        if (!VALID_ROLES.includes(a.role)) {
          return errorResponse(`Invalid role '${a.role}'`);
        }
      }

      const assigneesTable = getTableRef('workOrderAssignees');

      // Replace strategy: delete all then insert new list.
      // Acceptable for low-volume edits and avoids tracking which rows changed.
      await executeDbOperation(async (db) => {
        return db.delete(assigneesTable).where(eq(assigneesTable.workOrderId, workOrderId));
      });

      let inserted = 0;
      for (const a of list) {
        await executeDbOperation(async (db) => {
          return db.insert(assigneesTable).values({
            workOrderId,
            employeeId: Number(a.employeeId),
            positionId: a.positionId ? Number(a.positionId) : null,
            role: a.role,
            notes: a.notes || null,
            assignedBy: session.userId,
            assignedAt: dbDate(),
          });
        });
        inserted++;
      }

      return successResponse({ workOrderId, assigneesCount: inserted });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
