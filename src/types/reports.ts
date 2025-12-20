/**
 * TypeScript types for DevExpress Reports integration
 */

// Report Category
export interface ReportCategory {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: ReportCategory[];
}

// Report Template
export interface ReportTemplate {
  id: number;
  name: string;
  description: string | null;
  code: string;
  categoryId: number | null;
  definition: string;
  dataSourceConfig: DataSourceConfig | null;
  parametersSchema: ParametersSchema | null;
  version: number;
  isPublished: boolean;
  isSystem: boolean;
  thumbnail: string | null; // Base64 encoded
  createdBy: number;
  createdAt: Date;
  updatedBy: number | null;
  updatedAt: Date;
  category?: ReportCategory;
}

// Report Permission
export interface ReportPermission {
  id: number;
  templateId: number;
  role: string;
  canView: boolean;
  canDesign: boolean;
  canExport: boolean;
  createdAt: Date;
}

// Report Execution (Audit Trail)
export interface ReportExecution {
  id: number;
  templateId: number;
  userId: number;
  action: 'view' | 'export' | 'print';
  parameters: Record<string, unknown> | null;
  exportFormat: string | null;
  executedAt: Date;
  durationMs: number | null;
  status: 'success' | 'error' | 'cancelled';
  errorMessage: string | null;
  ipAddress: string | null;
}

// Data Source Configuration
export interface DataSourceConfig {
  sources: DataSource[];
}

export interface DataSource {
  name: string;
  type: 'json' | 'sql' | 'object';
  endpoint?: string;
  connectionString?: string;
  parameters?: string[];
}

// Report Parameters Schema
export interface ParametersSchema {
  parameters: ReportParameter[];
}

export interface ReportParameter {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  dataSource?: string;
  default?: unknown;
  required: boolean;
  options?: { label: string; value: unknown }[];
}

// API Request/Response Types
export interface CreateReportTemplateRequest {
  name: string;
  description?: string;
  code: string;
  categoryId?: number;
  definition: string;
  dataSourceConfig?: DataSourceConfig;
  parametersSchema?: ParametersSchema;
}

export interface UpdateReportTemplateRequest {
  name?: string;
  description?: string;
  categoryId?: number;
  definition?: string;
  dataSourceConfig?: DataSourceConfig;
  parametersSchema?: ParametersSchema;
}

export interface ReportTemplateListItem {
  id: number;
  name: string;
  description: string | null;
  code: string;
  categoryId: number | null;
  categoryName: string | null;
  version: number;
  isPublished: boolean;
  isSystem: boolean;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportTemplateListResponse {
  items: ReportTemplateListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parentId?: number;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  parentId?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SetPermissionsRequest {
  permissions: {
    role: string;
    canView: boolean;
    canDesign: boolean;
    canExport: boolean;
  }[];
}

export interface LogReportExecutionRequest {
  templateId: number;
  action: 'view' | 'export' | 'print';
  parameters?: Record<string, unknown>;
  exportFormat?: string;
  durationMs?: number;
  status: 'success' | 'error' | 'cancelled';
  errorMessage?: string;
}

// Report Viewer/Designer Component Props
export interface ReportViewerProps {
  reportUrl: string;
  parameters?: Record<string, unknown>;
  onReportReady?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface ReportDesignerProps {
  reportUrl: string;
  onSaved?: (url: string) => void;
  onError?: (error: Error) => void;
  className?: string;
}

// Available export formats
export type ExportFormat = 'pdf' | 'xlsx' | 'docx' | 'html' | 'csv' | 'png' | 'jpeg';

// Report data endpoint response types (for custom data sources)
export interface InventoryValuationData {
  itemCode: string;
  itemName: string;
  category: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  lotNumber?: string;
  expirationDate?: Date;
}

export interface LotStatusData {
  lotNumber: string;
  itemCode: string;
  itemName: string;
  status: string;
  quantity: number;
  manufacturingDate: Date;
  expirationDate: Date;
  warehouseCode: string;
  warehouseName: string;
}

export interface ProductionSummaryData {
  workOrderNumber: string;
  productCode: string;
  productName: string;
  plannedQuantity: number;
  completedQuantity: number;
  startDate: Date;
  endDate?: Date;
  status: string;
  yieldPercentage: number;
}
