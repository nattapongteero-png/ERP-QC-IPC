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
import { 
  Plus, Search, CheckCircle, XCircle, Clock, AlertTriangle,
  Package, ArrowRight, Eye
} from 'lucide-react';

interface Lot {
  id: number;
  lotNumber: string;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  warehouseId: number;
  warehouseName?: string;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  status: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  vendorLotNumber: string | null;
  vendorId: number | null;
  vendorName?: string;
  cost: number | null;
}

interface LotFormData {
  lotNumber: string;
  itemId: number;
  warehouseId: number;
  quantity: number;
  unit: string;
  manufacturingDate: string;
  expiryDate: string;
  receivedDate: string;
  vendorLotNumber: string;
  vendorId: number | null;
  cost: number;
  notes: string;
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'released', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'blocked', label: 'Blocked' },
];

const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'released': return 'success';
    case 'quarantine': return 'warning';
    case 'rejected': return 'danger';
    case 'blocked': return 'danger';
    default: return 'default';
  }
};

const getDaysUntilExpiry = (expiryDate: string | null) => {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getExpiryVariant = (days: number | null): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (days === null) return 'default';
  if (days < 0) return 'danger';
  if (days <= 7) return 'danger';
  if (days <= 30) return 'warning';
  if (days <= 60) return 'info';
  return 'success';
};

