'use client';

/**
 * Journal Entries Page
 * Feature: 010-accounting-module-integration
 * User Story 2: Record Purchase-to-Pay Transactions
 *
 * Responsive dashboard with ResponsivePageHeader, StatCard KPI row,
 * scroll-snap status tabs, mobile card view, empty / no-results /
 * loading states, and DevExtreme DataGrid with master-detail for desktop.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  BookOpen,
  FileText,
  Clock,
  CheckCircle,
  Calendar,
  Eye,
  Check,
  RotateCcw,
  Search,
  SearchX,
  ArrowDown,
  Boxes,
  ChevronRight,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
  Selection,
  Export,
  ColumnChooser,
  Sorting,
  Summary,
  TotalItem,
  Format,
  MasterDetail,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AccountingStatusBadge } from '@/components/accounting';
import { useMobile } from '@/hooks/use-mobile';

// ============================================
// Types
// ============================================

interface JournalLine {
  id: number;
  lineNumber: number;
  glAccountId: number;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description: string | null;
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  fiscalPeriodId: number | null;
  description: string | null;
  sourceType: string | null;
  sourceId: number | null;
  status: 'draft' | 'posted' | 'reversed';
  totalDebit: number;
  totalCredit: number;
  postedBy: number | null;
  postedAt: string | null;
  lines?: JournalLine[];
}

// next-intl translator type (accept compatible superset for helpers)
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

type StatusTabKey = '' | 'draft' | 'posted' | 'reversed';

// ============================================
// API
// ============================================

async function fetchJournalEntries(filters?: { status?: string; sourceType?: string }): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.sourceType) params.append('sourceType', filters.sourceType);
  const res = await fetch(`/api/accounting/journal-entries?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch entries');
  const json = await res.json();
  return json.data;
}

async function fetchJournalEntryById(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}`);
  if (!res.ok) throw new Error('Failed to fetch entry');
  const json = await res.json();
  return json.data;
}

async function postJournalEntry(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}/post`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to post entry');
  }
  return (await res.json()).data;
}

async function reverseJournalEntry(id: number): Promise<JournalEntry> {
  const res = await fetch(`/api/accounting/journal-entries/${id}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Manual reversal' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to reverse entry');
  }
  return (await res.json()).data;
}

// ============================================
// Helpers
// ============================================

function formatAmount(value: number): string {
  return Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toISOString().slice(0, 10);
  } catch {
    return '-';
  }
}

function isInCurrentMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch {
    return false;
  }
}

// ============================================
// Main Component
// ============================================

export default function JournalEntriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('accounting');
  const locale = useLocale();
  const { isMobile } = useMobile();

  const [statusFilter, setStatusFilter] = useState<StatusTabKey>('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // Custom confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    testIdPrefix: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    testIdPrefix: 'confirm-dialog',
    onConfirm: () => {},
  });

  // Fetch — always fetch all, filter client-side so tab counts are accurate
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: () => fetchJournalEntries(),
  });

  // Mutations
  const postMutation = useMutation({
    mutationFn: postJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      notify(t('journalEntries.toast.postSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('journalEntries.toast.postError'), 'error', 4000);
    },
  });

  const reverseMutation = useMutation({
    mutationFn: reverseJournalEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      notify(t('journalEntries.toast.reverseSuccess'), 'success', 3000);
    },
    onError: (error: Error) => {
      notify(error.message || t('journalEntries.toast.reverseError'), 'error', 4000);
    },
  });

  // Stats (based on unfiltered list)
  const stats = useMemo(() => {
    const total = entries.length;
    const draft = entries.filter((e) => e.status === 'draft').length;
    const posted = entries.filter((e) => e.status === 'posted').length;
    const reversed = entries.filter((e) => e.status === 'reversed').length;
    const thisMonth = entries.filter((e) => isInCurrentMonth(e.entryDate)).length;
    return { total, draft, posted, reversed, thisMonth };
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (statusFilter && entry.status !== statusFilter) return false;
      if (sourceTypeFilter && entry.sourceType !== sourceTypeFilter) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const number = entry.entryNumber?.toLowerCase() || '';
        const desc = entry.description?.toLowerCase() || '';
        const src = entry.sourceType?.toLowerCase() || '';
        if (!number.includes(q) && !desc.includes(q) && !src.includes(q)) return false;
      }
      return true;
    });
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [entries, statusFilter, sourceTypeFilter, searchText]);

  // ============================================
  // Handlers
  // ============================================

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
  }, [queryClient]);

  const handleRowClick = useCallback(
    (e: { data: JournalEntry }) => {
      router.push(`/accounting/journal-entries/${e.data.id}`);
    },
    [router]
  );

  const handleView = useCallback(
    (entry: JournalEntry, e?: React.MouseEvent) => {
      e?.stopPropagation();
      router.push(`/accounting/journal-entries/${entry.id}`);
    },
    [router]
  );

  const handlePost = useCallback(
    (entry: JournalEntry, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setConfirmDialog({
        visible: true,
        title: t('journalEntries.dialogs.postTitle'),
        message: t('journalEntries.dialogs.postMessage', { entryNumber: entry.entryNumber }),
        testIdPrefix: 'je-post',
        onConfirm: () => {
          postMutation.mutate(entry.id);
          setConfirmDialog((prev) => ({ ...prev, visible: false }));
        },
      });
    },
    [postMutation, t]
  );

  const handleReverse = useCallback(
    (entry: JournalEntry, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setConfirmDialog({
        visible: true,
        title: t('journalEntries.dialogs.reverseTitle'),
        message: `${t('journalEntries.dialogs.reverseMessage', { entryNumber: entry.entryNumber })}<br/>${t('journalEntries.dialogs.reverseNote')}`,
        testIdPrefix: 'je-reverse',
        onConfirm: () => {
          reverseMutation.mutate(entry.id);
          setConfirmDialog((prev) => ({ ...prev, visible: false }));
        },
      });
    },
    [reverseMutation, t]
  );

  const handleConfirmDialogCancel = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('');
    setSourceTypeFilter('');
    setSearchText('');
  }, []);

  // ============================================
  // Cell Renderers
  // ============================================

  const statusCellRender = useCallback(
    (cellData: { value: 'draft' | 'posted' | 'reversed' }) => (
      <AccountingStatusBadge status={cellData.value} />
    ),
    []
  );

  const sourceTypeCellRender = useCallback(
    (cellData: { value: string | null }) => {
      const value = cellData.value;
      if (!value) return '-';
      return t(`journalEntries.sourceTypes.${value}` as const) || value;
    },
    [t]
  );

  const actionsCellRender = useCallback(
    (cellData: { data: JournalEntry }) => {
      const entry = cellData.data;
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleView(entry, e)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={t('journalEntries.actions.view')}
            data-testid={`je-view-btn-${entry.id}`}
          >
            <Eye className="h-4 w-4" />
          </button>
          {entry.status === 'draft' && (
            <button
              onClick={(e) => handlePost(entry, e)}
              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title={t('journalEntries.actions.post')}
              data-testid={`je-post-btn-${entry.id}`}
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          {entry.status === 'posted' && (
            <button
              onClick={(e) => handleReverse(entry, e)}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title={t('journalEntries.actions.reverse')}
              data-testid={`je-reverse-btn-${entry.id}`}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    },
    [handleView, handlePost, handleReverse, t]
  );

  const renderDetail = useCallback((props: { data: { key: number } }) => {
    return <JournalLinesDetail entryId={props.data.key} />;
  }, []);

  // ============================================
  // Tab configuration
  // ============================================

  const statusTabs: Array<{ key: StatusTabKey; label: string; count: number }> = useMemo(
    () => [
      { key: '', label: t('journalEntries.filters.all'), count: stats.total },
      { key: 'draft', label: t('journalEntries.stats.draft'), count: stats.draft },
      { key: 'posted', label: t('journalEntries.stats.posted'), count: stats.posted },
      { key: 'reversed', label: t('journalEntries.stats.reversed'), count: stats.reversed },
    ],
    [t, stats]
  );

  const sourceTypeOptions: Array<{ value: string; label: string }> = useMemo(
    () => [
      { value: '', label: t('journalEntries.filters.allTypes') },
      { value: 'MANUAL', label: t('journalEntries.sourceTypes.MANUAL') },
      { value: 'PO_RECEIPT', label: t('journalEntries.sourceTypes.PO_RECEIPT') },
      { value: 'SO_SHIPMENT', label: t('journalEntries.sourceTypes.SO_SHIPMENT') },
      { value: 'AP_PAYMENT', label: t('journalEntries.sourceTypes.AP_PAYMENT') },
      { value: 'AR_RECEIPT', label: t('journalEntries.sourceTypes.AR_RECEIPT') },
    ],
    [t]
  );

  const showEmptyState = !isLoading && entries.length === 0;
  const showNoResultsState = !isLoading && entries.length > 0 && filteredEntries.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('journalEntries.title')}
        subtitle={t('journalEntries.subtitle')}
        icon={BookOpen}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              icon="refresh"
              text={t('journalEntries.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              elementAttr={{ 'data-testid': 'refresh-button', class: 'hidden sm:inline-flex' }}
            />
            <span data-testid="add-entry-button">
              <Button
                text={t('journalEntries.addEntry')}
                icon="plus"
                type="success"
                onClick={() => router.push('/accounting/journal-entries/new')}
              />
            </span>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="kpi-cards">
        <StatCard
          label={t('journalEntries.stats.total')}
          value={stats.total}
          icon={FileText}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('journalEntries.stats.draft')}
          value={stats.draft}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('journalEntries.stats.posted')}
          value={stats.posted}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('journalEntries.stats.thisMonth')}
          value={stats.thisMonth}
          icon={Calendar}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden">
        {/* Status Tabs (scroll-snap) */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x w-full">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key || 'all'}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px] ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  data-testid={`status-tab-${tab.key || 'all'}`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold ${
                      isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter / Search row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
            {/* Search */}
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('journalEntries.search')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                data-testid="je-search"
              />
            </div>
            {/* Source type filter */}
            <select
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 bg-white"
              data-testid="je-source-filter"
            >
              {sourceTypeOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Boxes className="h-4 w-4 text-gray-400" />
            <span>
              {filteredEntries.length} / {entries.length}
            </span>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          isMobile ? <JECardSkeletonList count={4} /> : <DataGridLoadingSkeleton />
        ) : showEmptyState ? (
          <EmptyState onCreate={() => router.push('/accounting/journal-entries/new')} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <JECardList
            entries={filteredEntries}
            onView={handleView}
            onPost={handlePost}
            onReverse={handleReverse}
            t={t}
          />
        ) : (
          <div className="je-compact-grid px-2 pb-1" data-testid="journal-entries-grid">
            <style>{`
              .je-compact-grid .dx-datagrid-rowsview .dx-row > td {
                padding: 6px 10px !important;
                line-height: 1.4 !important;
                border-bottom: 1px solid #f1f5f9;
              }
              .je-compact-grid .dx-datagrid-headers .dx-header-row > td {
                padding: 8px 10px !important;
                font-size: 0.72rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #6b7280;
              }
              .je-compact-grid .dx-data-row:hover > td {
                background-color: #fef3c7 !important;
                transition: background-color 0.15s ease;
              }
              .je-compact-grid .dx-data-row.dx-row-alt > td {
                background-color: #f8fafc;
              }
              .je-compact-grid .dx-datagrid { border: none; }
            `}</style>
            <DataGrid
              key={locale}
              dataSource={filteredEntries}
              keyExpr="id"
              showBorders={false}
              showRowLines
              showColumnLines={false}
              rowAlternationEnabled
              allowColumnReordering
              allowColumnResizing
              columnAutoWidth
              wordWrapEnabled
              hoverStateEnabled
              onRowClick={handleRowClick}
              className="min-h-[400px]"
            >
              <Paging defaultPageSize={20} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50]}
                showInfo
              />
              <FilterRow visible />
              <HeaderFilter visible />
              <SearchPanel visible={false} placeholder={t('journalEntries.search')} />
              <Sorting mode="multiple" />
              <Selection mode="single" />
              <ColumnChooser enabled />
              <Export enabled />

              <MasterDetail enabled component={renderDetail} />

              <Toolbar>
                <Item name="exportButton" location="after" />
                <Item name="columnChooserButton" location="after" />
              </Toolbar>

              <Column
                dataField="_rowNumber"
                caption={t('items.grid.columns.rowNum')}
                width={60}
                alignment="center"
                allowFiltering={false}
                allowSorting={false}
                allowGrouping={false}
                cellRender={(cellInfo) => (
                  <span className="text-gray-500 text-sm font-medium">
                    {cellInfo.data._rowNumber}
                  </span>
                )}
              />
              <Column
                dataField="entryNumber"
                caption={t('journalEntries.columns.entryNumber')}
                minWidth={140}
                cellRender={(cell: { value: string }) => (
                  <span className="font-mono font-medium text-amber-700 text-sm">{cell.value}</span>
                )}
              />
              <Column
                dataField="entryDate"
                caption={t('journalEntries.columns.date')}
                dataType="date"
                width={110}
              />
              <Column
                dataField="sourceType"
                caption={t('journalEntries.columns.type')}
                width={120}
                cellRender={sourceTypeCellRender}
              />
              <Column
                dataField="description"
                caption={t('journalEntries.columns.description')}
                minWidth={200}
              />
              <Column
                dataField="totalDebit"
                caption={t('journalEntries.columns.debit')}
                dataType="number"
                width={130}
                alignment="right"
              >
                <Format type="fixedPoint" precision={2} />
              </Column>
              <Column
                dataField="totalCredit"
                caption={t('journalEntries.columns.credit')}
                dataType="number"
                width={130}
                alignment="right"
              >
                <Format type="fixedPoint" precision={2} />
              </Column>
              <Column
                dataField="status"
                caption={t('journalEntries.columns.status')}
                width={110}
                cellRender={statusCellRender}
              />
              <Column
                caption={t('journalEntries.columns.actions')}
                width={130}
                cellRender={actionsCellRender}
                allowFiltering={false}
                allowSorting={false}
                alignment="center"
              />

              <Summary>
                <TotalItem column="totalDebit" summaryType="sum" displayFormat={t('journalEntries.summary.total')}>
                  <Format type="fixedPoint" precision={2} />
                </TotalItem>
                <TotalItem column="totalCredit" summaryType="sum" displayFormat={t('journalEntries.summary.total')}>
                  <Format type="fixedPoint" precision={2} />
                </TotalItem>
              </Summary>
            </DataGrid>
          </div>
        )}
      </div>

      {/* Custom Confirm Dialog with data-testid */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        testIdPrefix={confirmDialog.testIdPrefix}
        onConfirm={confirmDialog.onConfirm}
        onCancel={handleConfirmDialogCancel}
      />
    </div>
  );
}

