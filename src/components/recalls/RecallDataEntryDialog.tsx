'use client';

/**
 * Recall Data Entry Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Reusable dialog for creating and editing recalls.
 * Used by both /gmp/recalls/new and /gmp/recalls/[id] pages.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxTagBox } from '@/components/ui/dx-tag-box';
import { AlertCircle, AlertTriangle, Package, Users, Link2 } from 'lucide-react';
import type { Recall, RecallCreate, RecallClass } from '@/types/recalls';

// ============================================
// Types
// ============================================

export interface RecallDataEntryDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when recall is saved successfully */
  onSaved?: (recall: Recall) => void;
  /** Existing recall data for editing */
  recall?: Recall | null;
  /** Pre-link to complaint */
  complaintId?: number;
  complaintNumber?: string;
  /** Dialog title override */
  title?: string;
  /** Mode - 'create' or 'edit' */
  mode?: 'create' | 'edit';
}

interface FormData {
  recallClass: RecallClass;
  reason: string;
  productId: number | null;
  affectedLots: number[];
  coordinatorId: number | null;
  complaintId: number | null;
}

interface Product {
  id: number;
  nameTh: string;
  nameEn?: string | null;
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
  const response = await fetch(`/api/inventory/lots?itemId=${productId}&limit=100`);
  const result = await response.json();
  if (!result.success) return [];
  return result.data?.lots || result.data?.items || [];
}

async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users?role=qc&limit=100');
  const result = await response.json();
  if (!result.success) return [];
  const items = result.data?.users || result.data?.items || result.data || [];
  return Array.isArray(items) ? items : [];
}

async function createRecall(data: RecallCreate): Promise<Recall> {
  const response = await fetch('/api/recalls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create recall');
  }
  return result.data;
}

