'use client';

/**
 * Inspection Templates — list + edit + delete page.
 *
 * The inspections page (/environmental/inspections) only exposes a
 * "+ Template" creation popup; templates created there had no list view
 * and no way to edit. This page closes that gap: shows every template
 * (active + inactive), lets QA edit name / target / items in-place, and
 * supports soft-delete (sets isActive=false via the existing DELETE
 * endpoint).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Pencil, Trash2, Plus } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared';
import {
  INSPECTION_TARGET_TYPES,
  type InspectionTargetType,
  type InspectionTemplate,
  type InspectionTemplateItem,
} from '@/types/environmental-monitoring';

interface ItemForm {
  label: string;
  parameter: string;
  unit: string;
  specMin: number | '';
  specMax: number | '';
  isMandatory: boolean;
  sortOrder: number;
}

interface TmplForm {
  name: string;
  description: string;
  targetType: InspectionTargetType;
  items: ItemForm[];
}

const blankItem = (sortOrder: number): ItemForm => ({
  label: '',
  parameter: '',
  unit: '',
  specMin: '',
  specMax: '',
  isMandatory: true,
  sortOrder,
});

const blankForm: TmplForm = {
  name: '',
  description: '',
  targetType: 'room',
  items: [blankItem(1)],
};

// Standard environmental parameters operators can pick from a dropdown instead
// of typing a free-text technical key. Choosing one auto-fills a sensible
// default label + unit (still editable). "custom" lets them define their own.
const PARAM_PRESETS: Array<{ value: string; labelKey: string; defaultLabel: string; unit: string }> = [
  { value: 'temperature', labelKey: 'temperature', defaultLabel: 'อุณหภูมิ', unit: '°C' },
  { value: 'humidity', labelKey: 'humidity', defaultLabel: 'ความชื้นสัมพัทธ์', unit: '%RH' },
  { value: 'differential_pressure', labelKey: 'pressure', defaultLabel: 'ความดันต่าง', unit: 'Pa' },
  { value: 'cleanliness', labelKey: 'cleanliness', defaultLabel: 'ความสะอาด', unit: '' },
  { value: 'light', labelKey: 'light', defaultLabel: 'ความสว่าง', unit: 'lux' },
  { value: 'ph', labelKey: 'ph', defaultLabel: 'ค่า pH', unit: '' },
  { value: 'conductivity', labelKey: 'conductivity', defaultLabel: 'ค่าการนำไฟฟ้า', unit: 'µS/cm' },
  { value: 'tds', labelKey: 'tds', defaultLabel: 'TDS', unit: 'ppm' },
  { value: 'custom', labelKey: 'custom', defaultLabel: '', unit: '' },
];

// Distinct badge colour per location type so the column is scannable at a glance.
const TARGET_TYPE_BADGE: Record<string, string> = {
  room: 'bg-indigo-100 text-indigo-900',
  storage_area: 'bg-amber-100 text-amber-900',
  quarantine: 'bg-rose-100 text-rose-900',
  water_point: 'bg-sky-100 text-sky-900',
};

export default function TemplatesPage() {
  const t = useTranslations('premises');
  const targetLabel = (v: InspectionTargetType) => t('environmental.common.targetType.' + v);
  const qc = useQueryClient();
  const toast = useToast();

  const [editing, setEditing] = useState<InspectionTemplate | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [form, setForm] = useState<TmplForm>(blankForm);
  // Register filters: area type + active status + free-text search (client-side).
  const [typeFilter, setTypeFilter] = useState<'all' | InspectionTargetType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchText, setSearchText] = useState('');

  const { data: templates = [], isLoading, refetch } = useQuery<InspectionTemplate[]>({
    queryKey: ['env-templates-all'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/templates');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const filteredTemplates = templates.filter((tpl) => {
    if (typeFilter !== 'all' && tpl.targetType !== typeFilter) return false;
    if (statusFilter === 'active' && !tpl.isActive) return false;
    if (statusFilter === 'inactive' && tpl.isActive) return false;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      if (
        !tpl.name?.toLowerCase().includes(q) &&
        !(tpl.description ?? '').toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        targetType: editing.targetType,
        items: editing.items.map((it, idx) => ({
          label: it.label,
          parameter: it.parameter,
          unit: it.unit ?? '',
          specMin: it.specMin ?? '',
          specMax: it.specMax ?? '',
          isMandatory: it.isMandatory,
          sortOrder: it.sortOrder || idx + 1,
        })),
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

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        targetType: form.targetType,
        items: form.items
          .filter((it) => it.label.trim().length > 0)
          .map((it, idx) => ({
            label: it.label.trim(),
            parameter: it.parameter.trim() || it.label.trim().toLowerCase().replace(/\s+/g, '_'),
            unit: it.unit.trim() || null,
            specMin: it.specMin === '' ? null : Number(it.specMin),
            specMax: it.specMax === '' ? null : Number(it.specMax),
            isMandatory: it.isMandatory,
            sortOrder: idx + 1,
          })),
      };
      const url = editing
        ? `/api/environmental/templates/${editing.id}`
        : `/api/environmental/templates`;
      const method = editing ? 'PUT' : 'POST';
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
      qc.invalidateQueries({ queryKey: ['env-templates-all'] });
      qc.invalidateQueries({ queryKey: ['env-templates'] });
      toast.success(editing ? t('environmental.templates.updatedToast') : t('environmental.templates.createdToast'));
      closePopup();
    },
    onError: (e: Error) => toast.error(t('environmental.common.failedToast'), e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/environmental/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['env-templates-all'] });
      qc.invalidateQueries({ queryKey: ['env-templates'] });
      toast.success(t('environmental.templates.deactivatedToast'));
    },
    onError: (e: Error) => toast.error(t('environmental.common.deleteFailedToast'), e.message),
  });

  const handleDelete = (row: InspectionTemplate) => {
    if (!confirm(t('environmental.templates.deleteConfirm', { name: row.name }))) return;
    deleteMut.mutate(row.id);
  };

  const stats = useMemo(() => {
    const active = templates.filter((tpl) => tpl.isActive).length;
    return { total: templates.length, active, inactive: templates.length - active };
  }, [templates]);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: t('environmental.common.breadcrumb.premises'), href: '/premises' },
          { label: t('environmental.common.breadcrumb.environmental'), href: '/premises/environmental/inspections' },
          { label: t('environmental.templates.breadcrumb') },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" /> {t('environmental.templates.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('environmental.templates.subtitle')}
          </p>
        </div>
        <Button icon="refresh" text={t('environmental.common.refresh')} onClick={() => refetch()} />
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900">
        <span className="font-medium">{t('environmental.templates.infoTitle')}</span> {t('environmental.templates.infoBody')}{' '}
        <Link href="/premises/environmental/schedules" className="underline font-medium">{t('environmental.templates.infoLink')}</Link>
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
            <Plus className="w-4 h-4" /> {t('environmental.templates.createNew')}
          </span>
        </Button>
      </div>

      {/* Filter bar — area type, status, free-text search. */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('environmental.templates.usedWithAreaTypeColumn')}</label>
          <SelectBox
            width={180}
            value={typeFilter}
            onValueChanged={(e) => setTypeFilter(e.value)}
            valueExpr="value"
            displayExpr="label"
            items={[
              { value: 'all', label: t('environmental.templates.filterAllTypes') },
              ...INSPECTION_TARGET_TYPES.map((v) => ({ value: v, label: targetLabel(v) })),
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('environmental.common.statusColumn')}</label>
          <SelectBox
            width={150}
            value={statusFilter}
            onValueChanged={(e) => setStatusFilter(e.value)}
            valueExpr="value"
            displayExpr="label"
            items={[
              { value: 'all', label: t('environmental.templates.filterAllTypes') },
              { value: 'active', label: t('environmental.templates.filterActive') },
              { value: 'inactive', label: t('environmental.templates.filterInactive') },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500">{t('environmental.templates.filterSearch')}</label>
          <TextBox
            value={searchText}
            onValueChanged={(e) => setSearchText(e.value ?? '')}
            placeholder={t('environmental.templates.filterSearchPlaceholder')}
            showClearButton
            mode="search"
            inputAttr={{ autoComplete: 'off', name: 'tpl-search', 'data-lpignore': 'true', 'data-form-type': 'other' }}
          />
        </div>
      </div>

      <DataGrid
        dataSource={filteredTemplates}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? t('environmental.common.loading') : t('environmental.templates.noData')}
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} defaultSortOrder="asc" />
        <Column dataField="name" caption={t('environmental.templates.nameColumn')} />
        <Column
          caption={t('environmental.templates.usedWithAreaTypeColumn')}
          dataField="targetType"
          width={160}
          cellRender={(c) => (
            <Badge className={TARGET_TYPE_BADGE[c.value as string] ?? 'bg-gray-100 text-gray-700'}>
              {targetLabel(c.value)}
            </Badge>
          )}
        />
        <Column
          caption={t('environmental.templates.itemCountColumn')}
          width={120}
          cellRender={(c) => (c.data as InspectionTemplate).items.length}
        />
        <Column dataField="description" caption={t('environmental.templates.descriptionColumn')} />
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
            const row = c.data as InspectionTemplate;
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
                      <Trash2 className="w-3 h-3" /> {t('environmental.templates.closeAction')}
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
        title={editing ? t('environmental.templates.popupEditTitle', { name: editing.name }) : t('environmental.templates.popupCreateTitle')}
        width={760}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.templates.fieldName')}</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('environmental.templates.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.templates.fieldDescription')}</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('environmental.templates.descriptionPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('environmental.templates.fieldTargetType')}</label>
            <p className="text-xs text-gray-500 mb-1">
              {t('environmental.templates.targetTypeHint')}
            </p>
            <SelectBox
              dataSource={INSPECTION_TARGET_TYPES.map((v) => ({ value: v, label: targetLabel(v) }))}
              valueExpr="value"
              displayExpr="label"
              value={form.targetType}
              disabled={!!editing}
              onValueChanged={(e) => setForm({ ...form, targetType: e.value as InspectionTargetType })}
            />
            {editing && (
              <p className="text-xs text-gray-500 mt-1">
                {t('environmental.templates.targetTypeLockedHint')}
              </p>
            )}
          </div>
          <div className="border-t pt-3">
            <div className="font-medium text-sm mb-1">{t('environmental.templates.itemsHeading')}</div>
            <p className="text-xs text-gray-500 mb-2">{t('environmental.templates.itemsHint')}</p>
            {/* Column headers so each field's purpose is clear */}
            <div className="grid grid-cols-12 gap-2 mb-1 px-1 text-[11px] font-medium text-gray-500">
              <div className="col-span-3">{t('environmental.templates.colLabel')}</div>
              <div className="col-span-2">{t('environmental.templates.colParameter')}</div>
              <div className="col-span-1">{t('environmental.templates.colUnit')}</div>
              <div className="col-span-2">{t('environmental.templates.colMin')}</div>
              <div className="col-span-2">{t('environmental.templates.colMax')}</div>
              <div className="col-span-1">{t('environmental.templates.colMandatory')}</div>
              <div className="col-span-1"></div>
            </div>
            {form.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                <input
                  className="col-span-3 border rounded px-2 py-1 text-sm"
                  placeholder={t('environmental.templates.itemLabelPlaceholder')}
                  value={it.label}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                />
                {/* Parameter as a dropdown of standard env parameters. Picking one
                    auto-fills a default label (if empty) + unit, so operators don't
                    have to know technical keys. "custom" keeps free entry. */}
                <select
                  className="col-span-2 border rounded px-2 py-1 text-sm bg-white"
                  value={PARAM_PRESETS.some((p) => p.value === it.parameter) ? it.parameter : 'custom'}
                  onChange={(e) => {
                    const preset = PARAM_PRESETS.find((p) => p.value === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              parameter: e.target.value === 'custom' ? '' : e.target.value,
                              label: x.label || preset?.defaultLabel || x.label,
                              unit: x.unit || preset?.unit || x.unit,
                            }
                          : x,
                      ),
                    }));
                  }}
                >
                  {PARAM_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {t(`environmental.templates.param.${p.labelKey}` as never)}
                    </option>
                  ))}
                </select>
                <input
                  className="col-span-1 border rounded px-2 py-1 text-sm"
                  placeholder={t('environmental.templates.itemUnitPlaceholder')}
                  value={it.unit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)),
                    }))
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  className="col-span-2 border rounded px-2 py-1 text-sm"
                  placeholder={t('environmental.templates.itemMinPlaceholder')}
                  value={it.specMin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) =>
                        i === idx ? { ...x, specMin: e.target.value === '' ? '' : Number(e.target.value) } : x,
                      ),
                    }))
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  className="col-span-2 border rounded px-2 py-1 text-sm"
                  placeholder={t('environmental.templates.itemMaxPlaceholder')}
                  value={it.specMax}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.map((x, i) =>
                        i === idx ? { ...x, specMax: e.target.value === '' ? '' : Number(e.target.value) } : x,
                      ),
                    }))
                  }
                />
                <label className="col-span-1 inline-flex items-center text-xs gap-1">
                  <input
                    type="checkbox"
                    checked={it.isMandatory}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        items: prev.items.map((x, i) => (i === idx ? { ...x, isMandatory: e.target.checked } : x)),
                      }))
                    }
                  />
                  {t('environmental.templates.itemMandatory')}
                </label>
                <Button
                  icon="trash"
                  stylingMode="text"
                  onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                />
              </div>
            ))}
            <Button
              text={t('environmental.templates.addItem')}
              stylingMode="text"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  items: [...prev.items, blankItem(prev.items.length + 1)],
                }))
              }
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
                !form.name.trim() ||
                form.items.every((it) => it.label.trim().length === 0) ||
                saveMut.isPending
              }
              onClick={() => saveMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
