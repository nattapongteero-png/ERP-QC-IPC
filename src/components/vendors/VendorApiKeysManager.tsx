'use client';

/**
 * Vendor API Keys Manager Component
 *
 * Manages API keys for external vendor ERP integration.
 * Supports creating, viewing, and revoking API keys.
 *
 * Feature: VMI Vendor ERP Integration APIs
 */

import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import notify from 'devextreme/ui/notify';

// ============================================
// Types
// ============================================

interface VendorApiKey {
  id: number;
  keyPrefix: string;
  name: string;
  permissions: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CreateApiKeyResult {
  id: number;
  apiKey: string;
  keyPrefix: string;
  name: string;
  vendorId: number;
}

interface CreateApiKeyForm {
  name: string;
  permissions: 'read' | 'write' | 'admin';
  expiresInDays?: number;
}

interface VendorApiKeysManagerProps {
  vendorId: number;
}

// ============================================
// API Functions
// ============================================

async function fetchApiKeys(vendorId: number): Promise<VendorApiKey[]> {
  const response = await fetch(`/api/vendors/${vendorId}/api-keys`);
  if (!response.ok) {
    throw new Error('Failed to fetch API keys');
  }
  return response.json();
}

async function createApiKey(
  vendorId: number,
  data: CreateApiKeyForm
): Promise<CreateApiKeyResult> {
  const response = await fetch(`/api/vendors/${vendorId}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create API key');
  }
  return response.json();
}

async function revokeApiKey(vendorId: number, keyId: number): Promise<void> {
  const response = await fetch(`/api/vendors/${vendorId}/api-keys`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyId }),
  });
  if (!response.ok) {
    throw new Error('Failed to revoke API key');
  }
}

// ============================================
// Component
// ============================================

export function VendorApiKeysManager({ vendorId }: VendorApiKeysManagerProps) {
  const queryClient = useQueryClient();
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showKeyPopup, setShowKeyPopup] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateApiKeyForm>({
    name: '',
    permissions: 'read',
    expiresInDays: undefined,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor-api-keys', vendorId],
    queryFn: () => fetchApiKeys(vendorId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateApiKeyForm) => createApiKey(vendorId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-api-keys', vendorId] });
      setShowCreatePopup(false);
      setNewApiKey(result.apiKey);
      setShowKeyPopup(true);
      setFormData({ name: '', permissions: 'read', expiresInDays: undefined });
      notify('API key created successfully', 'success', 3000);
    },
    onError: (error) => {
      notify(`Failed to create API key: ${error.message}`, 'error', 5000);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: number) => revokeApiKey(vendorId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-api-keys', vendorId] });
      notify('API key revoked successfully', 'success', 3000);
    },
    onError: (error) => {
      notify(`Failed to revoke API key: ${error.message}`, 'error', 5000);
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      notify('Name is required', 'error', 3000);
      return;
    }
    createMutation.mutate(formData);
  };

  const handleRevoke = (keyId: number) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      revokeMutation.mutate(keyId);
    }
  };

  const permissionsOptions = [
    { value: 'read', text: 'Read Only' },
    { value: 'write', text: 'Read/Write' },
    { value: 'admin', text: 'Admin' },
  ];

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'keyPrefix',
      caption: 'Key Prefix',
      width: 150,
    },
    {
      dataField: 'name',
      caption: 'Name',
      width: 200,
    },
    {
      dataField: 'permissions',
      caption: 'Permissions',
      width: 120,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const perm = cellInfo.value as string;
        const labels: Record<string, string> = {
          read: 'Read Only',
          write: 'Read/Write',
          admin: 'Admin',
        };
        return labels[perm] || perm;
      },
    },
    {
      dataField: 'isActive',
      caption: 'Status',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const isActive = cellInfo.value as boolean;
        return (
          <span className={isActive ? 'text-green-600' : 'text-gray-400'}>
            {isActive ? 'Active' : 'Revoked'}
          </span>
        );
      },
    },
    {
      dataField: 'lastUsedAt',
      caption: 'Last Used',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleString();
      },
    },
    {
      dataField: 'expiresAt',
      caption: 'Expires',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return 'Never';
        const expiryDate = new Date(cellInfo.value as string);
        const now = new Date();
        const isExpired = expiryDate < now;
        return (
          <span className={isExpired ? 'text-red-600' : ''}>
            {expiryDate.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      dataField: 'createdAt',
      caption: 'Created',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleDateString();
      },
    },
    {
      caption: 'Actions',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const apiKey = cellInfo.data as VendorApiKey;
        if (!apiKey.isActive) return null;
        return (
          <DxButton
            text="Revoke"
            type="danger"
            stylingMode="text"
            onClick={() => handleRevoke(apiKey.id)}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">API Keys</h3>
        <div className="flex gap-2">
          <DxButton
            text="Create API Key"
            type="default"
            icon="plus"
            onClick={() => setShowCreatePopup(true)}
          />
          <DxButton
            icon="refresh"
            type="normal"
            onClick={() => refetch()}
            hint="Refresh"
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
          {error instanceof Error ? error.message : 'Failed to load API keys'}
        </div>
      )}

      {/* Data Grid */}
      <DxDataGrid
        dataSource={data || []}
        columns={columns}
        keyExpr="id"
        loading={isLoading}
        height={400}
        paging
        pageSize={10}
        sorting
        filterRow
        noDataText="No API keys found. Create one to get started."
      />

      {/* Create API Key Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => setShowCreatePopup(false)}
        dragEnabled={false}
        hideOnOutsideClick={false}
        showTitle={true}
        title="Create API Key"
        width={500}
        height={350}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g., Production Server"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Permissions</label>
            <SelectBox
              dataSource={permissionsOptions}
              displayExpr="text"
              valueExpr="value"
              value={formData.permissions}
              onValueChanged={(e) =>
                setFormData({ ...formData, permissions: e.value as 'read' | 'write' | 'admin' })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Expires In (days, optional)</label>
            <NumberBox
              value={formData.expiresInDays}
              onValueChanged={(e) =>
                setFormData({ ...formData, expiresInDays: e.value || undefined })
              }
              min={1}
              max={365}
              placeholder="Leave empty for no expiration"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="Cancel"
              type="normal"
              onClick={() => setShowCreatePopup(false)}
            />
            <DxButton
              text={createMutation.isPending ? 'Creating...' : 'Create'}
              type="default"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            />
          </div>
        </div>
      </Popup>

      {/* Show New API Key Popup (only shown once!) */}
      <Popup
        visible={showKeyPopup}
        onHiding={() => {
          setShowKeyPopup(false);
          setNewApiKey(null);
        }}
        dragEnabled={false}
        hideOnOutsideClick={false}
        showTitle={true}
        title="API Key Created"
        width={600}
        height={300}
      >
        <div className="p-4 space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800 font-medium">
              IMPORTANT: Copy this API key now. You won&apos;t be able to see it again!
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border rounded font-mono text-sm"
                value={newApiKey || ''}
                readOnly
              />
              <DxButton
                text="Copy"
                type="default"
                onClick={() => {
                  if (newApiKey) {
                    navigator.clipboard.writeText(newApiKey);
                    notify('API key copied to clipboard', 'success', 2000);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <DxButton
              text="Close"
              type="default"
              onClick={() => {
                setShowKeyPopup(false);
                setNewApiKey(null);
              }}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

export default VendorApiKeysManager;
