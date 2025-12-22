import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, isSqlite } from '@/lib/db';
import {
  sqliteDeviations,
  sqliteUsers,
  mysqlDeviations,
  mysqlUsers,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/quality/deviations/[id] - Get deviation details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const deviationId = parseInt(id);

      if (isNaN(deviationId)) {
        return errorResponse('Invalid deviation ID');
      }

      const db = await getDb();
      const usingSqlite = isSqlite();
      const deviationsTable = usingSqlite ? sqliteDeviations : mysqlDeviations;
      const usersTable = usingSqlite ? sqliteUsers : mysqlUsers;

      // Get deviation
      const deviationResult = await (db as any)
        .select()
        .from(deviationsTable)
        .where(eq(deviationsTable.id, deviationId));

      if (deviationResult.length === 0) {
        return notFoundResponse('Deviation not found');
      }

      const deviation = deviationResult[0];

      // Get reporter info
      let reporter = null;
      if (deviation.reportedBy) {
        const reporterResult = await (db as any)
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(eq(usersTable.id, deviation.reportedBy));
        reporter = reporterResult[0] || null;
      }

      // Get assignee info
      let assignee = null;
      if (deviation.assignedTo) {
        const assigneeResult = await (db as any)
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(eq(usersTable.id, deviation.assignedTo));
        assignee = assigneeResult[0] || null;
      }

      // Get closer info
      let closer = null;
      if (deviation.closedBy) {
        const closerResult = await (db as any)
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          })
          .from(usersTable)
          .where(eq(usersTable.id, deviation.closedBy));
        closer = closerResult[0] || null;
      }

      // Calculate metrics
      const createdDate = new Date(deviation.createdAt);
      const today = new Date();
      const daysOpen = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue =
        deviation.dueDate &&
        deviation.status !== 'closed' &&
        deviation.status !== 'resolved' &&
        new Date(deviation.dueDate) < today;

      return successResponse({
        ...deviation,
        reporter,
        assignee,
        closer,
        metrics: {
          daysOpen,
          isOverdue,
        },
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:read']);
}

// PUT /api/quality/deviations/[id] - Update deviation
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const deviationId = parseInt(id);

      if (isNaN(deviationId)) {
        return errorResponse('Invalid deviation ID');
      }

      const body = await request.json();
      const {
        title,
        description,
        sourceType,
        severity,
        status,
        rootCause,
        correctiveAction,
        preventiveAction,
        assignedTo,
        dueDate,
      } = body;

      const db = await getDb();
      const usingSqlite = isSqlite();
      const deviationsTable = usingSqlite ? sqliteDeviations : mysqlDeviations;

      // Check if deviation exists
      const existing = await (db as any)
        .select()
        .from(deviationsTable)
        .where(eq(deviationsTable.id, deviationId));

      if (existing.length === 0) {
        return notFoundResponse('Deviation not found');
      }

      const oldDeviation = existing[0];

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: isSqlite ? new Date().toISOString() : new Date(),
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (sourceType !== undefined) updateData.sourceType = sourceType;
      if (severity !== undefined) updateData.severity = severity;
      if (status !== undefined) updateData.status = status;
      if (rootCause !== undefined) updateData.rootCause = rootCause;
      if (correctiveAction !== undefined) updateData.correctiveAction = correctiveAction;
      if (preventiveAction !== undefined) updateData.preventiveAction = preventiveAction;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (dueDate !== undefined) updateData.dueDate = dueDate;

      // Auto-set closed fields if status is closed
      if (status === 'closed' && oldDeviation.status !== 'closed') {
        updateData.closedBy = session.userId;
        updateData.closedAt = isSqlite ? new Date().toISOString() : new Date();
      }

      // Update deviation
      await (db as any)
        .update(deviationsTable)
        .set(updateData)
        .where(eq(deviationsTable.id, deviationId));

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'deviations',
        recordId: deviationId,
        oldValue: oldDeviation,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: deviationId }, 'Deviation updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}

// DELETE /api/quality/deviations/[id] - Delete deviation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const deviationId = parseInt(id);

      if (isNaN(deviationId)) {
        return errorResponse('Invalid deviation ID');
      }

      const db = await getDb();
      const usingSqlite = isSqlite();
      const deviationsTable = usingSqlite ? sqliteDeviations : mysqlDeviations;

      // Check if deviation exists
      const existing = await (db as any)
        .select()
        .from(deviationsTable)
        .where(eq(deviationsTable.id, deviationId));

      if (existing.length === 0) {
        return notFoundResponse('Deviation not found');
      }

      const deviation = existing[0];

      // Only allow deletion of open deviations
      if (deviation.status !== 'open') {
        return errorResponse(
          'Only open deviations can be deleted. Close or resolve the deviation instead.',
          400
        );
      }

      // Delete deviation
      await (db as any).delete(deviationsTable).where(eq(deviationsTable.id, deviationId));

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'deviations',
        recordId: deviationId,
        oldValue: deviation,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: deviationId }, 'Deviation deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
