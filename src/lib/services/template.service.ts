// Template Module Service
// This is a prototype service for creating new ERP modules

import { getDb, isSqlite } from '../db';
import { eq, and, like, desc, asc, sql, count } from 'drizzle-orm';
import { getNow } from '../db/date-utils';
import {
  sqliteTemplateCategories,
  sqliteTemplateItems,
  mysqlTemplateCategories,
  mysqlTemplateItems,
} from '../db/schema-template';
import type {
  TemplateItem,
  TemplateCategory,
  TemplateItemCreate,
  TemplateItemUpdate,
  TemplateCategoryCreate,
  TemplateCategoryUpdate,
  TemplateListFilters,
  TemplateDashboardMetrics,
} from '@/types/template';

// Get tables based on database type
export function getTemplateTables() {
  if (isSqlite()) {
    return {
      categories: sqliteTemplateCategories,
      items: sqliteTemplateItems,
    };
  }
  return {
    categories: mysqlTemplateCategories,
    items: mysqlTemplateItems,
  };
}

// ============================================
// Template Categories
// ============================================

export async function listTemplateCategories(filters?: { isActive?: boolean; search?: string }) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const conditions: any[] = [];
  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.categories.isActive, filters.isActive));
  }
  if (filters?.search) {
    conditions.push(like(tables.categories.nameTh, `%${filters.search}%`));
  }

  const categories = await database
    .select()
    .from(tables.categories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(tables.categories.sortOrder), asc(tables.categories.nameTh));

  return categories;
}

export async function getTemplateCategory(id: number) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const result = await database
    .select()
    .from(tables.categories)
    .where(eq(tables.categories.id, id))
    .limit(1);

  return result[0] || null;
}

export async function createTemplateCategory(data: TemplateCategoryCreate) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  // Check for duplicate code
  const existing = await database
    .select()
    .from(tables.categories)
    .where(eq(tables.categories.code, data.code))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Category with code "${data.code}" already exists`);
  }

  const now = getNow();
  const insertData = {
    code: data.code,
    nameTh: data.nameTh,
    nameEn: data.nameEn || null,
    description: data.description || null,
    color: data.color || '#3B82F6',
    sortOrder: data.sortOrder || 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await database.insert(tables.categories).values(insertData);
  const insertId = isSqlite() ? (result as { lastInsertRowid: number }).lastInsertRowid : (result as any)[0].insertId;

  return getTemplateCategory(insertId);
}

export async function updateTemplateCategory(id: number, data: TemplateCategoryUpdate) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const existing = await getTemplateCategory(id);
  if (!existing) {
    throw new Error('Category not found');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: getNow(),
  };

  if (data.nameTh !== undefined) updateData.nameTh = data.nameTh;
  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await database.update(tables.categories).set(updateData).where(eq(tables.categories.id, id));

  return getTemplateCategory(id);
}

export async function deleteTemplateCategory(id: number) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  // Check if category has items
  const items = await database
    .select({ count: count() })
    .from(tables.items)
    .where(eq(tables.items.categoryId, id));

  if (items[0]?.count > 0) {
    throw new Error('Cannot delete category with existing items');
  }

  await database.delete(tables.categories).where(eq(tables.categories.id, id));
  return true;
}

// ============================================
// Template Items
// ============================================

export async function listTemplateItems(filters?: TemplateListFilters) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const conditions: any[] = [];
  if (filters?.status) {
    conditions.push(eq(tables.items.status, filters.status));
  }
  if (filters?.priority) {
    conditions.push(eq(tables.items.priority, filters.priority));
  }
  if (filters?.categoryId) {
    conditions.push(eq(tables.items.categoryId, filters.categoryId));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(tables.items.isActive, filters.isActive));
  }
  if (filters?.search) {
    conditions.push(like(tables.items.nameTh, `%${filters.search}%`));
  }

  const query = database
    .select({
      item: tables.items,
      category: tables.categories,
    })
    .from(tables.items)
    .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tables.items.createdAt));

  // Apply pagination
  const limit = filters?.limit || 50;
  const page = filters?.page || 1;
  const offset = (page - 1) * limit;

  const items = await query.limit(limit).offset(offset);

  // Get total count
  const totalResult = await database
    .select({ count: count() })
    .from(tables.items)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    items: items.map((row: any) => ({
      ...row.item,
      category: row.category,
    })),
    total: totalResult[0]?.count || 0,
    page,
    limit,
    totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
  };
}

export async function getTemplateItem(id: number): Promise<TemplateItem | null> {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const result = await database
    .select({
      item: tables.items,
      category: tables.categories,
    })
    .from(tables.items)
    .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
    .where(eq(tables.items.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0].item,
    category: result[0].category,
  } as unknown as TemplateItem;
}

export async function createTemplateItem(data: TemplateItemCreate, userId?: number) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  // Check for duplicate code
  const existing = await database
    .select()
    .from(tables.items)
    .where(eq(tables.items.code, data.code))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Item with code "${data.code}" already exists`);
  }

  // Validate category if provided
  if (data.categoryId) {
    const category = await getTemplateCategory(data.categoryId);
    if (!category) {
      throw new Error('Category not found');
    }
  }

  const now = getNow();
  const quantity = data.quantity || 0;
  const unitPrice = data.unitPrice || 0;
  const totalValue = quantity * unitPrice;

  const insertData = {
    code: data.code,
    nameTh: data.nameTh,
    nameEn: data.nameEn || null,
    description: data.description || null,
    status: data.status || 'draft',
    priority: data.priority || 'medium',
    categoryId: data.categoryId || null,
    quantity,
    unitPrice,
    totalValue,
    notes: data.notes || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: userId || null,
    updatedBy: userId || null,
  };

  const result = await database.insert(tables.items).values(insertData);
  const insertId = isSqlite() ? (result as { lastInsertRowid: number }).lastInsertRowid : (result as any)[0].insertId;

  return getTemplateItem(insertId);
}

