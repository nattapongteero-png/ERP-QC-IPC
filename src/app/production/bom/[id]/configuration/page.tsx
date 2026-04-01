'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSwitch } from '@/components/ui/dx-switch';
import { SwitchTypes } from 'devextreme-react/switch';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, FlaskConical, Plus, Trash2 } from 'lucide-react';

interface BOMIPCConfig {
  id: number;
  criteriaId: number;
  sequence: number;
  sampleSize: number;
  isCritical: boolean;
  criteriaCode: string;
  criteriaName: string;
  criteriaNameTh: string | null;
  testMethod: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
}

interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  specification: string | null;
  sampleSize: number;
  isCritical: boolean;
}

export default function BOMConfigurationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bomId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<number | null>(null);
  const [addSampleSize, setAddSampleSize] = useState(5);
  const [addIsCritical, setAddIsCritical] = useState(false);

  const { data: bom } = useQuery<{ id: number; code: string; name: string }>({
    queryKey: ['bom', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/bom/${bomId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const { data: ipcConfigs = [], isLoading } = useQuery<BOMIPCConfig[]>({
    queryKey: ['bom-ipc', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const { data: allCriteria = [] } = useQuery<IPCCriteria[]>({
    queryKey: ['ipc-criteria-active'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const availableCriteria = allCriteria.filter(
    (c) => !ipcConfigs.some((cfg) => cfg.criteriaId === c.id)
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCriteriaId) throw new Error('Select a criteria');
      const res = await fetch(`/api/production/bom/${bomId}/ipc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId: selectedCriteriaId, sampleSize: addSampleSize, isCritical: addIsCritical }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      setShowAddForm(false);
      setSelectedCriteriaId(null);
      setAddSampleSize(5);
      setAddIsCritical(false);
      toast.success('Added', 'IPC criteria added to BOM.');
    },
    onError: (err: Error) => toast.error('Error', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (bomIpcId: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc?bomIpcId=${bomIpcId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      toast.success('Removed', 'IPC criteria removed from BOM.');
    },
    onError: (err: Error) => toast.error('Error', err.message),
  });

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-5xl mx-auto">
        <ResponsivePageHeader
          title="BOM Configuration"
          subtitle={bom ? `${bom.code} - ${bom.name}` : 'Loading...'}
          icon={Settings}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          onBack={() => router.push(`/production/bom/${bomId}`)}
          breadcrumbs={[
            { label: 'Production', href: '/production/bom' },
            { label: 'BOM', href: `/production/bom/${bomId}` },
            { label: 'Configuration' },
          ]}
        />

        {/* IPC Criteria Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-emerald-600" />
                In-Process Control (IPC) Criteria ({ipcConfigs.length})
              </CardTitle>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add IPC Criteria
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <div className="text-center py-8 text-gray-400">Loading...</div>}

            {!isLoading && ipcConfigs.length === 0 && !showAddForm && (
              <div className="text-center py-8">
                <FlaskConical className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No IPC criteria configured for this BOM.</p>
                <p className="text-xs text-gray-400 mt-1">Add criteria from Master Data to enable in-process quality control.</p>
              </div>
            )}

            {ipcConfigs.map((cfg, idx) => (
              <div key={cfg.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-emerald-200 transition-colors group">
                <div className="flex-none w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-emerald-600">{cfg.criteriaCode}</span>
                    <span className="font-medium text-gray-900">{cfg.criteriaNameTh || cfg.criteriaName}</span>
                    {cfg.isCritical && <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Critical</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {cfg.specification && <span>{cfg.specification} | </span>}
                    {cfg.minValue != null && cfg.maxValue != null && <span>Range: {cfg.minValue}-{cfg.maxValue} {cfg.unit} | </span>}
                    Samples: {cfg.sampleSize}
                    {cfg.testMethod && <span> | Method: {cfg.testMethod}</span>}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Remove this IPC criteria?')) deleteMutation.mutate(cfg.id); }}
                  disabled={deleteMutation.isPending}
                  className="flex-none p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {showAddForm && (
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IPC Criteria *</label>
                  <DxSelectBox
                    dataSource={availableCriteria.map((c) => ({
                      id: c.id,
                      display: `${c.code} - ${c.nameTh || c.name}${c.specification ? ` (${c.specification})` : ''}`,
                    }))}
                    displayExpr="display"
                    valueExpr="id"
                    value={selectedCriteriaId}
                    onValueChanged={(e) => {
                      setSelectedCriteriaId(e.value);
                      const sel = allCriteria.find((c) => c.id === e.value);
                      if (sel) { setAddSampleSize(sel.sampleSize); setAddIsCritical(sel.isCritical); }
                    }}
                    placeholder="Select IPC criteria from Master Data"
                    searchEnabled
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sample Size</label>
                    <DxNumberBox value={addSampleSize} onValueChanged={(e) => setAddSampleSize(e.value)} min={1} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <DxSwitch value={addIsCritical} onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setAddIsCritical(e.value)} />
                    <span className="text-sm text-gray-700">Critical Test</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <DxButton text="Cancel" stylingMode="text" onClick={() => setShowAddForm(false)} />
                  <DxButton text={addMutation.isPending ? 'Adding...' : 'Add to BOM'} type="success" onClick={() => addMutation.mutate()} disabled={!selectedCriteriaId || addMutation.isPending} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
