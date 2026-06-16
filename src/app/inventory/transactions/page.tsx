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
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  RefreshCw,
  Trash2,
  RotateCcw,
  Boxes,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Warehouse,
  SearchX,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/number-format';

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

// Config now holds only style/icon — labels come from translations at render
// time via `t(\`transactions.types.${translationKey}\`)`.
const TYPE_CONFIG: Record<TransactionTypeFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gradient-to-br from-[#064E3B] to-emerald-600',
    textColor: 'text-white',
    icon: <Boxes className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  RECEIVE: {
    translationKey: 'receive',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    icon: <ArrowDownCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  ISSUE: {
    translationKey: 'issue',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    icon: <ArrowUpCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
  TRANSFER: {
    translationKey: 'transfer',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  ADJUST: {
    translationKey: 'adjust',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    icon: <RefreshCw className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  SCRAP: {
    translationKey: 'scrap',
    bgColor: 'bg-gray-600',
    textColor: 'text-white',
    icon: <Trash2 className="h-4 w-4" />,
    badgeVariant: 'secondary',
  },
  RETURN: {
    translationKey: 'return',
    bgColor: 'bg-purple-600',
    textColor: 'text-white',
    icon: <RotateCcw className="h-4 w-4" />,
    badgeVariant: 'primary',
  },
};

// Static value list; labels are translated at render time via t().
const REFERENCE_TYPE_VALUES: Array<{ value: string; translationKey: string }> = [
  { value: '', translationKey: 'none' },
  { value: 'PO', translationKey: 'purchaseOrder' },
  { value: 'SO', translationKey: 'salesOrder' },
  { value: 'WO', translationKey: 'workOrder' },
  { value: 'QC', translationKey: 'qcRelease' },
  { value: 'ADJ', translationKey: 'adjustment' },
];

// next-intl's Translator expects specific value types; accept a superset-compatible shape.
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

export default function TransactionsPage() {
  const router = useRouter();
  const t = useTranslations('inventory');
  const { isMobile } = useMobile();
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

  // Filter transactions + tag with display row number (mirrors /inventory/items).
  const filteredTransactions = allTransactions
    .filter(txn => {
      if (typeFilter && normalizeType(txn.type) !== typeFilter) return false;
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
    })
    .map((txn, index) => ({ ...txn, _rowNumber: index + 1 }));

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
    .reduce((sum, t) => sum + Math.abs(Number(t.quantity || 0)), 0);
  const todayCount = allTransactions.filter(t => {
    const txnDate = new Date(t.createdAt).toDateString();
    return txnDate === new Date().toDateString();
  }).length;

  const handleSave = async () => {
    if (!formData.lotId || !formData.quantity) {
      alert(t('transactions.form.alertSelectLotAndQty'));
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
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cellInfo) => (
        <span className="text-gray-500 text-sm font-medium">
          {cellInfo.data._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'transactionNumber',
      caption: t('transactions.table.columns.transactionNumber'),
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
      caption: t('transactions.table.columns.type'),
      width: 120,
      cellRender: (cellInfo) => {
        const txnType = normalizeType(cellInfo.data.type) as TransactionTypeFilter;
        const config = TYPE_CONFIG[txnType];
        return (
          <Badge variant={config?.badgeVariant || 'default'}>
            {config ? t(`transactions.types.${config.translationKey}`) : cellInfo.data.type}
          </Badge>
        );
      },
    },
    {
      dataField: 'lotNumber',
      caption: t('transactions.table.columns.lotItem'),
      minWidth: 200,
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
      caption: t('transactions.table.columns.quantity'),
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
              {formatNumber(Math.abs(Number(cellInfo.data.quantity)))} {cellInfo.data.unit}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'warehouse',
      caption: t('transactions.table.columns.warehouse'),
      minWidth: 180,
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
                <span className="mx-1 text-blue-500">&rarr;</span>
                {cellInfo.data.toWarehouseName || '-'}
              </span>
            ) : isIncoming ? (
              <span className="text-emerald-600">
                &rarr; {cellInfo.data.toWarehouseName || '-'}
              </span>
            ) : (
              <span className="text-red-600">
                {cellInfo.data.fromWarehouseName || '-'} &rarr;
              </span>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'referenceType',
      caption: t('transactions.table.columns.reference'),
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
      caption: t('transactions.table.columns.dateBy'),
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
    { value: '', label: t('transactions.form.selectLotPlaceholder') },
    ...lots.map(l => ({
      value: l.id.toString(),
      label: `${l.lotNumber} - ${l.itemCode} (${l.quantity} ${l.unit})`
    }))
  ];

  const warehouseOptions = [
    { value: '', label: t('transactions.form.selectWarehousePlaceholder') },
    ...warehouses.map(w => ({ value: w.id.toString(), label: `${w.code} - ${w.name}` }))
  ];

  const transactionTypeOptions = Object.entries(TYPE_CONFIG)
    .filter(([key]) => key !== '')
    .map(([value, config]) => ({
      value,
      label: t(`transactions.types.${config.translationKey}`),
    }));

  const referenceTypes = REFERENCE_TYPE_VALUES.map(({ value, translationKey }) => ({
    value,
    label: t(`transactions.refTypes.${translationKey}`),
  }));

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        {/* Responsive Page Header */}
        <ResponsivePageHeader
          title={t('transactions.pageTitle')}
          subtitle={t('transactions.description')}
          icon={ArrowLeftRight}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text={t('transactions.actions.refresh')}
                stylingMode="outlined"
                onClick={fetchTransactions}
                className="hidden sm:inline-flex"
              />
              <DxButton
                icon="box"
                text={t('transactions.actions.viewLots')}
                stylingMode="outlined"
                onClick={() => router.push('/inventory/lots')}
                className="hidden md:inline-flex"
              />
              <DxButton
                text={t('transactions.actions.newTransaction')}
                icon="plus"
                type="success"
                onClick={() => { resetForm(); setShowModal(true); }}
              />
            </div>
          }
        />

        {/* KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label={t('transactions.stats.total')}
            value={allTransactions.length}
            icon={Boxes}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label={t('transactions.stats.incoming')}
            value={`+${formatNumber(totalIncoming)}`}
            icon={TrendingUp}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label={t('transactions.stats.outgoing')}
            value={`-${formatNumber(totalOutgoing)}`}
            icon={TrendingDown}
            iconColor="text-red-500"
            accentColor="border-red-500"
          />
          <StatCard
            label={t('transactions.stats.today')}
            value={todayCount}
            icon={Calendar}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
        </div>

        {/* DataGrid Card */}
        <div className="bg-white border border-emerald-100 rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] overflow-hidden">
          {/* Filter Header: Type Tabs */}
          <div className="px-3 py-3 sm:px-4 border-b border-emerald-50 bg-gradient-to-b from-[#FBFEFC] to-[#F6FCF9]">
            <div className="flex items-center gap-1 p-1 bg-[#F1FAF5] border border-emerald-100 rounded-xl overflow-x-auto scrollbar-thin snap-x">
              {(Object.keys(TYPE_CONFIG) as TransactionTypeFilter[]).map((type) => {
                const config = TYPE_CONFIG[type];
                const count = typeCounts[type];
                const isActive = typeFilter === type;

                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                      isActive
                        ? `${config.bgColor} ${config.textColor} shadow-sm`
                        : `text-[#4B7163] hover:text-[#064E3B] hover:bg-[#E6F6EE]`
                    )}
                  >
                    {config.icon}
                    <span>{t(`transactions.types.${config.translationKey}`)}</span>
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Date Filter Row */}
          <div className="px-3 py-3 sm:px-4 border-b border-emerald-50">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 w-full sm:max-w-md">
                <DxTextBox
                  placeholder={t('transactions.search.placeholder')}
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="w-full sm:w-40">
                  <DxDateBox
                    value={dateFrom}
                    onValueChange={(value) => setDateFrom(value || '')}
                    placeholder={t('transactions.search.fromDate')}
                  />
                </div>
                <span className="text-gray-400 text-center hidden sm:block">-</span>
                <div className="w-full sm:w-40">
                  <DxDateBox
                    value={dateTo}
                    onValueChange={(value) => setDateTo(value || '')}
                    placeholder={t('transactions.search.toDate')}
                  />
                </div>
                <DxButton
                  icon="filter"
                  text={t('transactions.actions.apply')}
                  stylingMode="outlined"
                  onClick={fetchTransactions}
                />
              </div>
            </div>
          </div>

          {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
          {isLoading ? (
            isMobile ? (
              <TransactionCardSkeletonList count={4} />
            ) : (
              <DataGridLoadingSkeleton />
            )
          ) : allTransactions.length === 0 ? (
            <EmptyState
              onCreateNew={() => { resetForm(); setShowModal(true); }}
              t={t}
            />
          ) : filteredTransactions.length === 0 ? (
            <NoResultsState
              onClear={() => {
                setSearch('');
                setTypeFilter('');
              }}
              t={t}
            />
          ) : isMobile ? (
            <TransactionMobileList
              transactions={filteredTransactions}
              formatDate={formatDate}
              normalizeType={normalizeType}
              t={t}
            />
          ) : (
            <DxDataGrid
              dataSource={filteredTransactions}
              keyExpr="id"
              columns={columns}
              sorting
              pageSize={20}
              height="auto"
              noDataText={t('transactions.noDataText')}
            />
          )}
        </div>
      </div>

      {/* Create Transaction Modal */}
      <DxPopup
        visible={showModal}
        onHiding={() => { setShowModal(false); resetForm(); }}
        title={t('transactions.form.title')}
        width={520}
        height="auto"
        showCloseButton
        fullScreenOnMobile
        maxWidth="95vw"
      >
        <div className="p-4 space-y-4">
          {/* Transaction Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('transactions.form.transactionType')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
              {t('transactions.form.selectLot')} <span className="text-red-500">*</span>
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
              <div className="mt-2 p-3 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-lg border border-emerald-200/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-emerald-600">{t('transactions.form.lotInfo.item')}</span>
                    <p className="font-medium text-emerald-900">{selectedLot.itemName}</p>
                  </div>
                  <div>
                    <span className="text-emerald-600">{t('transactions.form.lotInfo.available')}</span>
                    <p className="font-medium text-emerald-900">{selectedLot.quantity} {selectedLot.unit}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-emerald-600">{t('transactions.form.lotInfo.warehouse')}</span>
                    <p className="font-medium text-emerald-900">{selectedLot.warehouseName}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.form.quantity')} <span className="text-red-500">*</span>
            </label>
            <DxNumberBox
              value={formData.quantity}
              onValueChange={(value) => setFormData(prev => ({ ...prev, quantity: value || 0 }))}
              min={0}
              step={0.01}
            />
            {selectedLot && ['ISSUE', 'TRANSFER', 'SCRAP'].includes(formData.type) && (
              <p className="text-xs text-amber-600 mt-1">
                {t('transactions.form.maxAvailable', {
                  qty: selectedLot.quantity,
                  unit: selectedLot.unit,
                })}
              </p>
            )}
          </div>

          {/* To Warehouse for Transfer/Receive/Return */}
          {(formData.type === 'TRANSFER' || ['RECEIVE', 'RETURN'].includes(formData.type)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('transactions.form.toWarehouse')} {formData.type === 'TRANSFER' && <span className="text-red-500">*</span>}
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('transactions.form.referenceSection')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('transactions.form.referenceType')}</label>
                <DxSelectBox
                  items={referenceTypes}
                  value={formData.referenceType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, referenceType: value }))}
                  valueExpr="value"
                  displayExpr="label"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('transactions.form.referenceNumber')}</label>
                <DxTextBox
                  value={formData.referenceNumber}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, referenceNumber: value }))}
                  placeholder={t('transactions.form.referencePlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('transactions.form.notes')}
            </label>
            <DxTextArea
              value={formData.notes}
              onValueChange={(value) => setFormData(prev => ({ ...prev, notes: value }))}
              placeholder={t('transactions.form.notesPlaceholder')}
              height={80}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text={t('transactions.actions.cancel')}
              type="normal"
              stylingMode="outlined"
              onClick={() => { setShowModal(false); resetForm(); }}
            />
            <DxButton
              text={t('transactions.actions.create')}
              type="success"
              onClick={handleSave}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List -- replaces DataGrid on mobile viewports.
 * Each card shows: transaction number + type badge, lot/item, quantity, warehouse, date.
 */
function TransactionMobileList({
  transactions,
  formatDate,
  normalizeType,
  t,
}: {
  transactions: Transaction[];
  formatDate: (dateStr: string) => string;
  normalizeType: (type: string) => string;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {transactions.map((txn) => {
        const txnType = normalizeType(txn.type) as TransactionTypeFilter;
        const config = TYPE_CONFIG[txnType];
        const isIncoming = ['RECEIVE', 'RETURN'].includes(txnType);
        const isOutgoing = ['ISSUE', 'SCRAP'].includes(txnType);
        const isTransfer = txnType === 'TRANSFER';

        return (
          <div
            key={txn.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            <div className="p-4 space-y-2.5">
              {/* Row 1: Type icon + Transaction number + Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
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
                  <span className="font-mono font-semibold text-gray-900 text-sm truncate">
                    {txn.transactionNumber}
                  </span>
                </div>
                <Badge variant={config?.badgeVariant || 'default'}>
                  {config ? t(`transactions.types.${config.translationKey}`) : txn.type}
                </Badge>
              </div>

              {/* Row 2: Lot + Item info */}
              <div className="pl-[46px]">
                <p className="text-sm text-gray-700">
                  <span className="text-gray-500">{t('transactions.mobile.lotPrefix')}</span>{' '}
                  <span className="font-medium">{txn.lotNumber}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {txn.itemName} ({txn.itemCode})
                </p>
              </div>

              {/* Row 3: Quantity + Warehouse */}
              <div className="pl-[46px] flex items-center justify-between gap-2">
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold',
                  isIncoming ? 'bg-emerald-50 text-emerald-700' :
                  isOutgoing ? 'bg-red-50 text-red-700' :
                  'bg-gray-50 text-gray-700'
                )}>
                  {isIncoming && <TrendingUp className="h-3.5 w-3.5" />}
                  {isOutgoing && <TrendingDown className="h-3.5 w-3.5" />}
                  <span>
                    {isIncoming ? '+' : isOutgoing ? '-' : ''}
                    {formatNumber(Math.abs(Number(txn.quantity)))} {txn.unit}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Warehouse className="h-3 w-3 text-gray-400" />
                  {isTransfer ? (
                    <span>
                      {txn.fromWarehouseName || '-'}
                      <span className="mx-0.5 text-blue-500">&rarr;</span>
                      {txn.toWarehouseName || '-'}
                    </span>
                  ) : isIncoming ? (
                    <span className="text-emerald-600">&rarr; {txn.toWarehouseName || '-'}</span>
                  ) : (
                    <span className="text-red-600">{txn.fromWarehouseName || '-'} &rarr;</span>
                  )}
                </div>
              </div>

              {/* Row 4: Date + Created By */}
              <div className="pl-[46px] flex items-center justify-between gap-2 text-xs text-gray-400 pt-1 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(txn.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{txn.createdByName}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function TransactionCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
              </div>
              <div className="h-3 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex justify-between pt-1">
                <div className="h-6 w-20 bg-gray-200 rounded-md" />
                <div className="h-3 w-24 bg-gray-200 rounded" />
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-100">
                <div className="h-3 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid area */
function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty State -- shown when there are zero transactions at all */
function EmptyState({ onCreateNew, t }: { onCreateNew: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
        <ArrowLeftRight className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('transactions.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('transactions.empty.description')}
      </p>
      <DxButton
        text={t('transactions.actions.newTransaction')}
        icon="plus"
        type="success"
        onClick={onCreateNew}
      />
    </div>
  );
}

/** No Results State -- shown when filter/search yields zero results but transactions exist */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('transactions.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('transactions.noResults.description')}
      </p>
      <DxButton
        text={t('common.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}
