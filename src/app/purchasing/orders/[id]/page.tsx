'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  Send, Package, DollarSign, AlertTriangle,
  Clock, CheckCircle, AlertCircle, Truck, FileText,
  Building2, User, Phone, Mail,
  Edit2, Trash2,
  PackageCheck, XCircle, FileCheck, Receipt, ExternalLink, FileSpreadsheet,
} from 'lucide-react';
import { DocumentAttachment } from '@/components/ui/document-attachment';
import { AuditLogViewerDialog } from '@/components/shared/AuditLogViewerDialog';
import { useCurrentUser } from '@/hooks/use-current-user';
import { POPrintDocument } from '@/components/purchasing/po-print-document';
import { thaiBahtText } from '@/lib/utils/thai-baht-text';

// VAT rate for Thailand (7%)
const VAT_RATE = 0.07;

// Roles that can submit a Draft PO (→ pending_approval)
const PO_SUBMIT_ROLES = ['PROCUREMENT', 'PROCUREMENT_MANAGER', 'admin', 'manager', 'purchasing'];

// Roles that can approve a Submitted PO (→ approved)
const PO_APPROVE_ROLES = ['PROCUREMENT_MANAGER', 'admin', 'manager'];

// Step bar — maps backend status → workflow step index (1..4), or -1 for cancelled
const STATUS_STEP: Record<string, number> = {
  draft: 1,
  pending_approval: 2,
  approved: 3,
  sent: 4,
  partial: 4,
  received: 4,
  cancelled: -1,
};

