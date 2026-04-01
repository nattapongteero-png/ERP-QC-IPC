'use client';

/**
 * BOM Configuration Page
 * Configures rooms, equipment, environmental conditions, SOP steps,
 * and packaging QC criteria for a specific BOM.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxDataGrid, DxColumn, DxPaging } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSwitch } from '@/components/ui/dx-switch';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { SwitchTypes } from 'devextreme-react/switch';
import {
  Settings,
  Building2,
  Wrench,
  Thermometer,
  FileText,
  Scale,
  FlaskConical,
  ArrowLeft,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';

// IPC Configuration Section Component
function IPCConfigSection({ bomId }: { bomId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selCriteria, setSelCriteria] = useState<number | null>(null);
  const [sampleSize, setSampleSize] = useState(5);
  const [isCritical, setIsCritical] = useState(false);

  const { data: configs = [], isLoading } = useQuery<any[]>({
    queryKey: ['bom-ipc', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc`);
      const d = await res.json();
      return d.success ? d.data : [];
    },
  });

  const { data: allCriteria = [] } = useQuery<any[]>({
    queryKey: ['ipc-criteria-active'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const d = await res.json();
      return d.success ? d.data : [];
    },
  });

  const available = allCriteria.filter((c: any) => !configs.some((cfg: any) => cfg.criteriaId === c.id));

  const addMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId: selCriteria, sampleSize, isCritical }),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      setShowAdd(false); setSelCriteria(null); setSampleSize(5); setIsCritical(false);
      toast.success('Added', 'IPC criteria added.');
    },
    onError: (e: Error) => toast.error('Error', e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc?bomIpcId=${id}`, { method: 'DELETE' });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      toast.success('Removed', 'IPC criteria removed.');
    },
    onError: (e: Error) => toast.error('Error', e.message),
  });

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-medium">In-Process Control (IPC) Criteria</h3>
          </div>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200">
              <Plus className="h-4 w-4" /> Add IPC Criteria
            </button>
          )}
        </div>

        {isLoading && <div className="text-center py-6 text-gray-400">Loading...</div>}

        {!isLoading && configs.length === 0 && !showAdd && (
          <div className="text-center py-6 text-gray-500 text-sm">No IPC criteria configured.</div>
        )}

        <div className="space-y-2">
          {configs.map((cfg: any, idx: number) => (
            <div key={cfg.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white group">
              <span className="flex-none w-7 h-7 rounded bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-emerald-600">{cfg.criteriaCode}</span>
                  <span className="font-medium">{cfg.criteriaNameTh || cfg.criteriaName}</span>
                  {cfg.isCritical && <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Critical</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {cfg.specification && <span>{cfg.specification} | </span>}
                  {cfg.minValue != null && <span>Range: {cfg.minValue}-{cfg.maxValue} {cfg.unit} | </span>}
                  Samples: {cfg.sampleSize}
                </div>
              </div>
              <button onClick={() => { if (confirm('Remove?')) delMut.mutate(cfg.id); }} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {showAdd && (
          <div className="mt-3 border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IPC Criteria *</label>
              <DxSelectBox
                dataSource={available.map((c: any) => ({ id: c.id, display: `${c.code} - ${c.nameTh || c.name}` }))}
                displayExpr="display" valueExpr="id" value={selCriteria}
                onValueChanged={(e) => {
                  setSelCriteria(e.value);
                  const s = allCriteria.find((c: any) => c.id === e.value);
                  if (s) { setSampleSize(s.sampleSize); setIsCritical(s.isCritical); }
                }}
                placeholder="Select criteria" searchEnabled
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sample Size</label>
                <DxNumberBox value={sampleSize} onValueChanged={(e) => setSampleSize(e.value)} min={1} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <DxSwitch value={isCritical} onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIsCritical(e.value)} />
                <span className="text-sm">Critical</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DxButton text="Cancel" stylingMode="text" onClick={() => setShowAdd(false)} />
              <DxButton text="Add to BOM" type="success" onClick={() => addMut.mutate()} disabled={!selCriteria || addMut.isPending} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Types
interface BOMBasic {
  id: number;
  code: string;
  name: string;
  status: string;
}

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  roomType: string;
  isActive: boolean;
}

interface ProductionEquipment {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  capacity?: string;
  isActive: boolean;
}

interface EnvironmentalCondition {
  id: number;
  code: string;
  name: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMax: number;
  monitoringIntervalMinutes: number;
  isActive: boolean;
}

interface SOPTemplate {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  category: string;
  isActive: boolean;
}

interface PackagingQCCriteria {
  id: number;
  code: string;
  name: string;
  weightMin: number;
  weightMax: number;
  sampleSize: number;
  maxFailures: number;
  isActive: boolean;
}

interface BOMRoom {
  id: number;
  bomId: number;
  roomId: number;
  phase: string;
  sequence: number;
  isRequired: boolean;
  room?: ProductionRoom;
}

interface BOMEquipment {
  id: number;
  bomId: number;
  equipmentId: number;
  phase: string;
  sequence: number;
  isRequired: boolean;
  equipment?: ProductionEquipment;
}

interface BOMEnvironmentalCondition {
  id: number;
  bomId: number;
  conditionId: number;
  phase: string;
  condition?: EnvironmentalCondition;
}

interface BOMSOPStep {
  id: number;
  bomId: number;
  templateId?: number;
  sequence: number;
  stepName: string;
  stepNameTh?: string;
  instructions?: string;
  instructionsTh?: string;
  parameters?: string;
  equipmentIds?: string;
  requiresVerification: boolean;
}

interface BOMPackagingQC {
  id: number;
  bomId: number;
  criteriaId: number;
  criteria?: PackagingQCCriteria;
}

const phases = [
  { value: 'pre_production', label: 'Pre-Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post-Production' },
  { value: 'pre_packaging', label: 'Pre-Packaging' },
  { value: 'packaging', label: 'Packaging' },
];

const tabItems: DxTabItem[] = [
  { id: 0, text: 'Rooms', icon: 'home' },
  { id: 1, text: 'Equipment', icon: 'toolbox' },
  { id: 2, text: 'Environmental', icon: 'globe' },
  { id: 3, text: 'SOP Steps', icon: 'textdocument' },
  { id: 4, text: 'Packaging QC', icon: 'box' },
  { id: 5, text: 'IPC', icon: 'checklist' },
];

export default function BOMConfigurationPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('bomConfiguration.title');
  const bomId = Number(params.id);

  const [activeTab, setActiveTab] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'room' | 'equipment' | 'condition' | 'sop' | 'qc'>('room');
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  // Fetch BOM basic info
  const { data: bom, isLoading: bomLoading } = useQuery<BOMBasic>({
    queryKey: ['bom', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/bom/${bomId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM Rooms
  const { data: bomRooms, isLoading: roomsLoading } = useQuery<BOMRoom[]>({
    queryKey: ['bom-rooms', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/rooms`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM Equipment
  const { data: bomEquipment, isLoading: equipmentLoading } = useQuery<BOMEquipment[]>({
    queryKey: ['bom-equipment', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/equipment`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM Environmental Conditions
  const { data: bomConditions, isLoading: conditionsLoading } = useQuery<BOMEnvironmentalCondition[]>({
    queryKey: ['bom-environmental-conditions', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/environmental-conditions`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM SOP Steps
  const { data: bomSOPSteps, isLoading: sopLoading } = useQuery<BOMSOPStep[]>({
    queryKey: ['bom-sop-steps', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/sop-steps`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch BOM Packaging QC
  const { data: bomPackagingQC, isLoading: qcLoading } = useQuery<BOMPackagingQC[]>({
    queryKey: ['bom-packaging-qc', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/packaging-qc`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Fetch Master Data for dropdowns
  const { data: rooms } = useQuery<ProductionRoom[]>({
    queryKey: ['production-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms');
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  const { data: equipment } = useQuery<ProductionEquipment[]>({
    queryKey: ['production-equipment'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-equipment');
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  const { data: conditions } = useQuery<EnvironmentalCondition[]>({
    queryKey: ['environmental-conditions'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/environmental-conditions');
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  const { data: sopTemplates } = useQuery<SOPTemplate[]>({
    queryKey: ['sop-templates'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/sop-templates');
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  const { data: qcCriteria } = useQuery<PackagingQCCriteria[]>({
    queryKey: ['packaging-qc-criteria'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/packaging-qc-criteria');
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  // Add Room form state
  const [roomForm, setRoomForm] = useState({
    roomId: 0,
    phase: 'production' as string,
    sequence: 1,
    isRequired: true,
  });

  // Add Equipment form state
  const [equipmentForm, setEquipmentForm] = useState({
    equipmentId: 0,
    phase: 'production' as string,
    sequence: 1,
    isRequired: true,
  });

  // Add Condition form state
  const [conditionForm, setConditionForm] = useState({
    conditionId: 0,
    phase: 'production' as string,
  });

  // Add SOP Step form state
  const [sopForm, setSOPForm] = useState({
    templateId: 0,
    stepName: '',
    stepNameTh: '',
    instructions: '',
    instructionsTh: '',
    parameters: '',
    requiresVerification: true,
  });

  // Add Packaging QC form state
  const [qcForm, setQCForm] = useState({
    criteriaId: 0,
  });

  // Delete mutations
  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/rooms?roomId=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-rooms', bomId] });
      toast.success('Room Removed', 'Room requirement has been removed.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/equipment?equipmentId=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-equipment', bomId] });
      toast.success('Equipment Removed', 'Equipment requirement has been removed.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const deleteConditionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/environmental-conditions?conditionId=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-environmental-conditions', bomId] });
      toast.success('Condition Removed', 'Environmental condition has been removed.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const deleteSOPMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/sop-steps?stepId=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-steps', bomId] });
      toast.success('SOP Step Removed', 'SOP step has been removed.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const deleteQCMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/packaging-qc?qcId=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-packaging-qc', bomId] });
      toast.success('QC Criteria Removed', 'Packaging QC criteria has been removed.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Add mutations
  const addRoomMutation = useMutation({
    mutationFn: async (data: typeof roomForm) => {
      const res = await fetch(`/api/production/bom/${bomId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-rooms', bomId] });
      toast.success('Room Added', 'Room requirement has been added.');
      setShowAddDialog(false);
      setRoomForm({ roomId: 0, phase: 'production', sequence: 1, isRequired: true });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async (data: typeof equipmentForm) => {
      const res = await fetch(`/api/production/bom/${bomId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-equipment', bomId] });
      toast.success('Equipment Added', 'Equipment requirement has been added.');
      setShowAddDialog(false);
      setEquipmentForm({ equipmentId: 0, phase: 'production', sequence: 1, isRequired: true });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const addConditionMutation = useMutation({
    mutationFn: async (data: typeof conditionForm) => {
      const res = await fetch(`/api/production/bom/${bomId}/environmental-conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-environmental-conditions', bomId] });
      toast.success('Condition Added', 'Environmental condition has been added.');
      setShowAddDialog(false);
      setConditionForm({ conditionId: 0, phase: 'production' });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const addSOPMutation = useMutation({
    mutationFn: async (data: typeof sopForm) => {
      const res = await fetch(`/api/production/bom/${bomId}/sop-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          templateId: data.templateId || null,
          sequence: (bomSOPSteps?.length || 0) + 1,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-steps', bomId] });
      toast.success('SOP Step Added', 'SOP step has been added.');
      setShowAddDialog(false);
      setSOPForm({ templateId: 0, stepName: '', stepNameTh: '', instructions: '', instructionsTh: '', parameters: '', requiresVerification: true });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const addQCMutation = useMutation({
    mutationFn: async (data: typeof qcForm) => {
      const res = await fetch(`/api/production/bom/${bomId}/packaging-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-packaging-qc', bomId] });
      toast.success('QC Criteria Added', 'Packaging QC criteria has been added.');
      setShowAddDialog(false);
      setQCForm({ criteriaId: 0 });
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  // Copy configuration mutation
  const copyConfigMutation = useMutation({
    mutationFn: async (sourceBomId: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/copy-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceBomId }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-rooms', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-equipment', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-environmental-conditions', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-sop-steps', bomId] });
      queryClient.invalidateQueries({ queryKey: ['bom-packaging-qc', bomId] });
      toast.success('Configuration Copied', 'BOM configuration has been copied successfully.');
      setShowCopyDialog(false);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const openAddDialog = (type: typeof dialogType) => {
    setDialogType(type);
    setShowAddDialog(true);
  };

  const handleAdd = () => {
    switch (dialogType) {
      case 'room':
        if (!roomForm.roomId) {
          toast.error('Validation Error', 'Please select a room.');
          return;
        }
        addRoomMutation.mutate(roomForm);
        break;
      case 'equipment':
        if (!equipmentForm.equipmentId) {
          toast.error('Validation Error', 'Please select equipment.');
          return;
        }
        addEquipmentMutation.mutate(equipmentForm);
        break;
      case 'condition':
        if (!conditionForm.conditionId) {
          toast.error('Validation Error', 'Please select a condition profile.');
          return;
        }
        addConditionMutation.mutate(conditionForm);
        break;
      case 'sop':
        if (!sopForm.stepName) {
          toast.error('Validation Error', 'Please enter a step name.');
          return;
        }
        addSOPMutation.mutate(sopForm);
        break;
      case 'qc':
        if (!qcForm.criteriaId) {
          toast.error('Validation Error', 'Please select QC criteria.');
          return;
        }
        addQCMutation.mutate(qcForm);
        break;
    }
  };

  const getPhaseLabel = (phase: string) => {
    return phases.find(p => p.value === phase)?.label || phase;
  };

  const renderPhaseBadge = (phase: string) => {
    const colors: Record<string, string> = {
      pre_production: 'bg-amber-100 text-amber-800',
      production: 'bg-blue-100 text-blue-800',
      post_production: 'bg-green-100 text-green-800',
      pre_packaging: 'bg-purple-100 text-purple-800',
      packaging: 'bg-indigo-100 text-indigo-800',
    };
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${colors[phase] || 'bg-gray-100 text-gray-800'}`}>
        {getPhaseLabel(phase)}
      </span>
    );
  };

  if (bomLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!bom) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">BOM not found</p>
        <DxButton
          text="Back to BOM List"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/bom')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title={`Configuration: ${bom.code}`}
        subtitle={`Configure GMP requirements for ${bom.name}`}
        icon={Settings}
        iconBgColor="bg-gray-100"
        iconColor="text-gray-600"
        breadcrumbs={[
          { label: 'Production', href: '/production' },
          { label: 'BOM', href: '/production/bom' },
          { label: bom.code, href: `/production/bom/${bomId}` },
          { label: 'Configuration' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="Back to BOM"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push(`/production/bom/${bomId}`)}
            />
            <DxButton
              text="Copy Config"
              icon="copy"
              type="normal"
              onClick={() => setShowCopyDialog(true)}
            />
          </div>
        }
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
            {/* Rooms Tab */}
            {activeTab === 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-medium">Required Rooms</h3>
                  </div>
                  <DxButton
                    text="Add Room"
                    icon="plus"
                    type="success"
                    onClick={() => openAddDialog('room')}
                  />
                </div>
                <DxDataGrid
                  dataSource={bomRooms || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={roomsLoading}
                  height={400}
                  noDataText="No rooms configured. Click 'Add Room' to add requirements."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="sequence" caption="#" width={60} />
                  <DxColumn dataField="room.code" caption="Room Code" width={120} />
                  <DxColumn dataField="room.name" caption="Room Name" />
                  <DxColumn dataField="phase" caption="Phase" width={150} cellRender={(cell) => renderPhaseBadge(cell.value)} />
                  <DxColumn dataField="isRequired" caption="Required" width={100} cellRender={(cell) => (
                    <span className={`px-2 py-0.5 rounded text-xs ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cell.value ? 'Yes' : 'Optional'}
                    </span>
                  )} />
                  <DxColumn caption="Actions" width={80} cellRender={(cell) => (
                    <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteRoomMutation.mutate(cell.data.id)} />
                  )} />
                </DxDataGrid>
              </div>
            )}

            {/* Equipment Tab */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-medium">Required Equipment</h3>
                  </div>
                  <DxButton
                    text="Add Equipment"
                    icon="plus"
                    type="success"
                    onClick={() => openAddDialog('equipment')}
                  />
                </div>
                <DxDataGrid
                  dataSource={bomEquipment || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={equipmentLoading}
                  height={400}
                  noDataText="No equipment configured. Click 'Add Equipment' to add requirements."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="sequence" caption="#" width={60} />
                  <DxColumn dataField="equipment.code" caption="Equipment Code" width={120} />
                  <DxColumn dataField="equipment.name" caption="Equipment Name" />
                  <DxColumn dataField="equipment.capacity" caption="Capacity" width={120} />
                  <DxColumn dataField="phase" caption="Phase" width={150} cellRender={(cell) => renderPhaseBadge(cell.value)} />
                  <DxColumn dataField="isRequired" caption="Required" width={100} cellRender={(cell) => (
                    <span className={`px-2 py-0.5 rounded text-xs ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cell.value ? 'Yes' : 'Optional'}
                    </span>
                  )} />
                  <DxColumn caption="Actions" width={80} cellRender={(cell) => (
                    <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteEquipmentMutation.mutate(cell.data.id)} />
                  )} />
                </DxDataGrid>
              </div>
            )}

            {/* Environmental Conditions Tab */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-teal-600" />
                    <h3 className="text-lg font-medium">Environmental Conditions</h3>
                  </div>
                  <DxButton
                    text="Add Condition"
                    icon="plus"
                    type="success"
                    onClick={() => openAddDialog('condition')}
                  />
                </div>
                <DxDataGrid
                  dataSource={bomConditions || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={conditionsLoading}
                  height={400}
                  noDataText="No environmental conditions configured. Click 'Add Condition' to add requirements."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="condition.code" caption="Profile Code" width={120} />
                  <DxColumn dataField="condition.name" caption="Profile Name" />
                  <DxColumn caption="Temperature Range" width={150} cellRender={(cell) => (
                    <span className="text-blue-700">
                      {cell.data.condition?.temperatureMin}-{cell.data.condition?.temperatureMax}°C
                    </span>
                  )} />
                  <DxColumn caption="Max Humidity" width={120} cellRender={(cell) => (
                    <span className="text-teal-700">≤{cell.data.condition?.humidityMax}% RH</span>
                  )} />
                  <DxColumn dataField="phase" caption="Phase" width={150} cellRender={(cell) => renderPhaseBadge(cell.value)} />
                  <DxColumn caption="Actions" width={80} cellRender={(cell) => (
                    <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteConditionMutation.mutate(cell.data.id)} />
                  )} />
                </DxDataGrid>
              </div>
            )}

            {/* SOP Steps Tab */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                    <h3 className="text-lg font-medium">SOP Production Steps</h3>
                  </div>
                  <DxButton
                    text="Add Step"
                    icon="plus"
                    type="success"
                    onClick={() => openAddDialog('sop')}
                  />
                </div>
                <DxDataGrid
                  dataSource={bomSOPSteps || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={sopLoading}
                  height={400}
                  noDataText="No SOP steps configured. Click 'Add Step' to add production steps."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="sequence" caption="Step" width={70} />
                  <DxColumn dataField="stepName" caption="Step Name (EN)" />
                  <DxColumn dataField="stepNameTh" caption="Step Name (TH)" />
                  <DxColumn dataField="requiresVerification" caption="Verification" width={120} cellRender={(cell) => (
                    <span className={`px-2 py-0.5 rounded text-xs ${cell.value ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cell.value ? 'Required' : 'Not Required'}
                    </span>
                  )} />
                  <DxColumn dataField="parameters" caption="Parameters" width={200} cellRender={(cell) => {
                    if (!cell.value) return '-';
                    try {
                      const params = JSON.parse(cell.value);
                      return Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ');
                    } catch {
                      return cell.value;
                    }
                  }} />
                  <DxColumn caption="Actions" width={80} cellRender={(cell) => (
                    <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteSOPMutation.mutate(cell.data.id)} />
                  )} />
                </DxDataGrid>
              </div>
            )}

            {/* Packaging QC Tab */}
            {activeTab === 4 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-lg font-medium">Packaging QC Criteria</h3>
                  </div>
                  <DxButton
                    text="Add Criteria"
                    icon="plus"
                    type="success"
                    onClick={() => openAddDialog('qc')}
                  />
                </div>
                <DxDataGrid
                  dataSource={bomPackagingQC || []}
                  keyExpr="id"
                  showBorders={false}
                  rowAlternationEnabled
                  loading={qcLoading}
                  height={400}
                  noDataText="No packaging QC criteria configured. Click 'Add Criteria' to add requirements."
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="criteria.code" caption="Criteria Code" width={120} />
                  <DxColumn dataField="criteria.name" caption="Criteria Name" />
                  <DxColumn caption="Weight Range" width={150} cellRender={(cell) => (
                    <span className="text-blue-700">{cell.data.criteria?.weightMin}-{cell.data.criteria?.weightMax}g</span>
                  )} />
                  <DxColumn caption="Sample Criteria" width={150} cellRender={(cell) => (
                    <span className="text-gray-600">≤{cell.data.criteria?.maxFailures}/{cell.data.criteria?.sampleSize} fail</span>
                  )} />
                  <DxColumn caption="Actions" width={80} cellRender={(cell) => (
                    <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteQCMutation.mutate(cell.data.id)} />
                  )} />
                </DxDataGrid>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab 5: IPC Criteria */}
      {activeTab === 5 && (
        <IPCConfigSection bomId={bomId} />
      )}

      {/* Add Dialog */}
      <DxPopup
        visible={showAddDialog}
        onHiding={() => setShowAddDialog(false)}
        title={
          dialogType === 'room' ? 'Add Room Requirement' :
          dialogType === 'equipment' ? 'Add Equipment Requirement' :
          dialogType === 'condition' ? 'Add Environmental Condition' :
          dialogType === 'sop' ? 'Add SOP Step' :
          'Add Packaging QC Criteria'
        }
        width={dialogType === 'sop' ? 650 : 500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          {/* Room Form */}
          {dialogType === 'room' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room *</label>
                <DxSelectBox
                  dataSource={(rooms || []).filter(r => r.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={roomForm.roomId}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, roomId: e.value })}
                  placeholder="Select room"
                  searchEnabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase *</label>
                <DxSelectBox
                  dataSource={phases}
                  displayExpr="label"
                  valueExpr="value"
                  value={roomForm.phase}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, phase: e.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sequence</label>
                <DxNumberBox
                  value={roomForm.sequence}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, sequence: e.value })}
                  min={1}
                  showSpinButtons
                />
              </div>
              <div className="flex items-center gap-2">
                <DxSwitch
                  value={roomForm.isRequired}
                  onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setRoomForm({ ...roomForm, isRequired: e.value ?? true })}
                />
                <span className="text-sm text-gray-700">Required for production</span>
              </div>
            </>
          )}

          {/* Equipment Form */}
          {dialogType === 'equipment' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment *</label>
                <DxSelectBox
                  dataSource={(equipment || []).filter(e => e.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={equipmentForm.equipmentId}
                  onValueChanged={(e) => setEquipmentForm({ ...equipmentForm, equipmentId: e.value })}
                  placeholder="Select equipment"
                  searchEnabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase *</label>
                <DxSelectBox
                  dataSource={phases}
                  displayExpr="label"
                  valueExpr="value"
                  value={equipmentForm.phase}
                  onValueChanged={(e) => setEquipmentForm({ ...equipmentForm, phase: e.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sequence</label>
                <DxNumberBox
                  value={equipmentForm.sequence}
                  onValueChanged={(e) => setEquipmentForm({ ...equipmentForm, sequence: e.value })}
                  min={1}
                  showSpinButtons
                />
              </div>
              <div className="flex items-center gap-2">
                <DxSwitch
                  value={equipmentForm.isRequired}
                  onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setEquipmentForm({ ...equipmentForm, isRequired: e.value ?? true })}
                />
                <span className="text-sm text-gray-700">Required for production</span>
              </div>
            </>
          )}

          {/* Condition Form */}
          {dialogType === 'condition' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition Profile *</label>
                <DxSelectBox
                  dataSource={(conditions || []).filter(c => c.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={conditionForm.conditionId}
                  onValueChanged={(e) => setConditionForm({ ...conditionForm, conditionId: e.value })}
                  placeholder="Select condition profile"
                  searchEnabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase *</label>
                <DxSelectBox
                  dataSource={phases.filter(p => ['production', 'packaging'].includes(p.value))}
                  displayExpr="label"
                  valueExpr="value"
                  value={conditionForm.phase}
                  onValueChanged={(e) => setConditionForm({ ...conditionForm, phase: e.value })}
                />
              </div>
              {conditionForm.conditionId > 0 && (
                <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                  <p className="text-sm text-teal-800">
                    <strong>Selected Profile:</strong>{' '}
                    {conditions?.find(c => c.id === conditionForm.conditionId)?.name}
                  </p>
                  <p className="text-sm text-teal-700 mt-1">
                    Temperature: {conditions?.find(c => c.id === conditionForm.conditionId)?.temperatureMin}-
                    {conditions?.find(c => c.id === conditionForm.conditionId)?.temperatureMax}°C |
                    Max Humidity: ≤{conditions?.find(c => c.id === conditionForm.conditionId)?.humidityMax}% RH
                  </p>
                </div>
              )}
            </>
          )}

          {/* SOP Step Form */}
          {dialogType === 'sop' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Template (Optional)</label>
                <DxSelectBox
                  dataSource={(sopTemplates || []).filter(t => t.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={sopForm.templateId || null}
                  onValueChanged={(e) => {
                    const template = sopTemplates?.find(t => t.id === e.value);
                    if (template) {
                      setSOPForm({
                        ...sopForm,
                        templateId: e.value,
                        stepName: template.name,
                        stepNameTh: template.nameTh,
                      });
                    } else {
                      setSOPForm({ ...sopForm, templateId: 0 });
                    }
                  }}
                  placeholder="Select template or leave empty for custom"
                  searchEnabled
                  showClearButton
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Step Name (EN) *</label>
                  <DxTextBox
                    value={sopForm.stepName}
                    onValueChanged={(e) => setSOPForm({ ...sopForm, stepName: e.value })}
                    placeholder="e.g., Mix ingredients"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Step Name (TH)</label>
                  <DxTextBox
                    value={sopForm.stepNameTh}
                    onValueChanged={(e) => setSOPForm({ ...sopForm, stepNameTh: e.value })}
                    placeholder="e.g., ผสมส่วนผสม"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (EN)</label>
                <DxTextArea
                  value={sopForm.instructions}
                  onValueChanged={(e) => setSOPForm({ ...sopForm, instructions: e.value })}
                  height={60}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (TH)</label>
                <DxTextArea
                  value={sopForm.instructionsTh}
                  onValueChanged={(e) => setSOPForm({ ...sopForm, instructionsTh: e.value })}
                  height={60}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parameters (JSON)</label>
                <DxTextBox
                  value={sopForm.parameters}
                  onValueChanged={(e) => setSOPForm({ ...sopForm, parameters: e.value })}
                  placeholder='e.g., {"temperature": 75, "duration": 5}'
                />
              </div>
              <div className="flex items-center gap-2">
                <DxSwitch
                  value={sopForm.requiresVerification}
                  onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setSOPForm({ ...sopForm, requiresVerification: e.value ?? true })}
                />
                <span className="text-sm text-gray-700">Requires verification by supervisor</span>
              </div>
            </>
          )}

          {/* QC Criteria Form */}
          {dialogType === 'qc' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">QC Criteria *</label>
                <DxSelectBox
                  dataSource={(qcCriteria || []).filter(q => q.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={qcForm.criteriaId}
                  onValueChanged={(e) => setQCForm({ ...qcForm, criteriaId: e.value })}
                  placeholder="Select QC criteria"
                  searchEnabled
                />
              </div>
              {qcForm.criteriaId > 0 && (
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <p className="text-sm text-indigo-800">
                    <strong>Selected Criteria:</strong>{' '}
                    {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.name}
                  </p>
                  <p className="text-sm text-indigo-700 mt-1">
                    Weight: {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.weightMin}-
                    {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.weightMax}g |
                    Sample: {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.sampleSize} units |
                    Max Failures: {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.maxFailures}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowAddDialog(false)} />
            <DxButton
              text="Add"
              type="success"
              onClick={handleAdd}
              disabled={
                (dialogType === 'room' && addRoomMutation.isPending) ||
                (dialogType === 'equipment' && addEquipmentMutation.isPending) ||
                (dialogType === 'condition' && addConditionMutation.isPending) ||
                (dialogType === 'sop' && addSOPMutation.isPending) ||
                (dialogType === 'qc' && addQCMutation.isPending)
              }
            />
          </div>
        </div>
      </DxPopup>

      {/* Copy Configuration Dialog */}
      <DxPopup
        visible={showCopyDialog}
        onHiding={() => setShowCopyDialog(false)}
        title="Copy Configuration from Another BOM"
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Copy all configuration (rooms, equipment, environmental conditions, SOP steps, packaging QC)
            from another BOM to this one. Existing configuration will be replaced.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source BOM</label>
            <DxTextBox placeholder="Enter source BOM ID" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> This will replace all existing configuration for this BOM.
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="Cancel" stylingMode="outlined" onClick={() => setShowCopyDialog(false)} />
            <DxButton
              text="Copy Configuration"
              type="default"
              disabled={copyConfigMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
