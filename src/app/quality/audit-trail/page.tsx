'use client';

/**
 * Unified Audit Trail Viewer — Phase 9
 *
 * Permission-gated page for QA managers, admins, and auditors to inspect every
 * tracked event across the QC + COA module (and a few neighbours). Pulls from
 * /api/quality/audit-trail which aggregates audit_trail + qc_sample_signatures
 * + coa_signatures + coa_print_history + coa_verify_log + qc_oos_investigations.
 *
 * Designed for FDA 21 CFR Part 11 §11.10(e) review: authorized personnel must
 * be able to inspect, copy, and print the audit trail.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ScrollText,
  Filter,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Eye,
  AlertTriangle,
  Activity,
} from 'lucide-react';

interface AuditRow {
  rowKey: string;
  source: string;
  timestamp: string;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: number | null;
  entityRef: string | null;
  details: string;
  detailsJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditKpis {
  totalEventsToday: number;
  signOffsThisWeek: number;
  verifyHitsThisWeek: number;
  failedLoginsThisWeek: number;
}

interface AuditApiResult {
  items: AuditRow[];
  total: number;
  page: number;
  limit: number;
  kpis: AuditKpis | null;
}

const ENTITY_OPTIONS = [
  { id: '', label: 'All entities' },
  { id: 'qc_sample', label: 'QC Sample' },
  { id: 'coa_document', label: 'COA Document' },
  { id: 'material_return', label: 'Material Return' },
  { id: 'wo_sop_execution', label: 'Work Order / SOP' },
];

const ACTION_OPTIONS = [
  { id: '', label: 'All actions' },
  { id: 'create', label: 'Create' },
  { id: 'update', label: 'Update' },
  { id: 'delete', label: 'Delete' },
  { id: 'sign', label: 'Sign' },
  { id: 'approve', label: 'Approve' },
  { id: 'release', label: 'Release' },
  { id: 'verify', label: 'Verify' },
  { id: 'print', label: 'Print/Export' },
  { id: 'investigate', label: 'OOS Investigation' },
];

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function actionBadgeVariant(action: string): {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
} {
  switch (action) {
    case 'create':
      return { variant: 'info', label: 'Create' };
    case 'update':
      return { variant: 'default', label: 'Update' };
    case 'delete':
      return { variant: 'danger', label: 'Delete' };
    case 'sign':
      return { variant: 'info', label: 'Sign' };
    case 'approve':
      return { variant: 'success', label: 'Approve' };
    case 'release':
      return { variant: 'success', label: 'Release' };
    case 'verify':
      return { variant: 'info', label: 'Verify' };
    case 'print':
      return { variant: 'default', label: 'Print' };
    case 'investigate':
      return { variant: 'warning', label: 'Investigate' };
    default:
      return { variant: 'default', label: action };
  }
}

/** RFC 4180 CSV cell escape. */
function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: AuditRow[]): string {
  const header = [
    'Timestamp',
    'User',
    'Role',
    'Action',
    'Entity Type',
    'Entity Ref',
    'Details',
    'IP',
    'User Agent',
    'Source',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        formatTimestamp(r.timestamp),
        r.userName ?? '',
        r.userRole ?? '',
        r.actionLabel || r.action,
        r.entityType,
        r.entityRef ?? '',
        r.details,
        r.ipAddress ?? '',
        r.userAgent ?? '',
        r.source,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

export default function AuditTrailPage() {
  const toast = useToast();
  const t = useTranslations('quality');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [kpis, setKpis] = useState<AuditKpis | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [actionType, setActionType] = useState('');
  const [userId, setUserId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (entityType) sp.set('entityType', entityType);
      if (actionType) sp.set('actionType', actionType);
      if (userId) sp.set('userId', userId);
      if (entityId) sp.set('entityId', entityId);
      if (dateFrom) sp.set('dateFrom', dateFrom);
      if (dateTo) sp.set('dateTo', dateTo);
      if (search.trim()) sp.set('search', search.trim());
      sp.set('page', String(page));
      sp.set('limit', String(limit));
      sp.set('kpis', '1');

      const res = await fetch(`/api/quality/audit-trail?${sp.toString()}`);
      if (res.status === 403) {
        setForbidden(true);
        setError('You do not have permission to view the audit trail.');
        setRows([]);
        setKpis(null);
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load audit trail');
        return;
      }
      const payload = data.data as AuditApiResult;
      setRows(payload.items);
      setTotal(payload.total);
      setKpis(payload.kpis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [
    entityType,
    actionType,
    userId,
    entityId,
    dateFrom,
    dateTo,
    search,
    page,
  ]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  const handleExportCsv = useCallback(() => {
    if (rows.length === 0) {
      toast.error('No rows to export.');
      return;
    }
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows to CSV.`);
  }, [rows, toast]);

  const clearFilters = () => {
    setEntityType('');
    setActionType('');
    setUserId('');
    setEntityId('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  };

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="Audit Trail"
          subtitle={t('auditTrail.subtitle')}
          icon={ScrollText}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'Audit Trail' },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text={t('auditTrail.refresh')}
                stylingMode="outlined"
                onClick={fetchAudit}
                disabled={loading}
              />
              <DxButton
                icon="exportxlsx"
                text="Export CSV"
                type="default"
                onClick={handleExportCsv}
                disabled={rows.length === 0}
              />
            </div>
          }
        />

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Activity}
            label={t('auditTrail.kpi.eventsToday')}
            value={kpis?.totalEventsToday ?? 0}
            color="emerald"
          />
          <KpiCard
            icon={ShieldCheck}
            label={t('auditTrail.kpi.signOffsThisWeek')}
            value={kpis?.signOffsThisWeek ?? 0}
            color="teal"
          />
          <KpiCard
            icon={Eye}
            label={t('auditTrail.kpi.verifyHitsThisWeek')}
            value={kpis?.verifyHitsThisWeek ?? 0}
            color="sky"
          />
          <KpiCard
            icon={AlertTriangle}
            label={t('auditTrail.kpi.failedLogins7d')}
            value={kpis?.failedLoginsThisWeek ?? 0}
            color="amber"
          />
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">{t('auditTrail.filters')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <SelectInput
              label={t('auditTrail.filterLabels.entity')}
              value={entityType}
              onChange={(v) => {
                setPage(1);
                setEntityType(v);
              }}
              options={ENTITY_OPTIONS}
            />
            <TextInput
              label={t('auditTrail.filterLabels.entityId')}
              value={entityId}
              onChange={(v) => {
                setPage(1);
                setEntityId(v);
              }}
              placeholder="e.g. 42"
              type="number"
            />
            <SelectInput
              label={t('auditTrail.filterLabels.action')}
              value={actionType}
              onChange={(v) => {
                setPage(1);
                setActionType(v);
              }}
              options={ACTION_OPTIONS}
            />
            <TextInput
              label={t('auditTrail.filterLabels.userId')}
              value={userId}
              onChange={(v) => {
                setPage(1);
                setUserId(v);
              }}
              placeholder="e.g. 7"
              type="number"
            />
            <TextInput
              label={t('auditTrail.filterLabels.from')}
              value={dateFrom}
              onChange={(v) => {
                setPage(1);
                setDateFrom(v);
              }}
              type="date"
            />
            <TextInput
              label={t('auditTrail.filterLabels.to')}
              value={dateTo}
              onChange={(v) => {
                setPage(1);
                setDateTo(v);
              }}
              type="date"
            />
            <TextInput
              label={t('auditTrail.filterLabels.search')}
              value={search}
              onChange={(v) => {
                setPage(1);
                setSearch(v);
              }}
              placeholder={t('auditTrail.filterLabels.searchPlaceholder')}
            />
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {t('auditTrail.clearFilters')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <DxLoadIndicator visible />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-rose-700">{error}</p>
              {forbidden && (
                <p className="mt-2 text-xs text-gray-500">
                  Required role: admin / qc_manager / qa_manager / auditor
                </p>
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              {t('auditTrail.noEvents')}
            </div>
          ) : (
            <>
              {/* Inner table is forced to a min-width so each column stays
                  legible on narrow screens; the wrapper handles horizontal
                  scrolling for tablets/phones. */}
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-8 px-3 py-2"></th>
                      <th className="w-12 px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {t('auditTrail.columns.no')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {t('auditTrail.columns.timestamp')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {t('auditTrail.columns.user')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {t('auditTrail.columns.action')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {t('auditTrail.columns.entity')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t('auditTrail.columns.details')}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {t('auditTrail.columns.ip')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rows.map((r, idx) => (
                      <RowFragment
                        key={r.rowKey}
                        row={r}
                        t={t}
                        // Global sequence so the number keeps climbing across pages.
                        sequenceNumber={(page - 1) * limit + idx + 1}
                        expanded={expandedRow === r.rowKey}
                        onToggle={() =>
                          setExpandedRow(
                            expandedRow === r.rowKey ? null : r.rowKey,
                          )
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pager — page size selector + first/prev/next/last so users
                  can jump in big audit logs without 100s of clicks. */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-sm text-gray-600 gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span>
                    {t('auditTrail.pager.pageInfo', { page, totalPages, total: total.toLocaleString() })}
                  </span>
                  <label className="flex items-center gap-2 text-xs">
                    {t('auditTrail.pager.pageSize')}:
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="px-2 py-1 rounded-md border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                    title={t('auditTrail.pager.firstPage')}
                  >
                    « {t('auditTrail.pager.first')}
                  </button>
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-md border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                  >
                    ‹ {t('auditTrail.pager.prev')}
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded-md border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                  >
                    {t('auditTrail.pager.next')} ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="px-2 py-1 rounded-md border border-gray-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                    title={t('auditTrail.pager.lastPage')}
                  >
                    {t('auditTrail.pager.last')} »
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function RowFragment({
  row,
  sequenceNumber,
  expanded,
  onToggle,
  t,
}: {
  row: AuditRow;
  sequenceNumber: number;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const ab = actionBadgeVariant(row.action);
  return (
    <>
      <tr
        className="hover:bg-emerald-50/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-gray-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-3 py-2 text-xs text-center text-gray-500 whitespace-nowrap">
          {sequenceNumber}
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap font-mono text-gray-700">
          {formatTimestamp(row.timestamp)}
        </td>
        <td className="px-3 py-2 text-sm">
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">
              {row.userName || '—'}
            </span>
            {row.userRole && (
              <span className="text-xs text-gray-500">{row.userRole}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-sm whitespace-nowrap">
          <Badge variant={ab.variant}>{ab.label}</Badge>
          {row.actionLabel && row.actionLabel !== row.action && (
            <span className="ml-1 text-xs font-mono text-gray-500">
              {row.actionLabel}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{row.entityRef ?? '—'}</span>
            <span className="text-xs text-gray-500">{row.entityType}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-gray-700 max-w-md truncate">
          {row.details || '—'}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">
          {row.ipAddress ?? '—'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={8} className="px-6 py-3 border-t border-gray-100">
            {/* Only fields NOT already shown in the row's columns (timestamp,
                action, entity, ip live in the table row) — avoids duplication. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
              <DetailField label={t('auditTrail.detail.source')} value={row.source} mono />
              <DetailField label={t('auditTrail.detail.userAgent')} value={row.userAgent || '—'} mono />
              <DetailField label={t('auditTrail.detail.ipSource')} value={row.ipAddress ?? '—'} mono />
            </div>
            {row.detailsJson && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {t('auditTrail.detail.payload')}
                </p>
                <pre className="text-xs font-mono bg-white border border-gray-200 rounded-md p-3 overflow-x-auto max-h-72">
                  {JSON.stringify(row.detailsJson, null, 2)}
                </pre>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`text-xs ${mono ? 'font-mono' : ''} text-gray-800 break-all`}
      >
        {value}
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'emerald' | 'teal' | 'sky' | 'amber';
}) {
  // White card + tone-coloured left accent bar + coloured icon (matches StatCard).
  const colorMap = {
    emerald: { accent: 'border-l-emerald-500', icon: 'text-emerald-500' },
    teal: { accent: 'border-l-teal-500', icon: 'text-teal-500' },
    sky: { accent: 'border-l-sky-500', icon: 'text-sky-500' },
    amber: { accent: 'border-l-amber-500', icon: 'text-amber-500' },
  };
  const c = colorMap[color];
  return (
    <div
      className={`bg-white border border-gray-200 border-l-4 ${c.accent} rounded-[14px] p-4 flex items-center gap-3 shadow-[0_6px_20px_rgba(6,78,59,0.06)]`}
    >
      <div className="p-2">
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 bg-[#FBFEFC] border border-[#D9EFE4] rounded-[11px] text-sm text-[#0F2E22] focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 bg-[#FBFEFC] border border-[#D9EFE4] rounded-[11px] text-sm text-[#0F2E22] focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
      />
    </label>
  );
}
