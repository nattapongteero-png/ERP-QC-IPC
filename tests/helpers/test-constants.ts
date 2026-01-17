/**
 * Test Constants
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Shared constants for integration tests.
 * Provides consistent IDs, statuses, and dates across all test files.
 */

// ============================================
// User IDs
// ============================================

export const TEST_USER_IDS = {
  QA_MANAGER: 1,
  PRODUCTION_SUPERVISOR: 2,
  QC_ANALYST: 3,
  DOCUMENT_CONTROLLER: 4,
  AUDITOR: 5,
} as const;

// ============================================
// Product/Item IDs
// ============================================

export const TEST_PRODUCT_IDS = {
  PRODUCT_A: 1,
  PRODUCT_B: 2,
  RAW_MATERIAL: 3,
} as const;

// ============================================
// Lot IDs
// ============================================

export const TEST_LOT_IDS = {
  LOT_A: 1,
  LOT_B: 2,
  LOT_QUARANTINE: 3,
} as const;

// ============================================
// Test Dates
// ============================================

const now = new Date();
const year = now.getFullYear();

export const TEST_DATES = {
  // Current date in ISO format
  TODAY: now.toISOString().split('T')[0],

  // Past date for historical records
  PAST_DATE: `${year - 1}-06-15`,

  // Future date for due dates, expiry, etc.
  FUTURE_DATE: `${year + 1}-06-15`,

  // Near future for urgency testing
  NEAR_FUTURE: `${year}-${String(now.getMonth() + 2).padStart(2, '0')}-01`,

  // Past due date for overdue testing
  OVERDUE_DATE: `${year - 1}-01-01`,

  // Month start for trends
  MONTH_START: `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
} as const;

// ============================================
// Status Values
// ============================================

export const CAPA_STATUSES = {
  OPEN: 'open',
  INVESTIGATION: 'investigation',
  ACTION_PLAN: 'action_plan',
  IMPLEMENTATION: 'implementation',
  VERIFICATION: 'verification',
  CLOSED: 'closed',
} as const;

export const COMPLAINT_STATUSES = {
  RECEIVED: 'received',
  UNDER_INVESTIGATION: 'under_investigation',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const DOCUMENT_STATUSES = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  OBSOLETE: 'obsolete',
} as const;

export const AUDIT_STATUSES = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REPORT_PENDING: 'report_pending',
  CLOSED: 'closed',
} as const;

export const RECALL_STATUSES = {
  INITIATED: 'initiated',
  IN_PROGRESS: 'in_progress',
  RECONCILIATION: 'reconciliation',
  CLOSED: 'closed',
} as const;

// ============================================
// Severity/Priority Values
// ============================================

export const SEVERITIES = {
  MINOR: 'minor',
  MAJOR: 'major',
  CRITICAL: 'critical',
} as const;

export const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// ============================================
// Complaint Categories
// ============================================

export const COMPLAINT_CATEGORIES = {
  QUALITY: 'quality',
  EFFICACY: 'efficacy',
  SAFETY: 'safety',
  PACKAGING: 'packaging',
  LABELING: 'labeling',
  OTHER: 'other',
} as const;

// ============================================
// Document Types
// ============================================

export const DOCUMENT_TYPE_CODES = {
  SOP: 'SOP',
  POLICY: 'POL',
  FORM: 'FORM',
  WORK_INSTRUCTION: 'WI',
  SPECIFICATION: 'SPEC',
} as const;

// ============================================
// GMP Chapter References
// ============================================

export const GMP_CHAPTERS = {
  CHAPTER_1: 'หมวด 1 - การบริหารและการจัดองค์กร',
  CHAPTER_2: 'หมวด 2 - บุคลากร',
  CHAPTER_3: 'หมวด 3 - อาคารสถานที่และสิ่งอำนวยความสะดวก',
  CHAPTER_4: 'หมวด 4 - เครื่องจักรและอุปกรณ์การผลิต',
  CHAPTER_5: 'หมวด 5 - สุขอนามัยและสุขาภิบาล',
  CHAPTER_6: 'หมวด 6 - วัตถุดิบและวัสดุการบรรจุ',
  CHAPTER_7: 'หมวด 7 - การดำเนินการผลิต',
  CHAPTER_8: 'หมวด 8 - การควบคุมคุณภาพ',
  CHAPTER_9: 'หมวด 9 - การจัดเก็บ จัดส่ง และเรียกคืนผลิตภัณฑ์',
  CHAPTER_10: 'หมวด 10 - เอกสาร',
} as const;

// ============================================
// Test Data Templates
// ============================================

export const CAPA_TEMPLATE = {
  title: 'Test CAPA',
  sourceType: 'deviation' as const,
  type: 'corrective' as const,
  priority: 'medium' as const,
  ownerId: TEST_USER_IDS.QA_MANAGER,
  dueDate: TEST_DATES.FUTURE_DATE,
};

export const COMPLAINT_TEMPLATE = {
  receivedDate: TEST_DATES.TODAY,
  source: 'customer' as const,
  customerName: 'Test Customer',
  customerContact: 'customer@test.com',
  productId: TEST_PRODUCT_IDS.PRODUCT_A,
  lotId: TEST_LOT_IDS.LOT_A,
  category: 'quality' as const,
  severity: 'major' as const,
  description: 'Test complaint description',
};

export const DOCUMENT_TEMPLATE = {
  typeId: 1, // SOP
  title: 'Test Document',
  effectiveDate: TEST_DATES.FUTURE_DATE,
  reviewDate: TEST_DATES.FUTURE_DATE,
};

export const AUDIT_TEMPLATE = {
  title: 'Test Audit',
  auditType: 'internal' as const,
  scope: 'GMP Compliance',
  scheduledDate: TEST_DATES.FUTURE_DATE,
  leadAuditorId: TEST_USER_IDS.AUDITOR,
};

// ============================================
// Extended IDs for UI Testing
// Feature: 014-unit-cost
// ============================================

export const TEST_VENDOR_IDS = {
  VENDOR_ALPHA: 1,
  VENDOR_BETA: 2,
  VENDOR_GAMMA: 3,
} as const;

export const TEST_CUSTOMER_IDS = {
  CUSTOMER_ALPHA: 1,
  CUSTOMER_BETA: 2,
  CUSTOMER_GAMMA: 3,
} as const;

export const TEST_PO_IDS = {
  DRAFT: 1,
  APPROVED: 2,
  RECEIVED_1: 3,
  RECEIVED_2: 4,
} as const;

export const TEST_SO_IDS = {
  DRAFT: 1,
  CONFIRMED: 2,
  SHIPPED: 3,
} as const;

export const TEST_WORK_ORDER_IDS = {
  DRAFT: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
} as const;

export const TEST_POSITION_IDS = {
  QA_MANAGER: 1,
  PRODUCTION_SUPERVISOR: 2,
  QC_ANALYST: 3,
  DOCUMENT_CONTROLLER: 4,
  AUDITOR: 5,
} as const;

// ============================================
// Status Enums for All Modules
// ============================================

export const PO_STATUSES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
} as const;

export const SO_STATUSES = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const WORK_ORDER_STATUSES = {
  DRAFT: 'draft',
  RELEASED: 'released',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const LANDED_COST_STATUSES = {
  DRAFT: 'draft',
  ALLOCATED: 'allocated',
  POSTED: 'posted',
} as const;

export const LOT_STATUSES = {
  QUARANTINE: 'quarantine',
  AVAILABLE: 'available',
  RELEASED: 'released',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

export const BOM_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  OBSOLETE: 'obsolete',
} as const;

// ============================================
// Landed Cost Types
// ============================================

export const LANDED_COST_TYPES = {
  FREIGHT: 'freight',
  DUTY: 'duty',
  INSURANCE: 'insurance',
  HANDLING: 'handling',
  INSPECTION: 'inspection',
  OTHER: 'other',
} as const;

export const ALLOCATION_BASES = {
  VALUE: 'value',
  QUANTITY: 'quantity',
  WEIGHT: 'weight',
  VOLUME: 'volume',
} as const;

// ============================================
// Test Data Templates for New Modules
// ============================================

export const VENDOR_TEMPLATE = {
  code: 'V-TEST',
  name: 'Test Vendor',
  contactPerson: 'Test Contact',
  phone: '0800000000',
  email: 'test@vendor.com',
  isApproved: true,
  isVMI: false,
};

export const CUSTOMER_TEMPLATE = {
  code: 'C-TEST',
  name: 'Test Customer',
  contactPerson: 'Test Contact',
  phone: '0800000000',
  email: 'test@customer.com',
  creditLimit: 100000,
};

export const PO_TEMPLATE = {
  vendorId: TEST_VENDOR_IDS.VENDOR_ALPHA,
  status: 'draft' as const,
  currency: 'THB',
  paymentTerms: 'Net 30',
};

export const LANDED_COST_TEMPLATE = {
  referenceType: 'po' as const,
  vendorId: TEST_VENDOR_IDS.VENDOR_ALPHA,
  currency: 'THB',
  exchangeRate: 1,
};

export const WORK_ORDER_TEMPLATE = {
  itemId: TEST_PRODUCT_IDS.PRODUCT_A,
  quantity: 100,
  unit: 'bottle',
  status: 'draft' as const,
  priority: 'medium' as const,
};
