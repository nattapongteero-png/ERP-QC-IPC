'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface SODetail {
  salesOrder: {
    id: number;
    soNumber: string;
    customerId: number;
    customerCode: string;
    customerName: string;
    customerContact: string;
    customerPhone: string;
    customerEmail: string;
    customerAddress: string;
    orderDate: string;
    requestedDate: string;
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
    shippedQty: number;
    lineTotal: number;
    pendingQty: number;
    fulfillmentStatus: string;
    availableStock: number;
    canFulfill: boolean;
    suggestedLots: Array<{
      id: number;
      lotNumber: string;
      quantity: number;
      expiryDate: string;
    }>;
  }>;
  summary: {
    lineCount: number;
    totalOrdered: number;
    totalShipped: number;
    totalPending: number;
    fulfillmentProgress: number;
    totalAmount: number;
    allCanFulfill: boolean;
  };
}

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<SODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'lines' | 'fulfillment' | 'shipping'>('overview');
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [fulfillForm, setFulfillForm] = useState({
    lotId: '',
    quantity: '',
  });

  useEffect(() => {
    fetchSODetail();
  }, [params.id]);

  const fetchSODetail = async () => {
    try {
      const response = await fetch(`/api/sales/orders/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch SO detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = (line: any) => {
    setSelectedLine(line);
    setFulfillForm({
      lotId: line.suggestedLots[0]?.id?.toString() || '',
      quantity: Math.min(line.pendingQty, line.suggestedLots[0]?.quantity || 0).toString(),
    });
    setShowFulfillModal(true);
  };

  const submitFulfill = async () => {
    if (!selectedLine) return;
    
    try {
      // This would call the fulfillment API
      const selectedLot = selectedLine.suggestedLots.find((l: any) => l.id.toString() === fulfillForm.lotId);
      alert(`Fulfilling ${fulfillForm.quantity} ${selectedLine.itemUnit} of ${selectedLine.itemCode} from Lot ${selectedLot?.lotNumber}`);
      setShowFulfillModal(false);
      fetchSODetail();
    } catch (error) {
      console.error('Failed to fulfill:', error);
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'shipped': case 'complete': case 'delivered': return 'primary';
      case 'partial': case 'processing': return 'secondary';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'processing': 'Processing',
      'partial': 'Partial Shipped',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
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
          <p className="text-gray-500">ไม่พบข้อมูล Sales Order</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/sales')}>
            กลับไปหน้ารายการ
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { salesOrder: so, lines, summary } = data;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/sales')}>
                ← Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">SO: {so.soNumber}</h1>
              <Badge variant={getStatusVariant(so.status)}>
                {getStatusLabel(so.status)}
              </Badge>
              {summary.allCanFulfill && summary.totalPending > 0 && (
                <Badge variant="primary">Ready to Ship</Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">Customer: {so.customerName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              Print SO
            </Button>
            {so.status === 'confirmed' && summary.allCanFulfill && (
              <Button variant="primary">Process All</Button>
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
                <p className="text-sm text-gray-600">Shipped</p>
                <p className="text-2xl font-bold text-green-600">{summary.totalShipped?.toLocaleString() || 0}</p>
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
                <p className="text-2xl font-bold text-gray-600">{summary.fulfillmentProgress || 0}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${summary.fulfillmentProgress || 0}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alert */}
        {!summary.allCanFulfill && summary.totalPending > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-orange-800">Insufficient Stock</p>
              <p className="text-sm text-orange-600">
                Some items do not have enough stock to fulfill this order. Check the Fulfillment tab for details.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'lines', label: '📋 Order Lines' },
              { id: 'fulfillment', label: '📦 Fulfillment' },
              { id: 'shipping', label: '🚚 Shipping' },
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
            {/* SO Info */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">SO Number</dt>
                    <dd className="font-medium">{so.soNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd><Badge variant={getStatusVariant(so.status)}>{getStatusLabel(so.status)}</Badge></dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Order Date</dt>
                    <dd className="font-medium">
                      {so.orderDate ? new Date(so.orderDate).toLocaleDateString('th-TH') : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Requested Date</dt>
                    <dd className="font-medium">
                      {so.requestedDate ? new Date(so.requestedDate).toLocaleDateString('th-TH') : '-'}
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

            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Customer Code</dt>
                    <dd className="font-medium">{so.customerCode || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Customer Name</dt>
                    <dd className="font-medium">{so.customerName || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Contact Person</dt>
                    <dd className="font-medium">{so.customerContact || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Phone</dt>
                    <dd className="font-medium">{so.customerPhone || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Email</dt>
                    <dd className="font-medium">{so.customerEmail || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Shipping Address</dt>
                    <dd className="font-medium">{so.customerAddress || '-'}</dd>
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
                <p className="text-gray-700">{so.notes || 'No notes'}</p>
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
                  { key: 'shipped', title: 'Shipped' },
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
                      {line.shippedQty || 0} / {line.quantity} {line.itemUnit}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(line.fulfillmentStatus)}>
                        {line.fulfillmentStatus}
                      </Badge>
                    </td>
                  </tr>
                )}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'fulfillment' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Order Fulfillment (FEFO)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'item', title: 'Item' },
                  { key: 'ordered', title: 'Ordered' },
                  { key: 'shipped', title: 'Shipped' },
                  { key: 'pending', title: 'Pending' },
                  { key: 'available', title: 'Available Stock' },
                  { key: 'suggestedLots', title: 'Suggested Lots (FEFO)' },
                  { key: 'actions', title: 'Actions' },
                ]}
                data={lines}
                renderRow={(line) => (
                  <tr key={line.id} className={`hover:bg-gray-50 ${!line.canFulfill ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{line.itemCode}</p>
                        <p className="text-sm text-gray-500">{line.itemName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{line.quantity} {line.itemUnit}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{line.shippedQty || 0} {line.itemUnit}</td>
                    <td className="px-4 py-3 text-orange-600 font-medium">{line.pendingQty} {line.itemUnit}</td>
                    <td className="px-4 py-3">
                      <span className={line.canFulfill ? 'text-green-600' : 'text-red-600'}>
                        {line.availableStock} {line.itemUnit}
                      </span>
                      {!line.canFulfill && <span className="text-red-500 text-xs block">Insufficient</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {line.suggestedLots.slice(0, 2).map((lot: any) => (
                          <div key={lot.id} className="text-xs bg-gray-100 rounded px-2 py-1">
                            <span className="font-medium">{lot.lotNumber}</span>
                            <span className="text-gray-500 ml-2">({lot.quantity})</span>
                            {lot.expiryDate && (
                              <span className="text-gray-400 ml-1">
                                Exp: {new Date(lot.expiryDate).toLocaleDateString('th-TH')}
                              </span>
                            )}
                          </div>
                        ))}
                        {line.suggestedLots.length === 0 && (
                          <span className="text-red-500 text-xs">No lots available</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {line.pendingQty > 0 && line.canFulfill && (
                        <Button variant="primary" size="sm" onClick={() => handleFulfill(line)}>
                          Pick & Ship
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'shipping' && (
          <Card>
            <CardHeader>
              <CardTitle>Shipping History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">No shipments recorded yet</p>
            </CardContent>
          </Card>
        )}

        {/* Fulfill Modal */}
        {showFulfillModal && selectedLine && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Pick & Ship</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Item</p>
                  <p className="font-medium">{selectedLine.itemCode} - {selectedLine.itemName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Lot (FEFO)</label>
                  <Select
                    value={fulfillForm.lotId}
                    onChange={(e) => {
                      const lot = selectedLine.suggestedLots.find((l: any) => l.id.toString() === e.target.value);
                      setFulfillForm({
                        lotId: e.target.value,
                        quantity: Math.min(selectedLine.pendingQty, lot?.quantity || 0).toString(),
                      });
                    }}
                  >
                    {selectedLine.suggestedLots.map((lot: any) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber} - Qty: {lot.quantity} - Exp: {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH') : 'N/A'}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({selectedLine.itemUnit})</label>
                  <Input
                    type="number"
                    value={fulfillForm.quantity}
                    onChange={(e) => setFulfillForm({ ...fulfillForm, quantity: e.target.value })}
                    max={selectedLine.pendingQty}
                  />
                  <p className="text-xs text-gray-500 mt-1">Pending: {selectedLine.pendingQty} {selectedLine.itemUnit}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowFulfillModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" className="flex-1" onClick={submitFulfill}>
                  Confirm Ship
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
