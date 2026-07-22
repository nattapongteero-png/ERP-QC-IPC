'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { useToast } from '@/hooks/use-toast';
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
import { SalesOrderPrintDocument } from '@/components/sales/SalesOrderPrintDocument';
import { StatusStepper } from '@/components/shared';

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
    shippingCost: number | string | null;
    carrier: string | null;
    trackingNumber: string | null;
    createdByName: string | null;
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
  type: 'lot_status' | 'lot_expired' | 'insufficient_qty' | 'invalid_line' | 'invalid_lot' | 'exceeds_pending' | 'unknown';
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

// Parse error message to structured error - returns translation keys for dynamic resolution
function parseErrorMessage(errorMsg: string, t: (key: string) => string): FulfillmentError {
  // Expired lot — issueMaterial refuses it, so say so in Thai rather than
  // letting the raw server string reach the warehouse operator.
  const expiredMatch = errorMsg.match(/Lot\s+([\w-]+)\s+expired on\s+([\d-]+)/i);
  if (expiredMatch) {
    const [, lotNumber, expiredOn] = expiredMatch;
    return {
      type: 'lot_expired',
      title: t('orders.detail.error.lotExpired.title'),
      message: `Lot ${lotNumber} ${t('orders.detail.error.lotExpired.message')} ${expiredOn}`,
      details: { lotNumber },
      suggestions: [
        t('orders.detail.error.lotExpired.suggestion1'),
        t('orders.detail.error.lotExpired.suggestion2'),
      ],
    };
  }

  // Lot not released error
  const lotStatusMatch = errorMsg.match(/Lot\s+([\w-]+)\s+is not released\s*\(status:\s*(\w+)\)/i);
  if (lotStatusMatch) {
    const [, lotNumber, status] = lotStatusMatch;
    return {
      type: 'lot_status',
      title: t('orders.detail.error.lotStatus.title'),
      message: `Lot ${lotNumber} ${t('orders.detail.error.lotStatus.message')}`,
      details: { lotNumber, lotStatus: status },
      suggestions: [
        `${t(`orders.detail.error.lotStatus.${status}` as 'orders.detail.error.lotStatus.quarantine')}`,
        t('orders.detail.error.lotStatus.suggestion1'),
        t('orders.detail.error.lotStatus.suggestion2'),
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
      title: t('orders.detail.error.insufficientQty.title'),
      message: t('orders.detail.error.insufficientQty.message'),
      details: { availableQty: available, requestedQty: requested },
      suggestions: [
        `${t('orders.detail.error.insufficientQty.available')}: ${available.toLocaleString()}`,
        `${t('orders.detail.error.insufficientQty.requested')}: ${requested.toLocaleString()}`,
        t('orders.detail.error.insufficientQty.suggestion1'),
        t('orders.detail.error.insufficientQty.suggestion2'),
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
      title: t('orders.detail.error.exceedsPending.title'),
      message: t('orders.detail.error.exceedsPending.message'),
      details: { pendingQty: pending },
      suggestions: [
        pending ? `${t('orders.detail.error.exceedsPending.pending')}: ${pending.toLocaleString()}` : t('orders.detail.error.exceedsPending.pending'),
        t('orders.detail.error.exceedsPending.suggestion'),
      ],
    };
  }

  // Sales order line not found
  if (errorMsg.toLowerCase().includes('line') && errorMsg.toLowerCase().includes('not found')) {
    return {
      type: 'invalid_line',
      title: t('orders.detail.error.invalidLine.title'),
      message: t('orders.detail.error.invalidLine.message'),
      details: {},
      suggestions: [
        t('orders.detail.error.invalidLine.suggestion1'),
        t('orders.detail.error.invalidLine.suggestion2'),
      ],
    };
  }

  // Lot not found
  if (errorMsg.toLowerCase().includes('lot') && errorMsg.toLowerCase().includes('not found')) {
    return {
      type: 'invalid_lot',
      title: t('orders.detail.error.invalidLot.title'),
      message: t('orders.detail.error.invalidLot.message'),
      details: {},
      suggestions: [
        t('orders.detail.error.invalidLot.suggestion1'),
        t('orders.detail.error.invalidLot.suggestion2'),
      ],
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    title: t('orders.detail.error.unknown.title'),
    message: errorMsg || t('orders.detail.error.unknown.message'),
    details: {},
    suggestions: [
      t('orders.detail.error.unknown.suggestion1'),
      t('orders.detail.error.unknown.suggestion2'),
    ],
  };
}

// ============================================================================
// Status Configuration
// ============================================================================

const STATUS_CONFIG: Record<string, {
  translationKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  gradient: string;
}> = {
  draft: {
    translationKey: 'draft',
    color: '#94a3b8',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    icon: FileText,
    gradient: 'from-slate-500 to-slate-600',
  },
  confirmed: {
    translationKey: 'confirmed',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: CheckCircle,
    gradient: 'from-emerald-600 to-teal-700',
  },
  processing: {
    translationKey: 'processing',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    icon: Clock,
    gradient: 'from-amber-500 to-amber-600',
  },
  ready: {
    translationKey: 'ready',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Package,
    gradient: 'from-violet-500 to-violet-600',
  },
  shipped: {
    translationKey: 'shipped',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: Truck,
    gradient: 'from-cyan-500 to-cyan-600',
  },
  delivered: {
    translationKey: 'delivered',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: CheckCircle,
    gradient: 'from-green-500 to-green-600',
  },
  cancelled: {
    translationKey: 'cancelled',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: AlertTriangle,
    gradient: 'from-red-500 to-red-600',
  },
};

const LINE_STATUS_CONFIG: Record<string, {
  translationKey: string;
  bgClass: string;
  textClass: string;
}> = {
  pending: { translationKey: 'pending', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
  partial: { translationKey: 'partial', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  shipped: { translationKey: 'shipped', bgClass: 'bg-green-100', textClass: 'text-green-700' },
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
  const t = useTranslations('sales');
  const toast = useToast();
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
  const [editingShipping, setEditingShipping] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    shippingCost: 0,
    carrier: '',
    trackingNumber: '',
  });
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
        // Surface partial-success warnings: shipment recorded but the
        // accounting integration (sales JE / COGS / AR invoice) failed.
        // Without this the user thinks everything's fine but the books
        // are silently out of sync.
        const data = result.data ?? {};
        if (data.accountingFailed) {
          toast.error(
            data.accountingMessage ||
              'ส่งของสำเร็จแต่สร้างรายการบัญชีไม่ได้ — กรุณาแจ้งฝ่ายบัญชี',
          );
        } else if (data.arInvoiceFailed) {
          toast.error(
            data.arInvoiceMessage ||
              'ส่งของสำเร็จแต่ออกใบกำกับภาษีไม่ได้ — กรุณาแจ้งฝ่ายบัญชี',
          );
        } else if (data.arInvoiceNumber) {
          toast.success(
            `ส่งของและออกใบกำกับภาษี ${data.taxInvoiceNumber || data.arInvoiceNumber} เรียบร้อย`,
          );
        }
        fetchSODetail(); // Refresh order data
        fetchDeliveries(); // Refresh delivery history
      } else {
        // Parse and display structured error
        const parsedError = parseErrorMessage(result.error || 'Unknown error', t);
        setFulfillError(parsedError);
        setShowFulfillModal(false);
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Failed to fulfill:', error);
      const parsedError = parseErrorMessage(
        error instanceof Error ? error.message : t('orders.detail.error.connection'), t
      );
      setFulfillError(parsedError);
      setShowFulfillModal(false);
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // Tabs Configuration (must be before early returns to maintain hooks order)
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = useMemo(() => [
    { key: 'overview', label: t('orders.detail.tabs.overview'), icon: Eye },
    { key: 'lines', label: t('orders.detail.tabs.lines'), icon: ClipboardList, count: data?.lines?.length ?? 0 },
    { key: 'fulfillment', label: t('orders.detail.tabs.fulfillment'), icon: BoxSelect },
    { key: 'shipping', label: t('orders.detail.tabs.shipping'), icon: Truck },
  ], [t, data?.lines?.length]);

  // ============================================================================
  // DataGrid Columns
  // ============================================================================

  const lineColumns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'itemCode',
      caption: t('orders.detail.columns.item'),
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
      caption: t('orders.detail.columns.quantity'),
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
      caption: t('orders.detail.columns.unitPrice'),
      width: 130,
      cellRender: (cellInfo) => (
        <span className="text-gray-700">{formatCurrency(cellInfo.data.unitPrice)}</span>
      ),
    },
    {
      dataField: 'lineTotal',
      caption: t('orders.detail.columns.lineTotal'),
      width: 140,
      cellRender: (cellInfo) => (
        <span className="font-semibold text-green-600">{formatCurrency(cellInfo.data.lineTotal)}</span>
      ),
    },
    {
      dataField: 'shippedQty',
      caption: t('orders.detail.columns.shipped'),
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
      caption: t('orders.detail.columns.status'),
      width: 120,
      cellRender: (cellInfo) => {
        const config = LINE_STATUS_CONFIG[cellInfo.data.fulfillmentStatus] || LINE_STATUS_CONFIG.pending;
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
            {t(`orders.detail.lineStatus.${config.translationKey}`)}
          </span>
        );
      },
    },
  ], [t]);

  const fulfillmentColumns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'itemCode',
      caption: t('orders.detail.columns.item'),
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
      caption: t('orders.detail.columns.ordered'),
      width: 90,
      cellRender: (cellInfo) => (
        <span className="font-medium">{cellInfo.data.quantity} {cellInfo.data.itemUnit}</span>
      ),
    },
    {
      dataField: 'shippedQty',
      caption: t('orders.detail.columns.shipped'),
      width: 100,
      cellRender: (cellInfo) => (
        <span className="text-green-600 font-medium">{cellInfo.data.shippedQty || 0} {cellInfo.data.itemUnit}</span>
      ),
    },
    {
      dataField: 'pendingQty',
      caption: t('orders.detail.columns.pendingShip'),
      width: 100,
      cellRender: (cellInfo) => (
        <span className={cn('font-medium', cellInfo.data.pendingQty > 0 ? 'text-amber-600' : 'text-gray-400')}>
          {cellInfo.data.pendingQty} {cellInfo.data.itemUnit}
        </span>
      ),
    },
    {
      dataField: 'availableStock',
      caption: t('orders.detail.columns.availableStock'),
      width: 120,
      cellRender: (cellInfo) => (
        <div>
          <span className={cn('font-medium', cellInfo.data.canFulfill ? 'text-green-600' : 'text-red-600')}>
            {cellInfo.data.availableStock} {cellInfo.data.itemUnit}
          </span>
          {!cellInfo.data.canFulfill && (
            <div className="flex items-center gap-1 text-red-500 text-xs mt-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span>{t('orders.detail.fulfillment.insufficient')}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      dataField: 'suggestedLots',
      caption: t('orders.detail.columns.suggestedLots'),
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
            <span className="text-red-500 text-xs">{t('orders.detail.fulfillment.noLot')}</span>
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
            text={t('orders.detail.fulfillment.selectAndShip')}
            type="success"
            stylingMode="outlined"
            onClick={() => handleFulfill(cellInfo.data)}
          />
        ) : null
      ),
    },
  ], [t]);

  const deliveryColumns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'deliveryNumber',
      caption: t('orders.detail.columns.deliveryNumber'),
      width: 150,
      cellRender: (cellInfo) => (
        <span className="font-mono font-semibold text-indigo-600">{cellInfo.data.deliveryNumber}</span>
      ),
    },
    {
      dataField: 'itemCode',
      caption: t('orders.detail.columns.item'),
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
      caption: t('orders.detail.columns.lot'),
      width: 120,
      cellRender: (cellInfo) => (
        <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">{cellInfo.data.lotNumber}</span>
      ),
    },
    {
      dataField: 'quantity',
      caption: t('orders.detail.columns.quantity'),
      width: 100,
      cellRender: (cellInfo) => (
        <span className="font-semibold">{formatNumber(cellInfo.data.quantity)} {cellInfo.data.unit}</span>
      ),
    },
    {
      dataField: 'deliveryDate',
      caption: t('orders.detail.columns.deliveryDate'),
      width: 110,
      cellRender: (cellInfo) => (
        <span>{formatDate(cellInfo.data.deliveryDate)}</span>
      ),
    },
    {
      dataField: 'status',
      caption: t('orders.detail.columns.status'),
      width: 100,
      cellRender: (cellInfo) => {
        const statusKey = cellInfo.data.status as 'shipped' | 'delivered' | 'returned';
        const statusStyles: Record<string, { bg: string; text: string }> = {
          shipped: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
          delivered: { bg: 'bg-green-100', text: 'text-green-700' },
          returned: { bg: 'bg-red-100', text: 'text-red-700' },
        };
        const config = statusStyles[statusKey] || statusStyles.shipped;
        return (
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.bg, config.text)}>
            {t(`orders.detail.shipping.deliveryStatus.${statusKey}`)}
          </span>
        );
      },
    },
    {
      dataField: 'journalEntries',
      caption: t('orders.detail.columns.journalEntries'),
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
      caption: t('orders.detail.columns.arInvoices'),
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
  ], [t, router]);

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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('orders.detail.notFound')}</h2>
          <p className="text-gray-500 mb-6">{t('orders.detail.notFoundDescription')}</p>
          <DxButton
            text={t('orders.detail.backToList')}
            icon="back"
            type="default"
            onClick={() => router.push('/sales/orders')}
          />
        </div>
      </MainLayout>
    );
  }

  const { salesOrder: so, lines, summary } = data;
  // The stored totalAmount is GOODS ONLY (line totals). Freight is stored
  // separately and posts to a different GL account, but the money the customer
  // owes — the "ยอดรวมสุทธิ" the tester expects — is goods + freight. Compute
  // it here so every place that shows the net total is consistent, and the
  // freight line never silently disappears after confirming.
  const goodsAmount = summary.totalAmount;
  const freightAmount = Number(so.shippingCost || 0);
  const netTotal = goodsAmount + freightAmount;
  const statusConfig = STATUS_CONFIG[so.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const overdue = isOverdue(so.requiredDate, so.status);
  const daysUntil = getDaysUntilRequired(so.requiredDate);

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
            {t('orders.detail.sections.orderInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('orders.detail.fields.soNumber')}</p>
              <p className="font-mono font-semibold text-indigo-600">{so.soNumber}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('orders.detail.fields.status')}</p>
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', statusConfig.bgClass, statusConfig.textClass)}>
                {t(`orders.status.${statusConfig.translationKey}`)}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{t('orders.detail.fields.lineCount')}</p>
              <p className="font-semibold">{summary.lineCount} {t('orders.detail.summary.units')}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs text-gray-500">{t('orders.detail.fields.orderDate')}</p>
              </div>
              <p className="font-medium">{formatDate(so.orderDate)}</p>
            </div>
            <div className={cn('p-3 rounded-lg', overdue ? 'bg-red-50' : 'bg-gray-50')}>
              <div className="flex items-center gap-1.5 mb-1">
                <Truck className={cn('h-3.5 w-3.5', overdue ? 'text-red-400' : 'text-gray-400')} />
                <p className={cn('text-xs', overdue ? 'text-red-500' : 'text-gray-500')}>{t('orders.detail.fields.requiredDate')}</p>
              </div>
              <p className={cn('font-medium', overdue ? 'text-red-600' : '')}>{formatDate(so.requiredDate)}</p>
              {daysUntil !== null && (
                <p className={cn(
                  'text-xs mt-0.5',
                  daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : 'text-gray-500'
                )}>
                  {daysUntil < 0 ? t('orders.dates.overdue', { days: Math.abs(daysUntil) }) : daysUntil === 0 ? t('orders.dates.today') : t('orders.dates.daysRemaining', { days: daysUntil })}
                </p>
              )}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs text-gray-500">{t('orders.detail.fields.paymentTerms')}</p>
              </div>
              <p className="font-medium">{so.paymentTerms || '-'}</p>
            </div>
            {/* ผู้สร้าง — SO ไม่มีขั้นอนุมัติแยก ผู้สร้างยืนยันออเดอร์เอง */}
            <div className="p-3 bg-gray-50 rounded-lg" data-testid="so-created-by">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs text-gray-500">{t('orders.detail.fields.createdBy')}</p>
              </div>
              <p className="font-medium" data-testid="so-created-by-name">{so.createdByName || '-'}</p>
            </div>
          </div>

          {/* Notes */}
          {so.notes && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-1">{t('orders.detail.fields.notes')}</p>
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
            {t('orders.detail.sections.customerInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
            <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {so.customerName?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 break-words" title={so.customerName || undefined}>{so.customerName || '-'}</p>
              <p className="text-sm text-gray-500">{t('orders.detail.fields.customer')}</p>
            </div>
          </div>

          {so.customerContact && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">{t('customers.table.columns.contact')}</p>
                <p className="font-medium">{so.customerContact}</p>
              </div>
            </div>
          )}

          {so.customerAddress && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">{t('customers.detail.fields.shippingAddress')}</p>
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
            {t('orders.detail.sections.fulfillmentProgress')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('orders.detail.summary.progress')}</span>
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
              <p className="text-sm text-gray-500 mb-1">{t('orders.detail.summary.totalOrdered')}</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(summary.totalOrdered)}</p>
              <p className="text-xs text-gray-500">{t('orders.detail.summary.units')}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-gray-500 mb-1">{t('orders.detail.summary.shipped')}</p>
              <p className="text-xl font-bold text-green-600">{formatNumber(summary.totalShipped)}</p>
              <p className="text-xs text-gray-500">{t('orders.detail.summary.units')}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm text-gray-500 mb-1">{t('orders.detail.summary.pending')}</p>
              <p className="text-xl font-bold text-amber-600">{formatNumber(summary.totalPending)}</p>
              <p className="text-xs text-gray-500">{t('orders.detail.summary.units')}</p>
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
        noDataText={t('orders.new.noItems')}
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
            <h3 className="font-semibold text-indigo-900">{t('orders.detail.fulfillment.title')}</h3>
            <p className="text-sm text-indigo-700">{t('orders.detail.fulfillment.description')}</p>
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
        noDataText={t('orders.new.noItems')}
      />
    </div>
  );

  // Move the order between draft and confirmed. The backend PATCH accepts a
  // { status } payload for draft⇄confirmed⇄cancelled; here we drive the two
  // user-facing transitions the sales clerk needs from the detail screen.
  const [changingStatus, setChangingStatus] = useState(false);
  const handleChangeStatus = async (nextStatus: 'confirmed' | 'draft') => {
    setChangingStatus(true);
    try {
      const response = await fetch(`/api/sales/orders/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(
          nextStatus === 'confirmed'
            ? t('orders.detail.actions.confirmSuccess')
            : t('orders.detail.actions.revertSuccess'),
        );
        await fetchSODetail();
      } else {
        toast.error(result.error || t('orders.detail.actions.statusChangeFailed'));
      }
    } catch (error) {
      console.error('Failed to change SO status:', error);
      toast.error(t('orders.detail.actions.statusChangeFailed'));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleStartEditShipping = () => {
    // Seed from what is stored, not from whatever was typed last time — the
    // edit must start from the truth even after a cancel.
    setShippingForm({
      shippingCost: Number(data?.salesOrder.shippingCost || 0),
      carrier: data?.salesOrder.carrier || '',
      trackingNumber: data?.salesOrder.trackingNumber || '',
    });
    setEditingShipping(true);
  };

  const handleSaveShipping = async () => {
    setSavingShipping(true);
    try {
      const response = await fetch(`/api/sales/orders/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shippingForm),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(t('orders.detail.shipping.saved'));
        setEditingShipping(false);
        // Re-read rather than patching local state: the server is what the
        // next reader (and the GL) will see.
        await fetchSODetail();
      } else {
        toast.error(result.error || t('orders.detail.shipping.saveFailed'));
      }
    } catch (error) {
      console.error('Failed to save shipping details:', error);
      toast.error(t('orders.detail.shipping.saveFailed'));
    } finally {
      setSavingShipping(false);
    }
  };

  const renderShippingTab = () => (
    <div className="p-6">
      {/* Freight and consignment details. Shown whether or not anything has
          shipped yet: the tracking number arrives after the goods leave, which
          is exactly when there is still nothing in the deliveries grid. */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4" data-testid="so-shipping-panel">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-500" />
            {t('orders.detail.shipping.detailsTitle')}
          </h3>
          {!editingShipping && (
            <DxButton
              text={t('orders.detail.shipping.edit')}
              icon="edit"
              stylingMode="text"
              onClick={handleStartEditShipping}
              data-testid="so-shipping-edit-btn"
            />
          )}
        </div>

        {editingShipping ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('orders.detail.shipping.cost')}</label>
              <DxNumberBox
                value={shippingForm.shippingCost}
                onValueChanged={(e) => setShippingForm(prev => ({ ...prev, shippingCost: e.value ?? 0 }))}
                min={0}
                format="#,##0.00"
                data-testid="so-shipping-cost-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('orders.detail.shipping.carrier')}</label>
              <DxTextBox
                value={shippingForm.carrier}
                onValueChanged={(e) => setShippingForm(prev => ({ ...prev, carrier: e.value || '' }))}
                data-testid="so-carrier-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('orders.detail.shipping.tracking')}</label>
              <DxTextBox
                value={shippingForm.trackingNumber}
                onValueChanged={(e) => setShippingForm(prev => ({ ...prev, trackingNumber: e.value || '' }))}
                data-testid="so-tracking-input"
              />
            </div>
            <div className="md:col-span-3 flex gap-2 justify-end">
              <DxButton
                text={t('orders.detail.shipping.cancel')}
                stylingMode="outlined"
                onClick={() => setEditingShipping(false)}
              />
              <DxButton
                text={t('orders.detail.shipping.save')}
                type="default"
                disabled={savingShipping}
                onClick={handleSaveShipping}
                data-testid="so-shipping-save-btn"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">{t('orders.detail.shipping.cost')}</p>
              <p className="font-medium" data-testid="so-shipping-cost">
                {formatCurrency(Number(so.shippingCost || 0), so.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('orders.detail.shipping.carrier')}</p>
              <p className="font-medium" data-testid="so-carrier">{so.carrier || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('orders.detail.shipping.tracking')}</p>
              <p className="font-medium" data-testid="so-tracking">{so.trackingNumber || '-'}</p>
            </div>
          </div>
        )}
      </div>

      {deliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Truck className="h-10 w-10 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">{t('orders.detail.shipping.noDeliveries')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('orders.detail.shipping.noDeliveriesDesc')}</p>
          {summary.totalPending > 0 && summary.allCanFulfill && (
            <DxButton
              text={t('orders.detail.actions.goToPrep')}
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
                <h3 className="font-semibold text-cyan-900">{t('orders.detail.shipping.title')}</h3>
                <p className="text-sm text-cyan-700">
                  {t('orders.detail.shipping.totalItems', { count: deliveries.length })} • {t('orders.detail.shipping.totalShipped', { count: formatNumber(deliveries.reduce((sum, d) => sum + Number(d.quantity || 0), 0)) })}
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
            noDataText={t('orders.detail.shipping.noDeliveries')}
          />
        </>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <>
    {/* Printable sales document (hidden on screen, shown only when printing) */}
    <SalesOrderPrintDocument
      order={{
        soNumber: so.soNumber,
        customerName: so.customerName,
        customerContact: so.customerContact,
        customerAddress: so.customerAddress,
        orderDate: so.orderDate,
        requiredDate: so.requiredDate,
        status: so.status,
        paymentTerms: so.paymentTerms,
        notes: so.notes,
        lines: lines.map((l) => ({
          itemCode: l.itemCode,
          itemName: l.itemName,
          itemUnit: l.itemUnit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      }}
    />
    <MainLayout>
      <div className="flex flex-col h-full gap-4 no-print">
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
                      {t(`orders.status.${statusConfig.translationKey}`)}
                    </span>
                    {overdue && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/80 text-white flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t('orders.detail.alerts.overdue')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-white/80 text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="break-words" title={so.customerName || undefined}>{so.customerName}</span>
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
                  text={t('orders.detail.actions.back')}
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
                {so.status === 'draft' && (
                  <DxButton
                    text={t('orders.detail.actions.confirmOrder')}
                    icon="check"
                    type="success"
                    disabled={changingStatus}
                    onClick={() => handleChangeStatus('confirmed')}
                    elementAttr={{ 'data-testid': 'so-confirm-btn' }}
                  />
                )}
                {so.status === 'confirmed' && summary.totalShipped === 0 && (
                  <DxButton
                    text={t('orders.detail.actions.revertToDraft')}
                    icon="undo"
                    type="normal"
                    stylingMode="text"
                    disabled={changingStatus}
                    onClick={() => handleChangeStatus('draft')}
                    className="text-white hover:bg-white/20"
                    elementAttr={{ 'data-testid': 'so-revert-btn' }}
                  />
                )}
                {so.status === 'confirmed' && summary.allCanFulfill && (
                  <DxButton
                    text={t('orders.detail.actions.processAll')}
                    icon="check"
                    type="success"
                    disabled
                    hint={t('orders.detail.actions.processAllDisabledHint')}
                    data-testid="so-process-all-btn"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow status — สถานะการดำเนินงาน.
            The flow ends at "จัดส่งแล้ว" (shipped): once shipped, the order is
            complete for accounting (AR invoice + journal entries are already
            posted). There is no proof-of-delivery step in the business process,
            so the old "delivered" step only ever stayed grey and made a finished
            order look unfinished. The 'delivered' status still exists elsewhere
            (list/filter/customer page) for any legacy orders — we just don't show
            it as a pending step here.
            // [marker: so-stepper-no-delivered] */}
        <StatusStepper
          title="สถานะการดำเนินงาน"
          current={so.status === 'delivered' ? 'shipped' : so.status}
          steps={[
            { key: 'draft', label: 'ร่าง' },
            { key: 'confirmed', label: 'ยืนยันแล้ว' },
            { key: 'processing', label: 'กำลังจัดเตรียม' },
            { key: 'ready', label: 'พร้อมส่ง' },
            { key: 'shipped', label: 'จัดส่งแล้ว' },
          ]}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{t('orders.detail.summary.netTotal')}</p>
                <p className="text-lg font-bold text-gray-900" data-testid="so-net-total">{formatCurrency(netTotal, so.currency)}</p>
                {freightAmount > 0 && (
                  <p className="text-[11px] text-gray-400 leading-tight">
                    {t('orders.detail.summary.goods')} {formatCurrency(goodsAmount, so.currency)}
                    {' + '}
                    {t('orders.detail.summary.freight')} {formatCurrency(freightAmount, so.currency)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 border-l-4 border-l-cyan-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-xs text-gray-500">{t('orders.detail.summary.totalOrdered')}</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalOrdered)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-3">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-gray-500">{t('orders.detail.summary.shipped')}</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalShipped)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500">{t('orders.detail.summary.pending')}</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(summary.totalPending)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 border-l-4 border-l-violet-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-xs text-gray-500">{t('orders.detail.summary.progress')}</p>
                <p className="text-lg font-bold text-gray-900">{summary.fulfillmentProgress}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Alert */}
        {!summary.allCanFulfill && summary.totalPending > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-800">{t('orders.detail.alerts.stockInsufficient')}</p>
              <p className="text-sm text-red-600">
                {t('orders.detail.alerts.stockInsufficientDesc')}
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
              <p className="font-semibold text-green-800">{t('orders.detail.alerts.readyToShip')}</p>
              <p className="text-sm text-green-600">
                {t('orders.detail.alerts.readyToShipDesc')}
              </p>
            </div>
            <DxButton
              text={t('orders.detail.actions.goToFulfillment')}
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
              <h2 className="text-lg font-bold text-gray-900">{t('orders.detail.modal.selectLotTitle')}</h2>
              <p className="text-sm text-gray-500">{t('orders.detail.modal.selectLotDesc')}</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('orders.detail.modal.selectLot')}</label>
                <DxSelectBox
                  items={selectedLine.suggestedLots.map((lot) => ({
                    value: lot.id.toString(),
                    text: `${lot.lotNumber} - ${lot.quantity} - ${lot.expiryDate ? formatDate(lot.expiryDate) : 'N/A'}`,
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
                  placeholder={t('orders.detail.modal.selectLotPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('orders.detail.modal.quantity')} ({selectedLine.itemUnit})
                </label>
                <DxNumberBox
                  value={fulfillForm.quantity}
                  onValueChange={(value) => setFulfillForm({ ...fulfillForm, quantity: value || 0 })}
                  min={0}
                  max={selectedLine.pendingQty}
                />
                <p className="text-xs text-gray-500 mt-1">{t('orders.detail.modal.pendingQty')}: {selectedLine.pendingQty} {selectedLine.itemUnit}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <DxButton
              text={t('orders.detail.modal.cancel')}
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowFulfillModal(false)}
              disabled={isSubmitting}
            />
            <DxButton
              text={isSubmitting ? t('orders.detail.modal.processing') : t('orders.detail.modal.confirm')}
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
                  fulfillError.type === 'lot_expired' ? 'bg-red-100' :
                  fulfillError.type === 'insufficient_qty' ? 'bg-red-100' :
                  'bg-gray-100'
                )}>
                  {fulfillError.type === 'lot_status' ? (
                    <AlertOctagon className="h-7 w-7 text-amber-600" />
                  ) : fulfillError.type === 'lot_expired' ? (
                    <AlertOctagon className="h-7 w-7 text-red-600" />
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
                    fulfillError.type === 'lot_expired' ? 'text-red-800' :
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
                    <span className="text-sm font-medium text-gray-700">{t('orders.detail.error.details')}</span>
                  </div>
                  <div className="space-y-2">
                    {fulfillError.details.lotNumber && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('orders.detail.error.lotNumber')}:</span>
                        <span className="font-mono font-semibold text-indigo-600">{fulfillError.details.lotNumber}</span>
                      </div>
                    )}
                    {fulfillError.details.lotStatus && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('orders.detail.error.lotStatusLabel')}:</span>
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
                        <span className="text-gray-500">{t('orders.detail.error.availableQty')}:</span>
                        <span className="font-semibold text-green-600">{fulfillError.details.availableQty.toLocaleString()}</span>
                      </div>
                    )}
                    {fulfillError.details.requestedQty !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('orders.detail.error.requestedQty')}:</span>
                        <span className="font-semibold text-red-600">{fulfillError.details.requestedQty.toLocaleString()}</span>
                      </div>
                    )}
                    {fulfillError.details.pendingQty !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{t('orders.detail.error.pendingQty')}:</span>
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
                  <span className="text-sm font-medium text-gray-700">{t('orders.detail.error.solutions')}</span>
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
                    text={t('orders.detail.error.goToQc')}
                    icon="link"
                    type="default"
                    stylingMode="outlined"
                    onClick={() => router.push('/quality/lots')}
                  />
                )}
                <DxButton
                  text={t('orders.detail.error.selectNewLot')}
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
                  text={t('orders.detail.error.close')}
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
    </>
  );
}