export default function LotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [traceData, setTraceData] = useState<any>(null);
  const [formData, setFormData] = useState<LotFormData>({
    lotNumber: '',
    itemId: 0,
    warehouseId: 0,
    quantity: 0,
    unit: 'kg',
    manufacturingDate: '',
    expiryDate: '',
    receivedDate: new Date().toISOString().split('T')[0],
    vendorLotNumber: '',
    vendorId: null,
    cost: 0,
    notes: '',
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchLots = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/inventory/lots?${params}`);
      const data = await res.json();

      if (data.success) {
        setLots(data.data?.items || data.data || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [itemsRes, warehousesRes, vendorsRes] = await Promise.all([
        fetch('/api/items?limit=1000'),
        fetch('/api/warehouses?limit=100'),
        fetch('/api/vendors?limit=100'),
      ]);
      
      const [itemsData, warehousesData, vendorsData] = await Promise.all([
        itemsRes.json(),
        warehousesRes.json(),
        vendorsRes.json(),
      ]);
      
      if (itemsData.success) setItems(itemsData.data?.items || []);
      if (warehousesData.success) setWarehouses(warehousesData.data?.items || []);
      if (vendorsData.success) setVendors(vendorsData.data?.items || []);
    } catch (error) {
      console.error('Failed to fetch master data:', error);
    }
  };

  useEffect(() => {
    fetchLots();
    fetchMasterData();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLots();
  };

  const handleCreateLot = async () => {
    try {
      const res = await fetch('/api/inventory/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchLots();
        resetForm();
      } else {
        alert(data.error || 'Failed to create lot');
      }
    } catch (error) {
      alert('Failed to create lot');
    }
  };

  const handleQCAction = async (action: 'release' | 'reject') => {
    if (!selectedLot) return;
    
    try {
      const res = await fetch(`/api/inventory/lots/${selectedLot.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: action === 'release' ? 'released' : 'rejected',
          notes: `QC ${action}d on ${new Date().toISOString()}`
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setShowQCModal(false);
        setSelectedLot(null);
        fetchLots();
      } else {
        alert(data.error || `Failed to ${action} lot`);
      }
    } catch (error) {
      alert(`Failed to ${action} lot`);
    }
  };

  const handleViewTrace = async (lot: Lot) => {
    setSelectedLot(lot);
    try {
      const res = await fetch(`/api/inventory/traceability?lotNumber=${lot.lotNumber}`);
      const data = await res.json();
      if (data.success) {
        setTraceData(data.data);
        setShowTraceModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch traceability:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      lotNumber: '',
      itemId: 0,
      warehouseId: 0,
      quantity: 0,
      unit: 'kg',
      manufacturingDate: '',
      expiryDate: '',
      receivedDate: new Date().toISOString().split('T')[0],
      vendorLotNumber: '',
      vendorId: null,
      cost: 0,
      notes: '',
    });
  };

  const generateLotNumber = () => {
    const date = new Date();
    const prefix = 'LOT';
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, lotNumber: `${prefix}-${dateStr}-${random}` }));
  };

  const columns = [
    { key: 'lotNumber', header: 'Lot Number' },
    { 
      key: 'itemCode', 
      header: 'Item',
      render: (lot: Lot) => (
        <div>
          <p className="font-medium">{lot.itemCode}</p>
          <p className="text-xs text-gray-500">{lot.itemName}</p>
        </div>
      )
    },
    { 
      key: 'quantity', 
      header: 'Quantity',
      render: (lot: Lot) => (
        <div>
          <p className="font-medium">{lot.quantity.toLocaleString()} {lot.unit}</p>
          {lot.reservedQuantity > 0 && (
            <p className="text-xs text-orange-500">Reserved: {lot.reservedQuantity}</p>
          )}
        </div>
      )
    },
    { key: 'warehouseName', header: 'Warehouse' },
    {
      key: 'expiryDate',
      header: 'Expiry',
      render: (lot: Lot) => {
        const days = getDaysUntilExpiry(lot.expiryDate);
        return (
          <div>
            <p>{lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : '-'}</p>
            {days !== null && (
              <Badge variant={getExpiryVariant(days)} className="text-xs">
                {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
              </Badge>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (lot: Lot) => (
        <Badge variant={getStatusVariant(lot.status)}>
          {lot.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (lot: Lot) => (
        <div className="flex gap-1">
          {lot.status === 'quarantine' && (
            <Button 
              size="sm" 
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLot(lot);
                setShowQCModal(true);
              }}
            >
              QC
            </Button>
          )}
          <Button 
            size="sm" 
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleViewTrace(lot);
            }}
          >
            <Eye className="h-3 w-3" />
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
            <h1 className="text-2xl font-bold text-gray-900">Inventory Lots</h1>
            <p className="text-gray-600">จัดการ Lot/Batch สินค้าคงคลัง</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Receive Lot
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Quarantine</p>
                <p className="text-xl font-bold">
                  {lots.filter(l => l.status === 'quarantine').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Released</p>
                <p className="text-xl font-bold">
                  {lots.filter(l => l.status === 'released').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rejected</p>
                <p className="text-xl font-bold">
                  {lots.filter(l => l.status === 'rejected').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Near Expiry (30d)</p>
                <p className="text-xl font-bold">
                  {lots.filter(l => {
                    const days = getDaysUntilExpiry(l.expiryDate);
                    return days !== null && days > 0 && days <= 30;
                  }).length}
                </p>
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
                placeholder="Search by lot number or item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={handleSearch}
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            data={lots}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="No lots found"
            onRowClick={(lot) => router.push(`/inventory/lots/${lot.id}`)}
          />

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} lots
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

      {/* Create Lot Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Receive New Lot</h2>
              <p className="text-gray-600">รับสินค้าเข้าคลัง (สถานะ: Quarantine)</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.lotNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, lotNumber: e.target.value }))}
                      placeholder="LOT-YYYYMMDD-XXX"
                    />
                    <Button variant="secondary" onClick={generateLotNumber}>
                      Generate
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Lot Number
                  </label>
                  <Input
                    value={formData.vendorLotNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendorLotNumber: e.target.value }))}
                    placeholder="Supplier's lot number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={[
                      { value: '', label: 'Select Item' },
                      ...items.map(i => ({ value: i.id.toString(), label: `${i.code} - ${i.nameTh}` }))
                    ]}
                    value={formData.itemId.toString()}
                    onChange={(e) => {
                      const item = items.find(i => i.id === parseInt(e.target.value));
                      setFormData(prev => ({ 
                        ...prev, 
                        itemId: parseInt(e.target.value),
                        unit: item?.primaryUnit || 'kg'
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warehouse <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={[
                      { value: '', label: 'Select Warehouse' },
                      ...warehouses.map(w => ({ value: w.id.toString(), label: w.name }))
                    ]}
                    value={formData.warehouseId.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, warehouseId: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <Input
                    value={formData.unit}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost per Unit
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturing Date
                  </label>
                  <Input
                    type="date"
                    value={formData.manufacturingDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, manufacturingDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Received Date
                  </label>
                  <Input
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, receivedDate: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor
                </label>
                <Select
                  options={[
                    { value: '', label: 'Select Vendor (Optional)' },
                    ...vendors.map(v => ({ value: v.id.toString(), label: v.name }))
                  ]}
                  value={formData.vendorId?.toString() || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendorId: e.target.value ? parseInt(e.target.value) : null }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreateLot}>
                <Package className="h-4 w-4 mr-2" />
                Receive Lot
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QC Action Modal */}
      {showQCModal && selectedLot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">QC Decision</h2>
              <p className="text-gray-600">Lot: {selectedLot.lotNumber}</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Item:</span>
                  <span className="font-medium">{selectedLot.itemCode} - {selectedLot.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{selectedLot.quantity} {selectedLot.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expiry Date:</span>
                  <span className="font-medium">
                    {selectedLot.expiryDate ? new Date(selectedLot.expiryDate).toLocaleDateString() : '-'}
                  </span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Please ensure all QC tests have been completed before making a decision.
                </p>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowQCModal(false); setSelectedLot(null); }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => handleQCAction('reject')}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={() => handleQCAction('release')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Release
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Traceability Modal */}
      {showTraceModal && selectedLot && traceData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Lot Traceability</h2>
              <p className="text-gray-600">Lot: {selectedLot.lotNumber}</p>
            </div>
            
            <div className="p-6">
              {/* Current Lot Info */}
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">Current Lot</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-600">Item:</span> {selectedLot.itemCode}</div>
                  <div><span className="text-gray-600">Quantity:</span> {selectedLot.quantity} {selectedLot.unit}</div>
                  <div><span className="text-gray-600">Status:</span> {selectedLot.status}</div>
                  <div><span className="text-gray-600">Expiry:</span> {selectedLot.expiryDate ? new Date(selectedLot.expiryDate).toLocaleDateString() : '-'}</div>
                </div>
              </div>

              {/* Backward Trace (Source Lots) */}
              {traceData.backward && traceData.backward.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    Source Lots (Backward Trace)
                  </h3>
                  <div className="space-y-2">
                    {traceData.backward.map((lot: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{lot.lotNumber}</span>
                          <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
                        </div>
                        <div className="text-gray-600 mt-1">
                          {lot.itemCode} - {lot.quantity} {lot.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forward Trace (Destination Lots) */}
              {traceData.forward && traceData.forward.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Destination Lots (Forward Trace)
                  </h3>
                  <div className="space-y-2">
                    {traceData.forward.map((lot: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{lot.lotNumber}</span>
                          <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
                        </div>
                        <div className="text-gray-600 mt-1">
                          {lot.itemCode} - {lot.quantity} {lot.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!traceData.backward || traceData.backward.length === 0) && 
               (!traceData.forward || traceData.forward.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  No traceability data found for this lot.
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <Button variant="secondary" onClick={() => { setShowTraceModal(false); setSelectedLot(null); setTraceData(null); }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
