// Accounting Module - TypeScript Types
// Feature: 010-accounting-module-integration

// ============================================
// Enums
// ============================================

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type NormalBalance = 'debit' | 'credit';

export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';

export type JournalSourceType =
  | 'PO_RECEIPT'
  | 'SO_SHIPMENT'
  | 'AP_PAYMENT'
  | 'AR_RECEIPT'
  | 'DEPRECIATION'
  | 'PAYROLL'
  | 'COST_ALLOCATION'
  | 'PERIOD_CLOSE'
  | 'MANUAL';

export type APInvoiceStatus = 'draft' | 'approved' | 'posted' | 'partial' | 'paid' | 'cancelled';

export type ARInvoiceStatus = 'draft' | 'confirmed' | 'posted' | 'partial' | 'paid' | 'cancelled';

export type PaymentType = 'ap' | 'ar';

export type PaymentMethod = 'cash' | 'check' | 'transfer' | 'other';

export type PaymentStatus = 'pending' | 'completed' | 'cancelled';

export type FiscalPeriodStatus = 'open' | 'soft_closed' | 'closed';

export type FiscalYearStatus = 'open' | 'closed';

export type VATTransactionType = 'input' | 'output';

export type WHTCertificateType = 'pnd3' | 'pnd53';

export type DepreciationMethod = 'straight_line' | 'declining_balance';

export type AssetStatus = 'active' | 'disposed' | 'fully_depreciated';

export type DisposalType = 'sale' | 'write_off' | 'scrap' | 'transfer';

export type MaintenanceIntervalType = 'days' | 'weeks' | 'months' | 'hours' | 'units';

export type MaintenanceType = 'preventive' | 'corrective' | 'emergency';

// ============================================
// GL Account Types
// ============================================

export interface GLAccountType {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  category: AccountCategory;
  normalBalance: NormalBalance;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GLAccountTypeCreate {
  code: string;
  nameTh: string;
  nameEn: string;
  category: AccountCategory;
  normalBalance: NormalBalance;
  displayOrder?: number;
}

// ============================================
// GL Account (Chart of Accounts)
// ============================================

export interface GLAccount {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  accountTypeId: number;
  parentId: number | null;
  level: number;
  isActive: boolean;
  isPostable: boolean;
  isBankAccount: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  description: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  accountType?: GLAccountType;
  parent?: GLAccount | null;
  children?: GLAccount[];
}

export interface GLAccountCreate {
  code: string;
  nameTh: string;
  nameEn: string;
  accountTypeId: number;
  parentId?: number | null;
  isPostable?: boolean;
  isBankAccount?: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  description?: string;
}

export interface GLAccountUpdate {
  nameTh?: string;
  nameEn?: string;
  accountTypeId?: number;
  parentId?: number | null;
  isActive?: boolean;
  isPostable?: boolean;
  isBankAccount?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  description?: string | null;
}

export interface GLAccountTreeNode extends GLAccount {
  children: GLAccountTreeNode[];
  balance?: number;
}

export interface GLAccountBalance {
  accountId: number;
  accountCode: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  asOfDate: string;
}

// ============================================
// Journal Entry
// ============================================

export interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  fiscalPeriodId: number;
  description: string | null;
  sourceType: JournalSourceType | null;
  sourceId: number | null;
  status: JournalEntryStatus;
  totalDebit: number;
  totalCredit: number;
  postedBy: number | null;
  postedAt: string | null;
  reversedBy: number | null;
  reversedAt: string | null;
  reversalEntryId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  lines?: JournalLine[];
  fiscalPeriod?: FiscalPeriod;
}

export interface JournalEntryCreate {
  entryDate: string;
  fiscalPeriodId?: number;
  description?: string;
  sourceType?: JournalSourceType;
  sourceId?: number;
  lines: JournalLineCreate[];
}

export interface JournalEntryUpdate {
  entryDate?: string;
  description?: string;
  lines?: JournalLineCreate[];
}

