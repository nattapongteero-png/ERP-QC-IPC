'use client';

/**
 * Group Members Management Page
 * Manage members of a confidential access group.
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import {
  Users,
  ArrowLeft,
  UserPlus,
  Trash2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  HeaderFilter,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import type {
  ConfidentialAccessGroup,
  ConfidentialAccessGroupMember,
} from '@/types/confidentiality';

// Types
interface User {
  id: number;
  email: string;
  name: string;
  role?: string;
  department?: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

// API functions
async function fetchGroup(groupId: number): Promise<ConfidentialAccessGroup> {
  const res = await fetch(`/api/admin/confidential-groups/${groupId}`);
  if (!res.ok) throw new Error('Failed to fetch group');
  const data: ApiResponse<ConfidentialAccessGroup> = await res.json();
  return data.data;
}

async function fetchMembers(groupId: number): Promise<ConfidentialAccessGroupMember[]> {
  const res = await fetch(`/api/admin/confidential-groups/${groupId}/members`);
  if (!res.ok) throw new Error('Failed to fetch members');
  const data: ApiResponse<ConfidentialAccessGroupMember[]> = await res.json();
  return data.data || [];
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?limit=1000');
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.data?.items || data.data || [];
}

async function addMember(groupId: number, userId: number): Promise<ConfidentialAccessGroupMember> {
  const res = await fetch(`/api/admin/confidential-groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to add member');
  }
  const data: ApiResponse<ConfidentialAccessGroupMember> = await res.json();
  return data.data;
}

async function removeMember(groupId: number, userId: number): Promise<void> {
  const res = await fetch(`/api/admin/confidential-groups/${groupId}/members?userId=${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to remove member');
  }
}

// Breadcrumb component
function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  const router = useRouter();

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-500" data-testid="breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
          {item.href ? (
            <button
              onClick={() => router.push(item.href!)}
              className="hover:text-gray-900 transition-colors"
              data-testid={`breadcrumb-${index}`}
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium" data-testid={`breadcrumb-${index}`}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// Page header component
function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  onBack,
  onRefresh,
  isRefreshing,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconClassName?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconClassName || 'from-blue-500 to-indigo-600'} text-white shadow-lg`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <Button
            icon={isRefreshing ? 'spindown' : 'refresh'}
            stylingMode="text"
            hint="Refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            data-testid="refresh-btn"
          />
        )}
        {actions}
      </div>
    </div>
  );
}

export default function GroupMembersPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = Number(params?.id);
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<ConfidentialAccessGroupMember | null>(null);

  // Query for group info
  const { data: group, isLoading: isLoadingGroup } = useQuery({
    queryKey: ['confidential-access-group', groupId],
    queryFn: () => fetchGroup(groupId),
    enabled: !isNaN(groupId),
  });

  // Query for members
  const { data: members = [], isLoading: isLoadingMembers, refetch, isFetching } = useQuery({
    queryKey: ['confidential-access-group-members', groupId],
    queryFn: () => fetchMembers(groupId),
    enabled: !isNaN(groupId),
  });

  // Query for users (for add member dialog)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  // Filter out users who are already members
  const availableUsers = React.useMemo(() => {
    const memberUserIds = new Set(members.map((m) => m.userId));
    return users.filter((u) => !memberUserIds.has(u.id));
  }, [users, members]);

  // Add member mutation
  const addMutation = useMutation({
    mutationFn: (userId: number) => addMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidential-access-group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['confidential-access-groups'] });
      notify('Member added successfully', 'success', 3000);
      setShowAddDialog(false);
      setSelectedUserId(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confidential-access-group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['confidential-access-groups'] });
      notify('Member removed successfully', 'success', 3000);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Handlers
  const handleBack = () => {
    router.push('/admin/confidential-groups');
  };

  const openAddDialog = () => {
    setSelectedUserId(null);
    setShowAddDialog(true);
  };

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setSelectedUserId(null);
  };

  const handleAddMember = () => {
    if (selectedUserId) {
      addMutation.mutate(selectedUserId);
    }
  };

  const handleRemove = (member: ConfidentialAccessGroupMember) => {
    setMemberToRemove(member);
    setShowRemoveConfirm(true);
  };

  const confirmRemove = () => {
    if (memberToRemove) {
      removeMutation.mutate(memberToRemove.userId);
    }
  };

  // Render functions
  const renderDateCell = (cellData: { value?: string | Date }) => {
    if (!cellData.value) return '-';
    const date = new Date(cellData.value);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderActionsCell = (cellData: { data: ConfidentialAccessGroupMember }) => {
    return (
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Remove Member"
          data-testid={`remove-btn-${cellData.data.userId}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const isLoading = isLoadingGroup || isLoadingMembers;

  if (isNaN(groupId)) {
    return (
      <div className="space-y-6 p-1">
        <PageHeader
          title="Invalid Group"
          icon={ShieldCheck}
          iconClassName="from-red-500 to-red-600"
          onBack={handleBack}
        />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Invalid group ID</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Confidential Groups', href: '/admin/confidential-groups' },
          { label: group?.name || 'Loading...', href: `/admin/confidential-groups/${groupId}` },
          { label: 'Members' },
        ]}
      />

      {/* Header */}
      <PageHeader
        title={group ? `Group Members - ${group.name}` : 'Loading...'}
        subtitle={group ? `Manage members of ${group.code}` : undefined}
        icon={Users}
        iconClassName="from-blue-500 to-indigo-600"
        onBack={handleBack}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text="Add Member"
            icon="add"
            type="success"
            onClick={openAddDialog}
            disabled={isLoading}
            data-testid="add-member-btn"
          />
        }
      />

      {/* Group Info Card */}
      {group && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                <div>
                  <span className="text-sm text-gray-500">Group Code:</span>
                  <span className="ml-2 font-mono font-medium text-gray-900">{group.code}</span>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <span className="text-sm text-gray-500">Name:</span>
                <span className="ml-2 font-medium text-gray-900">{group.name}</span>
              </div>
              {group.description && (
                <>
                  <div className="h-8 w-px bg-gray-200" />
                  <div>
                    <span className="text-sm text-gray-500">Description:</span>
                    <span className="ml-2 text-gray-700">{group.description}</span>
                  </div>
                </>
              )}
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 font-semibold">{members.length}</span>
                <span className="text-blue-600 text-sm">members</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members DataGrid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={members}
            keyExpr="userId"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            className="min-h-[400px]"
            data-testid="members-grid"
          >
            <LoadPanel enabled={isLoading} />
            <FilterRow visible />
            <HeaderFilter visible />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Column dataField="userId" caption="User ID" width={80} />
            <Column dataField="userName" caption="User Name" minWidth={200} />
            <Column dataField="userEmail" caption="Email" minWidth={250} />
            <Column
              dataField="addedAt"
              caption="Added At"
              width={180}
              cellRender={renderDateCell}
            />
            <Column dataField="addedBy" caption="Added By" width={100} />
            <Column
              caption="Actions"
              width={80}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <DxPopup
        visible={showAddDialog}
        onVisibleChange={setShowAddDialog}
        title="Add Member to Group"
        width={500}
        height="auto"
        showCloseButton
        toolbarItems={[
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: addMutation.isPending ? 'Adding...' : 'Add',
              type: 'success',
              onClick: handleAddMember,
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: 'Cancel',
              stylingMode: 'outlined',
              onClick: closeAddDialog,
            },
          },
        ]}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User <span className="text-red-500">*</span>
            </label>
            <SelectBox
              dataSource={availableUsers}
              valueExpr="id"
              displayExpr={(item: User | null) => {
                if (!item) return '';
                return `${item.name} (${item.email})`;
              }}
              value={selectedUserId}
              onValueChanged={(e) => setSelectedUserId(e.value)}
              searchEnabled
              searchExpr={['name', 'email']}
              searchMode="contains"
              placeholder="Search and select a user..."
              showClearButton
              noDataText="No users available"
              data-testid="user-select"
            />
            {availableUsers.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">
                All users are already members of this group.
              </p>
            )}
          </div>
          {selectedUserId && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <UserPlus className="inline-block h-4 w-4 mr-1" />
                Selected user will be added to <strong>{group?.name}</strong>
              </p>
            </div>
          )}
        </div>
      </DxPopup>

      {/* Remove Confirmation Dialog */}
      <DxConfirmDialog
        visible={showRemoveConfirm}
        onConfirm={confirmRemove}
        onCancel={() => {
          setShowRemoveConfirm(false);
          setMemberToRemove(null);
        }}
        title="Remove Member"
        message={`Are you sure you want to remove "${memberToRemove?.userName || memberToRemove?.userEmail}" from this group?`}
        confirmText={removeMutation.isPending ? 'Removing...' : 'Remove'}
        confirmType="danger"
      />
    </div>
  );
}
