/**
 * HR Lookup Tables Auto-Seeder
 *
 * Automatically seeds default values into HR lookup tables
 * (org_units, positions, training_courses, app_roles, app_permissions)
 * if they are empty. This runs during server startup after schema sync.
 */

import { sql } from 'drizzle-orm';
import { useSqlite, getSqliteDb, getMysqlDb } from './index';
import * as schema from './schema';

// Default Organization Units (โครงสร้างองค์กร)
const defaultOrgUnits = [
  // Company level
  {
    code: 'COMP-001',
    name: 'บริษัท สมุนไพรไทย จำกัด',
    nameEn: 'Thai Herbal Medicine Co., Ltd.',
    type: 'company',
    parentId: null,
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  // Site level
  {
    code: 'SITE-001',
    name: 'โรงงานผลิต (สำนักงานใหญ่)',
    nameEn: 'Main Production Site (HQ)',
    type: 'site',
    parentCode: 'COMP-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  // Division level
  {
    code: 'DIV-001',
    name: 'ฝ่ายผลิต',
    nameEn: 'Production Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-002',
    name: 'ฝ่ายควบคุมคุณภาพ',
    nameEn: 'Quality Control Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-003',
    name: 'ฝ่ายประกันคุณภาพ',
    nameEn: 'Quality Assurance Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-004',
    name: 'ฝ่ายคลังสินค้า',
    nameEn: 'Warehouse Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-005',
    name: 'ฝ่ายจัดซื้อ',
    nameEn: 'Purchasing Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-006',
    name: 'ฝ่ายขาย',
    nameEn: 'Sales Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-007',
    name: 'ฝ่ายบุคคล',
    nameEn: 'Human Resources Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-008',
    name: 'ฝ่ายบัญชีและการเงิน',
    nameEn: 'Accounting & Finance Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DIV-009',
    name: 'ฝ่ายเทคโนโลยีสารสนเทศ',
    nameEn: 'IT Division',
    type: 'division',
    parentCode: 'SITE-001',
    isGmpCritical: false,
    effectiveFrom: '2020-01-01',
  },
  // Department level
  {
    code: 'DEPT-001',
    name: 'แผนกผลิตยา',
    nameEn: 'Drug Manufacturing Department',
    type: 'department',
    parentCode: 'DIV-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-002',
    name: 'แผนกบรรจุภัณฑ์',
    nameEn: 'Packaging Department',
    type: 'department',
    parentCode: 'DIV-001',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-003',
    name: 'แผนกตรวจสอบคุณภาพ',
    nameEn: 'Quality Testing Department',
    type: 'department',
    parentCode: 'DIV-002',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-004',
    name: 'แผนกจุลชีววิทยา',
    nameEn: 'Microbiology Department',
    type: 'department',
    parentCode: 'DIV-002',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-005',
    name: 'แผนกวัตถุดิบ',
    nameEn: 'Raw Material Department',
    type: 'department',
    parentCode: 'DIV-004',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
  {
    code: 'DEPT-006',
    name: 'แผนกผลิตภัณฑ์สำเร็จรูป',
    nameEn: 'Finished Goods Department',
    type: 'department',
    parentCode: 'DIV-004',
    isGmpCritical: true,
    effectiveFrom: '2020-01-01',
  },
];

// Default Positions (ตำแหน่งงาน)
const defaultPositions = [
  // Executive
  { code: 'POS-001', title: 'กรรมการผู้จัดการ', titleEn: 'Managing Director', orgUnitCode: 'COMP-001', jobGrade: 'E1', isGmpCritical: true },
  { code: 'POS-002', title: 'ผู้จัดการโรงงาน', titleEn: 'Plant Manager', orgUnitCode: 'SITE-001', jobGrade: 'E2', isGmpCritical: true },

  // Production
  { code: 'POS-010', title: 'ผู้จัดการฝ่ายผลิต', titleEn: 'Production Manager', orgUnitCode: 'DIV-001', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-011', title: 'หัวหน้าแผนกผลิต', titleEn: 'Production Supervisor', orgUnitCode: 'DEPT-001', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-012', title: 'พนักงานผลิต', titleEn: 'Production Operator', orgUnitCode: 'DEPT-001', jobGrade: 'O1', isGmpCritical: true },
  { code: 'POS-013', title: 'หัวหน้าแผนกบรรจุ', titleEn: 'Packaging Supervisor', orgUnitCode: 'DEPT-002', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-014', title: 'พนักงานบรรจุ', titleEn: 'Packaging Operator', orgUnitCode: 'DEPT-002', jobGrade: 'O1', isGmpCritical: true },

  // Quality Control
  { code: 'POS-020', title: 'ผู้จัดการฝ่าย QC', titleEn: 'QC Manager', orgUnitCode: 'DIV-002', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-021', title: 'หัวหน้าห้องปฏิบัติการ', titleEn: 'Laboratory Supervisor', orgUnitCode: 'DEPT-003', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-022', title: 'นักวิทยาศาสตร์', titleEn: 'Scientist', orgUnitCode: 'DEPT-003', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-023', title: 'เจ้าหน้าที่ห้องปฏิบัติการ', titleEn: 'Laboratory Technician', orgUnitCode: 'DEPT-003', jobGrade: 'T1', isGmpCritical: true },
  { code: 'POS-024', title: 'นักจุลชีววิทยา', titleEn: 'Microbiologist', orgUnitCode: 'DEPT-004', jobGrade: 'P1', isGmpCritical: true },

  // Quality Assurance
  { code: 'POS-030', title: 'ผู้จัดการฝ่าย QA', titleEn: 'QA Manager', orgUnitCode: 'DIV-003', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-031', title: 'เจ้าหน้าที่ QA', titleEn: 'QA Officer', orgUnitCode: 'DIV-003', jobGrade: 'P1', isGmpCritical: true },
  { code: 'POS-032', title: 'เจ้าหน้าที่เอกสาร', titleEn: 'Document Controller', orgUnitCode: 'DIV-003', jobGrade: 'T1', isGmpCritical: true },

  // Warehouse
  { code: 'POS-040', title: 'ผู้จัดการคลังสินค้า', titleEn: 'Warehouse Manager', orgUnitCode: 'DIV-004', jobGrade: 'M1', isGmpCritical: true },
  { code: 'POS-041', title: 'หัวหน้าคลังวัตถุดิบ', titleEn: 'Raw Material Warehouse Supervisor', orgUnitCode: 'DEPT-005', jobGrade: 'S1', isGmpCritical: true },
  { code: 'POS-042', title: 'พนักงานคลังสินค้า', titleEn: 'Warehouse Staff', orgUnitCode: 'DEPT-005', jobGrade: 'O1', isGmpCritical: true },

  // Purchasing
  { code: 'POS-050', title: 'ผู้จัดการฝ่ายจัดซื้อ', titleEn: 'Purchasing Manager', orgUnitCode: 'DIV-005', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-051', title: 'เจ้าหน้าที่จัดซื้อ', titleEn: 'Purchasing Officer', orgUnitCode: 'DIV-005', jobGrade: 'P1', isGmpCritical: false },

  // Sales
  { code: 'POS-060', title: 'ผู้จัดการฝ่ายขาย', titleEn: 'Sales Manager', orgUnitCode: 'DIV-006', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-061', title: 'พนักงานขาย', titleEn: 'Sales Representative', orgUnitCode: 'DIV-006', jobGrade: 'P1', isGmpCritical: false },

  // HR
  { code: 'POS-070', title: 'ผู้จัดการฝ่ายบุคคล', titleEn: 'HR Manager', orgUnitCode: 'DIV-007', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-071', title: 'เจ้าหน้าที่บุคคล', titleEn: 'HR Officer', orgUnitCode: 'DIV-007', jobGrade: 'P1', isGmpCritical: false },

  // Finance
  { code: 'POS-080', title: 'ผู้จัดการฝ่ายบัญชี', titleEn: 'Accounting Manager', orgUnitCode: 'DIV-008', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-081', title: 'พนักงานบัญชี', titleEn: 'Accountant', orgUnitCode: 'DIV-008', jobGrade: 'P1', isGmpCritical: false },

  // IT
  { code: 'POS-090', title: 'ผู้จัดการฝ่าย IT', titleEn: 'IT Manager', orgUnitCode: 'DIV-009', jobGrade: 'M1', isGmpCritical: false },
  { code: 'POS-091', title: 'นักพัฒนาระบบ', titleEn: 'System Developer', orgUnitCode: 'DIV-009', jobGrade: 'P1', isGmpCritical: false },
];

// Default Training Courses (หลักสูตรอบรม)
const defaultTrainingCourses = [
  // GMP Training
  {
    code: 'TRN-GMP-001',
    name: 'หลักเกณฑ์และวิธีการที่ดีในการผลิตยา (GMP)',
    nameEn: 'Good Manufacturing Practice (GMP)',
    description: 'อบรมพื้นฐาน GMP สำหรับพนักงานใหม่',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 8,
  },
  {
    code: 'TRN-GMP-002',
    name: 'การทบทวน GMP ประจำปี',
    nameEn: 'Annual GMP Refresher',
    description: 'อบรมทบทวน GMP ประจำปี',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-GMP-003',
    name: 'สุขอนามัยส่วนบุคคล',
    nameEn: 'Personal Hygiene',
    description: 'อบรมเรื่องสุขอนามัยส่วนบุคคลในพื้นที่ผลิต',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 2,
  },
  {
    code: 'TRN-GMP-004',
    name: 'การแต่งกายและการใช้ชุด Cleanroom',
    nameEn: 'Gowning Procedure',
    description: 'ขั้นตอนการแต่งกายและการใช้ชุดสำหรับห้องสะอาด',
    category: 'GMP',
    validityDays: 365,
    isMandatory: true,
    durationHours: 2,
  },

  // Documentation
  {
    code: 'TRN-DOC-001',
    name: 'การจัดทำเอกสาร GDP',
    nameEn: 'Good Documentation Practice',
    description: 'หลักการจัดทำและควบคุมเอกสารตามมาตรฐาน GMP',
    category: 'Documentation',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-DOC-002',
    name: 'Batch Record และ Deviation',
    nameEn: 'Batch Record & Deviation Handling',
    description: 'การกรอกบันทึกการผลิตและการจัดการความเบี่ยงเบน',
    category: 'Documentation',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },

  // Quality
  {
    code: 'TRN-QC-001',
    name: 'การควบคุมคุณภาพเบื้องต้น',
    nameEn: 'Basic Quality Control',
    description: 'พื้นฐานการควบคุมคุณภาพในอุตสาหกรรมยา',
    category: 'Quality',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-QC-002',
    name: 'การตรวจสอบวัตถุดิบ',
    nameEn: 'Raw Material Inspection',
    description: 'วิธีการตรวจสอบและรับวัตถุดิบ',
    category: 'Quality',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },

  // Safety
  {
    code: 'TRN-SAF-001',
    name: 'ความปลอดภัยในการทำงาน',
    nameEn: 'Occupational Safety',
    description: 'หลักสูตรความปลอดภัยในการทำงานพื้นฐาน',
    category: 'Safety',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },
  {
    code: 'TRN-SAF-002',
    name: 'การจัดการสารเคมีอันตราย',
    nameEn: 'Chemical Handling',
    description: 'การจัดการสารเคมีอันตรายอย่างปลอดภัย',
    category: 'Safety',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
  {
    code: 'TRN-SAF-003',
    name: 'การดับเพลิงเบื้องต้น',
    nameEn: 'Basic Fire Fighting',
    description: 'ทักษะการดับเพลิงและการอพยพ',
    category: 'Safety',
    validityDays: 365,
    isMandatory: true,
    durationHours: 4,
  },

  // Production
  {
    code: 'TRN-PRD-001',
    name: 'การใช้เครื่องจักรผลิต',
    nameEn: 'Production Equipment Operation',
    description: 'การใช้งานเครื่องจักรในการผลิตยา',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },
  {
    code: 'TRN-PRD-002',
    name: 'กระบวนการผลิตแคปซูล',
    nameEn: 'Capsule Manufacturing Process',
    description: 'ขั้นตอนการผลิตยาแคปซูล',
    category: 'Production',
    validityDays: 365,
    isMandatory: false,
    durationHours: 8,
  },

  // Warehouse
  {
    code: 'TRN-WH-001',
    name: 'การจัดการคลังสินค้า GMP',
    nameEn: 'GMP Warehouse Management',
    description: 'การจัดการคลังสินค้าตามมาตรฐาน GMP',
    category: 'Warehouse',
    validityDays: 365,
    isMandatory: false,
    durationHours: 4,
  },
  {
    code: 'TRN-WH-002',
    name: 'FEFO และการจัดการ Lot',
    nameEn: 'FEFO & Lot Management',
    description: 'หลักการ First Expired First Out และการจัดการ Lot',
    category: 'Warehouse',
    validityDays: 365,
    isMandatory: false,
    durationHours: 2,
  },
];

// Default App Roles (บทบาทในระบบ)
const defaultAppRoles = [
  { code: 'ADMIN', name: 'System Administrator', nameEn: 'System Administrator', description: 'Full system access' },
  { code: 'HR_ADMIN', name: 'HR Administrator', nameEn: 'HR Administrator', description: 'HR module full access' },
  { code: 'HR_MANAGER', name: 'HR Manager', nameEn: 'HR Manager', description: 'HR management functions' },
  { code: 'HR_VIEWER', name: 'HR Viewer', nameEn: 'HR Viewer', description: 'HR read-only access' },
  { code: 'PROD_MANAGER', name: 'Production Manager', nameEn: 'Production Manager', description: 'Production management' },
  { code: 'PROD_OPERATOR', name: 'Production Operator', nameEn: 'Production Operator', description: 'Production operations' },
  { code: 'QC_MANAGER', name: 'QC Manager', nameEn: 'QC Manager', description: 'Quality control management' },
  { code: 'QC_ANALYST', name: 'QC Analyst', nameEn: 'QC Analyst', description: 'Quality testing operations' },
  { code: 'QA_MANAGER', name: 'QA Manager', nameEn: 'QA Manager', description: 'Quality assurance management' },
  { code: 'QA_OFFICER', name: 'QA Officer', nameEn: 'QA Officer', description: 'Quality assurance operations' },
  { code: 'WH_MANAGER', name: 'Warehouse Manager', nameEn: 'Warehouse Manager', description: 'Warehouse management' },
  { code: 'WH_STAFF', name: 'Warehouse Staff', nameEn: 'Warehouse Staff', description: 'Warehouse operations' },
  { code: 'PURCHASER', name: 'Purchaser', nameEn: 'Purchaser', description: 'Purchasing operations' },
  { code: 'SALES', name: 'Sales', nameEn: 'Sales', description: 'Sales operations' },
];

// Default App Permissions (สิทธิ์ในระบบ)
const defaultAppPermissions = [
  // HR Permissions
  { code: 'hr:read', name: 'HR View', module: 'HR', description: 'View HR data' },
  { code: 'hr:write', name: 'HR Edit', module: 'HR', description: 'Edit HR data' },
  { code: 'hr:admin', name: 'HR Admin', module: 'HR', description: 'Full HR administration' },
  { code: 'hr:health_staff', name: 'HR Health Staff', module: 'HR', description: 'Manage health records' },

  // Production Permissions
  { code: 'production:read', name: 'Production View', module: 'Production', description: 'View production data' },
  { code: 'production:write', name: 'Production Edit', module: 'Production', description: 'Edit production data' },
  { code: 'production:approve', name: 'Production Approve', module: 'Production', description: 'Approve production records' },

  // Quality Permissions
  { code: 'quality:read', name: 'Quality View', module: 'Quality', description: 'View quality data' },
  { code: 'quality:write', name: 'Quality Edit', module: 'Quality', description: 'Edit quality data' },
  { code: 'quality:approve', name: 'Quality Approve', module: 'Quality', description: 'Approve quality records' },

  // Inventory Permissions
  { code: 'inventory:read', name: 'Inventory View', module: 'Inventory', description: 'View inventory data' },
  { code: 'inventory:write', name: 'Inventory Edit', module: 'Inventory', description: 'Edit inventory data' },
  { code: 'inventory:adjust', name: 'Inventory Adjust', module: 'Inventory', description: 'Adjust inventory' },

  // Purchasing Permissions
  { code: 'purchasing:read', name: 'Purchasing View', module: 'Purchasing', description: 'View purchasing data' },
  { code: 'purchasing:write', name: 'Purchasing Edit', module: 'Purchasing', description: 'Create/edit purchase orders' },
  { code: 'purchasing:approve', name: 'Purchasing Approve', module: 'Purchasing', description: 'Approve purchase orders' },

  // Sales Permissions
  { code: 'sales:read', name: 'Sales View', module: 'Sales', description: 'View sales data' },
  { code: 'sales:write', name: 'Sales Edit', module: 'Sales', description: 'Create/edit sales orders' },
];

/**
 * Check if a table is empty
 */
async function isTableEmpty(tableName: string, isSqlite: boolean): Promise<boolean> {
  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result[0] as any)?.count === 0;
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM \`${tableName}\``));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result[0] as any[])[0]?.count === 0;
    }
  } catch {
    console.log(`[HR Seed] Could not check table ${tableName}, will attempt to seed`);
    return true;
  }
}

/**
 * Seed organization units if table is empty
 */
async function seedOrgUnits(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_org_units';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultOrgUnits.length} default values...`);

  try {
    const orgUnitTable = isSqlite ? schema.sqliteHROrgUnits : schema.mysqlHROrgUnits;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    // First pass: insert all org units without parent references
    const codeToIdMap: Record<string, number> = {};

    for (const orgUnit of defaultOrgUnits) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (db as any).insert(orgUnitTable).values({
        code: orgUnit.code,
        name: orgUnit.name,
        nameEn: orgUnit.nameEn,
        type: orgUnit.type,
        parentId: null, // Set to null initially
        isGmpCritical: orgUnit.isGmpCritical,
        effectiveFrom: new Date(orgUnit.effectiveFrom),
        isActive: true,
      });

      // Get the inserted ID
      if (isSqlite) {
        codeToIdMap[orgUnit.code] = result.lastInsertRowid as number;
      } else {
        codeToIdMap[orgUnit.code] = result[0].insertId as number;
      }
    }

    // Second pass: update parent IDs
    for (const orgUnit of defaultOrgUnits) {
      if ('parentCode' in orgUnit && orgUnit.parentCode) {
        const parentId = codeToIdMap[orgUnit.parentCode];
        const id = codeToIdMap[orgUnit.code];
        if (parentId && id) {
          if (isSqlite) {
            await db.run(sql.raw(`UPDATE "${tableName}" SET parent_id = ${parentId} WHERE id = ${id}`));
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (db as any).execute(sql.raw(`UPDATE \`${tableName}\` SET parent_id = ${parentId} WHERE id = ${id}`));
          }
        }
      }
    }

    console.log(`[HR Seed] Successfully seeded ${defaultOrgUnits.length} organization units`);
    return defaultOrgUnits.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed positions if table is empty
 */
async function seedPositions(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_positions';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  // First, get org unit ID mapping
  const orgUnitMap: Record<string, number> = {};
  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT id, code FROM "hr_org_units"`));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.forEach((row: any) => {
        orgUnitMap[row.code] = row.id;
      });
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT id, code FROM \`hr_org_units\``));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result[0] as any[]).forEach((row: any) => {
        orgUnitMap[row.code] = row.id;
      });
    }
  } catch (error) {
    console.error(`[HR Seed] Could not get org units for positions seed:`, error);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultPositions.length} default values...`);

  try {
    const positionsTable = isSqlite ? schema.sqliteHRPositions : schema.mysqlHRPositions;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const position of defaultPositions) {
      const orgUnitId = orgUnitMap[position.orgUnitCode];
      if (!orgUnitId) {
        console.warn(`[HR Seed] Org unit ${position.orgUnitCode} not found for position ${position.code}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(positionsTable).values({
        code: position.code,
        title: position.title,
        titleEn: position.titleEn,
        orgUnitId: orgUnitId,
        jobGrade: position.jobGrade,
        isGmpCritical: position.isGmpCritical,
        isActive: true,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultPositions.length} positions`);
    return defaultPositions.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed training courses if table is empty
 */
async function seedTrainingCourses(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_training_courses';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultTrainingCourses.length} default values...`);

  try {
    const coursesTable = isSqlite ? schema.sqliteHRTrainingCourses : schema.mysqlHRTrainingCourses;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const course of defaultTrainingCourses) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(coursesTable).values({
        code: course.code,
        name: course.name,
        nameEn: course.nameEn,
        description: course.description,
        category: course.category,
        validityDays: course.validityDays,
        isMandatory: course.isMandatory,
        durationHours: course.durationHours,
        isActive: true,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultTrainingCourses.length} training courses`);
    return defaultTrainingCourses.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed app roles if table is empty
 */
async function seedAppRoles(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_app_roles';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultAppRoles.length} default values...`);

  try {
    const rolesTable = isSqlite ? schema.sqliteHRAppRoles : schema.mysqlHRAppRoles;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const role of defaultAppRoles) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(rolesTable).values({
        code: role.code,
        name: role.name,
        description: role.description,
        isActive: true,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultAppRoles.length} app roles`);
    return defaultAppRoles.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed app permissions if table is empty
 */
async function seedAppPermissions(isSqlite: boolean): Promise<number> {
  const tableName = 'hr_app_permissions';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[HR Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[HR Seed] Seeding ${tableName} with ${defaultAppPermissions.length} default values...`);

  try {
    const permissionsTable = isSqlite ? schema.sqliteHRAppPermissions : schema.mysqlHRAppPermissions;
    const db = isSqlite ? getSqliteDb() : await getMysqlDb();

    for (const permission of defaultAppPermissions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).insert(permissionsTable).values({
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description,
      });
    }

    console.log(`[HR Seed] Successfully seeded ${defaultAppPermissions.length} app permissions`);
    return defaultAppPermissions.length;
  } catch (error) {
    console.error(`[HR Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed all HR lookup tables if they are empty
 * This function is called during server startup after schema sync
 */
export async function seedHRTables(): Promise<{
  orgUnitsSeeded: number;
  positionsSeeded: number;
  trainingCoursesSeeded: number;
  appRolesSeeded: number;
  appPermissionsSeeded: number;
}> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const isSqlite = useSqlite();
  console.log(`[HR Seed] Starting HR tables seeding for ${isSqlite ? 'SQLite' : 'MySQL'}...`);

  const orgUnitsSeeded = await seedOrgUnits(isSqlite);
  const positionsSeeded = await seedPositions(isSqlite);
  const trainingCoursesSeeded = await seedTrainingCourses(isSqlite);
  const appRolesSeeded = await seedAppRoles(isSqlite);
  const appPermissionsSeeded = await seedAppPermissions(isSqlite);

  console.log(`[HR Seed] HR tables seeding complete.`);
  console.log(`[HR Seed] Org units: ${orgUnitsSeeded}, Positions: ${positionsSeeded}, Courses: ${trainingCoursesSeeded}, Roles: ${appRolesSeeded}, Permissions: ${appPermissionsSeeded}`);

  return {
    orgUnitsSeeded,
    positionsSeeded,
    trainingCoursesSeeded,
    appRolesSeeded,
    appPermissionsSeeded,
  };
}
