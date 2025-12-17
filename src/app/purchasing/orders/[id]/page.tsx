'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

interface PODetail {
  purchaseOrder: {
    id: number;
    poNumber: string;
    vendorId: number;
    vendorCode: string;
    vendorName: string;
    vendorContact: string;
    vendorPhone: string;
    vendorEmail: string;
    orderDate: string;
    expectedDate: string;
    status: string;
    totalAmount: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
  lines: Array<{
    id: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    itemNameEn: string;
    itemUnit: string;
    quantity: number;
    unitPrice: number;
    receivedQty: number;
    lineTotal: number;
    pendingQty: number;
    receivingStatus: string;
  }>;
  receivedLots: Array<{
    id: number;
    lotNumber: string;
    itemId: number;
    itemCode: string;
    itemName: string;
    quantity: number;
    status: string;
    expiryDate: string;
    receivedDate: string;
  }>;
  summary: {
    lineCount: number;
    totalOrdered: number;
    totalReceived: number;
    totalPending: number;
    receivingProgress: number;
    totalAmount: number;
    lotsReceived: number;
  };
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'lines' | 'receiving' | 'lots'>('overview');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [receiveForm, setReceiveForm] = useState({
    lotNumber: '',
    quantity: '',
    expiryDate: '',
  });

  useEffect(() => {
    fetchPODetail();
  }, [params.id]);

  const fetchPODetail = async () => {
    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch PO detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = (line: any) => {
    setSelectedLine(line);
    setReceiveForm({
      lotNumber: `LOT-${Date.now()}`,
      quantity: line.pendingQty.toString(),
      expiryDate: '',
    });
    setShowReceiveModal(true);
  };

  const submitReceive = async () => {
    if (!selectedLine) return;
    
    try {
      // This would call the receiving API
      alert(`Receiving ${receiveForm.quantity} ${selectedLine.itemUnit} of ${selectedLine.itemCode} with Lot ${receiveForm.lotNumber}`);
      setShowReceiveModal(false);
      fetchPODetail();
    } catch (error) {
      console.error('Failed to receive:', error);
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'received': case 'complete': return 'primary';
      case 'partial': return 'secondary';
      case 'cancelled': return 'danger';
      case 'released': case 'quarantine': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'pending': 'Pending',
      'approved': 'Approved',
      'ordered': 'Ordered',
      'partial': 'Partial Received',
      'received': 'Received',
      'cancelled': 'Cancelled',
      'complete': 'Complete',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">ไม่พบข้อมูล Purchase Order</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/purchasing')}>
            กลับไปหน้ารายการ
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { purchaseOrder: po, lines, receivedLots, summary } = data;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/purchasing')}>
                ← Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">PO: {po.poNumber}</h1>
              <Badge variant={getStatusVariant(po.status)}>
                {getStatusLabel(po.status)}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">Vendor: {po.vendorName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              Print PO
            </Button>
            {po.status === 'approved' && (
              <Button variant="primary">Send to Vendor</Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-blue-600">฿{summary.totalAmount?.toLocaleString() || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Ordered</p>
                <p className="text-2xl font-bold text-gray-600">{summary.totalOrdered?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">units</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Received</p>
                <p className="text-2xl font-bold text-green-600">{summary.totalReceived?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">units</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{summary.totalPending?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">units</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Progress</p>
                <p className="text-2xl font-bold text-gray-600">{summary.receivingProgress || 0}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${summary.receivingProgress || 0}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'lines', label: '📋 Order Lines' },
              { id: 'receiving', label: '📦 Receiving' },
              { id: 'lots', label: '🏷️ Received Lots' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PO Info */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">PO Number</dt>
                    <dd className="font-medium">{po.poNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd><Badge variant={getStatusVariant(po.status)}>{getStatusLabel(po.status)}</Badge></dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Order Date</dt>
                    <dd className="font-medium">
                      {po.orderDate ? new Date(po.orderDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Expected Date</dt>
                    <dd className="font-medium">
                      {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Total Amount</dt>
                    <dd className="font-medium text-lg">฿{summary.totalAmount?.toLocaleString() || 0}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Line Items</dt>
                    <dd className="font-medium">{summary.lineCount} items</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Vendor Info */}
            <Card>
              <CardHeader>
                <CardTitle>Vendor Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Vendor Code</dt>
                    <dd className="font-medium">{po.vendorCode || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Vendor Name</dt>
                    <dd className="font-medium">{po.vendorName || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Contact Person</dt>
                    <dd className="font-medium">{po.vendorContact || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Phone</dt>
                    <dd className="font-medium">{po.vendorPhone || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Email</dt>
                    <dd className="font-medium">{po.vendorEmail || '-'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{po.notes || 'No notes'}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'lines' && (
          <Card>
            <CardHeader>
              <CardTitle>Order Lines</CardTitle>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'item', title: 'Item' },
                  { key: 'quantity', title: 'Quantity' },
                  { key: 'unitPrice', title: 'Unit Price' },
                  { key: 'lineTotal', title: 'Line Total' },
                  { key: 'received', title: 'Received' },
                  { key: 'status', title: 'Status' },
                ]}
                data={lines}
                renderRow={(line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{line.itemCode}</p>
                        <p className="text-sm text-gray-500">{line.itemName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{line.quantity} {line.itemUnit}</td>
                    <td className="px-4 py-3">฿{line.unitPrice?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3">฿{line.lineTotal?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3">
                      {line.receivedQty || 0} / {line.quantity} {line.itemUnit}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(line.receivingStatus)}>
                        {line.receivingStatus}
                      </Badge>
                    </td>
                  </tr>
                )}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'receiving' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Goods Receiving</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'item', title: 'Item' },
                  { key: 'ordered', title: 'Ordered' },
                  { key: 'received', title: 'Received' },
                  { key: 'pending', title: 'Pending' },
                  { key: 'status', title: 'Status' },
                  { key: 'actions', title: 'Actions' },
                ]}
                data={lines}
                renderRow={(line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{line.itemCode}</p>
                        <p className="text-sm text-gray-500">{line.itemName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{line.quantity} {line.itemUnit}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{line.receivedQty || 0} {line.itemUnit}</td>
                    <td className="px-4 py-3 text-orange-600 font-medium">{line.pendingQty} {line.itemUnit}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(line.receivingStatus)}>
                        {line.receivingStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {line.pendingQty > 0 && (
                        <Button variant="primary" size="sm" onClick={() => handleReceive(line)}>
                          Receive
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'lots' && (
          <Card>
            <CardHeader>
              <CardTitle>Received Lots</CardTitle>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'lotNumber', title: 'Lot Number' },
                  { key: 'item', title: 'Item' },
                  { key: 'quantity', title: 'Quantity' },
                  { key: 'status', title: 'Status' },
                  { key: 'expiryDate', title: 'Expiry Date' },
                  { key: 'receivedDate', title: 'Received Date' },
                ]}
                data={receivedLots}
                renderRow={(lot) => (
                  <tr key={lot.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/inventory/lots/${lot.id}`)}>
                    <td className="px-4 py-3 font-medium text-blue-600">{lot.lotNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{lot.itemCode}</p>
                        <p className="text-sm text-gray-500">{lot.itemName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{lot.quantity}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {lot.receivedDate ? new Date(lot.receivedDate).toLocaleDateString('th-TH') : '-'}
                    </td>
                  </tr>
                )}
              />
              {receivedLots.length === 0 && (
                <p className="text-center text-gray-500 py-8">No lots received yet</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Receive Modal */}
        {showReceiveModal && selectedLine && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Receive Goods</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Item</p>
                  <p className="font-medium">{selectedLine.itemCode} - {selectedLine.itemName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                  <Input
                    value={receiveForm.lotNumber}
                    onChange={(e) => setReceiveForm({ ...receiveForm, lotNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({selectedLine.itemUnit})</label>
                  <Input
                    type="number"
                    value={receiveForm.quantity}
                    onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                    max={selectedLine.pendingQty}
                  />
                  <p className="text-xs text-gray-500 mt-1">Max: {selectedLine.pendingQty} {selectedLine.itemUnit}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <Input
                    type="date"
                    value={receiveForm.expiryDate}
                    onChange={(e) => setReceiveForm({ ...receiveForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" className="flex-1" onClick={submitReceive}>
                  Receive
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
