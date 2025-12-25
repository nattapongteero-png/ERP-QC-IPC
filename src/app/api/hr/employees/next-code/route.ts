// HR Employees Next Code API
// Feature: 007-hr-personnel-management

import { sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

// GET /api/hr/employees/next-code - Generate next employee code
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const employees = getTableRef('HREmployees');

      // Get the highest employee code number
      const result = await executeDbOperation(async (db) => {
        return db
          .select({ code: employees.employeeCode })
          .from(employees)
          .where(sql`${employees.employeeCode} LIKE 'EMP%'`)
          .orderBy(sql`${employees.employeeCode} DESC`)
          .limit(1);
      });

      let nextNumber = 1;

      if (result.length > 0) {
        const lastCode = result[0].code;
        // Extract number from code like "EMP001" -> 1
        const match = lastCode.match(/EMP(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      // Format as EMP001, EMP002, etc.
      const nextCode = `EMP${nextNumber.toString().padStart(3, '0')}`;

      return successResponse({ code: nextCode });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['hr:read']);
}
