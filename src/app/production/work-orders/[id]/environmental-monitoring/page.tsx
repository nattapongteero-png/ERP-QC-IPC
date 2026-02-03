'use client';

/**
 * Work Order Environmental Monitoring Page
 * Records temperature and humidity readings during production/packaging
 * Form Sections: 7, 10.2
 */

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import {
  Thermometer,
  Droplets,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface EnvironmentalLog {
  id: number;
  workOrderId: number;
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
}

const tabItems: DxTabItem[] = [
  { id: 0, text: 'Production', icon: 'product' },
  { id: 1, text: 'Packaging', icon: 'box' },
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

  const initialPhase = searchParams.get('phase') === 'packaging' ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialPhase);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    temperature: 25,
    humidity: 50,
    notes: '',
  });

  const currentPhase = activeTab === 0 ? 'production' : 'packaging';

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
      const res = await fetch(`/api/production/work-orders/${workOrderId}/environmental-logs?phase=${currentPhase}`);
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

  // Add log mutation
  const addLogMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const now = new Date();
      const res = await fetch(`/api/production/work-orders/${workOrderId}/environmental-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: currentPhase,
          recordedDate: now.toISOString().split('T')[0],
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
      setFormData({ temperature: 25, humidity: 50, notes: '' });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleAdd = () => {
    addLogMutation.mutate(formData);
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

      {/* Condition Limits Card */}
      {condition && (
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-teal-600" />
                <span className="text-teal-800">
                  Temperature: <strong>{condition.temperatureMin}-{condition.temperatureMax}°C</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-teal-600" />
                <span className="text-teal-800">
                  Humidity: <strong>≤{condition.humidityMax}% RH</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-600" />
                <span className="text-teal-800">
                  Interval: <strong>Every {condition.monitoringIntervalMinutes} min</strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!condition && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-amber-800">
              No environmental condition profile configured for this phase in the BOM.
              Readings will still be recorded but limits won&apos;t be enforced.
            </p>
          </CardContent>
        </Card>
      )}

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
              <DxColumn dataField="operatorName" caption="Recorded By" width={150} />
              <DxColumn dataField="notes" caption="Notes" />
            </DxDataGrid>
          </div>
        </CardContent>
      </Card>

      {/* Add Reading Dialog */}
      <DxPopup
        visible={showAddDialog}
        onHiding={() => setShowAddDialog(false)}
        title="Record Environmental Reading"
        width={450}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <strong>Phase:</strong> {currentPhase === 'production' ? 'Production' : 'Packaging'}
            <br />
            <strong>Time:</strong> {new Date().toLocaleString()}
          </div>

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
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowAddDialog(false)} />
            <DxButton
              text="Save Reading"
              type="success"
              onClick={handleAdd}
              disabled={addLogMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
