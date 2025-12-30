/**
 * Variance Analysis Type Definitions (T129)
 * Part of 011-accounting-spec-gap - User Story 6
 */

// Variance types for manufacturing cost analysis
export type VarianceType =
  | 'mpv'      // Material Price Variance
  | 'muv'      // Material Usage Variance
  | 'lrv'      // Labor Rate Variance
  | 'lev'      // Labor Efficiency Variance
  | 'voh_var'  // Variable Overhead Variance
  | 'foh_vol'; // Fixed Overhead Volume Variance

export const VARIANCE_TYPE_LABELS: Record<VarianceType, string> = {
  mpv: 'Material Price Variance',
  muv: 'Material Usage Variance',
  lrv: 'Labor Rate Variance',
  lev: 'Labor Efficiency Variance',
  voh_var: 'Variable Overhead Variance',
  foh_vol: 'Fixed Overhead Volume Variance',
};

// Standard Cost types
export interface StandardCostInput {
  itemId: number;
  effectiveDate: string;
  materialCost?: number;
  laborCost?: number;
  overheadCost?: number;
  standardHours?: number;
  standardLaborRate?: number;
  notes?: string;
  setAsCurrent?: boolean;
}

export interface StandardCostUpdate extends Partial<StandardCostInput> {
  id: number;
}

export interface StandardCost {
  id: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  effectiveDate: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  standardHours: number;
  standardLaborRate: number;
  isCurrent: boolean;
  createdAt: string;
  createdBy?: number;
  createdByName?: string;
  notes?: string | null;
}

export interface StandardCostDetail extends StandardCost {
  materialBreakdown?: {
    componentId: number;
    componentCode: string;
    componentName: string;
    quantity: number;
    unitCost: number;
    extendedCost: number;
  }[];
}

// Variance Record types
export interface VarianceRecordInput {
  workOrderId: number;
  itemId: number;
  varianceType: VarianceType;
  varianceDate: string;
  standardValue: number;
  actualValue: number;
  varianceAmount: number;
  quantity: number;
  notes?: string;
}

export interface VarianceRecord {
  id: number;
  workOrderId: number;
  workOrderNumber?: string;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  varianceType: VarianceType;
  varianceTypeName?: string;
  varianceDate: string;
  standardValue: number;
  actualValue: number;
  varianceAmount: number;
  quantity: number;
  isFavorable: boolean;
  journalEntryId?: number | null;
  journalEntryNumber?: string;
  postedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

// Work Order Variance Summary
export interface WorkOrderVariances {
  workOrderId: number;
  workOrderNumber: string;
  itemCode: string;
  itemName: string;
  quantityProduced: number;
  totalVariance: number;
  isFavorable: boolean;
  variances: VarianceRecord[];
}

// Variance Summary types
export interface VarianceSummary {
  totalVariance: number;
  favorableTotal: number;
  unfavorableTotal: number;
  mpvTotal: number;
  muvTotal: number;
  lrvTotal: number;
  levTotal: number;
  vohVarTotal: number;
  fohVolTotal: number;
}

export interface VarianceSummaryRow {
  groupKey: string;
  groupName: string;
  mpv: number;
  muv: number;
  lrv: number;
  lev: number;
  vohVar: number;
  fohVol: number;
  total: number;
  isFavorable: boolean;
}

// Report types
export type VarianceReportGroupBy = 'item' | 'variance_type' | 'work_order' | 'month';

export interface VarianceSummaryReport {
  period: string;
  totalVariances: number;
  favorableVariances: number;
  unfavorableVariances: number;
  byType: {
    varianceType: VarianceType;
    varianceTypeName: string;
    amount: number;
    isFavorable: boolean;
  }[];
  details: VarianceSummaryRow[];
}

export interface MaterialVarianceReport {
  summary: {
    totalMpv: number;
    totalMuv: number;
    totalMaterialVariance: number;
  };
  items: {
    itemId: number;
    itemCode: string;
    itemName: string;
    standardPrice: number;
    actualPrice: number;
    priceVariance: number;
    standardQty: number;
    actualQty: number;
    usageVariance: number;
    totalVariance: number;
  }[];
}

export interface LaborVarianceReport {
  summary: {
    totalLrv: number;
    totalLev: number;
    totalLaborVariance: number;
  };
  details: {
    workOrderId: number;
    workOrderNumber: string;
    itemCode: string;
    standardHours: number;
    actualHours: number;
    standardRate: number;
    actualRate: number;
    rateVariance: number;
    efficiencyVariance: number;
  }[];
}

// Roll-up types
export interface RollupResult {
  itemsProcessed: number;
  itemsUpdated: number;
  errors: {
    itemId: number;
    itemCode: string;
    error: string;
  }[];
}

// Calculate variance result
export interface CalculateVarianceResult {
  workOrderId: number;
  variancesCreated: number;
  totalVariance: number;
  journalEntryId?: number;
  variances: VarianceRecord[];
}

// Post variance result
export interface PostVarianceResult {
  variancesPosted: number;
  journalEntriesCreated: number;
  totalVarianceAmount: number;
}

// Query filters
export interface VarianceListFilters {
  workOrderId?: number;
  itemId?: number;
  varianceType?: VarianceType;
  dateFrom?: string;
  dateTo?: string;
  isPosted?: boolean;
  page?: number;
  limit?: number;
}

export interface StandardCostListFilters {
  itemId?: number;
  isCurrent?: boolean;
  effectiveDate?: string;
  page?: number;
  limit?: number;
}
