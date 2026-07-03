'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { toLocalDateStr } from '@/lib/utils/date-format';
import {
  DollarSign,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
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

interface ItemPriceOffersSectionProps {
  itemId: number;
  className?: string;
}

interface PriceOfferFormData {
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

// effectiveDate/expiryDate are stored as datetimes pinned to midnight UTC, but
// they represent whole calendar days, not instants. Comparing them against the
// current instant makes an offer whose effective date is "today" look inactive
// during the hours before that midnight-UTC boundary (e.g. before 07:00 in
// Thailand, UTC+7). Compare by calendar day so a date-only offer is active for
// the entire day it names, regardless of timezone.
//
// The stored value's day is read in UTC (that's the day the user picked, pinned
// to 00:00 UTC). "Today" is read in the viewer's local timezone — the day the
// user sees on their calendar.
function storedDayNumber(dateInput: string | Date): number {
  const d = new Date(dateInput);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function localTodayNumber(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function isOfferActive(offer: PriceOffer): boolean {
  if (!offer.isActive) return false;
  const today = localTodayNumber();
  if (storedDayNumber(offer.effectiveDate) > today) return false;
  if (offer.expiryDate && storedDayNumber(offer.expiryDate) < today) return false;
  return true;
}

function getDefaultFormData(): PriceOfferFormData {
  return {
    unitPrice: null,
    packPrice: null,
    moq: null,
    leadTimeDays: null,
    effectiveDate: toLocalDateStr(new Date()),
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
    throw new Error(result.error || 'ไม่สามารถโหลดข้อเสนอราคาได้');
  }
  return result.data;
}

async function createPriceOffer(itemId: number, data: PriceOfferFormData): Promise<{ id: number }> {
  const response = await fetch(`/api/items/${itemId}/price-offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'ไม่สามารถสร้างข้อเสนอราคาได้');
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
    throw new Error(result.error || 'ไม่สามารถแก้ไขข้อเสนอราคาได้');
  }
}

async function deletePriceOffer(itemId: number, offerId: number): Promise<void> {
  const response = await fetch(`/api/items/${itemId}/price-offers/${offerId}`, {
    method: 'DELETE',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'ไม่สามารถลบข้อเสนอราคาได้');
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
    if (formData.unitPrice === null || formData.unitPrice === undefined) {
      setFormError('กรุณาระบุราคาต่อหน่วย (Unit Price is required)');
      return;
    }
    if (formData.unitPrice < 0) {
      setFormError('ราคาต่อหน่วยต้องไม่ติดลบ (Unit price cannot be negative)');
      return;
    }
    if (formData.unitPrice === 0) {
      setFormError('ราคาต่อหน่วยต้องมากกว่า 0 (Unit price must be greater than 0)');
      return;
    }
    if (formData.packPrice !== null && formData.packPrice !== undefined && formData.packPrice < 0) {
      setFormError('ราคาต่อแพ็คต้องไม่ติดลบ (Pack price cannot be negative)');
      return;
    }
    if (!formData.effectiveDate) {
      setFormError('กรุณาระบุวันที่มีผล (Effective date is required)');
      return;
    }

    if (editingOffer) {
      updateMutation.mutate({ offerId: editingOffer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (offer: PriceOffer) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อเสนอราคานี้?')) {
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
          <h3 className="text-sm font-semibold text-gray-900">ข้อเสนอราคา VMI</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            ใช้งานอยู่ {activeOffers.length} / ทั้งหมด {offers.length}
          </p>
        </div>
        <DxButton
          text="เพิ่ม"
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
            <span className="text-sm">ไม่สามารถโหลดข้อเสนอราคาได้</span>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">ยังไม่มีข้อเสนอราคา</p>
            <p className="text-xs text-gray-500 mb-4">เพิ่มข้อเสนอราคาสำหรับการซิงค์ VMI</p>
            <DxButton
              text="เพิ่มข้อเสนอราคา"
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
                      {/* Status badges */}
                      <div className="flex items-center gap-2 mb-2">
                        {isActive ? (
                          <Badge variant="success" dot className="text-xs">
                            ใช้งาน
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            ไม่ใช้งาน
                          </Badge>
                        )}
                        {offer.syncStatus === 'synced' && (
                          <Badge variant="info" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            ซิงค์แล้ว
                          </Badge>
                        )}
                        {offer.syncStatus === 'pending' && (
                          <Badge variant="warning" className="text-xs">
                            รอซิงค์
                          </Badge>
                        )}
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-xl font-bold text-gray-900">
                          {formatCurrency(offer.unitPrice)}
                        </span>
                        <span className="text-sm text-gray-500">/ หน่วย</span>
                        {offer.packPrice && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="text-sm text-gray-600">
                              {formatCurrency(offer.packPrice)} / แพ็ค
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
                            ระยะเวลานำ: {offer.leadTimeDays} วัน
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(offer)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="แก้ไข"
                      >
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(offer)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="ลบ"
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
        title={editingOffer ? 'แก้ไขข้อเสนอราคา' : 'เพิ่มข้อเสนอราคา'}
        showCloseButton
        width={450}
        height="auto"
      >
        <div className="p-4 space-y-4">
          {formError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{formError}</span>
            </div>
          )}

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ราคาต่อหน่วย (บาท) <span className="text-red-500">*</span>
              </label>
              <DxNumberBox
                value={formData.unitPrice}
                onValueChange={(value) => updateFormData('unitPrice', value)}
                format="#,##0.00"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต่อแพ็ค (บาท)</label>
              <DxNumberBox
                value={formData.packPrice}
                onValueChange={(value) => updateFormData('packPrice', value)}
                format="#,##0.00"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* MOQ and Lead Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MOQ (จำนวนสั่งซื้อขั้นต่ำ)</label>
              <DxNumberBox
                value={formData.moq}
                onValueChange={(value) => updateFormData('moq', value)}
                format="#,##0"
                min={1}
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลานำ (วัน)</label>
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
                วันที่มีผล <span className="text-red-500">*</span>
              </label>
              <DxDateBox
                value={formData.effectiveDate}
                onValueChange={(value) => updateFormData('effectiveDate', value)}
                type="date"
                displayFormat="dd/MM/yyyy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่หมดอายุ</label>
              <DxDateBox
                value={formData.expiryDate || undefined}
                onValueChange={(value) => updateFormData('expiryDate', value || null)}
                type="date"
                displayFormat="dd/MM/yyyy"
              />
              <p className="text-xs text-gray-500 mt-1">เว้นว่างไว้หากไม่มีวันหมดอายุ</p>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
            <DxCheckBox
              value={formData.isActive}
              onValueChange={(value) => updateFormData('isActive', value)}
            />
            <div>
              <span className="text-sm font-medium text-gray-700">ใช้งาน</span>
              <p className="text-xs text-gray-500">รวมในการซิงค์ราคา VMI</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={handleCloseDialog}
              disabled={isSaving}
            />
            <DxButton
              text={isSaving ? 'กำลังบันทึก...' : editingOffer ? 'อัปเดต' : 'สร้าง'}
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
