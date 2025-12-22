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
    label: 'Class I',
    description: 'Serious health hazard or death possible',
  },
  {
    value: 'class_ii',
    label: 'Class II',
    description: 'May cause temporary health problems',
  },
  {
    value: 'class_iii',
    label: 'Class III',
    description: 'Unlikely to cause health problems',
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
  const response = await fetch('/api/users?role=qc&limit=100');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.users || [];
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
      newErrors.reason = 'Reason must be at least 10 characters';
    }
    if (!formData.productId) {
      newErrors.productId = 'Product is required';
    }
    if (formData.affectedLots.length === 0) {
      newErrors.affectedLots = 'At least one lot must be selected';
    }
    if (!formData.coordinatorId) {
      newErrors.coordinatorId = 'Coordinator is required';
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
        <label className="text-sm font-medium">Recall Classification *</label>
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
        <label className="text-sm font-medium">Product *</label>
        <DxSelectBox
          dataSource={products}
          valueExpr="id"
          displayExpr="name"
          value={formData.productId || null}
          onValueChanged={(e) => handleProductChange(e.value || 0)}
          placeholder="Select product..."
          searchEnabled
          showClearButton
        />
        {errors.productId && (
          <p className="text-xs text-destructive">{errors.productId}</p>
        )}
      </div>

      {/* Affected Lots */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Affected Lots *</label>
        <DxTagBox
          dataSource={lots}
          valueExpr="id"
          displayExpr="lotNumber"
          value={formData.affectedLots}
          onValueChanged={(e) =>
            setFormData({ ...formData, affectedLots: e.value || [] })
          }
          placeholder="Select affected lots..."
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
        <label className="text-sm font-medium">Reason for Recall *</label>
        <DxTextArea
          value={formData.reason}
          onValueChange={(value) => setFormData({ ...formData, reason: value || '' })}
          placeholder="Describe the reason for this recall..."
          height={100}
        />
        {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
      </div>

      {/* Coordinator */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Recall Coordinator *</label>
        <DxSelectBox
          dataSource={users}
          valueExpr="id"
          displayExpr="name"
          value={formData.coordinatorId || null}
          onValueChanged={(e) =>
            setFormData({ ...formData, coordinatorId: e.value || 0 })
          }
          placeholder="Select coordinator..."
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
        <DxButton text="Cancel" onClick={onCancel} stylingMode="outlined" />
        <DxButton
          text="Initiate Recall"
          onClick={handleSubmit}
          type="danger"
          disabled={createMutation.isPending}
        />
      </div>
    </div>
  );
}
