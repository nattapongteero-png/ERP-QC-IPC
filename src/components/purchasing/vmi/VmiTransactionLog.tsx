'use client';

/**
 * VMI Transaction Log Component
 *
 * Displays VMI API transaction history with filtering and detail view
 */

import * as React from 'react';
import DataGrid, {
  Column,
  Paging,
  FilterRow,
  HeaderFilter,
  Scrolling,
  LoadPanel,
  ColumnChooser,
} from 'devextreme-react/data-grid';
import Popup from 'devextreme-react/popup';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Activity,
  Package,
  DollarSign,
  Warehouse,
  ShoppingCart,
  Truck,
  FileCheck,
  Wifi,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Transaction {
  id: number;
  vendorId: number;
  vendorName: string;
  transactionType: string;
  endpoint: string | null;
  method: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  status: string;
  errorMessage: string | null;
  hasRequestPayload: boolean;
  hasResponsePayload: boolean;
  createdAt: string | null;
}

export interface TransactionDetail extends Transaction {
  requestPayload: Record<string, unknown> | null;
  responsePayload: Record<string, unknown> | null;
}

export interface VmiTransactionLogProps {
  transactions: Transaction[];
  onRefresh?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Transaction Type Config
// ============================================================================

const transactionTypeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  item_sync: { label: 'Item Sync', icon: Package, color: 'text-blue-600' },
  price_sync: { label: 'Price Sync', icon: DollarSign, color: 'text-emerald-600' },
  inventory_sync: { label: 'Inventory Sync', icon: Warehouse, color: 'text-purple-600' },
  order_poll: { label: 'Order Poll', icon: ShoppingCart, color: 'text-amber-600' },
  order_confirm: { label: 'Order Confirm', icon: CheckCircle, color: 'text-green-600' },
  order_ship: { label: 'Order Ship', icon: Truck, color: 'text-indigo-600' },
  receipt_check: { label: 'Receipt Check', icon: FileCheck, color: 'text-teal-600' },
  connection_test: { label: 'Connection Test', icon: Wifi, color: 'text-gray-600' },
};

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; variant: 'success' | 'danger' | 'warning' | 'info' }
> = {
  success: { label: 'Success', icon: CheckCircle, variant: 'success' },
  error: { label: 'Error', icon: XCircle, variant: 'danger' },
  pending: { label: 'Pending', icon: Clock, variant: 'warning' },
};

// ============================================================================
// Main Component
// ============================================================================

