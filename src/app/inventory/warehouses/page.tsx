'use client';

import { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  WarehouseEditDialog,
  type Warehouse as WarehouseType,
  type WarehouseFormData,
  type WarehouseSummary,
} from '@/components/ui/warehouse-edit-dialog';
import { Warehouse, MapPin, Thermometer, Droplets, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const warehouseTypes = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'raw_material', label: 'วัตถุดิบ' },
  { value: 'wip', label: 'งานระหว่างทำ' },
  { value: 'finished_goods', label: 'สินค้าสำเร็จรูป' },
  { value: 'quarantine', label: 'กักกัน' },
  { value: 'rejected', label: 'ตีกลับ' },
  { value: 'cold_storage', label: 'ห้องเย็น' },
];

const getTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (type) {
    case 'raw_material': return 'info';
    case 'finished_goods': return 'success';
    case 'quarantine': return 'warning';
    case 'rejected': return 'danger';
    case 'cold_storage': return 'info';
    default: return 'default';
  }
};

const getTypeLabel = (type: string): string => {
  const found = warehouseTypes.find(t => t.value === type);
  return found ? found.label : type.replace('_', ' ');
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/warehouses?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedWarehouses = data.data?.items || data.data || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedWarehouses = fetchedWarehouses.filter((warehouse: WarehouseType) =>
            warehouse.code?.toLowerCase().includes(searchLower) ||
            warehouse.name?.toLowerCase().includes(searchLower) ||
            warehouse.location?.toLowerCase().includes(searchLower)
          );
        }

        setWarehouses(fetchedWarehouses);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, search]);

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

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'code',
      caption: 'รหัส',
      width: 100,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.code}</span>
      ),
    },
    {
      dataField: 'name',
      caption: 'ชื่อคลัง',
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-gray-500" />
          <span className="font-medium">{cellInfo.data.name}</span>
        </div>
      ),
    },
    {
      dataField: 'type',
      caption: 'ประเภท',
      width: 140,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <Badge variant={getTypeVariant(cellInfo.data.type)} dot>
          {getTypeLabel(cellInfo.data.type)}
        </Badge>
      ),
    },
    {
      dataField: 'location',
      caption: 'ที่ตั้ง',
      width: 150,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-gray-400" />
          <span>{cellInfo.data.location || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'temperatureMin',
      caption: 'อุณหภูมิ',
      width: 140,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-1">
          <Thermometer className="h-3 w-3 text-cyan-500" />
          <span>
            {cellInfo.data.temperatureMin !== null && cellInfo.data.temperatureMax !== null
              ? `${cellInfo.data.temperatureMin}°C - ${cellInfo.data.temperatureMax}°C`
              : '-'}
          </span>
        </div>
      ),
    },
    {
      dataField: 'humidityMin',
      caption: 'ความชื้น',
      width: 130,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-1">
          <Droplets className="h-3 w-3 text-blue-500" />
          <span>
            {cellInfo.data.humidityMin !== null && cellInfo.data.humidityMax !== null
              ? `${cellInfo.data.humidityMin}% - ${cellInfo.data.humidityMax}%`
              : '-'}
          </span>
        </div>
      ),
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 100,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
    {
      dataField: 'actions',
      caption: 'จัดการ',
      width: 150,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex gap-1">
          <DxButton
            icon="info"
            stylingMode="text"
            hint="ดูรายละเอียด"
            onClick={(e) => {
              e.event?.stopPropagation();
              setViewingWarehouse(cellInfo.data);
            }}
          />
          <DxButton
            icon="edit"
            stylingMode="text"
            hint="แก้ไข"
            onClick={(e) => {
              e.event?.stopPropagation();
              handleEdit(cellInfo.data);
            }}
          />
          <DxButton
            icon="trash"
            stylingMode="text"
            type="danger"
            hint="ลบ"
            onClick={(e) => {
              e.event?.stopPropagation();
              setDeleteConfirm({ open: true, warehouse: cellInfo.data });
            }}
          />
        </div>
      ),
    },
  ];

  // Calculate summary stats
  const totalCount = warehouses.length;
  const activeCount = warehouses.filter(w => w.isActive).length;
  const coldStorageCount = warehouses.filter(w => w.type === 'cold_storage').length;
  const quarantineCount = warehouses.filter(w => w.type === 'quarantine').length;

  const summaryCards = [
    { label: 'ทั้งหมด', count: totalCount, icon: Warehouse, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'ใช้งานอยู่', count: activeCount, icon: MapPin, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'ห้องเย็น', count: coldStorageCount, icon: Thermometer, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' },
    { label: 'กักกัน', count: quarantineCount, icon: Warehouse, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600' },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title="คลังสินค้า"
          description="จัดการคลังสินค้าและสถานที่จัดเก็บ"
          actions={
            <DxButton
              text="เพิ่มคลัง"
              icon="plus"
              type="success"
              onClick={handleCreate}
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2 lg:gap-4">
          {summaryCards.map((card, index) => (
            <Card
              key={card.label}
              elevation="raised"
              padding="sm"
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none md:py-2'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', card.bgColor)}>
                  <card.icon className={cn('h-5 w-5', card.iconColor)} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-xl font-bold">{card.count}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters Card */}
        <Card elevation="raised" className="md:py-1">
          <CardContent className="py-2 md:py-2 lg:py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยรหัส ชื่อ หรือที่ตั้ง..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchWarehouses()}
                />
              </div>
              <div className="w-full md:w-48">
                <DxSelectBox
                  items={warehouseTypes}
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  placeholder="เลือกประเภท"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex flex-col py-2 md:py-2 lg:py-4">
            {warehouses.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={warehouses}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="warehouses"
                columnChooser
                virtualScrolling={warehouses.length > 100}
                fillHeight
                noDataText="ไม่พบคลังสินค้า"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบคลังสินค้า"
                description="เริ่มต้นด้วยการเพิ่มคลังสินค้าใหม่"
                action={{
                  label: 'เพิ่มคลัง',
                  onClick: handleCreate,
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Detail Popup */}
      <DxPopup
        visible={!!viewingWarehouse}
        onVisibleChange={(visible) => !visible && setViewingWarehouse(null)}
        title="รายละเอียดคลังสินค้า"
        width={500}
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
              text: 'ปิด',
              stylingMode: 'outlined',
              onClick: () => setViewingWarehouse(null),
            },
          },
        ]}
      >
        {viewingWarehouse && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'p-3 rounded-xl',
                viewingWarehouse.type === 'raw_material' ? 'bg-blue-100' :
                viewingWarehouse.type === 'finished_goods' ? 'bg-green-100' :
                viewingWarehouse.type === 'quarantine' ? 'bg-yellow-100' :
                viewingWarehouse.type === 'rejected' ? 'bg-red-100' :
                'bg-gray-100'
              )}>
                <Warehouse className={cn(
                  'h-8 w-8',
                  viewingWarehouse.type === 'raw_material' ? 'text-blue-600' :
                  viewingWarehouse.type === 'finished_goods' ? 'text-green-600' :
                  viewingWarehouse.type === 'quarantine' ? 'text-yellow-600' :
                  viewingWarehouse.type === 'rejected' ? 'text-red-600' :
                  'text-gray-600'
                )} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{viewingWarehouse.name}</h3>
                <p className="text-gray-500">{viewingWarehouse.code}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">ประเภท</p>
                <Badge variant={getTypeVariant(viewingWarehouse.type)}>
                  {getTypeLabel(viewingWarehouse.type)}
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">สถานะ</p>
                <Badge variant={viewingWarehouse.isActive ? 'success' : 'danger'}>
                  {viewingWarehouse.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                </Badge>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">ที่ตั้ง</p>
                <p className="font-medium">{viewingWarehouse.location || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">ความจุ</p>
                <p className="font-medium">{viewingWarehouse.capacity || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-cyan-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer className="h-4 w-4 text-cyan-600" />
                  <p className="text-xs text-cyan-700">อุณหภูมิ</p>
                </div>
                <p className="font-medium text-cyan-900">
                  {viewingWarehouse.temperatureMin !== null && viewingWarehouse.temperatureMax !== null
                    ? `${viewingWarehouse.temperatureMin}°C - ${viewingWarehouse.temperatureMax}°C`
                    : '-'}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-blue-700">ความชื้น</p>
                </div>
                <p className="font-medium text-blue-900">
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
