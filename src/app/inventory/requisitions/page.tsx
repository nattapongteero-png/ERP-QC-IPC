'use client';

/**
 * Material Requisitions Inbox
 *
 * Warehouse-facing list of pending material requisitions submitted by Production
 * (WO.requisitionStatus = 'requested' → 'approved').
 *
 * The "issuance plan" column applies `calculateIssuance` to round up to whole
 * Primary Units for items with weight-tracking enabled — so the operator knows
 * to pull e.g. "2 boxes" rather than "1,750 capsules" from the warehouse.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxDataGrid, DxColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Package,
  AlertTriangle,
  X,
  Filter,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';
import {
  rowKey,
  formatDateTh,
  isInsufficient,
  type RequisitionRow,
} from './_lib';


export default function MaterialRequisitionsInboxPage() {
  const t = useTranslations('inventory');
  const router = useRouter();
  const toast = useToast();

  const STATUS_OPTIONS = useMemo(() => [
    { value: 'requested', label: t('requisitions.statusOptions.requested') },
    { value: 'approved', label: t('requisitions.statusOptions.approved') },
    { value: 'all', label: t('requisitions.statusOptions.all') },
  ], [t]);

  const reasonLabel = useCallback((reasonType: string) => {
    const key = `requisitions.reasons.${reasonType}`;
    const translated = t(key);
    return translated === key ? reasonType : translated;
  }, [t]);

  const [rows, setRows] = useState<RequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceTab, setSourceTab] = useState<'bom' | 'out_of_bom'>('bom');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Out-of-BOM sub-filter: all | approved (รอจ่าย) | released (จ่ายแล้ว)
  const [outStatusFilter, setOutStatusFilter] = useState<'all' | 'approved' | 'released'>('all');
  const [releasing, setReleasing] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>('');     // YYYY-MM-DD
  const [insufficientOnly, setInsufficientOnly] = useState<boolean>(false);
  const [approving, setApproving] = useState<Set<number>>(new Set());

  // Date preset helpers — set BOTH from/to so a chip shows the active range.
  const setDatePreset = (preset: 'today' | 'last7' | 'last30' | 'thisMonth') => {
    const today = new Date();
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (preset === 'today') {
      const s = ymd(today);
      setDateFrom(s); setDateTo(s);
    } else if (preset === 'last7') {
      const from = new Date(today); from.setDate(from.getDate() - 6);
      setDateFrom(ymd(from)); setDateTo(ymd(today));
    } else if (preset === 'last30') {
      const from = new Date(today); from.setDate(from.getDate() - 29);
      setDateFrom(ymd(from)); setDateTo(ymd(today));
    } else if (preset === 'thisMonth') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(ymd(from)); setDateTo(ymd(today));
    }
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setInsufficientOnly(false);
  };

  // Count active filters (status defaults to 'all', so only non-default counts)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== 'all') n++;
    if (search.trim()) n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    if (insufficientOnly) n++;
    return n;
  }, [statusFilter, search, dateFrom, dateTo, insufficientOnly]);

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      // Always load ALL statuses so the KPI cards reflect true totals; the
      // status dropdown / clickable cards filter the list on the client.
      const res = await fetch(`/api/inventory/requisitions?status=all`);
      const data = await res.json();
      if (data.success) {
        setRows((data.data ?? []) as RequisitionRow[]);
      } else {
        toast.error(t('requisitions.toast.loadFailed'), data.error || '');
      }
    } catch (err) {
      toast.error(t('requisitions.toast.loadFailed'), String(err));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Build the date window once (inclusive on both ends, full day on the
    // "to" date so something requested at 17:00 still shows when "to" is
    // the same day).
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return rows.filter((r) => {
      if (r.source !== sourceTab) return false;
      // Out-of-BOM uses its own รอจ่าย/จ่ายแล้ว filter; BOM uses requisitionStatus.
      if (sourceTab === 'out_of_bom') {
        if (outStatusFilter !== 'all' && r.workflowStatus !== outStatusFilter) return false;
      } else if (statusFilter !== 'all' && r.requisitionStatus !== statusFilter) {
        return false;
      }
      if (q) {
        const matchesSearch =
          r.woNumber.toLowerCase().includes(q) ||
          r.batchNumber.toLowerCase().includes(q) ||
          (r.productName ?? '').toLowerCase().includes(q) ||
          (r.productCode ?? '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (fromTs !== null || toTs !== null) {
        if (!r.requestedAt) return false; // can't include records with no timestamp
        const ts = new Date(r.requestedAt).getTime();
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
      }
      if (insufficientOnly) {
        if (!r.materials.some(isInsufficient)) return false;
      }
      return true;
    });
  }, [rows, sourceTab, statusFilter, outStatusFilter, search, dateFrom, dateTo, insufficientOnly]);

  // Add a stable grid/route key per row (out-of-BOM rows share workOrderId, so
  // rowKey discriminates by requestId). keyExpr="_key" + onRowClick use it to
  // navigate to /inventory/requisitions/{_key}.
  const gridRows = useMemo(
    () => filteredRows.map((r) => ({ ...r, _key: rowKey(r) })),
    [filteredRows],
  );

  // Stats reflect the active source tab so the cards match what's listed.
  // For out-of-BOM the cards mean awaiting-release vs released.
  const stats = useMemo(() => {
    const scoped = rows.filter((r) => r.source === sourceTab);
    if (sourceTab === 'out_of_bom') {
      const awaiting = scoped.filter((r) => r.workflowStatus === 'approved').length;
      const released = scoped.filter((r) => r.workflowStatus === 'released').length;
      const insufficient = scoped
        .filter((r) => r.workflowStatus === 'approved')
        .filter((r) => r.materials.some(isInsufficient)).length;
      return { requested: awaiting, approved: released, insufficient };
    }
    const requested = scoped.filter((r) => r.requisitionStatus === 'requested').length;
    const approved = scoped.filter((r) => r.requisitionStatus === 'approved').length;
    const insufficient = scoped.filter((r) => r.materials.some(isInsufficient)).length;
    return { requested, approved, insufficient };
  }, [rows, sourceTab]);

  // Counts per tab for the segmented control badges.
  const tabCounts = useMemo(() => ({
    bom: rows.filter((r) => r.source === 'bom').length,
    out_of_bom: rows.filter((r) => r.source === 'out_of_bom').length,
  }), [rows]);

  // Options for the "pick a requisition" dropdown — scoped to the ACTIVE tab
  // and its status filter, so picks always match what's listed (and the
  // out-of-BOM tab never offers BOM work orders, and vice-versa).
  const woOptions = useMemo(() => {
    return rows
      .filter((r) => r.source === sourceTab)
      .filter((r) => {
        if (sourceTab === 'out_of_bom') {
          return outStatusFilter === 'all' || r.workflowStatus === outStatusFilter;
        }
        return statusFilter === 'all' || r.requisitionStatus === statusFilter;
      })
      .map((r) => ({
        value: r.woNumber,
        label: `${r.woNumber} — ${r.productName ?? r.productCode ?? ''}${r.batchNumber ? ` · ${r.batchNumber}` : ''}`,
      }));
  }, [rows, sourceTab, statusFilter, outStatusFilter]);


  const approve = async (woId: number) => {
    setApproving((prev) => new Set(prev).add(woId));
    try {
      const res = await fetch(`/api/production/work-orders/${woId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        const issued = (data.data?.issued ?? []) as { itemCode: string; puToIssue: number; pu: string; suIssued: number; su: string }[];
        if (issued.length > 0) {
          const lines = issued
            .map((i) => t('requisitions.toast.issuedLine', {
              code: i.itemCode,
              pu: formatNumber(i.puToIssue),
              puUnit: i.pu,
              su: formatNumber(i.suIssued),
              suUnit: i.su,
            }))
            .join('\n');
          toast.success(t('requisitions.toast.approveReleaseSuccess'), lines);
        } else {
          toast.success(t('requisitions.toast.approveSuccess'));
        }
        await fetchRequisitions();
      } else {
        toast.error(t('requisitions.toast.approveFailed'), data.error || '');
      }
    } catch (err) {
      toast.error(t('requisitions.toast.approveFailed'), String(err));
    } finally {
      setApproving((prev) => {
        const next = new Set(prev);
        next.delete(woId);
        return next;
      });
    }
  };

  // Warehouse release of an approved out-of-BOM withdrawal — deducts stock.
  const release = async (requestId: number) => {
    setReleasing((prev) => new Set(prev).add(requestId));
    try {
      const res = await fetch(`/api/material-withdrawal/requests/${requestId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        toast.success(t('requisitions.toast.releaseSuccess'), t('requisitions.toast.releaseSuccessDetail'));
        await fetchRequisitions();
      } else {
        toast.error(t('requisitions.toast.releaseFailed'), data.error || '');
      }
    } catch (err) {
      toast.error(t('requisitions.toast.releaseFailed'), String(err));
    } finally {
      setReleasing((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <ResponsivePageHeader
          title={t('requisitions.page.title')}
          subtitle={t('requisitions.page.subtitle')}
          icon={ClipboardList}
        />

        {/* Source tabs — BOM vs out-of-BOM */}
        <div className="inline-flex rounded-xl border border-emerald-100 bg-white p-1 shadow-[0_4px_14px_rgba(6,78,59,0.05)]">
          {([
            { key: 'bom' as const, label: t('requisitions.tabs.bom'), count: tabCounts.bom },
            { key: 'out_of_bom' as const, label: t('requisitions.tabs.outOfBom'), count: tabCounts.out_of_bom },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setSourceTab(tab.key); setStatusFilter('all'); setOutStatusFilter('all'); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sourceTab === tab.key
                  ? 'bg-emerald-600 text-white'
                  : 'text-[#4B7163] hover:bg-[#F6FCF9]'
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs ${
                sourceTab === tab.key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Out-of-BOM status filter — รอจ่าย / จ่ายแล้ว */}
        {sourceTab === 'out_of_bom' && (
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all' as const, label: t('requisitions.outStatus.all') },
              { key: 'approved' as const, label: t('requisitions.outStatus.awaitingRelease') },
              { key: 'released' as const, label: t('requisitions.outStatus.released') },
            ]).map((pill) => (
              <button
                key={pill.key}
                onClick={() => setOutStatusFilter(pill.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  outStatusFilter === pill.key
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label={sourceTab === 'out_of_bom' ? t('requisitions.stats.awaitingRelease') : t('requisitions.stats.awaitingApproval')}
            value={stats.requested}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
            onClick={() => {
              if (sourceTab === 'out_of_bom') setOutStatusFilter('approved');
              else setStatusFilter('requested');
              setInsufficientOnly(false);
            }}
          />
          <StatCard
            label={sourceTab === 'out_of_bom' ? t('requisitions.stats.released') : t('requisitions.stats.approved')}
            value={stats.approved}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
            onClick={() => {
              if (sourceTab === 'out_of_bom') setOutStatusFilter('released');
              else setStatusFilter('approved');
              setInsufficientOnly(false);
            }}
          />
          <StatCard
            label={t('requisitions.stats.insufficient')}
            value={stats.insufficient}
            icon={AlertTriangle}
            iconColor={stats.insufficient > 0 ? 'text-red-500' : 'text-gray-400'}
            accentColor={stats.insufficient > 0 ? 'border-red-500' : 'border-gray-300'}
            onClick={() => {
              if (sourceTab === 'out_of_bom') setOutStatusFilter('approved');
              else setStatusFilter('all');
              setInsufficientOnly(true);
            }}
          />
        </div>

        <div className="p-4 rounded-2xl border border-emerald-100 bg-white shadow-[0_6px_20px_rgba(6,78,59,0.07)] space-y-3">
          {/* Row 1: status + search + refresh */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-56">
              <label className="block text-xs text-gray-500 mb-1">{t('requisitions.filters.status')}</label>
              <DxSelectBox
                items={STATUS_OPTIONS}
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as string)}
                valueExpr="value"
                displayExpr="label"
              />
            </div>
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs text-gray-500 mb-1">{t('requisitions.filters.selectRequisition')}</label>
              <DxSelectBox
                dataSource={woOptions}
                value={search}
                onValueChange={(v) => setSearch(String(v ?? ''))}
                displayExpr="label"
                valueExpr="value"
                searchEnabled
                showClearButton
                placeholder={t('requisitions.filters.selectRequisitionPlaceholder')}
              />
            </div>
            <DxButton
              text={t('common.refresh')}
              icon="refresh"
              type="normal"
              stylingMode="outlined"
              onClick={fetchRequisitions}
            />
          </div>

          {/* Row 2: date range + quick presets */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-44">
              <label className="block text-xs text-gray-500 mb-1">{t('requisitions.filters.requestedFrom')}</label>
              <DxDateBox
                value={dateFrom}
                onValueChange={(v) => setDateFrom(v ?? '')}
                placeholder={t('requisitions.filters.startDate')}
                showClearButton
              />
            </div>
            <div className="w-44">
              <label className="block text-xs text-gray-500 mb-1">{t('requisitions.filters.to')}</label>
              <DxDateBox
                value={dateTo}
                onValueChange={(v) => setDateTo(v ?? '')}
                placeholder={t('requisitions.filters.endDate')}
                showClearButton
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-400">{t('requisitions.filters.quick')}</span>
              <button
                className="text-xs px-2 py-1 rounded-md border border-emerald-100 bg-[#F6FCF9] hover:bg-[#E6F6EE] text-[#4B7163]"
                onClick={() => setDatePreset('today')}
              >{t('requisitions.filters.today')}</button>
              <button
                className="text-xs px-2 py-1 rounded-md border border-emerald-100 bg-[#F6FCF9] hover:bg-[#E6F6EE] text-[#4B7163]"
                onClick={() => setDatePreset('last7')}
              >{t('requisitions.filters.last7')}</button>
              <button
                className="text-xs px-2 py-1 rounded-md border border-emerald-100 bg-[#F6FCF9] hover:bg-[#E6F6EE] text-[#4B7163]"
                onClick={() => setDatePreset('last30')}
              >{t('requisitions.filters.last30')}</button>
              <button
                className="text-xs px-2 py-1 rounded-md border border-emerald-100 bg-[#F6FCF9] hover:bg-[#E6F6EE] text-[#4B7163]"
                onClick={() => setDatePreset('thisMonth')}
              >{t('requisitions.filters.thisMonth')}</button>
            </div>
            <div className="flex-1" />
            {/* Insufficient toggle */}
            <button
              onClick={() => setInsufficientOnly(!insufficientOnly)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                insufficientOnly
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-emerald-100 text-[#4B7163] hover:bg-[#F6FCF9]'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('requisitions.filters.insufficientOnly')}
            </button>
          </div>

          {/* Row 3: Active filter chips + clear all (only when filters are set) */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">{t('requisitions.filters.activeFilters')}</span>
              {statusFilter !== 'requested' && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {t('requisitions.filters.chipStatus', { label: STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label ?? '' })}
                  <button onClick={() => setStatusFilter('requested')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {search.trim() && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {t('requisitions.filters.chipSearch', { value: search })}
                  <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {t('requisitions.filters.chipDate', { from: dateFrom || '…', to: dateTo || '…' })}
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }}><X className="h-3 w-3" /></button>
                </span>
              )}
              {insufficientOnly && (
                <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                  {t('requisitions.filters.chipInsufficient')}
                  <button onClick={() => setInsufficientOnly(false)}><X className="h-3 w-3" /></button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
              >{t('requisitions.filters.clearAll')}</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            {t('requisitions.loading')}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-100 bg-white p-12 text-center text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-gray-400" />
            {t('requisitions.empty')}
          </div>
        ) : (
          <DxDataGrid
            dataSource={gridRows}
            keyExpr="_key"
            showBorders
            showRowLines
            rowAlternationEnabled
            columnAutoWidth
            pageSize={20}
            allowedPageSizes={[10, 20, 50, 100]}
            onRowClick={(e) => router.push(`/inventory/requisitions/${e.key}`)}
            elementAttr={{ 'data-testid': 'requisitions-grid' }}
          >
            <DxColumn
              caption="#"
              width={48}
              alignment="center"
              allowSorting={false}
              allowFiltering={false}
              cellRender={(c) => (
                <span className="text-gray-500 text-sm font-medium">{(c.row?.loadIndex ?? 0) + 1}</span>
              )}
            />
            <DxColumn
              caption={t('requisitions.table.workOrder')}
              minWidth={180}
              cellRender={(c) => {
                const req = c.data as RequisitionRow;
                return (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{req.woNumber}</div>
                    <div className="text-xs text-gray-500">Batch {req.batchNumber}</div>
                  </div>
                );
              }}
            />
            <DxColumn
              caption={t('requisitions.table.materialName')}
              minWidth={200}
              cellRender={(c) => {
                const req = c.data as RequisitionRow;
                return (
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900">{req.productName ?? '—'}</div>
                    <div className="text-xs text-gray-500">{req.productCode ?? ''}</div>
                    {req.source === 'out_of_bom' && req.reasonType && (
                      <div className="text-xs text-blue-600 mt-0.5">
                        {t('requisitions.reason', { reason: reasonLabel(req.reasonType) })}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <DxColumn
              caption="ขอเบิกโดย"
              width={170}
              cellRender={(c) => {
                const req = c.data as RequisitionRow;
                return (
                  <div className="text-xs text-gray-600">
                    <div>{req.requestedBy ?? '—'}</div>
                    <div>{formatDateTh(req.requestedAt)}</div>
                  </div>
                );
              }}
            />
            <DxColumn
              caption={t('requisitions.statusOptions.all')}
              width={170}
              alignment="center"
              cellRender={(c) => {
                const req = c.data as RequisitionRow;
                const insufficient = req.materials.some(isInsufficient);
                return (
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {insufficient && req.workflowStatus !== 'released' && (
                      <Badge variant="danger" dot>
                        <AlertTriangle className="h-3 w-3 mr-1" /> {t('requisitions.badges.insufficient')}
                      </Badge>
                    )}
                    {req.source === 'out_of_bom' ? (
                      <Badge variant={req.workflowStatus === 'released' ? 'success' : 'warning'} dot>
                        {req.workflowStatus === 'released'
                          ? t('requisitions.badges.released')
                          : t('requisitions.badges.awaitingRelease')}
                      </Badge>
                    ) : (
                      <Badge variant={req.requisitionStatus === 'approved' ? 'success' : 'warning'} dot>
                        {req.requisitionStatus === 'approved'
                          ? t('requisitions.badges.approved')
                          : t('requisitions.badges.awaitingApproval')}
                      </Badge>
                    )}
                  </div>
                );
              }}
            />
          </DxDataGrid>
        )}
      </div>
    </MainLayout>
  );
}
