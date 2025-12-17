'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, Warehouse, MapPin, Thermometer } from 'lucide-react';

interface WarehouseData {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string | null;
  capacity: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
  isActive: boolean;
  createdAt: string;
}

interface FormData {
  code: string;
  name: string;
  type: string;
  location: string;
  capacity: number;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
  isActive: boolean;
}

const warehouseTypes = [
  { value: '', label: 'All Types' },
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'wip', label: 'Work in Progress' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cold_storage', label: 'Cold Storage' },
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

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    code: '',
    name: '',
    type: 'raw_material',
    location: '',
    capacity: 0,
    temperatureMin: null,
    temperatureMax: null,
    humidityMin: null,
    humidityMax: null,
    isActive: true,
  });

  const fetchWarehouses = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);

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
  };

  useEffect(() => {
    fetchWarehouses();
  }, [typeFilter]);

  const handleSearch = () => {
    fetchWarehouses();
  };

  const handleSave = async () => {
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
        setShowModal(false);
        setEditingWarehouse(null);
        resetForm();
        fetchWarehouses();
      } else {
        alert(data.error || 'Failed to save warehouse');
      }
    } catch (error) {
      alert('Failed to save warehouse');
    }
  };

  const handleDelete = async (warehouse: WarehouseData) => {
    if (!confirm(`Are you sure you want to delete warehouse "${warehouse.name}"?`)) return;

    try {
      const res = await fetch(`/api/warehouses/${warehouse.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchWarehouses();
      } else {
        alert(data.error || 'Failed to delete warehouse');
      }
    } catch (error) {
      alert('Failed to delete warehouse');
    }
  };

  const handleEdit = (warehouse: WarehouseData) => {
    setEditingWarehouse(warehouse);
    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      type: warehouse.type,
      location: warehouse.location || '',
      capacity: warehouse.capacity || 0,
      temperatureMin: warehouse.temperatureMin,
      temperatureMax: warehouse.temperatureMax,
      humidityMin: warehouse.humidityMin,
      humidityMax: warehouse.humidityMax,
      isActive: warehouse.isActive,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'raw_material',
      location: '',
      capacity: 0,
      temperatureMin: null,
      temperatureMax: null,
      humidityMin: null,
      humidityMax: null,
      isActive: true,
    });
  };

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'type',
      header: 'Type',
      render: (w: WarehouseData) => (
        <Badge variant={getTypeVariant(w.type)}>
          {w.type.replace('_', ' ')}
        </Badge>
      ),
    },
    { 
      key: 'location', 
      header: 'Location',
      render: (w: WarehouseData) => w.location || '-'
    },
    {
      key: 'temperature',
      header: 'Temperature',
      render: (w: WarehouseData) => (
        w.temperatureMin !== null && w.temperatureMax !== null
          ? `${w.temperatureMin}°C - ${w.temperatureMax}°C`
          : '-'
      ),
    },
    {
      key: 'humidity',
      header: 'Humidity',
      render: (w: WarehouseData) => (
        w.humidityMin !== null && w.humidityMax !== null
          ? `${w.humidityMin}% - ${w.humidityMax}%`
          : '-'
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (w: WarehouseData) => (
        <Badge variant={w.isActive ? 'success' : 'danger'}>
          {w.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (w: WarehouseData) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(w);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(w);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
            <p className="text-gray-600">จัดการคลังสินค้าและสถานที่จัดเก็บ</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingWarehouse(null); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Warehouse
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Warehouse className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Warehouses</p>
                <p className="text-xl font-bold">{warehouses.length}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-xl font-bold">
                  {warehouses.filter(w => w.isActive).length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Thermometer className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cold Storage</p>
                <p className="text-xl font-bold">
                  {warehouses.filter(w => w.type === 'cold_storage').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Warehouse className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Quarantine</p>
                <p className="text-xl font-bold">
                  {warehouses.filter(w => w.type === 'quarantine').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Search by code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select
                options={warehouseTypes}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            data={warehouses}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No warehouses found"
          />
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="WH-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={warehouseTypes.filter(t => t.value !== '')}
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Warehouse name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Building A, Floor 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity
                </label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseFloat(e.target.value) }))}
                  placeholder="Storage capacity"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Environmental Conditions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Temperature Min (°C)</label>
                    <Input
                      type="number"
                      value={formData.temperatureMin ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        temperatureMin: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Temperature Max (°C)</label>
                    <Input
                      type="number"
                      value={formData.temperatureMax ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        temperatureMax: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Humidity Min (%)</label>
                    <Input
                      type="number"
                      value={formData.humidityMin ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        humidityMin: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Humidity Max (%)</label>
                    <Input
                      type="number"
                      value={formData.humidityMax ?? ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        humidityMax: e.target.value ? parseFloat(e.target.value) : null 
                      }))}
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
              <Button variant="secondary" onClick={() => { setShowModal(false); setEditingWarehouse(null); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingWarehouse ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
