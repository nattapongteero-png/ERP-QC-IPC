'use client';

// HR Authorizations Management Page - Redesigned Dashboard
// Feature: 007-hr-personnel-management
// Redesigned with KPIs, DataGrid, Cards, and Analytics views

import React, { useState, useCallback, useMemo } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  HeaderFilter,
  FilterRow,
  Paging,
  Pager,
  Scrolling,
  Toolbar,
  Item,
  Grouping,
  GroupPanel,
  ColumnChooser,
  StateStoring,
  Export,
} from 'devextreme-react/data-grid';
import PieChart, {
  Series,
  Label,
  Connector,
  Legend,
  Tooltip as PieTooltip,
  Size,
} from 'devextreme-react/pie-chart';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import TagBox from 'devextreme-react/tag-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useToast } from '@/components/ui/toast';
import {
  ShieldCheck,
  Users,
  Calendar,
  List,
  Grid3X3,
  PieChart as PieChartIcon,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileCheck,
  GitBranch,
  Activity,
  User,
  ArrowRight,
} from 'lucide-react';
import type {
  AuthorizationWithDetails,
  AuthorizationType,
  DelegationWithDetails,
  EmployeeSummary,
} from '@/types/hr';

// Authorization type configuration with colors and icons
const AUTH_TYPE_CONFIG: Record<
  AuthorizationType,
  { label: string; labelEn: string; color: string; bgColor: string; borderColor: string }
