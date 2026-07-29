'use client';

/**
 * Recall Reconciliation Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Form for recording recall reconciliation by lot.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxDataGrid, DxColumn, DxPaging, DxSummary, DxTotalItem } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { RecallReconciliation, RecallReconciliationCreate } from '@/types/recalls';

interface RecallReconciliationFormProps {
  recallId: number;
  affectedLots: number[];
  canEdit?: boolean;
}

async function fetchReconciliation(recallId: number): Promise<RecallReconciliation[]> {
  const response = await fetch(`/api/recalls/${recallId}/reconciliation`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function recordReconciliation(
  recallId: number,
  data: RecallReconciliationCreate
): Promise<RecallReconciliation> {
  const response = await fetch(`/api/recalls/${recallId}/reconciliation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export function RecallReconciliationForm({
  recallId,
  affectedLots: _affectedLots,
  canEdit = true,
}: RecallReconciliationFormProps) {
  const t = useTranslations('gmp');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const [editingLot, setEditingLot] = useState<RecallReconciliation | null>(null);
  const [formData, setFormData] = useState<RecallReconciliationCreate>({
    lotId: 0,
    returnedQty: 0,
    destroyedQty: 0,
    accountedQty: 0,
    reconciliationNotes: '',
  });

  const { data: reconciliation = [], isLoading } = useQuery({
    queryKey: ['recall-reconciliation', recallId],
    queryFn: () => fetchReconciliation(recallId),
  });

  const recordMutation = useMutation({
    mutationFn: (data: RecallReconciliationCreate) => recordReconciliation(recallId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recall-reconciliation', recallId] });
      queryClient.invalidateQueries({ queryKey: ['recall', recallId] });
      setEditingLot(null);
      setFormData({
        lotId: 0,
        returnedQty: 0,
        destroyedQty: 0,
        accountedQty: 0,
        reconciliationNotes: '',
      });
    },
  });

  // Calculate totals. MySQL returns decimal columns as strings, so coerce each
  // value with Number() — otherwise the additions string-concatenate.
  const totals = reconciliation.reduce(
    (acc, r) => ({
      distributed: acc.distributed + Number(r.distributedQty || 0),
      returned: acc.returned + Number(r.returnedQty || 0),
      destroyed: acc.destroyed + Number(r.destroyedQty || 0),
      accounted: acc.accounted + Number(r.accountedQty || 0),
      unaccounted: acc.unaccounted + Number(r.unaccountedQty || 0),
    }),
    { distributed: 0, returned: 0, destroyed: 0, accounted: 0, unaccounted: 0 }
  );

  const effectivenessRate =
    totals.distributed > 0
      ? ((totals.returned + totals.destroyed + totals.accounted) / totals.distributed) * 100
      : 0;

  const handleEdit = (record: RecallReconciliation) => {
    setEditingLot(record);
    setFormData({
      lotId: record.lotId,
      returnedQty: record.returnedQty,
      destroyedQty: record.destroyedQty,
      accountedQty: record.accountedQty,
      reconciliationNotes: record.reconciliationNotes || '',
    });
  };

  const handleSave = () => {
    if (!formData.lotId) return;
    recordMutation.mutate(formData);
  };

  const renderStatusCell = (cellData: { data: RecallReconciliation }) => {
    const record = cellData.data;
    const distributedQty = Number(record.distributedQty || 0);
    const totalReconciled =
      Number(record.returnedQty || 0) +
      Number(record.destroyedQty || 0) +
      Number(record.accountedQty || 0);
    const percentage = distributedQty > 0
      ? (totalReconciled / distributedQty) * 100
      : 0;

    if (percentage >= 100) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>{t(`recallReconciliation.completed`)}</span>
        </div>
      );
    } else if (percentage >= 80) {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <span>{percentage.toFixed(0)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <XCircle className="h-4 w-4" />
          <span>{percentage.toFixed(0)}%</span>
        </div>
      );
    }
  };

  const renderActionsCell = (cellData: { data: RecallReconciliation }) => {
    if (!canEdit) return null;
    return (
      <DxButton
        text={t(`recallReconciliation.adjust`)}
        stylingMode="text"
        onClick={() => handleEdit(cellData.data)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Effectiveness Summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{t(`recallReconciliation.effectiveness`)}</h3>
            <p className="text-sm text-muted-foreground">
              {t('recallReconciliation.summary', {
                done: totals.returned + totals.destroyed + totals.accounted,
                total: totals.distributed,
              })}
            </p>
          </div>
          <div
            className={`text-3xl font-bold ${
              effectivenessRate >= 90
                ? 'text-green-600'
                : effectivenessRate >= 70
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {effectivenessRate.toFixed(1)}%
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-lg font-semibold">{totals.returned}</div>
            <div className="text-xs text-muted-foreground">{t(`recallReconciliation.returned`)}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totals.destroyed}</div>
            <div className="text-xs text-muted-foreground">{t(`recallReconciliation.destroyed`)}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totals.accounted}</div>
            <div className="text-xs text-muted-foreground">{t(`recallReconciliation.accounted`)}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">{totals.unaccounted}</div>
            <div className="text-xs text-muted-foreground">{t(`recallReconciliation.unaccounted`)}</div>
          </div>
        </div>
      </div>

      {/* Reconciliation Table */}
      <DxDataGrid
        dataSource={reconciliation}
        showBorders
        rowAlternationEnabled
        loading={isLoading}
      >
        <DxPaging defaultPageSize={10} />

        <DxColumn dataField="lotNumber" caption={t(`recallReconciliation.lotNumber`)} width={120} />
        <DxColumn
          dataField="distributedQty"
          caption={t(`recallReconciliation.distributed`)}
          width={100}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="returnedQty"
          caption={t(`recallReconciliation.returned`)}
          width={90}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="destroyedQty"
          caption={t(`recallReconciliation.destroyed`)}
          width={90}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="accountedQty"
          caption={t(`recallReconciliation.accounted`)}
          width={90}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="unaccountedQty"
          caption={t(`recallReconciliation.unaccounted`)}
          width={100}
          dataType="number"
          format="#,##0"
          cellRender={(cellData: { value: number }) => (
            <span className={cellData.value > 0 ? 'text-red-600 font-medium' : ''}>
              {cellData.value}
            </span>
          )}
        />
        <DxColumn
          caption={t(`recallReconciliation.status`)}
          width={100}
          cellRender={renderStatusCell}
          allowFiltering={false}
          allowSorting={false}
        />
        <DxColumn dataField="verifiedByName" caption={t(`recallReconciliation.verifiedBy`)} width={120} />
        {canEdit && (
          <DxColumn
            caption={t(`recallReconciliation.actions`)}
            width={80}
            cellRender={renderActionsCell}
            allowFiltering={false}
            allowSorting={false}
          />
        )}

        <DxSummary>
          <DxTotalItem column="distributedQty" summaryType="sum" valueFormat="#,##0" />
          <DxTotalItem column="returnedQty" summaryType="sum" valueFormat="#,##0" />
          <DxTotalItem column="destroyedQty" summaryType="sum" valueFormat="#,##0" />
          <DxTotalItem column="accountedQty" summaryType="sum" valueFormat="#,##0" />
          <DxTotalItem column="unaccountedQty" summaryType="sum" valueFormat="#,##0" />
        </DxSummary>
      </DxDataGrid>

      {/* Edit Dialog */}
      <DxPopup
        visible={!!editingLot}
        onHiding={() => setEditingLot(null)}
        title={`${t(`recallReconciliation.dialogTitle`)}: ${editingLot?.lotNumber || ''}`}
        width={450}
        height="auto"
        showCloseButton
        // The body is gated by editingLot, the same state that opens this popup,
        // and DevExtreme caches the first (empty) deferred render — the
        // blank-popup bug T1064246 that hit /vmi/sync.
        deferRendering={false}
      >
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {editingLot && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>{t(`recallReconciliation.distributedLabel`)}</div>
                <div className="font-semibold">{editingLot.distributedQty}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{t(`recallReconciliation.returnedQty`)}</label>
            <DxNumberBox
              value={formData.returnedQty || 0}
              onValueChanged={(e) =>
                setFormData({ ...formData, returnedQty: e.value || 0 })
              }
              min={0}
              format="#,##0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t(`recallReconciliation.destroyedQty`)}</label>
            <DxNumberBox
              value={formData.destroyedQty || 0}
              onValueChanged={(e) =>
                setFormData({ ...formData, destroyedQty: e.value || 0 })
              }
              min={0}
              format="#,##0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t(`recallReconciliation.accountedQty`)}</label>
            <DxNumberBox
              value={formData.accountedQty || 0}
              onValueChanged={(e) =>
                setFormData({ ...formData, accountedQty: e.value || 0 })
              }
              min={0}
              format="#,##0"
            />
            <p className="text-xs text-muted-foreground">
              {t('recallReconciliation.accountedHint')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t(`recallReconciliation.notes`)}</label>
            <DxTextArea
              value={formData.reconciliationNotes || ''}
              onValueChange={(value) =>
                setFormData({ ...formData, reconciliationNotes: value || '' })
              }
              placeholder={t(`recallReconciliation.notesPlaceholder`)}
              height={80}
            />
          </div>

          {recordMutation.error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {recordMutation.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <DxButton
              text={tc(`actions.cancel`)}
              onClick={() => setEditingLot(null)}
              stylingMode="outlined"
            />
            <DxButton
              text={tc(`actions.save`)}
              onClick={handleSave}
              type="default"
              disabled={recordMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
