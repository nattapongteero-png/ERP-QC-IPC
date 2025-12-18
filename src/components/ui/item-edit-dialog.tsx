'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  Package,
  Leaf,
  FlaskConical,
  Box,
  Pill,
  Hash,
  Globe,
  Tag,
  Scale,
  Warehouse,
  Thermometer,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  type: string;
  category: string | null;
  primaryUnit: string;
  secondaryUnit: string | null;
  conversionFactor: number | null;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  shelfLifeDays: number | null;
  storageConditions: string | null;
  isActive: boolean;
  createdAt: string;
  onHand?: number;
}

export interface ItemFormData {
  code: string;
  nameTh: string;
  nameEn: string;
  type: string;
  category: string;
  primaryUnit: string;
  secondaryUnit: string;
  conversionFactor: number | null;
  minStock: number | null;
  maxStock: number | null;
  reorderPoint: number | null;
  shelfLifeDays: number | null;
  storageConditions: string;
  isActive: boolean;
}

export interface ItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onSave: (data: ItemFormData) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

export const itemTypes = [
  { value: 'raw_material', label: 'Raw Material', icon: Leaf, color: 'text-green-600', bgColor: 'bg-green-50' },
  { value: 'packaging', label: 'Packaging', icon: Box, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { value: 'wip', label: 'Work in Progress', icon: FlaskConical, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { value: 'finished_goods', label: 'Finished Goods', icon: Pill, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { value: 'consumable', label: 'Consumable', icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-50' },
];

export const categories = [
  { value: '', label: 'Select Category' },
  { value: 'herb', label: 'Herb' },
  { value: 'extract', label: 'Extract' },
  { value: 'excipient', label: 'Excipient' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'label', label: 'Label' },
  { value: 'box', label: 'Box' },
];

export const units = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'mg', label: 'Milligram (mg)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'mL', label: 'Milliliter (mL)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
];

// ============================================================================
// Helper Functions
// ============================================================================

const getDefaultFormData = (): ItemFormData => ({
  code: '',
  nameTh: '',
  nameEn: '',
  type: 'raw_material',
  category: '',
  primaryUnit: 'kg',
  secondaryUnit: '',
  conversionFactor: null,
  minStock: null,
  maxStock: null,
  reorderPoint: null,
  shelfLifeDays: null,
  storageConditions: '',
  isActive: true,
});

const itemToFormData = (item: Item): ItemFormData => ({
  code: item.code,
  nameTh: item.nameTh,
  nameEn: item.nameEn || '',
  type: item.type,
  category: item.category || '',
  primaryUnit: item.primaryUnit,
  secondaryUnit: item.secondaryUnit || '',
  conversionFactor: item.conversionFactor,
  minStock: item.minStock,
  maxStock: item.maxStock,
  reorderPoint: item.reorderPoint,
  shelfLifeDays: item.shelfLifeDays,
  storageConditions: item.storageConditions || '',
  isActive: item.isActive,
});

const getTypeConfig = (type: string) => {
  return itemTypes.find(t => t.value === type) || itemTypes[4];
};

const generateItemCode = (type: string): string => {
  const prefix = type === 'raw_material' ? 'RM'
    : type === 'packaging' ? 'PK'
    : type === 'wip' ? 'WIP'
    : type === 'finished_goods' ? 'FG'
    : 'ITM';
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${random}`;
};

// ============================================================================
// Section Components
// ============================================================================

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

function SectionHeader({ icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
      <div className="p-2 bg-gray-100 rounded-lg">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// Stock Status Component
// ============================================================================

interface StockStatusProps {
  item: Item;
}

function StockStatus({ item }: StockStatusProps) {
  const onHand = item.onHand ?? 0;
  const minStock = item.minStock ?? 0;
  const maxStock = item.maxStock ?? 0;
  const reorderPoint = item.reorderPoint ?? 0;

  const isLow = minStock > 0 && onHand < minStock;
  const isNearReorder = reorderPoint > 0 && onHand <= reorderPoint && !isLow;
  const isOverstock = maxStock > 0 && onHand > maxStock;
  const isHealthy = !isLow && !isNearReorder && !isOverstock;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Current Stock</span>
        <Badge
          variant={isLow ? 'danger' : isNearReorder ? 'warning' : isOverstock ? 'info' : 'success'}
          dot
        >
          {isLow ? 'Low Stock' : isNearReorder ? 'Near Reorder' : isOverstock ? 'Overstock' : 'Healthy'}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={cn(
          'text-3xl font-bold',
          isLow ? 'text-red-600' : isNearReorder ? 'text-amber-600' : 'text-gray-900'
        )}>
          {onHand.toLocaleString()}
        </span>
        <span className="text-sm text-gray-500">{item.primaryUnit}</span>
      </div>

      {/* Stock Level Bar */}
      {maxStock > 0 && (
        <div className="space-y-1">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isLow ? 'bg-red-500' : isNearReorder ? 'bg-amber-500' : isOverstock ? 'bg-blue-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min((onHand / maxStock) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Min: {minStock.toLocaleString()}</span>
            <span>Max: {maxStock.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Stock Alerts */}
      <div className="flex flex-wrap gap-2 pt-2">
        {isLow && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            Below minimum ({minStock} {item.primaryUnit})
          </div>
        )}
        {isNearReorder && (
          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
            <Info className="h-3 w-3" />
            Reorder soon ({reorderPoint} {item.primaryUnit})
          </div>
        )}
        {isHealthy && !isOverstock && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <CheckCircle className="h-3 w-3" />
            Stock level healthy
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ItemEditDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: ItemEditDialogProps) {
  const [formData, setFormData] = React.useState<ItemFormData>(getDefaultFormData());
  const [isSaving, setIsSaving] = React.useState(false);

  const isEditing = !!item;

  // Reset form when dialog opens/closes or item changes
  React.useEffect(() => {
    if (open) {
      setFormData(item ? itemToFormData(item) : getDefaultFormData());
    }
  }, [open, item]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCode = () => {
    setFormData(prev => ({ ...prev, code: generateItemCode(prev.type) }));
  };

  const updateFormData = <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const typeConfig = getTypeConfig(formData.type);
  const TypeIcon = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-start gap-4">
            <div className={cn('p-3 rounded-xl', typeConfig.bgColor)}>
              <TypeIcon className={cn('h-6 w-6', typeConfig.color)} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">
                {isEditing ? 'Edit Item' : 'Create New Item'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isEditing
                  ? `Editing ${item.code} - ${item.nameTh}`
                  : 'Add a new item to inventory management'}
              </DialogDescription>
            </div>
            {isEditing && (
              <Badge variant={item.isActive ? 'success' : 'danger'} dot className="mt-1">
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Current Stock Status (only for editing) */}
          {isEditing && item.onHand !== undefined && (
            <StockStatus item={item} />
          )}

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Identification Section */}
              <div className="space-y-4">
                <SectionHeader
                  icon={<Hash className="h-4 w-4 text-gray-600" />}
                  title="Identification"
                  description="Basic item identification and naming"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Item Code"
                      value={formData.code}
                      onChange={(e) => updateFormData('code', e.target.value)}
                      placeholder="RM-0001"
                      rightIcon={
                        <button
                          type="button"
                          onClick={handleGenerateCode}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                        >
                          Generate
                        </button>
                      }
                    />
                  </div>
                  <Select
                    label="Item Type"
                    options={itemTypes.map(t => ({ value: t.value, label: t.label }))}
                    value={formData.type}
                    onChange={(e) => updateFormData('type', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Name (Thai)"
                    value={formData.nameTh}
                    onChange={(e) => updateFormData('nameTh', e.target.value)}
                    placeholder="ชื่อสินค้าภาษาไทย"
                    leftIcon={<Globe className="h-4 w-4 text-gray-400" />}
                  />
                  <Input
                    label="Name (English)"
                    value={formData.nameEn}
                    onChange={(e) => updateFormData('nameEn', e.target.value)}
                    placeholder="English name (optional)"
                    leftIcon={<Globe className="h-4 w-4 text-gray-400" />}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Category"
                    options={categories}
                    value={formData.category}
                    onChange={(e) => updateFormData('category', e.target.value)}
                  />
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => updateFormData('isActive', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Active Item</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Units Section */}
              <div className="space-y-4">
                <SectionHeader
                  icon={<Scale className="h-4 w-4 text-gray-600" />}
                  title="Units of Measurement"
                  description="Primary and secondary units with conversion"
                />

                <div className="grid grid-cols-3 gap-4">
                  <Select
                    label="Primary Unit"
                    options={units}
                    value={formData.primaryUnit}
                    onChange={(e) => updateFormData('primaryUnit', e.target.value)}
                  />
                  <Select
                    label="Secondary Unit"
                    options={[{ value: '', label: 'None' }, ...units]}
                    value={formData.secondaryUnit}
                    onChange={(e) => updateFormData('secondaryUnit', e.target.value)}
                    helperText="Optional"
                  />
                  <Input
                    label="Conversion Factor"
                    type="number"
                    step="0.001"
                    value={formData.conversionFactor ?? ''}
                    onChange={(e) => updateFormData('conversionFactor', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="e.g., 1000"
                    helperText="1 primary = X secondary"
                    disabled={!formData.secondaryUnit}
                  />
                </div>

                {formData.secondaryUnit && formData.conversionFactor && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                    <Info className="h-4 w-4 inline-block mr-2" />
                    1 {units.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit} = {formData.conversionFactor.toLocaleString()} {units.find(u => u.value === formData.secondaryUnit)?.label || formData.secondaryUnit}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Stock & Storage */}
            <div className="space-y-6">
              {/* Stock Levels Section */}
              <div className="space-y-4">
                <SectionHeader
                  icon={<Warehouse className="h-4 w-4 text-gray-600" />}
                  title="Stock Levels"
                  description="Inventory thresholds"
                />

                <div className="space-y-3">
                  <Input
                    label="Minimum Stock"
                    type="number"
                    value={formData.minStock ?? ''}
                    onChange={(e) => updateFormData('minStock', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    helperText="Alert when below"
                    leftIcon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                  />
                  <Input
                    label="Maximum Stock"
                    type="number"
                    value={formData.maxStock ?? ''}
                    onChange={(e) => updateFormData('maxStock', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    helperText="Storage capacity"
                  />
                  <Input
                    label="Reorder Point"
                    type="number"
                    value={formData.reorderPoint ?? ''}
                    onChange={(e) => updateFormData('reorderPoint', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    helperText="When to reorder"
                    leftIcon={<Tag className="h-4 w-4 text-amber-400" />}
                  />
                </div>
              </div>

              {/* Storage Section */}
              <div className="space-y-4">
                <SectionHeader
                  icon={<Thermometer className="h-4 w-4 text-gray-600" />}
                  title="Storage Requirements"
                  description="Shelf life and conditions"
                />

                <div className="space-y-3">
                  <Input
                    label="Shelf Life"
                    type="number"
                    value={formData.shelfLifeDays ?? ''}
                    onChange={(e) => updateFormData('shelfLifeDays', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Days"
                    helperText="Days until expiry"
                    leftIcon={<Calendar className="h-4 w-4 text-gray-400" />}
                  />
                  <Input
                    label="Storage Conditions"
                    value={formData.storageConditions}
                    onChange={(e) => updateFormData('storageConditions', e.target.value)}
                    placeholder="e.g., 15-25°C, Dry"
                    helperText="Temperature, humidity"
                  />
                </div>
              </div>

              {/* Quick Info Card */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Reference</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">{typeConfig.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unit</span>
                    <span className="font-medium">{units.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit}</span>
                  </div>
                  {formData.shelfLifeDays && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shelf Life</span>
                      <span className="font-medium">{formData.shelfLifeDays} days</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-gray-50 gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.code || !formData.nameTh}
            loading={isSaving}
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Item' : 'Create Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemEditDialog;
