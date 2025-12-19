'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ItemEditDialog, Item, ItemFormData } from '@/components/ui/item-edit-dialog';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { Leaf, FlaskConical, Box, Pill, Package, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { DataGridTypes } from 'devextreme-react/data-grid';

const itemTypes = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'raw_material', label: 'วัตถุดิบ' },
  { value: 'packaging', label: 'บรรจุภัณฑ์' },
  { value: 'wip', label: 'งานระหว่างทำ' },
  { value: 'finished_goods', label: 'สินค้าสำเร็จรูป' },
  { value: 'consumable', label: 'วัสดุสิ้นเปลือง' },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'raw_material': return <Leaf className="h-4 w-4 text-green-600" />;
    case 'packaging': return <Box className="h-4 w-4 text-blue-600" />;
    case 'wip': return <FlaskConical className="h-4 w-4 text-orange-600" />;
    case 'finished_goods': return <Pill className="h-4 w-4 text-purple-600" />;
    default: return <Package className="h-4 w-4 text-gray-600" />;
  }
};

const getTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (type) {
    case 'raw_material': return 'success';
    case 'packaging': return 'info';
    case 'wip': return 'warning';
    case 'finished_goods': return 'default';
    default: return 'default';
  }
};

const getTypeLabel = (type: string): string => {
  const found = itemTypes.find(t => t.value === type);
  return found?.label || type.replace('_', ' ');
};

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // Fetch all items for client-side pagination/filtering via DevExtreme
      params.set('limit', '1000');
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedItems = data.data?.items || [];

        // Client-side search filter (DevExtreme will handle this better with remote data source)
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedItems = fetchedItems.filter((item: Item) =>
            item.code?.toLowerCase().includes(searchLower) ||
            item.nameTh?.toLowerCase().includes(searchLower) ||
            item.nameEn?.toLowerCase().includes(searchLower)
          );
        }

        setItems(fetchedItems);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSave = async (formData: ItemFormData) => {
    const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (data.success) {
      setDialogOpen(false);
      setEditingItem(null);
      fetchItems();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.item) return;

    try {
      const res = await fetch(`/api/items/${deleteConfirm.item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchItems();
      }
    } catch {
      // Network errors handled by global error handler
    } finally {
      setDeleteConfirm({ open: false, item: null });
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/inventory/items/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  // hideOnMobile: Hide on phones (<768px)
  // hideOnTablet: Hide on tablets (768-1024px)
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'code',
      caption: 'รหัส',
      width: 120,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          {getTypeIcon(cellInfo.data.type)}
          <span className="font-mono">{cellInfo.data.code}</span>
        </div>
      ),
    },
    {
      dataField: 'nameTh',
      caption: 'ชื่อสินค้า',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.nameTh}</p>
          {cellInfo.data.nameEn && <p className="text-xs text-gray-500">{cellInfo.data.nameEn}</p>}
        </div>
      ),
    },
    {
      dataField: 'type',
      caption: 'ประเภท',
      width: 140,
      hideOnMobile: true, // Hide on mobile - type is shown via icon in code column
      cellRender: (cellInfo) => (
        <Badge variant={getTypeVariant(cellInfo.data.type)} dot>
          {getTypeLabel(cellInfo.data.type)}
        </Badge>
      ),
    },
    {
      dataField: 'category',
      caption: 'หมวดหมู่',
      width: 120,
      hideOnMobile: true, // Less important on mobile
      hideOnTablet: true, // Also hide on tablet
      cellRender: (cellInfo) => cellInfo.data.category || '-',
    },
    {
      dataField: 'primaryUnit',
      caption: 'หน่วย',
      width: 80,
      hideOnMobile: true, // Unit shown in onHand column
    },
    {
      dataField: 'onHand',
      caption: 'คงคลัง',
      width: 140,
      dataType: 'number',
      cellRender: (cellInfo) => {
        const onHand = cellInfo.data.onHand ?? 0;
        const onHandCost = cellInfo.data.onHandCost ?? 0;
        const isLow = cellInfo.data.minStock && onHand < cellInfo.data.minStock;
        return (
          <div>
            <div className={cn('font-medium', isLow ? 'text-red-600' : '')}>
              {onHand.toLocaleString()} {cellInfo.data.primaryUnit}
              {isLow && <span className="text-xs ml-1">(ต่ำ)</span>}
            </div>
            <div className="text-xs text-gray-500">
              ฿{onHandCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'shelfLifeDays',
      caption: 'อายุการเก็บ',
      width: 100,
      dataType: 'number',
      hideOnMobile: true, // Less important on mobile
      hideOnTablet: true, // Also hide on tablet
      cellRender: (cellInfo) => cellInfo.data.shelfLifeDays ? `${cellInfo.data.shelfLifeDays} วัน` : '-',
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 100,
      hideOnMobile: true, // Can see in detail page
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.isActive ? 'success' : 'danger'} dot>
          {cellInfo.data.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
        </Badge>
      ),
    },
    {
      dataField: 'actions',
      caption: 'จัดการ',
      width: 120,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex gap-1">
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
              setDeleteConfirm({ open: true, item: cellInfo.data });
            }}
          />
        </div>
      ),
    },
  ];

  // Calculate summary stats
  const rawMaterialCount = items.filter(i => i.type === 'raw_material').length;
  const finishedGoodsCount = items.filter(i => i.type === 'finished_goods').length;
  const packagingCount = items.filter(i => i.type === 'packaging').length;
  const activeCount = items.filter(i => i.isActive).length;

  const summaryCards = [
    { label: 'วัตถุดิบ', count: rawMaterialCount, icon: Leaf, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'สินค้าสำเร็จรูป', count: finishedGoodsCount, icon: Pill, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'บรรจุภัณฑ์', count: packagingCount, icon: Box, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'รายการที่ใช้งาน', count: activeCount, icon: Package, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' },
  ];

  return (
    <MainLayout>
      {/* Flex container - fills viewport on tablet, normal flow on mobile/desktop */}
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        {/* Header - compact on tablet */}
        <PageHeader
          title="รายการสินค้า"
          description="จัดการรายการสินค้าและวัตถุดิบ"
          actions={
            <DxButton
              text="เพิ่มรายการ"
              icon="plus"
              type="success"
              onClick={handleOpenCreate}
            />
          }
        />

        {/* Summary Cards - compact on tablet */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2 lg:gap-4">
          {summaryCards.map((card, index) => (
            <Card
              key={card.label}
              elevation="raised"
              padding="sm"
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none',
                'md:py-2' // Extra compact on tablet
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-2 md:gap-2 lg:gap-3">
                <div className={cn('p-1.5 md:p-1.5 lg:p-2 rounded-lg', card.bgColor)}>
                  <card.icon className={cn('h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5', card.iconColor)} />
                </div>
                <div>
                  <p className="text-xs md:text-xs lg:text-sm text-gray-500">{card.label}</p>
                  <p className="text-lg md:text-lg lg:text-xl font-bold">{card.count}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters Card - compact on tablet */}
        <Card elevation="raised" className="md:py-1">
          <CardContent className="py-2 md:py-2 lg:py-4">
            <div className="flex flex-col md:flex-row gap-2 md:gap-2 lg:gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยรหัสหรือชื่อ..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchItems()}
                />
              </div>
              <div className="w-full md:w-40 lg:w-48">
                <DxSelectBox
                  items={itemTypes}
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                  placeholder="เลือกประเภท"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card - fills remaining space on tablet */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardContent className="flex-1 min-h-0 flex flex-col py-2 md:py-2 lg:py-4">
            {items.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={items}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="items"
                columnChooser
                virtualScrolling={items.length > 100}
                height={600}
                mobileHeight={400}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบรายการสินค้า"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบรายการสินค้า"
                description="เริ่มต้นด้วยการเพิ่มรายการสินค้าใหม่"
                action={{
                  label: 'เพิ่มรายการ',
                  onClick: handleOpenCreate,
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reusable Item Edit Dialog */}
      <ItemEditDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DxConfirmDialog
        visible={deleteConfirm.open}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, item: null })}
        title="ยืนยันการลบ"
        message={`คุณต้องการลบรายการ "${deleteConfirm.item?.nameTh}" หรือไม่?`}
        confirmText="ลบ"
        confirmType="danger"
      />
    </MainLayout>
  );
}
