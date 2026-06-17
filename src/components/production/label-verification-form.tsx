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
  { value: 'product_label', label: 'ฉลากผลิตภัณฑ์' },
  { value: 'batch_label', label: 'ฉลากรุ่นการผลิต' },
  { value: 'carton_label', label: 'ฉลากกล่อง' },
  { value: 'shipper_label', label: 'ฉลากหีบห่อขนส่ง' },
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
        return 'ข้าพเจ้าตรวจสอบยืนยันว่าเนื้อหาบนฉลากถูกต้องและตรงกับข้อกำหนดของผลิตภัณฑ์';
      case 'verify_reject':
        return `ข้าพเจ้าตรวจสอบยืนยันว่าเนื้อหาบนฉลากไม่ถูกต้อง เหตุผล: ${rejectionReason}`;
      case 'witness':
        return 'ข้าพเจ้าเป็นพยานและยืนยันว่าการตรวจสอบฉลากดำเนินการอย่างถูกต้อง และเนื้อหาบนฉลากตรงกับข้อกำหนดของผลิตภัณฑ์';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            <Clock className="h-4 w-4" />
            รอการตรวจสอบยืนยัน
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
            <UserCheck className="h-4 w-4" />
            รอพยานยืนยัน
          </span>
        );
      case 'witnessed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            ตรวจสอบยืนยันและมีพยานแล้ว
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <XCircle className="h-4 w-4" />
            ไม่ผ่าน
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
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-100/40 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Tag className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">การตรวจสอบยืนยันฉลาก</h3>
              <p className="text-sm text-gray-600">
                ใบสั่งผลิต: <span className="font-medium">{workOrderNumber}</span>
                {batchNumber && <span className="ml-2">• รุ่นการผลิต: {batchNumber}</span>}
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
              เลือกประเภทฉลาก
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
                  text={isCreating ? 'กำลังสร้าง...' : 'สร้างบันทึกฉลาก'}
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
              รูปฉลาก
            </h4>
            <DocumentAttachment
              moduleName="label_verification"
              entityId={labelId!}
              title="รูปฉลาก"
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
            <h4 className="text-sm font-medium text-gray-700 mb-3">เนื้อหาบนฉลาก</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {initialData?.productName && (
                <div>
                  <span className="text-gray-500">ชื่อผลิตภัณฑ์:</span>
                  <span className="ml-2 font-medium text-gray-900">{initialData.productName}</span>
                </div>
              )}
              {initialData?.batchNumber && (
                <div>
                  <span className="text-gray-500">หมายเลขรุ่นการผลิต:</span>
                  <span className="ml-2 font-medium text-gray-900">{initialData.batchNumber}</span>
                </div>
              )}
              {initialData?.expiryDate && (
                <div>
                  <span className="text-gray-500">วันหมดอายุ:</span>
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
              เหตุผลการปฏิเสธ (กรณีฉลากไม่ถูกต้อง)
            </label>
            <TextArea
              value={rejectionReason}
              onValueChange={setRejectionReason}
              placeholder="ระบุเหตุผลหากเนื้อหาบนฉลากไม่ถูกต้อง..."
              height={80}
            />
          </div>
        )}

        {/* Rejection Display (for rejected labels) */}
        {status === 'rejected' && initialData?.rejectionReason && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              เหตุผลการปฏิเสธ
            </h4>
            <p className="text-sm text-red-600">{initialData.rejectionReason}</p>
          </div>
        )}

        {/* Signature Info */}
        {(operatorName || witnessName) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">ลายเซ็นอิเล็กทรอนิกส์</h4>
            <div className="space-y-2 text-sm">
              {operatorName && (
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-gray-600">ตรวจสอบยืนยันโดย:</span>
                  <span className="font-medium text-gray-900">{operatorName}</span>
                </div>
              )}
              {witnessName && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">พยานยืนยันโดย:</span>
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
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <Eye className="h-4 w-4" />
                  ตรวจทานฉลากแล้วยืนยันหรือปฏิเสธ
                </span>
              )}
              {canWitness && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <Users className="h-4 w-4" />
                  ตรวจทานและเป็นพยานการตรวจสอบยืนยัน (ลงนามสองฝ่าย)
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {canVerify && (
                <>
                  <Button
                    text="ปฏิเสธ"
                    type="danger"
                    stylingMode="outlined"
                    icon="close"
                    onClick={() => handleVerifyClick(false)}
                    disabled={isLoading || !rejectionReason.trim()}
                  />
                  <Button
                    text="ยืนยันว่าถูกต้อง"
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
                  text="เป็นพยานและยืนยัน"
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
            ? 'ตรวจสอบยืนยันฉลาก - ถูกต้อง'
            : signAction === 'verify_reject'
            ? 'ตรวจสอบยืนยันฉลาก - ปฏิเสธ'
            : 'เป็นพยานการตรวจสอบยืนยันฉลาก'
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
