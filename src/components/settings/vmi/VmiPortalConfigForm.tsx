'use client';

/**
 * VMI Portal Configuration Form Component
 *
 * Form for creating and editing VMI Portal configurations.
 * This system IS the vendor - configures connections TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useRef, useCallback } from 'react';
import { DxForm, DxFormItem, DxFormGroup, validateFormGroup, resetFormValidation } from '@/components/ui/dx-form';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, Wifi, WifiOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { VmiPortalConfigInput, VmiPortalConfigUpdate, VmiPortalTestResult } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface VmiPortalConfigSummary {
  id: number;
  name: string;
  portalUrl: string;
  vendorId: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  syncInventoryEnabled: boolean;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
  orderPollingEnabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastErrorMessage?: string | null;
  lastInventorySyncAt?: string | null;
  lastItemsSyncAt?: string | null;
  lastPricesSyncAt?: string | null;
  lastOrdersPollAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VmiPortalConfigFormProps {
  /** Portal configuration to edit, or undefined for create mode */
  portal?: VmiPortalConfigSummary;
  /** Whether the form is visible */
  visible: boolean;
  /** Callback when form is closed */
  onClose: () => void;
  /** Callback when save is successful */
  onSave: (portal: VmiPortalConfigSummary) => void;
}

interface FormData {
  name: string;
  portalUrl: string;
  apiKey: string;
  vendorId: string;
  isEnabled: boolean;
  syncInventoryEnabled: boolean;
  syncInventoryInterval: number;
  syncItemsEnabled: boolean;
  syncItemsInterval: number;
  syncPricesEnabled: boolean;
  syncPricesInterval: number;
  orderPollingEnabled: boolean;
  orderPollingInterval: number;
}

// ============================================
// Component
// ============================================

