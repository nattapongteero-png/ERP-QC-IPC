'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  Package, ArrowRight, BoxSelect, ChevronRight, Inbox,
  Boxes, TrendingUp, CalendarClock, Warehouse,
  DollarSign, RefreshCw, Plus, RefreshCcw
} from 'lucide-react';
import { ItemSearchDialog, type Item as SearchItem } from '@/components/ui/item-search-dialog';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { cn } from '@/lib/utils/cn';

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
  // Phase 4: GMP Compliance fields (FR-055, FR-056)
  manufacturerName: string;
  manufacturerId: number | null;
  importerName: string;
  importerId: number | null;
  countryOfOrigin: string;
  retestDate: string;
  retestIntervalMonths: number | null;
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

type StatusType = '' | 'quarantine' | 'released' | 'rejected' | 'blocked';

const STATUS_CONFIG: Record<StatusType, {
  label: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
}> = {
  '': {
    label: 'All',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    icon: <Boxes className="h-4 w-4" />,
  },
  quarantine: {
    label: 'กักกัน',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    icon: <Clock className="h-4 w-4" />,
  },
  released: {
    label: 'ปล่อยแล้ว',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  rejected: {
    label: 'ปฏิเสธ',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    icon: <XCircle className="h-4 w-4" />,
  },
  blocked: {
    label: 'ล็อค',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

const getStatusLabel = (status: string): string => {
  const config = STATUS_CONFIG[status as StatusType];
  return config ? config.label : status;
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
  const [statusFilter, setStatusFilter] = useState<StatusType>('');
  const [showModal, setShowModal] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [qcLot, setQcLot] = useState<Lot | null>(null);
  const [traceLot, setTraceLot] = useState<Lot | null>(null);
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
    // Phase 4: GMP Compliance fields
    manufacturerName: '',
    manufacturerId: null,
    importerName: '',
    importerId: null,
    countryOfOrigin: '',
    retestDate: '',
    retestIntervalMonths: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Item search dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);

  // Ref to track pending fetch after modal closes (prevents DOM error during popup animation)
  const pendingFetchRef = useRef(false);

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
        // Set flag to fetch lots after popup animation completes (prevents DOM removeChild error)
        pendingFetchRef.current = true;
        setShowModal(false);
        // Note: fetchLots() and resetForm() are called in onHidden callback after popup animation completes
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleQCAction = async (action: 'release' | 'reject') => {
    if (!qcLot) return;

    try {
      const res = await fetch(`/api/inventory/lots/${qcLot.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'release' ? 'released' : 'rejected',
          notes: `QC ${action}d on ${new Date().toISOString()}`
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Close modal and refresh list
        setShowQCModal(false);
        setQcLot(null);
        // Refresh lots list after modal closes
        setTimeout(() => fetchLots(), 100);
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const handleViewTrace = async (lot: Lot) => {
    setTraceLot(lot);
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
      // Phase 4: GMP Compliance fields
      manufacturerName: '',
      manufacturerId: null,
      importerName: '',
      importerId: null,
      countryOfOrigin: '',
      retestDate: '',
      retestIntervalMonths: null,
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

  // Status counts for tabs
  const statusCounts = useMemo(() => ({
    '': lots.length,
    quarantine: stats.quarantineCount,
    released: stats.releasedCount,
    rejected: stats.rejectedCount,
    blocked: lots.filter(l => l.status === 'blocked').length,
  }), [lots, stats]);

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'lotNumber',
      caption: 'เลขที่ Lot',
      width: 160,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <span className={cn('p-1 rounded', STATUS_CONFIG[cellInfo.data.status as StatusType]?.bgColor, STATUS_CONFIG[cellInfo.data.status as StatusType]?.textColor)}>
            {STATUS_CONFIG[cellInfo.data.status as StatusType]?.icon}
          </span>
          <span className="font-mono text-emerald-600 hover:text-emerald-800">{cellInfo.data.lotNumber}</span>
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
          <p className="font-medium text-gray-900">{Number(cellInfo.data.quantity).toLocaleString()} <span className="text-xs text-gray-500 font-normal">{cellInfo.data.unit}</span></p>
          {cellInfo.data.reservedQuantity > 0 && (
            <p className="text-xs text-orange-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> จอง: {Number(cellInfo.data.reservedQuantity).toLocaleString()}
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
        const totalCost = (Number(cellInfo.data.quantity) || 0) * (Number(cellInfo.data.cost) || 0);
        return (
          <div>
            <p className="font-medium text-gray-900">{formatCurrency(totalCost)}</p>
            {cellInfo.data.cost && Number(cellInfo.data.cost) > 0 && (
              <p className="text-xs text-gray-500">@{formatCurrency(Number(cellInfo.data.cost))}/{cellInfo.data.unit}</p>
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
        const config = STATUS_CONFIG[status as StatusType];
        return (
          <Badge variant={variant} className="inline-flex items-center gap-1">
            {config?.icon}
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
                setQcLot(cellInfo.data);
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
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Inventory Lots"
          description="จัดการ Lot/Batch สินค้าคงคลัง"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLots()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                Refresh
              </button>
              <button
                onClick={() => router.push('/inventory/items')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Package className="h-4 w-4" />
                View Items
              </button>
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                รับ Lot ใหม่
              </button>
            </div>
          }
        />

        {/* DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 overflow-x-auto">
                {(Object.keys(STATUS_CONFIG) as StatusType[]).map((status) => {
                  const config = STATUS_CONFIG[status];
                  const count = statusCounts[status];
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                        statusFilter === status
                          ? status === '' ? 'bg-gray-900 text-white' : `${config.bgColor} ${config.textColor}`
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      )}
                    >
                      {config.icon}
                      {config.label}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        statusFilter === status ? (status === '' ? 'bg-gray-700' : 'bg-white/50') : 'bg-gray-200'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4 text-sm">
                {stats.nearExpiryCount > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{stats.nearExpiryCount} Near Expiry</span>
                  </div>
                )}
                {stats.expiredCount > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">{stats.expiredCount} Expired</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-500">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>{stats.totalQuantity.toLocaleString()} units</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span>{formatCurrency(stats.totalValue)}</span>
                </div>
                <div className="text-gray-400">|</div>
                <span className="text-gray-500">{lots.length} lots shown</span>
              </div>
            </div>
          </div>

          {/* Search Row */}
          <div className="px-4 py-2 border-b border-gray-100">
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
          </div>

          {/* DataGrid */}
          <div className="p-4">
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
                height={600}
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
                  onClick: () => { resetForm(); setShowModal(true); },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create Lot Modal */}
      <DxPopup
        visible={showModal}
        onVisibleChange={(v) => { if (!v) setShowModal(false); }}
        onHidden={() => {
          // Fetch lots after popup animation completes if a lot was created
          // Use setTimeout to ensure DevExtreme has fully cleaned up the DOM before triggering React re-renders
          if (pendingFetchRef.current) {
            pendingFetchRef.current = false;
            setTimeout(() => fetchLots(), 0);
          }
        }}
        title="รับ Lot ใหม่"
        width={800}
        height="auto"
        maxHeight="90vh"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
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

          {/* Phase 4: GMP Compliance Fields (FR-055) */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              ข้อมูล GMP Compliance
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ผลิต (Manufacturer)
                </label>
                <DxTextBox
                  value={formData.manufacturerName}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, manufacturerName: v }))}
                  placeholder="ชื่อผู้ผลิต..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้นำเข้า (Importer)
                </label>
                <DxTextBox
                  value={formData.importerName}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, importerName: v }))}
                  placeholder="ชื่อผู้นำเข้า..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเทศต้นกำเนิด
                </label>
                <DxTextBox
                  value={formData.countryOfOrigin}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, countryOfOrigin: v }))}
                  placeholder="ประเทศ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ต้อง Retest
                </label>
                <DxDateBox
                  value={formData.retestDate || ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, retestDate: v }))}
                  min={formData.receivedDate || undefined}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ระยะเวลา Retest (เดือน)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  value={formData.retestIntervalMonths || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    retestIntervalMonths: e.target.value ? parseInt(e.target.value) : null
                  }))}
                  min="1"
                  max="60"
                  placeholder="12"
                />
              </div>
            </div>
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
            <DxButton text="ยกเลิก" type="default" stylingMode="outlined" onClick={() => setShowModal(false)} />
            <DxButton text="รับ Lot" icon="check" type="success" onClick={handleCreateLot} />
          </div>
        </div>
      </DxPopup>

      {/* QC Action Modal */}
      {showQCModal && qcLot && (
        <DxPopup
          visible={showQCModal}
          onVisibleChange={(v) => {
            if (!v) {
              setShowQCModal(false);
              setQcLot(null);
            }
          }}
          title="ตัดสินใจ QC"
          width={500}
          height="auto"
        >
          <div className="p-6">
            <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="font-bold text-yellow-800">{qcLot.lotNumber}</p>
                <p className="text-sm text-yellow-600">รอการตัดสินใจ QC</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-gray-600">สินค้า:</span>
                <span className="font-medium">{qcLot.itemCode} - {qcLot.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">จำนวน:</span>
                <span className="font-medium">{Number(qcLot.quantity)?.toLocaleString()} {qcLot.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">วันหมดอายุ:</span>
                <span className="font-medium">{formatDate(qcLot.expiryDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">มูลค่า:</span>
                <span className="font-medium text-emerald-600">{formatCurrency((Number(qcLot.quantity) || 0) * (Number(qcLot.cost) || 0))}</span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg mb-6 border border-amber-200">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                กรุณาตรวจสอบให้แน่ใจว่าได้ทำการทดสอบ QC เสร็จสิ้นแล้วก่อนตัดสินใจ
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <DxButton text="ยกเลิก" type="default" stylingMode="outlined" onClick={() => setShowQCModal(false)} />
              <DxButton text="ปฏิเสธ" icon="close" type="danger" onClick={() => handleQCAction('reject')} />
              <DxButton text="ปล่อย" icon="check" type="success" onClick={() => handleQCAction('release')} />
            </div>
          </div>
        </DxPopup>
      )}

      {/* Traceability Modal */}
      <DxPopup
        visible={showTraceModal}
        onVisibleChange={(v) => { if (!v) setShowTraceModal(false); }}
        onHidden={() => { setTimeout(() => { setTraceLot(null); setTraceData(null); }, 0); }}
        title="Lot Traceability"
        width={700}
        height="auto"
        maxHeight="90vh"
      >
        {traceLot && traceData && (
          <div className="p-6">
            {/* Current Lot Info */}
            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Boxes className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-800">{traceLot.lotNumber}</h3>
                  <p className="text-sm text-emerald-600">Lot ปัจจุบัน</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">สินค้า:</span>
                  <span className="font-medium">{traceLot.itemCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">จำนวน:</span>
                  <span className="font-medium">{Number(traceLot.quantity)?.toLocaleString()} {traceLot.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">สถานะ:</span>
                  <Badge variant={getStatusVariant(traceLot.status)} size="sm">{getStatusLabel(traceLot.status)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">หมดอายุ:</span>
                  <span className="font-medium">{formatDate(traceLot.expiryDate)}</span>
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
              <DxButton text="ปิด" type="default" stylingMode="outlined" onClick={() => setShowTraceModal(false)} />
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
