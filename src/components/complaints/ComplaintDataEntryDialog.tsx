'use client';

/**
 * Complaint Data Entry Dialog Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Reusable dialog for creating and editing complaints.
 * Used by both /gmp/complaints/new and /gmp/complaints/[id] pages.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import {
  AlertCircle,
  MessageSquareWarning,
  User,
  Package,
  Calendar,
  AlertTriangle,
  Phone,
  FileText,
} from 'lucide-react';
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

export interface ComplaintDataEntryDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when complaint is saved successfully */
  onSaved?: (complaint: Complaint) => void;
  /** Existing complaint data for editing */
  complaint?: Complaint | null;
  /** Dialog title override */
  title?: string;
  /** Mode - 'create' or 'edit' */
  mode?: 'create' | 'edit';
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
  regulatoryReportRequired: boolean;
}

interface Product {
  id: number;
  name: string;
  sku: string;
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
  const response = await fetch('/api/items?type=finished_good&limit=100');
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
// Options
// ============================================

const sourceOptions = [
  { value: 'customer', label: 'Customer', icon: User },
  { value: 'distributor', label: 'Distributor', icon: Package },
  { value: 'regulatory', label: 'Regulatory Authority', icon: FileText },
  { value: 'internal', label: 'Internal', icon: AlertTriangle },
];

const categoryOptions = [
  { value: 'quality', label: 'Quality' },
  { value: 'efficacy', label: 'Efficacy' },
  { value: 'safety', label: 'Safety' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'labeling', label: 'Labeling' },
  { value: 'other', label: 'Other' },
];

const severityOptions = [
  { value: 'minor', label: 'Minor', color: 'bg-green-100 text-green-800' },
  { value: 'major', label: 'Major', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

// ============================================
// Component
// ============================================

export function ComplaintDataEntryDialog({
  visible,
  onClose,
  onSaved,
  complaint,
  title: customTitle,
  mode = complaint ? 'edit' : 'create',
}: ComplaintDataEntryDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = mode === 'edit' && !!complaint;

  // Generate initial form data (memoized to use as initial state)
  const initialFormData = useMemo((): FormData => {
    if (complaint) {
      return {
        receivedDate: complaint.receivedDate || new Date().toISOString().split('T')[0],
        source: complaint.source || 'customer',
        customerName: complaint.customerName || '',
        customerContact: complaint.customerContact || '',
        productId: complaint.productId || null,
        lotId: complaint.lotId || null,
        category: complaint.category || 'quality',
        severity: complaint.severity || 'minor',
        description: complaint.description || '',
        regulatoryReportRequired: complaint.regulatoryReportRequired || false,
      };
    }

    return {
      receivedDate: new Date().toISOString().split('T')[0],
      source: 'customer',
      customerName: '',
      customerContact: '',
      productId: null,
      lotId: null,
      category: 'quality',
      severity: 'minor',
      description: '',
      regulatoryReportRequired: false,
    };
  }, [complaint]);

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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () =>
      createComplaint({
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
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
      onSaved?.(data);
      onClose();
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<ComplaintCreate & { regulatoryReportRequired?: boolean }>) =>
      updateComplaint(complaint!.id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['complaint', complaint!.id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaints-dashboard'] });
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
        regulatoryReportRequired: formData.regulatoryReportRequired,
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Determine dialog title
  const dialogTitle =
    customTitle || (isEditing ? 'Edit Complaint' : 'Register New Complaint');

  // Generate a key for the dialog based on complaint id to force remount on complaint change
  const dialogKey = complaint ? `edit-${complaint.id}` : 'create';

  // Get severity color
  const getSeverityColor = (severity: ComplaintSeverity) => {
    const option = severityOptions.find((o) => o.value === severity);
    return option?.color || '';
  };

  return (
    <DxPopup
      key={dialogKey}
      visible={visible}
      onHiding={onClose}
      onShown={resetForm}
      title={dialogTitle}
      width={700}
      height="auto"
      maxHeight="90vh"
      showCloseButton
      dragEnabled={false}
    >
      <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
        {/* Header with icon */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <MessageSquareWarning className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {isEditing ? `Editing complaint ${complaint?.complaintNumber}` : 'Create a new customer complaint record'}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{errors.submit}</p>
          </div>
        )}

        <div className="grid gap-4">
          {/* Row 1: Received Date and Source */}
          <div className="grid grid-cols-2 gap-4">
            {/* Received Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Received Date <span className="text-destructive">*</span>
              </label>
              <DxDateBox
                value={formData.receivedDate || undefined}
                onValueChange={(value) =>
                  handleFieldChange(
                    'receivedDate',
                    value ? new Date(value).toISOString().split('T')[0] : ''
                  )
                }
                type="date"
                displayFormat="yyyy-MM-dd"
                disabled={isEditing}
              />
              {errors.receivedDate && (
                <p className="text-xs text-destructive">{errors.receivedDate}</p>
              )}
            </div>

            {/* Source */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Source
              </label>
              <DxSelectBox
                items={sourceOptions.map((s) => ({ value: s.value, label: s.label }))}
                value={formData.source}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('source', value as ComplaintSource)}
                disabled={isEditing}
              />
            </div>
          </div>

          {/* Row 2: Customer Name and Contact */}
          <div className="grid grid-cols-2 gap-4">
            {/* Customer Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Customer Name
              </label>
              <DxTextBox
                value={formData.customerName}
                onValueChange={(value) => handleFieldChange('customerName', value || '')}
                placeholder="Enter customer name"
                disabled={isEditing}
              />
            </div>

            {/* Customer Contact */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Contact Info
              </label>
              <DxTextBox
                value={formData.customerContact}
                onValueChange={(value) => handleFieldChange('customerContact', value || '')}
                placeholder="Phone, email, or address"
                disabled={isEditing}
              />
            </div>
          </div>

          {/* Row 3: Product and Lot */}
          <div className="grid grid-cols-2 gap-4">
            {/* Product */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Product <span className="text-destructive">*</span>
              </label>
              <DxSelectBox
                items={(products || []).map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.sku})`,
                }))}
                value={formData.productId}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => {
                  handleFieldChange('productId', value);
                  handleFieldChange('lotId', null);
                }}
                placeholder="Select product"
                searchEnabled
                disabled={isEditing}
              />
              {errors.productId && (
                <p className="text-xs text-destructive">{errors.productId}</p>
              )}
            </div>

            {/* Lot Number */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Lot Number
              </label>
              <DxSelectBox
                items={(lots || []).map((l) => ({ value: l.id, label: l.lotNumber }))}
                value={formData.lotId}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('lotId', value)}
                placeholder="Select lot (optional)"
                showClearButton
                disabled={!formData.productId || isEditing}
              />
            </div>
          </div>

          {/* Row 4: Category and Severity */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                Category
              </label>
              <DxSelectBox
                items={categoryOptions}
                value={formData.category}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('category', value as ComplaintCategory)}
                disabled={isEditing}
              />
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Severity <span className="text-destructive">*</span>
              </label>
              <DxSelectBox
                items={severityOptions.map((s) => ({ value: s.value, label: s.label }))}
                value={formData.severity}
                valueExpr="value"
                displayExpr="label"
                onValueChange={(value) => handleFieldChange('severity', value as ComplaintSeverity)}
              />
              {/* Severity indicator */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                    formData.severity
                  )}`}
                >
                  {formData.severity.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </label>
            <DxTextArea
              value={formData.description}
              onValueChange={(value) => handleFieldChange('description', value || '')}
              placeholder="Describe the complaint in detail including symptoms, circumstances, and any relevant information..."
              height={120}
              disabled={isEditing}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Regulatory Report Required (only for edit mode) */}
          {isEditing && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    Regulatory Assessment
                  </p>
                  <DxCheckBox
                    value={formData.regulatoryReportRequired}
                    onValueChange={(value) =>
                      handleFieldChange('regulatoryReportRequired', value ?? false)
                    }
                    text="This complaint requires reporting to regulatory authorities"
                  />
                </div>
              </div>
            </div>
          )}
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
            text={isEditing ? 'Save Changes' : 'Register Complaint'}
            icon="save"
            onClick={handleSubmit}
            type="success"
            disabled={isSubmitting}
          />
        </div>
      </div>
    </DxPopup>
  );
}
