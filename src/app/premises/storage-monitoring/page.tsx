'use client';
/**
 * Storage Area Environmental Monitoring
 * Audit Q6 — บันทึก/ดู/รับทราบ alert
 */
import { useEffect, useState, useMemo } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Thermometer, Droplets, AlertTriangle, CheckCircle2, Bell } from 'lucide-react';

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

const alertLabel = (level: string) =>
  ({
    in_spec: 'ปกติ',
    temp_low: 'อุณหภูมิต่ำ',
    temp_high: 'อุณหภูมิสูง',
    humidity_low: 'ความชื้นต่ำ',
    humidity_high: 'ความชื้นสูง',
    multiple: 'หลายรายการ',
  })[level] || level;

export default function StorageMonitoringPage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterWarehouseId, setFilterWarehouseId] = useState<number | null>(null);
  const [alertsOnly, setAlertsOnly] = useState(false);

  const [showLogDialog, setShowLogDialog] = useState(false);
  const [logForm, setLogForm] = useState({
    warehouseId: null as number | null,
    temperature: null as number | null,
    humidity: null as number | null,
    notes: '',
  });

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
      toast.error('โหลดข้อมูลไม่สำเร็จ', (e as Error).message);
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

  const submitLog = async () => {
    if (!logForm.warehouseId) {
      toast.error('กรุณาเลือกคลัง');
      return;
    }
    if (logForm.temperature == null && logForm.humidity == null) {
      toast.error('กรุณากรอกอย่างน้อย 1 ค่า');
      return;
    }
    const res = await fetch('/api/inventory/storage-monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logForm),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error('บันทึกไม่สำเร็จ', json?.error);
      return;
    }
    const created = json.data;
    if (created?.alertLevel && created.alertLevel !== 'in_spec') {
      toast.error(`⚠ ALERT — ${alertLabel(created.alertLevel)}`, created.alertMessage);
    } else {
      toast.success('บันทึกเรียบร้อย — อยู่ในเกณฑ์');
    }
    setShowLogDialog(false);
    setLogForm({ warehouseId: null, temperature: null, humidity: null, notes: '' });
    void loadData();
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
      toast.error('รับทราบไม่สำเร็จ', j?.error);
      return;
    }
    toast.success('รับทราบ alert แล้ว');
    setAckDialog(null);
    setAckNotes('');
    void loadData();
  };

  const columns: DxDataGridColumn[] = [
    { dataField: 'readingAt', caption: 'วันเวลา', dataType: 'datetime', width: 160 },
    {
      dataField: 'warehouseCode',
      caption: 'คลัง',
      width: 220,
      cellRender: (c: any) => {
        const d = c.data as LogRow;
        return (
          <span>
            <span className="font-medium">{d.warehouseCode}</span>
            {d.warehouseName ? (
              <span className="text-gray-500"> — {d.warehouseName}</span>
            ) : null}
          </span>
        );
      },
    },
    { dataField: 'temperature', caption: '°C', format: '#,##0.0', width: 80 },
    { dataField: 'humidity', caption: '%RH', format: '#,##0.0', width: 80 },
    {
      dataField: 'alertLevel',
      caption: 'สถานะ',
      width: 110,
      cellRender: (c: any) => (
        <Badge className={alertColor(c.value)}>{alertLabel(c.value)}</Badge>
      ),
    },
    { dataField: 'alertMessage', caption: 'รายละเอียด' },
    {
      caption: 'Acknowledged',
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
              รับทราบ
            </button>
          );
        }
        return <span className="text-xs text-gray-400">—</span>;
      },
    },
  ];

  return (
    <>
      <div className="space-y-4 p-4">
        <ResponsivePageHeader
          title="Storage Environmental Monitoring"
          subtitle="บันทึกและติดตามอุณหภูมิ/ความชื้นของห้องเก็บ"
          breadcrumbs={[
            { label: 'อาคารและสถานที่', href: '/premises' },
            { label: 'Storage Monitoring' },
          ]}
          actions={
            <DxButton
              text="+ บันทึกค่า"
              type="default"
              onClick={() => setShowLogDialog(true)}
              data-testid="storage-monitoring-add"
            />
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Open Alerts"
            value={stats.openAlerts}
            icon={AlertTriangle}
            iconColor="text-red-500"
            accentColor={stats.openAlerts > 0 ? 'border-red-500' : 'border-emerald-500'}
          />
          <StatCard label="บันทึก 24h" value={stats.last24h} icon={Bell} />
          <StatCard
            label="คลังที่ติดตาม"
            value={stats.monitoredAreas}
            icon={Thermometer}
          />
          <StatCard
            label="บันทึกทั้งหมด"
            value={stats.total}
            icon={CheckCircle2}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border p-3">
          <DxSelectBox
            placeholder="เลือกคลัง..."
            dataSource={[
              { id: null, name: 'ทุกคลัง' },
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
            เฉพาะรายการที่เกินเกณฑ์
          </label>
        </div>

        <div className="bg-white rounded-lg border">
          <DxDataGrid
            dataSource={logs}
            keyExpr="id"
            columns={columns}
            data-testid="storage-monitoring-grid"
          />
        </div>

        {/* Log entry dialog */}
        <DxPopup
          visible={showLogDialog}
          onHiding={() => setShowLogDialog(false)}
          title="บันทึกค่าอุณหภูมิ/ความชื้น"
          width={500}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <DxSelectBox
              placeholder="เลือกคลัง *"
              dataSource={warehouses.map((w) => ({
                id: w.id,
                name: `${w.code} — ${w.name}`,
              }))}
              valueExpr="id"
              displayExpr="name"
              value={logForm.warehouseId}
              onValueChanged={(e) => setLogForm({ ...logForm, warehouseId: e.value })}
              data-testid="storage-monitoring-warehouse"
            />
            {logForm.warehouseId &&
              (() => {
                const w = warehouses.find((x) => x.id === logForm.warehouseId);
                if (!w) return null;
                return (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    เกณฑ์: {w.temperatureMin}–{w.temperatureMax}°C / {w.humidityMin}–
                    {w.humidityMax}%RH
                  </div>
                );
              })()}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1 text-sm text-gray-700 mb-1">
                  <Thermometer className="w-4 h-4" /> อุณหภูมิ (°C)
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
                  <Droplets className="w-4 h-4" /> ความชื้น (%RH)
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
              placeholder="หมายเหตุ"
              value={logForm.notes}
              onValueChanged={(e) => setLogForm({ ...logForm, notes: e.value || '' })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <DxButton text="ยกเลิก" onClick={() => setShowLogDialog(false)} />
              <DxButton
                text="บันทึก"
                type="success"
                onClick={submitLog}
                data-testid="storage-monitoring-submit"
              />
            </div>
          </div>
        </DxPopup>

        {/* Acknowledge alert dialog */}
        <DxPopup
          visible={!!ackDialog}
          onHiding={() => setAckDialog(null)}
          title="รับทราบ Alert"
          width={460}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-sm">
              {ackDialog?.message}
            </div>
            <DxTextBox
              placeholder="หมายเหตุ / การดำเนินการ"
              value={ackNotes}
              onValueChanged={(e) => setAckNotes(e.value || '')}
            />
            <div className="flex justify-end gap-2 pt-2">
              <DxButton text="ยกเลิก" onClick={() => setAckDialog(null)} />
              <DxButton
                text="ยืนยันรับทราบ"
                type="danger"
                onClick={acknowledge}
                data-testid="storage-monitoring-ack-submit"
              />
            </div>
          </div>
        </DxPopup>

        {loading && <div className="text-center text-gray-500 py-4">กำลังโหลด...</div>}
      </div>
    </>
  );
}
