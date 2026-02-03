'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  RefreshCw,
  Trash2,
  RotateCcw,
  Package,
  Boxes,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Transaction {
  id: number;
  transactionNumber: string;
  type: string;
  lotId: number;
  lotNumber: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  fromWarehouseName: string | null;
  toWarehouseName: string | null;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
}

interface Lot {
  id: number;
  lotNumber: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  warehouseId: number;
  warehouseName: string;
}

interface WarehouseData {
  id: number;
  code: string;
  name: string;
}

interface FormData {
  type: string;
  lotId: number | null;
  quantity: number;
  fromWarehouseId: number | null;
  toWarehouseId: number | null;
  referenceType: string;
  referenceNumber: string;
  notes: string;
}

// Type configuration for tabs
type TransactionTypeFilter = '' | 'RECEIVE' | 'ISSUE' | 'TRANSFER' | 'ADJUST' | 'SCRAP' | 'RETURN';

const TYPE_CONFIG: Record<TransactionTypeFilter, {
  label: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    label: 'All',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    icon: <Boxes className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  RECEIVE: {
    label: 'Receive',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    icon: <ArrowDownCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  ISSUE: {
    label: 'Issue',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    icon: <ArrowUpCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
  TRANSFER: {
    label: 'Transfer',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  ADJUST: {
    label: 'Adjust',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    icon: <RefreshCw className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  SCRAP: {
    label: 'Scrap',
    bgColor: 'bg-gray-600',
    textColor: 'text-white',
    icon: <Trash2 className="h-4 w-4" />,
    badgeVariant: 'secondary',
  },
  RETURN: {
    label: 'Return',
    bgColor: 'bg-purple-600',
    textColor: 'text-white',
    icon: <RotateCcw className="h-4 w-4" />,
    badgeVariant: 'primary',
  },
};

const referenceTypes = [
  { value: '', label: 'None' },
  { value: 'PO', label: 'Purchase Order' },
  { value: 'SO', label: 'Sales Order' },
  { value: 'WO', label: 'Work Order' },
  { value: 'QC', label: 'QC Release' },
  { value: 'ADJ', label: 'Adjustment' },
];

export default function TransactionsPage() {
  const router = useRouter();
  const t = useTranslations('inventory');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [formData, setFormData] = useState<FormData>({
    type: 'RECEIVE',
    lotId: null,
    quantity: 0,
    fromWarehouseId: null,
    toWarehouseId: null,
    referenceType: '',
    referenceNumber: '',
    notes: '',
  });

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/inventory/transactions?${params}`);
      const data = await res.json();

      if (data.success) {
        const txns = data.data?.items || [];
        setAllTransactions(txns);
        setTransactions(txns);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchLots = async () => {
    try {
      const res = await fetch('/api/inventory/lots?limit=1000&status=released');
      const data = await res.json();
      if (data.success) {
        setLots(data.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch lots:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses?limit=100');
      const data = await res.json();
      if (data.success) {
        setWarehouses(data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchLots();
    fetchWarehouses();
  }, [fetchTransactions]);

  // Helper function to normalize type for comparison (handle both upper and lower case)
  const normalizeType = (type: string) => type?.toUpperCase() || '';

  // Filter transactions based on type and search
  const filteredTransactions = allTransactions.filter(txn => {
    // Type filter (case-insensitive)
    if (typeFilter && normalizeType(txn.type) !== typeFilter) {
      return false;
    }
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        txn.transactionNumber?.toLowerCase().includes(searchLower) ||
        txn.lotNumber?.toLowerCase().includes(searchLower) ||
        txn.itemCode?.toLowerCase().includes(searchLower) ||
        txn.itemName?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Calculate counts for tabs (case-insensitive)
  const typeCounts: Record<TransactionTypeFilter, number> = {
    '': allTransactions.length,
    RECEIVE: allTransactions.filter(t => normalizeType(t.type) === 'RECEIVE').length,
    ISSUE: allTransactions.filter(t => normalizeType(t.type) === 'ISSUE').length,
    TRANSFER: allTransactions.filter(t => normalizeType(t.type) === 'TRANSFER').length,
    ADJUST: allTransactions.filter(t => normalizeType(t.type) === 'ADJUST').length,
    SCRAP: allTransactions.filter(t => normalizeType(t.type) === 'SCRAP').length,
    RETURN: allTransactions.filter(t => normalizeType(t.type) === 'RETURN').length,
  };

  // Calculate summary stats (case-insensitive)
  const totalIncoming = allTransactions
    .filter(t => ['RECEIVE', 'RETURN'].includes(normalizeType(t.type)))
    .reduce((sum, t) => sum + Number(t.quantity || 0), 0);
  const totalOutgoing = allTransactions
    .filter(t => ['ISSUE', 'SCRAP'].includes(normalizeType(t.type)))
    .reduce((sum, t) => sum + Number(t.quantity || 0), 0);
  const todayCount = allTransactions.filter(t => {
    const txnDate = new Date(t.createdAt).toDateString();
    return txnDate === new Date().toDateString();
  }).length;

  const handleSave = async () => {
    if (!formData.lotId || !formData.quantity) {
      alert('Please select a lot and enter quantity');
      return;
    }

    try {
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        resetForm();
        fetchTransactions();
        fetchLots();
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'RECEIVE',
      lotId: null,
      quantity: 0,
      fromWarehouseId: null,
      toWarehouseId: null,
      referenceType: '',
      referenceNumber: '',
      notes: '',
    });
    setSelectedLot(null);
  };

  const handleLotSelect = (lotId: number) => {
    const lot = lots.find(l => l.id === lotId);
    setSelectedLot(lot || null);
    setFormData(prev => ({
      ...prev,
      lotId,
      fromWarehouseId: lot?.warehouseId || null,
    }));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'transactionNumber',
      caption: 'Transaction #',
      width: 180,
      cellRender: (cellInfo) => {
        const txnType = normalizeType(cellInfo.data.type) as TransactionTypeFilter;
        const config = TYPE_CONFIG[txnType];
        return (
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center',
              txnType === 'RECEIVE' ? 'bg-emerald-100' :
              txnType === 'ISSUE' ? 'bg-red-100' :
              txnType === 'TRANSFER' ? 'bg-blue-100' :
              txnType === 'ADJUST' ? 'bg-amber-100' :
              txnType === 'SCRAP' ? 'bg-gray-100' :
              txnType === 'RETURN' ? 'bg-purple-100' :
              'bg-gray-100'
            )}>
              <span className={cn(
                txnType === 'RECEIVE' ? 'text-emerald-600' :
                txnType === 'ISSUE' ? 'text-red-600' :
                txnType === 'TRANSFER' ? 'text-blue-600' :
                txnType === 'ADJUST' ? 'text-amber-600' :
                txnType === 'SCRAP' ? 'text-gray-600' :
                txnType === 'RETURN' ? 'text-purple-600' :
                'text-gray-600'
              )}>
                {config?.icon}
              </span>
            </div>
            <span className="font-mono font-semibold text-gray-900">{cellInfo.data.transactionNumber}</span>
          </div>
        );
      },
    },
    {
      dataField: 'type',
      caption: 'Type',
      width: 120,
      cellRender: (cellInfo) => {
        const txnType = normalizeType(cellInfo.data.type) as TransactionTypeFilter;
        const config = TYPE_CONFIG[txnType];
        return (
          <Badge variant={config?.badgeVariant || 'default'}>
            {config?.label || cellInfo.data.type}
          </Badge>
        );
      },
    },
    {
      dataField: 'lotNumber',
      caption: 'Lot / Item',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium text-gray-900">{cellInfo.data.lotNumber}</p>
          <p className="text-xs text-gray-500">
            {cellInfo.data.itemCode} - {cellInfo.data.itemName}
          </p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 140,
      cellRender: (cellInfo) => {
        const txnType = normalizeType(cellInfo.data.type);
        const isIncoming = ['RECEIVE', 'RETURN'].includes(txnType);
        const isOutgoing = ['ISSUE', 'SCRAP'].includes(txnType);
        return (
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md font-medium',
            isIncoming ? 'bg-emerald-50 text-emerald-700' :
            isOutgoing ? 'bg-red-50 text-red-700' :
            'text-gray-700'
          )}>
            {isIncoming && <TrendingUp className="h-3.5 w-3.5" />}
            {isOutgoing && <TrendingDown className="h-3.5 w-3.5" />}
            <span>
              {isIncoming ? '+' : isOutgoing ? '-' : ''}
              {Number(cellInfo.data.quantity).toLocaleString()} {cellInfo.data.unit}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'warehouse',
      caption: 'Warehouse',
      width: 220,
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const txnType = normalizeType(cellInfo.data.type);
        const isTransfer = txnType === 'TRANSFER';
        const isIncoming = ['RECEIVE', 'RETURN'].includes(txnType);
        return (
          <div className="flex items-center gap-1.5 text-sm">
            <Warehouse className="h-3.5 w-3.5 text-gray-400" />
            {isTransfer ? (
              <span className="text-gray-600">
                {cellInfo.data.fromWarehouseName || '-'}
                <span className="mx-1 text-blue-500">→</span>
                {cellInfo.data.toWarehouseName || '-'}
              </span>
            ) : isIncoming ? (
              <span className="text-emerald-600">
                → {cellInfo.data.toWarehouseName || '-'}
              </span>
            ) : (
              <span className="text-red-600">
                {cellInfo.data.fromWarehouseName || '-'} →
              </span>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'referenceType',
      caption: 'Reference',
      width: 130,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        cellInfo.data.referenceType ? (
          <span className="text-sm px-2 py-0.5 bg-gray-100 rounded text-gray-600">
            {cellInfo.data.referenceType}: {cellInfo.data.referenceId || '-'}
          </span>
        ) : <span className="text-gray-400">-</span>
      ),
    },
    {
      dataField: 'createdAt',
      caption: 'Date / By',
      width: 180,
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <div className="text-sm">
          <div className="flex items-center gap-1 text-gray-700">
            <Calendar className="h-3 w-3 text-gray-400" />
            {formatDate(cellInfo.data.createdAt)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <User className="h-3 w-3" />
            {cellInfo.data.createdByName}
          </div>
        </div>
      ),
    },
  ];

  const lotOptions = [
    { value: '', label: 'Select a lot...' },
    ...lots.map(l => ({
      value: l.id.toString(),
      label: `${l.lotNumber} - ${l.itemCode} (${l.quantity} ${l.unit})`
    }))
  ];

  const warehouseOptions = [
    { value: '', label: 'Select warehouse...' },
    ...warehouses.map(w => ({ value: w.id.toString(), label: `${w.code} - ${w.name}` }))
  ];

  const transactionTypeOptions = Object.entries(TYPE_CONFIG)
    .filter(([key]) => key !== '')
    .map(([value, config]) => ({ value, label: config.label }));

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title={t('transactions.pageTitle')}
          description={t('transactions.description')}
          actions={
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                text="Refresh"
                stylingMode="outlined"
                onClick={fetchTransactions}
              />
              <DxButton
                icon="box"
                text="View Lots"
                stylingMode="outlined"
                onClick={() => router.push('/inventory/lots')}
              />
              <DxButton
                text="New Transaction"
                icon="plus"
                type="success"
                onClick={() => { resetForm(); setShowModal(true); }}
              />
            </div>
          }
        />

        {/* DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Type Tabs */}
              <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto">
                {(Object.keys(TYPE_CONFIG) as TransactionTypeFilter[]).map((type) => {
                  const config = TYPE_CONFIG[type];
                  const count = typeCounts[type];
                  const isActive = typeFilter === type;

                  return (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                        isActive
                          ? `${config.bgColor} ${config.textColor}`
                          : `text-gray-600 hover:bg-gray-100`
                      )}
                    >
                      {config.icon}
                      <span>{config.label}</span>
                      <span className={cn(
                        'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                        isActive
                          ? 'bg-white/20 text-inherit'
                          : 'bg-gray-200 text-gray-600'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">
                    +{totalIncoming.toLocaleString()} In
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-red-600 font-medium">
                    -{totalOutgoing.toLocaleString()} Out
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span className="text-blue-600">{todayCount} Today</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{filteredTransactions.length} transactions shown</span>
              </div>
            </div>
          </div>

          {/* Search + Date Filter Row */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 max-w-md">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ Transaction, Lot, Item..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-40">
                  <DxDateBox
                    value={dateFrom}
                    onValueChange={(value) => setDateFrom(value || '')}
                    placeholder="From Date"
                  />
                </div>
                <span className="text-gray-400">-</span>
                <div className="w-40">
                  <DxDateBox
                    value={dateTo}
                    onValueChange={(value) => setDateTo(value || '')}
                    placeholder="To Date"
                  />
                </div>
                <DxButton
                  icon="filter"
                  text="Apply"
                  stylingMode="outlined"
                  onClick={fetchTransactions}
                />
              </div>
            </div>
          </div>

          {/* DataGrid */}
          <DxDataGrid
            dataSource={filteredTransactions}
            keyExpr="id"
            columns={columns}
            loading={isLoading}
            sorting
            filterRow
            headerFilter
            export
            exportFileName="inventory-transactions"
            columnChooser
            virtualScrolling={filteredTransactions.length > 100}
            height={600}
            noDataText="ไม่พบรายการเคลื่อนไหว"
          />
        </div>
      </div>

      {/* Create Transaction Modal */}
      <DxPopup
        visible={showModal}
        onHiding={() => { setShowModal(false); resetForm(); }}
        title="New Transaction"
        width={520}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {/* Transaction Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {transactionTypeOptions.map((opt) => {
                const config = TYPE_CONFIG[opt.value as TransactionTypeFilter];
                const isSelected = formData.type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: opt.value }))}
                    className={cn(
                      'flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium',
                      isSelected
                        ? `${config.bgColor} ${config.textColor} border-transparent`
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {config.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lot Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Lot <span className="text-red-500">*</span>
            </label>
            <DxSelectBox
              items={lotOptions}
              value={formData.lotId?.toString() || ''}
              onValueChange={(value) => handleLotSelect(parseInt(value))}
              valueExpr="value"
              displayExpr="label"
              searchEnabled
            />
            {selectedLot && (
              <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border border-blue-200/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600">Item:</span>
                    <p className="font-medium text-blue-900">{selectedLot.itemName}</p>
                  </div>
                  <div>
                    <span className="text-blue-600">Available:</span>
                    <p className="font-medium text-blue-900">{selectedLot.quantity} {selectedLot.unit}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-blue-600">Warehouse:</span>
                    <p className="font-medium text-blue-900">{selectedLot.warehouseName}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <DxNumberBox
              value={formData.quantity}
              onValueChange={(value) => setFormData(prev => ({ ...prev, quantity: value || 0 }))}
              min={0}
              step={0.01}
            />
            {selectedLot && ['ISSUE', 'TRANSFER', 'SCRAP'].includes(formData.type) && (
              <p className="text-xs text-amber-600 mt-1">
                Max available: {selectedLot.quantity} {selectedLot.unit}
              </p>
            )}
          </div>

          {/* To Warehouse for Transfer/Receive/Return */}
          {(formData.type === 'TRANSFER' || ['RECEIVE', 'RETURN'].includes(formData.type)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Warehouse {formData.type === 'TRANSFER' && <span className="text-red-500">*</span>}
              </label>
              <DxSelectBox
                items={warehouseOptions}
                value={formData.toWarehouseId?.toString() || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, toWarehouseId: parseInt(value) }))}
                valueExpr="value"
                displayExpr="label"
              />
            </div>
          )}

          {/* Reference Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Reference (Optional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reference Type</label>
                <DxSelectBox
                  items={referenceTypes}
                  value={formData.referenceType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, referenceType: value }))}
                  valueExpr="value"
                  displayExpr="label"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reference Number</label>
                <DxTextBox
                  value={formData.referenceNumber}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, referenceNumber: value }))}
                  placeholder="PO-2024-001"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <DxTextArea
              value={formData.notes}
              onValueChange={(value) => setFormData(prev => ({ ...prev, notes: value }))}
              placeholder="Additional notes..."
              height={80}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => { setShowModal(false); resetForm(); }}
            />
            <DxButton
              text="Create Transaction"
              type="success"
              onClick={handleSave}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}
