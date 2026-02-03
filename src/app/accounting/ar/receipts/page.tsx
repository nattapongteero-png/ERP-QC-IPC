'use client';

/**
 * AR Receipts Page
 * Feature: 010-accounting-module-integration
 * Track and manage customer payment receipts
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  SearchPanel,
  Summary,
  TotalItem,
  Export,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid';
import { DateBox } from 'devextreme-react/date-box';
import { SelectBox } from 'devextreme-react/select-box';
import { Button } from 'devextreme-react/button';
import notify from 'devextreme/ui/notify';
import {
  Banknote,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';

interface Receipt {
  id: number;
  receiptNumber: string;
  customerId: number;
  customerName?: string;
  receiptDate: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'credit_card';
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  bankAccountId: number | null;
  bankAccountName?: string;
  chequeNumber: string | null;
  chequeDate: string | null;
  status: 'pending' | 'cleared' | 'bounced' | 'cancelled';
  invoiceAllocations?: Array<{
    invoiceId: number;
    invoiceNumber: string;
    allocatedAmount: number;
  }>;
  createdAt: string;
}

interface ReceiptSummary {
  totalReceipts: number;
  totalAmount: number;
  pendingAmount: number;
  clearedAmount: number;
  receiptsByMethod: Record<string, { count: number; amount: number }>;
}

const paymentMethodOptions = [
  { value: '', text: 'All Methods' },
  { value: 'cash', text: 'Cash' },
  { value: 'bank_transfer', text: 'Bank Transfer' },
  { value: 'cheque', text: 'Cheque' },
  { value: 'credit_card', text: 'Credit Card' },
];

const statusOptions = [
  { value: '', text: 'All Status' },
  { value: 'pending', text: 'Pending' },
  { value: 'cleared', text: 'Cleared' },
  { value: 'bounced', text: 'Bounced' },
  { value: 'cancelled', text: 'Cancelled' },
];

async function fetchReceipts(params: {
  paymentMethod?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: number;
}): Promise<Receipt[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('paymentType', 'receipt');

  if (params.paymentMethod) searchParams.set('paymentMethod', params.paymentMethod);
  if (params.status) searchParams.set('status', params.status);
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params.customerId) searchParams.set('customerId', String(params.customerId));

  const res = await fetch(`/api/accounting/payments?${searchParams.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch receipts');
  }
  const data = await res.json();
  return data.data || [];
}

async function fetchReceiptSummary(): Promise<ReceiptSummary> {
  const res = await fetch('/api/accounting/payments?paymentType=receipt&summary=true');
  if (!res.ok) {
    return {
      totalReceipts: 0,
      totalAmount: 0,
      pendingAmount: 0,
      clearedAmount: 0,
      receiptsByMethod: {},
    };
  }
  const data = await res.json();
  return data.data || {
    totalReceipts: 0,
    totalAmount: 0,
    pendingAmount: 0,
    clearedAmount: 0,
    receiptsByMethod: {},
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    credit_card: 'Credit Card',
  };
  return labels[method] || method;
}

export default function ARReceiptsPage() {
  const t = useTranslations('accounting');
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['ar-receipts', paymentMethod, status, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: () => fetchReceipts({
      paymentMethod: paymentMethod || undefined,
      status: status || undefined,
      dateFrom: dateFrom?.toISOString().split('T')[0],
      dateTo: dateTo?.toISOString().split('T')[0],
    }),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ar-receipts-summary'],
    queryFn: fetchReceiptSummary,
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ar-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['ar-receipts-summary'] });
  }, [queryClient]);

  const handleExportJSON = useCallback(() => {
    if (!receipts || receipts.length === 0) return;
    const blob = new Blob([JSON.stringify(receipts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-receipts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Receipts exported successfully', 'success', 3000);
  }, [receipts]);

  const statusCellRender = useCallback((cellData: { value: string }) => {
    return <AccountingStatusBadge status={cellData.value as 'pending' | 'cleared' | 'bounced' | 'cancelled'} />;
  }, []);

  const paymentMethodCellRender = useCallback((cellData: { value: string }) => {
    const icons: Record<string, React.ReactNode> = {
      cash: <Banknote className="h-4 w-4 text-green-600" />,
      bank_transfer: <Building2 className="h-4 w-4 text-blue-600" />,
      cheque: <CreditCard className="h-4 w-4 text-purple-600" />,
      credit_card: <CreditCard className="h-4 w-4 text-orange-600" />,
    };

    return (
      <div className="flex items-center gap-2">
        {icons[cellData.value]}
        <span>{getPaymentMethodLabel(cellData.value)}</span>
      </div>
    );
  }, []);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <AccountingPageHeader
        title={t('accountsReceivable.receipts.title')}
        subtitle={t('accountsReceivable.description')}
        icon="file-text"
        onRefresh={handleRefresh}
        actions={
          <Button
            text="Record Receipt"
            icon="plus"
            type="success"
            onClick={() => notify('Record Receipt dialog - coming soon', 'info', 3000)}
          />
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryLoading ? (
            <>
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
              <AccountingKPICardSkeleton />
            </>
          ) : (
            <>
              <AccountingKPICard
                label="Total Receipts"
                value={summary?.totalReceipts || 0}
                subtitle="All time"
                icon="file-text"
                variant="info"
              />
              <AccountingKPICard
                label="Total Amount"
                value={formatCurrency(summary?.totalAmount || 0)}
                subtitle="Total received"
                icon="trending-up"
                variant="success"
              />
              <AccountingKPICard
                label="Cleared"
                value={formatCurrency(summary?.clearedAmount || 0)}
                subtitle="Confirmed payments"
                icon="check-circle"
                variant="success"
              />
              <AccountingKPICard
                label="Pending"
                value={formatCurrency(summary?.pendingAmount || 0)}
                subtitle="Awaiting clearance"
                icon="clock"
                variant="warning"
              />
            </>
          )}
        </div>

        {/* Filters */}
        <AccountingFilterPanel>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Method
            </label>
            <SelectBox
              items={paymentMethodOptions}
              value={paymentMethod}
              onValueChanged={(e) => setPaymentMethod(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={180}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <SelectBox
              items={statusOptions}
              value={status}
              onValueChanged={(e) => setStatus(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={150}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              From Date
            </label>
            <DateBox
              value={dateFrom}
              onValueChanged={(e) => setDateFrom(e.value)}
              type="date"
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">To Date</label>
            <DateBox
              value={dateTo}
              onValueChanged={(e) => setDateTo(e.value)}
              type="date"
              displayFormat="dd/MM/yyyy"
              width={150}
            />
          </div>
          <div className="flex gap-2 items-end">
            <Button
              text="Clear"
              stylingMode="outlined"
              onClick={() => {
                setPaymentMethod('');
                setStatus('');
                setDateFrom(null);
                setDateTo(null);
              }}
            />
            {receipts.length > 0 && (
              <Button
                text="Export"
                icon="export"
                stylingMode="outlined"
                onClick={handleExportJSON}
              />
            )}
          </div>
        </AccountingFilterPanel>

        {/* Data Grid */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Banknote className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Receipt List
                </h3>
                <p className="text-sm text-gray-600">
                  {receipts.length} receipt(s) found
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-green-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading receipts...</p>
              </div>
            ) : (
              <DataGrid
                dataSource={receipts}
                keyExpr="id"
                showBorders={false}
                showRowLines
                showColumnLines={false}
                rowAlternationEnabled
                allowColumnReordering
                allowColumnResizing
                columnAutoWidth
                hoverStateEnabled
              >
                <Paging defaultPageSize={20} />
                <FilterRow visible />
                <SearchPanel visible placeholder="Search receipts..." />
                <Export enabled allowExportSelectedData />

                <Toolbar>
                  <ToolbarItem name="searchPanel" location="before" />
                  <ToolbarItem name="exportButton" location="after" />
                </Toolbar>

                <Column dataField="receiptNumber" caption="Receipt #" width={150} />
                <Column
                  dataField="receiptDate"
                  caption="Date"
                  dataType="date"
                  width={120}
                  cellRender={(data) => formatDate(data.value)}
                />
                <Column dataField="customerName" caption="Customer" minWidth={200} />
                <Column
                  dataField="paymentMethod"
                  caption="Method"
                  width={150}
                  cellRender={paymentMethodCellRender}
                />
                <Column
                  dataField="amount"
                  caption="Amount"
                  dataType="number"
                  format="#,##0.00"
                  width={130}
                  alignment="right"
                />
                <Column dataField="reference" caption="Reference" width={150} />
                <Column dataField="bankAccountName" caption="Bank Account" width={150} />
                <Column
                  dataField="status"
                  caption="Status"
                  width={120}
                  cellRender={statusCellRender}
                />

                <Summary>
                  <TotalItem
                    column="amount"
                    summaryType="sum"
                    valueFormat="#,##0.00"
                    displayFormat="Total: {0}"
                  />
                  <TotalItem
                    column="receiptNumber"
                    summaryType="count"
                    displayFormat="{0} receipts"
                  />
                </Summary>
              </DataGrid>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
