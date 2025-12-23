'use client';

import { useEffect, useState, use, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { cn } from '@/lib/utils/cn';
import PieChart, { Series, Legend, Tooltip, Label } from 'devextreme-react/pie-chart';
import {
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  ShoppingBag,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Eye,
  RefreshCw,
  Printer,
  DollarSign,
  Percent,
  Hospital,
  Pill,
  Store,
  Truck,
  Leaf,
  Sparkles,
  Landmark,
  Globe,
  MoreHorizontal,
  User,
  Hash,
  Receipt,
  BarChart3,
  Activity,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Customer {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  customerType: string;
  creditLimit: number | null;
  creditTermDays: number | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SalesOrder {
  id: number;
  soNumber: string;
  orderDate: string | null;
  requiredDate: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
}

interface Summary {
  totalOrders: number;
  totalAmount: number;
  statusBreakdown: Record<string, number>;
}

interface CustomerDetail {
  customer: Customer;
  recentSalesOrders: SalesOrder[];
  summary: Summary;
}

type TabKey = 'overview' | 'orders' | 'contact' | 'credit';

// ============================================================================
// Customer Type Configuration
// ============================================================================

const CUSTOMER_TYPE_CONFIG: Record<string, {
  label: string;
  labelTh: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  gradient: string;
}> = {
  hospital: {
    label: 'Hospital',
    labelTh: 'โรงพยาบาล',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: Hospital,
    gradient: 'from-red-500 to-rose-600',
  },
  clinic: {
    label: 'Clinic',
    labelTh: 'คลินิก',
    color: '#f97316',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    icon: Pill,
    gradient: 'from-orange-500 to-amber-600',
  },
  pharmacy: {
    label: 'Pharmacy',
    labelTh: 'ร้านขายยา',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: Store,
    gradient: 'from-green-500 to-emerald-600',
  },
  distributor: {
    label: 'Distributor',
    labelTh: 'ตัวแทนจำหน่าย',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: Truck,
    gradient: 'from-blue-500 to-indigo-600',
  },
  traditional_medicine: {
    label: 'Traditional Medicine',
    labelTh: 'แพทย์แผนไทย',
    color: '#a855f7',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    icon: Leaf,
    gradient: 'from-purple-500 to-violet-600',
  },
  spa_wellness: {
    label: 'Spa & Wellness',
    labelTh: 'สปา & เวลเนส',
    color: '#ec4899',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    icon: Sparkles,
    gradient: 'from-pink-500 to-rose-600',
  },
  government: {
    label: 'Government',
    labelTh: 'หน่วยงานรัฐ',
    color: '#6366f1',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-700',
    icon: Landmark,
    gradient: 'from-indigo-500 to-purple-600',
  },
  export: {
    label: 'Export',
    labelTh: 'ส่งออก',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: Globe,
    gradient: 'from-cyan-500 to-teal-600',
  },
  other: {
    label: 'Other',
    labelTh: 'อื่นๆ',
    color: '#64748b',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    icon: MoreHorizontal,
    gradient: 'from-slate-500 to-gray-600',
  },
};

const STATUS_CONFIG: Record<string, {
  label: string;
  labelTh: string;
  bgClass: string;
  textClass: string;
}> = {
  draft: { label: 'Draft', labelTh: 'ร่าง', bgClass: 'bg-slate-100', textClass: 'text-slate-700' },
  confirmed: { label: 'Confirmed', labelTh: 'ยืนยัน', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  processing: { label: 'Processing', labelTh: 'กำลังดำเนินการ', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  ready: { label: 'Ready', labelTh: 'พร้อมส่ง', bgClass: 'bg-violet-100', textClass: 'text-violet-700' },
  shipped: { label: 'Shipped', labelTh: 'จัดส่งแล้ว', bgClass: 'bg-cyan-100', textClass: 'text-cyan-700' },
  delivered: { label: 'Delivered', labelTh: 'ส่งมอบแล้ว', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  cancelled: { label: 'Cancelled', labelTh: 'ยกเลิก', bgClass: 'bg-red-100', textClass: 'text-red-700' },
};

const customerTypeOptions = [
  { value: 'hospital', label: 'Hospital (โรงพยาบาล)' },
  { value: 'clinic', label: 'Clinic (คลินิก)' },
  { value: 'pharmacy', label: 'Pharmacy (ร้านขายยา)' },
  { value: 'distributor', label: 'Distributor (ตัวแทนจำหน่าย)' },
  { value: 'traditional_medicine', label: 'Traditional Medicine Center (ศูนย์การแพทย์แผนไทย)' },
  { value: 'spa_wellness', label: 'Spa & Wellness (สปาและเวลเนส)' },
  { value: 'government', label: 'Government Agency (หน่วยงานราชการ)' },
  { value: 'export', label: 'Export (ส่งออก)' },
  { value: 'other', label: 'Other (อื่นๆ)' },
];

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

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '฿0';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
};

const formatCurrencyShort = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '฿0';
  const num = Number(amount);
  if (num >= 1000000) return `฿${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `฿${(num / 1000).toFixed(0)}K`;
  return `฿${num}`;
};

// ============================================================================
// Main Component
// ============================================================================

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
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
    customerType: 'other',
    creditLimit: '',
    creditTermDays: '',
    paymentTerms: '',
    notes: '',
    isActive: true,
  });

  const fetchCustomerDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers/${resolvedParams.id}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        const c = result.data.customer;
        setEditForm({
          code: c.code || '',
          name: c.name || '',
          contactPerson: c.contactPerson || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          taxId: c.taxId || '',
          customerType: c.customerType || 'other',
          creditLimit: c.creditLimit?.toString() || '',
          creditTermDays: c.creditTermDays?.toString() || '',
          paymentTerms: c.paymentTerms || '',
          notes: c.notes || '',
          isActive: c.isActive ?? true,
        });
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchCustomerDetail();
  }, [fetchCustomerDetail]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/customers/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          creditLimit: editForm.creditLimit ? parseFloat(editForm.creditLimit) : null,
          creditTermDays: editForm.creditTermDays ? parseInt(editForm.creditTermDays) : null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setIsEditDialogOpen(false);
        fetchCustomerDetail();
      } else {
        alert(result.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Failed to update customer:', error);
      alert('Failed to update customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/customers/${resolvedParams.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();

      if (result.success) {
        router.push('/sales/customers');
      } else {
        alert(result.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert('Failed to delete customer');
    } finally {
      setIsSaving(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleViewOrder = useCallback((orderId: number) => {
    router.push(`/sales/orders/${orderId}`);
  }, [router]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!data) return null;
    const { summary, recentSalesOrders } = data;

    const completedOrders = recentSalesOrders.filter(o => o.status === 'delivered').length;
    const pendingOrders = recentSalesOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
    const avgOrderValue = summary.totalOrders > 0 ? summary.totalAmount / summary.totalOrders : 0;

    return {
      completedOrders,
      pendingOrders,
      avgOrderValue,
    };
  }, [data]);

  // Pie chart data for order status
  const orderStatusChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.summary.statusBreakdown).map(([status, count]) => ({
      status: STATUS_CONFIG[status]?.labelTh || status,
      count,
      color: status === 'delivered' ? '#22c55e' :
             status === 'cancelled' ? '#ef4444' :
             status === 'shipped' ? '#06b6d4' :
             status === 'processing' ? '#f59e0b' :
             status === 'confirmed' ? '#3b82f6' : '#94a3b8',
    }));
  }, [data]);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ไม่พบข้อมูลลูกค้า</h2>
          <p className="text-gray-500 mb-6">ไม่พบข้อมูลลูกค้าที่ร้องขอ</p>
          <DxButton
            text="กลับไปหน้ารายการ"
            icon="back"
            type="default"
            onClick={() => router.push('/sales/customers')}
          />
        </div>
      </MainLayout>
    );
  }

  const { customer, recentSalesOrders, summary } = data;
  const typeConfig = CUSTOMER_TYPE_CONFIG[customer.customerType] || CUSTOMER_TYPE_CONFIG.other;
  const TypeIcon = typeConfig.icon;

  // ============================================================================
  // Tabs Configuration
  // ============================================================================

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview', label: 'ภาพรวม', icon: Eye },
    { key: 'orders', label: 'ใบสั่งขาย', icon: ShoppingBag, count: recentSalesOrders.length },
    { key: 'contact', label: 'ข้อมูลติดต่อ', icon: User },
    { key: 'credit', label: 'เครดิต & การชำระ', icon: CreditCard },
  ];

  // ============================================================================
  // DataGrid Columns
  // ============================================================================

  const orderColumns: DxDataGridColumn[] = [
    {
      dataField: 'soNumber',
      caption: 'เลขที่ SO',
      width: 150,
      cellRender: (cellInfo) => (
        <button
          onClick={() => handleViewOrder(cellInfo.data.id)}
          className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {cellInfo.data.soNumber}
        </button>
      ),
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่ง',
      width: 130,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>{formatDate(cellInfo.data.orderDate)}</span>
        </div>
      ),
    },
    {
      dataField: 'requiredDate',
      caption: 'กำหนดส่ง',
      width: 130,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Truck className="h-4 w-4 text-gray-400" />
          <span>{formatDate(cellInfo.data.requiredDate)}</span>
        </div>
      ),
    },
    {
      dataField: 'totalAmount',
      caption: 'มูลค่า',
      width: 140,
      cellRender: (cellInfo) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(cellInfo.data.totalAmount)}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
      cellRender: (cellInfo) => {
        const config = STATUS_CONFIG[cellInfo.data.status] || STATUS_CONFIG.draft;
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
            {config.labelTh}
          </span>
        );
      },
    },
    {
      dataField: 'actions',
      caption: '',
      width: 100,
      cellRender: (cellInfo) => (
        <DxButton
          text="ดู"
          type="normal"
          stylingMode="text"
          icon="arrowright"
          onClick={() => handleViewOrder(cellInfo.data.id)}
        />
      ),
    },
  ];

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Customer Summary */}
      <Card elevation="raised" className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-indigo-500" />
            สรุปการขาย
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-gray-500">ยอดสั่งซื้อทั้งหมด</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">{summary.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <p className="text-xs text-gray-500">ยอดขายรวม</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrencyShort(summary.totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-gray-500">ค่าเฉลี่ยต่อรายการ</p>
              </div>
              <p className="text-2xl font-bold text-purple-600">{formatCurrencyShort(stats?.avgOrderValue || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats?.avgOrderValue || 0)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-xs text-gray-500">ส่งมอบแล้ว</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.completedOrders || 0}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-gray-500">กำลังดำเนินการ</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingOrders || 0}</p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <p className="text-xs text-gray-500">เครดิตเทอม</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{customer.creditTermDays || '-'}</p>
              <p className="text-xs text-gray-500 mt-1">วัน</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Status Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            สถานะคำสั่งซื้อ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {orderStatusChartData.length > 0 ? (
            <PieChart
              dataSource={orderStatusChartData}
              palette="Material"
              type="doughnut"
              innerRadius={0.6}
            >
              <Series
                argumentField="status"
                valueField="count"
              >
                <Label visible={false} />
              </Series>
              <Legend
                orientation="vertical"
                horizontalAlignment="right"
                verticalAlignment="center"
              />
              <Tooltip enabled customizeTooltip={(arg) => ({
                text: `${arg.argument}: ${arg.value} รายการ`,
              })} />
            </PieChart>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <ShoppingBag className="h-12 w-12 text-gray-300 mb-3" />
              <p>ยังไม่มีคำสั่งซื้อ</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      <Card elevation="raised" className="lg:col-span-3">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-gray-500" />
            ข้อมูลทั่วไป
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Hash className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">รหัสลูกค้า</p>
                <p className="font-mono font-semibold text-indigo-600">{customer.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <TypeIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">ประเภท</p>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', typeConfig.bgClass, typeConfig.textClass)}>
                  {typeConfig.labelTh}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Receipt className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">เลขประจำตัวผู้เสียภาษี</p>
                <p className="font-medium">{customer.taxId || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">สร้างเมื่อ</p>
                <p className="font-medium">{formatDate(customer.createdAt)}</p>
              </div>
            </div>
          </div>

          {customer.notes && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-1">หมายเหตุ</p>
              <p className="text-sm text-amber-700">{customer.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderOrdersTab = () => (
    <div className="p-6">
      {recentSalesOrders.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">แสดง {recentSalesOrders.length} รายการล่าสุด</p>
            <DxButton
              text="สร้างใบสั่งขายใหม่"
              icon="plus"
              type="success"
              onClick={() => router.push('/sales/orders/new')}
            />
          </div>
          <DxDataGrid
            dataSource={recentSalesOrders}
            keyExpr="id"
            columns={orderColumns}
            showBorders={false}
            rowAlternationEnabled
            height={450}
            noDataText="ไม่มีใบสั่งขาย"
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="h-10 w-10 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-2">ยังไม่มีใบสั่งขาย</p>
          <p className="text-sm text-gray-400 mb-4">สร้างใบสั่งขายแรกสำหรับลูกค้านี้</p>
          <DxButton
            text="สร้างใบสั่งขาย"
            icon="plus"
            type="success"
            onClick={() => router.push('/sales/orders/new')}
          />
        </div>
      )}
    </div>
  );

  const renderContactTab = () => (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Person */}
        <Card elevation="raised">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-indigo-500" />
              ผู้ติดต่อ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl">
              <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {customer.contactPerson?.charAt(0)?.toUpperCase() || customer.name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-lg truncate">
                  {customer.contactPerson || customer.name}
                </p>
                <p className="text-sm text-gray-500">ผู้ติดต่อหลัก</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">โทรศัพท์</p>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="font-medium text-blue-600 hover:underline">
                      {customer.phone}
                    </a>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">อีเมล</p>
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="font-medium text-green-600 hover:underline">
                      {customer.email}
                    </a>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card elevation="raised">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-5 w-5 text-red-500" />
              ที่อยู่
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="p-4 bg-gray-50 rounded-xl h-full">
              {customer.address ? (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ที่อยู่จัดส่ง</p>
                    <p className="text-gray-900 leading-relaxed">{customer.address}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <MapPin className="h-12 w-12 mb-2" />
                  <p>ยังไม่มีข้อมูลที่อยู่</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCreditTab = () => (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credit Limit */}
        <Card elevation="raised" className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-green-500" />
              วงเงินเครดิต
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">วงเงินเครดิต</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(customer.creditLimit)}</p>
              </div>

              <div className="p-6 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="text-sm text-gray-600">เครดิตเทอม</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {customer.creditTermDays ? `${customer.creditTermDays} วัน` : '-'}
                </p>
              </div>

              <div className="p-6 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-600">เงื่อนไขการชำระ</p>
                </div>
                <p className="text-xl font-semibold text-gray-900">{customer.paymentTerms || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Usage */}
        <Card elevation="raised">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-5 w-5 text-blue-500" />
              การใช้เครดิต
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="12"
                    strokeDasharray={`${0.75 * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">75%</span>
                  <span className="text-xs text-gray-500">ว่าง</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">ใช้ไป: <span className="font-semibold text-gray-900">{formatCurrencyShort((Number(customer.creditLimit) || 0) * 0.25)}</span></p>
                <p className="text-sm text-gray-500">คงเหลือ: <span className="font-semibold text-green-600">{formatCurrencyShort((Number(customer.creditLimit) || 0) * 0.75)}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card elevation="raised" className="lg:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-amber-500" />
              ประวัติการชำระล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Receipt className="h-12 w-12 mb-3" />
              <p className="font-medium">ยังไม่มีข้อมูลการชำระ</p>
              <p className="text-sm">ประวัติการชำระจะแสดงที่นี่</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================================================
  // Edit Dialog Content
  // ============================================================================

  const renderEditDialogContent = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            รหัสลูกค้า <span className="text-red-500">*</span>
          </label>
          <DxTextBox
            value={editForm.code}
            onValueChange={(value) => setEditForm({ ...editForm, code: value })}
            placeholder="กรอกรหัสลูกค้า"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อลูกค้า <span className="text-red-500">*</span>
          </label>
          <DxTextBox
            value={editForm.name}
            onValueChange={(value) => setEditForm({ ...editForm, name: value })}
            placeholder="กรอกชื่อลูกค้า"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ผู้ติดต่อ
          </label>
          <DxTextBox
            value={editForm.contactPerson}
            onValueChange={(value) => setEditForm({ ...editForm, contactPerson: value })}
            placeholder="กรอกชื่อผู้ติดต่อ"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            โทรศัพท์
          </label>
          <DxTextBox
            value={editForm.phone}
            onValueChange={(value) => setEditForm({ ...editForm, phone: value })}
            placeholder="กรอกเบอร์โทรศัพท์"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            อีเมล
          </label>
          <DxTextBox
            value={editForm.email}
            onValueChange={(value) => setEditForm({ ...editForm, email: value })}
            placeholder="กรอกอีเมล"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เลขประจำตัวผู้เสียภาษี
          </label>
          <DxTextBox
            value={editForm.taxId}
            onValueChange={(value) => setEditForm({ ...editForm, taxId: value })}
            placeholder="กรอก Tax ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ประเภทลูกค้า
          </label>
          <DxSelectBox
            items={customerTypeOptions}
            value={editForm.customerType}
            onValueChange={(value) => setEditForm({ ...editForm, customerType: value })}
            valueExpr="value"
            displayExpr="label"
            placeholder="เลือกประเภท"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            วงเงินเครดิต
          </label>
          <DxTextBox
            value={editForm.creditLimit}
            onValueChange={(value) => setEditForm({ ...editForm, creditLimit: value })}
            placeholder="กรอกวงเงินเครดิต"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เครดิตเทอม (วัน)
          </label>
          <DxTextBox
            value={editForm.creditTermDays}
            onValueChange={(value) => setEditForm({ ...editForm, creditTermDays: value })}
            placeholder="กรอกจำนวนวัน"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เงื่อนไขการชำระ
          </label>
          <DxTextBox
            value={editForm.paymentTerms}
            onValueChange={(value) => setEditForm({ ...editForm, paymentTerms: value })}
            placeholder="เช่น Net 30"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ที่อยู่
          </label>
          <DxTextBox
            value={editForm.address}
            onValueChange={(value) => setEditForm({ ...editForm, address: value })}
            placeholder="กรอกที่อยู่"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            หมายเหตุ
          </label>
          <DxTextBox
            value={editForm.notes}
            onValueChange={(value) => setEditForm({ ...editForm, notes: value })}
            placeholder="กรอกหมายเหตุ"
          />
        </div>
        <div className="md:col-span-2">
          <DxCheckBox
            value={editForm.isActive}
            onValueChange={(value) => setEditForm({ ...editForm, isActive: value })}
            text="ใช้งาน"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <DxButton
          text="ยกเลิก"
          type="normal"
          stylingMode="outlined"
          onClick={() => setIsEditDialogOpen(false)}
        />
        <DxButton
          text={isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          type="success"
          onClick={handleSave}
          disabled={isSaving}
        />
      </div>
    </div>
  );

  // ============================================================================
  // Delete Dialog Content
  // ============================================================================

  const renderDeleteDialogContent = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl">
        <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <p className="font-semibold text-red-800">ยืนยันการลบลูกค้า</p>
          <p className="text-sm text-red-600">
            หากลูกค้ามีใบสั่งขายที่เกี่ยวข้อง จะถูกปิดใช้งานแทนการลบ
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <DxButton
          text="ยกเลิก"
          type="normal"
          stylingMode="outlined"
          onClick={() => setIsDeleteDialogOpen(false)}
        />
        <DxButton
          text={isSaving ? 'กำลังลบ...' : 'ลบ'}
          type="danger"
          onClick={handleDelete}
          disabled={isSaving}
        />
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Hero Header */}
        <div className={cn('relative overflow-hidden rounded-xl bg-gradient-to-r', typeConfig.gradient)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <TypeIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                      {typeConfig.labelTh}
                    </span>
                    {!customer.isActive && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/80 text-white flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        ปิดใช้งาน
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-white/80 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-4 w-4" />
                      <span className="font-mono">{customer.code}</span>
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DxButton
                  text="กลับ"
                  icon="back"
                  type="normal"
                  stylingMode="text"
                  onClick={() => router.push('/sales/customers')}
                  elementAttr={{ class: 'text-white hover:bg-white/20' }}
                />
                <button
                  onClick={() => fetchCustomerDetail()}
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
                <DxButton
                  text="แก้ไข"
                  icon="edit"
                  type="default"
                  onClick={() => setIsEditDialogOpen(true)}
                />
                <DxButton
                  icon="trash"
                  type="danger"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  hint="ลบลูกค้า"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-blue-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ยอดสั่งซื้อ</p>
                      <p className="text-lg font-bold text-blue-600">{summary.totalOrders}</p>
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
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ยอดขายรวม</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrencyShort(summary.totalAmount)}</p>
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
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">วงเงินเครดิต</p>
                      <p className="text-lg font-bold text-purple-600">{formatCurrencyShort(customer.creditLimit)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className={cn('w-1', customer.isActive ? 'bg-emerald-500' : 'bg-amber-500')} />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', customer.isActive ? 'bg-emerald-100' : 'bg-amber-100')}>
                      <CheckCircle className={cn('h-5 w-5', customer.isActive ? 'text-emerald-600' : 'text-amber-600')} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">สถานะ</p>
                      <p className={cn('text-lg font-bold', customer.isActive ? 'text-emerald-600' : 'text-amber-600')}>
                        {customer.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
            {activeTab === 'orders' && renderOrdersTab()}
            {activeTab === 'contact' && renderContactTab()}
            {activeTab === 'credit' && renderCreditTab()}
          </div>
        </Card>
      </div>

      {/* Edit Dialog */}
      <DxPopup
        visible={isEditDialogOpen}
        onHiding={() => setIsEditDialogOpen(false)}
        title="แก้ไขข้อมูลลูกค้า"
        width={700}
        height="auto"
        showCloseButton
      >
        {renderEditDialogContent()}
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxPopup
        visible={isDeleteDialogOpen}
        onHiding={() => setIsDeleteDialogOpen(false)}
        title="ลบลูกค้า"
        width={450}
        height="auto"
        showCloseButton
      >
        {renderDeleteDialogContent()}
      </DxPopup>
    </MainLayout>
  );
}
