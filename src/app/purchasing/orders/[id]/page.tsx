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
import { DatePicker } from '@/components/ui/date-picker';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Printer, Send, Package, DollarSign,
  Clock, CheckCircle, AlertCircle, Truck, FileText,
  Building2, User, Phone, Mail, Warehouse, Calendar,
  Hash, Scale, Tag
} from 'lucide-react';

interface Warehouse {
  id: number;
  code: string;
  name: string;
}

interface POLine {
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
}

interface ReceivedLot {
  id: number;
  lotNumber: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  status: string;
  expiryDate: string;
  receivedDate: string;
}

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
  lines: POLine[];
  receivedLots: ReceivedLot[];
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
  const [selectedLine, setSelectedLine] = useState<POLine | null>(null);
  const [receiveForm, setReceiveForm] = useState({
    lotNumber: '',
    quantity: '',
    expiryDate: '',
    warehouseId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  useEffect(() => {
    fetchPODetail();
    fetchWarehouses();
  }, [params.id]);

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const response = await fetch('/api/warehouses?status=active&limit=100');
      const result = await response.json();
      if (result.success) {
        setWarehouses(result.data?.items || result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    } finally {
      setLoadingWarehouses(false);
    }
  };

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

  const handleReceive = (line: POLine) => {
    setSelectedLine(line);
    setReceiveForm({
      lotNumber: `LOT-${Date.now()}`,
      quantity: line.pendingQty.toString(),
      expiryDate: '',
      warehouseId: warehouses.length > 0 ? warehouses[0].id.toString() : '',
    });
    setShowReceiveModal(true);
  };

  const submitReceive = async () => {
    if (!selectedLine || !receiveForm.quantity || !receiveForm.expiryDate || !receiveForm.warehouseId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId: selectedLine.id,
          lotNumber: receiveForm.lotNumber,
          quantity: parseFloat(receiveForm.quantity),
          expiryDate: receiveForm.expiryDate,
          warehouseId: parseInt(receiveForm.warehouseId),
        }),
      });
      const result = await response.json();
      if (result.success) {
        setShowReceiveModal(false);
        setSelectedLine(null);
        fetchPODetail();
      }
    } catch (error) {
      console.error('Failed to receive:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'received': case 'complete': return 'success';
      case 'partial': return 'info';
      case 'cancelled': return 'danger';
      case 'approved': case 'ordered': return 'success';
      case 'pending': case 'pending_approval': return 'warning';
      case 'released': return 'success';
      case 'quarantine': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'pending': 'Pending',
      'pending_approval': 'Pending Approval',
      'approved': 'Approved',
      'ordered': 'Ordered',
      'partial': 'Partial Received',
      'received': 'Received',
      'cancelled': 'Cancelled',
      'complete': 'Complete',
    };
    return labels[status] || status;
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

  // Order Lines columns
  const linesColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (line: POLine) => (
        <div>
          <p className="font-medium">{line.itemCode}</p>
          <p className="text-sm text-gray-500">{line.itemName}</p>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (line: POLine) => `${line.quantity.toLocaleString()} ${line.itemUnit}`
    },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      align: 'right' as const,
      render: (line: POLine) => `฿${line.unitPrice?.toLocaleString() || 0}`
    },
    {
      key: 'lineTotal',
      header: 'Line Total',
      align: 'right' as const,
      render: (line: POLine) => `฿${line.lineTotal?.toLocaleString() || 0}`
    },
    {
      key: 'received',
      header: 'Received',
      render: (line: POLine) => (
        <span className={line.receivedQty > 0 ? 'text-green-600 font-medium' : ''}>
          {line.receivedQty || 0} / {line.quantity} {line.itemUnit}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (line: POLine) => (
        <Badge variant={getStatusVariant(line.receivingStatus)}>
          {line.receivingStatus}
        </Badge>
      )
    },
  ];

  // Receiving columns
  const receivingColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (line: POLine) => (
        <div>
          <p className="font-medium">{line.itemCode}</p>
          <p className="text-sm text-gray-500">{line.itemName}</p>
        </div>
      )
    },
    {
      key: 'ordered',
      header: 'Ordered',
      render: (line: POLine) => `${line.quantity.toLocaleString()} ${line.itemUnit}`
    },
    {
      key: 'received',
      header: 'Received',
      render: (line: POLine) => (
        <span className="text-green-600 font-medium">
          {line.receivedQty || 0} {line.itemUnit}
        </span>
      )
    },
    {
      key: 'pending',
      header: 'Pending',
      render: (line: POLine) => (
        <span className={line.pendingQty > 0 ? 'text-orange-600 font-medium' : ''}>
          {line.pendingQty} {line.itemUnit}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (line: POLine) => (
        <Badge variant={getStatusVariant(line.receivingStatus)}>
          {line.receivingStatus}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (line: POLine) => (
        line.pendingQty > 0 ? (
          <Button variant="primary" size="sm" onClick={() => handleReceive(line)}>
            <Package className="h-4 w-4 mr-1" />
            Receive
          </Button>
        ) : (
          <span className="text-gray-400 text-sm">Complete</span>
        )
      )
    },
  ];

  // Received Lots columns
  const lotsColumns = [
    {
      key: 'lotNumber',
      header: 'Lot Number',
      render: (lot: ReceivedLot) => (
        <span className="font-medium text-blue-600 hover:underline cursor-pointer">
          {lot.lotNumber}
        </span>
      )
    },
    {
      key: 'item',
      header: 'Item',
      render: (lot: ReceivedLot) => (
        <div>
          <p className="font-medium">{lot.itemCode}</p>
          <p className="text-sm text-gray-500">{lot.itemName}</p>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (lot: ReceivedLot) => lot.quantity.toLocaleString()
    },
    {
      key: 'status',
      header: 'Status',
      render: (lot: ReceivedLot) => (
        <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
      )
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (lot: ReceivedLot) => formatDate(lot.expiryDate)
    },
    {
      key: 'receivedDate',
      header: 'Received Date',
      render: (lot: ReceivedLot) => formatDate(lot.receivedDate)
    },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="!p-3 sm:!p-4">
                <Skeleton className="h-16" />
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <Skeleton className="h-64" />
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">ไม่พบข้อมูล Purchase Order</p>
          <Button variant="secondary" onClick={() => router.push('/purchasing')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/purchasing')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">PO: {po.poNumber}</h1>
              <Badge variant={getStatusVariant(po.status)} dot>
                {getStatusLabel(po.status)}
              </Badge>
            </div>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              <span className="hidden sm:inline">Vendor: </span>{po.vendorName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()} className="flex-1 sm:flex-none">
              <Printer className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            {po.status === 'approved' && (
              <Button variant="primary" className="flex-1 sm:flex-none">
                <Send className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Send to Vendor</span>
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Total Amount</p>
                <p className="text-base sm:text-xl font-bold text-blue-600">
                  ฿{summary.totalAmount?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Ordered</p>
                <p className="text-base sm:text-xl font-bold">{summary.totalOrdered?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-400">units</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Received</p>
                <p className="text-base sm:text-xl font-bold text-green-600">
                  {summary.totalReceived?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-400">units</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Pending</p>
                <p className="text-base sm:text-xl font-bold text-orange-600">
                  {summary.totalPending?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-400">units</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-gray-500">Progress</p>
                <p className="text-base sm:text-xl font-bold">{summary.receivingProgress || 0}%</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${summary.receivingProgress || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex gap-2 sm:gap-4 min-w-max">
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'lines', label: 'Order Lines', icon: Package },
              { id: 'receiving', label: 'Receiving', icon: Truck },
              { id: 'lots', label: 'Received Lots', icon: CheckCircle },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* PO Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  Purchase Order Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">PO Number</dt>
                    <dd className="font-medium">{po.poNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd>
                      <Badge variant={getStatusVariant(po.status)} dot>
                        {getStatusLabel(po.status)}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Order Date</dt>
                    <dd className="font-medium">{formatDate(po.orderDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Expected Date</dt>
                    <dd className="font-medium">{formatDate(po.expectedDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Total Amount</dt>
                    <dd className="font-medium text-lg text-blue-600">
                      ฿{summary.totalAmount?.toLocaleString() || 0}
                    </dd>
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
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  Vendor Information
                </CardTitle>
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
                    <dt className="text-sm text-gray-500 flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> Contact
                    </dt>
                    <dd className="font-medium">{po.vendorContact || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </dt>
                    <dd className="font-medium">{po.vendorPhone || '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </dt>
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
                <p className="text-gray-700 whitespace-pre-wrap">{po.notes || 'No notes'}</p>
              </CardContent>
            </Card>

            {/* Audit Info */}
            <Card className="lg:col-span-2">
              <CardContent className="!py-4">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm text-gray-500">
                  <span>Created: {formatDateTime(po.createdAt)}</span>
                  <span>Last Updated: {formatDateTime(po.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'lines' && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-gray-400" />
                Order Lines ({lines.length})
              </CardTitle>
            </CardHeader>
            <div className="p-4 sm:p-6">
              <Table
                columns={linesColumns}
                data={lines}
                keyField="id"
                emptyMessage="No order lines"
              />
            </div>
          </Card>
        )}

        {activeTab === 'receiving' && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-gray-400" />
                  Goods Receiving
                </CardTitle>
                {summary.totalPending > 0 && (
                  <Badge variant="warning">
                    {summary.totalPending} units pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <div className="p-4 sm:p-6">
              <Table
                columns={receivingColumns}
                data={lines}
                keyField="id"
                emptyMessage="No items to receive"
              />
            </div>
          </Card>
        )}

        {activeTab === 'lots' && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-gray-400" />
                Received Lots ({receivedLots.length})
              </CardTitle>
            </CardHeader>
            <div className="p-4 sm:p-6">
              <Table
                columns={lotsColumns}
                data={receivedLots}
                keyField="id"
                emptyMessage="No lots received yet"
                onRowClick={(lot) => router.push(`/inventory/lots/${lot.id}`)}
              />
            </div>
          </Card>
        )}

        {/* Receive Modal */}
        <Dialog open={showReceiveModal && !!selectedLine} onOpenChange={setShowReceiveModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                Receive Goods
              </DialogTitle>
              <DialogDescription>
                Record received goods from purchase order {data?.purchaseOrder.poNumber}
              </DialogDescription>
            </DialogHeader>

            {selectedLine && (
              <div className="flex-1 overflow-y-auto space-y-6">
                {/* Item Information Card */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Item Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Item Code</p>
                      <p className="font-semibold text-gray-900">{selectedLine.itemCode}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500">Item Name</p>
                      <p className="font-medium text-gray-900">{selectedLine.itemName}</p>
                      {selectedLine.itemNameEn && (
                        <p className="text-xs text-gray-500">{selectedLine.itemNameEn}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Unit</p>
                      <p className="font-medium text-gray-900">{selectedLine.itemUnit}</p>
                    </div>
                  </div>
                </div>

                {/* Order & Receiving Status */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1">Ordered Qty</p>
                    <p className="text-lg font-bold text-blue-700">
                      {selectedLine.quantity.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-500">{selectedLine.itemUnit}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs text-green-600 mb-1">Already Received</p>
                    <p className="text-lg font-bold text-green-700">
                      {(selectedLine.receivedQty || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-green-500">{selectedLine.itemUnit}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-xs text-orange-600 mb-1">Pending Qty</p>
                    <p className="text-lg font-bold text-orange-700">
                      {selectedLine.pendingQty.toLocaleString()}
                    </p>
                    <p className="text-xs text-orange-500">{selectedLine.itemUnit}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Unit Price</p>
                    <p className="text-lg font-bold text-gray-700">
                      ฿{(selectedLine.unitPrice || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">per {selectedLine.itemUnit}</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Warehouse Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <Warehouse className="h-4 w-4 text-gray-400" />
                      Warehouse <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={receiveForm.warehouseId}
                      onChange={(e) => setReceiveForm({ ...receiveForm, warehouseId: e.target.value })}
                      disabled={loadingWarehouses}
                    >
                      <option value="">-- Select warehouse --</option>
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.code} - {wh.name}
                        </option>
                      ))}
                    </Select>
                    {warehouses.length === 0 && !loadingWarehouses && (
                      <p className="text-xs text-red-500 mt-1">No active warehouses available</p>
                    )}
                  </div>

                  {/* Lot Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <Hash className="h-4 w-4 text-gray-400" />
                      Lot Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={receiveForm.lotNumber}
                      onChange={(e) => setReceiveForm({ ...receiveForm, lotNumber: e.target.value })}
                      placeholder="Enter lot number"
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <Scale className="h-4 w-4 text-gray-400" />
                      Receiving Quantity ({selectedLine.itemUnit}) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      value={receiveForm.quantity}
                      onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                      max={selectedLine.pendingQty}
                      min={0}
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum receivable: <span className="font-medium">{selectedLine.pendingQty.toLocaleString()} {selectedLine.itemUnit}</span>
                    </p>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      Expiry Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      value={receiveForm.expiryDate}
                      onChange={(value) => setReceiveForm({ ...receiveForm, expiryDate: value })}
                      min={new Date().toISOString().split('T')[0]}
                      showQuickActions={false}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Summary */}
                {receiveForm.quantity && parseFloat(receiveForm.quantity) > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Receiving Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">This Receipt</p>
                        <p className="font-bold text-emerald-600">
                          {parseFloat(receiveForm.quantity).toLocaleString()} {selectedLine.itemUnit}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total After Receipt</p>
                        <p className="font-bold">
                          {((selectedLine.receivedQty || 0) + parseFloat(receiveForm.quantity)).toLocaleString()} / {selectedLine.quantity.toLocaleString()} {selectedLine.itemUnit}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Remaining After</p>
                        <p className="font-bold text-orange-600">
                          {(selectedLine.pendingQty - parseFloat(receiveForm.quantity)).toLocaleString()} {selectedLine.itemUnit}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-4 border-t mt-4">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowReceiveModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={submitReceive}
                disabled={isSubmitting || !receiveForm.quantity || !receiveForm.expiryDate || !receiveForm.warehouseId || !receiveForm.lotNumber}
                loading={isSubmitting}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirm Receipt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
