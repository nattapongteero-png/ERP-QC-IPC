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

// GET /api/vendors - List vendors
export async function GET(request: NextRequest) {
  return withAuth(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const isApproved = searchParams.get('isApproved');
      const isVMI = searchParams.get('isVMI');
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const vendorsTable = useSqlite ? schema.sqliteVendors : schema.mysqlVendors;
      
      let query = (db as any).select().from(vendorsTable);
      
      const conditions = [];
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
      
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, cond, i) => 
          i === 0 ? cond : sql`${acc} AND ${cond}`
        );
        query = query.where(whereClause);
      }
      
      const countResult = await (db as any)
        .select({ count: sql`count(*)` })
        .from(vendorsTable);
      const total = Number(countResult[0]?.count || 0);
      
      const offset = (pagination.page - 1) * pagination.limit;
      const vendors = await query.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(vendors, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/vendors - Create vendor
export async function POST(request: NextRequest) {
  return withAuth(async (session) => {
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
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const vendorsTable = useSqlite ? schema.sqliteVendors : schema.mysqlVendors;
      
      // Check if code exists
      const existing = await (db as any)
        .select()
        .from(vendorsTable)
        .where(eq(vendorsTable.code, code))
        .limit(1);
      
      if (existing.length > 0) {
        return errorResponse('Vendor code already exists');
      }
      
      const result = await (db as any).insert(vendorsTable).values({
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
      
      const vendorId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
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
