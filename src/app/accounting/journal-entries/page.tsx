'use client';

/**
 * Journal Entries Page
 * Feature: 010-accounting-module-integration
 * User Story 2: Record Purchase-to-Pay Transactions
 * Updated to follow template pattern with Card components and icon actions
 */

import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Eye, Check, RotateCcw } from 'lucide-react';
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
import { SelectBox } from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';

// Types
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

// API functions
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

export default function JournalEntriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('accounting');
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [sourceTypeFilter, setSourceTypeFilter] = React.useState<string>('');

  // Custom confirm dialog state
  const [confirmDialog, setConfirmDialog] = React.useState<{
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

  // Queries
  const { data: entries = [] } = useQuery({
    queryKey: ['journal-entries', statusFilter, sourceTypeFilter],
    queryFn: () =>
      fetchJournalEntries({
        status: statusFilter || undefined,
        sourceType: sourceTypeFilter || undefined,
      }),
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

  // Handlers
  const handleRowClick = useCallback(
    (e: { data: JournalEntry }) => {
      router.push(`/accounting/journal-entries/${e.data.id}`);
    },
    [router]
  );

  const handlePost = useCallback(
    (entry: JournalEntry, e: React.MouseEvent) => {
      e.stopPropagation();
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
    (entry: JournalEntry, e: React.MouseEvent) => {
      e.stopPropagation();
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

  const handleView = useCallback(
    (entry: JournalEntry, e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(`/accounting/journal-entries/${entry.id}`);
    },
    [router]
  );

  // Status badge render
  const statusCellRender = useCallback((cellData: { value: 'draft' | 'posted' | 'reversed' }) => {
    return <AccountingStatusBadge status={cellData.value} />;
  }, []);

  // Source type label
  const sourceTypeCellRender = useCallback((cellData: { value: string | null }) => {
    const value = cellData.value;
    if (!value) return '-';
    // Use translation key dynamically
    return t(`journalEntries.sourceTypes.${value}` as const) || value;
  }, [t]);

  // Action buttons render with Lucide icons
  const actionsCellRender = useCallback(
    (cellData: { data: JournalEntry }) => {
      const entry = cellData.data as JournalEntry;
      return (
        <div className="flex items-center gap-1">
          {/* View button */}
          <button
            onClick={(e) => handleView(entry, e)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={t('journalEntries.actions.view')}
            data-testid={`je-view-btn-${entry.id}`}
          >
            <Eye className="h-4 w-4" />
          </button>

          {/* Post button - only for draft entries */}
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

          {/* Reverse button - only for posted entries */}
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

  // Master-detail for journal lines
  const renderDetail = useCallback((props: { data: { key: number } }) => {
    const { key } = props.data;
    return <JournalLinesDetail entryId={key} />;
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = entries.length;
    const draft = entries.filter((e) => e.status === 'draft').length;
    const posted = entries.filter((e) => e.status === 'posted').length;
    const reversed = entries.filter((e) => e.status === 'reversed').length;

    return { total, draft, posted, reversed };
  }, [entries]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <AccountingPageHeader
        title={t('journalEntries.title')}
        subtitle={t('journalEntries.subtitle')}
        icon="file-text"
        onRefresh={handleRefresh}
        actions={
          <span data-testid="add-entry-button">
            <Button
              text={t('journalEntries.addEntry')}
              icon="plus"
              type="success"
              onClick={() => router.push('/accounting/journal-entries/new')}
            />
          </span>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="kpi-cards">
          <AccountingKPICard
            label={t('journalEntries.stats.total')}
            value={stats.total}
            icon="file-text"
            variant="info"
          />
          <AccountingKPICard
            label={t('journalEntries.stats.draft')}
            value={stats.draft}
            icon="clock"
            variant="default"
          />
          <AccountingKPICard
            label={t('journalEntries.stats.posted')}
            value={stats.posted}
            icon="check-circle"
            variant="success"
          />
          <AccountingKPICard
            label={t('journalEntries.stats.reversed')}
            value={stats.reversed}
            icon="arrow-down"
            variant="danger"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('journalEntries.filters.status')}
            </label>
            <SelectBox
              dataSource={[
                { value: '', label: t('journalEntries.filters.all') },
                { value: 'draft', label: t('journalEntries.stats.draft') },
                { value: 'posted', label: t('journalEntries.stats.posted') },
                { value: 'reversed', label: t('journalEntries.stats.reversed') },
              ]}
              displayExpr="label"
              valueExpr="value"
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value)}
              placeholder={t('journalEntries.filters.statusPlaceholder')}
              width={150}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('journalEntries.filters.type')}
            </label>
            <SelectBox
              dataSource={[
                { value: '', label: t('journalEntries.filters.allTypes') },
                { value: 'MANUAL', label: t('journalEntries.sourceTypes.MANUAL') },
                { value: 'PO_RECEIPT', label: t('journalEntries.sourceTypes.PO_RECEIPT') },
                { value: 'SO_SHIPMENT', label: t('journalEntries.sourceTypes.SO_SHIPMENT') },
                { value: 'AP_PAYMENT', label: t('journalEntries.sourceTypes.AP_PAYMENT') },
                { value: 'AR_RECEIPT', label: t('journalEntries.sourceTypes.AR_RECEIPT') },
              ]}
              displayExpr="label"
              valueExpr="value"
              value={sourceTypeFilter}
              onValueChanged={(e) => setSourceTypeFilter(e.value)}
              placeholder={t('journalEntries.filters.typePlaceholder')}
              width={180}
            />
          </div>
        </AccountingFilterPanel>

        {/* Data Grid wrapped in Card */}
        <Card>
          <CardContent className="p-0" data-testid="journal-entries-grid">
            <DataGrid
              dataSource={entries}
              keyExpr="id"
              showBorders={false}
              showRowLines={true}
              showColumnLines={false}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={true}
              hoverStateEnabled={true}
              onRowClick={handleRowClick}
              className="min-h-[400px]"
            >
            <Paging defaultPageSize={20} />
            <Pager
              visible={true}
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50]}
              showInfo={true}
            />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} placeholder={t('journalEntries.search')} />
            <Sorting mode="multiple" />
            <Selection mode="single" />
            <ColumnChooser enabled={true} />
            <Export enabled={true} />

            <MasterDetail enabled={true} component={renderDetail} />

            <Toolbar>
              <Item name="searchPanel" location="before" />
              <Item name="exportButton" location="after" />
              <Item name="columnChooserButton" location="after" />
            </Toolbar>

            <Column dataField="entryNumber" caption={t('journalEntries.columns.entryNumber')} width={160} />
            <Column dataField="entryDate" caption={t('journalEntries.columns.date')} dataType="date" width={110} />
            <Column
              dataField="sourceType"
              caption={t('journalEntries.columns.type')}
              width={110}
              cellRender={sourceTypeCellRender}
            />
            <Column dataField="description" caption={t('journalEntries.columns.description')} minWidth={200} />
            <Column
              dataField="totalDebit"
              caption={t('journalEntries.columns.debit')}
              dataType="number"
              width={120}
              alignment="right"
            >
              <Format type="fixedPoint" precision={2} />
            </Column>
            <Column
              dataField="totalCredit"
              caption={t('journalEntries.columns.credit')}
              dataType="number"
              width={120}
              alignment="right"
            >
              <Format type="fixedPoint" precision={2} />
            </Column>
            <Column
              dataField="status"
              caption={t('journalEntries.columns.status')}
              width={100}
              cellRender={statusCellRender}
            />
            <Column
              caption={t('journalEntries.columns.actions')}
              width={120}
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
          </CardContent>
        </Card>
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

// Journal Lines Detail Component
function JournalLinesDetail({ entryId }: { entryId: number }) {
  const t = useTranslations('accounting');
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => fetchJournalEntryById(entryId),
  });

  if (isLoading) {
    return <div className="p-4">{t('journalEntries.detail.loading')}</div>;
  }

  if (!entry || !entry.lines) {
    return <div className="p-4">{t('journalEntries.detail.noLines')}</div>;
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
                {line.debit > 0 ? line.debit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : ''}
              </td>
              <td className="border p-2 text-right">
                {line.credit > 0 ? line.credit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
