'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTabs } from '@/components/ui/dx-tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  Package, ArrowRight, BoxSelect, ChevronRight, Inbox,
  Boxes, TrendingUp, CalendarClock, Warehouse, Search,
  DollarSign, BarChart3, RefreshCcw
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

interface WarehouseData {
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

const statusTabs = [
  { id: '', text: 'ทั้งหมด', icon: 'selectall' },
  { id: 'quarantine', text: 'กักกัน', icon: 'clock' },
  { id: 'released', text: 'ปล่อยแล้ว', icon: 'check' },
  { id: 'rejected', text: 'ปฏิเสธ', icon: 'close' },
  { id: 'blocked', text: 'ล็อค', icon: 'lock' },
];

const getStatusLabel = (status: string): string => {
  const found = statusTabs.find(s => s.id === status);
  return found ? found.text : status;
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function LotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
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

  // Calculate comprehensive stats
  const stats = useMemo(() => {
    const quarantine = lots.filter(l => l.status === 'quarantine');
    const released = lots.filter(l => l.status === 'released');
    const rejected = lots.filter(l => l.status === 'rejected');
    const nearExpiry = lots.filter(l => {
      const days = getDaysUntilExpiry(l.expiryDate);
      return days !== null && days > 0 && days <= 30;
    });
    const expired = lots.filter(l => {
      const days = getDaysUntilExpiry(l.expiryDate);
      return days !== null && days < 0;
    });

    const totalQuantity = lots.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0);
    const totalValue = lots.reduce((sum, lot) => sum + ((Number(lot.quantity) || 0) * (Number(lot.cost) || 0)), 0);
    const releasedValue = released.reduce((sum, lot) => sum + ((Number(lot.quantity) || 0) * (Number(lot.cost) || 0)), 0);

    // Calculate average days to expiry for released lots
    const releasedWithExpiry = released.filter(l => l.expiryDate);
    const avgDaysToExpiry = releasedWithExpiry.length > 0
      ? Math.round(releasedWithExpiry.reduce((sum, lot) => {
          const days = getDaysUntilExpiry(lot.expiryDate);
          return sum + (days || 0);
        }, 0) / releasedWithExpiry.length)
      : 0;

    return {
      quarantineCount: quarantine.length,
      releasedCount: released.length,
      rejectedCount: rejected.length,
      nearExpiryCount: nearExpiry.length,
      expiredCount: expired.length,
      totalLots: lots.length,
      totalQuantity,
      totalValue,
      releasedValue,
      avgDaysToExpiry,
    };
  }, [lots]);

