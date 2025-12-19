'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Warehouse, MapPin, Thermometer, Eye, X, Droplets } from 'lucide-react';
import {
  WarehouseEditDialog,
  type Warehouse as WarehouseType,
  type WarehouseFormData,
  type WarehouseSummary,
} from '@/components/ui/warehouse-edit-dialog';

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
  }, [typeFilter]);

  const handleSearch = () => {
    fetchWarehouses();
  };

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
      // API errors handled by global error handler
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleDelete = async (warehouse: WarehouseType) => {
    if (!confirm(`Are you sure you want to delete warehouse "${warehouse.name}"?`)) return;

    try {
      const res = await fetch(`/api/warehouses/${warehouse.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchWarehouses();
      }
      // API errors handled by global error handler
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleEdit = async (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    // Fetch summary data for existing warehouse
    const summary = await fetchWarehouseDetail(warehouse.id);
    setWarehouseSummary(summary);
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingWarehouse(null);
    setWarehouseSummary(null);
    setShowDialog(true);
  };

  // Warehouse Card Component for mobile/tablet view
  const WarehouseCard = ({ warehouse }: { warehouse: WarehouseType }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            warehouse.type === 'raw_material' ? 'bg-blue-100' :
            warehouse.type === 'finished_goods' ? 'bg-green-100' :
            warehouse.type === 'quarantine' ? 'bg-yellow-100' :
            warehouse.type === 'rejected' ? 'bg-red-100' :
            'bg-gray-100'
          }`}>
            <Warehouse className={`h-5 w-5 ${
              warehouse.type === 'raw_material' ? 'text-blue-600' :
              warehouse.type === 'finished_goods' ? 'text-green-600' :
              warehouse.type === 'quarantine' ? 'text-yellow-600' :
              warehouse.type === 'rejected' ? 'text-red-600' :
              'text-gray-600'
            }`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
            <p className="text-sm text-gray-500">{warehouse.code}</p>
          </div>
        </div>
        <Badge variant={warehouse.isActive ? 'success' : 'danger'} className="text-xs">
          {warehouse.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Type</span>
          <Badge variant={getTypeVariant(warehouse.type)} className="text-xs">
            {getTypeLabel(warehouse.type)}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Location</span>
          <span className="text-gray-900">{warehouse.location || '-'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Thermometer className="h-3 w-3" /> Temp
          </span>
          <span className="text-gray-900">
            {warehouse.temperatureMin !== null && warehouse.temperatureMax !== null
              ? `${warehouse.temperatureMin}°C - ${warehouse.temperatureMax}°C`
              : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1">
            <Droplets className="h-3 w-3" /> Humidity
          </span>
          <span className="text-gray-900">
            {warehouse.humidityMin !== null && warehouse.humidityMax !== null
              ? `${warehouse.humidityMin}% - ${warehouse.humidityMax}%`
              : '-'}
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => setViewingWarehouse(warehouse)}
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => handleEdit(warehouse)}
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleDelete(warehouse)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Warehouses</h1>
            <p className="text-sm md:text-base text-gray-600">จัดการคลังสินค้าและสถานที่จัดเก็บ</p>
          </div>
          <Button
            onClick={handleCreate}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Warehouse</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Summary Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="!p-3 md:!p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg">
                <Warehouse className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Total</p>
                <p className="text-lg md:text-xl font-bold">{warehouses.length}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 md:!p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-100 rounded-lg">
                <MapPin className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Active</p>
                <p className="text-lg md:text-xl font-bold">
                  {warehouses.filter(w => w.isActive).length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 md:!p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-cyan-100 rounded-lg">
                <Thermometer className="h-4 w-4 md:h-5 md:w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Cold</p>
                <p className="text-lg md:text-xl font-bold">
                  {warehouses.filter(w => w.type === 'cold_storage').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 md:!p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-yellow-100 rounded-lg">
                <Warehouse className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500">Quarantine</p>
                <p className="text-lg md:text-xl font-bold">
                  {warehouses.filter(w => w.type === 'quarantine').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="!p-3 md:!p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                variant="search"
                placeholder="Search by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={handleSearch}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={warehouseTypes}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Content - Card view for mobile/tablet, Table for desktop */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : warehouses.length === 0 ? (
          <Card className="!p-8 text-center">
            <Warehouse className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No warehouses found</p>
          </Card>
        ) : (
          <>
            {/* Mobile/Tablet Card View - Show on screens smaller than xl (1280px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xl:hidden">
              {warehouses.map((warehouse) => (
                <WarehouseCard key={warehouse.id} warehouse={warehouse} />
              ))}
            </div>

            {/* Desktop Table View - Show only on xl screens and above */}
            <Card className="hidden xl:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Code</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Location</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Temperature</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Humidity</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((warehouse) => (
                    <tr key={warehouse.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{warehouse.code}</td>
                      <td className="py-3 px-4 text-gray-900">{warehouse.name}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getTypeVariant(warehouse.type)}>
                          {getTypeLabel(warehouse.type)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{warehouse.location || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {warehouse.temperatureMin !== null && warehouse.temperatureMax !== null
                          ? `${warehouse.temperatureMin}°C - ${warehouse.temperatureMax}°C`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {warehouse.humidityMin !== null && warehouse.humidityMax !== null
                          ? `${warehouse.humidityMin}% - ${warehouse.humidityMax}%`
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={warehouse.isActive ? 'success' : 'danger'}>
                          {warehouse.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setViewingWarehouse(warehouse)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEdit(warehouse)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(warehouse)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>

      {/* View Modal */}
      {viewingWarehouse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-4 md:p-6 border-b flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold">Warehouse Details</h2>
              <button
                onClick={() => setViewingWarehouse(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  viewingWarehouse.type === 'raw_material' ? 'bg-blue-100' :
                  viewingWarehouse.type === 'finished_goods' ? 'bg-green-100' :
                  viewingWarehouse.type === 'quarantine' ? 'bg-yellow-100' :
                  viewingWarehouse.type === 'rejected' ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                  <Warehouse className={`h-8 w-8 ${
                    viewingWarehouse.type === 'raw_material' ? 'text-blue-600' :
                    viewingWarehouse.type === 'finished_goods' ? 'text-green-600' :
                    viewingWarehouse.type === 'quarantine' ? 'text-yellow-600' :
                    viewingWarehouse.type === 'rejected' ? 'text-red-600' :
                    'text-gray-600'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewingWarehouse.name}</h3>
                  <p className="text-gray-500">{viewingWarehouse.code}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <Badge variant={getTypeVariant(viewingWarehouse.type)}>
                    {getTypeLabel(viewingWarehouse.type)}
                  </Badge>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge variant={viewingWarehouse.isActive ? 'success' : 'danger'}>
                    {viewingWarehouse.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Location</p>
                  <p className="font-medium">{viewingWarehouse.location || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Capacity</p>
                  <p className="font-medium">{viewingWarehouse.capacity || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cyan-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Thermometer className="h-4 w-4 text-cyan-600" />
                    <p className="text-xs text-cyan-700">Temperature</p>
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
                    <p className="text-xs text-blue-700">Humidity</p>
                  </div>
                  <p className="font-medium text-blue-900">
                    {viewingWarehouse.humidityMin !== null && viewingWarehouse.humidityMax !== null
                      ? `${viewingWarehouse.humidityMin}% - ${viewingWarehouse.humidityMax}%`
                      : '-'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t bg-gray-50 rounded-b-2xl flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setViewingWarehouse(null)}
              >
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  handleEdit(viewingWarehouse);
                  setViewingWarehouse(null);
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog - Full Screen */}
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
    </MainLayout>
  );
}
