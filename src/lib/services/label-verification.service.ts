/**
 * Label Verification Service
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14 - T077)
 *
 * Implements label verification workflow with dual sign-off:
 * - FR-064: Label Image Attachment to batch record
 * - FR-065: Dual Label Verification (operator + witness)
 * - FR-071-074: Electronic Signatures for both operator and witness
 *
 * Workflow:
 * 1. Create label verification record with image attachment
 * 2. Operator verifies label content with e-signature
 * 3. Witness confirms verification with e-signature (different person)
 */

import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDateSafe } from '../db/date-utils';
import { eq, and } from 'drizzle-orm';
import { createElectronicSignature, getSignaturesForEntity, type SignatureResult } from './electronic-signature-service';

// Types
export type LabelType = 'product_label' | 'batch_label' | 'carton_label' | 'shipper_label';

export interface LabelVerification {
  id: number;
  workOrderId: number;
  batchRecordId: number | null;
  labelType: LabelType;
  imageAttachmentId: number | null;
  productName: string | null;
  batchNumber: string | null;
  expiryDate: string | Date | null;
  isCorrect: boolean | null;
  operatorId: number | null;
  operatorSignatureId: number | null;
  witnessId: number | null;
  witnessSignatureId: number | null;
  status: 'pending' | 'verified' | 'witnessed' | 'rejected';
  rejectionReason: string | null;
  createdAt: string | Date;
  verifiedAt: string | Date | null;
}

