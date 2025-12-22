/**
 * Lookup Tables Auto-Seeder
 *
 * Automatically seeds default values into lookup tables (item_categories, item_units)
 * if they are empty. This runs during server startup after schema sync.
 */

import { sql } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from './index';
import * as schema from './schema';

// Default item categories
const defaultCategories = [
  { code: 'herb', nameTh: 'สมุนไพร', nameEn: 'Herb', description: 'Raw herbal materials', sortOrder: 1 },
  { code: 'extract', nameTh: 'สารสกัด', nameEn: 'Extract', description: 'Herbal extracts and concentrates', sortOrder: 2 },
  { code: 'excipient', nameTh: 'สารเติมแต่ง', nameEn: 'Excipient', description: 'Pharmaceutical excipients', sortOrder: 3 },
  { code: 'packaging', nameTh: 'บรรจุภัณฑ์', nameEn: 'Packaging', description: 'Packaging materials', sortOrder: 4 },
  { code: 'capsule', nameTh: 'แคปซูล', nameEn: 'Capsule', description: 'Empty capsules', sortOrder: 5 },
  { code: 'bottle', nameTh: 'ขวด', nameEn: 'Bottle', description: 'Bottles and containers', sortOrder: 6 },
  { code: 'label', nameTh: 'ฉลาก', nameEn: 'Label', description: 'Labels and stickers', sortOrder: 7 },
  { code: 'box', nameTh: 'กล่อง', nameEn: 'Box', description: 'Boxes and cartons', sortOrder: 8 },
  { code: 'finished', nameTh: 'ผลิตภัณฑ์สำเร็จรูป', nameEn: 'Finished Product', description: 'Finished products', sortOrder: 9 },
  { code: 'semi_finished', nameTh: 'กึ่งสำเร็จรูป', nameEn: 'Semi-finished', description: 'Semi-finished products', sortOrder: 10 },
  { code: 'consumable', nameTh: 'วัสดุสิ้นเปลือง', nameEn: 'Consumable', description: 'Consumable supplies', sortOrder: 11 },
  { code: 'chemical', nameTh: 'เคมีภัณฑ์', nameEn: 'Chemical', description: 'Chemical substances', sortOrder: 12 },
  { code: 'other', nameTh: 'อื่นๆ', nameEn: 'Other', description: 'Other materials', sortOrder: 99 },
];

// Default item units
const defaultUnits = [
  { code: 'kg', nameTh: 'กิโลกรัม', nameEn: 'Kilogram', symbol: 'kg', description: 'Weight unit (1000 grams)', sortOrder: 1 },
  { code: 'g', nameTh: 'กรัม', nameEn: 'Gram', symbol: 'g', description: 'Weight unit', sortOrder: 2 },
  { code: 'mg', nameTh: 'มิลลิกรัม', nameEn: 'Milligram', symbol: 'mg', description: 'Weight unit (0.001 gram)', sortOrder: 3 },
  { code: 'l', nameTh: 'ลิตร', nameEn: 'Liter', symbol: 'L', description: 'Volume unit', sortOrder: 4 },
  { code: 'ml', nameTh: 'มิลลิลิตร', nameEn: 'Milliliter', symbol: 'mL', description: 'Volume unit (0.001 liter)', sortOrder: 5 },
  { code: 'pcs', nameTh: 'ชิ้น', nameEn: 'Piece', symbol: 'pcs', description: 'Count unit', sortOrder: 6 },
  { code: 'pack', nameTh: 'แพ็ค', nameEn: 'Pack', symbol: 'pack', description: 'Package unit', sortOrder: 7 },
  { code: 'box', nameTh: 'กล่อง', nameEn: 'Box', symbol: 'box', description: 'Box unit', sortOrder: 8 },
  { code: 'bottle', nameTh: 'ขวด', nameEn: 'Bottle', symbol: 'bottle', description: 'Bottle unit', sortOrder: 9 },
  { code: 'bag', nameTh: 'ถุง', nameEn: 'Bag', symbol: 'bag', description: 'Bag unit', sortOrder: 10 },
  { code: 'roll', nameTh: 'ม้วน', nameEn: 'Roll', symbol: 'roll', description: 'Roll unit', sortOrder: 11 },
  { code: 'sheet', nameTh: 'แผ่น', nameEn: 'Sheet', symbol: 'sheet', description: 'Sheet unit', sortOrder: 12 },
  { code: 'set', nameTh: 'ชุด', nameEn: 'Set', symbol: 'set', description: 'Set unit', sortOrder: 13 },
  { code: 'carton', nameTh: 'ลัง', nameEn: 'Carton', symbol: 'carton', description: 'Carton unit', sortOrder: 14 },
  { code: 'drum', nameTh: 'ถัง', nameEn: 'Drum', symbol: 'drum', description: 'Drum/barrel unit', sortOrder: 15 },
  { code: 'can', nameTh: 'กระป๋อง', nameEn: 'Can', symbol: 'can', description: 'Can unit', sortOrder: 16 },
  { code: 'tube', nameTh: 'หลอด', nameEn: 'Tube', symbol: 'tube', description: 'Tube unit', sortOrder: 17 },
  { code: 'cap', nameTh: 'ฝา', nameEn: 'Cap', symbol: 'cap', description: 'Cap/lid unit', sortOrder: 18 },
];

