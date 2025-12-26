// Accounting Module - Zod Validation Schemas
// Feature: 010-accounting-module-integration

import { z } from 'zod';

// ============================================
// Enums as Zod schemas
// ============================================

export const accountCategorySchema = z.enum([
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]);

export const normalBalanceSchema = z.enum(['debit', 'credit']);

export const journalEntryStatusSchema = z.enum(['draft', 'posted', 'reversed']);

export const journalSourceTypeSchema = z.enum([
  'PO_RECEIPT',
  'SO_SHIPMENT',
  'AP_PAYMENT',
  'AR_RECEIPT',
  'DEPRECIATION',
  'PAYROLL',
  'COST_ALLOCATION',
  'PERIOD_CLOSE',
  'MANUAL',
]);

export const apInvoiceStatusSchema = z.enum([
  'draft',
  'approved',
  'posted',
  'partial',
  'paid',
  'cancelled',
]);

export const arInvoiceStatusSchema = z.enum([
  'draft',
  'confirmed',
  'posted',
  'partial',
  'paid',
  'cancelled',
]);

export const paymentTypeSchema = z.enum(['ap', 'ar']);

export const paymentMethodSchema = z.enum(['cash', 'check', 'transfer', 'other']);

export const paymentStatusSchema = z.enum(['pending', 'completed', 'cancelled']);

export const fiscalPeriodStatusSchema = z.enum(['open', 'soft_closed', 'closed']);

export const fiscalYearStatusSchema = z.enum(['open', 'closed']);

export const vatTransactionTypeSchema = z.enum(['input', 'output']);

export const whtCertificateTypeSchema = z.enum(['pnd3', 'pnd53']);

export const depreciationMethodSchema = z.enum(['straight_line', 'declining_balance']);

export const assetStatusSchema = z.enum(['active', 'disposed', 'fully_depreciated']);

export const disposalTypeSchema = z.enum(['sale', 'write_off', 'scrap', 'transfer']);

export const maintenanceIntervalTypeSchema = z.enum([
  'days',
  'weeks',
  'months',
  'hours',
  'units',
]);

export const maintenanceTypeSchema = z.enum(['preventive', 'corrective', 'emergency']);

// ============================================
// Helper validators
// ============================================

const dateStringSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'วันที่ต้องเป็นรูปแบบที่ถูกต้อง',
});

const optionalDateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), {
    message: 'วันที่ต้องเป็นรูปแบบที่ถูกต้อง',
  })
  .optional()
  .nullable();

const positiveIntSchema = z.number().int().positive();
const positiveDecimalSchema = z.number().nonnegative();
const currencyAmountSchema = z
  .number()
  .refine((val) => val >= 0, { message: 'จำนวนเงินต้องไม่ติดลบ' });

// Thai tax period format: YYYYMM
const taxPeriodSchema = z.string().regex(/^\d{6}$/, 'รูปแบบงวดภาษีต้องเป็น YYYYMM');

// Thai tax ID: 13 digits
const taxIdSchema = z.string().regex(/^\d{13}$/, 'เลขประจำตัวผู้เสียภาษีต้องเป็น 13 หลัก');

// ============================================
// GL Account Type Schemas
// ============================================

export const glAccountTypeCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสประเภทบัญชีจำเป็น')
    .max(20, 'รหัสประเภทบัญชีต้องไม่เกิน 20 ตัวอักษร'),
  nameTh: z
    .string()
    .min(1, 'ชื่อประเภทบัญชีภาษาไทยจำเป็น')
    .max(100, 'ชื่อประเภทบัญชีภาษาไทยต้องไม่เกิน 100 ตัวอักษร'),
  nameEn: z
    .string()
    .min(1, 'ชื่อประเภทบัญชีภาษาอังกฤษจำเป็น')
    .max(100, 'ชื่อประเภทบัญชีภาษาอังกฤษต้องไม่เกิน 100 ตัวอักษร'),
  category: accountCategorySchema,
  normalBalance: normalBalanceSchema,
  displayOrder: z.number().int().nonnegative().optional(),
});