export interface CreateLabelInput {
  workOrderId: number;
  batchRecordId?: number;
  labelType: LabelType;
  imageAttachmentId?: number;
  productName?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface VerifyLabelInput {
  labelId: number;
  userId: number;
  password: string;
  isCorrect: boolean;
  rejectionReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface WitnessLabelInput {
  labelId: number;
  userId: number;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LabelVerificationResult {
  success: boolean;
  labelId?: number;
  error?: string;
  label?: LabelVerification;
}

export interface LabelVerificationDetails {
  label: LabelVerification;
  operatorName?: string;
  witnessName?: string;
  signatures: Array<{
    id: number;
    action: string;
    fullName: string;
    signedAt: string | Date;
    meaning: string;
  }>;
  imageUrl?: string;
}

/**
 * Create a new label verification record
 */
export async function createLabelVerification(
  input: CreateLabelInput
): Promise<LabelVerificationResult> {
  const labelTable = getTableRef('labelVerifications');

  try {
    const labelData = {
      workOrderId: input.workOrderId,
      batchRecordId: input.batchRecordId ?? null,
      labelType: input.labelType,
      imageAttachmentId: input.imageAttachmentId ?? null,
      productName: input.productName ?? null,
      batchNumber: input.batchNumber ?? null,
      expiryDate: input.expiryDate ?? null,
      isCorrect: null,
      operatorId: null,
      operatorSignatureId: null,
      witnessId: null,
      witnessSignatureId: null,
      status: 'pending',
      rejectionReason: null,
      createdAt: getNow(),
      verifiedAt: null,
    };

    const result = await executeDbOperation(async (db) => {
      return db.insert(labelTable).values(labelData);
    });
    const labelId = getInsertId(result);

    return {
      success: true,
      labelId,
      label: {
        id: labelId,
        ...labelData,
      } as LabelVerification,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create label verification: ${(error as Error).message}`,
    };
  }
}

/**
 * Get label verification by ID
 */
export async function getLabelVerification(
  labelId: number
): Promise<LabelVerification | null> {
  const labelTable = getTableRef('labelVerifications');

  const labels = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(labelTable)
      .where(eq(labelTable.id, labelId))
      .limit(1);
  });

  return labels.length > 0 ? (labels[0] as LabelVerification) : null;
}

/**
 * Get all label verifications for a work order
 */
export async function getLabelVerificationsForWorkOrder(
  workOrderId: number
): Promise<LabelVerification[]> {
  const labelTable = getTableRef('labelVerifications');

  const labels = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(labelTable)
      .where(eq(labelTable.workOrderId, workOrderId));
  });

  return labels as LabelVerification[];
}

/**
 * Get all label verifications for a batch record
 */
export async function getLabelVerificationsForBatchRecord(
  batchRecordId: number
): Promise<LabelVerification[]> {
  const labelTable = getTableRef('labelVerifications');

  const labels = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(labelTable)
      .where(eq(labelTable.batchRecordId, batchRecordId));
  });

  return labels as LabelVerification[];
}

/**
 * Operator verifies label with electronic signature
 * FR-064: Label verification with e-signature
 */
export async function verifyLabel(
  input: VerifyLabelInput
): Promise<LabelVerificationResult> {
  const labelTable = getTableRef('labelVerifications');

  // Get existing label
  const label = await getLabelVerification(input.labelId);
  if (!label) {
    return {
      success: false,
      error: 'Label verification record not found',
    };
  }

  // Check if already verified by operator
  if (label.operatorId) {
    return {
      success: false,
      error: 'Label has already been verified by an operator',
    };
  }

  // Create electronic signature for operator verification
  const meaning = input.isCorrect
    ? 'I verify that the label content is correct and matches the product specifications.'
    : `I verify that the label content is incorrect. Reason: ${input.rejectionReason || 'Not specified'}`;

  const signatureResult = await createElectronicSignature({
    entityType: 'label_verification',
    entityId: input.labelId,
    action: 'operator_verify',
    userId: input.userId,
    password: input.password,
    meaning,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (!signatureResult.success) {
    return {
      success: false,
      error: signatureResult.error,
    };
  }

  // Update label verification record
  const newStatus = input.isCorrect ? 'verified' : 'rejected';

  await executeDbOperation(async (db) => {
    return db
      .update(labelTable)
      .set({
        operatorId: input.userId,
        operatorSignatureId: signatureResult.signatureId,
        isCorrect: input.isCorrect,
        status: newStatus,
        rejectionReason: input.isCorrect ? null : (input.rejectionReason || null),
        verifiedAt: getNow(),
      })
      .where(eq(labelTable.id, input.labelId));
  });

  // Get updated label
  const updatedLabel = await getLabelVerification(input.labelId);

  return {
    success: true,
    labelId: input.labelId,
    label: updatedLabel!,
  };
}

/**
 * Witness confirms label verification with electronic signature
 * FR-065: Dual verification with witness signature
 */
export async function witnessLabel(
  input: WitnessLabelInput
): Promise<LabelVerificationResult> {
  const labelTable = getTableRef('labelVerifications');

  // Get existing label
  const label = await getLabelVerification(input.labelId);
  if (!label) {
    return {
      success: false,
      error: 'Label verification record not found',
    };
  }

  // Check if operator has verified
  if (!label.operatorId || label.status === 'pending') {
    return {
      success: false,
      error: 'Label must be verified by operator first',
    };
  }

  // Check if rejected - can't witness a rejected label
  if (label.status === 'rejected') {
    return {
      success: false,
      error: 'Cannot witness a rejected label verification',
    };
  }

  // Check if already witnessed
  if (label.witnessId) {
    return {
      success: false,
      error: 'Label has already been witnessed',
    };
  }

  // Ensure witness is different from operator (dual sign-off requirement)
  if (label.operatorId === input.userId) {
    return {
      success: false,
      error: 'Witness must be a different person from the operator (dual sign-off requirement)',
    };
  }

  // Create electronic signature for witness
  const meaning = 'I witness and confirm that the label verification was performed correctly and the label content matches the product specifications.';

  const signatureResult = await createElectronicSignature({
    entityType: 'label_verification',
    entityId: input.labelId,
    action: 'witness_verify',
    userId: input.userId,
    password: input.password,
    meaning,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (!signatureResult.success) {
    return {
      success: false,
      error: signatureResult.error,
    };
  }

  // Update label verification record
  await executeDbOperation(async (db) => {
    return db
      .update(labelTable)
      .set({
        witnessId: input.userId,
        witnessSignatureId: signatureResult.signatureId,
        status: 'witnessed',
      })
      .where(eq(labelTable.id, input.labelId));
  });

  // Get updated label
  const updatedLabel = await getLabelVerification(input.labelId);

  return {
    success: true,
    labelId: input.labelId,
    label: updatedLabel!,
  };
}

/**
 * Get label verification details with signatures
 */
export async function getLabelVerificationDetails(
  labelId: number
): Promise<LabelVerificationDetails | null> {
  const label = await getLabelVerification(labelId);
  if (!label) {
    return null;
  }

  const usersTable = getTableRef('users');
  const attachmentsTable = getTableRef('attachments');

  // Get operator name
  let operatorName: string | undefined;
  if (label.operatorId) {
    const operators = await executeDbOperation(async (db) => {
      return db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, label.operatorId!))
        .limit(1);
    });
    operatorName = operators[0]?.name;
  }

  // Get witness name
  let witnessName: string | undefined;
  if (label.witnessId) {
    const witnesses = await executeDbOperation(async (db) => {
      return db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, label.witnessId!))
        .limit(1);
    });
    witnessName = witnesses[0]?.name;
  }

  // Get signatures
  const allSignatures = await getSignaturesForEntity('label_verification', labelId);
  const signatures = allSignatures.map((sig) => ({
    id: sig.id,
    action: sig.action,
    fullName: sig.fullName,
    signedAt: sig.signedAt,
    meaning: sig.meaning,
  }));

  // Get image URL if attachment exists
  let imageUrl: string | undefined;
  if (label.imageAttachmentId) {
    imageUrl = `/api/attachments/${label.imageAttachmentId}`;
  }

  return {
    label,
    operatorName,
    witnessName,
    signatures,
    imageUrl,
  };
}

/**
 * Update label image attachment
 */
export async function updateLabelImage(
  labelId: number,
  attachmentId: number
): Promise<LabelVerificationResult> {
  const labelTable = getTableRef('labelVerifications');

  const label = await getLabelVerification(labelId);
  if (!label) {
    return {
      success: false,
      error: 'Label verification record not found',
    };
  }

  // Can only update image for pending labels
  if (label.status !== 'pending') {
    return {
      success: false,
      error: 'Cannot update image for a label that has already been verified',
    };
  }

  await executeDbOperation(async (db) => {
    return db
      .update(labelTable)
      .set({
        imageAttachmentId: attachmentId,
      })
      .where(eq(labelTable.id, labelId));
  });

  const updatedLabel = await getLabelVerification(labelId);

  return {
    success: true,
    labelId,
    label: updatedLabel!,
  };
}

/**
 * Check if all required labels are verified for a work order
 */
export async function checkLabelsVerified(
  workOrderId: number
): Promise<{
  allVerified: boolean;
  total: number;
  verified: number;
  witnessed: number;
  pending: number;
  rejected: number;
}> {
  const labels = await getLabelVerificationsForWorkOrder(workOrderId);

  const total = labels.length;
  const verified = labels.filter((l) => l.status === 'verified').length;
  const witnessed = labels.filter((l) => l.status === 'witnessed').length;
  const pending = labels.filter((l) => l.status === 'pending').length;
  const rejected = labels.filter((l) => l.status === 'rejected').length;

  // All verified means all labels are witnessed (dual sign-off complete)
  const allVerified = total > 0 && witnessed === total;

  return {
    allVerified,
    total,
    verified,
    witnessed,
    pending,
    rejected,
  };
}

/**
 * Get label type display name
 */
export function getLabelTypeDisplayName(labelType: LabelType): string {
  const displayNames: Record<LabelType, string> = {
    product_label: 'Product Label',
    batch_label: 'Batch Label',
    carton_label: 'Carton Label',
    shipper_label: 'Shipper Label',
  };
  return displayNames[labelType] || labelType;
}