// ============================================
// Journal Lines Detail Component (desktop master-detail)
// ============================================

function JournalLinesDetail({ entryId }: { entryId: number }) {
  const t = useTranslations('accounting');
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => fetchJournalEntryById(entryId),
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">{t('journalEntries.detail.loading')}</div>;
  }
  if (!entry || !entry.lines) {
    return <div className="p-4 text-sm text-gray-500">{t('journalEntries.detail.noLines')}</div>;
  }

  return (
    <div className="p-4 bg-gray-50">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2 text-left">{t('journalEntries.columns.account')}</th>
            <th className="border p-2 text-left">{t('journalEntries.columns.description')}</th>
            <th className="border p-2 text-right" style={{ width: 120 }}>
              {t('journalEntries.columns.debit')}
            </th>
            <th className="border p-2 text-right" style={{ width: 120 }}>
              {t('journalEntries.columns.credit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={line.id}>
              <td className="border p-2">
                {line.accountCode} - {line.accountName}
              </td>
              <td className="border p-2">{line.description || '-'}</td>
              <td className="border p-2 text-right">
                {line.debit > 0 ? formatAmount(line.debit) : ''}
              </td>
              <td className="border p-2 text-right">
                {line.credit > 0 ? formatAmount(line.credit) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Mobile Card List
// ============================================

function JECardList({
  entries,
  onView,
  onPost,
  onReverse,
  t,
}: {
  entries: JournalEntry[];
  onView: (entry: JournalEntry) => void;
  onPost: (entry: JournalEntry) => void;
  onReverse: (entry: JournalEntry) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {entries.map((entry) => {
        const isDraft = entry.status === 'draft';
        const isPosted = entry.status === 'posted';
        return (
          <div
            key={entry.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Tap-to-view body */}
            <button
              type="button"
              onClick={() => onView(entry)}
              className="w-full text-left p-4 flex items-start gap-3"
              data-testid={`je-card-${entry.id}`}
            >
              <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-base truncate">
                      {entry.entryNumber}
                    </p>
                    {entry.description && (
                      <p className="text-sm text-gray-700 truncate mt-0.5" title={entry.description}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <AccountingStatusBadge status={entry.status} />
                </div>

                {/* Posting date + source type tags */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    <Calendar className="h-3 w-3" />
                    {formatDate(entry.entryDate)}
                  </span>
                  {entry.sourceType && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {t(`journalEntries.sourceTypes.${entry.sourceType}`) || entry.sourceType}
                    </span>
                  )}
                </div>

                {/* Debit / Credit totals */}
                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">
                      {t('journalEntries.columns.debit')}
                    </p>
                    <p className="font-mono text-sm font-semibold text-emerald-700 tabular-nums truncate">
                      {formatAmount(entry.totalDebit)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  <div className="text-right min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">
                      {t('journalEntries.columns.credit')}
                    </p>
                    <p className="font-mono text-sm font-semibold text-rose-700 tabular-nums truncate">
                      {formatAmount(entry.totalCredit)}
                    </p>
                  </div>
                </div>
              </div>
            </button>

            {/* Footer actions (44px touch targets) */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(entry)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 transition-colors min-h-[44px]"
                data-testid={`je-view-card-${entry.id}`}
              >
                <Eye className="h-4 w-4" />
                <span>{t('journalEntries.actions.view')}</span>
              </button>
              {isDraft && (
                <button
                  type="button"
                  onClick={() => onPost(entry)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
                  data-testid={`je-post-card-${entry.id}`}
                >
                  <Check className="h-4 w-4" />
                  <span>{t('journalEntries.actions.post')}</span>
                </button>
              )}
              {isPosted && (
                <button
                  type="button"
                  onClick={() => onReverse(entry)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px]"
                  data-testid={`je-reverse-card-${entry.id}`}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{t('journalEntries.actions.reverse')}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Skeletons & Empty States
// ============================================

function JECardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
              </div>
              <div className="flex justify-between pt-2">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
        <BookOpen className="h-10 w-10 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('journalEntries.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('journalEntries.subtitle')}
      </p>
      <Button
        text={t('journalEntries.addEntry')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('journalEntries.empty.noResultsTitle')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('journalEntries.empty.noResultsDescription')}
      </p>
      <Button
        text={t('journalEntries.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

// Suppress unused import warning for ArrowDown (kept for potential future use)
void ArrowDown;
