import { getDb, useSqlite, initializeDatabase } from './index';
import { hashPassword } from '../auth';
import * as schema from './schema';

export async function seedDatabase() {
  // Initialize database tables
  await initializeDatabase();

  const db = await getDb();
  const isSqlite = useSqlite();

  console.log(`Seeding database (${isSqlite ? 'SQLite' : 'MySQL'})...`);

  // Get the appropriate schema tables
  const usersTable = isSqlite ? schema.sqliteUsers : schema.mysqlUsers;
  const warehousesTable = isSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;
  const itemsTable = isSqlite ? schema.sqliteItems : schema.mysqlItems;
  const vendorsTable = isSqlite ? schema.sqliteVendors : schema.mysqlVendors;

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  try {
    if (isSqlite) {
      await (db as any).insert(usersTable).values({
        email: 'admin@herbal-erp.com',
        password: adminPassword,
        name: 'System Administrator',
        role: 'admin',
        department: 'IT',
        isActive: true,
      }).onConflictDoNothing();
    } else {
      // MySQL - use INSERT IGNORE via raw SQL or try/catch
      await (db as any).insert(usersTable).values({
        email: 'admin@herbal-erp.com',
        password: adminPassword,
        name: 'System Administrator',
        role: 'admin',
        department: 'IT',
        isActive: true,
      });
    }
    console.log('Admin user created');
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint') || error.message?.includes('Duplicate entry')) {
      console.log('Admin user already exists');
    } else {
      throw error;
    }
  }

  // Create sample users
  const userPassword = await hashPassword('user123');
  const sampleUsers = [
    { email: 'production@herbal-erp.com', name: 'Production Manager', role: 'production', department: 'Production' },
    { email: 'qc@herbal-erp.com', name: 'QC Manager', role: 'qc', department: 'Quality Control' },
    { email: 'warehouse@herbal-erp.com', name: 'Warehouse Manager', role: 'warehouse', department: 'Warehouse' },
    { email: 'purchasing@herbal-erp.com', name: 'Purchasing Manager', role: 'purchasing', department: 'Purchasing' },
    { email: 'sales@herbal-erp.com', name: 'Sales Manager', role: 'sales', department: 'Sales' },
  ];

  // Helper function to insert and ignore duplicates
  async function insertIgnoreDuplicate(table: any, values: any) {
    try {
      if (isSqlite) {
        await (db as any).insert(table).values(values).onConflictDoNothing();
      } else {
        await (db as any).insert(table).values(values);
      }
    } catch (error: any) {
      // Ignore duplicate entry errors
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint') || error.message?.includes('Duplicate entry')) {
        return; // Ignore duplicates
      }
      throw error;
    }
  }

  for (const user of sampleUsers) {
    await insertIgnoreDuplicate(usersTable, {
      ...user,
      password: userPassword,
      isActive: true,
    });
  }
  console.log('Sample users created');

  // Create sample warehouses
  const warehouses = [
    { code: 'WH-RM', name: 'Raw Material Warehouse', type: 'raw_material', location: 'Building A', temperatureMin: 20, temperatureMax: 25, humidityMin: 45, humidityMax: 65 },
    { code: 'WH-FG', name: 'Finished Goods Warehouse', type: 'finished_goods', location: 'Building B', temperatureMin: 20, temperatureMax: 25, humidityMin: 45, humidityMax: 65 },
    { code: 'WH-QR', name: 'Quarantine Area', type: 'quarantine', location: 'Building A', temperatureMin: 20, temperatureMax: 25, humidityMin: 45, humidityMax: 65 },
    { code: 'WH-RJ', name: 'Rejected Material Area', type: 'rejected', location: 'Building C', temperatureMin: 15, temperatureMax: 30, humidityMin: 40, humidityMax: 70 },
  ];

  for (const warehouse of warehouses) {
    await insertIgnoreDuplicate(warehousesTable, warehouse);
  }
  console.log('Sample warehouses created');

  // Create sample items
  const items = [
    { code: 'RM-001', nameTh: 'ขมิ้นชัน', nameEn: 'Turmeric', type: 'raw_material', category: 'Herbal', primaryUnit: 'kg' },
    { code: 'RM-002', nameTh: 'ขิง', nameEn: 'Ginger', type: 'raw_material', category: 'Herbal', primaryUnit: 'kg' },
    { code: 'RM-003', nameTh: 'ฟ้าทะลายโจร', nameEn: 'Andrographis', type: 'raw_material', category: 'Herbal', primaryUnit: 'kg' },
    { code: 'RM-004', nameTh: 'กระชายขาว', nameEn: 'Fingerroot', type: 'raw_material', category: 'Herbal', primaryUnit: 'kg' },
    { code: 'EX-001', nameTh: 'สารสกัดขมิ้นชัน', nameEn: 'Turmeric Extract', type: 'extract', category: 'Extract', primaryUnit: 'kg' },
    { code: 'PK-001', nameTh: 'แคปซูลเปล่า ขนาด 0', nameEn: 'Empty Capsule Size 0', type: 'packaging', category: 'Capsule', primaryUnit: 'pcs' },
    { code: 'PK-002', nameTh: 'ขวดพลาสติก 100ml', nameEn: 'Plastic Bottle 100ml', type: 'packaging', category: 'Bottle', primaryUnit: 'pcs' },
    { code: 'FG-001', nameTh: 'แคปซูลขมิ้นชัน 500mg', nameEn: 'Turmeric Capsule 500mg', type: 'finished_product', category: 'Capsule', primaryUnit: 'bottle' },
    { code: 'FG-002', nameTh: 'แคปซูลฟ้าทะลายโจร 400mg', nameEn: 'Andrographis Capsule 400mg', type: 'finished_product', category: 'Capsule', primaryUnit: 'bottle' },
  ];

  for (const item of items) {
    await insertIgnoreDuplicate(itemsTable, {
      ...item,
      shelfLifeDays: 730,
      minStock: 100,
      maxStock: 10000,
      reorderPoint: 500,
      isLotControlled: true,
      isFEFO: true,
      isActive: true,
    });
  }
  console.log('Sample items created');

  // Create sample vendors
  const vendors = [
    { code: 'VD-001', name: 'Thai Herb Supply Co., Ltd.', contactPerson: 'Mr. Somchai', phone: '02-123-4567', isApproved: true },
    { code: 'VD-002', name: 'Organic Farm Thailand', contactPerson: 'Ms. Suda', phone: '02-234-5678', isApproved: true },
    { code: 'VD-003', name: 'Packaging Solutions Ltd.', contactPerson: 'Mr. John', phone: '02-345-6789', isApproved: true, isVMI: true },
  ];

  for (const vendor of vendors) {
    await insertIgnoreDuplicate(vendorsTable, {
      ...vendor,
      leadTimeDays: 7,
      paymentTerms: 'Net 30',
      isActive: true,
    });
  }
  console.log('Sample vendors created');

  console.log('Database seeded successfully!');
}

// Run seed if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
