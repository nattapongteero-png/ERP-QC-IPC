'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, Save } from 'lucide-react';

const customerTypes = [
  { value: 'regular', label: 'Regular' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail' },
  { value: 'export', label: 'Export' },
];

export default function NewCustomerPage() {
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
    customerType: 'regular',
    creditLimit: '',
    creditTermDays: '',
    paymentTerms: '',
    notes: '',
  });

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
              <Button
                variant="secondary"
                onClick={() => router.push('/sales/customers')}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isSaving ? 'Saving...' : 'Save Customer'}
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Customer Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                placeholder="e.g., CUS001"
              />
              <Input
                label="Customer Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g., ABC Trading Co., Ltd."
              />
              <Input
                label="Contact Person"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
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
                placeholder="e.g., contact@customer.com"
              />
              <Input
                label="Tax ID"
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                placeholder="e.g., 0-1234-56789-01-2"
              />
              <Select
                label="Customer Type"
                options={customerTypes}
                value={form.customerType}
                onChange={(e) =>
                  setForm({ ...form, customerType: e.target.value })
                }
              />
              <Input
                label="Credit Limit (THB)"
                type="number"
                value={form.creditLimit}
                onChange={(e) =>
                  setForm({ ...form, creditLimit: e.target.value })
                }
                placeholder="e.g., 100000"
              />
              <Input
                label="Credit Term (days)"
                type="number"
                value={form.creditTermDays}
                onChange={(e) =>
                  setForm({ ...form, creditTermDays: e.target.value })
                }
                placeholder="e.g., 30"
              />
              <Input
                label="Payment Terms"
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm({ ...form, paymentTerms: e.target.value })
                }
                placeholder="e.g., Net 30"
              />
              <div className="md:col-span-2">
                <Input
                  label="Address"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="e.g., 123 Main Street, Bangkok 10110"
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
