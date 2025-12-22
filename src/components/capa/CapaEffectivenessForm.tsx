'use client';

/**
 * CAPA Effectiveness Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Form for recording and displaying CAPA effectiveness checks.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import type { CapaEffectiveness, CapaEffectivenessCreate, CapaEffectivenessResult } from '@/types/capa';

// ============================================
// Types
// ============================================

interface CapaEffectivenessFormProps {
  capaId: number;
  effectivenessChecks: CapaEffectiveness[];
  canEdit?: boolean;
  onCheckRecorded?: () => void;
}

// ============================================
// API Functions
// ============================================

async function recordEffectiveness(
  capaId: number,
  data: CapaEffectivenessCreate
): Promise<CapaEffectiveness> {
  const response = await fetch(`/api/capa/${capaId}/effectiveness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ============================================
// Component
// ============================================

export function CapaEffectivenessForm({
  capaId,
  effectivenessChecks,
  canEdit = true,
  onCheckRecorded,
}: CapaEffectivenessFormProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [formData, setFormData] = useState<{
    checkDate: string;
    criteria: string;
    result: CapaEffectivenessResult;
    evidence: string;
    followUpRequired: boolean;
    notes: string;
  }>({
    checkDate: new Date().toISOString().split('T')[0],
    criteria: '',
    result: 'effective',
    evidence: '',
    followUpRequired: false,
    notes: '',
  });

  // Record effectiveness mutation
  const recordMutation = useMutation({
    mutationFn: () =>
      recordEffectiveness(capaId, {
        checkDate: formData.checkDate,
        criteria: formData.criteria,
        result: formData.result,
        evidence: formData.evidence || undefined,
        followUpRequired: formData.followUpRequired,
        notes: formData.notes || undefined,
      }),
    onSuccess: () => {
      setShowAddDialog(false);
      setFormData({
        checkDate: new Date().toISOString().split('T')[0],
        criteria: '',
        result: 'effective',
        evidence: '',
        followUpRequired: false,
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['capa', capaId] });
      onCheckRecorded?.();
    },
  });

  // Get result icon
  const getResultIcon = (result: CapaEffectivenessResult) => {
    switch (result) {
      case 'effective':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'not_effective':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  // Get result badge
  const getResultBadge = (result: CapaEffectivenessResult) => {
    const resultColors: Record<CapaEffectivenessResult, string> = {
      effective: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      not_effective: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };

    const resultLabels: Record<CapaEffectivenessResult, string> = {
      effective: 'EFFECTIVE',
      not_effective: 'NOT EFFECTIVE',
      partial: 'PARTIAL',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${resultColors[result]}`}>
        {resultLabels[result]}
      </span>
    );
  };

  // Result options
  const resultOptions = [
    { value: 'effective', label: 'Effective' },
    { value: 'partial', label: 'Partial' },
    { value: 'not_effective', label: 'Not Effective' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Effectiveness Verification ({effectivenessChecks.length})
        </h3>
        {canEdit && (
          <DxButton
            text="Record Check"
            icon="add"
            onClick={() => setShowAddDialog(true)}
            stylingMode="outlined"
          />
        )}
      </div>

      {effectivenessChecks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No effectiveness checks recorded yet</p>
          {canEdit && (
            <p className="text-sm mt-2">
              Record an effectiveness check once actions are verified
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {effectivenessChecks.map((check) => (
            <div
              key={check.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {getResultIcon(check.result)}

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="font-medium text-sm">
                      Check #{check.checkNumber}
                    </span>
                    {getResultBadge(check.result)}
                  </div>

                  <p className="text-sm">
                    <span className="font-medium">Criteria: </span>
                    {check.criteria}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {check.verifierName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {check.verifierName}
                      </span>
                    )}
                    {check.checkDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {check.checkDate}
                      </span>
                    )}
                    {check.followUpRequired && (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="h-3 w-3" />
                        Follow-up required
                      </span>
                    )}
                  </div>

                  {check.evidence && (
                    <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                      <span className="flex items-center gap-1 font-medium mb-1">
                        <FileText className="h-3 w-3" />
                        Evidence:
                      </span>
                      {check.evidence}
                    </div>
                  )}

                  {check.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Notes: </span>
                      {check.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Effectiveness Check Dialog */}
      <DxPopup
        visible={showAddDialog}
        onHiding={() => setShowAddDialog(false)}
        title="Record Effectiveness Check"
        width={550}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Check Date</label>
            <DxDateBox
              value={formData.checkDate || undefined}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  checkDate: value ? new Date(value).toISOString().split('T')[0] : '',
                }))
              }
              type="date"
              displayFormat="yyyy-MM-dd"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Effectiveness Criteria <span className="text-destructive">*</span>
            </label>
            <DxTextArea
              value={formData.criteria}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, criteria: value || '' }))}
              placeholder="What criteria were used to evaluate effectiveness? (e.g., No recurrence in 30 days)"
              height={80}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Result <span className="text-destructive">*</span>
            </label>
            <DxSelectBox
              items={resultOptions}
              value={formData.result}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => setFormData((prev) => ({ ...prev, result: value as CapaEffectivenessResult }))}
            />
            {formData.result === 'effective' && (
              <p className="text-xs text-green-600">
                CAPA actions successfully addressed the root cause
              </p>
            )}
            {formData.result === 'not_effective' && (
              <p className="text-xs text-red-600">
                Issue has recurred or root cause not adequately addressed
              </p>
            )}
            {formData.result === 'partial' && (
              <p className="text-xs text-yellow-600">
                Some improvement observed but additional actions may be needed
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Evidence</label>
            <DxTextArea
              value={formData.evidence}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, evidence: value || '' }))}
              placeholder="Reference to supporting documentation, QC records, etc."
              height={80}
            />
          </div>

          <div className="flex items-center gap-2">
            <DxCheckBox
              value={formData.followUpRequired}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, followUpRequired: value || false }))}
            />
            <label className="text-sm">Follow-up check required</label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <DxTextArea
              value={formData.notes}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, notes: value || '' }))}
              placeholder="Additional observations or recommendations..."
              height={80}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text="Cancel"
              onClick={() => setShowAddDialog(false)}
              stylingMode="outlined"
            />
            <DxButton
              text="Record Check"
              icon="check"
              onClick={() => recordMutation.mutate()}
              type="success"
              disabled={!formData.criteria || recordMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
