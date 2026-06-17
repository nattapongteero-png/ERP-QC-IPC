/**
 * Statement Line Grid Component (T069)
 * Displays bank statement lines with matching status
 */

'use client';

import { useState, useCallback } from 'react';
import DataGrid, {
  Column,
  Paging,
  Selection,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import type { BankStatementLine, StatementLineStatus } from '@/types/bank-reconciliation';

interface StatementLineGridProps {
  lines: BankStatementLine[];
  onMatch?: (lineId: number) => void;
  onUnmatch?: (lineId: number) => void;
  onIgnore?: (lineId: number) => void;
  onCreateJournal?: (lineId: number) => void;
  selectedLineIds?: number[];
  onSelectionChanged?: (lineIds: number[]) => void;
  readOnly?: boolean;
}

const statusColors: Record<StatementLineStatus, string> = {
  unmatched: 'bg-yellow-100 text-yellow-800',
  matched: 'bg-green-100 text-green-800',
  partially_matched: 'bg-blue-100 text-blue-800',
  journal_created: 'bg-purple-100 text-purple-800',
  ignored: 'bg-gray-100 text-gray-500',
};

export function StatementLineGrid({
  lines,
  onMatch,
  onUnmatch,
  onIgnore,
  onCreateJournal,
  selectedLineIds = [],
  onSelectionChanged,
  readOnly = false,
}: StatementLineGridProps) {
  const handleSelectionChanged = useCallback(
    (e: any) => {
      const selectedRows = e.selectedRowsData as BankStatementLine[];
      if (onSelectionChanged) {
        onSelectionChanged(selectedRows.map((r) => r.id));
      }
    },
    [onSelectionChanged]
  );

  const renderStatus = (cellData: any) => {
    const status = cellData.value as StatementLineStatus;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const renderAmount = (cellData: any) => {
    const amount = cellData.value as number;
    const type = cellData.data.transactionType;
    const sign = type === 'debit' ? '-' : '+';
    const colorClass = type === 'debit' ? 'text-red-600' : 'text-green-600';
    return (
      <span className={colorClass}>
        {sign}{amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </span>
    );
  };

  const renderActions = (cellData: any) => {
    const line = cellData.data as BankStatementLine;
    const isUnmatched = ['unmatched'].includes(line.status);
    const isMatched = ['matched', 'journal_created'].includes(line.status);

    if (readOnly) return null;

    return (
      <div className="flex gap-1">
        {isUnmatched && onMatch && (
          <Button
            icon="link"
            hint="จับคู่"
            stylingMode="text"
            onClick={() => onMatch(line.id)}
          />
        )}
        {isUnmatched && onCreateJournal && (
          <Button
            icon="doc"
            hint="สร้างรายการบันทึก"
            stylingMode="text"
            onClick={() => onCreateJournal(line.id)}
          />
        )}
        {isUnmatched && onIgnore && (
          <Button
            icon="remove"
            hint="ละเว้น"
            stylingMode="text"
            onClick={() => onIgnore(line.id)}
          />
        )}
        {isMatched && onUnmatch && (
          <Button
            icon="revert"
            hint="ยกเลิกการจับคู่"
            stylingMode="text"
            onClick={() => onUnmatch(line.id)}
          />
        )}
      </div>
    );
  };

  const formatDate = (cellData: any) => {
    const date = cellData.value;
    if (!date) return '';
    return new Date(date).toLocaleDateString('th-TH');
  };

  return (
    <DataGrid
      dataSource={lines}
      keyExpr="id"
      showBorders={true}
      rowAlternationEnabled={true}
      allowColumnResizing={true}
      columnAutoWidth={true}
      onSelectionChanged={handleSelectionChanged}
      data-testid="statement-line-grid"
    >
      {!readOnly && (
        <Selection mode="multiple" selectAllMode="allPages" showCheckBoxesMode="always" />
      )}
      <Paging defaultPageSize={20} />

      <Column
        dataField="lineNumber"
        caption="#"
        width={50}
        alignment="center"
      />
      <Column
        dataField="transactionDate"
        caption="วันที่"
        dataType="date"
        width={100}
        cellRender={formatDate}
      />
      <Column
        dataField="description"
        caption="รายละเอียด"
        minWidth={200}
      />
      <Column
        dataField="reference"
        caption="อ้างอิง"
        width={120}
      />
      <Column
        dataField="amount"
        caption="จำนวนเงิน"
        width={120}
        alignment="right"
        cellRender={renderAmount}
      />
      <Column
        dataField="transactionType"
        caption="ประเภท"
        width={80}
        alignment="center"
      />
      <Column
        dataField="status"
        caption="สถานะ"
        width={120}
        alignment="center"
        cellRender={renderStatus}
      />
      <Column
        dataField="matchConfidence"
        caption="ความเชื่อมั่น"
        width={90}
        alignment="center"
        cellRender={(cellData: any) =>
          cellData.value ? `${Math.round(cellData.value)}%` : '-'
        }
      />
      {!readOnly && (
        <Column
          caption="การดำเนินการ"
          width={120}
          alignment="center"
          cellRender={renderActions}
        />
      )}
    </DataGrid>
  );
}
