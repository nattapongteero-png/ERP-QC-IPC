/**
 * VMI Transactions API Routes
 *
 * GET /api/purchasing/vmi/transactions - Get VMI transaction log with filtering
 */

import { NextRequest } from 'next/server';
import { eq, and, sql, desc, gte, lte, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, isSqlite } from '@/lib/db/db-helper';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

// GET /api/purchasing/vmi/transactions - Get VMI transaction log
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const vendorIdStr = searchParams.get('vendorId');
      const transactionType = searchParams.get('type');
      const status = searchParams.get('status');
      const fromDate = searchParams.get('from');
      const toDate = searchParams.get('to');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      const vmiTransactions = getTableRef('vMITransactions');
      const vendors = getTableRef('vendors');

      const usingSqlite = isSqlite();

      // Build query conditions
      const conditions: (SQL | undefined)[] = [];

      if (vendorIdStr) {
        const vendorId = parseInt(vendorIdStr);
        if (!isNaN(vendorId)) {
          conditions.push(eq(vmiTransactions.vendorId, vendorId));
        }
      }

      if (transactionType) {
        conditions.push(eq(vmiTransactions.transactionType, transactionType));
      }

      if (status) {
        conditions.push(eq(vmiTransactions.status, status));
      }

      if (fromDate) {
        const from = new Date(fromDate);
        if (!isNaN(from.getTime())) {
          conditions.push(
            gte(vmiTransactions.createdAt, usingSqlite ? from.toISOString() : from)
          );
        }
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (!isNaN(to.getTime())) {
          conditions.push(
            lte(vmiTransactions.createdAt, usingSqlite ? to.toISOString() : to)
          );
        }
      }

      // Get total count
      const total = await executeDbOperation(async (db) => {
        let countQuery = db
          .select({ count: sql<number>`count(*)` })
          .from(vmiTransactions);

        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }

        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get transactions with vendor info
      const transactions = await executeDbOperation(async (db) => {
        let query = db
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
          .orderBy(desc(vmiTransactions.createdAt))
          .limit(Math.min(limit, 100))
          .offset(offset);

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query;
      });

      // Format transactions
      type TransactionType = typeof transactions[number];
      const formattedTransactions = transactions.map((t: TransactionType) => ({
        id: t.id,
        vendorId: t.vendorId,
        vendorName: t.vendorName || 'Unknown',
        transactionType: t.transactionType,
        endpoint: t.endpoint,
        method: t.method,
        httpStatus: t.httpStatus,
        durationMs: t.durationMs,
        status: t.status,
        errorMessage: t.errorMessage,
        hasRequestPayload: !!t.requestPayload,
        hasResponsePayload: !!t.responsePayload,
        createdAt: t.createdAt?.toString() || null,
      }));

      // Get transaction type stats
      const typeStats = await executeDbOperation(async (db) => {
        return db
          .select({
            transactionType: vmiTransactions.transactionType,
            count: sql<number>`count(*)`,
          })
          .from(vmiTransactions)
          .groupBy(vmiTransactions.transactionType);
      });

      const transactionTypes = typeStats.map((t: { transactionType: string; count: number }) => ({
        type: t.transactionType,
        count: Number(t.count),
      }));

      return successResponse({
        transactions: formattedTransactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        transactionTypes,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}
