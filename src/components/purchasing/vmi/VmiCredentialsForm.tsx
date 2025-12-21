'use client';

/**
 * VMI Credentials Form Component
 *
 * Form for configuring VMI Portal API credentials for a vendor.
 * Includes API key management, connection testing, and sync settings.
 */

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  Key,
  Globe,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Clock,
  Package,
  DollarSign,
  Warehouse,
  ShoppingCart,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Zap,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface VmiConfig {
  id?: number;
  vendorId: number;
  vmiVendorId?: string | null;
  baseUrl?: string | null;
  isConnected: boolean;
  lastConnectionAt?: string | null;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
  syncInventoryEnabled: boolean;
  orderPollIntervalMinutes: number;
  lastItemsSyncAt?: string | null;
  lastPricesSyncAt?: string | null;
  lastInventorySyncAt?: string | null;
  lastOrdersPollAt?: string | null;
}

export interface VmiCredentialsFormData {
  apiKey: string;
  vmiVendorId: string;
  baseUrl: string;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
  syncInventoryEnabled: boolean;
  orderPollIntervalMinutes: number;
}

export interface VmiCredentialsFormProps {
  vendorId: number;
  vendorName: string;
  config?: VmiConfig | null;
  isConfigured?: boolean;
  hasApiKey?: boolean;
  onSave: (data: VmiCredentialsFormData) => Promise<void>;
  onTestConnection: () => Promise<{ isConnected: boolean; error?: string }>;
  isSaving?: boolean;
  isTesting?: boolean;
  className?: string;
}

// ============================================================================
// Section Card Component
// ============================================================================

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'highlight' | 'warning' | 'success';
}