const WORKFLOW_STEPS: { key: string; label: string }[] = [
  { key: 'draft', label: 'ร่าง (Draft)' },
  { key: 'submitted', label: 'ส่งอนุมัติ (Submitted)' },
  { key: 'approved', label: 'อนุมัติแล้ว (Approved)' },
  { key: 'completed', label: 'เสร็จสิ้น (Completed)' },
];

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
  journalEntries?: Array<{
    id: number;
    entryNumber: string;
    status: string;
  }>;
  apInvoices?: Array<{
    id: number;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  }>;
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
  const t = useTranslations('purchasing');
  const [data, setData] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'lines' | 'receiving' | 'lots'>('overview');
  // VAT display preference, persisted across sessions per browser.
  //   'split'     — show ยอดก่อน VAT / VAT 7% / ยอดรวมสุทธิ (3 lines)
  //   'inclusive' — show only ยอดรวม (รวม VAT) (1 line)
  // Different operators prefer different views — สรรพากร reports want
  // split, while quick-glance ordering wants inclusive.
  const [vatDisplayMode, setVatDisplayMode] = useState<'split' | 'inclusive'>(() => {
    if (typeof window === 'undefined') return 'split';
    const stored = window.localStorage.getItem('po-vat-display-mode');
    return stored === 'inclusive' ? 'inclusive' : 'split';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('po-vat-display-mode', vatDisplayMode);
    }
  }, [vatDisplayMode]);

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
    vendorLotNumber: '',
    manufacturingDate: '',
    quantity: 0,
    expiryDate: '',
    warehouseId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reference data
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Delete PO state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPO, setDeletingPO] = useState(false);

  // Audit log dialog
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Current user (for role-gated Submit / Approve buttons)
  const { data: currentUser } = useCurrentUser();
  const userRole = currentUser?.role || '';
  const canSubmit = PO_SUBMIT_ROLES.includes(userRole);
  const canApprove = PO_APPROVE_ROLES.includes(userRole);

  // Status transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

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
    // Auto-generate lot number: [ItemCode]-[YYMMDD]-[Running]
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const running = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const autoLot = `${line.itemCode}-${yy}${mm}${dd}-${running}`;

    setReceiveForm({
      lotNumber: autoLot,
      vendorLotNumber: '',
      manufacturingDate: '',
      quantity: line.pendingQty,
      expiryDate: '',
      warehouseId: warehouses.length > 0 ? warehouses[0].id.toString() : '',
    });
    setShowReceiveModal(true);
  };

  const submitReceive = async () => {
    if (!selectedLine || !receiveForm.quantity || !receiveForm.expiryDate || !receiveForm.warehouseId || !receiveForm.vendorLotNumber || !receiveForm.manufacturingDate) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId: selectedLine.id,
          lotNumber: receiveForm.lotNumber,
          vendorLotNumber: receiveForm.vendorLotNumber,
          manufacturingDate: receiveForm.manufacturingDate,
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

  // Transition PO status (Submit / Approve)
  const transitionStatus = async (nextStatus: 'pending_approval' | 'approved', confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setIsTransitioning(true);
    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (result.success) {
        fetchPODetail();
      } else {
        alert(result.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to transition status:', error);
      alert('Failed to update status');
    } finally {
      setIsTransitioning(false);
    }
  };

  // Delete PO
  const handleDeletePO = async () => {
    setDeletingPO(true);
    try {
      const response = await fetch(`/api/purchasing/orders/${params.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setShowDeleteModal(false);
        router.push('/purchasing/orders');
      } else {
        alert(result.error || 'Failed to delete PO');
      }
    } catch {
      alert('Failed to delete PO');
    } finally {
      setDeletingPO(false);
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
    {
      dataField: 'journalEntries',
      caption: 'รายการบัญชี',
      width: 150,
      cellRender: (cellInfo) => {
        const journalEntries = cellInfo.data.journalEntries || [];
        if (journalEntries.length === 0) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {journalEntries.map((je: { id: number; entryNumber: string; status: string }) => (
              <button
                key={je.id}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/accounting/journal-entries?id=${je.id}`);
                }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <Receipt className="h-3 w-3" />
                <span>{je.entryNumber}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            ))}
          </div>
        );
      },
    },
    {
      dataField: 'apInvoices',
      caption: 'ใบแจ้งหนี้ AP',
      width: 150,
      cellRender: (cellInfo) => {
        const apInvoices = cellInfo.data.apInvoices || [];
        if (apInvoices.length === 0) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {apInvoices.map((ap: { id: number; invoiceNumber: string; status: string; totalAmount: number }) => (
              <button
                key={ap.id}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/accounting/ap/invoices?id=${ap.id}`);
                }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span>{ap.invoiceNumber}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <>
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
      </>
    );
  }

  if (!data) {
    return (
      <>
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
      </>
    );
  }

  const { purchaseOrder: po, lines, receivedLots, summary } = data;
  const statusConfig = getStatusConfig(po.status);

  // Financial summary (dynamically recomputed from current lines)
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0);
  const vatAmount = subtotal * VAT_RATE;
  const grandTotal = subtotal + vatAmount;

  // Workflow step (1..4 or -1 for cancelled)
  const currentStep = STATUS_STEP[po.status] ?? 1;
  const isCancelled = currentStep === -1;

  return (
    <>
      {/* Printable PO document — hidden on screen, shown only when printing */}
      <POPrintDocument
        data={{
          poNumber: po.poNumber,
          statusTh: statusConfig.labelTh,
          vendorName: po.vendorName,
          vendorCode: po.vendorCode,
          vendorContact: po.vendorContact,
          vendorPhone: po.vendorPhone,
          vendorEmail: po.vendorEmail,
          orderDate: po.orderDate,
          expectedDate: po.expectedDate,
          paymentTerms: po.paymentTerms,
          shippingAddress: po.shippingAddress,
          notes: po.notes,
          lines: lines.map((l) => ({
            id: l.id,
            itemCode: l.itemCode,
            itemName: l.itemName,
            itemNameEn: l.itemNameEn,
            quantity: Number(l.quantity) || 0,
            unit: l.unit,
            itemUnit: l.itemUnit,
            unitPrice: Number(l.unitPrice) || 0,
            lineTotal: Number(l.lineTotal) || 0,
          })),
          subtotal,
          vatAmount,
          grandTotal,
          grandTotalText: thaiBahtText(grandTotal),
        }}
      />
      <div className="space-y-4 no-print">
        {/* Header */}
        <PageHeader
          title={`${t('orders.detail.title')}: ${po.poNumber}`}
          description={`${t('orders.detail.vendor')}: ${po.vendorName} • ${t('orders.detail.status')}: ${statusConfig.labelTh}`}
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
                icon="clock"
                type="normal"
                stylingMode="outlined"
                hint="ประวัติการเปลี่ยนแปลง"
                onClick={() => setShowAuditLog(true)}
              />
              <DxButton
                text="พิมพ์"
                icon="print"
                type="normal"
                stylingMode="outlined"
                onClick={() => window.print()}
              />
              {po.status === 'draft' && (
                <DxButton
                  text="ลบใบ PO"
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => setShowDeleteModal(true)}
                  data-testid="delete-po-btn"
                />
              )}
              {po.status === 'draft' && canSubmit && (
                <DxButton
                  text={isTransitioning ? 'กำลังส่ง...' : 'ส่งอนุมัติ (Submit)'}
                  icon="upload"
                  type="default"
                  stylingMode="contained"
                  disabled={isTransitioning || lines.length === 0}
                  onClick={() => transitionStatus('pending_approval', `ต้องการส่ง PO ${po.poNumber} เพื่อขออนุมัติ?`)}
                  data-testid="po-submit-btn"
                />
              )}
              {po.status === 'pending_approval' && canApprove && (
                <DxButton
                  text={isTransitioning ? 'กำลังอนุมัติ...' : 'อนุมัติ (Approve)'}
                  icon="check"
                  type="success"
                  stylingMode="contained"
                  disabled={isTransitioning}
                  onClick={() => transitionStatus('approved', `ยืนยันอนุมัติ PO ${po.poNumber}?`)}
                  data-testid="po-approve-btn"
                />
              )}
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

        {/* Workflow Step Bar */}
        <Card className="!p-4">
          {isCancelled ? (
            <div className="flex items-center justify-center gap-2 py-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="font-semibold">PO ถูกยกเลิก (Cancelled)</span>
            </div>
          ) : (
            <div className="flex items-center" data-testid="po-workflow-steps">
              {WORKFLOW_STEPS.map((step, idx) => {
                const stepNum = idx + 1;
                const isDone = stepNum < currentStep;
                const isActive = stepNum === currentStep;
                return (
                  <div key={step.key} className="flex items-center flex-1 last:flex-initial">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'flex items-center justify-center w-9 h-9 rounded-full border-2 font-semibold text-sm transition-colors',
                          isDone && 'bg-green-500 border-green-500 text-white',
                          isActive && 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100',
                          !isDone && !isActive && 'bg-white border-gray-300 text-gray-400'
                        )}
                      >
                        {isDone ? <CheckCircle className="h-5 w-5" /> : stepNum}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium text-center whitespace-nowrap',
                          isActive && 'text-blue-600',
                          isDone && 'text-green-600',
                          !isDone && !isActive && 'text-gray-400'
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <div
                        className={cn(
                          'flex-1 h-0.5 mx-2 mb-5 transition-colors',
                          isDone ? 'bg-green-500' : 'bg-gray-200'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="!p-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-xs text-gray-500">
                    {vatDisplayMode === 'split' ? 'ยอดรวมสุทธิ (รวม VAT)' : 'ยอดรวม (รวม VAT)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setVatDisplayMode((m) => (m === 'split' ? 'inclusive' : 'split'))}
                    className="text-[10px] text-gray-500 hover:text-blue-600 underline decoration-dotted"
                    title="สลับโหมดแสดง VAT"
                  >
                    {vatDisplayMode === 'split' ? 'รวม VAT' : 'แยก VAT'}
                  </button>
                </div>
                <p className="text-lg font-bold text-blue-600" data-testid="po-card-grand-total">
                  {formatCurrency(grandTotal)}
                </p>
                {vatDisplayMode === 'split' && (
                  <p className="text-[11px] text-gray-500 leading-tight">
                    ก่อน VAT <span className="font-medium text-gray-700" data-testid="po-card-subtotal">{formatCurrency(subtotal)}</span>
                    {' '}· VAT {(VAT_RATE * 100).toFixed(0)}% <span className="font-medium text-gray-700" data-testid="po-card-vat">{formatCurrency(vatAmount)}</span>
                  </p>
                )}
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
                      type="normal"
                      stylingMode="text"
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
                          {vatDisplayMode === 'split' ? (
                            <>
                              <div>
                                <dt className="text-gray-500">ยอดก่อน VAT (Subtotal)</dt>
                                <dd className="font-medium text-gray-900">{formatCurrency(subtotal)}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-500">VAT {(VAT_RATE * 100).toFixed(0)}%</dt>
                                <dd className="font-medium text-gray-900">{formatCurrency(vatAmount)}</dd>
                              </div>
                              <div>
                                <dt className="text-gray-500">ยอดรวมสุทธิ (รวม VAT)</dt>
                                <dd className="font-bold text-blue-600">{formatCurrency(grandTotal)}</dd>
                              </div>
                            </>
                          ) : (
                            <div>
                              <dt className="text-gray-500">ยอดรวม (รวม VAT)</dt>
                              <dd className="font-bold text-blue-600">{formatCurrency(grandTotal)}</dd>
                            </div>
                          )}
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

                {/* Document Attachments */}
                <DocumentAttachment
                  moduleName="purchase_order"
                  entityId={po.id}
                  title="เอกสารแนบ"
                  categories={['quotation', 'invoice', 'delivery_note', 'coa', 'purchase_contract', 'certificate', 'other']}
                />

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

                {/* Summary Block — toggles with vatDisplayMode */}
                {lines.length > 0 && (
                  <div className="flex justify-end" data-testid="po-summary-block">
                    <div className="w-full md:w-96 border rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-1.5 bg-gray-100 border-b">
                        <span className="text-[11px] text-gray-500">โหมดแสดง</span>
                        <div className="inline-flex rounded-md overflow-hidden border border-gray-300 bg-white">
                          <button
                            type="button"
                            onClick={() => setVatDisplayMode('split')}
                            className={`px-2.5 py-1 text-[11px] ${vatDisplayMode === 'split' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            แยก VAT
                          </button>
                          <button
                            type="button"
                            onClick={() => setVatDisplayMode('inclusive')}
                            className={`px-2.5 py-1 text-[11px] border-l border-gray-300 ${vatDisplayMode === 'inclusive' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            รวม VAT
                          </button>
                        </div>
                      </div>
                      {vatDisplayMode === 'split' && (
                        <>
                          <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b">
                            <span className="text-sm text-gray-600">ยอดรวม (Subtotal)</span>
                            <span className="font-medium text-gray-900" data-testid="po-subtotal">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center px-4 py-2.5 bg-white border-b">
                            <span className="text-sm text-gray-600">
                              ภาษีมูลค่าเพิ่ม (VAT {(VAT_RATE * 100).toFixed(0)}%)
                            </span>
                            <span className="font-medium text-gray-900" data-testid="po-vat">
                              {formatCurrency(vatAmount)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center px-4 py-3 bg-blue-50">
                        <span className="text-sm font-semibold text-blue-900">
                          {vatDisplayMode === 'split' ? 'ยอดสุทธิ (Grand Total)' : 'ยอดรวม (รวม VAT)'}
                        </span>
                        <span className="text-lg font-bold text-blue-700" data-testid="po-grand-total">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                  setLineForm(prev => ({ ...prev, itemId: v, unit: item?.unitName || prev.unit }));
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
                  onValueChange={(v) => setLineForm(prev => ({ ...prev, quantity: v || 0 }))}
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
                onValueChange={(v) => setLineForm(prev => ({ ...prev, unitPrice: v || 0 }))}
                min={0}
                step={0.01}
                format="#,##0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
              <DxTextArea
                value={lineForm.notes}
                onValueChange={(v) => setLineForm(prev => ({ ...prev, notes: v }))}
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
                      จำนวนที่รับ <span className="text-red-500">*</span>
                    </label>
                    <DxNumberBox
                      value={receiveForm.quantity}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, quantity: v || 0 })}
                      min={0}
                      max={selectedLine.pendingQty}
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
                  <p className="text-sm font-semibold text-blue-800 mb-2">ข้อมูล Lot จาก Supplier</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vendor Lot No. <span className="text-red-500">*</span>
                      </label>
                      <DxTextBox
                        value={receiveForm.vendorLotNumber}
                        onValueChange={(v) => setReceiveForm({ ...receiveForm, vendorLotNumber: v })}
                        placeholder="เลข Lot/Batch จาก Supplier"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        วันผลิต (Mfg Date) <span className="text-red-500">*</span>
                      </label>
                      <DxDateBox
                        value={receiveForm.manufacturingDate}
                        onValueChange={(v) => setReceiveForm({ ...receiveForm, manufacturingDate: v || '' })}
                        max={new Date()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        วันหมดอายุ (Exp Date) <span className="text-red-500">*</span>
                      </label>
                      <DxDateBox
                        value={receiveForm.expiryDate}
                        onValueChange={(v) => setReceiveForm({ ...receiveForm, expiryDate: v || '' })}
                        min={receiveForm.manufacturingDate ? new Date(receiveForm.manufacturingDate) : new Date()}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mt-2">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Lot ในระบบ (Auto-generate)</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      System Lot Number
                    </label>
                    <DxTextBox
                      value={receiveForm.lotNumber}
                      onValueChange={(v) => setReceiveForm({ ...receiveForm, lotNumber: v })}
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">ระบบสร้างอัตโนมัติ: [ItemCode]-[YYMMDD]-[Running]</p>
                  </div>
                </div>

                {(!receiveForm.vendorLotNumber || !receiveForm.manufacturingDate || !receiveForm.expiryDate) && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    กรุณากรอกให้ครบ: Vendor Lot No., วันผลิต, วันหมดอายุ
                  </div>
                )}

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
                    disabled={isSubmitting || !receiveForm.quantity || !receiveForm.expiryDate || !receiveForm.warehouseId || !receiveForm.vendorLotNumber || !receiveForm.manufacturingDate}
                    width="50%"
                  />
                </div>
              </div>
            )}
          </div>
        </DxPopup>

        {/* Delete PO Modal */}
        <DxPopup
          visible={showDeleteModal}
          onHiding={() => setShowDeleteModal(false)}
          title="ลบใบสั่งซื้อ (Delete PO)"
          width={400}
          height={220}
          showCloseButton={true}
        >
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              คุณต้องการลบใบสั่งซื้อ <strong>{po.poNumber}</strong> ใช่หรือไม่? การลบจะไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-2 justify-end mt-6">
              <DxButton
                text="ปิด"
                type="normal"
                onClick={() => setShowDeleteModal(false)}
              />
              <DxButton
                text={deletingPO ? 'กำลังลบ...' : 'ยืนยันลบ'}
                type="danger"
                stylingMode="contained"
                icon="trash"
                onClick={handleDeletePO}
                disabled={deletingPO}
                data-testid="confirm-delete-po-btn"
              />
            </div>
          </div>
        </DxPopup>

        {/* Audit Log Dialog */}
        <AuditLogViewerDialog
          entityType="purchaseOrders"
          entityId={po.id}
          visible={showAuditLog}
          onClose={() => setShowAuditLog(false)}
          title={`ประวัติการเปลี่ยนแปลง: ${po.poNumber}`}
          fieldLabels={{
            vendorId: 'ผู้ขาย',
            status: 'สถานะ',
            orderDate: 'วันที่สั่งซื้อ',
            expectedDate: 'วันที่คาดว่าจะได้รับ',
            paymentTerms: 'เงื่อนไขการชำระ',
            shippingAddress: 'ที่อยู่จัดส่ง',
            notes: 'หมายเหตุ',
            totalAmount: 'ยอดรวม',
          }}
        />
      </div>
    </>
  );
}
