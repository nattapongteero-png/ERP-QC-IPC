import { sql, like, desc } from 'drizzle-orm';
import { db, getTableRef } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

// GET /api/customers/next-code - Generate next customer code
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const customersTable = getTableRef('customers');
      
      // Get the highest customer code number using the new db helper
      const result = await db.select({
        table: 'customers',
        columns: { code: customersTable.code },
        where: like(customersTable.code, 'CUS%'),
        orderBy: desc(customersTable.code),
        limit: 1,
      });

      let nextNumber = 1;

      if (result.length > 0) {
        const lastCode = result[0].code;
        // Extract number from code like "CUS001" -> 1
        const match = lastCode.match(/CUS(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      // Format as CUS001, CUS002, etc.
      const nextCode = `CUS${nextNumber.toString().padStart(3, '0')}`;

      return successResponse({ code: nextCode });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:read']);
}
