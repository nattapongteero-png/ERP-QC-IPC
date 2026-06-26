/**
 * Link / unlink a login account (users) to an HR employee (hr_employees).
 *
 * The Metaherb SSO handoff (/api/sso/metaherb) reads hr_employees.user_id to
 * resolve the "requesterId" it puts in the token. A login with no linked
 * employee can't hand off — this endpoint is how an admin establishes that
 * link from the user-detail page.
 *
 * Body: { employeeId: number | null }
 *   - number → link this employee to the user (1:1: clears any other employee
 *              previously linked to the same user, and refuses to steal an
 *              employee already linked to a DIFFERENT user).
 *   - null   → unlink (clear whatever employee currently points at this user).
 */

import { NextRequest } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/users/[id]/employee-link
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const userId = parseInt(id);
        if (isNaN(userId)) {
          return errorResponse('Invalid user ID');
        }

        const body = await request.json();
        const rawEmployeeId = body?.employeeId;
        // Accept a positive integer (link) or null/undefined (unlink).
        let employeeId: number | null = null;
        if (rawEmployeeId !== null && rawEmployeeId !== undefined) {
          employeeId = Number(rawEmployeeId);
          if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return errorResponse('Invalid employeeId');
          }
        }

        const usersTable = getTableRef('users');
        const employeesTable = getTableRef('hREmployees');

        // The user must exist.
        const userRows = await executeDbOperation(async (db) =>
          db
            .select({ id: usersTable.id, email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1)
        );
        if (userRows.length === 0) {
          return notFoundResponse('User not found');
        }

        // Snapshot whatever employee currently points at this user (for audit
        // + so we can clear it when re-linking elsewhere).
        const previouslyLinked = await executeDbOperation(async (db) =>
          db
            .select({ id: employeesTable.id })
            .from(employeesTable)
            .where(eq(employeesTable.userId, userId))
            .limit(1)
        );
        const previousEmployeeId: number | null =
          previouslyLinked.length > 0 ? previouslyLinked[0].id : null;

        if (employeeId !== null) {
          // Target employee must exist.
          const target = await executeDbOperation(async (db) =>
            db
              .select({
                id: employeesTable.id,
                userId: employeesTable.userId,
                employeeCode: employeesTable.employeeCode,
                firstName: employeesTable.firstName,
                lastName: employeesTable.lastName,
              })
              .from(employeesTable)
              .where(eq(employeesTable.id, employeeId))
              .limit(1)
          );
          if (target.length === 0) {
            return notFoundResponse('Employee not found');
          }

          // Refuse to steal an employee already linked to a different user.
          const targetOwner = target[0].userId as number | null;
          if (targetOwner !== null && targetOwner !== userId) {
            return errorResponse(
              'พนักงานนี้ถูกผูกกับบัญชีผู้ใช้อื่นแล้ว กรุณายกเลิกการผูกเดิมก่อน',
              409
            );
          }

          await executeDbOperation(async (db) => {
            // Clear any OTHER employee still pointing at this user (enforce 1:1).
            if (previousEmployeeId !== null && previousEmployeeId !== employeeId) {
              await db
                .update(employeesTable)
                .set({ userId: null })
                .where(
                  and(
                    eq(employeesTable.userId, userId),
                    ne(employeesTable.id, employeeId)
                  )
                );
            }
            // Link the target employee to this user.
            await db
              .update(employeesTable)
              .set({ userId })
              .where(eq(employeesTable.id, employeeId));
          });

          await createAuditLog({
            userId: session.userId,
            action: 'UPDATE',
            tableName: 'hr_employees',
            recordId: employeeId,
            oldValue: { userId: previousEmployeeId === employeeId ? userId : null },
            newValue: { userId },
            ipAddress: getClientIP(request),
          });

          return successResponse(
            {
              employeeId,
              employeeCode: target[0].employeeCode,
              fullName: `${target[0].firstName} ${target[0].lastName}`.trim(),
            },
            'Employee linked successfully'
          );
        }

        // Unlink: clear whatever employee currently points at this user.
        if (previousEmployeeId === null) {
          return successResponse({ employeeId: null }, 'No link to remove');
        }

        await executeDbOperation(async (db) =>
          db
            .update(employeesTable)
            .set({ userId: null })
            .where(eq(employeesTable.userId, userId))
        );

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'hr_employees',
          recordId: previousEmployeeId,
          oldValue: { userId },
          newValue: { userId: null },
          ipAddress: getClientIP(request),
        });

        return successResponse({ employeeId: null }, 'Employee unlinked successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['users:write']
  );
}
