import { NextRequest } from 'next/server';
import { eq, like, or, sql, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
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

      const customersTable = getTableRef('customers');

      const conditions: (SQL | undefined)[] = [];
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

      const whereClause = conditions.length > 0
        ? conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))
        : undefined;

      // Get count
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(customersTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const customers = await executeDbOperation(async (db) => {
        let query = db.select().from(customersTable);
        if (whereClause) {
          query = query.where(whereClause);
        }
        return query.limit(pagination.limit).offset(offset);
      });

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

      const customersTable = getTableRef('customers');

      // Check if code exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(customersTable)
          .where(eq(customersTable.code, code))
          .limit(1);
      });

      if (existing.length > 0) {
        return errorResponse('Customer code already exists');
      }

      const result = await executeDbOperation(async (db) => {
        return db.insert(customersTable).values({
          code,
          name,
          contactPerson,
          phone,
          email,
          address,
          taxId,
          customerType: customerType || 'hospital',
          creditLimit,
          creditTermDays,
          paymentTerms,
          notes,
        });
      });

      const customerId = process.env.DB_TYPE === 'sqlite'
        ? result.lastInsertRowid
        : result[0].insertId;

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
