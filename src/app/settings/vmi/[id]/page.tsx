'use client';

/**
 * VMI Portal Edit Page
 *
 * Dedicated page for editing VMI Portal configurations.
 * Uses URL-based routing instead of popup for better UX.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useEffect, use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DxForm, DxFormItem, validateFormGroup, resetFormValidation } from '@/components/ui/dx-form';
import { DxButton } from '@/components/ui/dx-button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import type { VmiPortalTestResult } from '@/types/vmi';

// ============================================
// Types
// ============================================

// This form holds an API-key field in password mode, which makes Chrome's
// password manager treat the whole form as a login and autofill the
// neighbouring inputs — the Portal URL was showing a saved e-mail address
// while Portal Name and Vendor ID came up blank, and saving would have
// written that rubbish over a working portal config.
const AUTOFILL_OFF = {
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const;

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

interface PageProps {
  params: Promise<{ id: string }>;
}

// ============================================
// Component
// ============================================

export default function VmiPortalEditPage({ params }: PageProps) {
  const t = useTranslations('settings');
  const router = useRouter();
  const { id } = use(params);
  const isNewMode = id === 'new';
  const portalId = isNewMode ? null : parseInt(id, 10);

  // State
  const [portal, setPortal] = useState<VmiPortalConfigSummary | null>(null);
  const [isLoading, setIsLoading] = useState(!isNewMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<VmiPortalTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    name: '',
    portalUrl: 'https://',
    apiKey: '',
    vendorId: '',
    isEnabled: true,
    syncInventoryEnabled: true,
    syncInventoryInterval: 60,
    syncItemsEnabled: true,
    syncItemsInterval: 1440,
    syncPricesEnabled: true,
    syncPricesInterval: 1440,
    orderPollingEnabled: true,
    orderPollingInterval: 15,
  });

  // Load portal data
  useEffect(() => {
    if (isNewMode) return;

    const loadPortal = async () => {
      try {
        const response = await fetch(`/api/settings/vmi/${portalId}`);
        const result = await response.json();

        if (result.success) {
          const data = result.data;
          setPortal(data);
          setFormData({
            name: data.name,
            portalUrl: data.portalUrl,
            apiKey: '',
            vendorId: data.vendorId,
            isEnabled: data.isEnabled,
            syncInventoryEnabled: data.syncInventoryEnabled,
            syncInventoryInterval: 60,
            syncItemsEnabled: data.syncItemsEnabled,
            syncItemsInterval: 1440,
            syncPricesEnabled: data.syncPricesEnabled,
            syncPricesInterval: 1440,
            orderPollingEnabled: data.orderPollingEnabled,
            orderPollingInterval: 15,
          });
        } else {
          setLoadError(result.error || t('vmiPortalEdit.loadError'));
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t('vmiPortalEdit.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPortal();
  }, [isNewMode, portalId, t]);

  // Reset validation after load
  useEffect(() => {
    if (!isLoading && !loadError) {
      try {
        resetFormValidation('vmiPortalForm');
      } catch {
        // Ignore if validation group doesn't exist yet
      }
    }
  }, [isLoading, loadError]);

  // Handle form data change
  const handleFormDataChange = (data: Record<string, unknown>) => {
    setFormData(data as unknown as FormData);
  };

  // Handle test connection
  const handleTestConnection = async () => {
    if (!portalId) {
      setError(t('vmiPortalEdit.saveThenTest'));
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/settings/vmi/${portalId}/test`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setTestResult(result.data);
        // Reload portal to get updated connection status
        const portalResponse = await fetch(`/api/settings/vmi/${portalId}`);
        const portalResult = await portalResponse.json();
        if (portalResult.success) {
          setPortal(portalResult.data);
        }
      } else {
        setError(result.error || t('vmiPortalEdit.connectionFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('vmiPortalEdit.connectionFailed'));
    } finally {
      setIsTesting(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!validateFormGroup('vmiPortalForm')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = isNewMode ? '/api/settings/vmi' : `/api/settings/vmi/${portalId}`;
      const method = isNewMode ? 'POST' : 'PUT';

      const body = isNewMode
        ? {
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
          }
        : {
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
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        router.push('/settings/vmi');
      } else {
        setError(result.error || t('vmiPortalEdit.saveError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('vmiPortalEdit.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Connection status indicator
  const ConnectionStatus = () => {
    if (!portal) return null;

    const statusConfig = {
      connected: { icon: Wifi, color: 'text-green-500', bgColor: 'bg-green-50', label: t('vmiPortalEdit.connected') },
      disconnected: { icon: WifiOff, color: 'text-gray-400', bgColor: 'bg-gray-50', label: t('vmiPortalEdit.disconnected') },
      error: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50', label: t('vmiPortalEdit.error') },
    };

    const config = statusConfig[portal.connectionStatus];
    const Icon = config.icon;

    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', config.bgColor, config.color)}>
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  // Load error
  if (loadError) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title={t('vmiPortalEdit.portalNotFound')}
            breadcrumb={
              <nav className="flex text-sm text-gray-500">
                <Link href="/settings" className="hover:text-gray-700">{t('page.title')}</Link>
                <span className="mx-2">/</span>
                <Link href="/settings/vmi" className="hover:text-gray-700">{t('vmiSettings.vmiPortals')}</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900">{t('vmiPortalEdit.error')}</span>
              </nav>
            }
          />
          <Card elevation="raised">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle className="h-6 w-6" />
                <span>{loadError}</span>
              </div>
              <div className="mt-4">
                <Link href="/settings/vmi">
                  <DxButton text={t('vmiPortalEdit.backToPortals')} icon="arrowleft" type="normal" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={isNewMode ? t('vmiPortalEdit.newTitle') : t('vmiPortalEdit.editTitle', { name: portal?.name || 'VMI Portal' })}
          description={isNewMode
            ? t('vmiPortalEdit.newDescription')
            : t('vmiPortalEdit.editDescription')
          }
          breadcrumb={
            <nav className="flex text-sm text-gray-500">
              <Link href="/settings" className="hover:text-gray-700">{t('page.title')}</Link>
              <span className="mx-2">/</span>
              <Link href="/settings/vmi" className="hover:text-gray-700">{t('vmiSettings.vmiPortals')}</Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900">{isNewMode ? t('vmiPortalEdit.newTitle') : portal?.name}</span>
            </nav>
          }
          actions={
            <div className="flex items-center gap-3">
              <ConnectionStatus />
              <Link href="/settings/vmi">
                <DxButton text={t('vmiPortalEdit.cancel')} icon="close" type="normal" />
              </Link>
            </div>
          }
        />

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
                  <div className="font-medium">{t('vmiPortalEdit.connectionSuccess')}</div>
                  <div className="text-sm">
                    {t('vmiPortalEdit.latency', { ms: String(testResult.latencyMs) })}
                    {testResult.vendorInfo && (
                      <span className="ml-2">| {t('vmiPortalEdit.vendor', { name: testResult.vendorInfo.vendorName })}</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">{t('vmiPortalEdit.connectionFailed')}</div>
                  <div className="text-sm">{testResult.error}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Status Card (Edit Mode) */}
        {!isNewMode && portal && (
          <Card elevation="flat">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {portal.lastOrdersPollAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {t('vmiPortalEdit.lastPoll', { time: new Date(portal.lastOrdersPollAt).toLocaleString() })}
                    </div>
                  )}
                  {portal.lastInventorySyncAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {t('vmiPortalEdit.lastInventorySync', { time: new Date(portal.lastInventorySyncAt).toLocaleString() })}
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
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('vmiPortalEdit.portalSettings')}</h3>
              <DxForm
                formData={formData as unknown as Record<string, unknown>}
                onFormDataChange={handleFormDataChange}
                colCount={1}
                labelLocation="top"
                validationGroup="vmiPortalForm"
              >
                <DxFormItem
                  dataField="name"
                  label={{ text: t('vmiPortalEdit.portalName') }}
                  isRequired
                  editorOptions={{
                    placeholder: 'e.g., Siriraj VMI Portal',
                    inputAttr: AUTOFILL_OFF,
                  }}
                  validationRules={[
                    { type: 'required', message: t('vmiPortalEdit.validation.nameRequired') },
                    { type: 'stringLength', max: 100, message: t('vmiPortalEdit.validation.nameMaxLength') },
                  ]}
                />
                <DxFormItem
                  dataField="vendorId"
                  label={{ text: t('vmiPortalEdit.vendorId') }}
                  isRequired
                  editorOptions={{
                    placeholder: 'Your vendor ID in this portal',
                    inputAttr: AUTOFILL_OFF,
                  }}
                  validationRules={[
                    { type: 'required', message: t('vmiPortalEdit.validation.vendorIdRequired') },
                    { type: 'stringLength', max: 50, message: t('vmiPortalEdit.validation.vendorIdMaxLength') },
                  ]}
                />
                <DxFormItem
                  dataField="portalUrl"
                  label={{ text: t('vmiPortalEdit.portalUrl') }}
                  isRequired
                  editorOptions={{
                    placeholder: 'https://vmi-portal.example.com',
                    inputAttr: AUTOFILL_OFF,
                  }}
                  validationRules={[
                    { type: 'required', message: t('vmiPortalEdit.validation.urlRequired') },
                    {
                      type: 'pattern',
                      pattern: /^https:\/\/.+/,
                      message: t('vmiPortalEdit.validation.urlHttps'),
                    },
                  ]}
                />
                <DxFormItem
                  dataField="apiKey"
                  label={{ text: isNewMode ? t('vmiPortalEdit.apiKey') : t('vmiPortalEdit.apiKeyEdit') }}
                  isRequired={isNewMode}
                  editorType="dxTextBox"
                  editorOptions={{
                    mode: 'password',
                    placeholder: isNewMode ? 'Enter API key' : '••••••••••••••••',
                    inputAttr: { ...AUTOFILL_OFF, autoComplete: 'new-password' },
                  }}
                  validationRules={
                    isNewMode
                      ? [
                          { type: 'required', message: t('vmiPortalEdit.validation.apiKeyRequired') },
                          { type: 'stringLength', max: 500, message: t('vmiPortalEdit.validation.apiKeyMaxLength') },
                        ]
                      : []
                  }
                />
                <DxFormItem
                  dataField="isEnabled"
                  label={{ text: t('vmiPortalEdit.status') }}
                  editorType="dxCheckBox"
                  editorOptions={{
                    text: t('vmiPortalEdit.enablePortal'),
                  }}
                />
              </DxForm>
            </CardContent>
          </Card>

          {/* Right Column - Sync Settings */}
          <Card elevation="raised">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('vmiPortalEdit.syncSettings')}</h3>
              <DxForm
                formData={formData as unknown as Record<string, unknown>}
                onFormDataChange={handleFormDataChange}
                colCount={2}
                labelLocation="top"
              >
                <DxFormItem
                  dataField="syncInventoryEnabled"
                  label={{ text: t('vmiPortalEdit.inventorySyncLabel') }}
                  editorType="dxCheckBox"
                  editorOptions={{ text: t('vmiPortalEdit.enable') }}
                />
                <DxFormItem
                  dataField="syncInventoryInterval"
                  label={{ text: t('vmiPortalEdit.intervalMinutes') }}
                  editorType="dxNumberBox"
                  editorOptions={{
                    min: 5,
                    max: 1440,
                    step: 5,
                    showSpinButtons: true,
                  }}
                />
                <DxFormItem
                  dataField="syncItemsEnabled"
                  label={{ text: t('vmiPortalEdit.itemsSyncLabel') }}
                  editorType="dxCheckBox"
                  editorOptions={{ text: t('vmiPortalEdit.enable') }}
                />
                <DxFormItem
                  dataField="syncItemsInterval"
                  label={{ text: t('vmiPortalEdit.intervalMinutes') }}
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
                  label={{ text: t('vmiPortalEdit.pricesSyncLabel') }}
                  editorType="dxCheckBox"
                  editorOptions={{ text: t('vmiPortalEdit.enable') }}
                />
                <DxFormItem
                  dataField="syncPricesInterval"
                  label={{ text: t('vmiPortalEdit.intervalMinutes') }}
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
                  label={{ text: t('vmiPortalEdit.orderPollingLabel') }}
                  editorType="dxCheckBox"
                  editorOptions={{ text: t('vmiPortalEdit.enable') }}
                />
                <DxFormItem
                  dataField="orderPollingInterval"
                  label={{ text: t('vmiPortalEdit.intervalMinutes') }}
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
                <h4 className="text-sm font-medium text-blue-900 mb-2">{t('vmiPortalEdit.syncGuide')}</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li><strong>{t('vmiPortalEdit.syncGuide5to15')}</strong></li>
                  <li><strong>{t('vmiPortalEdit.syncGuide30to60')}</strong></li>
                  <li><strong>{t('vmiPortalEdit.syncGuide1440')}</strong></li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center py-4 border-t">
          <div>
            {!isNewMode && (
              <DxButton
                text={isTesting ? t('vmiPortalEdit.testing') : t('vmiPortalEdit.testConnection')}
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
            <Link href="/settings/vmi">
              <DxButton text={t('vmiPortalEdit.cancel')} type="normal" disabled={isSaving} />
            </Link>
            <DxButton
              text={isSaving ? t('vmiPortalEdit.saving') : t('vmiPortalEdit.saveConfig')}
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
    </MainLayout>
  );
}
