'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';

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
  const t = useTranslations('inventory');
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
    temperatureMin: 0,
    temperatureMax: 0,
    humidityMin: 0,
    humidityMax: 0,
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
          temperatureMin: result.data.warehouse.temperatureMin || 0,
          temperatureMax: result.data.warehouse.temperatureMax || 0,
          humidityMin: result.data.warehouse.humidityMin || 0,
          humidityMax: result.data.warehouse.humidityMax || 0,
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
          temperatureMin: editForm.temperatureMin || null,
          temperatureMax: editForm.temperatureMax || null,
          humidityMin: editForm.humidityMin || null,
          humidityMax: editForm.humidityMax || null,
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

  const getStatusVariant = (status: string): 'success' | 'danger' | 'warning' | 'default' => {
    switch (status) {
      case 'released': return 'success';
      case 'quarantine': return 'warning';
      case 'rejected': return 'danger';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      'raw material': 'Raw Material',
      'finished goods': 'Finished Goods',
      'quarantine': 'Quarantine',
      'rejected': 'Rejected',
      'cold storage': 'Cold Storage',
      'general': 'General',
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

  // Grid columns for lots
  const lotsColumns: DxDataGridColumn[] = [
    {
      dataField: 'lotNumber',
      caption: 'Lot Number',
      cellRender: (cellInfo) => (
        <span className="font-medium text-blue-600">{cellInfo.data.lotNumber}</span>
      )
    },
    {
      dataField: 'itemCode',
      caption: 'Item',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      )
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 120,
      cellRender: (cellInfo) => `${cellInfo.data.quantity} ${cellInfo.data.unit}`
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusVariant(cellInfo.data.status)}>{cellInfo.data.status}</Badge>
      )
    },
    {
      dataField: 'expiryDate',
      caption: 'Expiry Date',
      width: 130,
      cellRender: (cellInfo) => cellInfo.data.expiryDate ? new Date(cellInfo.data.expiryDate).toLocaleDateString('th-TH') : '-'
    },
    {
      dataField: 'actions',
      caption: '',
      width: 80,
      cellRender: (cellInfo) => (
        <DxButton
          text="View"
          type="normal"
          stylingMode="text"
          onClick={() => router.push(`/inventory/lots/${cellInfo.data.id}`)}
        />
      )
    },
  ];

  // Grid columns for transactions
  const transactionsColumns: DxDataGridColumn[] = [
    {
      dataField: 'createdAt',
      caption: 'Date',
      width: 160,
      cellRender: (cellInfo) => cellInfo.data.createdAt ? new Date(cellInfo.data.createdAt).toLocaleString('th-TH') : '-'
    },
    {
      dataField: 'type',
      caption: 'Type',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={cellInfo.data.type === 'receive' ? 'success' : cellInfo.data.type === 'issue' ? 'danger' : 'default'}>
          {cellInfo.data.type}
        </Badge>
      )
    },
    {
      dataField: 'reference',
      caption: 'Reference',
      cellRender: (cellInfo) => cellInfo.data.reference || '-'
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 120,
      cellRender: (cellInfo) => (
        <span className={cellInfo.data.type === 'receive' ? 'text-green-600' : 'text-red-600'}>
          {cellInfo.data.type === 'receive' ? '+' : '-'}{cellInfo.data.quantity}
        </span>
      )
    },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Warehouse not found</p>
          <div className="mt-4">
            <DxButton
              text="Back to List"
              type="default"
              onClick={() => router.push('/inventory/warehouses')}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  const { warehouse, summary, recentTransactions } = data;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/inventory/warehouses')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{t('warehouses.detail.pageTitle')}: {warehouse.code}</h1>
              <Badge variant={warehouse.isActive ? 'success' : 'danger'}>
                {warehouse.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">{warehouse.name}</p>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <DxButton
                text="Edit"
                type="default"
                onClick={() => setIsEditing(true)}
              />
            ) : (
              <>
                <DxButton
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setIsEditing(false)}
                />
                <DxButton
                  text="Save"
                  type="success"
                  onClick={handleSave}
                />
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
              {summary.usedCapacity.toLocaleString()} / {summary.storageCapacity.toLocaleString()} lots
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'inventory', label: 'Inventory' },
              { id: 'transactions', label: 'Transactions' },
              { id: 'settings', label: 'Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
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

            <Card>
              <CardHeader>
                <CardTitle>Inventory by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.inventoryByType).map(([type, invData]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{type.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-500">{invData.count} lots</p>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{invData.quantity.toLocaleString()}</p>
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
                  <DxTextBox
                    placeholder="Search lots..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                    mode="search"
                    showClearButton
                    width={250}
                  />
                  <DxSelectBox
                    items={[
                      { value: 'all', text: 'All Status' },
                      { value: 'released', text: 'Released' },
                      { value: 'quarantine', text: 'Quarantine' },
                      { value: 'rejected', text: 'Rejected' },
                    ]}
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    valueExpr="value"
                    displayExpr="text"
                    width={150}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={filteredLots}
                keyExpr="id"
                columns={lotsColumns}
                showBorders
                height={400}
                noDataText="No lots found in this warehouse"
                onRowClick={(e) => router.push(`/inventory/lots/${e.data.id}`)}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={recentTransactions}
                keyExpr="id"
                columns={transactionsColumns}
                showBorders
                height={400}
                noDataText="No transactions found"
              />
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
                    <DxTextBox
                      value={editForm.code}
                      onValueChange={(value) => setEditForm({ ...editForm, code: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <DxTextBox
                      value={editForm.name}
                      onValueChange={(value) => setEditForm({ ...editForm, name: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <DxSelectBox
                      items={[
                        { value: 'raw material', text: 'Raw Material' },
                        { value: 'finished goods', text: 'Finished Goods' },
                        { value: 'quarantine', text: 'Quarantine' },
                        { value: 'rejected', text: 'Rejected' },
                        { value: 'cold storage', text: 'Cold Storage' },
                        { value: 'general', text: 'General' },
                      ]}
                      value={editForm.type}
                      onValueChange={(value) => setEditForm({ ...editForm, type: value })}
                      valueExpr="value"
                      displayExpr="text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <DxTextBox
                      value={editForm.location}
                      onValueChange={(value) => setEditForm({ ...editForm, location: value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Temperature (°C)</label>
                    <DxNumberBox
                      value={editForm.temperatureMin}
                      onValueChange={(value) => setEditForm({ ...editForm, temperatureMin: value || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Temperature (°C)</label>
                    <DxNumberBox
                      value={editForm.temperatureMax}
                      onValueChange={(value) => setEditForm({ ...editForm, temperatureMax: value || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Humidity (%)</label>
                    <DxNumberBox
                      value={editForm.humidityMin}
                      onValueChange={(value) => setEditForm({ ...editForm, humidityMin: value || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Humidity (%)</label>
                    <DxNumberBox
                      value={editForm.humidityMax}
                      onValueChange={(value) => setEditForm({ ...editForm, humidityMax: value || 0 })}
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