> = {
  batch_release: {
    label: 'ปล่อยผ่านชุด',
    labelEn: 'Batch Release',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
  },
  sop_approval: {
    label: 'อนุมัติ SOP',
    labelEn: 'SOP Approval',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  deviation_approval: {
    label: 'อนุมัติ Deviation',
    labelEn: 'Deviation Approval',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
  },
  change_control_approval: {
    label: 'อนุมัติ Change Control',
    labelEn: 'Change Control',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
  },
  capa_approval: {
    label: 'อนุมัติ CAPA',
    labelEn: 'CAPA Approval',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
  },
};

type ViewMode = 'grid' | 'cards' | 'analytics';

// Fetch functions
async function fetchAuthorizations(): Promise<AuthorizationWithDetails[]> {
  const response = await fetch('/api/hr/authorizations');
  if (!response.ok) throw new Error('Failed to fetch authorizations');
  const result = await response.json();
  return result.data || [];
}

async function fetchEmployees(): Promise<EmployeeSummary[]> {
  const response = await fetch('/api/hr/employees?status=active');
  if (!response.ok) throw new Error('Failed to fetch employees');
  const result = await response.json();
  return result.data || [];
}

async function createAuthorization(data: {
  employeeId: number;
  authType: AuthorizationType;
  scopeProductLines?: string[];
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<AuthorizationWithDetails> {
  const response = await fetch('/api/hr/authorizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create authorization');
  const result = await response.json();
  return result.data;
}

async function revokeAuthorization(id: number): Promise<void> {
  const response = await fetch('/api/hr/authorizations/' + id, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to revoke authorization');
}

async function createDelegation(data: {
  authorizationId: number;
  delegateId: number;
  reason?: string;
  effectiveFrom: string;
  effectiveTo: string;
}): Promise<DelegationWithDetails> {
  const response = await fetch('/api/hr/authorizations/' + data.authorizationId + '/delegations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to create delegation');
  }
  const result = await response.json();
  return result.data;
}

// Format date helper
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// Get authorization status
function getAuthStatus(auth: AuthorizationWithDetails): {
  status: 'active' | 'expired' | 'pending' | 'revoked';
  label: string;
  variant: 'success' | 'secondary' | 'warning' | 'destructive';
} {
  const today = new Date().toISOString().split('T')[0];

  if (!auth.isActive) {
    return { status: 'revoked', label: 'ถูกยกเลิก', variant: 'destructive' };
  }
  if (auth.effectiveTo && auth.effectiveTo < today) {
    return { status: 'expired', label: 'หมดอายุ', variant: 'secondary' };
  }
  if (auth.effectiveFrom > today) {
    return { status: 'pending', label: 'รอเริ่มต้น', variant: 'warning' };
  }
  return { status: 'active', label: 'มีผล', variant: 'success' };
}

// Generate gradient color based on code hash
function getGradientForType(authType: AuthorizationType): string {
  const gradients: Record<AuthorizationType, string> = {
    batch_release: 'from-green-500 to-green-600',
    sop_approval: 'from-blue-500 to-blue-600',
    deviation_approval: 'from-orange-500 to-orange-600',
    change_control_approval: 'from-purple-500 to-purple-600',
    capa_approval: 'from-red-500 to-red-600',
  };
  return gradients[authType] || 'from-gray-500 to-gray-600';
}

export default function AuthorizationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [authTypeFilter, setAuthTypeFilter] = useState<AuthorizationType | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Popup states
  const [showGrantPopup, setShowGrantPopup] = useState(false);
  const [showDelegatePopup, setShowDelegatePopup] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState<AuthorizationWithDetails | null>(null);

  // Form states
  const [newAuth, setNewAuth] = useState({
    employeeId: undefined as number | undefined,
    authType: undefined as AuthorizationType | undefined,
    scopeProductLines: [] as string[],
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  const [newDelegation, setNewDelegation] = useState({
    delegateId: undefined as number | undefined,
    reason: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  // Data queries
  const {
    data: authorizationsData = [],
    isLoading,
    refetch: refetchAuthorizations,
  } = useQuery({
    queryKey: ['hr', 'authorizations'],
    queryFn: fetchAuthorizations,
    staleTime: 30000,
  });

  const { data: employeesData = [] } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
    staleTime: 60000,
  });

  // Ensure data is always an array - memoized to avoid dependency changes
  const authorizations = useMemo(
    () => (Array.isArray(authorizationsData) ? authorizationsData : []),
    [authorizationsData]
  );
  const employees = useMemo(
    () => (Array.isArray(employeesData) ? employeesData : []),
    [employeesData]
  );

  // Calculate analytics
  const analytics = useMemo(() => {
    const total = authorizations.length;
    const active = authorizations.filter((a) => {
      const status = getAuthStatus(a);
      return status.status === 'active';
    }).length;
    const expired = authorizations.filter((a) => {
      const status = getAuthStatus(a);
      return status.status === 'expired';
    }).length;
    const pending = authorizations.filter((a) => {
      const status = getAuthStatus(a);
      return status.status === 'pending';
    }).length;
    const revoked = authorizations.filter((a) => {
      const status = getAuthStatus(a);
      return status.status === 'revoked';
    }).length;

    // By type distribution
    const byTypeDistribution = Object.entries(AUTH_TYPE_CONFIG).map(([type, config]) => ({
      name: config.label,
      type: type as AuthorizationType,
      count: authorizations.filter((a) => a.authType === type && a.isActive).length,
    })).filter((item) => item.count > 0);

    // Status distribution
    const statusDistribution = [
      { name: 'มีผล', count: active, color: '#10b981' },
      { name: 'รอเริ่มต้น', count: pending, color: '#f59e0b' },
      { name: 'หมดอายุ', count: expired, color: '#6b7280' },
      { name: 'ถูกยกเลิก', count: revoked, color: '#ef4444' },
    ].filter((s) => s.count > 0);

    // Total delegations
    const totalDelegations = authorizations.reduce((acc, a) => acc + (a.delegations?.length || 0), 0);

    // Employees with authorizations
    const employeesWithAuth = new Set(authorizations.filter((a) => a.isActive).map((a) => a.employeeId)).size;

    // Expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringToday = thirtyDaysFromNow.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const expiringSoon = authorizations.filter((a) => {
      if (!a.isActive || !a.effectiveTo) return false;
      return a.effectiveTo >= today && a.effectiveTo <= expiringToday;
    }).length;

    return {
      total,
      active,
      expired,
      pending,
      revoked,
      byTypeDistribution,
      statusDistribution,
      totalDelegations,
      employeesWithAuth,
      expiringSoon,
    };
  }, [authorizations]);

  // Filtered data
  const filteredAuthorizations = useMemo(() => {
    return authorizations.filter((auth) => {
      const matchesSearch =
        !searchText ||
        auth.employeeName?.toLowerCase().includes(searchText.toLowerCase()) ||
        AUTH_TYPE_CONFIG[auth.authType]?.label.toLowerCase().includes(searchText.toLowerCase());

      const matchesType = !authTypeFilter || auth.authType === authTypeFilter;

      const status = getAuthStatus(auth);
      const matchesStatus = !statusFilter || status.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [authorizations, searchText, authTypeFilter, statusFilter]);

  // Mutations
  const grantMutation = useMutation({
    mutationFn: createAuthorization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorizations'] });
      setShowGrantPopup(false);
      resetNewAuth();
      toast.success('มอบสิทธิ์สำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถมอบสิทธิ์ได้');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAuthorization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorizations'] });
      toast.success('ยกเลิกสิทธิ์สำเร็จ');
    },
    onError: () => {
      toast.error('ไม่สามารถยกเลิกสิทธิ์ได้');
    },
  });

  const delegateMutation = useMutation({
    mutationFn: createDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'authorizations'] });
      setShowDelegatePopup(false);
      resetNewDelegation();
      toast.success('มอบอำนาจสำเร็จ');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'ไม่สามารถมอบอำนาจได้');
    },
  });

  const resetNewAuth = () => {
    setNewAuth({
      employeeId: undefined,
      authType: undefined,
      scopeProductLines: [],
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
    });
  };

  const resetNewDelegation = () => {
    setNewDelegation({
      delegateId: undefined,
      reason: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
    });
    setSelectedAuth(null);
  };

  const handleGrantAuth = useCallback(() => {
    if (!newAuth.employeeId || !newAuth.authType) return;
    grantMutation.mutate({
      employeeId: newAuth.employeeId,
      authType: newAuth.authType,
      scopeProductLines: newAuth.scopeProductLines.length > 0 ? newAuth.scopeProductLines : undefined,
      effectiveFrom: newAuth.effectiveFrom,
      effectiveTo: newAuth.effectiveTo || undefined,
    });
  }, [newAuth, grantMutation]);

  const handleDelegate = useCallback(() => {
    if (!selectedAuth || !newDelegation.delegateId || !newDelegation.effectiveTo) return;
    delegateMutation.mutate({
      authorizationId: selectedAuth.id,
      delegateId: newDelegation.delegateId,
      reason: newDelegation.reason || undefined,
      effectiveFrom: newDelegation.effectiveFrom,
      effectiveTo: newDelegation.effectiveTo,
    });
  }, [selectedAuth, newDelegation, delegateMutation]);

  const openDelegatePopup = (auth: AuthorizationWithDetails) => {
    setSelectedAuth(auth);
    setShowDelegatePopup(true);
  };

  const handleRefresh = () => {
    refetchAuthorizations();
  };

  const clearFilters = () => {
    setSearchText('');
    setAuthTypeFilter(null);
    setStatusFilter(null);
  };

  // Options for filters
  const authTypeOptions = Object.entries(AUTH_TYPE_CONFIG).map(([value, config]) => ({
    value,
    text: config.label,
  }));

  const statusOptions = [
    { value: 'active', text: 'มีผล' },
    { value: 'pending', text: 'รอเริ่มต้น' },
    { value: 'expired', text: 'หมดอายุ' },
    { value: 'revoked', text: 'ถูกยกเลิก' },
  ];

  // Cell renderers
  const renderAuthTypeCell = (cellData: { value: AuthorizationType }) => {
    const config = AUTH_TYPE_CONFIG[cellData.value];
    if (!config) return cellData.value;
    return (
      <span className={`font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const renderStatusCell = (cellData: { data: AuthorizationWithDetails }) => {
    const { label, variant } = getAuthStatus(cellData.data);
    return <Badge variant={variant}>{label}</Badge>;
  };

  const renderDelegationsCell = (cellData: { data: AuthorizationWithDetails }) => {
    const count = cellData.data.delegations?.length || 0;
    if (count === 0) return <span className="text-gray-400">-</span>;
    return (
      <Badge variant="default" className="text-xs">
        <Users className="h-3 w-3 mr-1" />
        {count} มอบอำนาจ
      </Badge>
    );
  };

  const renderActionsCell = (cellData: { data: AuthorizationWithDetails }) => {
    const auth = cellData.data;
    if (!auth.isActive) return null;

    return (
      <div className="flex gap-1">
        <DxButton
          icon="group"
          hint="มอบอำนาจ"
          type="default"
          stylingMode="text"
          onClick={() => openDelegatePopup(auth)}
        />
        <DxButton
          icon="close"
          hint="ยกเลิกสิทธิ์"
          type="danger"
          stylingMode="text"
          onClick={() => {
            if (confirm('ต้องการยกเลิกสิทธิ์นี้หรือไม่?')) {
              revokeMutation.mutate(auth.id);
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <ResponsivePageHeader
        title="สิทธิ์อนุมัติ"
        subtitle="Authorization Management Dashboard"
        icon={ShieldCheck}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[{ label: 'HR', href: '/hr' }, { label: 'สิทธิ์อนุมัติ' }]}
        actions={
          <div className="flex items-center gap-2">
            <DxButton icon="refresh" onClick={handleRefresh} hint="รีเฟรชข้อมูล" />
            <DxButton
              icon="filter"
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? 'default' : 'normal'}
              hint="ตัวกรอง"
            />
          </div>
        }
      />

      {/* KPI Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          label="สิทธิ์ทั้งหมด"
          value={analytics.total}
          icon={ShieldCheck}
          iconColor="text-indigo-600"
          accentColor="border-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label="มีผลบังคับใช้"
          value={analytics.active}
          icon={CheckCircle}
          iconColor="text-green-600"
          accentColor="border-green-500"
          isLoading={isLoading}
        />
        <StatCard
          label="รอเริ่มต้น"
          value={analytics.pending}
          icon={Clock}
          iconColor="text-amber-600"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label="ใกล้หมดอายุ"
          value={analytics.expiringSoon}
          icon={AlertTriangle}
          iconColor="text-orange-600"
          accentColor="border-orange-500"
          trend={
            analytics.expiringSoon > 0
              ? { direction: 'up', value: 'ภายใน 30 วัน' }
              : undefined
          }
          isLoading={isLoading}
        />
        <StatCard
          label="การมอบอำนาจ"
          value={analytics.totalDelegations}
          icon={Users}
          iconColor="text-purple-600"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          label="พนักงานที่มีสิทธิ์"
          value={analytics.employeesWithAuth}
          icon={User}
          iconColor="text-blue-600"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
      </div>

      {/* View Mode Switcher and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">มุมมอง:</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="มุมมองตาราง"
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 border-x border-gray-200 ${
                viewMode === 'cards'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="มุมมองการ์ด"
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`p-2 ${
                viewMode === 'analytics'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="มุมมองวิเคราะห์"
            >
              <PieChartIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <DxButton
          text="มอบสิทธิ์ใหม่"
          icon="add"
          type="default"
          stylingMode="contained"
          onClick={() => setShowGrantPopup(true)}
        />
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              ตัวกรองข้อมูล
            </h3>
            <button
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              ล้างตัวกรอง
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">ค้นหา</label>
              <TextBox
                value={searchText}
                onValueChanged={(e) => setSearchText(e.value || '')}
                placeholder="ชื่อพนักงาน, ประเภทสิทธิ์..."
                showClearButton
                mode="search"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">ประเภทสิทธิ์</label>
              <SelectBox
                dataSource={authTypeOptions}
                value={authTypeFilter}
                onValueChanged={(e) => setAuthTypeFilter(e.value)}
                displayExpr="text"
                valueExpr="value"
                placeholder="ทุกประเภท"
                showClearButton
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">สถานะ</label>
              <SelectBox
                dataSource={statusOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                displayExpr="text"
                valueExpr="value"
                placeholder="ทุกสถานะ"
                showClearButton
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <DataGrid
            dataSource={filteredAuthorizations}
            keyExpr="id"
            showBorders={false}
            rowAlternationEnabled
            allowColumnReordering
            allowColumnResizing
            columnAutoWidth
            height="calc(100vh - 500px)"
            hoverStateEnabled
            loadPanel={{ enabled: isLoading }}
          >
            <SearchPanel visible placeholder="ค้นหา..." />
            <HeaderFilter visible />
            <FilterRow visible />
            <Grouping autoExpandAll={false} />
            <GroupPanel visible />
            <ColumnChooser enabled mode="select" />
            <StateStoring enabled type="localStorage" storageKey="hr_authorizations_grid" />
            <Scrolling mode="virtual" />
            <Export enabled fileName="authorizations" />

            <Column dataField="employeeName" caption="พนักงาน" minWidth={180} allowGrouping />
            <Column
              dataField="authType"
              caption="ประเภทสิทธิ์"
              width={180}
              cellRender={renderAuthTypeCell}
              allowGrouping
            />
            <Column
              dataField="effectiveFrom"
              caption="วันที่เริ่ม"
              width={120}
              calculateCellValue={(rowData) => formatDate(rowData.effectiveFrom)}
            />
            <Column
              dataField="effectiveTo"
              caption="วันที่สิ้นสุด"
              width={120}
              calculateCellValue={(rowData) => formatDate(rowData.effectiveTo)}
            />
            <Column
              caption="สถานะ"
              width={110}
              cellRender={renderStatusCell}
              alignment="center"
              allowGrouping
            />
            <Column
              caption="มอบอำนาจ"
              width={120}
              cellRender={renderDelegationsCell}
              alignment="center"
            />
            <Column
              dataField="grantedByName"
              caption="ผู้มอบสิทธิ์"
              width={150}
            />
            <Column
              caption="การดำเนินการ"
              width={100}
              cellRender={renderActionsCell}
              alignment="center"
            />

            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Toolbar>
              <Item name="groupPanel" />
              <Item name="searchPanel" />
              <Item name="columnChooserButton" />
              <Item name="exportButton" />
            </Toolbar>
          </DataGrid>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="space-y-6">
          {/* Group by authorization type */}
          {Object.entries(AUTH_TYPE_CONFIG).map(([type, config]) => {
            const typeAuths = filteredAuthorizations.filter(
              (a) => a.authType === type && a.isActive
            );
            if (typeAuths.length === 0) return null;

            return (
              <div key={type} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full bg-gradient-to-r ${getGradientForType(
                      type as AuthorizationType
                    )}`}
                  />
                  <h3 className="font-semibold text-gray-700">
                    {config.label}{' '}
                    <span className="text-gray-400 font-normal">({typeAuths.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {typeAuths.map((auth) => {
                    const status = getAuthStatus(auth);
                    return (
                      <div
                        key={auth.id}
                        className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all"
                      >
                        {/* Card Header */}
                        <div
                          className={`h-2 bg-gradient-to-r ${getGradientForType(auth.authType)}`}
                        />

                        <div className="p-4">
                          {/* Employee Info */}
                          <div className="flex items-start justify-between mb-3">
                            <div
                              className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradientForType(
                                auth.authType
                              )} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                            >
                              {auth.employeeName?.charAt(0) || '?'}
                            </div>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>

                          {/* Employee Name */}
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {auth.employeeName || 'Unknown'}
                          </h4>
                          <p className="text-xs text-gray-500 mb-3">{config.labelEn}</p>

                          {/* Details */}
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>
                                {formatDate(auth.effectiveFrom)}
                                {auth.effectiveTo && ` - ${formatDate(auth.effectiveTo)}`}
                              </span>
                            </div>
                            {auth.delegations && auth.delegations.length > 0 && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span>{auth.delegations.length} มอบอำนาจ</span>
                              </div>
                            )}
                            {auth.grantedByName && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="truncate">โดย {auth.grantedByName}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                            <DxButton
                              text="มอบอำนาจ"
                              icon="group"
                              type="default"
                              stylingMode="outlined"
                              onClick={() => openDelegatePopup(auth)}
                            />
                            <DxButton
                              icon="close"
                              hint="ยกเลิก"
                              type="danger"
                              stylingMode="text"
                              onClick={() => {
                                if (confirm('ต้องการยกเลิกสิทธิ์นี้หรือไม่?')) {
                                  revokeMutation.mutate(auth.id);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredAuthorizations.filter((a) => a.isActive).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>ไม่พบสิทธิ์อนุมัติที่ตรงกับเงื่อนไข</p>
            </div>
          )}
        </div>
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Authorization Type Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                การกระจายตามประเภทสิทธิ์
              </h3>
              {analytics.byTypeDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.byTypeDistribution}
                  type="doughnut"
                  palette={['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444']}
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} สิทธิ์`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  ไม่มีข้อมูลสิทธิ์ที่มีผล
                </div>
              )}
            </div>

            {/* Status Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                สถานะสิทธิ์อนุมัติ
              </h3>
              {analytics.statusDistribution.length > 0 ? (
                <PieChart
                  dataSource={analytics.statusDistribution}
                  type="doughnut"
                  palette="Material"
                >
                  <Size height={300} />
                  <Series argumentField="name" valueField="count">
                    <Label visible format="fixedPoint">
                      <Connector visible width={1} />
                    </Label>
                  </Series>
                  <Legend
                    visible
                    verticalAlignment="bottom"
                    horizontalAlignment="center"
                    itemTextPosition="right"
                    orientation="horizontal"
                  />
                  <PieTooltip
                    enabled
                    format="fixedPoint"
                    customizeTooltip={(pointInfo: { argumentText?: string; valueText?: string }) => ({
                      text: `${pointInfo.argumentText}: ${pointInfo.valueText} รายการ`,
                    })}
                  />
                </PieChart>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  ไม่มีข้อมูล
                </div>
              )}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* By Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" />
                สรุปตามสถานะ
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">มีผลบังคับใช้</span>
                  <span className="font-semibold text-green-600">{analytics.active}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">รอเริ่มต้น</span>
                  <span className="font-semibold text-amber-600">{analytics.pending}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">หมดอายุ</span>
                  <span className="font-semibold text-gray-600">{analytics.expired}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ถูกยกเลิก</span>
                  <span className="font-semibold text-red-600">{analytics.revoked}</span>
                </div>
              </div>
            </div>

            {/* By Type Count */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-600" />
                สรุปตามประเภท
              </h4>
              <div className="space-y-3">
                {Object.entries(AUTH_TYPE_CONFIG).map(([type, config]) => {
                  const count = authorizations.filter(
                    (a) => a.authType === type && a.isActive
                  ).length;
                  return (
                    <div key={type} className="flex justify-between items-center">
                      <span className={`text-sm ${config.color}`}>{config.label}</span>
                      <span className="font-semibold text-gray-700">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delegations Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-purple-600" />
                การมอบอำนาจ
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">การมอบอำนาจทั้งหมด</span>
                  <span className="font-semibold text-purple-600">
                    {analytics.totalDelegations}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">สิทธิ์ที่มีการมอบอำนาจ</span>
                  <span className="font-semibold text-gray-700">
                    {authorizations.filter((a) => a.delegations && a.delegations.length > 0).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-emerald-600" />
                ดำเนินการด่วน
              </h4>
              <div className="space-y-2">
                <DxButton
                  text="มอบสิทธิ์ใหม่"
                  icon="add"
                  type="default"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => setShowGrantPopup(true)}
                />
                <DxButton
                  text="ดูสิทธิ์ใกล้หมดอายุ"
                  icon="warning"
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => {
                    setStatusFilter(null);
                    setShowFilters(true);
                    setViewMode('grid');
                  }}
                />
              </div>
            </div>
          </div>

          {/* Authorization Type Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              จำนวนสิทธิ์ตามประเภท
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(AUTH_TYPE_CONFIG).map(([type, config]) => {
                const count = authorizations.filter(
                  (a) => a.authType === type && a.isActive
                ).length;
                return (
                  <div
                    key={type}
                    className={`text-center p-4 rounded-lg ${config.bgColor} border-l-4 ${config.borderColor}`}
                  >
                    <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
                    <div className="text-sm text-gray-600">{config.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grant Authorization Popup */}
      <Popup
        visible={showGrantPopup}
        onHiding={() => setShowGrantPopup(false)}
        title="มอบสิทธิ์อนุมัติ"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <SelectBox
            dataSource={employees}
            valueExpr="id"
            displayExpr={(item: EmployeeSummary | null) =>
              item ? item.employeeCode + ' - ' + item.fullName : ''
            }
            value={newAuth.employeeId}
            onValueChanged={(e) => setNewAuth((prev) => ({ ...prev, employeeId: e.value }))}
            label="พนักงาน"
            labelMode="floating"
            searchEnabled
            placeholder="เลือกพนักงาน..."
          />
          <SelectBox
            dataSource={authTypeOptions}
            valueExpr="value"
            displayExpr="text"
            value={newAuth.authType}
            onValueChanged={(e) => setNewAuth((prev) => ({ ...prev, authType: e.value }))}
            label="ประเภทสิทธิ์"
            labelMode="floating"
            placeholder="เลือกประเภทสิทธิ์..."
          />
          <TagBox
            items={['Herbal', 'Supplement', 'Cosmetic', 'Food']}
            value={newAuth.scopeProductLines}
            onValueChanged={(e) => setNewAuth((prev) => ({ ...prev, scopeProductLines: e.value || [] }))}
            label="สายผลิตภัณฑ์ (ไม่บังคับ)"
            labelMode="floating"
            placeholder="เลือกสายผลิตภัณฑ์..."
            showSelectionControls
          />
          <div className="grid grid-cols-2 gap-4">
            <DxDateBox
              value={newAuth.effectiveFrom}
              onValueChange={(value) =>
                setNewAuth((prev) => ({
                  ...prev,
                  effectiveFrom: value || prev.effectiveFrom,
                }))
              }
              label="วันที่เริ่มต้น"
            />
            <DxDateBox
              value={newAuth.effectiveTo || ''}
              onValueChange={(value) =>
                setNewAuth((prev) => ({
                  ...prev,
                  effectiveTo: value || '',
                }))
              }
              label="วันที่สิ้นสุด (ถ้ามี)"
              showClearButton
            />
          </div>
        </div>
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'มอบสิทธิ์',
            type: 'default',
            stylingMode: 'contained',
            icon: 'check',
            onClick: handleGrantAuth,
            disabled: grantMutation.isPending || !newAuth.employeeId || !newAuth.authType,
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            type: 'default',
            stylingMode: 'outlined',
            onClick: () => setShowGrantPopup(false),
          }}
        />
      </Popup>

      {/* Delegate Authorization Popup */}
      <Popup
        visible={showDelegatePopup}
        onHiding={() => setShowDelegatePopup(false)}
        title="มอบอำนาจ"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          {selectedAuth && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-500">มอบอำนาจจาก</p>
              <p className="font-medium">{selectedAuth.employeeName}</p>
              <p className="text-sm text-gray-500 mt-1">
                สิทธิ์: {AUTH_TYPE_CONFIG[selectedAuth.authType]?.label}
              </p>
            </div>
          )}
          <SelectBox
            dataSource={employees.filter((e) => e.id !== selectedAuth?.employeeId)}
            valueExpr="id"
            displayExpr={(item: EmployeeSummary | null) =>
              item ? item.employeeCode + ' - ' + item.fullName : ''
            }
            value={newDelegation.delegateId}
            onValueChanged={(e) => setNewDelegation((prev) => ({ ...prev, delegateId: e.value }))}
            label="ผู้รับมอบอำนาจ"
            labelMode="floating"
            searchEnabled
            placeholder="เลือกพนักงาน..."
          />
          <TextBox
            value={newDelegation.reason}
            onValueChanged={(e) => setNewDelegation((prev) => ({ ...prev, reason: e.value || '' }))}
            label="เหตุผล (ไม่บังคับ)"
            labelMode="floating"
          />
          <div className="grid grid-cols-2 gap-4">
            <DxDateBox
              value={newDelegation.effectiveFrom}
              onValueChange={(value) =>
                setNewDelegation((prev) => ({
                  ...prev,
                  effectiveFrom: value || prev.effectiveFrom,
                }))
              }
              label="วันที่เริ่มต้น"
            />
            <DxDateBox
              value={newDelegation.effectiveTo || ''}
              onValueChange={(value) =>
                setNewDelegation((prev) => ({
                  ...prev,
                  effectiveTo: value || '',
                }))
              }
              label="วันที่สิ้นสุด"
              showClearButton
            />
          </div>
        </div>
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'มอบอำนาจ',
            type: 'default',
            stylingMode: 'contained',
            icon: 'user',
            onClick: handleDelegate,
            disabled:
              delegateMutation.isPending ||
              !newDelegation.delegateId ||
              !newDelegation.effectiveTo,
          }}
        />
        <ToolbarItem
          widget="dxButton"
          location="after"
          options={{
            text: 'ยกเลิก',
            type: 'default',
            stylingMode: 'outlined',
            onClick: () => setShowDelegatePopup(false),
          }}
        />
      </Popup>
    </div>
  );
}
