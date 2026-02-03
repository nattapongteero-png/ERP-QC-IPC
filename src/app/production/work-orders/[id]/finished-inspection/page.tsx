'use client';

/**
 * Work Order Finished Product Inspection Page
 * 15-point inspection checklist for finished products
 * Form Section: 14
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { SwitchTypes } from 'devextreme-react/switch';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  Package,
  FileText,
  Eye,
  FlaskConical,
} from 'lucide-react';

interface FinishedInspection {
  id: number;
  workOrderId: number;
  sampleDate: string;
  samplerId: number;
  samplerName?: string;
  sampleQtyForTest: number;
  sampleQtyForRetention: number;
  checklistResults: Record<string, boolean>;
  inspectorId?: number;
  inspectorName?: string;
  inspectedAt?: string;
  reInspectorId?: number;
  reInspectorName?: string;
  reInspectedAt?: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 're_inspected';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
}

// 15-point checklist items organized by category
const checklistCategories = [
  {
    name: 'Product Identity',
    icon: Package,
    items: [
      { key: 'medicineCorrect', label: 'ยาตรงตามที่ระบุ (Medicine matches specification)' },
      { key: 'strengthCorrect', label: 'ความแรงถูกต้อง (Correct strength)' },
      { key: 'dosageFormCorrect', label: 'รูปแบบยาถูกต้อง (Correct dosage form)' },
    ],
  },
  {
    name: 'Label Verification',
    icon: FileText,
    items: [
      { key: 'labelComplete', label: 'ฉลากครบถ้วน (Label complete)' },
      { key: 'batchNumberCorrect', label: 'เลขที่ผลิตถูกต้อง (Batch number correct)' },
      { key: 'expiryDateCorrect', label: 'วันหมดอายุถูกต้อง (Expiry date correct)' },
      { key: 'manufacturerCorrect', label: 'ข้อมูลผู้ผลิตถูกต้อง (Manufacturer info correct)' },
    ],
  },
  {
    name: 'Physical Appearance',
    icon: Eye,
    items: [
      { key: 'colorNormal', label: 'สีปกติ (Normal color)' },
      { key: 'odorNormal', label: 'กลิ่นปกติ (Normal odor)' },
      { key: 'textureNormal', label: 'เนื้อสัมผัสปกติ (Normal texture)' },
      { key: 'noContamination', label: 'ไม่มีสิ่งปนเปื้อน (No contamination)' },
    ],
  },
  {
    name: 'Container Integrity',
    icon: FlaskConical,
    items: [
      { key: 'containerIntact', label: 'ภาชนะบรรจุสมบูรณ์ (Container intact)' },
      { key: 'sealIntact', label: 'ซีลไม่เสียหาย (Seal intact)' },
      { key: 'capSecure', label: 'ฝาปิดแน่นหนา (Cap secure)' },
      { key: 'fillLevelCorrect', label: 'ปริมาณบรรจุถูกต้อง (Fill level correct)' },
    ],
  },
];

const allChecklistItems = checklistCategories.flatMap(cat => cat.items);

export default function FinishedInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('execution.finishedInspection');
  const workOrderId = Number(params.id);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInspectDialog, setShowInspectDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    sampleQtyForTest: 50,
    sampleQtyForRetention: 3,
  });
  const [checklistResults, setChecklistResults] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allChecklistItems.forEach(item => {
      initial[item.key] = true;
    });
    return initial;
  });
  const [inspectNotes, setInspectNotes] = useState('');

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

  // Fetch finished inspection
  const { data: inspection, isLoading: inspectionLoading } = useQuery<FinishedInspection | null>({
    queryKey: ['wo-finished-inspection', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/finished-inspection`);
      const data = await res.json();
      if (!data.success) return null;
      return data.data;
    },
  });

  // Create inspection mutation
  const createInspectionMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/finished-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleDate: new Date().toISOString().split('T')[0],
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-finished-inspection', workOrderId] });
      toast.success('Inspection Created', 'Finished product inspection has been created.');
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Update inspection (submit checklist) mutation
  const updateInspectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { checklistResults: Record<string, boolean>; notes?: string } }) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/finished-inspection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-finished-inspection', workOrderId] });
      toast.success('Inspection Completed', 'Inspection checklist has been submitted.');
      setShowInspectDialog(false);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Re-inspect mutation
  const reInspectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/finished-inspection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-finished-inspection', workOrderId] });
      toast.success('Re-inspection Recorded', 'Re-inspection has been recorded.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleOpenInspectDialog = () => {
    if (inspection?.checklistResults) {
      setChecklistResults(inspection.checklistResults);
    }
    setInspectNotes(inspection?.notes || '');
    setShowInspectDialog(true);
  };

  const handleSubmitInspection = () => {
    if (!inspection) return;
    updateInspectionMutation.mutate({
      id: inspection.id,
      data: {
        checklistResults,
        notes: inspectNotes || undefined,
      },
    });
  };

  const getPassCount = (results: Record<string, boolean>) => {
    return Object.values(results).filter(v => v).length;
  };

  const getStatusInfo = (status: FinishedInspection['status']) => {
    const statusMap = {
      pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
      in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
      passed: { label: 'Passed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
      re_inspected: { label: 'Re-inspected', color: 'bg-blue-100 text-blue-700', icon: UserCheck },
    };
    return statusMap[status];
  };

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
        title="Finished Product Inspection"
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={ClipboardCheck}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}/execution` },
          { label: 'Finished Inspection' },
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

      {inspectionLoading ? (
        <div className="flex items-center justify-center h-40">
          <DxLoadIndicator />
        </div>
      ) : !inspection ? (
        // No inspection yet - show create button
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Inspection Started</h3>
            <p className="text-gray-500 mb-6">
              Create a finished product inspection to start the 15-point quality checklist.
            </p>
            <DxButton
              text="Start Inspection"
              type="success"
              onClick={() => setShowCreateDialog(true)}
            />
          </CardContent>
        </Card>
      ) : (
        // Show inspection details
        <>
          {/* Status Card */}
          <Card className={`border-2 ${
            inspection.status === 'passed' ? 'border-green-200 bg-green-50' :
            inspection.status === 'failed' ? 'border-red-200 bg-red-50' :
            'border-gray-200'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {(() => {
                    const statusInfo = getStatusInfo(inspection.status);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <>
                        <StatusIcon className={`h-8 w-8 ${
                          inspection.status === 'passed' ? 'text-green-600' :
                          inspection.status === 'failed' ? 'text-red-600' :
                          'text-gray-600'
                        }`} />
                        <div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          <p className="text-sm text-gray-600 mt-1">
                            Sampled: {new Date(inspection.sampleDate).toLocaleDateString()} by {inspection.samplerName}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Samples</p>
                  <p className="text-lg font-medium">
                    Test: {inspection.sampleQtyForTest} | Retention: {inspection.sampleQtyForRetention}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inspection Results */}
          {inspection.checklistResults && Object.keys(inspection.checklistResults).length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Inspection Results</h3>
                  <div className="text-sm text-gray-600">
                    {getPassCount(inspection.checklistResults)}/{allChecklistItems.length} Passed
                  </div>
                </div>

                <div className="space-y-6">
                  {checklistCategories.map((category) => {
                    const CategoryIcon = category.icon;
                    return (
                      <div key={category.name}>
                        <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <CategoryIcon className="h-4 w-4" />
                          {category.name}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {category.items.map((item) => {
                            const passed = inspection.checklistResults[item.key];
                            return (
                              <div
                                key={item.key}
                                className={`flex items-center gap-2 p-2 rounded ${
                                  passed ? 'bg-green-50' : 'bg-red-50'
                                }`}
                              >
                                {passed ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                )}
                                <span className={`text-sm ${passed ? 'text-green-800' : 'text-red-800'}`}>
                                  {item.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {inspection.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700"><strong>Notes:</strong> {inspection.notes}</p>
                  </div>
                )}

                {/* Inspector info */}
                {inspection.inspectorName && (
                  <div className="mt-4 text-sm text-gray-600 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-4 w-4" />
                      Inspected by {inspection.inspectorName}
                    </span>
                    <span>{new Date(inspection.inspectedAt!).toLocaleString()}</span>
                  </div>
                )}

                {inspection.reInspectorName && (
                  <div className="mt-2 text-sm text-blue-600 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-4 w-4" />
                      Re-inspected by {inspection.reInspectorName}
                    </span>
                    <span>{new Date(inspection.reInspectedAt!).toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            // Inspection created but checklist not filled
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">Inspection In Progress</h3>
                <p className="text-gray-500 mb-6">
                  Complete the 15-point inspection checklist.
                </p>
                <DxButton
                  text="Complete Inspection"
                  type="success"
                  onClick={handleOpenInspectDialog}
                />
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          {inspection.status === 'failed' && !inspection.reInspectedAt && (
            <Card className="border-amber-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="h-5 w-5" />
                  <span>Inspection failed. Re-inspection may be required.</span>
                </div>
                <DxButton
                  text="Record Re-inspection"
                  type="default"
                  onClick={() => reInspectMutation.mutate(inspection.id)}
                  disabled={reInspectMutation.isPending}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create Inspection Dialog */}
      <DxPopup
        visible={showCreateDialog}
        onHiding={() => setShowCreateDialog(false)}
        title="Create Finished Product Inspection"
        width={450}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>Product:</strong> {workOrder?.productName}
            <br />
            <strong>Batch:</strong> {workOrder?.batchNumber}
            <br />
            <strong>Date:</strong> {new Date().toLocaleDateString()}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sample for Testing
              </label>
              <DxNumberBox
                value={createForm.sampleQtyForTest}
                onValueChanged={(e) => setCreateForm({ ...createForm, sampleQtyForTest: e.value })}
                min={1}
                showSpinButtons
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sample for Retention
              </label>
              <DxNumberBox
                value={createForm.sampleQtyForRetention}
                onValueChanged={(e) => setCreateForm({ ...createForm, sampleQtyForRetention: e.value })}
                min={1}
                showSpinButtons
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowCreateDialog(false)} />
            <DxButton
              text="Create Inspection"
              type="success"
              onClick={() => createInspectionMutation.mutate(createForm)}
              disabled={createInspectionMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Inspection Checklist Dialog */}
      <DxPopup
        visible={showInspectDialog}
        onHiding={() => setShowInspectDialog(false)}
        title="Inspection Checklist (15 Points)"
        width={700}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {checklistCategories.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <div key={category.name} className="bg-gray-50 rounded-lg p-4">
                <h4 className="flex items-center gap-2 font-medium text-gray-800 mb-3">
                  <CategoryIcon className="h-5 w-5" />
                  {category.name}
                </h4>
                <div className="space-y-2">
                  {category.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-2 bg-white rounded border"
                    >
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <DxSwitch
                        value={checklistResults[item.key] ?? true}
                        onValueChanged={(e: SwitchTypes.ValueChangedEvent) =>
                          setChecklistResults({ ...checklistResults, [item.key]: e.value ?? true })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className={`rounded-lg p-4 ${
            getPassCount(checklistResults) === allChecklistItems.length
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getPassCount(checklistResults) === allChecklistItems.length ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">All checks passed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">
                      {allChecklistItems.length - getPassCount(checklistResults)} items failed
                    </span>
                  </>
                )}
              </div>
              <span className="text-sm">
                {getPassCount(checklistResults)}/{allChecklistItems.length}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextArea
              value={inspectNotes}
              onValueChanged={(e) => setInspectNotes(e.value)}
              placeholder="Any observations or remarks..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowInspectDialog(false)} />
            <DxButton
              text="Submit Inspection"
              type="success"
              onClick={handleSubmitInspection}
              disabled={updateInspectionMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
