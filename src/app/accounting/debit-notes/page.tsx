/**
 * Debit Notes List Page (T097)
 * Part of 011-accounting-spec-gap - User Story 3
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, {
  Column,
  Paging,
  Toolbar,
  Item,
  SearchPanel,
} from 'devextreme-react/data-grid';
import type { CreditDebitNote, NoteStatus } from '@/types/credit-debit-notes';

const statusColors: Record<NoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const noteTypeLabels: Record<string, string> = {
  ar_debit: 'AR Debit',
  ap_debit: 'AP Debit',
};

export default function DebitNotesPage() {
  const t = useTranslations('accounting');
  const router = useRouter();
  const [notes, setNotes] = useState<CreditDebitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('ar_debit');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/debit-notes?noteType=${noteTypeFilter}`);
      const data = await response.json();

      if (data.success) {
        setNotes(data.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [noteTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNewNote = () => {
    router.push(`/accounting/debit-notes/new?type=${noteTypeFilter}`);
  };

  const handleViewNote = (id: number) => {
    router.push(`/accounting/debit-notes/${id}`);
  };

  const renderStatus = (cellData: any) => {
    const status = cellData.value as NoteStatus;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
    );
  };

  const renderNoteType = (cellData: any) => {
    const type = cellData.value as string;
    return noteTypeLabels[type] || type;
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
      <div className="flex gap-1">
        <Button
          icon="search"
          hint={t('debitNotes.actions.view')}
          stylingMode="text"
          onClick={() => handleViewNote(note.id)}
        />
      </div>
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
            {t('debitNotes.description')}
          </p>
        </div>

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
            <SearchPanel visible={true} placeholder={t('debitNotes.filters.searchPlaceholder')} />
            <Paging defaultPageSize={20} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">{t('debitNotes.title')}</span>
              </Item>
              <Item location="before">
                <SelectBox
                  items={[
                    { id: 'ar_debit', text: t('debitNotes.filters.arDebit') },
                    { id: 'ap_debit', text: t('debitNotes.filters.apDebit') },
                  ]}
                  displayExpr="text"
                  valueExpr="id"
                  value={noteTypeFilter}
                  onValueChanged={(e) => setNoteTypeFilter(e.value)}
                  width={180}
                />
              </Item>
              <Item location="after">
                <Button
                  text={t('debitNotes.actions.new')}
                  icon="plus"
                  type="default"
                  stylingMode="contained"
                  onClick={handleNewNote}
                  elementAttr={{ 'data-testid': 'new-note-btn' }}
                />
              </Item>
            </Toolbar>

            <Column
              dataField="noteNumber"
              caption={t('debitNotes.columns.noteNumber')}
              width={160}
            />
            <Column
              dataField="noteType"
              caption={t('debitNotes.columns.noteType')}
              width={100}
              cellRender={renderNoteType}
            />
            <Column
              dataField="noteDate"
              caption={t('debitNotes.columns.noteDate')}
              dataType="date"
              width={100}
              cellRender={formatDate}
            />
            <Column
              dataField="customerName"
              caption={t('debitNotes.columns.customer')}
              minWidth={150}
              visible={noteTypeFilter === 'ar_debit'}
            />
            <Column
              dataField="vendorName"
              caption={t('debitNotes.columns.vendor')}
              minWidth={150}
              visible={noteTypeFilter === 'ap_debit'}
            />
            <Column
              dataField="referenceInvoiceNumber"
              caption={t('debitNotes.columns.referenceInvoice')}
              width={140}
            />
            <Column
              dataField="totalAmount"
              caption={t('debitNotes.columns.amount')}
              width={120}
              alignment="right"
              cellRender={renderAmount}
            />
            <Column
              dataField="status"
              caption={t('debitNotes.columns.status')}
              width={110}
              alignment="center"
              cellRender={renderStatus}
            />
            <Column
              caption={t('debitNotes.columns.actions')}
              width={80}
              alignment="center"
              cellRender={renderActions}
            />
          </DataGrid>
        </div>
      </div>
  );
}
