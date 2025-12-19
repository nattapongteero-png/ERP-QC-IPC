'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/components/ui/api-error';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';

interface ExpiryItem {
  lotNumber: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  expiryDate: string;
  daysToExpiry?: number;
  daysExpired?: number;
}

interface ExpiryReport {
  expired: ExpiryItem[];
  nearExpiry: ExpiryItem[];
  summary: {
    expiredCount: number;
    expiredValue: number;
    nearExpiryCount: number;
    nearExpiryValue: number;
  };
}

interface ApiErrorState {
  error: string;
  debug?: {
    message: string;
    stack?: string;
    name?: string;
    cause?: string;
    code?: string;
    path?: string;
    timestamp: string;
  };
}

const daysOptions = [
  { value: '30', label: 'Next 30 days' },
  { value: '60', label: 'Next 60 days' },
  { value: '90', label: 'Next 90 days' },
  { value: '180', label: 'Next 180 days' },
];

export default function ExpiryAlertsPage() {
  const [report, setReport] = useState<ExpiryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiErrorState | null>(null);
  const [daysThreshold, setDaysThreshold] = useState('90');

  const fetchExpiryAlerts = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/reports/expiry?days=${daysThreshold}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data?.data || null);
      } else {
        setApiError({
          error: data.error || 'Unknown error',
          debug: data.debug,
        });
      }
    } catch (error) {
      console.error('Failed to fetch expiry alerts:', error);
      setApiError({
        error: error instanceof Error ? error.message : 'Network error',
        debug: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          timestamp: new Date().toISOString(),
        } : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryAlerts();
  }, [daysThreshold]);

  const expiredColumns: DxDataGridColumn[] = [
    { dataField: 'lotNumber', caption: 'Lot Number', width: 150 },
    { dataField: 'itemCode', caption: 'Item Code', width: 120, hideOnMobile: true },
    { dataField: 'itemName', caption: 'Item Name' },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 120,
      cellRender: (cellInfo) => cellInfo.data.quantity.toLocaleString()
    },
    { dataField: 'expiryDate', caption: 'Expiry Date', width: 120, hideOnMobile: true },
    {
      dataField: 'daysExpired',
      caption: 'Days Expired',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant="danger">{cellInfo.data.daysExpired} days ago</Badge>
      )
    },
  ];

  const nearExpiryColumns: DxDataGridColumn[] = [
    { dataField: 'lotNumber', caption: 'Lot Number', width: 150 },
    { dataField: 'itemCode', caption: 'Item Code', width: 120, hideOnMobile: true },
    { dataField: 'itemName', caption: 'Item Name' },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 120,
      cellRender: (cellInfo) => cellInfo.data.quantity.toLocaleString()
    },
    { dataField: 'expiryDate', caption: 'Expiry Date', width: 120, hideOnMobile: true },
    {
      dataField: 'daysToExpiry',
      caption: 'Days to Expiry',
      width: 120,
      cellRender: (cellInfo) => {
        const days = cellInfo.data.daysToExpiry || 0;
        const variant = days <= 30 ? 'danger' : days <= 60 ? 'secondary' : 'default';
        return <Badge variant={variant}>{days} days</Badge>;
      }
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expiry Alerts</h1>
            <p className="text-gray-600">Monitor expired and near-expiry inventory</p>
          </div>
          <div className="flex items-center gap-3">
            <DxSelectBox
              items={daysOptions}
              value={daysThreshold}
              onValueChange={setDaysThreshold}
              valueExpr="value"
              displayExpr="label"
              width={150}
            />
            <DxButton
              text="Refresh"
              icon="refresh"
              type="normal"
              stylingMode="outlined"
              onClick={fetchExpiryAlerts}
            />
          </div>
        </div>

        {/* Error Display */}
        {apiError && (
          <ApiError
            error={apiError.error}
            debug={apiError.debug}
            onRetry={fetchExpiryAlerts}
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <DxLoadIndicator />
          </div>
        )}

        {/* Summary Cards */}
        {!apiError && !isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="!p-3 sm:!p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Expired Lots</p>
                  <p className="text-lg sm:text-xl font-bold text-red-600">{report?.summary.expiredCount || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="!p-3 sm:!p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Expired Value</p>
                  <p className="text-lg sm:text-xl font-bold text-red-600">
                    ฿{(report?.summary.expiredValue || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="!p-3 sm:!p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Near Expiry Lots</p>
                  <p className="text-lg sm:text-xl font-bold text-yellow-600">{report?.summary.nearExpiryCount || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="!p-3 sm:!p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Near Expiry Value</p>
                  <p className="text-lg sm:text-xl font-bold text-yellow-600">
                    ฿{(report?.summary.nearExpiryValue || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Expired Lots */}
        {!apiError && !isLoading && (report?.expired?.length || 0) > 0 && (
          <Card className="overflow-hidden flex-1 min-h-0 flex flex-col md:overflow-hidden">
            <div className="p-4 sm:p-6 bg-red-50 border-b border-red-100 md:py-1">
              <h2 className="text-base sm:text-lg font-semibold text-red-800 flex items-center gap-2">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                Expired Lots ({report?.expired.length})
              </h2>
              <p className="text-xs sm:text-sm text-red-600 mt-1">These lots have passed their expiry date and should be quarantined or disposed</p>
            </div>
            <div className="p-4 sm:p-6 flex-1 min-h-0 flex flex-col">
              <DxDataGrid
                dataSource={report?.expired || []}
                keyExpr="lotNumber"
                columns={expiredColumns}
                showBorders
                fillHeight
                noDataText="No expired lots"
              />
            </div>
          </Card>
        )}

        {/* Near Expiry Lots */}
        {!apiError && !isLoading && (
          <Card className="overflow-hidden flex-1 min-h-0 flex flex-col md:overflow-hidden">
            <div className="p-4 sm:p-6 bg-yellow-50 border-b border-yellow-100 md:py-1">
              <h2 className="text-base sm:text-lg font-semibold text-yellow-800 flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                Near Expiry Lots ({report?.nearExpiry?.length || 0})
              </h2>
              <p className="text-xs sm:text-sm text-yellow-600 mt-1">These lots will expire within {daysThreshold} days - prioritize for FEFO picking</p>
            </div>
            <div className="p-4 sm:p-6 flex-1 min-h-0 flex flex-col">
              <DxDataGrid
                dataSource={report?.nearExpiry || []}
                keyExpr="lotNumber"
                columns={nearExpiryColumns}
                showBorders
                fillHeight
                noDataText="No near-expiry lots"
              />
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
