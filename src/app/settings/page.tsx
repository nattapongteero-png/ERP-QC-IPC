'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { ResponsivePageHeader } from '@/components/shared';
import { Settings as SettingsIcon, Check, AlertCircle, Wifi, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

interface Settings {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  /** Blank = head office. Printed on the tax invoice as สำนักงานใหญ่ / สาขาที่ N. */
  branch: string;
  fdaLicense: string;
  gmpCertificate: string;
  lotPrefix: string;
  poPrefix: string;
  soPrefix: string;
  woPrefix: string;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [settings, setSettings] = useState<Settings>({
    companyName: '',
    companyNameTh: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    branch: '',
    fdaLicense: '',
    gmpCertificate: '',
    lotPrefix: 'LOT',
    poPrefix: 'PO',
    soPrefix: 'SO',
    woPrefix: 'WO',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/company');
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (field: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Save failed');
      }
      setMessage({ type: 'success', text: t('settingsPage.saveSuccess') });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: t('settingsPage.saveError') });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 p-4 md:p-0">
        <ResponsivePageHeader
          title={t('page.title')}
          subtitle={t('page.description')}
          icon={SettingsIcon}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-600"
          actions={
            <DxButton
              text={isSaving ? t('settingsPage.saving') : t('settingsPage.saveSettings')}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={isSaving || isLoading}
            />
          }
        />

        {message && (
          <div
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg',
              'motion-safe:animate-slide-in motion-reduce:animate-none',
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            )}
          >
            {message.type === 'success' ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            {message.text}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {!isLoading && (
        <>
        {/* Company Information */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>{t('company.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('company.nameEn')}
                </label>
                <DxTextBox
                  value={settings.companyName}
                  onValueChange={(value) => handleChange('companyName', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('company.nameTh')}
                </label>
                <DxTextBox
                  value={settings.companyNameTh}
                  onValueChange={(value) => handleChange('companyNameTh', value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('company.address')}
                </label>
                <DxTextBox
                  value={settings.address}
                  onValueChange={(value) => handleChange('address', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('company.phone')}
                </label>
                <DxTextBox
                  value={settings.phone}
                  onValueChange={(value) => handleChange('phone', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('company.email')}
                </label>
                <DxTextBox
                  value={settings.email}
                  onValueChange={(value) => handleChange('email', value)}
                  mode="email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regulatory Information */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>{t('regulatory.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('regulatory.taxId')}
                </label>
                <DxTextBox
                  value={settings.taxId}
                  onValueChange={(value) => handleChange('taxId', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สาขา (เว้นว่าง = สำนักงานใหญ่)
                </label>
                <DxTextBox
                  value={settings.branch}
                  onValueChange={(value) => handleChange('branch', value)}
                  placeholder="เช่น 00001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('regulatory.fdaLicense')}
                </label>
                <DxTextBox
                  value={settings.fdaLicense}
                  onValueChange={(value) => handleChange('fdaLicense', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('regulatory.gmpCertificate')}
                </label>
                <DxTextBox
                  value={settings.gmpCertificate}
                  onValueChange={(value) => handleChange('gmpCertificate', value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Prefixes */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>{t('prefixes.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('prefixes.lotPrefix')}
                </label>
                <DxTextBox
                  value={settings.lotPrefix}
                  onValueChange={(value) => handleChange('lotPrefix', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('prefixes.poPrefix')}
                </label>
                <DxTextBox
                  value={settings.poPrefix}
                  onValueChange={(value) => handleChange('poPrefix', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('prefixes.soPrefix')}
                </label>
                <DxTextBox
                  value={settings.soPrefix}
                  onValueChange={(value) => handleChange('soPrefix', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('prefixes.woPrefix')}
                </label>
                <DxTextBox
                  value={settings.woPrefix}
                  onValueChange={(value) => handleChange('woPrefix', value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Confidentiality */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>{t('securityConfidentiality.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link
                href="/settings/confidentiality"
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{t('securityConfidentiality.confidentialityLink')}</div>
                    <div className="text-sm text-gray-500">
                      {t('securityConfidentiality.confidentialityDescription')}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Integration Settings */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>{t('integrations.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link
                href="/settings/vmi"
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{t('vmiSettings.vmiPortalConnections')}</div>
                    <div className="text-sm text-gray-500">
                      {t('vmiSettings.vmiPortalDescription')}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            </div>
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </MainLayout>
  );
}
