'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { cn } from '@/lib/utils/cn';
import {
  ArrowLeft,
  Printer,
  DollarSign,
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  ShoppingCart,
  FileText,
  Calendar,
  Clock,
  User,
  MapPin,
  CreditCard,
  ClipboardList,
  BoxSelect,
  RefreshCw,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  TrendingUp,
  BarChart3,
  Edit,
  Eye,
  Send,
  XCircle,
  Info,
  AlertOctagon,
  ArrowRight,
  Receipt,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

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

type TabKey = 'overview' | 'lines' | 'fulfillment' | 'shipping';

// Error types for fulfillment
interface FulfillmentError {
  type: 'lot_status' | 'insufficient_qty' | 'invalid_line' | 'invalid_lot' | 'exceeds_pending' | 'unknown';
  title: string;
  message: string;
  details: {
    lotNumber?: string;
    lotStatus?: string;
    requestedQty?: number;
    availableQty?: number;
    pendingQty?: number;
  };
  suggestions: string[];
}

// Parse error message to structured error
function parseErrorMessage(errorMsg: string): FulfillmentError {
  // Lot not released error
  const lotStatusMatch = errorMsg.match(/Lot\s+([\w-]+)\s+is not released\s*\(status:\s*(\w+)\)/i);
  if (lotStatusMatch) {
    const [, lotNumber, status] = lotStatusMatch;
    const statusLabels: Record<string, string> = {
      quarantine: 'กักกัน (Quarantine)',
      blocked: 'ถูกบล็อก (Blocked)',
      rejected: 'ถูกปฏิเสธ (Rejected)',
      under_test: 'กำลังทดสอบ (Under Test)',
    };
    return {
      type: 'lot_status',
      title: 'ไม่สามารถใช้ Lot นี้ได้',
      message: `Lot ${lotNumber} ยังไม่ได้รับการปล่อย (Release) เพื่อใช้งาน`,
      details: { lotNumber, lotStatus: status },
      suggestions: [
        `Lot นี้มีสถานะ "${statusLabels[status] || status}"`,
        'กรุณาติดต่อฝ่ายควบคุมคุณภาพ (QC) เพื่อตรวจสอบและปล่อย Lot',
        'หรือเลือก Lot อื่นที่มีสถานะ "Released" แล้ว',
      ],
    };
  }

  // Insufficient quantity error
  const insufficientMatch = errorMsg.match(/Insufficient.*Available:\s*(\d+(?:\.\d+)?),\s*Requested:\s*(\d+(?:\.\d+)?)/i);
  if (insufficientMatch) {
    const available = parseFloat(insufficientMatch[1]);
    const requested = parseFloat(insufficientMatch[2]);
    return {
      type: 'insufficient_qty',
      title: 'สต็อกไม่เพียงพอ',
      message: `Lot นี้มีจำนวนสินค้าไม่เพียงพอสำหรับการจัดส่ง`,
      details: { availableQty: available, requestedQty: requested },
      suggestions: [
        `มีสินค้าพร้อมใช้: ${available.toLocaleString()} หน่วย`,
        `ต้องการ: ${requested.toLocaleString()} หน่วย`,
        'ลดจำนวนที่จะจัดส่งให้ไม่เกินจำนวนที่มี',
        'หรือเลือก Lot เพิ่มเติมเพื่อให้ครบจำนวน',
      ],
    };
  }

  // Exceeds pending quantity
  const exceedsPendingMatch = errorMsg.match(/exceeds pending quantity\s*(\d+(?:\.\d+)?)/i) ||
                              errorMsg.match(/Quantity\s*(\d+(?:\.\d+)?)\s*exceeds pending/i);
  if (exceedsPendingMatch || errorMsg.toLowerCase().includes('exceeds pending')) {
    const pendingMatch = errorMsg.match(/(\d+(?:\.\d+)?)/);
    const pending = pendingMatch ? parseFloat(pendingMatch[1]) : undefined;
    return {
      type: 'exceeds_pending',
      title: 'จำนวนเกินยอดค้างส่ง',
      message: 'จำนวนที่ต้องการจัดส่งมากกว่ายอดที่ยังค้างอยู่',
      details: { pendingQty: pending },
      suggestions: [
        pending ? `ยอดค้างส่ง: ${pending.toLocaleString()} หน่วย` : 'ตรวจสอบยอดค้างส่ง',
        'ลดจำนวนที่จะจัดส่งให้ไม่เกินยอดค้าง',
      ],
    };
  }

  // Sales order line not found
  if (errorMsg.toLowerCase().includes('line') && errorMsg.toLowerCase().includes('not found')) {
    return {
      type: 'invalid_line',
      title: 'ไม่พบรายการสินค้า',
      message: 'ไม่พบรายการสินค้าที่ระบุในใบสั่งขายนี้',
      details: {},
      suggestions: [
        'รีเฟรชหน้าและลองใหม่อีกครั้ง',
        'ตรวจสอบว่าใบสั่งขายยังมีรายการนี้อยู่หรือไม่',
      ],
    };
  }

  // Lot not found
  if (errorMsg.toLowerCase().includes('lot') && errorMsg.toLowerCase().includes('not found')) {
    return {
      type: 'invalid_lot',
      title: 'ไม่พบ Lot',
      message: 'ไม่พบ Lot ที่ระบุในระบบ',
      details: {},
      suggestions: [
        'Lot อาจถูกลบหรือใช้หมดแล้ว',
        'รีเฟรชหน้าและเลือก Lot ใหม่',
      ],
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    title: 'เกิดข้อผิดพลาด',
    message: errorMsg || 'ไม่สามารถดำเนินการได้',
    details: {},
    suggestions: [
      'ลองใหม่อีกครั้ง',
      'หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ',
    ],
  };
}

// ============================================================================
// Status Configuration
// ============================================================================

const STATUS_CONFIG: Record<string, {
  label: string;
  labelTh: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  gradient: string;
}> = {
  draft: {
    label: 'Draft',
    labelTh: 'ร่าง',
    color: '#94a3b8',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    icon: FileText,
    gradient: 'from-slate-500 to-slate-600',
  },
  confirmed: {
    label: 'Confirmed',
    labelTh: 'ยืนยันแล้ว',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: CheckCircle,
    gradient: 'from-blue-500 to-blue-600',
  },
  processing: {
    label: 'Processing',
    labelTh: 'กำลังดำเนินการ',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    icon: Clock,
    gradient: 'from-amber-500 to-amber-600',
  },
  ready: {
    label: 'Ready',
    labelTh: 'พร้อมส่ง',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Package,
    gradient: 'from-violet-500 to-violet-600',
  },
  shipped: {
    label: 'Shipped',
    labelTh: 'จัดส่งแล้ว',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: Truck,
    gradient: 'from-cyan-500 to-cyan-600',
  },
  delivered: {
    label: 'Delivered',
    labelTh: 'ส่งมอบแล้ว',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: CheckCircle,
    gradient: 'from-green-500 to-green-600',
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: AlertTriangle,
    gradient: 'from-red-500 to-red-600',
  },
};

const LINE_STATUS_CONFIG: Record<string, {
  label: string;
  labelTh: string;
  bgClass: string;
  textClass: string;
}> = {
  pending: { label: 'Pending', labelTh: 'รอดำเนินการ', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
  partial: { label: 'Partial', labelTh: 'บางส่วน', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  shipped: { label: 'Shipped', labelTh: 'จัดส่งแล้ว', bgClass: 'bg-green-100', textClass: 'text-green-700' },
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (amount: number | null, currency: string = 'THB') => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: currency,
  }).format(amount || 0);
};

const formatNumber = (num: number | null) => {
  return new Intl.NumberFormat('th-TH').format(num || 0);
};

const isOverdue = (requiredDate: string | null, status: string) => {
  if (!requiredDate || ['delivered', 'cancelled', 'shipped'].includes(status)) return false;
  return new Date(requiredDate) < new Date();
};

const getDaysUntilRequired = (requiredDate: string | null) => {
  if (!requiredDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const required = new Date(requiredDate);
  required.setHours(0, 0, 0, 0);
  const diff = Math.ceil((required.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

// ============================================================================
// Main Component
// ============================================================================

export default function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<SODetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<SOLine | null>(null);
  const [fulfillForm, setFulfillForm] = useState({
    lotId: '',
    quantity: 0,
  });
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [fulfillError, setFulfillError] = useState<FulfillmentError | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const fetchDeliveries = async () => {
    try {
      const response = await fetch(`/api/sales/orders/${resolvedParams.id}/deliveries`);
      const result = await response.json();
      if (result.success) {
        setDeliveries(result.data.deliveries);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    }
  };

  useEffect(() => {
    fetchSODetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  useEffect(() => {
    if (activeTab === 'shipping') {
      fetchDeliveries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, resolvedParams.id]);

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

    setIsSubmitting(true);
    setFulfillError(null);

    try {
      const response = await fetch(`/api/sales/orders/${resolvedParams.id}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soLineId: selectedLine.id,
          itemId: selectedLine.itemId,
          lotId: parseInt(fulfillForm.lotId),
          quantity: fulfillForm.quantity,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowFulfillModal(false);
        fetchSODetail(); // Refresh order data
        fetchDeliveries(); // Refresh delivery history
      } else {
        // Parse and display structured error
        const parsedError = parseErrorMessage(result.error || 'Unknown error');
        setFulfillError(parsedError);
        setShowFulfillModal(false);
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Failed to fulfill:', error);
      const parsedError = parseErrorMessage(
        error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
      );
      setFulfillError(parsedError);
      setShowFulfillModal(false);
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  // ============================================================================
  // Not Found State
  // ============================================================================

  if (!data) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ไม่พบใบสั่งขาย</h2>
          <p className="text-gray-500 mb-6">ไม่พบข้อมูลใบสั่งขายที่ร้องขอ</p>
          <DxButton
            text="กลับไปหน้ารายการ"
            icon="back"
            type="default"
            onClick={() => router.push('/sales/orders')}
          />
        </div>
      </MainLayout>
    );
  }

  const { salesOrder: so, lines, summary } = data;
  const statusConfig = STATUS_CONFIG[so.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const overdue = isOverdue(so.requiredDate, so.status);
  const daysUntil = getDaysUntilRequired(so.requiredDate);

  // ============================================================================
  // Tabs Configuration
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview', label: 'ภาพรวม', icon: Eye },
    { key: 'lines', label: 'รายการสินค้า', icon: ClipboardList, count: lines.length },
    { key: 'fulfillment', label: 'จัดเตรียมสินค้า', icon: BoxSelect },
    { key: 'shipping', label: 'การจัดส่ง', icon: Truck },
  ];

  // ============================================================================
  // DataGrid Columns
  // ============================================================================

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{cellInfo.data.itemCode}</p>
            <p className="text-sm text-gray-500 truncate">{cellInfo.data.itemName}</p>
          </div>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวนสั่ง',
      width: 120,
      cellRender: (cellInfo) => (
        <div className="text-right">
          <span className="font-semibold">{formatNumber(cellInfo.data.quantity)}</span>
          <span className="text-gray-500 text-sm ml-1">{cellInfo.data.itemUnit}</span>
        </div>
      ),
    },
    {
      dataField: 'unitPrice',
      caption: 'ราคาต่อหน่วย',
      width: 130,
      cellRender: (cellInfo) => (
        <span className="text-gray-700">{formatCurrency(cellInfo.data.unitPrice)}</span>
      ),
    },
    {
      dataField: 'lineTotal',
      caption: 'รวม',
      width: 140,
      cellRender: (cellInfo) => (
        <span className="font-semibold text-green-600">{formatCurrency(cellInfo.data.lineTotal)}</span>
      ),
    },
    {
      dataField: 'shippedQty',
      caption: 'จัดส่งแล้ว',
      width: 150,
      cellRender: (cellInfo) => {
        const shipped = cellInfo.data.shippedQty || 0;
        const total = cellInfo.data.quantity;
        const percentage = total > 0 ? Math.round((shipped / total) * 100) : 0;
        return (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{shipped} / {total}</span>
              <span className="text-xs text-gray-500">{percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'fulfillmentStatus',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => {
        const config = LINE_STATUS_CONFIG[cellInfo.data.fulfillmentStatus] || LINE_STATUS_CONFIG.pending;
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
            {config.labelTh}
          </span>
        );
      },
    },
  ];

  const fulfillmentColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center',
            cellInfo.data.canFulfill ? 'bg-green-100' : 'bg-red-100'
          )}>
            <Package className={cn('h-4 w-4', cellInfo.data.canFulfill ? 'text-green-600' : 'text-red-600')} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{cellInfo.data.itemCode}</p>
            <p className="text-xs text-gray-500 truncate">{cellInfo.data.itemName}</p>
          </div>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'สั่งซื้อ',
      width: 90,
      cellRender: (cellInfo) => (
        <span className="font-medium">{cellInfo.data.quantity} {cellInfo.data.itemUnit}</span>
      ),
    },
    {
      dataField: 'shippedQty',
      caption: 'จัดส่งแล้ว',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="text-green-600 font-medium">{cellInfo.data.shippedQty || 0} {cellInfo.data.itemUnit}</span>
      ),
    },
    {
      dataField: 'pendingQty',
      caption: 'รอจัดส่ง',
      width: 100,
      cellRender: (cellInfo) => (
        <span className={cn('font-medium', cellInfo.data.pendingQty > 0 ? 'text-amber-600' : 'text-gray-400')}>
          {cellInfo.data.pendingQty} {cellInfo.data.itemUnit}
        </span>
      ),
    },
    {
      dataField: 'availableStock',
      caption: 'สต็อกพร้อมใช้',
      width: 120,
      cellRender: (cellInfo) => (
        <div>
          <span className={cn('font-medium', cellInfo.data.canFulfill ? 'text-green-600' : 'text-red-600')}>
            {cellInfo.data.availableStock} {cellInfo.data.itemUnit}
          </span>
          {!cellInfo.data.canFulfill && (
            <div className="flex items-center gap-1 text-red-500 text-xs mt-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span>ไม่เพียงพอ</span>
            </div>
          )}
        </div>
      ),
    },
    {
      dataField: 'suggestedLots',
      caption: 'Lot แนะนำ (FEFO)',
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div className="space-y-1">
          {cellInfo.data.suggestedLots.slice(0, 2).map((lot: SOLine['suggestedLots'][0]) => (
            <div key={lot.id} className="text-xs bg-gray-50 border rounded px-2 py-1 flex items-center justify-between">
              <span className="font-mono font-medium text-indigo-600">{lot.lotNumber}</span>
              <span className="text-gray-500">
                {lot.quantity} • {lot.expiryDate ? formatDate(lot.expiryDate) : 'N/A'}
              </span>
            </div>
          ))}
          {cellInfo.data.suggestedLots.length === 0 && (
            <span className="text-red-500 text-xs">ไม่มี Lot พร้อมใช้</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 130,
      cellRender: (cellInfo) => (
        cellInfo.data.pendingQty > 0 && cellInfo.data.canFulfill ? (
          <DxButton
            text="เลือก & ส่ง"
            type="success"
            stylingMode="outlined"
            onClick={() => handleFulfill(cellInfo.data)}
          />
        ) : null
      ),
    },
  ];

  const deliveryColumns: DxDataGridColumn[] = [
    {
      dataField: 'deliveryNumber',
      caption: 'เลขที่จัดส่ง',
      width: 150,
      cellRender: (cellInfo) => (
        <span className="font-mono font-semibold text-indigo-600">{cellInfo.data.deliveryNumber}</span>
      ),
    },
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      minWidth: 150,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-400" />
          <div>
            <p className="font-medium">{cellInfo.data.itemCode}</p>
            <p className="text-xs text-gray-500">{cellInfo.data.itemName}</p>
          </div>
        </div>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: 'Lot',
      width: 120,
      cellRender: (cellInfo) => (
        <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">{cellInfo.data.lotNumber}</span>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="font-semibold">{formatNumber(cellInfo.data.quantity)} {cellInfo.data.unit}</span>
      ),
    },
    {
      dataField: 'deliveryDate',
      caption: 'วันที่จัดส่ง',
      width: 110,
      cellRender: (cellInfo) => (
        <span>{formatDate(cellInfo.data.deliveryDate)}</span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 100,
      cellRender: (cellInfo) => {
        const statusMap: Record<string, { label: string; bg: string; text: string }> = {
          shipped: { label: 'จัดส่งแล้ว', bg: 'bg-cyan-100', text: 'text-cyan-700' },
          delivered: { label: 'ส่งมอบแล้ว', bg: 'bg-green-100', text: 'text-green-700' },
          returned: { label: 'ส่งคืน', bg: 'bg-red-100', text: 'text-red-700' },
        };
        const config = statusMap[cellInfo.data.status] || statusMap.shipped;
        return (
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.bg, config.text)}>
            {config.label}
          </span>
        );
      },
    },
    {
      dataField: 'journalEntries',
      caption: 'รายการบัญชี',
      width: 180,
      cellRender: (cellInfo) => {
        const journalEntries = cellInfo.data.journalEntries || [];
        if (journalEntries.length === 0) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {journalEntries.map((je: { id: number; entryNumber: string; sourceType: string; status: string }) => (
              <button
                key={je.id}
                onClick={() => router.push(`/accounting/journal-entries?id=${je.id}`)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors',
                  je.sourceType === 'SO_SHIPMENT'
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                )}
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
      dataField: 'arInvoices',
      caption: 'ใบแจ้งหนี้ AR',
      width: 150,
      cellRender: (cellInfo) => {
        const arInvoices = cellInfo.data.arInvoices || [];
        if (arInvoices.length === 0) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            {arInvoices.map((inv: { id: number; invoiceNumber: string; taxInvoiceNumber: string; status: string }) => (
              <button
                key={inv.id}
                onClick={() => router.push(`/accounting/ar/invoices?id=${inv.id}`)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors bg-teal-50 text-teal-700 hover:bg-teal-100"
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span>{inv.invoiceNumber}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Order Information */}
      <Card elevation="raised" className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-indigo-500" />
            ข้อมูลใบสั่งขาย
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">เลขที่ SO</p>
              <p className="font-mono font-semibold text-indigo-600">{so.soNumber}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">สถานะ</p>
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', statusConfig.bgClass, statusConfig.textClass)}>
                {statusConfig.labelTh}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">จำนวนรายการ</p>
              <p className="font-semibold">{summary.lineCount} รายการ</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs text-gray-500">วันที่สั่ง</p>
              </div>
              <p className="font-medium">{formatDate(so.orderDate)}</p>
            </div>
            <div className={cn('p-3 rounded-lg', overdue ? 'bg-red-50' : 'bg-gray-50')}>
              <div className="flex items-center gap-1.5 mb-1">
                <Truck className={cn('h-3.5 w-3.5', overdue ? 'text-red-400' : 'text-gray-400')} />
                <p className={cn('text-xs', overdue ? 'text-red-500' : 'text-gray-500')}>กำหนดส่ง</p>
              </div>
              <p className={cn('font-medium', overdue ? 'text-red-600' : '')}>{formatDate(so.requiredDate)}</p>
              {daysUntil !== null && (
                <p className={cn(
                  'text-xs mt-0.5',
                  daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : 'text-gray-500'
                )}>
                  {daysUntil < 0 ? `เกิน ${Math.abs(daysUntil)} วัน` : daysUntil === 0 ? 'วันนี้' : `อีก ${daysUntil} วัน`}
                </p>
              )}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs text-gray-500">เงื่อนไขการชำระ</p>
              </div>
              <p className="font-medium">{so.paymentTerms || '-'}</p>
            </div>
          </div>

          {/* Notes */}
          {so.notes && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-1">หมายเหตุ</p>
              <p className="text-sm text-amber-700">{so.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Information */}
      <Card elevation="raised">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-purple-500" />
            ข้อมูลลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
            <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {so.customerName?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{so.customerName || '-'}</p>
              <p className="text-sm text-gray-500">ลูกค้า</p>
            </div>
          </div>

          {so.customerContact && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">ผู้ติดต่อ</p>
                <p className="font-medium">{so.customerContact}</p>
              </div>
            </div>
          )}

          {so.customerAddress && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">ที่อยู่จัดส่ง</p>
                <p className="font-medium text-sm">{so.customerAddress}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fulfillment Progress */}
      <Card elevation="raised" className="lg:col-span-3">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-green-500" />
            ความคืบหน้าการจัดส่ง
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">ความคืบหน้า</span>
                <span className="text-2xl font-bold text-green-600">{summary.fulfillmentProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${summary.fulfillmentProgress || 0}%` }}
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border">
              <p className="text-sm text-gray-500 mb-1">ยอดสั่งทั้งหมด</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(summary.totalOrdered)}</p>
              <p className="text-xs text-gray-500">หน่วย</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-gray-500 mb-1">จัดส่งแล้ว</p>
              <p className="text-xl font-bold text-green-600">{formatNumber(summary.totalShipped)}</p>
              <p className="text-xs text-gray-500">หน่วย</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm text-gray-500 mb-1">รอจัดส่ง</p>
              <p className="text-xl font-bold text-amber-600">{formatNumber(summary.totalPending)}</p>
              <p className="text-xs text-gray-500">หน่วย</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLinesTab = () => (
    <div className="p-6">
      <DxDataGrid
        dataSource={lines}
        keyExpr="id"
        columns={lineColumns}
        showBorders={false}
        rowAlternationEnabled
        height={450}
        noDataText="ไม่มีรายการสินค้า"
      />
    </div>
  );

  const renderFulfillmentTab = () => (
    <div className="p-6">
      <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BoxSelect className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-indigo-900">จัดเตรียมสินค้า (FEFO)</h3>
            <p className="text-sm text-indigo-700">แนะนำ Lot ตามนโยบาย First Expiry, First Out</p>
          </div>
        </div>
      </div>
      <DxDataGrid
        dataSource={lines}
        keyExpr="id"
        columns={fulfillmentColumns}
        showBorders={false}
        rowAlternationEnabled
        height={400}
        noDataText="ไม่มีข้อมูลการจัดเตรียม"
      />
    </div>
  );

  const renderShippingTab = () => (
    <div className="p-6">
      {deliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Truck className="h-10 w-10 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">ยังไม่มีการจัดส่ง</p>
          <p className="text-sm text-gray-400 mt-1">รายการจัดส่งจะแสดงที่นี่เมื่อมีการดำเนินการ</p>
          {summary.totalPending > 0 && summary.allCanFulfill && (
            <DxButton
              text="ไปจัดเตรียมสินค้า"
              icon="arrowright"
              type="default"
              stylingMode="outlined"
              className="mt-4"
              onClick={() => setActiveTab('fulfillment')}
            />
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="font-semibold text-cyan-900">ประวัติการจัดส่ง</h3>
                <p className="text-sm text-cyan-700">
                  ทั้งหมด {deliveries.length} รายการ •
                  จัดส่งแล้ว {formatNumber(deliveries.reduce((sum, d) => sum + Number(d.quantity || 0), 0))} หน่วย
                </p>
              </div>
            </div>
          </div>
          <DxDataGrid
            dataSource={deliveries}
            keyExpr="id"
            columns={deliveryColumns}
            showBorders={false}
            rowAlternationEnabled
            height={400}
            noDataText="ไม่มีรายการจัดส่ง"
          />
        </>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Hero Header */}
        <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-r', statusConfig.gradient)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{so.soNumber}</h1>
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm'
                    )}>
                      {statusConfig.labelTh}
                    </span>
                    {overdue && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/80 text-white flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        เกินกำหนด
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-white/80 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      <span>{so.customerName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(so.orderDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DxButton
                  text="กลับ"
                  icon="back"
                  type="normal"
                  stylingMode="text"
                  onClick={() => router.push('/sales/orders')}
                  className="text-white hover:bg-white/20"
                />
                <button
                  onClick={() => fetchSODetail()}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button
                  onClick={() => window.print()}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <Printer className="h-5 w-5" />
                </button>
                {so.status === 'confirmed' && summary.allCanFulfill && (
                  <DxButton
                    text="ดำเนินการทั้งหมด"
                    icon="check"
                    type="success"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-blue-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-blue-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ยอดรวม</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalAmount, so.currency)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-indigo-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <ClipboardList className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ยอดสั่ง</p>
                      <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalOrdered)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-green-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-green-100 rounded-lg flex items-center justify-center">
                      <Truck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">จัดส่งแล้ว</p>
                      <p className="text-lg font-bold text-green-600">{formatNumber(summary.totalShipped)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-amber-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">รอจัดส่ง</p>
                      <p className="text-lg font-bold text-amber-600">{formatNumber(summary.totalPending)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-purple-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-purple-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ความคืบหน้า</p>
                      <p className="text-lg font-bold text-purple-600">{summary.fulfillmentProgress}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Alert */}
        {!summary.allCanFulfill && summary.totalPending > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-800">สต็อกไม่เพียงพอ</p>
              <p className="text-sm text-red-600">
                บางรายการไม่มีสต็อกเพียงพอสำหรับการจัดส่ง ตรวจสอบรายละเอียดในแท็บ &quot;จัดเตรียมสินค้า&quot;
              </p>
            </div>
          </div>
        )}

        {/* Ready to Ship Alert */}
        {summary.allCanFulfill && summary.totalPending > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800">พร้อมจัดส่ง</p>
              <p className="text-sm text-green-600">
                สินค้าทุกรายการมีสต็อกเพียงพอ สามารถดำเนินการจัดส่งได้ทันที
              </p>
            </div>
            <DxButton
              text="ไปที่การจัดเตรียม"
              icon="arrowright"
              type="success"
              onClick={() => setActiveTab('fulfillment')}
            />
          </div>
        )}

        {/* Tabs Content */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b px-4 py-2">
            <div className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-600'
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'lines' && renderLinesTab()}
            {activeTab === 'fulfillment' && renderFulfillmentTab()}
            {activeTab === 'shipping' && renderShippingTab()}
          </div>
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
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Send className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">เลือก Lot และจัดส่ง</h2>
              <p className="text-sm text-gray-500">เลือก Lot สำหรับการจัดส่งสินค้า</p>
            </div>
          </div>

          {selectedLine && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedLine.itemCode}</p>
                    <p className="text-sm text-gray-500">{selectedLine.itemName}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">เลือก Lot (FEFO)</label>
                <DxSelectBox
                  items={selectedLine.suggestedLots.map((lot) => ({
                    value: lot.id.toString(),
                    text: `${lot.lotNumber} - จำนวน: ${lot.quantity} - หมดอายุ: ${lot.expiryDate ? formatDate(lot.expiryDate) : 'N/A'}`,
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
                  placeholder="เลือก Lot..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนที่จะจัดส่ง ({selectedLine.itemUnit})
                </label>
                <DxNumberBox
                  value={fulfillForm.quantity}
                  onValueChange={(value) => setFulfillForm({ ...fulfillForm, quantity: value || 0 })}
                  min={0}
                  max={selectedLine.pendingQty}
                />
                <p className="text-xs text-gray-500 mt-1">รอจัดส่ง: {selectedLine.pendingQty} {selectedLine.itemUnit}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowFulfillModal(false)}
              disabled={isSubmitting}
            />
            <DxButton
              text={isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการจัดส่ง'}
              icon={isSubmitting ? 'refresh' : 'check'}
              type="success"
              onClick={submitFulfill}
              disabled={isSubmitting || !fulfillForm.lotId || fulfillForm.quantity <= 0}
            />
          </div>
        </div>
      </DxPopup>

      {/* Error Modal */}
      <DxPopup
        visible={showErrorModal}
        onHiding={() => setShowErrorModal(false)}
        title=""
        width={520}
        height="auto"
        showCloseButton
        showTitle={false}
      >
        <div className="p-6">
          {fulfillError && (
            <>
              {/* Error Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={cn(
                  'h-14 w-14 rounded-xl flex items-center justify-center shrink-0',
                  fulfillError.type === 'lot_status' ? 'bg-amber-100' :
                  fulfillError.type === 'insufficient_qty' ? 'bg-red-100' :
                  'bg-gray-100'
                )}>
                  {fulfillError.type === 'lot_status' ? (
                    <AlertOctagon className="h-7 w-7 text-amber-600" />
                  ) : fulfillError.type === 'insufficient_qty' ? (
                    <XCircle className="h-7 w-7 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-7 w-7 text-gray-600" />
                  )}
                </div>
                <div>
                  <h2 className={cn(
                    'text-xl font-bold',
                    fulfillError.type === 'lot_status' ? 'text-amber-800' :
                    fulfillError.type === 'insufficient_qty' ? 'text-red-800' :
                    'text-gray-800'
                  )}>
                    {fulfillError.title}
                  </h2>
                  <p className="text-gray-600 mt-1">{fulfillError.message}</p>
                </div>
              </div>

              {/* Error Details */}
              {(fulfillError.details.lotNumber || fulfillError.details.lotStatus ||
                fulfillError.details.availableQty !== undefined || fulfillError.details.requestedQty !== undefined) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">รายละเอียด</span>
                  </div>
                  <div className="space-y-2">
                    {fulfillError.details.lotNumber && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Lot Number:</span>
                        <span className="font-mono font-semibold text-indigo-600">{fulfillError.details.lotNumber}</span>
                      </div>
                    )}
                    {fulfillError.details.lotStatus && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">สถานะ Lot:</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          fulfillError.details.lotStatus === 'quarantine' ? 'bg-amber-100 text-amber-700' :
                          fulfillError.details.lotStatus === 'blocked' ? 'bg-red-100 text-red-700' :
                          fulfillError.details.lotStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        )}>
                          {fulfillError.details.lotStatus}
                        </span>
                      </div>
                    )}
                    {fulfillError.details.availableQty !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">จำนวนพร้อมใช้:</span>
                        <span className="font-semibold text-green-600">{fulfillError.details.availableQty.toLocaleString()}</span>
                      </div>
                    )}
                    {fulfillError.details.requestedQty !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">จำนวนที่ต้องการ:</span>
                        <span className="font-semibold text-red-600">{fulfillError.details.requestedQty.toLocaleString()}</span>
                      </div>
                    )}
                    {fulfillError.details.pendingQty !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">ยอดค้างส่ง:</span>
                        <span className="font-semibold">{fulfillError.details.pendingQty.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">วิธีแก้ไข</span>
                </div>
                <ul className="space-y-2">
                  {fulfillError.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <span className="text-gray-600">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {fulfillError.type === 'lot_status' && (
                  <DxButton
                    text="ไปหน้าควบคุมคุณภาพ"
                    icon="link"
                    type="default"
                    stylingMode="outlined"
                    onClick={() => router.push('/quality/lots')}
                  />
                )}
                <DxButton
                  text="เลือก Lot ใหม่"
                  icon="refresh"
                  type="default"
                  onClick={() => {
                    setShowErrorModal(false);
                    if (selectedLine) {
                      handleFulfill(selectedLine);
                    }
                  }}
                />
                <DxButton
                  text="ปิด"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setShowErrorModal(false)}
                />
              </div>
            </>
          )}
        </div>
      </DxPopup>
    </MainLayout>
  );
}
