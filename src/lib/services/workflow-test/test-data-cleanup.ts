/**
 * Test Data Cleanup Service
 *
 * Cleans up test data created by workflow tests using prefix-based identification.
 */

import { executeDbOperation, getTableRef } from '@/lib/db/db-helper'
import { like, or } from 'drizzle-orm'
import type { CleanupStatus } from '@/types/workflow-test'

// Default test data prefix
export const DEFAULT_TEST_PREFIX = 'WFTEST_'

// Tables to clean in reverse dependency order
const CLEANUP_ORDER = [
  // Phase 9: HR Flow (most dependent first)
  'HRHealthRecords',
  'HRAuthorizations',
  'HRTrainingRecords',
  'HRTrainingSessions',
  'HRTrainingCourses',
  'HREmployeeAssignments',

  // Phase 8: VMI - no direct table, handled by sync logs
  // 'vmiSyncLogs',

  // Phase 7: Accounting - verification only, no cleanup needed
  // 'journalEntries',
  // 'arInvoices',
  // 'apInvoices',

  // Phase 6: Sales
  // 'shipments',
  'salesOrderLines',
  'salesOrders',
  'customers',

  // Phase 5: Finished Goods QC
  // QC tests cleaned with Phase 3

  // Phase 4: Production
  'workOrderMaterials',
  'workOrders',

  // Phase 3: Purchasing & QC
  'qualityTests',
  'inventoryTransactions',
  'inventoryLots',
  'purchaseOrderLines',
  'purchaseOrders',
  'purchaseRequisitionLines',
  'purchaseRequisitions',
  'approvedVendorList',
  'vendors',

  // Phase 2: BOM
  'BOMLines',
  'BOM',

  // Phase 1: Master Data (employees before positions/org units)
  'HREmployees',
  'HRPositions',
  'HROrgUnits',
  'items',
  'itemCategories',
  'warehouseLocations',
  'warehouses',
]

// Field names that may contain the test prefix
const SEARCHABLE_FIELDS = ['code', 'name', 'lotNumber', 'description', 'employeeCode']

interface TableCleanupResult {
  table: string
  deletedCount: number
  error?: string
}

/**
 * Clean test data from a single table
 */
async function cleanupTable(
  tableName: string,
  prefix: string
): Promise<TableCleanupResult> {
  try {
    const table = getTableRef(tableName)
    if (!table) {
      return { table: tableName, deletedCount: 0, error: 'Table not found' }
    }

    // Build conditions for fields that exist on this table
    const conditions: ReturnType<typeof like>[] = []

    for (const field of SEARCHABLE_FIELDS) {
      if (field in table) {
        const tableField = table[field as keyof typeof table]
        if (tableField) {
          conditions.push(like(tableField as Parameters<typeof like>[0], `${prefix}%`))
        }
      }
    }

    if (conditions.length === 0) {
      return { table: tableName, deletedCount: 0 }
    }

    const result = await executeDbOperation(async (db) => {
      const deleteResult = await db
        .delete(table)
        .where(or(...conditions))

      // Get affected rows count
      const affectedRows = (deleteResult as unknown as { rowsAffected?: number })?.rowsAffected ?? 0
      return affectedRows
    })

    return { table: tableName, deletedCount: result }
  } catch (error) {
    return {
      table: tableName,
      deletedCount: 0,
      error: String(error),
    }
  }
}

/**
 * Clean all test data matching the given prefix
 */
export async function cleanupTestData(
  prefix: string = DEFAULT_TEST_PREFIX
): Promise<CleanupStatus> {
  const startedAt = new Date().toISOString()
  const deletedCounts: Record<string, number> = {}
  const errors: string[] = []

  for (const tableName of CLEANUP_ORDER) {
    const result = await cleanupTable(tableName, prefix)

    if (result.deletedCount > 0) {
      deletedCounts[result.table] = result.deletedCount
    }

    if (result.error) {
      errors.push(`${result.table}: ${result.error}`)
    }
  }

  const completedAt = new Date().toISOString()
  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime()

  return {
    performed: true,
    startedAt,
    completedAt,
    duration,
    deletedCounts,
    errors,
  }
}

/**
 * Check if test data exists
 */
export async function hasTestData(prefix: string = DEFAULT_TEST_PREFIX): Promise<boolean> {
  try {
    // Check a few key tables for test data
    const tablesToCheck = ['items', 'vendors', 'warehouses']

    for (const tableName of tablesToCheck) {
      const table = getTableRef(tableName)
      if (!table) continue

      const codeField = table['code' as keyof typeof table]
      if (!codeField) continue

      const result = await executeDbOperation(async (db) => {
        const rows = await db
          .select()
          .from(table)
          .where(like(codeField as Parameters<typeof like>[0], `${prefix}%`))
          .limit(1)
        return rows.length > 0
      })

      if (result) return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Get count of test data records
 */
export async function getTestDataCounts(
  prefix: string = DEFAULT_TEST_PREFIX
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  for (const tableName of CLEANUP_ORDER) {
    try {
      const table = getTableRef(tableName)
      if (!table) continue

      const codeField = table['code' as keyof typeof table]
      const nameField = table['name' as keyof typeof table]

      if (!codeField && !nameField) continue

      const conditions: ReturnType<typeof like>[] = []
      if (codeField) {
        conditions.push(like(codeField as Parameters<typeof like>[0], `${prefix}%`))
      }
      if (nameField) {
        conditions.push(like(nameField as Parameters<typeof like>[0], `${prefix}%`))
      }

      const count = await executeDbOperation(async (db) => {
        const rows = await db
          .select()
          .from(table)
          .where(or(...conditions))
        return rows.length
      })

      if (count > 0) {
        counts[tableName] = count
      }
    } catch {
      // Skip tables that error
    }
  }

  return counts
}
