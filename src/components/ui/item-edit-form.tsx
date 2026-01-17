'use client';

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
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
  Tag,
  Scale,
  Warehouse,
  Thermometer,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Settings,
  ClipboardList,
  ShieldCheck,
  Barcode,
  RefreshCw,
  Sparkles,
  Lock,
} from 'lucide-react';
import { TppSearchDialog, TppItem } from '@/components/ui/tpp-search-dialog';
import { TtmtSearchDialog, TtmtItem } from '@/components/ui/ttmt-search-dialog';
import { ItemImagesSection } from '@/components/ui/item-images-section';
import { ItemPriceOffersSection } from '@/components/ui/item-price-offers-section';

// ============================================================================
// Types
// ============================================================================

export type ConfidentialityLevel = 'public' | 'internal' | 'confidential';

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
  onHandCost?: number;
  quarantineQty?: number;
  // VMI Standard Codes
  tppCode: string | null;
  tppName: string | null;
  ttmtCode: string | null;
  ttmtName: string | null;
  vmiSyncEnabled: boolean;
  // GMP Phase 4: Strength for finished goods (FR-059)
  strength: string | null;
  // BOM Confidentiality Protection fields (014-unit-cost)
  confidentialityLevel: ConfidentialityLevel;
  defaultConfidential: boolean;
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
  // VMI Standard Codes
  tppCode: string;
  tppName: string;
  ttmtCode: string;
  ttmtName: string;
  vmiSyncEnabled: boolean;
  // GMP Phase 4: Strength for finished goods (FR-059)
  strength: string;
  // BOM Confidentiality Protection fields (014-unit-cost)
  confidentialityLevel: ConfidentialityLevel;
  defaultConfidential: boolean;
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

