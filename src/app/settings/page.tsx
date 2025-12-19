'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { PageHeader } from '@/components/ui/page-header';
import { Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Settings {
  companyName: string;
  companyNameTh: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  fdaLicense: string;
  gmpCertificate: string;
  lotPrefix: string;
  poPrefix: string;
  soPrefix: string;
  woPrefix: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    companyName: 'Herbal Medicine Co., Ltd.',
    companyNameTh: 'บริษัท สมุนไพรไทย จำกัด',
    address: '123 Herbal Street, Bangkok 10110',
    phone: '02-123-4567',
    email: 'info@herbal-medicine.co.th',
    taxId: '0123456789012',
    fdaLicense: 'FDA-12345',
    gmpCertificate: 'GMP-67890',
    lotPrefix: 'LOT',
    poPrefix: 'PO',
    soPrefix: 'SO',
    woPrefix: 'WO',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (field: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      // In a real app, this would save to the database
      await new Promise((resolve) => setTimeout(resolve, 500));
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="ตั้งค่าระบบ"
          actions={
            <DxButton
              text={isSaving ? 'Saving...' : 'Save Settings'}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={isSaving}
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

        {/* Company Information */}
        <Card elevation="raised">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (English)
                </label>
                <DxTextBox
                  value={settings.companyName}
                  onValueChange={(value) => handleChange('companyName', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (Thai)
                </label>
                <DxTextBox
                  value={settings.companyNameTh}
                  onValueChange={(value) => handleChange('companyNameTh', value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <DxTextBox
                  value={settings.address}
                  onValueChange={(value) => handleChange('address', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <DxTextBox
                  value={settings.phone}
                  onValueChange={(value) => handleChange('phone', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
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
            <CardTitle>Regulatory Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax ID
                </label>
                <DxTextBox
                  value={settings.taxId}
                  onValueChange={(value) => handleChange('taxId', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FDA License Number
                </label>
                <DxTextBox
                  value={settings.fdaLicense}
                  onValueChange={(value) => handleChange('fdaLicense', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GMP Certificate Number
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
            <CardTitle>Document Prefixes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lot Number Prefix
                </label>
                <DxTextBox
                  value={settings.lotPrefix}
                  onValueChange={(value) => handleChange('lotPrefix', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number Prefix
                </label>
                <DxTextBox
                  value={settings.poPrefix}
                  onValueChange={(value) => handleChange('poPrefix', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SO Number Prefix
                </label>
                <DxTextBox
                  value={settings.soPrefix}
                  onValueChange={(value) => handleChange('soPrefix', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Order Prefix
                </label>
                <DxTextBox
                  value={settings.woPrefix}
                  onValueChange={(value) => handleChange('woPrefix', value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
