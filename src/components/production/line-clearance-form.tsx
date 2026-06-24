'use client';

import React, { useState, useCallback } from 'react';
import { Button } from 'devextreme-react/button';
import { TextArea } from 'devextreme-react/text-area';
import { CheckBox } from 'devextreme-react/check-box';
import {
  ClipboardCheck,
  Trash2,
  Sparkles,
  Wrench,
  ShieldAlert,
  Tag,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';
import { useTranslations } from 'next-intl';

export interface LineClearanceChecklistData {
  previousProductCleared: boolean;
  areaClean: boolean;
  equipmentClean: boolean;
  noContaminationRisk: boolean;
  labelsRemoved: boolean;
  docsReady: boolean;
  notes?: string;
}

export interface LineClearanceFormProps {
  workOrderId: number;
  workOrderNumber: string;
  productName?: string;
  initialData?: Partial<LineClearanceChecklistData>;
  status: 'not_started' | 'pending' | 'performed' | 'verified' | 'rejected';
  performerName?: string;
  performedAt?: string;
  verifierName?: string;
  verifiedAt?: string;
  onPerform: (data: LineClearanceChecklistData, password: string) => Promise<{ success: boolean; error?: string }>;
  onVerify: (approved: boolean, password: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  isPerformer?: boolean;
  isVerifier?: boolean;
  readOnly?: boolean;
}

// Checklist item keys + icons. Labels/descriptions are pulled from i18n
// (lineClearance.items.<key>) at render time so they switch with the locale.
const CHECKLIST_ITEMS = [
  { key: 'previousProductCleared' as const, icon: Trash2 },
  { key: 'areaClean' as const, icon: Sparkles },
  { key: 'equipmentClean' as const, icon: Wrench },
  { key: 'noContaminationRisk' as const, icon: ShieldAlert },
  { key: 'labelsRemoved' as const, icon: Tag },
  { key: 'docsReady' as const, icon: FileText },
];

/**
 * Line Clearance Form Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US13 - T072)
 *
 * A comprehensive line clearance checklist form with:
 * - 6 GMP-required checklist items
 * - Electronic signature integration for perform and verify
 * - Visual status indicators
 * - Read-only mode for viewing completed clearances
 */
export function LineClearanceForm({
  workOrderId,
  workOrderNumber,
  productName,
  initialData,
  status,
  performerName,
  performedAt,
  verifierName,
  verifiedAt,
  onPerform,
  onVerify,
  isPerformer = true,
  isVerifier = false,
  readOnly = false,
}: LineClearanceFormProps) {
  const t = useTranslations('production.lineClearance');
  const [checklistData, setChecklistData] = useState<LineClearanceChecklistData>({
    previousProductCleared: initialData?.previousProductCleared ?? false,
    areaClean: initialData?.areaClean ?? false,
    equipmentClean: initialData?.equipmentClean ?? false,
    noContaminationRisk: initialData?.noContaminationRisk ?? false,
    labelsRemoved: initialData?.labelsRemoved ?? false,
    docsReady: initialData?.docsReady ?? false,
    notes: initialData?.notes ?? '',
  });

  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signAction, setSignAction] = useState<'perform' | 'verify_approve' | 'verify_reject'>('perform');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const allItemsChecked =
    checklistData.previousProductCleared &&
    checklistData.areaClean &&
    checklistData.equipmentClean &&
    checklistData.noContaminationRisk &&
    checklistData.labelsRemoved &&
    checklistData.docsReady;

  const handleChecklistChange = useCallback((key: keyof LineClearanceChecklistData, value: boolean) => {
    setChecklistData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePerformClick = useCallback(() => {
    setSignAction('perform');
    setShowSignDialog(true);
  }, []);

  const handleVerifyClick = useCallback((approved: boolean) => {
    setSignAction(approved ? 'verify_approve' : 'verify_reject');
    setShowSignDialog(true);
  }, []);

  const handleSign = useCallback(
    async (password: string, meaning: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        if (signAction === 'perform') {
          return await onPerform(checklistData, password);
        } else {
          const approved = signAction === 'verify_approve';
          return await onVerify(approved, password, verifyNotes || undefined);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [signAction, checklistData, verifyNotes, onPerform, onVerify]
  );

  const getSignatureMeaning = () => {
    switch (signAction) {
      case 'perform':
        return t('meaning.perform');
      case 'verify_approve':
        return t('meaning.verify_approve');
      case 'verify_reject':
        return `${t('meaning.verify_reject')}${verifyNotes ? ` (${verifyNotes})` : ''}`;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'not_started':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            <Clock className="h-4 w-4" />
            {t('status.not_started')}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
            <Clock className="h-4 w-4" />
            {t('status.pending')}
          </span>
        );
      case 'performed':
        // Awaiting verification — amber, NOT green (green is reserved for verified).
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
            <UserCheck className="h-4 w-4" />
            {t('status.performed')}
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {t('status.verified')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <AlertCircle className="h-4 w-4" />
            {t('status.rejected')}
          </span>
        );
    }
  };

  const canPerform = !readOnly && isPerformer && (status === 'not_started' || status === 'pending' || status === 'rejected');
  const canVerify = !readOnly && isVerifier && status === 'performed';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-100/40 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('checklistTitle')}</h3>
              <p className="text-sm text-gray-600">
                {t('workOrderLabel')}: <span className="font-medium">{workOrderNumber}</span>
                {productName && <span className="ml-2">• {productName}</span>}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Checklist Items */}
      <div className="p-6">
        <div className="space-y-4">
          {CHECKLIST_ITEMS.map((item) => {
            const Icon = item.icon;
            const isChecked = checklistData[item.key] as boolean;
            const isDisabled = readOnly || !canPerform;

            return (
              <div
                key={item.key}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isChecked
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isDisabled ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isChecked ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isChecked ? 'text-emerald-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <CheckBox
                        value={isChecked}
                        onValueChange={(value) => handleChecklistChange(item.key, value ?? false)}
                        disabled={isDisabled}
                      />
                      <label className="font-medium text-gray-900">{t(`items.${item.key}.label`)}</label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-7">{t(`items.${item.key}.description`)}</p>
                  </div>
                  {isChecked && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes Section */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('notesLabel')}</label>
          <TextArea
            value={checklistData.notes}
            onValueChange={(value) => setChecklistData((prev) => ({ ...prev, notes: value }))}
            placeholder={t('notesPlaceholder')}
            height={80}
            disabled={readOnly || !canPerform}
          />
        </div>

        {/* Signature Info */}
        {(performerName || verifierName) && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">{t('signaturesTitle')}</h4>
            <div className="space-y-2 text-sm">
              {performerName && (
                <div className="flex items-center gap-2">
                  {/* Stays amber (awaiting verification) until a verifier signs;
                      only the full clearance turns green once verified. */}
                  {status === 'verified' ? (
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-gray-600">{t('performedBy')}</span>
                  <span className="font-medium text-gray-900">{performerName}</span>
                  {performedAt && (
                    <span className="text-gray-500">
                      • {new Date(performedAt).toLocaleString('th-TH')}
                    </span>
                  )}
                </div>
              )}
              {verifierName && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">{t('verifiedBy')}</span>
                  <span className="font-medium text-gray-900">{verifierName}</span>
                  {verifiedAt && (
                    <span className="text-gray-500">
                      • {new Date(verifiedAt).toLocaleString('th-TH')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verify Notes Input (for verifier) */}
        {canVerify && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('verifyNotesLabel')}
            </label>
            <TextArea
              value={verifyNotes}
              onValueChange={setVerifyNotes}
              placeholder={t('verifyNotesPlaceholder')}
              height={80}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {canPerform && !allItemsChecked && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                {t('allItemsRequired')}
              </span>
            )}
            {canVerify && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <UserCheck className="h-4 w-4" />
                {t('reviewHint')}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {canPerform && (
              <Button
                text={isLoading ? t('signing') : t('signComplete')}
                type="success"
                stylingMode="contained"
                icon="check"
                onClick={handlePerformClick}
                disabled={!allItemsChecked || isLoading}
              />
            )}
            {canVerify && (
              <>
                <Button
                  text={t('reject')}
                  type="danger"
                  stylingMode="outlined"
                  icon="close"
                  onClick={() => handleVerifyClick(false)}
                  disabled={isLoading}
                />
                <Button
                  text={t('approve')}
                  type="success"
                  stylingMode="contained"
                  icon="check"
                  onClick={() => handleVerifyClick(true)}
                  disabled={isLoading}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Electronic Signature Dialog */}
      <ElectronicSignatureDialog
        visible={showSignDialog}
        title={t(`signDialogTitle.${signAction}`)}
        action={signAction}
        meaning={getSignatureMeaning()}
        onSign={handleSign}
        onCancel={() => setShowSignDialog(false)}
        isLoading={isLoading}
      />
    </div>
  );
}

export default LineClearanceForm;
