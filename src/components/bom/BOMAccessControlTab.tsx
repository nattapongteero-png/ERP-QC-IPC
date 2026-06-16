'use client';

/**
 * BOM Access Control Tab Component
 * Manages who has access to view confidential items in a BOM.
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Info,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import type {
  BOMConfidentialAccess,
  ConfidentialAccessGroup,
} from '@/types/confidentiality';

// Props
export interface BOMAccessControlTabProps {
  bomId: number;
  canManage: boolean;
}

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
async function fetchAccessGrants(bomId: number): Promise<BOMConfidentialAccess[]> {
  const res = await fetch(`/api/bom/${bomId}/access`);
  if (!res.ok) throw new Error('Failed to fetch access grants');
  const data: ApiResponse<BOMConfidentialAccess[]> = await res.json();
  return data.data || [];
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users?limit=1000');
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.data?.items || data.data || [];
}

async function fetchGroups(): Promise<ConfidentialAccessGroup[]> {
  const res = await fetch('/api/admin/confidential-groups');
  if (!res.ok) throw new Error('Failed to fetch groups');
  const data: ApiResponse<ConfidentialAccessGroup[]> = await res.json();
  return data.data || [];
}

async function grantUserAccess(bomId: number, userId: number): Promise<BOMConfidentialAccess> {
  const res = await fetch(`/api/bom/${bomId}/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to grant user access');
  }
  const data: ApiResponse<BOMConfidentialAccess> = await res.json();
  return data.data;
}

async function grantGroupAccess(bomId: number, groupId: number): Promise<BOMConfidentialAccess> {
  const res = await fetch(`/api/bom/${bomId}/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to grant group access');
  }
  const data: ApiResponse<BOMConfidentialAccess> = await res.json();
  return data.data;
}

async function revokeAccess(bomId: number, grantId: number): Promise<void> {
  const res = await fetch(`/api/bom/${bomId}/access?grantId=${grantId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to revoke access');
  }
}

/**
 * BOM Access Control Tab
 * Displays and manages access grants for a BOM's confidential items.
 */
