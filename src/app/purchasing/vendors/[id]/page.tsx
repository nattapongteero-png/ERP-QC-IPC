'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock,
  CreditCard,
  ShoppingCart,
  Package,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Edit,
  Trash2,
  User,
  XCircle,
  Link2,
  TrendingUp,
  Calendar,
  BarChart3,
  Star,
  Truck,
} from 'lucide-react';

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  isApproved: boolean;
  isVMI: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  orderDate: string | null;
  expectedDate: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
}

interface ApprovedItem {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  itemNameEn: string | null;
  approvalDate: string | null;
  expiryDate: string | null;
  isPreferred: boolean;
}

interface Summary {
  totalOrders: number;
  totalAmount: number;
  approvedItemsCount: number;
  statusBreakdown: Record<string, number>;
}

interface VendorDetail {
  vendor: Vendor;
  recentPurchaseOrders: PurchaseOrder[];
  approvedItems: ApprovedItem[];
  summary: Summary;
}

type TabKey = 'overview' | 'orders' | 'items';

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Cash', text: 'Cash' },
  { value: 'Net 7', text: 'Net 7 วัน' },
  { value: 'Net 15', text: 'Net 15 วัน' },
  { value: 'Net 30', text: 'Net 30 วัน' },
  { value: 'Net 45', text: 'Net 45 วัน' },
  { value: 'Net 60', text: 'Net 60 วัน' },
  { value: 'Net 90', text: 'Net 90 วัน' },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; labelTh: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft', labelTh: 'แบบร่าง' },
  pending_approval: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending', labelTh: 'รออนุมัติ' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', labelTh: 'อนุมัติ' },
  ordered: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ordered', labelTh: 'สั่งซื้อแล้ว' },
  partial: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Partial', labelTh: 'รับบางส่วน' },
  received: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Received', labelTh: 'รับครบ' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled', labelTh: 'ยกเลิก' },
};

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<VendorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    code: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    leadTimeDays: null as number | null,
    paymentTerms: '',
    isApproved: false,
    isVMI: false,
    isActive: true,
  });

  const fetchVendorDetail = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vendors/${resolvedParams.id}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        const v = result.data.vendor;
        setEditForm({
          code: v.code || '',
          name: v.name || '',
          contactPerson: v.contactPerson || '',
          phone: v.phone || '',
          email: v.email || '',
          address: v.address || '',
          taxId: v.taxId || '',
          leadTimeDays: v.leadTimeDays ?? null,
          paymentTerms: v.paymentTerms || '',
          isApproved: v.isApproved || false,
          isVMI: v.isVMI || false,
          isActive: v.isActive ?? true,
        });
      } else {
        console.error('Failed to fetch vendor:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch vendor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/vendors/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await res.json();

      if (result.success) {
        setIsEditDialogOpen(false);
        fetchVendorDetail();
      } else {
        alert(result.error || 'Failed to update vendor');
      }
    } catch (error) {
      console.error('Failed to update vendor:', error);
      alert('Failed to update vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/vendors/${resolvedParams.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();

      if (result.success) {
        router.push('/purchasing/vendors');
      } else {
        alert(result.error || 'Failed to delete vendor');
      }
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      alert('Failed to delete vendor');
    } finally {
      setIsSaving(false);
      setIsDeleteDialogOpen(false);
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

  const formatCurrency = (amount: number | null, currency: string = 'THB') => {
    if (amount === null || amount === 0) return '฿0';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status, labelTh: status };
  };

  // Loading State
  if (isLoading) {
    return (
      <>
        <div className="space-y-6">
          <div className="h-40 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </>
    );
  }

  // Not Found State
  if (!data) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ไม่พบข้อมูลผู้ขาย</h2>
          <p className="text-gray-500 mb-6">ไม่พบข้อมูลผู้ขายที่ระบุในระบบ</p>
          <DxButton
            text="กลับหน้ารายการผู้ขาย"
            icon="back"
            type="default"
            onClick={() => router.push('/purchasing/vendors')}
          />
        </div>
      </>
    );
  }

  const { vendor, recentPurchaseOrders, approvedItems, summary } = data;

  // Determine vendor status styling
  const getVendorStatusStyle = () => {
    if (!vendor.isActive) {
      return { bg: 'from-gray-500 to-gray-600', icon: <XCircle className="h-6 w-6" />, label: 'ไม่ใช้งาน' };
    }
    if (vendor.isVMI) {
      return { bg: 'from-blue-500 to-blue-600', icon: <Link2 className="h-6 w-6" />, label: 'VMI Vendor' };
    }
    if (vendor.isApproved) {
      return { bg: 'from-green-500 to-green-600', icon: <CheckCircle className="h-6 w-6" />, label: 'อนุมัติแล้ว' };
    }
    return { bg: 'from-yellow-500 to-yellow-600', icon: <Clock className="h-6 w-6" />, label: 'รออนุมัติ' };
  };

  const statusStyle = getVendorStatusStyle();

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'overview', label: 'ภาพรวม', icon: <Building2 className="h-4 w-4" /> },
    { key: 'orders', label: 'ใบสั่งซื้อ', icon: <ShoppingCart className="h-4 w-4" />, count: recentPurchaseOrders.length },
    { key: 'items', label: 'รายการสินค้า AVL', icon: <Package className="h-4 w-4" />, count: approvedItems.length },
  ];

  const poColumns: DxDataGridColumn[] = [
    {
      dataField: 'poNumber',
      caption: 'เลขที่ PO',
      width: 140,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <span className="font-mono font-semibold text-blue-600">{cellInfo.data.poNumber}</span>
        </div>
      ),
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่งซื้อ',
      width: 140,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm">{formatDate(cellInfo.data.orderDate)}</span>
        </div>
      ),
    },
    {
      dataField: 'expectedDate',
      caption: 'วันที่คาดรับ',
      width: 140,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Truck className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm">{formatDate(cellInfo.data.expectedDate)}</span>
        </div>
      ),
    },
    {
      dataField: 'totalAmount',
      caption: 'มูลค่า',
      width: 140,
      cellRender: (cellInfo) => (
        <span className="font-semibold text-gray-900">
          {formatCurrency(cellInfo.data.totalAmount, cellInfo.data.currency)}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
      cellRender: (cellInfo) => {
        const config = getStatusConfig(cellInfo.data.status);
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
            {config.labelTh}
          </span>
        );
      },
    },
  ];

  const itemColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'รหัสสินค้า',
      width: 130,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Package className="h-4 w-4 text-purple-600" />
          </div>
          <span className="font-mono font-semibold text-gray-900">{cellInfo.data.itemCode || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'itemName',
      caption: 'ชื่อสินค้า (TH)',
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div>
          <span className="font-medium text-gray-800">{cellInfo.data.itemName || '-'}</span>
          {cellInfo.data.itemNameEn && (
            <span className="block text-xs text-gray-500">{cellInfo.data.itemNameEn}</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'approvalDate',
      caption: 'วันที่อนุมัติ',
      width: 130,
      cellRender: (cellInfo) => (
        <span className="text-sm text-gray-600">{formatDate(cellInfo.data.approvalDate)}</span>
      ),
    },
    {
      dataField: 'expiryDate',
      caption: 'วันหมดอายุ',
      width: 130,
      cellRender: (cellInfo) => {
        const expiry = cellInfo.data.expiryDate;
        if (!expiry) return <span className="text-gray-400">-</span>;
        const isExpired = new Date(expiry) < new Date();
        return (
          <span className={cn('text-sm', isExpired ? 'text-red-600 font-medium' : 'text-gray-600')}>
            {formatDate(expiry)}
          </span>
        );
      },
    },
    {
      dataField: 'isPreferred',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) =>
        cellInfo.data.isPreferred ? (
          <div className="flex items-center gap-1.5 text-amber-600">
            <Star className="h-4 w-4 fill-amber-500" />
            <span className="text-sm font-medium">ต้องการหลัก</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">ทั่วไป</span>
        ),
    },
  ];

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contact Information */}
      <Card elevation="raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-blue-500" />
            ข้อมูลติดต่อ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">ผู้ติดต่อ</p>
                <p className="font-medium text-gray-900">{vendor.contactPerson || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">โทรศัพท์</p>
                <p className="font-medium text-gray-900">{vendor.phone || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">อีเมล</p>
                <p className="font-medium text-gray-900">{vendor.email || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">ที่อยู่</p>
                <p className="font-medium text-gray-900">{vendor.address || '-'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Information */}
      <Card elevation="raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-purple-500" />
            ข้อมูลธุรกิจ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">เลขประจำตัวผู้เสียภาษี</p>
                <p className="font-medium text-gray-900 font-mono">{vendor.taxId || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Truck className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Lead Time</p>
                <p className="font-medium text-gray-900">
                  {vendor.leadTimeDays ? (
                    <span className={cn(
                      vendor.leadTimeDays <= 7 ? 'text-green-600' :
                      vendor.leadTimeDays <= 14 ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {vendor.leadTimeDays} วัน
                    </span>
                  ) : '-'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">เงื่อนไขการชำระเงิน</p>
                <p className="font-medium text-gray-900">{vendor.paymentTerms || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">วันที่สร้าง</p>
                <p className="font-medium text-gray-900">{formatDate(vendor.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Status Breakdown */}
      {Object.keys(summary.statusBreakdown).length > 0 && (
        <Card elevation="raised" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-green-500" />
              สถิติใบสั่งซื้อตามสถานะ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(summary.statusBreakdown).map(([status, count]) => {
                const config = getStatusConfig(status);
                return (
                  <div key={status} className={cn('p-4 rounded-xl', config.bg)}>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className={cn('text-sm font-medium', config.text)}>{config.labelTh}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Hero Header */}
        <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-r', statusStyle.bg)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Back Button */}
                <button
                  onClick={() => router.push('/purchasing/vendors')}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                {/* Vendor Avatar */}
                <div className="h-16 w-16 sm:h-20 sm:w-20 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold text-white">
                    {vendor.name?.charAt(0)?.toUpperCase() || 'V'}
                  </span>
                </div>

                {/* Vendor Info */}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{vendor.name}</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-mono text-white">
                      {vendor.code}
                    </span>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                      {statusStyle.icon}
                      <span>{statusStyle.label}</span>
                    </div>
                    {vendor.isVMI && vendor.isApproved && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>อนุมัติแล้ว</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <DxButton
                  icon="edit"
                  hint="แก้ไข"
                  type="normal"
                  stylingMode="contained"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="!bg-white/20 hover:!bg-white/30 !text-white !border-transparent"
                />
                <DxButton
                  icon="trash"
                  hint="ลบ"
                  type="danger"
                  stylingMode="contained"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="!bg-white/20 hover:!bg-red-500 !text-white !border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-blue-500" />
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ใบสั่งซื้อทั้งหมด</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.totalOrders}</p>
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
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">มูลค่ารวม</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
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
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">รายการใน AVL</p>
                      <p className="text-2xl font-bold text-gray-900">{summary.approvedItemsCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-cyan-500" />
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                      <Truck className="h-6 w-6 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Lead Time</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {vendor.leadTimeDays ? `${vendor.leadTimeDays} วัน` : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Content */}
        <Card elevation="raised">
          <CardHeader className="border-b pb-0">
            <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-thin">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap',
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-semibold',
                        activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {activeTab === 'overview' && renderOverviewTab()}

            {activeTab === 'orders' && (
              recentPurchaseOrders.length > 0 ? (
                <DxDataGrid
                  dataSource={recentPurchaseOrders}
                  keyExpr="id"
                  columns={poColumns}
                  showBorders={false}
                  rowAlternationEnabled
                  height={450}
                  onRowClick={(e) => {
                    if (e.data) {
                      router.push(`/purchasing/orders/${e.data.id}`);
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingCart className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ยังไม่มีใบสั่งซื้อ</h3>
                  <p className="text-gray-500 max-w-md">ยังไม่มีใบสั่งซื้อที่บันทึกกับผู้ขายรายนี้</p>
                </div>
              )
            )}

            {activeTab === 'items' && (
              approvedItems.length > 0 ? (
                <DxDataGrid
                  dataSource={approvedItems}
                  keyExpr="id"
                  columns={itemColumns}
                  showBorders={false}
                  rowAlternationEnabled
                  height={450}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Package className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ยังไม่มีรายการใน AVL</h3>
                  <p className="text-gray-500 max-w-md">ยังไม่มีสินค้าที่อนุมัติให้สั่งซื้อจากผู้ขายรายนี้</p>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <DxPopup
        visible={isEditDialogOpen}
        onHiding={() => setIsEditDialogOpen(false)}
        title="แก้ไขข้อมูลผู้ขาย"
        width={750}
        height="auto"
        showCloseButton
      >
        <div className="space-y-6">
          {/* Basic Info Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              ข้อมูลพื้นฐาน
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสผู้ขาย <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={editForm.code}
                  onValueChange={(value) => setEditForm({ ...editForm, code: value })}
                  placeholder="VND-XXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ขาย <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={editForm.name}
                  onValueChange={(value) => setEditForm({ ...editForm, name: value })}
                  placeholder="ชื่อบริษัท/ร้านค้า"
                />
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              ข้อมูลติดต่อ
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label>
                <DxTextBox
                  value={editForm.contactPerson}
                  onValueChange={(value) => setEditForm({ ...editForm, contactPerson: value })}
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">โทรศัพท์</label>
                <DxTextBox
                  value={editForm.phone}
                  onValueChange={(value) => setEditForm({ ...editForm, phone: value })}
                  placeholder="0XX-XXX-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                <DxTextBox
                  value={editForm.email}
                  onValueChange={(value) => setEditForm({ ...editForm, email: value })}
                  placeholder="email@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
                <DxTextBox
                  value={editForm.taxId}
                  onValueChange={(value) => setEditForm({ ...editForm, taxId: value })}
                  placeholder="เลข 13 หลัก"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                <DxTextArea
                  value={editForm.address}
                  onValueChange={(value) => setEditForm({ ...editForm, address: value })}
                  placeholder="ที่อยู่เต็ม"
                  height={80}
                />
              </div>
            </div>
          </div>

          {/* Business Terms Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              เงื่อนไขทางธุรกิจ
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (วัน)</label>
                <DxNumberBox
                  value={editForm.leadTimeDays}
                  onValueChange={(value) => setEditForm({ ...editForm, leadTimeDays: value })}
                  min={0}
                  max={365}
                  showSpinButtons
                  placeholder="จำนวนวัน"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เงื่อนไขการชำระเงิน</label>
                <DxSelectBox
                  dataSource={PAYMENT_TERMS_OPTIONS}
                  value={editForm.paymentTerms}
                  onValueChange={(value) => setEditForm({ ...editForm, paymentTerms: value })}
                  displayExpr="text"
                  valueExpr="value"
                  placeholder="เลือกเงื่อนไข"
                  searchEnabled
                />
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              สถานะ
            </h4>
            <div className="flex flex-wrap gap-6 p-4 bg-gray-50 rounded-lg">
              <DxCheckBox
                value={editForm.isApproved}
                onValueChange={(value) => setEditForm({ ...editForm, isApproved: value })}
                text="ผู้ขายที่อนุมัติแล้ว"
              />
              <DxCheckBox
                value={editForm.isVMI}
                onValueChange={(value) => setEditForm({ ...editForm, isVMI: value })}
                text="VMI Vendor"
              />
              <DxCheckBox
                value={editForm.isActive}
                onValueChange={(value) => setEditForm({ ...editForm, isActive: value })}
                text="ใช้งาน"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setIsEditDialogOpen(false)}
            />
            <DxButton
              text={isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={isSaving || !editForm.code || !editForm.name}
            />
          </div>
        </div>
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxPopup
        visible={isDeleteDialogOpen}
        onHiding={() => setIsDeleteDialogOpen(false)}
        title="ลบผู้ขาย"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">ยืนยันการลบ?</h4>
              <p className="text-sm text-gray-600 mt-1">
                คุณต้องการลบผู้ขาย <strong>{vendor.name}</strong> ({vendor.code}) ใช่หรือไม่?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                หากผู้ขายมีใบสั่งซื้อที่เกี่ยวข้อง ระบบจะทำการปิดใช้งานแทนการลบ
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setIsDeleteDialogOpen(false)}
            />
            <DxButton
              text={isSaving ? 'กำลังลบ...' : 'ลบผู้ขาย'}
              icon="trash"
              type="danger"
              onClick={handleDelete}
              disabled={isSaving}
            />
          </div>
        </div>
      </DxPopup>
    </>
  );
}
