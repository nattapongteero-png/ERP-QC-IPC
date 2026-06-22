/**
 * Purchase Requisition Form Component (T044)
 * Part of 011-accounting-spec-gap
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function PRForm({ mode, prId, initialData }: PRFormProps) {
  const router = useRouter();
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
          body: JSON.stringify({
            requesterId: 1, // TODO: Get from session
            priority,
            requiredDate: requiredDate ? toLocalDateStr(requiredDate) : undefined,
            description,
            justification,
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
  }, [mode, currentPrId, priority, requiredDate, description, justification, lines, originalLineIds, router]);

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
          {mode === 'edit' ? 'แก้ไขใบขอซื้อ (PR)' : 'สร้างใบขอซื้อ (PR)'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {mode === 'edit'
            ? 'แก้ไขรายละเอียดใบขอซื้อแล้วบันทึกร่าง หรือส่งขออนุมัติ'
            : 'กรอกรายละเอียด เพิ่มรายการสินค้า แล้วบันทึกร่างก่อนส่งขออนุมัติ'}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">PR Number</label>
              <TextBox value={prNumber} readOnly={true} data-testid="pr-number" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Date</label>
            <DateBox
              value={requiredDate}
              onValueChanged={(e) => setRequiredDate(e.value)}
              type="date"
              disabled={!isEditable}
              data-testid="required-date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
            <TextBox
              value={totalAmount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
              readOnly={true}
              data-testid="total-amount"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <TextArea
            value={description}
            onValueChanged={(e) => setDescription(e.value)}
            height={60}
            disabled={!isEditable}
            data-testid="description"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Justification</label>
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
        <h3 className="text-lg font-medium text-gray-800 mb-4">Line Items</h3>
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
          text="Cancel"
          type="normal"
          onClick={() => router.push('/purchasing/requisitions')}
          data-testid="cancel-btn"
        />

        {isEditable && (
          <>
            <Button
              text={saving ? 'กำลังบันทึก...' : 'บันทึกร่าง (Save Draft)'}
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
                text={submitting ? 'กำลังส่ง...' : 'ส่งขออนุมัติ (Submit)'}
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
        title="ยืนยันการส่งขออนุมัติ"
        width={420}
        height="auto"
        data-testid="pr-submit-confirm"
      >
        <div className="p-2 space-y-4">
          <p className="text-sm text-gray-700">
            ยืนยันส่งใบขอซื้อ {prNumber ? <b>{prNumber}</b> : 'นี้'} เข้าสู่ขั้นตอนอนุมัติ?
            หลังส่งแล้วจะไม่สามารถแก้ไขร่างได้จนกว่าจะมีผลการอนุมัติ
          </p>
          <div className="flex justify-end gap-2">
            <Button
              text="ยกเลิก"
              stylingMode="text"
              onClick={() => setConfirmSubmit(false)}
              disabled={submitting}
            />
            <Button
              text={submitting ? 'กำลังส่ง...' : 'ยืนยันส่งขออนุมัติ'}
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
