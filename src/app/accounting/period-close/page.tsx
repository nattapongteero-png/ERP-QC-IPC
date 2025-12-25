'use client';

// Period Close Dashboard Page
// Feature: 010-accounting-module-integration
// User Story 9: Perform Period-End Closing

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Paging, FilterRow, Selection } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Calendar, Lock, Unlock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { FiscalPeriod, FiscalYear, FiscalPeriodStatus } from '@/types/accounting';

interface PeriodWithYear extends FiscalPeriod {
  fiscalYear?: FiscalYear;
}

interface PeriodValidation {
  canClose: boolean;
  periodId: number;
  periodName: string;
  fiscalYearCode: string;
  errors: Array<{ code: string; message: string; count?: number }>;
  warnings: Array<{ code: string; message: string; count?: number }>;
  metrics: {
    unpostedJournalEntries: number;
    draftAPInvoices: number;
    draftARInvoices: number;
    pendingPayments: number;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
}

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(value);
}

async function fetchFiscalYears(): Promise<FiscalYear[]> {
  const res = await fetch('/api/accounting/fiscal-years');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

async function fetchPeriods(fiscalYearId?: number): Promise<PeriodWithYear[]> {
  const params = new URLSearchParams();
  if (fiscalYearId) params.set('fiscalYearId', String(fiscalYearId));

  const res = await fetch(`/api/accounting/fiscal-periods?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch periods');
  }
  const data = await res.json();
  return data.data || [];
}

async function fetchPeriodValidation(periodId: number): Promise<PeriodValidation> {
  const res = await fetch(`/api/accounting/fiscal-periods/${periodId}/validate`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to validate period');
  }
  const data = await res.json();
  return data.data;
}

async function closePeriod(periodId: number, force: boolean = false): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/accounting/fiscal-periods/${periodId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to close period');
  }
  return data;
}

async function reopenPeriod(periodId: number, reason: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/accounting/fiscal-periods/${periodId}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reopen period');
  }
  return data;
}

function StatusBadge({ status }: { status: FiscalPeriodStatus }) {
  const config = {
    open: { bg: 'bg-green-100', text: 'text-green-800', icon: Unlock },
    soft_closed: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle },
    closed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Lock },
  };
  const { bg, text, icon: Icon } = config[status] || config.open;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {status === 'soft_closed' ? 'Soft Closed' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PeriodClosePage() {
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<number | undefined>();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: fetchFiscalYears,
  });

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['fiscal-periods', selectedYearId],
    queryFn: () => fetchPeriods(selectedYearId),
  });

  const { data: validation, isFetching: isValidating } = useQuery({
    queryKey: ['period-validation', selectedPeriodId],
    queryFn: () => selectedPeriodId ? fetchPeriodValidation(selectedPeriodId) : null,
    enabled: !!selectedPeriodId,
  });

  const closeMutation = useMutation({
    mutationFn: ({ periodId, force }: { periodId: number; force: boolean }) => closePeriod(periodId, force),
    onSuccess: (data) => {
      notify(data.message, 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      queryClient.invalidateQueries({ queryKey: ['period-validation'] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ periodId, reason }: { periodId: number; reason: string }) => reopenPeriod(periodId, reason),
    onSuccess: (data) => {
      notify(data.message, 'success', 3000);
      setReopenReason('');
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      queryClient.invalidateQueries({ queryKey: ['period-validation'] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleClosePeriod = useCallback((force: boolean = false) => {
    if (!selectedPeriodId) return;
    closeMutation.mutate({ periodId: selectedPeriodId, force });
  }, [selectedPeriodId, closeMutation]);

  const handleReopenPeriod = useCallback(() => {
    if (!selectedPeriodId || !reopenReason.trim()) {
      notify('Please enter a reason for reopening', 'warning', 3000);
      return;
    }
    reopenMutation.mutate({ periodId: selectedPeriodId, reason: reopenReason });
  }, [selectedPeriodId, reopenReason, reopenMutation]);

  const openPeriods = periods.filter(p => p.status === 'open').length;
  const closedPeriods = periods.filter(p => p.status === 'closed').length;
  const softClosedPeriods = periods.filter(p => p.status === 'soft_closed').length;

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="flex flex-col gap-6">
      <ResponsivePageHeader
        title="Period Close"
        subtitle="Month-end and year-end closing procedures"
        icon={Calendar}
        iconColor="text-blue-600"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Open Periods"
          value={openPeriods.toString()}
          icon={Unlock}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="Soft Closed"
          value={softClosedPeriods.toString()}
          icon={AlertTriangle}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label="Closed Periods"
          value={closedPeriods.toString()}
          icon={Lock}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Total Periods"
          value={periods.length.toString()}
          icon={Calendar}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
      </div>

      {/* Year Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fiscal Year</label>
            <SelectBox
              items={[{ id: undefined, yearCode: 'All Years' }, ...fiscalYears]}
              value={selectedYearId}
              onValueChanged={(e) => {
                setSelectedYearId(e.value);
                setSelectedPeriodId(null);
              }}
              valueExpr="id"
              displayExpr="yearCode"
              width={200}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Periods Grid */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Fiscal Periods
          </h3>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading periods...</p>
            </div>
          ) : (
            <DataGrid
              dataSource={periods}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
              hoverStateEnabled
              onRowClick={(e) => setSelectedPeriodId(e.data.id)}
              selectedRowKeys={selectedPeriodId ? [selectedPeriodId] : []}
            >
              <Selection mode="single" />
              <FilterRow visible />
              <Paging defaultPageSize={12} />
              <Column dataField="periodName" caption="Period" />
              <Column
                dataField="fiscalYear.yearCode"
                caption="Year"
                width={80}
                calculateCellValue={(row: PeriodWithYear) => row.fiscalYear?.yearCode || '-'}
              />
              <Column
                dataField="startDate"
                caption="Start"
                calculateCellValue={(row: PeriodWithYear) => formatDate(row.startDate)}
                width={100}
              />
              <Column
                dataField="endDate"
                caption="End"
                calculateCellValue={(row: PeriodWithYear) => formatDate(row.endDate)}
                width={100}
              />
              <Column
                dataField="status"
                caption="Status"
                width={120}
                cellRender={({ data }) => <StatusBadge status={data.status} />}
              />
            </DataGrid>
          )}
        </div>

        {/* Validation & Actions Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedPeriod ? `Close: ${selectedPeriod.periodName}` : 'Select a Period'}
          </h3>

          {!selectedPeriodId ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select a period from the list to view close status</p>
            </div>
          ) : isValidating ? (
            <div className="text-center py-12 text-gray-500">
              <p>Validating period...</p>
            </div>
          ) : validation ? (
            <div className="space-y-6">
              {/* Close Status */}
              <div className={`p-4 rounded-lg ${validation.canClose ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {validation.canClose ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Ready to Close</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Cannot Close</span>
                    </>
                  )}
                </div>
              </div>

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-red-800">Errors</h4>
                  {validation.errors.map((error, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{error.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-yellow-800">Warnings</h4>
                  {validation.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{warning.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">Unposted JEs</div>
                  <div className="font-semibold">{validation.metrics.unpostedJournalEntries}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">Draft AP</div>
                  <div className="font-semibold">{validation.metrics.draftAPInvoices}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">Draft AR</div>
                  <div className="font-semibold">{validation.metrics.draftARInvoices}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">Trial Balance</div>
                  <div className={`font-semibold ${validation.metrics.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {validation.metrics.isBalanced ? 'Balanced' : 'Not Balanced'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedPeriod?.status === 'open' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    text="Close Period"
                    type="default"
                    stylingMode="contained"
                    icon="lock"
                    disabled={!validation.canClose || closeMutation.isPending}
                    onClick={() => handleClosePeriod(false)}
                  />
                  {!validation.canClose && (
                    <Button
                      text="Force Close"
                      type="danger"
                      stylingMode="outlined"
                      disabled={closeMutation.isPending}
                      onClick={() => {
                        if (confirm('Force close will skip validation. Are you sure?')) {
                          handleClosePeriod(true);
                        }
                      }}
                    />
                  )}
                </div>
              )}

              {(selectedPeriod?.status === 'closed' || selectedPeriod?.status === 'soft_closed') && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Reason for Reopening</label>
                    <input
                      type="text"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      placeholder="Enter reason..."
                      className="border rounded p-2 text-sm"
                    />
                  </div>
                  <Button
                    text="Reopen Period"
                    type="normal"
                    stylingMode="outlined"
                    icon="unlock"
                    disabled={!reopenReason.trim() || reopenMutation.isPending}
                    onClick={handleReopenPeriod}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
