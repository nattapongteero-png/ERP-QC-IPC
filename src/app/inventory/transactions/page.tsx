'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import {
  Plus, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  RefreshCw, Trash2, RotateCcw, Package
} from 'lucide-react';

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

interface Warehouse {
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

const transactionTypes = [
  { value: '', label: 'All Types' },
  { value: 'RECEIVE', label: 'Receive' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'ADJUST', label: 'Adjustment' },
  { value: 'SCRAP', label: 'Scrap' },
  { value: 'RETURN', label: 'Return' },
];

const referenceTypes = [
  { value: '', label: 'None' },
  { value: 'PO', label: 'Purchase Order' },
  { value: 'SO', label: 'Sales Order' },
  { value: 'WO', label: 'Work Order' },
  { value: 'QC', label: 'QC Release' },
  { value: 'ADJ', label: 'Adjustment' },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'RECEIVE': return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
    case 'ISSUE': return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
    case 'TRANSFER': return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
    case 'ADJUST': return <RefreshCw className="h-4 w-4 text-orange-600" />;
    case 'SCRAP': return <Trash2 className="h-4 w-4 text-gray-600" />;
    case 'RETURN': return <RotateCcw className="h-4 w-4 text-purple-600" />;
    default: return <Package className="h-4 w-4 text-gray-600" />;
  }
};

