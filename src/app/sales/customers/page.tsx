'use client';

/**
 * Customers Page - Redesigned Dashboard
 *
 * Professional dashboard for managing customer information.
 * Features 3 view modes, KPI stats, pie charts, and analytics.
 *
 * Feature: Sales Module
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils/cn';
import {
  Users,
  Building2,
  Hospital,
  Pill,
  Truck,
  Leaf,
  Sparkles,
  Landmark,
  Globe,
  HelpCircle,
  UserCheck,
  UserX,
  CreditCard,
  TrendingUp,
  BarChart3,
  LayoutGrid,
  List,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  Inbox,
  Star,
  Award,
} from 'lucide-react';
import PieChart, { Series, Legend, Tooltip, Label } from 'devextreme-react/pie-chart';
import type { DataGridTypes } from 'devextreme-react/data-grid';

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
  customerType: string;
  creditLimit: number | null;
  creditTermDays: number | null;
  paymentTerms: string | null;
  isActive: boolean;
  createdAt: string;
}

type ViewMode = 'grid' | 'cards' | 'analytics';
type StatusFilter = 'all' | 'active' | 'inactive';

// ============================================================================
// Configuration Constants
// ============================================================================

const CUSTOMER_TYPE_CONFIG: Record<string, {
  label: string;
  labelTh: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
}> = {
  hospital: {
    label: 'Hospital',
    labelTh: 'โรงพยาบาล',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: Hospital,
    badgeVariant: 'danger',
  },
  clinic: {
    label: 'Clinic',
    labelTh: 'คลินิก',
    color: '#f97316',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    icon: Building2,
    badgeVariant: 'warning',
  },
  pharmacy: {
    label: 'Pharmacy',
    labelTh: 'ร้านขายยา',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: Pill,
    badgeVariant: 'success',
  },
  distributor: {
    label: 'Distributor',
    labelTh: 'ตัวแทนจำหน่าย',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: Truck,
    badgeVariant: 'info',
  },
  traditional_medicine: {
    label: 'Traditional Medicine',
    labelTh: 'แพทย์แผนไทย',
    color: '#84cc16',
    bgClass: 'bg-lime-100',
    textClass: 'text-lime-700',
    icon: Leaf,
    badgeVariant: 'success',
  },
  spa_wellness: {
    label: 'Spa & Wellness',
    labelTh: 'สปา & เวลเนส',
    color: '#ec4899',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    icon: Sparkles,
    badgeVariant: 'primary',
  },
  government: {
    label: 'Government',
    labelTh: 'หน่วยงานรัฐ',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Landmark,
    badgeVariant: 'secondary',
  },
  export: {
    label: 'Export',
    labelTh: 'ส่งออก',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: Globe,
    badgeVariant: 'info',
  },
  other: {
    label: 'Other',
    labelTh: 'อื่นๆ',
    color: '#6b7280',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    icon: HelpCircle,
    badgeVariant: 'default',
  },
};

const customerTypeOptions = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'hospital', label: 'โรงพยาบาล' },
  { value: 'clinic', label: 'คลินิก' },
  { value: 'pharmacy', label: 'ร้านขายยา' },
  { value: 'distributor', label: 'ตัวแทนจำหน่าย' },
  { value: 'traditional_medicine', label: 'แพทย์แผนไทย' },
  { value: 'spa_wellness', label: 'สปา & เวลเนส' },
  { value: 'government', label: 'หน่วยงานรัฐ' },
  { value: 'export', label: 'ส่งออก' },
  { value: 'other', label: 'อื่นๆ' },
];

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '฿0';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCurrencyShort = (amount: number | null | undefined) => {
  const safeAmount = Number(amount) || 0;
  if (safeAmount >= 1000000) {
    return `฿${(safeAmount / 1000000).toFixed(1)}M`;
  }
  if (safeAmount >= 1000) {
    return `฿${(safeAmount / 1000).toFixed(0)}K`;
  }
  return `฿${safeAmount.toFixed(0)}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getTypeConfig = (type: string) => {
  return CUSTOMER_TYPE_CONFIG[type] || CUSTOMER_TYPE_CONFIG.other;
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchCustomers(): Promise<Customer[]> {
  const params = new URLSearchParams();
  params.set('limit', '1000');

  const response = await fetch(`/api/customers?${params}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch customers');
  }

  return data.data?.items || [];
}

// ============================================================================
// Main Component
// ============================================================================

export default function CustomersPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Data fetching with React Query
  const { data: customers = [], isLoading, refetch } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    staleTime: 30 * 1000,
  });

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch = !search ||
        customer.code?.toLowerCase().includes(search.toLowerCase()) ||
        customer.name?.toLowerCase().includes(search.toLowerCase()) ||
        customer.email?.toLowerCase().includes(search.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(search.toLowerCase());

      const matchesType = !typeFilter || customer.customerType === typeFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && customer.isActive) ||
        (statusFilter === 'inactive' && !customer.isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [customers, search, typeFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.isActive).length;
    const inactive = customers.filter(c => !c.isActive).length;

    const totalCreditLimit = customers.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0);
    const avgCreditLimit = total > 0 ? totalCreditLimit / total : 0;

    const byType: Record<string, number> = {};
    customers.forEach(c => {
      byType[c.customerType] = (byType[c.customerType] || 0) + 1;
    });

    const creditByType: Record<string, number> = {};
    customers.forEach(c => {
      creditByType[c.customerType] = (creditByType[c.customerType] || 0) + (Number(c.creditLimit) || 0);
    });

    // Get top customer type
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

    // Customers with high credit
    const highCredit = customers.filter(c => (Number(c.creditLimit) || 0) >= 1000000).length;

    // Recent customers (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCustomers = customers.filter(c => new Date(c.createdAt) >= thirtyDaysAgo).length;

    return {
      total,
      active,
      inactive,
      totalCreditLimit,
      avgCreditLimit,
      byType,
      creditByType,
      topType: topType ? { type: topType[0], count: topType[1] } : null,
      highCredit,
      recentCustomers,
    };
  }, [customers]);

  // Status counts for tabs
  const statusCounts = useMemo(() => ({
    all: customers.length,
    active: stats.active,
    inactive: stats.inactive,
  }), [customers.length, stats.active, stats.inactive]);

  // Chart data for type distribution
  const typeChartData = useMemo(() => {
    return Object.entries(stats.byType)
      .map(([type, count]) => {
        const config = getTypeConfig(type);
        return {
          type: config.labelTh,
          count,
          color: config.color,
        };
      })
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [stats.byType]);

  // Chart data for credit by type
  const creditChartData = useMemo(() => {
    return Object.entries(stats.creditByType)
      .map(([type, credit]) => {
        const config = getTypeConfig(type);
        return {
          type: config.labelTh,
          credit,
          color: config.color,
        };
      })
      .filter(item => item.credit > 0)
      .sort((a, b) => b.credit - a.credit);
  }, [stats.creditByType]);

  // Top customers by credit limit
  const topCustomers = useMemo(() => {
    return [...customers]
      .filter(c => c.creditLimit && c.creditLimit > 0)
      .sort((a, b) => (b.creditLimit || 0) - (a.creditLimit || 0))
      .slice(0, 5);
  }, [customers]);

  // Recent customers
  const recentCustomersList = useMemo(() => {
    return [...customers]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [customers]);

  // Navigation handler
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/sales/customers/${e.data.id}`);
    }
  }, [router]);

  const handleCustomerClick = useCallback((id: number) => {
    router.push(`/sales/customers/${id}`);
  }, [router]);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'code',
      caption: 'รหัส',
      width: 110,
      cellRender: (data: { data: Customer }) => {
        const config = getTypeConfig(data.data.customerType);
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', config.bgClass)}>
              <Icon className={cn('h-4 w-4', config.textClass)} />
            </div>
            <span className="font-mono font-semibold text-blue-600">{data.data.code}</span>
          </div>
        );
      },
    },
    {
      dataField: 'name',
      caption: 'ชื่อลูกค้า',
      minWidth: 200,
      cellRender: (data: { data: Customer }) => (
        <div className="min-w-0">
          <span className="font-medium text-gray-800 truncate block">{data.data.name}</span>
          {data.data.contactPerson && (
            <span className="text-xs text-gray-500 truncate block">{data.data.contactPerson}</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'phone',
      caption: 'โทรศัพท์',
      width: 130,
      cellRender: (data: { data: Customer }) => (
        <div className="flex items-center gap-2 text-gray-600">
          {data.data.phone ? (
            <>
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm">{data.data.phone}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'email',
      caption: 'อีเมล',
      width: 180,
      hideOnMobile: true,
      cellRender: (data: { data: Customer }) => (
        <div className="flex items-center gap-2 text-gray-600">
          {data.data.email ? (
            <>
              <Mail className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm truncate">{data.data.email}</span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'creditLimit',
      caption: 'วงเงินเครดิต',
      width: 140,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (data: { data: Customer }) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(data.data.creditLimit)}
        </span>
      ),
    },
    {
      dataField: 'customerType',
      caption: 'ประเภท',
      width: 150,
      cellRender: (data: { data: Customer }) => {
        const config = getTypeConfig(data.data.customerType);
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
            {config.labelTh}
          </span>
        );
      },
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 100,
      cellRender: (data: { data: Customer }) => (
        <Badge variant={data.data.isActive ? 'success' : 'danger'} dot>
          {data.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
  ], []);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderCustomerCard = (customer: Customer) => {
    const config = getTypeConfig(customer.customerType);
    const Icon = config.icon;

    return (
      <Card
        key={customer.id}
        elevation="raised"
        className="cursor-pointer transition-all hover:shadow-lg overflow-hidden"
        onClick={() => handleCustomerClick(customer.id)}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch">
            <div className="w-1" style={{ backgroundColor: config.color }} />
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', config.bgClass)}>
                    <Icon className={cn('h-5 w-5', config.textClass)} />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-blue-600">{customer.code}</p>
                    <p className="font-semibold text-gray-900">{customer.name}</p>
                  </div>
                </div>
                <Badge variant={customer.isActive ? 'success' : 'danger'} dot>
                  {customer.isActive ? 'ใช้งาน' : 'ปิด'}
                </Badge>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                {customer.contactPerson && (
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    <span>{customer.contactPerson}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
                  {config.labelTh}
                </span>
                {customer.creditLimit ? (
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrencyShort(customer.creditLimit)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCharts = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Type Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            การกระจายตามประเภท
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {typeChartData.length > 0 ? (
            <PieChart
              id="type-pie"
              dataSource={typeChartData}
              type="doughnut"
              palette={typeChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 220 }}
            >
              <Series argumentField="type" valueField="count">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${arg.valueText} ราย`
              })} />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            วงเงินเครดิตตามประเภท
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {creditChartData.length > 0 ? (
            <PieChart
              id="credit-pie"
              dataSource={creditChartData}
              type="doughnut"
              palette={creditChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 220 }}
            >
              <Series argumentField="type" valueField="credit">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${formatCurrency(arg.value as number)}`
              })} />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderGridView = () => (
    <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        {filteredCustomers.length > 0 || isLoading ? (
          <DxDataGrid
            dataSource={filteredCustomers}
            keyExpr="id"
            columns={columns}
            loading={isLoading}
            sorting
            filterRow
            headerFilter
            export
            exportFileName="customers"
            columnChooser
            virtualScrolling={filteredCustomers.length > 100}
            fillHeight
            onRowClick={handleRowClick}
            noDataText="ไม่พบลูกค้า"
            rowAlternationEnabled
          />
        ) : (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="ไม่พบลูกค้า"
            description="เริ่มต้นด้วยการเพิ่มลูกค้าใหม่"
            action={{
              label: 'เพิ่มลูกค้า',
              onClick: () => router.push('/sales/customers/new'),
            }}
          />
        )}
      </CardContent>
    </Card>
  );

  const renderCardsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
      {/* Main Content */}
      <div className="lg:col-span-3 space-y-4">
        {renderCharts()}

        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              ลูกค้าที่กรองแล้ว ({filteredCustomers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredCustomers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCustomers.slice(0, 10).map(renderCustomerCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                ไม่พบลูกค้าที่ตรงกับเงื่อนไข
              </div>
            )}
            {filteredCustomers.length > 10 && (
              <div className="mt-4 text-center">
                <DxButton
                  text={`ดูเพิ่มเติมอีก ${filteredCustomers.length - 10} ราย`}
                  type="normal"
                  onClick={() => setViewMode('grid')}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              สรุปรวม
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">วงเงินเครดิตรวม</span>
              <span className="font-semibold text-green-600">{formatCurrencyShort(stats.totalCreditLimit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">เครดิตเฉลี่ย</span>
              <span className="font-semibold text-blue-600">{formatCurrencyShort(stats.avgCreditLimit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">วงเงินสูง (≥1M)</span>
              <span className="font-semibold">{stats.highCredit} ราย</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">ลูกค้าใหม่ (30 วัน)</span>
              <span className="font-semibold text-emerald-600">{stats.recentCustomers} ราย</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              วงเงินเครดิตสูงสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topCustomers.map((customer, idx) => {
                const config = getTypeConfig(customer.customerType);
                return (
                  <div
                    key={customer.id}
                    className="p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-l-2"
                    style={{ borderLeftColor: config.color }}
                    onClick={() => handleCustomerClick(customer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                          {idx + 1}
                        </div>
                        <p className="font-mono text-xs text-blue-600">{customer.code}</p>
                      </div>
                      <p className="text-xs font-semibold text-green-600">{formatCurrencyShort(customer.creditLimit)}</p>
                    </div>
                    <p className="text-sm truncate mt-1">{customer.name}</p>
                  </div>
                );
              })}
              {topCustomers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ไม่มีข้อมูล</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Customers */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              ล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentCustomersList.map((customer) => {
                const config = getTypeConfig(customer.customerType);
                return (
                  <div
                    key={customer.id}
                    className="p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-l-2"
                    style={{ borderLeftColor: config.color }}
                    onClick={() => handleCustomerClick(customer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-blue-600">{customer.code}</p>
                      <Badge variant={customer.isActive ? 'success' : 'danger'} className="text-xs">
                        {customer.isActive ? 'ใช้งาน' : 'ปิด'}
                      </Badge>
                    </div>
                    <p className="text-sm truncate">{customer.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(customer.createdAt)}</p>
                  </div>
                );
              })}
              {recentCustomersList.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ไม่มีข้อมูล</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-4 flex-1">
      {/* Full-width Charts */}
      {renderCharts()}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type Breakdown */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              สรุปตามประเภท
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {Object.entries(CUSTOMER_TYPE_CONFIG).map(([key, config]) => {
                const count = stats.byType[key] || 0;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                const Icon = config.icon;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', config.bgClass)}>
                      <Icon className={cn('h-4 w-4', config.textClass)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{config.labelTh}</span>
                        <span className="text-sm text-gray-500">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Credit Summary */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              สรุปวงเงินเครดิต
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600">วงเงินเครดิตรวม</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalCreditLimit)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-500">เครดิตเฉลี่ย</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrencyShort(stats.avgCreditLimit)}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-gray-500">วงเงินสูง (≥1M)</p>
                  <p className="text-lg font-bold text-amber-600">{stats.highCredit} ราย</p>
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">อัตราลูกค้าใช้งาน</span>
                  <span className="text-sm font-semibold">
                    {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            ลูกค้าวงเงินสูงสุด 5 อันดับ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topCustomers.map((customer, idx) => {
              const config = getTypeConfig(customer.customerType);
              const Icon = config.icon;
              return (
                <Card
                  key={customer.id}
                  className="border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCustomerClick(customer.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      <div className="w-1" style={{ backgroundColor: config.color }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                            {idx + 1}
                          </div>
                          <div className={cn('p-1.5 rounded-lg', config.bgClass)}>
                            <Icon className={cn('h-4 w-4', config.textClass)} />
                          </div>
                        </div>
                        <p className="font-mono text-xs text-blue-600 mb-1">{customer.code}</p>
                        <p className="font-medium text-sm truncate">{customer.name}</p>
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-xs text-gray-500">วงเงินเครดิต</span>
                          <p className="font-semibold text-green-600">{formatCurrency(customer.creditLimit)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {topCustomers.length === 0 && (
              <div className="col-span-5 text-center py-8 text-gray-400">
                ไม่มีข้อมูลลูกค้า
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">ลูกค้า</h1>
                  <p className="text-white/80 text-sm">จัดการข้อมูลลูกค้าและวิเคราะห์การขาย</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="hidden md:flex items-center bg-white/20 backdrop-blur-sm rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      viewMode === 'grid' ? 'bg-white/30 text-white' : 'text-white/70 hover:text-white'
                    )}
                    title="Grid View"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      viewMode === 'cards' ? 'bg-white/30 text-white' : 'text-white/70 hover:text-white'
                    )}
                    title="Cards View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('analytics')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      viewMode === 'analytics' ? 'bg-white/30 text-white' : 'text-white/70 hover:text-white'
                    )}
                    title="Analytics View"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => refetch()}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <DxButton
                  text="เพิ่มลูกค้า"
                  icon="plus"
                  type="success"
                  onClick={() => router.push('/sales/customers/new')}
                />
              </div>
            </div>

            {/* Quick Stats in Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">ทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">ใช้งาน</p>
                <p className="text-2xl font-bold text-white">{stats.active}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">วงเงินรวม</p>
                <p className="text-2xl font-bold text-white">{formatCurrencyShort(stats.totalCreditLimit)}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-white/70 text-xs">ประเภทหลัก</p>
                <p className="text-lg font-bold text-white truncate">
                  {stats.topType ? getTypeConfig(stats.topType.type).labelTh : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card with Tabs and Search */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
          <CardHeader className="border-b pb-0 space-y-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-thin">
              {(['all', 'active', 'inactive'] as StatusFilter[]).map((status) => {
                const config = status === 'all'
                  ? { label: 'ทั้งหมด', icon: Users, bgClass: 'bg-gray-100', textClass: 'text-gray-700', hoverBg: 'hover:bg-gray-200' }
                  : status === 'active'
                  ? { label: 'ใช้งาน', icon: UserCheck, bgClass: 'bg-green-100', textClass: 'text-green-700', hoverBg: 'hover:bg-green-200' }
                  : { label: 'ปิดใช้งาน', icon: UserX, bgClass: 'bg-red-100', textClass: 'text-red-700', hoverBg: 'hover:bg-red-200' };
                const count = statusCounts[status];
                const isActive = statusFilter === status;
                const Icon = config.icon;

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border-b-2',
                      isActive
                        ? `${config.bgClass} ${config.textClass} border-current`
                        : `text-gray-500 border-transparent ${config.hoverBg}`
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{config.label}</span>
                    <span
                      className={cn(
                        'ml-1 px-1.5 py-0.5 rounded text-xs font-semibold',
                        isActive ? 'bg-white/50' : 'bg-gray-200/70'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-center gap-3 pb-3">
              <div className="flex-1 w-full md:max-w-md">
                <DxTextBox
                  placeholder="ค้นหาด้วยรหัส ชื่อ อีเมล หรือโทรศัพท์..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="w-full md:w-40">
                <DxSelectBox
                  items={customerTypeOptions}
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  placeholder="ประเภท"
                  showClearButton
                />
              </div>
              <div className="text-sm text-gray-500">
                แสดง <span className="font-semibold text-gray-700">{filteredCustomers.length}</span> ราย
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col pt-4">
            {/* Content based on view mode */}
            {viewMode === 'grid' && renderGridView()}
            {viewMode === 'cards' && renderCardsView()}
            {viewMode === 'analytics' && renderAnalyticsView()}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
