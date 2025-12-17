'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

export default function ExpiryAlertsPage() {
  const [report, setReport] = useState<ExpiryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [daysThreshold, setDaysThreshold] = useState(90);

  const fetchExpiryAlerts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/expiry?days=${daysThreshold}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data?.data || null);
      }
    } catch (error) {
      console.error('Failed to fetch expiry alerts:', error);
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
          <div className="flex items-center gap-4">
            <select
              value={daysThreshold}
              onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
              <option value={180}>Next 180 days</option>
            </select>
            <Button variant="secondary" onClick={fetchExpiryAlerts}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Expired Lots</p>
                <p className="text-2xl font-bold text-red-600">{report?.summary.expiredCount || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Expired Value</p>
                <p className="text-2xl font-bold text-red-600">
                  ฿{(report?.summary.expiredValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Near Expiry Lots</p>
                <p className="text-2xl font-bold text-yellow-600">{report?.summary.nearExpiryCount || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Near Expiry Value</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ฿{(report?.summary.nearExpiryValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Expired Lots */}
        {(report?.expired?.length || 0) > 0 && (
          <Card>
            <div className="p-4 border-b bg-red-50">
              <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Expired Lots ({report?.expired.length})
              </h2>
              <p className="text-sm text-red-600">These lots have passed their expiry date and should be quarantined or disposed</p>
            </div>
            <Table
              columns={expiredColumns}
              data={report?.expired || []}
              keyField="lotNumber"
              isLoading={isLoading}
              emptyMessage="No expired lots"
            />
          </Card>
        )}

        {/* Near Expiry Lots */}
        <Card>
          <div className="p-4 border-b bg-yellow-50">
            <h2 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Near Expiry Lots ({report?.nearExpiry?.length || 0})
            </h2>
            <p className="text-sm text-yellow-600">These lots will expire within {daysThreshold} days - prioritize for FEFO picking</p>
          </div>
          <Table
            columns={nearExpiryColumns}
            data={report?.nearExpiry || []}
            keyField="lotNumber"
            isLoading={isLoading}
            emptyMessage="No near-expiry lots"
          />
        </Card>
      </div>
    </MainLayout>
  );
}
