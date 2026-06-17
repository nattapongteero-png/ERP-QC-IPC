'use client';

// HR Employee Directory Page - Professional Dashboard Design
// Feature: 007-hr-personnel-management

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import DataGrid, {
  Column,
  SearchPanel,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
  Grouping,
  GroupPanel,
  StateStoring,
  Summary,
  GroupItem,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series as PieSeries,
  Label,
  Connector,
  Legend as PieLegend,
  Tooltip as PieTooltip,
  Size,
} from 'devextreme-react/pie-chart';
import { useQuery } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { OrgUnitPicker, ResponsivePageHeader, StatCard } from '@/components/shared';
import {
  Users,
  UserPlus,
  UserCheck,
  Clock,
  Phone,
  Calendar,
  ChevronRight,
  Building2,
  Mail,
  BarChart3,
  List,
  Grid3X3,
  UserX,
  Award,
  Briefcase,
  Filter,
  Eye,
} from 'lucide-react';
import type { EmployeeWithDetails } from '@/types/hr';

const STATUS_OPTIONS_CONFIG = [
  { value: 'active', translationKey: 'status.active' },
  { value: 'inactive', translationKey: 'status.inactive' },
  { value: 'terminated', translationKey: 'status.terminated' },
];

// Professional avatar gradient colors based on name hash
const AVATAR_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
];

// Status colors for pie chart
const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',    // emerald-500
  inactive: '#f59e0b',  // amber-500
  terminated: '#ef4444', // red-500
};

function getAvatarGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function formatTenure(
  dateStr: string | Date | null,
  labels: { new: string; month: string; year: string; years: string }
): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);

  if (years === 0 && months === 0) return labels.new;
  if (years === 0) return `${months} ${labels.month}`;
  if (months === 0) return `${years} ${labels.year}`;
  return `${years} ${labels.year} ${months} ${labels.month}`;
}

async function fetchEmployees(filters: {
  orgUnitId?: number;
  status?: string;
  search?: string;
}): Promise<EmployeeWithDetails[]> {
  const url = new URL('/api/hr/employees', window.location.origin);
  if (filters.orgUnitId) url.searchParams.set('orgUnitId', String(filters.orgUnitId));
  if (filters.status) url.searchParams.set('status', filters.status);
  if (filters.search) url.searchParams.set('search', filters.search);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch employees');
  const result = await response.json();
  return result.data || [];
}

type ViewMode = 'grid' | 'cards' | 'analytics';

