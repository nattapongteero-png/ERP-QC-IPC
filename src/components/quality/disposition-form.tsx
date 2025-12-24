'use client';

import React, { useState, useCallback } from 'react';
import { Button } from 'devextreme-react/button';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  UserCheck,
  Users,
  AlertCircle,
  XCircle,
  RotateCcw,
  Trash2,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';

export type DispositionType =
  | 'accept'
  | 'reject'
  | 'rework'
  | 'scrap'
  | 'return_to_vendor'
  | 'conditional_release';

export interface DispositionData {
  disposition: DispositionType | null;
  dispositionReason: string | null;
  dispositionAt: string | null;
  dispositionApprovedAt: string | null;
}

export interface DispositionFormProps {
  testId: number;
  testType: string;
  testResult: string | null;
  lotNumber?: string;
  itemName?: string;
  initialData?: Partial<DispositionData>;
  status?: 'pending' | 'dispositioned' | 'approved';
  dispositionByName?: string;
  approvedByName?: string;
  onSetDisposition: (
    disposition: DispositionType,
    reason: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onApprove: (
    password: string,
    notes?: string
  ) => Promise<{ success: boolean; error?: string }>;
  canDisposition?: boolean;
  canApprove?: boolean;
  readOnly?: boolean;
}

const DISPOSITION_TYPES: { value: DispositionType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'accept',
    label: 'Accept',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    description: 'Material/product meets specifications and can be released',
  },
  {
    value: 'reject',
    label: 'Reject',
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    description: 'Material/product does not meet specifications and cannot be used',
  },
  {
    value: 'rework',
    label: 'Rework',
    icon: <RotateCcw className="h-4 w-4 text-orange-600" />,
    description: 'Material/product requires reprocessing to meet specifications',
  },
  {
    value: 'scrap',
    label: 'Scrap',
    icon: <Trash2 className="h-4 w-4 text-gray-600" />,
    description: 'Material/product must be destroyed',
  },
  {
    value: 'return_to_vendor',
    label: 'Return to Vendor',
    icon: <Truck className="h-4 w-4 text-blue-600" />,
    description: 'Material to be returned to vendor for replacement or credit',
  },
  {
    value: 'conditional_release',
    label: 'Conditional Release',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
    description: 'Release with specific conditions or restrictions attached',
  },
];

/**
 * Disposition Form Component
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T091)
 *
 * A comprehensive disposition form with:
 * - Disposition type selection with descriptions
 * - Reason field (mandatory for non-accept)
 * - Electronic signature for disposition decision
 * - Approval workflow with dual sign-off
 * - Visual status indicators
 * - Read-only mode for viewing completed dispositions
 */