function SectionCard({ icon, title, description, children, className, variant = 'default' }: SectionCardProps) {
  const variants = {
    default: {
      border: 'border-gray-200',
      bg: 'bg-white',
      headerBg: 'bg-gray-50/50',
      headerBorder: 'border-gray-100',
      iconBg: 'bg-white border border-gray-200',
    },
    highlight: {
      border: 'border-blue-200',
      bg: 'bg-gradient-to-br from-blue-50/50 to-white',
      headerBg: 'bg-blue-50/50',
      headerBorder: 'border-blue-100',
      iconBg: 'bg-blue-100',
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-gradient-to-br from-amber-50/50 to-white',
      headerBg: 'bg-amber-50/50',
      headerBorder: 'border-amber-100',
      iconBg: 'bg-amber-100',
    },
    success: {
      border: 'border-emerald-200',
      bg: 'bg-gradient-to-br from-emerald-50/50 to-white',
      headerBg: 'bg-emerald-50/50',
      headerBorder: 'border-emerald-100',
      iconBg: 'bg-emerald-100',
    },
  };

  const v = variants[variant];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', v.border, v.bg, className)}>
      <div className={cn('px-5 py-4 border-b flex items-center gap-3', v.headerBorder, v.headerBg)}>
        <div className={cn('p-2.5 rounded-xl', v.iconBg)}>
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
// Connection Status Badge
// ============================================================================

interface ConnectionStatusProps {
  isConnected: boolean;
  lastConnectionAt?: string | null;
  isTesting?: boolean;
}

function ConnectionStatus({ isConnected, lastConnectionAt, isTesting }: ConnectionStatusProps) {
  if (isTesting) {
    return (
      <Badge variant="info" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Testing...
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Badge
        variant={isConnected ? 'success' : 'danger'}
        dot
      >
        {isConnected ? 'Connected' : 'Disconnected'}
      </Badge>
      {lastConnectionAt && (
        <span className="text-xs text-gray-500">
          Last tested: {new Date(lastConnectionAt).toLocaleString('th-TH')}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Sync Status Item
// ============================================================================

interface SyncStatusItemProps {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  lastSyncAt?: string | null;
}

function SyncStatusItem({ icon, label, enabled, lastSyncAt }: SyncStatusItemProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border',
      enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50/50'
    )}>
      <div className={cn(
        'p-2 rounded-lg',
        enabled ? 'bg-emerald-100' : 'bg-gray-100'
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          enabled ? 'text-gray-900' : 'text-gray-500'
        )}>
          {label}
        </p>
        {lastSyncAt ? (
          <p className="text-xs text-gray-500">
            Last sync: {new Date(lastSyncAt).toLocaleString('th-TH')}
          </p>
        ) : (
          <p className="text-xs text-gray-400">
            {enabled ? 'Never synced' : 'Disabled'}
          </p>
        )}
      </div>
      {enabled ? (
        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
      )}
    </div>
  );
}

// ============================================================================
// Main Form Component
// ============================================================================

export function VmiCredentialsForm({
  vendorId,
  vendorName,
  config,
  isConfigured = false,
  hasApiKey = false,
  onSave,
  onTestConnection,
  isSaving = false,
  isTesting = false,
  className,
}: VmiCredentialsFormProps) {
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [formData, setFormData] = React.useState<VmiCredentialsFormData>({
    apiKey: '',
    vmiVendorId: config?.vmiVendorId || '',
    baseUrl: config?.baseUrl || '',
    syncItemsEnabled: config?.syncItemsEnabled ?? true,
    syncPricesEnabled: config?.syncPricesEnabled ?? true,
    syncInventoryEnabled: config?.syncInventoryEnabled ?? true,
    orderPollIntervalMinutes: config?.orderPollIntervalMinutes ?? 15,
  });
  const [testResult, setTestResult] = React.useState<{ isConnected: boolean; error?: string } | null>(null);

  // Update form when config changes
  React.useEffect(() => {
    if (config) {
      setFormData({
        apiKey: '', // Never pre-fill API key for security
        vmiVendorId: config.vmiVendorId || '',
        baseUrl: config.baseUrl || '',
        syncItemsEnabled: config.syncItemsEnabled,
        syncPricesEnabled: config.syncPricesEnabled,
        syncInventoryEnabled: config.syncInventoryEnabled,
        orderPollIntervalMinutes: config.orderPollIntervalMinutes,
      });
    }
  }, [config]);

  const handleSave = async () => {
    await onSave(formData);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    const result = await onTestConnection();
    setTestResult(result);
  };

  const updateFormData = <K extends keyof VmiCredentialsFormData>(key: K, value: VmiCredentialsFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const isValid = isConfigured && hasApiKey || formData.apiKey.length > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Status */}
      <div className={cn(
        'rounded-2xl p-5 border',
        isConfigured && config?.isConnected
          ? 'bg-emerald-50 border-emerald-200'
          : isConfigured
          ? 'bg-amber-50 border-amber-200'
          : 'bg-gray-50 border-gray-200'
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            'p-3 rounded-xl',
            isConfigured && config?.isConnected
              ? 'bg-emerald-100'
              : isConfigured
              ? 'bg-amber-100'
              : 'bg-gray-100'
          )}>
            {isConfigured && config?.isConnected ? (
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            ) : isConfigured ? (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            ) : (
              <Key className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              VMI Portal Configuration for {vendorName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isConfigured && config?.isConnected
                ? 'VMI Portal is configured and connected. You can sync items, prices, and receive orders.'
                : isConfigured
                ? 'VMI Portal is configured but connection failed. Please verify your API key.'
                : 'Configure VMI Portal API credentials to enable synchronization with the hospital network.'}
            </p>
            {isConfigured && (
              <div className="mt-3">
                <ConnectionStatus
                  isConnected={config?.isConnected ?? false}
                  lastConnectionAt={config?.lastConnectionAt}
                  isTesting={isTesting}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Credentials */}
        <div className="col-span-7 space-y-6">
          {/* API Credentials */}
          <SectionCard
            icon={<Key className="h-5 w-5 text-gray-600" />}
            title="API Credentials"
            description="VMI Portal authentication settings"
            variant={hasApiKey ? 'success' : 'warning'}
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key {hasApiKey && <span className="text-gray-400">(leave blank to keep current)</span>}
                </label>
                <div className="flex gap-2">
                  <DxTextBox
                    value={formData.apiKey}
                    onValueChange={(value) => updateFormData('apiKey', value)}
                    placeholder={hasApiKey ? '••••••••••••••••' : 'Enter VMI Portal API Key'}
                    mode={showApiKey ? 'text' : 'password'}
                    className="flex-1"
                  />
                  <DxButton
                    icon={showApiKey ? 'eyeopen' : 'eyeclose'}
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setShowApiKey(!showApiKey)}
                    hint={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  API Key is encrypted at rest and never displayed after saving
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VMI Vendor ID</label>
                  <DxTextBox
                    value={formData.vmiVendorId}
                    onValueChange={(value) => updateFormData('vmiVendorId', value)}
                    placeholder="e.g., VMI-001"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional vendor identifier in VMI Portal</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Base URL</label>
                  <DxTextBox
                    value={formData.baseUrl}
                    onValueChange={(value) => updateFormData('baseUrl', value)}
                    placeholder="Leave blank for default"
                  />
                  <p className="text-xs text-gray-500 mt-1">Override default VMI Portal URL</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Sync Settings */}
          <SectionCard
            icon={<RefreshCw className="h-5 w-5 text-gray-600" />}
            title="Synchronization Settings"
            description="Configure which data to sync with VMI Portal"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <label className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                  formData.syncItemsEnabled
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}>
                  <DxCheckBox
                    value={formData.syncItemsEnabled}
                    onValueChange={(value) => updateFormData('syncItemsEnabled', value ?? false)}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Package className={cn('h-4 w-4', formData.syncItemsEnabled ? 'text-blue-600' : 'text-gray-400')} />
                      <span className="text-sm font-medium text-gray-900">Items</span>
                    </div>
                    <p className="text-xs text-gray-500">Sync product catalog</p>
                  </div>
                </label>

                <label className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                  formData.syncPricesEnabled
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}>
                  <DxCheckBox
                    value={formData.syncPricesEnabled}
                    onValueChange={(value) => updateFormData('syncPricesEnabled', value ?? false)}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className={cn('h-4 w-4', formData.syncPricesEnabled ? 'text-blue-600' : 'text-gray-400')} />
                      <span className="text-sm font-medium text-gray-900">Prices</span>
                    </div>
                    <p className="text-xs text-gray-500">Sync price offers</p>
                  </div>
                </label>

                <label className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                  formData.syncInventoryEnabled
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}>
                  <DxCheckBox
                    value={formData.syncInventoryEnabled}
                    onValueChange={(value) => updateFormData('syncInventoryEnabled', value ?? false)}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Warehouse className={cn('h-4 w-4', formData.syncInventoryEnabled ? 'text-blue-600' : 'text-gray-400')} />
                      <span className="text-sm font-medium text-gray-900">Inventory</span>
                    </div>
                    <p className="text-xs text-gray-500">Sync stock levels</p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Poll Interval
                </label>
                <div className="flex items-center gap-3">
                  <DxNumberBox
                    value={formData.orderPollIntervalMinutes}
                    onValueChange={(value) => updateFormData('orderPollIntervalMinutes', value ?? 15)}
                    min={5}
                    max={60}
                    format="#0"
                    width={100}
                  />
                  <span className="text-sm text-gray-500">minutes (5-60)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  How often to check for new orders from hospitals
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column - Status & Actions */}
        <div className="col-span-5 space-y-6">
          {/* Connection Test */}
          <SectionCard
            icon={<Zap className="h-5 w-5 text-gray-600" />}
            title="Connection Test"
            description="Verify VMI Portal connectivity"
            variant={testResult?.isConnected ? 'success' : testResult?.error ? 'warning' : 'default'}
          >
            <div className="space-y-4">
              <DxButton
                text={isTesting ? 'Testing...' : 'Test Connection'}
                icon={isTesting ? undefined : 'check'}
                type="default"
                stylingMode="contained"
                width="100%"
                onClick={handleTestConnection}
                disabled={isTesting || (!hasApiKey && !formData.apiKey)}
              />

              {testResult && (
                <div className={cn(
                  'p-4 rounded-xl border',
                  testResult.isConnected
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                )}>
                  <div className="flex items-start gap-3">
                    {testResult.isConnected ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        testResult.isConnected ? 'text-emerald-800' : 'text-red-800'
                      )}>
                        {testResult.isConnected ? 'Connection Successful' : 'Connection Failed'}
                      </p>
                      {testResult.error && (
                        <p className="text-xs text-red-600 mt-1">{testResult.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!hasApiKey && !formData.apiKey && (
                <p className="text-xs text-gray-500 text-center">
                  Enter an API key to test the connection
                </p>
              )}
            </div>
          </SectionCard>

          {/* Sync Status */}
          {isConfigured && (
            <SectionCard
              icon={<Clock className="h-5 w-5 text-gray-600" />}
              title="Sync Status"
              description="Current synchronization status"
            >
              <div className="space-y-3">
                <SyncStatusItem
                  icon={<Package className={cn('h-4 w-4', config?.syncItemsEnabled ? 'text-emerald-600' : 'text-gray-400')} />}
                  label="Items Sync"
                  enabled={config?.syncItemsEnabled ?? false}
                  lastSyncAt={config?.lastItemsSyncAt}
                />
                <SyncStatusItem
                  icon={<DollarSign className={cn('h-4 w-4', config?.syncPricesEnabled ? 'text-emerald-600' : 'text-gray-400')} />}
                  label="Prices Sync"
                  enabled={config?.syncPricesEnabled ?? false}
                  lastSyncAt={config?.lastPricesSyncAt}
                />
                <SyncStatusItem
                  icon={<Warehouse className={cn('h-4 w-4', config?.syncInventoryEnabled ? 'text-emerald-600' : 'text-gray-400')} />}
                  label="Inventory Sync"
                  enabled={config?.syncInventoryEnabled ?? false}
                  lastSyncAt={config?.lastInventorySyncAt}
                />
                <SyncStatusItem
                  icon={<ShoppingCart className={cn('h-4 w-4', 'text-emerald-600')} />}
                  label="Orders Poll"
                  enabled={true}
                  lastSyncAt={config?.lastOrdersPollAt}
                />
              </div>
            </SectionCard>
          )}

          {/* Save Button */}
          <div className="sticky bottom-0 pt-4">
            <DxButton
              text={isSaving ? 'Saving...' : isConfigured ? 'Update Configuration' : 'Save Configuration'}
              icon="save"
              type="success"
              stylingMode="contained"
              width="100%"
              onClick={handleSave}
              disabled={isSaving || !isValid}
            />
            {!isValid && (
              <p className="text-xs text-amber-600 text-center mt-2">
                Please enter an API key to save the configuration
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VmiCredentialsForm;
