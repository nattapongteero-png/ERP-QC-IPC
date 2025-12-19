'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus, Search, CheckCircle, XCircle, Clock, AlertTriangle,
  Package, ArrowRight, Eye, Loader2, BoxSelect, Check, ChevronRight
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

interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  primaryUnit: string;
  type: string;
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  // Item search dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [searchItems, setSearchItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemTemp, setSelectedItemTemp] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.lotNumber.trim()) {
      errors.lotNumber = 'Lot number is required';
    }

    if (!formData.itemId || formData.itemId === 0) {
      errors.itemId = 'Please select an item';
    }

    if (!formData.warehouseId || formData.warehouseId === 0) {
      errors.warehouseId = 'Please select a warehouse';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }

    if (!formData.expiryDate) {
      errors.expiryDate = 'Expiry date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(formData.expiryDate);
      if (expiryDate <= today) {
        errors.expiryDate = 'Expiry date must be in the future';
      }
    }

    if (formData.manufacturingDate && formData.expiryDate) {
      const mfgDate = new Date(formData.manufacturingDate);
      const expDate = new Date(formData.expiryDate);
      if (mfgDate >= expDate) {
        errors.manufacturingDate = 'Manufacturing date must be before expiry date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
      const [warehousesRes, vendorsRes] = await Promise.all([
        fetch('/api/warehouses?limit=100'),
        fetch('/api/vendors?limit=100'),
      ]);

      const [warehousesData, vendorsData] = await Promise.all([
        warehousesRes.json(),
        vendorsRes.json(),
      ]);

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

  // Debounced item search for dialog
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemSearch.length >= 1 && itemDialogOpen) {
        searchItemsApi();
      } else if (itemSearch.length === 0 && itemDialogOpen) {
        loadRecentItems();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch, itemDialogOpen]);

  // Load recent items when dialog opens
  useEffect(() => {
    if (itemDialogOpen && searchItems.length === 0) {
      loadRecentItems();
    }
  }, [itemDialogOpen]);

  const loadRecentItems = async () => {
    setItemsLoading(true);
    try {
      const response = await fetch('/api/items?limit=20');
      const result = await response.json();
      if (result.success) {
        setSearchItems(result.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const searchItemsApi = async () => {
    setItemsLoading(true);
    try {
      const response = await fetch(`/api/items?search=${encodeURIComponent(itemSearch)}&limit=20`);
      const result = await response.json();
      if (result.success) {
        setSearchItems(result.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to search items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleSelectItemTemp = (item: Item) => {
    setSelectedItemTemp(item);
  };

  const handleConfirmItem = () => {
    if (selectedItemTemp) {
      setSelectedItem(selectedItemTemp);
      setFormData(prev => ({
        ...prev,
        itemId: selectedItemTemp.id,
        unit: selectedItemTemp.primaryUnit,
      }));
      if (formErrors.itemId) {
        setFormErrors(prev => ({ ...prev, itemId: '' }));
      }
      setItemDialogOpen(false);
      setItemSearch('');
      setSelectedItemTemp(null);
    }
  };

  const handleOpenItemDialog = () => {
    setSelectedItemTemp(selectedItem);
    setItemDialogOpen(true);
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLots();
  };

  const handleCreateLot = async () => {
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

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
      }
      // API errors handled by global error handler
    } catch {
      // Network errors handled by global error handler
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
      }
      // API errors handled by global error handler
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleViewTrace = async (lot: Lot) => {
    setSelectedLot(lot);
    try {
      const res = await fetch(`/api/inventory/traceability?lotId=${lot.id}`);
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
    setFormErrors({});
    setSelectedItem(null);
    setSelectedItemTemp(null);
    setItemSearch('');
    setSearchItems([]);
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

        {/* Filters Card */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
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
        </Card>

        {/* Table Card */}
        <Card className="p-6">
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
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, lotNumber: e.target.value }));
                        if (formErrors.lotNumber) setFormErrors(prev => ({ ...prev, lotNumber: '' }));
                      }}
                      placeholder="LOT-YYYYMMDD-XXX"
                      className={formErrors.lotNumber ? 'border-red-500' : ''}
                    />
                    <Button variant="secondary" onClick={generateLotNumber}>
                      Generate
                    </Button>
                  </div>
                  {formErrors.lotNumber && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.lotNumber}</p>
                  )}
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
                  {selectedItem ? (
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${formErrors.itemId ? 'border-red-500 bg-red-50' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <Package className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-800 text-sm">{selectedItem.code}</p>
                          <p className="text-xs text-green-600">{selectedItem.nameTh}</p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={handleOpenItemDialog}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenItemDialog}
                      className={`w-full flex items-center justify-between p-3 border-2 border-dashed rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors group ${formErrors.itemId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    >
                      <div className="flex items-center gap-2 text-gray-500 group-hover:text-green-600">
                        <BoxSelect className="h-4 w-4" />
                        <span className="text-sm">Click to select an item...</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-green-500" />
                    </button>
                  )}
                  {formErrors.itemId && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.itemId}</p>
                  )}
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
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, warehouseId: parseInt(e.target.value) || 0 }));
                      if (formErrors.warehouseId) setFormErrors(prev => ({ ...prev, warehouseId: '' }));
                    }}
                    className={formErrors.warehouseId ? 'border-red-500' : ''}
                  />
                  {formErrors.warehouseId && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.warehouseId}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.quantity || ''}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }));
                      if (formErrors.quantity) setFormErrors(prev => ({ ...prev, quantity: '' }));
                    }}
                    className={formErrors.quantity ? 'border-red-500' : ''}
                    min="0"
                    step="0.001"
                  />
                  {formErrors.quantity && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.quantity}</p>
                  )}
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
                    value={formData.cost || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <DatePicker
                  label="Manufacturing Date"
                  value={formData.manufacturingDate}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, manufacturingDate: value }));
                    if (formErrors.manufacturingDate) setFormErrors(prev => ({ ...prev, manufacturingDate: '' }));
                  }}
                  max={formData.expiryDate || undefined}
                  error={formErrors.manufacturingDate}
                  showQuickActions={false}
                  size="sm"
                />
                <DatePicker
                  label="Expiry Date"
                  value={formData.expiryDate}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, expiryDate: value }));
                    if (formErrors.expiryDate) setFormErrors(prev => ({ ...prev, expiryDate: '' }));
                  }}
                  min={formData.manufacturingDate || undefined}
                  error={formErrors.expiryDate}
                  required
                  showQuickActions={false}
                  size="sm"
                />
                <DatePicker
                  label="Received Date"
                  value={formData.receivedDate}
                  onChange={(value) => setFormData(prev => ({ ...prev, receivedDate: value }))}
                  showQuickActions={false}
                  size="sm"
                />
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

      {/* Item Selection Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              Select Item
            </DialogTitle>
            <DialogDescription>
              Search and select an item to receive
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Input
              placeholder="Search by item code or name..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              leftIcon={itemsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              autoFocus
            />
          </div>

          {/* Item List */}
          <div className="flex-1 overflow-auto min-h-[300px] border rounded-lg">
            {itemsLoading && searchItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading items...
              </div>
            ) : searchItems.length > 0 ? (
              <div className="divide-y">
                {searchItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItemTemp(item)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      selectedItemTemp?.id === item.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        selectedItemTemp?.id === item.id ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Package className={`h-5 w-5 ${
                          selectedItemTemp?.id === item.id ? 'text-green-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <p className={`font-semibold ${
                          selectedItemTemp?.id === item.id ? 'text-green-800' : 'text-gray-900'
                        }`}>
                          {item.code}
                        </p>
                        <p className={`text-sm ${
                          selectedItemTemp?.id === item.id ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {item.nameTh}
                        </p>
                        {item.nameEn && (
                          <p className="text-xs text-gray-400">{item.nameEn}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" size="sm">{item.type}</Badge>
                      <Badge variant="default" size="sm">{item.primaryUnit}</Badge>
                      {selectedItemTemp?.id === item.id && (
                        <Check className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : itemSearch.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Search className="h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No items found</p>
                <p className="text-sm text-center mt-1">
                  Try a different search term or check if the item exists in the system
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <Package className="h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">No items available</p>
                <p className="text-sm text-center mt-1">
                  Create items in the Items module first
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-500">
              {selectedItemTemp ? (
                <>Selected: <span className="font-medium text-green-600">{selectedItemTemp.code} - {selectedItemTemp.nameTh}</span></>
              ) : (
                'Click on an item to select it'
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setItemDialogOpen(false);
                  setItemSearch('');
                  setSelectedItemTemp(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmItem}
                disabled={!selectedItemTemp}
              >
                Select Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
