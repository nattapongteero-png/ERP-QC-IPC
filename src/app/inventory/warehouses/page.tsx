'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import {
  WarehouseEditDialog,
  type Warehouse as WarehouseType,
  type WarehouseFormData,
  type WarehouseSummary,
} from '@/components/ui/warehouse-edit-dialog';
import {
  Warehouse,
  MapPin,
  Thermometer,
  Droplets,
  Package,
  Boxes,
  CheckCircle,
  Clock,
  XCircle,
  Snowflake,
  ShieldAlert,
  Database,
  Pencil,
  Trash2,
  Eye,
  SearchX,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/number-format';

// Type configuration for tabs
type WarehouseTypeFilter = '' | 'raw_material' | 'wip' | 'finished_goods' | 'quarantine' | 'rejected' | 'cold_storage';

const TYPE_CONFIG: Record<WarehouseTypeFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default';
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gradient-to-br from-[#064E3B] to-emerald-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-gray-800',
    icon: <Boxes className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  raw_material: {
    translationKey: 'rawMaterial',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-emerald-700',
    icon: <Package className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  wip: {
    translationKey: 'wip',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    hoverBg: 'hover:bg-amber-600',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  finished_goods: {
    translationKey: 'finishedGoods',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-emerald-700',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  quarantine: {
    translationKey: 'quarantine',
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
    hoverBg: 'hover:bg-yellow-600',
    icon: <ShieldAlert className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  rejected: {
    translationKey: 'rejected',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-red-700',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
  cold_storage: {
    translationKey: 'coldStorage',
    bgColor: 'bg-cyan-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-cyan-700',
    icon: <Snowflake className="h-4 w-4" />,
    badgeVariant: 'info',
  },
};

// Normalize legacy/dirty DB values like "raw material" (space) or mixed case
// to the canonical TYPE_CONFIG key ("raw_material"). Unknown types (e.g.
// "general") return null so caller can fall back gracefully.
const normalizeWarehouseType = (rawType: string | null | undefined): WarehouseTypeFilter | null => {
  if (!rawType) return null;
  const normalized = rawType.trim().toLowerCase().replace(/\s+/g, '_') as WarehouseTypeFilter;
  return normalized in TYPE_CONFIG ? normalized : null;
};

const getTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  const normalized = normalizeWarehouseType(type);
  return normalized ? TYPE_CONFIG[normalized].badgeVariant : 'default';
};

export default function WarehousesPage() {
  const router = useRouter();
  const t = useTranslations('inventory');
  const locale = useLocale();
  const { isMobile } = useMobile();
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<WarehouseTypeFilter>('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [warehouseSummary, setWarehouseSummary] = useState<WarehouseSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; warehouse: WarehouseType | null }>({ open: false, warehouse: null });

  const fetchWarehouses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');

      const res = await fetch(`/api/warehouses?${params}`);
      const data = await res.json();

      if (data.success) {
        setWarehouses(data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleSave = async (formData: WarehouseFormData) => {
    try {
      const url = editingWarehouse
        ? `/api/warehouses/${editingWarehouse.id}`
        : '/api/warehouses';
      const method = editingWarehouse ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowDialog(false);
        setEditingWarehouse(null);
        setWarehouseSummary(null);
        fetchWarehouses();
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.warehouse) return;

    try {
      const res = await fetch(`/api/warehouses/${deleteConfirm.warehouse.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchWarehouses();
      }
    } catch {
      // Network errors handled by global error handler
    } finally {
      setDeleteConfirm({ open: false, warehouse: null });
    }
  };

  const handleCreate = () => {
    setEditingWarehouse(null);
    setWarehouseSummary(null);
    setShowDialog(true);
  };

  // Edit goes to the detail page in Settings-tab edit mode (?edit=1)
  // so users land in the same UI whether they clicked the row OR the
  // pencil. The popup dialog is reserved for the "+ Add" flow.
  const handleEdit = useCallback((warehouse: WarehouseType) => {
    router.push(`/inventory/warehouses/${warehouse.id}?edit=1`);
  }, [router]);

  const handleDeleteClick = useCallback((warehouse: WarehouseType) => {
    setDeleteConfirm({ open: true, warehouse });
  }, []);

  const handleView = useCallback((warehouse: WarehouseType) => {
    router.push(`/inventory/warehouses/${warehouse.id}`);
  }, [router]);

  // Filter warehouses + tag with display row number (mirrors /inventory/items).
  const filteredWarehouses = warehouses
    .filter(warehouse => {
      if (typeFilter && warehouse.type !== typeFilter) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          warehouse.code?.toLowerCase().includes(searchLower) ||
          warehouse.name?.toLowerCase().includes(searchLower) ||
          warehouse.location?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .map((w, index) => ({ ...w, _rowNumber: index + 1 }));

  // Calculate counts for tabs
  const typeCounts: Record<WarehouseTypeFilter, number> = {
    '': warehouses.length,
    raw_material: warehouses.filter(w => w.type === 'raw_material').length,
    wip: warehouses.filter(w => w.type === 'wip').length,
    finished_goods: warehouses.filter(w => w.type === 'finished_goods').length,
    quarantine: warehouses.filter(w => w.type === 'quarantine').length,
    rejected: warehouses.filter(w => w.type === 'rejected').length,
    cold_storage: warehouses.filter(w => w.type === 'cold_storage').length,
  };

  // Calculate summary stats
  const activeCount = warehouses.filter(w => w.isActive).length;
  const inactiveCount = warehouses.filter(w => !w.isActive).length;
  const coldStorageCount = typeCounts.cold_storage;

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cellInfo) => (
        <span className="text-gray-500 text-sm font-medium">
          {cellInfo.data._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'code',
      caption: t('warehouses.table.columns.code'),
      width: 120,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center',
            cellInfo.data.type === 'raw_material' ? 'bg-emerald-100' :
            cellInfo.data.type === 'finished_goods' ? 'bg-emerald-100' :
            cellInfo.data.type === 'quarantine' ? 'bg-yellow-100' :
            cellInfo.data.type === 'rejected' ? 'bg-red-100' :
            cellInfo.data.type === 'cold_storage' ? 'bg-cyan-100' :
            'bg-gray-100'
          )}>
            <Warehouse className={cn(
              'h-4 w-4',
              cellInfo.data.type === 'raw_material' ? 'text-emerald-600' :
              cellInfo.data.type === 'finished_goods' ? 'text-emerald-600' :
              cellInfo.data.type === 'quarantine' ? 'text-yellow-600' :
              cellInfo.data.type === 'rejected' ? 'text-red-600' :
              cellInfo.data.type === 'cold_storage' ? 'text-cyan-600' :
              'text-gray-600'
            )} />
          </div>
          <span className="font-mono font-semibold text-gray-900">{cellInfo.data.code}</span>
        </div>
      ),
    },
    {
      dataField: 'name',
      caption: t('warehouses.table.columns.name'),
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium text-gray-900">{cellInfo.data.name}</p>
          {cellInfo.data.location && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {cellInfo.data.location}
            </p>
          )}
        </div>
      ),
    },
    {
      dataField: 'type',
      caption: t('warehouses.table.columns.type'),
      width: 160,
      cellRender: (cellInfo) => {
        const normalized = normalizeWarehouseType(cellInfo.data.type);
        const config = normalized ? TYPE_CONFIG[normalized] : null;
        // For known types, translate the config key; for unknown/legacy values
        // (e.g. "general"), fall back to the raw DB value rather than rendering
        // a broken translation path like "warehouses.types.general".
        const label = config
          ? t(`warehouses.types.${config.translationKey}`)
          : (cellInfo.data.type || '—');
        return (
          <Badge variant={getTypeVariant(cellInfo.data.type)} dot>
            {label}
          </Badge>
        );
      },
    },
    {
      dataField: 'temperatureMin',
      caption: t('warehouses.table.columns.temperature'),
      width: 175,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        const hasTemp = cellInfo.data.temperatureMin !== null && cellInfo.data.temperatureMax !== null;
        return (
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md flex-nowrap',
            hasTemp ? 'bg-cyan-50' : ''
          )}>
            <Thermometer className={cn('h-3.5 w-3.5 shrink-0', hasTemp ? 'text-cyan-600' : 'text-gray-400')} />
            <span className={cn('whitespace-nowrap', hasTemp ? 'text-cyan-700 font-medium' : 'text-gray-400')}>
              {hasTemp
                ? `${cellInfo.data.temperatureMin}°C - ${cellInfo.data.temperatureMax}°C`
                : '-'}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'humidityMin',
      caption: t('warehouses.table.columns.humidity'),
      width: 160,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        const hasHumidity = cellInfo.data.humidityMin !== null && cellInfo.data.humidityMax !== null;
        return (
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md flex-nowrap',
            hasHumidity ? 'bg-emerald-50' : ''
          )}>
            <Droplets className={cn('h-3.5 w-3.5 shrink-0', hasHumidity ? 'text-emerald-600' : 'text-gray-400')} />
            <span className={cn('whitespace-nowrap', hasHumidity ? 'text-emerald-700 font-medium' : 'text-gray-400')}>
              {hasHumidity
                ? `${cellInfo.data.humidityMin}% - ${cellInfo.data.humidityMax}%`
                : '-'}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'capacity',
      caption: t('warehouses.table.columns.capacity'),
      width: 120,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-1">
          <Database className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-700 font-medium">
            {cellInfo.data.capacity ? formatNumber(cellInfo.data.capacity) : '-'}
          </span>
        </div>
      ),
    },
    {
      dataField: 'isActive',
      caption: t('warehouses.table.columns.status'),
      width: 110,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? t('warehouses.status.active') : t('warehouses.status.inactive')}
        </Badge>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 140,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={t('warehouses.viewDetails')}
            aria-label={t('warehouses.viewDetails')}
            onClick={(e) => {
              e.stopPropagation();
              handleView(cellInfo.data as WarehouseType);
            }}
            className="p-2 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t('common.edit') || 'Edit'}
            aria-label={t('common.edit') || 'Edit'}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(cellInfo.data as WarehouseType);
            }}
            className="p-2 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t('common.delete') || 'Delete'}
            aria-label={t('common.delete') || 'Delete'}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(cellInfo.data as WarehouseType);
            }}
            className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        {/* Responsive Page Header */}
        <ResponsivePageHeader
          title={t('warehouses.pageTitle')}
          subtitle={t('warehouses.description')}
          icon={Warehouse}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text={t('common.refresh')}
                stylingMode="outlined"
                onClick={fetchWarehouses}
                className="hidden sm:inline-flex"
              />
              <DxButton
                icon="box"
                text={t('warehouses.viewLots')}
                stylingMode="outlined"
                onClick={() => router.push('/inventory/lots')}
                className="hidden md:inline-flex"
              />
              <button
                onClick={() => {
                  const rows = filteredWarehouses.map((w) => ({
                    [t('warehouses.table.columns.code')]: w.code,
                    [t('warehouses.table.columns.name')]: w.name,
                    [t('warehouses.table.columns.type')]: w.type,
                    [t('warehouses.table.columns.status')]: w.isActive
                      ? t('warehouses.status.active')
                      : t('warehouses.status.inactive'),
                  }));
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.json_to_sheet(rows);
                  ws['!cols'] = Array(4).fill({ wch: 25 });
                  XLSX.utils.book_append_sheet(wb, ws, t('warehouses.excelSheetName'));
                  XLSX.writeFile(wb, `warehouses-${new Date().toISOString().slice(0, 10)}.xlsx`);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
              >
                <Download className="h-4 w-4" /> {t('warehouses.downloadExcel')}
              </button>
              <DxButton
                text={t('warehouses.addWarehouse')}
                icon="plus"
                type="success"
                onClick={handleCreate}
              />
            </div>
          }
        />

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label={t('stats.total')}
            value={warehouses.length}
            icon={Boxes}
            tone="emerald"
          />
          <StatCard
            label={t('stats.active')}
            value={activeCount}
            icon={CheckCircle}
            tone="blue"
          />
          <StatCard
            label={t('stats.coldStorage')}
            value={coldStorageCount}
            icon={Snowflake}
            tone="cyan"
          />
          <StatCard
            label={t('stats.inactive')}
            value={inactiveCount}
            icon={XCircle}
            tone="gray"
          />
        </div>

        {/* DataGrid Card */}
        <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] overflow-hidden">
          {/* Filter Header: Type Tabs */}
          <div className="px-3 py-3 sm:px-4 border-b border-emerald-50 bg-gradient-to-r from-[#F6FCF9] to-white">
            <div className="flex items-center gap-1 p-1 bg-[#F1FAF5] border border-emerald-100 rounded-xl overflow-x-auto scrollbar-thin snap-x">
              {(Object.keys(TYPE_CONFIG) as WarehouseTypeFilter[]).map((type) => {
                const config = TYPE_CONFIG[type];
                const count = typeCounts[type];
                const isActive = typeFilter === type;

                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                      isActive
                        ? `${config.bgColor} ${config.textColor} shadow-sm`
                        : `text-[#4B7163] hover:text-[#064E3B] hover:bg-[#E6F6EE]`
                    )}
                  >
                    {config.icon}
                    <span>{t(`warehouses.types.${config.translationKey}`)}</span>
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                      isActive
                        ? 'bg-white/25 text-inherit'
                        : 'bg-emerald-100 text-emerald-800'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Result Count Row */}
          <div className="px-3 py-3 sm:px-4 border-b border-emerald-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="w-full sm:max-w-md">
              <DxTextBox
                placeholder={t('warehouses.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
              />
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              <Boxes className="h-4 w-4 text-gray-400" />
              <span>{t('common.warehousesShown', { count: filteredWarehouses.length })}</span>
            </div>
          </div>

          {/* Content: Loading / Empty / Mobile Cards / Desktop Grid */}
          {isLoading ? (
            isMobile ? (
              <WarehouseCardSkeletonList count={4} />
            ) : (
              <DataGridLoadingSkeleton />
            )
          ) : warehouses.length === 0 ? (
            <EmptyState onCreate={handleCreate} t={t} />
          ) : filteredWarehouses.length === 0 ? (
            <NoResultsState
              onClear={() => {
                setSearch('');
                setTypeFilter('');
              }}
              t={t}
            />
          ) : isMobile ? (
            <WarehouseCardList
              warehouses={filteredWarehouses}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              t={t}
            />
          ) : (
            <DxDataGrid
              key={locale}
              dataSource={filteredWarehouses}
              keyExpr="id"
              columns={columns}
              sorting
              responsiveColumns
              virtualScrolling={filteredWarehouses.length > 100}
              height={600}
              mobileHeight={520}
              tabletHeight={560}
              noDataText={t('warehouses.noWarehouses')}
              onRowClick={(e) => {
                if (e.data) {
                  router.push(`/inventory/warehouses/${e.data.id}`);
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <WarehouseEditDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            setEditingWarehouse(null);
            setWarehouseSummary(null);
          }
        }}
        warehouse={editingWarehouse}
        summary={warehouseSummary}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DxConfirmDialog
        visible={deleteConfirm.open}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, warehouse: null })}
        title={t('warehouses.confirmDelete.title')}
        message={t('warehouses.confirmDelete.message', { name: deleteConfirm.warehouse?.name || '' })}
        confirmText={t('warehouses.confirmDelete.confirm')}
        confirmType="danger"
      />
    </MainLayout>
  );
}

// ============================================
// Helper Components
// ============================================

// next-intl's Translator expects specific value types; accept a superset-compatible shape.
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: Name → Code → Location → Status.
 * Action buttons (View/Edit/Delete) are 40px+ touch targets.
 */
function WarehouseCardList({
  warehouses,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  warehouses: WarehouseType[];
  onView: (w: WarehouseType) => void;
  onEdit: (w: WarehouseType) => void;
  onDelete: (w: WarehouseType) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {warehouses.map((w) => {
        const normalized = normalizeWarehouseType(w.type);
        const config = normalized ? TYPE_CONFIG[normalized] : null;
        const typeLabel = config
          ? t(`warehouses.types.${config.translationKey}`)
          : (w.type || '—');
        const hasTemp = w.temperatureMin !== null && w.temperatureMax !== null;
        const hasHumidity = w.humidityMin !== null && w.humidityMax !== null;
        return (
          <div
            key={w.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card header: icon + name + code + type badge */}
            <button
              type="button"
              onClick={() => onView(w)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  w.type === 'raw_material' ? 'bg-emerald-100' :
                  w.type === 'finished_goods' ? 'bg-emerald-100' :
                  w.type === 'wip' ? 'bg-amber-100' :
                  w.type === 'quarantine' ? 'bg-yellow-100' :
                  w.type === 'rejected' ? 'bg-red-100' :
                  w.type === 'cold_storage' ? 'bg-cyan-100' :
                  'bg-gray-100'
                )}
              >
                <Warehouse
                  className={cn(
                    'h-5 w-5',
                    w.type === 'raw_material' ? 'text-emerald-600' :
                    w.type === 'finished_goods' ? 'text-emerald-600' :
                    w.type === 'wip' ? 'text-amber-600' :
                    w.type === 'quarantine' ? 'text-yellow-600' :
                    w.type === 'rejected' ? 'text-red-600' :
                    w.type === 'cold_storage' ? 'text-cyan-600' :
                    'text-gray-600'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">{w.name}</p>
                    <p className="font-mono text-xs text-gray-500">{w.code}</p>
                  </div>
                  <Badge variant={w.isActive ? 'success' : 'danger'} dot>
                    {w.isActive ? t('warehouses.status.active') : t('warehouses.status.inactive')}
                  </Badge>
                </div>
                {w.location && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{w.location}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant={getTypeVariant(w.type)}>
                    {typeLabel}
                  </Badge>
                  {hasTemp && (
                    <span className="inline-flex items-center gap-1 text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded">
                      <Thermometer className="h-3 w-3" />
                      {w.temperatureMin}–{w.temperatureMax}°C
                    </span>
                  )}
                  {hasHumidity && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                      <Droplets className="h-3 w-3" />
                      {w.humidityMin}–{w.humidityMax}%
                    </span>
                  )}
                  {w.capacity ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      <Database className="h-3 w-3" />
                      {formatNumber(w.capacity)}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            {/* Card footer: action buttons (touch-friendly 44px min-height) */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(w)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('warehouses.viewDetails')}</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(w)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Pencil className="h-4 w-4" />
                <span>{t('common.edit') || 'Edit'}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(w)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px]"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('common.delete') || 'Delete'}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function WarehouseCardSkeletonList({ count = 3 }: { count?: number }) {
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

/** Empty State — shown when user has zero warehouses at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
        <Warehouse className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('warehouses.emptyTitle') || 'ยังไม่มีคลังสินค้า'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('warehouses.emptyDescription') || 'เริ่มต้นจัดการสินค้าคงคลังของคุณโดยเพิ่มคลังสินค้าแรก'}
      </p>
      <DxButton
        text={t('warehouses.addWarehouse')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results but warehouses exist */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('warehouses.noResultsTitle') || 'ไม่พบคลังสินค้าที่ตรงกับเงื่อนไข'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('warehouses.noResultsDescription') || 'ลองเปลี่ยนคำค้นหาหรือเลือกตัวกรองอื่น'}
      </p>
      <DxButton
        text={t('common.clearFilters') || 'ล้างตัวกรอง'}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}
