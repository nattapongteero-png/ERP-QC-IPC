/**
 * VMI Orders Polling Cron Endpoint
 *
 * POST /api/purchasing/vmi/cron/poll-orders - Poll orders from all VMI vendors
 *
 * This endpoint is designed to be called by an external cron job.
 * It polls for new orders from all configured VMI vendors.
 *
 * Security: Requires CRON_SECRET header for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, lte, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVMIVendorConfig,
  sqliteVMIOrders,
  sqliteVMIOrderLines,
  sqliteVMITransactions,
  mysqlVMIVendorConfig,
  mysqlVMIOrders,
  mysqlVMIOrderLines,
  mysqlVMITransactions,
} from '@/lib/db/schema';
import { VmiPortalService, VmiPortalError, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType, VmiOrderStatus } from '@/types/vmi';

interface PollResult {
  vendorId: number;
  success: boolean;
  newOrders: number;
  error?: string;
}

// POST /api/purchasing/vmi/cron/poll-orders
export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable is not configured');
    return NextResponse.json(
      { success: false, error: 'Cron endpoint not configured' },
      { status: 500 }
    );
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const results: PollResult[] = [];

  try {
    const db = await getDb();
    const isSqlite = process.env.DB_TYPE === 'sqlite';
    const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
    const vmiOrders = isSqlite ? sqliteVMIOrders : mysqlVMIOrders;
    const vmiOrderLines = isSqlite ? sqliteVMIOrderLines : mysqlVMIOrderLines;
    const vmiTransactions = isSqlite ? sqliteVMITransactions : mysqlVMITransactions;

    // Get all connected VMI vendor configs that are due for polling
    const now = new Date();
    const configs = await (db as any)
      .select()
      .from(vmiConfig)
      .where(eq(vmiConfig.isConnected, true));

    console.log(`[VMI Cron] Starting order poll for ${configs.length} vendor(s)`);

    for (const config of configs) {
      // Check if it's time to poll (based on orderPollIntervalMinutes)
      const lastPoll = config.lastOrdersPollAt
        ? new Date(config.lastOrdersPollAt)
        : new Date(0);
      const minutesSinceLastPoll = (now.getTime() - lastPoll.getTime()) / (1000 * 60);

      if (minutesSinceLastPoll < config.orderPollIntervalMinutes) {
        console.log(`[VMI Cron] Skipping vendor ${config.vendorId} - polled ${Math.floor(minutesSinceLastPoll)} minutes ago`);
        continue;
      }

      console.log(`[VMI Cron] Polling vendor ${config.vendorId}...`);

      try {
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

        // Create service
        const service = new VmiPortalService({
          vendorId: config.vendorId,
          apiKeyEncrypted: config.apiKeyEncrypted,
          baseUrl: config.baseUrl || undefined,
          vmiVendorId: config.vmiVendorId || undefined,
        });
        service.setTransactionLogger(transactionLogger);

        // Fetch new orders
        const ordersResponse = await service.getOrders({ status: 'submitted' });

        // Get existing VMI order IDs
        const existingOrderIds = await (db as any)
          .select({ vmiOrderId: vmiOrders.vmiOrderId })
          .from(vmiOrders)
          .where(eq(vmiOrders.vendorId, config.vendorId));

        const existingIds = new Set(existingOrderIds.map((o: { vmiOrderId: number }) => o.vmiOrderId));
        const newOrders = ordersResponse.orders.filter((o) => !existingIds.has(o.id));

        // Insert new orders
        let insertedCount = 0;
        for (const order of newOrders) {
          // Insert order
          const orderInsert = await (db as any).insert(vmiOrders).values({
            vendorId: config.vendorId,
            vmiOrderId: order.id,
            hospitalCode: order.hospitalCode,
            hospitalName: order.hospitalName,
            poNumber: order.poNumber,
            warehouseName: order.warehouseName || null,
            status: order.status as VmiOrderStatus,
            orderDate: order.orderDate,
            expectedDate: order.expectedDeliveryDate || null,
            totalAmount: order.totalValue,
            currency: 'THB',
            createdAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          });

          const orderId = isSqlite
            ? (orderInsert as { lastInsertRowid: number }).lastInsertRowid
            : (orderInsert as unknown as [{ insertId: number }])[0].insertId;

          // Fetch order detail for lines
          try {
            const orderDetail = await service.getOrderDetail(order.id);

            for (const line of orderDetail.order?.items || []) {
              await (db as any).insert(vmiOrderLines).values({
                vmiOrderId: orderId,
                tppCode: line.tppCode || null,
                ttmtCode: line.ttmtCode || null,
                itemName: line.name,
                quantity: line.quantity,
                unit: line.unit,
                unitPrice: line.unitPrice,
                totalPrice: line.totalPrice || line.quantity * line.unitPrice,
                createdAt: isSqlite ? now.toISOString() : now,
              });
            }
          } catch {
            console.error(`[VMI Cron] Failed to fetch detail for order ${order.id}`);
          }

          insertedCount++;
        }

        // Update last poll time
        await (db as any)
          .update(vmiConfig)
          .set({
            lastOrdersPollAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(vmiConfig.vendorId, config.vendorId));

        results.push({
          vendorId: config.vendorId,
          success: true,
          newOrders: insertedCount,
        });

        console.log(`[VMI Cron] Vendor ${config.vendorId}: ${insertedCount} new orders`);
      } catch (err) {
        const errorMessage = err instanceof VmiPortalError
          ? err.getUserMessage('en')
          : err instanceof Error
          ? err.message
          : 'Unknown error';

        results.push({
          vendorId: config.vendorId,
          success: false,
          newOrders: 0,
          error: errorMessage,
        });

        console.error(`[VMI Cron] Vendor ${config.vendorId} error: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    const totalNewOrders = results.reduce((sum, r) => sum + r.newOrders, 0);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[VMI Cron] Completed in ${duration}ms: ${successCount} success, ${failureCount} failed, ${totalNewOrders} new orders`);

    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      durationMs: duration,
      summary: {
        vendorsProcessed: results.length,
        successCount,
        failureCount,
        totalNewOrders,
      },
      results,
    });
  } catch (error) {
    console.error('[VMI Cron] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
