'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTabs, DxTabItem } from '@/components/ui/dx-tabs';
import { DxPopup } from '@/components/ui/dx-popup';
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
  const [activeTab, setActiveTab] = useState(0);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<SOLine | null>(null);
  const [fulfillForm, setFulfillForm] = useState({
    lotId: '',
    quantity: 0,
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
      quantity: Math.min(line.pendingQty, line.suggestedLots[0]?.quantity || 0),
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
          <div className="mt-4">
            <DxButton
              text="Back to Orders"
              type="default"
              onClick={() => router.push('/sales/orders')}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  const { salesOrder: so, lines, summary } = data;

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'Item',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 120,
      cellRender: (cellInfo) => `${cellInfo.data.quantity} ${cellInfo.data.itemUnit}`,
    },
    {
      dataField: 'unitPrice',
      caption: 'Unit Price',
      width: 120,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.unitPrice),
    },
    {
      dataField: 'lineTotal',
      caption: 'Line Total',
      width: 130,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.lineTotal),
    },
    {
      dataField: 'shippedQty',
      caption: 'Shipped',
      width: 140,
      cellRender: (cellInfo) => `${cellInfo.data.shippedQty || 0} / ${cellInfo.data.quantity} ${cellInfo.data.itemUnit}`,
    },
    {
      dataField: 'fulfillmentStatus',
      caption: 'Status',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusVariant(cellInfo.data.fulfillmentStatus)} dot>
          {cellInfo.data.fulfillmentStatus}
        </Badge>
      ),
    },
  ];

  const fulfillmentColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'Item',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'Ordered',
      width: 100,
      cellRender: (cellInfo) => `${cellInfo.data.quantity} ${cellInfo.data.itemUnit}`,
    },
    {
      dataField: 'shippedQty',
      caption: 'Shipped',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="text-green-600 font-medium">{cellInfo.data.shippedQty || 0} {cellInfo.data.itemUnit}</span>
      ),
    },
    {
      dataField: 'pendingQty',
      caption: 'Pending',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="text-orange-600 font-medium">{cellInfo.data.pendingQty} {cellInfo.data.itemUnit}</span>
      ),
    },
    {
      dataField: 'availableStock',
      caption: 'Available Stock',
      width: 130,
      cellRender: (cellInfo) => (
        <div>
          <span className={cellInfo.data.canFulfill ? 'text-green-600' : 'text-red-600'}>
            {cellInfo.data.availableStock} {cellInfo.data.itemUnit}
          </span>
          {!cellInfo.data.canFulfill && <span className="text-red-500 text-xs block">Insufficient</span>}
        </div>
      ),
    },
    {
      dataField: 'suggestedLots',
      caption: 'Suggested Lots (FEFO)',
      width: 200,
      cellRender: (cellInfo) => (
        <div className="space-y-1">
          {cellInfo.data.suggestedLots.slice(0, 2).map((lot: SOLine['suggestedLots'][0]) => (
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
          {cellInfo.data.suggestedLots.length === 0 && (
            <span className="text-red-500 text-xs">No lots available</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 120,
      cellRender: (cellInfo) => (
        cellInfo.data.pendingQty > 0 && cellInfo.data.canFulfill ? (
          <DxButton
            text="Pick & Ship"
            type="default"
            stylingMode="outlined"
            onClick={() => handleFulfill(cellInfo.data)}
          />
        ) : null
      ),
    },
  ];

  const renderOverviewTab = () => (
    <div className="p-6">
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
    </div>
  );

  const renderLinesTab = () => (
    <div className="p-6">
      <DxDataGrid
        dataSource={lines}
        keyExpr="id"
        columns={lineColumns}
        showBorders
        height={400}
        noDataText="No order lines"
      />
    </div>
  );

  const renderFulfillmentTab = () => (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">Order Fulfillment (FEFO)</h3>
        <p className="text-sm text-gray-500">Items are suggested based on First Expiry, First Out policy</p>
      </div>
      <DxDataGrid
        dataSource={lines}
        keyExpr="id"
        columns={fulfillmentColumns}
        showBorders
        height={400}
        noDataText="No fulfillment data"
      />
    </div>
  );

  const renderShippingTab = () => (
    <div className="p-6">
      <div className="text-center py-8 text-gray-500">
        <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p>No shipments recorded yet</p>
      </div>
    </div>
  );

  const renderFulfillModalContent = () => (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Pick & Ship</h2>
      {selectedLine && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Item</p>
            <p className="font-medium">{selectedLine.itemCode} - {selectedLine.itemName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Lot (FEFO)</label>
            <DxSelectBox
              items={selectedLine.suggestedLots.map((lot) => ({
                value: lot.id.toString(),
                text: `${lot.lotNumber} - Qty: ${lot.quantity} - Exp: ${lot.expiryDate ? formatDate(lot.expiryDate) : 'N/A'}`,
              }))}
              value={fulfillForm.lotId}
              onValueChange={(value) => {
                const lot = selectedLine.suggestedLots.find((l) => l.id.toString() === value);
                setFulfillForm({
                  lotId: value,
                  quantity: Math.min(selectedLine.pendingQty, lot?.quantity || 0),
                });
              }}
              valueExpr="value"
              displayExpr="text"
              placeholder="Select a lot"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity ({selectedLine.itemUnit})
            </label>
            <DxNumberBox
              value={fulfillForm.quantity}
              onValueChange={(value) => setFulfillForm({ ...fulfillForm, quantity: value || 0 })}
              min={0}
              max={selectedLine.pendingQty}
            />
            <p className="text-xs text-gray-500 mt-1">Pending: {selectedLine.pendingQty} {selectedLine.itemUnit}</p>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        <DxButton
          text="Cancel"
          type="normal"
          stylingMode="outlined"
          onClick={() => setShowFulfillModal(false)}
        />
        <DxButton
          text="Confirm Ship"
          type="success"
          onClick={submitFulfill}
        />
      </div>
    </div>
  );

  const tabItems: DxTabItem[] = [
    { text: 'Overview' },
    { text: `Order Lines (${lines.length})` },
    { text: 'Fulfillment' },
    { text: 'Shipping' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={`SO: ${so.soNumber}`}
          description={`Customer: ${so.customerName}`}
          actions={
            <div className="flex gap-2">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/sales/orders')}
              />
              <DxButton
                text="Print"
                icon="print"
                type="normal"
                stylingMode="outlined"
                onClick={() => window.print()}
              />
              {so.status === 'confirmed' && summary.allCanFulfill && (
                <DxButton
                  text="Process All"
                  type="success"
                />
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
          <CardHeader className="border-b pb-0">
            <DxTabs
              items={tabItems}
              selectedIndex={activeTab}
              onSelectedIndexChange={setActiveTab}
            />
          </CardHeader>

          <CardContent className="p-0">
            {activeTab === 0 && renderOverviewTab()}
            {activeTab === 1 && renderLinesTab()}
            {activeTab === 2 && renderFulfillmentTab()}
            {activeTab === 3 && renderShippingTab()}
          </CardContent>
        </Card>
      </div>

      {/* Fulfill Modal */}
      <DxPopup
        visible={showFulfillModal}
        onHiding={() => setShowFulfillModal(false)}
        title=""
        width={500}
        height="auto"
        showCloseButton
        showTitle={false}
      >
        {renderFulfillModalContent()}
      </DxPopup>
    </MainLayout>
  );
}
