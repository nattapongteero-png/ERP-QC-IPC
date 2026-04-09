'use client';

/**
 * Work Order Environmental Monitoring Page
 * Records temperature and humidity readings during production/packaging
 * Form Sections: 7, 10.2
 */

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
}

interface BOMRoom {
  id: number;
  roomId: number;
  room?: { id: number; code: string; name: string };
  phase: string;
}

const PHASE_MAP = ['pre_production', 'production', 'packaging'] as const;

const tabItems: DxTabItem[] = [
  { id: 0, text: 'Pre-Production', icon: 'clock' },
  { id: 1, text: 'Production', icon: 'product' },
  { id: 2, text: 'Packaging', icon: 'box' },
];

export default function EnvironmentalMonitoringPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('execution.environmentalMonitoring');
  const workOrderId = Number(params.id);

  const phaseParam = searchParams.get('phase');
  const initialPhase = phaseParam === 'packaging' ? 2 : phaseParam === 'production' ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialPhase);
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

  // Fetch environmental logs
  const { data: logs, isLoading: logsLoading } = useQuery<EnvironmentalLog[]>({
    queryKey: ['wo-environmental-logs', workOrderId, currentPhase],
    queryFn: async () => {
      const res = await fetch(`/api/environmental-logs?workOrderId=${workOrderId}&phase=${currentPhase}`);
      const data = await res.json();
      if (!data.success) return [];
      return data.data;
    },
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
      toast.success('Log Added', 'Environmental reading has been recorded.');
      setShowAddDialog(false);
      setFormData({ roomId: undefined, temperature: 25, humidity: 50, notes: '' });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
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
    onError: (error: Error) => toast.error('Error', error.message),
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
        Normal
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertCircle className="h-3 w-3" />
        Abnormal
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
        title="Environmental Monitoring"
        subtitle={`${workOrder.woNumber} | Batch: ${workOrder.batchNumber}`}
        icon={Thermometer}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'Work Orders', href: '/production/work-orders' },
          { label: workOrder.woNumber, href: `/production/work-orders/${workOrderId}` },
          { label: 'Execution', href: `/production/work-orders/${workOrderId}/execution` },
          { label: 'Environmental Monitoring' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="Back to Execution"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push(`/production/work-orders/${workOrderId}/execution`)}
            />
            <DxButton
              text="Add Reading"
              icon="plus"
              type="success"
              onClick={() => setShowAddDialog(true)}
            />
          </div>
        }
      />

      {/* BOM Environmental Requirements */}
      <BOMConfigReferencePanel
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
            onSelectedIndexChange={(idx) => setActiveTab(idx)}
          />

          <div className="p-4">
            <DxDataGrid
              dataSource={logs || []}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={logsLoading}
              height={400}
              noDataText="No environmental readings recorded. Click 'Add Reading' to start."
            >
              <DxPaging defaultPageSize={15} />

              <DxColumn dataField="roomName" caption="Room" width={140} cellRender={(cell) => {
                const name = cell.data.roomName || cell.data.roomCode;
                return name ? (
                  <span className="text-sm">{name}</span>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                );
              }} />
              <DxColumn dataField="recordedDate" caption="Date" width={120} />
              <DxColumn dataField="recordedTime" caption="Time" width={100} />
              <DxColumn dataField="temperature" caption="Temperature (°C)" width={140} cellRender={(cell) => (
                <span className={`font-medium ${
                  condition && (cell.value < condition.temperatureMin || cell.value > condition.temperatureMax)
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {cell.value}°C
                </span>
              )} />
              <DxColumn dataField="humidity" caption="Humidity (% RH)" width={140} cellRender={(cell) => (
                <span className={`font-medium ${
                  condition && cell.value > condition.humidityMax
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {cell.value}% RH
                </span>
              )} />
              <DxColumn dataField="isNormal" caption="Status" width={120} cellRender={(cell) => renderStatusBadge(cell.value)} />
              <DxColumn dataField="operatorName" caption="Recorded By" width={130} />
              <DxColumn dataField="notes" caption="Notes" />
              <DxColumn caption="" width={90} cellRender={(cell) => (
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
        title={editingLogId ? 'แก้ไขข้อมูลสภาวะแวดล้อม' : 'Record Environmental Reading'}
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>Phase:</strong> {currentPhase === 'pre_production' ? 'Pre-Production' : currentPhase === 'production' ? 'Production' : 'Packaging'}
            <br />
            <strong>Time:</strong> {new Date().toLocaleString()}
          </div>

          {/* Room Selector */}
          {bomRooms && bomRooms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ห้อง (Room) *
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
                Temperature (°C) *
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
                  Limit: {condition.temperatureMin}-{condition.temperatureMax}°C
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Humidity (% RH) *
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
                  Max: ≤{condition.humidityMax}% RH
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
                  <span className="text-green-800 font-medium">Reading within normal limits</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">Reading outside normal limits</span>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextArea
              value={formData.notes}
              onValueChanged={(e) => setFormData({ ...formData, notes: e.value })}
              placeholder="Any observations or remarks..."
              height={80}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => { setShowAddDialog(false); setEditingLogId(null); }} />
            <DxButton
              text={editingLogId ? 'บันทึกการแก้ไข' : 'Save Reading'}
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
