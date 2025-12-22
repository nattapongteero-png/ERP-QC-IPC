/**
 * VMI Config API Routes
 *
 * GET /api/vendors/[id]/vmi-config - Get vendor's VMI configuration
 * PUT /api/vendors/[id]/vmi-config - Update vendor's VMI configuration
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVendors,
  sqliteVMIVendorConfig,
  mysqlVendors,
  mysqlVMIVendorConfig,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { encrypt, isValidCiphertext } from '@/lib/crypto/encrypt';

// GET /api/vendors/[id]/vmi-config - Get vendor's VMI configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
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

      // Check if vendor exists
      const vendorResult = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      if (vendorResult.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Get VMI config for this vendor
      const configResult = await (db as any)
        .select({
          id: vmiConfig.id,
          vendorId: vmiConfig.vendorId,
          vmiVendorId: vmiConfig.vmiVendorId,
          baseUrl: vmiConfig.baseUrl,
          isConnected: vmiConfig.isConnected,
          lastConnectionAt: vmiConfig.lastConnectionAt,
          syncItemsEnabled: vmiConfig.syncItemsEnabled,
          syncPricesEnabled: vmiConfig.syncPricesEnabled,
          syncInventoryEnabled: vmiConfig.syncInventoryEnabled,
          orderPollIntervalMinutes: vmiConfig.orderPollIntervalMinutes,
          lastItemsSyncAt: vmiConfig.lastItemsSyncAt,
          lastPricesSyncAt: vmiConfig.lastPricesSyncAt,
          lastInventorySyncAt: vmiConfig.lastInventorySyncAt,
          lastOrdersPollAt: vmiConfig.lastOrdersPollAt,
          createdAt: vmiConfig.createdAt,
          updatedAt: vmiConfig.updatedAt,
        })
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        // Return empty config if not configured
        return successResponse({
          vendorId,
          isConfigured: false,
          config: null,
        });
      }

      // Return config without exposing encrypted API key
      return successResponse({
        vendorId,
        isConfigured: true,
        hasApiKey: true,
        config: configResult[0],
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// PUT /api/vendors/[id]/vmi-config - Update vendor's VMI configuration
export async function PUT(
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

      const body = await request.json();
      const {
        apiKey,
        vmiVendorId,
        baseUrl,
        syncItemsEnabled,
        syncPricesEnabled,
        syncInventoryEnabled,
        orderPollIntervalMinutes,
      } = body;

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;

      // Check if vendor exists
      const vendorResult = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      if (vendorResult.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Check if vendor is VMI-enabled
      if (!vendorResult[0].isVMI) {
        return errorResponse('Vendor is not VMI-enabled. Enable VMI on the vendor first.');
      }

      // Check if config already exists
      const existingConfig = await (db as any)
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      const now = new Date();
      const isUpdate = existingConfig.length > 0;

      if (isUpdate) {
        // Update existing config
        const updateData: Record<string, unknown> = {
          updatedAt: isSqlite ? now.toISOString() : now,
        };

        // Only update API key if provided (allows partial updates)
        if (apiKey) {
          updateData.apiKeyEncrypted = encrypt(apiKey);
          updateData.isConnected = false; // Reset connection status when API key changes
          updateData.lastConnectionAt = null;
        }

        if (vmiVendorId !== undefined) updateData.vmiVendorId = vmiVendorId || null;
        if (baseUrl !== undefined) updateData.baseUrl = baseUrl || null;
        if (syncItemsEnabled !== undefined) updateData.syncItemsEnabled = syncItemsEnabled;
        if (syncPricesEnabled !== undefined) updateData.syncPricesEnabled = syncPricesEnabled;
        if (syncInventoryEnabled !== undefined) updateData.syncInventoryEnabled = syncInventoryEnabled;
        if (orderPollIntervalMinutes !== undefined) {
          updateData.orderPollIntervalMinutes = Math.max(5, Math.min(60, orderPollIntervalMinutes));
        }

        await (db as any)
          .update(vmiConfig)
          .set(updateData)
          .where(eq(vmiConfig.vendorId, vendorId));

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'vmi_vendor_config',
          recordId: existingConfig[0].id,
          oldValue: { ...existingConfig[0], apiKeyEncrypted: '[REDACTED]' },
          newValue: { ...updateData, apiKeyEncrypted: apiKey ? '[UPDATED]' : '[UNCHANGED]' },
          ipAddress: getClientIP(request),
        });

        return successResponse({ vendorId }, 'VMI configuration updated successfully');
      } else {
        // Create new config - API key is required for new configs
        if (!apiKey) {
          return errorResponse('API key is required for new VMI configuration');
        }

        const encryptedApiKey = encrypt(apiKey);

        const insertData = {
          vendorId,
          apiKeyEncrypted: encryptedApiKey,
          vmiVendorId: vmiVendorId || null,
          baseUrl: baseUrl || null,
          isConnected: false,
          syncItemsEnabled: syncItemsEnabled ?? true,
          syncPricesEnabled: syncPricesEnabled ?? true,
          syncInventoryEnabled: syncInventoryEnabled ?? true,
          orderPollIntervalMinutes: orderPollIntervalMinutes
            ? Math.max(5, Math.min(60, orderPollIntervalMinutes))
            : 15,
          createdAt: isSqlite ? now.toISOString() : now,
          updatedAt: isSqlite ? now.toISOString() : now,
        };

        const result = await (db as any).insert(vmiConfig).values(insertData);

        const insertedId = isSqlite
          ? (result as { lastInsertRowid: number }).lastInsertRowid
          : (result as unknown as [{ insertId: number }])[0].insertId;

        await createAuditLog({
          userId: session.userId,
          action: 'CREATE',
          tableName: 'vmi_vendor_config',
          recordId: insertedId,
          newValue: { ...insertData, apiKeyEncrypted: '[REDACTED]' },
          ipAddress: getClientIP(request),
        });

        return successResponse({ vendorId, configId: insertedId }, 'VMI configuration created successfully');
      }
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