export default function EmployeesPage() {
  const t = useTranslations('hr');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Build status options with translations
  const STATUS_OPTIONS = useMemo(
    () =>
      STATUS_OPTIONS_CONFIG.map((s) => ({
        value: s.value,
        label: t(`employees.${s.translationKey}`),
      })),
    [t]
  );

  // Tenure labels memoized
  const tenureLabels = useMemo(
    () => ({
      new: t('common.newBadge'),
      month: t('common.month'),
      year: t('common.year'),
      years: t('common.years'),
    }),
    [t]
  );

  const [orgUnitFilter, setOrgUnitFilter] = useState<number | null>(
    searchParams.get('orgUnitId') ? Number(searchParams.get('orgUnitId')) : null
  );
  const [statusFilter, setStatusFilter] = useState<string | null>(
    searchParams.get('status') || null
  );
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridHeight, setGridHeight] = useState(600);

  // Responsive height calculation for DataGrid
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 320;
      const padding = 100;
      const minHeight = 400;
      const availableHeight = window.innerHeight - headerHeight - padding;
      setGridHeight(Math.max(minHeight, availableHeight));
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const { data: employees = [], isLoading, refetch } = useQuery({
    queryKey: ['hr', 'employees', { orgUnitId: orgUnitFilter, status: statusFilter }],
    queryFn: () => fetchEmployees({
      orgUnitId: orgUnitFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  // Compute analytics data
  const employeeList = useMemo(() => Array.isArray(employees) ? employees : [], [employees]);

  const employeeListWithRowNum = useMemo(
    () => employeeList.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [employeeList]
  );

  const analytics = useMemo(() => {
    const activeCount = employeeList.filter((e) => e.status === 'active').length;
    const inactiveCount = employeeList.filter((e) => e.status === 'inactive').length;
    const terminatedCount = employeeList.filter((e) => e.status === 'terminated').length;

    const thisMonth = new Date();
    const newThisMonth = employeeList.filter((e) => {
      if (!e.hireDate) return false;
      const hireDate = new Date(e.hireDate);
      return hireDate.getMonth() === thisMonth.getMonth() &&
             hireDate.getFullYear() === thisMonth.getFullYear();
    }).length;

    // Get department distribution
    const deptMap = new Map<string, number>();
    employeeList.forEach((e) => {
      const dept = e.orgUnitName || t('authorizations.unknown');
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });
    const deptDistribution = Array.from(deptMap.entries())
      .map(([name, count]) => ({ department: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Status distribution for pie chart
    const statusDistribution = [
      { status: t('employees.status.active'), count: activeCount, color: STATUS_COLORS.active },
      { status: t('employees.status.inactive'), count: inactiveCount, color: STATUS_COLORS.inactive },
      { status: t('employees.status.terminated'), count: terminatedCount, color: STATUS_COLORS.terminated },
    ].filter(s => s.count > 0);

    // Calculate average tenure using a stable reference date
    const referenceDate = new Date().getTime();
    const activeTenures = employeeList
      .filter(e => e.status === 'active' && e.hireDate)
      .map(e => {
        const hireDate = new Date(e.hireDate!);
        return Math.floor((referenceDate - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
      });
    const avgTenure = activeTenures.length > 0
      ? (activeTenures.reduce((a, b) => a + b, 0) / activeTenures.length).toFixed(1)
      : 0;

    return {
      total: employeeList.length,
      active: activeCount,
      inactive: inactiveCount,
      terminated: terminatedCount,
      newThisMonth,
      deptDistribution,
      statusDistribution,
      avgTenure,
    };
  }, [employeeList, t]);

  const handleRowClick = useCallback(
    (e: { data: EmployeeWithDetails }) => {
      router.push(`/hr/employees/${e.data.id}`);
    },
    [router]
  );

  const handleAddEmployee = useCallback(() => {
    router.push('/hr/employees/new');
  }, [router]);

  const clearFilters = useCallback(() => {
    setOrgUnitFilter(null);
    setStatusFilter(null);
  }, []);

  // Enhanced status cell with modern styling
  const renderStatusCell = (cellData: { value: string }) => {
    const status = cellData.value;
    const statusConfig = {
      active: { variant: 'success' as const, label: t('employees.status.active'), icon: UserCheck },
      inactive: { variant: 'warning' as const, label: t('employees.status.inactive'), icon: Clock },
      terminated: { variant: 'danger' as const, label: t('employees.status.terminated'), icon: UserX },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

    return (
      <div className="flex items-center justify-center">
        <Badge variant={config.variant} dot className="font-medium">
          {config.label}
        </Badge>
      </div>
    );
  };

  // Professional employee cell with gradient avatar
  const renderEmployeeCell = (cellData: { data: EmployeeWithDetails }) => {
    const emp = cellData.data;
    const fullName = `${emp.firstName} ${emp.lastName}`;
    const gradient = getAvatarGradient(fullName);

    return (
      <div className="flex items-center gap-3.5 py-2 group">
        {/* Gradient Avatar */}
        <div className={`
          relative w-11 h-11 rounded-full bg-gradient-to-br ${gradient}
          flex items-center justify-center text-white font-semibold text-sm
          shadow-md ring-2 ring-white
          transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg
        `}>
          {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
          {/* Online indicator for active employees */}
          {emp.status === 'active' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
          )}
        </div>

        {/* Employee Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 truncate text-base">
              {fullName}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              {emp.employeeCode}
            </span>
            {emp.email && (
              <span className="flex items-center gap-1 text-slate-400">
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{emp.email}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Organization unit cell with icon and position
  const renderOrgUnitCell = (cellData: { data: EmployeeWithDetails }) => {
    const emp = cellData.data;
    if (!emp.orgUnitName) {
      return <span className="text-slate-300 text-sm italic">-</span>;
    }
    return (
      <div className="flex items-center gap-2.5 py-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Building2 className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-slate-700 text-sm font-medium truncate">{emp.orgUnitName}</span>
          {emp.positionTitle && (
            <span className="text-xs text-slate-400 truncate flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {emp.positionTitle}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Professional phone cell with icon
  const renderPhoneCell = (cellData: { value: string }) => {
    const phone = cellData.value;
    if (!phone) {
      return <span className="text-slate-300 text-sm italic">-</span>;
    }
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center flex-shrink-0">
          <Phone className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <span className="text-slate-600 text-sm font-mono">
          {phone}
        </span>
      </div>
    );
  };

  // Enhanced hire date cell with tenure badge
  const renderHireDateCell = (cellData: { value: string | Date }) => {
    const dateValue = cellData.value;
    if (!dateValue) {
      return <span className="text-slate-300 text-sm italic">-</span>;
    }

    const date = new Date(dateValue);
    const formattedDate = date.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const tenure = formatTenure(dateValue, tenureLabels);

    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <div className="flex flex-col">
          <span className="text-slate-700 text-sm">{formattedDate}</span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Award className="w-3 h-3" />
            {t('employees.tenureLabel')}: {tenure}
          </span>
        </div>
      </div>
    );
  };

  // Pie chart tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customizePieTooltip = (pointInfo: any) => {
    return {
      text: `${pointInfo.argument}: ${pointInfo.value} ${t('common.people')} (${((pointInfo.percent || 0) * 100).toFixed(1)}%)`,
    };
  };

  // Pie chart point customization
  const customizePiePoint = (pointInfo: { data?: { color?: string } }) => {
    return { color: pointInfo.data?.color || '#6366f1' };
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto" data-testid="hr-employees-page">
      {/* Header Section */}
      <ResponsivePageHeader
        title={t('employees.title')}
        subtitle={t('employees.description')}
        icon={Users}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: t('employees.breadcrumb') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title={t('employees.viewMode.grid')}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title={t('employees.viewMode.cards')}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'analytics'
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title={t('employees.viewMode.analytics')}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>

            <DxButton
              icon="filter"
              text={showFilters ? t('common.hideFilters') : t('common.showFilters')}
              type="default"
              stylingMode="outlined"
              onClick={() => setShowFilters(!showFilters)}
            />
            <DxButton
              icon="refresh"
              type="default"
              stylingMode="outlined"
              onClick={() => refetch()}
              disabled={isLoading}
            />
            <DxButton
              icon="add"
              text={t('employees.addEmployee')}
              type="default"
              stylingMode="contained"
              onClick={handleAddEmployee}
              elementAttr={{ 'data-testid': 'hr-add-employee-btn' }}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4" data-testid="hr-employees-stats">
        <StatCard
          label={t('employees.stats.total')}
          value={analytics.total}
          icon={Users}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('employees.stats.active')}
          value={analytics.active}
          icon={UserCheck}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          trend={analytics.active > 0 ? { direction: 'up', value: `${((analytics.active / analytics.total) * 100).toFixed(0)}%` } : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t('employees.stats.inactive')}
          value={analytics.inactive}
          icon={Clock}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('employees.stats.newThisMonth')}
          value={analytics.newThisMonth}
          icon={UserPlus}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
          trend={analytics.newThisMonth > 0 ? { direction: 'up', value: t('employees.stats.increasing') } : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label={t('employees.stats.avgTenure')}
          value={`${analytics.avgTenure} ${t('common.year')}`}
          icon={Award}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
          className="hidden lg:block"
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">{t('common.dataFilters')}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 md:gap-4">
            <div className="w-full sm:w-64">
              <OrgUnitPicker
                value={orgUnitFilter}
                onValueChange={setOrgUnitFilter}
                label={t('employees.filters.orgUnit')}
                placeholder={t('employees.filters.orgUnitPlaceholder')}
                showClearButton
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('employees.filters.status')}
              </label>
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="w-full px-3 py-2 min-h-[44px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-700"
              >
                <option value="">{t('employees.filters.allStatus')}</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <DxButton
              text={t('common.clearFilters')}
              type="default"
              stylingMode="text"
              onClick={clearFilters}
            />
          </div>
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status Distribution Pie Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
              {t('employees.analytics.statusTitle')}
            </h3>
            {analytics.statusDistribution.length > 0 ? (
              <PieChart
                key={locale}
                id="status-pie"
                dataSource={analytics.statusDistribution}
                type="doughnut"
                palette={analytics.statusDistribution.map(s => s.color)}
                customizePoint={customizePiePoint}
              >
                <Size height={250} />
                <PieSeries argumentField="status" valueField="count">
                  <Label visible format="fixedPoint">
                    <Connector visible width={1} />
                  </Label>
                </PieSeries>
                <PieLegend
                  visible
                  orientation="vertical"
                  horizontalAlignment="right"
                  verticalAlignment="top"
                  itemTextPosition="right"
                  customizeText={(info: { pointName?: string; pointIndex?: number }) => {
                    const d = analytics.statusDistribution[info.pointIndex ?? -1];
                    return d ? `${info.pointName} (${d.count})` : (info.pointName ?? '');
                  }}
                />
                <PieTooltip enabled customizeTooltip={customizePieTooltip} />
              </PieChart>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-400">
                {t('common.noData')}
              </div>
            )}
          </div>

          {/* Department Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
              {t('employees.analytics.byDepartment')}
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {analytics.deptDistribution.map((dept) => {
                const percentage = analytics.total > 0 ? (dept.count / analytics.total) * 100 : 0;
                return (
                  <div key={dept.department} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 truncate flex-1">{dept.department}</span>
                      <span className="text-sm font-semibold text-slate-800 ml-2">{dept.count} {t('common.people')}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
              {analytics.deptDistribution.length === 0 && (
                <div className="text-center text-slate-400 py-8">{t('common.noData')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employeeList.map((emp) => {
            const fullName = `${emp.firstName} ${emp.lastName}`;
            const gradient = getAvatarGradient(fullName);
            const statusConfig = {
              active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: t('employees.status.active') },
              inactive: { bg: 'bg-amber-100', text: 'text-amber-700', label: t('employees.status.inactive') },
              terminated: { bg: 'bg-red-100', text: 'text-red-700', label: t('employees.status.terminated') },
            };
            const status = statusConfig[emp.status as keyof typeof statusConfig] || statusConfig.active;

            return (
              <div
                key={emp.id}
                onClick={() => router.push(`/hr/employees/${emp.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`
                    relative w-14 h-14 rounded-full bg-gradient-to-br ${gradient}
                    flex items-center justify-center text-white font-bold text-lg
                    shadow-lg ring-3 ring-white
                    transition-transform duration-200 group-hover:scale-105
                  `}>
                    {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                    {emp.status === 'active' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate text-lg group-hover:text-blue-600 transition-colors">
                      {fullName}
                    </h3>
                    <p className="text-sm text-slate-500 font-mono">{emp.employeeCode}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2.5 text-sm">
                  {emp.positionTitle && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{emp.positionTitle}</span>
                    </div>
                  )}
                  {emp.orgUnitName && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{emp.orgUnitName}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="font-mono">{emp.phone}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  )}
                  {emp.hireDate && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs pt-2 border-t border-slate-100">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{t('employees.tenureLabel')}: {formatTenure(emp.hireDate, tenureLabels)}</span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                    <Eye className="w-4 h-4" />
                    {t('common.viewDetails')}
                  </button>
                </div>
              </div>
            );
          })}
          {employeeList.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('employees.noEmployees')}</p>
            </div>
          )}
        </div>
      )}

      {/* Grid View - DataGrid */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="hr-employees-grid">
          <DataGrid
            key={locale}
            dataSource={employeeListWithRowNum}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled={false}
            columnAutoWidth
            allowColumnReordering
            allowColumnResizing
            columnHidingEnabled
            height={gridHeight}
            onRowClick={handleRowClick}
            hoverStateEnabled
            loadPanel={{ enabled: isLoading }}
            className="[&_.dx-datagrid-headers]:bg-slate-50/80 [&_.dx-datagrid-headers]:border-b [&_.dx-datagrid-headers]:border-slate-200 [&_.dx-header-row>td]:font-semibold [&_.dx-header-row>td]:text-slate-600 [&_.dx-header-row>td]:text-xs [&_.dx-header-row>td]:uppercase [&_.dx-header-row>td]:tracking-wider [&_.dx-header-row>td]:py-3.5 [&_.dx-data-row]:border-b [&_.dx-data-row]:border-slate-100 [&_.dx-data-row:hover]:bg-blue-50/50 [&_.dx-data-row]:transition-colors [&_.dx-data-row]:cursor-pointer"
          >
            <SearchPanel visible placeholder={t('employees.searchPlaceholder')} width={280} />
            <Scrolling mode="virtual" />
            <Paging defaultPageSize={25} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 25, 50, 100]}
              showInfo
              showNavigationButtons
            />
            <GroupPanel visible />
            <Grouping autoExpandAll={false} />
            <StateStoring enabled type="localStorage" storageKey="hrEmployeesGrid_v2" />

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
            </Toolbar>

            <Summary>
              <GroupItem column="status" summaryType="count" displayFormat={t('employees.table.columns.employeeCount', { 0: '{0}' })} />
            </Summary>

            {/* Professional columns with enhanced cell renderers */}
            <Column
              dataField="_rowNumber"
              caption={t('items.grid.columns.rowNum')}
              width={60}
              alignment="center"
              allowFiltering={false}
              allowSorting={false}
              allowGrouping={false}
              cellRender={(cellInfo) => (
                <span className="text-gray-500 text-sm font-medium">
                  {cellInfo.data._rowNumber}
                </span>
              )}
            />
            <Column
              caption={t('employees.employeeCol')}
              cellRender={renderEmployeeCell}
              minWidth={280}
              calculateSortValue={(data: EmployeeWithDetails) => `${data.firstName} ${data.lastName}`}
              hidingPriority={0}
            />
            <Column
              caption={t('employees.orgUnitPosition')}
              cellRender={renderOrgUnitCell}
              minWidth={220}
              calculateSortValue={(data: EmployeeWithDetails) => data.orgUnitName || ''}
              hidingPriority={2}
            />
            <Column
              dataField="phone"
              caption={t('employees.phoneCol')}
              cellRender={renderPhoneCell}
              width={160}
              hidingPriority={4}
            />
            <Column
              dataField="status"
              caption={t('employees.statusCol')}
              width={130}
              cellRender={renderStatusCell}
              alignment="center"
              hidingPriority={1}
              groupIndex={-1}
            />
            <Column
              dataField="hireDate"
              caption={t('employees.hireDateLabel')}
              cellRender={renderHireDateCell}
              minWidth={180}
              hidingPriority={3}
            />
          </DataGrid>
        </div>
      )}
    </div>
  );
}
