'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ItemEditDialog, Item, ItemFormData } from '@/components/ui/item-edit-dialog';
import { Plus, Edit2, Trash2, Package, Leaf, FlaskConical, Box, Pill, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const itemTypes = [
  { value: '', label: 'All Types' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'wip', label: 'Work in Progress' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'consumable', label: 'Consumable' },
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

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [pagination.page, typeFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchItems();
  };

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

  const handleDelete = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete "${item.nameTh}"?`)) return;

    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchItems();
      }
    } catch {
      // Network errors handled by global error handler
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

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: Item) => (
        <div className="flex items-center gap-2">
          {getTypeIcon(item.type)}
          <span className="font-mono">{item.code}</span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: Item) => (
        <div>
          <p className="font-medium">{item.nameTh}</p>
          {item.nameEn && <p className="text-xs text-gray-500">{item.nameEn}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: Item) => (
        <Badge variant={getTypeVariant(item.type)} dot>
          {item.type.replace('_', ' ')}
        </Badge>
      ),
    },
    { key: 'category', header: 'Category', render: (item: Item) => item.category || '-' },
    { key: 'primaryUnit', header: 'Unit' },
    {
      key: 'onHand',
      header: 'On Hand',
      render: (item: Item) => {
        const onHand = item.onHand ?? 0;
        const isLow = item.minStock && onHand < item.minStock;
        return (
          <div className={cn('font-medium', isLow ? 'text-red-600' : '')}>
            {onHand.toLocaleString()} {item.primaryUnit}
            {isLow && <span className="text-xs ml-1">(Low)</span>}
          </div>
        );
      },
    },
    {
      key: 'shelfLife',
      header: 'Shelf Life',
      render: (item: Item) => item.shelfLifeDays ? `${item.shelfLifeDays} days` : '-',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item: Item) => (
        <Badge variant={item.isActive ? 'success' : 'danger'} dot>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Item) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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
    { label: 'Raw Materials', count: rawMaterialCount, icon: Leaf, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'Finished Goods', count: finishedGoodsCount, icon: Pill, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Packaging', count: packagingCount, icon: Box, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Active Items', count: activeCount, icon: Package, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Items"
          description="จัดการรายการสินค้าและวัตถุดิบ"
          actions={
            <Button onClick={handleOpenCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Add Item
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryCards.map((card, index) => (
            <Card
              key={card.label}
              elevation="raised"
              padding="md"
              className={cn(
                'motion-safe:animate-fade-in motion-reduce:animate-none'
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
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  variant="search"
                  placeholder="Search by code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSearch={handleSearch}
                />
              </div>
              <div className="w-full md:w-48">
                <Select
                  options={itemTypes}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised">
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : items.length > 0 ? (
              <>
                <Table
                  columns={columns}
                  data={items}
                  keyField="id"
                  isLoading={isLoading}
                  emptyMessage="No items found"
                  striped
                  hoverable
                  onRowClick={(item) => router.push(`/inventory/items/${item.id}`)}
                />

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} items
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagination.page * pagination.limit >= pagination.total}
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No items found"
                description="Get started by adding your first item"
                action={{
                  label: 'Add Item',
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
    </MainLayout>
  );
}
