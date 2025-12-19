'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { PageHeader } from '@/components/ui/page-header';

export default function NewVendorPage() {
  const router = useRouter();
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
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="New Vendor"
          description="สร้างผู้ขายใหม่"
          actions={
            <div className="flex gap-2">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/purchasing/vendors')}
              />
              <DxButton
                text={isSaving ? 'Saving...' : 'Save Vendor'}
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
            <CardTitle>Vendor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Code <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.code}
                  onValueChange={(value) => setForm({ ...form, code: value })}
                  placeholder="e.g., VND001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.name}
                  onValueChange={(value) => setForm({ ...form, name: value })}
                  placeholder="e.g., ABC Supplies Co., Ltd."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <DxTextBox
                  value={form.contactPerson}
                  onValueChange={(value) => setForm({ ...form, contactPerson: value })}
                  placeholder="e.g., John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <DxTextBox
                  value={form.phone}
                  onValueChange={(value) => setForm({ ...form, phone: value })}
                  placeholder="e.g., 02-xxx-xxxx"
                  mode="tel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <DxTextBox
                  value={form.email}
                  onValueChange={(value) => setForm({ ...form, email: value })}
                  placeholder="e.g., contact@vendor.com"
                  mode="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax ID
                </label>
                <DxTextBox
                  value={form.taxId}
                  onValueChange={(value) => setForm({ ...form, taxId: value })}
                  placeholder="e.g., 0-1234-56789-01-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Time (days)
                </label>
                <DxTextBox
                  value={form.leadTimeDays}
                  onValueChange={(value) => setForm({ ...form, leadTimeDays: value })}
                  placeholder="e.g., 7"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <DxTextBox
                  value={form.paymentTerms}
                  onValueChange={(value) => setForm({ ...form, paymentTerms: value })}
                  placeholder="e.g., Net 30"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <DxTextBox
                  value={form.address}
                  onValueChange={(value) => setForm({ ...form, address: value })}
                  placeholder="e.g., 123 Main Street, Bangkok 10110"
                />
              </div>
              <div className="md:col-span-2 flex gap-6 pt-2">
                <DxCheckBox
                  text="Approved Vendor (ผู้ขายที่ได้รับการอนุมัติ)"
                  value={form.isApproved}
                  onValueChange={(value) => setForm({ ...form, isApproved: value })}
                />
                <DxCheckBox
                  text="VMI Vendor"
                  value={form.isVMI}
                  onValueChange={(value) => setForm({ ...form, isVMI: value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
