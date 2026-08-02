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
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { useToast } from '@/hooks/use-toast';
import { SwitchTypes } from 'devextreme-react/switch';
import { formatSpecSummary, formatSpecInline, getCriteriaTypeLabel } from '@/lib/master-data/ipc-spec-payload';
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
  { value: 'pre_production', label: 'ก่อนการผลิต' },
  { value: 'production', label: 'การผลิต' },
  { value: 'post_production', label: 'หลังการผลิต' },
  { value: 'packaging', label: 'การบรรจุ' },
];

function IPCConfigSection({ bomId }: { bomId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingIpcId, setEditingIpcId] = useState<number | null>(null);
  // Add mode = multi-select bulk add. Edit mode still works on a single
  // row, so we keep both shapes side by side.
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<number[]>([]);
  const [criteriaSearch, setCriteriaSearch] = useState('');
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
    setShowForm(false); setEditingIpcId(null);
    setSelectedCriteriaIds([]); setCriteriaSearch('');
    setSampleSize(5); setIsCritical(false); setPhase('production');
  };

  // Bulk add: POST one row per selected criterion, each with that
  // criterion's master defaults for sampleSize / isCritical (operator can
  // still edit per-row after add). Phase is shared across the batch.
  const addMut = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        selectedCriteriaIds.map(async (id) => {
          const master = allCriteria.find((c: any) => c.id === id) as any;
          const res = await fetch(`/api/production/bom/${bomId}/ipc`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              criteriaId: id,
              sampleSize: master?.sampleSize ?? 5,
              isCritical: master?.isCritical ?? false,
              phase,
            }),
          });
          return res.json();
        }),
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        throw new Error(`${failed.length}/${results.length} failed: ${failed[0]?.error ?? 'unknown'}`);
      }
      return { added: results.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      resetForm();
      toast.success('เพิ่มแล้ว', `เพิ่ม IPC criteria ${data.added} รายการสำเร็จ`);
    },
    onError: (e: Error) => toast.error('ข้อผิดพลาด', e.message),
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
      toast.success('อัปเดตแล้ว', 'อัปเดตเกณฑ์ IPC แล้ว');
    },
    onError: (e: Error) => toast.error('ข้อผิดพลาด', e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc?bomIpcId=${id}`, { method: 'DELETE' });
      const r = await res.json();
      if (!r.success) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-ipc', bomId] });
      toast.success('นำออกแล้ว', 'นำเกณฑ์ IPC ออกแล้ว');
    },
    onError: (e: Error) => toast.error('ข้อผิดพลาด', e.message),
  });

  const openEdit = (cfg: any) => {
    setEditingIpcId(cfg.id);
    setSampleSize(cfg.sampleSize);
    setIsCritical(cfg.isCritical);
    setPhase(((cfg.phase as string) || 'production') as IPCPhase);
    setShowForm(true);
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-medium">การควบคุมระหว่างกระบวนการ (IPC) — ระดับเฟส</h3>
          </div>
          {!showForm && (
            <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200">
              <Plus className="h-4 w-4" /> เพิ่มเกณฑ์ IPC
            </button>
          )}
        </div>

        {/* New workflow: Phase Level is now the master scope for this BOM
            (must be populated first). SOP Steps reference IPCs from here —
            cannot bind anything that isn't declared at phase level. */}
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-900 leading-relaxed">
          <p className="font-semibold mb-0.5">ขั้นตอนการกำหนด IPC สำหรับ BOM นี้</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>
              <strong>tab นี้ (IPC — Phase Level):</strong> กำหนด IPC criteria ทั้งหมดที่จะใช้ใน BOM นี้ก่อน
            </li>
            <li>
              <strong>tab &quot;SOP Steps&quot; → ปุ่ม &quot;Manage&quot; ในแต่ละ step:</strong> เลือก IPC จากที่กำหนดในข้อ 1 มาผูกกับ step หรือ sub-step เฉพาะ
            </li>
          </ol>
          <p className="mt-1.5 text-[11px] text-emerald-700">
            IPC ที่ไม่ได้กำหนดในข้อ 1 จะไม่สามารถผูกกับ SOP step ได้
          </p>
        </div>

        {isLoading && <div className="text-center py-6 text-gray-400">กำลังโหลด...</div>}

        {!isLoading && configs.length === 0 && !showForm && (
          <div className="text-center py-6 text-gray-500 text-sm">ยังไม่ได้กำหนดเกณฑ์ IPC</div>
        )}

        <div className="space-y-2">
          {configs.map((cfg: any, idx: number) => {
            const summaryLines = formatSpecSummary({
              criteriaType: cfg.criteriaType || 'numeric',
              specification: cfg.specification,
              sampleSize: cfg.sampleSize,
              minValue: cfg.minValue,
              maxValue: cfg.maxValue,
              unit: cfg.unit,
            });
            return (
            <div key={cfg.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white group">
              <span className="flex-none w-7 h-7 rounded bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center mt-0.5">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-emerald-600">{cfg.criteriaCode}</span>
                  <span className="font-medium">{cfg.criteriaNameTh || cfg.criteriaName}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {getCriteriaTypeLabel(cfg.criteriaType || 'numeric')}
                  </span>
                  {cfg.isCritical && <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">วิกฤต</span>}
                </div>
                <div className="mt-1 space-y-1">
                  {summaryLines.map((line: { icon: string; text: string; tone?: string }, i: number) => (
                    <div
                      key={i}
                      className={`text-sm flex items-start gap-1.5 ${
                        line.tone === 'pass'
                          ? 'text-emerald-700'
                          : line.tone === 'fail'
                          ? 'text-rose-700'
                          : line.tone === 'meta'
                          ? 'text-gray-500'
                          : 'text-gray-700'
                      }`}
                    >
                      <span className="flex-none w-4 text-center select-none">{line.icon}</span>
                      <span className="break-words">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => openEdit(cfg)} className="p-1 text-gray-400 hover:text-emerald-700 opacity-0 group-hover:opacity-100">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => { if (confirm('ลบรายการนี้?')) delMut.mutate(cfg.id); }} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            );
          })}
        </div>

        {showForm && (
          <div className="mt-3 border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-3">
            {!editingIpcId && (() => {
              // Filter master list: hide already-configured criteria + apply search.
              const term = criteriaSearch.trim().toLowerCase();
              const filtered = (available as any[]).filter((c: any) => {
                if (!term) return true;
                return (
                  (c.code || '').toLowerCase().includes(term) ||
                  (c.nameTh || '').toLowerCase().includes(term) ||
                  (c.name || '').toLowerCase().includes(term)
                );
              });
              const allFilteredIds = filtered.map((c: any) => c.id);
              const allSelected = filtered.length > 0 && filtered.every((c: any) => selectedCriteriaIds.includes(c.id));
              const toggleAll = () => {
                if (allSelected) {
                  setSelectedCriteriaIds((s) => s.filter((id) => !allFilteredIds.includes(id)));
                } else {
                  setSelectedCriteriaIds((s) => Array.from(new Set([...s, ...allFilteredIds])));
                }
              };
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เกณฑ์ IPC * <span className="text-xs text-gray-500 font-normal">(ติ๊กเลือกได้หลายตัว)</span>
                  </label>
                  <input
                    type="text"
                    value={criteriaSearch}
                    onChange={(e) => setCriteriaSearch(e.target.value)}
                    placeholder="ค้นหา code / ชื่อ..."
                    className="w-full mb-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md bg-white">
                    {filtered.length === 0 ? (
                      <div className="text-center py-6 text-sm">
                        {allCriteria.length === 0 ? (
                          <div className="text-amber-700">
                            <p className="font-medium mb-1">ยังไม่มี IPC criteria ใน Master Data</p>
                            <p className="text-xs text-gray-500">กรุณาเพิ่มที่ <strong>Master Data → IPC Criteria</strong> ก่อน</p>
                          </div>
                        ) : available.length === 0 ? (
                          <span className="text-gray-400">IPC criteria ทั้งหมดถูกเพิ่มไปยัง BOM นี้แล้ว</span>
                        ) : (
                          <span className="text-gray-400">ไม่พบรายการที่ค้นหา</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="rounded"
                          />
                          <span>{allSelected ? 'ยกเลิกการเลือกทั้งหมด' : `เลือกทั้งหมด (${filtered.length})`}</span>
                        </label>
                        {filtered.map((c: any) => {
                          const checked = selectedCriteriaIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-start gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-emerald-50 ${checked ? 'bg-emerald-50/60' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCriteriaIds((s) => [...s, c.id]);
                                  } else {
                                    setSelectedCriteriaIds((s) => s.filter((id) => id !== c.id));
                                  }
                                }}
                                className="mt-0.5 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm text-emerald-600">{c.code}</span>
                                  <span className="text-sm font-medium">{c.nameTh || c.name}</span>
                                  {c.isCritical && (
                                    <span className="text-[11px] text-red-600 bg-red-50 px-1 py-0.5 rounded">วิกฤต</span>
                                  )}
                                </div>
                                {/* Render the spec as readable summary lines, NOT the raw
                                    JSON payload — some criteria store a structured spec
                                    ({"type":"visual",...}) that dumped unreadable text here. */}
                                {(() => {
                                  const specLines = formatSpecSummary({
                                    criteriaType: c.criteriaType || 'numeric',
                                    specification: c.specification,
                                    sampleSize: c.sampleSize,
                                    minValue: c.minValue,
                                    maxValue: c.maxValue,
                                    unit: c.unit,
                                  });
                                  if (specLines.length === 0) return null;
                                  return (
                                    <div className="mt-1 space-y-1">
                                      {specLines.map((line: { icon: string; text: string; tone?: string }, i: number) => (
                                        <div
                                          key={i}
                                          className={`text-sm flex items-start gap-1.5 ${
                                            line.tone === 'pass' ? 'text-emerald-700'
                                              : line.tone === 'fail' ? 'text-rose-700'
                                              : line.tone === 'meta' ? 'text-gray-500'
                                              : 'text-gray-600'
                                          }`}
                                        >
                                          <span className="flex-none w-4 text-center select-none">{line.icon}</span>
                                          <span className="break-words">{line.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </label>
                          );
                        })}
                      </>
                    )}
                  </div>
                  {selectedCriteriaIds.length > 0 && (
                    <p className="mt-2 text-xs text-emerald-700">
                      เลือกแล้ว <strong>{selectedCriteriaIds.length}</strong> รายการ — Sample size / Critical จะใช้ค่า default ของแต่ละ criterion (แก้ภายหลังได้)
                    </p>
                  )}
                </div>
              );
            })()}
            {editingIpcId && (
              <>
                <div className="text-sm font-medium text-gray-700">
                  กำลังแก้ไข: {configs.find((c: any) => c.id === editingIpcId)?.criteriaNameTh || configs.find((c: any) => c.id === editingIpcId)?.criteriaName}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ขนาดตัวอย่าง</label>
                    <DxNumberBox value={sampleSize} onValueChanged={(e) => setSampleSize(e.value)} min={1} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <DxSwitch value={isCritical} onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIsCritical(e.value)} />
                    <span className="text-sm">วิกฤต</span>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เฟส *</label>
              <DxSelectBox
                dataSource={IPC_PHASE_OPTIONS as unknown as Record<string, unknown>[]}
                displayExpr="label"
                valueExpr="value"
                value={phase}
                onValueChanged={(e) => setPhase(e.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                {editingIpcId
                  ? 'เลือก phase ที่จะให้ IPC test นี้แสดงใน Execution Dashboard'
                  : 'Phase นี้จะใช้กับ IPC ที่เลือกทั้งหมด — สามารถเปลี่ยนทีหลังในแต่ละรายการ'}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <DxButton text="ยกเลิก" stylingMode="text" onClick={resetForm} />
              <DxButton
                text={
                  editingIpcId
                    ? 'บันทึก'
                    : (selectedCriteriaIds.length > 0
                        ? `เพิ่ม ${selectedCriteriaIds.length} รายการเข้าสูตรการผลิต`
                        : 'เพิ่มเข้าสูตรการผลิต')
                }
                type="success"
                onClick={() => editingIpcId ? editMut.mutate() : addMut.mutate()}
                disabled={(!editingIpcId && selectedCriteriaIds.length === 0) || addMut.isPending || editMut.isPending}
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
  { value: 'pre_production', label: 'ก่อนการผลิต' },
  { value: 'production', label: 'การผลิต' },
  { value: 'post_production', label: 'หลังการผลิต' },
  { value: 'packaging', label: 'การบรรจุ' },
];

// Packaging QC tab removed — packaging-specific QC criteria are now defined
// as IPC criteria (phase=packaging). Legacy bom_packaging_qc data remains in
// the database but is no longer reachable from the UI. Tab IDs 3+ keep their
// numeric position so existing tab-content blocks don't need re-wiring.
// Tab items are now built inside the component so each tab label can carry
// a live count badge (e.g. "Rooms 4"). The base shape stays declarative.
// IPC tab is renamed to make the legacy phase-level scope explicit — the
// new per-sub-step linker lives under "SOP Steps → Manage IPC" so operators
// don't accidentally double-record the same criterion in both places.
const tabBlueprint: Array<{ id: number; text: string; icon: string }> = [
  { id: 0, text: 'ห้องผลิต', icon: 'home' },
  { id: 1, text: 'เครื่องจักร', icon: 'toolbox' },
  { id: 2, text: 'ขั้นตอน SOP', icon: 'textdocument' },
  { id: 4, text: 'IPC — ระดับเฟส', icon: 'checklist' },
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
  // Source BOM selected in the Copy-Configuration dialog (the dialog used to
  // have a dead free-text "BOM ID" input + a button with no onClick).
  const [copySourceId, setCopySourceId] = useState<number | null>(null);

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

  // Master IPC criteria list (active only) — used for dictionary lookups
  // (display name, master defaults) when an existing link references a
  // criterion that may no longer be in phase-level config.
  const { data: ipcCriteriaMaster = [] } = useQuery<any[]>({
    queryKey: ['ipc-criteria-active'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?isActive=true');
      const d = await res.json();
      return d.success ? d.data : [];
    },
  });

  // Phase-level IPC configs for THIS BOM. Drives which IPC criteria appear
  // in SOP-step / sub-step linker dropdowns — operators may only bind IPC
  // tests that have been pre-declared at the BOM phase level (in the
  // "IPC — Phase Level" tab).
  const { data: bomIpcConfigs = [] } = useQuery<any[]>({
    queryKey: ['bom-ipc', bomId],
    queryFn: async () => {
      const res = await fetch(`/api/production/bom/${bomId}/ipc`);
      const d = await res.json();
      return d.success ? d.data : [];
    },
  });

  // IPC criteria that are eligible to bind into SOP steps — derived from
  // ipcCriteriaMaster ∩ bomIpcConfigs.criteriaId. Stable identity via memo
  // so DxSelectBox doesn't see fresh dataSource on every render.
  const bomPhaseIpcCriteria = useMemo(() => {
    const allowedIds = new Set<number>(
      (bomIpcConfigs as any[]).map((c) => Number(c.criteriaId))
    );
    return (ipcCriteriaMaster as any[]).filter((c: any) => allowedIds.has(Number(c.id)));
  }, [ipcCriteriaMaster, bomIpcConfigs]);

  // Fetch Master Data for dropdowns
  const { data: rooms } = useQuery<ProductionRoom[]>({
    queryKey: ['production-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms');
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  // Only IN-LINE equipment can be assigned to a BOM. Off-line/support equipment
  // (e.g. air-conditioner) is never part of a production line, so it must not be
  // selectable here. Distinct queryKey avoids colliding with the unfiltered list.
  const { data: equipment } = useQuery<ProductionEquipment[]>({
    queryKey: ['production-equipment', 'in_line'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-equipment?lineCategory=in_line');
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
      toast.success('นำห้องผลิตออกแล้ว', 'นำข้อกำหนดห้องผลิตออกแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('นำเครื่องจักรออกแล้ว', 'นำข้อกำหนดเครื่องจักรออกแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('นำสภาวะแวดล้อมออกแล้ว', 'นำสภาวะแวดล้อมออกแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('นำขั้นตอน SOP ออกแล้ว', 'นำขั้นตอน SOP ออกแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('นำเกณฑ์ QC ออกแล้ว', 'นำเกณฑ์ QC การบรรจุออกแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('อัปเดตห้องผลิตแล้ว', 'อัปเดตข้อกำหนดห้องผลิตแล้ว');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('ข้อผิดพลาด', error.message),
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
      toast.success('อัปเดตเครื่องจักรแล้ว', 'อัปเดตข้อกำหนดเครื่องจักรแล้ว');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('ข้อผิดพลาด', error.message),
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
      toast.success('อัปเดตสภาวะแวดล้อมแล้ว', 'อัปเดตสภาวะแวดล้อมแล้ว');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('ข้อผิดพลาด', error.message),
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
      toast.success('อัปเดตขั้นตอน SOP แล้ว', 'อัปเดตขั้นตอน SOP แล้ว');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('ข้อผิดพลาด', error.message),
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
      toast.success('อัปเดตเกณฑ์ QC แล้ว', 'อัปเดตเกณฑ์ QC การบรรจุแล้ว');
      setShowAddDialog(false);
      setEditingId(null);
    },
    onError: (error: Error) => toast.error('ข้อผิดพลาด', error.message),
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
      toast.success('เพิ่มห้องผลิตแล้ว', 'เพิ่มข้อกำหนดห้องผลิตแล้ว');
      setShowAddDialog(false);
      setRoomForm({ roomId: 0, phase: 'production', sequence: 1, isRequired: true, selectedConditionId: null });
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('เพิ่มเครื่องจักรแล้ว', 'เพิ่มข้อกำหนดเครื่องจักรแล้ว');
      setShowAddDialog(false);
      setEquipmentForm({ equipmentId: 0, phase: 'production', sequence: 1, isRequired: true });
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('เพิ่มสภาวะแวดล้อมแล้ว', 'เพิ่มสภาวะแวดล้อมแล้ว');
      setShowAddDialog(false);
      setConditionForm({ conditionId: 0, phase: 'production' });
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
      // before the step itself was saved. POST /sop-steps now flattens the
      // response so result.data.id is the bomStep id; the legacy nested
      // shape result.data.bomStep.id is checked too in case an older
      // server build is in front of a freshly-deployed UI.
      const newBomStepId: number | undefined =
        result?.data?.id ??
        result?.data?.bomStep?.id ??
        result?.data?.bomStepId;
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
        toast.success('เพิ่มขั้นตอน SOP แล้ว', `บันทึกแล้ว — ${linkedCount} IPC link${linkedCount === 1 ? '' : 's'}${linkErrors > 0 ? ` (${linkErrors} ล้มเหลว)` : ''}`);
      } else {
        toast.success('เพิ่มขั้นตอน SOP แล้ว', 'เพิ่มขั้นตอน SOP แล้ว');
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
      toast.error('ข้อผิดพลาด', error.message);
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
      toast.success('เพิ่มเกณฑ์ QC แล้ว', 'เพิ่มเกณฑ์ QC การบรรจุแล้ว');
      setShowAddDialog(false);
      setQCForm({ criteriaId: 0 });
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
    },
  });

  // IPC linker mutations — wired against /api/production/bom/[id]/sop-step-ipc.
  // bomStepId is captured from selectedStepForIPC at submit time so the
  // form itself only carries criteria-level fields.
  const createIpcLinkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStepForIPC) throw new Error('ยังไม่ได้เลือกขั้นตอน SOP');
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
      toast.success('ผูก IPC แล้ว', 'ผูกเกณฑ์ IPC เข้ากับขั้นตอน SOP แล้ว');
    },
    onError: (e: Error) => toast.error('ข้อผิดพลาด', e.message),
  });

  const updateIpcLinkMutation = useMutation({
    mutationFn: async () => {
      if (!editingIpcLinkId) throw new Error('ยังไม่ได้เลือกการผูก IPC');
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
      toast.success('อัปเดต IPC แล้ว', 'อัปเดตการผูก IPC แล้ว');
    },
    onError: (e: Error) => toast.error('ข้อผิดพลาด', e.message),
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
      toast.success('นำ IPC ออกแล้ว', 'นำการผูก IPC ออกจากขั้นตอนแล้ว');
    },
    onError: (e: Error) => toast.error('ข้อผิดพลาด', e.message),
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

  // Selectable source BOMs for the Copy-Configuration dialog (exclude self).
  const { data: copySourceBoms = [] } = useQuery<Array<{ id: number; code: string; name: string; label: string }>>({
    queryKey: ['bom-copy-sources', bomId],
    enabled: showCopyDialog,
    queryFn: async () => {
      const res = await fetch('/api/bom?limit=1000');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const items = (data.data?.items || []) as Array<{ id: number; code: string; name: string }>;
      return items
        .filter((b) => b.id !== bomId)
        .map((b) => ({ ...b, label: `${b.code} — ${b.name}` }));
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
      queryClient.invalidateQueries({ queryKey: ['bom-sop-step-ipc-links', bomId] });
      toast.success('คัดลอกการตั้งค่าสำเร็จ', 'คัดลอกการตั้งค่า BOM เรียบร้อยแล้ว');
      setShowCopyDialog(false);
      setCopySourceId(null);
    },
    onError: (error: Error) => {
      toast.error('ข้อผิดพลาด', error.message);
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
          toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกห้องผลิต');
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
          toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกเครื่องจักร');
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
          toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกโปรไฟล์สภาวะแวดล้อม');
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
          toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณากรอกชื่อขั้นตอน (ภาษาไทย)');
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
          toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกเกณฑ์ QC');
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
    // Distinct hue per phase along the production flow so the Phase column isn't
    // a wall of near-identical greens (production/post_production/packaging were
    // all green before). nowrap keeps each label on one line.
    const colors: Record<string, string> = {
      pre_production: 'bg-amber-100 text-amber-800',
      production: 'bg-blue-100 text-blue-800',
      post_production: 'bg-violet-100 text-violet-800',
      pre_packaging: 'bg-cyan-100 text-cyan-800',
      packaging: 'bg-emerald-100 text-emerald-800',
    };
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colors[phase] || 'bg-gray-100 text-gray-800'}`}>
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
        <p className="text-gray-500">ไม่พบสูตรการผลิต</p>
        <DxButton
          text="กลับไปยังรายการสูตรการผลิต"
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
        title={`การตั้งค่า: ${bom.code}`}
        subtitle={`ตั้งค่าข้อกำหนด GMP สำหรับ ${bom.name}`}
        icon={Settings}
        iconBgColor="bg-gray-100"
        iconColor="text-gray-600"
        breadcrumbs={[
          { label: 'การผลิต', href: '/production' },
          { label: 'สูตรการผลิต', href: '/production/bom' },
          { label: bom.code, href: `/production/bom/${bomId}` },
          { label: 'การตั้งค่า' },
        ]}
        actions={
          <div className="flex gap-2">
            <DxButton
              text="กลับไปยังสูตรการผลิต"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push(`/production/bom/${bomId}`)}
            />
            <DxButton
              text="คัดลอกการตั้งค่า"
              icon="copy"
              type="normal"
              onClick={() => setShowCopyDialog(true)}
            />
          </div>
        }
      />

      {/* Tabs — labels carry live counts so the operator sees what's
          configured at a glance ("Rooms 4 · Equipment 6 · …"). */}
      <Card>
        <CardContent className="p-0">
          <DxTabs
            items={tabBlueprint.map((t) => {
              const count =
                t.id === 0 ? (bomRooms?.length ?? 0)
                : t.id === 1 ? (bomEquipment?.length ?? 0)
                : t.id === 2 ? (bomSOPSteps?.length ?? 0)
                : t.id === 4 ? (bomIpcConfigs?.length ?? 0)
                : 0;
              // IPC—Phase Level is required setup. When 0, show a "⚠" marker
              // instead of hiding the badge so the operator notices that this
              // tab must be configured before they can bind IPC at step level.
              const badge =
                t.id === 4
                  ? (count > 0 ? count : '⚠ 0')
                  : (count > 0 ? count : undefined);
              return { ...t, badge };
            })}
            selectedIndex={activeTab}
            onSelectedIndexChange={(idx) => setActiveTab(idx)}
          />

          <div className="p-4">
            {/* Rooms Tab */}
            {activeTab === 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-medium">ห้องผลิตที่ต้องใช้</h3>
                  </div>
                  <DxButton
                    text="เพิ่มห้องผลิต"
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
                  noDataText="ยังไม่ได้กำหนดห้องผลิต คลิก 'เพิ่มห้องผลิต' เพื่อเพิ่มข้อกำหนด"
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="sequence" caption="#" width={60} sortOrder="asc" sortIndex={0} />
                  <DxColumn dataField="phase" caption="เฟส" width={140} cellRender={(cell) => renderPhaseBadge(cell.value)} />
                  <DxColumn dataField="room.code" caption="รหัสห้อง" width={120} />
                  <DxColumn dataField="room.name" caption="ชื่อห้อง" />
                  <DxColumn dataField="isRequired" caption="จำเป็น" width={100} cellRender={(cell) => (
                    <span className={`px-2 py-0.5 rounded text-xs ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cell.value ? 'ใช่' : 'ไม่บังคับ'}
                    </span>
                  )} />
                  <DxColumn caption="สภาวะแวดล้อม" cellRender={(cell) => {
                    const envConds = cell.data.environmentalConditions || [];
                    if (envConds.length === 0) return <span className="text-xs text-gray-400">-</span>;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {envConds.map((ec: { id: number; conditionName: string }) => (
                          <span key={ec.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-800 border border-teal-200">
                            {ec.conditionName || 'สภาวะแวดล้อม'}
                          </span>
                        ))}
                      </div>
                    );
                  }} />
                  <DxColumn caption="การดำเนินการ" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="แก้ไข" onClick={() => openEditDialog('room', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="ลบ" onClick={() => deleteRoomMutation.mutate(cell.data.id)} />
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
                    <h3 className="text-lg font-medium">เครื่องจักรที่ต้องใช้</h3>
                  </div>
                  <DxButton
                    text="เพิ่มเครื่องจักร"
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
                  noDataText="ยังไม่ได้กำหนดเครื่องจักร คลิก 'เพิ่มเครื่องจักร' เพื่อเพิ่มข้อกำหนด"
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="sequence" caption="#" width={60} sortOrder="asc" sortIndex={0} />
                  <DxColumn dataField="phase" caption="เฟส" width={140} cellRender={(cell) => renderPhaseBadge(cell.value)} />
                  <DxColumn dataField="equipment.code" caption="รหัสเครื่องจักร" width={120} />
                  <DxColumn dataField="equipment.name" caption="ชื่อเครื่องจักร" />
                  <DxColumn dataField="equipment.capacity" caption="ความจุ" width={120} />
                  <DxColumn dataField="isRequired" caption="จำเป็น" width={100} cellRender={(cell) => (
                    <span className={`px-2 py-0.5 rounded text-xs ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cell.value ? 'ใช่' : 'ไม่บังคับ'}
                    </span>
                  )} />
                  <DxColumn caption="การดำเนินการ" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="แก้ไข" onClick={() => openEditDialog('equipment', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="ลบ" onClick={() => deleteEquipmentMutation.mutate(cell.data.id)} />
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
                    <h3 className="text-lg font-medium">ขั้นตอนการผลิต SOP</h3>
                  </div>
                  <DxButton
                    text="เพิ่มขั้นตอน"
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
                  noDataText="ยังไม่ได้กำหนดขั้นตอน SOP คลิก 'เพิ่มขั้นตอน' เพื่อเพิ่มขั้นตอนการผลิต"
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="sequence" caption="ขั้นตอน" width={70} sortOrder="asc" sortIndex={0} />
                  <DxColumn dataField="phase" caption="เฟส" width={140} cellRender={(cell) => renderPhaseBadge(cell.value)} />
                  <DxColumn dataField="stepName" caption="ชื่อขั้นตอน (EN)" />
                  <DxColumn dataField="stepNameTh" caption="ชื่อขั้นตอน (TH)" />
                  <DxColumn dataField="requiresVerification" caption="การตรวจสอบยืนยัน" width={120} cellRender={(cell) => (
                    <span className={`px-2 py-0.5 rounded text-xs ${cell.value ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                      {cell.value ? 'จำเป็น' : 'ไม่จำเป็น'}
                    </span>
                  )} />
                  <DxColumn caption="IPC" width={170} cellRender={(cell) => {
                    // Count IPC links attached to this BOM SOP step. Click
                    // "Manage" to open the per-step IPC linker dialog.
                    const stepId = cell.data.id as number;
                    const count = bomStepIpcLinks.filter((l: any) => l.bomStepId === stepId).length;
                    return (
                      <div className="flex items-center gap-2 flex-nowrap">
                        <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-xs font-medium ${count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                          {count}
                        </span>
                        <button
                          onClick={() => openIpcManageDialog(cell.data as BOMSOPStep)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 whitespace-nowrap shrink-0"
                        >
                          <FlaskConical className="h-3 w-3 shrink-0" /> จัดการ
                        </button>
                      </div>
                    );
                  }} />
                  <DxColumn caption="การดำเนินการ" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="แก้ไข" onClick={() => openEditDialog('sop', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="ลบ" onClick={() => deleteSOPMutation.mutate(cell.data.id)} />
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
                    <Scale className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-medium">เกณฑ์ QC การบรรจุ</h3>
                  </div>
                  <DxButton
                    text="เพิ่มเกณฑ์"
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
                  noDataText="ยังไม่ได้กำหนดเกณฑ์ QC การบรรจุ คลิก 'เพิ่มเกณฑ์' เพื่อเพิ่มข้อกำหนด"
                >
                  <DxPaging defaultPageSize={10} />
                  <DxColumn dataField="criteria.code" caption="รหัสเกณฑ์" width={120} />
                  <DxColumn dataField="criteria.name" caption="ชื่อเกณฑ์" />
                  <DxColumn caption="ช่วงน้ำหนัก" width={150} cellRender={(cell) => (
                    <span className="text-emerald-700">{cell.data.criteria?.weightMin}-{cell.data.criteria?.weightMax}g</span>
                  )} />
                  <DxColumn caption="เกณฑ์การสุ่ม" width={150} cellRender={(cell) => (
                    <span className="text-gray-600">≤{cell.data.criteria?.maxFailures}/{cell.data.criteria?.sampleSize} ไม่ผ่าน</span>
                  )} />
                  <DxColumn caption="การดำเนินการ" width={100} cellRender={(cell) => (
                    <div className="flex gap-0.5">
                      <DxButton icon="edit" stylingMode="text" hint="แก้ไข" onClick={() => openEditDialog('qc', cell.data)} />
                      <DxButton icon="trash" stylingMode="text" hint="ลบ" onClick={() => deleteQCMutation.mutate(cell.data.id)} />
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
            ? (dialogType === 'room' ? 'แก้ไขข้อกำหนดห้องผลิต' :
               dialogType === 'equipment' ? 'แก้ไขข้อกำหนดเครื่องจักร' :
               dialogType === 'condition' ? 'แก้ไขสภาวะแวดล้อม' :
               dialogType === 'sop' ? 'แก้ไขขั้นตอน SOP' :
               'แก้ไขเกณฑ์ QC การบรรจุ')
            : (dialogType === 'room' ? 'เพิ่มข้อกำหนดห้องผลิต' :
               dialogType === 'equipment' ? 'เพิ่มข้อกำหนดเครื่องจักร' :
               dialogType === 'condition' ? 'เพิ่มสภาวะแวดล้อม' :
               dialogType === 'sop' ? 'เพิ่มขั้นตอน SOP' :
               'เพิ่มเกณฑ์ QC การบรรจุ')
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
                <label className="block text-sm font-medium text-gray-700 mb-1">ห้องผลิต *</label>
                <DxSelectBox
                  dataSource={(rooms || []).filter(r => r.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={roomForm.roomId}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, roomId: e.value })}
                  placeholder="เลือกห้องผลิต"
                  searchEnabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เฟส *</label>
                <DxSelectBox
                  dataSource={phases}
                  displayExpr="label"
                  valueExpr="value"
                  value={roomForm.phase}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, phase: e.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับ</label>
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
                <span className="text-sm text-gray-700">จำเป็นสำหรับการผลิต</span>
              </div>

              {/* Environmental Condition — single select */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">สภาวะแวดล้อม</label>
                <DxSelectBox
                  dataSource={(conditions || []).filter((c: EnvironmentalCondition) => c.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={roomForm.selectedConditionId}
                  onValueChanged={(e) => setRoomForm({ ...roomForm, selectedConditionId: e.value })}
                  placeholder="เลือกสภาวะแวดล้อม..."
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
                <label className="block text-sm font-medium text-gray-700 mb-1">เครื่องจักร *</label>
                <DxSelectBox
                  dataSource={(equipment || []).filter(e => e.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={equipmentForm.equipmentId}
                  onValueChanged={(e) => setEquipmentForm({ ...equipmentForm, equipmentId: e.value })}
                  placeholder="เลือกเครื่องจักร"
                  searchEnabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เฟส *</label>
                <DxSelectBox
                  dataSource={phases}
                  displayExpr="label"
                  valueExpr="value"
                  value={equipmentForm.phase}
                  onValueChanged={(e) => setEquipmentForm({ ...equipmentForm, phase: e.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับ</label>
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
                <span className="text-sm text-gray-700">จำเป็นสำหรับการผลิต</span>
              </div>
            </>
          )}

          {/* Condition Form */}
          {dialogType === 'condition' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">โปรไฟล์สภาวะแวดล้อม *</label>
                <DxSelectBox
                  dataSource={(conditions || []).filter(c => c.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={conditionForm.conditionId}
                  onValueChanged={(e) => setConditionForm({ ...conditionForm, conditionId: e.value })}
                  placeholder="เลือกโปรไฟล์สภาวะแวดล้อม"
                  searchEnabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เฟส *</label>
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
                    <strong>โปรไฟล์ที่เลือก:</strong>{' '}
                    {conditions?.find(c => c.id === conditionForm.conditionId)?.name}
                  </p>
                  <p className="text-sm text-teal-700 mt-1">
                    อุณหภูมิ: {conditions?.find(c => c.id === conditionForm.conditionId)?.temperatureMin}-
                    {conditions?.find(c => c.id === conditionForm.conditionId)?.temperatureMax}°C |
                    ความชื้นสูงสุด: ≤{conditions?.find(c => c.id === conditionForm.conditionId)?.humidityMax}% RH
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
                  จากเทมเพลต <span className="text-gray-400">(ไม่บังคับ)</span>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อขั้นตอน (TH) *</label>
                  <DxTextBox
                    value={sopForm.stepNameTh}
                    onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, stepNameTh: e.value }))}
                    placeholder="เช่น ผสมส่วนผสม"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อขั้นตอน (EN) <span className="text-gray-400">(ไม่บังคับ)</span>
                  </label>
                  <DxTextBox
                    value={sopForm.stepName}
                    onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, stepName: e.value }))}
                    placeholder="เช่น Mix ingredients"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำแนะนำ (TH)</label>
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
                  <span className="ml-auto text-xs text-gray-400 font-normal">คำแนะนำ (EN), พารามิเตอร์ JSON</span>
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">คำแนะนำ (EN)</label>
                    <DxTextArea
                      value={sopForm.instructions}
                      onValueChanged={(e) => setSOPForm((prev) => ({ ...prev, instructions: e.value }))}
                      height={60}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">พารามิเตอร์ (JSON)</label>
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
                <span className="text-sm text-gray-700">ต้องมีการตรวจสอบยืนยันโดยหัวหน้างาน</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เฟส *</label>
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
                  // Selection list = IPCs declared at THIS BOM's phase level only.
                  const availablePendingCriteria = bomPhaseIpcCriteria.filter((c: any) => !criteriaUsedForThisSlot.has(c.id));

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
                      toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกเกณฑ์ IPC');
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
                              {criterion?.nameTh || criterion?.name || 'ไม่ทราบเกณฑ์'}
                            </span>
                            {entry.isCritical && (
                              <span className="text-[10px] text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-200">
                                วิกฤต
                              </span>
                            )}
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                              ยังไม่บันทึก
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ตัวอย่าง: {entry.sampleSize}
                            {entry.maxRetestRounds != null && <span> · ทดสอบซ้ำสูงสุด: {entry.maxRetestRounds}</span>}
                            {entry.notes && <span> · {entry.notes}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => editPendingEntry(entry)}
                            className="p-1 text-gray-400 hover:text-emerald-700"
                            title="แก้ไข"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePendingEntry(entry.tempId)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="ลบ"
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
                          การทดสอบ IPC ตามขั้นตอนย่อย ({pendingIpcLinks.length})
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
                            <label className="block text-xs font-medium text-gray-700 mb-1">เกณฑ์ IPC *</label>
                            {bomPhaseIpcCriteria.length === 0 ? (
                              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 space-y-2">
                                <p>ยังไม่มี IPC ที่กำหนดใน Phase Level ของ BOM นี้</p>
                                <p className="text-[11px] text-amber-700">ต้องกำหนด IPC ที่ Phase Level ก่อน แล้วจึงเลือกมาผูกกับ SOP step</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddDialog(false);
                                    setActiveTab(4);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
                                >
                                  ไปที่ Tab IPC — Phase Level ทันที →
                                </button>
                              </div>
                            ) : (
                              <DxSelectBox
                                dataSource={availablePendingCriteria.map((c: any) => ({
                                  id: c.id,
                                  display: (() => {
                                    const inline = formatSpecInline({
                                      criteriaType: c.criteriaType,
                                      specification: c.specification,
                                      minValue: c.minValue,
                                      maxValue: c.maxValue,
                                      unit: c.unit,
                                    });
                                    return `${c.code} — ${c.nameTh || c.name}${inline ? ` (${inline})` : ''}`;
                                  })(),
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
                                placeholder="เลือกเกณฑ์ IPC"
                                searchEnabled
                              />
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">ลำดับ</label>
                              <DxNumberBox
                                value={pendingIpcForm.sequence}
                                onValueChanged={(e) => setPendingIpcForm((f) => ({ ...f, sequence: e.value ?? 1 }))}
                                min={1}
                                showSpinButtons
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">ขนาดตัวอย่าง</label>
                              <DxNumberBox
                                value={pendingIpcForm.sampleSize}
                                onValueChanged={(e) => setPendingIpcForm((f) => ({ ...f, sampleSize: e.value ?? 1 }))}
                                min={1}
                                showSpinButtons
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">ทดสอบซ้ำสูงสุด</label>
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
                                placeholder="ค่าเริ่มต้น"
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
                            <span className="text-xs text-gray-700">วิกฤต (หากไม่ผ่านต้องแจ้ง QA ตรวจสอบ)</span>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">หมายเหตุ</label>
                            <DxTextArea
                              value={pendingIpcForm.notes}
                              onValueChanged={(e) => setPendingIpcForm((f) => ({ ...f, notes: e.value ?? '' }))}
                              height={48}
                              placeholder="ไม่บังคับ"
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
                        การทดสอบ IPC ตามขั้นตอนย่อย ({stepLinks.length})
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
                        กำลังโหลดขั้นตอนย่อย... หรือเทมเพลตนี้ไม่มีขั้นตอนย่อย
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
                                        <span className="text-[10px] text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-200">วิกฤต</span>
                                      )}
                                      <span className="text-gray-500">· ตัวอย่าง: {link.sampleSize}</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ QC *</label>
                <DxSelectBox
                  dataSource={(qcCriteria || []).filter(q => q.isActive) as unknown as Record<string, unknown>[]}
                  displayExpr="name"
                  valueExpr="id"
                  value={qcForm.criteriaId}
                  onValueChanged={(e) => setQCForm({ ...qcForm, criteriaId: e.value })}
                  placeholder="เลือกเกณฑ์ QC"
                  searchEnabled
                />
              </div>
              {qcForm.criteriaId > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="text-sm text-emerald-800">
                    <strong>เกณฑ์ที่เลือก:</strong>{' '}
                    {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.name}
                  </p>
                  <p className="text-sm text-emerald-700 mt-1">
                    น้ำหนัก: {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.weightMin}-
                    {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.weightMax}g |
                    ตัวอย่าง: {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.sampleSize} หน่วย |
                    จำนวนที่ไม่ผ่านสูงสุด: {qcCriteria?.find(q => q.id === qcForm.criteriaId)?.maxFailures}
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
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => {
                setShowAddDialog(false);
                setEditingId(null);
                setPendingIpcLinks([]);
                resetPendingIpcForm();
              }}
            />
            <DxButton
              text={editingId ? 'บันทึก' : 'เพิ่ม'}
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
        title={selectedStepForIPC ? `การทดสอบ IPC — ขั้นตอนที่ ${selectedStepForIPC.sequence}: ${selectedStepForIPC.stepNameTh || selectedStepForIPC.stepName}` : 'การทดสอบ IPC'}
        width={780}
        height="90vh"
        showCloseButton
        dragEnabled={false}
      >
        <div className="flex flex-col h-full">
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {selectedStepForIPC && (() => {
            const stepLinks = bomStepIpcLinks.filter((l: any) => l.bomStepId === selectedStepForIPC.id);
            const linkedCriteriaIds = new Set(stepLinks.map((l: any) => l.criteriaId));
            const editingLink = editingIpcLinkId ? stepLinks.find((l: any) => l.id === editingIpcLinkId) : null;
            // Selection source = phase-level IPCs of THIS BOM. If editing a
            // legacy link whose criterion is no longer in phase config,
            // keep it visible so the dropdown still shows the current value.
            const phaseIpcsForLinker = (() => {
              if (editingLink && !bomPhaseIpcCriteria.some((c: any) => c.id === editingLink.criteriaId)) {
                const fromMaster = ipcCriteriaMaster.find((c: any) => c.id === editingLink.criteriaId);
                if (fromMaster) return [...bomPhaseIpcCriteria, fromMaster];
              }
              return bomPhaseIpcCriteria;
            })();
            // When editing, show all phase-level IPCs; otherwise filter out
            // ones already linked to this step.
            const availableCriteria = phaseIpcsForLinker.filter((c: any) =>
              editingIpcLinkId ? true : !linkedCriteriaIds.has(c.id)
            );

            // Group existing IPC links by procedureStepId (sub-step). null
            // = not tied to any specific sub-step ("whole step" IPCs).
            const linksBySubStep = new Map<number | null, any[]>();
            for (const link of stepLinks) {
              const key = link.procedureStepId ?? null;
              if (!linksBySubStep.has(key)) linksBySubStep.set(key, []);
              linksBySubStep.get(key)!.push(link);
            }

            // Render a single IPC link row (used by both grouped and ungrouped views).
            const renderLinkRow = (link: any) => {
              const linkLines = formatSpecSummary({
                criteriaType: link.criteriaType || 'numeric',
                specification: link.specification,
                sampleSize: link.sampleSize,
                minValue: link.minValue,
                maxValue: link.maxValue,
                unit: link.unit,
              });
              return (
              <div key={link.id} className={`flex items-start gap-3 p-3 rounded-lg border bg-white group ${editingIpcLinkId === link.id ? 'border-emerald-400 bg-emerald-50/40' : 'border-gray-200'}`}>
                <span className="flex-none w-7 h-7 rounded bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center mt-0.5">
                  {link.sequence}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-emerald-700">{link.criteriaCode}</span>
                    <span className="font-medium">{link.criteriaNameTh || link.criteriaName}</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      {getCriteriaTypeLabel(link.criteriaType || 'numeric')}
                    </span>
                    {link.isCritical && (
                      <span className="text-xs text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">วิกฤต</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {linkLines.map((ln: { icon: string; text: string; tone?: string }, i: number) => (
                      <div
                        key={i}
                        className={`text-xs flex items-start gap-1.5 ${
                          ln.tone === 'pass' ? 'text-emerald-700'
                          : ln.tone === 'fail' ? 'text-rose-700'
                          : ln.tone === 'meta' ? 'text-gray-500'
                          : 'text-gray-700'
                        }`}
                      >
                        <span className="flex-none w-4 text-center select-none">{ln.icon}</span>
                        <span className="break-words">{ln.text}</span>
                      </div>
                    ))}
                    <div className="text-xs text-gray-500 flex items-start gap-1.5">
                      <span className="flex-none w-4 text-center select-none">↻</span>
                      <span>ทดสอบซ้ำสูงสุด: {link.maxRetestRounds != null
                        ? link.maxRetestRounds
                        : <span className="italic">ค่าเริ่มต้นจาก Master ({link.masterMaxRetestRounds ?? '—'})</span>}
                      </span>
                    </div>
                  </div>
                  {link.notes && (
                    <div className="text-xs text-gray-600 mt-1 italic">{link.notes}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditIpcLink(link)}
                    className="p-1 text-gray-400 hover:text-emerald-700"
                    title="แก้ไข"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm('ลบการผูก IPC นี้?')) deleteIpcLinkMutation.mutate(link.id); }}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="ลบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              );
            };

            return (
              <>
                {/* Step header summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">ขั้นตอน SOP</div>
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
                        การทดสอบ IPC ตามขั้นตอนย่อย ({stepLinks.length})
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
                        การทดสอบ IPC ({stepLinks.length})
                      </h4>
                    </div>
                    {stepIpcLinksLoading ? (
                      <div className="text-center py-4 text-gray-400 text-sm">กำลังโหลด...</div>
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
                      {editingIpcLinkId ? 'แก้ไขการผูก IPC' : 'เพิ่มการทดสอบ IPC'}
                    </h4>
                    {editingIpcLinkId && (
                      <button
                        onClick={resetIpcLinkForm}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        ยกเลิกการแก้ไข
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ IPC *</label>
                      {bomPhaseIpcCriteria.length === 0 ? (
                        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2.5 space-y-2">
                          <p>ยังไม่มี IPC ที่กำหนดใน Phase Level ของ BOM นี้</p>
                          <p className="text-xs text-amber-700">ต้องกำหนด IPC ที่ Phase Level ก่อน แล้วจึงเลือกมาผูกกับ SOP step</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStepForIPC(null);
                              setActiveTab(4);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
                          >
                            ไปที่ Tab IPC — Phase Level ทันที →
                          </button>
                        </div>
                      ) : (
                        <DxSelectBox
                          dataSource={availableCriteria.map((c: any) => ({
                            id: c.id,
                            display: (() => {
                              const inline = formatSpecInline({
                                criteriaType: c.criteriaType,
                                specification: c.specification,
                                minValue: c.minValue,
                                maxValue: c.maxValue,
                                unit: c.unit,
                              });
                              return `${c.code} — ${c.nameTh || c.name}${inline ? ` (${inline})` : ''}`;
                            })(),
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
                          placeholder="เลือกเกณฑ์ IPC"
                          searchEnabled
                        />
                      )}
                    </div>
                  )}
                  {editingIpcLinkId && editingLink && (
                    <div className="text-sm font-medium text-gray-700">
                      กำลังแก้ไข: <span className="font-mono text-xs text-emerald-700">{editingLink.criteriaCode}</span> {editingLink.criteriaNameTh || editingLink.criteriaName}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับ</label>
                      <DxNumberBox
                        value={ipcLinkForm.sequence}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, sequence: e.value ?? 1 }))}
                        min={1}
                        showSpinButtons
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ขนาดตัวอย่าง</label>
                      <DxNumberBox
                        value={ipcLinkForm.sampleSize}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, sampleSize: e.value ?? 1 }))}
                        min={1}
                        showSpinButtons
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนรอบทดสอบซ้ำสูงสุด</label>
                      <DxNumberBox
                        value={ipcLinkForm.maxRetestRounds ?? null}
                        onValueChanged={(e) => setIpcLinkForm((f) => ({
                          ...f,
                          maxRetestRounds: e.value === null || e.value === undefined ? null : Number(e.value),
                        }))}
                        min={0}
                        showClearButton
                        placeholder="ใช้ค่าเริ่มต้นจาก Master"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DxSwitch
                      value={ipcLinkForm.isCritical}
                      onValueChanged={(e: SwitchTypes.ValueChangedEvent) => setIpcLinkForm((f) => ({ ...f, isCritical: e.value ?? false }))}
                    />
                    <span className="text-sm text-gray-700">วิกฤต (หากไม่ผ่านต้องแจ้ง QA ตรวจสอบ)</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                    <DxTextArea
                      value={ipcLinkForm.notes}
                      onValueChanged={(e) => setIpcLinkForm((f) => ({ ...f, notes: e.value ?? '' }))}
                      height={60}
                      placeholder="ไม่บังคับ — คำแนะนำพิเศษสำหรับการทดสอบ IPC ของขั้นตอนนี้"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
                    <DxButton
                      text={editingIpcLinkId ? 'บันทึกการแก้ไข' : 'เพิ่ม IPC'}
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

              </>
            );
          })()}
        </div>
        {/* Sticky footer — Close button always visible regardless of how
            long the IPC list grows. Without flex+sticky the button slid
            off-screen on tall lists and the operator had no way to
            dismiss the dialog except via the header X. */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-white shrink-0">
          <DxButton
            text="ปิด"
            stylingMode="outlined"
            onClick={() => { setShowIPCLinkDialog(false); resetIpcLinkForm(); setSelectedStepForIPC(null); }}
          />
        </div>
        </div>
      </DxPopup>

      {/* Copy Configuration Dialog */}
      <DxPopup
        visible={showCopyDialog}
        onHiding={() => setShowCopyDialog(false)}
        title="คัดลอกการตั้งค่าจากสูตรการผลิตอื่น"
        width={500}
        height="auto"
        showCloseButton
        dragEnabled={false}
      >
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-sm text-emerald-900 leading-relaxed">
            <p className="font-semibold mb-0.5">คัดลอกการตั้งค่าจาก BOM อื่น</p>
            <p className="text-xs text-emerald-800">
              ดึงการตั้งค่าทั้งหมด (ห้องผลิต, เครื่องจักร, สภาวะแวดล้อม, ขั้นตอน SOP, QC บรรจุภัณฑ์)
              จาก BOM ที่เลือกมาใส่ BOM นี้ เพื่อไม่ต้องตั้งค่าใหม่ทั้งหมด
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือก BOM ต้นทาง *</label>
            <DxSelectBox
              items={copySourceBoms}
              value={copySourceId}
              onValueChange={(v) => setCopySourceId(v ?? null)}
              valueExpr="id"
              displayExpr="label"
              searchEnabled
              placeholder="ค้นหา/เลือก BOM ที่ต้องการคัดลอกการตั้งค่า"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>คำเตือน:</strong> การตั้งค่าเดิมทั้งหมดของ BOM นี้จะถูกแทนที่ และไม่สามารถย้อนกลับได้
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="ยกเลิก" stylingMode="outlined" onClick={() => { setShowCopyDialog(false); setCopySourceId(null); }} />
            <DxButton
              text={copyConfigMutation.isPending ? 'กำลังคัดลอก...' : 'คัดลอกการตั้งค่า'}
              type="success"
              onClick={() => { if (copySourceId) copyConfigMutation.mutate(copySourceId); }}
              disabled={copyConfigMutation.isPending || !copySourceId}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
