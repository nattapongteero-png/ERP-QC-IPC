// Template Module Types
// This is a prototype module for creating new ERP modules

export type TemplateItemStatus = 'draft' | 'active' | 'archived';
export type TemplateItemPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TemplateItem {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  description: string | null;
  status: TemplateItemStatus;
  priority: TemplateItemPriority;
  categoryId: number | null;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
  // Relations
  category?: TemplateCategory;
  createdByUser?: { id: number; name: string };
  updatedByUser?: { id: number; name: string };
}

export interface TemplateCategory {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  description: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed
  itemCount?: number;
}

export interface TemplateItemCreate {
  code: string;
  nameTh: string;
  nameEn?: string | null;
  description?: string | null;
  status?: TemplateItemStatus;
  priority?: TemplateItemPriority;
  categoryId?: number | null;
  quantity?: number;
  unitPrice?: number;
  notes?: string | null;
}

export interface TemplateItemUpdate {
  nameTh?: string;
  nameEn?: string | null;
  description?: string | null;
  status?: TemplateItemStatus;
  priority?: TemplateItemPriority;
  categoryId?: number | null;
  quantity?: number;
  unitPrice?: number;
  notes?: string | null;
  isActive?: boolean;
}

export interface TemplateCategoryCreate {
  code: string;
  nameTh: string;
  nameEn?: string | null;
  description?: string | null;
  color?: string;
  sortOrder?: number;
}

export interface TemplateCategoryUpdate {
  nameTh?: string;
  nameEn?: string | null;
  description?: string | null;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TemplateListFilters {
  status?: TemplateItemStatus;
  priority?: TemplateItemPriority;
  categoryId?: number;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TemplateDashboardMetrics {
  totalItems: number;
  activeItems: number;
  draftItems: number;
  archivedItems: number;
  totalValue: number;
  avgUnitPrice: number;
  itemsByStatus: { status: string; count: number }[];
  itemsByPriority: { priority: string; count: number }[];
  itemsByCategory: { categoryId: number; categoryName: string; count: number; value: number }[];
  recentItems: TemplateItem[];
  monthlyTrend: { month: string; count: number; value: number }[];
}
