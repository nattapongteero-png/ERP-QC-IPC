import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Inventory API', () => {
  let sqliteDb: ReturnType<typeof Database>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    // Create in-memory SQLite database
    sqliteDb = new Database(':memory:');
    db = drizzle(sqliteDb, { schema });

    // Create tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name_th TEXT NOT NULL,
        name_en TEXT,
        type TEXT NOT NULL,
        category TEXT,
        primary_unit TEXT NOT NULL,
        secondary_unit TEXT,
        conversion_rate REAL DEFAULT 1,
        shelf_life_days INTEGER,
        storage_condition TEXT,
        min_stock REAL DEFAULT 0,
        max_stock REAL,
        reorder_point REAL DEFAULT 0,
        on_hand REAL NOT NULL DEFAULT 0,
        on_hand_cost REAL NOT NULL DEFAULT 0,
        is_lot_controlled INTEGER DEFAULT 1,
        is_fefo INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        tpp_code TEXT,
        ttmt_code TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        location TEXT,
        temperature_min REAL,
        temperature_max REAL,
        humidity_min REAL,
        humidity_max REAL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inventory_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        lot_number TEXT NOT NULL,
        batch_number TEXT,
        warehouse_id INTEGER NOT NULL,
        location_id INTEGER,
        quantity REAL NOT NULL DEFAULT 0,
        reserved_quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'quarantine',
        manufacturing_date TEXT,
        expiry_date TEXT,
        received_date TEXT,
        vendor_id INTEGER,
        po_number TEXT,
        coa_number TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      );
    `);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  beforeEach(() => {
    // Clear tables before each test
    sqliteDb.exec('DELETE FROM inventory_lots');
    sqliteDb.exec('DELETE FROM items');
    sqliteDb.exec('DELETE FROM warehouses');
  });

  describe('Inventory Lots', () => {
    let itemId: number;
    let warehouseId: number;

    beforeEach(() => {
      // Create test item
      const itemResult = db.insert(schema.sqliteItems).values({
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        type: 'raw_material',
        primaryUnit: 'kg',
      }).run();
      itemId = Number(itemResult.lastInsertRowid);

      // Create test warehouse
      const warehouseResult = db.insert(schema.sqliteWarehouses).values({
        code: 'WH-001',
        name: 'Main Warehouse',
        type: 'raw_material',
      }).run();
      warehouseId = Number(warehouseResult.lastInsertRowid);
    });

    it('should create a new lot', async () => {
      const result = db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-001',
        batchNumber: 'BATCH-001',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'quarantine',
      }).run();

      expect(result.changes).toBe(1);

      const lots = db.select().from(schema.sqliteInventoryLots).all();
      expect(lots).toHaveLength(1);
      expect(lots[0].lotNumber).toBe('LOT-2024-001');
      expect(lots[0].quantity).toBe(100);
      expect(lots[0].status).toBe('quarantine');
    });

    it('should update lot status from quarantine to released', async () => {
      // Create lot in quarantine
      db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-001',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'quarantine',
      }).run();

      const lot = db.select().from(schema.sqliteInventoryLots).get();

      // Release the lot
      db.update(schema.sqliteInventoryLots)
        .set({ status: 'released' })
        .where(eq(schema.sqliteInventoryLots.id, lot!.id))
        .run();

      const updatedLot = db.select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.id, lot!.id))
        .get();

      expect(updatedLot?.status).toBe('released');
    });

    it('should reject lot', async () => {
      // Create lot in quarantine
      db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-001',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'quarantine',
      }).run();

      const lot = db.select().from(schema.sqliteInventoryLots).get();

      // Reject the lot
      db.update(schema.sqliteInventoryLots)
        .set({ status: 'rejected' })
        .where(eq(schema.sqliteInventoryLots.id, lot!.id))
        .run();

      const updatedLot = db.select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.id, lot!.id))
        .get();

      expect(updatedLot?.status).toBe('rejected');
    });

    it('should calculate available quantity (quantity - reserved)', async () => {
      db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-001',
        itemId,
        warehouseId,
        quantity: 100,
        reservedQuantity: 30,
        unit: 'kg',
        status: 'released',
      }).run();

      const lot = db.select().from(schema.sqliteInventoryLots).get();
      const availableQuantity = (lot?.quantity || 0) - (lot?.reservedQuantity || 0);

      expect(availableQuantity).toBe(70);
    });

    it('should track FEFO (First Expiry First Out)', async () => {
      // Create lots with different expiry dates
      db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-001',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'released',
        expiryDate: '2025-06-01',
      }).run();

      db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-002',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'released',
        expiryDate: '2025-03-01',
      }).run();

      db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-003',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'released',
        expiryDate: '2025-09-01',
      }).run();

      // Get lots ordered by expiry date (FEFO)
      const lots = sqliteDb.prepare(`
        SELECT * FROM inventory_lots 
        WHERE status = 'released' 
        ORDER BY expiry_date ASC
      `).all() as any[];

      expect(lots[0].lot_number).toBe('LOT-2024-002'); // Earliest expiry
      expect(lots[1].lot_number).toBe('LOT-2024-001');
      expect(lots[2].lot_number).toBe('LOT-2024-003'); // Latest expiry
    });
  });

  describe('Inventory Transactions', () => {
    let itemId: number;
    let warehouseId: number;
    let lotId: number;

    beforeEach(() => {
      // Create test item
      const itemResult = db.insert(schema.sqliteItems).values({
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        type: 'raw_material',
        primaryUnit: 'kg',
      }).run();
      itemId = Number(itemResult.lastInsertRowid);

      // Create test warehouse
      const warehouseResult = db.insert(schema.sqliteWarehouses).values({
        code: 'WH-001',
        name: 'Main Warehouse',
        type: 'raw_material',
      }).run();
      warehouseId = Number(warehouseResult.lastInsertRowid);

      // Create test lot
      const lotResult = db.insert(schema.sqliteInventoryLots).values({
        lotNumber: 'LOT-2024-001',
        itemId,
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'released',
      }).run();
      lotId = Number(lotResult.lastInsertRowid);
    });

    it('should decrease quantity on issue', async () => {
      const issueQty = 30;
      const lot = db.select().from(schema.sqliteInventoryLots).get();
      const originalQty = lot?.quantity || 0;

      // Issue stock
      db.update(schema.sqliteInventoryLots)
        .set({ quantity: originalQty - issueQty })
        .where(eq(schema.sqliteInventoryLots.id, lotId))
        .run();

      const updatedLot = db.select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.id, lotId))
        .get();

      expect(updatedLot?.quantity).toBe(70);
    });

    it('should increase quantity on receipt', async () => {
      const receiptQty = 50;
      const lot = db.select().from(schema.sqliteInventoryLots).get();
      const originalQty = lot?.quantity || 0;

      // Receive stock
      db.update(schema.sqliteInventoryLots)
        .set({ quantity: originalQty + receiptQty })
        .where(eq(schema.sqliteInventoryLots.id, lotId))
        .run();

      const updatedLot = db.select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.id, lotId))
        .get();

      expect(updatedLot?.quantity).toBe(150);
    });
  });
});