export function DispositionForm({
  testId,
  testType,
  testResult,
  lotNumber,
  itemName,
  initialData,
  status = 'pending',
  dispositionByName,
  approvedByName,
  onSetDisposition,
  onApprove,
  canDisposition = true,
  canApprove = false,
  readOnly = false,
}: DispositionFormProps) {
  const [selectedDisposition, setSelectedDisposition] = useState<DispositionType | null>(
    initialData?.disposition || null
  );
  const [reason, setReason] = useState(initialData?.dispositionReason || '');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signAction, setSignAction] = useState<'disposition' | 'approve'>('disposition');
  const [isLoading, setIsLoading] = useState(false);

  const handleDispositionClick = useCallback(() => {
    if (!selectedDisposition) return;
    if (selectedDisposition !== 'accept' && !reason.trim()) {
      return; // Reason required for non-accept
    }
    setSignAction('disposition');
    setShowSignDialog(true);
  }, [selectedDisposition, reason]);

  const handleApproveClick = useCallback(() => {
    setSignAction('approve');
    setShowSignDialog(true);
  }, []);

  const handleSign = useCallback(
    async (password: string, meaning: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        if (signAction === 'disposition') {
          return await onSetDisposition(selectedDisposition!, reason, password);
        } else {
          return await onApprove(password, approvalNotes || undefined);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [signAction, selectedDisposition, reason, approvalNotes, onSetDisposition, onApprove]
  );

  const getSignatureMeaning = () => {
    if (signAction === 'disposition') {
      const dispType = DISPOSITION_TYPES.find(d => d.value === selectedDisposition);
      return `I have reviewed the QC test results and make the disposition decision: ${dispType?.label || selectedDisposition}${reason ? `. Reason: ${reason}` : ''}`;
    } else {
      return `I approve the disposition decision and authorize the corresponding lot status update${approvalNotes ? `. Notes: ${approvalNotes}` : ''}`;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
            <Clock className="h-4 w-4" />
            Pending Disposition
          </span>
        );
      case 'dispositioned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            <UserCheck className="h-4 w-4" />
            Awaiting Approval
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Approved
          </span>
        );
    }
  };

  const getDispositionBadge = (disposition: DispositionType) => {
    const dispType = DISPOSITION_TYPES.find(d => d.value === disposition);
    if (!dispType) return null;

    const colorClasses: Record<DispositionType, string> = {
      accept: 'bg-green-100 text-green-700',
      reject: 'bg-red-100 text-red-700',
      rework: 'bg-orange-100 text-orange-700',
      scrap: 'bg-gray-100 text-gray-700',
      return_to_vendor: 'bg-blue-100 text-blue-700',
      conditional_release: 'bg-yellow-100 text-yellow-700',
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${colorClasses[disposition]}`}>
        {dispType.icon}
        {dispType.label}
      </span>
    );
  };

  const showDispositionSelector = !readOnly && canDisposition && status === 'pending';
  const canSubmitDisposition = showDispositionSelector && selectedDisposition;
  const canSubmitApproval = !readOnly && canApprove && status === 'dispositioned';
  const requiresReason = selectedDisposition && selectedDisposition !== 'accept';
  const hasRequiredReason = !requiresReason || reason.trim().length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Disposition Decision</h3>
              <p className="text-sm text-gray-600">
                Test: <span className="font-medium">{testType}</span>
                {lotNumber && <span className="ml-2">• Lot: {lotNumber}</span>}
                {itemName && <span className="ml-2">• {itemName}</span>}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Test Result Display */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Test Result:</span>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-sm font-medium ${
            testResult === 'pass' || testResult === 'passed'
              ? 'bg-green-100 text-green-700'
              : testResult === 'fail' || testResult === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {testResult === 'pass' || testResult === 'passed' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : testResult === 'fail' || testResult === 'failed' ? (
              <XCircle className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {testResult?.toUpperCase() || 'PENDING'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Disposition Type Selector */}
        {showDispositionSelector && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Disposition <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DISPOSITION_TYPES.map((dispType) => (
                <button
                  key={dispType.value}
                  type="button"
                  onClick={() => setSelectedDisposition(dispType.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedDisposition === dispType.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {dispType.icon}
                    <span className="font-medium text-gray-900">{dispType.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{dispType.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Disposition Display */}
        {initialData?.disposition && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Disposition Decision</h4>
            <div className="flex items-center gap-3 mb-2">
              {getDispositionBadge(initialData.disposition)}
            </div>
            {initialData.dispositionReason && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Reason:</span> {initialData.dispositionReason}
              </p>
            )}
          </div>
        )}

        {/* Reason Input */}
        {showDispositionSelector && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disposition Reason {requiresReason && <span className="text-red-500">*</span>}
            </label>
            <TextArea
              value={reason}
              onValueChange={setReason}
              placeholder={
                requiresReason
                  ? 'Reason is required for non-accept dispositions...'
                  : 'Optional notes for accept disposition...'
              }
              height={80}
            />
            {requiresReason && !reason.trim() && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Reason is required for {DISPOSITION_TYPES.find(d => d.value === selectedDisposition)?.label} disposition
              </p>
            )}
          </div>
        )}

        {/* Approval Notes */}
        {canSubmitApproval && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Notes (Optional)
            </label>
            <TextArea
              value={approvalNotes}
              onValueChange={setApprovalNotes}
              placeholder="Add any notes for the approval..."
              height={60}
            />
          </div>
        )}

        {/* Signature Info */}
        {(dispositionByName || approvedByName) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Electronic Signatures</h4>
            <div className="space-y-2 text-sm">
              {dispositionByName && (
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-gray-600">Disposition by:</span>
                  <span className="font-medium text-gray-900">{dispositionByName}</span>
                  {initialData?.dispositionAt && (
                    <span className="text-gray-500 text-xs">
                      ({new Date(initialData.dispositionAt).toLocaleString()})
                    </span>
                  )}
                </div>
              )}
              {approvedByName && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">Approved by:</span>
                  <span className="font-medium text-gray-900">{approvedByName}</span>
                  {initialData?.dispositionApprovedAt && (
                    <span className="text-gray-500 text-xs">
                      ({new Date(initialData.dispositionApprovedAt).toLocaleString()})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {(showDispositionSelector || canSubmitApproval) && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {showDispositionSelector && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <ClipboardCheck className="h-4 w-4" />
                  Select a disposition and sign to record decision
                </span>
              )}
              {canSubmitApproval && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <Users className="h-4 w-4" />
                  Review and approve the disposition (dual sign-off)
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {showDispositionSelector && (
                <Button
                  text="Sign & Submit Disposition"
                  type="default"
                  stylingMode="contained"
                  icon="check"
                  onClick={handleDispositionClick}
                  disabled={isLoading || !selectedDisposition || !hasRequiredReason}
                />
              )}
              {canSubmitApproval && (
                <Button
                  text="Approve & Sign"
                  type="success"
                  stylingMode="contained"
                  icon="check"
                  onClick={handleApproveClick}
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
          signAction === 'disposition'
            ? `Disposition: ${DISPOSITION_TYPES.find(d => d.value === selectedDisposition)?.label || ''}`
            : 'Approve Disposition'
        }
        action={signAction === 'disposition' ? 'disposition_decision' : 'disposition_approval'}
        meaning={getSignatureMeaning()}
        onSign={handleSign}
        onCancel={() => setShowSignDialog(false)}
        isLoading={isLoading}
      />
    </div>
  );
}

export default DispositionForm;
