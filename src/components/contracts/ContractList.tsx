'use client';

/**
 * Contract List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * DataGrid showing manufacturing contracts with status, expiration, and audit info.
 */

import { useRouter } from 'next/navigation';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  FlaskConical,
  Package,
} from 'lucide-react';
import type { ManufacturingContract, ContractStatus, ContractorType } from '@/types/contracts';

interface ContractListProps {
  contracts: ManufacturingContract[];
  loading?: boolean;
  onContractSelect?: (contract: ManufacturingContract) => void;
}

const statusConfig: Record<
  ContractStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-800',
    icon: <XCircle className="h-3 w-3" />,
  },
  terminated: {
    label: 'Terminated',
    color: 'bg-gray-100 text-gray-800',
    icon: <XCircle className="h-3 w-3" />,
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <Clock className="h-3 w-3" />,
  },
};

const typeConfig: Record<ContractorType, { label: string; icon: React.ReactNode }> = {
  manufacturer: {
    label: 'Manufacturer',
    icon: <Building2 className="h-3 w-3" />,
  },
  laboratory: {
    label: 'Laboratory',
    icon: <FlaskConical className="h-3 w-3" />,
  },
  both: {
    label: 'Both',
    icon: <Package className="h-3 w-3" />,
  },
};

export function ContractList({
  contracts,
  loading = false,
  onContractSelect,
}: ContractListProps) {
  const router = useRouter();

  const renderStatusCell = (cellData: { value: ContractStatus }) => {
    const config = statusConfig[cellData.value];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const renderTypeCell = (cellData: { value: ContractorType }) => {
    const config = typeConfig[cellData.value];
    return (
      <span className="inline-flex items-center gap-1 text-gray-700">
        {config.icon}
        {config.label}
      </span>
    );
  };

  const renderExpirationCell = (cellData: { data: ManufacturingContract }) => {
    const contract = cellData.data;
    if (!contract.expirationDate) return '-';

    if (contract.status !== 'active') {
      return contract.expirationDate;
    }

    if (contract.isExpiringSoon) {
      return (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {contract.expirationDate} ({contract.daysUntilExpiry}d)
          </span>
        </div>
      );
    }

    if (contract.daysUntilExpiry !== undefined && contract.daysUntilExpiry < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{contract.expirationDate}</span>
        </div>
      );
    }

    return contract.expirationDate;
  };

  const renderAuditCell = (cellData: { data: ManufacturingContract }) => {
    const contract = cellData.data;
    if (!contract.nextAuditDue) return '-';

    if (contract.isAuditOverdue) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{contract.nextAuditDue}</span>
        </div>
      );
    }

    return contract.nextAuditDue;
  };

  const renderActionsCell = (cellData: { data: ManufacturingContract }) => {
    const contract = cellData.data;
    return (
      <DxButton
        text="View"
        stylingMode="text"
        onClick={(e) => {
          e?.event?.stopPropagation();
          if (onContractSelect) {
            onContractSelect(contract);
          } else {
            router.push(`/gmp/contracts/${contract.id}`);
          }
        }}
      />
    );
  };

  return (
    <DxDataGrid
      dataSource={contracts}
      showBorders
      rowAlternationEnabled
      loading={loading}
      onRowClick={(e) => {
        if (e.data) {
          if (onContractSelect) {
            onContractSelect(e.data);
          } else {
            router.push(`/gmp/contracts/${e.data.id}`);
          }
        }
      }}
    >
      <DxSearchPanel visible placeholder="Search contracts..." />
      <DxPaging defaultPageSize={15} />

      <DxColumn dataField="contractNumber" caption="Contract #" width={140} />
      <DxColumn dataField="contractorName" caption="Contractor" minWidth={180} />
      <DxColumn
        dataField="contractorType"
        caption="Type"
        width={130}
        cellRender={renderTypeCell}
      />
      <DxColumn dataField="effectiveDate" caption="Effective" dataType="date" width={110} />
      <DxColumn
        caption="Expires"
        width={140}
        cellRender={renderExpirationCell}
        allowFiltering={false}
        allowSorting={false}
      />
      <DxColumn
        dataField="batchCount"
        caption="Batches"
        width={80}
        alignment="center"
      />
      <DxColumn
        caption="Next Audit"
        width={120}
        cellRender={renderAuditCell}
        allowFiltering={false}
        allowSorting={false}
      />
      <DxColumn
        dataField="status"
        caption="Status"
        width={110}
        cellRender={renderStatusCell}
      />
      <DxColumn
        caption="Actions"
        width={80}
        cellRender={renderActionsCell}
        allowFiltering={false}
        allowSorting={false}
      />
    </DxDataGrid>
  );
}