export const glAccountTypeUpdateSchema = z.object({
  nameTh: z.string().min(1).max(100).optional(),
  nameEn: z.string().min(1).max(100).optional(),
  category: accountCategorySchema.optional(),
  normalBalance: normalBalanceSchema.optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

// ============================================
// GL Account Schemas
// ============================================

export const glAccountCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสบัญชีจำเป็น')
    .max(20, 'รหัสบัญชีต้องไม่เกิน 20 ตัวอักษร')
    .regex(/^[0-9\-\.]+$/, 'รหัสบัญชีต้องประกอบด้วยตัวเลข ขีด หรือจุดเท่านั้น'),
  nameTh: z
    .string()
    .min(1, 'ชื่อบัญชีภาษาไทยจำเป็น')
    .max(200, 'ชื่อบัญชีภาษาไทยต้องไม่เกิน 200 ตัวอักษร'),
  nameEn: z
    .string()
    .min(1, 'ชื่อบัญชีภาษาอังกฤษจำเป็น')
    .max(200, 'ชื่อบัญชีภาษาอังกฤษต้องไม่เกิน 200 ตัวอักษร'),
  accountTypeId: positiveIntSchema.describe('กรุณาเลือกประเภทบัญชี'),
  parentId: positiveIntSchema.nullable().optional(),
  isPostable: z.boolean().default(true),
  isBankAccount: z.boolean().default(false),
  bankName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const glAccountUpdateSchema = z.object({
  nameTh: z.string().min(1).max(200).optional(),
  nameEn: z.string().min(1).max(200).optional(),
  accountTypeId: positiveIntSchema.optional(),
  parentId: positiveIntSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  isPostable: z.boolean().optional(),
  isBankAccount: z.boolean().optional(),
  bankName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const glAccountQuerySchema = z.object({
  accountTypeId: z.coerce.number().int().positive().optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  isPostable: z.enum(['true', 'false']).optional(),
  isBankAccount: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// ============================================
// Fiscal Year Schemas
// ============================================

export const fiscalYearCreateSchema = z.object({
  yearCode: z
    .string()
    .min(1, 'รหัสปีบัญชีจำเป็น')
    .max(10, 'รหัสปีบัญชีต้องไม่เกิน 10 ตัวอักษร'),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  isCurrent: z.boolean().default(false),
});

export const fiscalYearUpdateSchema = z.object({
  startDate: optionalDateStringSchema,
  endDate: optionalDateStringSchema,
  isCurrent: z.boolean().optional(),
});

// ============================================
// Fiscal Period Schemas
// ============================================

export const fiscalPeriodCreateSchema = z.object({
  fiscalYearId: positiveIntSchema.describe('กรุณาเลือกปีบัญชี'),
  periodNumber: z.number().int().min(1).max(13),
  periodName: z
    .string()
    .min(1, 'ชื่องวดบัญชีจำเป็น')
    .max(50, 'ชื่องวดบัญชีต้องไม่เกิน 50 ตัวอักษร'),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

export const fiscalPeriodUpdateSchema = z.object({
  periodName: z.string().min(1).max(50).optional(),
  status: fiscalPeriodStatusSchema.optional(),
});

export const fiscalPeriodQuerySchema = z.object({
  fiscalYearId: z.coerce.number().int().positive().optional(),
  status: fiscalPeriodStatusSchema.optional(),
  isCurrent: z.enum(['true', 'false']).optional(),
});

// ============================================
// Journal Entry Schemas
// ============================================

export const journalLineCreateSchema = z.object({
  glAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชี'),
  debit: currencyAmountSchema.default(0),
  credit: currencyAmountSchema.default(0),
  description: z.string().max(255).optional().nullable(),
  costCenterId: positiveIntSchema.optional().nullable(),
});

export const journalEntryCreateSchema = z
  .object({
    entryDate: dateStringSchema,
    fiscalPeriodId: positiveIntSchema.optional(),
    description: z.string().max(500).optional().nullable(),
    sourceType: journalSourceTypeSchema.optional().nullable(),
    sourceId: positiveIntSchema.optional().nullable(),
    lines: z
      .array(journalLineCreateSchema)
      .min(2, 'รายการบันทึกต้องมีอย่างน้อย 2 บรรทัด'),
  })
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      return Math.abs(totalDebit - totalCredit) < 0.01; // Allow small rounding difference
    },
    { message: 'ยอดเดบิตและเครดิตต้องเท่ากัน' }
  );

export const journalEntryUpdateSchema = z
  .object({
    entryDate: optionalDateStringSchema,
    description: z.string().max(500).optional().nullable(),
    lines: z.array(journalLineCreateSchema).min(2).optional(),
  })
  .refine(
    (data) => {
      if (!data.lines) return true;
      const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: 'ยอดเดบิตและเครดิตต้องเท่ากัน' }
  );

export const journalEntryQuerySchema = z.object({
  fiscalPeriodId: z.coerce.number().int().positive().optional(),
  status: journalEntryStatusSchema.optional(),
  sourceType: journalSourceTypeSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// AP Invoice Schemas
// ============================================

export const apInvoiceLineCreateSchema = z.object({
  description: z
    .string()
    .min(1, 'รายละเอียดรายการจำเป็น')
    .max(255, 'รายละเอียดรายการต้องไม่เกิน 255 ตัวอักษร'),
  itemId: positiveIntSchema.optional().nullable(),
  glAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชี'),
  quantity: z.number().positive('จำนวนต้องมากกว่า 0'),
  unitPrice: currencyAmountSchema,
  isCapitalizable: z.boolean().default(false),
});

export const apInvoiceCreateSchema = z.object({
  invoiceNumber: z
    .string()
    .min(1, 'เลขที่ใบแจ้งหนี้จำเป็น')
    .max(50, 'เลขที่ใบแจ้งหนี้ต้องไม่เกิน 50 ตัวอักษร'),
  vendorId: positiveIntSchema.describe('กรุณาเลือกผู้จำหน่าย'),
  purchaseOrderId: positiveIntSchema.optional().nullable(),
  invoiceDate: dateStringSchema,
  dueDate: dateStringSchema,
  receivedDate: dateStringSchema,
  description: z.string().max(500).optional().nullable(),
  currency: z.string().max(3).default('THB'),
  exchangeRate: z.number().positive().default(1),
  lines: z.array(apInvoiceLineCreateSchema).min(1, 'ต้องมีรายการอย่างน้อย 1 รายการ'),
});

export const apInvoiceUpdateSchema = z.object({
  invoiceNumber: z.string().min(1).max(50).optional(),
  invoiceDate: optionalDateStringSchema,
  dueDate: optionalDateStringSchema,
  description: z.string().max(500).optional().nullable(),
  lines: z.array(apInvoiceLineCreateSchema).min(1).optional(),
});

export const apInvoiceQuerySchema = z.object({
  vendorId: z.coerce.number().int().positive().optional(),
  status: apInvoiceStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// AR Invoice Schemas
// ============================================

export const arInvoiceLineCreateSchema = z.object({
  description: z
    .string()
    .min(1, 'รายละเอียดรายการจำเป็น')
    .max(255, 'รายละเอียดรายการต้องไม่เกิน 255 ตัวอักษร'),
  itemId: positiveIntSchema.optional().nullable(),
  glAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชี'),
  quantity: z.number().positive('จำนวนต้องมากกว่า 0'),
  unitPrice: currencyAmountSchema,
  lotId: positiveIntSchema.optional().nullable(),
});

export const arInvoiceCreateSchema = z.object({
  invoiceNumber: z
    .string()
    .min(1, 'เลขที่ใบแจ้งหนี้จำเป็น')
    .max(50, 'เลขที่ใบแจ้งหนี้ต้องไม่เกิน 50 ตัวอักษร'),
  customerId: positiveIntSchema.describe('กรุณาเลือกลูกค้า'),
  salesOrderId: positiveIntSchema.optional().nullable(),
  invoiceDate: dateStringSchema,
  dueDate: dateStringSchema,
  description: z.string().max(500).optional().nullable(),
  currency: z.string().max(3).default('THB'),
  exchangeRate: z.number().positive().default(1),
  lines: z.array(arInvoiceLineCreateSchema).min(1, 'ต้องมีรายการอย่างน้อย 1 รายการ'),
});

export const arInvoiceUpdateSchema = z.object({
  invoiceNumber: z.string().min(1).max(50).optional(),
  invoiceDate: optionalDateStringSchema,
  dueDate: optionalDateStringSchema,
  description: z.string().max(500).optional().nullable(),
  lines: z.array(arInvoiceLineCreateSchema).min(1).optional(),
});

export const arInvoiceQuerySchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  status: arInvoiceStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Payment Schemas
// ============================================

export const paymentAllocationCreateSchema = z.object({
  apInvoiceId: positiveIntSchema.optional().nullable(),
  arInvoiceId: positiveIntSchema.optional().nullable(),
  allocatedAmount: z.number().positive('จำนวนเงินที่จัดสรรต้องมากกว่า 0'),
});

export const paymentCreateSchema = z
  .object({
    paymentType: paymentTypeSchema,
    paymentDate: dateStringSchema,
    vendorId: positiveIntSchema.optional().nullable(),
    customerId: positiveIntSchema.optional().nullable(),
    bankAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชีธนาคาร'),
    paymentMethod: paymentMethodSchema,
    referenceNumber: z.string().max(50).optional().nullable(),
    amount: z.number().positive('จำนวนเงินต้องมากกว่า 0'),
    whtAmount: currencyAmountSchema.default(0),
    description: z.string().max(500).optional().nullable(),
    allocations: z.array(paymentAllocationCreateSchema).min(1, 'ต้องมีการจัดสรรอย่างน้อย 1 รายการ'),
  })
  .refine(
    (data) => {
      if (data.paymentType === 'ap') {
        return data.vendorId !== undefined && data.vendorId !== null;
      }
      return data.customerId !== undefined && data.customerId !== null;
    },
    { message: 'กรุณาเลือกผู้จำหน่ายหรือลูกค้าตามประเภทการชำระเงิน' }
  );

export const paymentQuerySchema = z.object({
  paymentType: paymentTypeSchema.optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  status: paymentStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// VAT Transaction Schemas
// ============================================

export const vatTransactionCreateSchema = z.object({
  transactionType: vatTransactionTypeSchema,
  taxInvoiceNumber: z
    .string()
    .min(1, 'เลขที่ใบกำกับภาษีจำเป็น')
    .max(50, 'เลขที่ใบกำกับภาษีต้องไม่เกิน 50 ตัวอักษร'),
  taxInvoiceDate: dateStringSchema,
  taxPeriod: taxPeriodSchema,
  vendorId: positiveIntSchema.optional().nullable(),
  customerId: positiveIntSchema.optional().nullable(),
  partyName: z
    .string()
    .min(1, 'ชื่อคู่ค้าจำเป็น')
    .max(200, 'ชื่อคู่ค้าต้องไม่เกิน 200 ตัวอักษร'),
  partyTaxId: taxIdSchema,
  branchCode: z.string().max(5).default('00000'),
  taxableAmount: currencyAmountSchema,
  vatRate: z.number().min(0).max(100).default(7),
  apInvoiceId: positiveIntSchema.optional().nullable(),
  arInvoiceId: positiveIntSchema.optional().nullable(),
});

export const vatReportQuerySchema = z.object({
  taxPeriod: taxPeriodSchema,
  transactionType: vatTransactionTypeSchema.optional(),
});

// ============================================
// WHT Transaction Schemas
// ============================================

export const whtTransactionCreateSchema = z.object({
  certificateType: whtCertificateTypeSchema,
  paymentId: positiveIntSchema.describe('กรุณาเลือกการชำระเงิน'),
  vendorId: positiveIntSchema.describe('กรุณาเลือกผู้จำหน่าย'),
  paymentDate: dateStringSchema,
  taxPeriod: taxPeriodSchema,
  whtType: z
    .string()
    .min(1, 'ประเภทภาษีหัก ณ ที่จ่ายจำเป็น')
    .max(20, 'ประเภทภาษีหัก ณ ที่จ่ายต้องไม่เกิน 20 ตัวอักษร'),
  whtDescription: z
    .string()
    .min(1, 'รายละเอียดภาษีจำเป็น')
    .max(255, 'รายละเอียดภาษีต้องไม่เกิน 255 ตัวอักษร'),
  paymentAmount: z.number().positive('จำนวนเงินต้องมากกว่า 0'),
  whtRate: z.number().min(0).max(100),
});

// ============================================
// Asset Category Schemas
// ============================================

export const assetCategoryCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'รหัสหมวดสินทรัพย์จำเป็น')
    .max(20, 'รหัสหมวดสินทรัพย์ต้องไม่เกิน 20 ตัวอักษร'),
  nameTh: z
    .string()
    .min(1, 'ชื่อหมวดภาษาไทยจำเป็น')
    .max(100, 'ชื่อหมวดภาษาไทยต้องไม่เกิน 100 ตัวอักษร'),
  nameEn: z
    .string()
    .min(1, 'ชื่อหมวดภาษาอังกฤษจำเป็น')
    .max(100, 'ชื่อหมวดภาษาอังกฤษต้องไม่เกิน 100 ตัวอักษร'),
  defaultUsefulLifeMonths: z
    .number()
    .int()
    .positive('อายุการใช้งานต้องมากกว่า 0'),
  defaultDepreciationMethod: depreciationMethodSchema.default('straight_line'),
  maxDepreciationRate: z
    .number()
    .min(0)
    .max(100, 'อัตราค่าเสื่อมราคาสูงสุดต้องไม่เกิน 100%')
    .default(20),
  assetGLAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชีสินทรัพย์'),
  depreciationExpenseGLAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชีค่าเสื่อมราคา'),
  accumulatedDepreciationGLAccountId: positiveIntSchema.describe('กรุณาเลือกบัญชีค่าเสื่อมราคาสะสม'),
});

export const assetCategoryUpdateSchema = z.object({
  nameTh: z.string().min(1).max(100).optional(),
  nameEn: z.string().min(1).max(100).optional(),
  defaultUsefulLifeMonths: z.number().int().positive().optional(),
  defaultDepreciationMethod: depreciationMethodSchema.optional(),
  maxDepreciationRate: z.number().min(0).max(100).optional(),
  assetGLAccountId: positiveIntSchema.optional(),
  depreciationExpenseGLAccountId: positiveIntSchema.optional(),
  accumulatedDepreciationGLAccountId: positiveIntSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Fixed Asset Schemas
// ============================================

export const fixedAssetCreateSchema = z.object({
  nameTh: z
    .string()
    .min(1, 'ชื่อสินทรัพย์ภาษาไทยจำเป็น')
    .max(200, 'ชื่อสินทรัพย์ภาษาไทยต้องไม่เกิน 200 ตัวอักษร'),
  nameEn: z
    .string()
    .min(1, 'ชื่อสินทรัพย์ภาษาอังกฤษจำเป็น')
    .max(200, 'ชื่อสินทรัพย์ภาษาอังกฤษต้องไม่เกิน 200 ตัวอักษร'),
  categoryId: positiveIntSchema.describe('กรุณาเลือกหมวดสินทรัพย์'),
  acquisitionDate: dateStringSchema,
  acquisitionCost: z.number().positive('ราคาที่ได้มาต้องมากกว่า 0'),
  salvageValue: currencyAmountSchema.default(0),
  usefulLifeMonths: z.number().int().positive().optional(),
  depreciationMethod: depreciationMethodSchema.optional(),
  depreciationStartDate: optionalDateStringSchema,
  location: z.string().max(100).optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  responsiblePersonId: positiveIntSchema.optional().nullable(),
  purchaseOrderId: positiveIntSchema.optional().nullable(),
  apInvoiceId: positiveIntSchema.optional().nullable(),
});

export const fixedAssetUpdateSchema = z.object({
  nameTh: z.string().min(1).max(200).optional(),
  nameEn: z.string().min(1).max(200).optional(),
  location: z.string().max(100).optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  responsiblePersonId: positiveIntSchema.optional().nullable(),
});

export const fixedAssetQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  status: assetStatusSchema.optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  location: z.string().optional(),
  search: z.string().optional(),
  acquisitionDateFrom: dateStringSchema.optional(),
  acquisitionDateTo: dateStringSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Asset Disposal Schemas
// ============================================

export const assetDisposalCreateSchema = z.object({
  fixedAssetId: positiveIntSchema.describe('กรุณาเลือกสินทรัพย์'),
  disposalDate: dateStringSchema,
  disposalType: disposalTypeSchema,
  disposalReason: z.string().max(500).optional().nullable(),
  saleProceeds: currencyAmountSchema.default(0),
  buyerName: z.string().max(200).optional().nullable(),
});

// ============================================
// Asset Movement Schemas
// ============================================

export const assetMovementCreateSchema = z.object({
  fixedAssetId: positiveIntSchema.describe('กรุณาเลือกสินทรัพย์'),
  movementDate: dateStringSchema,
  toLocation: z.string().max(100).optional().nullable(),
  toDepartmentId: positiveIntSchema.optional().nullable(),
  toResponsiblePersonId: positiveIntSchema.optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

// ============================================
// Equipment Schemas
// ============================================

export const equipmentCreateSchema = z.object({
  fixedAssetId: positiveIntSchema.describe('กรุณาเลือกสินทรัพย์ถาวร'),
  serialNumber: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  specifications: z.string().optional().nullable(),
  warrantyStartDate: optionalDateStringSchema,
  warrantyEndDate: optionalDateStringSchema,
  assignedOperatorId: positiveIntSchema.optional().nullable(),
  productionLineId: positiveIntSchema.optional().nullable(),
});

export const equipmentUpdateSchema = z.object({
  serialNumber: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  specifications: z.string().optional().nullable(),
  warrantyStartDate: optionalDateStringSchema,
  warrantyEndDate: optionalDateStringSchema,
  assignedOperatorId: positiveIntSchema.optional().nullable(),
  productionLineId: positiveIntSchema.optional().nullable(),
  isAvailable: z.boolean().optional(),
});

export const equipmentQuerySchema = z.object({
  isAvailable: z.enum(['true', 'false']).optional(),
  manufacturer: z.string().optional(),
  productionLineId: z.coerce.number().int().positive().optional(),
  assignedOperatorId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Maintenance Schedule Schemas
// ============================================

export const maintenanceScheduleCreateSchema = z.object({
  equipmentId: positiveIntSchema.describe('กรุณาเลือกอุปกรณ์'),
  maintenanceType: z
    .string()
    .min(1, 'ประเภทการบำรุงรักษาจำเป็น')
    .max(50, 'ประเภทการบำรุงรักษาต้องไม่เกิน 50 ตัวอักษร'),
  description: z.string().max(500).optional().nullable(),
  intervalType: maintenanceIntervalTypeSchema,
  intervalValue: z.number().int().positive('ช่วงเวลาต้องมากกว่า 0'),
  nextDue: dateStringSchema,
  nextDueHours: z.number().int().nonnegative().optional().nullable(),
  alertDaysBefore: z.number().int().nonnegative().default(7),
});

export const maintenanceScheduleUpdateSchema = z.object({
  maintenanceType: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  intervalType: maintenanceIntervalTypeSchema.optional(),
  intervalValue: z.number().int().positive().optional(),
  nextDue: optionalDateStringSchema,
  nextDueHours: z.number().int().nonnegative().optional().nullable(),
  alertDaysBefore: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Maintenance Record Schemas
// ============================================

export const maintenanceRecordCreateSchema = z.object({
  equipmentId: positiveIntSchema.describe('กรุณาเลือกอุปกรณ์'),
  maintenanceScheduleId: positiveIntSchema.optional().nullable(),
  maintenanceDate: dateStringSchema,
  maintenanceType: maintenanceTypeSchema,
  description: z
    .string()
    .min(1, 'รายละเอียดการบำรุงรักษาจำเป็น')
    .max(1000, 'รายละเอียดการบำรุงรักษาต้องไม่เกิน 1000 ตัวอักษร'),
  hoursAtMaintenance: z.number().int().nonnegative().optional().nullable(),
  partsUsed: z.string().optional().nullable(),
  partsCost: currencyAmountSchema.default(0),
  laborHours: z.number().nonnegative().default(0),
  laborCost: currencyAmountSchema.default(0),
  externalServiceCost: currencyAmountSchema.default(0),
  downtimeHours: z.number().nonnegative().default(0),
  isCritical: z.boolean().default(false),
  rootCause: z.string().max(500).optional().nullable(),
  isCapitalized: z.boolean().default(false),
  performedBy: z.string().max(100).optional().nullable(),
});

export const maintenanceRecordQuerySchema = z.object({
  equipmentId: z.coerce.number().int().positive().optional(),
  maintenanceType: maintenanceTypeSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isCritical: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Report Query Schemas
// ============================================

export const trialBalanceQuerySchema = z.object({
  fiscalPeriodId: z.coerce.number().int().positive().optional(),
  asOfDate: z.string().optional(),
});

export const balanceSheetQuerySchema = z.object({
  asOfDate: dateStringSchema,
});

export const incomeStatementQuerySchema = z.object({
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
});

export const agingReportQuerySchema = z.object({
  reportType: z.enum(['AP', 'AR']),
  asOfDate: dateStringSchema,
});

export const assetRegisterQuerySchema = z.object({
  asOfDate: dateStringSchema,
  categoryId: z.coerce.number().int().positive().optional(),
  status: assetStatusSchema.optional(),
});

export const depreciationScheduleQuerySchema = z.object({
  fiscalPeriodId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
});

export const maintenanceDueQuerySchema = z.object({
  daysAhead: z.coerce.number().int().nonnegative().default(30),
  equipmentId: z.coerce.number().int().positive().optional(),
  includeOverdue: z.enum(['true', 'false']).default('true'),
});

// ============================================
// Cost Allocation Schemas (US4: Manufacturing Cost Accounting)
// ============================================

export const overheadTypeSchema = z.enum(['fixed', 'variable', 'mixed']);

export const allocationBasisSchema = z.enum([
  'labor_hours',
  'machine_hours',
  'units',
  'direct_labor_cost',
]);

export const materialCostInputSchema = z.object({
  workOrderId: positiveIntSchema.describe('กรุณาเลือกใบสั่งผลิต'),
  batchNumber: z
    .string()
    .min(1, 'เลขที่รุ่นการผลิตจำเป็น')
    .max(50, 'เลขที่รุ่นการผลิตต้องไม่เกิน 50 ตัวอักษร'),
  materialItemId: positiveIntSchema.describe('กรุณาเลือกวัตถุดิบ'),
  lotId: positiveIntSchema.optional().nullable(),
  quantity: z.number().positive('จำนวนต้องมากกว่า 0'),
  unitCost: currencyAmountSchema,
  issueDate: dateStringSchema,
  description: z.string().max(500).optional().nullable(),
});

export const laborCostInputSchema = z.object({
  workOrderId: positiveIntSchema.describe('กรุณาเลือกใบสั่งผลิต'),
  batchNumber: z
    .string()
    .min(1, 'เลขที่รุ่นการผลิตจำเป็น')
    .max(50, 'เลขที่รุ่นการผลิตต้องไม่เกิน 50 ตัวอักษร'),
  laborHours: z.number().positive('ชั่วโมงแรงงานต้องมากกว่า 0'),
  hourlyRate: z.number().positive('อัตราค่าแรงต้องมากกว่า 0'),
  allocationDate: dateStringSchema,
  description: z.string().max(500).optional().nullable(),
  costCenterId: positiveIntSchema.optional().nullable(),
});

export const overheadAllocationInputSchema = z.object({
  workOrderId: positiveIntSchema.describe('กรุณาเลือกใบสั่งผลิต'),
  batchNumber: z
    .string()
    .min(1, 'เลขที่รุ่นการผลิตจำเป็น')
    .max(50, 'เลขที่รุ่นการผลิตต้องไม่เกิน 50 ตัวอักษร'),
  overheadType: overheadTypeSchema,
  allocationBasis: allocationBasisSchema,
  basisAmount: z.number().positive('จำนวนฐานการปันส่วนต้องมากกว่า 0'),
  overheadRate: z.number().positive('อัตราค่าใช้จ่ายโสหุ้ยต้องมากกว่า 0'),
  allocationDate: dateStringSchema,
  description: z.string().max(500).optional().nullable(),
});

export const transferToFinishedGoodsInputSchema = z.object({
  workOrderId: positiveIntSchema.describe('กรุณาเลือกใบสั่งผลิต'),
  batchNumber: z
    .string()
    .min(1, 'เลขที่รุ่นการผลิตจำเป็น')
    .max(50, 'เลขที่รุ่นการผลิตต้องไม่เกิน 50 ตัวอักษร'),
  finishedGoodsItemId: positiveIntSchema.describe('กรุณาเลือกสินค้าสำเร็จรูป'),
  producedQuantity: z.number().positive('จำนวนผลิตต้องมากกว่า 0'),
  transferDate: dateStringSchema,
  description: z.string().max(500).optional().nullable(),
  lotId: positiveIntSchema.optional().nullable(),
});

export const costAllocationInputSchema = z.discriminatedUnion('allocationType', [
  z.object({
    allocationType: z.literal('material'),
    data: materialCostInputSchema,
  }),
  z.object({
    allocationType: z.literal('labor'),
    data: laborCostInputSchema,
  }),
  z.object({
    allocationType: z.literal('overhead'),
    data: overheadAllocationInputSchema,
  }),
  z.object({
    allocationType: z.literal('transfer'),
    data: transferToFinishedGoodsInputSchema,
  }),
]);

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type GLAccountTypeCreateInput = z.infer<typeof glAccountTypeCreateSchema>;
export type GLAccountTypeUpdateInput = z.infer<typeof glAccountTypeUpdateSchema>;
export type GLAccountCreateInput = z.infer<typeof glAccountCreateSchema>;
export type GLAccountUpdateInput = z.infer<typeof glAccountUpdateSchema>;
export type GLAccountQueryInput = z.infer<typeof glAccountQuerySchema>;
export type FiscalYearCreateInput = z.infer<typeof fiscalYearCreateSchema>;
export type FiscalYearUpdateInput = z.infer<typeof fiscalYearUpdateSchema>;
export type FiscalPeriodCreateInput = z.infer<typeof fiscalPeriodCreateSchema>;
export type FiscalPeriodUpdateInput = z.infer<typeof fiscalPeriodUpdateSchema>;
export type FiscalPeriodQueryInput = z.infer<typeof fiscalPeriodQuerySchema>;
export type JournalLineCreateInput = z.infer<typeof journalLineCreateSchema>;
export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;
export type JournalEntryUpdateInput = z.infer<typeof journalEntryUpdateSchema>;
export type JournalEntryQueryInput = z.infer<typeof journalEntryQuerySchema>;
export type APInvoiceLineCreateInput = z.infer<typeof apInvoiceLineCreateSchema>;
export type APInvoiceCreateInput = z.infer<typeof apInvoiceCreateSchema>;
export type APInvoiceUpdateInput = z.infer<typeof apInvoiceUpdateSchema>;
export type APInvoiceQueryInput = z.infer<typeof apInvoiceQuerySchema>;
export type ARInvoiceLineCreateInput = z.infer<typeof arInvoiceLineCreateSchema>;
export type ARInvoiceCreateInput = z.infer<typeof arInvoiceCreateSchema>;
export type ARInvoiceUpdateInput = z.infer<typeof arInvoiceUpdateSchema>;
export type ARInvoiceQueryInput = z.infer<typeof arInvoiceQuerySchema>;
export type PaymentAllocationCreateInput = z.infer<typeof paymentAllocationCreateSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type VATTransactionCreateInput = z.infer<typeof vatTransactionCreateSchema>;
export type VATReportQueryInput = z.infer<typeof vatReportQuerySchema>;
export type WHTTransactionCreateInput = z.infer<typeof whtTransactionCreateSchema>;
export type AssetCategoryCreateInput = z.infer<typeof assetCategoryCreateSchema>;
export type AssetCategoryUpdateInput = z.infer<typeof assetCategoryUpdateSchema>;
export type FixedAssetCreateInput = z.infer<typeof fixedAssetCreateSchema>;
export type FixedAssetUpdateInput = z.infer<typeof fixedAssetUpdateSchema>;
export type FixedAssetQueryInput = z.infer<typeof fixedAssetQuerySchema>;
export type AssetDisposalCreateInput = z.infer<typeof assetDisposalCreateSchema>;
export type AssetMovementCreateInput = z.infer<typeof assetMovementCreateSchema>;
export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
export type EquipmentQueryInput = z.infer<typeof equipmentQuerySchema>;
export type MaintenanceScheduleCreateInput = z.infer<typeof maintenanceScheduleCreateSchema>;
export type MaintenanceScheduleUpdateInput = z.infer<typeof maintenanceScheduleUpdateSchema>;
export type MaintenanceRecordCreateInput = z.infer<typeof maintenanceRecordCreateSchema>;
export type MaintenanceRecordQueryInput = z.infer<typeof maintenanceRecordQuerySchema>;
export type TrialBalanceQueryInput = z.infer<typeof trialBalanceQuerySchema>;
export type BalanceSheetQueryInput = z.infer<typeof balanceSheetQuerySchema>;
export type IncomeStatementQueryInput = z.infer<typeof incomeStatementQuerySchema>;
export type AgingReportQueryInput = z.infer<typeof agingReportQuerySchema>;
export type AssetRegisterQueryInput = z.infer<typeof assetRegisterQuerySchema>;
export type DepreciationScheduleQueryInput = z.infer<typeof depreciationScheduleQuerySchema>;
export type MaintenanceDueQueryInput = z.infer<typeof maintenanceDueQuerySchema>;
// Cost Allocation Types (US4)
export type MaterialCostInput = z.infer<typeof materialCostInputSchema>;
export type LaborCostInput = z.infer<typeof laborCostInputSchema>;
export type OverheadAllocationInput = z.infer<typeof overheadAllocationInputSchema>;
export type TransferToFinishedGoodsInput = z.infer<typeof transferToFinishedGoodsInputSchema>;
export type CostAllocationInput = z.infer<typeof costAllocationInputSchema>;
