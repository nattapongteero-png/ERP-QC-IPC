'use client';

/**
 * Recall Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Form for creating and editing recalls.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import type { Recall, RecallCreate, RecallClass } from '@/types/recalls';

interface RecallFormProps {
  recall?: Recall;
  complaintId?: number;
  onSave: () => void;
  onCancel: () => void;
}

interface Product {
  id: number;
  name: string;
  code: string;
}

interface Lot {
  id: number;
  lotNumber: string;
  itemId: number;
}

interface User {
  id: number;
  name: string;
}

const recallClasses: { value: RecallClass; label: string; description: string }[] = [
  {
    value: 'class_i',
    label: 'ระดับ 1 (Class I)',
    description: 'อันตรายร้ายแรงต่อสุขภาพหรืออาจถึงแก่ชีวิต',
  },
  {
    value: 'class_ii',
    label: 'ระดับ 2 (Class II)',
    description: 'อาจก่อให้เกิดปัญหาสุขภาพชั่วคราว',
  },
  {
    value: 'class_iii',
    label: 'ระดับ 3 (Class III)',
    description: 'ไม่น่าจะก่อให้เกิดปัญหาสุขภาพ',
  },
];

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch('/api/items?category=finished_goods&limit=100');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.items || [];
}

async function fetchLots(productId: number): Promise<Lot[]> {
  const response = await fetch(`/api/inventory/lots?itemId=${productId}&limit=100`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.lots || [];
}

async function fetchUsers(): Promise<User[]> {
  // Fetch ALL active users for the coordinator picker — filtering by role=qc
  // returned nothing (seed data has no qc-role users), leaving the required
  // dropdown empty. /api/users returns a paginated shape → data.items.
  const response = await fetch('/api/users?limit=200');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.items || result.data.users || [];
}

async function createRecall(data: RecallCreate): Promise<Recall> {
  const response = await fetch('/api/recalls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

export function RecallForm({ recall, complaintId, onSave, onCancel }: RecallFormProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    recallClass: recall?.recallClass || ('class_ii' as RecallClass),
    reason: recall?.reason || '',
    productId: recall?.productId || 0,
    affectedLots: recall?.affectedLots || ([] as number[]),
    coordinatorId: recall?.coordinatorId || 0,
    complaintId: complaintId || recall?.complaintId || undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products-finished'],
    queryFn: fetchProducts,
  });

  // Fetch lots when product changes
  const { data: lots = [] } = useQuery({
    queryKey: ['lots', formData.productId],
    queryFn: () => fetchLots(formData.productId),
    enabled: formData.productId > 0,
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users-qc'],
    queryFn: fetchUsers,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createRecall,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recalls'] });
      onSave();
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.reason || formData.reason.length < 10) {
      newErrors.reason = 'เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร';
    }
    if (!formData.productId) {
      newErrors.productId = 'กรุณาเลือกผลิตภัณฑ์';
    }
    if (formData.affectedLots.length === 0) {
      newErrors.affectedLots = 'ต้องเลือกอย่างน้อยหนึ่งล็อต';
    }
    if (!formData.coordinatorId) {
      newErrors.coordinatorId = 'กรุณาเลือกผู้ประสานงาน';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const data: RecallCreate = {
      recallClass: formData.recallClass,
      reason: formData.reason,
      productId: formData.productId,
      affectedLots: formData.affectedLots,
      coordinatorId: formData.coordinatorId,
      complaintId: formData.complaintId,
    };

    createMutation.mutate(data);
  };

  // Handle product change - clears affected lots when product changes
  const handleProductChange = (productId: number) => {
    setFormData({ ...formData, productId, affectedLots: [] });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Recall Class */}
      <div className="space-y-2">
        <label className="text-sm font-medium">ระดับการเรียกคืน *</label>
        <div className="grid grid-cols-1 gap-2">
          {recallClasses.map((cls) => (
            <button
              key={cls.value}
              type="button"
              onClick={() => setFormData({ ...formData, recallClass: cls.value })}
              className={`p-3 rounded-lg border text-left transition-colors ${
                formData.recallClass === cls.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">{cls.label}</div>
              <div className="text-xs text-muted-foreground">{cls.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Product */}
      <div className="space-y-2">
        <label className="text-sm font-medium">ผลิตภัณฑ์ *</label>
        <DxSelectBox
          dataSource={products as unknown as Record<string, unknown>[]}
          valueExpr="id"
          displayExpr="name"
          value={formData.productId || null}
          onValueChanged={(e) => handleProductChange(e.value || 0)}
          placeholder="เลือกผลิตภัณฑ์..."
          searchEnabled
          showClearButton
        />
        {errors.productId && (
          <p className="text-xs text-destructive">{errors.productId}</p>
        )}
      </div>

      {/* Affected Lots */}
      <div className="space-y-2">
        <label className="text-sm font-medium">ล็อตที่ได้รับผลกระทบ *</label>
        <DxTagBox
          dataSource={lots as unknown as Record<string, unknown>[]}
          valueExpr="id"
          displayExpr="lotNumber"
          value={formData.affectedLots}
          onValueChanged={(e) =>
            setFormData({ ...formData, affectedLots: e.value || [] })
          }
          placeholder="เลือกล็อตที่ได้รับผลกระทบ..."
          searchEnabled
          showSelectionControls
          disabled={!formData.productId}
        />
        {errors.affectedLots && (
          <p className="text-xs text-destructive">{errors.affectedLots}</p>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <label className="text-sm font-medium">เหตุผลการเรียกคืน *</label>
        <DxTextArea
          value={formData.reason}
          onValueChange={(value) => setFormData({ ...formData, reason: value || '' })}
          placeholder="อธิบายเหตุผลของการเรียกคืนนี้..."
          height={100}
        />
        {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
      </div>

      {/* Coordinator */}
      <div className="space-y-2">
        <label className="text-sm font-medium">ผู้ประสานงานการเรียกคืน *</label>
        <DxSelectBox
          dataSource={users as unknown as Record<string, unknown>[]}
          valueExpr="id"
          displayExpr="name"
          value={formData.coordinatorId || null}
          onValueChanged={(e) =>
            setFormData({ ...formData, coordinatorId: e.value || 0 })
          }
          placeholder="เลือกผู้ประสานงาน..."
          searchEnabled
        />
        {errors.coordinatorId && (
          <p className="text-xs text-destructive">{errors.coordinatorId}</p>
        )}
      </div>

      {/* Error Message */}
      {createMutation.error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {createMutation.error.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <DxButton text="ยกเลิก" onClick={onCancel} stylingMode="outlined" />
        <DxButton
          text="เริ่มการเรียกคืน"
          onClick={handleSubmit}
          type="danger"
          disabled={createMutation.isPending}
        />
      </div>
    </div>
  );
}