export function VmiTransactionLog({
  transactions,
  onRefresh,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  className,
}: VmiTransactionLogProps) {
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null);
  const [transactionDetail, setTransactionDetail] = React.useState<TransactionDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [showDetailPopup, setShowDetailPopup] = React.useState(false);

  // Load transaction detail
  const loadTransactionDetail = async (transactionId: number) => {
    setIsDetailLoading(true);
    try {
      const response = await fetch(`/api/purchasing/vmi/transactions/${transactionId}`);
      const result = await response.json();
      if (result.success) {
        setTransactionDetail(result.data);
        setShowDetailPopup(true);
      }
    } catch (error) {
      console.error('Failed to load transaction detail:', error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Render transaction type cell
  const renderTransactionType = (data: { value: string }) => {
    const config = transactionTypeConfig[data.value] || {
      label: data.value,
      icon: Activity,
      color: 'text-gray-600',
    };
    const Icon = config.icon;

    return (
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', config.color)} />
        <span>{config.label}</span>
      </div>
    );
  };

  // Render status cell
  const renderStatus = (data: { value: string }) => {
    const config = statusConfig[data.value] || {
      label: data.value,
      icon: Clock,
      variant: 'info' as const,
    };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Render HTTP status cell
  const renderHttpStatus = (data: { value: number | null }) => {
    if (!data.value) return <span className="text-gray-400">-</span>;

    const status = data.value;
    const color =
      status >= 200 && status < 300
        ? 'text-emerald-600 bg-emerald-50'
        : status >= 400
          ? 'text-red-600 bg-red-50'
          : 'text-amber-600 bg-amber-50';

    return (
      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', color)}>
        {status}
      </span>
    );
  };

  // Render duration cell
  const renderDuration = (data: { value: number | null }) => {
    if (!data.value) return <span className="text-gray-400">-</span>;

    const ms = data.value;
    const color = ms < 500 ? 'text-emerald-600' : ms < 2000 ? 'text-amber-600' : 'text-red-600';

    return <span className={cn('font-mono text-xs', color)}>{ms}ms</span>;
  };

  // Render date cell
  const renderDate = (data: { value: string | null }) => {
    if (!data.value) return <span className="text-gray-400">-</span>;

    return (
      <span className="text-xs">
        {new Date(data.value).toLocaleString('th-TH', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </span>
    );
  };

  // Render action cell
  const renderActions = (data: { data: Transaction }) => {
    return (
      <button
        className="p-1 hover:bg-gray-100 rounded"
        onClick={() => {
          setSelectedTransaction(data.data);
          loadTransactionDetail(data.data.id);
        }}
      >
        <ChevronRight className="h-4 w-4 text-gray-500" />
      </button>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Transaction Log</h3>
        {onRefresh && (
          <DxButton
            icon="refresh"
            text="Refresh"
            type="default"
            stylingMode="text"
            onClick={onRefresh}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Data Grid */}
      <DataGrid
        dataSource={transactions}
        keyExpr="id"
        showBorders={true}
        showRowLines={true}
        rowAlternationEnabled={true}
        height={500}
        columnAutoWidth={true}
      >
        <LoadPanel enabled={isLoading} />
        <Scrolling mode="virtual" />
        <FilterRow visible={true} />
        <HeaderFilter visible={true} />
        <ColumnChooser enabled={true} mode="select" />
        <Paging enabled={true} pageSize={50} />

        <Column
          dataField="transactionType"
          caption="Type"
          width={150}
          cellRender={renderTransactionType}
        />
        <Column dataField="vendorName" caption="Vendor" width={150} />
        <Column dataField="method" caption="Method" width={80} />
        <Column dataField="endpoint" caption="Endpoint" minWidth={200} />
        <Column
          dataField="httpStatus"
          caption="HTTP"
          width={80}
          alignment="center"
          cellRender={renderHttpStatus}
        />
        <Column
          dataField="durationMs"
          caption="Duration"
          width={100}
          alignment="right"
          cellRender={renderDuration}
        />
        <Column
          dataField="status"
          caption="Status"
          width={100}
          cellRender={renderStatus}
        />
        <Column
          dataField="createdAt"
          caption="Time"
          width={140}
          dataType="datetime"
          cellRender={renderDate}
        />
        <Column
          caption=""
          width={50}
          cellRender={renderActions}
          allowFiltering={false}
          allowSorting={false}
        />
      </DataGrid>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-2">
          <DxButton
            text="Load More"
            type="default"
            stylingMode="outlined"
            onClick={onLoadMore}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Detail Popup */}
      <Popup
        visible={showDetailPopup}
        onHiding={() => {
          setShowDetailPopup(false);
          setTransactionDetail(null);
        }}
        title={`Transaction Details - #${selectedTransaction?.id}`}
        showCloseButton={true}
        width={800}
        height={600}
      >
        {isDetailLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : transactionDetail ? (
          <div className="p-4 space-y-6 overflow-auto h-full">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Vendor</span>
                <p className="font-medium">{transactionDetail.vendorName}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Type</span>
                <p className="font-medium">
                  {transactionTypeConfig[transactionDetail.transactionType]?.label ||
                    transactionDetail.transactionType}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status</span>
                <div className="mt-1">
                  <Badge
                    variant={statusConfig[transactionDetail.status]?.variant || 'info'}
                  >
                    {transactionDetail.status}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">HTTP Status</span>
                <p className="font-medium">{transactionDetail.httpStatus || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Duration</span>
                <p className="font-medium">{transactionDetail.durationMs}ms</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Time</span>
                <p className="font-medium">
                  {transactionDetail.createdAt
                    ? new Date(transactionDetail.createdAt).toLocaleString('th-TH')
                    : '-'}
                </p>
              </div>
            </div>

            {/* Endpoint */}
            <div>
              <span className="text-sm text-gray-500">Endpoint</span>
              <p className="font-mono text-sm bg-gray-50 p-2 rounded mt-1">
                {transactionDetail.method} {transactionDetail.endpoint}
              </p>
            </div>

            {/* Error Message */}
            {transactionDetail.errorMessage && (
              <div>
                <span className="text-sm text-gray-500">Error</span>
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded mt-1">
                  {transactionDetail.errorMessage}
                </p>
              </div>
            )}

            {/* Request Payload */}
            {transactionDetail.requestPayload && (
              <div>
                <span className="text-sm text-gray-500">Request Payload</span>
                <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto max-h-40">
                  {JSON.stringify(transactionDetail.requestPayload, null, 2)}
                </pre>
              </div>
            )}

            {/* Response Payload */}
            {transactionDetail.responsePayload && (
              <div>
                <span className="text-sm text-gray-500">Response Payload</span>
                <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto max-h-40">
                  {JSON.stringify(transactionDetail.responsePayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Popup>
    </div>
  );
}

export default VmiTransactionLog;
