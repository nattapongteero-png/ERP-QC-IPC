/**
 * Purchase Requisition Form Component (T044)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { TextArea } from 'devextreme-react/text-area';
import { SelectBox } from 'devextreme-react/select-box';
import { DateBox } from 'devextreme-react/date-box';
import { Popup } from 'devextreme-react/popup';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { PRLineGrid } from './PRLineGrid';
import type { PRWithLines, PRLineInput, PRPriority } from '@/types/purchase-requisition';

interface PRFormProps {
  mode: 'create' | 'edit';
  prId?: number;
  initialData?: PRWithLines;
}

export function PRForm({ mode, prId, initialData }: PRFormProps) {
  const router = useRouter();
  const t = useTranslations('purchasing');
  // Priority options pull their labels from i18n so they switch with the
  // language toggle (was previously a hardcoded Thai array).
  const priorityOptions = [
    { value: 'low', label: t('requisitions.priority.low') },
    { value: 'normal', label: t('requisitions.priority.normal') },
    { value: 'high', label: t('requisitions.priority.high') },
    { value: 'urgent', label: t('requisitions.priority.urgent') },
  ];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirm dialog before submitting for approval (submit is irreversible —
  // it locks the PR out of draft editing).
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Form state
  const [priority, setPriority] = useState<PRPriority>(initialData?.priority || 'normal');
  const [requiredDate, setRequiredDate] = useState<Date | null>(
    initialData?.requiredDate ? new Date(initialData.requiredDate) : null
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [justification, setJustification] = useState(initialData?.justification || '');
  // Intended vendor + payment terms set at the PR stage (both optional). When
  // filled, PR→PO conversion pre-fills the PO so the buyer doesn't re-pick them.
  const [vendorId, setVendorId] = useState<number | null>(initialData?.vendorId ?? null);
  const [paymentTerms, setPaymentTerms] = useState<string>(initialData?.paymentTerms || '');
  const [vendors, setVendors] = useState<Array<{ id: number; name: string; paymentTerms?: string | null }>>([]);
  const [lines, setLines] = useState<PRLineInput[]>(
    initialData?.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId || undefined,
      itemCode: l.itemCode || undefined,
      description: l.description,
      quantity: l.quantity,
      unitOfMeasure: l.unitOfMeasure,
      estimatedUnitPrice: l.estimatedUnitPrice,
      suggestedVendorId: l.suggestedVendorId || undefined,
      notes: l.notes || undefined,
    })) || []
  );
  // Track original line IDs for detecting deletions in edit mode
  const [originalLineIds] = useState<number[]>(
    initialData?.lines.map((l) => l.id) || []
  );
  const [currentPrId, setCurrentPrId] = useState<number | null>(prId || null);
  const [prNumber, setPrNumber] = useState(initialData?.prNumber || '');

  // Calculate total
  const totalAmount = lines.reduce(
    (sum, line) => sum + (line.quantity || 0) * (line.estimatedUnitPrice || 0),
    0
  );

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      if (mode === 'create' && !currentPrId) {
        // Create PR first
        const createResponse = await fetch('/api/purchasing/requisitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // requesterId is omitted on purpose — the API derives it from the
          // logged-in user's linked HR employee. (Previously hard-coded to 1,
          // which attributed every PR to the same employee.)
          body: JSON.stringify({
            priority,
            requiredDate: requiredDate ? toLocalDateStr(requiredDate) : undefined,
            description,
            justification,
            vendorId: vendorId ?? undefined,
            paymentTerms: paymentTerms || undefined,
          }),
        });

        const createResult = await createResponse.json();
        if (!createResult.success) {
          throw new Error(createResult.error);
        }

        setCurrentPrId(createResult.id);

        // Add lines
        if (lines.length > 0) {
          const linesResponse = await fetch(`/api/purchasing/requisitions/${createResult.id}/lines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lines }),
          });

          const linesResult = await linesResponse.json();
          if (!linesResult.success) {
            throw new Error(linesResult.error);
          }
        }

        router.push(`/purchasing/requisitions/${createResult.id}`);
      } else if (currentPrId) {
        // Update PR header
        const updateResponse = await fetch(`/api/purchasing/requisitions/${currentPrId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priority,
            requiredDate: requiredDate ? toLocalDateStr(requiredDate) : null,
            description,
            justification,
            vendorId: vendorId,
            paymentTerms: paymentTerms || null,
          }),
        });

        const updateResult = await updateResponse.json();
        if (!updateResult.success) {
          throw new Error(updateResult.error);
        }

        // Update existing lines
        const existingLines = lines.filter((l) => l.id);
        for (const line of existingLines) {
          const lineResponse = await fetch(`/api/purchasing/requisitions/${currentPrId}/lines`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lineId: line.id,
              description: line.description,
              quantity: line.quantity,
              unitOfMeasure: line.unitOfMeasure,
              estimatedUnitPrice: line.estimatedUnitPrice,
              itemCode: line.itemCode,
              notes: line.notes,
            }),
          });

          const lineResult = await lineResponse.json();
          if (!lineResult.success) {
            throw new Error(lineResult.error);
          }
        }

        // Add new lines (no id)
        const newLines = lines.filter((l) => !l.id);
        if (newLines.length > 0) {
          const addResponse = await fetch(`/api/purchasing/requisitions/${currentPrId}/lines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lines: newLines }),
          });

          const addResult = await addResponse.json();
          if (!addResult.success) {
            throw new Error(addResult.error);
          }
        }

        // Delete removed lines
        const currentLineIds = lines.filter((l) => l.id).map((l) => l.id!);
        const deletedLineIds = originalLineIds.filter((id) => !currentLineIds.includes(id));
        for (const lineId of deletedLineIds) {
          const deleteResponse = await fetch(
            `/api/purchasing/requisitions/${currentPrId}/lines?lineId=${lineId}`,
            { method: 'DELETE' }
          );

          const deleteResult = await deleteResponse.json();
          if (!deleteResult.success) {
            throw new Error(deleteResult.error);
          }
        }

        // Reload to show updated data
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save PR');
    } finally {
      setSaving(false);
    }
  }, [mode, currentPrId, priority, requiredDate, description, justification, vendorId, paymentTerms, lines, originalLineIds, router]);

  // Load active vendors for the "intended vendor" dropdown.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/vendors?limit=200&isActive=true')
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        // API returns { success, data: { items, total, ... } }. Be defensive
        // about the exact shape so a paginated wrapper doesn't empty the list.
        const raw = res?.data?.items ?? res?.data?.vendors ?? res?.data ?? res?.vendors ?? [];
        const list = (Array.isArray(raw) ? raw : [])
          .map((v: any) => ({ id: v.id, name: v.name, paymentTerms: v.paymentTerms }));
        setVendors(list);
      })
      .catch(() => { /* dropdown just stays empty on failure */ });
    return () => { cancelled = true; };
  }, []);

  const handleSubmitForApproval = useCallback(async () => {
    if (!currentPrId) {
      setError('Please save the PR first');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/purchasing/requisitions/${currentPrId}/submit`, {
        method: 'POST',
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      router.push('/purchasing/requisitions');
    } catch (err: any) {
      setError(err.message || 'Failed to submit PR');
    } finally {
      setSubmitting(false);
    }
  }, [currentPrId, router]);

  const handleLinesChange = useCallback((newLines: PRLineInput[]) => {
    setLines(newLines);
  }, []);

  const isEditable = !initialData || initialData.status === 'draft';

  // Submit is only meaningful once the PR is saved as a draft (it needs a PR id
  // + at least one line). Hide it until then so the operator saves the draft
  // first, matching the documented flow.
  const isSavedDraft = currentPrId != null;
  const canSubmit = isSavedDraft && lines.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'edit' ? t('requisitions.form.editTitle') : t('requisitions.form.createTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {mode === 'edit' ? t('requisitions.form.editSubtitle') : t('requisitions.form.createSubtitle')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" data-testid="error-message">
          {error}
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {prNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('requisitions.form.prNumber')}</label>
              <TextBox value={prNumber} readOnly={true} data-testid="pr-number" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('requisitions.form.priority')}</label>
            <SelectBox
              dataSource={priorityOptions}
              value={priority}
              onValueChanged={(e) => setPriority(e.value)}
              displayExpr="label"
              valueExpr="value"
              disabled={!isEditable}
              data-testid="priority-select"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('requisitions.form.requiredDate')}</label>
            <DateBox
              value={requiredDate}
              onValueChanged={(e) => setRequiredDate(e.value)}
              type="date"
              disabled={!isEditable}
              data-testid="required-date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('requisitions.form.totalAmount')}</label>
            <TextBox
              value={totalAmount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
              readOnly={true}
              data-testid="total-amount"
            />
          </div>

          {/* Intended vendor + payment terms (optional). When set, PR→PO
              conversion pre-fills the PO so the buyer doesn't re-pick them. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บริษัทผู้ขาย (ถ้าระบุ)</label>
            <SelectBox
              dataSource={vendors}
              value={vendorId}
              onValueChanged={(e) => {
                const v = e.value as number | null;
                setVendorId(v);
                // Auto-fill payment terms from the chosen vendor's default if the
                // field is still empty, as a convenience (user can override).
                if (v && !paymentTerms) {
                  const picked = vendors.find((x) => x.id === v);
                  if (picked?.paymentTerms) setPaymentTerms(picked.paymentTerms);
                }
              }}
              displayExpr="name"
              valueExpr="id"
              searchEnabled={true}
              showClearButton={true}
              placeholder="เลือกผู้ขาย (ไม่บังคับ)"
              disabled={!isEditable}
              data-testid="pr-vendor-select"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เงื่อนไขการชำระเงิน (ถ้าระบุ)</label>
            <TextBox
              value={paymentTerms}
              onValueChanged={(e) => setPaymentTerms(e.value)}
              placeholder="เช่น Net 30, เงินสด"
              disabled={!isEditable}
              data-testid="pr-payment-terms"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('requisitions.form.description')}</label>
          <TextArea
            value={description}
            onValueChanged={(e) => setDescription(e.value)}
            height={60}
            disabled={!isEditable}
            data-testid="description"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('requisitions.form.justification')}</label>
          <TextArea
            value={justification}
            onValueChanged={(e) => setJustification(e.value)}
            height={80}
            disabled={!isEditable}
            data-testid="justification"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-4">{t('requisitions.form.lineItems')}</h3>
        <PRLineGrid
          lines={lines}
          onChange={handleLinesChange}
          prId={currentPrId || undefined}
          editable={isEditable}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button
          text={t('requisitions.buttons.cancel')}
          type="normal"
          onClick={() => router.push('/purchasing/requisitions')}
          data-testid="cancel-btn"
        />

        {isEditable && (
          <>
            <Button
              text={saving ? t('requisitions.buttons.saving') : t('requisitions.buttons.saveDraft')}
              type="default"
              stylingMode="outlined"
              onClick={handleSave}
              disabled={saving || submitting}
              data-testid="save-btn"
            />

            {/* Submit appears only after the draft is saved (note: hide Submit
                before Save Draft). Clicking it asks for confirmation first. */}
            {canSubmit && (
              <Button
                text={submitting ? t('requisitions.buttons.submitting') : t('requisitions.buttons.submit')}
                type="success"
                stylingMode="contained"
                onClick={() => setConfirmSubmit(true)}
                disabled={saving || submitting}
                data-testid="submit-btn"
              />
            )}
          </>
        )}
      </div>

      {/* Confirm-before-submit dialog */}
      <Popup
        visible={confirmSubmit}
        onHiding={() => setConfirmSubmit(false)}
        dragEnabled={false}
        hideOnOutsideClick
        showTitle
        title={t('requisitions.modals.submitTitle')}
        width={420}
        height="auto"
        data-testid="pr-submit-confirm"
      >
        <div className="p-2 space-y-4">
          <p className="text-sm text-gray-700">
            {prNumber ? <b>{prNumber}</b> : null} {t('requisitions.modals.submitMessage')}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              text={t('requisitions.buttons.cancel')}
              stylingMode="text"
              onClick={() => setConfirmSubmit(false)}
              disabled={submitting}
            />
            <Button
              text={submitting ? t('requisitions.buttons.submitting') : t('requisitions.buttons.submit')}
              type="success"
              stylingMode="contained"
              onClick={() => {
                setConfirmSubmit(false);
                void handleSubmitForApproval();
              }}
              disabled={submitting}
              data-testid="pr-submit-confirm-btn"
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
