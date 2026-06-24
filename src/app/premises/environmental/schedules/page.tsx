'use client';

/**
 * Inspection Schedules — list + edit + delete page.
 *
 * Parallel to /environmental/templates: gives QA a place to list every
 * Schedule, edit cadence/alert/name, and soft-delete one without going
 * back through the create popup. Target type + target id are LOCKED on
 * edit because schedules point at a specific room/area; changing them
 * would orphan past records.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Pencil, Trash2, Plus } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared';
import {
  INSPECTION_TARGET_TYPES,
  INSPECTION_FREQUENCIES,
  type InspectionTargetType,
  type InspectionFrequency,
  type InspectionTemplate,
} from '@/types/environmental-monitoring';

interface ScheduleRow {
  id: number;
  targetType: InspectionTargetType;
  targetId: number;
  targetName: string;
  templateId: number;
  templateName: string;
  frequency: InspectionFrequency;
  alertDaysBefore: number;
  isActive: boolean;
  nextDue: string;
  lastDone: string | null;
}

interface TargetOption {
  id: number;
  name: string;
}

interface FormState {
  targetType: InspectionTargetType;
  targetId: number | null;
  targetName: string;
  templateId: number | null;
  frequency: InspectionFrequency;
  alertDaysBefore: number;
}

const blankForm: FormState = {
  targetType: 'room',
  targetId: null,
  targetName: '',
  templateId: null,
  frequency: 'daily',
  alertDaysBefore: 1,
};

// Distinct badge colour per location type so the column is scannable at a glance.
const TARGET_TYPE_BADGE: Record<string, string> = {
  room: 'bg-indigo-100 text-indigo-900',
  storage_area: 'bg-amber-100 text-amber-900',
  quarantine: 'bg-rose-100 text-rose-900',
  water_point: 'bg-sky-100 text-sky-900',
};

export default function SchedulesPage() {
  const t = useTranslations('premises');
  const targetLabel = (v: InspectionTargetType) => t('environmental.common.targetType.' + v);
  const freqLabel = (f: InspectionFrequency) => t('environmental.common.frequency.' + f);
  const qc = useQueryClient();
  const toast = useToast();

  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);

  const { data: schedData, isLoading, refetch } = useQuery<{ items: ScheduleRow[] }>({
    queryKey: ['env-schedules-all'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/schedules');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
  const schedules = schedData?.items ?? [];

  const { data: templates = [] } = useQuery<InspectionTemplate[]>({
    queryKey: ['env-templates'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/templates');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: targetData = { items: [] } } = useQuery<{ items: TargetOption[] }>({
    queryKey: ['env-targets', form.targetType],
    queryFn: async () => {
      const res = await fetch(`/api/environmental/targets?type=${form.targetType}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: popupOpen,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        targetType: editing.targetType,
        targetId: editing.targetId,
        targetName: editing.targetName,
        templateId: editing.templateId,
        frequency: editing.frequency,
        alertDaysBefore: editing.alertDaysBefore,
      });
      setPopupOpen(true);
    }
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setPopupOpen(true);
  };

  const closePopup = () => {
    setPopupOpen(false);
    setEditing(null);
    setForm(blankForm);
  };

  const templatesForType = templates.filter((tpl) => tpl.targetType === form.targetType && tpl.isActive);

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editing
        ? `/api/environmental/schedules/${editing.id}`
        : `/api/environmental/schedules`;
      const method = editing ? 'PUT' : 'POST';
      const payload = editing
        ? {
            targetName: form.targetName,
            frequency: form.frequency,
            alertDaysBefore: form.alertDaysBefore,
          }
        : {
            targetType: form.targetType,
            targetId: form.targetId,
            targetName: form.targetName,
            templateId: form.templateId,
            frequency: form.frequency,
            alertDaysBefore: form.alertDaysBefore,
          };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Save failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-schedules-all'] });
      qc.invalidateQueries({ queryKey: ['env-schedules'] });
      toast.success(editing ? t('environmental.schedules.updatedToast') : t('environmental.schedules.createdToast'));
      closePopup();
    },
    onError: (e: Error) => toast.error(t('environmental.common.failedToast'), e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/environmental/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-schedules-all'] });
      qc.invalidateQueries({ queryKey: ['env-schedules'] });
      toast.success(t('environmental.schedules.deactivatedToast'));
    },
    onError: (e: Error) => toast.error(t('environmental.common.deleteFailedToast'), e.message),
  });

  const handleDelete = (row: ScheduleRow) => {
    if (!confirm(t('environmental.schedules.deleteConfirm', { name: row.targetName }))) return;
    deleteMut.mutate(row.id);
  };

  const stats = useMemo(() => {
    const active = schedules.filter((s) => s.isActive).length;
    return { total: schedules.length, active, inactive: schedules.length - active };
  }, [schedules]);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: t('environmental.common.breadcrumb.premises'), href: '/premises' },
          { label: t('environmental.common.breadcrumb.environmental'), href: '/premises/environmental/inspections' },
          { label: t('environmental.schedules.breadcrumb') },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6" /> {t('environmental.schedules.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('environmental.schedules.subtitle')}
          </p>
        </div>
        <Button icon="refresh" text={t('environmental.common.refresh')} onClick={() => refetch()} />
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900 space-y-1">
        <div>
          <span className="font-medium">{t('environmental.schedules.infoTitle')}</span> {t('environmental.schedules.infoBodyPart1')}{' '}
          <span className="font-medium">{t('environmental.schedules.infoBodyPlace')}</span> {t('environmental.schedules.infoBodyTargetSuffix')}{' '}
          <span className="font-medium">{t('environmental.schedules.infoBodyTemplate')}</span> {t('environmental.schedules.infoBodyAnd')}{' '}
          <span className="font-medium">{t('environmental.schedules.infoBodyFreq')}</span>
        </div>
        <div className="text-xs text-sky-800">
          {t('environmental.schedules.infoHint')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('environmental.common.stats.total')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('environmental.common.stats.active')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white border border-gray-200 border-l-4 border-l-gray-500 rounded-[14px] p-4 shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
          <div className="text-xs uppercase text-gray-500">{t('environmental.common.stats.inactive')}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.inactive}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="default" stylingMode="contained" onClick={openCreate}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> {t('environmental.schedules.createNew')}
          </span>
        </Button>
      </div>

      <DataGrid
        dataSource={schedules}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? t('environmental.common.loading') : t('environmental.schedules.noData')}
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} defaultSortOrder="asc" />
        <Column
          caption={t('environmental.schedules.areaTypeColumn')}
          dataField="targetType"
          width={130}
          cellRender={(c) => (
            <Badge className={TARGET_TYPE_BADGE[c.value as string] ?? 'bg-gray-100 text-gray-700'}>
              {targetLabel(c.value)}
            </Badge>
          )}
        />
        <Column dataField="targetName" caption={t('environmental.common.targetColumn')} />
        <Column dataField="templateName" caption={t('environmental.common.templateColumn')} />
        <Column
          dataField="frequency"
          caption={t('environmental.common.frequencyColumn')}
          width={130}
          cellRender={(c) => freqLabel(c.value)}
        />
        <Column dataField="alertDaysBefore" caption={t('environmental.schedules.alertDaysColumn')} width={150} />
        <Column dataField="nextDue" caption={t('environmental.common.nextDueColumn')} dataType="datetime" width={170} />
        <Column dataField="lastDone" caption={t('environmental.common.lastDoneColumn')} dataType="datetime" width={170} />
        <Column
          dataField="isActive"
          caption={t('environmental.common.statusColumn')}
          width={110}
          cellRender={(c) =>
            c.value ? (
              <Badge className="bg-emerald-100 text-emerald-900">{t('environmental.common.badge.active')}</Badge>
            ) : (
              <Badge className="bg-gray-200 text-gray-700">{t('environmental.common.badge.inactive')}</Badge>
            )
          }
        />
        <Column
          caption={t('environmental.common.actionsColumn')}
          width={170}
          cellRender={(c) => {
            const row = c.data as ScheduleRow;
            return (
              <div className="flex gap-1">
                <Button stylingMode="outlined" onClick={() => setEditing(row)}>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Pencil className="w-3 h-3" /> {t('environmental.common.edit')}
                  </span>
                </Button>
                {row.isActive && (
                  <Button stylingMode="text" type="danger" onClick={() => handleDelete(row)}>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Trash2 className="w-3 h-3" /> {t('environmental.schedules.closeAction')}
                    </span>
                  </Button>
                )}
              </div>
            );
          }}
        />
      </DataGrid>

      <Popup
        visible={popupOpen}
        onHiding={closePopup}
        showCloseButton
        title={editing ? t('environmental.schedules.popupEditTitle', { name: editing.targetName }) : t('environmental.schedules.popupCreateTitle')}
        width={620}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.schedules.fieldAreaType')}</label>
            <SelectBox
              dataSource={INSPECTION_TARGET_TYPES.map((v) => ({ value: v, label: targetLabel(v) }))}
              valueExpr="value"
              displayExpr="label"
              value={form.targetType}
              disabled={!!editing}
              onValueChanged={(e) =>
                setForm({ ...form, targetType: e.value as InspectionTargetType, targetId: null, targetName: '', templateId: null })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.schedules.fieldTarget')}</label>
            <p className="text-xs text-gray-500 mb-1">
              {t('environmental.schedules.fieldTargetHint')}
            </p>
            <SelectBox
              dataSource={
                // When editing, make sure the currently-selected target is present
                // in the list even if the async targets query hasn't returned yet
                // (or doesn't include it) — otherwise the disabled box renders empty
                // and looks like the data was lost.
                editing && form.targetId != null && !targetData.items.some((it) => it.id === form.targetId)
                  ? [{ id: form.targetId, name: form.targetName || editing.targetName }, ...targetData.items]
                  : targetData.items
              }
              valueExpr="id"
              displayExpr="name"
              value={form.targetId}
              disabled={!!editing}
              placeholder={t('environmental.schedules.targetPlaceholder', { type: targetLabel(form.targetType) })}
              onValueChanged={(e) => {
                const picked = targetData.items.find((it) => it.id === e.value);
                setForm({ ...form, targetId: e.value ?? null, targetName: picked?.name ?? '' });
              }}
            />
            {!editing && targetData.items.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                {t('environmental.schedules.noTargetWarning', { type: targetLabel(form.targetType) })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.schedules.fieldDisplayName')}</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={form.targetName}
              onChange={(e) => setForm({ ...form, targetName: e.target.value })}
              placeholder={t('environmental.schedules.displayNamePlaceholder')}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('environmental.schedules.displayNameHint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.schedules.fieldTemplate')}</label>
            <SelectBox
              dataSource={templatesForType.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
              valueExpr="value"
              displayExpr="label"
              value={form.templateId}
              disabled={!!editing}
              placeholder={t('environmental.schedules.templatePlaceholder')}
              onValueChanged={(e) => setForm({ ...form, templateId: e.value ?? null })}
            />
            {!editing && templatesForType.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                {t('environmental.schedules.noTemplateWarningPart1', { type: targetLabel(form.targetType) })}{' '}
                <Link href="/premises/environmental/templates" className="underline">{t('environmental.schedules.noTemplateWarningLink')}</Link>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.schedules.fieldFrequency')}</label>
            <SelectBox
              dataSource={INSPECTION_FREQUENCIES.map((f) => ({ value: f, label: freqLabel(f) }))}
              valueExpr="value"
              displayExpr="label"
              value={form.frequency}
              onValueChanged={(e) => setForm({ ...form, frequency: e.value as InspectionFrequency })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.schedules.fieldAlertDays')}</label>
            <NumberBox
              value={form.alertDaysBefore}
              min={0}
              max={365}
              onValueChanged={(e) => setForm({ ...form, alertDaysBefore: e.value ?? 1 })}
            />
          </div>

          {saveMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm">
              {String((saveMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('environmental.common.cancel')} stylingMode="text" onClick={closePopup} />
            <Button
              type="default"
              stylingMode="contained"
              text={editing ? t('environmental.common.saveEdit') : t('environmental.common.create')}
              disabled={
                saveMut.isPending ||
                (!editing && (form.targetId === null || form.templateId === null || form.targetName.trim() === ''))
              }
              onClick={() => saveMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