export const confidentialityLevelOptions = [
  { value: 'public', label: 'Public', description: 'Visible to all users' },
  { value: 'internal', label: 'Internal', description: 'Visible to internal staff only' },
  { value: 'confidential', label: 'Confidential', description: 'Restricted access only' },
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
  tppCode: '',
  tppName: '',
  ttmtCode: '',
  ttmtName: '',
  vmiSyncEnabled: false,
  strength: '',
  confidentialityLevel: 'public',
  defaultConfidential: false,
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
  tppCode: item.tppCode || '',
  tppName: item.tppName || '',
  ttmtCode: item.ttmtCode || '',
  ttmtName: item.ttmtName || '',
  vmiSyncEnabled: item.vmiSyncEnabled || false,
  strength: item.strength || '',
  confidentialityLevel: item.confidentialityLevel || 'public',
  defaultConfidential: item.defaultConfidential || false,
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

// Map TTMT dispensing units to internal units
const mapTtmtUnitToUnit = (dispensingUnit: string): string => {
  const unitMap: Record<string, string> = {
    'เม็ด': 'pcs',
    'แคปซูล': 'pcs',
    'ซอง': 'pcs',
    'ขวด': 'btl',
    'กล่อง': 'box',
    'มิลลิลิตร': 'ml',
    'ลิตร': 'L',
    'กรัม': 'g',
    'กิโลกรัม': 'kg',
    'หลอด': 'pcs',
    'แผง': 'pcs',
  };
  return unitMap[dispensingUnit] || 'pcs';
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

  // State for TPP/TTMT search dialogs
  const [showTppSearch, setShowTppSearch] = React.useState(false);
  const [showTtmtSearch, setShowTtmtSearch] = React.useState(false);
  const [showTtmtQuickFill, setShowTtmtQuickFill] = React.useState(false);

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

  // TPP/TTMT selection handlers
  const handleTppSelect = React.useCallback((tppItem: TppItem) => {
    setFormData(prev => ({
      ...prev,
      tppCode: tppItem.tppCode,
      tppName: tppItem.tppName,
    }));
  }, []);

  const handleTtmtSelect = React.useCallback((ttmtItem: TtmtItem) => {
    setFormData(prev => ({
      ...prev,
      ttmtCode: ttmtItem.ttmtCode,
      ttmtName: ttmtItem.fsn, // Use FSN as the name
    }));
  }, []);

  // Handler for TTMT quick-fill (fills entire form from TTMT product)
  const handleTtmtQuickFill = React.useCallback((ttmtItem: TtmtItem) => {
    const mappedUnit = mapTtmtUnitToUnit(ttmtItem.dispensingUnit);

    setFormData(prev => ({
      ...prev,
      // Auto-set type to finished_goods for TTMT products
      type: 'finished_goods',
      // Use FSN as Thai name, trade name as English name
      nameTh: ttmtItem.fsn || ttmtItem.tradeName || '',
      nameEn: ttmtItem.tradeName || '',
      // Always set category to "Finished Product" for TTMT products
      category: 'finished',
      // Map unit from dispensing unit
      primaryUnit: mappedUnit,
      // Set TTMT codes
      ttmtCode: ttmtItem.ttmtCode,
      ttmtName: ttmtItem.fsn,
      // Enable VMI sync since this is from TTMT database
      vmiSyncEnabled: true,
      // Generate a code based on type
      code: generateItemCode('finished_goods'),
    }));
    setShowTtmtQuickFill(false);
  }, []);

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
                <DxButton
                  text="Back"
                  icon="back"
                  type="normal"
                  stylingMode="text"
                  onClick={onCancel}
                />
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
                <DxButton
                  text="Delete"
                  icon="trash"
                  type="danger"
                  onClick={onDelete}
                />
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

              {/* TTMT Quick Fill - Only show when creating new item */}
              {!isEditing && (
                <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-2xl border-2 border-dashed border-green-300 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-xl">
                        <Sparkles className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Quick Fill from TTMT Database</h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Search well-known Thai Traditional Medicine products and auto-fill the form
                        </p>
                      </div>
                    </div>
                    <DxButton
                      text="Search TTMT Products"
                      icon="search"
                      type="success"
                      stylingMode="contained"
                      onClick={() => setShowTtmtQuickFill(true)}
                    />
                  </div>
                </div>
              )}

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
                    <div className="flex gap-2">
                      <DxTextBox
                        value={formData.code}
                        onValueChange={(value) => updateFormData('code', value)}
                        placeholder="RM-0001"
                        className="flex-1"
                      />
                      <DxButton
                        text="Generate"
                        type="normal"
                        stylingMode="outlined"
                        onClick={handleGenerateCode}
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <DxSelectBox
                      items={categoryOptions}
                      value={formData.category}
                      onValueChange={(value) => updateFormData('category', value)}
                      valueExpr="value"
                      displayExpr="label"
                      disabled={categoriesLoading}
                      placeholder="Select category"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (Thai)</label>
                    <DxTextBox
                      value={formData.nameTh}
                      onValueChange={(value) => updateFormData('nameTh', value)}
                      placeholder="ชื่อสินค้าภาษาไทย"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                    <DxTextBox
                      value={formData.nameEn}
                      onValueChange={(value) => updateFormData('nameEn', value)}
                      placeholder="English name (optional)"
                    />
                  </div>
                  {/* FR-059: Strength field for finished goods */}
                  {formData.type === 'finished_goods' && (
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Strength/Dosage</label>
                      <DxTextBox
                        value={formData.strength}
                        onValueChange={(value) => updateFormData('strength', value)}
                        placeholder="e.g., 500mg, 250mg/5ml"
                      />
                      <p className="text-xs text-gray-500 mt-1">Dosage strength for GMP compliance</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* VMI Standard Codes - Only for Finished Goods */}
              {formData.type === 'finished_goods' && (
              <SectionCard
                icon={<Barcode className="h-5 w-5 text-gray-600" />}
                title="VMI Standard Codes"
                description="Thai pharmaceutical and traditional medicine codes for VMI Portal integration"
              >
                {/* VMI Sync Enable Toggle */}
                <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${formData.vmiSyncEnabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <RefreshCw className={`h-5 w-5 ${formData.vmiSyncEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Enable VMI Sync</p>
                        <p className="text-xs text-gray-500">Include this item in VMI Portal synchronization</p>
                      </div>
                    </div>
                    <DxCheckBox
                      value={formData.vmiSyncEnabled}
                      onValueChange={(value) => updateFormData('vmiSyncEnabled', value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* TPP Code */}
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">TPP Code</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DxTextBox
                          value={formData.tppCode}
                          onValueChange={(value) => {
                            updateFormData('tppCode', value);
                            if (!value) updateFormData('tppName', '');
                          }}
                          placeholder="13-digit code"
                          maxLength={13}
                        />
                      </div>
                      <DxButton
                        icon="search"
                        hint="Search TPP codes from VMI Portal"
                        type="default"
                        stylingMode="outlined"
                        onClick={() => setShowTppSearch(true)}
                      />
                    </div>
                    {formData.tppName && (
                      <p className="text-xs text-blue-600 mt-1 truncate" title={formData.tppName}>
                        {formData.tppName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Thai Pharmaceutical Product code (13 digits)</p>
                  </div>

                  {/* TTMT Code */}
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">TTMT Code</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DxTextBox
                          value={formData.ttmtCode}
                          onValueChange={(value) => {
                            updateFormData('ttmtCode', value);
                            if (!value) updateFormData('ttmtName', '');
                          }}
                          placeholder="A + 8 digits"
                          maxLength={10}
                        />
                      </div>
                      <DxButton
                        icon="search"
                        hint="Search TTMT codes from VMI Portal"
                        type="default"
                        stylingMode="outlined"
                        onClick={() => setShowTtmtSearch(true)}
                      />
                    </div>
                    {formData.ttmtName && (
                      <p className="text-xs text-green-600 mt-1 truncate" title={formData.ttmtName}>
                        {formData.ttmtName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Thai Traditional Medicine Terminology code</p>
                  </div>
                </div>
                {formData.vmiSyncEnabled && (formData.tppCode || formData.ttmtCode) && (
                  <div className="mt-4 bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-emerald-100">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-sm text-emerald-700">
                      <span className="font-semibold">VMI Ready:</span> This item will be synced to VMI Portal
                    </div>
                  </div>
                )}
                {formData.vmiSyncEnabled && !formData.tppCode && !formData.ttmtCode && (
                  <div className="mt-4 bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-100">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-sm text-amber-700">
                      <span className="font-semibold">Add Standard Codes:</span> TPP or TTMT code recommended for proper VMI Portal identification
                    </div>
                  </div>
                )}
              </SectionCard>
              )}

              {/* TPP/TTMT Search Dialogs */}
              <TppSearchDialog
                open={showTppSearch}
                onOpenChange={setShowTppSearch}
                onSelect={handleTppSelect}
              />
              <TtmtSearchDialog
                open={showTtmtSearch}
                onOpenChange={setShowTtmtSearch}
                onSelect={handleTtmtSelect}
              />
              {/* TTMT Quick Fill Dialog for new item creation */}
              <TtmtSearchDialog
                open={showTtmtQuickFill}
                onOpenChange={setShowTtmtQuickFill}
                onSelect={handleTtmtQuickFill}
                title="Quick Fill from TTMT Products"
              />

              {/* Units of Measurement */}
              <SectionCard
                icon={<Scale className="h-5 w-5 text-gray-600" />}
                title="Units of Measurement"
                description="Primary and secondary units with conversion factor"
              >
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Primary Unit</label>
                      <DxSelectBox
                        items={unitOptions}
                        value={formData.primaryUnit}
                        onValueChange={(value) => updateFormData('primaryUnit', value)}
                        valueExpr="value"
                        displayExpr="label"
                        disabled={unitsLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Unit</label>
                      <DxSelectBox
                        items={unitOptionsWithNone}
                        value={formData.secondaryUnit}
                        onValueChange={(value) => updateFormData('secondaryUnit', value)}
                        valueExpr="value"
                        displayExpr="label"
                        disabled={unitsLoading}
                      />
                      <p className="text-xs text-gray-500 mt-1">Optional alternative unit</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Conversion Factor</label>
                      <DxNumberBox
                        value={formData.conversionFactor}
                        onValueChange={(value) => updateFormData('conversionFactor', value)}
                        placeholder="e.g., 1000"
                        disabled={!formData.secondaryUnit}
                        format="#,##0.###"
                      />
                      <p className="text-xs text-gray-500 mt-1">1 primary = X secondary</p>
                    </div>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock</label>
                    <DxNumberBox
                      value={formData.minStock}
                      onValueChange={(value) => updateFormData('minStock', value)}
                      placeholder="0"
                      format="#,##0.##"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert when stock falls below</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Stock</label>
                    <DxNumberBox
                      value={formData.maxStock}
                      onValueChange={(value) => updateFormData('maxStock', value)}
                      placeholder="0"
                      format="#,##0.##"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum storage capacity</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                    <DxNumberBox
                      value={formData.reorderPoint}
                      onValueChange={(value) => updateFormData('reorderPoint', value)}
                      placeholder="0"
                      format="#,##0.##"
                    />
                    <p className="text-xs text-gray-500 mt-1">Trigger reorder when reached</p>
                  </div>
                </div>
              </SectionCard>

              {/* Storage Requirements */}
              <SectionCard
                icon={<Thermometer className="h-5 w-5 text-gray-600" />}
                title="Storage Requirements"
                description="Shelf life and storage conditions"
              >
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Life (Days)</label>
                    <DxNumberBox
                      value={formData.shelfLifeDays}
                      onValueChange={(value) => updateFormData('shelfLifeDays', value)}
                      placeholder="e.g., 365"
                      format="#,##0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Days until expiration</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Storage Conditions</label>
                    <DxTextBox
                      value={formData.storageConditions}
                      onValueChange={(value) => updateFormData('storageConditions', value)}
                      placeholder="e.g., 15-25°C, Dry, Away from light"
                    />
                    <p className="text-xs text-gray-500 mt-1">Temperature, humidity, special requirements</p>
                  </div>
                </div>
              </SectionCard>

              {/* BOM Confidentiality Settings */}
              <SectionCard
                icon={<Lock className="h-5 w-5 text-gray-600" />}
                title="Confidentiality"
                description="Control access to cost and BOM information for this item"
              >
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confidentiality Level</label>
                    <DxSelectBox
                      items={confidentialityLevelOptions}
                      value={formData.confidentialityLevel}
                      onValueChange={(value) => updateFormData('confidentialityLevel', value as ConfidentialityLevel)}
                      valueExpr="value"
                      displayExpr="label"
                      placeholder="Select confidentiality level"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {confidentialityLevelOptions.find(o => o.value === formData.confidentialityLevel)?.description || 'Select a level'}
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.defaultConfidential ? 'bg-amber-100' : 'bg-gray-100'}`}>
                          <Lock className={`h-5 w-5 ${formData.defaultConfidential ? 'text-amber-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Default Confidential in BOM</p>
                          <p className="text-xs text-gray-500">When used as a component, mark as confidential by default</p>
                        </div>
                      </div>
                      <DxCheckBox
                        value={formData.defaultConfidential}
                        onValueChange={(value) => updateFormData('defaultConfidential', value)}
                      />
                    </div>
                  </div>

                  {formData.confidentialityLevel === 'confidential' && (
                    <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-100">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="text-sm text-amber-700">
                        <span className="font-semibold">Restricted Access:</span> Only users with confidential access will see cost and BOM details
                      </div>
                    </div>
                  )}
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

              {/* Item Images (only for editing) */}
              {isEditing && item?.id && (
                <ItemImagesSection itemId={item.id} />
              )}

              {/* VMI Price Offers (only for editing finished goods with VMI enabled) */}
              {isEditing && item?.id && formData.type === 'finished_goods' && formData.vmiSyncEnabled && (
                <ItemPriceOffersSection itemId={item.id} />
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
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">Reorder Point</span>
                      <span className="text-sm font-medium text-gray-900">{formData.reorderPoint?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">VMI Status</span>
                    {formData.tppCode || formData.ttmtCode ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600">Ready</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No VMI codes</span>
                    )}
                  </div>
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
              <DxButton
                text="Cancel"
                type="normal"
                stylingMode="text"
                onClick={onCancel}
                disabled={isSaving}
              />
            )}
            <DxButton
              text={isSaving ? 'Saving...' : isEditing ? 'Update Item' : 'Create Item'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={isSaving || !formData.code || !formData.nameTh}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemEditForm;
