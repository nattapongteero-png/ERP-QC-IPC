'use client';

/**
 * Recall Reconciliation Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Form for recording recall reconciliation by lot.
 */

import { useState } from 'react';
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

  // Calculate totals
  const totals = reconciliation.reduce(
    (acc, r) => ({
      distributed: acc.distributed + r.distributedQty,
      returned: acc.returned + r.returnedQty,
      destroyed: acc.destroyed + r.destroyedQty,
      accounted: acc.accounted + r.accountedQty,
      unaccounted: acc.unaccounted + r.unaccountedQty,
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
    const totalReconciled = record.returnedQty + record.destroyedQty + record.accountedQty;
    const percentage = record.distributedQty > 0
      ? (totalReconciled / record.distributedQty) * 100
      : 0;

    if (percentage >= 100) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Complete</span>
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
        text="Update"
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
            <h3 className="font-semibold">Recall Effectiveness</h3>
            <p className="text-sm text-muted-foreground">
              {totals.returned + totals.destroyed + totals.accounted} of {totals.distributed} units
              reconciled
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
            <div className="text-xs text-muted-foreground">Returned</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totals.destroyed}</div>
            <div className="text-xs text-muted-foreground">Destroyed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{totals.accounted}</div>
            <div className="text-xs text-muted-foreground">Accounted</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">{totals.unaccounted}</div>
            <div className="text-xs text-muted-foreground">Unaccounted</div>
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

        <DxColumn dataField="lotNumber" caption="Lot #" width={120} />
        <DxColumn
          dataField="distributedQty"
          caption="Distributed"
          width={100}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="returnedQty"
          caption="Returned"
          width={90}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="destroyedQty"
          caption="Destroyed"
          width={90}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="accountedQty"
          caption="Accounted"
          width={90}
          dataType="number"
          format="#,##0"
        />
        <DxColumn
          dataField="unaccountedQty"
          caption="Unaccounted"
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
          caption="Status"
          width={100}
          cellRender={renderStatusCell}
          allowFiltering={false}
          allowSorting={false}
        />
        <DxColumn dataField="verifiedByName" caption="Verified By" width={120} />
        {canEdit && (
          <DxColumn
            caption="Actions"
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
        title={`Reconcile Lot: ${editingLot?.lotNumber || ''}`}
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {editingLot && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Distributed:</div>
                <div className="font-semibold">{editingLot.distributedQty}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity Returned</label>
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
            <label className="text-sm font-medium">Quantity Destroyed</label>
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
            <label className="text-sm font-medium">Quantity Accounted For (other)</label>
            <DxNumberBox
              value={formData.accountedQty || 0}
              onValueChanged={(e) =>
                setFormData({ ...formData, accountedQty: e.value || 0 })
              }
              min={0}
              format="#,##0"
            />
            <p className="text-xs text-muted-foreground">
              E.g., product consumed, expired, or otherwise disposed
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <DxTextArea
              value={formData.reconciliationNotes || ''}
              onValueChange={(value) =>
                setFormData({ ...formData, reconciliationNotes: value || '' })
              }
              placeholder="Add reconciliation notes..."
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
              text="Cancel"
              onClick={() => setEditingLot(null)}
              stylingMode="outlined"
            />
            <DxButton
              text="Save"
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
