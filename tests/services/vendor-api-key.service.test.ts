/**
 * Vendor API Key Service Tests
 * Tests for API key creation, validation, and product code retrieval (TPP/TTMT)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeDatabase, getSqliteDb, schema } from '../../src/lib/db';
import { vendorApiKeyService } from '../../src/lib/services/vendor-api-key.service';
import { eq } from 'drizzle-orm';

describe('VendorApiKeyService', () => {
  let db: ReturnType<typeof getSqliteDb>;
  let testVendorId: number;
  let testUserId: number;
  let testItemWithTpp: number;
  let testItemWithTtmt: number;
  let testItemWithBoth: number;

  beforeAll(async () => {
    db = await initializeDatabase() as ReturnType<typeof getSqliteDb>;

    // Create test user
    const userResult = await db.insert(schema.sqliteUsers).values({
      name: 'Test VMI User',
      password: 'test-hash',
      email: 'test-vmi@example.com',
      role: 'admin',
      isActive: true,
    }).returning({ id: schema.sqliteUsers.id });
    testUserId = userResult[0].id;

    // Create test vendor
    const vendorResult = await db.insert(schema.sqliteVendors).values({
      code: 'TEST-VMI-VENDOR',
      name: 'Test VMI Vendor',
      isActive: true,
    }).returning({ id: schema.sqliteVendors.id });
    testVendorId = vendorResult[0].id;

    // Create test items with TPP code, TTMT code, and both
    const itemWithTppResult = await db.insert(schema.sqliteItems).values({
      code: 'TEST-ITEM-TPP',
      nameTh: 'Test Item with TPP',
      type: 'raw_material',
      primaryUnit: 'kg',
      tppCode: '1234567890123', // TPP code only
      ttmtCode: null,
    }).returning({ id: schema.sqliteItems.id });
    testItemWithTpp = itemWithTppResult[0].id;

    const itemWithTtmtResult = await db.insert(schema.sqliteItems).values({
      code: 'TEST-ITEM-TTMT',
      nameTh: 'Test Item with TTMT',
      type: 'raw_material',
      primaryUnit: 'kg',
      tppCode: null,
      ttmtCode: 'A12345678', // TTMT code only
    }).returning({ id: schema.sqliteItems.id });
    testItemWithTtmt = itemWithTtmtResult[0].id;

    const itemWithBothResult = await db.insert(schema.sqliteItems).values({
      code: 'TEST-ITEM-BOTH',
      nameTh: 'Test Item with Both Codes',
      type: 'raw_material',
      primaryUnit: 'kg',
      tppCode: '9876543210987', // Both TPP and TTMT
      ttmtCode: 'A99999999',
    }).returning({ id: schema.sqliteItems.id });
    testItemWithBoth = itemWithBothResult[0].id;

    // Add items to AVL for this vendor
    await db.insert(schema.sqliteApprovedVendorList).values({
      vendorId: testVendorId,
      itemId: testItemWithTpp,
      isPreferred: true,
    });
    await db.insert(schema.sqliteApprovedVendorList).values({
      vendorId: testVendorId,
      itemId: testItemWithTtmt,
      isPreferred: false,
    });
    await db.insert(schema.sqliteApprovedVendorList).values({
      vendorId: testVendorId,
      itemId: testItemWithBoth,
      isPreferred: false,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.sqliteApprovedVendorList).where(eq(schema.sqliteApprovedVendorList.vendorId, testVendorId));
    await db.delete(schema.sqliteVendorApiKeys).where(eq(schema.sqliteVendorApiKeys.vendorId, testVendorId));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, testItemWithTpp));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, testItemWithTtmt));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, testItemWithBoth));
    await db.delete(schema.sqliteVendors).where(eq(schema.sqliteVendors.id, testVendorId));
    await db.delete(schema.sqliteUsers).where(eq(schema.sqliteUsers.id, testUserId));
  });

  it('creates API key with correct prefix', async () => {
    const result = await vendorApiKeyService.createApiKey(testVendorId, 'Test Key', testUserId);
    expect(result.apiKey).toMatch(/^vmi_erp_/);
    expect(result.keyPrefix).toHaveLength(16);
    expect(result.keyPrefix).toBe(result.apiKey.substring(0, 16));
    expect(result.vendorId).toBe(testVendorId);
    expect(result.name).toBe('Test Key');
  });

  it('validates correct API key', async () => {
    const created = await vendorApiKeyService.createApiKey(testVendorId, 'Test Key for Validation', testUserId);
    const validated = await vendorApiKeyService.validateApiKey(created.apiKey);
    
    expect(validated).not.toBeNull();
    expect(validated?.vendorId).toBe(testVendorId);
    expect(validated?.vendorCode).toBe('TEST-VMI-VENDOR');
    expect(validated?.vendorName).toBe('Test VMI Vendor');
    expect(validated?.permissions).toBe('read');
  });

  it('rejects invalid API key', async () => {
    const validated = await vendorApiKeyService.validateApiKey('invalid_key');
    expect(validated).toBeNull();
  });

  it('rejects API key without correct prefix', async () => {
    const validated = await vendorApiKeyService.validateApiKey('wrong_prefix_1234567890abcdef');
    expect(validated).toBeNull();
  });

  it('returns both TPP and TTMT codes for vendor', async () => {
    const codes = await vendorApiKeyService.getVendorProductCodes(testVendorId);
    
    expect(codes).toHaveProperty('tppCodes');
    expect(codes).toHaveProperty('ttmtCodes');
    expect(Array.isArray(codes.tppCodes)).toBe(true);
    expect(Array.isArray(codes.ttmtCodes)).toBe(true);
    
    // Should have 2 TPP codes (one from TPP-only item, one from both-codes item)
    expect(codes.tppCodes).toContain('1234567890123');
    expect(codes.tppCodes).toContain('9876543210987');
    expect(codes.tppCodes.length).toBe(2);
    
    // Should have 2 TTMT codes (one from TTMT-only item, one from both-codes item)
    expect(codes.ttmtCodes).toContain('A12345678');
    expect(codes.ttmtCodes).toContain('A99999999');
    expect(codes.ttmtCodes.length).toBe(2);
  });

  it('lists API keys for a vendor', async () => {
    await vendorApiKeyService.createApiKey(testVendorId, 'Key 1', testUserId);
    await vendorApiKeyService.createApiKey(testVendorId, 'Key 2', testUserId);
    
    const keys = await vendorApiKeyService.listApiKeys(testVendorId);
    
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys.every(k => k.keyPrefix.startsWith('vmi_erp_'))).toBe(true);
    expect(keys.every(k => !('keyHash' in k))).toBe(true); // Should not expose hash
  });

  it('revokes an API key', async () => {
    const created = await vendorApiKeyService.createApiKey(testVendorId, 'Key to Revoke', testUserId);
    
    // Verify it works before revocation
    let validated = await vendorApiKeyService.validateApiKey(created.apiKey);
    expect(validated).not.toBeNull();
    
    // Revoke the key
    await vendorApiKeyService.revokeApiKey(created.id);
    
    // Verify it no longer works
    validated = await vendorApiKeyService.validateApiKey(created.apiKey);
    expect(validated).toBeNull();
  });

  it('updates lastUsedAt when validating API key', async () => {
    const created = await vendorApiKeyService.createApiKey(testVendorId, 'Key for Usage Test', testUserId);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Validate the key
    await vendorApiKeyService.validateApiKey(created.apiKey);
    
    // Check that lastUsedAt was updated
    const keys = await vendorApiKeyService.listApiKeys(testVendorId);
    const usedKey = keys.find(k => k.id === created.id);
    
    expect(usedKey).toBeDefined();
    expect(usedKey?.lastUsedAt).not.toBeNull();
  });
});
