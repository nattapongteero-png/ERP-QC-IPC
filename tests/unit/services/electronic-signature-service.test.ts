/**
 * Electronic Signature Service Unit Tests
 *
 * Tests 21 CFR Part 11 compliant electronic signature functionality
 * with an in-memory SQLite database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';
import bcrypt from 'bcryptjs';

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Import service after mocking
import {
  createElectronicSignature,
  getSignaturesForEntity,
  verifySignatureIntegrity,
  getSignatureById,
} from '@/lib/services/electronic-signature-service';

// Helper function to generate CREATE TABLE SQL from Drizzle schema
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
    const col = column as {
      name: string;
      dataType: string;
      primary?: boolean;
      autoIncrement?: boolean;
      notNull?: boolean;
    };
    let def = `"${col.name}" `;

    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        def += 'INTEGER';
        break;
      case 'boolean':
        def += 'INTEGER';
        break;
      case 'buffer':
        def += 'BLOB';
        break;
      default:
        def += 'TEXT';
    }

    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) {
        def += ' AUTOINCREMENT';
      }
    }

    if (col.notNull && !col.primary) {
      def += ' NOT NULL';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}

describe('Electronic Signature Service', () => {
  let testUserId: number;
  const testPassword = 'TestPassword123';
  const hashedPassword = bcrypt.hashSync(testPassword, 10);

  beforeAll(() => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite, { schema });

    // Create required tables
    const tables = [
      schema.sqliteUsers,
      schema.sqliteElectronicSignatures,
    ];

    for (const table of tables) {
      const sql = generateCreateTableSql(table);
      sqlite.exec(sql);
    }
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // Clear data before each test
    sqlite.exec('DELETE FROM electronic_signatures');
    sqlite.exec('DELETE FROM users');

    // Create a test user
    const result = sqlite.prepare(`
      INSERT INTO users (email, password, name, role, department, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `test-sig-${Date.now()}@example.com`,
      hashedPassword,
      'Test User',
      'qc',
      'Quality Control',
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );

    testUserId = Number(result.lastInsertRowid);
  });

  describe('createElectronicSignature', () => {
    it('should create signature with valid password', async () => {
      const result = await createElectronicSignature({
        entityType: 'line_clearance',
        entityId: 1,
        action: 'perform',
        userId: testUserId,
        password: testPassword,
        meaning: 'I verify the line clearance is complete',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      expect(result.success).toBe(true);
      expect(result.signatureId).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.signature?.meaning).toBe('I verify the line clearance is complete');
      expect(result.signature?.passwordVerified).toBe(true);
      expect(result.signature?.signatureHash).toBeDefined();
      expect(result.signature?.signatureHash.length).toBe(64); // SHA-256 hex
    });

    it('should fail with invalid password', async () => {
      const result = await createElectronicSignature({
        entityType: 'line_clearance',
        entityId: 1,
        action: 'perform',
        userId: testUserId,
        password: 'WrongPassword',
        meaning: 'I verify the line clearance is complete',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid password');
      expect(result.signatureId).toBeUndefined();
    });

    it('should fail with non-existent user', async () => {
      const result = await createElectronicSignature({
        entityType: 'line_clearance',
        entityId: 1,
        action: 'perform',
        userId: 999999,
        password: testPassword,
        meaning: 'I verify the line clearance is complete',
      });

      expect(result.success).toBe(false);
      expect(result.signatureId).toBeUndefined();
    });

    it('should capture user details in signature', async () => {
      const result = await createElectronicSignature({
        entityType: 'label_verification',
        entityId: 2,
        action: 'witness',
        userId: testUserId,
        password: testPassword,
        meaning: 'I witness this label verification',
      });

      expect(result.success).toBe(true);
      expect(result.signature?.fullName).toBe('Test User');
      expect(result.signature?.title).toContain('Quality Control');
    });
  });

  describe('getSignaturesForEntity', () => {
    it('should retrieve signatures for an entity', async () => {
      // Create multiple signatures
      await createElectronicSignature({
        entityType: 'disposition',
        entityId: 5,
        action: 'set',
        userId: testUserId,
        password: testPassword,
        meaning: 'I set the disposition to accept',
      });

      await createElectronicSignature({
        entityType: 'disposition',
        entityId: 5,
        action: 'approve',
        userId: testUserId,
        password: testPassword,
        meaning: 'I approve this disposition decision',
      });

      const signatures = await getSignaturesForEntity('disposition', 5);

      expect(signatures.length).toBe(2);
      expect(signatures.some((s) => s.action === 'set')).toBe(true);
      expect(signatures.some((s) => s.action === 'approve')).toBe(true);
    });

    it('should return empty array for entity without signatures', async () => {
      const signatures = await getSignaturesForEntity('nonexistent', 99999);
      expect(signatures).toEqual([]);
    });
  });

  describe('verifySignatureIntegrity', () => {
    it('should verify valid signature', async () => {
      const createResult = await createElectronicSignature({
        entityType: 'line_clearance',
        entityId: 10,
        action: 'verify',
        userId: testUserId,
        password: testPassword,
        meaning: 'I verify this is correct',
      });

      expect(createResult.success).toBe(true);
      expect(createResult.signatureId).toBeDefined();

      const verifyResult = await verifySignatureIntegrity(createResult.signatureId!);
      expect(verifyResult.valid).toBe(true);
    });

    it('should fail for non-existent signature', async () => {
      const result = await verifySignatureIntegrity(99999);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Signature not found');
    });
  });

  describe('getSignatureById', () => {
    it('should retrieve signature by ID', async () => {
      const createResult = await createElectronicSignature({
        entityType: 'qc_release',
        entityId: 15,
        action: 'release',
        userId: testUserId,
        password: testPassword,
        meaning: 'I release this batch for distribution',
      });

      expect(createResult.success).toBe(true);

      const signature = await getSignatureById(createResult.signatureId!);
      expect(signature).toBeDefined();
      expect(signature?.entityType).toBe('qc_release');
      expect(signature?.action).toBe('release');
      expect(signature?.meaning).toBe('I release this batch for distribution');
    });

    it('should return null for non-existent signature', async () => {
      const signature = await getSignatureById(99999);
      expect(signature).toBeNull();
    });
  });
});
