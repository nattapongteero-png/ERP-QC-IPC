import { NextRequest } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteCustomers,
  sqliteSalesOrders,
  mysqlCustomers,
  mysqlSalesOrders,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/customers/[id] - Get customer details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const customerId = parseInt(id);

      if (isNaN(customerId)) {
        return errorResponse('Invalid customer ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const customers = isSqlite ? sqliteCustomers : mysqlCustomers;
      const salesOrders = isSqlite ? sqliteSalesOrders : mysqlSalesOrders;

      // Get customer details
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerResult = await (db as any)
        .select()
        .from(customers)
        .where(eq(customers.id, customerId));

      if (customerResult.length === 0) {
        return errorResponse('Customer not found', 404);
      }

      const customer = customerResult[0];

      // Get recent sales orders for this customer
      const recentSOs = await (db as any).select({
          id: salesOrders.id,
          soNumber: salesOrders.soNumber,
          orderDate: salesOrders.orderDate,
          requiredDate: salesOrders.requiredDate,
          status: salesOrders.status,
          totalAmount: salesOrders.totalAmount,
          currency: salesOrders.currency,
        })
        .from(salesOrders)
        .where(eq(salesOrders.customerName, customer.name))
        .orderBy(desc(salesOrders.createdAt))
        .limit(10);

      // Get summary statistics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const soStats = await (db as any).select({
          totalOrders: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(${salesOrders.totalAmount})`,
        })
        .from(salesOrders)
        .where(eq(salesOrders.customerName, customer.name));

      const statusCounts = await (db as any).select({
          status: salesOrders.status,
          count: sql<number>`count(*)`,
        })
        .from(salesOrders)
        .where(eq(salesOrders.customerName, customer.name))
        .groupBy(salesOrders.status);

      const summary = {
        totalOrders: Number(soStats[0]?.totalOrders) || 0,
        totalAmount: Number(soStats[0]?.totalAmount) || 0,
        statusBreakdown: statusCounts.reduce(
          (
            acc: Record<string, number>,
            curr: { status: string | null; count: number | string }
          ) => {
            acc[curr.status || 'unknown'] = Number(curr.count);
            return acc;
          },
          {}
        ),
      };

      return successResponse({
        customer,
        recentSalesOrders: recentSOs,
        summary,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:read']);
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const customerId = parseInt(id);

      if (isNaN(customerId)) {
        return errorResponse('Invalid customer ID');
      }

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
        isActive,
      } = body;

      if (!code || !name) {
        return errorResponse('Code and name are required');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const customers = isSqlite ? sqliteCustomers : mysqlCustomers;

      // Check if customer exists
      const existing = await (db as any).select()
        .from(customers)
        .where(eq(customers.id, customerId));

      if (existing.length === 0) {
        return errorResponse('Customer not found', 404);
      }

      // Check if code is unique (excluding current customer)
      const codeCheck = await (db as any).select()
        .from(customers)
        .where(eq(customers.code, code));

      if (codeCheck.length > 0 && codeCheck[0].id !== customerId) {
        return errorResponse('Customer code already exists');
      }

      const now = new Date();
      await (db as any).update(customers)
        .set({
          code,
          name,
          contactPerson,
          phone,
          email,
          address,
          taxId,
          customerType: customerType ?? existing[0].customerType,
          creditLimit,
          creditTermDays,
          paymentTerms,
          notes,
          isActive: isActive ?? existing[0].isActive,
          updatedAt: isSqlite ? now.toISOString() : now,
        })
        .where(eq(customers.id, customerId));

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'customers',
        recordId: customerId,
        oldValue: existing[0],
        newValue: { code, name, customerType, isActive },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: customerId }, 'Customer updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:write']);
}

// DELETE /api/customers/[id] - Delete (deactivate) customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const customerId = parseInt(id);

      if (isNaN(customerId)) {
        return errorResponse('Invalid customer ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const customers = isSqlite ? sqliteCustomers : mysqlCustomers;
      const salesOrders = isSqlite ? sqliteSalesOrders : mysqlSalesOrders;

      // Check if customer exists
      const existing = await (db as any).select()
        .from(customers)
        .where(eq(customers.id, customerId));

      if (existing.length === 0) {
        return errorResponse('Customer not found', 404);
      }

      // Check if customer has any sales orders
      const soCount = await (db as any).select({ count: sql<number>`count(*)` })
        .from(salesOrders)
        .where(eq(salesOrders.customerName, existing[0].name));

      if (Number(soCount[0]?.count) > 0) {
        // Soft delete - deactivate instead of hard delete
        const now = new Date();
        await (db as any).update(customers)
          .set({
            isActive: false,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(customers.id, customerId));

        await createAuditLog({
          userId: session.userId,
          action: 'DELETE',
          tableName: 'customers',
          recordId: customerId,
          oldValue: existing[0],
          newValue: { isActive: false },
          ipAddress: getClientIP(request),
        });

        return successResponse(
          { id: customerId },
          'Customer deactivated (has related records)'
        );
      }

      // Hard delete if no related records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).delete(customers).where(eq(customers.id, customerId));

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'customers',
        recordId: customerId,
        oldValue: existing[0],
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: customerId }, 'Customer deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:write']);
}
