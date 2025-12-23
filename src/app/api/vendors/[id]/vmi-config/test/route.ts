/**
 * VMI Config Test API Route
 *
 * POST /api/vendors/[id]/vmi-config/test - Test VMI Portal connection
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
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

      const vendorsTable = getTableRef('vendors');
      const vmiConfigTable = getTableRef('vmiVendorConfig');
      const vmiTransactionsTable = getTableRef('vmiTransactions');

      // Check if vendor exists
      const vendorResult = await executeDbOperation(async (db) => {
        return db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
      });

      if (vendorResult.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Get VMI config
      const configResult = await executeDbOperation(async (db) => {
        return db.select().from(vmiConfigTable).where(eq(vmiConfigTable.vendorId, vendorId));
      });

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
          await executeDbOperation(async (db) => {
            return db.insert(vmiTransactionsTable).values({
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
              createdAt: dbDate(),
            });
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
            await executeDbOperation(async (db) => {
              return db
                .update(vmiConfigTable)
                .set({
                  isConnected: false,
                  lastConnectionAt: dbDate(),
                  updatedAt: dbDate(),
                })
                .where(eq(vmiConfigTable.vendorId, vendorId));
            });

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
      await executeDbOperation(async (db) => {
        return db
          .update(vmiConfigTable)
          .set({
            isConnected,
            lastConnectionAt: dbDate(),
            updatedAt: dbDate(),
          })
          .where(eq(vmiConfigTable.vendorId, vendorId));
      });

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
