'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, Save } from 'lucide-react';

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
              <Button variant="secondary" onClick={() => router.push('/purchasing/vendors')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                {isSaving ? 'Saving...' : 'Save Vendor'}
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Vendor Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                placeholder="e.g., VND001"
              />
              <Input
                label="Vendor Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g., ABC Supplies Co., Ltd."
              />
              <Input
                label="Contact Person"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="e.g., John Doe"
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g., 02-xxx-xxxx"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g., contact@vendor.com"
              />
              <Input
                label="Tax ID"
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                placeholder="e.g., 0-1234-56789-01-2"
              />
              <Input
                label="Lead Time (days)"
                type="number"
                value={form.leadTimeDays}
                onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                placeholder="e.g., 7"
              />
              <Input
                label="Payment Terms"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="e.g., Net 30"
              />
              <div className="md:col-span-2">
                <Input
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g., 123 Main Street, Bangkok 10110"
                />
              </div>
              <div className="md:col-span-2 flex gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isApproved}
                    onChange={(e) => setForm({ ...form, isApproved: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Approved Vendor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isVMI}
                    onChange={(e) => setForm({ ...form, isVMI: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">VMI Vendor</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