export function VmiPortalConfigForm({
  portal,
  visible,
  onClose,
  onSave,
}: VmiPortalConfigFormProps) {
  const isEditMode = !!portal;
  const formRef = useRef<{ instance: () => { validate: () => { isValid: boolean } } } | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>(() => ({
    name: portal?.name ?? '',
    portalUrl: portal?.portalUrl ?? 'https://',
    apiKey: '',
    vendorId: portal?.vendorId ?? '',
    isEnabled: portal?.isEnabled ?? true,
    syncInventoryEnabled: portal?.syncInventoryEnabled ?? true,
    syncInventoryInterval: 60,
    syncItemsEnabled: portal?.syncItemsEnabled ?? true,
    syncItemsInterval: 1440,
    syncPricesEnabled: portal?.syncPricesEnabled ?? true,
    syncPricesInterval: 1440,
    orderPollingEnabled: portal?.orderPollingEnabled ?? true,
    orderPollingInterval: 15,
  }));

  // State
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<VmiPortalTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset form when portal changes
  const resetForm = useCallback(() => {
    setFormData({
      name: portal?.name ?? '',
      portalUrl: portal?.portalUrl ?? 'https://',
      apiKey: '',
      vendorId: portal?.vendorId ?? '',
      isEnabled: portal?.isEnabled ?? true,
      syncInventoryEnabled: portal?.syncInventoryEnabled ?? true,
      syncInventoryInterval: 60,
      syncItemsEnabled: portal?.syncItemsEnabled ?? true,
      syncItemsInterval: 1440,
      syncPricesEnabled: portal?.syncPricesEnabled ?? true,
      syncPricesInterval: 1440,
      orderPollingEnabled: portal?.orderPollingEnabled ?? true,
      orderPollingInterval: 15,
    });
    setTestResult(null);
    setError(null);
    resetFormValidation('vmiPortalForm');
  }, [portal]);

  // Handle form data change
  const handleFormDataChange = (data: Record<string, unknown>) => {
    setFormData(data as FormData);
  };

  // Handle test connection
  const handleTestConnection = async () => {
    if (!portal) {
      setError('Please save the portal configuration first before testing the connection.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/settings/vmi/${portal.id}/test`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setTestResult(result.data);
      } else {
        setError(result.error || 'Connection test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    // Validate form
    if (!validateFormGroup('vmiPortalForm')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = isEditMode
        ? `/api/settings/vmi/${portal.id}`
        : '/api/settings/vmi';

      const method = isEditMode ? 'PUT' : 'POST';

      // Build request body
      const body: VmiPortalConfigInput | VmiPortalConfigUpdate = isEditMode
        ? {
            name: formData.name,
            portalUrl: formData.portalUrl,
            vendorId: formData.vendorId,
            isEnabled: formData.isEnabled,
            syncInventoryEnabled: formData.syncInventoryEnabled,
            syncInventoryInterval: formData.syncInventoryInterval,
            syncItemsEnabled: formData.syncItemsEnabled,
            syncItemsInterval: formData.syncItemsInterval,
            syncPricesEnabled: formData.syncPricesEnabled,
            syncPricesInterval: formData.syncPricesInterval,
            orderPollingEnabled: formData.orderPollingEnabled,
            orderPollingInterval: formData.orderPollingInterval,
            ...(formData.apiKey ? { apiKey: formData.apiKey } : {}),
          }
        : {
            name: formData.name,
            portalUrl: formData.portalUrl,
            apiKey: formData.apiKey,
            vendorId: formData.vendorId,
            isEnabled: formData.isEnabled,
            syncInventoryEnabled: formData.syncInventoryEnabled,
            syncInventoryInterval: formData.syncInventoryInterval,
            syncItemsEnabled: formData.syncItemsEnabled,
            syncItemsInterval: formData.syncItemsInterval,
            syncPricesEnabled: formData.syncPricesEnabled,
            syncPricesInterval: formData.syncPricesInterval,
            orderPollingEnabled: formData.orderPollingEnabled,
            orderPollingInterval: formData.orderPollingInterval,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        onSave(result.data);
        onClose();
      } else {
        setError(result.error || 'Failed to save portal configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portal configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Connection status indicator
  const ConnectionStatus = () => {
    if (!portal) return null;

    const statusConfig = {
      connected: { icon: Wifi, color: 'text-green-500', label: 'Connected' },
      disconnected: { icon: WifiOff, color: 'text-gray-400', label: 'Disconnected' },
      error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
    };

    const config = statusConfig[portal.connectionStatus];
    const Icon = config.icon;

    return (
      <div className={cn('flex items-center gap-2', config.color)}>
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    );
  };

  return (
    <DxPopup
      visible={visible}
      onHiding={handleClose}
      title={isEditMode ? 'Edit VMI Portal Configuration' : 'New VMI Portal Configuration'}
      fullScreen
      showCloseButton
      dragEnabled={false}
      className="vmi-portal-config-popup"
    >
      <div className="h-full flex flex-col">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
                <XCircle className="h-5 w-5 text-red-600" />
                {error}
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border',
                  testResult.connected
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                )}
              >
                {testResult.connected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Connection Successful</div>
                      <div className="text-sm">
                        Latency: {testResult.latencyMs}ms
                        {testResult.vendorInfo && (
                          <span className="ml-2">
                            | Vendor: {testResult.vendorInfo.vendorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="font-medium">Connection Failed</div>
                      <div className="text-sm">{testResult.error}</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Status and Last Sync Info (Edit Mode) */}
            {isEditMode && (
              <Card elevation="flat">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <ConnectionStatus />
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {portal.lastOrdersPollAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Last Poll: {new Date(portal.lastOrdersPollAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  {portal.lastErrorMessage && (
                    <div className="mt-2 text-sm text-red-600">{portal.lastErrorMessage}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Form - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Portal Settings */}
              <Card elevation="raised">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Portal Settings</h3>
                  <DxForm
                    formData={formData}
                    onFormDataChange={handleFormDataChange}
                    colCount={1}
                    labelLocation="top"
                    validationGroup="vmiPortalForm"
                    formRef={formRef}
                  >
                    <DxFormItem
                      dataField="name"
                      label={{ text: 'Portal Name' }}
                      isRequired
                      editorOptions={{
                        placeholder: 'e.g., Siriraj VMI Portal',
                      }}
                      validationRules={[
                        { type: 'required', message: 'Portal name is required' },
                        { type: 'stringLength', max: 100, message: 'Portal name must be at most 100 characters' },
                      ]}
                    />
                    <DxFormItem
                      dataField="vendorId"
                      label={{ text: 'Vendor ID' }}
                      isRequired
                      editorOptions={{
                        placeholder: 'Your vendor ID in this portal',
                      }}
                      validationRules={[
                        { type: 'required', message: 'Vendor ID is required' },
                        { type: 'stringLength', max: 50, message: 'Vendor ID must be at most 50 characters' },
                      ]}
                    />
                    <DxFormItem
                      dataField="portalUrl"
                      label={{ text: 'Portal URL' }}
                      isRequired
                      editorOptions={{
                        placeholder: 'https://vmi-portal.example.com',
                      }}
                      validationRules={[
                        { type: 'required', message: 'Portal URL is required' },
                        {
                          type: 'pattern',
                          pattern: /^https:\/\/.+/,
                          message: 'Portal URL must start with https://',
                        },
                      ]}
                    />
                    <DxFormItem
                      dataField="apiKey"
                      label={{ text: isEditMode ? 'API Key (leave blank to keep existing)' : 'API Key' }}
                      isRequired={!isEditMode}
                      editorType="dxTextBox"
                      editorOptions={{
                        mode: 'password',
                        placeholder: isEditMode ? '••••••••••••••••' : 'Enter API key',
                      }}
                      validationRules={
                        isEditMode
                          ? []
                          : [
                              { type: 'required', message: 'API key is required' },
                              { type: 'stringLength', max: 500, message: 'API key must be at most 500 characters' },
                            ]
                      }
                    />
                    <DxFormItem
                      dataField="isEnabled"
                      label={{ text: 'Status' }}
                      editorType="dxCheckBox"
                      editorOptions={{
                        text: 'Enable this portal connection',
                      }}
                    />
                  </DxForm>
                </CardContent>
              </Card>

              {/* Right Column - Sync Settings */}
              <Card elevation="raised">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Settings</h3>
                  <DxForm
                    formData={formData}
                    onFormDataChange={handleFormDataChange}
                    colCount={2}
                    labelLocation="top"
                  >
                    <DxFormItem
                      dataField="syncInventoryEnabled"
                      label={{ text: 'Inventory Sync' }}
                      editorType="dxCheckBox"
                      editorOptions={{
                        text: 'Enable',
                      }}
                    />
                    <DxFormItem
                      dataField="syncInventoryInterval"
                      label={{ text: 'Interval (minutes)' }}
                      editorType="dxNumberBox"
                      editorOptions={{
                        min: 5,
                        max: 1440,
                        step: 5,
                        showSpinButtons: true,
                      }}
                      validationRules={[
                        { type: 'range', min: 5, max: 1440, message: 'Interval must be between 5 and 1440 minutes' },
                      ]}
                    />
                    <DxFormItem
                      dataField="syncItemsEnabled"
                      label={{ text: 'Items Sync' }}
                      editorType="dxCheckBox"
                      editorOptions={{
                        text: 'Enable',
                      }}
                    />
                    <DxFormItem
                      dataField="syncItemsInterval"
                      label={{ text: 'Interval (minutes)' }}
                      editorType="dxNumberBox"
                      editorOptions={{
                        min: 5,
                        max: 1440,
                        step: 5,
                        showSpinButtons: true,
                      }}
                    />
                    <DxFormItem
                      dataField="syncPricesEnabled"
                      label={{ text: 'Prices Sync' }}
                      editorType="dxCheckBox"
                      editorOptions={{
                        text: 'Enable',
                      }}
                    />
                    <DxFormItem
                      dataField="syncPricesInterval"
                      label={{ text: 'Interval (minutes)' }}
                      editorType="dxNumberBox"
                      editorOptions={{
                        min: 5,
                        max: 1440,
                        step: 5,
                        showSpinButtons: true,
                      }}
                    />
                    <DxFormItem
                      dataField="orderPollingEnabled"
                      label={{ text: 'Order Polling' }}
                      editorType="dxCheckBox"
                      editorOptions={{
                        text: 'Enable',
                      }}
                    />
                    <DxFormItem
                      dataField="orderPollingInterval"
                      label={{ text: 'Interval (minutes)' }}
                      editorType="dxNumberBox"
                      editorOptions={{
                        min: 5,
                        max: 1440,
                        step: 5,
                        showSpinButtons: true,
                      }}
                    />
                  </DxForm>

                  {/* Sync Interval Help */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Sync Interval Guide</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li><strong>5-15 min:</strong> Real-time sync (high API usage)</li>
                      <li><strong>30-60 min:</strong> Frequent updates (recommended for inventory)</li>
                      <li><strong>1440 min (24h):</strong> Daily sync (recommended for items/prices)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="flex-shrink-0 border-t bg-gray-50 px-6 py-4">
          <div className="max-w-5xl mx-auto flex justify-between">
            <div>
              {isEditMode && (
                <DxButton
                  text={isTesting ? 'Testing...' : 'Test Connection'}
                  icon={isTesting ? undefined : 'wifi'}
                  type="default"
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving}
                >
                  {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                </DxButton>
              )}
            </div>
            <div className="flex gap-3">
              <DxButton
                text="Cancel"
                type="normal"
                onClick={handleClose}
                disabled={isSaving}
              />
              <DxButton
                text={isSaving ? 'Saving...' : 'Save Configuration'}
                icon={isSaving ? undefined : 'save'}
                type="success"
                onClick={handleSave}
                disabled={isSaving || isTesting}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              </DxButton>
            </div>
          </div>
        </div>
      </div>
    </DxPopup>
  );
}

export default VmiPortalConfigForm;