export async function updateTemplateItem(id: number, data: TemplateItemUpdate, userId?: number) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const existing = await getTemplateItem(id);
  if (!existing) {
    throw new Error('Item not found');
  }

  // Validate category if provided
  if (data.categoryId) {
    const category = await getTemplateCategory(data.categoryId);
    if (!category) {
      throw new Error('Category not found');
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: getNow(),
    updatedBy: userId || null,
  };

  if (data.nameTh !== undefined) updateData.nameTh = data.nameTh;
  if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Recalculate total value if quantity or unit price changed
  const quantity = data.quantity !== undefined ? data.quantity : existing.quantity;
  const unitPrice = data.unitPrice !== undefined ? data.unitPrice : existing.unitPrice;

  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
  updateData.totalValue = quantity * unitPrice;

  await database.update(tables.items).set(updateData).where(eq(tables.items.id, id));

  return getTemplateItem(id);
}

export async function deleteTemplateItem(id: number) {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  const existing = await getTemplateItem(id);
  if (!existing) {
    throw new Error('Item not found');
  }

  await database.delete(tables.items).where(eq(tables.items.id, id));
  return true;
}

// ============================================
// Dashboard Metrics
// ============================================

export async function getTemplateDashboardMetrics(): Promise<TemplateDashboardMetrics> {
  const database = (await getDb()) as any;
  const tables = getTemplateTables();

  // Get total counts by status
  const statusCounts = await database
    .select({
      status: tables.items.status,
      count: count(),
    })
    .from(tables.items)
    .groupBy(tables.items.status);

  // Get counts by priority
  const priorityCounts = await database
    .select({
      priority: tables.items.priority,
      count: count(),
    })
    .from(tables.items)
    .groupBy(tables.items.priority);

  // Get counts by category with value
  const categoryCounts = await database
    .select({
      categoryId: tables.items.categoryId,
      categoryName: tables.categories.nameTh,
      count: count(),
      value: sql<number>`SUM(${tables.items.totalValue})`,
    })
    .from(tables.items)
    .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
    .groupBy(tables.items.categoryId, tables.categories.nameTh);

  // Get aggregated metrics
  const aggregates = await database
    .select({
      totalItems: count(),
      totalValue: sql<number>`COALESCE(SUM(${tables.items.totalValue}), 0)`,
      avgUnitPrice: sql<number>`COALESCE(AVG(${tables.items.unitPrice}), 0)`,
    })
    .from(tables.items);

  // Get recent items
  const recentItems = await database
    .select({
      item: tables.items,
      category: tables.categories,
    })
    .from(tables.items)
    .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
    .orderBy(desc(tables.items.createdAt))
    .limit(5);

  // Calculate status-specific counts
  const totalItems = aggregates[0]?.totalItems || 0;
  const activeItems = statusCounts.find((s: any) => s.status === 'active')?.count || 0;
  const draftItems = statusCounts.find((s: any) => s.status === 'draft')?.count || 0;
  const archivedItems = statusCounts.find((s: any) => s.status === 'archived')?.count || 0;

  // Generate sample monthly trend data (in real implementation, this would be from actual data)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthlyTrend = months.map((month) => ({
    month,
    count: Math.floor(Math.random() * 50) + 10,
    value: Math.floor(Math.random() * 100000) + 50000,
  }));

  return {
    totalItems,
    activeItems,
    draftItems,
    archivedItems,
    totalValue: Number(aggregates[0]?.totalValue) || 0,
    avgUnitPrice: Number(aggregates[0]?.avgUnitPrice) || 0,
    itemsByStatus: statusCounts.map((s: any) => ({
      status: s.status,
      count: s.count,
    })),
    itemsByPriority: priorityCounts.map((p: any) => ({
      priority: p.priority,
      count: p.count,
    })),
    itemsByCategory: categoryCounts.map((c: any) => ({
      categoryId: c.categoryId || 0,
      categoryName: c.categoryName || 'Uncategorized',
      count: c.count,
      value: Number(c.value) || 0,
    })),
    recentItems: recentItems.map((r: any) => ({
      ...r.item,
      category: r.category,
    })) as unknown as TemplateItem[],
    monthlyTrend,
  };
}
