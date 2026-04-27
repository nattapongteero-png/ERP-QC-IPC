'use client';

/**
 * Work Order Packaging QC Page
 * Weight control and integrity checks during packaging
 * Form Sections: 10.1, 10.3
 */

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { SwitchTypes } from 'devextreme-react/switch';
import {
  Scale,
  Package,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

interface WeightLog {
  id: number;
  workOrderId: number;
  checkTime: string;
  sampleWeights: number[];
  failedCount: number;
  isPass: boolean;
  operatorId: number;
  operatorName?: string;
  notes?: string;
  createdAt: string;
}

interface IntegrityLog {
  id: number;
  workOrderId: number;
  checkTime: string;
  tubeCapComplete: boolean;
  lotNumberCorrect: boolean;
  packingCorrect: boolean;
  operatorId: number;
  operatorName?: string;
  inspectorId: number;
  inspectorName?: string;
  notes?: string;
  createdAt: string;
}

interface QCCriteria {
  id: number;
  code: string;
  name: string;
  weightMin: number;
  weightMax: number;
  sampleSize: number;
  maxFailures: number;
  checkIntervalMinutes: number;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
}

const tabItems: DxTabItem[] = [
  { id: 0, text: 'Weight Control', icon: 'scales' },
  { id: 1, text: 'Integrity Checks', icon: 'check' },
];

export default function PackagingQCPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('execution.packagingQC');
  const workOrderId = Number(params.id);

  const initialTab = searchParams.get('tab') === 'integrity' ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showIntegrityDialog, setShowIntegrityDialog] = useState(false);
  const [sampleWeights, setSampleWeights] = useState<number[]>([]);
  const [editingWeightLog, setEditingWeightLog] = useState<WeightLog | null>(null);
  const [weightNotes, setWeightNotes] = useState('');
  const [deletingWeightLogId, setDeletingWeightLogId] = useState<number | null>(null);
  const [integrityForm, setIntegrityForm] = useState({
    tubeCapComplete: true,
    lotNumberCorrect: true,
    packingCorrect: true,
    notes: '',
  });

  // Fetch Work Order basic info
  const { data: workOrder, isLoading: woLoading } = useQuery<WorkOrderBasic>({
    queryKey: ['work-order', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/detail`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data?.workOrder;
    },
  });

  // Fetch QC Criteria from BOM
  const { data: criteria } = useQuery<QCCriteria | null>({
    queryKey: ['wo-packaging-qc-criteria', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-qc-criteria`);
      const data = await res.json();
      if (!data.success) return null;
      return data.data;
    },
  });

  // Fetch weight logs
  const { data: weightLogs, isLoading: weightLoading } = useQuery<WeightLog[]>({
    queryKey: ['wo-packaging-weight', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Fetch integrity logs
  const { data: integrityLogs, isLoading: integrityLoading } = useQuery<IntegrityLog[]>({
    queryKey: ['wo-packaging-integrity', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-integrity`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Add weight log mutation
  const addWeightMutation = useMutation({
    mutationFn: async (data: { sampleWeights: number[]; notes?: string }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkTime: new Date().toTimeString().slice(0, 5),
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
      toast.success('Weight Check Recorded', 'Weight sample has been recorded.');
      setShowWeightDialog(false);
      setSampleWeights([]);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Edit weight log mutation
  const editWeightMutation = useMutation({
    mutationFn: async (data: { logId: number; sampleWeights: number[]; notes?: string }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
      toast.success('Weight Check Updated', 'Weight sample has been updated.');
      setShowWeightDialog(false);
      setSampleWeights([]);
      setEditingWeightLog(null);
      setWeightNotes('');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Delete weight log mutation
  const deleteWeightMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-weight`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-weight', workOrderId] });
      toast.success('Weight Check Deleted', 'Weight record has been removed.');
      setDeletingWeightLogId(null);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
      setDeletingWeightLogId(null);
    },
  });

  // Add integrity log mutation
  const addIntegrityMutation = useMutation({
    mutationFn: async (data: typeof integrityForm) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/packaging-integrity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkTime: new Date().toTimeString().slice(0, 5),
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-packaging-integrity', workOrderId] });
      toast.success('Integrity Check Recorded', 'Integrity check has been recorded.');
      setShowIntegrityDialog(false);
      setIntegrityForm({
        tubeCapComplete: true,
        lotNumberCorrect: true,
        packingCorrect: true,
        notes: '',
      });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenWeightDialog = () => {
    setEditingWeightLog(null);
    setWeightNotes('');
    if (criteria) {
      setSampleWeights(new Array(criteria.sampleSize).fill(0));
    }
    setShowWeightDialog(true);
  };

  const handleEditWeightLog = (log: WeightLog) => {
    let weights: number[] = [];
    try {
      weights = typeof log.sampleWeights === 'string' ? JSON.parse(log.sampleWeights as unknown as string) : log.sampleWeights || [];
    } catch { /* ignore */ }
    setEditingWeightLog(log);
    setSampleWeights(weights);
    setWeightNotes(log.notes || '');
    setShowWeightDialog(true);
  };

  const handleSaveWeight = () => {
    if (editingWeightLog) {
      editWeightMutation.mutate({ logId: editingWeightLog.id, sampleWeights, notes: weightNotes || undefined });
    } else {
      addWeightMutation.mutate({ sampleWeights, notes: weightNotes || undefined });
    }
  };

  const updateSampleWeight = (index: number, value: number) => {
    const newWeights = [...sampleWeights];
    newWeights[index] = value;
    setSampleWeights(newWeights);
  };

  const calculateWeightResult = () => {
    if (!criteria || sampleWeights.length === 0) return { failedCount: 0, isPass: true };
    const failedCount = sampleWeights.filter(w => w < criteria.weightMin || w > criteria.weightMax).length;
    const isPass = failedCount <= criteria.maxFailures;
    return { failedCount, isPass };
  };

  const weightResult = calculateWeightResult();

  if (woLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Work Order not found</p>
        <DxButton
          text="Back to Work Orders"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/work-orders')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Packaging QC"
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={Package}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}/execution` },
          { label: 'Packaging QC' },
        ]}
        actions={
          <DxButton
            text="Back to Execution"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}/execution`)}
          />
        }
      />

      {/* BOM Packaging QC Criteria */}
      <BOMConfigReferencePanel
        workOrderId={workOrderId}
        showOnly={['packagingQC']}
        defaultExpanded={true}
      />

      {/* Tabs */}
      <Card>
        <CardContent className="p-0">
          <DxTabs
            items={tabItems}
            selectedIndex={activeTab}
            onSelectedIndexChange={(idx) => setActiveTab(idx)}
          />

          <div className="p-4">
            {/* Weight Control Tab */}
            {activeTab === 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Scale className="h-5 w-5 text-indigo-600" />
                    Weight Control Logs
                  </h3>
                  <DxButton
                    text="Add Weight Check"
                    icon="plus"
                    type="success"
                    onClick={handleOpenWeightDialog}
                    disabled={!criteria}
                  />
                </div>

                <DxDataGrid
                  dataSource={weightLogs || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={weightLoading}
                  height={400}
                  noDataText="No weight checks recorded. Click 'Add Weight Check' to start."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="checkTime" caption="Time" width={100} />
                  <DxColumn dataField="sampleWeights" caption="Samples (g)" cellRender={(cell) => {
                    let weights: number[] = [];
                    try {
                      weights = typeof cell.value === 'string' ? JSON.parse(cell.value) : cell.value || [];
                    } catch { /* invalid JSON */ }
                    return (
                      <span className="text-sm">
                        {weights.join(', ')}
                      </span>
                    );
                  }} />
                  <DxColumn dataField="failedCount" caption="Failed" width={80} cellRender={(cell) => (
                    <span className={cell.value > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {cell.value}
                    </span>
                  )} />
                  <DxColumn dataField="isPass" caption="Result" width={100} cellRender={(cell) => (
                    cell.value ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        Fail
                      </span>
                    )
                  )} />
                  <DxColumn dataField="operatorName" caption="Operator" width={150} />
                  <DxColumn dataField="notes" caption="Notes" />
                  {workOrder.status !== 'completed' && (
                    <DxColumn caption="Actions" width={120} cellRender={(cell) => (
                      <div className="flex items-center gap-1">
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          onClick={() => handleEditWeightLog(cell.data)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          onClick={() => setDeletingWeightLogId(cell.data.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )} />
                  )}
                </DxDataGrid>
              </div>
            )}

            {/* Integrity Checks Tab */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-600" />
                    Integrity Check Logs
                  </h3>
                  <DxButton
                    text="Add Integrity Check"
                    icon="plus"
                    type="success"
                    onClick={() => setShowIntegrityDialog(true)}
                  />
                </div>

                <DxDataGrid
                  dataSource={integrityLogs || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={integrityLoading}
                  height={400}
                  noDataText="No integrity checks recorded. Click 'Add Integrity Check' to start."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="checkTime" caption="Time" width={100} />
                  <DxColumn dataField="tubeCapComplete" caption="Tube/Cap" width={100} cellRender={(cell) => (
                    cell.value ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )
                  )} />
                  <DxColumn dataField="lotNumberCorrect" caption="Lot Number" width={100} cellRender={(cell) => (
                    cell.value ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )
                  )} />
                  <DxColumn dataField="packingCorrect" caption="Packing" width={100} cellRender={(cell) => (
                    cell.value ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )
                  )} />
                  <DxColumn dataField="operatorName" caption="Operator" width={150} />
                  <DxColumn dataField="inspectorName" caption="Inspector" width={150} />
                  <DxColumn dataField="notes" caption="Notes" />
                </DxDataGrid>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weight Check Dialog (Add / Edit) */}
      <DxPopup
        visible={showWeightDialog}
        onHiding={() => {
          setShowWeightDialog(false);
          setSampleWeights([]);
          setEditingWeightLog(null);
          setWeightNotes('');
        }}
        title={editingWeightLog ? 'Edit Weight Check' : 'Record Weight Check'}
        width={600}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          {editingWeightLog && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Editing record from <strong>{editingWeightLog.checkTime}</strong>. Changes will be logged in audit trail.
              </p>
            </div>
          )}

          {criteria && (
            <div className="bg-indigo-50 rounded-lg p-3">
              <p className="text-sm text-indigo-800">
                <strong>Criteria:</strong> {criteria.weightMin}-{criteria.weightMax}g |
                Sample Size: {criteria.sampleSize} |
                Max Failures: {criteria.maxFailures}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sample Weights (g)
            </label>
            <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto">
              {sampleWeights.map((weight, index) => (
                <div key={index}>
                  <label className="block text-xs text-gray-500 mb-1">#{index + 1}</label>
                  <DxNumberBox
                    value={weight}
                    onValueChanged={(e) => updateSampleWeight(index, e.value)}
                    format="#0.0"
                    min={0}
                    showSpinButtons
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes {editingWeightLog && <span className="text-amber-600">(reason for edit)</span>}</label>
            <DxTextArea
              value={weightNotes}
              onValueChanged={(e) => setWeightNotes(e.value)}
              placeholder={editingWeightLog ? 'Reason for editing...' : 'Any observations...'}
              height={60}
            />
          </div>

          {/* Result Preview */}
          <div className={`rounded-lg p-4 ${weightResult.isPass ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {weightResult.isPass ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">PASS</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">FAIL</span>
                  </>
                )}
              </div>
              <div className="text-sm">
                Failed: <strong>{weightResult.failedCount}</strong> / Max: <strong>{criteria?.maxFailures || 0}</strong>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowWeightDialog(false)} />
            <DxButton
              text={editingWeightLog ? 'Update' : 'Save'}
              type="success"
              onClick={handleSaveWeight}
              disabled={(editingWeightLog ? editWeightMutation.isPending : addWeightMutation.isPending) || sampleWeights.some(w => w === 0)}
            />
          </div>
        </div>
      </DxPopup>

      {/* Integrity Check Dialog */}
      <DxPopup
        visible={showIntegrityDialog}
        onHiding={() => setShowIntegrityDialog(false)}
        title="Record Integrity Check"
        width={450}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Tube/Cap Complete & Sealed</span>
              <DxSwitch
                value={integrityForm.tubeCapComplete}
                onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIntegrityForm({ ...integrityForm, tubeCapComplete: e.value ?? true })}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Lot Number Correct</span>
              <DxSwitch
                value={integrityForm.lotNumberCorrect}
                onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIntegrityForm({ ...integrityForm, lotNumberCorrect: e.value ?? true })}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Packing Correct</span>
              <DxSwitch
                value={integrityForm.packingCorrect}
                onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIntegrityForm({ ...integrityForm, packingCorrect: e.value ?? true })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextArea
              value={integrityForm.notes}
              onValueChanged={(e) => setIntegrityForm({ ...integrityForm, notes: e.value })}
              placeholder="Any observations..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowIntegrityDialog(false)} />
            <DxButton
              text="Save"
              type="success"
              onClick={() => addIntegrityMutation.mutate(integrityForm)}
              disabled={addIntegrityMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxPopup
        visible={deletingWeightLogId !== null}
        onHiding={() => setDeletingWeightLogId(null)}
        title="Confirm Delete"
        width={400}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-gray-700">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setDeletingWeightLogId(null)} />
            <DxButton
              text="Delete"
              type="danger"
              onClick={() => deletingWeightLogId && deleteWeightMutation.mutate(deletingWeightLogId)}
              disabled={deleteWeightMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