/**
 * Check if a table is empty
 */
async function isTableEmpty(tableName: string, isSqlite: boolean): Promise<boolean> {
  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      return (result[0] as any)?.count === 0;
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM \`${tableName}\``));
      return (result[0] as any[])[0]?.count === 0;
    }
  } catch (error) {
    // Table might not exist yet or connection issue - assume empty and try to seed
    console.log(`[Lookup Seed] Could not check table ${tableName}, will attempt to seed: ${error}`);
    return true;
  }
}

/**
 * Seed item categories if table is empty
 */
async function seedItemCategories(isSqlite: boolean): Promise<number> {
  const tableName = 'item_categories';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[Lookup Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[Lookup Seed] Seeding ${tableName} with ${defaultCategories.length} default values...`);

  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const categoriesTable = schema.sqliteItemCategories;
      for (const category of defaultCategories) {
        await db.insert(categoriesTable).values({
          code: category.code,
          nameTh: category.nameTh,
          nameEn: category.nameEn,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        });
      }
    } else {
      const db = await getMysqlDb();
      const categoriesTable = schema.mysqlItemCategories;
      for (const category of defaultCategories) {
        await db.insert(categoriesTable).values({
          code: category.code,
          nameTh: category.nameTh,
          nameEn: category.nameEn,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        });
      }
    }

    console.log(`[Lookup Seed] Successfully seeded ${defaultCategories.length} categories`);
    return defaultCategories.length;
  } catch (error) {
    console.error(`[Lookup Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed item units if table is empty
 */
async function seedItemUnits(isSqlite: boolean): Promise<number> {
  const tableName = 'item_units';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[Lookup Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[Lookup Seed] Seeding ${tableName} with ${defaultUnits.length} default values...`);

  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const unitsTable = schema.sqliteItemUnits;
      for (const unit of defaultUnits) {
        await db.insert(unitsTable).values({
          code: unit.code,
          nameTh: unit.nameTh,
          nameEn: unit.nameEn,
          symbol: unit.symbol,
          description: unit.description,
          sortOrder: unit.sortOrder,
          isActive: true,
        });
      }
    } else {
      const db = await getMysqlDb();
      const unitsTable = schema.mysqlItemUnits;
      for (const unit of defaultUnits) {
        await db.insert(unitsTable).values({
          code: unit.code,
          nameTh: unit.nameTh,
          nameEn: unit.nameEn,
          symbol: unit.symbol,
          description: unit.description,
          sortOrder: unit.sortOrder,
          isActive: true,
        });
      }
    }

    console.log(`[Lookup Seed] Successfully seeded ${defaultUnits.length} units`);
    return defaultUnits.length;
  } catch (error) {
    console.error(`[Lookup Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed all lookup tables if they are empty
 * This function is called during server startup after schema sync
 */
export async function seedLookupTables(): Promise<{
  categoriesSeeded: number;
  unitsSeeded: number;
}> {
  const usingSqlite = isSqlite();
  console.log(`[Lookup Seed] Starting lookup tables seeding for ${usingSqlite ? 'SQLite' : 'MySQL'}...`);

  const categoriesSeeded = await seedItemCategories(isSqlite);
  const unitsSeeded = await seedItemUnits(isSqlite);

  console.log(`[Lookup Seed] Lookup tables seeding complete.`);
  console.log(`[Lookup Seed] Categories seeded: ${categoriesSeeded}, Units seeded: ${unitsSeeded}`);

  return { categoriesSeeded, unitsSeeded };
}
