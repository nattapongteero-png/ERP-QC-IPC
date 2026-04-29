'use client';

/**
 * BOM Configuration Page
 * Configures rooms, equipment, environmental conditions, SOP steps,
 * and packaging QC criteria for a specific BOM.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
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
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';

// IPC Configuration Section Component
type IPCPhase = 'pre_production' | 'production' | 'post_production' | 'packaging';
const IPC_PHASE_OPTIONS: Array<{ value: IPCPhase; label: string }> = [
  { value: 'pre_production', label: 'Pre-Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post-Production' },
  { value: 'packaging', label: 'Packaging' },
];

function IPCConfigSection({ bomId }: { bomId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingIpcId, setEditingIpcId] = useState<number | null>(null);
  const [selCriteria, setSelCriteria] = useState<number | null>(null);
  const [sampleSize, setSampleSize] = useState(5);
  const [isCritical, setIsCritical] = useState(false);
  const [phase, setPhase] = useState<IPCPhase>('production');

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

  const available = editingIpcId
    ? allCriteria // When editing, show all criteria including current
    : allCriteria.filter((c: any) => !configs.some((cfg: any) => cfg.criteriaId === c.id));

  const resetForm = () => {
    setShowForm(false); setEditingIpcId(null); setSelCriteria(null); setSampleSize(5); setIsCritical(false); setPhase('production');
  };

  const addMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId: selCriteria, sampleSize, isCritical, phase }),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      resetForm();
      toast.success('Added', 'IPC criteria added.');
    },
    onError: (e: Error) => toast.error('Error', e.message),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bomIpcId: editingIpcId, sampleSize, isCritical, phase }),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      resetForm();
      toast.success('Updated', 'IPC criteria updated.');
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

  const openEdit = (cfg: any) => {
    setEditingIpcId(cfg.id);
    setSelCriteria(cfg.criteriaId);
    setSampleSize(cfg.sampleSize);
    setIsCritical(cfg.isCritical);
    setPhase(((cfg.phase as string) || 'production') as IPCPhase);
    setShowForm(true);
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-medium">In-Process Control (IPC) Criteria</h3>
          </div>
          {!showForm && (
            <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200">
              <Plus className="h-4 w-4" /> Add IPC Criteria
            </button>
          )}
        </div>

        {isLoading && <div className="text-center py-6 text-gray-400">Loading...</div>}

        {!isLoading && configs.length === 0 && !showForm && (
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
              <button onClick={() => openEdit(cfg)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => { if (confirm('Remove?')) delMut.mutate(cfg.id); }} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="mt-3 border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-3">
            {!editingIpcId && (
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
            )}
            {editingIpcId && (
              <div className="text-sm font-medium text-gray-700">
                Editing: {configs.find((c: any) => c.id === editingIpcId)?.criteriaNameTh || configs.find((c: any) => c.id === editingIpcId)?.criteriaName}
              </div>
            )}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phase *</label>
              <DxSelectBox
                dataSource={IPC_PHASE_OPTIONS as unknown as Record<string, unknown>[]}
                displayExpr="label"
                valueExpr="value"
                value={phase}
                onValueChanged={(e) => setPhase(e.value)}
              />
              <p className="text-xs text-gray-500 mt-1">เลือก phase ที่จะให้ IPC test นี้แสดงใน Execution Dashboard</p>
            </div>
            <div className="flex justify-end gap-2">
              <DxButton text="Cancel" stylingMode="text" onClick={resetForm} />
              <DxButton
                text={editingIpcId ? 'Save' : 'Add to BOM'}
                type="success"
                onClick={() => editingIpcId ? editMut.mutate() : addMut.mutate()}
                disabled={(!editingIpcId && !selCriteria) || addMut.isPending || editMut.isPending}
              />
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

// pre_packaging phase merged into packaging — operator records both line
// clearance + packaging cleanliness from the Packaging Cleaning card. Existing
// BOM rows with phase='pre_packaging' still render (color mapping kept below)
// but new rooms/equipment can only be assigned to the 4 phases below.
const phases = [
  { value: 'pre_production', label: 'Pre-Production' },
  { value: 'production', label: 'Production' },
  { value: 'post_production', label: 'Post-Production' },
  { value: 'packaging', label: 'Packaging' },
];

// Packaging QC tab removed — packaging-specific QC criteria are now defined
// as IPC criteria (phase=packaging). Legacy bom_packaging_qc data remains in
// the database but is no longer reachable from the UI. Tab IDs 3+ keep their
// numeric position so existing tab-content blocks don't need re-wiring.
const tabItems: DxTabItem[] = [
  { id: 0, text: 'Rooms', icon: 'home' },
  { id: 1, text: 'Equipment', icon: 'toolbox' },
  { id: 2, text: 'SOP Steps', icon: 'textdocument' },
  { id: 4, text: 'IPC', icon: 'checklist' },
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  // BOM SOP-step IPC linker state.
  // selectedStepForIPC = the BOM SOP step the operator is managing IPCs for.
  // showIPCLinkDialog opens the per-step IPC management popup.
  // editingIpcLinkId tracks which existing link is being edited (null = new).
  const [selectedStepForIPC, setSelectedStepForIPC] = useState<BOMSOPStep | null>(null);
  const [showIPCLinkDialog, setShowIPCLinkDialog] = useState(false);
  const [editingIpcLinkId, setEditingIpcLinkId] = useState<number | null>(null);
  const [ipcLinkForm, setIpcLinkForm] = useState({
    criteriaId: null as number | null,
    procedureStepId: null as number | null,
    sampleSize: 1,
    sequence: 1,
    isCritical: false,
    maxRetestRounds: null as number | null,
    notes: '',
  });

  // Pending IPC links — staged client-side while creating a new BOM SOP step.
  // Once the step itself is saved (addSOPMutation), each entry is POSTed to
  // /api/production/bom/[id]/sop-step-ipc with the freshly-minted bomStepId.
  type PendingIpcLink = {
    tempId: string;
    procedureStepId: number | null;
    criteriaId: number;
    sequence: number;
    sampleSize: number;
    isCritical: boolean;
    maxRetestRounds: number | null;
    notes: string;
  };
  const [pendingIpcLinks, setPendingIpcLinks] = useState<PendingIpcLink[]>([]);
  const [pendingIpcEditingId, setPendingIpcEditingId] = useState<string | null>(null);
  const [pendingIpcForm, setPendingIpcForm] = useState({
    criteriaId: null as number | null,
    procedureStepId: null as number | null,
    sampleSize: 1,
    sequence: 1,
    isCritical: false,
    maxRetestRounds: null as number | null,
    notes: '',
  });
  // Active sub-step the inline ADD-mode form is currently targeting. null
  // means the form is closed; pendingIpcActiveSubStepId === <number> means
  // "Add IPC for sub-step #X" is open. Sentinel -1 = whole-step (no sub-step).
  const [pendingIpcActiveSubStepId, setPendingIpcActiveSubStepId] = useState<number | null>(null);

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

  // Fetch BOM SOP-step IPC links — joined with IPC master so the grid can
  // show code/name/spec without a second roundtrip per row.
  const { data: bomStepIpcLinks = [], isLoading: stepIpcLinksLoading } = useQuery<any[]>({
    queryKey: ['bom-sop-step-ipc-links', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/sop-step-ipc`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Master IPC criteria list (active only) for the linker dialog dropdown.
  // Reused at the page level (in addition to the existing IPCConfigSection
  // which has its own copy under the IPC tab).
  const { data: ipcCriteriaMaster = [] } = useQuery<any[]>({
    queryKey: ['ipc-criteria-active'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const d = await res.json();
      return d.success ? d.data : [];
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

  // Memoize the SOP-template dropdown items. Without this, the inline
  // .filter().map() rebuilt the array on every render, and DxSelectBox saw
  // a fresh dataSource reference each time. After the user clicked an
  // item, the next render swapped in a "new" array, which made the widget
  // re-emit onValueChanged(null) — wiping templateId back to 0 and hiding
  // the IPC sub-step linker. Stable identity → no spurious null emit.
  const sopTemplateOptions = useMemo(
    () =>
      (sopTemplates || [])
        .filter((t) => t.isActive)
        .map((t) => {
          const th = (t.nameTh || '').trim();
          const en = (t.name || '').trim();
          const both = th && en && th !== en ? `${th} / ${en}` : (th || en || '—');
          return {
            ...t,
            displayLabel: `${t.code} — ${both}`,
          };
        }),
    [sopTemplates],
  );

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
    selectedConditionId: null as number | null,
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

  // Add SOP Step form state — phase drives which Execution Dashboard card
  // hosts this step (per-phase SOP cards).
  const [sopForm, setSOPForm] = useState({
    templateId: 0,
    stepName: '',
    stepNameTh: '',
    instructions: '',
    instructionsTh: '',
    parameters: '',
    requiresVerification: true,
    phase: 'production' as 'pre_production' | 'production' | 'post_production' | 'packaging',
  });

  // Clear pendingIpcLinks + pending form state whenever the user switches
  // the template in the Add Step dialog. Otherwise IPC entries staged for
  // template A would carry over (with stale procedure_step_id) when the
  // operator changes their mind and picks template B — which would silently
  // create cross-template links on save.
  useEffect(() => {
    if (showAddDialog && dialogType === 'sop') {
      setPendingIpcLinks([]);
      setPendingIpcEditingId(null);
      setPendingIpcActiveSubStepId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopForm.templateId]);

  // Sub-steps (procedure_step_id targets) for the template currently in
  // play. The two dialogs that need this MUST NOT mix sources — that caused
  // sticky stale state when the user picked a different template:
  //  - Manage IPC popup (showIPCLinkDialog): use selectedStepForIPC.templateId
  //  - Add/Edit Step dialog (showAddDialog + dialogType='sop'): use sopForm.templateId
  const activeTemplateIdForSubSteps = showIPCLinkDialog
    ? (selectedStepForIPC?.templateId ?? null)
    : (showAddDialog && dialogType === 'sop' && sopForm.templateId > 0 ? sopForm.templateId : null);
  const { data: subStepsForSelectedBomStep = [], isFetching: subStepsFetching } = useQuery<any[]>({
    queryKey: ['sop-template-sub-steps', activeTemplateIdForSubSteps],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/sop-templates/${activeTemplateIdForSubSteps}/steps`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!activeTemplateIdForSubSteps,
    staleTime: 60_000,
    refetchOnMount: true,
  });

  // Add Packaging QC form state
  const [qcForm, setQCForm] = useState({
    criteriaId: 0,
  });

  // Delete mutations
  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/rooms?bomRoomId=${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/production/bom/${bomId}/equipment?bomEquipmentId=${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/production/bom/${bomId}/environmental-conditions?bomConditionId=${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/production/bom/${bomId}/sop-steps?bomStepId=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-steps', bomId] });
      // Removing a step cascades the IPC links server-side; clear the cache.
      queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
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

  // Edit mutations
  const editRoomMutation = useMutation({
    mutationFn: async (data: typeof roomForm & { bomRoomId: number }) => {
      const res = await fetch(`/api/production/bom/${bomId}/rooms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-rooms', bomId] });
      toast.success('Room Updated', 'Room requirement has been updated.');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const editEquipmentMutation = useMutation({
    mutationFn: async (data: typeof equipmentForm & { bomEquipmentId: number }) => {
      const res = await fetch(`/api/production/bom/${bomId}/equipment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-equipment', bomId] });
      toast.success('Equipment Updated', 'Equipment requirement has been updated.');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const editConditionMutation = useMutation({
    mutationFn: async (data: { oldId: number; conditionId: number; phase: string }) => {
      // Environmental conditions has no PUT - delete old + add new
      await fetch(`/api/production/bom/${bomId}/environmental-conditions?bomConditionId=${data.oldId}`, { method: 'DELETE' });
      const res = await fetch(`/api/production/bom/${bomId}/environmental-conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionId: data.conditionId, phase: data.phase }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-environmental-conditions', bomId] });
      toast.success('Condition Updated', 'Environmental condition has been updated.');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const editSOPMutation = useMutation({
    mutationFn: async (data: typeof sopForm & { bomStepId: number; sequence: number }) => {
      const res = await fetch(`/api/production/bom/${bomId}/sop-steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-steps', bomId] });
      toast.success('SOP Step Updated', 'SOP step has been updated.');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  const editQCMutation = useMutation({
    mutationFn: async (data: { criteriaId: number }) => {
      // Packaging QC has no PUT - delete all for this BOM + add new
      await fetch(`/api/production/bom/${bomId}/packaging-qc`, { method: 'DELETE' });
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
      toast.success('QC Criteria Updated', 'Packaging QC criteria has been updated.');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  // Add mutations
  const addRoomMutation = useMutation({
    mutationFn: async (data: typeof roomForm) => {
      const res = await fetch(`/api/production/bom/${bomId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: data.roomId,
          phase: data.phase,
          sequence: data.sequence,
          isRequired: data.isRequired,
          environmentalConditionIds: data.selectedConditionId ? [data.selectedConditionId] : [],
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-rooms', bomId] });
      toast.success('Room Added', 'Room requirement has been added.');
      setShowAddDialog(false);
      setRoomForm({ roomId: 0, phase: 'production', sequence: 1, isRequired: true, selectedConditionId: null });
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
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-steps', bomId] });

      // Batch-insert any IPC links the operator staged in pendingIpcLinks
      // before the step itself was saved. The server returns the new step's
      // id in result.data.id (matches POST /api/production/bom/[id]/sop-steps).
      const newBomStepId: number | undefined = result?.data?.id ?? result?.data?.bomStepId;
      const pending = pendingIpcLinks;
      let linkedCount = 0;
      let linkErrors = 0;
      if (newBomStepId && pending.length > 0) {
        for (const link of pending) {
          try {
            const linkRes = await fetch(`/api/production/bom/${bomId}/sop-step-ipc`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bomStepId: newBomStepId,
                procedureStepId: link.procedureStepId,
                criteriaId: link.criteriaId,
                sequence: link.sequence,
                sampleSize: link.sampleSize,
                isCritical: link.isCritical,
                maxRetestRounds: link.maxRetestRounds,
                notes: link.notes || null,
              }),
            });
            const linkJson = await linkRes.json();
            if (linkJson.success) linkedCount++;
            else linkErrors++;
          } catch {
            linkErrors++;
          }
        }
        queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
      }

      if (linkedCount > 0) {
        toast.success('SOP Step Added', `บันทึกแล้ว — ${linkedCount} IPC link${linkedCount === 1 ? '' : 's'}${linkErrors > 0 ? ` (${linkErrors} failed)` : ''}`);
      } else {
        toast.success('SOP Step Added', 'SOP step has been added.');
      }
      setShowAddDialog(false);
      setSOPForm({ templateId: 0, stepName: '', stepNameTh: '', instructions: '', instructionsTh: '', parameters: '', requiresVerification: true, phase: 'production' });
      setPendingIpcLinks([]);
      setPendingIpcEditingId(null);
      setPendingIpcActiveSubStepId(null);
      setPendingIpcForm({
        criteriaId: null,
        procedureStepId: null,
        sampleSize: 1,
        sequence: 1,
        isCritical: false,
        maxRetestRounds: null,
        notes: '',
      });
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

  // IPC linker mutations — wired against /api/production/bom/[id]/sop-step-ipc.
  // bomStepId is captured from selectedStepForIPC at submit time so the
  // form itself only carries criteria-level fields.
  const createIpcLinkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStepForIPC) throw new Error('No SOP step selected');
      if (!ipcLinkForm.criteriaId) throw new Error('กรุณาเลือก IPC Criterion');
      // IPC must bind to a sub-step (procedureStepId) when sub-steps exist —
      // WO Execution renders IPC under sub-steps, so unrooted IPCs are
      // unreachable to operators.
      if (subStepsForSelectedBomStep.length > 0 && !ipcLinkForm.procedureStepId) {
        throw new Error('กรุณาเลือกขั้นตอนย่อย (sub-step) ที่ IPC ผูก');
      }
      const res = await fetch(`/api/production/bom/${bomId}/sop-step-ipc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomStepId: selectedStepForIPC.id,
          procedureStepId: ipcLinkForm.procedureStepId,
          criteriaId: ipcLinkForm.criteriaId,
          sampleSize: ipcLinkForm.sampleSize,
          sequence: ipcLinkForm.sequence,
          isCritical: ipcLinkForm.isCritical,
          maxRetestRounds: ipcLinkForm.maxRetestRounds,
          notes: ipcLinkForm.notes || null,
        }),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
      resetIpcLinkForm();
      toast.success('IPC Linked', 'IPC criterion attached to SOP step.');
    },
    onError: (e: Error) => toast.error('Error', e.message),
  });

  const updateIpcLinkMutation = useMutation({
    mutationFn: async () => {
      if (!editingIpcLinkId) throw new Error('No IPC link selected');
      const res = await fetch(`/api/production/bom/${bomId}/sop-step-ipc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingIpcLinkId,
          sampleSize: ipcLinkForm.sampleSize,
          sequence: ipcLinkForm.sequence,
          isCritical: ipcLinkForm.isCritical,
          maxRetestRounds: ipcLinkForm.maxRetestRounds,
          notes: ipcLinkForm.notes || null,
        }),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
      resetIpcLinkForm();
      toast.success('IPC Updated', 'IPC link updated.');
    },
    onError: (e: Error) => toast.error('Error', e.message),
  });

  const deleteIpcLinkMutation = useMutation({
    mutationFn: async (linkId: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/sop-step-ipc?linkId=${linkId}`, {
        method: 'DELETE',
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
      toast.success('IPC Removed', 'IPC link removed from step.');
    },
    onError: (e: Error) => toast.error('Error', e.message),
  });

  const resetIpcLinkForm = () => {
    setEditingIpcLinkId(null);
    setIpcLinkForm({
      criteriaId: null,
      procedureStepId: null,
      sampleSize: 1,
      sequence: 1,
      isCritical: false,
      maxRetestRounds: null,
      notes: '',
    });
  };

  const openIpcManageDialog = (step: BOMSOPStep) => {
    setSelectedStepForIPC(step);
    resetIpcLinkForm();
    setShowIPCLinkDialog(true);
  };

  const openAddIpcForSubStep = (procedureStepId: number | null) => {
    resetIpcLinkForm();
    setIpcLinkForm((f) => ({ ...f, procedureStepId }));
  };

  const openEditIpcLink = (link: any) => {
    setEditingIpcLinkId(link.id);
    setIpcLinkForm({
      criteriaId: link.criteriaId,
      procedureStepId: link.procedureStepId ?? null,
      sampleSize: link.sampleSize ?? 1,
      sequence: link.sequence ?? 1,
      isCritical: !!link.isCritical,
      maxRetestRounds: link.maxRetestRounds ?? null,
      notes: link.notes || '',
    });
  };

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
      queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
      toast.success('Configuration Copied', 'BOM configuration has been copied successfully.');
      setShowCopyDialog(false);
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const openAddDialog = (type: typeof dialogType) => {
    setDialogType(type);
    setEditingId(null);
    // Reset pending IPC state — only relevant for SOP, but cheap to always reset.
    setPendingIpcLinks([]);
    setPendingIpcEditingId(null);
    setPendingIpcActiveSubStepId(null);
    setPendingIpcForm({
      criteriaId: null,
      procedureStepId: null,
      sampleSize: 1,
      sequence: 1,
      isCritical: false,
      maxRetestRounds: null,
      notes: '',
    });
    // Reset sopForm so the previous session's templateId doesn't bleed in
    // (this caused the "have to open/close several times to see sub-steps"
    // bug — a stale templateId made the picker show selected without
    // triggering the sub-steps fetch).
    if (type === 'sop') {
      setSOPForm({
        templateId: 0,
        stepName: '',
        stepNameTh: '',
        instructions: '',
        instructionsTh: '',
        parameters: '',
        requiresVerification: true,
        phase: 'production',
      });
    }
    // Also clear any lingering selectedStepForIPC that would shadow
    // sopForm.templateId via activeTemplateIdForSubSteps.
    setSelectedStepForIPC(null);
    setShowAddDialog(true);
  };

  const resetPendingIpcForm = () => {
    setPendingIpcEditingId(null);
    setPendingIpcActiveSubStepId(null);
    setPendingIpcForm({
      criteriaId: null,
      procedureStepId: null,
      sampleSize: 1,
      sequence: 1,
      isCritical: false,
      maxRetestRounds: null,
      notes: '',
    });
  };

  const openEditDialog = (type: typeof dialogType, item: Record<string, unknown>) => {
    setDialogType(type);
    setEditingId(item.id as number);
    switch (type) {
      case 'room':
        setRoomForm({
          roomId: (item.roomId as number) || 0,
          phase: (item.phase as string) || 'production',
          sequence: (item.sequence as number) || 1,
          isRequired: item.isRequired !== false,
          selectedConditionId: ((item.environmentalConditions as any[]) || [])[0]?.conditionId ?? null,
        });
        break;
      case 'equipment':
        setEquipmentForm({
          equipmentId: (item.equipmentId as number) || 0,
          phase: (item.phase as string) || 'production',
          sequence: (item.sequence as number) || 1,
          isRequired: item.isRequired !== false,
        });
        break;
      case 'condition':
        setConditionForm({
          conditionId: (item.conditionId as number) || 0,
          phase: (item.phase as string) || 'production',
        });
        break;
      case 'sop':
        setSOPForm({
          templateId: (item.templateId as number) || 0,
          stepName: (item.stepName as string) || '',
          stepNameTh: (item.stepNameTh as string) || '',
          instructions: (item.instructions as string) || '',
          instructionsTh: (item.instructionsTh as string) || '',
          parameters: (item.parameters as string) || '',
          requiresVerification: item.requiresVerification !== false,
          phase: ((item.phase as string) || 'production') as 'pre_production' | 'production' | 'post_production' | 'packaging',
        });
        break;
      case 'qc':
        setQCForm({
          criteriaId: (item.criteriaId as number) || 0,
        });
        break;
    }
    setShowAddDialog(true);
  };

  const handleSave = () => {
    switch (dialogType) {
      case 'room':
        if (!roomForm.roomId) {
          toast.error('Validation Error', 'Please select a room.');
          return;
        }
        if (editingId) {
          editRoomMutation.mutate({ ...roomForm, bomRoomId: editingId });
        } else {
          addRoomMutation.mutate(roomForm);
        }
        break;
      case 'equipment':
        if (!equipmentForm.equipmentId) {
          toast.error('Validation Error', 'Please select equipment.');
          return;
        }
        if (editingId) {
          editEquipmentMutation.mutate({ ...equipmentForm, bomEquipmentId: editingId });
        } else {
          addEquipmentMutation.mutate(equipmentForm);
        }
        break;
      case 'condition':
        if (!conditionForm.conditionId) {
          toast.error('Validation Error', 'Please select a condition profile.');
          return;
        }
        if (editingId) {
          editConditionMutation.mutate({ oldId: editingId, ...conditionForm });
        } else {
          addConditionMutation.mutate(conditionForm);
        }
        break;
      case 'sop': {
        if (!sopForm.stepNameTh) {
          toast.error('Validation Error', 'กรุณากรอกชื่อขั้นตอน (ภาษาไทย)');
          return;
        }
        if (editingId) {
          const existingStep = bomSOPSteps?.find(s => s.id === editingId);
          editSOPMutation.mutate({ ...sopForm, bomStepId: editingId, sequence: existingStep?.sequence || 1 });
        } else {
          addSOPMutation.mutate(sopForm);
        }
        break;
      }
      case 'qc':
        if (!qcForm.criteriaId) {
          toast.error('Validation Error', 'Please select QC criteria.');
          return;
        }
        if (editingId) {
          editQCMutation.mutate(qcForm);
        } else {
          addQCMutation.mutate(qcForm);
        }
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
                  <DxColumn caption="Env. Conditions" cellRender={(cell) => {
                    const envConds = cell.data.environmentalConditions || [];
                    if (envConds.length === 0) return <span className="text-xs text-gray-400">-</span>;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {envConds.map((ec: { id: number; conditionName: string }) => (
                          <span key={ec.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-800 border border-teal-200">
                            {ec.conditionName || 'Condition'}
                          </span>
                        ))}
                      </div>
                    );
                  }} />
                  <DxColumn caption="Actions" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="Edit" onClick={() => openEditDialog('room', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteRoomMutation.mutate(cell.data.id)} />
                    </div>
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
                  <DxColumn caption="Actions" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="Edit" onClick={() => openEditDialog('equipment', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteEquipmentMutation.mutate(cell.data.id)} />
                    </div>
                  )} />
                </DxDataGrid>
              </div>
            )}

            {/* Environmental Conditions Tab */}
            {/* SOP Steps Tab */}
            {activeTab === 2 && (
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
                  <DxColumn caption="IPC" width={140} cellRender={(cell) => {
                    // Count IPC links attached to this BOM SOP step. Click
                    // "Manage" to open the per-step IPC linker dialog.
                    const stepId = cell.data.id as number;
                    const count = bomStepIpcLinks.filter((l: any) => l.bomStepId === stepId).length;
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-xs font-medium ${count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                          {count}
                        </span>
                        <button
                          onClick={() => openIpcManageDialog(cell.data as BOMSOPStep)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                        >
                          <FlaskConical className="h-3 w-3" /> Manage
                        </button>
                      </div>
                    );
                  }} />
                  <DxColumn caption="Actions" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="Edit" onClick={() => openEditDialog('sop', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteSOPMutation.mutate(cell.data.id)} />
                    </div>
                  )} />
                </DxDataGrid>
              </div>
            )}

            {/* Packaging QC Tab */}
            {activeTab === 3 && (
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
                  <DxColumn caption="Actions" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="Edit" onClick={() => openEditDialog('qc', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="Remove" onClick={() => deleteQCMutation.mutate(cell.data.id)} />
                    </div>
                  )} />
                </DxDataGrid>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab 5: IPC Criteria */}
      {activeTab === 4 && (
        <IPCConfigSection bomId={bomId} />
      )}

      {/* Add Dialog */}
      <DxPopup
        visible={showAddDialog}
        onHiding={() => {
          setShowAddDialog(false);
          setEditingId(null);
          setPendingIpcLinks([]);
          setPendingIpcEditingId(null);
          setPendingIpcActiveSubStepId(null);
        }}
        title={
          editingId
            ? (dialogType === 'room' ? 'Edit Room Requirement' :
               dialogType === 'equipment' ? 'Edit Equipment Requirement' :
               dialogType === 'condition' ? 'Edit Environmental Condition' :
               dialogType === 'sop' ? 'Edit SOP Step' :
               'Edit Packaging QC Criteria')
            : (dialogType === 'room' ? 'Add Room Requirement' :
               dialogType === 'equipment' ? 'Add Equipment Requirement' :
               dialogType === 'condition' ? 'Add Environmental Condition' :
               dialogType === 'sop' ? 'Add SOP Step' :
               'Add Packaging QC Criteria')
        }
        width={dialogType === 'sop' ? 650 : dialogType === 'room' ? 600 : 500}
        height={dialogType === 'sop' ? '90vh' : 'auto'}
        showCloseButton
        dragEnabled={false}
      >
        <div className={dialogType === 'sop' ? 'flex flex-col h-full' : 'p-4 space-y-4'}>
        <div className={dialogType === 'sop' ? 'p-4 space-y-4 overflow-y-auto flex-1' : 'contents'}>
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

              {/* Environmental Condition — single select */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Environmental Condition</label>
                <DxSelectBox
                  dataSource={(conditions || []).filter((c: EnvironmentalCondition) => c.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={roomForm.selectedConditionId}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, selectedConditionId: e.value })}
                  placeholder="เลือก Environmental Condition..."
                  searchEnabled
                  showClearButton
                />
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
                  dataSource={phases.filter(p => ['pre_production', 'production', 'packaging'].includes(p.value))}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Template <span className="text-gray-400">(Optional)</span>
                </label>
                <DxSelectBox
                  dataSource={sopTemplateOptions as unknown as Record<string, unknown>[]}
                  displayExpr="displayLabel"
                  valueExpr="id"
                  searchExpr={['displayLabel', 'nameTh', 'name', 'code']}
                  value={sopForm.templateId || null}
                  onValueChanged={(e) => {
                    // Guard: spurious null emit (no DOM event) means the
                    // widget reset itself after a programmatic value change
                    // — don't honor it, the user didn't clear.
                    if (e.value == null && !e.event) return;
                    const template = sopTemplates?.find((t) => t.id === e.value);
                    // Use functional setState so the spread reads the LATEST
                    // sopForm. Without this, sibling DxTextBox handlers
                    // emitting on prop change can revert templateId back to
                    // 0 via a stale closure spread (their closure still has
                    // the pre-pick sopForm).
                    setSOPForm((prev) =>
                      template
                        ? { ...prev, templateId: e.value, stepName: template.name, stepNameTh: template.nameTh }
                        : { ...prev, templateId: 0 }
                    );
                  }}
                  placeholder="เลือก Template หรือเว้นว่างเพื่อกรอกเอง"
                  searchEnabled
                  showClearButton
                />
                <p className="text-xs text-gray-500 mt-1">
                  รายการแสดงเป็น &quot;Code — ชื่อไทย / ชื่อ EN&quot; (ค้นหาได้ทั้ง 3 ฟิลด์)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Step Name (TH) *</label>
                  <DxTextBox
                    value={sopForm.stepNameTh}
                    onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, stepNameTh: e.value }))}
                    placeholder="เช่น ผสมส่วนผสม"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Step Name (EN) <span className="text-gray-400">(Optional)</span>
                  </label>
                  <DxTextBox
                    value={sopForm.stepName}
                    onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, stepName: e.value }))}
                    placeholder="e.g., Mix ingredients"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (TH)</label>
                <DxTextArea
                  value={sopForm.instructionsTh}
                  onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, instructionsTh: e.value }))}
                  height={60}
                />
              </div>
              <details className="rounded-lg border border-gray-200 bg-gray-50/50 group">
                <summary className="cursor-pointer select-none flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100/70 rounded-lg">
                  <Settings className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-90" />
                  ตั้งค่าขั้นสูง (Advanced)
                  <span className="ml-auto text-xs text-gray-400 font-normal">Instructions (EN), Parameters JSON</span>
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (EN)</label>
                    <DxTextArea
                      value={sopForm.instructions}
                      onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, instructions: e.value }))}
                      height={60}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parameters (JSON)</label>
                    <DxTextBox
                      value={sopForm.parameters}
                      onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, parameters: e.value }))}
                      placeholder='e.g., {"temperature": 75, "duration": 5}'
                    />
                  </div>
                </div>
              </details>
              <div className="flex items-center gap-2">
                <DxSwitch
                  value={sopForm.requiresVerification}
                  onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setSOPForm((prev) => ({ ...prev, requiresVerification: e.value ?? true }))}
                />
                <span className="text-sm text-gray-700">Requires verification by supervisor</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phase *</label>
                <DxSelectBox
                  dataSource={phases as unknown as Record<string, unknown>[]}
                  displayExpr="label"
                  valueExpr="value"
                  value={sopForm.phase}
                  onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, phase: e.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">เลือก phase ที่จะให้ขั้นตอนนี้แสดงใน Execution Dashboard</p>
              </div>

              {/* Inline IPC linker — shown when template is picked. Allows
                  user to attach IPC criteria to specific sub-steps right
                  here in the same Step dialog. */}
              {sopForm.templateId > 0 && (() => {
                if (!editingId) {
                  // ADD mode — pre-stage IPC links in pendingIpcLinks. They
                  // get batch-POSTed to /sop-step-ipc once the parent step is
                  // saved (see addSOPMutation.onSuccess).
                  const subSteps = subStepsForSelectedBomStep as any[];
                  // Group pending entries by procedureStepId.
                  const pendingBySubStep = new Map<number | null, PendingIpcLink[]>();
                  for (const link of pendingIpcLinks) {
                    const key = link.procedureStepId ?? null;
                    if (!pendingBySubStep.has(key)) pendingBySubStep.set(key, []);
                    pendingBySubStep.get(key)!.push(link);
                  }

                  // Pending form — render only when user clicked "+ เพิ่ม IPC"
                  // on a sub-step (or whole-step). pendingIpcActiveSubStepId
                  // === null means form is hidden. Sentinel -1 = whole-step.
                  const formOpen = pendingIpcActiveSubStepId !== null || pendingIpcEditingId !== null;
                  const formSubStepId =
                    pendingIpcEditingId !== null
                      ? pendingIpcForm.procedureStepId
                      : pendingIpcActiveSubStepId === -1
                        ? null
                        : pendingIpcActiveSubStepId;

                  // Filter out criteria already staged for THIS sub-step (or
                  // whole-step). When editing a pending entry, allow current.
                  const criteriaUsedForThisSlot = new Set(
                    pendingIpcLinks
                      .filter((p) => (p.procedureStepId ?? null) === (formSubStepId ?? null))
                      .filter((p) => p.tempId !== pendingIpcEditingId)
                      .map((p) => p.criteriaId)
                  );
                  const availablePendingCriteria = ipcCriteriaMaster.filter((c: any) => !criteriaUsedForThisSlot.has(c.id));

                  const openPendingForm = (subStepId: number | null) => {
                    // Pre-fill defaults; sentinel -1 = whole-step.
                    setPendingIpcEditingId(null);
                    setPendingIpcActiveSubStepId(subStepId === null ? -1 : subStepId);
                    setPendingIpcForm({
                      criteriaId: null,
                      procedureStepId: subStepId,
                      sampleSize: 1,
                      sequence: (pendingBySubStep.get(subStepId)?.length ?? 0) + 1,
                      isCritical: false,
                      maxRetestRounds: null,
                      notes: '',
                    });
                  };

                  const editPendingEntry = (entry: PendingIpcLink) => {
                    setPendingIpcEditingId(entry.tempId);
                    setPendingIpcActiveSubStepId(entry.procedureStepId === null ? -1 : entry.procedureStepId);
                    setPendingIpcForm({
                      criteriaId: entry.criteriaId,
                      procedureStepId: entry.procedureStepId,
                      sampleSize: entry.sampleSize,
                      sequence: entry.sequence,
                      isCritical: entry.isCritical,
                      maxRetestRounds: entry.maxRetestRounds,
                      notes: entry.notes,
                    });
                  };

                  const deletePendingEntry = (tempId: string) => {
                    setPendingIpcLinks((prev) => prev.filter((p) => p.tempId !== tempId));
                    if (pendingIpcEditingId === tempId) resetPendingIpcForm();
                  };

                  const submitPendingForm = () => {
                    if (!pendingIpcForm.criteriaId) {
                      toast.error('Validation Error', 'กรุณาเลือก IPC Criterion');
                      return;
                    }
                    if (pendingIpcEditingId !== null) {
                      // Update existing pending entry.
                      setPendingIpcLinks((prev) =>
                        prev.map((p) =>
                          p.tempId === pendingIpcEditingId
                            ? {
                                ...p,
                                criteriaId: pendingIpcForm.criteriaId!,
                                procedureStepId: pendingIpcForm.procedureStepId,
                                sampleSize: pendingIpcForm.sampleSize,
                                sequence: pendingIpcForm.sequence,
                                isCritical: pendingIpcForm.isCritical,
                                maxRetestRounds: pendingIpcForm.maxRetestRounds,
                                notes: pendingIpcForm.notes,
                              }
                            : p
                        )
                      );
                    } else {
                      // Append new pending entry.
                      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                      setPendingIpcLinks((prev) => [
                        ...prev,
                        {
                          tempId,
                          criteriaId: pendingIpcForm.criteriaId!,
                          procedureStepId: pendingIpcForm.procedureStepId,
                          sampleSize: pendingIpcForm.sampleSize,
                          sequence: pendingIpcForm.sequence,
                          isCritical: pendingIpcForm.isCritical,
                          maxRetestRounds: pendingIpcForm.maxRetestRounds,
                          notes: pendingIpcForm.notes,
                        },
                      ]);
                    }
                    resetPendingIpcForm();
                  };

                  // Render a single pending entry row (sub-step linked).
                  const renderPendingRow = (entry: PendingIpcLink) => {
                    const criterion = ipcCriteriaMaster.find((c: any) => c.id === entry.criteriaId) as any;
                    return (
                      <div
                        key={entry.tempId}
                        className={`flex items-start gap-3 p-2.5 rounded-md border bg-white ${pendingIpcEditingId === entry.tempId ? 'border-emerald-400 bg-emerald-50/40' : 'border-gray-200'}`}
                      >
                        <span className="flex-none w-6 h-6 rounded bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center mt-0.5">
                          {entry.sequence}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-emerald-700">{criterion?.code ?? '—'}</span>
                            <span className="text-sm font-medium truncate">
                              {criterion?.nameTh || criterion?.name || 'Unknown criterion'}
                            </span>
                            {entry.isCritical && (
                              <span className="text-[10px] text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-200">
                                Critical
                              </span>
                            )}
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                              ยังไม่บันทึก
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Sample: {entry.sampleSize}
                            {entry.maxRetestRounds != null && <span> · Max retests: {entry.maxRetestRounds}</span>}
                            {entry.notes && <span> · {entry.notes}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => editPendingEntry(entry)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePendingEntry(entry.tempId)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-emerald-600" />
                          IPC Tests by Sub-Step ({pendingIpcLinks.length})
                        </h4>
                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          จะบันทึกพร้อม step
                        </span>
                      </div>

                      {subStepsFetching && subSteps.length === 0 ? (
                        <div className="flex items-center gap-2 py-3 text-sm text-emerald-700">
                          <span className="inline-block w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                          <span>กำลังโหลด sub-steps จาก template...</span>
                        </div>
                      ) : subSteps.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-3">
                          Template นี้ไม่มี sub-step — ไม่สามารถผูก IPC ได้
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {subSteps.map((sub: any, idx: number) => {
                            const subPending = pendingBySubStep.get(sub.id) ?? [];
                            const isFormTargetingThisSub =
                              pendingIpcEditingId === null && pendingIpcActiveSubStepId === sub.id;
                            return (
                              <div
                                key={sub.id}
                                className={`rounded-md border ${isFormTargetingThisSub ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}
                              >
                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50/50 rounded-t-md">
                                  <div className="flex items-center gap-2">
                                    <span className="flex-none w-5 h-5 rounded bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                                      {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium text-gray-800 truncate">
                                      {sub.stepNameTh || sub.stepName}
                                    </span>
                                    <span className="text-[10px] text-gray-500">({subPending.length} IPC)</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openPendingForm(sub.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    เพิ่ม IPC
                                  </button>
                                </div>
                                {subPending.length === 0 ? (
                                  <div className="px-3 py-2.5 text-xs text-gray-400 italic">
                                    ยังไม่มี IPC ผูกกับขั้นตอนย่อยนี้
                                  </div>
                                ) : (
                                  <div className="p-2 space-y-2">{subPending.map(renderPendingRow)}</div>
                                )}
                              </div>
                            );
                          })}

                          {/* IPC ต้องผูกกับ sub-step เสมอ (ไม่อนุญาตให้ผูกที่ระดับ
                              step เพราะ WO Execution ต้องใช้ sub-step ในการบันทึก IPC) */}
                        </div>
                      )}

                      {/* Inline pending Add/Edit form — shown only when an
                          "+ เพิ่ม IPC" button is clicked. */}
                      {formOpen && (
                        <div className="border border-emerald-300 bg-white rounded-md p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                              <Plus className="h-3.5 w-3.5" />
                              {pendingIpcEditingId !== null ? 'แก้ไข IPC' : 'เพิ่ม IPC ใหม่'}
                              {formSubStepId !== null && subSteps.length > 0 && (
                                <span className="text-gray-500 font-normal">
                                  — {(() => {
                                    const found = subSteps.find((s: any) => s.id === formSubStepId);
                                    return found ? found.stepNameTh || found.stepName : '';
                                  })()}
                                </span>
                              )}
                            </h5>
                            <button
                              type="button"
                              onClick={resetPendingIpcForm}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              ยกเลิก
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">IPC Criterion *</label>
                            <DxSelectBox
                              dataSource={availablePendingCriteria.map((c: any) => ({
                                id: c.id,
                                display: `${c.code} — ${c.nameTh || c.name}${c.specification ? ` (${c.specification})` : ''}`,
                              }))}
                              displayExpr="display"
                              valueExpr="id"
                              value={pendingIpcForm.criteriaId}
                              onValueChanged={(e) => {
                                const picked = ipcCriteriaMaster.find((c: any) => c.id === e.value) as any;
                                setPendingIpcForm((f) => ({
                                  ...f,
                                  criteriaId: e.value,
                                  sampleSize: picked?.sampleSize ?? f.sampleSize,
                                  isCritical: picked?.isCritical ?? f.isCritical,
                                }));
                              }}
                              placeholder="เลือก IPC criterion"
                              searchEnabled
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Sequence</label>
                              <DxNumberBox
                                value={pendingIpcForm.sequence}
                                onValueChanged={(e) => setPendingIpcForm((f) => ({ ...f, sequence: e.value ?? 1 }))}
                                min={1}
                                showSpinButtons
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Sample Size</label>
                              <DxNumberBox
                                value={pendingIpcForm.sampleSize}
                                onValueChanged={(e) => setPendingIpcForm((f) => ({ ...f, sampleSize: e.value ?? 1 }))}
                                min={1}
                                showSpinButtons
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Max Retest</label>
                              <DxNumberBox
                                value={pendingIpcForm.maxRetestRounds ?? null}
                                onValueChanged={(e) =>
                                  setPendingIpcForm((f) => ({
                                    ...f,
                                    maxRetestRounds:
                                      e.value === null || e.value === undefined ? null : Number(e.value),
                                  }))
                                }
                                min={0}
                                showClearButton
                                placeholder="default"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <DxSwitch
                              value={pendingIpcForm.isCritical}
                              onValueChanged={(e: SwitchTypes.ValueChangedEvent) =>
                                setPendingIpcForm((f) => ({ ...f, isCritical: e.value ?? false }))
                              }
                            />
                            <span className="text-xs text-gray-700">Critical (failure must be flagged for QA review)</span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                            <DxTextArea
                              value={pendingIpcForm.notes}
                              onValueChanged={(e) => setPendingIpcForm((f) => ({ ...f, notes: e.value ?? '' }))}
                              height={48}
                              placeholder="Optional"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-emerald-100">
                            <DxButton
                              text="ยกเลิก"
                              stylingMode="text"
                              onClick={resetPendingIpcForm}
                            />
                            <DxButton
                              text={pendingIpcEditingId !== null ? 'บันทึกการแก้ไข' : 'เพิ่ม'}
                              type="success"
                              icon={pendingIpcEditingId !== null ? 'save' : 'plus'}
                              onClick={submitPendingForm}
                              disabled={!pendingIpcForm.criteriaId}
                            />
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-gray-500 italic">
                        IPC ที่เพิ่มในนี้จะถูกบันทึกเมื่อกด &quot;Add&quot; — ยังไม่ได้บันทึกลงฐานข้อมูล
                      </p>
                    </div>
                  );
                }
                // Edit mode — render full inline linker for the editing step.
                const stepLinks = bomStepIpcLinks.filter((l: any) => l.bomStepId === editingId);
                const linksBySubStep = new Map<number | null, any[]>();
                for (const link of stepLinks) {
                  const key = link.procedureStepId ?? null;
                  if (!linksBySubStep.has(key)) linksBySubStep.set(key, []);
                  linksBySubStep.get(key)!.push(link);
                }
                // Use the same templateId from form (live) — fetch sub-steps if mismatch with selected step.
                const subSteps = (selectedStepForIPC?.templateId === sopForm.templateId
                  ? subStepsForSelectedBomStep
                  : []) as any[];
                return (
                  <div className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-emerald-600" />
                        IPC Tests by Sub-Step ({stepLinks.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          // Open the standalone Manage dialog so the user gets the full
                          // editor with form, edit/delete, etc. We pass the current step.
                          const currentStep = (bomSOPSteps || []).find((s: any) => s.id === editingId);
                          if (currentStep) {
                            setSelectedStepForIPC(currentStep as BOMSOPStep);
                            setShowIPCLinkDialog(true);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 rounded transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        จัดการ IPC แบบเต็ม
                      </button>
                    </div>
                    {subSteps.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        Loading sub-steps... หรือ template นี้ไม่มี sub-step
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {subSteps.map((sub: any, idx: number) => {
                          const subLinks = linksBySubStep.get(sub.id) ?? [];
                          return (
                            <div key={sub.id} className="rounded-md bg-white border border-gray-200 p-2.5">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex-none w-5 h-5 rounded bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm font-medium text-gray-800 truncate">{sub.stepNameTh || sub.stepName}</span>
                                  <span className="flex-none text-[10px] text-gray-500">({subLinks.length} IPC)</span>
                                </div>
                              </div>
                              {subLinks.length === 0 ? (
                                <div className="text-xs text-gray-400 italic pl-7">— ยังไม่ได้ผูก IPC —</div>
                              ) : (
                                <div className="pl-7 space-y-1">
                                  {subLinks.map((link: any) => (
                                    <div key={link.id} className="flex items-center gap-2 text-xs">
                                      <span className="font-mono text-emerald-700">{link.criteriaCode}</span>
                                      <span className="text-gray-700 truncate">{link.criteriaNameTh || link.criteriaName}</span>
                                      {link.isCritical && (
                                        <span className="text-[10px] text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-200">Critical</span>
                                      )}
                                      <span className="text-gray-500">· Sample: {link.sampleSize}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 italic">
                      เพิ่ม / แก้ไข / ลบ IPC ผ่านปุ่ม &quot;จัดการ IPC แบบเต็ม&quot;
                    </p>
                  </div>
                );
              })()}
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

          </div>
          <div className={dialogType === 'sop'
            ? 'flex justify-end gap-2 px-4 py-3 border-t bg-white shrink-0'
            : 'flex justify-end gap-2 pt-4 border-t'}>
            <DxButton
              text="Cancel"
              stylingMode="outlined"
              onClick={() => {
                setShowAddDialog(false);
                setEditingId(null);
                setPendingIpcLinks([]);
                resetPendingIpcForm();
              }}
            />
            <DxButton
              text={editingId ? 'Save' : 'Add'}
              type="success"
              onClick={handleSave}
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

      {/* BOM SOP Step IPC Linker Dialog */}
      {/* Opened from the "Manage" button on the IPC column of the SOP Steps grid. */}
      {/* Shows existing links + an inline Add/Edit form, all scoped to one BOM step. */}
      <DxPopup
        visible={showIPCLinkDialog}
        onHiding={() => { setShowIPCLinkDialog(false); resetIpcLinkForm(); setSelectedStepForIPC(null); }}
        title={selectedStepForIPC ? `IPC Tests — Step ${selectedStepForIPC.sequence}: ${selectedStepForIPC.stepNameTh || selectedStepForIPC.stepName}` : 'IPC Tests'}
        width={780}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          {selectedStepForIPC && (() => {
            const stepLinks = bomStepIpcLinks.filter((l: any) => l.bomStepId === selectedStepForIPC.id);
            const linkedCriteriaIds = new Set(stepLinks.map((l: any) => l.criteriaId));
            // When editing, keep current criterion in the dropdown so it
            // shows up; otherwise filter out already-linked ones.
            const availableCriteria = ipcCriteriaMaster.filter((c: any) =>
              editingIpcLinkId ? true : !linkedCriteriaIds.has(c.id)
            );
            const editingLink = editingIpcLinkId ? stepLinks.find((l: any) => l.id === editingIpcLinkId) : null;

            // Group existing IPC links by procedureStepId (sub-step). null
            // = not tied to any specific sub-step ("whole step" IPCs).
            const linksBySubStep = new Map<number | null, any[]>();
            for (const link of stepLinks) {
              const key = link.procedureStepId ?? null;
              if (!linksBySubStep.has(key)) linksBySubStep.set(key, []);
              linksBySubStep.get(key)!.push(link);
            }

            // Render a single IPC link row (used by both grouped and ungrouped views).
            const renderLinkRow = (link: any) => (
              <div key={link.id} className={`flex items-start gap-3 p-3 rounded-lg border bg-white group ${editingIpcLinkId === link.id ? 'border-emerald-400 bg-emerald-50/40' : 'border-gray-200'}`}>
                <span className="flex-none w-7 h-7 rounded bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center mt-0.5">
                  {link.sequence}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-emerald-700">{link.criteriaCode}</span>
                    <span className="font-medium">{link.criteriaNameTh || link.criteriaName}</span>
                    {link.isCritical && (
                      <span className="text-xs text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">Critical</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {link.specification && <span>Spec: {link.specification} | </span>}
                    <span>Sample: {link.sampleSize}</span>
                    <span> | Max retests: {link.maxRetestRounds != null
                      ? link.maxRetestRounds
                      : <span className="italic">Master default ({link.masterMaxRetestRounds ?? '—'})</span>}
                    </span>
                  </div>
                  {link.notes && (
                    <div className="text-xs text-gray-600 mt-1 italic">{link.notes}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditIpcLink(link)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Remove this IPC link?')) deleteIpcLinkMutation.mutate(link.id); }}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );

            return (
              <>
                {/* Step header summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">SOP Step</div>
                  <div className="font-medium">
                    {selectedStepForIPC.stepName}
                    {selectedStepForIPC.stepNameTh && (
                      <span className="text-gray-500 font-normal"> — {selectedStepForIPC.stepNameTh}</span>
                    )}
                  </div>
                </div>

                {/* Sub-step grouped IPC list — when the BOM step uses an SOP
                    template with sub-steps, render each sub-step as its own
                    section. Operator clicks "+ Add IPC" on the sub-step they
                    want to attach to. */}
                {subStepsForSelectedBomStep.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-emerald-600" />
                        IPC Tests by Sub-Step ({stepLinks.length})
                      </h4>
                    </div>
                    {subStepsForSelectedBomStep.map((sub: any, idx: number) => {
                      const subLinks = linksBySubStep.get(sub.id) ?? [];
                      const subName = sub.stepNameTh || sub.stepName;
                      const isFormTargetingThisSub = !editingIpcLinkId && ipcLinkForm.procedureStepId === sub.id;
                      return (
                        <div key={sub.id} className={`rounded-lg border ${isFormTargetingThisSub ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
                            <div className="flex items-center gap-2">
                              <span className="flex-none w-6 h-6 rounded bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-800">{subName}</span>
                              <span className="text-xs text-gray-500">({subLinks.length} IPC)</span>
                            </div>
                            <button
                              onClick={() => openAddIpcForSubStep(sub.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              เพิ่ม IPC
                            </button>
                          </div>
                          {subLinks.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-gray-400 italic">
                              ยังไม่มี IPC ผูกกับขั้นตอนย่อยนี้
                            </div>
                          ) : (
                            <div className="p-2 space-y-2">
                              {subLinks.map(renderLinkRow)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* "Whole step" IPCs — links without a procedureStepId */}
                    {(() => {
                      const wholeStepLinks = linksBySubStep.get(null) ?? [];
                      if (wholeStepLinks.length === 0) return null;
                      return (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/20">
                          <div className="px-3 py-2 border-b border-amber-200 bg-amber-50/50 rounded-t-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-amber-800">⚠ ผูกกับ step ทั้งหมด (ไม่ระบุ sub-step)</span>
                              <span className="text-xs text-amber-700">({wholeStepLinks.length} IPC)</span>
                            </div>
                          </div>
                          <div className="p-2 space-y-2">
                            {wholeStepLinks.map(renderLinkRow)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // Fallback: BOM step has no template/sub-steps — flat list.
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-emerald-600" />
                        IPC Tests ({stepLinks.length})
                      </h4>
                    </div>
                    {stepIpcLinksLoading ? (
                      <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
                    ) : stepLinks.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-200 rounded-lg">
                        ยังไม่มี IPC ผูกกับ step นี้
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stepLinks.map(renderLinkRow)}
                      </div>
                    )}
                  </div>
                )}

                {/* Add / Edit form */}
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      {editingIpcLinkId ? 'Edit IPC link' : 'Add IPC test'}
                    </h4>
                    {editingIpcLinkId && (
                      <button
                        onClick={resetIpcLinkForm}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>

                  {/* Sub-step picker — IPC ต้องผูกกับ sub-step เสมอ (จำเป็น) */}
                  {subStepsForSelectedBomStep.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ขั้นตอนย่อย (Sub-step) <span className="text-red-500">*</span>
                        <span className="text-xs text-gray-500 font-normal ml-1">— เลือกขั้นตอนย่อยที่ IPC ผูก</span>
                      </label>
                      <DxSelectBox
                        dataSource={subStepsForSelectedBomStep.map((s: any, idx: number) => ({
                          id: s.id,
                          display: `${idx + 1}. ${s.stepNameTh || s.stepName}`,
                        }))}
                        displayExpr="display"
                        valueExpr="id"
                        value={ipcLinkForm.procedureStepId}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, procedureStepId: e.value }))}
                        placeholder="เลือก sub-step..."
                      />
                    </div>
                  )}

                  {!editingIpcLinkId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IPC Criterion *</label>
                      <DxSelectBox
                        dataSource={availableCriteria.map((c: any) => ({
                          id: c.id,
                          display: `${c.code} — ${c.nameTh || c.name}${c.specification ? ` (${c.specification})` : ''}`,
                        }))}
                        displayExpr="display"
                        valueExpr="id"
                        value={ipcLinkForm.criteriaId}
                        onValueChanged={(e) => {
                          const picked = ipcCriteriaMaster.find((c: any) => c.id === e.value);
                          // Pre-fill sampleSize/critical from master defaults so
                          // the operator doesn't have to retype them.
                          setIpcLinkForm((f) => ({
                            ...f,
                            criteriaId: e.value,
                            sampleSize: picked?.sampleSize ?? f.sampleSize,
                            isCritical: picked?.isCritical ?? f.isCritical,
                          }));
                        }}
                        placeholder="Select IPC criterion"
                        searchEnabled
                      />
                    </div>
                  )}
                  {editingIpcLinkId && editingLink && (
                    <div className="text-sm font-medium text-gray-700">
                      Editing: <span className="font-mono text-xs text-emerald-700">{editingLink.criteriaCode}</span> {editingLink.criteriaNameTh || editingLink.criteriaName}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sequence</label>
                      <DxNumberBox
                        value={ipcLinkForm.sequence}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, sequence: e.value ?? 1 }))}
                        min={1}
                        showSpinButtons
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sample Size</label>
                      <DxNumberBox
                        value={ipcLinkForm.sampleSize}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, sampleSize: e.value ?? 1 }))}
                        min={1}
                        showSpinButtons
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Retest Rounds</label>
                      <DxNumberBox
                        value={ipcLinkForm.maxRetestRounds ?? null}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({
                          ...f,
                          maxRetestRounds: e.value === null || e.value === undefined ? null : Number(e.value),
                        }))}
                        min={0}
                        showClearButton
                        placeholder="Use master default"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DxSwitch
                      value={ipcLinkForm.isCritical}
                      onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIpcLinkForm((f) => ({ ...f, isCritical: e.value ?? false }))}
                    />
                    <span className="text-sm text-gray-700">Critical (failure must be flagged for QA review)</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <DxTextArea
                      value={ipcLinkForm.notes}
                      onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, notes: e.value ?? '' }))}
                      height={60}
                      placeholder="Optional — special instructions for this step's IPC test"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
                    <DxButton
                      text={editingIpcLinkId ? 'Save changes' : 'Add IPC'}
                      type="success"
                      icon={editingIpcLinkId ? 'save' : 'plus'}
                      onClick={() => editingIpcLinkId ? updateIpcLinkMutation.mutate() : createIpcLinkMutation.mutate()}
                      disabled={
                        (!editingIpcLinkId && !ipcLinkForm.criteriaId) ||
                        createIpcLinkMutation.isPending ||
                        updateIpcLinkMutation.isPending
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <DxButton
                    text="Close"
                    stylingMode="outlined"
                    onClick={() => { setShowIPCLinkDialog(false); resetIpcLinkForm(); setSelectedStepForIPC(null); }}
                  />
                </div>
              </>
            );
          })()}
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
