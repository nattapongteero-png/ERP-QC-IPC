'use client';
/**
 * Storage Area Environmental Monitoring
 * Audit Q6 — บันทึก/ดู/รับทราบ alert
 */
import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard, ConfirmationDialog } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Thermometer, Droplets, AlertTriangle, CheckCircle2, Bell, Pencil, Trash2 } from 'lucide-react';

interface Warehouse {
  id: number;
  code: string;
  name: string;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
}

interface LogRow {
  id: number;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  readingAt: string;
  temperature: number | null;
  humidity: number | null;
  alertLevel:
    | 'in_spec'
    | 'temp_low'
    | 'temp_high'
    | 'humidity_low'
    | 'humidity_high'
    | 'multiple';
  alertMessage: string | null;
  acknowledgedBy: number | null;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  acknowledgedNotes: string | null;
  notes: string | null;
}

const alertColor = (level: string) =>
  level === 'in_spec'
    ? 'bg-green-100 text-green-700'
    : level === 'multiple'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';

export default function StorageMonitoringPage() {
  const t = useTranslations('premises');
  const alertLabel = (level: string) => {
    const known = [
      'in_spec',
      'temp_low',
      'temp_high',
      'humidity_low',
      'humidity_high',
      'multiple',
    ];
    return known.includes(level)
      ? t(`storageMonitoring.alertLabel.${level}` as any)
      : level;
  };
  const toast = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterWarehouseId, setFilterWarehouseId] = useState<number | null>(null);
  const [alertsOnly, setAlertsOnly] = useState(false);

  const [showLogDialog, setShowLogDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LogRow | null>(null);
  const emptyForm = {
    warehouseId: null as number | null,
    readingAt: '' as string,
    temperature: null as number | null,
    humidity: null as number | null,
    notes: '',
  };
  const [logForm, setLogForm] = useState({ ...emptyForm });

  const [ackDialog, setAckDialog] = useState<{ logId: number; message: string } | null>(null);
  const [ackNotes, setAckNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [whRes, logRes] = await Promise.all([
        fetch('/api/warehouses'),
        fetch(
          `/api/inventory/storage-monitoring?` +
            new URLSearchParams({
              ...(filterWarehouseId ? { warehouseId: String(filterWarehouseId) } : {}),
              ...(alertsOnly ? { alertsOnly: 'true' } : {}),
              limit: '500',
            }),
        ),
      ]);
      const whJson = await whRes.json();
      const logJson = await logRes.json();
      // /api/warehouses returns paginated { data: { items, total, page, ... } };
      // fall back to raw arrays for other shapes.
      const whRaw =
        whJson?.data?.items ?? whJson?.data ?? whJson?.items ?? whJson ?? [];
      setWarehouses(Array.isArray(whRaw) ? whRaw : []);
      const logRaw = logJson?.data ?? logJson ?? [];
      setLogs(Array.isArray(logRaw) ? logRaw : []);
    } catch (e) {
      toast.error(t('storageMonitoring.toast.loadFailed'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWarehouseId, alertsOnly]);

  const stats = useMemo(() => {
    const openAlerts = logs.filter(
      (l) => l.alertLevel !== 'in_spec' && !l.acknowledgedBy,
    ).length;
    const last24h = logs.filter((l) => {
      const d = new Date(l.readingAt).getTime();
      return Date.now() - d < 24 * 3600 * 1000;
    });
    return {
      total: logs.length,
      openAlerts,
      last24h: last24h.length,
      monitoredAreas: new Set(logs.map((l) => l.warehouseId)).size,
    };
  }, [logs]);

  // Newest first (highest id = most recent), numbered so the top row is #1.
  const numberedLogs = useMemo(
    () =>
      [...logs]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [logs],
  );

  // Stable option list for the warehouse SelectBox — a fresh array each render
  // can make DevExtreme drop the currently-selected display value.
  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` })),
    [warehouses],
  );

  const openCreate = () => {
    setEditingId(null);
    setLogForm({ ...emptyForm });
    setShowLogDialog(true);
  };

  const openEdit = (row: LogRow) => {
    setEditingId(row.id);
    setLogForm({
      warehouseId: row.warehouseId,
      readingAt: row.readingAt ? new Date(row.readingAt).toISOString() : '',
      temperature: row.temperature,
      humidity: row.humidity,
      notes: row.notes ?? '',
    });
    setShowLogDialog(true);
  };

  const closeDialog = () => {
    setShowLogDialog(false);
    setEditingId(null);
    setLogForm({ ...emptyForm });
  };

  const submitLog = async () => {
    if (!logForm.warehouseId) {
      toast.error(t('storageMonitoring.toast.selectWarehouse'));
      return;
    }
    if (logForm.temperature == null && logForm.humidity == null) {
      toast.error(t('storageMonitoring.toast.atLeastOneValue'));
      return;
    }
    setSaving(true);
    try {
      const isEdit = editingId != null;
      const res = await fetch(
        isEdit
          ? `/api/inventory/storage-monitoring/${editingId}`
          : '/api/inventory/storage-monitoring',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logForm),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(t('storageMonitoring.toast.saveFailed'), json?.error);
        return;
      }
      const saved = json.data;
      if (saved?.alertLevel && saved.alertLevel !== 'in_spec') {
        toast.error(
          t('storageMonitoring.toast.alertTitle', { label: alertLabel(saved.alertLevel) }),
          saved.alertMessage,
        );
      } else {
        toast.success(
          isEdit
            ? t('storageMonitoring.toast.editedInSpec')
            : t('storageMonitoring.toast.savedInSpec'),
        );
      }
      closeDialog();
      void loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/storage-monitoring/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(t('storageMonitoring.toast.deleteFailed'), j?.error);
        return;
      }
      toast.success(t('storageMonitoring.toast.deleted'));
      setDeleteTarget(null);
      void loadData();
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async () => {
    if (!ackDialog) return;
    const res = await fetch('/api/inventory/storage-monitoring/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: ackDialog.logId, notes: ackNotes }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(t('storageMonitoring.toast.ackFailed'), j?.error);
      return;
    }
    toast.success(t('storageMonitoring.toast.acked'));
    setAckDialog(null);
    setAckNotes('');
    void loadData();
  };

  const columns: DxDataGridColumn[] = [
    {
      dataField: '_rowNumber',
      caption: '#',
      width: 56,
      alignment: 'center',
      allowSorting: false,
      allowFiltering: false,
    },
    { dataField: 'readingAt', caption: t('storageMonitoring.columns.readingAt'), dataType: 'datetime', width: 160 },
    {
      dataField: 'warehouseCode',
      caption: t('storageMonitoring.columns.warehouse'),
      minWidth: 260,
      cellRender: (c: any) => {
        const d = c.data as LogRow;
        return (
          // Keep the warehouse on a single line (no wrap) so rows stay even.
          <span className="whitespace-nowrap" title={`${d.warehouseCode}${d.warehouseName ? ` — ${d.warehouseName}` : ''}`}>
            <span className="font-medium">{d.warehouseCode}</span>
            {d.warehouseName ? (
              <span className="text-gray-500"> — {d.warehouseName}</span>
            ) : null}
          </span>
        );
      },
    },
    { dataField: 'temperature', caption: t('storageMonitoring.columns.temperature'), format: '#,##0.0', width: 80 },
    { dataField: 'humidity', caption: t('storageMonitoring.columns.humidity'), format: '#,##0.0', width: 80 },
    {
      dataField: 'alertLevel',
      caption: t('storageMonitoring.columns.status'),
      width: 130,
      cellRender: (c: any) => (
        <div className="overflow-hidden">
          <Badge className={`${alertColor(c.value)} whitespace-nowrap max-w-full`}>
            {alertLabel(c.value)}
          </Badge>
        </div>
      ),
    },
    { dataField: 'alertMessage', caption: t('storageMonitoring.columns.details'), minWidth: 240 },
    {
      caption: t('storageMonitoring.columns.acknowledge'),
      width: 180,
      cellRender: (c: any) => {
        const d = c.data as LogRow;
        if (d.acknowledgedAt) {
          return (
            <span className="text-xs text-green-700">
              ✓ {d.acknowledgedByName || '—'}
            </span>
          );
        }
        if (d.alertLevel !== 'in_spec') {
          return (
            <button
              className="text-xs bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600"
              onClick={() => setAckDialog({ logId: d.id, message: d.alertMessage || '' })}
              data-testid={`ack-btn-${d.id}`}
            >
              {t('storageMonitoring.actions.acknowledge')}
            </button>
          );
        }
        return <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      caption: t('storageMonitoring.columns.manage'),
      width: 100,
      cellRender: (c: any) => {
        const d = c.data as LogRow;
        return (
          <div className="flex gap-1">
            <button
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              title={t('storageMonitoring.actions.edit')}
              onClick={() => openEdit(d)}
              data-testid={`edit-btn-${d.id}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-red-50 text-red-600"
              title={t('storageMonitoring.actions.delete')}
              onClick={() => setDeleteTarget(d)}
              data-testid={`delete-btn-${d.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="space-y-4 p-4">
        <ResponsivePageHeader
          title={t('storageMonitoring.header.title')}
          subtitle={t('storageMonitoring.header.subtitle')}
          breadcrumbs={[
            { label: t('storageMonitoring.header.breadcrumbPremises'), href: '/premises' },
            { label: t('storageMonitoring.header.breadcrumbCurrent') },
          ]}
          actions={
            <DxButton
              text={t('storageMonitoring.actions.addReading')}
              type="default"
              onClick={openCreate}
              data-testid="storage-monitoring-add"
            />
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label={t('storageMonitoring.stats.openAlerts')}
            value={stats.openAlerts}
            icon={AlertTriangle}
            iconColor="text-red-500"
            accentColor={stats.openAlerts > 0 ? 'border-red-500' : 'border-emerald-500'}
          />
          <StatCard label={t('storageMonitoring.stats.last24h')} value={stats.last24h} icon={Bell} />
          <StatCard
            label={t('storageMonitoring.stats.monitoredAreas')}
            value={stats.monitoredAreas}
            icon={Thermometer}
          />
          <StatCard
            label={t('storageMonitoring.stats.total')}
            value={stats.total}
            icon={CheckCircle2}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border p-3">
          <DxSelectBox
            placeholder={t('storageMonitoring.filters.selectWarehousePlaceholder')}
            dataSource={[
              { id: null, name: t('storageMonitoring.filters.allWarehouses') },
              ...warehouses.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` })),
            ]}
            valueExpr="id"
            displayExpr="name"
            value={filterWarehouseId}
            onValueChanged={(e) => setFilterWarehouseId(e.value)}
            width={260}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={alertsOnly}
              onChange={(e) => setAlertsOnly(e.target.checked)}
              data-testid="alerts-only-filter"
            />
            {t('storageMonitoring.filters.alertsOnly')}
          </label>
        </div>

        {/* Status legend — explains what each สถานะ means */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600 px-1">
          <span className="font-medium text-gray-500">{t('storageMonitoring.legend.label')}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
            {t('storageMonitoring.legend.normal')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
            {t('storageMonitoring.legend.oneExceeded')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            {t('storageMonitoring.legend.multipleExceeded')}
          </span>
        </div>

        <div className="bg-white rounded-lg border">
          <DxDataGrid
            dataSource={numberedLogs}
            keyExpr="id"
            columns={columns}
            data-testid="storage-monitoring-grid"
          />
        </div>

        {/* Log entry dialog */}
        <DxPopup
          visible={showLogDialog}
          onHiding={closeDialog}
          title={editingId ? t('storageMonitoring.dialog.editTitle') : t('storageMonitoring.dialog.createTitle')}
          width={500}
          height="auto"
          showCloseButton
        >
          {/* key per record forces the DevExtreme editors to remount with the
              correct initial value. Without it the SelectBox/DateBox kept the
              value they had when the dialog first mounted (empty, from "บันทึกค่า")
              and didn't re-sync on edit — so คลัง + วันเวลา showed blank even
              though logForm held them. */}
          <div key={editingId ?? 'new'} className="space-y-3 p-2">
            <DxSelectBox
              placeholder={t('storageMonitoring.dialog.selectWarehouseRequired')}
              dataSource={warehouseOptions}
              valueExpr="id"
              displayExpr="name"
              value={logForm.warehouseId}
              onValueChanged={(e) => setLogForm({ ...logForm, warehouseId: e.value })}
              data-testid="storage-monitoring-warehouse"
            />
            <div>
              <label className="text-sm text-gray-700 mb-1 block">
                {t('storageMonitoring.dialog.readingAtLabel')}{' '}
                <span className="text-gray-400">{t('storageMonitoring.dialog.readingAtHint')}</span>
              </label>
              <DxDateBox
                type="datetime"
                labelMode="hidden"
                value={logForm.readingAt || undefined}
                showClearButton
                width="100%"
                onValueChanged={(e) => {
                  const d = e.value as Date | null;
                  setLogForm((f) => ({ ...f, readingAt: d ? d.toISOString() : '' }));
                }}
                data-testid="storage-monitoring-readingat"
              />
            </div>
            {logForm.warehouseId &&
              (() => {
                const w = warehouses.find((x) => x.id === logForm.warehouseId);
                if (!w) return null;
                return (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {t('storageMonitoring.dialog.criteria', {
                      tempMin: String(w.temperatureMin),
                      tempMax: String(w.temperatureMax),
                      humidityMin: String(w.humidityMin),
                      humidityMax: String(w.humidityMax),
                    })}
                  </div>
                );
              })()}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                  <Thermometer className="w-4 h-4" /> {t('storageMonitoring.dialog.temperatureLabel')}
                </label>
                <DxNumberBox
                  value={logForm.temperature ?? undefined}
                  format="#,##0.0"
                  onValueChanged={(e) => setLogForm({ ...logForm, temperature: e.value ?? null })}
                  data-testid="storage-monitoring-temp"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                  <Droplets className="w-4 h-4" /> {t('storageMonitoring.dialog.humidityLabel')}
                </label>
                <DxNumberBox
                  value={logForm.humidity ?? undefined}
                  format="#,##0.0"
                  onValueChanged={(e) => setLogForm({ ...logForm, humidity: e.value ?? null })}
                  data-testid="storage-monitoring-humidity"
                />
              </div>
            </div>
            <DxTextBox
              placeholder={t('storageMonitoring.dialog.notesPlaceholder')}
              value={logForm.notes}
              onValueChanged={(e) => setLogForm({ ...logForm, notes: e.value || '' })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <DxButton text={t('storageMonitoring.dialog.cancel')} onClick={closeDialog} disabled={saving} />
              <DxButton
                text={editingId ? t('storageMonitoring.dialog.saveEdit') : t('storageMonitoring.dialog.save')}
                type="success"
                onClick={submitLog}
                disabled={saving}
                data-testid="storage-monitoring-submit"
              />
            </div>
          </div>
        </DxPopup>

        {/* Acknowledge alert dialog */}
        <DxPopup
          visible={!!ackDialog}
          onHiding={() => setAckDialog(null)}
          title={t('storageMonitoring.ack.title')}
          width={460}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-sm">
              {ackDialog?.message}
            </div>
            {/* Next-step guidance so the operator knows acknowledging is not the
                end — they must investigate the excursion per GMP. */}
            <div className="bg-sky-50 border border-sky-200 rounded p-2.5 text-xs text-sky-900">
              <p className="font-semibold mb-1">{t('storageMonitoring.ack.nextStepsTitle')}</p>
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>{t('storageMonitoring.ack.nextStep1')}</li>
                <li>{t('storageMonitoring.ack.nextStep2')}</li>
                <li>{t('storageMonitoring.ack.nextStep3')}</li>
              </ol>
            </div>
            <label className="block text-xs font-medium text-gray-600">
              {t('storageMonitoring.ack.notesLabel')}
            </label>
            <DxTextBox
              placeholder={t('storageMonitoring.ack.notesPlaceholder')}
              value={ackNotes}
              onValueChanged={(e) => setAckNotes(e.value || '')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <DxButton text={t('storageMonitoring.ack.cancel')} onClick={() => setAckDialog(null)} />
              <DxButton
                text={t('storageMonitoring.ack.confirm')}
                type="danger"
                onClick={acknowledge}
                data-testid="storage-monitoring-ack-submit"
              />
            </div>
          </div>
        </DxPopup>

        {/* Delete confirmation */}
        <ConfirmationDialog
          visible={!!deleteTarget}
          title={t('storageMonitoring.delete.title')}
          message={
            deleteTarget
              ? t('storageMonitoring.delete.message', {
                  warehouseCode: deleteTarget.warehouseCode,
                  date: new Date(deleteTarget.readingAt).toLocaleString('th-TH'),
                })
              : ''
          }
          confirmText={t('storageMonitoring.delete.confirm')}
          cancelText={t('storageMonitoring.delete.cancel')}
          confirmType="danger"
          isLoading={saving}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />

        {loading && <div className="text-center text-gray-500 py-4">{t('storageMonitoring.loading')}</div>}
      </div>
    </>
  );
}
