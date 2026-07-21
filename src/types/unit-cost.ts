// Unit Cost Calculation System Types
// Feature: 014-unit-cost

// ============================================================================
// ENUMS
// ============================================================================

export type CostLayerTransactionType = 'receipt' | 'landed_cost' | 'adjustment' | 'return';

export type LandedCostType = 'freight' | 'duty' | 'insurance' | 'handling' | 'inspection' | 'other';

export type AllocationBasis = 'value' | 'quantity' | 'weight' | 'volume';

export type LandedCostStatus = 'draft' | 'allocated' | 'posted';

export type LandedCostReferenceType = 'po' | 'shipment';

export type OverheadType = 'fixed' | 'variable' | 'mixed';

export type OverheadAllocationBasis = 'labor_hours' | 'machine_hours' | 'units' | 'direct_labor_cost';

export type WorkOrderOperationStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type WorkOrderCostStatus = 'in_progress' | 'completed' | 'adjusted';

export type CostGLTransactionType =
  | 'material_receipt'
  | 'landed_cost'
  | 'material_issue'
  | 'labor'
  | 'overhead'
  | 'fg_transfer'
  | 'cogs'
  | 'variance';

export type ItemType = 'raw_material' | 'packaging' | 'wip' | 'finished_goods' | 'consumable';

// ============================================================================
// WORK CENTERS
// ============================================================================

