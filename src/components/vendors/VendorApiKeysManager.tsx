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
      notify('สร้างคีย์ API สำเร็จ', 'success', 3000);
    },
    onError: (error) => {
      notify(`สร้างคีย์ API ไม่สำเร็จ: ${error.message}`, 'error', 5000);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: number) => revokeApiKey(vendorId, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-api-keys', vendorId] });
      notify('เพิกถอนคีย์ API สำเร็จ', 'success', 3000);
    },
    onError: (error) => {
      notify(`เพิกถอนคีย์ API ไม่สำเร็จ: ${error.message}`, 'error', 5000);
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      notify('กรุณากรอกชื่อ', 'error', 3000);
      return;
    }
    createMutation.mutate(formData);
  };

  const handleRevoke = (keyId: number) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการเพิกถอนคีย์ API นี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) {
      revokeMutation.mutate(keyId);
    }
  };

  const permissionsOptions = [
    { value: 'read', text: 'อ่านอย่างเดียว' },
    { value: 'write', text: 'อ่าน/เขียน' },
    { value: 'admin', text: 'ผู้ดูแลระบบ' },
  ];

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'keyPrefix',
      caption: 'คำนำหน้าคีย์',
      width: 150,
    },
    {
      dataField: 'name',
      caption: 'ชื่อ',
      width: 200,
    },
    {
      dataField: 'permissions',
      caption: 'สิทธิ์การใช้งาน',
      width: 120,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const perm = cellInfo.value as string;
        const labels: Record<string, string> = {
          read: 'อ่านอย่างเดียว',
          write: 'อ่าน/เขียน',
          admin: 'ผู้ดูแลระบบ',
        };
        return labels[perm] || perm;
      },
    },
    {
      dataField: 'isActive',
      caption: 'สถานะ',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const isActive = cellInfo.value as boolean;
        return (
          <span className={isActive ? 'text-green-600' : 'text-gray-400'}>
            {isActive ? 'ใช้งาน' : 'เพิกถอนแล้ว'}
          </span>
        );
      },
    },
    {
      dataField: 'lastUsedAt',
      caption: 'ใช้ล่าสุด',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleString();
      },
    },
    {
      dataField: 'expiresAt',
      caption: 'หมดอายุ',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return 'ไม่มีวันหมดอายุ';
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
      caption: 'สร้างเมื่อ',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleDateString();
      },
    },
    {
      caption: 'การดำเนินการ',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const apiKey = cellInfo.data as VendorApiKey;
        if (!apiKey.isActive) return null;
        return (
          <DxButton
            text="เพิกถอน"
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
        <h3 className="text-lg font-semibold">คีย์ API</h3>
        <div className="flex gap-2">
          <DxButton
            text="สร้างคีย์ API"
            type="default"
            icon="plus"
            onClick={() => setShowCreatePopup(true)}
          />
          <DxButton
            icon="refresh"
            type="normal"
            onClick={() => refetch()}
            hint="รีเฟรช"
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
          {error instanceof Error ? error.message : 'โหลดคีย์ API ไม่สำเร็จ'}
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
        noDataText="ไม่พบคีย์ API กรุณาสร้างคีย์เพื่อเริ่มต้นใช้งาน"
      />

      {/* Create API Key Popup */}
      <Popup
        visible={showCreatePopup}
        onHiding={() => setShowCreatePopup(false)}
        dragEnabled={false}
        hideOnOutsideClick={false}
        showTitle={true}
        title="สร้างคีย์ API"
        width={500}
        height={350}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อ *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded"
              placeholder="เช่น เซิร์ฟเวอร์ Production"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">สิทธิ์การใช้งาน</label>
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
            <label className="block text-sm font-medium mb-1">หมดอายุใน (วัน, ไม่บังคับ)</label>
            <NumberBox
              value={formData.expiresInDays}
              onValueChanged={(e) =>
                setFormData({ ...formData, expiresInDays: e.value || undefined })
              }
              min={1}
              max={365}
              placeholder="เว้นว่างไว้หากไม่มีวันหมดอายุ"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DxButton
              text="ยกเลิก"
              type="normal"
              onClick={() => setShowCreatePopup(false)}
            />
            <DxButton
              text={createMutation.isPending ? 'กำลังสร้าง...' : 'สร้าง'}
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
        title="สร้างคีย์ API แล้ว"
        width={600}
        height={300}
      >
        <div className="p-4 space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800 font-medium">
              สำคัญ: กรุณาคัดลอกคีย์ API นี้ทันที คุณจะไม่สามารถดูคีย์นี้ได้อีก!
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">คีย์ API</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border rounded font-mono text-sm"
                value={newApiKey || ''}
                readOnly
              />
              <DxButton
                text="คัดลอก"
                type="default"
                onClick={() => {
                  if (newApiKey) {
                    navigator.clipboard.writeText(newApiKey);
                    notify('คัดลอกคีย์ API ไปยังคลิปบอร์ดแล้ว', 'success', 2000);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <DxButton
              text="ปิด"
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
