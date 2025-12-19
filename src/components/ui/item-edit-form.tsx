'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  useItemCategories,
  useItemUnits,
  categoriesToOptions,
  unitsToOptions,
} from '@/hooks/use-lookup-data';
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
  X,
  Save,
  Sparkles,
  Settings,
  ClipboardList,
  ShieldCheck,
  ArrowLeft,
  Trash2,
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

export interface ItemEditFormProps {
  item?: Item | null;
  onSave: (data: ItemFormData) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  showHeader?: boolean;
  showDelete?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const itemTypes = [
  { value: 'raw_material', label: 'Raw Material', icon: Leaf, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200' },
  { value: 'packaging', label: 'Packaging', icon: Box, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200' },
  { value: 'wip', label: 'Work in Progress', icon: FlaskConical, color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  { value: 'finished_goods', label: 'Finished Goods', icon: Pill, color: 'text-purple-600', bgColor: 'bg-purple-100', borderColor: 'border-purple-200' },
  { value: 'consumable', label: 'Consumable', icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
];

// ============================================================================
// Helper Functions
// ============================================================================

export const getDefaultFormData = (): ItemFormData => ({
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

export const itemToFormData = (item: Item): ItemFormData => ({
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

export const getTypeConfig = (type: string) => {
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
// Section Card Component
// ============================================================================

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'highlight';
}

export function SectionCard({ icon, title, description, children, className, variant = 'default' }: SectionCardProps) {
  return (
    <div className={cn(
      'rounded-2xl border bg-white overflow-hidden',
      variant === 'highlight' ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white' : 'border-gray-200',
      className
    )}>
      <div className={cn(
        'px-5 py-4 border-b flex items-center gap-3',
        variant === 'highlight' ? 'border-emerald-100 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50'
      )}>
        <div className={cn(
          'p-2.5 rounded-xl',
          variant === 'highlight' ? 'bg-emerald-100' : 'bg-white border border-gray-200'
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5">
        {children}
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

export function StockStatus({ item }: StockStatusProps) {
  const onHand = item.onHand ?? 0;
  const minStock = item.minStock ?? 0;
  const maxStock = item.maxStock ?? 0;
  const reorderPoint = item.reorderPoint ?? 0;

  const isLow = minStock > 0 && onHand < minStock;
  const isNearReorder = reorderPoint > 0 && onHand <= reorderPoint && !isLow;
  const isOverstock = maxStock > 0 && onHand > maxStock;
  const isHealthy = !isLow && !isNearReorder && !isOverstock;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Current Stock Level</span>
        <Badge
          variant={isLow ? 'danger' : isNearReorder ? 'warning' : isOverstock ? 'info' : 'success'}
          dot
        >
          {isLow ? 'Low Stock' : isNearReorder ? 'Near Reorder' : isOverstock ? 'Overstock' : 'Healthy'}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={cn(
          'text-4xl font-bold tracking-tight',
          isLow ? 'text-red-600' : isNearReorder ? 'text-amber-600' : 'text-gray-900'
        )}>
          {onHand.toLocaleString()}
        </span>
        <span className="text-lg text-gray-500">{item.primaryUnit}</span>
      </div>

      {maxStock > 0 && (
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isLow ? 'bg-gradient-to-r from-red-400 to-red-500' :
                isNearReorder ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                isOverstock ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                'bg-gradient-to-r from-emerald-400 to-emerald-500'
              )}
              style={{ width: `${Math.min((onHand / maxStock) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Min: {minStock.toLocaleString()}</span>
            <span>Reorder: {reorderPoint.toLocaleString()}</span>
            <span>Max: {maxStock.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isLow && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Below minimum stock
          </div>
        )}
        {isNearReorder && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
            <Info className="h-3.5 w-3.5" />
            Approaching reorder point
          </div>
        )}
        {isHealthy && !isOverstock && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <CheckCircle className="h-3.5 w-3.5" />
            Stock level is healthy
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Type Selector Component
// ============================================================================

interface TypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {itemTypes.map((type) => {
        const Icon = type.icon;
        const isSelected = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
              isSelected
                ? `${type.bgColor} ${type.borderColor} ring-2 ring-offset-2 ring-${type.value === 'raw_material' ? 'green' : type.value === 'packaging' ? 'blue' : type.value === 'wip' ? 'orange' : type.value === 'finished_goods' ? 'purple' : 'gray'}-200`
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <div className={cn(
              'p-3 rounded-xl transition-colors',
              isSelected ? 'bg-white/80' : 'bg-gray-100'
            )}>
              <Icon className={cn('h-6 w-6', isSelected ? type.color : 'text-gray-400')} />
            </div>
            <span className={cn(
              'text-xs font-medium text-center leading-tight',
              isSelected ? 'text-gray-900' : 'text-gray-600'
            )}>
              {type.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Form Component
// ============================================================================

export function ItemEditForm({
  item,
  onSave,
  onCancel,
  onDelete,
  isSaving = false,
  showHeader = true,
  showDelete = false,
  className,
}: ItemEditFormProps) {
  const [formData, setFormData] = React.useState<ItemFormData>(
    item ? itemToFormData(item) : getDefaultFormData()
  );

  // Fetch categories and units from database
  const { data: categories, isLoading: categoriesLoading } = useItemCategories();
  const { data: units, isLoading: unitsLoading } = useItemUnits();

  // Convert to select options
  const categoryOptions = React.useMemo(
    () => categoriesToOptions(categories, true),
    [categories]
  );
  const unitOptions = React.useMemo(
    () => unitsToOptions(units, false),
    [units]
  );
  const unitOptionsWithNone = React.useMemo(
    () => unitsToOptions(units, true),
    [units]
  );

  const isEditing = !!item;

  // Reset form when item changes
  React.useEffect(() => {
    setFormData(item ? itemToFormData(item) : getDefaultFormData());
  }, [item]);

  const handleSave = async () => {
    await onSave(formData);
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
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex-none px-8 py-5 border-b bg-white">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <div className={cn('p-3 rounded-2xl', typeConfig.bgColor, typeConfig.borderColor, 'border')}>
                <TypeIcon className={cn('h-7 w-7', typeConfig.color)} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEditing ? 'Edit Item' : 'Create New Item'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditing
                    ? `Editing ${item.code} - ${item.nameTh}`
                    : 'Add a new item to your inventory system'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isEditing && (
                <Badge
                  variant={item.isActive ? 'success' : 'danger'}
                  dot
                  className="text-sm px-3 py-1"
                >
                  {item.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
              {showDelete && onDelete && (
                <Button variant="danger" onClick={onDelete} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-12 gap-6">

            {/* Left Column - Main Form (8 cols) */}
            <div className="col-span-8 space-y-6">

              {/* Item Type Selection */}
              <SectionCard
                icon={<Tag className="h-5 w-5 text-gray-600" />}
                title="Item Type"
                description="Select the type of item you are creating"
              >
                <TypeSelector
                  value={formData.type}
                  onChange={(value) => updateFormData('type', value)}
                />
              </SectionCard>

              {/* Basic Information */}
              <SectionCard
                icon={<Hash className="h-5 w-5 text-gray-600" />}
                title="Basic Information"
                description="Item identification and naming"
              >
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-1">
                    <Input
                      label="Item Code"
                      value={formData.code}
                      onChange={(e) => updateFormData('code', e.target.value)}
                      placeholder="RM-0001"
                      rightIcon={
                        <button
                          type="button"
                          onClick={handleGenerateCode}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                        >
                          <Sparkles className="h-3 w-3" />
                          Generate
                        </button>
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <Select
                      label="Category"
                      options={categoryOptions}
                      value={formData.category}
                      onChange={(e) => updateFormData('category', e.target.value)}
                      disabled={categoriesLoading}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="Name (Thai)"
                      value={formData.nameTh}
                      onChange={(e) => updateFormData('nameTh', e.target.value)}
                      placeholder="ชื่อสินค้าภาษาไทย"
                      leftIcon={<Globe className="h-4 w-4 text-gray-400" />}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label="Name (English)"
                      value={formData.nameEn}
                      onChange={(e) => updateFormData('nameEn', e.target.value)}
                      placeholder="English name (optional)"
                      leftIcon={<Globe className="h-4 w-4 text-gray-400" />}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Units of Measurement */}
              <SectionCard
                icon={<Scale className="h-5 w-5 text-gray-600" />}
                title="Units of Measurement"
                description="Primary and secondary units with conversion factor"
              >
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-5">
                    <Select
                      label="Primary Unit"
                      options={unitOptions}
                      value={formData.primaryUnit}
                      onChange={(e) => updateFormData('primaryUnit', e.target.value)}
                      disabled={unitsLoading}
                    />
                    <Select
                      label="Secondary Unit"
                      options={unitOptionsWithNone}
                      value={formData.secondaryUnit}
                      onChange={(e) => updateFormData('secondaryUnit', e.target.value)}
                      helperText="Optional alternative unit"
                      disabled={unitsLoading}
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
                    <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3 border border-blue-100">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Info className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-sm text-blue-700">
                        <span className="font-semibold">Conversion:</span> 1 {unitOptions.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit} = {formData.conversionFactor.toLocaleString()} {unitOptions.find(u => u.value === formData.secondaryUnit)?.label || formData.secondaryUnit}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Inventory Management */}
              <SectionCard
                icon={<Warehouse className="h-5 w-5 text-gray-600" />}
                title="Inventory Management"
                description="Stock thresholds and reorder settings"
              >
                <div className="grid grid-cols-3 gap-5">
                  <Input
                    label="Minimum Stock"
                    type="number"
                    value={formData.minStock ?? ''}
                    onChange={(e) => updateFormData('minStock', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    helperText="Alert when stock falls below"
                    leftIcon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                  />
                  <Input
                    label="Maximum Stock"
                    type="number"
                    value={formData.maxStock ?? ''}
                    onChange={(e) => updateFormData('maxStock', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    helperText="Maximum storage capacity"
                  />
                  <Input
                    label="Reorder Point"
                    type="number"
                    value={formData.reorderPoint ?? ''}
                    onChange={(e) => updateFormData('reorderPoint', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="0"
                    helperText="Trigger reorder when reached"
                    leftIcon={<Tag className="h-4 w-4 text-amber-400" />}
                  />
                </div>
              </SectionCard>

              {/* Storage Requirements */}
              <SectionCard
                icon={<Thermometer className="h-5 w-5 text-gray-600" />}
                title="Storage Requirements"
                description="Shelf life and storage conditions"
              >
                <div className="grid grid-cols-2 gap-5">
                  <Input
                    label="Shelf Life (Days)"
                    type="number"
                    value={formData.shelfLifeDays ?? ''}
                    onChange={(e) => updateFormData('shelfLifeDays', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="e.g., 365"
                    helperText="Days until expiration"
                    leftIcon={<Calendar className="h-4 w-4 text-gray-400" />}
                  />
                  <Input
                    label="Storage Conditions"
                    value={formData.storageConditions}
                    onChange={(e) => updateFormData('storageConditions', e.target.value)}
                    placeholder="e.g., 15-25°C, Dry, Away from light"
                    helperText="Temperature, humidity, special requirements"
                  />
                </div>
              </SectionCard>
            </div>

            {/* Right Column - Summary & Status (4 cols) */}
            <div className="col-span-4 space-y-6">

              {/* Current Stock Status (only for editing) */}
              {isEditing && item.onHand !== undefined && (
                <SectionCard
                  icon={<ClipboardList className="h-5 w-5 text-emerald-600" />}
                  title="Current Stock Status"
                  description="Real-time inventory level"
                  variant="highlight"
                >
                  <StockStatus item={item} />
                </SectionCard>
              )}

              {/* Item Status */}
              <SectionCard
                icon={<ShieldCheck className="h-5 w-5 text-gray-600" />}
                title="Item Status"
                description="Active/Inactive status"
              >
                <div className="space-y-4">
                  <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-200 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => updateFormData('isActive', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900">Active Item</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Item can be used in transactions
                      </p>
                    </div>
                    {formData.isActive ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <X className="h-5 w-5 text-gray-300" />
                    )}
                  </label>
                </div>
              </SectionCard>

              {/* Quick Summary */}
              <SectionCard
                icon={<Settings className="h-5 w-5 text-gray-600" />}
                title="Quick Summary"
                description="Overview of item configuration"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Type</span>
                    <div className="flex items-center gap-2">
                      <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                      <span className="text-sm font-medium text-gray-900">{typeConfig.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Primary Unit</span>
                    <span className="text-sm font-medium text-gray-900">
                      {unitOptions.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit}
                    </span>
                  </div>
                  {formData.category && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Category</span>
                      <span className="text-sm font-medium text-gray-900">
                        {categoryOptions.find(c => c.value === formData.category)?.label || formData.category}
                      </span>
                    </div>
                  )}
                  {formData.shelfLifeDays && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Shelf Life</span>
                      <span className="text-sm font-medium text-gray-900">{formData.shelfLifeDays} days</span>
                    </div>
                  )}
                  {formData.minStock !== null && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Min Stock</span>
                      <span className="text-sm font-medium text-gray-900">{formData.minStock?.toLocaleString()}</span>
                    </div>
                  )}
                  {formData.reorderPoint !== null && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500">Reorder Point</span>
                      <span className="text-sm font-medium text-gray-900">{formData.reorderPoint?.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Validation Status */}
              <div className={cn(
                'rounded-xl p-4 border',
                formData.code && formData.nameTh
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              )}>
                <div className="flex items-start gap-3">
                  {formData.code && formData.nameTh ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Ready to Save</p>
                        <p className="text-xs text-emerald-600 mt-0.5">All required fields are filled</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Required Fields</p>
                        <ul className="text-xs text-amber-600 mt-1 space-y-0.5">
                          {!formData.code && <li>• Item Code is required</li>}
                          {!formData.nameTh && <li>• Thai Name is required</li>}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-none px-8 py-4 border-t bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {isEditing && item?.createdAt ? (
              <>Last updated: {new Date(item.createdAt).toLocaleDateString()}</>
            ) : (
              <>Creating new {typeConfig.label.toLowerCase()}</>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onCancel && (
              <Button
                variant="ghost"
                onClick={onCancel}
                disabled={isSaving}
                className="px-6"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.code || !formData.nameTh}
              loading={isSaving}
              className="px-6 gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : isEditing ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemEditForm;
