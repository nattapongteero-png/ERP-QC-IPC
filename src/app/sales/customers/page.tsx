'use client';

/**
 * Customers Page — Responsive Dashboard
 *
 * Feature: Sales Module
 *
 * Responsive: ResponsivePageHeader, StatCard KPI row, customer-type scroll-snap tabs,
 * desktop charts (hidden on mobile), mobile card list (replaces DataGrid on < 768px),
 * empty state, no-results state, loading skeletons. Modal-friendly layout with
 * DataGrid minWidth to preserve info density on wide screens.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
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
  Phone,
  Mail,
  Calendar,
  Inbox,
  Star,
  Award,
  RefreshCw,
  SearchX,
  Eye,
  MapPin,
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

type StatusFilter = 'all' | 'active' | 'inactive';
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================================================
// Configuration Constants
// ============================================================================

const CUSTOMER_TYPE_CONFIG: Record<string, {
  translationKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  icon: React.ElementType;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
}> = {
  hospital: {
    translationKey: 'hospital',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: Hospital,
    badgeVariant: 'danger',
  },
  clinic: {
    translationKey: 'clinic',
    color: '#f97316',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    icon: Building2,
    badgeVariant: 'warning',
  },
  pharmacy: {
    translationKey: 'pharmacy',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: Pill,
    badgeVariant: 'success',
  },
  distributor: {
    translationKey: 'distributor',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: Truck,
    badgeVariant: 'info',
  },
  traditional_medicine: {
    translationKey: 'traditional_medicine',
    color: '#84cc16',
    bgClass: 'bg-lime-100',
    textClass: 'text-lime-700',
    icon: Leaf,
    badgeVariant: 'success',
  },
  spa_wellness: {
    translationKey: 'spa_wellness',
    color: '#ec4899',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    icon: Sparkles,
    badgeVariant: 'primary',
  },
  government: {
    translationKey: 'government',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: Landmark,
    badgeVariant: 'secondary',
  },
  export: {
    translationKey: 'export',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: Globe,
    badgeVariant: 'info',
  },
  other: {
    translationKey: 'other',
    color: '#6b7280',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    icon: HelpCircle,
    badgeVariant: 'default',
  },
};

const CUSTOMER_TYPE_KEYS = ['hospital', 'clinic', 'pharmacy', 'distributor', 'traditional_medicine', 'spa_wellness', 'government', 'export', 'other'];

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
  const t = useTranslations('sales');
  const locale = useLocale();
  const { isMobile } = useMobile();
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
    }).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
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

    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    const highCredit = customers.filter(c => (Number(c.creditLimit) || 0) >= 1000000).length;

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

  // Type counts for type-filter tabs
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { '': customers.length };
    for (const key of CUSTOMER_TYPE_KEYS) {
      counts[key] = customers.filter(c => c.customerType === key).length;
    }
    return counts;
  }, [customers]);

  // Chart data
  const typeChartData = useMemo(() => {
    return Object.entries(stats.byType)
      .map(([type, count]) => {
        const config = getTypeConfig(type);
        return {
          type: t(`customers.type.${config.translationKey}`),
          count,
          color: config.color,
        };
      })
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [stats.byType, t]);

  const creditChartData = useMemo(() => {
    return Object.entries(stats.creditByType)
      .map(([type, credit]) => {
        const config = getTypeConfig(type);
        return {
          type: t(`customers.type.${config.translationKey}`),
          credit,
          color: config.color,
        };
      })
      .filter(item => item.credit > 0)
      .sort((a, b) => b.credit - a.credit);
  }, [stats.creditByType, t]);

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

  // Navigation handlers
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/sales/customers/${e.data.id}`);
    }
  }, [router]);

  const handleCustomerClick = useCallback((id: number) => {
    router.push(`/sales/customers/${id}`);
  }, [router]);

  const handleAddCustomer = useCallback(() => {
    router.push('/sales/customers/new');
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('all');
  }, []);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowHeaderFiltering: false,
      allowSorting: false,
      cellRender: (cellInfo: { data?: Customer & { _rowNumber?: number } }) => (
        <span className="text-gray-500 text-sm font-medium">
          {cellInfo.data?._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'code',
      caption: t('customers.grid.columns.code'),
      width: 120,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
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
      caption: t('customers.grid.columns.name'),
      minWidth: 200,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
        return (
          <div className="min-w-0">
            <span className="font-medium text-gray-800 truncate block">{data.data.name}</span>
            {data.data.contactPerson && (
              <span className="text-xs text-gray-500 truncate block">{data.data.contactPerson}</span>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'phone',
      caption: t('customers.grid.columns.phone'),
      width: 140,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
        return (
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
        );
      },
    },
    {
      dataField: 'email',
      caption: t('customers.grid.columns.email'),
      width: 200,
      hideOnMobile: true,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
        return (
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
        );
      },
    },
    {
      dataField: 'creditLimit',
      caption: t('customers.grid.columns.creditLimit'),
      width: 150,
      dataType: 'number',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
        return (
          <span className="font-semibold text-green-600">
            {formatCurrency(data.data.creditLimit)}
          </span>
        );
      },
    },
    {
      dataField: 'customerType',
      caption: t('customers.grid.columns.type'),
      width: 160,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
        const config = getTypeConfig(data.data.customerType);
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
            {t(`customers.type.${config.translationKey}`)}
          </span>
        );
      },
    },
    {
      dataField: 'isActive',
      caption: t('customers.grid.columns.status'),
      width: 110,
      cellRender: (data: { data?: Customer }) => {
        if (!data.data) return null;
        return (
          <Badge variant={data.data.isActive ? 'success' : 'danger'} dot>
            {data.data.isActive ? t('customers.status.active') : t('customers.status.inactive')}
          </Badge>
        );
      },
    },
  ], [t]);

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        {/* Responsive Page Header */}
        <ResponsivePageHeader
          title={t('customers.pageTitle')}
          subtitle={t('customers.description')}
          icon={Users}
          iconBgColor="bg-pink-100"
          iconColor="text-pink-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text={t('customers.actions.refresh')}
                stylingMode="outlined"
                onClick={() => refetch()}
                className="hidden sm:inline-flex"
              />
              <DxButton
                text={t('customers.actions.addCustomer')}
                icon="plus"
                type="success"
                onClick={handleAddCustomer}
              />
            </div>
          }
        />

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label={t('customers.stats.total')}
            value={stats.total}
            icon={Users}
            iconColor="text-pink-500"
            accentColor="border-pink-500"
          />
          <StatCard
            label={t('customers.stats.active')}
            value={stats.active}
            icon={UserCheck}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label={t('customers.cards.highCredit')}
            value={stats.highCredit}
            icon={Star}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
          />
          <StatCard
            label={t('customers.stats.totalCreditLimit')}
            value={formatCurrencyShort(stats.totalCreditLimit)}
            icon={CreditCard}
            iconColor="text-green-500"
            accentColor="border-green-500"
          />
        </div>

        {/* Charts Row — hidden on mobile */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Type Distribution */}
          <Card elevation="raised" className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t('customers.charts.typeDistribution')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {typeChartData.length > 0 ? (
                <PieChart
                  key={`type-${locale}`}
                  id="type-pie"
                  dataSource={typeChartData}
                  type="doughnut"
                  palette={typeChartData.map(d => d.color)}
                  innerRadius={0.6}
                  size={{ height: 280 }}
                >
                  <Series argumentField="type" valueField="count">
                    <Label visible={false} />
                  </Series>
                  {/* Legend on the RIGHT (vertical) so long Thai labels stack
                      down the side and never get clipped. */}
                  <Legend orientation="vertical" horizontalAlignment="right" verticalAlignment="top" />
                  <Tooltip enabled={true} customizeTooltip={(arg) => ({
                    text: `${arg.argumentText}: ${t('customers.cards.count', { count: arg.valueText || 0 })}`
                  })} />
                </PieChart>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  {t('customers.charts.noData')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Distribution */}
          <Card elevation="raised" className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('customers.charts.creditByType')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {creditChartData.length > 0 ? (
                <PieChart
                  key={`credit-${locale}`}
                  id="credit-pie"
                  dataSource={creditChartData}
                  type="doughnut"
                  palette={creditChartData.map(d => d.color)}
                  innerRadius={0.6}
                  size={{ height: 280 }}
                >
                  <Series argumentField="type" valueField="credit">
                    <Label visible={false} />
                  </Series>
                  <Legend orientation="vertical" horizontalAlignment="right" verticalAlignment="top" />
                  <Tooltip enabled={true} customizeTooltip={(arg) => ({
                    text: `${arg.argumentText}: ${formatCurrency(arg.value as number)}`
                  })} />
                </PieChart>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  {t('customers.charts.noData')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Sidebar — Top & Recent */}
          <Card elevation="raised" className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {t('customers.cards.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-xs text-gray-500">{t('customers.cards.avgCreditLimit')}</span>
                <span className="text-sm font-semibold text-blue-600">{formatCurrencyShort(stats.avgCreditLimit)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-xs text-gray-500">{t('customers.cards.recentCustomers')}</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {t('customers.cards.count', { count: stats.recentCustomers })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-xs text-gray-500">{t('customers.stats.mainType')}</span>
                <span className="text-sm font-semibold text-gray-900 truncate max-w-[60%]">
                  {stats.topType ? t(`customers.type.${getTypeConfig(stats.topType.type).translationKey}`) : '-'}
                </span>
              </div>
              <div className="pt-1.5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-500">{t('customers.analytics.activeRate')}</span>
                  <span className="text-xs font-semibold">
                    {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Filter Header: Customer Type Tabs (scroll-snap on mobile) */}
          <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
            <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
              {/* All types button */}
              <button
                key="all-types"
                onClick={() => setTypeFilter('')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                  typeFilter === ''
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Users className="h-4 w-4" />
                <span>{t('customers.type.all')}</span>
                <span className={cn(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                  typeFilter === ''
                    ? 'bg-white/25 text-inherit'
                    : 'bg-gray-200 text-gray-700'
                )}>
                  {typeCounts['']}
                </span>
              </button>
              {CUSTOMER_TYPE_KEYS.map((key) => {
                const config = CUSTOMER_TYPE_CONFIG[key];
                const count = typeCounts[key] || 0;
                const isActive = typeFilter === key;
                const Icon = config.icon;

                return (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                      isActive
                        ? cn(config.bgClass, config.textClass, 'shadow-sm')
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(`customers.type.${config.translationKey}`)}</span>
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                      isActive
                        ? 'bg-white/60 text-gray-900'
                        : 'bg-gray-200 text-gray-700'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Tabs + Search + Result Count */}
          <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col gap-3">
            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin snap-x">
              {(['all', 'active', 'inactive'] as StatusFilter[]).map((status) => {
                const isActive = statusFilter === status;
                const Icon = status === 'all' ? Users : status === 'active' ? UserCheck : UserX;
                const activeClasses =
                  status === 'active' ? 'bg-green-100 text-green-700 border-green-500'
                  : status === 'inactive' ? 'bg-red-100 text-red-700 border-red-500'
                  : 'bg-gray-100 text-gray-800 border-gray-700';

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border-b-2 snap-start',
                      isActive
                        ? activeClasses
                        : 'text-gray-500 border-transparent hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(`customers.status.${status}`)}</span>
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 rounded text-xs font-semibold',
                      isActive ? 'bg-white/60' : 'bg-gray-200/70'
                    )}>
                      {statusCounts[status]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + count row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="w-full sm:max-w-md">
                <DxTextBox
                  placeholder={t('customers.searchPlaceholder')}
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                <Users className="h-4 w-4 text-gray-400" />
                <span>{t('customers.grid.showing', { count: filteredCustomers.length })}</span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="sm:hidden ml-1 p-1 rounded-md text-gray-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
                  aria-label={t('customers.actions.refresh')}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content: Loading / Empty / Mobile Cards / Desktop Grid */}
          {isLoading ? (
            isMobile ? (
              <CustomerCardSkeletonList count={4} />
            ) : (
              <DataGridLoadingSkeleton />
            )
          ) : customers.length === 0 ? (
            <CustomerEmptyState onCreate={handleAddCustomer} t={t} />
          ) : filteredCustomers.length === 0 ? (
            <NoResultsState onClear={handleClearFilters} t={t} />
          ) : isMobile ? (
            <CustomerCardList
              customers={filteredCustomers}
              onView={(c) => handleCustomerClick(c.id)}
              t={t}
            />
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 960 }}>
                <DxDataGrid
                  key={locale}
                  dataSource={filteredCustomers}
                  keyExpr="id"
                  columns={columns}
                  loading={isLoading}
                  sorting
                  responsiveColumns
                  virtualScrolling={filteredCustomers.length > 100}
                  height={600}
                  mobileHeight={520}
                  tabletHeight={560}
                  noDataText={t('customers.grid.noData')}
                  onRowClick={handleRowClick}
                  rowAlternationEnabled
                />
              </div>
            </div>
          )}
        </div>

        {/* Top Customers & Recent — hidden on mobile */}
        {!isMobile && topCustomers.length > 0 && (
          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 5 by Credit */}
            <Card elevation="raised">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  {t('customers.cards.topCreditLimit')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {topCustomers.map((customer, idx) => {
                    const config = getTypeConfig(customer.customerType);
                    const Icon = config.icon;
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleCustomerClick(customer.id)}
                        className="text-left rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-stretch">
                          <div className="w-1" style={{ backgroundColor: config.color }} />
                          <div className="flex-1 p-3 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                                {idx + 1}
                              </div>
                              <div className={cn('p-1 rounded', config.bgClass)}>
                                <Icon className={cn('h-3 w-3', config.textClass)} />
                              </div>
                            </div>
                            <p className="font-mono text-xs text-blue-600 truncate">{customer.code}</p>
                            <p className="font-medium text-sm truncate">{customer.name}</p>
                            <p className="text-xs font-semibold text-green-600 mt-1">
                              {formatCurrencyShort(customer.creditLimit)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent */}
            <Card elevation="raised">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  {t('customers.cards.recent')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {recentCustomersList.map((customer) => {
                    const config = getTypeConfig(customer.customerType);
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleCustomerClick(customer.id)}
                        className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors border-l-2"
                        style={{ borderLeftColor: config.color }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-xs text-blue-600">{customer.code}</p>
                              <Badge variant={customer.isActive ? 'success' : 'danger'} className="text-xs">
                                {customer.isActive ? t('customers.status.active') : t('customers.status.inactive')}
                              </Badge>
                            </div>
                            <p className="text-sm truncate">{customer.name}</p>
                          </div>
                          <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(customer.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: Code + Name → Contact → Type → Status.
 * Footer row has 44px+ tap targets.
 */
function CustomerCardList({
  customers,
  onView,
  t,
}: {
  customers: Customer[];
  onView: (c: Customer) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {customers.map((c) => {
        const config = getTypeConfig(c.customerType);
        const Icon = config.icon;
        return (
          <div
            key={c.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card header: tap to view */}
            <button
              type="button"
              onClick={() => onView(c)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0', config.bgClass)}>
                <Icon className={cn('h-5 w-5', config.textClass)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">{c.name}</p>
                    <p className="font-mono text-xs text-blue-600">{c.code}</p>
                  </div>
                  <Badge variant={c.isActive ? 'success' : 'danger'} dot>
                    {c.isActive ? t('customers.status.active') : t('customers.status.inactive')}
                  </Badge>
                </div>

                {/* Contact lines */}
                {(c.contactPerson || c.phone || c.email) && (
                  <div className="space-y-0.5 mt-1.5">
                    {c.contactPerson && (
                      <p className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{c.contactPerson}</span>
                      </p>
                    )}
                    {c.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{c.phone}</span>
                      </p>
                    )}
                    {c.email && (
                      <p className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    )}
                    {c.address && (
                      <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{c.address}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
                    {t(`customers.type.${config.translationKey}`)}
                  </span>
                  {c.creditLimit ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      <CreditCard className="h-3 w-3" />
                      {formatCurrencyShort(c.creditLimit)}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            {/* Card footer: tap-friendly action */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onView(c)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-700 active:bg-pink-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('customers.cards.viewCustomer')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function CustomerCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid area */
function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty State — shown when user has zero customers */
function CustomerEmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-pink-100 flex items-center justify-center mb-5">
        <Inbox className="h-10 w-10 text-pink-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('customers.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('customers.empty.description')}
      </p>
      <DxButton
        text={t('customers.actions.addCustomer')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filters/search yield no matches but data exists */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('customers.cards.noMatchingCustomers')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('customers.empty.description')}
      </p>
      <DxButton
        text={t('customers.actions.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}
