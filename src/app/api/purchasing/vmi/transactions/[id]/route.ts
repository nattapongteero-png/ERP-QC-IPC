/**
 * VMI Transaction Detail API Routes
 *
 * GET /api/purchasing/vmi/transactions/[id] - Get transaction detail with payloads
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVendors,
  sqliteVMITransactions,
  mysqlVendors,
  mysqlVMITransactions,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/purchasing/vmi/transactions/[id] - Get transaction detail
export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async () => {
    try {
      const { id: idStr } = await context.params;
      const id = parseInt(idStr);

      if (isNaN(id)) {
        return errorResponse('Invalid transaction ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiTransactions = isSqlite ? sqliteVMITransactions : mysqlVMITransactions;
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;

      // Get transaction with vendor info
      const result = await (db as any)
        .select({
          id: vmiTransactions.id,
          vendorId: vmiTransactions.vendorId,
          vendorName: vendors.name,
          transactionType: vmiTransactions.transactionType,
          endpoint: vmiTransactions.endpoint,
          method: vmiTransactions.method,
          httpStatus: vmiTransactions.httpStatus,
          durationMs: vmiTransactions.durationMs,
          status: vmiTransactions.status,
          errorMessage: vmiTransactions.errorMessage,
          requestPayload: vmiTransactions.requestPayload,
          responsePayload: vmiTransactions.responsePayload,
          createdAt: vmiTransactions.createdAt,
        })
        .from(vmiTransactions)
        .leftJoin(vendors, eq(vmiTransactions.vendorId, vendors.id))
        .where(eq(vmiTransactions.id, id));

      if (result.length === 0) {
        return errorResponse('Transaction not found', 404);
      }

      const transaction = result[0];

      // Parse JSON payloads safely
      let requestPayload = null;
      let responsePayload = null;

      try {
        if (transaction.requestPayload) {
          requestPayload = JSON.parse(transaction.requestPayload);
        }
      } catch {
        requestPayload = transaction.requestPayload; // Return as string if parse fails
      }

      try {
        if (transaction.responsePayload) {
          responsePayload = JSON.parse(transaction.responsePayload);
        }
      } catch {
        responsePayload = transaction.responsePayload; // Return as string if parse fails
      }

      return successResponse({
        id: transaction.id,
        vendorId: transaction.vendorId,
        vendorName: transaction.vendorName || 'Unknown',
        transactionType: transaction.transactionType,
        endpoint: transaction.endpoint,
        method: transaction.method,
        httpStatus: transaction.httpStatus,
        durationMs: transaction.durationMs,
        status: transaction.status,
        errorMessage: transaction.errorMessage,
        requestPayload,
        responsePayload,
        createdAt: transaction.createdAt?.toString() || null,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}
