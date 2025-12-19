'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  Package, ArrowRight, BoxSelect, ChevronRight, Inbox
} from 'lucide-react';
import { ItemSearchDialog, type Item as SearchItem } from '@/components/ui/item-search-dialog';
import type { DataGridTypes } from 'devextreme-react/data-grid';

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

interface Warehouse {
  id: number;
  name: string;
  code?: string;
}

interface Vendor {
  id: number;
  name: string;
  code?: string;
}

interface TraceLot {
  lotNumber: string;
  itemCode: string;
  quantity: number;
  unit: string;
  status: string;
}

interface TraceData {
  backward?: TraceLot[];
  forward?: TraceLot[];
}

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'quarantine', label: 'กักกัน' },
  { value: 'released', label: 'ปล่อยแล้ว' },
  { value: 'rejected', label: 'ปฏิเสธ' },
  { value: 'blocked', label: 'ล็อค' },
];

const getStatusLabel = (status: string): string => {
  const found = statusOptions.find(s => s.value === status);
  return found ? found.label : status;
};

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

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH');
};

export default function LotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
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

  // Item search dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);

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

    if (!formData.cost || formData.cost <= 0) {
      errors.cost = 'Cost per unit is required and must be greater than 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/inventory/lots?${params}`);
      const data = await res.json();

      if (data.success) {
        let fetchedLots = data.data?.items || data.data || [];

        // Client-side search filter
        if (search) {
          const searchLower = search.toLowerCase();
          fetchedLots = fetchedLots.filter((lot: Lot) =>
            lot.lotNumber?.toLowerCase().includes(searchLower) ||
            lot.itemCode?.toLowerCase().includes(searchLower) ||
            lot.itemName?.toLowerCase().includes(searchLower)
          );
        }

        setLots(fetchedLots);
      } else {
        setLots([]);
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
      setLots([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

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
  }, [fetchLots]);

  const handleSelectItem = (item: SearchItem) => {
    setSelectedItem(item);
    setFormData(prev => ({
      ...prev,
      itemId: item.id,
      unit: item.primaryUnit,
    }));
    if (formErrors.itemId) {
      setFormErrors(prev => ({ ...prev, itemId: '' }));
    }
  };

  const handleCreateLot = async () => {
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
  };

  const generateLotNumber = () => {
    const date = new Date();
    const prefix = 'LOT';
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, lotNumber: `${prefix}-${dateStr}-${random}` }));
  };

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/inventory/lots/${e.data.id}`);
    }
  };

  // Calculate summary stats
  const quarantineCount = lots.filter(l => l.status === 'quarantine').length;
  const releasedCount = lots.filter(l => l.status === 'released').length;
  const rejectedCount = lots.filter(l => l.status === 'rejected').length;
  const nearExpiryCount = lots.filter(l => {
    const days = getDaysUntilExpiry(l.expiryDate);
    return days !== null && days > 0 && days <= 30;
  }).length;

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'lotNumber',
      caption: 'เลขที่ Lot',
      width: 150,
      cellRender: (cellInfo) => (
        <span className="font-mono font-medium">{cellInfo.data.lotNumber}</span>
      ),
    },
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 140,
      dataType: 'number',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.quantity.toLocaleString()} {cellInfo.data.unit}</p>
          {cellInfo.data.reservedQuantity > 0 && (
            <p className="text-xs text-orange-500">จอง: {cellInfo.data.reservedQuantity}</p>
          )}
        </div>
      ),
    },
    {
      dataField: 'cost',
      caption: 'มูลค่ารวม',
      width: 150,
      dataType: 'number',
      cellRender: (cellInfo) => {
        const totalCost = (cellInfo.data.quantity || 0) * (cellInfo.data.cost || 0);
        return (
          <div>
            <p className="font-medium">฿{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            {cellInfo.data.cost && cellInfo.data.cost > 0 && (
              <p className="text-xs text-gray-500">@฿{cellInfo.data.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{cellInfo.data.unit}</p>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'warehouseName',
      caption: 'คลัง',
      width: 120,
    },
    {
      dataField: 'expiryDate',
      caption: 'วันหมดอายุ',
      width: 140,
      dataType: 'date',
      cellRender: (cellInfo) => {
        const days = getDaysUntilExpiry(cellInfo.data.expiryDate);
        return (
          <div>
            <p>{formatDate(cellInfo.data.expiryDate)}</p>
            {days !== null && (
              <Badge variant={getExpiryVariant(days)} size="sm">
                {days < 0 ? `หมดอายุ ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusVariant(cellInfo.data.status)} dot>
          {getStatusLabel(cellInfo.data.status)}
        </Badge>
      ),
    },
    {
      caption: 'การดำเนินการ',
      width: 120,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex gap-1">
          {cellInfo.data.status === 'quarantine' && (
            <DxButton
              text="QC"
              type="default"
              stylingMode="outlined"
              onClick={(e) => {
                e?.event?.stopPropagation();
                setSelectedLot(cellInfo.data);
                setShowQCModal(true);
              }}
            />
          )}
          <DxButton
            icon="search"
            type="default"
            stylingMode="text"
            onClick={(e) => {
              e?.event?.stopPropagation();
              handleViewTrace(cellInfo.data);
            }}
          />
        </div>
      ),
    },
  ];

  const warehouseOptions = [
    { value: '', label: 'เลือกคลัง' },
    ...warehouses.map(w => ({ value: w.id.toString(), label: w.name }))
  ];

  const vendorOptions = [
    { value: '', label: 'เลือก Vendor (ไม่บังคับ)' },
    ...vendors.map(v => ({ value: v.id.toString(), label: v.name }))
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Inventory Lots"
          description="จัดการ Lot/Batch สินค้าคงคลัง"
          actions={
            <DxButton
              text="รับ Lot ใหม่"
              icon="plus"
              type="success"
              onClick={() => setShowModal(true)}
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">กักกัน</p>
                  <p className="text-xl font-bold">{quarantineCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ปล่อยแล้ว</p>
                  <p className="text-xl font-bold">{releasedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ปฏิเสธ</p>
                  <p className="text-xl font-bold">{rejectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card elevation="raised">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ใกล้หมดอายุ (30 วัน)</p>
                  <p className="text-xl font-bold">{nearExpiryCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card elevation="raised">
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ Lot หรือสินค้า..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                  onEnterKey={() => fetchLots()}
                />
              </div>
              <div className="w-full md:w-48">
                <DxSelectBox
                  items={statusOptions}
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  placeholder="สถานะ"
                  showClearButton
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card elevation="raised">
          <CardContent>
            {lots.length > 0 || isLoading ? (
              <DxDataGrid
                dataSource={lots}
                keyExpr="id"
                columns={columns}
                loading={isLoading}
                sorting
                filterRow
                headerFilter
                export
                exportFileName="inventory-lots"
                searchPanel
                columnChooser
                virtualScrolling={lots.length > 100}
                height={600}
                onRowClick={handleRowClick}
                noDataText="ไม่พบ Lot"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="ไม่พบ Lot"
                description="เริ่มต้นด้วยการรับ Lot ใหม่เข้าคลัง"
                action={{
                  label: 'รับ Lot ใหม่',
                  onClick: () => setShowModal(true),
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Lot Modal */}
      <DxPopup
        visible={showModal}
        onVisibleChange={(v) => { if (!v) { setShowModal(false); resetForm(); } }}
        title="รับ Lot ใหม่"
        width={800}
        height="auto"
        maxHeight="90vh"
      >
        <div className="p-6 space-y-4">
          <p className="text-gray-600 mb-4">รับสินค้าเข้าคลัง (สถานะ: กักกัน)</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขที่ Lot <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <DxTextBox
                  value={formData.lotNumber}
                  onValueChange={(v) => {
                    setFormData(prev => ({ ...prev, lotNumber: v }));
                    if (formErrors.lotNumber) setFormErrors(prev => ({ ...prev, lotNumber: '' }));
                  }}
                  placeholder="LOT-YYYYMMDD-XXX"
                />
                <DxButton text="สร้าง" type="default" onClick={generateLotNumber} />
              </div>
              {formErrors.lotNumber && (
                <p className="text-sm text-red-500 mt-1">{formErrors.lotNumber}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Lot Number
              </label>
              <DxTextBox
                value={formData.vendorLotNumber}
                onValueChange={(v) => setFormData(prev => ({ ...prev, vendorLotNumber: v }))}
                placeholder="เลขที่ Lot ผู้ขาย"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สินค้า <span className="text-red-500">*</span>
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
                  <DxButton text="เปลี่ยน" type="default" stylingMode="text" onClick={() => setItemDialogOpen(true)} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setItemDialogOpen(true)}
                  className={`w-full flex items-center justify-between p-3 border-2 border-dashed rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors group ${formErrors.itemId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 text-gray-500 group-hover:text-green-600">
                    <BoxSelect className="h-4 w-4" />
                    <span className="text-sm">คลิกเพื่อเลือกสินค้า...</span>
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
                คลัง <span className="text-red-500">*</span>
              </label>
              <DxSelectBox
                items={warehouseOptions}
                value={formData.warehouseId.toString()}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, warehouseId: parseInt(v) || 0 }));
                  if (formErrors.warehouseId) setFormErrors(prev => ({ ...prev, warehouseId: '' }));
                }}
              />
              {formErrors.warehouseId && (
                <p className="text-sm text-red-500 mt-1">{formErrors.warehouseId}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จำนวน <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                value={formData.quantity || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }));
                  if (formErrors.quantity) setFormErrors(prev => ({ ...prev, quantity: '' }));
                }}
                min="0"
                step="0.001"
              />
              {formErrors.quantity && (
                <p className="text-sm text-red-500 mt-1">{formErrors.quantity}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หน่วย
              </label>
              <DxTextBox value={formData.unit} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ราคาต่อหน่วย <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                value={formData.cost || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }));
                  if (formErrors.cost) setFormErrors(prev => ({ ...prev, cost: '' }));
                }}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              {formErrors.cost && (
                <p className="text-sm text-red-500 mt-1">{formErrors.cost}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันผลิต
              </label>
              <DxDateBox
                value={formData.manufacturingDate || ''}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, manufacturingDate: v }));
                  if (formErrors.manufacturingDate) setFormErrors(prev => ({ ...prev, manufacturingDate: '' }));
                }}
                max={formData.expiryDate || undefined}
              />
              {formErrors.manufacturingDate && (
                <p className="text-sm text-red-500 mt-1">{formErrors.manufacturingDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันหมดอายุ <span className="text-red-500">*</span>
              </label>
              <DxDateBox
                value={formData.expiryDate || ''}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, expiryDate: v }));
                  if (formErrors.expiryDate) setFormErrors(prev => ({ ...prev, expiryDate: '' }));
                }}
                min={formData.manufacturingDate || undefined}
              />
              {formErrors.expiryDate && (
                <p className="text-sm text-red-500 mt-1">{formErrors.expiryDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันรับสินค้า
              </label>
              <DxDateBox
                value={formData.receivedDate || ''}
                onValueChange={(v) => {
                  setFormData(prev => ({ ...prev, receivedDate: v }));
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor
            </label>
            <DxSelectBox
              items={vendorOptions}
              value={formData.vendorId?.toString() || ''}
              onValueChange={(v) => setFormData(prev => ({ ...prev, vendorId: v ? parseInt(v) : null }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หมายเหตุ
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton text="ยกเลิก" type="default" stylingMode="outlined" onClick={() => { setShowModal(false); resetForm(); }} />
            <DxButton text="รับ Lot" icon="check" type="success" onClick={handleCreateLot} />
          </div>
        </div>
      </DxPopup>

      {/* QC Action Modal */}
      <DxPopup
        visible={showQCModal && !!selectedLot}
        onVisibleChange={(v) => { if (!v) { setShowQCModal(false); setSelectedLot(null); } }}
        title="ตัดสินใจ QC"
        width={450}
        height="auto"
      >
        {selectedLot && (
          <div className="p-6">
            <p className="text-gray-600 mb-4">Lot: {selectedLot.lotNumber}</p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">สินค้า:</span>
                <span className="font-medium">{selectedLot.itemCode} - {selectedLot.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">จำนวน:</span>
                <span className="font-medium">{selectedLot.quantity} {selectedLot.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">วันหมดอายุ:</span>
                <span className="font-medium">{formatDate(selectedLot.expiryDate)}</span>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg mb-6">
              <p className="text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                กรุณาตรวจสอบให้แน่ใจว่าได้ทำการทดสอบ QC เสร็จสิ้นแล้วก่อนตัดสินใจ
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <DxButton text="ยกเลิก" type="default" stylingMode="outlined" onClick={() => { setShowQCModal(false); setSelectedLot(null); }} />
              <DxButton text="ปฏิเสธ" icon="close" type="danger" onClick={() => handleQCAction('reject')} />
              <DxButton text="ปล่อย" icon="check" type="success" onClick={() => handleQCAction('release')} />
            </div>
          </div>
        )}
      </DxPopup>

      {/* Traceability Modal */}
      <DxPopup
        visible={showTraceModal && !!selectedLot && !!traceData}
        onVisibleChange={(v) => { if (!v) { setShowTraceModal(false); setSelectedLot(null); setTraceData(null); } }}
        title="Lot Traceability"
        width={700}
        height="auto"
        maxHeight="90vh"
      >
        {selectedLot && traceData && (
          <div className="p-6">
            <p className="text-gray-600 mb-6">Lot: {selectedLot.lotNumber}</p>

            {/* Current Lot Info */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Lot ปัจจุบัน</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">สินค้า:</span> {selectedLot.itemCode}</div>
                <div><span className="text-gray-600">จำนวน:</span> {selectedLot.quantity} {selectedLot.unit}</div>
                <div><span className="text-gray-600">สถานะ:</span> {getStatusLabel(selectedLot.status)}</div>
                <div><span className="text-gray-600">หมดอายุ:</span> {formatDate(selectedLot.expiryDate)}</div>
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
                  {traceData.backward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)}>{getStatusLabel(lot.status)}</Badge>
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
                  {traceData.forward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)}>{getStatusLabel(lot.status)}</Badge>
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
                ไม่พบข้อมูล traceability สำหรับ Lot นี้
              </div>
            )}

            <div className="flex justify-end mt-6">
              <DxButton text="ปิด" type="default" stylingMode="outlined" onClick={() => { setShowTraceModal(false); setSelectedLot(null); setTraceData(null); }} />
            </div>
          </div>
        )}
      </DxPopup>

      {/* Item Selection Dialog */}
      <ItemSearchDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSelect={handleSelectItem}
        title="เลือกสินค้าที่จะรับ"
        showPrice="cost"
        showStock={true}
      />
    </MainLayout>
  );
}
