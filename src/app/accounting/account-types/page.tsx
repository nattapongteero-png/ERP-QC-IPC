'use client';

/**
 * Account Types Page — Accounting / GL Account Types
 *
 * Responsive read-only dashboard showing GL account types with counts of
 * accounts in each type. Follows the shared responsive pattern:
 * ResponsivePageHeader, StatCard KPIs, mobile card view, DataGrid on desktop,
 * empty/no-results/loading skeleton states.
 */

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  CheckCircle2,
  FileText,
  FolderTree,
  ArrowRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  PiggyBank,
  CreditCard,
  Scale,
  Search,
  SearchX,
  BookOpen,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

interface AccountTypeSummary {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  category: string;
  normalBalance: string;
  displayOrder: number;
  accountCount: number;
  activeCount: number;
  postableCount: number;
  groupCount: number;
}

type CategoryFilter = '' | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface CategoryConfigEntry {
  color: string;
  bgColor: string;
  borderColor: string;
  iconBg: string;
  iconText: string;
  labelKey: string;
  labelThKey: string;
  icon: LucideIcon;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default';
}

const categoryConfig: Record<string, CategoryConfigEntry> = {
  asset: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    labelKey: 'categories.asset',
    labelThKey: 'categories.assetTh',
    icon: Wallet,
    badgeVariant: 'info',
  },
  liability: {
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    labelKey: 'categories.liability',
    labelThKey: 'categories.liabilityTh',
    icon: CreditCard,
    badgeVariant: 'warning',
  },
  equity: {
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    labelKey: 'categories.equity',
    labelThKey: 'categories.equityTh',
    icon: PiggyBank,
    badgeVariant: 'default',
  },
  revenue: {
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    labelKey: 'categories.revenue',
    labelThKey: 'categories.revenueTh',
    icon: TrendingUp,
    badgeVariant: 'success',
  },
  expense: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    labelKey: 'categories.expense',
    labelThKey: 'categories.expenseTh',
    icon: TrendingDown,
    badgeVariant: 'danger',
  },
};

const CATEGORY_FILTERS: Array<{
  key: CategoryFilter;
  translationKey: string;
  bgColor: string;
  textColor: string;
  icon: LucideIcon;
}> = [
  { key: '', translationKey: 'filters.all', bgColor: 'bg-gray-900', textColor: 'text-white', icon: Layers },
  { key: 'asset', translationKey: 'categories.assetTh', bgColor: 'bg-blue-600', textColor: 'text-white', icon: Wallet },
  { key: 'liability', translationKey: 'categories.liabilityTh', bgColor: 'bg-orange-500', textColor: 'text-white', icon: CreditCard },
  { key: 'equity', translationKey: 'categories.equityTh', bgColor: 'bg-purple-600', textColor: 'text-white', icon: PiggyBank },
  { key: 'revenue', translationKey: 'categories.revenueTh', bgColor: 'bg-emerald-600', textColor: 'text-white', icon: TrendingUp },
  { key: 'expense', translationKey: 'categories.expenseTh', bgColor: 'bg-red-600', textColor: 'text-white', icon: TrendingDown },
];

async function fetchAccountTypeSummary(): Promise<AccountTypeSummary[]> {
  const res = await fetch('/api/accounting/gl-account-types/summary');
  if (!res.ok) throw new Error('Failed to fetch account type summary');
  const data = await res.json();
  return data.data || [];
}

