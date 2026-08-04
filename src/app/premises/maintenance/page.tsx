'use client';

/**
 * Equipment Maintenance Register — GMP maintenance plans + records.
 *
 * Two tabs over the same equipment: the PLAN (what must be done, how often, by
 * whom, with what — 21 CFR 211.67) and the RECORD (what was actually done, dated
 * and signed by the performer and a second checker — 21 CFR 211.182).
 *
 * Equipment under maintenance is taken out of service from here; the work-order
 * equipment-inspection step refuses to pass equipment that is not in service.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { useToast } from '@/hooks/use-toast';
import { Hammer, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ScheduleRow {
  id: number;
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  lineCategory: string | null;
  equipmentStatus: string;
  maintenanceType: string;
  description: string | null;
  intervalType: string;
  intervalValue: number;
  responsibleName: string | null;
  responsibleRole: string | null;
  method: string | null;
  materials: string | null;
  intervalRationale: string | null;
  isCritical: boolean;
  lastPerformedDate: string | null;
  nextDueDate: string | null;
  alertDaysBefore: number;
  isActive: boolean;
  dueStatus: 'ok' | 'due_soon' | 'due_today' | 'overdue' | 'inactive';
}

interface RecordRow {
  id: number;
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  maintenanceType: string;
  description: string;
  performedDate: string | null;
  workDone: string | null;
  partsUsed: string | null;
  downtimeMinutes: number | null;
  result: string;
  performedByUserId: number;
  performedByName: string | null;
  verifiedByUserId: number | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
}

interface EquipmentOption {
  id: number;
  code: string;
  nameTh: string;
  lineCategory?: string | null;
  scaleStatus?: string;
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  due_soon: 'bg-amber-100 text-amber-800',
  due_today: 'bg-orange-100 text-orange-800',
  overdue: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function EquipmentMaintenancePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const tRoot = useTranslations('premises');
  const t = (k: string, v?: Record<string, string | number>) =>
    tRoot(`maintenance.${k}`, v as never);

  const [tab, setTab] = useState<'schedules' | 'records'>('schedules');
  const [lineFilter, setLineFilter] = useState<'all' | 'in_line' | 'off_line'>('all');
  const [planOpen, setPlanOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);

  const [planForm, setPlanForm] = useState({
    equipmentId: 0,
    maintenanceType: 'preventive',
    description: '',
    intervalType: 'days',
    intervalValue: 30,
    responsibleRole: '',
    method: '',
    materials: '',
    intervalRationale: '',
    isCritical: false,
    alertDaysBefore: 7,
    startDate: '',
  });
  const [jobForm, setJobForm] = useState({
    equipmentId: 0,
    scheduleId: 0,
    maintenanceType: 'preventive',
    description: '',
    performedDate: '',
    workDone: '',
    partsUsed: '',
    downtimeMinutes: 0,
    result: 'completed',
    notes: '',
    returnToService: true,
  });

  const { data: schedules, isLoading: loadingSchedules } = useQuery<ScheduleRow[]>({
    queryKey: ['maintenance-schedules', lineFilter],
    queryFn: async () => {
      const q = lineFilter === 'all' ? '' : `?lineCategory=${lineFilter}`;
      const res = await fetch(`/api/premises/maintenance/schedules${q}`);
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const { data: records, isLoading: loadingRecords } = useQuery<RecordRow[]>({
    queryKey: ['maintenance-records'],
    queryFn: async () => {
      const res = await fetch('/api/premises/maintenance/records');
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
  });

  const { data: equipment } = useQuery<EquipmentOption[]>({
    queryKey: ['production-equipment', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-equipment');
      const j = await res.json();
      return j.success ? j.data : [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['maintenance-schedules'] });
    qc.invalidateQueries({ queryKey: ['maintenance-records'] });
    qc.invalidateQueries({ queryKey: ['production-equipment'] });
  };

  const createPlan = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/premises/maintenance/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planForm),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      toast.success(t('savedSchedule'), '');
      setPlanOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(t('errorTitle'), e.message),
  });

  const createJob = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/premises/maintenance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...jobForm,
          scheduleId: jobForm.scheduleId || null,
          downtimeMinutes: jobForm.downtimeMinutes || null,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      toast.success(t('savedRecord'), '');
      setJobOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(t('errorTitle'), e.message),
  });

  const verifyRecord = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/premises/maintenance/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      toast.success(t('verified'), '');
      invalidate();
    },
    onError: (e: Error) => toast.error(t('errorTitle'), e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { equipmentId: number; status: string }) => {
      const res = await fetch('/api/premises/maintenance/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setStatus', ...v }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      return j;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(t('errorTitle'), e.message),
  });

  const intervalLabel = (type: string, n: number) =>
    type === 'weeks' ? t('intervalWeeks', { n }) : type === 'months' ? t('intervalMonths', { n }) : t('intervalDays', { n });

  const typeLabel = (v: string) =>
    v === 'corrective' ? t('typeCorrective') : v === 'calibration' ? t('typeCalibration') : t('typePreventive');

  const statusLabel = (v: string) =>
    ({ ok: t('statusOk'), due_soon: t('statusDueSoon'), due_today: t('statusDueToday'), overdue: t('statusOverdue'), inactive: t('statusInactive') } as Record<string, string>)[v] ?? v;

  const equipmentItems = (equipment ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} — ${e.nameTh}`,
  }));

  const openJobFor = (row?: ScheduleRow) => {
    setJobForm((f) => ({
      ...f,
      equipmentId: row?.equipmentId ?? 0,
      scheduleId: row?.id ?? 0,
      maintenanceType: row?.maintenanceType ?? 'preventive',
      description: row?.description ?? '',
      performedDate: '',
      workDone: '',
      partsUsed: '',
      downtimeMinutes: 0,
      result: 'completed',
      notes: '',
    }));
    setJobOpen(true);
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        icon={Hammer}
        iconBgColor="bg-orange-100"
        iconColor="text-orange-600"
        onBack={() => router.push('/premises')}
        breadcrumbs={[{ label: t('breadcrumbPremises'), href: '/premises' }, { label: t('title') }]}
        actions={
          <div className="flex gap-2">
            <DxButton text={t('recordJob')} icon="edit" type="default" stylingMode="outlined" onClick={() => openJobFor()} />
            <DxButton text={t('addSchedule')} icon="plus" type="success" onClick={() => setPlanOpen(true)} />
          </div>
        }
      />

      {/* GMP note — the two-signature rule is a legal requirement, not a nicety */}
      <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
        <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{t('legalNote')}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['schedules', 'records'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === k ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            data-testid={`tab-${k}`}
          >
            {k === 'schedules' ? t('tabSchedules') : t('tabRecords')}
          </button>
        ))}
      </div>

      {tab === 'schedules' && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['all', 'in_line', 'off_line'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setLineFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  lineFilter === k ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                data-testid={`line-filter-${k}`}
              >
                {k === 'all' ? t('filterAll') : k === 'in_line' ? t('filterInLine') : t('filterOffLine')}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
            <DxDataGrid
              dataSource={schedules ?? []}
              keyExpr="id"
              showBorders={false}
              rowAlternationEnabled
              loading={loadingSchedules}
              height="auto"
              width="100%"
              columnAutoWidth={false}
              noDataText={t('emptySchedules')}
            >
              <DxSearchPanel visible width={220} />
              <DxPaging defaultPageSize={20} />
              <DxColumn caption={t('colEquipment')} minWidth={200} cellRender={(cell) => {
                const d = cell.data as ScheduleRow;
                return (
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-semibold text-emerald-700">{d.equipmentCode}</span>
                    <span className="text-sm text-gray-900">{d.equipmentName}</span>
                    {d.equipmentStatus !== 'active' && (
                      <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200 whitespace-nowrap">
                        <AlertTriangle className="h-3 w-3" />
                        {d.equipmentStatus === 'maintenance' ? t('equipStatusMaintenance') : t('equipStatusOutOfService')}
                      </span>
                    )}
                  </div>
                );
              }} />
              <DxColumn caption={t('colType')} width={150} cellRender={(cell) => {
                const d = cell.data as ScheduleRow;
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{typeLabel(d.maintenanceType)}</span>
                    {d.isCritical && (
                      <span className="inline-flex w-fit rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                        {tRoot('maintenance.formCritical')}
                      </span>
                    )}
                  </div>
                );
              }} />
              <DxColumn caption={t('colInterval')} width={130} cellRender={(cell) => {
                const d = cell.data as ScheduleRow;
                return <span className="text-sm whitespace-nowrap">{intervalLabel(d.intervalType, d.intervalValue)}</span>;
              }} />
              <DxColumn caption={t('colResponsible')} width={160} cellRender={(cell) => {
                const d = cell.data as ScheduleRow;
                return <span className="text-sm">{d.responsibleName || d.responsibleRole || '—'}</span>;
              }} />
              <DxColumn dataField="lastPerformedDate" caption={t('colLastDone')} width={120} cellRender={(cell) => (
                <span className="text-sm text-gray-600 whitespace-nowrap">{(cell.value as string) || '—'}</span>
              )} />
              <DxColumn dataField="nextDueDate" caption={t('colNextDue')} width={120} cellRender={(cell) => (
                <span className="text-sm font-medium whitespace-nowrap">{(cell.value as string) || '—'}</span>
              )} />
              <DxColumn dataField="dueStatus" caption={t('colStatus')} width={150} cellRender={(cell) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[cell.value as string] ?? 'bg-gray-100 text-gray-600'}`}>
                  {statusLabel(cell.value as string)}
                </span>
              )} />
              {/* Wide enough for the longest label in either language — a clipped
                  action button is how "งดใช้งาน (ซ่อมบำ…" happened. */}
              <DxColumn caption={t('colActions')} width={210} cellRender={(cell) => {
                const d = cell.data as ScheduleRow;
                return (
                  <div className="flex flex-col gap-1">
                    <DxButton text={t('recordJob')} type="default" stylingMode="outlined" onClick={() => openJobFor(d)} />
                    {d.equipmentStatus === 'active' ? (
                      <DxButton
                        text={t('takeOutOfService')}
                        type="danger"
                        stylingMode="outlined"
                        onClick={() => setStatus.mutate({ equipmentId: d.equipmentId, status: 'maintenance' })}
                      />
                    ) : (
                      <DxButton
                        text={t('returnToService')}
                        type="success"
                        stylingMode="outlined"
                        onClick={() => setStatus.mutate({ equipmentId: d.equipmentId, status: 'active' })}
                      />
                    )}
                  </div>
                );
              }} />
            </DxDataGrid>
          </div>
        </>
      )}

      {tab === 'records' && (
        <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
          <DxDataGrid
            dataSource={records ?? []}
            keyExpr="id"
            showBorders={false}
            rowAlternationEnabled
            loading={loadingRecords}
            height="auto"
            width="100%"
            columnAutoWidth={false}
            noDataText={t('emptyRecords')}
          >
            <DxSearchPanel visible width={220} />
            <DxPaging defaultPageSize={20} />
            <DxColumn caption={t('colEquipment')} minWidth={180} cellRender={(cell) => {
              const d = cell.data as RecordRow;
              return (
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-semibold text-emerald-700">{d.equipmentCode}</span>
                  <span className="text-sm text-gray-900">{d.equipmentName}</span>
                </div>
              );
            }} />
            <DxColumn dataField="performedDate" caption={t('colPerformedDate')} width={120} cellRender={(cell) => (
              <span className="text-sm whitespace-nowrap">{(cell.value as string) || '—'}</span>
            )} />
            <DxColumn caption={t('colDescription')} minWidth={220} cellRender={(cell) => {
              const d = cell.data as RecordRow;
              return (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-900">{d.description}</span>
                  {d.workDone && <span className="text-xs text-gray-500">{d.workDone}</span>}
                  <span className="text-xs text-gray-400">{typeLabel(d.maintenanceType)}</span>
                </div>
              );
            }} />
            {/* 21 CFR 211.182 — both signatures live in one column so a missing
                second signature is impossible to miss. */}
            <DxColumn caption={t('colSignatures')} width={240} cellRender={(cell) => {
              const d = cell.data as RecordRow;
              return (
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-gray-700">
                    <b>{t('signedBy')}:</b> {d.performedByName ?? '—'}
                  </span>
                  {d.verifiedByUserId ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <b>{t('verifiedBy')}:</b> {d.verifiedByName ?? '—'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                        {t('notVerified')}
                      </span>
                      <button
                        className="text-emerald-700 underline hover:text-emerald-900"
                        onClick={() => verifyRecord.mutate(d.id)}
                        title={t('verifyHint')}
                        data-testid={`verify-${d.id}`}
                      >
                        {t('verify')}
                      </button>
                    </div>
                  )}
                </div>
              );
            }} />
          </DxDataGrid>
        </div>
      )}

      {/* ---------- Plan popup ---------- */}
      <DxPopup visible={planOpen} onHiding={() => setPlanOpen(false)} title={t('addSchedule')} width={640} height="auto">
        <div className="space-y-3 p-1 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formEquipment')} *</label>
            <DxSelectBox
              items={equipmentItems}
              value={planForm.equipmentId || undefined}
              onValueChange={(v) => setPlanForm({ ...planForm, equipmentId: Number(v) })}
              placeholder={t('formEquipment')}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formType')}</label>
              <DxSelectBox
                items={[
                  { value: 'preventive', label: t('typePreventive') },
                  { value: 'corrective', label: t('typeCorrective') },
                  { value: 'calibration', label: t('typeCalibration') },
                ]}
                value={planForm.maintenanceType}
                onValueChange={(v) => setPlanForm({ ...planForm, maintenanceType: String(v) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formStartDate')}</label>
              <DxDateBox
                type="date"
                value={planForm.startDate}
                onValueChange={(v) => setPlanForm({ ...planForm, startDate: v })}
                displayFormat="dd/MM/yyyy"
                showClearButton
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formInterval')} *</label>
              <DxNumberBox
                value={planForm.intervalValue}
                onValueChange={(v) => setPlanForm({ ...planForm, intervalValue: Number(v) })}
                min={1}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formIntervalUnit')}</label>
              <DxSelectBox
                items={[
                  { value: 'days', label: t('intervalDays', { n: '' }).replace('{n}', '').trim() },
                  { value: 'weeks', label: t('intervalWeeks', { n: '' }).replace('{n}', '').trim() },
                  { value: 'months', label: t('intervalMonths', { n: '' }).replace('{n}', '').trim() },
                ]}
                value={planForm.intervalType}
                onValueChange={(v) => setPlanForm({ ...planForm, intervalType: String(v) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formAlertDays')}</label>
              <DxNumberBox
                value={planForm.alertDaysBefore}
                onValueChange={(v) => setPlanForm({ ...planForm, alertDaysBefore: Number(v) })}
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formResponsibleRole')}</label>
            <DxTextBox
              value={planForm.responsibleRole}
              onValueChange={(v) => setPlanForm({ ...planForm, responsibleRole: v })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formMethod')}</label>
            <DxTextArea value={planForm.method} onValueChange={(v) => setPlanForm({ ...planForm, method: v })} height={60} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formMaterials')}</label>
            <DxTextBox value={planForm.materials} onValueChange={(v) => setPlanForm({ ...planForm, materials: v })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formRationale')}</label>
            <DxTextArea
              value={planForm.intervalRationale}
              onValueChange={(v) => setPlanForm({ ...planForm, intervalRationale: v })}
              height={60}
            />
            <p className="mt-1 text-xs text-gray-500">{t('formRationaleHint')}</p>
          </div>
          <div className="flex items-center gap-2">
            <DxCheckBox value={planForm.isCritical} onValueChange={(v) => setPlanForm({ ...planForm, isCritical: Boolean(v) })} />
            <span className="text-sm">{t('formCritical')}</span>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <DxButton text={t('cancel')} stylingMode="text" onClick={() => setPlanOpen(false)} />
            <DxButton
              text={t('save')}
              type="success"
              disabled={!planForm.equipmentId || !(planForm.intervalValue > 0) || createPlan.isPending}
              onClick={() => createPlan.mutate()}
            />
          </div>
        </div>
      </DxPopup>

      {/* ---------- Job popup ---------- */}
      <DxPopup visible={jobOpen} onHiding={() => setJobOpen(false)} title={t('recordJob')} width={640} height="auto">
        <div className="space-y-3 p-1 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formEquipment')} *</label>
            <DxSelectBox
              items={equipmentItems}
              value={jobForm.equipmentId || undefined}
              onValueChange={(v) => setJobForm({ ...jobForm, equipmentId: Number(v) })}
              placeholder={t('formEquipment')}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formPerformedDate')} *</label>
              <DxDateBox
                type="date"
                value={jobForm.performedDate}
                onValueChange={(v) => setJobForm({ ...jobForm, performedDate: v })}
                displayFormat="dd/MM/yyyy"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formResult')}</label>
              <DxSelectBox
                items={[
                  { value: 'completed', label: t('resultCompleted') },
                  { value: 'failed', label: t('resultFailed') },
                  { value: 'deferred', label: t('resultDeferred') },
                ]}
                value={jobForm.result}
                onValueChange={(v) => setJobForm({ ...jobForm, result: String(v) })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formDescription')} *</label>
            <DxTextBox value={jobForm.description} onValueChange={(v) => setJobForm({ ...jobForm, description: v })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formWorkDone')}</label>
            <DxTextArea value={jobForm.workDone} onValueChange={(v) => setJobForm({ ...jobForm, workDone: v })} height={60} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formPartsUsed')}</label>
              <DxTextBox value={jobForm.partsUsed} onValueChange={(v) => setJobForm({ ...jobForm, partsUsed: v })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('formDowntime')}</label>
              <DxNumberBox
                value={jobForm.downtimeMinutes}
                onValueChange={(v) => setJobForm({ ...jobForm, downtimeMinutes: Number(v) })}
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('formNotes')}</label>
            <DxTextArea value={jobForm.notes} onValueChange={(v) => setJobForm({ ...jobForm, notes: v })} height={50} />
          </div>
          <div className="flex items-center gap-2">
            <DxCheckBox
              value={jobForm.returnToService}
              onValueChange={(v) => setJobForm({ ...jobForm, returnToService: Boolean(v) })}
            />
            <span className="text-sm">{t('formReturnToService')}</span>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {t('verifyHint')}
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <DxButton text={t('cancel')} stylingMode="text" onClick={() => setJobOpen(false)} />
            <DxButton
              text={t('save')}
              type="success"
              disabled={
                !jobForm.equipmentId || !jobForm.description.trim() || !jobForm.performedDate || createJob.isPending
              }
              onClick={() => createJob.mutate()}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
