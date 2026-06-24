'use client';

/**
 * Work Order Environmental Monitoring Page
 * Records temperature and humidity readings during production/packaging
 * Form Sections: 7, 10.2
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeTopic } from '@/hooks/use-realtime-topic';
import { ResponsivePageHeader } from '@/components/shared';
import BOMConfigReferencePanel from '@/components/production/BOMConfigReferencePanel';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  Thermometer,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface EnvironmentalLog {
  id: number;
  workOrderId: number;
  roomId?: number;
  roomName?: string;
  roomCode?: string;
  phase: string;
  recordedDate: string;
  recordedTime: string;
  temperature: number;
  humidity: number;
  isNormal: boolean;
  operatorId: number;
  operatorName?: string;
  notes?: string;
  createdAt: string;
}

interface EnvironmentalCondition {
  id: number;
  name: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMax: number;
  monitoringIntervalMinutes: number;
}

interface WorkOrderBasic {
  id: number;
  woNumber: string;
  batchNumber: string;
  productName: string;
  status: string;
  bomId?: number;
  bomCode?: string | null;
  bomName?: string | null;
  bomVersion?: string | null;
}

type PhaseStatusValue = 'pending' | 'active' | 'completed';
interface PhaseInfo {
  status: PhaseStatusValue;
  startedAt: string | null;
  completedAt: string | null;
  progress: { completed: number; total: number };
  hasRoomMapping: boolean;
}
interface PhaseStatusResponse {
  workOrderId: number;
  workOrderStatus: string;
  bomId: number | null;
  activePhase: 'pre_production' | 'production' | 'packaging' | null;
  pre_production: PhaseInfo;
  production: PhaseInfo;
  packaging: PhaseInfo;
}

interface BOMRoom {
  id: number;
  roomId: number;
  room?: { id: number; code: string; name: string };
  phase: string;
}

const PHASE_MAP = ['pre_production', 'production', 'packaging'] as const;

const PHASE_LABELS: Record<typeof PHASE_MAP[number], string> = {
  pre_production: 'ก่อนการผลิต',
  production: 'การผลิต',
  packaging: 'บรรจุภัณฑ์',
};

export default function EnvironmentalMonitoringPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const workOrderId = Number(params.id);

  const phaseParam = searchParams.get('phase');
  const initialPhase = phaseParam === 'packaging' ? 2 : phaseParam === 'production' ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialPhase);
  // Once the user (or an explicit ?phase= URL) picks a tab, stop auto-jumping
  // to the active phase so manual navigation isn't overridden.
  const tabManuallySet = useRef<boolean>(!!phaseParam);

  // Keep tab in sync with URL ?phase= when navigating via back/forward
  useEffect(() => {
    if (!phaseParam) return;
    const idx = phaseParam === 'packaging' ? 2 : phaseParam === 'production' ? 1 : 0;
    tabManuallySet.current = true;
    setActiveTab(idx);
  }, [phaseParam]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    roomId: undefined as number | undefined,
    temperature: 25,
    humidity: 50,
    notes: '',
  });

  const currentPhase = PHASE_MAP[activeTab] || 'pre_production';

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

  // Fetch environmental logs (auto-refresh every 10s to pick up new IoT readings)
  const { data: logs, isLoading: logsLoading } = useQuery<EnvironmentalLog[]>({
    queryKey: ['wo-environmental-logs', workOrderId, currentPhase],
    queryFn: async () => {
      const res = await fetch(`/api/environmental-logs?workOrderId=${workOrderId}&phase=${currentPhase}`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  // Auto-refresh when any user records / updates an environmental log on this WO
  useRealtimeTopic('work-order-changed', (data) => {
    if (data.workOrderId !== workOrderId) return;
    if (data.section !== 'environmental' && data.section !== 'status') return;
    queryClient.invalidateQueries({ queryKey: ['wo-environmental-logs', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['wo-phase-status', workOrderId] });
    queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
  });

  // Fetch computed phase status — drives per-tab badges + active-phase banner.
  // Auto-refresh every 10s so UI keeps up when activities are updated elsewhere.
  const { data: phaseStatus } = useQuery<PhaseStatusResponse>({
    queryKey: ['wo-phase-status', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/phase/status`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const currentPhaseInfo = phaseStatus?.[currentPhase];

  // Auto-focus the phase that's actively recording: on first load (no explicit
  // ?phase= and the user hasn't switched tabs yet), jump to the active phase so
  // the user sees only the data for the phase currently being recorded.
  useEffect(() => {
    if (tabManuallySet.current) return;
    const active = phaseStatus?.activePhase;
    if (!active) return;
    const idx = PHASE_MAP.indexOf(active as typeof PHASE_MAP[number]);
    if (idx >= 0) setActiveTab(idx);
  }, [phaseStatus]);

  // Build dynamic tab items with status badges (Active/Frozen/Pending)
  // next to each phase label. Status reflects computed phase state.
  const tabItems: DxTabItem[] = PHASE_MAP.map((phaseKey, idx) => {
    const info = phaseStatus?.[phaseKey];
    const label = PHASE_LABELS[phaseKey];
    let suffix = '';
    if (info?.status === 'active') suffix = ' 🟢';
    else if (info?.status === 'completed') suffix = ' ✓';
    else suffix = ' ⏳';
    return {
      id: idx,
      text: `${label}${suffix}`,
      icon: phaseKey === 'pre_production' ? 'clock' : phaseKey === 'production' ? 'product' : 'box',
    };
  });

  // Fetch BOM environmental condition for this phase
  const { data: condition } = useQuery<EnvironmentalCondition | null>({
    queryKey: ['wo-environmental-condition', workOrderId, currentPhase],
    queryFn: async () => {
      const res = await fetch(`/api/production/work-orders/${workOrderId}/environmental-condition?phase=${currentPhase}`);
      const data = await res.json();
      if (!data.success) return null;
      return data.data;
    },
  });

  // Fetch BOM rooms for current phase (for room selector in dialog)
  const { data: bomRooms } = useQuery<BOMRoom[]>({
    queryKey: ['bom-rooms-phase', workOrder?.bomId, currentPhase],
    queryFn: async () => {
      if (!workOrder?.bomId) return [];
      const res = await fetch(`/api/production/bom/${workOrder.bomId}/rooms?phase=${currentPhase}`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data || [];
    },
    enabled: !!workOrder?.bomId,
  });

  // Add log mutation
  const addLogMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const now = new Date();
      const res = await fetch(`/api/environmental-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId,
          phase: currentPhase,
          recordedDate: toLocalDateStr(now),
          recordedTime: now.toTimeString().slice(0, 5),
          ...data,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-environmental-logs', workOrderId, currentPhase] });
      toast.success('บันทึกสำเร็จ', 'บันทึกค่าสภาพแวดล้อมเรียบร้อยแล้ว');
      setShowAddDialog(false);
      setFormData({ roomId: undefined, temperature: 25, humidity: 50, notes: '' });
    },
    onError: (error: Error) => {
      toast.error('เกิดข้อผิดพลาด', error.message);
    },
  });

  // Edit log mutation
  const editLogMutation = useMutation({
    mutationFn: async (data: typeof formData & { logId: number }) => {
      const res = await fetch(`/api/environmental-logs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, workOrderId, phase: currentPhase }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-environmental-logs', workOrderId, currentPhase] });
      toast.success('อัปเดตสำเร็จ', 'แก้ไขข้อมูลสภาวะแวดล้อมเรียบร้อย');
      setShowAddDialog(false);
      setEditingLogId(null);
      setFormData({ roomId: undefined, temperature: 25, humidity: 50, notes: '' });
    },
    onError: (error: Error) => toast.error('เกิดข้อผิดพลาด', error.message),
  });

  // Delete log mutation
  const deleteLogMutation = useMutation({
    mutationFn: async (logId: number) => {
      const res = await fetch(`/api/environmental-logs?logId=${logId}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wo-environmental-logs', workOrderId, currentPhase] });
      toast.success('ลบสำเร็จ', 'ลบข้อมูลสภาวะแวดล้อมเรียบร้อย');
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const handleOpenEdit = (log: EnvironmentalLog) => {
    setEditingLogId(log.id);
    setFormData({
      roomId: log.roomId || undefined,
      temperature: log.temperature,
      humidity: log.humidity,
      notes: log.notes || '',
    });
    setShowAddDialog(true);
  };

  const handleSave = () => {
    if (editingLogId) {
      editLogMutation.mutate({ ...formData, logId: editingLogId });
    } else {
      addLogMutation.mutate(formData);
    }
  };

  const isWithinLimits = (temp: number, humidity: number) => {
    if (!condition) return true;
    return (
      temp >= condition.temperatureMin &&
      temp <= condition.temperatureMax &&
      humidity <= condition.humidityMax
    );
  };

  const renderStatusBadge = (isNormal: boolean) => {
    return isNormal ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        ปกติ
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertCircle className="h-3 w-3" />
        ผิดปกติ
      </span>
    );
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
          text="กลับไปที่ใบสั่งผลิต"
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
        title="การเฝ้าระวังสภาพแวดล้อม"
        subtitle={`${workOrder.woNumber} | แบทช์: ${workOrder.batchNumber}${workOrder.bomCode ? ` | BOM: ${workOrder.bomCode}${workOrder.bomVersion ? ` v${workOrder.bomVersion}` : ''}` : ''}`}
        icon={Thermometer}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'การผลิต', href: '/production' },
          { label: 'ใบสั่งผลิต', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'การดำเนินการผลิต', href: `/production/work-orders/${workOrderId}?tab=execution` },
          { label: 'การเฝ้าระวังสภาพแวดล้อม' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="กลับไปการดำเนินการผลิต"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push(`/production/work-orders/${workOrderId}?tab=execution`)}
            />
            <DxButton
              text="เพิ่มการบันทึกค่า"
              icon="plus"
              type="success"
              onClick={() => setShowAddDialog(true)}
            />
          </div>
        }
      />

      {/* BOM Environmental Requirements — remount on phase change to force fresh filter */}
      <BOMConfigReferencePanel
        key={currentPhase}
        workOrderId={workOrderId}
        phase={currentPhase}
        showOnly={['environmental']}
        defaultExpanded={true}
      />

      {/* Phase Tabs */}
      <Card>
        <CardContent className="p-0">
          <DxTabs
            items={tabItems}
            selectedIndex={activeTab}
            onSelectedIndexChange={(idx) => { tabManuallySet.current = true; setActiveTab(idx); }}
          />

          {/* Per-phase status banner (Active / Frozen / Pending / Missing mapping) */}
          <PhaseStatusBanner
            workOrderStatus={workOrder.status}
            phaseLabel={PHASE_LABELS[currentPhase]}
            info={currentPhaseInfo}
            activePhase={phaseStatus?.activePhase}
            bomId={phaseStatus?.bomId}
          />

          <div className="p-4">
            <DxDataGrid
              dataSource={logs || []}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={logsLoading}
              height={400}
              noDataText="ยังไม่มีการบันทึกค่าสภาพแวดล้อม กด 'เพิ่มการบันทึกค่า' เพื่อเริ่มต้น"
            >
              <DxPaging defaultPageSize={15} />

              <DxColumn dataField="roomName" caption="ห้อง" minWidth={120} cellRender={(cell) => {
                const name = cell.data.roomName || cell.data.roomCode;
                return name ? (
                  <span className="text-sm">{name}</span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                );
              }} />
              <DxColumn dataField="recordedDate" caption="วันที่" minWidth={110} width={110} />
              <DxColumn dataField="recordedTime" caption="เวลา" width={80} />
              <DxColumn dataField="temperature" caption="อุณหภูมิ (°C)" minWidth={100} cellRender={(cell) => (
                <span className={`font-medium ${
                  condition && (cell.value < condition.temperatureMin || cell.value > condition.temperatureMax)
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {cell.value}°C
                </span>
              )} />
              <DxColumn dataField="humidity" caption="ความชื้น (%)" minWidth={100} cellRender={(cell) => (
                <span className={`font-medium ${
                  condition && cell.value > condition.humidityMax
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {cell.value}%
                </span>
              )} />
              <DxColumn dataField="isNormal" caption="สถานะ" width={110} cellRender={(cell) => renderStatusBadge(cell.value)} />
              <DxColumn dataField="operatorName" caption="ผู้บันทึก" minWidth={110} />
              <DxColumn dataField="notes" caption="หมายเหตุ" minWidth={120} cellRender={(cell) => (
                cell.value ? (
                  <span
                    title={cell.value}
                    className="text-xs text-gray-600 block truncate"
                  >
                    {cell.value}
                  </span>
                ) : <span className="text-xs text-gray-400">-</span>
              )} />
              <DxColumn caption="" width={90} allowSorting={false} allowFiltering={false} cellRender={(cell) => (
                <div className="flex gap-0.5">
                  <DxButton icon="edit" stylingMode="text" hint="แก้ไข" onClick={() => handleOpenEdit(cell.data)} />
                  <DxButton icon="trash" stylingMode="text" hint="ลบ" onClick={() => {
                    if (confirm('ต้องการลบข้อมูลนี้หรือไม่?')) {
                      deleteLogMutation.mutate(cell.data.id);
                    }
                  }} />
                </div>
              )} />
            </DxDataGrid>
          </div>
        </CardContent>
      </Card>

      {/* Add Reading Dialog */}
      <DxPopup
        visible={showAddDialog}
        onHiding={() => { setShowAddDialog(false); setEditingLogId(null); }}
        title={editingLogId ? 'แก้ไขข้อมูลสภาวะแวดล้อม' : 'บันทึกค่าสภาพแวดล้อม'}
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>ขั้นตอน:</strong> {currentPhase === 'pre_production' ? 'ก่อนการผลิต' : currentPhase === 'production' ? 'การผลิต' : 'บรรจุภัณฑ์'}
            <br />
            <strong>เวลา:</strong> {new Date().toLocaleString()}
          </div>

          {/* Room Selector */}
          {bomRooms && bomRooms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ห้อง *
              </label>
              <DxSelectBox
                value={formData.roomId}
                onValueChange={(value) => setFormData({ ...formData, roomId: value || undefined })}
                dataSource={bomRooms.map((r: BOMRoom) => ({
                  id: r.room?.id || r.roomId,
                  display: `${r.room?.code || ''} - ${r.room?.name || ''}`,
                }))}
                valueExpr="id"
                displayExpr="display"
                placeholder="เลือกห้องที่บันทึก"
                searchEnabled
                showClearButton
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อุณหภูมิ (°C) *
              </label>
              <DxNumberBox
                value={formData.temperature}
                onValueChanged={(e) => setFormData({ ...formData, temperature: e.value })}
                min={-10}
                max={60}
                format="#0.0"
                showSpinButtons
              />
              {condition && (
                <p className="text-xs text-gray-500 mt-1">
                  ค่าที่กำหนด: {condition.temperatureMin}-{condition.temperatureMax}°C
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ความชื้น (% RH) *
              </label>
              <DxNumberBox
                value={formData.humidity}
                onValueChanged={(e) => setFormData({ ...formData, humidity: e.value })}
                min={0}
                max={100}
                format="#0"
                showSpinButtons
              />
              {condition && (
                <p className="text-xs text-gray-500 mt-1">
                  สูงสุด: ≤{condition.humidityMax}% RH
                </p>
              )}
            </div>
          </div>

          {/* Preview status */}
          <div className={`rounded-lg p-3 ${
            isWithinLimits(formData.temperature, formData.humidity)
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {isWithinLimits(formData.temperature, formData.humidity) ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">ค่าอยู่ในเกณฑ์ปกติ</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">ค่าอยู่นอกเกณฑ์ปกติ</span>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <DxTextArea
              value={formData.notes}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value })}
              placeholder="ข้อสังเกตหรือหมายเหตุเพิ่มเติม..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => { setShowAddDialog(false); setEditingLogId(null); }} />
            <DxButton
              text={editingLogId ? 'บันทึกการแก้ไข' : 'บันทึกค่า'}
              type="success"
              onClick={handleSave}
              disabled={addLogMutation.isPending || editLogMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

// ============================================
// PhaseStatusBanner — per-tab status indicator
// ============================================

function PhaseStatusBanner({
  workOrderStatus,
  phaseLabel,
  info,
  activePhase,
  bomId,
}: {
  workOrderStatus: string;
  phaseLabel: string;
  info?: PhaseInfo;
  activePhase?: 'pre_production' | 'production' | 'packaging' | null;
  bomId?: number | null;
}) {
  // Format a timestamp as "HH:mm" (local time)
  const fmtTime = (iso: string | null): string => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('th-TH', {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // WO still planned — reference notice
  if (workOrderStatus === 'planned') {
    return (
      <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">WO ยังไม่ได้ Release</p>
          <p className="text-amber-800 mt-0.5">
            ระบบยังไม่เริ่มบันทึกข้อมูลสภาพแวดล้อม — กด Release WO เพื่อให้ Pre-Production เริ่มบันทึกอัตโนมัติภายใน 10-20 วินาที
          </p>
        </div>
      </div>
    );
  }

  // WO completed — all phases frozen
  if (workOrderStatus === 'completed') {
    return (
      <div className="mx-4 mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-gray-800">WO เสร็จสมบูรณ์แล้ว</p>
          <p className="text-gray-600 mt-0.5">
            ข้อมูลสภาพแวดล้อมทุก phase ถูก frozen เพื่อเป็นบันทึกตามข้อกำหนด GMP — แก้ไขไม่ได้แล้ว
          </p>
        </div>
      </div>
    );
  }

  // No phase info yet (loading)
  if (!info) {
    return null;
  }

  // BOM is missing a room mapping for this phase — highest-priority warning.
  // Without a mapping, IoT can never route readings to this tab, so show
  // a clear call-to-action to fix BOM Rooms setup.
  if (!info.hasRoomMapping) {
    return (
      <div className="mx-4 mt-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm flex-1">
          <p className="font-semibold text-orange-900">
            BOM ไม่มี Room Mapping สำหรับ {phaseLabel}
          </p>
          <p className="text-orange-800 mt-0.5">
            IoT จะไม่ส่งข้อมูลเข้า tab นี้จนกว่าจะเพิ่มห้องที่ใช้งานใน phase {phaseLabel} ใน BOM
          </p>
          {bomId && (
            <div className="mt-2">
              <a
                href={`/production/bom/${bomId}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors"
              >
                ไปตั้ง BOM Rooms →
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Phase Active (currently being logged)
  if (info.status === 'active') {
    const hasData = !!info.startedAt;
    return (
      <div className={`mx-4 mt-3 rounded-lg border px-4 py-3 flex items-start gap-3 ${
        hasData
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex-shrink-0 mt-0.5">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              hasData ? 'bg-emerald-400' : 'bg-amber-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              hasData ? 'bg-emerald-600' : 'bg-amber-600'
            }`}></span>
          </span>
        </div>
        <div className="text-sm flex-1">
          {hasData ? (
            <>
              <p className="font-semibold text-emerald-900">
                {phaseLabel} Active — กำลังบันทึกข้อมูลจาก IoT
              </p>
              <p className="text-emerald-800 mt-0.5">
                เริ่มเมื่อ: {fmtTime(info.startedAt)}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-900">
                {phaseLabel} Active — เพิ่งเริ่ม รอข้อมูลครั้งแรกจาก IoT
              </p>
              <p className="text-amber-800 mt-0.5">
                ระบบพร้อมรับข้อมูลแล้ว
              </p>
              <p className="text-xs text-amber-700 mt-1">
                ℹ️ ถ้ารอนานเกินไป ตรวจสอบว่า BOM มี room mapping สำหรับ phase นี้หรือไม่
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Phase Completed (frozen — read-only history)
  if (info.status === 'completed') {
    return (
      <div className="mx-4 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm flex-1">
          <p className="font-semibold text-emerald-900">
            {phaseLabel} Frozen — ข้อมูลย้อนหลัง (Read-only)
          </p>
          <p className="text-emerald-800 mt-0.5">
            เริ่ม: {fmtTime(info.startedAt)} · สิ้นสุด: {fmtTime(info.completedAt)}
          </p>
        </div>
      </div>
    );
  }

  // Phase Pending (not yet active — waiting for previous phase to finish)
  return (
    <div className="mx-4 mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-start gap-3">
      <Clock className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm flex-1">
        <p className="font-semibold text-gray-800">
          {phaseLabel} Pending — ยังไม่เริ่ม
        </p>
        <p className="text-gray-600 mt-0.5">
          {activePhase
            ? `ตอนนี้กำลังอยู่ที่ phase ${PHASE_LABELS[activePhase]} — เมื่อ phase นี้เสร็จระบบจะย้ายมา ${phaseLabel} อัตโนมัติ`
            : 'รอ phase ก่อนหน้าเสร็จก่อน'}
        </p>
      </div>
    </div>
  );
}
