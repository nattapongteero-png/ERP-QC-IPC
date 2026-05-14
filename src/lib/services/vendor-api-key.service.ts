/**
 * Vendor API Key Service
 * Manages API keys for external vendors accessing ERP data
 * Supports both TPP codes (pharmaceutical) and TTMT codes (herbal medicine)
 */

import { eq, and, sql, or } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import {
  sqliteVendorApiKeys,
  mysqlVendorApiKeys,
  sqliteVendors,
  mysqlVendors,
  sqliteApprovedVendorList,
  mysqlApprovedVendorList,
  sqliteItems,
  mysqlItems,
} from '@/lib/db/schema';
import { getNow } from '@/lib/db/date-utils';

const KEY_PREFIX = 'vmi_erp_';

export interface CreateApiKeyResult {
  id: number;
  apiKey: string; // Full key - only returned once!
  keyPrefix: string;
  name: string;
  vendorId: number;
}

export interface ValidatedVendor {
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  keyId: number;
  permissions: string;
}

/**
 * Product codes for vendor - supports both TPP and TTMT
 */
export interface VendorProductCodes {
  tppCodes: string[];
  ttmtCodes: string[];
}

export interface VendorApiKeyListItem {
  id: number;
  keyPrefix: string;
  name: string;
  permissions: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export class VendorApiKeyService {
  /**
   * Generate and store a new API key for a vendor
   */
  async createApiKey(
    vendorId: number,
    name: string,
    createdBy: number,
    permissions: string = 'read',
    expiresAt?: Date
  ): Promise<CreateApiKeyResult> {
    // Generate random key
    const randomPart = randomBytes(32).toString('hex');
    const fullKey = `${KEY_PREFIX}${randomPart}`;
    const keyHash = createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 16);

    const usingSqlite = isSqlite();

    if (usingSqlite) {
      const db = getSqliteDb();
      const result = await db.insert(sqliteVendorApiKeys).values({
        vendorId,
        keyHash,
        keyPrefix,
        name,
        permissions,
        expiresAt: expiresAt?.toISOString() ?? null,
        createdBy,
      }).returning({ id: sqliteVendorApiKeys.id });

      return {
        id: result[0].id,
        apiKey: fullKey,
        keyPrefix,
        name,
        vendorId,
      };
    } else {
      const db = await getMysqlDb();
      const result = await db.insert(mysqlVendorApiKeys).values({
        vendorId,
        keyHash,
        keyPrefix,
        name,
        permissions,
        expiresAt: expiresAt ?? null,
        createdBy,
        createdAt: getNow() as Date,
      });

      return {
        id: Number(result[0].insertId),
        apiKey: fullKey,
        keyPrefix,
        name,
        vendorId,
      };
    }
  }