export function BOMAccessControlTab({ bomId, canManage }: BOMAccessControlTabProps) {
  const queryClient = useQueryClient();

  // Dialog states
  const [showAddUserDialog, setShowAddUserDialog] = React.useState(false);
  const [showAddGroupDialog, setShowAddGroupDialog] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = React.useState(false);
  const [grantToRevoke, setGrantToRevoke] = React.useState<BOMConfidentialAccess | null>(null);

  // Query for access grants
  const {
    data: grants = [],
    isLoading: isLoadingGrants,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['bom-access-grants', bomId],
    queryFn: () => fetchAccessGrants(bomId),
    enabled: bomId > 0,
  });

  // Query for users (for add user dialog)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: showAddUserDialog,
  });

  // Query for groups (for add group dialog)
  const { data: groups = [] } = useQuery({
    queryKey: ['confidential-access-groups'],
    queryFn: fetchGroups,
    enabled: showAddGroupDialog,
  });

  // Filter out users who already have access
  const availableUsers = React.useMemo(() => {
    const grantedUserIds = new Set(
      grants.filter((g) => g.userId).map((g) => g.userId!)
    );
    return users.filter((u) => !grantedUserIds.has(u.id));
  }, [users, grants]);

  // Filter out groups that already have access
  const availableGroups = React.useMemo(() => {
    const grantedGroupIds = new Set(
      grants.filter((g) => g.groupId).map((g) => g.groupId!)
    );
    return groups.filter((g) => !grantedGroupIds.has(g.id));
  }, [groups, grants]);

  // Grant user access mutation
  const grantUserMutation = useMutation({
    mutationFn: (userId: number) => grantUserAccess(bomId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-access-grants', bomId] });
      notify('User access granted successfully', 'success', 3000);
      setShowAddUserDialog(false);
      setSelectedUserId(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Grant group access mutation
  const grantGroupMutation = useMutation({
    mutationFn: (groupId: number) => grantGroupAccess(bomId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-access-grants', bomId] });
      notify('Group access granted successfully', 'success', 3000);
      setShowAddGroupDialog(false);
      setSelectedGroupId(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Revoke access mutation
  const revokeMutation = useMutation({
    mutationFn: (grantId: number) => revokeAccess(bomId, grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-access-grants', bomId] });
      notify('Access revoked successfully', 'success', 3000);
      setShowRevokeConfirm(false);
      setGrantToRevoke(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Handlers
  const openAddUserDialog = () => {
    setSelectedUserId(null);
    setShowAddUserDialog(true);
  };

  const closeAddUserDialog = () => {
    setShowAddUserDialog(false);
    setSelectedUserId(null);
  };

  const handleAddUser = () => {
    if (selectedUserId) {
      grantUserMutation.mutate(selectedUserId);
    }
  };

  const openAddGroupDialog = () => {
    setSelectedGroupId(null);
    setShowAddGroupDialog(true);
  };

  const closeAddGroupDialog = () => {
    setShowAddGroupDialog(false);
    setSelectedGroupId(null);
  };

  const handleAddGroup = () => {
    if (selectedGroupId) {
      grantGroupMutation.mutate(selectedGroupId);
    }
  };

  const handleRevoke = (grant: BOMConfidentialAccess) => {
    setGrantToRevoke(grant);
    setShowRevokeConfirm(true);
  };

  const confirmRevoke = () => {
    if (grantToRevoke) {
      revokeMutation.mutate(grantToRevoke.id);
    }
  };

  // Render functions
  const renderTypeCell = (cellData: { data: BOMConfidentialAccess }) => {
    const isUser = !!cellData.data.userId;
    return (
      <div className="flex items-center gap-2">
        {isUser ? (
          <>
            <UserPlus className="h-4 w-4 text-blue-500" />
            <span className="text-blue-700 font-medium">User</span>
          </>
        ) : (
          <>
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="text-amber-700 font-medium">Group</span>
          </>
        )}
      </div>
    );
  };

  const renderNameCell = (cellData: { data: BOMConfidentialAccess }) => {
    if (cellData.data.userId) {
      return (
        <div>
          <div className="font-medium text-gray-900">
            {cellData.data.userName || 'Unknown User'}
          </div>
          {cellData.data.userEmail && (
            <div className="text-sm text-gray-500">{cellData.data.userEmail}</div>
          )}
        </div>
      );
    } else {
      return (
        <div>
          <div className="font-medium text-gray-900">
            {cellData.data.groupName || 'Unknown Group'}
          </div>
          {cellData.data.groupCode && (
            <div className="text-sm text-gray-500 font-mono">
              {cellData.data.groupCode}
            </div>
          )}
        </div>
      );
    }
  };

  const renderGrantedByCell = (cellData: { data: BOMConfidentialAccess }) => {
    return cellData.data.grantedByName || `User #${cellData.data.grantedBy}`;
  };

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

  const renderActionsCell = (cellData: { data: BOMConfidentialAccess }) => {
    if (!canManage) return null;

    return (
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRevoke(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Revoke Access"
          data-testid={`revoke-btn-${cellData.data.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  // Get display name for revoke confirmation
  const getRevokeTargetName = (grant: BOMConfidentialAccess | null): string => {
    if (!grant) return '';
    if (grant.userId) {
      return grant.userName || grant.userEmail || `User #${grant.userId}`;
    } else {
      return grant.groupName || grant.groupCode || `Group #${grant.groupId}`;
    }
  };

  return (
    <div className="space-y-4" data-testid="bom-access-control-tab">
      {/* Read-only notice */}
      {!canManage && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            You can view access grants but cannot modify them.
          </p>
        </div>
      )}

      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Access Control</h3>
          <span className="px-2 py-0.5 bg-gray-100 rounded text-sm text-gray-600">
            {grants.length} {grants.length === 1 ? 'grant' : 'grants'}
          </span>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              text="Refresh"
              icon="refresh"
              stylingMode="text"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="refresh-access-btn"
            />
            <Button
              text="Add User"
              icon="user"
              type="default"
              onClick={openAddUserDialog}
              disabled={isLoadingGrants}
              data-testid="add-user-access-btn"
            />
            <Button
              text="Add Group"
              icon="group"
              type="default"
              onClick={openAddGroupDialog}
              disabled={isLoadingGrants}
              data-testid="add-group-access-btn"
            />
          </div>
        )}
      </div>

      {/* Access grants DataGrid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={grants}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            className="min-h-[300px]"
            data-testid="access-grants-grid"
            noDataText="No access grants configured. Add users or groups to allow access to confidential items."
          >
            <LoadPanel enabled={isLoadingGrants} />
            <Sorting mode="multiple" />
            <Paging defaultPageSize={10} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[5, 10, 20, 50]}
              showInfo
              showNavigationButtons
            />

            <Column
              caption="Type"
              width={100}
              cellRender={renderTypeCell}
              allowFiltering={false}
              allowSorting={false}
            />
            <Column
              caption="Name"
              minWidth={250}
              cellRender={renderNameCell}
              allowFiltering={false}
            />
            <Column
              caption="Granted By"
              width={150}
              cellRender={renderGrantedByCell}
            />
            <Column
              dataField="grantedAt"
              caption="Granted At"
              width={180}
              cellRender={renderDateCell}
            />
            {canManage && (
              <Column
                caption="Actions"
                width={80}
                cellRender={renderActionsCell}
                allowFiltering={false}
                allowSorting={false}
                alignment="center"
              />
            )}
          </DataGrid>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <DxPopup
        visible={showAddUserDialog}
        onVisibleChange={setShowAddUserDialog}
        title="Grant User Access"
        width={500}
        height="auto"
        showCloseButton
        toolbarItems={[
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: grantUserMutation.isPending ? 'Granting...' : 'Grant Access',
              type: 'success',
              onClick: handleAddUser,
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: 'Cancel',
              stylingMode: 'outlined',
              onClick: closeAddUserDialog,
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
              data-testid="user-access-select"
            />
            {availableUsers.length === 0 && users.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                All users already have access to this BOM.
              </p>
            )}
          </div>
          {selectedUserId && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <UserPlus className="inline-block h-4 w-4 mr-1" />
                Selected user will be granted access to view confidential items in this BOM.
              </p>
            </div>
          )}
        </div>
      </DxPopup>

      {/* Add Group Dialog */}
      <DxPopup
        visible={showAddGroupDialog}
        onVisibleChange={setShowAddGroupDialog}
        title="Grant Group Access"
        width={500}
        height="auto"
        showCloseButton
        toolbarItems={[
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: grantGroupMutation.isPending ? 'Granting...' : 'Grant Access',
              type: 'success',
              onClick: handleAddGroup,
            },
          },
          {
            widget: 'dxButton',
            toolbar: 'bottom',
            location: 'after',
            options: {
              text: 'Cancel',
              stylingMode: 'outlined',
              onClick: closeAddGroupDialog,
            },
          },
        ]}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Group <span className="text-red-500">*</span>
            </label>
            <SelectBox
              dataSource={availableGroups}
              valueExpr="id"
              displayExpr={(item: ConfidentialAccessGroup | null) => {
                if (!item) return '';
                return `${item.name} (${item.code})`;
              }}
              value={selectedGroupId}
              onValueChanged={(e) => setSelectedGroupId(e.value)}
              searchEnabled
              searchExpr={['name', 'code']}
              searchMode="contains"
              placeholder="Search and select a group..."
              showClearButton
              noDataText="No groups available"
              data-testid="group-access-select"
            />
            {availableGroups.length === 0 && groups.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                All groups already have access to this BOM.
              </p>
            )}
          </div>
          {selectedGroupId && (
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-700">
                <Shield className="inline-block h-4 w-4 mr-1" />
                All members of this group will be granted access to view confidential items in this BOM.
              </p>
            </div>
          )}
        </div>
      </DxPopup>

      {/* Revoke Confirmation Dialog */}
      <DxConfirmDialog
        visible={showRevokeConfirm}
        onConfirm={confirmRevoke}
        onCancel={() => {
          setShowRevokeConfirm(false);
          setGrantToRevoke(null);
        }}
        title="Revoke Access"
        message={`Are you sure you want to revoke access for "${getRevokeTargetName(grantToRevoke)}"? They will no longer be able to view confidential items in this BOM.`}
        confirmText={revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
        confirmType="danger"
      />
    </div>
  );
}

export default BOMAccessControlTab;
