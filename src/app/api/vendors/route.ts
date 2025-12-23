import { NextRequest } from 'next/server';
import { eq, like, or, sql, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/vendors - List vendors
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const isApproved = searchParams.get('isApproved');
      const isVMI = searchParams.get('isVMI');

      const vendorsTable = getTableRef('vendors');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(
          or(
            like(vendorsTable.code, `%${search}%`),
            like(vendorsTable.name, `%${search}%`)
          )
        );
      }
      if (isApproved !== null && isApproved !== undefined) {
        conditions.push(eq(vendorsTable.isApproved, isApproved === 'true'));
      }
      if (isVMI !== null && isVMI !== undefined) {
        conditions.push(eq(vendorsTable.isVMI, isVMI === 'true'));
      }

      const whereClause = conditions.length > 0
        ? conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))
        : undefined;

      // Get count
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(vendorsTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const vendors = await executeDbOperation(async (db) => {
        let query = db.select().from(vendorsTable);
        if (whereClause) {
          query = query.where(whereClause);
        }
        return query.limit(pagination.limit).offset(offset);
      });

      return successResponse(createPaginatedResponse(vendors, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/vendors - Create vendor
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
        isApproved,
        isVMI,
        leadTimeDays,
        paymentTerms,
      } = body;

      if (!code || !name) {
        return errorResponse('Code and name are required');
      }

      const vendorsTable = getTableRef('vendors');

      // Check if code exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(vendorsTable)
          .where(eq(vendorsTable.code, code))
          .limit(1);
      });

      if (existing.length > 0) {
        return errorResponse('Vendor code already exists');
      }

      const result = await executeDbOperation(async (db) => {
        return db.insert(vendorsTable).values({
          code,
          name,
          contactPerson,
          phone,
          email,
          address,
          taxId,
          isApproved: isApproved || false,
          isVMI: isVMI || false,
          leadTimeDays,
          paymentTerms,
        });
      });

      const vendorId = getInsertId(result);

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'vendors',
        recordId: Number(vendorId),
        newValue: { code, name, isApproved, isVMI },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(vendorId) }, 'Vendor created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
