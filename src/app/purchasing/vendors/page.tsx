'use client';

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
  Building2,
  CheckCircle,
  Clock,
  Truck,
  Link2,
  UserCheck,
  Mail,
  Phone,
  XCircle,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isApproved: boolean;
  isVMI: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
}

// Status filter type
type VendorStatusFilter = '' | 'approved' | 'pending' | 'vmi' | 'inactive';

// Status configuration for tabs and styling
const STATUS_CONFIG: Record<VendorStatusFilter, {
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
    icon: <Building2 className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  approved: {
    translationKey: 'approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    hoverBg: 'hover:bg-green-200',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  pending: {
    translationKey: 'pending',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    hoverBg: 'hover:bg-yellow-200',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  vmi: {
    translationKey: 'vmi',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    hoverBg: 'hover:bg-blue-200',
    icon: <Link2 className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  inactive: {
    translationKey: 'inactive',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    hoverBg: 'hover:bg-red-200',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
};

const STATUS_ORDER: VendorStatusFilter[] = ['', 'approved', 'pending', 'vmi', 'inactive'];

export default function VendorsPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatusFilter>('');

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/vendors?limit=1000');
      const data = await res.json();

      if (data.success) {
        setVendors(data.data?.items || []);
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Client-side filtering
  const filteredVendors = vendors.filter((vendor) => {
    // Status filter
    let matchesStatus = true;
    switch (statusFilter) {
      case 'approved':
        matchesStatus = vendor.isApproved === true && vendor.isActive !== false;
        break;
      case 'pending':
        matchesStatus = vendor.isApproved === false && vendor.isActive !== false;
        break;
      case 'vmi':
        matchesStatus = vendor.isVMI === true;
        break;
      case 'inactive':
        matchesStatus = vendor.isActive === false;
        break;
    }

    // Search filter
    const matchesSearch =
      !search ||
      vendor.code?.toLowerCase().includes(search.toLowerCase()) ||
      vendor.name?.toLowerCase().includes(search.toLowerCase()) ||
      vendor.contactPerson?.toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Calculate counts for each status
  const statusCounts: Record<VendorStatusFilter, number> = {
    '': vendors.length,
    approved: vendors.filter((v) => v.isApproved === true && v.isActive !== false).length,
    pending: vendors.filter((v) => v.isApproved === false && v.isActive !== false).length,
    vmi: vendors.filter((v) => v.isVMI === true).length,
    inactive: vendors.filter((v) => v.isActive === false).length,
  };

  // Calculate stats
  const activeVendors = vendors.filter((v) => v.isActive !== false).length;
  const avgLeadTime = vendors.filter((v) => v.leadTimeDays).reduce((sum, v) => sum + (v.leadTimeDays || 0), 0) /
    (vendors.filter((v) => v.leadTimeDays).length || 1);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/vendors/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'code',
      caption: t('vendors.grid.columns.code'),
      width: 120,
      cellRender: (cellInfo) => {
        const isApproved = cellInfo.data.isApproved;
        const isVMI = cellInfo.data.isVMI;
        const isActive = cellInfo.data.isActive !== false;

        let bgColor = 'bg-gray-100';
        let textColor = 'text-gray-600';
        let icon = <Building2 className="h-4 w-4" />;

        if (!isActive) {
          bgColor = 'bg-red-100';
          textColor = 'text-red-600';
          icon = <XCircle className="h-4 w-4" />;
        } else if (isVMI) {
          bgColor = 'bg-blue-100';
          textColor = 'text-blue-600';
          icon = <Link2 className="h-4 w-4" />;
        } else if (isApproved) {
          bgColor = 'bg-green-100';
          textColor = 'text-green-600';
          icon = <CheckCircle className="h-4 w-4" />;
        } else {
          bgColor = 'bg-yellow-100';
          textColor = 'text-yellow-600';
          icon = <Clock className="h-4 w-4" />;
        }

        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', bgColor)}>
              <span className={textColor}>{icon}</span>
            </div>
            <span className="font-mono font-semibold text-gray-900">{cellInfo.data.code}</span>
          </div>
        );
      },
    },
    {
      dataField: 'name',
      caption: t('vendors.grid.columns.name'),
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs">
            {cellInfo.data.name?.charAt(0)?.toUpperCase() || 'V'}
          </div>
          <div className="min-w-0">
            <span className="font-medium text-gray-800 truncate block">{cellInfo.data.name || '-'}</span>
            {cellInfo.data.contactPerson && (
              <span className="text-xs text-gray-500 truncate block">{cellInfo.data.contactPerson}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      dataField: 'phone',
      caption: t('vendors.grid.columns.phone'),
      width: 140,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.phone) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm">{cellInfo.data.phone}</span>
          </div>
        );
      },
    },
    {
      dataField: 'email',
      caption: t('vendors.grid.columns.email'),
      width: 200,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.email) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm truncate">{cellInfo.data.email}</span>
          </div>
        );
      },
    },
    {
      dataField: 'leadTimeDays',
      caption: t('vendors.grid.columns.leadTime'),
      width: 110,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const days = cellInfo.data.leadTimeDays;
        if (!days) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-gray-400" />
            <span className={cn(
              'text-sm font-medium',
              days <= 7 ? 'text-green-600' : days <= 14 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {t('vendors.grid.days', { days })}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'paymentTerms',
      caption: t('vendors.grid.columns.paymentTerms'),
      width: 120,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.paymentTerms) return <span className="text-gray-400">-</span>;
        return <span className="text-sm text-gray-600">{cellInfo.data.paymentTerms}</span>;
      },
    },
    {
      dataField: 'status',
      caption: t('vendors.grid.columns.status'),
      width: 180,
      cellRender: (cellInfo) => {
        const isApproved = cellInfo.data.isApproved;
        const isVMI = cellInfo.data.isVMI;
        const isActive = cellInfo.data.isActive !== false;

        return (
          <div className="flex gap-1 flex-wrap">
            {!isActive ? (
              <Badge variant="danger" dot>{t('vendors.status.inactive')}</Badge>
            ) : (
              <>
                <Badge variant={isApproved ? 'success' : 'warning'} dot>
                  {isApproved ? t('vendors.status.approved') : t('vendors.status.pending')}
                </Badge>
                {isVMI && <Badge variant="info">{t('vendors.status.vmi')}</Badge>}
              </>
            )}
          </div>
        );
      },
    },
  ], [t]);

  return (
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title={t('vendors.pageTitle')}
          description={t('vendors.description')}
          actions={
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="outlined"
                hint={t('vendors.actions.refresh')}
                onClick={() => fetchVendors()}
              />
              <DxButton
                text={t('vendors.actions.addVendor')}
                icon="plus"
                type="success"
                onClick={() => router.push('/purchasing/vendors/new')}
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
                    >
                      {config.icon}
                      <span>{t(`vendors.status.${config.translationKey}`)}</span>
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
                <div className="flex items-center gap-1.5 text-green-600">
                  <UserCheck className="h-4 w-4" />
                  <span className="font-semibold">{statusCounts.approved}</span>
                  <span className="text-gray-400">{t('vendors.stats.approved')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-600">
                  <Link2 className="h-4 w-4" />
                  <span className="font-semibold">{statusCounts.vmi}</span>
                  <span className="text-gray-400">{t('vendors.stats.vmi')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-600">
                  <Truck className="h-4 w-4" />
                  <span className="font-semibold">{avgLeadTime.toFixed(0)}</span>
                  <span className="text-gray-400">{t('vendors.stats.avgDays')}</span>
                </div>
              </div>
            </div>

            {/* Search Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-md">
                <DxTextBox
                  placeholder={t('vendors.searchPlaceholder')}
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="text-sm text-gray-500">
                {t('vendors.grid.showing', { count: filteredVendors.length })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col pt-3">
            <DxDataGrid
              dataSource={filteredVendors}
              keyExpr="id"
              columns={columns}
              loading={isLoading}
              sorting
              filterRow
              headerFilter
              export
              exportFileName="vendors"
              columnChooser
              virtualScrolling={filteredVendors.length > 100}
              fillHeight
              onRowClick={handleRowClick}
              noDataText={t('vendors.grid.noData')}
            />
          </CardContent>
        </Card>
      </div>
  );
}
