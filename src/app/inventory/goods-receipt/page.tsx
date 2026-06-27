'use client';

/**
 * Goods Receipt — list / dashboard
 * Feature: 020-goods-receipt
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DxDataGrid,
  DxColumn,
  DxFilterRow,
  DxPaging,
  DxHeaderFilter,
} from '@/components/ui/dx-data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { DateBox } from 'devextreme-react/date-box';
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { ClipboardCheck, AlertTriangle, CheckCircle2, Hourglass, FlaskConical } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import type { IncomingDashboardCounts, GrnWorkflowStatus } from '@/types/goods-receipt';

interface GrnListItem {
  id: number;
  grnNumber: string;
  sourceType: 'po' | 'wo';
  status: string;
  receivedDate: string;
  vendorId: number | null;
  vendorName: string | null;
  woNumber: string | null;
  lineCount: number;
  workflowStatus: GrnWorkflowStatus;
  canCancel: boolean;
}

type WorkflowFilter = GrnWorkflowStatus | 'all';

// Pill / column colours per derived workflow status. Green (emerald) is
// reserved ONLY for the final "released / ผ่านแล้ว" state — every in-progress
// stage uses a distinct non-green colour so a green badge always means "done".
const WORKFLOW_BADGE: Record<GrnWorkflowStatus, string> = {
  pending_checklist: 'bg-amber-100 text-amber-800',
  pending_qc: 'bg-sky-100 text-sky-800',
  pending_qa: 'bg-violet-100 text-violet-800',
  released: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

// Per-filter pill colours — active (filled) + inactive (tinted) variants so
// each workflow tab visually carries its own status colour. Keyed by the
// WorkflowFilter values; 'all' stays neutral.
const PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  all: {
    active: 'bg-gray-700 text-white border-gray-700',
    inactive: 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
  },
  pending_checklist: {
    active: 'bg-amber-500 text-white border-amber-500',
    inactive: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400',
  },
  pending_qc: {
    active: 'bg-sky-500 text-white border-sky-500',
    inactive: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-400',
  },
  pending_qa: {
    active: 'bg-violet-500 text-white border-violet-500',
    inactive: 'bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400',
  },
  released: {
    active: 'bg-emerald-600 text-white border-emerald-600',
    inactive: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400',
  },
};

export default function GoodsReceiptListPage() {
  const t = useTranslations('goodsReceipt');
  const router = useRouter();

  const { data: counts } = useQuery<IncomingDashboardCounts>({
    queryKey: ['grn-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/quality/incoming-inspection/dashboard');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30_000,
  });

  const qc = useQueryClient();

  // Active workflow-status filter — driven by the KPI cards + pill bar.
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
  // Extra register filters (server-side via existing API params).
  const [sourceFilter, setSourceFilter] = useState<'all' | 'po' | 'wo'>('all');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  // Free-text search over GRN number / vendor / WO (client-side).
  const [searchText, setSearchText] = useState('');

  const { data, refetch } = useQuery<{ items: GrnListItem[]; total: number }>({
    queryKey: ['grn-list', workflowFilter, sourceFilter, dateFrom, dateTo],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (workflowFilter !== 'all') qs.set('workflowStatus', workflowFilter);
      if (sourceFilter !== 'all') qs.set('sourceType', sourceFilter);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      const res = await fetch(`/api/inventory/goods-receipts?${qs}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Client-side text filter applied on top of the server-filtered list.
  const visibleItems = (data?.items ?? []).filter((row) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      row.grnNumber?.toLowerCase().includes(q) ||
      (row.vendorName ?? '').toLowerCase().includes(q) ||
      (row.woNumber ?? '').toLowerCase().includes(q)
    );
  });

  const hasActiveFilters =
    sourceFilter !== 'all' || !!dateFrom || !!dateTo || !!searchText.trim() || workflowFilter !== 'all';

  const clearFilters = () => {
    setSourceFilter('all');
    setDateFrom(null);
    setDateTo(null);
    setSearchText('');
    setWorkflowFilter('all');
  };

  // Cancel a GRN straight from the register (so a cancelled PO/WO can be
  // re-selected via "+ สร้าง GRN"). Backend enforces creator + 24h window +
  // all-lines-still-created; the list `canCancel` flag hides obviously-invalid rows.
  const [cancelTarget, setCancelTarget] = useState<GrnListItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      const res = await fetch(`/api/inventory/goods-receipts/${cancelTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'ยกเลิกใบรับของไม่สำเร็จ');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn-list'] });
      qc.invalidateQueries({ queryKey: ['grn-dashboard'] });
      setCancelTarget(null);
      setCancelReason('');
    },
  });

  // White card + left accent bar + coloured icon (matches the shared StatCard
  // style used system-wide). `accent` = left bar colour, `iconCls` = icon tint.
  // KPI cards. `filter` links a card to a workflow-status drill-down; cards
  // without one (aging is computed from inventory lots, not GRN workflow) stay
  // non-interactive.
  const tiles: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    iconCls: string;
    filter?: WorkflowFilter;
  }> = [
    {
      label: t('tiles.pendingChecklist'),
      value: counts?.pendingChecklistCount ?? 0,
      icon: <Hourglass className="w-5 h-5" />,
      accent: 'border-l-amber-500',
      iconCls: 'text-amber-500',
      filter: 'pending_checklist',
    },
    {
      label: t('tiles.pendingQa'),
      value: counts?.pendingQaCount ?? 0,
      icon: <FlaskConical className="w-5 h-5" />,
      accent: 'border-l-blue-500',
      iconCls: 'text-blue-500',
      filter: 'pending_qa',
    },
    {
      label: t('tiles.releasedToday'),
      value: counts?.releasedTodayCount ?? 0,
      icon: <CheckCircle2 className="w-5 h-5" />,
      accent: 'border-l-emerald-500',
      iconCls: 'text-emerald-500',
      filter: 'released',
    },
    {
      label: t('tiles.quarantineAging'),
      value: counts?.quarantineAgingCount ?? 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      accent: 'border-l-rose-500',
      iconCls: 'text-rose-500',
    },
  ];

  // Pill bar — quick toggles across the GRN workflow stages.
  const pills: Array<{ key: WorkflowFilter; label: string }> = [
    { key: 'all', label: t('status.workflow.all') },
    { key: 'pending_checklist', label: t('status.workflow.pending_checklist') },
    { key: 'pending_qc', label: t('status.workflow.pending_qc') },
    { key: 'pending_qa', label: t('status.workflow.pending_qa') },
    { key: 'released', label: t('status.workflow.released') },
  ];

  return (
    <div className="p-6 space-y-4">
      <BackButton href="/inventory" label="Inventory" />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#064E3B]">
            <ClipboardCheck className="w-6 h-6" />
            {t('page.title')}
          </h1>
          <p className="text-[#4B7163] text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        {/* GRN is created automatically (PO → on receive/approve, WO → on Work
            Order close), so there's no manual "create GRN" entry point here.
            The /goods-receipt/new route is kept as a fallback but unlinked. */}
        <div className="flex gap-2">
          <Button text={t('actions.refresh')} onClick={() => refetch()} />
        </div>
      </header>

      {/* Tiles — clickable cards drill the list down to that workflow stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const clickable = !!tile.filter;
          const isActive = clickable && workflowFilter === tile.filter;
          return (
            <button
              key={tile.label}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setWorkflowFilter(isActive ? 'all' : tile.filter!)}
              aria-pressed={isActive}
              className={`text-left bg-white border border-gray-200 border-l-4 ${tile.accent} rounded-[14px] p-4 flex items-center justify-between shadow-[0_6px_20px_rgba(6,78,59,0.06)] transition ${
                clickable ? 'cursor-pointer hover:shadow-[0_8px_24px_rgba(6,78,59,0.12)]' : 'cursor-default'
              } ${isActive ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
            >
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{tile.label}</div>
                <div className="text-3xl font-bold mt-1 text-gray-900">{tile.value}</div>
              </div>
              <div className={tile.iconCls}>{tile.icon}</div>
            </button>
          );
        })}
      </div>

      {/* Workflow-status pill bar */}
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const active = workflowFilter === pill.key;
          const colors = PILL_COLORS[pill.key] ?? PILL_COLORS.all;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setWorkflowFilter(pill.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                active ? colors.active : colors.inactive
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar — source type, received-date range, free-text search.
          sourceType/dateFrom/dateTo go to the server (existing API params);
          the search box filters the returned rows client-side. */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('filters.sourceType')}</label>
          <SelectBox
            width={170}
            value={sourceFilter}
            onValueChanged={(e) => setSourceFilter(e.value)}
            valueExpr="value"
            displayExpr="text"
            items={[
              { value: 'all', text: t('filters.allSources') },
              { value: 'po', text: t('sourceType.po') },
              { value: 'wo', text: t('sourceType.wo') },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('filters.dateFrom')}</label>
          <DateBox
            width={150}
            type="date"
            displayFormat="dd/MM/yyyy"
            value={dateFrom}
            onValueChanged={(e) =>
              setDateFrom(e.value ? new Date(e.value).toISOString().slice(0, 10) : null)
            }
            showClearButton
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{t('filters.dateTo')}</label>
          <DateBox
            width={150}
            type="date"
            displayFormat="dd/MM/yyyy"
            value={dateTo}
            onValueChanged={(e) =>
              setDateTo(e.value ? new Date(e.value).toISOString().slice(0, 10) : null)
            }
            showClearButton
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500">{t('filters.search')}</label>
          <TextBox
            value={searchText}
            onValueChanged={(e) => setSearchText(e.value ?? '')}
            placeholder={t('filters.searchPlaceholder')}
            showClearButton
            mode="search"
          />
        </div>
        {hasActiveFilters && (
          <Button
            text={t('filters.clear')}
            icon="clear"
            stylingMode="outlined"
            onClick={clearFilters}
          />
        )}
      </div>

      {/* List */}
      <DxDataGrid
        dataSource={visibleItems}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        onRowClick={(e) => router.push(`/inventory/goods-receipt/${e.key}`)}
        elementAttr={{ 'data-testid': 'grn-list-grid' }}
        paging={false}
      >
        <DxFilterRow visible={false} />
        <DxHeaderFilter visible={false} />
        <DxPaging defaultPageSize={20} />
        <DxColumn dataField="grnNumber" caption={t('table.columns.grnNumber')} width={150} />
        <DxColumn
          dataField="sourceType"
          caption={t('table.columns.sourceType')}
          width={160}
          cellRender={(c) => {
            const v = c.value as 'po' | 'wo';
            // Distinct colours: ใบสั่งซื้อ (po) = teal, ใบสั่งผลิต (wo) = indigo.
            const cls =
              v === 'po'
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200';
            return (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
                title={t(`sourceType.${v}`)}
              >
                {t(`sourceTypeShort.${v}`)}
              </span>
            );
          }}
        />
        <DxColumn
          dataField="vendorName"
          caption={t('table.columns.vendor')}
          calculateCellValue={(row: GrnListItem) =>
            row.sourceType === 'po'
              ? row.vendorName ?? '-'
              : row.woNumber ?? t('sourceTypeShort.wo')
          }
        />
        <DxColumn dataField="receivedDate" caption={t('table.columns.receivedDate')} width={140} dataType="date" />
        <DxColumn dataField="lineCount" caption={t('table.columns.lineCount')} width={100} />
        <DxColumn
          dataField="workflowStatus"
          caption={t('table.columns.status')}
          width={150}
          cellRender={(c) => {
            const v = c.value as GrnWorkflowStatus;
            return (
              <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${WORKFLOW_BADGE[v] ?? 'bg-gray-100'}`}>
                {t(`status.workflow.${v}`)}
              </span>
            );
          }}
        />
        <DxColumn
          caption=""
          width={150}
          allowFiltering={false}
          allowSorting={false}
          cellRender={(c) => {
            const row = c.data as GrnListItem;
            if (!row.canCancel) return null;
            return (
              <Button
                type="danger"
                stylingMode="outlined"
                onClick={(e) => {
                  // Stop the row-click navigation to the detail page.
                  (e.event as Event | undefined)?.stopPropagation?.();
                  setCancelTarget(row);
                }}
                render={() => (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <AlertTriangle className="w-4 h-4" />
                    {t('actions.cancelGrn')}
                  </span>
                )}
              />
            );
          }}
        />
      </DxDataGrid>

      {/* Cancel GRN popup.
          Uses contentRender (not plain children) so DevExtreme portals the body
          INTO the popup's content area. Passing children directly made the form
          leak out and render BELOW the grid while the popup itself showed empty
          (DevExpress T1064246) — exactly the "empty popup + duplicate form under
          the table" the user hit. */}
      <Popup
        visible={!!cancelTarget}
        onHiding={() => setCancelTarget(null)}
        dragEnabled={false}
        hideOnOutsideClick
        showTitle
        title={t('actions.cancelGrn')}
        width={460}
        height="auto"
        contentRender={() =>
          cancelTarget ? (
            <div className="space-y-4 p-2">
              <p className="text-sm font-medium text-gray-800">{cancelTarget.grnNumber}</p>
              <p className="text-sm text-gray-600">{t('cancel.warning')}</p>
              <div>
                <label className="block text-sm font-medium mb-1">{t('cancel.reasonLabel')}</label>
                <TextArea
                  value={cancelReason}
                  onValueChanged={(e) => setCancelReason(e.value ?? '')}
                  height={90}
                  placeholder={t('cancel.reasonPlaceholder')}
                />
              </div>
              {cancelMut.isError && (
                <p className="text-sm text-red-600">{(cancelMut.error as Error)?.message}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setCancelTarget(null)} />
                <Button
                  text={t('actions.cancelGrn')}
                  type="danger"
                  stylingMode="contained"
                  disabled={cancelReason.trim().length < 10 || cancelMut.isPending}
                  onClick={() => cancelMut.mutate()}
                />
              </div>
            </div>
          ) : (
            <div />
          )
        }
      />
    </div>
  );
}
