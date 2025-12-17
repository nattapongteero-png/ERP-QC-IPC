import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSqliteDb, initializeDatabase, closeConnections } from '../src/lib/db';
import * as schema from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Database Operations', () => {
  let db: ReturnType<typeof getSqliteDb>;

  beforeAll(async () => {
    await initializeDatabase();
    db = getSqliteDb();
  });

  afterAll(async () => {
    await closeConnections();
  });

  describe('Users Table', () => {
    it('should create a user', async () => {
      const result = await db.insert(schema.sqliteUsers).values({
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        role: 'user',
      });

      expect(result).toBeDefined();
    });

    it('should read a user by email', async () => {
      const users = await db
        .select()
        .from(schema.sqliteUsers)
        .where(eq(schema.sqliteUsers.email, 'test@example.com'))
        .limit(1);

      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Test User');
      expect(users[0].role).toBe('user');
    });

    it('should update a user', async () => {
      await db
        .update(schema.sqliteUsers)
        .set({ name: 'Updated User' })
        .where(eq(schema.sqliteUsers.email, 'test@example.com'));

      const users = await db
        .select()
        .from(schema.sqliteUsers)
        .where(eq(schema.sqliteUsers.email, 'test@example.com'))
        .limit(1);

      expect(users[0].name).toBe('Updated User');
    });

    it('should soft delete a user', async () => {
      await db
        .update(schema.sqliteUsers)
        .set({ isActive: false })
        .where(eq(schema.sqliteUsers.email, 'test@example.com'));

      const users = await db
        .select()
        .from(schema.sqliteUsers)
        .where(eq(schema.sqliteUsers.email, 'test@example.com'))
        .limit(1);

      expect(users[0].isActive).toBe(false);
    });
  });

  describe('Items Table', () => {
    it('should create an item', async () => {
      const result = await db.insert(schema.sqliteItems).values({
        code: 'TEST-001',
        nameTh: 'รายการทดสอบ',
        nameEn: 'Test Item',
        type: 'raw_material',
        primaryUnit: 'kg',
      });

      expect(result).toBeDefined();
    });

    it('should read an item by code', async () => {
      const items = await db
        .select()
        .from(schema.sqliteItems)
        .where(eq(schema.sqliteItems.code, 'TEST-001'))
        .limit(1);

      expect(items.length).toBe(1);
      expect(items[0].nameTh).toBe('รายการทดสอบ');
      expect(items[0].type).toBe('raw_material');
    });

    it('should enforce unique code constraint', async () => {
      await expect(
        db.insert(schema.sqliteItems).values({
          code: 'TEST-001',
          nameTh: 'รายการซ้ำ',
          type: 'raw_material',
          primaryUnit: 'kg',
        })
      ).rejects.toThrow();
    });
  });

  describe('Warehouses Table', () => {
    it('should create a warehouse', async () => {
      const result = await db.insert(schema.sqliteWarehouses).values({
        code: 'WH-TEST',
        name: 'Test Warehouse',
        type: 'raw_material',
        location: 'Test Location',
      });

      expect(result).toBeDefined();
    });

    it('should read a warehouse', async () => {
      const warehouses = await db
        .select()
        .from(schema.sqliteWarehouses)
        .where(eq(schema.sqliteWarehouses.code, 'WH-TEST'))
        .limit(1);

      expect(warehouses.length).toBe(1);
      expect(warehouses[0].name).toBe('Test Warehouse');
    });
  });

  describe('Vendors Table', () => {
    it('should create a vendor', async () => {
      const result = await db.insert(schema.sqliteVendors).values({
        code: 'VD-TEST',
        name: 'Test Vendor',
        contactPerson: 'Test Contact',
        phone: '012-345-6789',
      });

      expect(result).toBeDefined();
    });

    it('should read a vendor', async () => {
      const vendors = await db
        .select()
        .from(schema.sqliteVendors)
        .where(eq(schema.sqliteVendors.code, 'VD-TEST'))
        .limit(1);

      expect(vendors.length).toBe(1);
      expect(vendors[0].name).toBe('Test Vendor');
      expect(vendors[0].isApproved).toBe(false);
    });
  });

  describe('Inventory Lots Table', () => {
    let itemId: number;
    let warehouseId: number;

    beforeAll(async () => {
      // Get item and warehouse IDs
      const items = await db
        .select()
        .from(schema.sqliteItems)
        .where(eq(schema.sqliteItems.code, 'TEST-001'))
        .limit(1);
      itemId = items[0].id;

      const warehouses = await db
        .select()
        .from(schema.sqliteWarehouses)
        .where(eq(schema.sqliteWarehouses.code, 'WH-TEST'))
        .limit(1);
      warehouseId = warehouses[0].id;
    });

    it('should create an inventory lot', async () => {
      const result = await db.insert(schema.sqliteInventoryLots).values({
        itemId,
        lotNumber: 'LOT-TEST-001',
        warehouseId,
        quantity: 100,
        unit: 'kg',
        status: 'quarantine',
      });

      expect(result).toBeDefined();
    });

    it('should read an inventory lot', async () => {
      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.lotNumber, 'LOT-TEST-001'))
        .limit(1);

      expect(lots.length).toBe(1);
      expect(lots[0].quantity).toBe(100);
      expect(lots[0].status).toBe('quarantine');
    });

    it('should update lot status', async () => {
      await db
        .update(schema.sqliteInventoryLots)
        .set({ status: 'released' })
        .where(eq(schema.sqliteInventoryLots.lotNumber, 'LOT-TEST-001'));

      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.lotNumber, 'LOT-TEST-001'))
        .limit(1);

      expect(lots[0].status).toBe('released');
    });
  });
});