const getTypeVariant = (type: string): 'primary' | 'danger' | 'secondary' | 'default' => {
  switch (type) {
    case 'RECEIVE': return 'primary';
    case 'ISSUE': return 'danger';
    case 'TRANSFER': return 'secondary';
    case 'ADJUST': return 'secondary';
    case 'SCRAP': return 'danger';
    case 'RETURN': return 'secondary';
    default: return 'default';
  }
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
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
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/inventory/transactions?${params}`);
      const data = await res.json();

      if (data.success) {
        setTransactions(data.data?.items || []);
        setPagination((prev) => ({ ...prev, total: data.data?.total || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [pagination.page, typeFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchTransactions();
  };

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
      width: 150,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          {getTypeIcon(cellInfo.data.type)}
          <span className="font-mono text-sm">{cellInfo.data.transactionNumber}</span>
        </div>
      ),
    },
    {
      dataField: 'type',
      caption: 'Type',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getTypeVariant(cellInfo.data.type)}>
          {cellInfo.data.type}
        </Badge>
      ),
    },
    {
      dataField: 'lotNumber',
      caption: 'Lot / Item',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.lotNumber}</p>
          <p className="text-xs text-gray-500">{cellInfo.data.itemCode} - {cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 120,
      cellRender: (cellInfo) => (
        <span className={`font-medium ${
          ['RECEIVE', 'RETURN'].includes(cellInfo.data.type) ? 'text-green-600' :
          ['ISSUE', 'SCRAP'].includes(cellInfo.data.type) ? 'text-red-600' : ''
        }`}>
          {['RECEIVE', 'RETURN'].includes(cellInfo.data.type) ? '+' :
           ['ISSUE', 'SCRAP'].includes(cellInfo.data.type) ? '-' : ''}
          {cellInfo.data.quantity.toLocaleString()} {cellInfo.data.unit}
        </span>
      ),
    },
    {
      dataField: 'warehouse',
      caption: 'Warehouse',
      width: 200,
      cellRender: (cellInfo) => (
        <div className="text-sm">
          {cellInfo.data.type === 'TRANSFER' ? (
            <span>
              {cellInfo.data.fromWarehouseName || '-'} → {cellInfo.data.toWarehouseName || '-'}
            </span>
          ) : cellInfo.data.type === 'RECEIVE' || cellInfo.data.type === 'RETURN' ? (
            <span>→ {cellInfo.data.toWarehouseName || '-'}</span>
          ) : (
            <span>{cellInfo.data.fromWarehouseName || '-'} →</span>
          )}
        </div>
      ),
    },
    {
      dataField: 'referenceType',
      caption: 'Reference',
      width: 120,
      cellRender: (cellInfo) => (
        cellInfo.data.referenceType ? (
          <span className="text-sm text-gray-600">
            {cellInfo.data.referenceType}: {cellInfo.data.referenceId || '-'}
          </span>
        ) : <span>-</span>
      ),
    },
    {
      dataField: 'createdAt',
      caption: 'Date',
      width: 150,
      cellRender: (cellInfo) => (
        <div className="text-sm">
          <p>{formatDate(cellInfo.data.createdAt)}</p>
          <p className="text-xs text-gray-500">by {cellInfo.data.createdByName}</p>
        </div>
      ),
    },
  ];

  // Calculate summary stats
  const receiveCount = transactions.filter(t => t.type === 'RECEIVE').length;
  const issueCount = transactions.filter(t => t.type === 'ISSUE').length;
  const transferCount = transactions.filter(t => t.type === 'TRANSFER').length;
  const adjustCount = transactions.filter(t => t.type === 'ADJUST').length;

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory Transactions</h1>
            <p className="text-sm sm:text-base text-gray-600">รายการเคลื่อนไหวสินค้าคงคลัง</p>
          </div>
          <DxButton
            text="New Transaction"
            icon="plus"
            type="default"
            onClick={() => { resetForm(); setShowModal(true); }}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Receive</p>
                <p className="text-lg sm:text-xl font-bold">{receiveCount}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Issue</p>
                <p className="text-lg sm:text-xl font-bold">{issueCount}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <ArrowLeftRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Transfer</p>
                <p className="text-lg sm:text-xl font-bold">{transferCount}</p>
              </div>
            </div>
          </Card>
          <Card className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Adjustment</p>
                <p className="text-lg sm:text-xl font-bold">{adjustCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Transaction Type
              </label>
              <DxSelectBox
                items={transactionTypes}
                value={typeFilter}
                onValueChange={setTypeFilter}
                valueExpr="value"
                displayExpr="label"
              />
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date From
                </label>
                <DxDateBox
                  value={dateFrom}
                  onValueChange={(value) => setDateFrom(value || '')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date To
                </label>
                <DxDateBox
                  value={dateTo}
                  onValueChange={(value) => setDateTo(value || '')}
                />
              </div>
            </div>

            <DxButton
              text="Apply Filter"
              icon="filter"
              type="normal"
              stylingMode="outlined"
              onClick={handleSearch}
            />
          </div>
        </Card>

        {/* Table Card */}
        <Card className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <DxLoadIndicator />
            </div>
          ) : (
            <>
              <DxDataGrid
                dataSource={transactions}
                keyExpr="id"
                columns={columns}
                showBorders
                height={500}
                noDataText="No transactions found"
              />

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} transactions
                  </p>
                  <div className="flex gap-2">
                    <DxButton
                      text="Previous"
                      type="normal"
                      stylingMode="outlined"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    />
                    <DxButton
                      text="Next"
                      type="normal"
                      stylingMode="outlined"
                      disabled={pagination.page * pagination.limit >= pagination.total}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Create Transaction Modal */}
      <DxPopup
        visible={showModal}
        onHiding={() => { setShowModal(false); resetForm(); }}
        title="New Transaction"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <DxSelectBox
              items={transactionTypes.filter(t => t.value !== '')}
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              valueExpr="value"
              displayExpr="label"
            />
          </div>

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
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                <p><strong>Item:</strong> {selectedLot.itemName}</p>
                <p><strong>Available:</strong> {selectedLot.quantity} {selectedLot.unit}</p>
                <p><strong>Warehouse:</strong> {selectedLot.warehouseName}</p>
              </div>
            )}
          </div>

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
              <p className="text-xs text-gray-500 mt-1">
                Max available: {selectedLot.quantity} {selectedLot.unit}
              </p>
            )}
          </div>

          {formData.type === 'TRANSFER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Warehouse <span className="text-red-500">*</span>
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

          {['RECEIVE', 'RETURN'].includes(formData.type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Warehouse
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

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Reference (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => { setShowModal(false); resetForm(); }}
            />
            <DxButton
              text="Create Transaction"
              type="default"
              onClick={handleSave}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}