async function updateRecall(id: number, data: Partial<RecallCreate>): Promise<Recall> {
  const response = await fetch(`/api/recalls/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update recall');
  }
  return result.data;
}

// ============================================
// Options
// ============================================

const recallClassOptions: { value: RecallClass; label: string; description: string; color: string }[] = [
  {
    value: 'class_i',
    label: 'Class I',
    description: 'Serious health hazard or death possible',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300',
  },
  {
    value: 'class_ii',
    label: 'Class II',
    description: 'May cause temporary health problems',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300',
  },
  {
    value: 'class_iii',
    label: 'Class III',
    description: 'Unlikely to cause health problems',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300',
  },
];

// ============================================
// Component
// ============================================

export function RecallDataEntryDialog({
  visible,
  onClose,
  onSaved,
  recall,
  complaintId: preLinkedComplaintId,
  complaintNumber: preLinkedComplaintNumber,
  title: customTitle,
  mode = recall ? 'edit' : 'create',
}: RecallDataEntryDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = mode === 'edit' && !!recall;
  const hasLinkedComplaint = !!preLinkedComplaintId || !!recall?.complaintId;
  const linkedComplaintNumber = preLinkedComplaintNumber || recall?.complaintNumber;

  // Generate initial form data (memoized to use as initial state)
  const initialFormData = useMemo((): FormData => {
    if (recall) {
      return {
        recallClass: recall.recallClass,
        reason: recall.reason || '',
        productId: recall.productId || null,
        affectedLots: recall.affectedLots || [],
        coordinatorId: recall.coordinatorId || null,
        complaintId: recall.complaintId || null,
      };
    }

    return {
      recallClass: 'class_ii',
      reason: '',
      productId: null,
      affectedLots: [],
      coordinatorId: null,
      complaintId: preLinkedComplaintId || null,
    };
  }, [recall, preLinkedComplaintId]);

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when initial data changes (dialog reopens with different data)
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
  }, [initialFormData]);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-finished'],
    queryFn: fetchProducts,
    enabled: visible,
  });

  // Fetch lots when product is selected
  const { data: lots } = useQuery({
    queryKey: ['lots', formData.productId],
    queryFn: () => fetchLots(formData.productId!),
    enabled: !!formData.productId && visible,
  });

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ['users-qc'],
    queryFn: fetchUsers,
    enabled: visible,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () =>
      createRecall({
        recallClass: formData.recallClass,
        reason: formData.reason,
        productId: formData.productId!,
        affectedLots: formData.affectedLots,
        coordinatorId: formData.coordinatorId!,
        complaintId: formData.complaintId || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recalls'] });
      queryClient.invalidateQueries({ queryKey: ['recalls-dashboard'] });
      onSaved?.(data);
      onClose();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<RecallCreate>) => updateRecall(recall!.id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recall', recall!.id] });
      queryClient.invalidateQueries({ queryKey: ['recalls'] });
      queryClient.invalidateQueries({ queryKey: ['recalls-dashboard'] });
      onSaved?.(data);
      onClose();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Validate form
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

  // Handle submit
  const handleSubmit = () => {
    if (!validate()) return;

    if (isEditing) {
      // Only allow updating certain fields in edit mode
      updateMutation.mutate({
        reason: formData.reason,
        coordinatorId: formData.coordinatorId || undefined,
      });
    } else {
      createMutation.mutate();
    }
  };

  // Handle field change
  const handleFieldChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle product change - clears affected lots when product changes
  const handleProductChange = (productId: number | null) => {
    setFormData((prev) => ({ ...prev, productId, affectedLots: [] }));
    if (errors.productId) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.productId;
        return newErrors;
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Determine dialog title
  const dialogTitle =
    customTitle ||
    (isEditing
      ? `Edit Recall ${recall?.recallNumber}`
      : hasLinkedComplaint
        ? 'Initiate Recall from Complaint'
        : 'Initiate Product Recall');

  // Generate a key for the dialog based on recall id to force remount on recall change
  const dialogKey = recall ? `edit-${recall.id}` : 'create';

  // Get recall class info
  const getClassInfo = (recallClass: RecallClass) => {
    return recallClassOptions.find((c) => c.value === recallClass);
  };

  return (
    <DxPopup
      key={dialogKey}
      visible={visible}
      onHiding={onClose}
      onShown={resetForm}
      title={dialogTitle}
      width={650}
      height="auto"
      maxHeight="90vh"
      showCloseButton
      dragEnabled={false}
    >
      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Header with warning */}
        <div className="flex items-start gap-3 pb-4 border-b">
          <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              Product Recall {isEditing ? 'Modification' : 'Initiation'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isEditing
                ? 'Modify recall details. Product and lots cannot be changed after initiation.'
                : 'A product recall will notify all affected customers and may require regulatory reporting.'}
            </p>
          </div>
        </div>

        {/* Linked Complaint Info */}
        {hasLinkedComplaint && linkedComplaintNumber && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Linked to Complaint: <span className="font-mono font-medium">{linkedComplaintNumber}</span>
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errors.submit && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{errors.submit}</p>
          </div>
        )}

        <div className="grid gap-4">
          {/* Recall Class Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              Recall Classification <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {recallClassOptions.map((cls) => (
                <button
                  key={cls.value}
                  type="button"
                  onClick={() => handleFieldChange('recallClass', cls.value)}
                  disabled={isEditing}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    formData.recallClass === cls.value
                      ? `border-2 ${cls.color}`
                      : 'border-border hover:border-primary/50'
                  } ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="font-medium">{cls.label}</div>
                  <div className="text-xs text-muted-foreground">{cls.description}</div>
                </button>
              ))}
            </div>
            {/* Current classification indicator */}
            {formData.recallClass && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getClassInfo(formData.recallClass)?.color}`}
                >
                  {getClassInfo(formData.recallClass)?.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getClassInfo(formData.recallClass)?.description}
                </span>
              </div>
            )}
          </div>

          {/* Product */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              Product <span className="text-destructive">*</span>
            </label>
            <DxSelectBox
              items={(products || []).map((p) => ({
                value: p.id,
                label: `${p.nameTh} (${p.code})`,
              }))}
              value={formData.productId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => handleProductChange(value)}
              placeholder="Select product..."
              searchEnabled
              showClearButton
              disabled={isEditing}
            />
            {errors.productId && <p className="text-xs text-destructive">{errors.productId}</p>}
          </div>

          {/* Affected Lots */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              Affected Lots <span className="text-destructive">*</span>
            </label>
            <DxTagBox
              dataSource={(lots || [])
                .filter((l) => l && l.id && l.lotNumber)
                .map((l) => ({ id: l.id, lotNumber: l.lotNumber })) as unknown as Record<string, unknown>[]}
              valueExpr="id"
              displayExpr="lotNumber"
              value={formData.affectedLots}
              onValueChanged={(e) => handleFieldChange('affectedLots', e.value || [])}
              placeholder="Select affected lots..."
              searchEnabled
              showSelectionControls
              disabled={!formData.productId || isEditing}
            />
            {errors.affectedLots && <p className="text-xs text-destructive">{errors.affectedLots}</p>}
            {formData.affectedLots.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {formData.affectedLots.length} lot(s) selected
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason for Recall <span className="text-destructive">*</span>
            </label>
            <DxTextArea
              value={formData.reason}
              onValueChange={(value) => handleFieldChange('reason', value || '')}
              placeholder="Describe the reason for this recall in detail..."
              height={100}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>

          {/* Coordinator */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Recall Coordinator <span className="text-destructive">*</span>
            </label>
            <DxSelectBox
              items={(users || []).map((u) => ({ value: u.id, label: u.name }))}
              value={formData.coordinatorId}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(value) => handleFieldChange('coordinatorId', value)}
              placeholder="Select coordinator..."
              searchEnabled
            />
            {errors.coordinatorId && <p className="text-xs text-destructive">{errors.coordinatorId}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <DxButton
            text="Cancel"
            onClick={onClose}
            stylingMode="outlined"
            disabled={isSubmitting}
          />
          <DxButton
            text={isEditing ? 'Save Changes' : 'Initiate Recall'}
            icon={isEditing ? 'save' : 'warning'}
            onClick={handleSubmit}
            type="danger"
            disabled={isSubmitting}
          />
        </div>
      </div>
    </DxPopup>
  );
}
