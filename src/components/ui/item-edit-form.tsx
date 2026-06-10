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
import { useTranslations } from 'next-intl';

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
  // 3-level unit conversion (PU → SU → WU)
  weightUnit?: string | null;
  secondaryToWeightRate?: number | null;
  weightTrackingEnabled?: boolean;
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
  drugCode24: string | null;
  vmiSyncEnabled: boolean;
  // GMP Phase 4: Strength for finished goods (FR-059)
  strength: string | null;
  strengthValue: number | null;
  strengthUnit: string | null;
  gRegNumber: string | null;
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
  // 3-level unit conversion (PU → SU → WU)
  weightUnit: string;
  secondaryToWeightRate: number | null;
  weightTrackingEnabled: boolean;
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
  drugCode24: string;
  vmiSyncEnabled: boolean;
  // GMP Phase 4: Strength for finished goods (FR-059)
  strength: string;
  strengthValue: string; // kept as string for the form input; coerced on save
  strengthUnit: string;
  gRegNumber: string;
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

// Strength unit options — value + label kept identical so the stored unit is
// human-readable and BOM/WO can use it directly. Covers the herbal-medicine
// dosage forms in use plus the common potency units.
export const strengthUnitOptions = [
  { value: 'mg', label: 'mg' },
  { value: 'g', label: 'g' },
  { value: 'mcg', label: 'mcg' },
  { value: 'IU', label: 'IU' },
  { value: '%', label: '%' },
  { value: 'mg/แคปซูล', label: 'mg/แคปซูล' },
  { value: 'mg/เม็ด', label: 'mg/เม็ด' },
  { value: 'mg/ml', label: 'mg/ml' },
  { value: 'g/ซอง', label: 'g/ซอง' },
];

// Item types that carry a meaningful strength/potency value in herbal medicine:
// finished goods (per-capsule/tablet potency) and WIP/bulk (intermediate potency).
const STRENGTH_TYPES = ['finished_goods', 'wip'];

