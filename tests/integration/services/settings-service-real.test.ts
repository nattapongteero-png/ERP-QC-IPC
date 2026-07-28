/**
 * Settings Service Real Integration Tests
 *
 * Tests the company settings service with a real SQLite database
 * to verify key-value upsert and retrieval.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    db: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import service functions after mocking
import {
  getCompanySettings,
  upsertCompanySettings,
  getInvoicePaymentTermsDays,
  setInvoicePaymentTermsDays,
} from '@/lib/services/settings.service';

// Schema Sync Helper
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
  columnType?: string;
  primary?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  hasDefault?: boolean;
  default?: unknown;
  isUnique?: boolean;
}

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;

    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        if (col.columnType === 'SQLiteReal') {
          def += 'REAL';
        } else {
          def += 'INTEGER';
        }
        break;
      case 'boolean':
        def += 'INTEGER';
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

    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = typeof col.default === 'string'
        ? `'${col.default}'`
        : col.default;
      def += ` DEFAULT ${defaultVal}`;
    }

    if (col.isUnique && !col.primary) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}

describe('Settings Service Real Integration Tests', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

    // Create the settings table
    const createSql = generateCreateTableSql(schema.sqliteSettings);
    sqlite.prepare(createSql).run();
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.prepare('DELETE FROM settings').run();
  });

  describe('invoice payment terms (list item 3)', () => {
    it('defaults to 30 days when unset', async () => {
      expect(await getInvoicePaymentTermsDays()).toBe(30);
    });

    it('persists a configured value and reads it back', async () => {
      await setInvoicePaymentTermsDays(45, 1);
      expect(await getInvoicePaymentTermsDays()).toBe(45);
    });

    it('updates an existing value rather than duplicating', async () => {
      await setInvoicePaymentTermsDays(15, 1);
      await setInvoicePaymentTermsDays(60, 1);
      expect(await getInvoicePaymentTermsDays()).toBe(60);
      const rows = sqlite
        .prepare("SELECT COUNT(*) AS n FROM settings WHERE key = 'invoice_payment_terms_days'")
        .get() as { n: number };
      expect(rows.n).toBe(1);
    });
  });

  describe('getCompanySettings', () => {
    it('should return defaults when settings table is empty', async () => {
      const settings = await getCompanySettings();

      expect(settings.companyName).toBe('');
      expect(settings.companyNameTh).toBe('');
      expect(settings.lotPrefix).toBe('LOT');
      expect(settings.poPrefix).toBe('PO');
      expect(settings.soPrefix).toBe('SO');
      expect(settings.woPrefix).toBe('WO');
    });

    it('should return saved values merged with defaults', async () => {
      // Insert some values directly
      sqlite.prepare(`INSERT INTO settings ("key", "value", "category", "created_at", "updated_at") VALUES ('companyName', 'Test Co', 'company', '2024-01-01', '2024-01-01')`).run();
      sqlite.prepare(`INSERT INTO settings ("key", "value", "category", "created_at", "updated_at") VALUES ('taxId', '1234567890123', 'regulatory', '2024-01-01', '2024-01-01')`).run();

      const settings = await getCompanySettings();

      expect(settings.companyName).toBe('Test Co');
      expect(settings.taxId).toBe('1234567890123');
      // Defaults should still be present for unsaved keys
      expect(settings.lotPrefix).toBe('LOT');
      expect(settings.address).toBe('');
    });
  });

  describe('upsertCompanySettings', () => {
    it('should insert new settings', async () => {
      await upsertCompanySettings({
        companyName: 'Herbal Co',
        companyNameTh: 'สมุนไพร',
        taxId: '9999999999999',
      });

      const settings = await getCompanySettings();
      expect(settings.companyName).toBe('Herbal Co');
      expect(settings.companyNameTh).toBe('สมุนไพร');
      expect(settings.taxId).toBe('9999999999999');
    });

    it('should update existing settings', async () => {
      // Insert first
      await upsertCompanySettings({ companyName: 'Old Name' });

      // Update
      await upsertCompanySettings({ companyName: 'New Name' });

      const settings = await getCompanySettings();
      expect(settings.companyName).toBe('New Name');
    });

    it('should handle partial updates without affecting other keys', async () => {
      // Save initial values
      await upsertCompanySettings({
        companyName: 'My Company',
        email: 'info@test.com',
        lotPrefix: 'L',
      });

      // Update only one key
      await upsertCompanySettings({ email: 'new@test.com' });

      const settings = await getCompanySettings();
      expect(settings.companyName).toBe('My Company');
      expect(settings.email).toBe('new@test.com');
      expect(settings.lotPrefix).toBe('L');
    });

    it('should save userId as updatedBy', async () => {
      await upsertCompanySettings({ companyName: 'Test' }, 42);

      const row = sqlite.prepare('SELECT updated_by FROM settings WHERE key = ?').get('companyName') as { updated_by: number };
      expect(row.updated_by).toBe(42);
    });

    it('should save all 13 company setting fields', async () => {
      const fullSettings = {
        companyName: 'Full Co',
        companyNameTh: 'บริษัทเต็ม',
        address: '123 Test St',
        phone: '02-000-0000',
        email: 'full@test.com',
        taxId: '0000000000000',
        // Printed on the tax invoice as สาขาที่ 00001 (blank = สำนักงานใหญ่).
        branch: '00001',
        fdaLicense: 'FDA-000',
        gmpCertificate: 'GMP-000',
        lotPrefix: 'LT',
        poPrefix: 'PUR',
        soPrefix: 'SLS',
        woPrefix: 'WRK',
      };

      await upsertCompanySettings(fullSettings);
      const settings = await getCompanySettings();

      expect(settings).toEqual(fullSettings);
    });
  });
});
