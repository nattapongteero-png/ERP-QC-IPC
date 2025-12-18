'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
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

export default function ExpiryAlertsPage() {
  const [report, setReport] = useState<ExpiryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiErrorState | null>(null);
  const [daysThreshold, setDaysThreshold] = useState(90);

  const fetchExpiryAlerts = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/reports/expiry?days=${daysThreshold}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data?.data || null);
      } else {
        // API returned an error
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

  const expiredColumns = [
    { key: 'lotNumber', header: 'Lot Number' },
    { key: 'itemCode', header: 'Item Code' },
    { key: 'itemName', header: 'Item Name' },
    { key: 'quantity', header: 'Quantity', render: (item: ExpiryItem) => item.quantity.toLocaleString() },
    { key: 'expiryDate', header: 'Expiry Date' },
    { 
      key: 'daysExpired', 
      header: 'Days Expired',
      render: (item: ExpiryItem) => (
        <Badge variant="danger">{item.daysExpired} days ago</Badge>
      )
    },
  ];

  const nearExpiryColumns = [
    { key: 'lotNumber', header: 'Lot Number' },
    { key: 'itemCode', header: 'Item Code' },
    { key: 'itemName', header: 'Item Name' },
    { key: 'quantity', header: 'Quantity', render: (item: ExpiryItem) => item.quantity.toLocaleString() },
    { key: 'expiryDate', header: 'Expiry Date' },
    { 
      key: 'daysToExpiry', 
      header: 'Days to Expiry',
      render: (item: ExpiryItem) => {
        const days = item.daysToExpiry || 0;
        const variant = days <= 30 ? 'danger' : days <= 60 ? 'warning' : 'info';
        return <Badge variant={variant}>{days} days</Badge>;
      }
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expiry Alerts</h1>
            <p className="text-gray-600">Monitor expired and near-expiry inventory</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={daysThreshold.toString()}
              onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
              options={[
                { value: '30', label: 'Next 30 days' },
                { value: '60', label: 'Next 60 days' },
                { value: '90', label: 'Next 90 days' },
                { value: '180', label: 'Next 180 days' },
              ]}
              className="w-40"
            />
            <Button variant="secondary" onClick={fetchExpiryAlerts}>
              Refresh
            </Button>
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

        {/* Summary Cards */}
        {!apiError && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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
        </div>}

        {/* Expired Lots */}
        {!apiError && (report?.expired?.length || 0) > 0 && (
          <Card className="overflow-hidden">
            <div className="p-4 sm:p-6 bg-red-50 border-b border-red-100">
              <h2 className="text-base sm:text-lg font-semibold text-red-800 flex items-center gap-2">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                Expired Lots ({report?.expired.length})
              </h2>
              <p className="text-xs sm:text-sm text-red-600 mt-1">These lots have passed their expiry date and should be quarantined or disposed</p>
            </div>
            <div className="p-4 sm:p-6">
              <Table
                columns={expiredColumns}
                data={report?.expired || []}
                keyField="lotNumber"
                isLoading={isLoading}
                emptyMessage="No expired lots"
              />
            </div>
          </Card>
        )}

        {/* Near Expiry Lots */}
        {!apiError && <Card className="overflow-hidden">
          <div className="p-4 sm:p-6 bg-yellow-50 border-b border-yellow-100">
            <h2 className="text-base sm:text-lg font-semibold text-yellow-800 flex items-center gap-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              Near Expiry Lots ({report?.nearExpiry?.length || 0})
            </h2>
            <p className="text-xs sm:text-sm text-yellow-600 mt-1">These lots will expire within {daysThreshold} days - prioritize for FEFO picking</p>
          </div>
          <div className="p-4 sm:p-6">
            <Table
              columns={nearExpiryColumns}
              data={report?.nearExpiry || []}
              keyField="lotNumber"
              isLoading={isLoading}
              emptyMessage="No near-expiry lots"
            />
          </div>
        </Card>}
      </div>
    </MainLayout>
  );
}
