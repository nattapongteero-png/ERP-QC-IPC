'use client';

// HR Authorizations Management Page
// Feature: 007-hr-personnel-management

import { useState, useCallback } from 'react';
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
} from 'devextreme-react/data-grid';
import { Popup, ToolbarItem } from 'devextreme-react/popup';
import SelectBox from 'devextreme-react/select-box';
import DateBox from 'devextreme-react/date-box';
import TextBox from 'devextreme-react/text-box';
import TagBox from 'devextreme-react/tag-box';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  ShieldCheck,
  Users,
  Calendar,
  Building2,
} from 'lucide-react';
import type {
  AuthorizationWithDetails,
  AuthorizationType,
  DelegationWithDetails,
  EmployeeSummary,
} from '@/types/hr';

const AUTH_TYPE_CONFIG: Record<AuthorizationType, { label: string; color: string }> = {
  batch_release: { label: 'ปล่อยผ่านชุด', color: 'text-green-700' },
  sop_approval: { label: 'อนุมัติ SOP', color: 'text-blue-700' },
  deviation_approval: { label: 'อนุมัติ Deviation', color: 'text-orange-700' },
  change_control_approval: { label: 'อนุมัติ Change Control', color: 'text-purple-700' },
  capa_approval: { label: 'อนุมัติ CAPA', color: 'text-red-700' },
};

async function fetchAuthorizations(): Promise<AuthorizationWithDetails[]> {
  const response = await fetch('/api/hr/authorizations?isActive=true');
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

export default function AuthorizationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showGrantPopup, setShowGrantPopup] = useState(false);
  const [showDelegatePopup, setShowDelegatePopup] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState<AuthorizationWithDetails | null>(null);

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

  const { data: authorizations = [], isLoading } = useQuery({
    queryKey: ['hr', 'authorizations'],
    queryFn: fetchAuthorizations,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr', 'employees', 'active'],
    queryFn: fetchEmployees,
  });

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

  const authTypeOptions = Object.entries(AUTH_TYPE_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
  }));

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderAuthTypeCell = (cellData: { value: AuthorizationType }) => {
    const config = AUTH_TYPE_CONFIG[cellData.value];
    if (!config) return cellData.value;
    return (
      <span className={'font-medium ' + config.color}>
        {config.label}
      </span>
    );
  };

  const renderStatusCell = (cellData: { data: AuthorizationWithDetails }) => {
    const auth = cellData.data;
    const today = new Date().toISOString().split('T')[0];

    if (!auth.isActive) {
      return <Badge variant="danger">ถูกยกเลิก</Badge>;
    }
    if (auth.effectiveTo && auth.effectiveTo < today) {
      return <Badge variant="secondary">หมดอายุ</Badge>;
    }
    if (auth.effectiveFrom > today) {
      return <Badge variant="info">รอเริ่มต้น</Badge>;
    }
    return <Badge variant="success">มีผล</Badge>;
  };

  const renderDelegationsCell = (cellData: { data: AuthorizationWithDetails }) => {
    const count = cellData.data.delegations?.length || 0;
    if (count === 0) return <span className="text-gray-400">-</span>;
    return (
      <Badge variant="info" className="text-xs">
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

  // Calculate stats
  const stats = {
    total: authorizations.filter((a) => a.isActive).length,
    batchRelease: authorizations.filter((a) => a.isActive && a.authType === 'batch_release').length,
    sopApproval: authorizations.filter((a) => a.isActive && a.authType === 'sop_approval').length,
    delegations: authorizations.reduce((acc, a) => acc + (a.delegations?.length || 0), 0),
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            สิทธิ์อนุมัติ
          </h1>
          <p className="text-gray-500 mt-1">
            Authorization Management • {stats.total} สิทธิ์ที่มีผลบังคับใช้
          </p>
        </div>
        <DxButton
          text="มอบสิทธิ์ใหม่"
          icon="add"
          type="default"
          stylingMode="contained"
          onClick={() => setShowGrantPopup(true)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">สิทธิ์ทั้งหมด</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.batchRelease}</p>
              <p className="text-sm text-gray-500">ปล่อยผ่านชุด</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.sopApproval}</p>
              <p className="text-sm text-gray-500">อนุมัติ SOP</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.delegations}</p>
              <p className="text-sm text-gray-500">การมอบอำนาจ</p>
            </div>
          </div>
        </div>
      </div>

      {/* DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <DataGrid
          dataSource={authorizations}
          keyExpr="id"
          showBorders={false}
          showRowLines
          rowAlternationEnabled
          columnAutoWidth
          height={600}
          hoverStateEnabled
          loadPanel={{ enabled: isLoading }}
        >
          <SearchPanel visible placeholder="ค้นหา..." width={250} />
          <HeaderFilter visible />
          <FilterRow visible />
          <Scrolling mode="virtual" />
          <Paging defaultPageSize={20} />
          <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />

          <Toolbar>
            <Item name="searchPanel" />
          </Toolbar>

          <Column dataField="employeeName" caption="พนักงาน" minWidth={180} />
          <Column
            dataField="authType"
            caption="ประเภทสิทธิ์"
            width={180}
            cellRender={renderAuthTypeCell}
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
            width={100}
            cellRender={renderStatusCell}
            alignment="center"
          />
          <Column
            caption="มอบอำนาจ"
            width={110}
            cellRender={renderDelegationsCell}
            alignment="center"
          />
          <Column
            caption="การดำเนินการ"
            width={100}
            cellRender={renderActionsCell}
            alignment="center"
          />
        </DataGrid>
      </div>

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
            displayExpr="label"
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
            <DateBox
              value={newAuth.effectiveFrom}
              onValueChanged={(e) =>
                setNewAuth((prev) => ({
                  ...prev,
                  effectiveFrom: e.value ? new Date(e.value).toISOString().split('T')[0] : prev.effectiveFrom,
                }))
              }
              type="date"
              label="วันที่เริ่มต้น"
              labelMode="floating"
            />
            <DateBox
              value={newAuth.effectiveTo || null}
              onValueChanged={(e) =>
                setNewAuth((prev) => ({
                  ...prev,
                  effectiveTo: e.value ? new Date(e.value).toISOString().split('T')[0] : '',
                }))
              }
              type="date"
              label="วันที่สิ้นสุด (ถ้ามี)"
              labelMode="floating"
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
            <DateBox
              value={newDelegation.effectiveFrom}
              onValueChanged={(e) =>
                setNewDelegation((prev) => ({
                  ...prev,
                  effectiveFrom: e.value ? new Date(e.value).toISOString().split('T')[0] : prev.effectiveFrom,
                }))
              }
              type="date"
              label="วันที่เริ่มต้น"
              labelMode="floating"
            />
            <DateBox
              value={newDelegation.effectiveTo || null}
              onValueChanged={(e) =>
                setNewDelegation((prev) => ({
                  ...prev,
                  effectiveTo: e.value ? new Date(e.value).toISOString().split('T')[0] : '',
                }))
              }
              type="date"
              label="วันที่สิ้นสุด"
              labelMode="floating"
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
