'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, Save, Wand2 } from 'lucide-react';

const customerTypes = [
  { value: 'hospital', label: 'Hospital (โรงพยาบาล)' },
  { value: 'clinic', label: 'Clinic (คลินิก)' },
  { value: 'pharmacy', label: 'Pharmacy (ร้านขายยา)' },
  { value: 'distributor', label: 'Distributor (ตัวแทนจำหน่าย)' },
  { value: 'traditional_medicine', label: 'Traditional Medicine Center (ศูนย์การแพทย์แผนไทย)' },
  { value: 'spa_wellness', label: 'Spa & Wellness (สปาและเวลเนส)' },
  { value: 'government', label: 'Government Agency (หน่วยงานราชการ)' },
  { value: 'export', label: 'Export (ส่งออก)' },
  { value: 'other', label: 'Other (อื่นๆ)' },
];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    customerType: 'hospital',
    creditLimit: '',
    creditTermDays: '',
    paymentTerms: '',
    notes: '',
  });

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch('/api/customers/next-code');
      const result = await res.json();
      if (result.success) {
        setForm({ ...form, code: result.data.code });
      } else {
        alert(result.error || 'Failed to generate code');
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
      alert('Failed to generate code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      alert('Customer code and name are required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null,
          creditTermDays: form.creditTermDays
            ? parseInt(form.creditTermDays)
            : null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        router.push(`/sales/customers/${result.data.id}`);
      } else {
        alert(result.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Failed to create customer:', error);
      alert('Failed to create customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="New Customer"
          description="สร้างลูกค้าใหม่"
          actions={
            <div className="flex gap-2">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/sales/customers')}
              />
              <DxButton
                text={isSaving ? 'Saving...' : 'Save Customer'}
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
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Code <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <DxTextBox
                      value={form.code}
                      onValueChange={(value) => setForm({ ...form, code: value })}
                      placeholder="e.g., CUS001"
                    />
                  </div>
                  <DxButton
                    icon="magic"
                    type="normal"
                    stylingMode="outlined"
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    hint="Generate Code"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <DxTextBox
                  value={form.name}
                  onValueChange={(value) => setForm({ ...form, name: value })}
                  placeholder="e.g., ABC Trading Co., Ltd."
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
                  placeholder="e.g., contact@customer.com"
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
                  Customer Type
                </label>
                <DxSelectBox
                  items={customerTypes}
                  value={form.customerType}
                  onValueChange={(value) => setForm({ ...form, customerType: value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credit Limit (THB)
                </label>
                <DxTextBox
                  value={form.creditLimit}
                  onValueChange={(value) => setForm({ ...form, creditLimit: value })}
                  placeholder="e.g., 100000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credit Term (days)
                </label>
                <DxTextBox
                  value={form.creditTermDays}
                  onValueChange={(value) => setForm({ ...form, creditTermDays: value })}
                  placeholder="e.g., 30"
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <DxTextBox
                  value={form.notes}
                  onValueChange={(value) => setForm({ ...form, notes: value })}
                  placeholder="Additional notes about this customer..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