export const itemTypes = [
  { value: 'raw_material', label: 'Raw Material', translationKey: 'itemForm.types.raw_material', icon: Leaf, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200' },
  { value: 'packaging', label: 'Packaging', translationKey: 'itemForm.types.packaging', icon: Box, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200' },
  { value: 'wip', label: 'Work in Progress', translationKey: 'itemForm.types.wip', icon: FlaskConical, color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  { value: 'finished_goods', label: 'Finished Goods', translationKey: 'itemForm.types.finished_goods', icon: Pill, color: 'text-purple-600', bgColor: 'bg-purple-100', borderColor: 'border-purple-200' },
  { value: 'consumable', label: 'Consumable', translationKey: 'itemForm.types.consumable', icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
];

export const confidentialityLevelOptions = [
  { value: 'public', label: 'Public', description: 'Visible to all users', translationKey: 'itemForm.confidentialityLevels.public', descriptionKey: 'itemForm.confidentialityLevels.publicDesc' },
  { value: 'internal', label: 'Internal', description: 'Visible to internal staff only', translationKey: 'itemForm.confidentialityLevels.internal', descriptionKey: 'itemForm.confidentialityLevels.internalDesc' },
  { value: 'confidential', label: 'Confidential', description: 'Restricted access only', translationKey: 'itemForm.confidentialityLevels.confidential', descriptionKey: 'itemForm.confidentialityLevels.confidentialDesc' },
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
  weightUnit: '',
  secondaryToWeightRate: null,
  weightTrackingEnabled: false,
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
  drugCode24: '',
  vmiSyncEnabled: false,
  strength: '',
  strengthValue: '',
  strengthUnit: '',
  gRegNumber: '',
  confidentialityLevel: 'public',
  defaultConfidential: false,
});

export const itemToFormData = (item: Item): ItemFormData => {
  // API may return conversionRate (DB field) or conversionFactor (mapped field)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = item as any;
  const conversionValue = raw.conversionFactor ?? raw.conversionRate ?? null;
  const conversionFactor = conversionValue != null ? Number(conversionValue) : null;

  return {
  code: item.code,
  nameTh: item.nameTh,
  nameEn: item.nameEn || '',
  type: item.type,
  category: item.category || '',
  primaryUnit: item.primaryUnit,
  secondaryUnit: item.secondaryUnit || '',
  conversionFactor: isNaN(conversionFactor as number) ? null : conversionFactor,
  weightUnit: item.weightUnit || '',
  secondaryToWeightRate:
    item.secondaryToWeightRate != null ? Number(item.secondaryToWeightRate) : null,
  weightTrackingEnabled: item.weightTrackingEnabled === true,
  minStock: item.minStock != null ? Number(item.minStock) : null,
  maxStock: item.maxStock != null ? Number(item.maxStock) : null,
  reorderPoint: item.reorderPoint != null ? Number(item.reorderPoint) : null,
  shelfLifeDays: item.shelfLifeDays,
  storageConditions: item.storageConditions || (raw.storageCondition as string) || '',
  isActive: item.isActive,
  tppCode: item.tppCode || '',
  tppName: item.tppName || '',
  ttmtCode: item.ttmtCode || '',
  ttmtName: item.ttmtName || '',
  drugCode24: item.drugCode24 || '',
  vmiSyncEnabled: item.vmiSyncEnabled || false,
  strength: item.strength || '',
  strengthValue: item.strengthValue != null ? String(item.strengthValue) : '',
  strengthUnit: item.strengthUnit || '',
  gRegNumber: item.gRegNumber || '',
  confidentialityLevel: item.confidentialityLevel || 'public',
  defaultConfidential: item.defaultConfidential || false,
};
};

export const getTypeConfig = (type: string) => {
  return itemTypes.find(t => t.value === type) || itemTypes[4];
};

// Fallback — used only when the server API is unreachable.
// Prefer calling `/api/items/next-code?type=...` for proper sequential, gap-filling codes.
const generateItemCodeFallback = (type: string): string => {
  const prefix = type === 'raw_material' ? 'RM'
    : type === 'packaging' ? 'PK'
    : type === 'wip' ? 'WIP'
    : type === 'finished_goods' ? 'FG'
    : type === 'extract' ? 'EX'
    : type === 'consumable' ? 'CN'
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
  const t = useTranslations('inventory');
  const onHand = Number(item.onHand) || 0;
  const minStock = Number(item.minStock) || 0;
  const maxStock = Number(item.maxStock) || 0;
  const reorderPoint = Number(item.reorderPoint) || 0;

  const isLow = minStock > 0 && onHand < minStock;
  const isNearReorder = reorderPoint > 0 && onHand <= reorderPoint && !isLow;
  const isOverstock = maxStock > 0 && onHand > maxStock;
  const isHealthy = !isLow && !isNearReorder && !isOverstock;

  // Format number with commas and consistent decimals
  // Use fewer decimals for large-unit conversions (g, ml) to avoid noise
  const fmt = (n: number, maxDecimals = 4, minDecimals = 0) =>
    n.toLocaleString('en-US', { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals });

  // Secondary unit conversion — round to avoid floating-point noise
  const convFactor = Number(item.conversionFactor) || 0;
  const hasSecondary = !!(item.secondaryUnit && convFactor > 0);
  const secondaryOnHand = hasSecondary ? Math.round(onHand * convFactor * 10000) / 10000 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('itemForm.stock.currentLevel')}</span>
        <Badge
          variant={isLow ? 'danger' : isNearReorder ? 'warning' : isOverstock ? 'info' : 'success'}
          dot
        >
          {isLow ? t('itemForm.stock.low') : isNearReorder ? t('itemForm.stock.nearReorder') : isOverstock ? t('itemForm.stock.overstock') : t('itemForm.stock.healthy')}
        </Badge>
      </div>

      {/* Primary unit — fixed 2 decimal places for Current Stock Level */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-4xl font-bold tracking-tight',
            isLow ? 'text-red-600' : isNearReorder ? 'text-amber-600' : 'text-gray-900'
          )}>
            {fmt(onHand, 2, 2)}
          </span>
          <span className="text-lg text-gray-500">{item.primaryUnit}</span>
        </div>
        {/* Secondary unit (only if secondaryUnit + conversionFactor are defined) */}
        {hasSecondary && (
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={cn(
              'text-xl font-semibold',
              isLow ? 'text-red-500' : isNearReorder ? 'text-amber-500' : 'text-gray-600'
            )}>
              {fmt(secondaryOnHand, convFactor >= 100 ? 2 : 4)}
            </span>
            <span className="text-sm text-gray-400">{item.secondaryUnit}</span>
          </div>
        )}
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
            <span>{t('itemForm.stock.min', { value: fmt(minStock) })}</span>
            <span>{t('itemForm.stock.reorder', { value: fmt(reorderPoint) })}</span>
            <span>{t('itemForm.stock.max', { value: fmt(maxStock) })}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isLow && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('itemForm.stock.belowMinimum')}
          </div>
        )}
        {isNearReorder && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
            <Info className="h-3.5 w-3.5" />
            {t('itemForm.stock.approachingReorder')}
          </div>
        )}
        {isHealthy && !isOverstock && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <CheckCircle className="h-3.5 w-3.5" />
            {t('itemForm.stock.stockHealthy')}
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
  const t = useTranslations('inventory');
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
              {t(type.translationKey)}
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
  const t = useTranslations('inventory');
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
    // The API expects the singular field name `storageCondition` (matching the
    // DB column `storage_condition`). Our form state uses the plural form, so
    // map at the boundary — without this, the API silently drops the value.
    const payload = {
      ...formData,
      storageCondition: formData.storageConditions,
    } as ItemFormData & { storageCondition: string };
    await onSave(payload);
  };

  const handleGenerateCode = async () => {
    try {
      const res = await fetch(`/api/items/next-code?type=${encodeURIComponent(formData.type)}`);
      const json = await res.json();
      if (json?.success && json?.data?.code) {
        setFormData(prev => ({ ...prev, code: json.data.code }));
        return;
      }
      throw new Error(json?.error || 'Failed to generate code');
    } catch (err) {
      console.warn('next-code API failed, using random fallback:', err);
      setFormData(prev => ({ ...prev, code: generateItemCodeFallback(prev.type) }));
    }
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
      code: generateItemCodeFallback('finished_goods'),
    }));
    setShowTtmtQuickFill(false);
  }, []);

  const typeConfig = getTypeConfig(formData.type);
  const TypeIcon = typeConfig.icon;

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex-none px-4 md:px-6 py-4 border-b bg-white z-10">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              {onCancel && (
                <DxButton
                  text={t('itemForm.back')}
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
                  {isEditing ? t('itemForm.editTitle') : t('itemForm.createTitle')}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditing
                    ? t('itemForm.editSubtitle', { code: item.code, name: item.nameTh })
                    : t('itemForm.createSubtitle')}
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
                  {item.isActive ? t('itemForm.active') : t('itemForm.inactive')}
                </Badge>
              )}
              {showDelete && onDelete && (
                <DxButton
                  text={t('itemForm.delete')}
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
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 lg:py-8">
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
                        <h3 className="text-lg font-semibold text-gray-900">{t('itemForm.quickFill.title')}</h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {t('itemForm.quickFill.description')}
                        </p>
                      </div>
                    </div>
                    <DxButton
                      text={t('itemForm.quickFill.searchBtn')}
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
                title={t('itemForm.sections.type')}
                description={t('itemForm.sections.typeDesc')}
              >
                <TypeSelector
                  value={formData.type}
                  onChange={(value) => updateFormData('type', value)}
                />
              </SectionCard>

              {/* Basic Information */}
              <SectionCard
                icon={<Hash className="h-5 w-5 text-gray-600" />}
                title={t('itemForm.sections.basicInfo')}
                description={t('itemForm.sections.basicInfoDesc')}
              >
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.code')}</label>
                    <div className="flex gap-2">
                      <DxTextBox
                        value={formData.code}
                        onValueChange={(value) => updateFormData('code', value)}
                        placeholder={t('itemForm.placeholders.code')}
                        className="flex-1"
                      />
                      <DxButton
                        text={t('itemForm.generate')}
                        type="normal"
                        stylingMode="outlined"
                        onClick={handleGenerateCode}
                      />
                    </div>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.category')}</label>
                    <DxSelectBox
                      items={categoryOptions}
                      value={formData.category}
                      onValueChange={(value) => updateFormData('category', value)}
                      valueExpr="value"
                      displayExpr="label"
                      disabled={categoriesLoading}
                      placeholder={t('itemForm.placeholders.category')}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.nameTh')}</label>
                    <DxTextBox
                      value={formData.nameTh}
                      onValueChange={(value) => updateFormData('nameTh', value)}
                      placeholder={t('itemForm.placeholders.nameTh')}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.nameEn')}</label>
                    <DxTextBox
                      value={formData.nameEn}
                      onValueChange={(value) => updateFormData('nameEn', value)}
                      placeholder={t('itemForm.placeholders.nameEn')}
                    />
                  </div>
                  {/* FR-059: Strength — value + selectable unit, so BOM/WO can
                      compute (powder weight + empty capsule). Shown for the
                      types that carry a potency: finished goods and WIP/bulk. */}
                  {STRENGTH_TYPES.includes(formData.type) && (
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.strength')}</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <DxNumberBox
                            value={formData.strengthValue === '' ? null : Number(formData.strengthValue)}
                            onValueChange={(value) =>
                              updateFormData('strengthValue', value == null ? '' : String(value))
                            }
                            min={0}
                            placeholder="เช่น 500"
                          />
                        </div>
                        <div className="w-40">
                          <DxSelectBox
                            items={strengthUnitOptions}
                            value={formData.strengthUnit}
                            onValueChange={(value) => updateFormData('strengthUnit', value)}
                            displayExpr="label"
                            valueExpr="value"
                            placeholder="หน่วย"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.strength')}</p>
                    </div>
                  )}
                  {/* เลขที่ทะเบียน G */}
                  {formData.type === 'finished_goods' && (
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.gRegNumber')}</label>
                      <DxTextBox
                        value={formData.gRegNumber}
                        onValueChange={(value) => updateFormData('gRegNumber', value)}
                        placeholder={t('itemForm.placeholders.gRegNumber')}
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.gRegNumber')}</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* VMI Standard Codes - Only for Finished Goods */}
              {formData.type === 'finished_goods' && (
              <SectionCard
                icon={<Barcode className="h-5 w-5 text-gray-600" />}
                title={t('itemForm.sections.vmi')}
                description={t('itemForm.sections.vmiDesc')}
              >
                {/* VMI Sync Enable Toggle */}
                <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${formData.vmiSyncEnabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <RefreshCw className={`h-5 w-5 ${formData.vmiSyncEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{t('itemForm.vmi.enableSync')}</p>
                        <p className="text-xs text-gray-500">{t('itemForm.vmi.enableSyncDesc')}</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.tppCode')}</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DxTextBox
                          value={formData.tppCode}
                          onValueChange={(value) => {
                            updateFormData('tppCode', value);
                            if (!value) updateFormData('tppName', '');
                          }}
                          placeholder={t('itemForm.placeholders.tppCode')}
                          maxLength={13}
                        />
                      </div>
                      <DxButton
                        icon="search"
                        hint={t('itemForm.vmi.searchTpp')}
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
                    <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.tppCode')}</p>
                  </div>

                  {/* TTMT Code */}
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.ttmtCode')}</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DxTextBox
                          value={formData.ttmtCode}
                          onValueChange={(value) => {
                            updateFormData('ttmtCode', value);
                            if (!value) updateFormData('ttmtName', '');
                          }}
                          placeholder={t('itemForm.placeholders.ttmtCode')}
                          maxLength={10}
                        />
                      </div>
                      <DxButton
                        icon="search"
                        hint={t('itemForm.vmi.searchTtmt')}
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
                    <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.ttmtCode')}</p>
                  </div>
                </div>

                {/* Drug Code 24 digits */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.drugCode24')}</label>
                  <DxTextBox
                    value={formData.drugCode24}
                    onValueChange={(value) => updateFormData('drugCode24', value)}
                    placeholder={t('itemForm.placeholders.drugCode24')}
                    maxLength={24}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.drugCode24')}</p>
                </div>

                {formData.vmiSyncEnabled && (formData.tppCode || formData.ttmtCode) && (
                  <div className="mt-4 bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-emerald-100">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-sm text-emerald-700">
                      <span className="font-semibold">{t('itemForm.vmi.ready')}</span> {t('itemForm.vmi.readyDesc')}
                    </div>
                  </div>
                )}
                {formData.vmiSyncEnabled && !formData.tppCode && !formData.ttmtCode && (
                  <div className="mt-4 bg-amber-50 rounded-xl p-4 flex items-center gap-3 border border-amber-100">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-sm text-amber-700">
                      <span className="font-semibold">{t('itemForm.vmi.addCodes')}</span> {t('itemForm.vmi.addCodesDesc')}
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
                title={t('itemForm.quickFill.dialogTitle')}
              />

              {/* Units of Measurement */}
              <SectionCard
                icon={<Scale className="h-5 w-5 text-gray-600" />}
                title={t('itemForm.sections.units')}
                description={t('itemForm.sections.unitsDesc')}
              >
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.primaryUnit')}</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.secondaryUnit')}</label>
                      <DxSelectBox
                        items={unitOptionsWithNone}
                        value={formData.secondaryUnit}
                        onValueChange={(value) => updateFormData('secondaryUnit', value)}
                        valueExpr="value"
                        displayExpr="label"
                        disabled={unitsLoading}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.secondaryUnit')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.conversionFactor')}</label>
                      <DxNumberBox
                        value={formData.conversionFactor}
                        onValueChange={(value) => updateFormData('conversionFactor', value)}
                        placeholder={t('itemForm.placeholders.conversionFactor')}
                        disabled={!formData.secondaryUnit}
                        format="#,##0.###"
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.conversionFactor')}</p>
                    </div>
                  </div>

                  {formData.secondaryUnit && formData.conversionFactor && (
                    <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3 border border-blue-100">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Info className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-sm text-blue-700">
                        <span className="font-semibold">{t('itemForm.conversion.label')}</span> 1 {unitOptions.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit} = {formData.conversionFactor.toLocaleString()} {unitOptions.find(u => u.value === formData.secondaryUnit)?.label || formData.secondaryUnit}
                      </div>
                    </div>
                  )}

                  {/* Weight tracking (3rd level) — for items issued by SU but consumed by weight */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <DxCheckBox
                      text="เปิดใช้งานหน่วยชั่ง (Weight Unit) — สำหรับการเบิกจ่ายเป็นน้ำหนัก"
                      value={formData.weightTrackingEnabled}
                      onValueChange={(v) => updateFormData('weightTrackingEnabled', v)}
                      disabled={!formData.secondaryUnit || !formData.conversionFactor}
                    />
                    {formData.weightTrackingEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-5 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              หน่วยชั่ง (Weight Unit)
                            </label>
                            <DxSelectBox
                              items={unitOptionsWithNone}
                              value={formData.weightUnit}
                              onValueChange={(value) => updateFormData('weightUnit', value)}
                              valueExpr="value"
                              displayExpr="label"
                              disabled={unitsLoading}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              เช่น g (กรัม), ml (มิลลิลิตร)
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              อัตราแปลง (1 {unitOptions.find(u => u.value === formData.secondaryUnit)?.label || formData.secondaryUnit || 'SU'} = ? {unitOptions.find(u => u.value === formData.weightUnit)?.label || formData.weightUnit || 'WU'})
                            </label>
                            <DxNumberBox
                              value={formData.secondaryToWeightRate}
                              onValueChange={(value) => updateFormData('secondaryToWeightRate', value)}
                              placeholder="เช่น 0.1"
                              disabled={!formData.weightUnit}
                              format="#,##0.######"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              น้ำหนักต่อ 1 หน่วยรอง
                            </p>
                          </div>
                        </div>

                        {formData.weightUnit && formData.secondaryToWeightRate && formData.conversionFactor && (
                          <div className="mt-4 bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-emerald-100">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                              <Info className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-sm text-emerald-700">
                              <span className="font-semibold">3-Level conversion:</span>{' '}
                              1 {unitOptions.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit}
                              {' = '}
                              {formData.conversionFactor.toLocaleString()} {unitOptions.find(u => u.value === formData.secondaryUnit)?.label || formData.secondaryUnit}
                              {' = '}
                              {(formData.conversionFactor * formData.secondaryToWeightRate).toLocaleString(undefined, { maximumFractionDigits: 4 })} {unitOptions.find(u => u.value === formData.weightUnit)?.label || formData.weightUnit}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Inventory Management */}
              <SectionCard
                icon={<Warehouse className="h-5 w-5 text-gray-600" />}
                title={t('itemForm.sections.stock')}
                description={t('itemForm.sections.stockDesc')}
              >
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.minStock')}</label>
                    <DxNumberBox
                      value={formData.minStock}
                      onValueChange={(value) => updateFormData('minStock', value)}
                      placeholder="0"
                      format="#,##0.##"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.minStock')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.maxStock')}</label>
                    <DxNumberBox
                      value={formData.maxStock}
                      onValueChange={(value) => updateFormData('maxStock', value)}
                      placeholder="0"
                      format="#,##0.##"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.maxStock')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.reorderPoint')}</label>
                    <DxNumberBox
                      value={formData.reorderPoint}
                      onValueChange={(value) => updateFormData('reorderPoint', value)}
                      placeholder="0"
                      format="#,##0.##"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.reorderPoint')}</p>
                  </div>
                </div>
              </SectionCard>

              {/* Storage Requirements */}
              <SectionCard
                icon={<Thermometer className="h-5 w-5 text-gray-600" />}
                title={t('itemForm.sections.storage')}
                description={t('itemForm.sections.storageDesc')}
              >
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.shelfLifeYears')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <DxNumberBox
                          value={formData.shelfLifeDays !== null ? Math.floor(formData.shelfLifeDays / 365) : null}
                          onValueChange={(value) => {
                            const years = value || 0;
                            const currentMonths = formData.shelfLifeDays !== null ? Math.round((formData.shelfLifeDays % 365) / 30) : 0;
                            const next = (years * 365) + (currentMonths * 30) || null;
                            if (next !== formData.shelfLifeDays) {
                              updateFormData('shelfLifeDays', next);
                            }
                          }}
                          placeholder={t('itemForm.placeholders.years')}
                          min={0}
                          max={99}
                          format="#0"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('itemForm.placeholders.years')}</p>
                      </div>
                      <div>
                        <DxNumberBox
                          value={formData.shelfLifeDays !== null ? Math.round((formData.shelfLifeDays % 365) / 30) : null}
                          onValueChange={(value) => {
                            const months = value || 0;
                            const currentYears = formData.shelfLifeDays !== null ? Math.floor(formData.shelfLifeDays / 365) : 0;
                            const next = (currentYears * 365) + (months * 30) || null;
                            if (next !== formData.shelfLifeDays) {
                              updateFormData('shelfLifeDays', next);
                            }
                          }}
                          placeholder={t('itemForm.placeholders.months')}
                          min={0}
                          max={11}
                          format="#0"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('itemForm.placeholders.months')}</p>
                      </div>
                    </div>
                    {formData.shelfLifeDays !== null && formData.shelfLifeDays > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">
                        = {formData.shelfLifeDays.toLocaleString()} {t('itemForm.days')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.storageConditions')}</label>
                    <DxTextBox
                      value={formData.storageConditions}
                      onValueChange={(value) => updateFormData('storageConditions', value)}
                      placeholder={t('itemForm.placeholders.storageConditions')}
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('itemForm.hints.storageConditions')}</p>
                  </div>
                </div>
              </SectionCard>

              {/* BOM Confidentiality Settings */}
              <SectionCard
                icon={<Lock className="h-5 w-5 text-gray-600" />}
                title={t('itemForm.sections.confidentiality')}
                description={t('itemForm.sections.confidentialityDesc')}
              >
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('itemForm.fields.confidentialityLevel')}</label>
                    <DxSelectBox
                      items={confidentialityLevelOptions.map(o => ({ ...o, label: t(o.translationKey) }))}
                      value={formData.confidentialityLevel}
                      onValueChange={(value) => updateFormData('confidentialityLevel', value as ConfidentialityLevel)}
                      valueExpr="value"
                      displayExpr="label"
                      placeholder={t('itemForm.placeholders.confidentialityLevel')}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const opt = confidentialityLevelOptions.find(o => o.value === formData.confidentialityLevel);
                        return opt ? t(opt.descriptionKey) : t('itemForm.placeholders.confidentialityLevel');
                      })()}
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.defaultConfidential ? 'bg-amber-100' : 'bg-gray-100'}`}>
                          <Lock className={`h-5 w-5 ${formData.defaultConfidential ? 'text-amber-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{t('itemForm.fields.defaultConfidential')}</p>
                          <p className="text-xs text-gray-500">{t('itemForm.hints.defaultConfidential')}</p>
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
                        <span className="font-semibold">{t('itemForm.confidentialWarning.title')}</span> {t('itemForm.confidentialWarning.description')}
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
                  title={t('itemForm.sections.stockStatus')}
                  description={t('itemForm.sections.stockStatusDesc')}
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
                title={t('itemForm.sections.itemStatus')}
                description={t('itemForm.sections.itemStatusDesc')}
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
                      <span className="text-sm font-semibold text-gray-900">{t('itemForm.activeItem.label')}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t('itemForm.activeItem.description')}
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
                title={t('itemForm.sections.quickSummary')}
                description={t('itemForm.sections.quickSummaryDesc')}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">{t('itemForm.fields.type')}</span>
                    <div className="flex items-center gap-2">
                      <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                      <span className="text-sm font-medium text-gray-900">{t(typeConfig.translationKey)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">{t('itemForm.fields.primaryUnit')}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {unitOptions.find(u => u.value === formData.primaryUnit)?.label || formData.primaryUnit}
                    </span>
                  </div>
                  {formData.category && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">{t('itemForm.fields.category')}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {categoryOptions.find(c => c.value === formData.category)?.label || formData.category}
                      </span>
                    </div>
                  )}
                  {formData.shelfLifeDays && formData.shelfLifeDays > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">{t('itemForm.fields.shelfLife')}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Math.floor(formData.shelfLifeDays / 365) > 0 && `${Math.floor(formData.shelfLifeDays / 365)} ${t('itemForm.years')}`}
                        {Math.floor(formData.shelfLifeDays / 365) > 0 && Math.round((formData.shelfLifeDays % 365) / 30) > 0 && ' '}
                        {Math.round((formData.shelfLifeDays % 365) / 30) > 0 && `${Math.round((formData.shelfLifeDays % 365) / 30)} ${t('itemForm.months')}`}
                        {' '}({formData.shelfLifeDays} {t('itemForm.days')})
                      </span>
                    </div>
                  )}
                  {formData.minStock !== null && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">{t('itemForm.fields.minStock')}</span>
                      <span className="text-sm font-medium text-gray-900">{formData.minStock?.toLocaleString()}</span>
                    </div>
                  )}
                  {formData.reorderPoint !== null && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">{t('itemForm.fields.reorderPoint')}</span>
                      <span className="text-sm font-medium text-gray-900">{formData.reorderPoint?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">{t('itemForm.fields.vmiStatus')}</span>
                    {formData.tppCode || formData.ttmtCode ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600">{t('itemForm.vmi.vmiReady')}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">{t('itemForm.vmi.noVmiCodes')}</span>
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
                        <p className="text-sm font-semibold text-emerald-800">{t('itemForm.validation.readyToSave')}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">{t('itemForm.validation.allFieldsFilled')}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">{t('itemForm.validation.requiredFields')}</p>
                        <ul className="text-xs text-amber-600 mt-1 space-y-0.5">
                          {!formData.code && <li>• {t('itemForm.validation.codeRequired')}</li>}
                          {!formData.nameTh && <li>• {t('itemForm.validation.nameThRequired')}</li>}
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

      {/* Footer - pinned at bottom via flex layout */}
      <div className="flex-none border-t border-gray-200 bg-gray-50/80 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {isEditing && item?.createdAt ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('itemForm.lastUpdated', { date: new Date(item.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) })}
              </>
            ) : (
              <>{t('itemForm.creatingNew', { type: t(typeConfig.translationKey).toLowerCase() })}</>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <DxButton
                text={t('itemForm.cancel')}
                type="normal"
                stylingMode="outlined"
                onClick={onCancel}
                disabled={isSaving}
              />
            )}
            <DxButton
              text={isSaving ? t('itemForm.saving') : isEditing ? t('itemForm.updateBtn') : t('itemForm.createBtn')}
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
