import { NextRequest } from 'next/server';
import { eq, like, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/customers - List customers
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const customerType = searchParams.get('customerType');
      const isActive = searchParams.get('isActive');

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const customersTable = useSqlite ? schema.sqliteCustomers : schema.mysqlCustomers;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (db as any).select().from(customersTable);

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            like(customersTable.code, `%${search}%`),
            like(customersTable.name, `%${search}%`),
            like(customersTable.email, `%${search}%`),
            like(customersTable.phone, `%${search}%`)
          )
        );
      }
      if (customerType) {
        conditions.push(eq(customersTable.customerType, customerType));
      }
      if (isActive !== null && isActive !== undefined && isActive !== '') {
        conditions.push(eq(customersTable.isActive, isActive === 'true'));
      }

      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, cond, i) =>
          i === 0 ? cond : sql`${acc} AND ${cond}`
        );
        query = query.where(whereClause);
      }

      // Get count with same conditions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let countQuery = (db as any)
        .select({ count: sql`count(*)` })
        .from(customersTable);

      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, cond, i) =>
          i === 0 ? cond : sql`${acc} AND ${cond}`
        );
        countQuery = countQuery.where(whereClause);
      }

      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);

      const offset = (pagination.page - 1) * pagination.limit;
      const customers = await query.limit(pagination.limit).offset(offset);

      return successResponse(createPaginatedResponse(customers, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:read']);
}

// POST /api/customers - Create customer
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        code,
        name,
        contactPerson,
        phone,
        email,
        address,
        taxId,
        customerType,
        creditLimit,
        creditTermDays,
        paymentTerms,
        notes,
      } = body;

      if (!code || !name) {
        return errorResponse('Code and name are required');
      }

      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const customersTable = useSqlite ? schema.sqliteCustomers : schema.mysqlCustomers;

      // Check if code exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (db as any)
        .select()
        .from(customersTable)
        .where(eq(customersTable.code, code))
        .limit(1);

      if (existing.length > 0) {
        return errorResponse('Customer code already exists');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (db as any).insert(customersTable).values({
        code,
        name,
        contactPerson,
        phone,
        email,
        address,
        taxId,
        customerType: customerType || 'regular',
        creditLimit,
        creditTermDays,
        paymentTerms,
        notes,
      });

      const customerId = useSqlite ? result.lastInsertRowid : result[0].insertId;

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'customers',
        recordId: Number(customerId),
        newValue: { code, name, customerType },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(customerId) }, 'Customer created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:write']);
}
