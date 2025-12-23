'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils/cn';
import {
  ArrowLeft, Printer, Send, Package, DollarSign,
  Clock, CheckCircle, AlertCircle, Truck, FileText,
  Building2, User, Phone, Mail, Warehouse, Calendar,
  Hash, Scale, Tag, Edit2, Save, X, Plus, Trash2,
  RefreshCw, PackageCheck, XCircle, FileCheck,
} from 'lucide-react';

interface WarehouseItem {
  id: number;
  code: string;
  name: string;
}

interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  unitName: string;
}

interface Vendor {
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
  unit?: string;
  notes?: string;
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
    paymentTerms: string;
    shippingAddress: string;
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

// Status configuration
type POStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partial' | 'received' | 'cancelled';

const STATUS_CONFIG: Record<POStatus, {
  label: string;
  labelTh: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default';
}> = {
  draft: {
    label: 'Draft',
    labelTh: 'ร่าง',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    icon: <FileText className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  pending_approval: {
    label: 'Pending Approval',
    labelTh: 'รออนุมัติ',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  approved: {
    label: 'Approved',
    labelTh: 'อนุมัติแล้ว',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  sent: {
    label: 'Sent to Vendor',
    labelTh: 'ส่งแล้ว',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: <Send className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  partial: {
    label: 'Partial Received',
    labelTh: 'รับบางส่วน',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    icon: <Package className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  received: {
    label: 'Received',
    labelTh: 'รับครบแล้ว',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    icon: <PackageCheck className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'ร่าง' },
  { value: 'pending_approval', label: 'รออนุมัติ' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'sent', label: 'ส่งให้ผู้ขาย' },
  { value: 'partial', label: 'รับบางส่วน' },
  { value: 'received', label: 'รับครบแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'lines' | 'receiving' | 'lots'>('overview');

  // Edit states
  const [isEditingPO, setIsEditingPO] = useState(false);
  const [editPOForm, setEditPOForm] = useState({
    vendorId: 0,
    status: '',
    orderDate: '',
    expectedDate: '',
    paymentTerms: '',
    shippingAddress: '',
    notes: '',
  });
  const [isSavingPO, setIsSavingPO] = useState(false);

  // Line edit states
  const [showLineModal, setShowLineModal] = useState(false);
  const [editingLine, setEditingLine] = useState<POLine | null>(null);
  const [lineForm, setLineForm] = useState({
    itemId: 0,
    quantity: 0,
    unit: '',
    unitPrice: 0,
    notes: '',
  });
  const [isSavingLine, setIsSavingLine] = useState(false);

  // Receiving states
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<POLine | null>(null);
  const [receiveForm, setReceiveForm] = useState({
    lotNumber: '',
    quantity: 0,
    expiryDate: '',
    warehouseId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reference data
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const fetchPODetail = useCallback(async () => {
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
  }, [params.id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [whRes, vendorRes, itemRes] = await Promise.all([
        fetch('/api/warehouses?status=active&limit=100'),
        fetch('/api/vendors?limit=100'),
        fetch('/api/items?limit=500'),
      ]);

      const [whData, vendorData, itemData] = await Promise.all([
        whRes.json(),
        vendorRes.json(),
        itemRes.json(),
      ]);

      if (whData.success) setWarehouses(whData.data?.items || whData.data || []);
      if (vendorData.success) setVendors(vendorData.data?.items || vendorData.data || []);
      if (itemData.success) setItems(itemData.data?.items || itemData.data || []);
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    }
  }, []);

  useEffect(() => {
    fetchPODetail();
    fetchReferenceData();
  }, [fetchPODetail, fetchReferenceData]);

  // Start editing PO
  const startEditPO = () => {
    if (!data) return;
    const po = data.purchaseOrder;
    setEditPOForm({
      vendorId: po.vendorId,
      status: po.status,
      orderDate: po.orderDate ? po.orderDate.split('T')[0] : '',
      expectedDate: po.expectedDate ? po.expectedDate.split('T')[0] : '',
      paymentTerms: po.paymentTerms || '',
      shippingAddress: po.shippingAddress || '',
      notes: po.notes || '',
    });
    setIsEditingPO(true);
  };

  // Save PO changes
  const savePOChanges = async () => {
    setIsSavingPO(true);
    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPOForm),
      });
      const result = await response.json();
      if (result.success) {
        setIsEditingPO(false);
        fetchPODetail();
      } else {
        alert(result.error || 'Failed to save changes');
      }
    } catch (error) {
      console.error('Failed to save PO:', error);
      alert('Failed to save changes');
    } finally {
      setIsSavingPO(false);
    }
  };

  // Open line modal for add/edit
  const openLineModal = (line?: POLine) => {
    if (line) {
      setEditingLine(line);
      setLineForm({
        itemId: line.itemId,
        quantity: line.quantity,
        unit: line.unit || line.itemUnit || '',
        unitPrice: line.unitPrice,
        notes: line.notes || '',
      });
    } else {
      setEditingLine(null);
      setLineForm({
        itemId: 0,
        quantity: 0,
        unit: '',
        unitPrice: 0,
        notes: '',
      });
    }
    setShowLineModal(true);
  };

  // Save line
  const saveLine = async () => {
    if (!lineForm.itemId || !lineForm.quantity || !lineForm.unitPrice) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSavingLine(true);
    try {
      const url = `/api/purchasing/orders/${params.id}/lines`;
      const method = editingLine ? 'PUT' : 'POST';
      const body = editingLine
        ? { lineId: editingLine.id, ...lineForm }
        : lineForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        setShowLineModal(false);
        setEditingLine(null);
        fetchPODetail();
      } else {
        alert(result.error || 'Failed to save line');
      }
    } catch (error) {
      console.error('Failed to save line:', error);
      alert('Failed to save line');
    } finally {
      setIsSavingLine(false);
    }
  };

  // Delete line
  const deleteLine = async (lineId: number) => {
    if (!confirm('Are you sure you want to delete this line?')) return;

    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}/lines?lineId=${lineId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        fetchPODetail();
      } else {
        alert(result.error || 'Failed to delete line');
      }
    } catch (error) {
      console.error('Failed to delete line:', error);
      alert('Failed to delete line');
    }
  };

  // Handle receive
  const handleReceive = (line: POLine) => {
    setSelectedLine(line);
    setReceiveForm({
      lotNumber: `LOT-${Date.now()}`,
      quantity: line.pendingQty,
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
          quantity: receiveForm.quantity,
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as POStatus] || STATUS_CONFIG.draft;
  };

  const isEditable = data?.purchaseOrder?.status === 'draft' || data?.purchaseOrder?.status === 'pending_approval';

  // Order Lines columns
  const linesColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'รายการสินค้า',
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{cellInfo.data.itemCode}</p>
            <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
          </div>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 120,
      cellRender: (cellInfo) => (
        <span className="font-medium">
          {cellInfo.data.quantity.toLocaleString()} {cellInfo.data.itemUnit}
        </span>
      ),
    },
    {
      dataField: 'unitPrice',
      caption: 'ราคา/หน่วย',
      width: 120,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.unitPrice),
    },
    {
      dataField: 'lineTotal',
      caption: 'รวม',
      width: 130,
      cellRender: (cellInfo) => (
        <span className="font-semibold text-blue-600">
          {formatCurrency(cellInfo.data.lineTotal)}
        </span>
      ),
    },
    {
      dataField: 'receivedQty',
      caption: 'รับแล้ว',
      width: 140,
      cellRender: (cellInfo) => {
        const received = cellInfo.data.receivedQty || 0;
        const ordered = cellInfo.data.quantity;
        const percentage = ordered > 0 ? (received / ordered) * 100 : 0;
        return (
          <div>
            <span className={cn(
              'font-medium',
              received >= ordered ? 'text-green-600' : received > 0 ? 'text-orange-600' : 'text-gray-500'
            )}>
              {received} / {ordered}
            </span>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  percentage >= 100 ? 'bg-green-500' : percentage > 0 ? 'bg-orange-500' : 'bg-gray-300'
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'receivingStatus',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => {
        const status = cellInfo.data.receivingStatus;
        const variant = status === 'complete' ? 'success' : status === 'partial' ? 'info' : 'default';
        return <Badge variant={variant}>{status || 'pending'}</Badge>;
      },
    },
    {
      dataField: 'actions',
      caption: '',
      width: 100,
      visible: isEditable,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openLineModal(cellInfo.data); }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteLine(cellInfo.data.id); }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // Receiving columns
  const receivingColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'รายการ',
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'สั่งซื้อ',
      width: 100,
      cellRender: (cellInfo) => `${cellInfo.data.quantity.toLocaleString()} ${cellInfo.data.itemUnit}`,
    },
    {
      dataField: 'receivedQty',
      caption: 'รับแล้ว',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="text-green-600 font-medium">
          {cellInfo.data.receivedQty || 0}
        </span>
      ),
    },
    {
      dataField: 'pendingQty',
      caption: 'คงเหลือ',
      width: 100,
      cellRender: (cellInfo) => (
        <span className={cellInfo.data.pendingQty > 0 ? 'text-orange-600 font-medium' : ''}>
          {cellInfo.data.pendingQty}
        </span>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 120,
      cellRender: (cellInfo) => (
        cellInfo.data.pendingQty > 0 ? (
          <DxButton
            text="รับสินค้า"
            icon="box"
            type="success"
            stylingMode="outlined"
            onClick={() => handleReceive(cellInfo.data)}
          />
        ) : (
          <Badge variant="success">ครบแล้ว</Badge>
        )
      ),
    },
  ];

  // Received Lots columns
  const lotsColumns: DxDataGridColumn[] = [
    {
      dataField: 'lotNumber',
      caption: 'เลข Lot',
      cellRender: (cellInfo) => (
        <span className="font-medium text-blue-600 cursor-pointer hover:underline">
          {cellInfo.data.lotNumber}
        </span>
      ),
    },
    {
      dataField: 'itemCode',
      caption: 'รายการ',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 100,
      cellRender: (cellInfo) => cellInfo.data.quantity.toLocaleString(),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => {
        const status = cellInfo.data.status;
        const variant = status === 'released' ? 'success' : status === 'quarantine' ? 'warning' : 'default';
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    {
      dataField: 'expiryDate',
      caption: 'วันหมดอายุ',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.expiryDate),
    },
    {
      dataField: 'receivedDate',
      caption: 'วันที่รับ',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.receivedDate),
    },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
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
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">ไม่พบข้อมูล Purchase Order</p>
          <DxButton
            text="กลับไปหน้ารายการ"
            icon="back"
            type="normal"
            stylingMode="outlined"
            onClick={() => router.push('/purchasing/orders')}
          />
        </div>
      </MainLayout>
    );
  }

  const { purchaseOrder: po, lines, receivedLots, summary } = data;
  const statusConfig = getStatusConfig(po.status);

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <span>PO: {po.poNumber}</span>
              <Badge variant={statusConfig.badgeVariant} className="text-sm">
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.labelTh}</span>
              </Badge>
            </div>
          }
          description={`ผู้ขาย: ${po.vendorName}`}
          backButton={
            <DxButton
              icon="back"
              type="normal"
              stylingMode="text"
              onClick={() => router.push('/purchasing/orders')}
            />
          }
          actions={
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="outlined"
                hint="รีเฟรช"
                onClick={() => fetchPODetail()}
              />
              <DxButton
                text="พิมพ์"
                icon="print"
                type="normal"
                stylingMode="outlined"
                onClick={() => window.print()}
              />
              {po.status === 'approved' && (
                <DxButton
                  text="ส่งให้ผู้ขาย"
                  icon="email"
                  type="success"
                />
              )}
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">ยอดรวม</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalAmount)}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Package className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">สั่งซื้อ</p>
                <p className="text-lg font-bold">{summary.totalOrdered?.toLocaleString() || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">รับแล้ว</p>
                <p className="text-lg font-bold text-green-600">{summary.totalReceived?.toLocaleString() || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">คงเหลือ</p>
                <p className="text-lg font-bold text-orange-600">{summary.totalPending?.toLocaleString() || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">ความคืบหน้า</p>
                <p className="text-lg font-bold">{summary.receivingProgress || 0}%</p>
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
        <Card elevation="raised" className="overflow-hidden">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex gap-1 px-4 min-w-max">
              {[
                { id: 'overview', label: 'ข้อมูลทั่วไป', icon: FileText },
                { id: 'lines', label: `รายการสินค้า (${lines.length})`, icon: Package },
                { id: 'receiving', label: 'รับสินค้า', icon: Truck },
                { id: 'lots', label: `Lot ที่รับ (${receivedLots.length})`, icon: FileCheck },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <CardContent className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Edit Actions */}
                <div className="flex justify-end gap-2">
                  {isEditingPO ? (
                    <>
                      <DxButton
                        text="ยกเลิก"
                        icon="close"
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => setIsEditingPO(false)}
                        disabled={isSavingPO}
                      />
                      <DxButton
                        text={isSavingPO ? 'กำลังบันทึก...' : 'บันทึก'}
                        icon="save"
                        type="success"
                        onClick={savePOChanges}
                        disabled={isSavingPO}
                      />
                    </>
                  ) : isEditable ? (
                    <DxButton
                      text="แก้ไขข้อมูล"
                      icon="edit"
                      type="default"
                      onClick={startEditPO}
                    />
                  ) : null}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* PO Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        ข้อมูล Purchase Order
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isEditingPO ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                              <DxSelectBox
                                items={STATUS_OPTIONS}
                                value={editPOForm.status}
                                onValueChange={(v) => setEditPOForm({ ...editPOForm, status: v })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ขาย</label>
                              <DxSelectBox
                                items={vendors.map((v) => ({ value: v.id, label: `${v.code} - ${v.name}` }))}
                                value={editPOForm.vendorId}
                                onValueChange={(v) => setEditPOForm({ ...editPOForm, vendorId: v })}
                                searchEnabled
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สั่งซื้อ</label>
                              <DxDateBox
                                value={editPOForm.orderDate}
                                onValueChange={(v) => setEditPOForm({ ...editPOForm, orderDate: v || '' })}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่คาดว่าจะได้รับ</label>
                              <DxDateBox
                                value={editPOForm.expectedDate}
                                onValueChange={(v) => setEditPOForm({ ...editPOForm, expectedDate: v || '' })}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เงื่อนไขการชำระเงิน</label>
                            <DxTextBox
                              value={editPOForm.paymentTerms}
                              onValueChange={(v) => setEditPOForm({ ...editPOForm, paymentTerms: v })}
                              placeholder="เช่น Net 30, COD"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่จัดส่ง</label>
                            <DxTextArea
                              value={editPOForm.shippingAddress}
                              onValueChange={(v) => setEditPOForm({ ...editPOForm, shippingAddress: v })}
                              height={80}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                            <DxTextArea
                              value={editPOForm.notes}
                              onValueChange={(v) => setEditPOForm({ ...editPOForm, notes: v })}
                              height={80}
                            />
                          </div>
                        </div>
                      ) : (
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <div>
                            <dt className="text-gray-500">เลขที่ PO</dt>
                            <dd className="font-semibold">{po.poNumber}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">สถานะ</dt>
                            <dd><Badge variant={statusConfig.badgeVariant}>{statusConfig.labelTh}</Badge></dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">วันที่สั่งซื้อ</dt>
                            <dd className="font-medium">{formatDate(po.orderDate)}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">วันที่คาดว่าจะได้รับ</dt>
                            <dd className="font-medium">{formatDate(po.expectedDate)}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">ยอดรวม</dt>
                            <dd className="font-bold text-blue-600">{formatCurrency(summary.totalAmount)}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">จำนวนรายการ</dt>
                            <dd className="font-medium">{summary.lineCount} รายการ</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">เงื่อนไขการชำระ</dt>
                            <dd className="font-medium">{po.paymentTerms || '-'}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-gray-500">หมายเหตุ</dt>
                            <dd className="font-medium whitespace-pre-wrap">{po.notes || '-'}</dd>
                          </div>
                        </dl>
                      )}
                    </CardContent>
                  </Card>

                  {/* Vendor Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        ข้อมูลผู้ขาย
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div>
                          <dt className="text-gray-500">รหัสผู้ขาย</dt>
                          <dd className="font-semibold">{po.vendorCode || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">ชื่อผู้ขาย</dt>
                          <dd className="font-medium">{po.vendorName || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 flex items-center gap-1">
                            <User className="h-3.5 w-3.5" /> ผู้ติดต่อ
                          </dt>
                          <dd className="font-medium">{po.vendorContact || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> โทรศัพท์
                          </dt>
                          <dd className="font-medium">{po.vendorPhone || '-'}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-gray-500 flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" /> อีเมล
                          </dt>
                          <dd className="font-medium">{po.vendorEmail || '-'}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </div>

                {/* Audit Info */}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-xs text-gray-500 pt-4 border-t">
                  <span>สร้างเมื่อ: {formatDateTime(po.createdAt)}</span>
                  <span>แก้ไขล่าสุด: {formatDateTime(po.updatedAt)}</span>
                </div>
              </div>
            )}

            {activeTab === 'lines' && (
              <div className="space-y-4">
                {isEditable && (
                  <div className="flex justify-end">
                    <DxButton
                      text="เพิ่มรายการ"
                      icon="plus"
                      type="success"
                      onClick={() => openLineModal()}
                    />
                  </div>
                )}
                <DxDataGrid
                  dataSource={lines}
                  keyExpr="id"
                  columns={linesColumns}
                  showBorders
                  height={450}
                  noDataText="ไม่มีรายการสินค้า"
                  filterRow
                  export
                  exportFileName={`PO-${po.poNumber}-lines`}
                />
              </div>
            )}

            {activeTab === 'receiving' && (
              <div className="space-y-4">
                {summary.totalPending > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-yellow-800">
                      คงเหลือรอรับ <strong>{summary.totalPending.toLocaleString()}</strong> หน่วย
                    </span>
                  </div>
                )}
                <DxDataGrid
                  dataSource={lines}
                  keyExpr="id"
                  columns={receivingColumns}
                  showBorders
                  height={450}
                  noDataText="ไม่มีรายการรอรับ"
                />
              </div>
            )}

            {activeTab === 'lots' && (
              <DxDataGrid
                dataSource={receivedLots}
                keyExpr="id"
                columns={lotsColumns}
                showBorders
                height={450}
                noDataText="ยังไม่มี Lot ที่รับเข้า"
                filterRow
                export
                exportFileName={`PO-${po.poNumber}-lots`}
                onRowClick={(e) => router.push(`/inventory/lots/${e.data.id}`)}
              />
            )}
          </CardContent>
        </Card>

        {/* Line Modal */}
        <DxPopup
          visible={showLineModal}
          onHiding={() => setShowLineModal(false)}
          title={editingLine ? 'แก้ไขรายการสินค้า' : 'เพิ่มรายการสินค้า'}
          width={600}
          height="auto"
          showCloseButton
        >
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สินค้า <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                items={items.map((item) => ({
                  value: item.id,
                  label: `${item.code} - ${item.nameTh}`,
                  unit: item.unitName,
                }))}
                value={lineForm.itemId}
                onValueChange={(v) => {
                  const item = items.find((i) => i.id === v);
                  setLineForm({ ...lineForm, itemId: v, unit: item?.unitName || '' });
                }}
                searchEnabled
                placeholder="เลือกสินค้า"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวน <span className="text-red-500">*</span>
                </label>
                <DxNumberBox
                  value={lineForm.quantity}
                  onValueChange={(v) => setLineForm({ ...lineForm, quantity: v || 0 })}
                  min={0}
                  step={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                <DxTextBox value={lineForm.unit} disabled />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ราคาต่อหน่วย <span className="text-red-500">*</span>
              </label>
              <DxNumberBox
                value={lineForm.unitPrice}
                onValueChange={(v) => setLineForm({ ...lineForm, unitPrice: v || 0 })}
                min={0}
                step={0.01}
                format="#,##0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
              <DxTextArea
                value={lineForm.notes}
                onValueChange={(v) => setLineForm({ ...lineForm, notes: v })}
                height={60}
              />
            </div>
            {lineForm.quantity > 0 && lineForm.unitPrice > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700">
                  ยอดรวม: <strong>{formatCurrency(lineForm.quantity * lineForm.unitPrice)}</strong>
                </span>
              </div>
            )}
            <div className="flex gap-3 pt-4 border-t">
              <DxButton
                text="ยกเลิก"
                type="normal"
                stylingMode="outlined"
                onClick={() => setShowLineModal(false)}
                disabled={isSavingLine}
                width="50%"
              />
              <DxButton
                text={isSavingLine ? 'กำลังบันทึก...' : 'บันทึก'}
                icon="save"
                type="success"
                onClick={saveLine}
                disabled={isSavingLine || !lineForm.itemId || !lineForm.quantity || !lineForm.unitPrice}
                width="50%"
              />
            </div>
          </div>
        </DxPopup>

        {/* Receive Modal */}
        <DxPopup
          visible={showReceiveModal && !!selectedLine}
          onHiding={() => setShowReceiveModal(false)}
          title="รับสินค้าเข้าคลัง"
          width={700}
          height="auto"
          showCloseButton
        >
          <div className="p-4">
            {selectedLine && (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">{selectedLine.itemCode}</span>
                  </div>
                  <p className="text-sm text-green-700">{selectedLine.itemName}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-xs text-blue-600 mb-1">สั่งซื้อ</p>
                    <p className="text-lg font-bold text-blue-700">{selectedLine.quantity}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-xs text-green-600 mb-1">รับแล้ว</p>
                    <p className="text-lg font-bold text-green-700">{selectedLine.receivedQty || 0}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg text-center">
                    <p className="text-xs text-orange-600 mb-1">คงเหลือ</p>
                    <p className="text-lg font-bold text-orange-700">{selectedLine.pendingQty}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      คลังสินค้า <span className="text-red-500">*</span>
                    </label>
                    <DxSelectBox
                      items={warehouses.map((wh) => ({ value: wh.id.toString(), label: `${wh.code} - ${wh.name}` }))}
                      value={receiveForm.warehouseId}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, warehouseId: v })}
                      placeholder="เลือกคลังสินค้า"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เลข Lot <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      value={receiveForm.lotNumber}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, lotNumber: v })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      จำนวนที่รับ <span className="text-red-500">*</span>
                    </label>
                    <DxNumberBox
                      value={receiveForm.quantity}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, quantity: v || 0 })}
                      min={0}
                      max={selectedLine.pendingQty}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันหมดอายุ <span className="text-red-500">*</span>
                    </label>
                    <DxDateBox
                      value={receiveForm.expiryDate}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, expiryDate: v || '' })}
                      min={new Date()}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <DxButton
                    text="ยกเลิก"
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setShowReceiveModal(false)}
                    disabled={isSubmitting}
                    width="50%"
                  />
                  <DxButton
                    text={isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับสินค้า'}
                    icon="check"
                    type="success"
                    onClick={submitReceive}
                    disabled={isSubmitting || !receiveForm.quantity || !receiveForm.expiryDate || !receiveForm.warehouseId}
                    width="50%"
                  />
                </div>
              </div>
            )}
          </div>
        </DxPopup>
      </div>
    </MainLayout>
  );
}