  /**
   * Validate API key and return vendor info
   */
  async validateApiKey(apiKey: string): Promise<ValidatedVendor | null> {
    if (!apiKey || !apiKey.startsWith(KEY_PREFIX)) {
      return null;
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const usingSqlite = isSqlite();

    if (usingSqlite) {
      const db = getSqliteDb();
      const now = getNow() as string;

      const results = await db
        .select({
          keyId: sqliteVendorApiKeys.id,
          vendorId: sqliteVendorApiKeys.vendorId,
          permissions: sqliteVendorApiKeys.permissions,
          vendorCode: sqliteVendors.code,
          vendorName: sqliteVendors.name,
        })
        .from(sqliteVendorApiKeys)
        .innerJoin(sqliteVendors, eq(sqliteVendorApiKeys.vendorId, sqliteVendors.id))
        .where(
          and(
            eq(sqliteVendorApiKeys.keyHash, keyHash),
            eq(sqliteVendorApiKeys.isActive, true),
            eq(sqliteVendors.isActive, true),
            // Check expiration: allow if null OR not expired
            or(
              sql`${sqliteVendorApiKeys.expiresAt} IS NULL`,
              sql`${sqliteVendorApiKeys.expiresAt} > ${now}`
            )
          )
        )
        .limit(1);

      if (results.length === 0) return null;

      const key = results[0];

      // Update last used timestamp
      await db
        .update(sqliteVendorApiKeys)
        .set({ lastUsedAt: now })
        .where(eq(sqliteVendorApiKeys.id, key.keyId));

      return {
        keyId: key.keyId,
        vendorId: key.vendorId,
        vendorCode: key.vendorCode,
        vendorName: key.vendorName,
        permissions: key.permissions,
      };
    } else {
      const db = await getMysqlDb();

      const results = await db
        .select({
          keyId: mysqlVendorApiKeys.id,
          vendorId: mysqlVendorApiKeys.vendorId,
          permissions: mysqlVendorApiKeys.permissions,
          vendorCode: mysqlVendors.code,
          vendorName: mysqlVendors.name,
        })
        .from(mysqlVendorApiKeys)
        .innerJoin(mysqlVendors, eq(mysqlVendorApiKeys.vendorId, mysqlVendors.id))
        .where(
          and(
            eq(mysqlVendorApiKeys.keyHash, keyHash),
            eq(mysqlVendorApiKeys.isActive, true),
            eq(mysqlVendors.isActive, true),
            // Check expiration: allow if null OR not expired
            or(
              sql`${mysqlVendorApiKeys.expiresAt} IS NULL`,
              sql`${mysqlVendorApiKeys.expiresAt} > CURRENT_TIMESTAMP`
            )
          )
        )
        .limit(1);

      if (results.length === 0) return null;

      const key = results[0];

      // Update last used timestamp
      await db
        .update(mysqlVendorApiKeys)
        .set({ lastUsedAt: getNow() as Date })
        .where(eq(mysqlVendorApiKeys.id, key.keyId));

      return {
        keyId: key.keyId,
        vendorId: key.vendorId,
        vendorCode: key.vendorCode,
        vendorName: key.vendorName,
        permissions: key.permissions,
      };
    }
  }

  /**
   * Get vendor's TPP codes (products they supply)
   */
  async getVendorTppCodes(vendorId: number): Promise<string[]> {
    const usingSqlite = isSqlite();

    if (usingSqlite) {
      const db = getSqliteDb();
      // Get TPP codes from AVL entries for this vendor
      const results = await db
        .select({ tppCode: sqliteItems.tppCode })
        .from(sqliteApprovedVendorList)
        .innerJoin(sqliteItems, eq(sqliteApprovedVendorList.itemId, sqliteItems.id))
        .where(
          and(
            eq(sqliteApprovedVendorList.vendorId, vendorId),
            sql`${sqliteItems.tppCode} IS NOT NULL`
          )
        );

      return results.map(r => r.tppCode!).filter(Boolean);
    } else {
      const db = await getMysqlDb();
      const results = await db
        .select({ tppCode: mysqlItems.tppCode })
        .from(mysqlApprovedVendorList)
        .innerJoin(mysqlItems, eq(mysqlApprovedVendorList.itemId, mysqlItems.id))
        .where(
          and(
            eq(mysqlApprovedVendorList.vendorId, vendorId),
            sql`${mysqlItems.tppCode} IS NOT NULL`
          )
        );

      return results.map(r => r.tppCode!).filter(Boolean);
    }
  }

  /**
   * Get vendor's product codes (both TPP and TTMT) from AVL
   * Items may have TPP code, TTMT code, or both
   */
  async getVendorProductCodes(vendorId: number): Promise<VendorProductCodes> {
    const usingSqlite = isSqlite();

    if (usingSqlite) {
      const db = getSqliteDb();
      // Get both TPP and TTMT codes from AVL entries for this vendor
      const results = await db
        .select({
          tppCode: sqliteItems.tppCode,
          ttmtCode: sqliteItems.ttmtCode,
        })
        .from(sqliteApprovedVendorList)
        .innerJoin(sqliteItems, eq(sqliteApprovedVendorList.itemId, sqliteItems.id))
        .where(
          and(
            eq(sqliteApprovedVendorList.vendorId, vendorId),
            or(
              sql`${sqliteItems.tppCode} IS NOT NULL`,
              sql`${sqliteItems.ttmtCode} IS NOT NULL`
            )
          )
        );

      const tppCodes = results
        .map(r => r.tppCode)
        .filter((code): code is string => code !== null && code !== '');
      const ttmtCodes = results
        .map(r => r.ttmtCode)
        .filter((code): code is string => code !== null && code !== '');

      return {
        tppCodes: [...new Set(tppCodes)], // Remove duplicates
        ttmtCodes: [...new Set(ttmtCodes)],
      };
    } else {
      const db = await getMysqlDb();
      const results = await db
        .select({
          tppCode: mysqlItems.tppCode,
          ttmtCode: mysqlItems.ttmtCode,
        })
        .from(mysqlApprovedVendorList)
        .innerJoin(mysqlItems, eq(mysqlApprovedVendorList.itemId, mysqlItems.id))
        .where(
          and(
            eq(mysqlApprovedVendorList.vendorId, vendorId),
            or(
              sql`${mysqlItems.tppCode} IS NOT NULL`,
              sql`${mysqlItems.ttmtCode} IS NOT NULL`
            )
          )
        );

      const tppCodes = results
        .map(r => r.tppCode)
        .filter((code): code is string => code !== null && code !== '');
      const ttmtCodes = results
        .map(r => r.ttmtCode)
        .filter((code): code is string => code !== null && code !== '');

      return {
        tppCodes: [...new Set(tppCodes)],
        ttmtCodes: [...new Set(ttmtCodes)],
      };
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: number): Promise<void> {
    const usingSqlite = isSqlite();

    if (usingSqlite) {
      const db = getSqliteDb();
      await db
        .update(sqliteVendorApiKeys)
        .set({ isActive: false })
        .where(eq(sqliteVendorApiKeys.id, keyId));
    } else {
      const db = await getMysqlDb();
      await db
        .update(mysqlVendorApiKeys)
        .set({ isActive: false })
        .where(eq(mysqlVendorApiKeys.id, keyId));
    }
  }

  /**
   * List API keys for a vendor (without exposing hash)
   */
  async listApiKeys(vendorId: number): Promise<VendorApiKeyListItem[]> {
    const usingSqlite = isSqlite();

    if (usingSqlite) {
      const db = getSqliteDb();
      const results = await db
        .select({
          id: sqliteVendorApiKeys.id,
          keyPrefix: sqliteVendorApiKeys.keyPrefix,
          name: sqliteVendorApiKeys.name,
          permissions: sqliteVendorApiKeys.permissions,
          expiresAt: sqliteVendorApiKeys.expiresAt,
          lastUsedAt: sqliteVendorApiKeys.lastUsedAt,
          isActive: sqliteVendorApiKeys.isActive,
          createdAt: sqliteVendorApiKeys.createdAt,
        })
        .from(sqliteVendorApiKeys)
        .where(eq(sqliteVendorApiKeys.vendorId, vendorId));

      return results.map(r => ({
        id: r.id,
        keyPrefix: r.keyPrefix,
        name: r.name,
        permissions: r.permissions,
        expiresAt: r.expiresAt,
        lastUsedAt: r.lastUsedAt,
        isActive: Boolean(r.isActive),
        createdAt: r.createdAt,
      }));
    } else {
      const db = await getMysqlDb();
      const results = await db
        .select({
          id: mysqlVendorApiKeys.id,
          keyPrefix: mysqlVendorApiKeys.keyPrefix,
          name: mysqlVendorApiKeys.name,
          permissions: mysqlVendorApiKeys.permissions,
          expiresAt: mysqlVendorApiKeys.expiresAt,
          lastUsedAt: mysqlVendorApiKeys.lastUsedAt,
          isActive: mysqlVendorApiKeys.isActive,
          createdAt: mysqlVendorApiKeys.createdAt,
        })
        .from(mysqlVendorApiKeys)
        .where(eq(mysqlVendorApiKeys.vendorId, vendorId));

      return results.map(r => ({
        id: r.id,
        keyPrefix: r.keyPrefix,
        name: r.name,
        permissions: r.permissions,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
        isActive: Boolean(r.isActive),
        createdAt: r.createdAt.toISOString(),
      }));
    }
  }
}

export const vendorApiKeyService = new VendorApiKeyService();
