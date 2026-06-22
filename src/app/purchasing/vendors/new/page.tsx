'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { PageHeader } from '@/components/ui/page-header';

// Generate vendor code: VND-YYYYMMDD-XXXX
function generateVendorCode(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VND-${year}${month}-${random}`;
}

export default function NewVendorPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    leadTimeDays: '',
    paymentTerms: '',
    isApproved: false,
    isVMI: false,
  });

  // Auto-generate vendor code on mount
  useEffect(() => {
    setForm(prev => ({ ...prev, code: generateVendorCode() }));
  }, []);

  const handleSave = async () => {
    if (!form.code || !form.name) {
      alert('Vendor code and name are required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        router.push(`/purchasing/vendors/${result.data.id}`);
      } else {
        alert(result.error || 'Failed to create vendor');
      }
    } catch (error) {
      console.error('Failed to create vendor:', error);
      alert('Failed to create vendor');
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <div className="space-y-6">
        <PageHeader
          title={t('vendors.newTitle')}
          description={t('vendors.newDescription')}
          actions={
            <div className="flex gap-2">
              <DxButton
                text={t('vendors.form.back')}
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/purchasing/vendors')}
              />
              <DxButton
                text={isSaving ? t('vendors.form.saving') : t('vendors.form.save')}
                icon="save"
                type="success"
                onClick={handleSave}
                disabled={isSaving}
              />
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('vendors.form.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.code')} <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.code}
                  onValueChange={(value) => setForm({ ...form, code: value })}
                  placeholder={t('vendors.form.codePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.name')} <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.name}
                  onValueChange={(value) => setForm({ ...form, name: value })}
                  placeholder={t('vendors.form.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.contactPerson')}
                </label>
                <DxTextBox
                  value={form.contactPerson}
                  onValueChange={(value) => setForm({ ...form, contactPerson: value })}
                  placeholder={t('vendors.form.contactPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.phone')}
                </label>
                <DxTextBox
                  value={form.phone}
                  onValueChange={(value) => setForm({ ...form, phone: value })}
                  placeholder={t('vendors.form.phonePlaceholder')}
                  mode="tel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.email')}
                </label>
                <DxTextBox
                  value={form.email}
                  onValueChange={(value) => setForm({ ...form, email: value })}
                  placeholder={t('vendors.form.emailPlaceholder')}
                  mode="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.taxId')}
                </label>
                <DxTextBox
                  value={form.taxId}
                  // Thai tax ID is exactly 13 digits — digits only, capped at 13.
                  onValueChange={(value) =>
                    setForm({ ...form, taxId: (value ?? '').replace(/\D/g, '').slice(0, 13) })
                  }
                  maxLength={13}
                  placeholder={t('vendors.form.taxIdPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.leadTime')}
                </label>
                <DxTextBox
                  value={form.leadTimeDays}
                  onValueChange={(value) => setForm({ ...form, leadTimeDays: value })}
                  placeholder={t('vendors.form.leadTimePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.paymentTerms')}
                </label>
                <DxTextBox
                  value={form.paymentTerms}
                  onValueChange={(value) => setForm({ ...form, paymentTerms: value })}
                  placeholder={t('vendors.form.paymentTermsPlaceholder')}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendors.form.address')}
                </label>
                <DxTextBox
                  value={form.address}
                  onValueChange={(value) => setForm({ ...form, address: value })}
                  placeholder={t('vendors.form.addressPlaceholder')}
                />
              </div>
              <div className="md:col-span-2 flex gap-6 pt-2">
                <DxCheckBox
                  text={t('vendors.form.approvedVendor')}
                  value={form.isApproved}
                  onValueChange={(value) => setForm({ ...form, isApproved: value })}
                />
                <DxCheckBox
                  text={t('vendors.form.vmiVendor')}
                  value={form.isVMI}
                  onValueChange={(value) => setForm({ ...form, isVMI: value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