export interface JournalLine {
  id: number;
  journalEntryId: number;
  lineNumber: number;
  glAccountId: number;
  debit: number;
  credit: number;
  description: string | null;
  costCenterId: number | null;
  createdAt: string;
  // Populated fields
  glAccount?: GLAccount;
}

export interface JournalLineCreate {
  glAccountId: number;
  debit: number;
  credit: number;
  description?: string;
  costCenterId?: number;
}

// ============================================
// Fiscal Year and Period
// ============================================

export interface FiscalYear {
  id: number;
  yearCode: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: FiscalYearStatus;
  closedBy: number | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  periods?: FiscalPeriod[];
}

export interface FiscalYearCreate {
  yearCode: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

export interface FiscalPeriod {
  id: number;
  fiscalYearId: number;
  periodNumber: number;
  periodName: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
  closedBy: number | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  fiscalYear?: FiscalYear;
}

export interface FiscalPeriodCreate {
  fiscalYearId: number;
  periodNumber: number;
  periodName: string;
  startDate: string;
  endDate: string;
}

// ============================================
// Accounts Payable (AP) Invoice
// ============================================

export interface APInvoice {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  purchaseOrderId: number | null;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  exchangeRate: number;
  status: APInvoiceStatus;
  approvedBy: number | null;
  approvedAt: string | null;
  journalEntryId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  lines?: APInvoiceLine[];
  vendor?: { id: number; name: string };
  journalEntry?: JournalEntry;
}

export interface APInvoiceCreate {
  invoiceNumber: string;
  vendorId: number;
  purchaseOrderId?: number;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
  description?: string;
  currency?: string;
  exchangeRate?: number;
  lines: APInvoiceLineCreate[];
}

export interface APInvoiceUpdate {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  description?: string;
  lines?: APInvoiceLineCreate[];
}

export interface APInvoiceLine {
  id: number;
  apInvoiceId: number;
  lineNumber: number;
  description: string;
  itemId: number | null;
  glAccountId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  isCapitalizable: boolean;
  createdAt: string;
  // Populated fields
  item?: { id: number; name: string };
  glAccount?: GLAccount;
}

export interface APInvoiceLineCreate {
  description: string;
  itemId?: number;
  glAccountId: number;
  quantity: number;
  unitPrice: number;
  isCapitalizable?: boolean;
}

// ============================================
// Accounts Receivable (AR) Invoice
// ============================================

export interface ARInvoice {
  id: number;
  invoiceNumber: string;
  taxInvoiceNumber: string;
  customerId: number;
  salesOrderId: number | null;
  invoiceDate: string;
  dueDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  exchangeRate: number;
  status: ARInvoiceStatus;
  confirmedBy: number | null;
  confirmedAt: string | null;
  journalEntryId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  lines?: ARInvoiceLine[];
  customer?: { id: number; name: string };
  journalEntry?: JournalEntry;
}

export interface ARInvoiceCreate {
  invoiceNumber: string;
  customerId: number;
  salesOrderId?: number;
  invoiceDate: string;
  dueDate: string;
  description?: string;
  currency?: string;
  exchangeRate?: number;
  lines: ARInvoiceLineCreate[];
}

export interface ARInvoiceUpdate {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  description?: string;
  lines?: ARInvoiceLineCreate[];
}

export interface ARInvoiceLine {
  id: number;
  arInvoiceId: number;
  lineNumber: number;
  description: string;
  itemId: number | null;
  glAccountId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  lotId: number | null;
  createdAt: string;
  // Populated fields
  item?: { id: number; name: string };
  glAccount?: GLAccount;
}

export interface ARInvoiceLineCreate {
  description: string;
  itemId?: number;
  glAccountId: number;
  quantity: number;
  unitPrice: number;
  lotId?: number;
}

// ============================================
// Payment
// ============================================

export interface Payment {
  id: number;
  paymentNumber: string;
  paymentType: PaymentType;
  paymentDate: string;
  vendorId: number | null;
  customerId: number | null;
  bankAccountId: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  amount: number;
  whtAmount: number;
  description: string | null;
  status: PaymentStatus;
  journalEntryId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  allocations?: PaymentAllocation[];
  bankAccount?: GLAccount;
  journalEntry?: JournalEntry;
}

export interface PaymentCreate {
  paymentType: PaymentType;
  paymentDate: string;
  vendorId?: number;
  customerId?: number;
  bankAccountId: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  amount: number;
  whtAmount?: number;
  description?: string;
  allocations: PaymentAllocationCreate[];
}

export interface PaymentAllocation {
  id: number;
  paymentId: number;
  apInvoiceId: number | null;
  arInvoiceId: number | null;
  allocatedAmount: number;
  createdAt: string;
}

export interface PaymentAllocationCreate {
  apInvoiceId?: number;
  arInvoiceId?: number;
  allocatedAmount: number;
}

// ============================================
// VAT Transaction
// ============================================

export interface VATTransaction {
  id: number;
  transactionType: VATTransactionType;
  taxInvoiceNumber: string;
  taxInvoiceDate: string;
  taxPeriod: string;
  vendorId: number | null;
  customerId: number | null;
  partyName: string;
  partyTaxId: string;
  branchCode: string;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  apInvoiceId: number | null;
  arInvoiceId: number | null;
  createdAt: string;
}

export interface VATTransactionCreate {
  transactionType: VATTransactionType;
  taxInvoiceNumber: string;
  taxInvoiceDate: string;
  taxPeriod: string;
  vendorId?: number;
  customerId?: number;
  partyName: string;
  partyTaxId: string;
  branchCode?: string;
  taxableAmount: number;
  vatRate: number;
  apInvoiceId?: number;
  arInvoiceId?: number;
}

// ============================================
// Withholding Tax (WHT)
// ============================================

export interface WHTTransaction {
  id: number;
  certificateNumber: string;
  certificateType: WHTCertificateType;
  paymentId: number;
  vendorId: number;
  paymentDate: string;
  taxPeriod: string;
  whtType: string;
  whtDescription: string;
  paymentAmount: number;
  whtRate: number;
  whtAmount: number;
  netAmount: number;
  createdAt: string;
  // Populated fields
  vendor?: { id: number; name: string; taxId?: string };
}

export interface WHTTransactionCreate {
  certificateType: WHTCertificateType;
  paymentId: number;
  vendorId: number;
  paymentDate: string;
  taxPeriod: string;
  whtType: string;
  whtDescription: string;
  paymentAmount: number;
  whtRate: number;
}

// ============================================
// Asset Category
// ============================================

export interface AssetCategory {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: DepreciationMethod;
  maxDepreciationRate: number;
  assetGLAccountId: number;
  depreciationExpenseGLAccountId: number;
  accumulatedDepreciationGLAccountId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  assetGLAccount?: GLAccount;
  depreciationExpenseGLAccount?: GLAccount;
  accumulatedDepreciationGLAccount?: GLAccount;
}

export interface AssetCategoryCreate {
  code: string;
  nameTh: string;
  nameEn: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: DepreciationMethod;
  maxDepreciationRate: number;
  assetGLAccountId: number;
  depreciationExpenseGLAccountId: number;
  accumulatedDepreciationGLAccountId: number;
}

export interface AssetCategoryUpdate {
  nameTh?: string;
  nameEn?: string;
  defaultUsefulLifeMonths?: number;
  defaultDepreciationMethod?: DepreciationMethod;
  maxDepreciationRate?: number;
  assetGLAccountId?: number;
  depreciationExpenseGLAccountId?: number;
  accumulatedDepreciationGLAccountId?: number;
  isActive?: boolean;
}

// ============================================
// Fixed Asset
// ============================================

export interface FixedAsset {
  id: number;
  assetCode: string;
  nameTh: string;
  nameEn: string;
  categoryId: number;
  acquisitionDate: string;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  depreciationStartDate: string;
  accumulatedDepreciation: number;
  netBookValue: number;
  location: string | null;
  departmentId: number | null;
  responsiblePersonId: number | null;
  purchaseOrderId: number | null;
  apInvoiceId: number | null;
  status: AssetStatus;
  disposalDate: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  category?: AssetCategory;
  equipment?: Equipment;
  depreciationHistory?: AssetDepreciation[];
  disposal?: AssetDisposal;
}

export interface FixedAssetCreate {
  nameTh: string;
  nameEn: string;
  categoryId: number;
  acquisitionDate: string;
  acquisitionCost: number;
  salvageValue?: number;
  usefulLifeMonths?: number;
  depreciationMethod?: DepreciationMethod;
  depreciationStartDate?: string;
  location?: string;
  departmentId?: number;
  responsiblePersonId?: number;
  purchaseOrderId?: number;
  apInvoiceId?: number;
}

export interface FixedAssetUpdate {
  nameTh?: string;
  nameEn?: string;
  location?: string;
  departmentId?: number;
  responsiblePersonId?: number;
}

// ============================================
// Asset Depreciation
// ============================================

export interface AssetDepreciation {
  id: number;
  fixedAssetId: number;
  fiscalPeriodId: number;
  depreciationDate: string;
  openingBookValue: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
  journalEntryId: number | null;
  createdAt: string;
  // Populated fields
  fiscalPeriod?: FiscalPeriod;
  journalEntry?: JournalEntry;
}

// ============================================
// Asset Disposal
// ============================================

export interface AssetDisposal {
  id: number;
  fixedAssetId: number;
  disposalDate: string;
  disposalType: DisposalType;
  disposalReason: string | null;
  saleProceeds: number;
  bookValueAtDisposal: number;
  gainLoss: number;
  buyerName: string | null;
  journalEntryId: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  createdBy: number;
  createdAt: string;
}

export interface AssetDisposalCreate {
  fixedAssetId: number;
  disposalDate: string;
  disposalType: DisposalType;
  disposalReason?: string;
  saleProceeds?: number;
  buyerName?: string;
}

// ============================================
// Asset Movement
// ============================================

export interface AssetMovement {
  id: number;
  fixedAssetId: number;
  movementDate: string;
  fromLocation: string | null;
  toLocation: string | null;
  fromDepartmentId: number | null;
  toDepartmentId: number | null;
  fromResponsiblePersonId: number | null;
  toResponsiblePersonId: number | null;
  reason: string | null;
  createdBy: number;
  createdAt: string;
}

export interface AssetMovementCreate {
  fixedAssetId: number;
  movementDate: string;
  toLocation?: string;
  toDepartmentId?: number;
  toResponsiblePersonId?: number;
  reason?: string;
}

// ============================================
// Equipment
// ============================================

export interface Equipment {
  id: number;
  fixedAssetId: number;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  specifications: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  operatingHours: number;
  operatingUnits: number;
  lastMeterReading: number;
  lastMeterReadingDate: string | null;
  assignedOperatorId: number | null;
  productionLineId: number | null;
  isAvailable: boolean;
  lastMaintenanceDate: string | null;
  nextMaintenanceDue: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  fixedAsset?: FixedAsset;
  maintenanceSchedules?: MaintenanceSchedule[];
  maintenanceRecords?: MaintenanceRecord[];
}

export interface EquipmentCreate {
  fixedAssetId: number;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  specifications?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  assignedOperatorId?: number;
  productionLineId?: number;
}

export interface EquipmentUpdate {
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  specifications?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  assignedOperatorId?: number;
  productionLineId?: number;
  isAvailable?: boolean;
}

// ============================================
// Maintenance Schedule
// ============================================

export interface MaintenanceSchedule {
  id: number;
  equipmentId: number;
  maintenanceType: string;
  description: string | null;
  intervalType: MaintenanceIntervalType;
  intervalValue: number;
  lastPerformed: string | null;
  lastPerformedHours: number | null;
  nextDue: string;
  nextDueHours: number | null;
  alertDaysBefore: number;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceScheduleCreate {
  equipmentId: number;
  maintenanceType: string;
  description?: string;
  intervalType: MaintenanceIntervalType;
  intervalValue: number;
  nextDue: string;
  nextDueHours?: number;
  alertDaysBefore?: number;
}

export interface MaintenanceScheduleUpdate {
  maintenanceType?: string;
  description?: string;
  intervalType?: MaintenanceIntervalType;
  intervalValue?: number;
  nextDue?: string;
  nextDueHours?: number;
  alertDaysBefore?: number;
  isActive?: boolean;
}

// ============================================
// Maintenance Record
// ============================================

export interface MaintenanceRecord {
  id: number;
  equipmentId: number;
  maintenanceScheduleId: number | null;
  maintenanceDate: string;
  maintenanceType: MaintenanceType;
  description: string;
  hoursAtMaintenance: number | null;
  partsUsed: string | null;
  partsCost: number;
  laborHours: number;
  laborCost: number;
  externalServiceCost: number;
  totalCost: number;
  downtimeHours: number;
  isCritical: boolean;
  rootCause: string | null;
  isCapitalized: boolean;
  journalEntryId: number | null;
  performedBy: string | null;
  approvedBy: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  equipment?: Equipment;
  maintenanceSchedule?: MaintenanceSchedule;
  journalEntry?: JournalEntry;
}

export interface MaintenanceRecordCreate {
  equipmentId: number;
  maintenanceScheduleId?: number;
  maintenanceDate: string;
  maintenanceType: MaintenanceType;
  description: string;
  hoursAtMaintenance?: number;
  partsUsed?: string;
  partsCost?: number;
  laborHours?: number;
  laborCost?: number;
  externalServiceCost?: number;
  downtimeHours?: number;
  isCritical?: boolean;
  rootCause?: string;
  isCapitalized?: boolean;
  performedBy?: string;
}

// ============================================
// Report Types
// ============================================

export interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountType: string;
  category: AccountCategory;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceReport {
  asOfDate: string;
  fiscalPeriod: string;
  entries: TrialBalanceEntry[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
  };
}

export interface BalanceSheetSection {
  title: string;
  accounts: Array<{
    code: string;
    name: string;
    amount: number;
    isSubtotal?: boolean;
  }>;
  subtotal: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: {
    currentAssets: BalanceSheetSection;
    nonCurrentAssets: BalanceSheetSection;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection;
    nonCurrentLiabilities: BalanceSheetSection;
    totalLiabilities: number;
  };
  equity: {
    section: BalanceSheetSection;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface IncomeStatementSection {
  title: string;
  accounts: Array<{
    code: string;
    name: string;
    amount: number;
    isSubtotal?: boolean;
  }>;
  subtotal: number;
}

export interface IncomeStatementReport {
  periodStart: string;
  periodEnd: string;
  revenue: IncomeStatementSection;
  costOfGoodsSold: IncomeStatementSection;
  grossProfit: number;
  operatingExpenses: IncomeStatementSection;
  operatingIncome: number;
  otherIncomeExpenses: IncomeStatementSection;
  netIncomeBeforeTax: number;
  incomeTax: number;
  netIncome: number;
}

export interface AgingBucket {
  range: string;
  count: number;
  amount: number;
}

export interface AgingReportEntry {
  entityId: number;
  entityName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

export interface AgingReport {
  reportType: 'AP' | 'AR';
  asOfDate: string;
  entries: AgingReportEntry[];
  buckets: AgingBucket[];
  totals: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    total: number;
  };
}

export interface VATReportEntry {
  taxInvoiceNumber: string;
  taxInvoiceDate: string;
  partyName: string;
  partyTaxId: string;
  branchCode: string;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface VATReport {
  taxPeriod: string;
  inputVAT: {
    entries: VATReportEntry[];
    totalTaxableAmount: number;
    totalVATAmount: number;
  };
  outputVAT: {
    entries: VATReportEntry[];
    totalTaxableAmount: number;
    totalVATAmount: number;
  };
  netVAT: number;
}

export interface AssetRegisterEntry {
  assetCode: string;
  assetName: string;
  category: string;
  location: string | null;
  acquisitionDate: string;
  acquisitionCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: AssetStatus;
}

export interface AssetRegisterReport {
  asOfDate: string;
  entries: AssetRegisterEntry[];
  totals: {
    acquisitionCost: number;
    accumulatedDepreciation: number;
    netBookValue: number;
  };
}

export interface CashFlowSection {
  title: string;
  items: Array<{
    description: string;
    amount: number;
  }>;
  subtotal: number;
}

export interface CashFlowStatementReport {
  periodStart: string;
  periodEnd: string;
  operatingActivities: {
    netIncome: number;
    adjustments: CashFlowSection;
    workingCapitalChanges: CashFlowSection;
    netCashFromOperating: number;
  };
  investingActivities: {
    section: CashFlowSection;
    netCashFromInvesting: number;
  };
  financingActivities: {
    section: CashFlowSection;
    netCashFromFinancing: number;
  };
  netChangeInCash: number;
  beginningCashBalance: number;
  endingCashBalance: number;
}

// ============================================
// Filter/Query Types
// ============================================

export interface GLAccountFilter {
  accountTypeId?: number;
  parentId?: number | null;
  isActive?: boolean;
  isPostable?: boolean;
  isBankAccount?: boolean;
  search?: string;
}

export interface JournalEntryFilter {
  fiscalPeriodId?: number;
  status?: JournalEntryStatus;
  sourceType?: JournalSourceType;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface APInvoiceFilter {
  vendorId?: number;
  status?: APInvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}

export interface ARInvoiceFilter {
  customerId?: number;
  status?: ARInvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}

export interface FixedAssetFilter {
  categoryId?: number;
  status?: AssetStatus;
  departmentId?: number;
  location?: string;
  search?: string;
}

export interface MaintenanceFilter {
  equipmentId?: number;
  maintenanceType?: MaintenanceType;
  dateFrom?: string;
  dateTo?: string;
  isOverdue?: boolean;
  isDue?: boolean;
}

// ============================================
// Thai VAT Configuration
// ============================================

export const THAI_VAT_RATE = 0.07; // 7%
export const THAI_BRANCH_CODE_HEAD_OFFICE = '00000';

// WHT Rate Configuration
export interface WHTRate {
  code: string;
  description: string;
  descriptionTh: string;
  rate: number;
}

export const WHT_RATES: WHTRate[] = [
  { code: '40(1)', description: 'Salary, wages', descriptionTh: 'เงินเดือน ค่าจ้าง', rate: 0 },
  { code: '40(2)', description: 'Hire of work', descriptionTh: 'ค่าจ้างทำของ', rate: 3 },
  { code: '40(4)a', description: 'Interest', descriptionTh: 'ดอกเบี้ย', rate: 15 },
  { code: '40(4)b', description: 'Dividend', descriptionTh: 'เงินปันผล', rate: 10 },
  { code: '40(6)', description: 'Liberal profession', descriptionTh: 'วิชาชีพอิสระ', rate: 3 },
  { code: '40(7)', description: 'Contract of work', descriptionTh: 'รับเหมาก่อสร้าง', rate: 3 },
  { code: '40(8)', description: 'Rent', descriptionTh: 'ค่าเช่า', rate: 5 },
  { code: '3', description: 'Service', descriptionTh: 'ค่าบริการ', rate: 3 },
  { code: '5', description: 'Transport', descriptionTh: 'ค่าขนส่ง', rate: 1 },
  { code: '6', description: 'Advertising', descriptionTh: 'ค่าโฆษณา', rate: 2 },
];

// ============================================
// WHT Certificate Report Types (User Story 6)
// ============================================

export interface WHTCertificateEntry {
  id: number;
  certificateNumber: string;
  certificateType: WHTCertificateType;
  paymentDate: string;
  vendorName: string;
  vendorTaxId: string | null;
  vendorAddress?: string;
  whtType: string;
  whtDescription: string;
  paymentAmount: number;
  whtRate: number;
  whtAmount: number;
  netAmount: number;
}

export interface WHTCertificateSummary {
  taxPeriod: string;
  certificateType: WHTCertificateType;
  entries: WHTCertificateEntry[];
  totalPaymentAmount: number;
  totalWHTAmount: number;
  totalNetAmount: number;
  certificateCount: number;
}

/**
 * WHT Certificate PDF data for generating PND 3/53 form
 */
export interface WHTCertificatePDFData {
  // Company (Payer) Info
  companyName: string;
  companyNameTh: string;
  companyTaxId: string;
  companyAddress: string;
  companyBranch: string;

  // Vendor (Payee) Info
  vendorName: string;
  vendorTaxId: string;
  vendorAddress: string;

  // Certificate Details
  certificateNumber: string;
  certificateType: WHTCertificateType;
  paymentDate: string;
  taxPeriod: string;

  // Payment Details
  items: Array<{
    whtType: string;
    whtDescription: string;
    paymentDate: string;
    paymentAmount: number;
    whtRate: number;
    whtAmount: number;
  }>;

  // Totals
  totalPaymentAmount: number;
  totalWHTAmount: number;
}

/**
 * VAT Summary Report (Por Por 30 format)
 */
export interface VATSummaryReport {
  taxPeriod: string;
  companyName: string;
  companyTaxId: string;

  // Output VAT (Sales)
  outputVAT: {
    entries: VATReportEntry[];
    totalTaxableAmount: number;
    totalVATAmount: number;
    count: number;
  };

  // Input VAT (Purchases)
  inputVAT: {
    entries: VATReportEntry[];
    totalTaxableAmount: number;
    totalVATAmount: number;
    count: number;
  };

  // Net VAT calculation
  netVATPayable: number; // Positive = pay, Negative = refund
  vatPayable: boolean;
}

// ============================================
// Payroll Accounting (US10)
// ============================================

/**
 * Thai statutory rates for payroll deductions
 */
export const THAI_SSO_EMPLOYEE_RATE = 0.05; // 5% of wage (max 750 THB/month)
export const THAI_SSO_EMPLOYER_RATE = 0.05; // 5% of wage (max 750 THB/month)
export const THAI_SSO_MAX_WAGE_BASE = 15000; // Maximum wage for SSO calculation

/**
 * Payroll entry for creating journal entries
 */
export interface PayrollEntry {
  employeeId: number;
  employeeName: string;
  costCenterId?: number;
  costCenterCode?: string;

  // Earnings
  baseSalary: number;
  overtime: number;
  bonuses: number;
  allowances: number;
  otherEarnings: number;
  grossPay: number;

  // Deductions
  ssoEmployee: number;     // Social Security (employee portion)
  whtAmount: number;       // Withholding tax
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netPay: number;

  // Employer contributions
  ssoEmployer: number;     // Social Security (employer portion)
}

/**
 * Payroll batch for processing multiple employees
 */
export interface PayrollBatch {
  payrollPeriod: string;      // YYYY-MM format
  payrollDate: string;        // Payment date
  payrollNumber?: string;     // Reference number
  description?: string;
  entries: PayrollEntry[];
}

/**
 * Result from creating payroll journal entry
 */
export interface PayrollJournalResult {
  success: boolean;
  journalEntryId: number | null;
  entryNumber: string | null;
  message: string;
  totals: {
    totalGrossPay: number;
    totalNetPay: number;
    totalSSOEmployee: number;
    totalSSOEmployer: number;
    totalWHT: number;
    totalOtherDeductions: number;
  };
  costCenterAllocations: Array<{
    costCenterId: number;
    costCenterCode: string | null;
    salaryExpense: number;
    ssoEmployerExpense: number;
    totalExpense: number;
  }>;
}

/**
 * Statutory liabilities result
 */
export interface StatutoryLiabilitiesResult {
  success: boolean;
  journalEntryId: number | null;
  message: string;
  ssoPayable: number;
  whtPayable: number;
  totalPayable: number;
}

/**
 * Payroll configuration with GL account mappings
 */
export interface PayrollAccountConfig {
  salaryExpenseAccountId: number;
  wagesExpenseAccountId?: number;
  bonusExpenseAccountId?: number;
  overtimeExpenseAccountId?: number;
  ssoEmployerExpenseAccountId: number;
  ssoPayableAccountId: number;
  whtPayableAccountId: number;
  salaryPayableAccountId: number;
  cashAccountId: number;
}

// ============================================
// Executive Dashboard Types (Dashboard Redesign)
// ============================================

export type AlertPriority = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'cash_below_threshold'
  | 'ar_overdue_critical'
  | 'ap_overdue_supplier_risk'
  | 'gross_margin_declining'
  | 'inventory_expiring'
  | 'budget_variance'
  | 'period_close_pending'
  | 'pending_approvals';

export interface ExecutiveKPI {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  unit: 'currency' | 'percentage' | 'days' | 'ratio' | 'times';
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
  trendPercentage: number;
  sparklineData: number[];
  status: 'good' | 'warning' | 'danger';
  targetMin?: number;
  targetMax?: number;
}

export interface ExecutiveMetrics {
  asOfDate: string;
  periodStart: string;
  periodEnd: string;

  // Financial Health KPIs
  workingCapital: ExecutiveKPI;
  currentRatio: ExecutiveKPI;
  quickRatio: ExecutiveKPI;
  dso: ExecutiveKPI;

  // Business Performance KPIs
  grossProfitMargin: ExecutiveKPI;
  operatingCashFlow: ExecutiveKPI;
  dpo: ExecutiveKPI;
  inventoryTurnover: ExecutiveKPI;
}

export interface ExecutiveAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  value?: number;
  formattedValue?: string;
  threshold?: number;
  actionLink: string;
  actionLabel: string;
  createdAt: string;
  dismissedAt?: string;
}

export interface CashFlowWaterfallItem {
  category: string;
  label: string;
  value: number;
  isTotal: boolean;
  runningTotal: number;
}

export interface CashFlowWaterfallData {
  periodStart: string;
  periodEnd: string;
  items: CashFlowWaterfallItem[];
  openingCash: number;
  closingCash: number;
}

export interface CategoryProfitability {
  categoryId: number;
  categoryName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  revenueContributionPercent: number;
}

export interface ProfitabilityByCategoryData {
  periodStart: string;
  periodEnd: string;
  categories: CategoryProfitability[];
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  overallMarginPercent: number;
}

export interface ExpenseCategory {
  categoryName: string;
  glAccountIds: number[];
  amount: number;
  percentage: number;
}

export interface ExpenseBreakdownData {
  periodStart: string;
  periodEnd: string;
  categories: ExpenseCategory[];
  totalExpenses: number;
}

export interface BusinessIntelMetrics {
  asOfDate: string;

  // Inventory & Quality
  inventoryAtRisk: number;
  expiredWriteOffYtd: number;
  qualityCostRatio: number;
  rejectedBatchCostYtd: number;

  // Operational Efficiency
  productionYieldPercent: number | null;
  equipmentDowntimeCost: number;
  vendorConcentrationPercent: number;
  paymentDiscountsCapturedPercent: number;

  // Sparklines (6 months)
  inventoryAtRiskTrend: number[];
  qualityCostTrend: number[];
  productionYieldTrend: number[];
  vendorConcentrationTrend: number[];
}
