'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
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
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    hoverBg: 'hover:bg-gray-800',
    icon: <Boxes className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  raw_material: {
    translationKey: 'rawMaterial',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-blue-700',
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

const getTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  return TYPE_CONFIG[type as WarehouseTypeFilter]?.badgeVariant || 'default';
};

export default function WarehousesPage() {
  const router = useRouter();
  const t = useTranslations('inventory');
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

  // Filter warehouses based on type and search
  const filteredWarehouses = warehouses.filter(warehouse => {
    // Type filter
    if (typeFilter && warehouse.type !== typeFilter) {
      return false;
    }
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        warehouse.code?.toLowerCase().includes(searchLower) ||
        warehouse.name?.toLowerCase().includes(searchLower) ||
        warehouse.location?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

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
      dataField: 'code',
      caption: t('warehouses.table.columns.code'),
      width: 120,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center',
            cellInfo.data.type === 'raw_material' ? 'bg-blue-100' :
            cellInfo.data.type === 'finished_goods' ? 'bg-emerald-100' :
            cellInfo.data.type === 'quarantine' ? 'bg-yellow-100' :
            cellInfo.data.type === 'rejected' ? 'bg-red-100' :
            cellInfo.data.type === 'cold_storage' ? 'bg-cyan-100' :
            'bg-gray-100'
          )}>
            <Warehouse className={cn(
              'h-4 w-4',
              cellInfo.data.type === 'raw_material' ? 'text-blue-600' :
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
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const config = TYPE_CONFIG[cellInfo.data.type as WarehouseTypeFilter];
        return (
          <Badge variant={getTypeVariant(cellInfo.data.type)} dot>
            {t(`warehouses.types.${config?.translationKey || cellInfo.data.type}`)}
          </Badge>
        );
      },
    },
    {
      dataField: 'temperatureMin',
      caption: t('warehouses.table.columns.temperature'),
      width: 150,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const hasTemp = cellInfo.data.temperatureMin !== null && cellInfo.data.temperatureMax !== null;
        return (
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            hasTemp ? 'bg-cyan-50' : ''
          )}>
            <Thermometer className={cn('h-3.5 w-3.5', hasTemp ? 'text-cyan-600' : 'text-gray-400')} />
            <span className={hasTemp ? 'text-cyan-700 font-medium' : 'text-gray-400'}>
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
      width: 140,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const hasHumidity = cellInfo.data.humidityMin !== null && cellInfo.data.humidityMax !== null;
        return (
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            hasHumidity ? 'bg-blue-50' : ''
          )}>
            <Droplets className={cn('h-3.5 w-3.5', hasHumidity ? 'text-blue-600' : 'text-gray-400')} />
            <span className={hasHumidity ? 'text-blue-700 font-medium' : 'text-gray-400'}>
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
      width: 100,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-600">
          {cellInfo.data.capacity ? cellInfo.data.capacity.toLocaleString() : '-'}
        </span>
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
      width: 60,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <DxButton
          icon="search"
          stylingMode="text"
          hint={t('warehouses.viewDetails')}
          onClick={(e) => {
            e.event?.stopPropagation();
            router.push(`/inventory/warehouses/${cellInfo.data.id}`);
          }}
        />
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title={t('warehouses.pageTitle')}
          description={t('warehouses.description')}
          actions={
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                text={t('common.refresh')}
                stylingMode="outlined"
                onClick={fetchWarehouses}
              />
              <DxButton
                icon="box"
                text={t('warehouses.viewLots')}
                stylingMode="outlined"
                onClick={() => router.push('/inventory/lots')}
              />
              <DxButton
                text={t('warehouses.addWarehouse')}
                icon="plus"
                type="success"
                onClick={handleCreate}
              />
            </div>
          }
        />

        {/* DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Type Tabs */}
              <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto">
                {(Object.keys(TYPE_CONFIG) as WarehouseTypeFilter[]).map((type) => {
                  const config = TYPE_CONFIG[type];
                  const count = typeCounts[type];
                  const isActive = typeFilter === type;

                  return (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                        isActive
                          ? `${config.bgColor} ${config.textColor}`
                          : `text-gray-600 hover:bg-gray-100`
                      )}
                    >
                      {config.icon}
                      <span>{t(`warehouses.types.${config.translationKey}`)}</span>
                      <span className={cn(
                        'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                        isActive
                          ? 'bg-white/20 text-inherit'
                          : 'bg-gray-200 text-gray-600'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">{activeCount} {t('stats.active')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">{inactiveCount} {t('stats.inactive')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Snowflake className="h-4 w-4 text-cyan-500" />
                  <span className="text-cyan-600">{coldStorageCount} {t('stats.coldStorage')}</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{t('common.warehousesShown', { count: filteredWarehouses.length })}</span>
              </div>
            </div>
          </div>

          {/* Search Row */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="max-w-md">
              <DxTextBox
                placeholder={t('warehouses.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
              />
            </div>
          </div>

          {/* DataGrid */}
          <DxDataGrid
            dataSource={filteredWarehouses}
            keyExpr="id"
            columns={columns}
            loading={isLoading}
            sorting
            filterRow
            headerFilter
            export
            exportFileName="warehouses"
            columnChooser
            virtualScrolling={filteredWarehouses.length > 100}
            height={600}
            noDataText={t('warehouses.noWarehouses')}
            onRowClick={(e) => {
              if (e.data) {
                router.push(`/inventory/warehouses/${e.data.id}`);
              }
            }}
          />
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
