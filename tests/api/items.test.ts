import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Items API', () => {
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  beforeEach(() => {
    // Clear items table before each test
    sqliteDb.exec('DELETE FROM items');
  });

  describe('Create Item', () => {
    it('should create a new item with required fields', async () => {
      const itemData = {
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        nameEn: 'Turmeric',
        type: 'raw_material',
        category: 'Herbal',
        primaryUnit: 'kg',
      };

      const result = db.insert(schema.sqliteItems).values({
        code: itemData.code,
        nameTh: itemData.nameTh,
        nameEn: itemData.nameEn,
        type: itemData.type,
        category: itemData.category,
        primaryUnit: itemData.primaryUnit,
      }).run();

      expect(result.changes).toBe(1);

      // Verify the item was created
      const items = db.select().from(schema.sqliteItems).all();
      expect(items).toHaveLength(1);
      expect(items[0].code).toBe('RM-001');
      expect(items[0].nameTh).toBe('ขมิ้นชัน');
    });

    it('should not create item with duplicate code', async () => {
      // Create first item
      db.insert(schema.sqliteItems).values({
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        type: 'raw_material',
        primaryUnit: 'kg',
      }).run();

      // Try to create duplicate
      expect(() => {
        db.insert(schema.sqliteItems).values({
          code: 'RM-001',
          nameTh: 'ขิง',
          type: 'raw_material',
          primaryUnit: 'kg',
        }).run();
      }).toThrow();
    });
  });

  describe('Read Items', () => {
    beforeEach(() => {
      // Seed test data
      const items = [
        { code: 'RM-001', nameTh: 'ขมิ้นชัน', nameEn: 'Turmeric', type: 'raw_material', primaryUnit: 'kg' },
        { code: 'RM-002', nameTh: 'ขิง', nameEn: 'Ginger', type: 'raw_material', primaryUnit: 'kg' },
        { code: 'FG-001', nameTh: 'แคปซูลขมิ้นชัน', nameEn: 'Turmeric Capsule', type: 'finished_product', primaryUnit: 'bottle' },
      ];

      for (const item of items) {
        db.insert(schema.sqliteItems).values(item).run();
      }
    });

    it('should list all items', async () => {
      const items = db.select().from(schema.sqliteItems).all();
      expect(items).toHaveLength(3);
    });

    it('should filter items by type', async () => {
      const items = db.select()
        .from(schema.sqliteItems)
        .where(eq(schema.sqliteItems.type, 'raw_material'))
        .all();
      
      expect(items).toHaveLength(2);
      expect(items.every(i => i.type === 'raw_material')).toBe(true);
    });

    it('should get item by id', async () => {
      const allItems = db.select().from(schema.sqliteItems).all();
      const firstItem = allItems[0];

      const item = db.select()
        .from(schema.sqliteItems)
        .where(eq(schema.sqliteItems.id, firstItem.id))
        .get();

      expect(item).toBeDefined();
      expect(item?.code).toBe('RM-001');
    });
  });

  describe('Update Item', () => {
    it('should update item fields', async () => {
      // Create item
      db.insert(schema.sqliteItems).values({
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        type: 'raw_material',
        primaryUnit: 'kg',
      }).run();

      const item = db.select().from(schema.sqliteItems).get();

      // Update item
      db.update(schema.sqliteItems)
        .set({ nameTh: 'ขมิ้นชัน (ปรับปรุง)', category: 'Herbal' })
        .where(eq(schema.sqliteItems.id, item!.id))
        .run();

      const updatedItem = db.select()
        .from(schema.sqliteItems)
        .where(eq(schema.sqliteItems.id, item!.id))
        .get();

      expect(updatedItem?.nameTh).toBe('ขมิ้นชัน (ปรับปรุง)');
      expect(updatedItem?.category).toBe('Herbal');
    });

    it('should deactivate item', async () => {
      // Create item
      db.insert(schema.sqliteItems).values({
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        type: 'raw_material',
        primaryUnit: 'kg',
        isActive: true,
      }).run();

      const item = db.select().from(schema.sqliteItems).get();

      // Deactivate
      db.update(schema.sqliteItems)
        .set({ isActive: false })
        .where(eq(schema.sqliteItems.id, item!.id))
        .run();

      const updatedItem = db.select()
        .from(schema.sqliteItems)
        .where(eq(schema.sqliteItems.id, item!.id))
        .get();

      expect(updatedItem?.isActive).toBe(false);
    });
  });

  describe('Delete Item', () => {
    it('should delete item by id', async () => {
      // Create item
      db.insert(schema.sqliteItems).values({
        code: 'RM-001',
        nameTh: 'ขมิ้นชัน',
        type: 'raw_material',
        primaryUnit: 'kg',
      }).run();

      const item = db.select().from(schema.sqliteItems).get();

      // Delete
      db.delete(schema.sqliteItems)
        .where(eq(schema.sqliteItems.id, item!.id))
        .run();

      const items = db.select().from(schema.sqliteItems).all();
      expect(items).toHaveLength(0);
    });
  });
});
