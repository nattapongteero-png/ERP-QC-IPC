'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, Package, Leaf, FlaskConical, Box, Pill } from 'lucide-react';

interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  type: string;
  category: string | null;
  primaryUnit: string;
  secondaryUnit: string | null;
  conversionFactor: number | null;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  shelfLifeDays: number | null;
  storageConditions: string | null;
  isActive: boolean;
  createdAt: string;
}

interface FormData {
  code: string;
  nameTh: string;
  nameEn: string;
  type: string;
  category: string;
  primaryUnit: string;
  secondaryUnit: string;
  conversionFactor: number | null;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  shelfLifeDays: number | null;
  storageConditions: string;
  isActive: boolean;
}

const itemTypes = [
  { value: '', label: 'All Types' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'wip', label: 'Work in Progress' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'consumable', label: 'Consumable' },
];

const categories = [
  { value: '', label: 'Select Category' },
  { value: 'herb', label: 'Herb' },
  { value: 'extract', label: 'Extract' },
  { value: 'excipient', label: 'Excipient' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'label', label: 'Label' },
  { value: 'box', label: 'Box' },
];

const units = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'mg', label: 'Milligram (mg)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'mL', label: 'Milliliter (mL)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
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
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<FormData>({
    code: '',
    nameTh: '',
    nameEn: '',
    type: 'raw_material',
    category: '',
    primaryUnit: 'kg',
    secondaryUnit: '',
    conversionFactor: null,
    minStock: null,
    maxStock: null,
    reorderPoint: null,
    shelfLifeDays: null,
    storageConditions: '',
    isActive: true,
  });
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

  const handleSave = async () => {
    try {
      const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        fetchItems();
      } else {
        alert(data.error || 'Failed to save item');
      }
    } catch (error) {
      alert('Failed to save item');
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete "${item.nameTh}"?`)) return;

    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchItems();
      } else {
        alert(data.error || 'Failed to delete item');
      }
    } catch (error) {
      alert('Failed to delete item');
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      nameTh: item.nameTh,
      nameEn: item.nameEn || '',
      type: item.type,
      category: item.category || '',
      primaryUnit: item.primaryUnit,
      secondaryUnit: item.secondaryUnit || '',
      conversionFactor: item.conversionFactor,
      minStock: item.minStock,
      maxStock: item.maxStock,
      reorderPoint: item.reorderPoint,
      shelfLifeDays: item.shelfLifeDays,
      storageConditions: item.storageConditions || '',
      isActive: item.isActive,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameTh: '',
      nameEn: '',
      type: 'raw_material',
      category: '',
      primaryUnit: 'kg',
      secondaryUnit: '',
      conversionFactor: null,
      minStock: null,
      maxStock: null,
      reorderPoint: null,
      shelfLifeDays: null,
      storageConditions: '',
      isActive: true,
    });
  };

  const generateCode = () => {
    const prefix = formData.type === 'raw_material' ? 'RM' 
      : formData.type === 'packaging' ? 'PK'
      : formData.type === 'wip' ? 'WIP'
      : formData.type === 'finished_goods' ? 'FG'
      : 'ITM';
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, code: `${prefix}-${random}` }));
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
        <Badge variant={getTypeVariant(item.type)}>
          {item.type.replace('_', ' ')}
        </Badge>
      ),
    },
    { key: 'category', header: 'Category', render: (item: Item) => item.category || '-' },
    { key: 'primaryUnit', header: 'Unit' },
    {
      key: 'shelfLife',
      header: 'Shelf Life',
      render: (item: Item) => item.shelfLifeDays ? `${item.shelfLifeDays} days` : '-',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item: Item) => (
        <Badge variant={item.isActive ? 'success' : 'danger'}>
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
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Items</h1>
            <p className="text-gray-600">จัดการรายการสินค้าและวัตถุดิบ</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingItem(null); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Leaf className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Raw Materials</p>
                <p className="text-xl font-bold">{rawMaterialCount}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Pill className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Finished Goods</p>
                <p className="text-xl font-bold">{finishedGoodsCount}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Box className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Packaging</p>
                <p className="text-xl font-bold">{packagingCount}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Package className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Items</p>
                <p className="text-xl font-bold">{activeCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
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

          {/* Table */}
          <Table
            columns={columns}
            data={items}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No items found"
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
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="RM-001"
                    />
                    <Button variant="secondary" onClick={generateCode}>
                      Gen
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={itemTypes.filter(t => t.value !== '')}
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (Thai) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.nameTh}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameTh: e.target.value }))}
                    placeholder="ชื่อสินค้าภาษาไทย"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (English)
                  </label>
                  <Input
                    value={formData.nameEn}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="English name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <Select
                    options={categories}
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Unit <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={units}
                    value={formData.primaryUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, primaryUnit: e.target.value }))}
                  />
                </div>
              </div>

              {/* Secondary Unit */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Secondary Unit (Optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Secondary Unit</label>
                    <Select
                      options={[{ value: '', label: 'None' }, ...units]}
                      value={formData.secondaryUnit}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryUnit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Conversion Factor</label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.conversionFactor ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        conversionFactor: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                      placeholder="e.g., 1000 (1kg = 1000g)"
                    />
                  </div>
                </div>
              </div>

              {/* Stock Levels */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Stock Levels</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min Stock</label>
                    <Input
                      type="number"
                      value={formData.minStock ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        minStock: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max Stock</label>
                    <Input
                      type="number"
                      value={formData.maxStock ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        maxStock: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Reorder Point</label>
                    <Input
                      type="number"
                      value={formData.reorderPoint ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        reorderPoint: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Storage */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Storage Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Shelf Life (Days)</label>
                    <Input
                      type="number"
                      value={formData.shelfLifeDays ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        shelfLifeDays: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Storage Conditions</label>
                    <Input
                      value={formData.storageConditions}
                      onChange={(e) => setFormData(prev => ({ ...prev, storageConditions: e.target.value }))}
                      placeholder="e.g., 15-25°C, Dry place"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowModal(false); setEditingItem(null); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
