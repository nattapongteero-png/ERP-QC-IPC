'use client';

/**
 * Purchase Requisitions List Page (T046)
 * Part of 011-accounting-spec-gap
 * Redesigned to match PO list UI pattern
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils/cn';
import {
  FileText,
  Clock,
  CheckCircle,
  Send,
  XCircle,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  ArrowRightCircle,
  Zap,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type { PurchaseRequisition, PRStatus, PRPriority } from '@/types/purchase-requisition';

// Status filter type
type PRStatusFilter = '' | PRStatus;

// Status configuration for tabs and styling
const STATUS_CONFIG: Record<PRStatusFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    hoverBg: 'hover:bg-gray-200',
    icon: <ClipboardList className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  draft: {
    translationKey: 'draft',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    hoverBg: 'hover:bg-slate-200',
    icon: <FileText className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  submitted: {
    translationKey: 'submitted',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    hoverBg: 'hover:bg-blue-200',
    icon: <Send className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  pending_approval: {
    translationKey: 'pendingApproval',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    hoverBg: 'hover:bg-yellow-200',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  approved: {
    translationKey: 'approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    hoverBg: 'hover:bg-green-200',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  rejected: {
    translationKey: 'rejected',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    hoverBg: 'hover:bg-red-200',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
  cancelled: {
    translationKey: 'cancelled',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-500',
    hoverBg: 'hover:bg-gray-200',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'secondary',
  },
  converted: {
    translationKey: 'converted',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    hoverBg: 'hover:bg-purple-200',
    icon: <ArrowRightCircle className="h-4 w-4" />,
    badgeVariant: 'primary',
  },
};

// Priority configuration
const PRIORITY_CONFIG: Record<PRPriority, {
  translationKey: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
}> = {
  low: {
    translationKey: 'low',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
  normal: {
    translationKey: 'normal',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  high: {
    translationKey: 'high',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  urgent: {
    translationKey: 'urgent',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: <Zap className="h-3 w-3" />,
  },
};

const STATUS_ORDER: PRStatusFilter[] = ['', 'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled', 'converted'];

// Helper function to normalize status for comparison
const normalizeStatus = (status: string): string => status?.toLowerCase() || '';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return `฿${amount.toFixed(0)}`;
};

export default function PurchaseRequisitionsPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PRStatusFilter>('');

  const fetchRequisitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/purchasing/requisitions?limit=1000');
      const result = await response.json();
      if (result.success) {
        setRequisitions(result.data || []);
      } else {
        setRequisitions([]);
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
      setRequisitions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  // Client-side filtering
  const filteredRequisitions = requisitions.filter((pr) => {
    const matchesStatus = !statusFilter || normalizeStatus(pr.status) === statusFilter;
    const matchesSearch =
      !search ||
      pr.prNumber?.toLowerCase().includes(search.toLowerCase()) ||
      pr.description?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate counts for each status
  const statusCounts = STATUS_ORDER.reduce((acc, status) => {
    if (status === '') {
      acc[status] = requisitions.length;
    } else {
      acc[status] = requisitions.filter((r) => normalizeStatus(r.status) === status).length;
    }
    return acc;
  }, {} as Record<PRStatusFilter, number>);

  // Calculate stats
  const totalAmount = requisitions.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
  const pendingCount = requisitions.filter((r) =>
    ['draft', 'submitted', 'pending_approval'].includes(normalizeStatus(r.status))
  ).length;
  const urgentCount = requisitions.filter((r) =>
    r.priority === 'urgent' || r.priority === 'high'
  ).length;

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/requisitions/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'prNumber',
      caption: t('requisitions.grid.columns.prNumber'),
      width: 150,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as PRStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', config.bgColor)}>
              <span className={config.textColor}>{config.icon}</span>
            </div>
            <div>
              <span className="font-mono font-semibold text-gray-900">{cellInfo.data.prNumber}</span>
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'description',
      caption: t('requisitions.grid.columns.description'),
      minWidth: 200,
      cellRender: (cellInfo) => (
        <span className="text-gray-800 truncate">{cellInfo.data.description || '-'}</span>
      ),
    },
    {
      dataField: 'priority',
      caption: t('requisitions.grid.columns.priority'),
      width: 110,
      cellRender: (cellInfo) => {
        const priority = (cellInfo.data.priority as PRPriority) || 'normal';
        const config = PRIORITY_CONFIG[priority];
        return (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium w-fit', config.bgColor, config.color)}>
            {config.icon}
            <span>{t(`requisitions.priority.${config.translationKey}`)}</span>
          </div>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: t('requisitions.grid.columns.totalAmount'),
      width: 130,
      dataType: 'number',
      cellRender: (cellInfo) => (
        <div className="text-right">
          <span className="font-semibold text-gray-900">
            {formatCurrency(Number(cellInfo.data.totalAmount || 0))}
          </span>
        </div>
      ),
    },
    {
      dataField: 'requiredDate',
      caption: t('requisitions.grid.columns.requiredDate'),
      width: 130,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const requiredDate = cellInfo.data.requiredDate;
        const status = normalizeStatus(cellInfo.data.status);
        if (!requiredDate) return <span className="text-gray-400">-</span>;

        const isOverdue = new Date(requiredDate) < new Date() && !['converted', 'cancelled', 'rejected'].includes(status);
        return (
          <div className="flex items-center gap-1">
            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            <span className={cn('text-sm', isOverdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
              {formatDate(requiredDate)}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'createdAt',
      caption: t('requisitions.grid.columns.createdAt'),
      width: 120,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-600 text-sm">{formatDate(cellInfo.data.createdAt)}</span>
      ),
    },
    {
      dataField: 'status',
      caption: t('requisitions.grid.columns.status'),
      width: 130,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as PRStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <Badge variant={config.badgeVariant} dot>
            {t(`requisitions.status.${config.translationKey}`)}
          </Badge>
        );
      },
    },
  ], [t]);

  return (
    <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
      <PageHeader
        title={t('requisitions.pageTitle')}
        description={t('requisitions.description')}
        actions={
          <div className="flex items-center gap-2">
            <DxButton
              icon="refresh"
              type="normal"
              stylingMode="outlined"
              hint={t('requisitions.actions.refresh')}
              onClick={() => fetchRequisitions()}
              data-testid="refresh-btn"
            />
            <DxButton
              text={t('requisitions.actions.createPR')}
              icon="plus"
              type="success"
              onClick={() => router.push('/purchasing/requisitions/new')}
              data-testid="new-pr-btn"
            />
          </div>
        }
      />

      {/* Main Content Card */}
      <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
        <CardHeader className="pb-0 space-y-3">
          {/* Status Tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
              {STATUS_ORDER.map((status) => {
                const config = STATUS_CONFIG[status];
                const count = statusCounts[status];
                const isActive = statusFilter === status;

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                      isActive
                        ? `${config.bgColor} ${config.textColor} shadow-sm`
                        : `text-gray-500 ${config.hoverBg}`
                    )}
                    data-testid={`status-tab-${status || 'all'}`}
                  >
                    {config.icon}
                    <span>{t(`requisitions.status.${config.translationKey}`)}</span>
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

            {/* Compact Stats */}
            <div className="hidden lg:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-blue-600">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold">{formatCompactCurrency(totalAmount)}</span>
                <span className="text-gray-400">{t('requisitions.stats.total')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-yellow-600">
                <Clock className="h-4 w-4" />
                <span className="font-semibold">{pendingCount}</span>
                <span className="text-gray-400">{t('requisitions.stats.pending')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-600">
                <Zap className="h-4 w-4" />
                <span className="font-semibold">{urgentCount}</span>
                <span className="text-gray-400">{t('requisitions.stats.urgent')}</span>
              </div>
            </div>
          </div>

          {/* Search Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-md">
              <DxTextBox
                placeholder={t('requisitions.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
                data-testid="search-input"
              />
            </div>
            <div className="text-sm text-gray-500">
              {t('requisitions.grid.showing', { count: filteredRequisitions.length })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 flex flex-col pt-3">
          <DxDataGrid
            dataSource={filteredRequisitions}
            keyExpr="id"
            columns={columns}
            loading={isLoading}
            sorting
            filterRow
            headerFilter
            export
            exportFileName="purchase-requisitions"
            columnChooser
            virtualScrolling={filteredRequisitions.length > 100}
            fillHeight
            onRowClick={handleRowClick}
            noDataText={t('requisitions.grid.noData')}
            data-testid="pr-grid"
          />
        </CardContent>
      </Card>
    </div>
  );
}
