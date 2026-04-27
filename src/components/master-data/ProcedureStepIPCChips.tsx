'use client';

/**
 * IPC Criteria linker for a single Procedure Step.
 *
 * Renders under each step row on the SOP Template edit page. Shows linked
 * criteria with enough detail (code, name, spec, sample size, critical flag)
 * to be useful at a glance — not just tiny chips. Picker popup supports
 * category/search filters.
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Plus,
  X,
  Search,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Gauge,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-checkbox';

interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh?: string | null;
  specification?: string | null;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  specTarget?: number | null;
  sampleSize: number;
  isCritical: boolean;
  criteriaType: string;
}

interface LinkRow {
  id: number;
  procedureStepId: number;
  criteriaId: number;
  sequence: number;
  sampleSize: number;
  isCritical: boolean;
  criteriaCode: string;
  criteriaName: string;
  criteriaNameTh: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  criteriaType: string;
  specTarget: number | null;
}

interface Props {
  templateId: number;
  procedureStepId: number;
}

const formatSpec = (row: LinkRow | IPCCriteria): string => {
  const parts: string[] = [];
  if ('specification' in row && row.specification) return row.specification;
  if (row.specTarget != null) parts.push(`target ${row.specTarget}`);
  if (row.minValue != null) parts.push(`min ${row.minValue}`);
  if (row.maxValue != null) parts.push(`max ${row.maxValue}`);
  if (row.unit) parts.push(row.unit);
  return parts.join(' / ') || '-';
};

export function ProcedureStepIPCChips({ templateId, procedureStepId }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [showPicker, setShowPicker] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [showCriticalOnly, setShowCriticalOnly] = React.useState(false);

  const linkKey = ['procedure-step-ipc', procedureStepId];

  const { data: links = [] } = useQuery<LinkRow[]>({
    queryKey: linkKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/master-data/sop-templates/${templateId}/steps/${procedureStepId}/ipc-criteria`
      );
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data as LinkRow[];
    },
  });

  const { data: allCriteria = [] } = useQuery<IPCCriteria[]>({
    queryKey: ['ipc-criteria-master'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria?limit=500');
      const j = await res.json();
      if (!j.success) return [];
      return (j.data?.items || j.data || []) as IPCCriteria[];
    },
    enabled: showPicker,
  });

  const addMutation = useMutation({
    mutationFn: async (criteria: IPCCriteria) => {
      const res = await fetch(
        `/api/master-data/sop-templates/${templateId}/steps/${procedureStepId}/ipc-criteria`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            criteriaId: criteria.id,
            sequence: links.length + 1,
            sampleSize: criteria.sampleSize || 1,
            isCritical: criteria.isCritical || false,
          }),
        }
      );
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkKey });
      toast.success('เพิ่ม IPC', 'ผูก IPC criteria กับขั้นตอนสำเร็จ');
    },
    onError: (err: Error) => toast.error('Error', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ linkId, patch }: { linkId: number; patch: Partial<LinkRow> }) => {
      const res = await fetch(
        `/api/master-data/sop-templates/${templateId}/steps/${procedureStepId}/ipc-criteria`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId, ...patch }),
        }
      );
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkKey });
    },
    onError: (err: Error) => toast.error('Error', err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (linkId: number) => {
      const res = await fetch(
        `/api/master-data/sop-templates/${templateId}/steps/${procedureStepId}/ipc-criteria?linkId=${linkId}`,
        { method: 'DELETE' }
      );
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linkKey });
    },
    onError: (err: Error) => toast.error('Error', err.message),
  });

  const linkedIds = new Set(links.map((l) => l.criteriaId));
  const filtered = allCriteria.filter((c) => {
    if (linkedIds.has(c.id)) return false;
    if (showCriticalOnly && !c.isCritical) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.nameTh || '').toLowerCase().includes(q) ||
      (c.specification || '').toLowerCase().includes(q)
    );
  });

  const criticalCount = links.filter((l) => l.isCritical).length;

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-emerald-100">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
            IPC ที่ต้องตรวจ
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium">
            {links.length}
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-xs font-medium">
              <AlertTriangle className="h-3 w-3" />
              Critical {criticalCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่ม IPC
        </button>
      </div>

      {/* Linked IPC list — card rows */}
      {links.length === 0 ? (
        <div className="text-xs text-gray-400 italic py-2 px-3 rounded bg-gray-50/50">
          ยังไม่มี IPC criteria ผูกไว้ — คลิก &quot;เพิ่ม IPC&quot; เพื่อเลือก
        </div>
      ) : (
        <div className="space-y-1.5">
          {links.map((row) => (
            <div
              key={row.id}
              className={`grid grid-cols-1 md:grid-cols-[minmax(180px,1.6fr)_minmax(120px,1fr)_90px_80px_36px] md:items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                row.isCritical
                  ? 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/60'
                  : 'border-gray-200 bg-white hover:bg-emerald-50/30'
              }`}
            >
              {/* Col 1: code + name */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {row.criteriaCode}
                  </span>
                  {row.isCritical && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Critical
                    </span>
                  )}
                </div>
                <div
                  className="text-sm font-medium text-gray-900 mt-0.5 truncate"
                  title={row.criteriaNameTh || row.criteriaName}
                >
                  {row.criteriaNameTh || row.criteriaName}
                </div>
              </div>

              {/* Col 2: spec + type */}
              <div className="text-xs text-gray-600 min-w-0">
                <div className="truncate" title={formatSpec(row)}>
                  <span className="text-gray-400">Spec:</span> {formatSpec(row)}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                  {row.criteriaType === 'checkbox' ? 'Checkbox' : 'Numeric'}
                </div>
              </div>

              {/* Col 3: sample size editor */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5 md:hidden">
                  Sample size
                </label>
                <div className="flex items-center gap-1">
                  <Gauge className="h-3 w-3 text-gray-400 hidden md:inline" />
                  <DxNumberBox
                    value={row.sampleSize}
                    min={1}
                    onValueChange={(v) =>
                      updateMutation.mutate({
                        linkId: row.id,
                        patch: { sampleSize: Number(v) || 1 },
                      })
                    }
                  />
                </div>
              </div>

              {/* Col 4: critical toggle */}
              <div className="flex items-center gap-1.5">
                <DxCheckBox
                  value={row.isCritical}
                  onValueChange={(v) =>
                    updateMutation.mutate({
                      linkId: row.id,
                      patch: { isCritical: !!v },
                    })
                  }
                />
                <span className="text-xs text-gray-500">Critical</span>
              </div>

              {/* Col 5: remove */}
              <button
                type="button"
                onClick={() => removeMutation.mutate(row.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors md:justify-self-center"
                title="ลบ IPC นี้"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Picker modal */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPicker(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-emerald-600" />
                  เลือก IPC Criteria
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  IPC ที่เพิ่มจะแสดงให้ operator กรอกค่าในหน้าบันทึก WO ของขั้นตอนนี้
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="p-1.5 rounded hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาด้วย code ชื่อ หรือ specification..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCriticalOnly}
                  onChange={(e) => setShowCriticalOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  แสดงเฉพาะ Critical
                </span>
              </label>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {search || showCriticalOnly
                      ? 'ไม่พบ criteria ที่ตรงกับเงื่อนไข'
                      : 'ไม่มี criteria ให้เพิ่ม (หรือผูกครบแล้ว)'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        addMutation.mutate(c);
                        setShowPicker(false);
                        setSearch('');
                      }}
                      className="w-full text-left p-3 hover:bg-emerald-50 transition-colors flex items-start gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {c.code}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {c.nameTh || c.name}
                          </span>
                          {c.isCritical && (
                            <span className="inline-flex items-center gap-1 text-xs bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              Critical
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                            {c.criteriaType === 'checkbox' ? 'Checkbox' : 'Numeric'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span>
                            <span className="text-gray-400">Spec:</span> {formatSpec(c)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Gauge className="h-3 w-3" />
                            Sample: {c.sampleSize}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Plus className="h-4 w-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 rounded-b-xl">
                คลิก criteria เพื่อผูกกับขั้นตอนนี้ · {filtered.length} รายการที่ยังไม่ได้ผูก
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
