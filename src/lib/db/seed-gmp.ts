/**
 * GMP Compliance Auto-Seeder
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Automatically seeds default values for document_types table
 * if it is empty. This runs during server startup after schema sync.
 */

import { sql } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from './index';
import * as schema from './schema';

// Default document types for Document Control (หมวด 5)
// Thai FDA GMP requires controlled documents with proper approval workflows
const defaultDocumentTypes = [
  {
    code: 'SOP',
    name: 'Standard Operating Procedure',
    nameTh: 'ขั้นตอนการปฏิบัติงานมาตรฐาน',
    prefix: 'SOP',
    approvalChain: JSON.stringify(['author', 'reviewer', 'approver']),
    reviewPeriodMonths: 24, // 2 years
  },
  {
    code: 'POL',
    name: 'Policy',
    nameTh: 'นโยบาย',
    prefix: 'POL',
    approvalChain: JSON.stringify(['author', 'reviewer', 'qa_manager', 'management']),
    reviewPeriodMonths: 36, // 3 years
  },
  {
    code: 'FORM',
    name: 'Form/Record',
    nameTh: 'แบบฟอร์ม/บันทึก',
    prefix: 'FRM',
    approvalChain: JSON.stringify(['author', 'approver']),
    reviewPeriodMonths: 24, // 2 years
  },
  {
    code: 'WI',
    name: 'Work Instruction',
    nameTh: 'วิธีปฏิบัติงาน',
    prefix: 'WI',
    approvalChain: JSON.stringify(['author', 'supervisor', 'approver']),
    reviewPeriodMonths: 12, // 1 year
  },
  {
    code: 'SPEC',
    name: 'Specification',
    nameTh: 'ข้อกำหนด',
    prefix: 'SPEC',
    approvalChain: JSON.stringify(['author', 'qa_reviewer', 'qa_manager']),
    reviewPeriodMonths: 24, // 2 years
  },
  {
    code: 'MAN',
    name: 'Manual',
    nameTh: 'คู่มือ',
    prefix: 'MAN',
    approvalChain: JSON.stringify(['author', 'reviewer', 'qa_manager', 'management']),
    reviewPeriodMonths: 36, // 3 years
  },
  {
    code: 'PRO',
    name: 'Protocol',
    nameTh: 'โปรโตคอล',
    prefix: 'PRO',
    approvalChain: JSON.stringify(['author', 'reviewer', 'qa_approver']),
    reviewPeriodMonths: 24, // 2 years
  },
  {
    code: 'RPT',
    name: 'Report Template',
    nameTh: 'แม่แบบรายงาน',
    prefix: 'RPT',
    approvalChain: JSON.stringify(['author', 'reviewer', 'approver']),
    reviewPeriodMonths: 24, // 2 years
  },
  {
    code: 'LOG',
    name: 'Log Book Template',
    nameTh: 'แม่แบบสมุดบันทึก',
    prefix: 'LOG',
    approvalChain: JSON.stringify(['author', 'supervisor']),
    reviewPeriodMonths: 24, // 2 years
  },
  {
    code: 'CHK',
    name: 'Checklist',
    nameTh: 'รายการตรวจสอบ',
    prefix: 'CHK',
    approvalChain: JSON.stringify(['author', 'approver']),
    reviewPeriodMonths: 12, // 1 year
  },
];

/**
 * Check if a table is empty
 */
async function isTableEmpty(tableName: string, isSqlite: boolean): Promise<boolean> {
  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      return (result[0] as { count: number })?.count === 0;
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM \`${tableName}\``));
      return (result[0] as Array<{ count: number }>)[0]?.count === 0;
    }
  } catch (error) {
    // Table might not exist yet or connection issue - assume empty and try to seed
    console.log(`[GMP Seed] Could not check table ${tableName}, will attempt to seed: ${error}`);
    return true;
  }
}

/**
 * Seed document types if table is empty
 */
async function seedDocumentTypes(isSqlite: boolean): Promise<number> {
  const tableName = 'document_types';
  const isEmpty = await isTableEmpty(tableName, isSqlite);

  if (!isEmpty) {
    console.log(`[GMP Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[GMP Seed] Seeding ${tableName} with ${defaultDocumentTypes.length} default values...`);

  try {
    if (isSqlite) {
      const db = getSqliteDb();
      const documentTypesTable = schema.sqliteDocumentTypes;
      for (const docType of defaultDocumentTypes) {
        await db.insert(documentTypesTable).values({
          code: docType.code,
          name: docType.name,
          prefix: docType.prefix,
          approvalChain: docType.approvalChain,
          reviewPeriodMonths: docType.reviewPeriodMonths,
        });
      }
    } else {
      // MySQL version
      const db = await getMysqlDb();
      const documentTypesTable = schema.mysqlDocumentTypes;
      for (const docType of defaultDocumentTypes) {
        await db.insert(documentTypesTable).values({
          code: docType.code,
          name: docType.name,
          prefix: docType.prefix,
          approvalChain: docType.approvalChain,
          reviewPeriodMonths: docType.reviewPeriodMonths,
        });
      }
    }

    console.log(`[GMP Seed] Successfully seeded ${defaultDocumentTypes.length} document types`);
    return defaultDocumentTypes.length;
  } catch (error) {
    console.error(`[GMP Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed all GMP compliance lookup tables if they are empty
 * This function is called during server startup after schema sync
 */
export async function seedGmpTables(): Promise<{
  documentTypesSeeded: number;
}> {
  const usingSqlite = isSqlite();
  console.log(`[GMP Seed] Starting GMP tables seeding for ${usingSqlite ? 'SQLite' : 'MySQL'}...`);

  const documentTypesSeeded = await seedDocumentTypes(isSqlite);

  console.log(`[GMP Seed] GMP tables seeding complete.`);
  console.log(`[GMP Seed] Document types seeded: ${documentTypesSeeded}`);

  return { documentTypesSeeded };
}

// Export default document types for reference
export { defaultDocumentTypes };
