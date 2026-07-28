/**
 * Credit/Debit Notes List Page (T095)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import DataGrid, {
  Column,
  Paging,
  Toolbar,
  Item,
  SearchPanel,
} from 'devextreme-react/data-grid';
import type { CreditDebitNote, NoteSummary } from '@/types/credit-debit-notes';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const noteTypeLabels: Record<string, string> = {
  ar_credit: 'AR Credit',
  ap_credit: 'AP Credit',
  ar_debit: 'AR Debit',
  ap_debit: 'AP Debit',
};

export default function CreditDebitNotesPage() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const [notes, setNotes] = useState<CreditDebitNote[]>([]);
  const [summary, setSummary] = useState<NoteSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notesRes, summaryRes] = await Promise.all([
        fetch('/api/accounting/credit-debit-notes'),
        fetch('/api/accounting/credit-debit-notes/dashboard'),
      ]);

      const notesData = await notesRes.json();
      const summaryData = await summaryRes.json();

      if (notesData.success) {
        setNotes(notesData.data);
      }
      if (summaryData.success) {
        setSummary(summaryData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewNote = () => {
    router.push('/accounting/credit-debit-notes/new');
  };

  const handleViewNote = (id: number) => {
    router.push(`/accounting/credit-debit-notes/${id}`);
  };

  const renderStatus = (cellData: any) => {
    const status = cellData.value as string;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
    );
  };

  const renderNoteType = (cellData: any) => {
    const noteType = cellData.value as string;
    return noteTypeLabels[noteType] || noteType;
  };

  const renderAmount = (cellData: any) => {
    const amount = Number(cellData.value || 0);
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  const formatDate = (cellData: any) => {
    const date = cellData.value;
    if (!date) return '';
    return new Date(date).toLocaleDateString('th-TH');
  };

  const renderActions = (cellData: any) => {
    const note = cellData.data as CreditDebitNote;
    return (
      <Button
        icon="search"
        hint={t('creditDebitNotes.actions.view')}
        stylingMode="text"
        onClick={() => handleViewNote(note.id)}
      />
    );
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('page.title')}
          </h1>
          <p className="text-gray-600">
            {t('creditDebitNotes.description')}
          </p>
        </div>

        {/* Dashboard Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
              <div className="text-sm text-gray-500">{t('creditDebitNotes.stats.draft')}</div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.draftCount}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500">{t('creditDebitNotes.stats.pendingApproval')}</div>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.pendingApprovalCount}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">{t('creditDebitNotes.stats.postedThisMonth')}</div>
              <div className="text-2xl font-bold text-green-600">
                {summary.postedThisMonth}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500">{t('creditDebitNotes.stats.totalThisMonth')}</div>
              <div className="text-2xl font-bold text-blue-600">
                {summary.totalThisMonth.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {/* Notes Grid */}
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={notes}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            allowColumnResizing={true}
            columnAutoWidth={true}
            data-testid="notes-grid"
          >
            <SearchPanel visible={true} placeholder={t('creditDebitNotes.filters.searchPlaceholder')} />
            <Paging defaultPageSize={20} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">{t('creditDebitNotes.title')}</span>
              </Item>
              <Item location="after">
                <Button
                  text={t('creditDebitNotes.actions.new')}
                  icon="plus"
                  type="default"
                  stylingMode="contained"
                  onClick={handleNewNote}
                  elementAttr={{ 'data-testid': 'new-note-btn' }}
                />
              </Item>
            </Toolbar>

            <Column dataField="noteNumber" caption={t('creditDebitNotes.columns.noteNumber')} width={150} />
            <Column
              dataField="noteType"
              caption={t('creditDebitNotes.columns.noteType')}
              width={100}
              cellRender={renderNoteType}
            />
            <Column
              dataField="noteDate"
              caption={t('creditDebitNotes.columns.noteDate')}
              width={100}
              cellRender={formatDate}
            />
            <Column dataField="customerName" caption={t('creditDebitNotes.columns.customer')} width={150} />
            <Column dataField="vendorName" caption={t('creditDebitNotes.columns.vendor')} width={150} />
            <Column dataField="reasonCode" caption={t('creditDebitNotes.columns.reason')} width={120} />
            <Column
              dataField="totalAmount"
              caption={t('creditDebitNotes.columns.amount')}
              width={120}
              alignment="right"
              cellRender={renderAmount}
            />
            <Column
              dataField="status"
              caption={t('creditDebitNotes.columns.status')}
              width={100}
              alignment="center"
              cellRender={renderStatus}
            />
            <Column
              caption={t('creditDebitNotes.columns.actions')}
              width={80}
              alignment="center"
              cellRender={renderActions}
            />
          </DataGrid>
        </div>
      </div>
  );
}
