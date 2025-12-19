'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export const warehouseTypes = [
  { value: 'raw_material', label: 'Raw Material', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200', description: 'Store raw materials and ingredients' },
  { value: 'wip', label: 'Work in Progress', icon: Activity, color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-200', description: 'Items currently in production' },
  { value: 'finished_goods', label: 'Finished Goods', icon: Boxes, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200', description: 'Completed products ready for sale' },
  { value: 'quarantine', label: 'Quarantine', icon: ShieldAlert, color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200', description: 'Items pending quality approval' },
  { value: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-200', description: 'Items that failed quality checks' },
  { value: 'cold_storage', label: 'Cold Storage', icon: Snowflake, color: 'text-cyan-600', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-200', description: 'Temperature-controlled storage' },
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
            <span className="font-medium text-sm">{type.label}</span>
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
  const utilizationPercent = Number(summary?.utilizationPercent) || 0;
  const totalLots = Number(summary?.totalLots) || 0;
  const usedCapacity = Number(summary?.usedCapacity) || 0;

  let statusColor = 'text-green-600';
  let statusBg = 'bg-green-500';
  let statusLabel = 'Normal';

  if (utilizationPercent >= 90) {
    statusColor = 'text-red-600';
    statusBg = 'bg-red-500';
    statusLabel = 'Critical';
  } else if (utilizationPercent >= 75) {
    statusColor = 'text-yellow-600';
    statusBg = 'bg-yellow-500';
    statusLabel = 'High';
  } else if (utilizationPercent >= 50) {
    statusColor = 'text-blue-600';
    statusBg = 'bg-blue-500';
    statusLabel = 'Moderate';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Storage Utilization</span>
        <span className={cn('text-sm font-medium', statusColor)}>{statusLabel}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-gray-900">{utilizationPercent}%</span>
        <span className="text-sm text-gray-500 mb-1">used</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', statusBg)}
          style={{ width: `${utilizationPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{totalLots} lots stored</span>
        <span>{usedCapacity.toFixed(0)} / {capacity ?? '-'} units</span>
      </div>
    </div>
  );
}

interface InventorySummaryProps {
  summary: WarehouseSummary | null;
}

export function InventorySummary({ summary }: InventorySummaryProps) {
  if (!summary) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No inventory data available
      </div>
    );
  }

  const stats = [
    { label: 'Total Lots', value: summary.totalLots, icon: Boxes, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Released', value: summary.releasedLots, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: 'Quarantine', value: summary.quarantineLots, icon: ShieldAlert, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: 'Near Expiry', value: summary.nearExpiryLots, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50' },
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
                <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
              <div className={cn('p-3 rounded-2xl', typeConfig.bgColor, typeConfig.borderColor, 'border')}>
                <TypeIcon className={cn('h-7 w-7', typeConfig.color)} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEditing ? 'Edit Warehouse' : 'Create New Warehouse'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditing
                    ? `Editing ${warehouse.code} - ${warehouse.name}`
                    : 'Add a new warehouse to your inventory system'}
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
                  {formData.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
              {showDelete && onDelete && (
                <Button type="button" variant="danger" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
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
                title="Warehouse Type"
                description="Select the type of warehouse"
                iconColor="text-emerald-600"
                iconBgColor="bg-emerald-100"
              >
                <TypeSelector
                  value={formData.type}
                  onChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                />
                <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  <Info className="h-4 w-4 inline-block mr-1 text-gray-400" />
                  {typeConfig.description}
                </p>
              </SectionCard>

              {/* Basic Information */}
              <SectionCard
                icon={Building2}
                title="Basic Information"
                description="Warehouse identification and location"
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Warehouse Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="WH-RM-001"
                        className="flex-1"
                      />
                      <Button type="button" variant="secondary" size="sm" onClick={generateCode}>
                        Generate
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Warehouse Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Main Warehouse"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 absolute ml-3" />
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Building A, Floor 1, Zone B"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Storage Capacity
                    </label>
                    <div className="flex items-center">
                      <Gauge className="h-4 w-4 text-gray-400 absolute ml-3" />
                      <Input
                        type="number"
                        value={formData.capacity ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          capacity: e.target.value ? parseInt(e.target.value) : null
                        }))}
                        placeholder="1000"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Maximum storage units</p>
                  </div>
                </div>
              </SectionCard>

              {/* Environmental Controls */}
              <SectionCard
                icon={Settings}
                title="Environmental Controls"
                description="Temperature and humidity requirements"
                iconColor="text-purple-600"
                iconBgColor="bg-purple-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Temperature */}
                  <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Thermometer className="h-5 w-5 text-cyan-600" />
                      <span className="font-medium text-cyan-800">Temperature Range (°C)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-cyan-700 mb-1">Minimum</label>
                        <Input
                          type="number"
                          value={formData.temperatureMin ?? ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            temperatureMin: e.target.value ? parseFloat(e.target.value) : null
                          }))}
                          placeholder="15"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-cyan-700 mb-1">Maximum</label>
                        <Input
                          type="number"
                          value={formData.temperatureMax ?? ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            temperatureMax: e.target.value ? parseFloat(e.target.value) : null
                          }))}
                          placeholder="25"
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
                      <span className="font-medium text-blue-800">Humidity Range (%)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-blue-700 mb-1">Minimum</label>
                        <Input
                          type="number"
                          value={formData.humidityMin ?? ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            humidityMin: e.target.value ? parseFloat(e.target.value) : null
                          }))}
                          placeholder="40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-blue-700 mb-1">Maximum</label>
                        <Input
                          type="number"
                          value={formData.humidityMax ?? ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            humidityMax: e.target.value ? parseFloat(e.target.value) : null
                          }))}
                          placeholder="65"
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
                  title="Storage Utilization"
                  description="Current capacity usage"
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
                  title="Inventory Summary"
                  description="Current lot statistics"
                  iconColor="text-blue-600"
                  iconBgColor="bg-blue-100"
                >
                  <InventorySummary summary={summary ?? null} />
                </SectionCard>
              )}

              {/* Status Toggle */}
              <SectionCard
                icon={CheckCircle}
                title="Warehouse Status"
                description="Active/Inactive status"
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
                    <span className="font-medium text-gray-900">Active Warehouse</span>
                    <p className="text-sm text-gray-500">Warehouse can receive inventory</p>
                  </div>
                </label>
              </SectionCard>

              {/* Quick Summary */}
              <SectionCard
                icon={Info}
                title="Quick Summary"
                description="Overview of warehouse configuration"
                iconColor="text-gray-600"
                iconBgColor="bg-gray-100"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Type</span>
                    <div className="flex items-center gap-2">
                      <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                      <span className="text-sm font-medium text-gray-900">{typeConfig.label}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Capacity</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.capacity ?? 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Temperature</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.temperatureMin !== null && formData.temperatureMax !== null
                        ? `${formData.temperatureMin}°C - ${formData.temperatureMax}°C`
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500">Humidity</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.humidityMin !== null && formData.humidityMax !== null
                        ? `${formData.humidityMin}% - ${formData.humidityMax}%`
                        : 'Not set'}
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
                    {isValid ? 'Ready to Save' : 'Missing Required Fields'}
                  </p>
                  <p className={cn('text-sm', isValid ? 'text-green-600' : 'text-yellow-600')}>
                    {isValid ? 'All required fields are filled' : 'Code and Name are required'}
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
              <>Created: {new Date(warehouse.createdAt).toLocaleDateString()}</>
            )}
          </span>
          <div className="flex items-center gap-3">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!isValid || isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : isEditing ? 'Update Warehouse' : 'Create Warehouse'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default WarehouseEditForm;
