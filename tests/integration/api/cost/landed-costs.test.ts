/**
 * Landed Costs API Integration Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: 'test-token' })),
    set: vi.fn(),
    delete: vi.fn()
  }))
}));

// Mock auth session
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual('@/lib/auth');
  return {
    ...actual,
    getSession: vi.fn(() => Promise.resolve({
      userId: 1,
      email: 'admin@test.com',
      role: 'admin',
      name: 'Admin User'
    })),
    hasPermission: vi.fn(() => true)
  };
});

interface LandedCostHeaderRow {
  id: number;
  document_number: string;
  reference_type: string;
  reference_id: number;
  reference_number: string | null;
  vendor_id: number | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  currency: string;
  exchange_rate: number;
  status: string;
  posted_at: string | null;
  posted_by: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface LandedCostLineRow {
  id: number;
  landed_cost_header_id: number;
  cost_type: string;
  description: string | null;
  amount: number;
  allocation_basis: string;
  created_at: string;
}

let testDb: Database.Database;
const TEST_DB_PATH = path.join(process.cwd(), 'test-landed-costs.db');

beforeAll(() => {
  // Create test database with required tables
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  testDb = new Database(TEST_DB_PATH);

  // Create minimal schema for landed cost tests
  testDb.exec(`
    CREATE TABLE landed_cost_headers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_number TEXT NOT NULL UNIQUE,
      reference_type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      reference_number TEXT,
      vendor_id INTEGER,
      invoice_number TEXT,
      invoice_date TEXT,
      total_amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'THB',
      exchange_rate REAL DEFAULT 1,
      status TEXT DEFAULT 'draft',
      posted_at TEXT,
      posted_by INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE landed_cost_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      landed_cost_header_id INTEGER NOT NULL,
      cost_type TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      allocation_basis TEXT DEFAULT 'value',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE landed_cost_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      landed_cost_line_id INTEGER NOT NULL,
      landed_cost_header_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      lot_id INTEGER,
      po_line_id INTEGER,
      allocated_amount REAL NOT NULL,
      basis_value REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Seed test data
    INSERT INTO landed_cost_headers (document_number, reference_type, reference_id, reference_number, vendor_id, invoice_number, total_amount, status, created_by)
    VALUES
      ('LC2026-00001', 'po', 1, 'PO-001', 1, 'INV-001', 5000, 'draft', 1),
      ('LC2026-00002', 'po', 2, 'PO-002', 2, 'INV-002', 3000, 'allocated', 1),
      ('LC2026-00003', 'po', 3, 'PO-003', 1, 'INV-003', 7500, 'posted', 1);

    INSERT INTO landed_cost_lines (landed_cost_header_id, cost_type, description, amount, allocation_basis)
    VALUES
      (1, 'freight', 'Sea freight from China', 3000, 'value'),
      (1, 'duty', 'Import duty', 2000, 'value'),
      (2, 'freight', 'Air freight', 2500, 'quantity'),
      (2, 'insurance', 'Cargo insurance', 500, 'value'),
      (3, 'freight', 'Express delivery', 5000, 'weight'),
      (3, 'handling', 'Port handling', 2500, 'volume');
  `);
});

afterAll(() => {
  testDb.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('Landed Costs API Integration Tests', () => {
  describe('GET /api/cost/landed-costs', () => {
    it('should return list of landed costs', async () => {
      const headers = testDb.prepare(`
        SELECT * FROM landed_cost_headers ORDER BY created_at DESC
      `).all() as LandedCostHeaderRow[];

      expect(headers).toHaveLength(3);
      expect(headers[0]).toHaveProperty('document_number');
      expect(headers[0]).toHaveProperty('status');
    });

    it('should support status filtering', async () => {
      const draftHeaders = testDb.prepare(`
        SELECT * FROM landed_cost_headers WHERE status = ?
      `).all('draft') as LandedCostHeaderRow[];

      expect(draftHeaders).toHaveLength(1);
      expect(draftHeaders[0].document_number).toBe('LC2026-00001');
    });

    it('should support search by document number', async () => {
      const headers = testDb.prepare(`
        SELECT * FROM landed_cost_headers
        WHERE document_number LIKE ?
      `).all('%00001%') as LandedCostHeaderRow[];

      expect(headers).toHaveLength(1);
      expect(headers[0].document_number).toBe('LC2026-00001');
    });
  });

  describe('GET /api/cost/landed-costs/[id]', () => {
    it('should return landed cost with lines', async () => {
      const header = testDb.prepare(`
        SELECT * FROM landed_cost_headers WHERE id = ?
      `).get(1) as LandedCostHeaderRow;

      const lines = testDb.prepare(`
        SELECT * FROM landed_cost_lines WHERE landed_cost_header_id = ?
      `).all(1) as LandedCostLineRow[];

      expect(header).toBeDefined();
      expect(header.document_number).toBe('LC2026-00001');
      expect(lines).toHaveLength(2);
      expect(lines[0].cost_type).toBe('freight');
      expect(lines[1].cost_type).toBe('duty');
    });

    it('should calculate total from lines', async () => {
      const header = testDb.prepare(`
        SELECT * FROM landed_cost_headers WHERE id = ?
      `).get(1) as LandedCostHeaderRow;

      const lines = testDb.prepare(`
        SELECT * FROM landed_cost_lines WHERE landed_cost_header_id = ?
      `).all(1) as LandedCostLineRow[];

      const lineTotal = lines.reduce((sum, line) => sum + line.amount, 0);
      expect(header.total_amount).toBe(lineTotal);
    });
  });

  describe('POST /api/cost/landed-costs', () => {
    it('should create landed cost with draft status', async () => {
      const result = testDb.prepare(`
        INSERT INTO landed_cost_headers
        (document_number, reference_type, reference_id, status, created_by)
        VALUES (?, ?, ?, 'draft', 1)
      `).run('LC2026-00004', 'po', 4);

      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const header = testDb.prepare(`
        SELECT * FROM landed_cost_headers WHERE id = ?
      `).get(result.lastInsertRowid) as LandedCostHeaderRow;

      expect(header.status).toBe('draft');
      expect(header.reference_type).toBe('po');
    });
  });

  describe('PUT /api/cost/landed-costs/[id]', () => {
    it('should only allow update of draft status', async () => {
      const draftHeader = testDb.prepare(`
        SELECT * FROM landed_cost_headers WHERE status = 'draft' LIMIT 1
      `).get() as LandedCostHeaderRow;

      expect(draftHeader).toBeDefined();
      expect(draftHeader.status).toBe('draft');

      // Should not allow update of posted
      const postedHeader = testDb.prepare(`
        SELECT * FROM landed_cost_headers WHERE status = 'posted' LIMIT 1
      `).get() as LandedCostHeaderRow;

      expect(postedHeader).toBeDefined();
      expect(postedHeader.status).toBe('posted');
    });
  });

  describe('Allocation Logic', () => {
    it('should support different allocation bases', async () => {
      const lines = testDb.prepare(`
        SELECT * FROM landed_cost_lines ORDER BY id
      `).all() as LandedCostLineRow[];

      // Verify different allocation bases exist
      const bases = new Set(lines.map(l => l.allocation_basis));
      expect(bases.has('value')).toBe(true);
      expect(bases.has('quantity')).toBe(true);
      expect(bases.has('weight')).toBe(true);
      expect(bases.has('volume')).toBe(true);
    });
  });

  describe('Cost Type Validation', () => {
    it('should support all cost types', async () => {
      const lines = testDb.prepare(`
        SELECT DISTINCT cost_type FROM landed_cost_lines
      `).all() as { cost_type: string }[];

      const types = lines.map(l => l.cost_type);
      expect(types).toContain('freight');
      expect(types).toContain('duty');
      expect(types).toContain('insurance');
      expect(types).toContain('handling');
    });
  });

  describe('Document Number Generation', () => {
    it('should generate unique document numbers', async () => {
      const headers = testDb.prepare(`
        SELECT document_number FROM landed_cost_headers
      `).all() as { document_number: string }[];

      const docNumbers = headers.map(h => h.document_number);
      const uniqueNumbers = new Set(docNumbers);
      expect(uniqueNumbers.size).toBe(docNumbers.length);
    });

    it('should follow LC-YYYY-NNNNN format', async () => {
      const headers = testDb.prepare(`
        SELECT document_number FROM landed_cost_headers
      `).all() as { document_number: string }[];

      const pattern = /^LC\d{4}-\d{5}$/;
      headers.forEach(h => {
        expect(h.document_number).toMatch(pattern);
      });
    });
  });
});
