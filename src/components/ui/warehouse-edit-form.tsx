'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  Warehouse,
  MapPin,
  Thermometer,
  Droplets,
  Package,
  AlertTriangle,
  CheckCircle,
  Info,
  Save,
  ArrowLeft,
  Trash2,
  Snowflake,
  ShieldAlert,
  XCircle,
  Boxes,
  Clock,
  Activity,
  Settings,
  Building2,
  Gauge,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string | null;
  capacity: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface WarehouseFormData {
  code: string;
  name: string;
  type: string;
  location: string;
  capacity: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityMin: number | null;
  humidityMax: number | null;
  isActive: boolean;
}

export interface WarehouseSummary {
  totalLots: number;
  totalQuantity: number;
  quarantineLots: number;
  releasedLots: number;
  rejectedLots: number;
  nearExpiryLots: number;
  inventoryByType: Record<string, { count: number; quantity: number }>;
  storageCapacity: number;
  usedCapacity: number;
  utilizationPercent: number;
}

export interface WarehouseEditFormProps {
  warehouse?: Warehouse | null;
  summary?: WarehouseSummary | null;
  onSave: (data: WarehouseFormData) => Promise<void>;
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

// Keep the type config as a function so callers can pass the translator;
// avoids stale English strings when the user switches locales.
export const warehouseTypes = [
  { value: 'raw_material', labelKey: 'rawMaterial', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200' },
  { value: 'wip', labelKey: 'wip', icon: Activity, color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  { value: 'finished_goods', labelKey: 'finishedGoods', icon: Boxes, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200' },
  { value: 'quarantine', labelKey: 'quarantine', icon: ShieldAlert, color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200' },
  { value: 'rejected', labelKey: 'rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-200' },
  { value: 'cold_storage', labelKey: 'coldStorage', icon: Snowflake, color: 'text-cyan-600', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-200' },
];

export const getTypeConfig = (type: string) => {
  return warehouseTypes.find(t => t.value === type) || warehouseTypes[0];
};

export const getDefaultFormData = (): WarehouseFormData => ({
  code: '',
  name: '',
  type: 'raw_material',
  location: '',
  capacity: null,
  temperatureMin: null,
  temperatureMax: null,
  humidityMin: null,
  humidityMax: null,
  isActive: true,
});

export const warehouseToFormData = (warehouse: Warehouse): WarehouseFormData => ({
  code: warehouse.code,
  name: warehouse.name,
  type: warehouse.type,
  location: warehouse.location || '',
  capacity: warehouse.capacity,
  temperatureMin: warehouse.temperatureMin,
  temperatureMax: warehouse.temperatureMax,
  humidityMin: warehouse.humidityMin,
  humidityMax: warehouse.humidityMax,
  isActive: warehouse.isActive,
});

// ============================================================================
// Sub-Components
// ============================================================================

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
}

export function SectionCard({ icon: Icon, title, description, children, iconColor = 'text-gray-600', iconBgColor = 'bg-gray-100' }: SectionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className={cn('p-2 rounded-xl', iconBgColor)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface TypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  const t = useTranslations('inventory');
  return (
    <div className="flex flex-wrap gap-2">
      {warehouseTypes.map((type) => {
        const Icon = type.icon;
        const isSelected = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all',
              isSelected
                ? `${type.bgColor} ${type.borderColor} ${type.color}`
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium text-sm">{t(`warehouses.types.${type.labelKey}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

interface StorageUtilizationProps {
  summary: WarehouseSummary | null;
  capacity: number | null;
}

export function StorageUtilization({ summary, capacity }: StorageUtilizationProps) {
  const t = useTranslations('inventory');
  const utilizationPercent = Number(summary?.utilizationPercent) || 0;
  const totalLots = Number(summary?.totalLots) || 0;
  const usedCapacity = Number(summary?.usedCapacity) || 0;

  let statusColor = 'text-green-600';
  let statusBg = 'bg-green-500';
  let statusLabel = t('warehouses.form.utilization.normal');

  if (utilizationPercent >= 90) {
    statusColor = 'text-red-600';
    statusBg = 'bg-red-500';
    statusLabel = t('warehouses.form.utilization.critical');
  } else if (utilizationPercent >= 75) {
    statusColor = 'text-yellow-600';
    statusBg = 'bg-yellow-500';
    statusLabel = t('warehouses.form.utilization.high');
  } else if (utilizationPercent >= 50) {
    statusColor = 'text-blue-600';
    statusBg = 'bg-blue-500';
    statusLabel = t('warehouses.form.utilization.moderate');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{t('warehouses.form.utilization.label')}</span>
        <span className={cn('text-sm font-medium', statusColor)}>{statusLabel}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-gray-900">{utilizationPercent}%</span>
        <span className="text-sm text-gray-500 mb-1">{t('warehouses.form.utilization.used')}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', statusBg)}
          style={{ width: `${utilizationPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{t('warehouses.form.utilization.lotsStored', { count: totalLots })}</span>
        <span>{t('warehouses.form.utilization.capacityUnit', { used: usedCapacity.toFixed(0), capacity: capacity ?? '-' })}</span>
      </div>
    </div>
  );
}

interface InventorySummaryProps {
  summary: WarehouseSummary | null;
}

export function InventorySummary({ summary }: InventorySummaryProps) {
  const t = useTranslations('inventory');
  if (!summary) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        {t('warehouses.form.summary.noData')}
      </div>
    );
  }

  const stats = [
    { label: t('warehouses.form.summary.totalLots'), value: summary.totalLots, icon: Boxes, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: t('warehouses.form.summary.released'), value: summary.releasedLots, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: t('warehouses.form.summary.quarantine'), value: summary.quarantineLots, icon: ShieldAlert, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: t('warehouses.form.summary.nearExpiry'), value: summary.nearExpiryLots, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className={cn('rounded-xl p-3', stat.bgColor)}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('h-4 w-4', stat.color)} />
              <span className="text-xs text-gray-600">{stat.label}</span>
            </div>
            <span className={cn('text-xl font-bold', stat.color)}>{stat.value}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WarehouseEditForm({
  warehouse,
  summary,
  onSave,
  onCancel,
  onDelete,
  isSaving = false,
  showHeader = true,
  showDelete = false,
  className,
}: WarehouseEditFormProps) {
  const t = useTranslations('inventory');
  const isEditing = !!warehouse;
  const [formData, setFormData] = React.useState<WarehouseFormData>(
    warehouse ? warehouseToFormData(warehouse) : getDefaultFormData()
  );

  // Update form data when warehouse prop changes
  React.useEffect(() => {
    if (warehouse) {
      setFormData(warehouseToFormData(warehouse));
    } else {
      setFormData(getDefaultFormData());
    }
  }, [warehouse]);

  const typeConfig = getTypeConfig(formData.type);
  const TypeIcon = typeConfig.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const generateCode = () => {
    const prefix = formData.type === 'raw_material' ? 'WH-RM' :
                   formData.type === 'finished_goods' ? 'WH-FG' :
                   formData.type === 'quarantine' ? 'WH-QA' :
                   formData.type === 'rejected' ? 'WH-RJ' :
                   formData.type === 'cold_storage' ? 'WH-CS' :
                   formData.type === 'wip' ? 'WH-WIP' : 'WH';
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, code: `${prefix}-${random}` }));
  };

  // Validation
  const isValid = formData.code && formData.name;

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex-none px-8 py-5 border-b bg-white">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              {onCancel && (
                <DxButton
                  text={t('warehouses.form.back')}
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
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEditing ? t('warehouses.form.editTitle') : t('warehouses.form.createTitle')}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditing
                    ? t('warehouses.form.editSubtitle', { code: warehouse.code, name: warehouse.name })
                    : t('warehouses.form.createSubtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isEditing && (
                <Badge
                  variant={formData.isActive ? 'success' : 'danger'}
                  dot
                  className="text-sm px-3 py-1"
                >
                  {formData.isActive ? t('warehouses.form.status.active') : t('warehouses.form.status.inactive')}
                </Badge>
              )}
              {showDelete && onDelete && (
                <DxButton
                  text={t('warehouses.form.deleteBtn')}
                  icon="trash"
                  type="danger"
                  onClick={onDelete}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-8">
          <div className="grid grid-cols-12 gap-6">
            {/* Main Form - Left Column */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Warehouse Type */}
              <SectionCard
                icon={Warehouse}
                title={t('warehouses.form.warehouseTypeTitle')}
                description={t('warehouses.form.warehouseTypeDesc')}
                iconColor="text-emerald-600"
                iconBgColor="bg-emerald-100"
              >
                <TypeSelector
                  value={formData.type}
                  onChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                />
                <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  <Info className="h-4 w-4 inline-block mr-1 text-gray-400" />
                  {t(`warehouses.typeDescriptions.${typeConfig.labelKey}`)}
                </p>
              </SectionCard>

              {/* Basic Information */}
              <SectionCard
                icon={Building2}
                title={t('warehouses.form.basicInfoTitle')}
                description={t('warehouses.form.basicInfoDesc')}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('warehouses.form.fields.code')} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <DxTextBox
                        value={formData.code}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, code: value }))}
                        placeholder={t('warehouses.form.placeholders.code')}
                        className="flex-1"
                      />
                      <DxButton
                        text={t('warehouses.form.generateCode')}
                        type="normal"
                        stylingMode="outlined"
                        onClick={generateCode}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('warehouses.form.fields.name')} <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      value={formData.name}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                      placeholder={t('warehouses.form.placeholders.name')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('warehouses.form.fields.location')}
                    </label>
                    <DxTextBox
                      value={formData.location}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                      placeholder={t('warehouses.form.placeholders.location')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('warehouses.form.fields.capacity')}
                    </label>
                    <DxNumberBox
                      value={formData.capacity}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        capacity: value
                      }))}
                      placeholder={t('warehouses.form.placeholders.capacity')}
                      format="#,##0"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('warehouses.form.fields.capacityHint')}</p>
                  </div>
                </div>
              </SectionCard>

              {/* Environmental Controls */}
              <SectionCard
                icon={Settings}
                title={t('warehouses.form.envControlsTitle')}
                description={t('warehouses.form.envControlsDesc')}
                iconColor="text-purple-600"
                iconBgColor="bg-purple-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Temperature */}
                  <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Thermometer className="h-5 w-5 text-cyan-600" />
                      <span className="font-medium text-cyan-800">{t('warehouses.form.fields.tempRangeLabel')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-cyan-700 mb-1">{t('warehouses.form.fields.minimum')}</label>
                        <DxNumberBox
                          value={formData.temperatureMin}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            temperatureMin: value
                          }))}
                          placeholder={t('warehouses.form.placeholders.tempMin')}
                          format="#0.#"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-cyan-700 mb-1">{t('warehouses.form.fields.maximum')}</label>
                        <DxNumberBox
                          value={formData.temperatureMax}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            temperatureMax: value
                          }))}
                          placeholder={t('warehouses.form.placeholders.tempMax')}
                          format="#0.#"
                        />
                      </div>
                    </div>
                    {formData.temperatureMin !== null && formData.temperatureMax !== null && (
                      <p className="text-sm text-cyan-700 mt-3 text-center font-medium">
                        {formData.temperatureMin}°C — {formData.temperatureMax}°C
                      </p>
                    )}
                  </div>

                  {/* Humidity */}
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Droplets className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">{t('warehouses.form.fields.humidityRangeLabel')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-blue-700 mb-1">{t('warehouses.form.fields.minimum')}</label>
                        <DxNumberBox
                          value={formData.humidityMin}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            humidityMin: value
                          }))}
                          placeholder={t('warehouses.form.placeholders.humidityMin')}
                          format="#0.#"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700 mb-1">{t('warehouses.form.fields.maximum')}</label>
                        <DxNumberBox
                          value={formData.humidityMax}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            humidityMax: value
                          }))}
                          placeholder={t('warehouses.form.placeholders.humidityMax')}
                          format="#0.#"
                        />
                      </div>
                    </div>
                    {formData.humidityMin !== null && formData.humidityMax !== null && (
                      <p className="text-sm text-blue-700 mt-3 text-center font-medium">
                        {formData.humidityMin}% — {formData.humidityMax}%
                      </p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Sidebar - Right Column */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* Storage Utilization - Only show for existing warehouses */}
              {isEditing && (
                <SectionCard
                  icon={Gauge}
                  title={t('warehouses.form.storageUtilizationTitle')}
                  description={t('warehouses.form.storageUtilizationDesc')}
                  iconColor="text-emerald-600"
                  iconBgColor="bg-emerald-100"
                >
                  <StorageUtilization summary={summary ?? null} capacity={formData.capacity} />
                </SectionCard>
              )}

              {/* Inventory Summary - Only show for existing warehouses */}
              {isEditing && (
                <SectionCard
                  icon={Boxes}
                  title={t('warehouses.form.inventorySummaryTitle')}
                  description={t('warehouses.form.inventorySummaryDesc')}
                  iconColor="text-blue-600"
                  iconBgColor="bg-blue-100"
                >
                  <InventorySummary summary={summary ?? null} />
                </SectionCard>
              )}

              {/* Status Toggle */}
              <SectionCard
                icon={CheckCircle}
                title={t('warehouses.form.warehouseStatusTitle')}
                description={t('warehouses.form.warehouseStatusDesc')}
                iconColor="text-green-600"
                iconBgColor="bg-green-100"
              >
                <label
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    formData.isActive
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-12 h-7 rounded-full relative transition-colors',
                    formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                  )}>
                    <div className={cn(
                      'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      formData.isActive ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{t('warehouses.form.activeWarehouse')}</span>
                    <p className="text-sm text-gray-500">{t('warehouses.form.activeWarehouseDesc')}</p>
                  </div>
                </label>
              </SectionCard>

              {/* Quick Summary */}
              <SectionCard
                icon={Info}
                title={t('warehouses.form.quickSummaryTitle')}
                description={t('warehouses.form.quickSummaryDesc')}
                iconColor="text-gray-600"
                iconBgColor="bg-gray-100"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">{t('warehouses.form.fields.type')}</span>
                    <div className="flex items-center gap-2">
                      <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                      <span className="text-sm font-medium text-gray-900">{t(`warehouses.types.${typeConfig.labelKey}`)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">{t('warehouses.form.fields.capacity')}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.capacity ?? t('warehouses.form.fields.notSet')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">{t('warehouses.form.fields.temperature')}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.temperatureMin !== null && formData.temperatureMax !== null
                        ? `${formData.temperatureMin}°C - ${formData.temperatureMax}°C`
                        : t('warehouses.form.fields.notSet')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500">{t('warehouses.form.fields.humidity')}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.humidityMin !== null && formData.humidityMax !== null
                        ? `${formData.humidityMin}% - ${formData.humidityMax}%`
                        : t('warehouses.form.fields.notSet')}
                    </span>
                  </div>
                </div>
              </SectionCard>

              {/* Validation Status */}
              <div className={cn(
                'rounded-2xl p-4 flex items-center gap-3',
                isValid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              )}>
                {isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <p className={cn('font-medium', isValid ? 'text-green-800' : 'text-yellow-800')}>
                    {isValid ? t('warehouses.form.validation.ready') : t('warehouses.form.validation.missing')}
                  </p>
                  <p className={cn('text-sm', isValid ? 'text-green-600' : 'text-yellow-600')}>
                    {isValid ? t('warehouses.form.validation.readyDesc') : t('warehouses.form.validation.missingDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none px-8 py-4 border-t bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {isEditing && warehouse?.createdAt && (
              <>{t('warehouses.form.createdOn', { date: new Date(warehouse.createdAt).toLocaleDateString() })}</>
            )}
          </span>
          <div className="flex items-center gap-3">
            {onCancel && (
              <DxButton
                text={t('warehouses.form.cancel')}
                type="normal"
                stylingMode="outlined"
                onClick={onCancel}
              />
            )}
            <DxButton
              text={isSaving ? t('warehouses.form.saving') : isEditing ? t('warehouses.form.updateBtn') : t('warehouses.form.createBtn')}
              icon="save"
              type="success"
              useSubmitBehavior
              disabled={!isValid || isSaving}
            />
          </div>
        </div>
      </div>
    </form>
  );
}

export default WarehouseEditForm;
