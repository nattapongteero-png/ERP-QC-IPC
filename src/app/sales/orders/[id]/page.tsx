'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import {
  ArrowLeft,
  Printer,
  DollarSign,
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';

interface SOLine {
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
}

interface SODetail {
  salesOrder: {
    id: number;
    soNumber: string;
    customerName: string;
    customerContact: string;
    customerAddress: string;
    orderDate: string;
    requiredDate: string;
    shippedDate: string;
    status: string;
    totalAmount: number;
    currency: string;
    paymentTerms: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  };
  lines: SOLine[];
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

export default function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<SODetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<SOLine | null>(null);
  const [fulfillForm, setFulfillForm] = useState({
    lotId: '',
    quantity: '',
  });

  const fetchSODetail = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sales/orders/${resolvedParams.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch SO detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSODetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const handleFulfill = (line: SOLine) => {
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
      const selectedLot = selectedLine.suggestedLots.find((l) => l.id.toString() === fulfillForm.lotId);
      alert(`Fulfilling ${fulfillForm.quantity} ${selectedLine.itemUnit} of ${selectedLine.itemCode} from Lot ${selectedLot?.lotNumber}`);
      setShowFulfillModal(false);
      fetchSODetail();
    } catch (error) {
      console.error('Failed to fulfill:', error);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'shipped':
      case 'complete':
      case 'delivered':
        return 'success';
      case 'partial':
      case 'processing':
        return 'warning';
      case 'cancelled':
        return 'danger';
      case 'confirmed':
        return 'info';
      default:
        return 'default';
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const formatCurrency = (amount: number | null) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount || 0);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Sales Order not found</h2>
          <p className="text-gray-500 mt-2">The requested sales order could not be found.</p>
          <Button className="mt-4" onClick={() => router.push('/sales/orders')}>
            Back to Orders
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { salesOrder: so, lines, summary } = data;

  const lineColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (line: SOLine) => (
        <div>
          <p className="font-medium">{line.itemCode}</p>
          <p className="text-sm text-gray-500">{line.itemName}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (line: SOLine) => `${line.quantity} ${line.itemUnit}`,
    },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      render: (line: SOLine) => formatCurrency(line.unitPrice),
    },
    {
      key: 'lineTotal',
      header: 'Line Total',
      render: (line: SOLine) => formatCurrency(line.lineTotal),
    },
    {
      key: 'shipped',
      header: 'Shipped',
      render: (line: SOLine) => `${line.shippedQty || 0} / ${line.quantity} ${line.itemUnit}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (line: SOLine) => (
        <Badge variant={getStatusVariant(line.fulfillmentStatus)} dot>
          {line.fulfillmentStatus}
        </Badge>
      ),
    },
  ];

  const fulfillmentColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (line: SOLine) => (
        <div>
          <p className="font-medium">{line.itemCode}</p>
          <p className="text-sm text-gray-500">{line.itemName}</p>
        </div>
      ),
    },
    {
      key: 'ordered',
      header: 'Ordered',
      render: (line: SOLine) => `${line.quantity} ${line.itemUnit}`,
    },
    {
      key: 'shipped',
      header: 'Shipped',
      render: (line: SOLine) => (
        <span className="text-green-600 font-medium">{line.shippedQty || 0} {line.itemUnit}</span>
      ),
    },
    {
      key: 'pending',
      header: 'Pending',
      render: (line: SOLine) => (
        <span className="text-orange-600 font-medium">{line.pendingQty} {line.itemUnit}</span>
      ),
    },
    {
      key: 'available',
      header: 'Available Stock',
      render: (line: SOLine) => (
        <div>
          <span className={line.canFulfill ? 'text-green-600' : 'text-red-600'}>
            {line.availableStock} {line.itemUnit}
          </span>
          {!line.canFulfill && <span className="text-red-500 text-xs block">Insufficient</span>}
        </div>
      ),
    },
    {
      key: 'suggestedLots',
      header: 'Suggested Lots (FEFO)',
      render: (line: SOLine) => (
        <div className="space-y-1">
          {line.suggestedLots.slice(0, 2).map((lot) => (
            <div key={lot.id} className="text-xs bg-gray-100 rounded px-2 py-1">
              <span className="font-medium">{lot.lotNumber}</span>
              <span className="text-gray-500 ml-2">({lot.quantity})</span>
              {lot.expiryDate && (
                <span className="text-gray-400 ml-1">
                  Exp: {formatDate(lot.expiryDate)}
                </span>
              )}
            </div>
          ))}
          {line.suggestedLots.length === 0 && (
            <span className="text-red-500 text-xs">No lots available</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (line: SOLine) => (
        line.pendingQty > 0 && line.canFulfill ? (
          <Button size="sm" onClick={() => handleFulfill(line)}>
            Pick & Ship
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={`SO: ${so.soNumber}`}
          description={`Customer: ${so.customerName}`}
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push('/sales/orders')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button variant="secondary" onClick={() => window.print()} leftIcon={<Printer className="h-4 w-4" />}>
                Print
              </Button>
              {so.status === 'confirmed' && summary.allCanFulfill && (
                <Button>Process All</Button>
              )}
            </div>
          }
        />

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(so.status)} dot>
            {getStatusLabel(so.status)}
          </Badge>
          {summary.allCanFulfill && summary.totalPending > 0 && (
            <Badge variant="success">Ready to Ship</Badge>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Total Amount</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gray-50">
                  <ShoppingCart className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Total Ordered</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{summary.totalOrdered}</p>
                  <p className="text-xs text-gray-500">units</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <Truck className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Shipped</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{summary.totalShipped}</p>
                  <p className="text-xs text-gray-500">units</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-50">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Pending</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{summary.totalPending}</p>
                  <p className="text-xs text-gray-500">units</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Progress</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{summary.fulfillmentProgress}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${summary.fulfillmentProgress || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alert */}
        {!summary.allCanFulfill && summary.totalPending > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <div>
              <p className="font-medium text-orange-800">Insufficient Stock</p>
              <p className="text-sm text-orange-600">
                Some items do not have enough stock to fulfill this order. Check the Fulfillment tab for details.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="border-b pb-0">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="lines">Order Lines ({lines.length})</TabsTrigger>
                <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
                <TabsTrigger value="shipping">Shipping</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="overview" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SO Info */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Order Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">SO Number</p>
                        <p className="font-medium">{so.soNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <Badge variant={getStatusVariant(so.status)} dot>{getStatusLabel(so.status)}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Order Date</p>
                        <p className="font-medium">{formatDate(so.orderDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Required Date</p>
                        <p className="font-medium">{formatDate(so.requiredDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payment Terms</p>
                        <p className="font-medium">{so.paymentTerms || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Line Items</p>
                        <p className="font-medium">{summary.lineCount} items</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Customer Name</p>
                        <p className="font-medium">{so.customerName || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Contact Person</p>
                        <p className="font-medium">{so.customerContact || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Shipping Address</p>
                        <p className="font-medium">{so.customerAddress || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {so.notes && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                    <p className="text-gray-700">{so.notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lines" className="mt-0">
                <Table columns={lineColumns} data={lines} keyField="id" />
              </TabsContent>

              <TabsContent value="fulfillment" className="mt-0">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Order Fulfillment (FEFO)</h3>
                  <p className="text-sm text-gray-500">Items are suggested based on First Expiry, First Out policy</p>
                </div>
                <Table columns={fulfillmentColumns} data={lines} keyField="id" />
              </TabsContent>

              <TabsContent value="shipping" className="mt-0">
                <div className="text-center py-8 text-gray-500">
                  <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>No shipments recorded yet</p>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Fulfill Modal */}
      <Dialog open={showFulfillModal} onOpenChange={setShowFulfillModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick & Ship</DialogTitle>
          </DialogHeader>
          {selectedLine && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-gray-500">Item</p>
                <p className="font-medium">{selectedLine.itemCode} - {selectedLine.itemName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Lot (FEFO)</label>
                <Select
                  value={fulfillForm.lotId}
                  onChange={(e) => {
                    const lot = selectedLine.suggestedLots.find((l) => l.id.toString() === e.target.value);
                    setFulfillForm({
                      lotId: e.target.value,
                      quantity: Math.min(selectedLine.pendingQty, lot?.quantity || 0).toString(),
                    });
                  }}
                  options={selectedLine.suggestedLots.map((lot) => ({
                    value: lot.id.toString(),
                    label: `${lot.lotNumber} - Qty: ${lot.quantity} - Exp: ${lot.expiryDate ? formatDate(lot.expiryDate) : 'N/A'}`,
                  }))}
                />
              </div>
              <div>
                <Input
                  label={`Quantity (${selectedLine.itemUnit})`}
                  type="number"
                  value={fulfillForm.quantity}
                  onChange={(e) => setFulfillForm({ ...fulfillForm, quantity: e.target.value })}
                  max={selectedLine.pendingQty}
                />
                <p className="text-xs text-gray-500 mt-1">Pending: {selectedLine.pendingQty} {selectedLine.itemUnit}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowFulfillModal(false)}>
              Cancel
            </Button>
            <Button onClick={submitFulfill}>
              Confirm Ship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
