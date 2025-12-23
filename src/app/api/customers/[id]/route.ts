import { NextRequest } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
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

      const customersTable = getTableRef('customers');
      const salesOrdersTable = getTableRef('salesOrders');

      // Get customer details
      const customerResult = await executeDbOperation(async (db) => {
        return db.select().from(customersTable).where(eq(customersTable.id, customerId));
      });

      if (customerResult.length === 0) {
        return errorResponse('Customer not found', 404);
      }

      const customer = customerResult[0];

      // Get recent sales orders for this customer
      const recentSOs = await executeDbOperation(async (db) => {
        return db.select({
          id: salesOrdersTable.id,
          soNumber: salesOrdersTable.soNumber,
          orderDate: salesOrdersTable.orderDate,
          requiredDate: salesOrdersTable.requiredDate,
          status: salesOrdersTable.status,
          totalAmount: salesOrdersTable.totalAmount,
          currency: salesOrdersTable.currency,
        })
        .from(salesOrdersTable)
        .where(eq(salesOrdersTable.customerName, customer.name))
        .orderBy(desc(salesOrdersTable.createdAt))
        .limit(10);
      });

      // Get summary statistics
      const soStats = await executeDbOperation(async (db) => {
        return db.select({
          totalOrders: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(${salesOrdersTable.totalAmount})`,
        })
        .from(salesOrdersTable)
        .where(eq(salesOrdersTable.customerName, customer.name));
      });

      const statusCounts = await executeDbOperation(async (db) => {
        return db.select({
          status: salesOrdersTable.status,
          count: sql<number>`count(*)`,
        })
        .from(salesOrdersTable)
        .where(eq(salesOrdersTable.customerName, customer.name))
        .groupBy(salesOrdersTable.status);
      });

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

      const customersTable = getTableRef('customers');

      // Check if customer exists
      const existing = await executeDbOperation(async (db) => {
        return db.select().from(customersTable).where(eq(customersTable.id, customerId));
      });

      if (existing.length === 0) {
        return errorResponse('Customer not found', 404);
      }

      // Check if code is unique (excluding current customer)
      const codeCheck = await executeDbOperation(async (db) => {
        return db.select().from(customersTable).where(eq(customersTable.code, code));
      });

      if (codeCheck.length > 0 && codeCheck[0].id !== customerId) {
        return errorResponse('Customer code already exists');
      }

      await executeDbOperation(async (db) => {
        return db.update(customersTable)
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
            updatedAt: dbDate(),
          })
          .where(eq(customersTable.id, customerId));
      });

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

      const customersTable = getTableRef('customers');
      const salesOrdersTable = getTableRef('salesOrders');

      // Check if customer exists
      const existing = await executeDbOperation(async (db) => {
        return db.select().from(customersTable).where(eq(customersTable.id, customerId));
      });

      if (existing.length === 0) {
        return errorResponse('Customer not found', 404);
      }

      // Check if customer has any sales orders
      const soCount = await executeDbOperation(async (db) => {
        return db.select({ count: sql<number>`count(*)` })
          .from(salesOrdersTable)
          .where(eq(salesOrdersTable.customerName, existing[0].name));
      });

      if (Number(soCount[0]?.count) > 0) {
        // Soft delete - deactivate instead of hard delete
        await executeDbOperation(async (db) => {
          return db.update(customersTable)
            .set({
              isActive: false,
              updatedAt: dbDate(),
            })
            .where(eq(customersTable.id, customerId));
        });

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
      await executeDbOperation(async (db) => {
        return db.delete(customersTable).where(eq(customersTable.id, customerId));
      });

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
