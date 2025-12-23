'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
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
  RefreshCw,
  Package,
  Boxes,
  CheckCircle,
  Clock,
  XCircle,
  Snowflake,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Type configuration for tabs
type WarehouseTypeFilter = '' | 'raw_material' | 'wip' | 'finished_goods' | 'quarantine' | 'rejected' | 'cold_storage';

const TYPE_CONFIG: Record<WarehouseTypeFilter, {
  label: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default';
}> = {
  '': {
    label: 'All',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    hoverBg: 'hover:bg-gray-800',
    icon: <Boxes className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  raw_material: {
    label: 'วัตถุดิบ',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-blue-700',
    icon: <Package className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  wip: {
    label: 'งานระหว่างทำ',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    hoverBg: 'hover:bg-amber-600',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  finished_goods: {
    label: 'สินค้าสำเร็จรูป',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-emerald-700',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  quarantine: {
    label: 'กักกัน',
    bgColor: 'bg-yellow-500',
    textColor: 'text-white',
    hoverBg: 'hover:bg-yellow-600',
    icon: <ShieldAlert className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  rejected: {
    label: 'ตีกลับ',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-red-700',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
  cold_storage: {
    label: 'ห้องเย็น',
    bgColor: 'bg-cyan-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-cyan-700',
    icon: <Snowflake className="h-4 w-4" />,
    badgeVariant: 'info',
  },
};

const getTypeLabel = (type: string): string => {
  return TYPE_CONFIG[type as WarehouseTypeFilter]?.label || type.replace('_', ' ');
};

const getTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  return TYPE_CONFIG[type as WarehouseTypeFilter]?.badgeVariant || 'default';
};

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<WarehouseTypeFilter>('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [warehouseSummary, setWarehouseSummary] = useState<WarehouseSummary | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<WarehouseType | null>(null);
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

  const fetchWarehouseDetail = async (warehouseId: number) => {
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/detail`);
      const data = await res.json();
      if (data.success) {
        return data.data.summary as WarehouseSummary;
      }
    } catch (error) {
      console.error('Failed to fetch warehouse detail:', error);
    }
    return null;
  };

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

  const handleEdit = async (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    const summary = await fetchWarehouseDetail(warehouse.id);
    setWarehouseSummary(summary);
    setShowDialog(true);
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
      caption: 'รหัส',
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
      caption: 'ชื่อคลัง',
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
      caption: 'ประเภท',
      width: 160,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const config = TYPE_CONFIG[cellInfo.data.type as WarehouseTypeFilter];
        return (
          <Badge variant={getTypeVariant(cellInfo.data.type)} dot>
            {getTypeLabel(cellInfo.data.type)}
          </Badge>
        );
      },
    },
    {
      dataField: 'temperatureMin',
      caption: 'อุณหภูมิ',
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
      caption: 'ความชื้น',
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
      caption: 'ความจุ',
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
      caption: 'สถานะ',
      width: 110,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
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
          hint="ดูรายละเอียด"
          onClick={(e) => {
            e.event?.stopPropagation();
            setViewingWarehouse(cellInfo.data);
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
          title="Warehouses"
          description="จัดการคลังสินค้าและสถานที่จัดเก็บ"
          actions={
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                text="Refresh"
                stylingMode="outlined"
                onClick={fetchWarehouses}
              />
              <DxButton
                icon="box"
                text="View Lots"
                stylingMode="outlined"
                onClick={() => router.push('/inventory/lots')}
              />
              <DxButton
                text="เพิ่มคลัง"
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
                      <span>{config.label}</span>
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
                  <span className="text-emerald-600 font-medium">{activeCount} Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">{inactiveCount} Inactive</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Snowflake className="h-4 w-4 text-cyan-500" />
                  <span className="text-cyan-600">{coldStorageCount} Cold Storage</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{filteredWarehouses.length} warehouses shown</span>
              </div>
            </div>
          </div>

          {/* Search Row */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="max-w-md">
              <DxTextBox
                placeholder="ค้นหาด้วยรหัส ชื่อ หรือที่ตั้ง..."
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
            noDataText="ไม่พบคลังสินค้า"
            onRowClick={(e) => {
              if (e.data) {
                setViewingWarehouse(e.data);
              }
            }}
          />
        </div>
      </div>

      {/* View Detail Popup */}
      <DxPopup
        visible={!!viewingWarehouse}
        onVisibleChange={(visible) => !visible && setViewingWarehouse(null)}
        title="รายละเอียดคลังสินค้า"
        width={520}
        height="auto"
        showCloseButton
        toolbarItems={[
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: 'แก้ไข',
              icon: 'edit',
              type: 'default',
              onClick: () => {
                if (viewingWarehouse) {
                  handleEdit(viewingWarehouse);
                  setViewingWarehouse(null);
                }
              },
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: 'ลบ',
              icon: 'trash',
              type: 'danger',
              stylingMode: 'outlined',
              onClick: () => {
                if (viewingWarehouse) {
                  setDeleteConfirm({ open: true, warehouse: viewingWarehouse });
                  setViewingWarehouse(null);
                }
              },
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: 'ปิด',
              stylingMode: 'outlined',
              onClick: () => setViewingWarehouse(null),
            },
          },
        ]}
      >
        {viewingWarehouse && (
          <div className="p-4 space-y-4">
            {/* Header with warehouse info */}
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className={cn(
                'p-3 rounded-xl',
                viewingWarehouse.type === 'raw_material' ? 'bg-blue-100' :
                viewingWarehouse.type === 'finished_goods' ? 'bg-emerald-100' :
                viewingWarehouse.type === 'quarantine' ? 'bg-yellow-100' :
                viewingWarehouse.type === 'rejected' ? 'bg-red-100' :
                viewingWarehouse.type === 'cold_storage' ? 'bg-cyan-100' :
                'bg-gray-100'
              )}>
                <Warehouse className={cn(
                  'h-8 w-8',
                  viewingWarehouse.type === 'raw_material' ? 'text-blue-600' :
                  viewingWarehouse.type === 'finished_goods' ? 'text-emerald-600' :
                  viewingWarehouse.type === 'quarantine' ? 'text-yellow-600' :
                  viewingWarehouse.type === 'rejected' ? 'text-red-600' :
                  viewingWarehouse.type === 'cold_storage' ? 'text-cyan-600' :
                  'text-gray-600'
                )} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{viewingWarehouse.name}</h3>
                <p className="text-sm text-gray-500 font-mono">{viewingWarehouse.code}</p>
              </div>
              <Badge variant={viewingWarehouse.isActive ? 'success' : 'danger'} dot className="self-start">
                {viewingWarehouse.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
              </Badge>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">ประเภท</p>
                <Badge variant={getTypeVariant(viewingWarehouse.type)}>
                  {getTypeLabel(viewingWarehouse.type)}
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">ที่ตั้ง</p>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <p className="font-medium text-gray-900">{viewingWarehouse.location || '-'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">ความจุ</p>
                <p className="font-medium text-gray-900">
                  {viewingWarehouse.capacity ? viewingWarehouse.capacity.toLocaleString() : '-'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">รหัสคลัง</p>
                <p className="font-mono font-medium text-gray-900">{viewingWarehouse.code}</p>
              </div>
            </div>

            {/* Environmental Conditions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-xl p-4 border border-cyan-200/50">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="h-5 w-5 text-cyan-600" />
                  <p className="text-sm font-medium text-cyan-800">อุณหภูมิ</p>
                </div>
                <p className="text-xl font-bold text-cyan-900">
                  {viewingWarehouse.temperatureMin !== null && viewingWarehouse.temperatureMax !== null
                    ? `${viewingWarehouse.temperatureMin}°C - ${viewingWarehouse.temperatureMax}°C`
                    : '-'}
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">ความชื้น</p>
                </div>
                <p className="text-xl font-bold text-blue-900">
                  {viewingWarehouse.humidityMin !== null && viewingWarehouse.humidityMax !== null
                    ? `${viewingWarehouse.humidityMin}% - ${viewingWarehouse.humidityMax}%`
                    : '-'}
                </p>
              </div>
            </div>

          </div>
        )}
      </DxPopup>

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
        title="ยืนยันการลบ"
        message={`คุณต้องการลบคลังสินค้า "${deleteConfirm.warehouse?.name}" หรือไม่?`}
        confirmText="ลบ"
        confirmType="danger"
      />
    </MainLayout>
  );
}