export default function AccountTypesPage() {
  const router = useRouter();
  const { isMobile } = useMobile();
  const t = useTranslations('accounting');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');

  const {
    data: types = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['gl-account-types-summary'],
    queryFn: fetchAccountTypeSummary,
  });

  const handleOpenType = useCallback(
    (type: AccountTypeSummary) => {
      router.push(`/accounting/chart-of-accounts?typeId=${type.id}`);
    },
    [router]
  );

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setCategoryFilter('');
  }, []);

  const handleViewChartOfAccounts = useCallback(() => {
    router.push('/accounting/chart-of-accounts');
  }, [router]);

  // Filtered list (category + search)
  const filteredTypes = useMemo(() => {
    return types.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.code?.toLowerCase().includes(q) ||
          item.nameTh?.toLowerCase().includes(q) ||
          item.nameEn?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [types, categoryFilter, search]);

  // Category counts for filter tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      '': types.length,
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    };
    types.forEach((item) => {
      if (item.category in counts) counts[item.category as CategoryFilter]++;
    });
    return counts;
  }, [types]);

  // KPI totals — Total types / Asset accounts / Liability accounts / Equity accounts
  const totals = useMemo(() => {
    const sumBy = (cat: string) =>
      types.filter((item) => item.category === cat).reduce((s, item) => s + item.accountCount, 0);
    return {
      totalTypes: types.length,
      totalAccounts: types.reduce((sum, item) => sum + item.accountCount, 0),
      activeAccounts: types.reduce((sum, item) => sum + item.activeCount, 0),
      postableAccounts: types.reduce((sum, item) => sum + item.postableCount, 0),
      groups: types.reduce((sum, item) => sum + item.groupCount, 0),
      assets: sumBy('asset'),
      liabilities: sumBy('liability'),
      equity: sumBy('equity'),
    };
  }, [types]);

  // DataGrid columns (desktop)
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'code',
      caption: t('accountTypes.columns.code'),
      width: 140,
      cellRender: (cellInfo) => {
        const type = cellInfo.data as AccountTypeSummary;
        const config = categoryConfig[type.category] || categoryConfig.asset;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', config.iconBg)}>
              <Icon className={cn('h-4 w-4', config.iconText)} />
            </div>
            <span className={cn('font-mono font-bold px-2 py-0.5 rounded text-xs', config.bgColor, config.color)}>
              {type.code}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'nameTh',
      caption: t('accountTypes.columns.name'),
      cellRender: (cellInfo) => {
        const type = cellInfo.data as AccountTypeSummary;
        return (
          <div>
            <p className="font-medium text-gray-900">{type.nameTh}</p>
            <p className="text-xs text-gray-500">{type.nameEn}</p>
          </div>
        );
      },
    },
    {
      dataField: 'category',
      caption: t('accountTypes.columns.category'),
      width: 160,
      cellRender: (cellInfo) => {
        const type = cellInfo.data as AccountTypeSummary;
        const config = categoryConfig[type.category] || categoryConfig.asset;
        return (
          <Badge variant={config.badgeVariant} dot>
            {t(`accountTypes.${config.labelThKey}`)}
          </Badge>
        );
      },
    },
    {
      dataField: 'normalBalance',
      caption: t('accountTypes.columns.normalBalance'),
      width: 110,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const type = cellInfo.data as AccountTypeSummary;
        const isDebit = type.normalBalance === 'debit';
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded',
              isDebit ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
            )}
          >
            <Scale className="h-3 w-3" />
            {isDebit ? t('accountTypes.balance.debit') : t('accountTypes.balance.credit')}
          </span>
        );
      },
    },
    {
      dataField: 'accountCount',
      caption: t('accountTypes.columns.accounts'),
      width: 100,
      alignment: 'center',
      cellRender: (cellInfo) => {
        const type = cellInfo.data as AccountTypeSummary;
        return (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
            <Layers className="h-3.5 w-3.5 text-gray-400" />
            {type.accountCount}
          </span>
        );
      },
    },
    {
      dataField: 'activeCount',
      caption: t('accountTypes.columns.active'),
      width: 100,
      alignment: 'center',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const type = cellInfo.data as AccountTypeSummary;
        const pct = type.accountCount > 0 ? Math.round((type.activeCount / type.accountCount) * 100) : 0;
        return (
          <span
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"
            title={t('accountTypes.tooltips.activePercent', { percent: pct })}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {type.activeCount}
          </span>
        );
      },
    },
    {
      dataField: 'postableCount',
      caption: t('accountTypes.columns.postable'),
      width: 110,
      alignment: 'center',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">
          <FileText className="h-3.5 w-3.5" />
          {(cellInfo.data as AccountTypeSummary).postableCount}
        </span>
      ),
    },
    {
      dataField: 'groupCount',
      caption: t('accountTypes.columns.groups'),
      width: 100,
      alignment: 'center',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
          <FolderTree className="h-3.5 w-3.5" />
          {(cellInfo.data as AccountTypeSummary).groupCount}
        </span>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 90,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            title={t('accountTypes.card.viewChartOfType')}
            aria-label={t('accountTypes.card.viewChartOfType')}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenType(cellInfo.data as AccountTypeSummary);
            }}
            className="p-2 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], [t, handleOpenType]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('accountTypes.title')}
        subtitle={t('accountTypes.subtitle')}
        icon={Layers}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        breadcrumbs={[
          { label: t('accountTypes.breadcrumbAccounting'), href: '/accounting' },
          { label: t('accountTypes.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('accountTypes.refresh')}
              stylingMode="outlined"
              onClick={() => refetch()}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="bulletlist"
              text={t('accountTypes.viewChart')}
              stylingMode="outlined"
              type="default"
              onClick={handleViewChartOfAccounts}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('accountTypes.stats.totalTypes')}
          value={totals.totalTypes}
          icon={Layers}
          iconColor="text-teal-500"
          accentColor="border-teal-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountTypes.stats.assetAccounts')}
          value={totals.assets}
          icon={Wallet}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountTypes.stats.liabilityAccounts')}
          value={totals.liabilities}
          icon={CreditCard}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('accountTypes.stats.equityAccounts')}
          value={totals.equity}
          icon={PiggyBank}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
      </div>

      {/* Filter + Content Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Category Filter Tabs (scrollable on mobile) */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {CATEGORY_FILTERS.map((filter) => {
              const Icon = filter.icon;
              const count = categoryCounts[filter.key];
              const isActive = categoryFilter === filter.key;
              return (
                <button
                  key={filter.key || 'all'}
                  onClick={() => setCategoryFilter(filter.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? `${filter.bgColor} ${filter.textColor} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(`accountTypes.${filter.translationKey}`)}</span>
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                      isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Count Row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:max-w-md">
            <DxTextBox
              placeholder={t('accountTypes.search.placeholder')}
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Layers className="h-4 w-4 text-gray-400" />
            <span>
              {t('accountTypes.showingCount', { filtered: filteredTypes.length, total: types.length })}
            </span>
          </div>
        </div>

        {/* Content: Loading / Empty / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <AccountTypeCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : types.length === 0 ? (
          <EmptyState onRefresh={() => refetch()} t={t} />
        ) : filteredTypes.length === 0 ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <AccountTypeCardList types={filteredTypes} onOpen={handleOpenType} t={t} />
        ) : (
          <DxDataGrid
            key={locale}
            dataSource={filteredTypes}
            keyExpr="id"
            columns={columns}
            sorting
            filterRow
            headerFilter
            responsiveColumns
            height={560}
            mobileHeight={480}
            tabletHeight={520}
            noDataText={t('accountTypes.noDataText')}
            onRowClick={(e) => {
              if (e.data) handleOpenType(e.data as AccountTypeSummary);
            }}
          />
        )}
      </div>

      {/* Summary Footer Table (desktop only, informational) */}
      {!isLoading && types.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hidden md:block">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              {t('accountTypes.summaryTable.title')}
            </h3>
            <span className="text-xs text-gray-500">
              {totals.totalAccounts > 0
                ? t('accountTypes.summaryTable.activeUsage', {
                    percent: Math.round((totals.activeAccounts / totals.totalAccounts) * 100),
                  })
                : t('accountTypes.summaryTable.noAccounts')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 720 }}>
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-5 py-3 text-left font-medium">{t('accountTypes.summaryTable.columns.category')}</th>
                  <th className="px-5 py-3 text-center font-medium">{t('accountTypes.summaryTable.columns.types')}</th>
                  <th className="px-5 py-3 text-center font-medium">{t('accountTypes.summaryTable.columns.totalAccounts')}</th>
                  <th className="px-5 py-3 text-center font-medium">{t('accountTypes.summaryTable.columns.active')}</th>
                  <th className="px-5 py-3 text-center font-medium">{t('accountTypes.summaryTable.columns.postable')}</th>
                  <th className="px-5 py-3 text-center font-medium">{t('accountTypes.summaryTable.columns.groups')}</th>
                </tr>
              </thead>
              <tbody>
                {(['asset', 'liability', 'equity', 'revenue', 'expense'] as const).map((cat) => {
                  const config = categoryConfig[cat];
                  const typesInCat = types.filter((item) => item.category === cat);
                  if (typesInCat.length === 0) return null;
                  const accounts = typesInCat.reduce((s, item) => s + item.accountCount, 0);
                  const active = typesInCat.reduce((s, item) => s + item.activeCount, 0);
                  const postable = typesInCat.reduce((s, item) => s + item.postableCount, 0);
                  const groups = typesInCat.reduce((s, item) => s + item.groupCount, 0);
                  const Icon = config.icon;
                  return (
                    <tr key={cat} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-7 w-7 rounded-md flex items-center justify-center', config.iconBg)}>
                            <Icon className={cn('h-3.5 w-3.5', config.iconText)} />
                          </div>
                          <span className={cn('text-sm font-medium', config.color)}>
                            {t(`accountTypes.${config.labelThKey}`)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center font-semibold">{typesInCat.length}</td>
                      <td className="px-5 py-3 text-center font-semibold">{accounts}</td>
                      <td className="px-5 py-3 text-center text-emerald-600 font-medium">{active}</td>
                      <td className="px-5 py-3 text-center text-blue-600 font-medium">{postable}</td>
                      <td className="px-5 py-3 text-center text-amber-600 font-medium">{groups}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-5 py-3">{t('accountTypes.summaryTable.total')}</td>
                  <td className="px-5 py-3 text-center">{totals.totalTypes}</td>
                  <td className="px-5 py-3 text-center">{totals.totalAccounts}</td>
                  <td className="px-5 py-3 text-center text-emerald-600">{totals.activeAccounts}</td>
                  <td className="px-5 py-3 text-center text-blue-600">{totals.postableAccounts}</td>
                  <td className="px-5 py-3 text-center text-amber-600">{totals.groups}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card shows: icon, type code, Thai/English name, normal balance,
 * count stats, and a tap-friendly 44px footer to open the chart of accounts.
 */
function AccountTypeCardList({
  types,
  onOpen,
  t,
}: {
  types: AccountTypeSummary[];
  onOpen: (t: AccountTypeSummary) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {types.map((type) => {
        const config = categoryConfig[type.category] || categoryConfig.asset;
        const Icon = config.icon;
        const isDebit = type.normalBalance === 'debit';
        const activePct =
          type.accountCount > 0 ? Math.round((type.activeCount / type.accountCount) * 100) : 0;
        return (
          <div
            key={type.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body */}
            <button
              type="button"
              onClick={() => onOpen(type)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  config.iconBg
                )}
              >
                <Icon className={cn('h-5 w-5', config.iconText)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'font-mono font-bold text-xs px-2 py-0.5 rounded',
                          config.bgColor,
                          config.color
                        )}
                      >
                        {type.code}
                      </span>
                      <Badge variant={config.badgeVariant}>
                        {t(`accountTypes.${config.labelThKey}`)}
                      </Badge>
                    </div>
                    <p className="font-semibold text-gray-900 text-base truncate">{type.nameTh}</p>
                    <p className="text-xs text-gray-500 truncate">{type.nameEn}</p>
                  </div>
                </div>

                {/* Normal balance + stats row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded',
                      isDebit ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    )}
                  >
                    <Scale className="h-3 w-3" />
                    {isDebit ? t('accountTypes.balance.debit') : t('accountTypes.balance.credit')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    <Layers className="h-3 w-3" />
                    {type.accountCount} {t('accountTypes.card.accountsLabel')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('accountTypes.card.activeLabel')} {type.activeCount} ({activePct}%)
                  </span>
                  {type.groupCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                      <FolderTree className="h-3 w-3" />
                      {type.groupCount} {t('accountTypes.card.groupsLabel')}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Footer: touch-friendly tap target (44px min-height) */}
            <button
              type="button"
              onClick={() => onOpen(type)}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-100 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 transition-colors min-h-[44px]"
            >
              <BookOpen className="h-4 w-4" />
              <span>{t('accountTypes.card.viewChartOfType')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function AccountTypeCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
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
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
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

/** Empty State — no account types at all */
function EmptyState({ onRefresh, t }: { onRefresh: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-teal-100 flex items-center justify-center mb-5">
        <Coins className="h-10 w-10 text-teal-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('accountTypes.empty.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('accountTypes.empty.description')}
      </p>
      <DxButton icon="refresh" text={t('accountTypes.actions.retry')} stylingMode="outlined" onClick={onRefresh} />
    </div>
  );
}

/** No Results State — filter/search returned zero results */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{t('accountTypes.noResults.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('accountTypes.noResults.description')}
      </p>
      <DxButton
        text={t('accountTypes.actions.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}

// Suppress unused-import warning for Search icon kept for future use in filter header
void Search;
