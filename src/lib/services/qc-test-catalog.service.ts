import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '../db/db-helper';
import { auditedInsert, auditedUpdate, auditedDelete } from '../db/audit-wrapper';
import type { QcTestCatalogCreate, QcTestCatalogUpdate, QcTestCategory } from '../validation/qc-test-catalog';

const TABLE = 'qcTestCatalog';

export interface QcTestCatalogFilter {
  search?: string;
  category?: QcTestCategory;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

function getTable() {
  return getTableRef(TABLE);
}

export async function listQcTestCatalog(filter: QcTestCatalogFilter = {}) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    const conditions = [] as any[];

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      conditions.push(or(
        like(table.code, q),
        like(table.name, q),
        like(table.nameTh, q),
      ));
    }
    if (filter.category) conditions.push(eq(table.category, filter.category));
    if (typeof filter.isActive === 'boolean') conditions.push(eq(table.isActive, filter.isActive));

    let query = db.select().from(table);
    if (conditions.length > 0) query = query.where(and(...conditions));
    query = query.orderBy(desc(table.id));
    if (filter.limit) query = query.limit(filter.limit);
    if (filter.offset) query = query.offset(filter.offset);

    return query;
  });
}

export async function getQcTestCatalogById(id: number) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
    return rows[0] ?? null;
  });
}

export async function createQcTestCatalog(data: QcTestCatalogCreate, userId: number) {
  return auditedInsert({ table: TABLE, data, userId });
}

export async function updateQcTestCatalog(id: number, data: QcTestCatalogUpdate, userId: number) {
  return auditedUpdate({ table: TABLE, id, data, userId });
}

export async function deleteQcTestCatalog(id: number, userId: number) {
  // Soft-delete by flipping isActive=false instead of row removal — preserves spec references
  return auditedUpdate({ table: TABLE, id, data: { isActive: false }, userId });
}

export async function hardDeleteQcTestCatalog(id: number, userId: number) {
  return auditedDelete({ table: TABLE, id, userId });
}

export async function countQcTestCatalog(filter: QcTestCatalogFilter = {}) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    const conditions = [] as any[];
    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      conditions.push(or(like(table.code, q), like(table.name, q), like(table.nameTh, q)));
    }
    if (filter.category) conditions.push(eq(table.category, filter.category));
    if (typeof filter.isActive === 'boolean') conditions.push(eq(table.isActive, filter.isActive));

    let query = db.select({ count: sql<number>`count(*)` }).from(table);
    if (conditions.length > 0) query = query.where(and(...conditions));
    const rows = await query;
    return Number(rows[0]?.count ?? 0);
  });
}
