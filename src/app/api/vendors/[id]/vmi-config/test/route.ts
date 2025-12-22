/**
 * VMI Config Test API Route
 *
 * POST /api/vendors/[id]/vmi-config/test - Test VMI Portal connection
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVendors,
  sqliteVMIVendorConfig,
  sqliteVMITransactions,
  mysqlVendors,
  mysqlVMIVendorConfig,
  mysqlVMITransactions,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { VmiPortalService, VmiPortalError, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType } from '@/types/vmi';

// POST /api/vendors/[id]/vmi-config/test - Test VMI Portal connection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const vendorId = parseInt(id);

      if (isNaN(vendorId)) {
        return errorResponse('Invalid vendor ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
      const vmiTransactions = isSqlite ? sqliteVMITransactions : mysqlVMITransactions;

      // Check if vendor exists
      const vendorResult = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      if (vendorResult.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Get VMI config
      const configResult = await (db as any)
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found. Please configure VMI settings first.');
      }

      const config = configResult[0];

      // Create transaction logger
      const transactionLogger: VmiTransactionLogger = {
        async log(
          logVendorId: number,
          transactionType: VmiTransactionType,
          endpoint: string,
          method: string,
          requestPayload: unknown,
          responsePayload: unknown,
          httpStatus: number,
          durationMs: number,
          error?: string
        ) {
          const now = new Date();
          await (db as any).insert(vmiTransactions).values({
            vendorId: logVendorId,
            transactionType,
            endpoint,
            method,
            requestPayload: requestPayload ? JSON.stringify(requestPayload) : null,
            responsePayload: responsePayload ? JSON.stringify(responsePayload) : null,
            httpStatus,
            durationMs,
            status: error ? 'error' : 'success',
            errorMessage: error || null,
            createdAt: isSqlite ? now.toISOString() : now,
          });
        },
      };

      // Create service and test connection
      const service = new VmiPortalService({
        vendorId: config.vendorId,
        apiKeyEncrypted: config.apiKeyEncrypted,
        baseUrl: config.baseUrl || undefined,
        vmiVendorId: config.vmiVendorId || undefined,
      });
      service.setTransactionLogger(transactionLogger);

      const now = new Date();
      let isConnected = false;
      let errorMessage: string | undefined;

      try {
        isConnected = await service.testConnection();
      } catch (err) {
        if (err instanceof VmiPortalError) {
          errorMessage = err.getUserMessage('en');

          // Return specific error for auth issues
          if (err.code === 'UNAUTHORIZED' || err.code === 'API_KEY_EXPIRED' || err.code === 'API_KEY_REVOKED') {
            // Update config to mark as disconnected
            await (db as any)
              .update(vmiConfig)
              .set({
                isConnected: false,
                lastConnectionAt: isSqlite ? now.toISOString() : now,
                updatedAt: isSqlite ? now.toISOString() : now,
              })
              .where(eq(vmiConfig.vendorId, vendorId));

            return errorResponse(
              `VMI Portal authentication failed: ${errorMessage}`,
              401,
              err
            );
          }
        } else {
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
        }
      }

      // Update connection status
      await (db as any)
        .update(vmiConfig)
        .set({
          isConnected,
          lastConnectionAt: isSqlite ? now.toISOString() : now,
          updatedAt: isSqlite ? now.toISOString() : now,
        })
        .where(eq(vmiConfig.vendorId, vendorId));

      // Create audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'vmi_vendor_config',
        recordId: config.id,
        oldValue: { isConnected: config.isConnected },
        newValue: { isConnected, testResult: isConnected ? 'success' : 'failed' },
        ipAddress: getClientIP(request),
      });

      if (isConnected) {
        return successResponse({
          vendorId,
          isConnected: true,
          testedAt: now.toISOString(),
        }, 'VMI Portal connection test successful');
      } else {
        return successResponse({
          vendorId,
          isConnected: false,
          testedAt: now.toISOString(),
          error: errorMessage || 'Connection failed - VMI Portal may be unreachable',
        }, 'VMI Portal connection test failed');
      }
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
