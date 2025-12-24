'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Building2,
  Calendar,
  Package,
  Clock,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PriceOffer {
  id: number;
  vendorId: number;
  vendorName: string | null;
  vendorCode: string | null;
  itemId: number;
  unitPrice: number;
  packPrice: number | null;
  moq: number | null;
  leadTimeDays: number | null;
  effectiveDate: string;
  expiryDate: string | null;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Vendor {
  id: number;
  code: string;
  name: string;
}

interface ItemPriceOffersSectionProps {
  itemId: number;
  className?: string;
}

interface PriceOfferFormData {
  vendorId: number | null;
  unitPrice: number | null;
  packPrice: number | null;
  moq: number | null;
  leadTimeDays: number | null;
  effectiveDate: string;
  expiryDate: string | null;
  isActive: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount);
}

function isOfferActive(offer: PriceOffer): boolean {
  if (!offer.isActive) return false;
  const now = new Date();
  const effectiveDate = new Date(offer.effectiveDate);
  if (effectiveDate > now) return false;
  if (offer.expiryDate) {
    const expiryDate = new Date(offer.expiryDate);
    if (expiryDate < now) return false;
  }
  return true;
}

function getDefaultFormData(): PriceOfferFormData {
  return {
    vendorId: null,
    unitPrice: null,
    packPrice: null,
    moq: null,
    leadTimeDays: null,
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: null,
    isActive: true,
  };
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchPriceOffers(itemId: number): Promise<PriceOffer[]> {
  const response = await fetch(`/api/items/${itemId}/price-offers`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch price offers');
  }
  return result.data;
}

async function fetchVendors(): Promise<Vendor[]> {
  const response = await fetch('/api/vendors?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch vendors');
  }
  return result.data || result.items || [];
}

