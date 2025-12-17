'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';

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
  const [message, setMessage] = useState('');

  const handleChange = (field: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      // In a real app, this would save to the database
      await new Promise((resolve) => setTimeout(resolve, 500));
      setMessage('Settings saved successfully');
    } catch (error) {
      setMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">ตั้งค่าระบบ</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.includes('success')
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message}
          </div>
        )}

        {/* Company Information */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name (English)
              </label>
              <Input
                value={settings.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name (Thai)
              </label>
              <Input
                value={settings.companyNameTh}
                onChange={(e) => handleChange('companyNameTh', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <Input
                value={settings.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <Input
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Regulatory Information */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Regulatory Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax ID
              </label>
              <Input
                value={settings.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FDA License Number
              </label>
              <Input
                value={settings.fdaLicense}
                onChange={(e) => handleChange('fdaLicense', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GMP Certificate Number
              </label>
              <Input
                value={settings.gmpCertificate}
                onChange={(e) => handleChange('gmpCertificate', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Document Prefixes */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Document Prefixes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lot Number Prefix
              </label>
              <Input
                value={settings.lotPrefix}
                onChange={(e) => handleChange('lotPrefix', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PO Number Prefix
              </label>
              <Input
                value={settings.poPrefix}
                onChange={(e) => handleChange('poPrefix', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SO Number Prefix
              </label>
              <Input
                value={settings.soPrefix}
                onChange={(e) => handleChange('soPrefix', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Order Prefix
              </label>
              <Input
                value={settings.woPrefix}
                onChange={(e) => handleChange('woPrefix', e.target.value)}
              />
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
