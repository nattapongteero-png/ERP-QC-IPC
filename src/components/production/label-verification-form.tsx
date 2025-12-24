'use client';

import React, { useState, useCallback } from 'react';
import { Button } from 'devextreme-react/button';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import {
  Tag,
  CheckCircle2,
  Clock,
  UserCheck,
  Users,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Eye,
  XCircle,
} from 'lucide-react';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';
import { DocumentAttachment } from '@/components/ui/document-attachment';

export type LabelType = 'product_label' | 'batch_label' | 'carton_label' | 'shipper_label';

export interface LabelVerificationData {
  id: number;
  workOrderId: number;
  batchRecordId: number | null;
  labelType: LabelType;
  imageAttachmentId: number | null;
  productName: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  isCorrect: boolean | null;
  status: 'pending' | 'verified' | 'witnessed' | 'rejected';
  rejectionReason: string | null;
}

export interface LabelVerificationFormProps {
  workOrderId: number;
  workOrderNumber: string;
  batchRecordId?: number;
  batchNumber?: string;
  productName?: string;
  initialData?: Partial<LabelVerificationData>;
  status?: 'pending' | 'verified' | 'witnessed' | 'rejected';
  operatorName?: string;
  witnessName?: string;
  onVerify: (
    isCorrect: boolean,
    rejectionReason: string | undefined,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onWitness: (password: string) => Promise<{ success: boolean; error?: string }>;
  isOperator?: boolean;
  isWitness?: boolean;
  readOnly?: boolean;
  labelId?: number;
  labelType?: LabelType;
  onLabelTypeChange?: (labelType: LabelType) => void;
  onCreate?: (labelType: LabelType) => Promise<{ success: boolean; labelId?: number; error?: string }>;
}

const LABEL_TYPES: { value: LabelType; label: string }[] = [
  { value: 'product_label', label: 'Product Label' },
  { value: 'batch_label', label: 'Batch Label' },
  { value: 'carton_label', label: 'Carton Label' },
  { value: 'shipper_label', label: 'Shipper Label' },
];

/**
 * Label Verification Form Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14 - T081)
 *
 * A comprehensive label verification form with:
 * - Label type selection
 * - Image upload via DocumentAttachment
 * - Operator verification with electronic signature
 * - Witness confirmation with electronic signature (dual sign-off)
 * - Visual status indicators
 * - Read-only mode for viewing completed verifications
 */
export function LabelVerificationForm({
  workOrderId,
  workOrderNumber,
  batchRecordId,
  batchNumber,
  productName,
  initialData,
  status = 'pending',
  operatorName,
  witnessName,
  onVerify,
  onWitness,
  isOperator = true,
  isWitness = false,
  readOnly = false,
  labelId,
  labelType: initialLabelType,
  onLabelTypeChange,
  onCreate,
}: LabelVerificationFormProps) {
  const [selectedLabelType, setSelectedLabelType] = useState<LabelType>(
    initialLabelType || initialData?.labelType || 'product_label'
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signAction, setSignAction] = useState<'verify_approve' | 'verify_reject' | 'witness'>('verify_approve');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleLabelTypeChange = useCallback((value: LabelType) => {
    setSelectedLabelType(value);
    onLabelTypeChange?.(value);
  }, [onLabelTypeChange]);

  const handleCreateLabel = useCallback(async () => {
    if (!onCreate) return;

    setIsCreating(true);
    try {
      const result = await onCreate(selectedLabelType);
      if (!result.success) {
        console.error('Failed to create label:', result.error);
      }
    } finally {
      setIsCreating(false);
    }
  }, [onCreate, selectedLabelType]);

  const handleVerifyClick = useCallback((approved: boolean) => {
    if (!approved && !rejectionReason.trim()) {
      return; // Rejection reason required
    }
    setSignAction(approved ? 'verify_approve' : 'verify_reject');
    setShowSignDialog(true);
  }, [rejectionReason]);

  const handleWitnessClick = useCallback(() => {
    setSignAction('witness');
    setShowSignDialog(true);
  }, []);

  const handleSign = useCallback(
    async (password: string, meaning: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        if (signAction === 'witness') {
          return await onWitness(password);
        } else {
          const isCorrect = signAction === 'verify_approve';
          return await onVerify(isCorrect, isCorrect ? undefined : rejectionReason, password);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [signAction, rejectionReason, onVerify, onWitness]
  );

  const getSignatureMeaning = () => {
    switch (signAction) {
      case 'verify_approve':
        return 'I verify that the label content is correct and matches the product specifications.';
      case 'verify_reject':
        return `I verify that the label content is incorrect. Reason: ${rejectionReason}`;
      case 'witness':
        return 'I witness and confirm that the label verification was performed correctly and the label content matches the product specifications.';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            <Clock className="h-4 w-4" />
            Pending Verification
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            <UserCheck className="h-4 w-4" />
            Awaiting Witness
          </span>
        );
      case 'witnessed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Verified & Witnessed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <XCircle className="h-4 w-4" />
            Rejected
          </span>
        );
    }
  };

  const canVerify = !readOnly && isOperator && status === 'pending';
  const canWitness = !readOnly && isWitness && status === 'verified';
  const hasLabel = !!labelId;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Tag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Label Verification</h3>
              <p className="text-sm text-gray-600">
                Work Order: <span className="font-medium">{workOrderNumber}</span>
                {batchNumber && <span className="ml-2">• Batch: {batchNumber}</span>}
                {productName && <span className="ml-2">• {productName}</span>}
              </p>
            </div>
          </div>
          {hasLabel && getStatusBadge()}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Label Type Selector */}
        {!hasLabel && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Label Type
            </label>
            <div className="flex gap-4">
              <div className="flex-1">
                <SelectBox
                  dataSource={LABEL_TYPES}
                  displayExpr="label"
                  valueExpr="value"
                  value={selectedLabelType}
                  onValueChange={handleLabelTypeChange}
                  disabled={readOnly}
                />
              </div>
              {onCreate && (
                <Button
                  text={isCreating ? 'Creating...' : 'Create Label Record'}
                  type="default"
                  stylingMode="contained"
                  icon="plus"
                  onClick={handleCreateLabel}
                  disabled={isCreating}
                />
              )}
            </div>
          </div>
        )}

        {/* Label Image Upload */}
        {hasLabel && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Label Image
            </h4>
            <DocumentAttachment
              moduleName="label_verification"
              entityId={labelId!}
              title="Label Images"
              readOnly={readOnly || status !== 'pending'}
              maxFiles={5}
              allowedExtensions={['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']}
              categories={['photo']}
              showPreview
            />
          </div>
        )}

        {/* Label Information Display */}
        {hasLabel && (initialData?.productName || initialData?.batchNumber || initialData?.expiryDate) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Label Content</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {initialData?.productName && (
                <div>
                  <span className="text-gray-500">Product Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{initialData.productName}</span>
                </div>
              )}
              {initialData?.batchNumber && (
                <div>
                  <span className="text-gray-500">Batch Number:</span>
                  <span className="ml-2 font-medium text-gray-900">{initialData.batchNumber}</span>
                </div>
              )}
              {initialData?.expiryDate && (
                <div>
                  <span className="text-gray-500">Expiry Date:</span>
                  <span className="ml-2 font-medium text-gray-900">{initialData.expiryDate}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rejection Reason (for operator) */}
        {canVerify && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason (if label is incorrect)
            </label>
            <TextArea
              value={rejectionReason}
              onValueChange={setRejectionReason}
              placeholder="Enter reason if the label content is incorrect..."
              height={80}
            />
          </div>
        )}

        {/* Rejection Display (for rejected labels) */}
        {status === 'rejected' && initialData?.rejectionReason && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Rejection Reason
            </h4>
            <p className="text-sm text-red-600">{initialData.rejectionReason}</p>
          </div>
        )}

        {/* Signature Info */}
        {(operatorName || witnessName) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Electronic Signatures</h4>
            <div className="space-y-2 text-sm">
              {operatorName && (
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-600">Verified by:</span>
                  <span className="font-medium text-gray-900">{operatorName}</span>
                </div>
              )}
              {witnessName && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">Witnessed by:</span>
                  <span className="font-medium text-gray-900">{witnessName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {hasLabel && (canVerify || canWitness) && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {canVerify && (
                <span className="flex items-center gap-1.5 text-blue-600">
                  <Eye className="h-4 w-4" />
                  Review the label and verify or reject
                </span>
              )}
              {canWitness && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <Users className="h-4 w-4" />
                  Review and witness the verification (dual sign-off)
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {canVerify && (
                <>
                  <Button
                    text="Reject"
                    type="danger"
                    stylingMode="outlined"
                    icon="close"
                    onClick={() => handleVerifyClick(false)}
                    disabled={isLoading || !rejectionReason.trim()}
                  />
                  <Button
                    text="Verify Correct"
                    type="success"
                    stylingMode="contained"
                    icon="check"
                    onClick={() => handleVerifyClick(true)}
                    disabled={isLoading}
                  />
                </>
              )}
              {canWitness && (
                <Button
                  text="Witness & Confirm"
                  type="success"
                  stylingMode="contained"
                  icon="check"
                  onClick={handleWitnessClick}
                  disabled={isLoading}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Electronic Signature Dialog */}
      <ElectronicSignatureDialog
        visible={showSignDialog}
        title={
          signAction === 'verify_approve'
            ? 'Verify Label - Correct'
            : signAction === 'verify_reject'
            ? 'Verify Label - Reject'
            : 'Witness Label Verification'
        }
        action={signAction}
        meaning={getSignatureMeaning()}
        onSign={handleSign}
        onCancel={() => setShowSignDialog(false)}
        isLoading={isLoading}
      />
    </div>
  );
}

export default LabelVerificationForm;
