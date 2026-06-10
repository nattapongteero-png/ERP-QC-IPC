import { eq } from 'drizzle-orm';
import { getDb, isSqlite, initializeDatabase } from './index';
import { hashPassword } from '../auth';
import * as schema from './schema';

// Report category seed data
const reportCategories = [
  { name: 'Inventory Reports', description: 'Stock levels, valuations, and inventory movements', sortOrder: 1 },
  { name: 'Production Reports', description: 'Work orders, batch records, and production yields', sortOrder: 2 },
  { name: 'Quality Reports', description: 'Certificates of Analysis, test results, and deviations', sortOrder: 3 },
  { name: 'Purchasing Reports', description: 'Purchase orders and vendor analysis', sortOrder: 4 },
  { name: 'Sales Reports', description: 'Sales orders and customer analysis', sortOrder: 5 },
];

export async function seedDatabase() {
  // Initialize database tables
  await initializeDatabase();

  const db = await getDb();
  const usingSqlite = isSqlite();

  console.log(`Seeding database (${usingSqlite ? 'SQLite' : 'MySQL'})...`);

  // Get the appropriate schema tables
  const usersTable = usingSqlite ? schema.sqliteUsers : schema.mysqlUsers;
  const warehousesTable = usingSqlite ? schema.sqliteWarehouses : schema.mysqlWarehouses;
  const itemsTable = usingSqlite ? schema.sqliteItems : schema.mysqlItems;
  const vendorsTable = usingSqlite ? schema.sqliteVendors : schema.mysqlVendors;

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  try {
    if (usingSqlite) {
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
    { email: 'hr@herbal-erp.com', name: 'HR Manager', role: 'hr', department: 'Human Resources' },
  ];

  // Helper function to insert and ignore duplicates
  async function insertIgnoreDuplicate(table: any, values: any) {
    try {
      if (usingSqlite) {
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
    { code: 'FG-001', nameTh: 'แคปซูลขมิ้นชัน 500mg', nameEn: 'Turmeric Capsule 500mg', type: 'finished_goods', category: 'Capsule', primaryUnit: 'bottle' },
    { code: 'FG-002', nameTh: 'แคปซูลฟ้าทะลายโจร 400mg', nameEn: 'Andrographis Capsule 400mg', type: 'finished_goods', category: 'Capsule', primaryUnit: 'bottle' },
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

  // Seed report categories
  const reportCategoriesTable = usingSqlite ? schema.sqliteReportCategories : schema.mysqlReportCategories;
  for (const category of reportCategories) {
    await insertIgnoreDuplicate(reportCategoriesTable, {
      ...category,
      isActive: true,
    });
  }
  console.log('Report categories created');

  // Feature 018: seed default global material withdrawal rule (10% soft / 50% hard)
  // Lookup precedence: (factory, category) → (factory, NULL) → (NULL, category) → (NULL, NULL = this row)
  const withdrawalRulesTable = usingSqlite
    ? schema.sqliteMaterialWithdrawalRules
    : schema.mysqlMaterialWithdrawalRules;
  try {
    const adminUser = await (db as any)
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, 'admin@herbal-erp.com'))
      .limit(1);
    const adminId: number | undefined = adminUser?.[0]?.id;
    if (adminId) {
      await insertIgnoreDuplicate(withdrawalRulesTable, {
        factoryCode: null,
        materialCategory: null,
        softCapPercent: usingSqlite ? 10.0 : '10.00',
        hardCapPercent: usingSqlite ? 50.0 : '50.00',
        isActive: true,
        createdByUserId: adminId,
      });
      console.log('Default material withdrawal rule seeded');
    }
  } catch (error) {
    console.warn('Default material withdrawal rule seed skipped:', error);
  }

  // Seed a default Purchase Requisition approval flow so PR "submit for
  // approval" works out of the box in every environment. Without an active
  // flow for the document type, submitForApproval() throws NO_MATCHING_FLOW
  // and PRs can never reach PO. The flow has NO rules (always matches) and a
  // single admin approval step. Idempotent: skipped if any PR flow exists.
  const approvalFlowsTable = usingSqlite ? schema.sqliteApprovalFlows : schema.mysqlApprovalFlows;
  const approvalStepsTable = usingSqlite ? schema.sqliteApprovalSteps : schema.mysqlApprovalSteps;
  try {
    const existingPrFlow = await (db as any)
      .select({ id: approvalFlowsTable.id })
      .from(approvalFlowsTable)
      .where(eq(approvalFlowsTable.documentType, 'purchase_requisition'))
      .limit(1);

    if (!existingPrFlow?.[0]?.id) {
      const adminUser = await (db as any)
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, 'admin@herbal-erp.com'))
        .limit(1);
      const adminId: number | undefined = adminUser?.[0]?.id;

      if (adminId) {
        const insertResult = await (db as any).insert(approvalFlowsTable).values({
          name: 'Default PR Approval',
          description: 'Auto-seeded default approval flow for Purchase Requisitions',
          documentType: 'purchase_requisition',
          priority: 100,
          isActive: true,
          createdBy: adminId,
        });

        // Resolve the new flow id across both drivers (SQLite returns
        // lastInsertRowid; MySQL returns insertId), falling back to a lookup.
        let flowId: number | undefined =
          insertResult?.lastInsertRowid ?? insertResult?.[0]?.insertId ?? insertResult?.insertId;
        if (!flowId) {
          const justInserted = await (db as any)
            .select({ id: approvalFlowsTable.id })
            .from(approvalFlowsTable)
            .where(eq(approvalFlowsTable.documentType, 'purchase_requisition'))
            .limit(1);
          flowId = justInserted?.[0]?.id;
        }

        if (flowId) {
          await (db as any).insert(approvalStepsTable).values({
            flowId: Number(flowId),
            stepOrder: 1,
            stepName: 'Admin Approval',
            approverType: 'user',
            approverId: adminId,
            canDelegate: false,
            timeoutDays: 3,
          });
          console.log('Default PR approval flow seeded');
        }
      }
    }
  } catch (error) {
    console.warn('Default PR approval flow seed skipped:', error);
  }

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
