'use client';

/**
 * Complaint Form Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Form for creating and editing complaints.
 */

import { useState } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type {
  Complaint,
  ComplaintCreate,
  ComplaintSource,
  ComplaintCategory,
  ComplaintSeverity,
} from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintFormProps {
  complaint?: Complaint | null;
  onSave?: (complaint: Complaint) => void;
  onCancel?: () => void;
}

interface FormData {
  receivedDate: string;
  source: ComplaintSource;
  customerName: string;
  customerContact: string;
  productId: number | null;
  lotId: number | null;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  description: string;
}

interface Product {
  id: number;
  code: string;
  nameTh: string;
  nameEn?: string | null;
}

interface Lot {
  id: number;
  lotNumber: string;
  itemId: number;
}

// ============================================
// API Functions
// ============================================

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch('/api/items?type=finished_goods&limit=100');
  const result = await response.json();
  if (!result.success) return [];
  return result.data?.items || [];
}

async function fetchLots(productId: number): Promise<Lot[]> {
  const response = await fetch(`/api/inventory/lots?itemId=${productId}`);
  const result = await response.json();
  if (!result.success) return [];
  return result.data || [];
}

async function createComplaint(data: ComplaintCreate): Promise<Complaint> {
  const response = await fetch('/api/complaints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create complaint');
  }
  return result.data;
}

async function updateComplaint(id: number, data: Partial<ComplaintCreate>): Promise<Complaint> {
  const response = await fetch(`/api/complaints/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update complaint');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function ComplaintForm({
  complaint,
  onSave,
  onCancel,
}: ComplaintFormProps) {
  const isEditing = !!complaint;

  // Form state
  const [formData, setFormData] = useState<FormData>({
    receivedDate: complaint?.receivedDate || new Date().toISOString().split('T')[0],
    source: complaint?.source || 'customer',
    customerName: complaint?.customerName || '',
    customerContact: complaint?.customerContact || '',
    productId: complaint?.productId || null,
    lotId: complaint?.lotId || null,
    category: complaint?.category || 'quality',
    severity: complaint?.severity || 'minor',
    description: complaint?.description || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-finished'],
    queryFn: fetchProducts,
  });

  // Fetch lots when product is selected
  const { data: lots } = useQuery({
    queryKey: ['lots', formData.productId],
    queryFn: () => fetchLots(formData.productId!),
    enabled: !!formData.productId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => createComplaint({
      receivedDate: formData.receivedDate,
      source: formData.source,
      customerName: formData.customerName || undefined,
      customerContact: formData.customerContact || undefined,
      productId: formData.productId!,
      lotId: formData.lotId || undefined,
      category: formData.category,
      severity: formData.severity,
      description: formData.description,
    }),
    onSuccess: (data) => {
      onSave?.(data);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<ComplaintCreate>) => updateComplaint(complaint!.id, data),
    onSuccess: (data) => {
      onSave?.(data);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.receivedDate) {
      newErrors.receivedDate = 'Received date is required';
    }
    if (!formData.productId) {
      newErrors.productId = 'Product is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validate()) return;

    if (isEditing) {
      updateMutation.mutate({
        severity: formData.severity,
      });
    } else {
      createMutation.mutate();
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Source options
  const sourceOptions = [
    { value: 'customer', label: 'Customer' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'regulatory', label: 'Regulatory Authority' },
    { value: 'internal', label: 'Internal' },
  ];

  // Category options
  const categoryOptions = [
    { value: 'quality', label: 'Quality' },
    { value: 'efficacy', label: 'Efficacy' },
    { value: 'safety', label: 'Safety' },
    { value: 'packaging', label: 'Packaging' },
    { value: 'labeling', label: 'Labeling' },
    { value: 'other', label: 'Other' },
  ];

  // Severity options
  const severityOptions = [
    { value: 'minor', label: 'Minor' },
    { value: 'major', label: 'Major' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Edit Complaint' : 'New Complaint'}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {errors.submit && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {errors.submit}
        </div>
      )}

      <div className="space-y-4">
        {/* Received Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Received Date <span className="text-destructive">*</span>
          </label>
          <DxDateBox
            value={formData.receivedDate || undefined}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                receivedDate: value ? new Date(value).toISOString().split('T')[0] : '',
              }))
            }
            type="date"
            displayFormat="yyyy-MM-dd"
            disabled={isEditing}
          />
          {errors.receivedDate && (
            <p className="text-sm text-destructive">{errors.receivedDate}</p>
          )}
        </div>

        {/* Source */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Source</label>
          <DxSelectBox
            items={sourceOptions}
            value={formData.source}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, source: value as ComplaintSource }))}
            disabled={isEditing}
          />
        </div>

        {/* Customer Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Customer Name</label>
          <DxTextBox
            value={formData.customerName}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, customerName: value || '' }))}
            placeholder="Enter customer name"
            disabled={isEditing}
          />
        </div>

        {/* Customer Contact */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Customer Contact</label>
          <DxTextBox
            value={formData.customerContact}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, customerContact: value || '' }))}
            placeholder="Phone, email, or address"
            disabled={isEditing}
          />
        </div>

        {/* Product */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Product <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={(products || []).map((p) => ({ value: p.id, label: `${p.nameTh} (${p.code})` }))}
            value={formData.productId}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, productId: value, lotId: null }))}
            placeholder="Select product"
            searchEnabled
            disabled={isEditing}
          />
          {errors.productId && (
            <p className="text-sm text-destructive">{errors.productId}</p>
          )}
        </div>

        {/* Lot Number */}
        {formData.productId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Lot Number</label>
            <DxSelectBox
              items={(lots || []).map((l) => ({ value: l.id, label: l.lotNumber }))}
              value={formData.lotId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => setFormData((prev) => ({ ...prev, lotId: value }))}
              placeholder="Select lot (optional)"
              showClearButton
              disabled={isEditing}
            />
          </div>
        )}

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <DxSelectBox
            items={categoryOptions}
            value={formData.category}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value as ComplaintCategory }))}
            disabled={isEditing}
          />
        </div>

        {/* Severity */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Severity <span className="text-destructive">*</span>
          </label>
          <DxSelectBox
            items={severityOptions}
            value={formData.severity}
            valueExpr="value"
            displayExpr="label"
            onValueChange={(value) => setFormData((prev) => ({ ...prev, severity: value as ComplaintSeverity }))}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Description <span className="text-destructive">*</span>
          </label>
          <DxTextArea
            value={formData.description}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, description: value || '' }))}
            placeholder="Describe the complaint in detail..."
            height={120}
            disabled={isEditing}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <DxButton
            text={isEditing ? 'Save Changes' : 'Create Complaint'}
            icon="save"
            onClick={handleSubmit}
            type="success"
            disabled={isSubmitting}
          />
          {onCancel && (
            <DxButton
              text="Cancel"
              onClick={onCancel}
              stylingMode="outlined"
              disabled={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