  // Tab items with counts
  const tabItems = useMemo(() => statusTabs.map(tab => {
    let count = 0;
    if (tab.id === '') count = lots.length;
    else if (tab.id === 'quarantine') count = stats.quarantineCount;
    else if (tab.id === 'released') count = stats.releasedCount;
    else if (tab.id === 'rejected') count = stats.rejectedCount;
    else count = lots.filter(l => l.status === tab.id).length;

    return {
      ...tab,
      badge: count > 0 ? count.toString() : undefined,
    };
  }), [lots, stats]);

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'lotNumber',
      caption: 'เลขที่ Lot',
      width: 150,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
            {cellInfo.data.lotNumber?.substring(0, 2) || 'LT'}
          </div>
          <span className="font-mono font-medium text-emerald-700">{cellInfo.data.lotNumber}</span>
        </div>
      ),
    },
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium text-gray-900">{cellInfo.data.itemCode}</p>
          <p className="text-xs text-gray-500 truncate max-w-[200px]">{cellInfo.data.itemName}</p>
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
          <p className="font-semibold text-gray-900">{cellInfo.data.quantity.toLocaleString()} <span className="text-xs text-gray-500 font-normal">{cellInfo.data.unit}</span></p>
          {cellInfo.data.reservedQuantity > 0 && (
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> จอง: {cellInfo.data.reservedQuantity.toLocaleString()}
            </p>
          )}
        </div>
      ),
    },
    {
      dataField: 'cost',
      caption: 'มูลค่า',
      width: 160,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const totalCost = (cellInfo.data.quantity || 0) * (cellInfo.data.cost || 0);
        return (
          <div>
            <p className="font-semibold text-emerald-700">{formatCurrency(totalCost)}</p>
            {cellInfo.data.cost && cellInfo.data.cost > 0 && (
              <p className="text-xs text-gray-500">@{formatCurrency(cellInfo.data.cost)}/{cellInfo.data.unit}</p>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'warehouseName',
      caption: 'คลัง',
      width: 130,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-gray-400" />
          <span>{cellInfo.data.warehouseName || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'expiryDate',
      caption: 'วันหมดอายุ',
      width: 150,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const days = getDaysUntilExpiry(cellInfo.data.expiryDate);
        const variant = getExpiryVariant(days);
        return (
          <div>
            <p className="text-gray-700">{formatDate(cellInfo.data.expiryDate)}</p>
            {days !== null && (
              <Badge variant={variant} size="sm">
                {days < 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    หมดอายุ {Math.abs(days)} วัน
                  </span>
                ) : (
                  <span>เหลือ {days} วัน</span>
                )}
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
      cellRender: (cellInfo) => {
        const status = cellInfo.data.status;
        const variant = getStatusVariant(status);
        const iconMap: Record<string, React.ReactNode> = {
          quarantine: <Clock className="h-3.5 w-3.5" />,
          released: <CheckCircle className="h-3.5 w-3.5" />,
          rejected: <XCircle className="h-3.5 w-3.5" />,
          blocked: <AlertTriangle className="h-3.5 w-3.5" />,
        };
        return (
          <Badge variant={variant} className="inline-flex items-center gap-1">
            {iconMap[status]}
            {getStatusLabel(status)}
          </Badge>
        );
      },
    },
    {
      caption: '',
      width: 100,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => (
        <div className="flex gap-1">
          {cellInfo.data.status === 'quarantine' && (
            <DxButton
              icon="todo"
              hint="QC Decision"
              type="default"
              stylingMode="text"
              onClick={(e) => {
                e?.event?.stopPropagation();
                setSelectedLot(cellInfo.data);
                setShowQCModal(true);
              }}
            />
          )}
          <DxButton
            icon="find"
            hint="ดู Traceability"
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
      <div className="flex flex-col h-full gap-4">
        {/* Professional Header with Gradient */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Boxes className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Inventory Lots</h1>
                <p className="text-emerald-100">จัดการ Lot/Batch สินค้าคงคลัง</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DxButton
                icon="refresh"
                hint="รีเฟรชข้อมูล"
                type="normal"
                stylingMode="text"
                onClick={() => fetchLots()}
                className="text-white hover:bg-white/20"
              />
              <DxButton
                text="รับ Lot ใหม่"
                icon="plus"
                type="default"
                onClick={() => setShowModal(true)}
                className="bg-white text-emerald-600 hover:bg-emerald-50"
              />
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-white/80" />
                <span className="text-emerald-100 text-sm">Total Lots</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.totalLots.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-white/80" />
                <span className="text-emerald-100 text-sm">Total Qty</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.totalQuantity.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-white/80" />
                <span className="text-emerald-100 text-sm">Total Value</span>
              </div>
              <p className="text-xl font-bold mt-1">{formatCurrency(stats.totalValue)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-white/80" />
                <span className="text-emerald-100 text-sm">Released Value</span>
              </div>
              <p className="text-xl font-bold mt-1">{formatCurrency(stats.releasedValue)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-white/80" />
                <span className="text-emerald-100 text-sm">Avg Expiry</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.avgDaysToExpiry} <span className="text-sm font-normal">วัน</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-300" />
                <span className="text-emerald-100 text-sm">Near Expiry</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-orange-200">{stats.nearExpiryCount}</p>
            </div>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            elevation="raised"
            className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === 'quarantine' ? 'ring-2 ring-yellow-400' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'quarantine' ? '' : 'quarantine')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-200">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">กักกัน</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.quarantineCount}</p>
                  </div>
                </div>
                {stats.quarantineCount > 0 && (
                  <Badge variant="warning" size="sm">รอ QC</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            elevation="raised"
            className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === 'released' ? 'ring-2 ring-green-400' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'released' ? '' : 'released')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">ปล่อยแล้ว</p>
                    <p className="text-2xl font-bold text-green-600">{stats.releasedCount}</p>
                  </div>
                </div>
                <Badge variant="success" size="sm">พร้อมใช้</Badge>
              </div>
            </CardContent>
          </Card>

          <Card
            elevation="raised"
            className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === 'rejected' ? 'ring-2 ring-red-400' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">ปฏิเสธ</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejectedCount}</p>
                  </div>
                </div>
                {stats.rejectedCount > 0 && (
                  <Badge variant="danger" size="sm">ไม่ผ่าน</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            elevation="raised"
            className="cursor-pointer transition-all hover:shadow-lg"
            onClick={() => {
              // Could add expired filter
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">ใกล้หมดอายุ</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.nearExpiryCount}</p>
                  </div>
                </div>
                {stats.expiredCount > 0 && (
                  <Badge variant="danger" size="sm">หมดอายุ {stats.expiredCount}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Grid Card */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                รายการ Lot
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="w-full md:w-72">
                  <DxTextBox
                    placeholder="ค้นหาด้วยเลขที่ Lot หรือสินค้า..."
                    value={search}
                    onValueChange={setSearch}
                    showClearButton
                    mode="search"
                    onEnterKey={() => fetchLots()}
                  />
                </div>
                <DxTabs
                  items={tabItems}
                  selectedIndex={statusTabs.findIndex(t => t.id === statusFilter)}
                  onSelectedIndexChange={(idx) => setStatusFilter(statusTabs[idx]?.id || '')}
                  scrollByContent
                  showNavButtons
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col py-4">
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
                columnChooser
                virtualScrolling={lots.length > 100}
                fillHeight
                onRowClick={handleRowClick}
                noDataText="ไม่พบ Lot"
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-12 w-12" />}
                title="ไม่พบ Lot"
                description="เริ่มต้นด้วยการรับ Lot ใหม่เข้าคลัง หรือลองเปลี่ยนตัวกรอง"
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
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
            <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-emerald-800">รับสินค้าเข้าคลัง</p>
              <p className="text-sm text-emerald-600">สถานะเริ่มต้น: กักกัน (รอ QC)</p>
            </div>
          </div>

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
        width={500}
        height="auto"
      >
        {selectedLot && (
          <div className="p-6">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200 mb-6">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="font-bold text-yellow-800">{selectedLot.lotNumber}</p>
                <p className="text-sm text-yellow-600">รอการตัดสินใจ QC</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-gray-600">สินค้า:</span>
                <span className="font-medium">{selectedLot.itemCode} - {selectedLot.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">จำนวน:</span>
                <span className="font-medium">{selectedLot.quantity?.toLocaleString()} {selectedLot.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">วันหมดอายุ:</span>
                <span className="font-medium">{formatDate(selectedLot.expiryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">มูลค่า:</span>
                <span className="font-medium text-emerald-600">{formatCurrency((selectedLot.quantity || 0) * (selectedLot.cost || 0))}</span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg mb-6 border border-amber-200">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                กรุณาตรวจสอบให้แน่ใจว่าได้ทำการทดสอบ QC เสร็จสิ้นแล้วก่อนตัดสินใจ
              </p>
            </div>

            <div className="flex justify-end gap-3">
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
            {/* Current Lot Info */}
            <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Boxes className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-800">{selectedLot.lotNumber}</h3>
                  <p className="text-sm text-emerald-600">Lot ปัจจุบัน</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">สินค้า:</span>
                  <span className="font-medium">{selectedLot.itemCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">จำนวน:</span>
                  <span className="font-medium">{selectedLot.quantity?.toLocaleString()} {selectedLot.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">สถานะ:</span>
                  <Badge variant={getStatusVariant(selectedLot.status)} size="sm">{getStatusLabel(selectedLot.status)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">หมดอายุ:</span>
                  <span className="font-medium">{formatDate(selectedLot.expiryDate)}</span>
                </div>
              </div>
            </div>

            {/* Backward Trace (Source Lots) */}
            {traceData.backward && traceData.backward.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Source Lots (วัตถุดิบที่ใช้)
                </h3>
                <div className="space-y-2">
                  {traceData.backward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-blue-800">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)} size="sm">{getStatusLabel(lot.status)}</Badge>
                      </div>
                      <div className="text-blue-600 mt-1">
                        {lot.itemCode} - {lot.quantity?.toLocaleString()} {lot.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forward Trace (Destination Lots) */}
            {traceData.forward && traceData.forward.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-800">
                  <ArrowRight className="h-4 w-4" />
                  Destination Lots (ผลิตภัณฑ์ที่ผลิต)
                </h3>
                <div className="space-y-2">
                  {traceData.forward.map((lot: TraceLot, idx: number) => (
                    <div key={idx} className="p-3 bg-purple-50 rounded-lg text-sm border border-purple-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-purple-800">{lot.lotNumber}</span>
                        <Badge variant={getStatusVariant(lot.status)} size="sm">{getStatusLabel(lot.status)}</Badge>
                      </div>
                      <div className="text-purple-600 mt-1">
                        {lot.itemCode} - {lot.quantity?.toLocaleString()} {lot.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!traceData.backward || traceData.backward.length === 0) &&
             (!traceData.forward || traceData.forward.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                <RefreshCcw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>ไม่พบข้อมูล traceability สำหรับ Lot นี้</p>
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t">
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
