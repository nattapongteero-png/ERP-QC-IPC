'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Table } from '@/components/ui/table';

interface LotDetail {
  id: number;
  lotNumber: string;
  batchNumber: string | null;
  itemId: number;
  warehouseId: number;
  locationId: number | null;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  status: string;
  cost: number | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  vendorId: number | null;
  poNumber: string | null;
  coaNumber: string | null;
  createdAt: string;
  updatedAt: string;
  itemCode: string;
  itemNameTh: string;
  itemNameEn: string;
  itemType: string;
  itemCategory: string;
  warehouseName: string;
  warehouseCode: string;
  vendor: {
    id: number;
    code: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
  } | null;
  transactions: Array<{
    id: number;
    transactionType: string;
    quantity: number;
    unit: string;
    referenceType: string | null;
    referenceNumber: string | null;
    reason: string | null;
    performedBy: number | null;
    performedByName: string | null;
    createdAt: string;
  }>;
  qcTests: Array<{
    id: number;
    sampleNumber: string | null;
    testType: string;
    status: string;
    result: string | null;
    testedBy: number | null;
    testedByName: string | null;
    testDate: string | null;
    createdAt: string;
  }>;
  relatedWorkOrders: Array<{
    id: number;
    woNumber: string;
    productId: number;
    status: string;
    plannedQuantity: number;
    actualQuantity: number | null;
    plannedStartDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
  }>;
  daysUntilExpiry: number | null;
  expiryStatus: string;
  availableQuantity: number;
}

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lot, setLot] = useState<LotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'transactions' | 'qc' | 'traceability'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    coaNumber: '',
  });
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchLotDetail();
  }, [params.id]);

  const fetchLotDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/inventory/lots/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setLot(data.data);
        setEditForm({
          batchNumber: data.data.batchNumber || '',
          manufacturingDate: data.data.manufacturingDate || '',
          expiryDate: data.data.expiryDate || '',
          coaNumber: data.data.coaNumber || '',
        });
      } else {
        setError(data.error || 'Failed to fetch lot detail');
      }
    } catch (err) {
      setError('Failed to fetch lot detail');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lot) return;
    
    try {
      setStatusLoading(true);
      const response = await fetch(`/api/inventory/lots/${lot.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (data.success) {
        fetchLotDetail();
      }
      // API errors handled by global error handler
    } catch {
      // Network errors handled by global error handler
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lot) return;

    try {
      const response = await fetch(`/api/inventory/lots/${lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (data.success) {
        setIsEditing(false);
        fetchLotDetail();
      }
      // API errors handled by global error handler
    } catch {
      // Network errors handled by global error handler
    }
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'released': return 'success';
      case 'quarantine': return 'warning';
      case 'under_test': return 'warning';
      case 'rejected': return 'danger';
      case 'blocked': return 'danger';
      default: return 'default';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receive': 'รับเข้า',
      'issue': 'เบิกออก',
      'transfer': 'โอนย้าย',
      'adjust': 'ปรับปรุง',
      'scrap': 'ตัดทิ้ง',
      'return': 'รับคืน',
    };
    return labels[type] || type;
  };

  const getQcStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'passed': return 'success';
      case 'failed': return 'danger';
      case 'pending': return 'warning';
      case 'in_progress': return 'warning';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Transaction table columns
  const transactionColumns = [
    { key: 'createdAt', header: 'Date/Time', render: (tx: any) => formatDateTime(tx.createdAt) },
    { 
      key: 'transactionType', 
      header: 'Type', 
      render: (tx: any) => (
        <Badge variant={
          tx.transactionType === 'receive' || tx.transactionType === 'return' ? 'success' :
          tx.transactionType === 'issue' || tx.transactionType === 'scrap' ? 'danger' :
          'default'
        }>
          {getTransactionTypeLabel(tx.transactionType)}
        </Badge>
      )
    },
    { 
      key: 'quantity', 
      header: 'Quantity', 
      render: (tx: any) => (
        <span className={
          tx.transactionType === 'receive' || tx.transactionType === 'return' ? 'text-green-600' :
          tx.transactionType === 'issue' || tx.transactionType === 'scrap' ? 'text-red-600' : ''
        }>
          {tx.transactionType === 'receive' || tx.transactionType === 'return' ? '+' : '-'}
          {tx.quantity.toLocaleString()} {tx.unit}
        </span>
      )
    },
    { 
      key: 'reference', 
      header: 'Reference', 
      render: (tx: any) => tx.referenceType && tx.referenceNumber ? (
        <span className="text-blue-600">{tx.referenceType}: {tx.referenceNumber}</span>
      ) : '-'
    },
    { key: 'reason', header: 'Reason', render: (tx: any) => tx.reason || '-' },
    { key: 'performedByName', header: 'Performed By', render: (tx: any) => tx.performedByName || '-' },
  ];

  // QC tests table columns
  const qcTestColumns = [
    { key: 'sampleNumber', header: 'Sample Number', render: (test: any) => <span className="font-medium">{test.sampleNumber || '-'}</span> },
    { key: 'testType', header: 'Test Type' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (test: any) => <Badge variant={getQcStatusVariant(test.status)}>{test.status}</Badge>
    },
    { key: 'result', header: 'Result', render: (test: any) => test.result || '-' },
    { key: 'testedByName', header: 'Tested By', render: (test: any) => test.testedByName || '-' },
    { key: 'testDate', header: 'Test Date', render: (test: any) => formatDate(test.testDate) },
  ];

  // Work orders table columns
  const workOrderColumns = [
    { 
      key: 'woNumber', 
      header: 'WO Number', 
      render: (wo: any) => <span className="font-medium text-blue-600 cursor-pointer hover:underline">{wo.woNumber}</span>
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (wo: any) => (
        <Badge variant={
          wo.status === 'completed' ? 'success' :
          wo.status === 'in_progress' ? 'warning' :
          'default'
        }>{wo.status}</Badge>
      )
    },
    { key: 'plannedQuantity', header: 'Planned Qty', render: (wo: any) => wo.plannedQuantity?.toLocaleString() || '-' },
    { key: 'actualQuantity', header: 'Actual Qty', render: (wo: any) => wo.actualQuantity?.toLocaleString() || '-' },
    { key: 'startDate', header: 'Start Date', render: (wo: any) => formatDate(wo.actualStartDate || wo.plannedStartDate) },
    { key: 'actualEndDate', header: 'Completed Date', render: (wo: any) => formatDate(wo.actualEndDate) },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !lot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-red-500 mb-4">{error || 'Lot not found'}</p>
          <Button onClick={() => router.push('/inventory/lots')}>Back to Lots</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/inventory/lots')}>
                ← Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Lot: {lot.lotNumber}</h1>
              <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
            </div>
            <p className="text-gray-500 mt-1">รายละเอียด Lot/Batch สินค้าคงคลัง</p>
          </div>
          <div className="flex gap-2">
            {lot.status === 'quarantine' && (
              <>
                <Button 
                  variant="primary" 
                  onClick={() => handleStatusChange('released')}
                  disabled={statusLoading}
                >
                  ✓ Release
                </Button>
                <Button 
                  variant="danger" 
                  onClick={() => handleStatusChange('rejected')}
                  disabled={statusLoading}
                >
                  ✗ Reject
                </Button>
              </>
            )}
            {lot.status === 'released' && (
              <Button 
                variant="secondary" 
                onClick={() => handleStatusChange('blocked')}
                disabled={statusLoading}
              >
                Block
              </Button>
            )}
            {lot.status === 'blocked' && (
              <Button 
                variant="primary" 
                onClick={() => handleStatusChange('released')}
                disabled={statusLoading}
              >
                Unblock
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-blue-600">Total Quantity</p>
                  <p className="text-2xl font-bold text-blue-800">{lot.quantity.toLocaleString()} {lot.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-green-600">Available</p>
                  <p className="text-2xl font-bold text-green-800">{lot.availableQuantity.toLocaleString()} {lot.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-yellow-600">Reserved</p>
                  <p className="text-2xl font-bold text-yellow-800">{lot.reservedQuantity.toLocaleString()} {lot.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-purple-600">Total Cost</p>
                  <p className="text-2xl font-bold text-purple-800">
                    ฿{((lot.quantity || 0) * (lot.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {lot.cost && lot.cost > 0 && (
                    <p className="text-xs text-purple-500">@฿{lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}/{lot.unit}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${
            lot.expiryStatus === 'expired' ? 'from-red-50 to-red-100 border-red-200' :
            lot.expiryStatus === 'critical' ? 'from-red-50 to-red-100 border-red-200' :
            lot.expiryStatus === 'warning' ? 'from-orange-50 to-orange-100 border-orange-200' :
            'from-gray-50 to-gray-100 border-gray-200'
          }`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  lot.expiryStatus === 'expired' || lot.expiryStatus === 'critical' ? 'bg-red-500' :
                  lot.expiryStatus === 'warning' ? 'bg-orange-500' : 'bg-gray-500'
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm ${
                    lot.expiryStatus === 'expired' || lot.expiryStatus === 'critical' ? 'text-red-600' :
                    lot.expiryStatus === 'warning' ? 'text-orange-600' : 'text-gray-600'
                  }`}>Days Until Expiry</p>
                  <p className={`text-2xl font-bold ${
                    lot.expiryStatus === 'expired' || lot.expiryStatus === 'critical' ? 'text-red-800' :
                    lot.expiryStatus === 'warning' ? 'text-orange-800' : 'text-gray-800'
                  }`}>
                    {lot.daysUntilExpiry !== null ? (
                      lot.daysUntilExpiry < 0 ? `Expired ${Math.abs(lot.daysUntilExpiry)} days ago` : `${lot.daysUntilExpiry} days`
                    ) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'info', label: 'Lot Information', icon: '📋' },
              { id: 'transactions', label: 'Transaction History', icon: '📊' },
              { id: 'qc', label: 'QC Tests', icon: '🔬' },
              { id: 'traceability', label: 'Traceability', icon: '🔗' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Item Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Item Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Item Code</label>
                      <p className="font-medium">{lot.itemCode}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Type</label>
                      <p className="font-medium">{lot.itemType}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Item Name (TH)</label>
                    <p className="font-medium">{lot.itemNameTh}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Item Name (EN)</label>
                    <p className="font-medium">{lot.itemNameEn}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Category</label>
                      <p className="font-medium">{lot.itemCategory || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Unit</label>
                      <p className="font-medium">{lot.unit}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lot Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lot Details</CardTitle>
                {!isEditing ? (
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Lot Number</label>
                      <p className="font-medium">{lot.lotNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Batch Number</label>
                      {isEditing ? (
                        <Input
                          value={editForm.batchNumber}
                          onChange={(e) => setEditForm({ ...editForm, batchNumber: e.target.value })}
                        />
                      ) : (
                        <p className="font-medium">{lot.batchNumber || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      {isEditing ? (
                        <DatePicker
                          label="Manufacturing Date"
                          value={editForm.manufacturingDate}
                          onChange={(value) => setEditForm({ ...editForm, manufacturingDate: value })}
                          max={editForm.expiryDate || undefined}
                          showQuickActions={false}
                          size="sm"
                        />
                      ) : (
                        <>
                          <label className="text-sm text-gray-500">Manufacturing Date</label>
                          <p className="font-medium">{formatDate(lot.manufacturingDate)}</p>
                        </>
                      )}
                    </div>
                    <div>
                      {isEditing ? (
                        <DatePicker
                          label="Expiry Date"
                          value={editForm.expiryDate}
                          onChange={(value) => setEditForm({ ...editForm, expiryDate: value })}
                          min={editForm.manufacturingDate || undefined}
                          showQuickActions={false}
                          size="sm"
                        />
                      ) : (
                        <>
                          <label className="text-sm text-gray-500">Expiry Date</label>
                          <p className="font-medium">{formatDate(lot.expiryDate)}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Received Date</label>
                      <p className="font-medium">{formatDate(lot.receivedDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">COA Number</label>
                      {isEditing ? (
                        <Input
                          value={editForm.coaNumber}
                          onChange={(e) => setEditForm({ ...editForm, coaNumber: e.target.value })}
                        />
                      ) : (
                        <p className="font-medium">{lot.coaNumber || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">PO Number</label>
                    <p className="font-medium">{lot.poNumber || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Location */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Warehouse Code</label>
                      <p className="font-medium">{lot.warehouseCode}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Warehouse Name</label>
                      <p className="font-medium">{lot.warehouseName}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vendor Information */}
            <Card>
              <CardHeader>
                <CardTitle>Vendor Information</CardTitle>
              </CardHeader>
              <CardContent>
                {lot.vendor ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Vendor Code</label>
                        <p className="font-medium">{lot.vendor.code}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Vendor Name</label>
                        <p className="font-medium">{lot.vendor.name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Contact Person</label>
                        <p className="font-medium">{lot.vendor.contactPerson || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Phone</label>
                        <p className="font-medium">{lot.vendor.phone || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="font-medium">{lot.vendor.email || '-'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No vendor information available</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table
                columns={transactionColumns}
                data={lot.transactions}
                keyField="id"
                emptyMessage="No transactions found"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'qc' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>QC Tests</CardTitle>
              <Button size="sm" onClick={() => router.push(`/quality/tests/new?lotId=${lot.id}`)}>+ New QC Test</Button>
            </CardHeader>
            <CardContent>
              <Table
                columns={qcTestColumns}
                data={lot.qcTests}
                keyField="id"
                emptyMessage="No QC tests found"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'traceability' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Forward Traceability</CardTitle>
                <p className="text-sm text-gray-500">Work orders and finished products that used this lot</p>
              </CardHeader>
              <CardContent>
                <Table
                  columns={workOrderColumns}
                  data={lot.relatedWorkOrders}
                  keyField="id"
                  emptyMessage="No related work orders found"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backward Traceability</CardTitle>
                <p className="text-sm text-gray-500">Source materials and suppliers for this lot</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-full">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Vendor: {lot.vendor?.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">PO: {lot.poNumber || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-full">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">COA: {lot.coaNumber || 'Not Available'}</p>
                        <p className="text-sm text-gray-500">Certificate of Analysis</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Information */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Created: {formatDateTime(lot.createdAt)}</span>
              <span>Last Updated: {formatDateTime(lot.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
