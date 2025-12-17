'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface WarehouseDetail {
  warehouse: {
    id: number;
    code: string;
    name: string;
    type: string;
    location: string;
    temperatureMin?: number;
    temperatureMax?: number;
    humidityMin?: number;
    humidityMax?: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalLots: number;
    totalQuantity: number;
    quarantineLots: number;
    releasedLots: number;
    rejectedLots: number;
    nearExpiryLots: number;
    inventoryByType: Record<string, { count: number; quantity: number }>;
    storageCapacity: number;
    usedCapacity: number;
    utilizationPercent: number;
  };
  lots: Array<{
    id: number;
    lotNumber: string;
    itemCode: string;
    itemName: string;
    itemNameEn: string;
    itemType: string;
    quantity: number;
    unit: string;
    status: string;
    expiryDate: string;
    receivedDate: string;
  }>;
  recentTransactions: Array<{
    id: number;
    type: string;
    lotId: number;
    quantity: number;
    reference: string;
    createdAt: string;
  }>;
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<WarehouseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'transactions' | 'settings'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    code: '',
    name: '',
    type: '',
    location: '',
    temperatureMin: '',
    temperatureMax: '',
    humidityMin: '',
    humidityMax: '',
  });

  useEffect(() => {
    fetchWarehouseDetail();
  }, [params.id]);

  const fetchWarehouseDetail = async () => {
    try {
      const response = await fetch(`/api/warehouses/${params.id}/detail`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setEditForm({
          code: result.data.warehouse.code || '',
          name: result.data.warehouse.name || '',
          type: result.data.warehouse.type || '',
          location: result.data.warehouse.location || '',
          temperatureMin: result.data.warehouse.temperatureMin?.toString() || '',
          temperatureMax: result.data.warehouse.temperatureMax?.toString() || '',
          humidityMin: result.data.warehouse.humidityMin?.toString() || '',
          humidityMax: result.data.warehouse.humidityMax?.toString() || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch warehouse detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/warehouses/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          temperatureMin: editForm.temperatureMin ? parseFloat(editForm.temperatureMin) : null,
          temperatureMax: editForm.temperatureMax ? parseFloat(editForm.temperatureMax) : null,
          humidityMin: editForm.humidityMin ? parseFloat(editForm.humidityMin) : null,
          humidityMax: editForm.humidityMax ? parseFloat(editForm.humidityMax) : null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setIsEditing(false);
        fetchWarehouseDetail();
      }
    } catch (error) {
      console.error('Failed to update warehouse:', error);
    }
  };

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'released': return 'primary';
      case 'quarantine': return 'secondary';
      case 'rejected': return 'danger';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      'raw material': 'วัตถุดิบ',
      'finished goods': 'สินค้าสำเร็จรูป',
      'quarantine': 'กักกัน',
      'rejected': 'ปฏิเสธ',
      'cold storage': 'ห้องเย็น',
      'general': 'ทั่วไป',
    };
    return types[type] || type;
  };

  const filteredLots = data?.lots.filter(lot => {
    const matchesSearch = lot.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.itemName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lot.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">ไม่พบข้อมูลคลังสินค้า</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/inventory/warehouses')}>
            กลับไปหน้ารายการ
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { warehouse, summary, lots, recentTransactions } = data;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/inventory/warehouses')}>
                ← Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Warehouse: {warehouse.code}</h1>
              <Badge variant={warehouse.isActive ? 'primary' : 'danger'}>
                {warehouse.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">{warehouse.name}</p>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="primary" onClick={() => setIsEditing(true)}>Edit</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Save</Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Lots</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.totalLots}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Released</p>
                  <p className="text-2xl font-bold text-green-600">{summary.releasedLots}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <span className="text-2xl">⏳</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quarantine</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.quarantineLots}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Near Expiry</p>
                  <p className="text-2xl font-bold text-orange-600">{summary.nearExpiryLots}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Storage Utilization */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Storage Utilization</span>
              <span className="text-sm text-gray-600">{summary.utilizationPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full ${
                  summary.utilizationPercent > 90 ? 'bg-red-500' : 
                  summary.utilizationPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${summary.utilizationPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summary.usedCapacity.toLocaleString()} / {summary.storageCapacity.toLocaleString()} units
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'inventory', label: '📦 Inventory', icon: '📦' },
              { id: 'transactions', label: '📋 Transactions', icon: '📋' },
              { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Warehouse Info */}
            <Card>
              <CardHeader>
                <CardTitle>Warehouse Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Code</dt>
                    <dd className="font-medium">{warehouse.code}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Name</dt>
                    <dd className="font-medium">{warehouse.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="font-medium">{getTypeLabel(warehouse.type)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Location</dt>
                    <dd className="font-medium">{warehouse.location || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Temperature Range</dt>
                    <dd className="font-medium">
                      {warehouse.temperatureMin !== undefined && warehouse.temperatureMax !== undefined
                        ? `${warehouse.temperatureMin}°C - ${warehouse.temperatureMax}°C`
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Humidity Range</dt>
                    <dd className="font-medium">
                      {warehouse.humidityMin !== undefined && warehouse.humidityMax !== undefined
                        ? `${warehouse.humidityMin}% - ${warehouse.humidityMax}%`
                        : '-'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Inventory by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.inventoryByType).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{type.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-500">{data.count} lots</p>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{data.quantity.toLocaleString()}</p>
                    </div>
                  ))}
                  {Object.keys(summary.inventoryByType).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No inventory data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'inventory' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Inventory Lots</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search lots..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="released">Released</option>
                    <option value="quarantine">Quarantine</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'lotNumber', title: 'Lot Number' },
                  { key: 'item', title: 'Item' },
                  { key: 'quantity', title: 'Quantity' },
                  { key: 'status', title: 'Status' },
                  { key: 'expiryDate', title: 'Expiry Date' },
                  { key: 'actions', title: 'Actions' },
                ]}
                data={filteredLots}
                renderRow={(lot) => (
                  <tr key={lot.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/inventory/lots/${lot.id}`)}>
                    <td className="px-4 py-3 font-medium text-blue-600">{lot.lotNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{lot.itemCode}</p>
                        <p className="text-sm text-gray-500">{lot.itemName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{lot.quantity} {lot.unit}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/inventory/lots/${lot.id}`); }}>
                        View
                      </Button>
                    </td>
                  </tr>
                )}
              />
              {filteredLots.length === 0 && (
                <p className="text-center text-gray-500 py-8">No lots found in this warehouse</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table
                columns={[
                  { key: 'date', title: 'Date' },
                  { key: 'type', title: 'Type' },
                  { key: 'reference', title: 'Reference' },
                  { key: 'quantity', title: 'Quantity' },
                ]}
                data={recentTransactions}
                renderRow={(tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('th-TH') : '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.type === 'receive' ? 'primary' : tx.type === 'issue' ? 'danger' : 'secondary'}>
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{tx.reference || '-'}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className={tx.type === 'receive' ? 'text-green-600' : 'text-red-600'}>
                        {tx.type === 'receive' ? '+' : '-'}{tx.quantity}
                      </span>
                    </td>
                  </tr>
                )}
              />
              {recentTransactions.length === 0 && (
                <p className="text-center text-gray-500 py-8">No transactions found</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                    <Input
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <Select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    >
                      <option value="raw material">Raw Material</option>
                      <option value="finished goods">Finished Goods</option>
                      <option value="quarantine">Quarantine</option>
                      <option value="rejected">Rejected</option>
                      <option value="cold storage">Cold Storage</option>
                      <option value="general">General</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <Input
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Temperature (°C)</label>
                    <Input
                      type="number"
                      value={editForm.temperatureMin}
                      onChange={(e) => setEditForm({ ...editForm, temperatureMin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Temperature (°C)</label>
                    <Input
                      type="number"
                      value={editForm.temperatureMax}
                      onChange={(e) => setEditForm({ ...editForm, temperatureMax: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Humidity (%)</label>
                    <Input
                      type="number"
                      value={editForm.humidityMin}
                      onChange={(e) => setEditForm({ ...editForm, humidityMin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Humidity (%)</label>
                    <Input
                      type="number"
                      value={editForm.humidityMax}
                      onChange={(e) => setEditForm({ ...editForm, humidityMax: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Code</dt>
                    <dd className="font-medium">{warehouse.code}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Name</dt>
                    <dd className="font-medium">{warehouse.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="font-medium">{getTypeLabel(warehouse.type)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Location</dt>
                    <dd className="font-medium">{warehouse.location || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Temperature Range</dt>
                    <dd className="font-medium">
                      {warehouse.temperatureMin !== undefined && warehouse.temperatureMax !== undefined
                        ? `${warehouse.temperatureMin}°C - ${warehouse.temperatureMax}°C`
                        : 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Humidity Range</dt>
                    <dd className="font-medium">
                      {warehouse.humidityMin !== undefined && warehouse.humidityMax !== undefined
                        ? `${warehouse.humidityMin}% - ${warehouse.humidityMax}%`
                        : 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Created</dt>
                    <dd className="font-medium">{warehouse.createdAt ? new Date(warehouse.createdAt).toLocaleString('th-TH') : '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Last Updated</dt>
                    <dd className="font-medium">{warehouse.updatedAt ? new Date(warehouse.updatedAt).toLocaleString('th-TH') : '-'}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
