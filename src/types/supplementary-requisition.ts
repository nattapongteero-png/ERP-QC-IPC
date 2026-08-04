/**
 * Work Order Supplementary Requisition — GMP-compliant mid-production
 * re-requisition (PIC/S 6.32, 21 CFR Part 211.192).
 *
 * Used when material is damaged/spilled/contaminated during production and
 * additional material must be drawn from the warehouse. Each request:
 *   - auto-creates a linked Deviation record
 *   - requires Head of Production approval (with e-signature)
 *   - then QA concurrence (with e-signature)
 *   - then warehouse physical issuance
 */

export type ReasonCategory =
  | 'damage'              // ของเสียหาย/แตก
  | 'spillage'            // หกกระเด็น
  | 'contamination'       // ปนเปื้อน
  | 'weighing_loss'       // ความผิดพลาดจากการชั่ง
  | 'machine_setup_loss'  // สูญเสียระหว่างตั้งค่าเครื่อง (machine setup/flushing/priming)
  | 'equipment_failure'   // เครื่องมือผิดพลาด
  | 'operator_error'      // ความผิดพลาดของผู้ปฏิบัติงาน
  | 'other';              // อื่นๆ

export const REASON_CATEGORIES: ReasonCategory[] = [
  'damage',
  'spillage',
  'contamination',
  'weighing_loss',
  'machine_setup_loss',
  'equipment_failure',
  'operator_error',
  'other',
];

export type ThresholdLevel = 'low' | 'medium' | 'high';

export type SupplementaryRequisitionStatus =
  | 'requested'        // ฝ่ายผลิตขอ รอหัวหน้าฝ่ายผลิตอนุมัติ
  | 'prod_approved'    // หัวหน้าฝ่ายผลิตอนุมัติ รอ QA
  | 'qa_approved'      // QA อนุมัติ รอคลังจ่าย
  | 'issued'           // คลังจ่ายแล้ว
  | 'rejected'         // ปฏิเสธ (terminal)
  | 'cancelled';       // ยกเลิกโดยผู้ขอก่อนอนุมัติ (terminal)

export type RejectionStage = 'prod' | 'qa';

export interface SupplementaryRequisitionLineInput {
  itemId: number;
  originalMaterialId?: number | null;
  requestedQuantity: number;
  unit: string;
  notes?: string | null;
}

export interface SupplementaryRequisitionLine extends SupplementaryRequisitionLineInput {
  id: number;
  supplementaryRequisitionId: number;
  lotId: number | null;
  issuedQuantity: number | null;
  createdAt: string | Date;
  // joined display fields
  itemCode?: string | null;
  itemName?: string | null;
  lotNumber?: string | null;
}

export interface SupplementaryRequisitionRecord {
  id: number;
  workOrderId: number;
  requestNo: string;
  reasonCategory: ReasonCategory;
  reasonDetail: string;
  linkedDeviationId: number | null;
  linkedReturnId: number | null;
  thresholdLevel: ThresholdLevel;
  status: SupplementaryRequisitionStatus;
  requestedBy: number;
  requestedAt: string | Date;
  prodApprovedBy: number | null;
  prodApprovedAt: string | Date | null;
  prodSignatureId: number | null;
  qaApprovedBy: number | null;
  qaApprovedAt: string | Date | null;
  qaSignatureId: number | null;
  issuedBy: number | null;
  issuedAt: string | Date | null;
  rejectedBy: number | null;
  rejectedAt: string | Date | null;
  rejectedReason: string | null;
  rejectionStage: RejectionStage | null;
  cancelledBy: number | null;
  cancelledAt: string | Date | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * Aggregate view used by inbox + detail UIs (header + lines + actor names).
 */
export interface SupplementaryRequisitionDetail extends SupplementaryRequisitionRecord {
  lines: SupplementaryRequisitionLine[];
  // Display: requester / approvers / warehouse
  requestedByName: string | null;
  prodApprovedByName: string | null;
  qaApprovedByName: string | null;
  issuedByName: string | null;
  rejectedByName: string | null;
  // Work order context
  woNumber: string;
  batchNumber: string;
  productName: string;
  // Linked deviation
  deviationNumber: string | null;
}

export interface CreateSupplementaryRequisitionInput {
  workOrderId: number;
  reasonCategory: ReasonCategory;
  reasonDetail: string;
  linkedReturnId?: number | null;
  lines: SupplementaryRequisitionLineInput[];
  notes?: string | null;
}

export interface ApproveSupplementaryRequisitionInput {
  password: string; // for e-signature re-authentication
  meaning?: string; // override signature meaning if needed
}

export interface RejectSupplementaryRequisitionInput {
  reason: string;   // why rejected
  password: string; // for e-signature re-authentication
}

export interface IssueSupplementaryRequisitionInput {
  lines: Array<{
    lineId: number;
    lotId: number;
    issuedQuantity: number;
  }>;
}
