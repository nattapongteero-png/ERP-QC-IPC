'use client';

/**
 * Work Order Finished Product Inspection Page
 * 15-point inspection checklist for finished products
 * Form Section: 14
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { formatNumber } from '@/lib/utils/number-format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { ResponsivePageHeader } from '@/components/shared';
import { AttachmentPanel } from '@/components/shared/AttachmentPanel';
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
    name: 'การระบุตัวสินค้า',
    icon: Package,
    items: [
      { key: 'medicineCorrect', label: 'ยาตรงตามที่ระบุ (Medicine matches specification)' },
      { key: 'strengthCorrect', label: 'ความแรงถูกต้อง (Correct strength)' },
      { key: 'dosageFormCorrect', label: 'รูปแบบยาถูกต้อง (Correct dosage form)' },
    ],
  },
  {
    name: 'การตรวจฉลาก',
    icon: FileText,
    items: [
      { key: 'labelComplete', label: 'ฉลากครบถ้วน (Label complete)' },
      { key: 'batchNumberCorrect', label: 'เลขที่ผลิตถูกต้อง (Batch number correct)' },
      { key: 'expiryDateCorrect', label: 'วันหมดอายุถูกต้อง (Expiry date correct)' },
      { key: 'manufacturerCorrect', label: 'ข้อมูลผู้ผลิตถูกต้อง (Manufacturer info correct)' },
    ],
  },
  {
    name: 'ลักษณะภายนอก',
    icon: Eye,
    items: [
      { key: 'colorNormal', label: 'สีปกติ (Normal color)' },
      { key: 'odorNormal', label: 'กลิ่นปกติ (Normal odor)' },
      { key: 'textureNormal', label: 'เนื้อสัมผัสปกติ (Normal texture)' },
      { key: 'noContamination', label: 'ไม่มีสิ่งปนเปื้อน (No contamination)' },
    ],
  },
  {
    name: 'ความสมบูรณ์ของภาชนะ',
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
  const [isEditing, setIsEditing] = useState(false);
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
  const [categoryRemarks, setCategoryRemarks] = useState<Record<string, string>>({});
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

  // Realtime sync — when another user records / verifies / re-inspects on
  // the same WO, refresh both the inspection record and the WO header
  // (status flips when inspection passes).
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    if (data.section !== 'finished-inspection' && data.section !== 'status') return;
    queryClient.invalidateQueries({ queryKey: ['wo-finished-inspection', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Create inspection mutation
  const createInspectionMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/finished-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleDate: toLocalDateStr(new Date()),
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-finished-inspection', workOrderId] });
      toast.success('สร้างการตรวจแล้ว', 'สร้างการตรวจสินค้าสำเร็จรูปเรียบร้อย');
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  // Update inspection (submit checklist) mutation
  const updateInspectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { checklistResults: Record<string, boolean>; notes?: string; isDraft?: boolean } }) => {
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
      toast.success('บันทึกแล้ว', 'บันทึกรายการตรวจเรียบร้อย');
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
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
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  const handleStartEditing = () => {
    if (inspection?.checklistResults && Object.keys(inspection.checklistResults).length > 0) {
      setChecklistResults(inspection.checklistResults);
    } else {
      const initial: Record<string, boolean> = {};
      allChecklistItems.forEach(item => { initial[item.key] = true; });
      setChecklistResults(initial);
    }
    setInspectNotes(inspection?.notes || '');
    // Parse category remarks from notes if exists
    const remarks: Record<string, string> = {};
    if (inspection?.notes) {
      try {
        const parsed = JSON.parse(inspection.notes);
        if (typeof parsed === 'object' && parsed.categoryRemarks) {
          Object.assign(remarks, parsed.categoryRemarks);
        }
      } catch { /* notes is plain text, not JSON */ }
    }
    setCategoryRemarks(remarks);
    setIsEditing(true);
  };

  const buildNotesWithRemarks = () => {
    const hasRemarks = Object.values(categoryRemarks).some(v => v.trim());
    if (!inspectNotes && !hasRemarks) return undefined;
    const parts: string[] = [];
    if (inspectNotes) parts.push(inspectNotes);
    if (hasRemarks) {
      for (const [cat, remark] of Object.entries(categoryRemarks)) {
        if (remark.trim()) parts.push(`[${cat}] ${remark}`);
      }
    }
    return parts.join('\n');
  };

  const handleSaveDraft = () => {
    if (!inspection) return;
    updateInspectionMutation.mutate({
      id: inspection.id,
      data: {
        checklistResults,
        notes: buildNotesWithRemarks(),
        isDraft: true,
      },
    });
  };

  const handleConfirmInspection = () => {
    if (!inspection) return;
    updateInspectionMutation.mutate({
      id: inspection.id,
      data: {
        checklistResults,
        notes: buildNotesWithRemarks(),
      },
    });
  };

  const getPassCount = (results: Record<string, boolean>) => {
    return Object.values(results).filter(v => v).length;
  };

  const getStatusInfo = (status: FinishedInspection['status']) => {
    const statusMap = {
      pending: { label: 'รอดำเนินการ', color: 'bg-gray-100 text-gray-600', icon: Clock },
      in_progress: { label: 'กำลังตรวจ', color: 'bg-amber-100 text-amber-700', icon: Clock },
      passed: { label: 'ผ่าน', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      failed: { label: 'ไม่ผ่าน', color: 'bg-red-100 text-red-700', icon: XCircle },
      re_inspected: { label: 'ตรวจซ้ำแล้ว', color: 'bg-emerald-100 text-emerald-700', icon: UserCheck },
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
        <p className="text-gray-500">ไม่พบใบสั่งผลิต</p>
        <DxButton
          text="กลับไปใบสั่งผลิต"
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
        title="ตรวจสินค้าสำเร็จรูป"
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={ClipboardCheck}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}?tab=execution` },
          { label: 'Finished Inspection' },
        ]}
        actions={
          <DxButton
            text="กลับไปการดำเนินการ"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push(`/production/work-orders/${workOrderId}?tab=execution`)}
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
            <h3 className="text-lg font-medium text-gray-700 mb-2">ยังไม่ได้เริ่มตรวจสินค้าสำเร็จรูป</h3>
            <p className="text-gray-500 mb-6">
              กดปุ่ม &quot;เริ่มตรวจสินค้า&quot; เพื่อเริ่มรายการตรวจคุณภาพ 15 ข้อ และจะแนบรูปถ่ายสินค้าได้หลังจากนั้น
            </p>
            <DxButton
              text="เริ่มตรวจสินค้า"
              type="success"
              onClick={() => setShowCreateDialog(true)}
            />
          </CardContent>
        </Card>
      ) : (
        // Show inspection details with inline checklist
        <>
          {/* Status Card */}
          <Card className={`border-2 ${
            inspection.status === 'passed' ? 'border-green-200 bg-green-50' :
            inspection.status === 'failed' ? 'border-red-200 bg-red-50' :
            'border-emerald-100'
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
                            สุ่มตัวอย่าง: {new Date(inspection.sampleDate).toLocaleDateString('th-TH')} โดย {inspection.samplerName || `User#${inspection.samplerId}`}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">ตัวอย่าง</p>
                    <p className="text-lg font-medium">
                      ทดสอบ: {formatNumber(inspection.sampleQtyForTest)} | สำรอง: {formatNumber(inspection.sampleQtyForRetention)}
                    </p>
                  </div>
                  {!isEditing && inspection.status !== 'passed' && (
                    <DxButton text="แก้ไขรายการตรวจ" icon="edit" stylingMode="outlined" onClick={handleStartEditing} />
                  )}
                  {!isEditing && inspection.status === 'passed' && workOrder.status !== 'completed' && (
                    <DxButton text="แก้ไขอีกครั้ง" icon="edit" stylingMode="outlined" onClick={handleStartEditing} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Finished-product photos — supports multiple views:
              box packaging / pills in blister / product in bottle / bottle label.
              Locked (view-only) once the WO is completed. */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-2">
                <h4 className="flex items-center gap-2 font-medium text-gray-800">
                  <Package className="h-5 w-5" />
                  รูปถ่ายสินค้าสำเร็จรูป
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  ถ่ายได้หลายรูป เช่น กล่องบรรจุ · ยาในแผง · สินค้าในขวด · ฉลากติดขวด
                </p>
              </div>
              {/* Finished-product photos can always be attached — they're taken
                  once the product IS finished, so locking them when the WO is
                  'completed' hid the upload button exactly when it's needed. */}
              <AttachmentPanel
                moduleName="wo_finished_product"
                entityId={workOrderId}
                defaultCategory="photo"
                imagesOnly
                title="รูปถ่ายสินค้าสำเร็จรูป"
                testIdBase="finished-product-photos"
              />
            </CardContent>
          </Card>

          {/* Inline Checklist — Editing Mode */}
          {(isEditing || (!inspection.checklistResults || Object.keys(inspection.checklistResults).length === 0)) ? (() => {
            // Auto-enter edit mode if checklist is empty
            if (!isEditing && (!inspection.checklistResults || Object.keys(inspection.checklistResults).length === 0)) {
              // Will enter edit mode on mount via effect-like pattern
              setTimeout(() => handleStartEditing(), 0);
              return null;
            }
            const passCount = getPassCount(checklistResults);
            return (
              <>
                {/* Summary bar */}
                <div className={`rounded-lg p-4 ${passCount === allChecklistItems.length ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {passCount === allChecklistItems.length ? (
                        <><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="font-medium text-green-800">ผ่านครบ 15 ข้อ</span></>
                      ) : (
                        <><AlertCircle className="h-5 w-5 text-amber-600" /><span className="font-medium text-amber-800">ผ่าน {passCount}/{allChecklistItems.length} ข้อ — มี {allChecklistItems.length - passCount} ข้อที่ต้องตรวจสอบ</span></>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checklist categories */}
                {checklistCategories.map((category) => {
                  const CategoryIcon = category.icon;
                  const catPassCount = category.items.filter(i => checklistResults[i.key]).length;
                  return (
                    <Card key={category.name}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="flex items-center gap-2 font-medium text-gray-800">
                            <CategoryIcon className="h-5 w-5" />
                            {category.name}
                          </h4>
                          <span className={`text-sm px-2 py-0.5 rounded ${catPassCount === category.items.length ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {catPassCount}/{category.items.length} Pass
                          </span>
                        </div>
                        <div className="space-y-2">
                          {category.items.map((item) => (
                            <div key={item.key} className={`flex items-center justify-between p-3 rounded-lg border ${checklistResults[item.key] ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-center gap-2">
                                {checklistResults[item.key] ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                )}
                                <span className="text-sm text-gray-700">{item.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${checklistResults[item.key] ? 'text-green-700' : 'text-red-700'}`}>
                                  {checklistResults[item.key] ? 'ผ่าน' : 'ไม่ผ่าน'}
                                </span>
                                <DxSwitch
                                  value={checklistResults[item.key] ?? true}
                                  onValueChanged={(e: SwitchTypes.ValueChangedEvent) =>
                                    setChecklistResults({ ...checklistResults, [item.key]: e.value ?? true })
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Per-category remarks */}
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Remarks — {category.name}</label>
                          <DxTextArea
                            value={categoryRemarks[category.name] || ''}
                            onValueChanged={(e) => setCategoryRemarks({ ...categoryRemarks, [category.name]: e.value })}
                            placeholder={`Remarks for ${category.name}...`}
                            height={50}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* General notes */}
                <Card>
                  <CardContent className="p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุทั่วไป</label>
                    <DxTextArea
                      value={inspectNotes}
                      onValueChanged={(e) => setInspectNotes(e.value)}
                      placeholder="Overall observations or remarks..."
                      height={80}
                    />
                  </CardContent>
                </Card>

                {/* Action buttons: Save Draft / Confirm */}
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <p className="text-sm text-emerald-800">
                      Inspector digital signature will be recorded automatically (user login + timestamp).
                    </p>
                    <div className="flex gap-2">
                      <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => setIsEditing(false)} />
                      <DxButton
                        text="บันทึกร่าง"
                        type="normal"
                        stylingMode="outlined"
                        onClick={handleSaveDraft}
                        disabled={updateInspectionMutation.isPending}
                      />
                      <DxButton
                        text="ยืนยันผลตรวจ"
                        type="success"
                        onClick={handleConfirmInspection}
                        disabled={updateInspectionMutation.isPending}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })() : (
            // Read-only view after confirmed
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">ผลการตรวจ</h3>
                    <div className="text-sm text-gray-600">
                      ผ่าน {getPassCount(inspection.checklistResults)}/{allChecklistItems.length} ข้อ
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
                                <div key={item.key} className={`flex items-center gap-2 p-2 rounded ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
                                  {passed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                  )}
                                  <span className={`text-sm ${passed ? 'text-green-800' : 'text-red-800'}`}>{item.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {inspection.notes && (
                    <div className="mt-4 p-3 bg-[#F6FCF9] rounded-lg">
                      <p className="text-sm text-gray-700 whitespace-pre-line"><strong>หมายเหตุ:</strong> {inspection.notes}</p>
                    </div>
                  )}

                  {(inspection.inspectorId || inspection.inspectorName) && (
                    <div className="mt-4 text-sm text-gray-600 flex items-center gap-4">
                      <span className="flex items-center gap-1"><UserCheck className="h-4 w-4" /> ผู้ตรวจ: {inspection.inspectorName || `User#${inspection.inspectorId}`}</span>
                      {inspection.inspectedAt && <span>{new Date(inspection.inspectedAt).toLocaleString('th-TH')}</span>}
                    </div>
                  )}

                  {(inspection.reInspectorId || inspection.reInspectorName) && (
                    <div className="mt-2 text-sm text-emerald-600 flex items-center gap-4">
                      <span className="flex items-center gap-1"><UserCheck className="h-4 w-4" /> ผู้ตรวจซ้ำ: {inspection.reInspectorName || `User#${inspection.reInspectorId}`}</span>
                      {inspection.reInspectedAt && <span>{new Date(inspection.reInspectedAt).toLocaleString('th-TH')}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {inspection.status === 'failed' && !inspection.reInspectedAt && (
                <Card className="border-amber-200">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertCircle className="h-5 w-5" />
                      <span>ผลตรวจไม่ผ่าน อาจต้องตรวจซ้ำ</span>
                    </div>
                    <DxButton text="บันทึกการตรวจซ้ำ" type="default" onClick={() => reInspectMutation.mutate(inspection.id)} disabled={reInspectMutation.isPending} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Create Inspection Dialog */}
      <DxPopup
        visible={showCreateDialog}
        onHiding={() => setShowCreateDialog(false)}
        title="สร้างการตรวจสินค้าสำเร็จรูป"
        width={450}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>สินค้า:</strong> {workOrder?.productName}
            <br />
            <strong>แบตช์:</strong> {workOrder?.batchNumber}
            <br />
            <strong>วันที่:</strong> {new Date().toLocaleDateString('th-TH')}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จำนวนตัวอย่างเพื่อทดสอบ
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
                จำนวนตัวอย่างเก็บสำรอง
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
            <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => setShowCreateDialog(false)} />
            <DxButton
              text="สร้างการตรวจ"
              type="success"
              onClick={() => createInspectionMutation.mutate(createForm)}
              disabled={createInspectionMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Old checklist dialog removed — now inline on page */}
    </div>
  );
}