export interface WorkCenter {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  orgUnitId: number | null;
  orgUnitName?: string | null;
  laborRatePerHour: number;
  overheadRatePerHour: number;
  machineRatePerHour: number;
  capacityHoursPerDay: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkCenterCreate {
  code: string;
  name: string;
  nameTh?: string | null;
  orgUnitId?: number | null;
  laborRatePerHour?: number;
  overheadRatePerHour?: number;
  machineRatePerHour?: number;
  capacityHoursPerDay?: number | null;
  isActive?: boolean;
}

export interface WorkCenterUpdate {
  code?: string;
  name?: string;
  nameTh?: string | null;
  orgUnitId?: number | null;
  laborRatePerHour?: number;
  overheadRatePerHour?: number;
  machineRatePerHour?: number;
  capacityHoursPerDay?: number | null;
  isActive?: boolean;
}

// ============================================================================
// COST LAYERS (WAC Audit Trail)
// ============================================================================

export interface ItemCostLayer {
  id: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  transactionType: CostLayerTransactionType;
  transactionId: number;
  transactionDate: string;
  quantityIn: number;
  unitCost: number;
  totalCost: number;
  runningQty: number;
  runningTotalCost: number;
  runningWAC: number;
  notes: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
}

export interface ItemCostLayerCreate {
  itemId: number;
  transactionType: CostLayerTransactionType;
  transactionId: number;
  transactionDate: string;
  quantityIn: number;
  unitCost: number;
  totalCost: number;
  runningQty: number;
  runningTotalCost: number;
  runningWAC: number;
  notes?: string | null;
  createdBy: number;
}

// ============================================================================
// LANDED COSTS
// ============================================================================

export interface LandedCostHeader {
  id: number;
  documentNumber: string;
  referenceType: LandedCostReferenceType;
  referenceId: number;
  referenceNumber?: string;
  vendorId: number | null;
  vendorName?: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  status: LandedCostStatus;
  postedAt: string | null;
  postedBy: number | null;
  postedByName?: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  lines?: LandedCostLine[];
  allocations?: LandedCostAllocation[];
}

export interface LandedCostHeaderCreate {
  referenceType: LandedCostReferenceType;
  referenceId: number;
  vendorId?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string;
  exchangeRate?: number;
  lines?: LandedCostLineCreate[];
}

export interface LandedCostHeaderUpdate {
  vendorId?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string;
  exchangeRate?: number;
  lines?: LandedCostLineCreate[];
}

export interface LandedCostLine {
  id: number;
  landedCostHeaderId: number;
  costType: LandedCostType;
  description: string | null;
  amount: number;
  allocationBasis: AllocationBasis;
  createdAt: string;
}

export interface LandedCostLineCreate {
  costType: LandedCostType;
  description?: string | null;
  amount: number;
  allocationBasis?: AllocationBasis;
}

export interface LandedCostAllocation {
  id: number;
  landedCostLineId: number;
  landedCostHeaderId: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  lotId: number | null;
  lotNumber?: string | null;
  poLineId: number | null;
  allocatedAmount: number;
  basisValue: number;
  perUnitAllocation?: number;
  createdAt: string;
}

export interface LandedCostAllocationCreate {
  landedCostLineId: number;
  landedCostHeaderId: number;
  itemId: number;
  lotId?: number | null;
  poLineId?: number | null;
  allocatedAmount: number;
  basisValue: number;
}

// ============================================================================
// OVERHEAD RATES
// ============================================================================

export interface OverheadRate {
  id: number;
  code: string;
  name: string;
  orgUnitId: number | null;
  orgUnitName?: string | null;
  workCenterId: number | null;
  workCenterCode?: string | null;
  overheadType: OverheadType;
  allocationBasis: OverheadAllocationBasis;
  ratePerUnit: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  glAccountId: number | null;
  glAccountCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OverheadRateCreate {
  code: string;
  name: string;
  orgUnitId?: number | null;
  workCenterId?: number | null;
  overheadType: OverheadType;
  allocationBasis: OverheadAllocationBasis;
  ratePerUnit: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  glAccountId?: number | null;
  isActive?: boolean;
}

export interface OverheadRateUpdate {
  name?: string;
  ratePerUnit?: number;
  effectiveTo?: string | null;
  isActive?: boolean;
}

// ============================================================================
// WORK ORDER OPERATIONS (Time Tracking)
// ============================================================================

export interface WorkOrderOperation {
  id: number;
  workOrderId: number;
  operationId: number;
  workCenterId: number;
  workCenterCode?: string;
  workCenterName?: string;
  sequence: number;
  operationName?: string;
  plannedHours: number;
  actualHours: number | null;
  laborRate: number;
  laborCost: number | null;
  overheadRate: number;
  overheadCost: number | null;
  startTime: string | null;
  endTime: string | null;
  operatorId: number | null;
  operatorName?: string | null;
  status: WorkOrderOperationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderOperationCreate {
  workOrderId: number;
  operationId: number;
  workCenterId: number;
  sequence: number;
  plannedHours: number;
  laborRate: number;
  overheadRate: number;
}

export interface WorkOrderOperationUpdate {
  actualHours?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  operatorId?: number | null;
  status?: WorkOrderOperationStatus;
  notes?: string | null;
}

// ============================================================================
// WORK ORDER COSTS (Aggregated Summary)
// ============================================================================

export interface WorkOrderCost {
  id: number;
  workOrderId: number;
  workOrderNumber?: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  producedQuantity: number | null;
  unitCost: number | null;
  status: WorkOrderCostStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderCostUpsert {
  workOrderId: number;
  materialCost?: number;
  laborCost?: number;
  overheadCost?: number;
  totalCost?: number;
  producedQuantity?: number | null;
  unitCost?: number | null;
  status?: WorkOrderCostStatus;
  completedAt?: string | null;
}

// ============================================================================
// COST GL MAPPING
// ============================================================================

export interface CostGLMapping {
  id: number;
  transactionType: CostGLTransactionType;
  itemType: ItemType;
  debitAccountId: number;
  debitAccountCode?: string;
  debitAccountName?: string;
  creditAccountId: number;
  creditAccountCode?: string;
  creditAccountName?: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostGLMappingCreate {
  transactionType: CostGLTransactionType;
  itemType: ItemType;
  debitAccountId: number;
  creditAccountId: number;
  description?: string | null;
  isActive?: boolean;
}

export interface CostGLMappingUpdate {
  debitAccountId?: number;
  creditAccountId?: number;
  description?: string | null;
  isActive?: boolean;
}

// ============================================================================
// COST VIEWS (Item Cost Summary)
// ============================================================================

export interface ItemCostViews {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  uom: string;
  onHand: number;
  // Cost Views
  inventoryCost: number | null; // Current WAC
  standardCost: number | null;
  lastPurchaseCost: number | null;
  lastPurchaseDate: string | null;
  lastProductionCost: number | null;
  lastProductionDate: string | null;
  fullCost: number | null; // WAC + SG&A allocation
  // Computed
  onHandValue: number;
  sgaAllocationRate: number;
}

// ============================================================================
// WAC CALCULATION
// ============================================================================

export interface RecalculateWACInput {
  itemId: number;
  transactionType: CostLayerTransactionType;
  transactionId: number;
  quantity: number;
  unitCost: number;
  transactionDate: string;
  notes?: string | null;
  createdBy: number;
  /**
   * Value-only cost adjustment (landed cost, freight, duty). When true, `unitCost`
   * is read as the TOTAL amount to add to the item's on-hand cost — quantity does
   * not change and WAC is re-struck over the existing quantity. Without this flag a
   * quantity of 0 makes `quantity * unitCost` collapse to 0, so the extra cost never
   * reaches inventory value (the landed-cost-lost bug).
   */
  costAdjustmentOnly?: boolean;
}

export interface RecalculateWACResult {
  previousWAC: number;
  newWAC: number;
  costLayerId: number;
  previousQty: number;
  newQty: number;
}

// ============================================================================
// LANDED COST ALLOCATION RESULT
// ============================================================================

export interface AllocationResult {
  status: 'allocated';
  totalAllocated: number;
  itemCount: number;
  allocations: LandedCostAllocation[];
}

export interface PostResult {
  status: 'posted';
  postedAt: string;
  journalEntryId: number | null;
  costLayersCreated: number;
  itemsUpdated: number;
}

// ============================================================================
// PRODUCTION COST SUMMARY
// ============================================================================

export interface ProductionCostSummary {
  workOrderId: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number | null;
}

// ============================================================================
// DASHBOARD & REPORTS
// ============================================================================

export interface CostDashboardKPIs {
  inventoryValue: number;
  inventoryValueChange: number;
  wipValue: number;
  wipValueChange: number;
  avgMaterialCostChange: number;
  grossMarginPercent: number;
  grossMarginPercentPrior: number;
  favorableVariance: number;
  unfavorableVariance: number;
  topCostIncreases: ItemCostChange[];
  topMarginErosion: ItemMarginChange[];
  costTrend: CostTrendPoint[];
}

export interface ItemCostChange {
  itemId: number;
  itemCode: string;
  itemName: string;
  previousCost: number;
  currentCost: number;
  changePercent: number;
}

export interface ItemMarginChange {
  itemId: number;
  itemCode: string;
  itemName: string;
  previousMargin: number;
  currentMargin: number;
  changePercent: number;
}

export interface CostTrendPoint {
  period: string; // YYYY-MM format
  avgMaterialCost: number;
  avgProductionCost: number;
  avgGrossMargin: number;
}

export interface ItemCostSummaryRow {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  categoryName: string | null;
  uom: string;
  onHand: number;
  currentWAC: number | null;
  onHandValue: number;
  standardCost: number | null;
  lastPurchaseCost: number | null;
  lastPurchaseDate: string | null;
  lastProductionCost: number | null;
  lastProductionDate: string | null;
  fullCost: number | null;
}

export interface ProductionCostRow {
  workOrderId: number;
  workOrderNumber: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  plannedQty: number;
  producedQty: number | null;
  completedDate: string | null;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number | null;
  standardUnitCost: number | null;
  varianceAmount: number | null;
  variancePercent: number | null;
  status: string;
}

export interface MarginAnalysisRow {
  groupKey: string;
  groupId: number | null;
  groupName: string;
  revenue: number;
  cogs: number;
  grossMargin: number;
  marginPercent: number;
  quantity: number;
  orderCount: number;
}

export interface LandedCostAnalysisRow {
  poNumber: string;
  vendorName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  poValue: number;
  freightCost: number;
  dutyCost: number;
  insuranceCost: number;
  otherCost: number;
  totalLandedCost: number;
  totalCost: number;
  landedCostPercent: number;
  unitCost: number;
}

// ============================================================================
// LIST FILTERS
// ============================================================================

export interface WorkCenterListFilters {
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CostLayerListFilters {
  itemId?: number;
  transactionType?: CostLayerTransactionType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface LandedCostListFilters {
  status?: LandedCostStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface OverheadRateListFilters {
  workCenterId?: number;
  isActive?: boolean;
  effectiveDate?: string;
}

// ============================================================================
// COGS CALCULATION
// ============================================================================

export interface COGSLineInput {
  itemId: number;
  quantity: number;
  unitCost: number;
}

export interface COGSResult {
  lineId: number;
  unitCost: number;
  totalCost: number;
  marginAmount: number;
  marginPercent: number;
}

// ============================================================================
// EXECUTIVE DASHBOARD TYPES
// ============================================================================

export interface KPIValue {
  current: number;
  prior: number;
  budget: number | null;
  changePercent: number;
  changeDirection: 'up' | 'down' | 'flat';
  status: 'good' | 'warning' | 'critical' | 'neutral';
}

export interface FinancialHealthKPIs {
  inventoryValue: KPIValue;
  cogsMTD: KPIValue;
  grossMarginPercent: KPIValue;
  netCostVariance: KPIValue;
  inventoryByCategory: { category: string; value: number; percent: number; change: number }[];
}

export interface MaterialCostKPIs {
  purchasesMTD: KPIValue;
  landedCostPercent: KPIValue;
  avgMaterialCostChange: KPIValue;
  inventoryTurnover: KPIValue;
  daysInventoryOutstanding: KPIValue;
  topCostIncreases: ItemCostChange[];
  purchasesBySupplier: { supplierId: number; supplierName: string; amount: number; percent: number }[];
}

export interface ProductionCostKPIs {
  wipValue: KPIValue;
  productionCostMTD: KPIValue;
  laborEfficiency: KPIValue;
  overheadAbsorption: KPIValue;
  avgUnitCost: KPIValue;
  productionVariance: KPIValue;
  costBreakdown: { material: number; labor: number; overhead: number };
  byWorkCenter: { workCenterId: number; workCenterName: string; laborCost: number; overheadCost: number; efficiency: number }[];
}

export interface MarginKPIs {
  revenueMTD: KPIValue;
  grossProfitMTD: KPIValue;
  marginByCategory: { category: string; revenue: number; cogs: number; margin: number; marginPercent: number; change: number }[];
  marginErosion: ItemMarginChange[];
  topMarginProducts: { itemId: number; itemCode: string; itemName: string; marginPercent: number }[];
}

export interface CostAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'cost' | 'variance' | 'margin' | 'inventory';
  title: string;
  description: string;
  value: number;
  threshold: number;
  entityId?: number;
}

export interface TrendDataPoint {
  period: string;
  grossMargin: number;
  avgUnitCost: number;
}

export interface MoMComparisonRow {
  metric: string;
  thisMonth: number;
  lastMonth: number;
  change: number;
  changePercent: number;
  unit: 'currency' | 'percent' | 'number' | 'days';
}

export interface ExecutiveDashboardKPIs {
  period: { from: string; to: string; label: string };
  priorPeriod: { from: string; to: string; label: string };
  financialHealth: FinancialHealthKPIs;
  materialCosts: MaterialCostKPIs;
  productionCosts: ProductionCostKPIs;
  margins: MarginKPIs;
  alerts: CostAlert[];
  trends: TrendDataPoint[];
  momComparison: MoMComparisonRow[];
}

export interface DashboardPeriodParams {
  periodType: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'ytd' | 'custom';
  fromDate?: string;
  toDate?: string;
}