async function createPriceOffer(itemId: number, data: PriceOfferFormData): Promise<{ id: number }> {
  const response = await fetch(`/api/items/${itemId}/price-offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create price offer');
  }
  return result.data;
}

async function updatePriceOffer(
  itemId: number,
  offerId: number,
  data: Partial<PriceOfferFormData>
): Promise<void> {
  const response = await fetch(`/api/items/${itemId}/price-offers/${offerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update price offer');
  }
}

async function deletePriceOffer(itemId: number, offerId: number): Promise<void> {
  const response = await fetch(`/api/items/${itemId}/price-offers/${offerId}`, {
    method: 'DELETE',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete price offer');
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ItemPriceOffersSection({ itemId, className }: ItemPriceOffersSectionProps) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingOffer, setEditingOffer] = React.useState<PriceOffer | null>(null);
  const [formData, setFormData] = React.useState<PriceOfferFormData>(getDefaultFormData());
  const [formError, setFormError] = React.useState<string | null>(null);

  // Fetch price offers
  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ['item-price-offers', itemId],
    queryFn: () => fetchPriceOffers(itemId),
    enabled: !!itemId,
  });

  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: fetchVendors,
  });

  const vendorOptions = React.useMemo(() => {
    return vendors.map((v) => ({
      value: v.id,
      label: `${v.code} - ${v.name}`,
    }));
  }, [vendors]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: PriceOfferFormData) => createPriceOffer(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-price-offers', itemId] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ offerId, data }: { offerId: number; data: Partial<PriceOfferFormData> }) =>
      updatePriceOffer(itemId, offerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-price-offers', itemId] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (offerId: number) => deletePriceOffer(itemId, offerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-price-offers', itemId] });
    },
  });

  // Handlers
  const handleOpenCreate = () => {
    setEditingOffer(null);
    setFormData(getDefaultFormData());
    setFormError(null);
    setShowDialog(true);
  };

  const handleOpenEdit = (offer: PriceOffer) => {
    setEditingOffer(offer);
    setFormData({
      vendorId: offer.vendorId,
      unitPrice: offer.unitPrice,
      packPrice: offer.packPrice,
      moq: offer.moq,
      leadTimeDays: offer.leadTimeDays,
      effectiveDate: offer.effectiveDate.split('T')[0],
      expiryDate: offer.expiryDate ? offer.expiryDate.split('T')[0] : null,
      isActive: offer.isActive,
    });
    setFormError(null);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingOffer(null);
    setFormData(getDefaultFormData());
    setFormError(null);
  };

  const handleSave = () => {
    setFormError(null);

    // Validate
    if (!formData.vendorId) {
      setFormError('Please select a vendor');
      return;
    }
    if (!formData.unitPrice || formData.unitPrice <= 0) {
      setFormError('Unit price must be greater than 0');
      return;
    }
    if (!formData.effectiveDate) {
      setFormError('Effective date is required');
      return;
    }

    if (editingOffer) {
      updateMutation.mutate({ offerId: editingOffer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (offer: PriceOffer) => {
    if (confirm(`Are you sure you want to delete this price offer from ${offer.vendorName || offer.vendorCode}?`)) {
      deleteMutation.mutate(offer.id);
    }
  };

  const updateFormData = <K extends keyof PriceOfferFormData>(key: K, value: PriceOfferFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const activeOffers = offers.filter(isOfferActive);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white border border-gray-200">
          <DollarSign className="h-5 w-5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">VMI Price Offers</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeOffers.length} active / {offers.length} total
          </p>
        </div>
        <DxButton
          text="Add"
          icon="plus"
          type="default"
          stylingMode="outlined"
          onClick={handleOpenCreate}
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load price offers</span>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">No price offers</p>
            <p className="text-xs text-gray-500 mb-4">Add vendor price offers for VMI sync</p>
            <DxButton
              text="Add Price Offer"
              icon="plus"
              type="success"
              stylingMode="contained"
              onClick={handleOpenCreate}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => {
              const isActive = isOfferActive(offer);
              return (
                <div
                  key={offer.id}
                  className={cn(
                    'p-4 rounded-xl border transition-colors',
                    isActive
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-gray-200 bg-gray-50/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Vendor */}
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {offer.vendorName || offer.vendorCode || 'Unknown Vendor'}
                        </span>
                        {isActive ? (
                          <Badge variant="success" dot className="text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                        {offer.syncStatus === 'synced' && (
                          <Badge variant="info" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        )}
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-xl font-bold text-gray-900">
                          {formatCurrency(offer.unitPrice)}
                        </span>
                        <span className="text-sm text-gray-500">/ unit</span>
                        {offer.packPrice && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="text-sm text-gray-600">
                              {formatCurrency(offer.packPrice)} / pack
                            </span>
                          </>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(offer.effectiveDate)}
                          {offer.expiryDate && ` - ${formatDate(offer.expiryDate)}`}
                        </div>
                        {offer.moq && (
                          <div className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            MOQ: {offer.moq}
                          </div>
                        )}
                        {offer.leadTimeDays && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Lead: {offer.leadTimeDays} days
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(offer)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(offer)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <DxPopup
        visible={showDialog}
        onHiding={handleCloseDialog}
        title={editingOffer ? 'Edit Price Offer' : 'Add Price Offer'}
        showCloseButton
        width={500}
        height="auto"
      >
        <div className="p-4 space-y-4">
          {formError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{formError}</span>
            </div>
          )}

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor <span className="text-red-500">*</span>
            </label>
            <DxSelectBox
              items={vendorOptions}
              value={formData.vendorId}
              onValueChange={(value) => updateFormData('vendorId', value)}
              valueExpr="value"
              displayExpr="label"
              placeholder="Select vendor"
              searchEnabled
              searchExpr="label"
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Price (THB) <span className="text-red-500">*</span>
              </label>
              <DxNumberBox
                value={formData.unitPrice}
                onValueChange={(value) => updateFormData('unitPrice', value)}
                format="#,##0.00"
                min={0.01}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pack Price (THB)</label>
              <DxNumberBox
                value={formData.packPrice}
                onValueChange={(value) => updateFormData('packPrice', value)}
                format="#,##0.00"
                min={0}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* MOQ and Lead Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MOQ (Min Order Qty)</label>
              <DxNumberBox
                value={formData.moq}
                onValueChange={(value) => updateFormData('moq', value)}
                format="#,##0"
                min={1}
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (Days)</label>
              <DxNumberBox
                value={formData.leadTimeDays}
                onValueChange={(value) => updateFormData('leadTimeDays', value)}
                format="#,##0"
                min={0}
                placeholder="0"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <DxDateBox
                value={formData.effectiveDate}
                onValueChange={(value) => updateFormData('effectiveDate', value)}
                type="date"
                displayFormat="dd/MM/yyyy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <DxDateBox
                value={formData.expiryDate || undefined}
                onValueChange={(value) => updateFormData('expiryDate', value || null)}
                type="date"
                displayFormat="dd/MM/yyyy"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for no expiry</p>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
            <DxCheckBox
              value={formData.isActive}
              onValueChange={(value) => updateFormData('isActive', value)}
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Active</span>
              <p className="text-xs text-gray-500">Include in VMI price sync</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={handleCloseDialog}
              disabled={isSaving}
            />
            <DxButton
              text={isSaving ? 'Saving...' : editingOffer ? 'Update' : 'Create'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={isSaving}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

export default ItemPriceOffersSection;
