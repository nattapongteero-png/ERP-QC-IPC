// Template Module Service
// This is a prototype service for creating new ERP modules
// Uses centralized db-helper utilities for database operations

import { eq, and, like, desc, asc, sql, count } from 'drizzle-orm';
import { getNow, toDbDate } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
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

// Get tables based on database type using centralized utility
function getTemplateTables() {
  return {
    categories: getTableRef('templateCategories'),
    items: getTableRef('templateItems'),
  };
}

// ============================================
// Template Categories
// ============================================

export async function listTemplateCategories(filters?: { isActive?: boolean; search?: string }) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    const conditions: any[] = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(tables.categories.isActive, filters.isActive));
    }
    if (filters?.search) {
      conditions.push(like(tables.categories.nameTh, `%${filters.search}%`));
    }

    return db
      .select()
      .from(tables.categories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(tables.categories.sortOrder), asc(tables.categories.nameTh));
  });
}

export async function getTemplateCategory(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    const result = await db
      .select()
      .from(tables.categories)
      .where(eq(tables.categories.id, id))
      .limit(1);

    return result[0] || null;
  });
}

export async function createTemplateCategory(data: TemplateCategoryCreate) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Check for duplicate code
    const existing = await db
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

    const result = await db.insert(tables.categories).values(insertData);
    const insertId = getInsertId(result);

    // Fetch and return the created category
    const created = await db
      .select()
      .from(tables.categories)
      .where(eq(tables.categories.id, insertId))
      .limit(1);

    return created[0] || null;
  });
}

export async function updateTemplateCategory(id: number, data: TemplateCategoryUpdate) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Check if category exists
    const existing = await db
      .select()
      .from(tables.categories)
      .where(eq(tables.categories.id, id))
      .limit(1);

    if (existing.length === 0) {
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

    await db.update(tables.categories).set(updateData).where(eq(tables.categories.id, id));

    // Fetch and return the updated category
    const updated = await db
      .select()
      .from(tables.categories)
      .where(eq(tables.categories.id, id))
      .limit(1);

    return updated[0] || null;
  });
}

export async function deleteTemplateCategory(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Check if category has items
    const items = await db
      .select({ count: count() })
      .from(tables.items)
      .where(eq(tables.items.categoryId, id));

    if (items[0]?.count > 0) {
      throw new Error('Cannot delete category with existing items');
    }

    await db.delete(tables.categories).where(eq(tables.categories.id, id));
    return true;
  });
}

// ============================================
// Template Items
// ============================================

export async function listTemplateItems(filters?: TemplateListFilters) {
  return executeDbOperation(async (db) => {
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

    // Apply pagination
    const limit = filters?.limit || 50;
    const page = filters?.page || 1;
    const offset = (page - 1) * limit;

    const items = await db
      .select({
        item: tables.items,
        category: tables.categories,
      })
      .from(tables.items)
      .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tables.items.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
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
  });
}

export async function getTemplateItem(id: number): Promise<TemplateItem | null> {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    const result = await db
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
  });
}

export async function createTemplateItem(data: TemplateItemCreate, userId?: number) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Check for duplicate code
    const existing = await db
      .select()
      .from(tables.items)
      .where(eq(tables.items.code, data.code))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Item with code "${data.code}" already exists`);
    }

    // Validate category if provided
    if (data.categoryId) {
      const category = await db
        .select()
        .from(tables.categories)
        .where(eq(tables.categories.id, data.categoryId))
        .limit(1);

      if (category.length === 0) {
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
      dueDate: data.dueDate ? toDbDate(data.dueDate) : null,
      dueTime: data.dueTime || null,
      notes: data.notes || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: userId || null,
      updatedBy: userId || null,
    };

    const result = await db.insert(tables.items).values(insertData);
    const insertId = getInsertId(result);

    // Fetch and return the created item with category
    const created = await db
      .select({
        item: tables.items,
        category: tables.categories,
      })
      .from(tables.items)
      .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
      .where(eq(tables.items.id, insertId))
      .limit(1);

    if (created.length === 0) return null;

    return {
      ...created[0].item,
      category: created[0].category,
    } as unknown as TemplateItem;
  });
}

export async function updateTemplateItem(id: number, data: TemplateItemUpdate, userId?: number) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Check if item exists
    const existing = await db
      .select()
      .from(tables.items)
      .where(eq(tables.items.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Item not found');
    }

    // Validate category if provided
    if (data.categoryId) {
      const category = await db
        .select()
        .from(tables.categories)
        .where(eq(tables.categories.id, data.categoryId))
        .limit(1);

      if (category.length === 0) {
        throw new Error('Category not found');
      }
    }

    const existingItem = existing[0];
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
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? toDbDate(data.dueDate) : null;
    if (data.dueTime !== undefined) updateData.dueTime = data.dueTime;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Recalculate total value if quantity or unit price changed
    const quantity = data.quantity !== undefined ? data.quantity : existingItem.quantity;
    const unitPrice = data.unitPrice !== undefined ? data.unitPrice : existingItem.unitPrice;

    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
    updateData.totalValue = quantity * unitPrice;

    await db.update(tables.items).set(updateData).where(eq(tables.items.id, id));

    // Fetch and return the updated item with category
    const updated = await db
      .select({
        item: tables.items,
        category: tables.categories,
      })
      .from(tables.items)
      .leftJoin(tables.categories, eq(tables.items.categoryId, tables.categories.id))
      .where(eq(tables.items.id, id))
      .limit(1);

    if (updated.length === 0) return null;

    return {
      ...updated[0].item,
      category: updated[0].category,
    } as unknown as TemplateItem;
  });
}

export async function deleteTemplateItem(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Check if item exists
    const existing = await db
      .select()
      .from(tables.items)
      .where(eq(tables.items.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Item not found');
    }

    await db.delete(tables.items).where(eq(tables.items.id, id));
    return true;
  });
}

// ============================================
// Dashboard Metrics
// ============================================

export async function getTemplateDashboardMetrics(): Promise<TemplateDashboardMetrics> {
  return executeDbOperation(async (db) => {
    const tables = getTemplateTables();

    // Get total counts by status
    const statusCounts = await db
      .select({
        status: tables.items.status,
        count: count(),
      })
      .from(tables.items)
      .groupBy(tables.items.status);

    // Get counts by priority
    const priorityCounts = await db
      .select({
        priority: tables.items.priority,
        count: count(),
      })
      .from(tables.items)
      .groupBy(tables.items.priority);

    // Get counts by category with value
    const categoryCounts = await db
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
    const aggregates = await db
      .select({
        totalItems: count(),
        totalValue: sql<number>`COALESCE(SUM(${tables.items.totalValue}), 0)`,
        avgUnitPrice: sql<number>`COALESCE(AVG(${tables.items.unitPrice}), 0)`,
      })
      .from(tables.items);

    // Get recent items
    const recentItems = await db
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
  });
}
