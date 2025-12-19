import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { sqliteCustomers, mysqlCustomers } from '@/lib/db/schema';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

// GET /api/customers/next-code - Generate next customer code
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const customers = isSqlite ? sqliteCustomers : mysqlCustomers;

      // Get the highest customer code number
      const result = await db
        .select({ code: customers.code })
        .from(customers)
        .where(sql`${customers.code} LIKE 'CUS%'`)
        .orderBy(sql`${customers.code} DESC`)
        .limit(1);

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
