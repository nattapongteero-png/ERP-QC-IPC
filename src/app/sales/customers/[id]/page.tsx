'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Edit,
  ArrowLeft,
  Trash2,
  Calendar,
} from 'lucide-react';

interface Customer {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  customerType: string;
  creditLimit: number | null;
  creditTermDays: number | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SalesOrder {
  id: number;
  soNumber: string;
  orderDate: string | null;
  requiredDate: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
}

interface Summary {
  totalOrders: number;
  totalAmount: number;
  statusBreakdown: Record<string, number>;
}

interface CustomerDetail {
  customer: Customer;
  recentSalesOrders: SalesOrder[];
  summary: Summary;
}

const customerTypes = [
  { value: 'regular', label: 'Regular' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail' },
  { value: 'export', label: 'Export' },
];

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
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
    isActive: true,
  });

  const fetchCustomerDetail = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers/${resolvedParams.id}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        const c = result.data.customer;
        setEditForm({
          code: c.code || '',
          name: c.name || '',
          contactPerson: c.contactPerson || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          taxId: c.taxId || '',
          customerType: c.customerType || 'regular',
          creditLimit: c.creditLimit?.toString() || '',
          creditTermDays: c.creditTermDays?.toString() || '',
          paymentTerms: c.paymentTerms || '',
          notes: c.notes || '',
          isActive: c.isActive ?? true,
        });
      } else {
        console.error('Failed to fetch customer:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/customers/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          creditLimit: editForm.creditLimit
            ? parseFloat(editForm.creditLimit)
            : null,
          creditTermDays: editForm.creditTermDays
            ? parseInt(editForm.creditTermDays)
            : null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setIsEditDialogOpen(false);
        fetchCustomerDetail();
      } else {
        alert(result.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Failed to update customer:', error);
      alert('Failed to update customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/customers/${resolvedParams.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();

      if (result.success) {
        router.push('/sales/customers');
      } else {
        alert(result.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert('Failed to delete customer');
    } finally {
      setIsSaving(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const formatCurrency = (amount: number | null, currency: string = 'THB') => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getStatusVariant = (
    status: string
  ): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'delivered':
      case 'shipped':
        return 'success';
      case 'cancelled':
        return 'danger';
      case 'processing':
      case 'ready':
        return 'warning';
      case 'confirmed':
        return 'info';
      default:
        return 'default';
    }
  };

  const getTypeVariant = (
    type: string
  ): 'success' | 'info' | 'warning' | 'default' => {
    switch (type) {
      case 'wholesale':
        return 'success';
      case 'export':
        return 'info';
      case 'retail':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">
            Customer not found
          </h2>
          <p className="text-gray-500 mt-2">
            The requested customer could not be found.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/sales/customers')}
          >
            Back to Customers
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { customer, recentSalesOrders, summary } = data;

  const soColumns = [
    { key: 'soNumber', header: 'SO Number' },
    {
      key: 'orderDate',
      header: 'Order Date',
      render: (so: SalesOrder) => formatDate(so.orderDate),
    },
    {
      key: 'requiredDate',
      header: 'Required Date',
      render: (so: SalesOrder) => formatDate(so.requiredDate),
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      render: (so: SalesOrder) => formatCurrency(so.totalAmount, so.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (so: SalesOrder) => (
        <Badge variant={getStatusVariant(so.status)} dot>
          {so.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={customer.name}
          description={`รหัส: ${customer.code}`}
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
                variant="secondary"
                onClick={() => setIsEditDialogOpen(true)}
                leftIcon={<Edit className="h-4 w-4" />}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                onClick={() => setIsDeleteDialogOpen(true)}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Delete
              </Button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Total Orders
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">
                    {summary.totalOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <CreditCard className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Total Sales
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">
                    {formatCurrency(summary.totalAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Credit Limit
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">
                    {formatCurrency(customer.creditLimit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${customer.isActive ? 'bg-green-50' : 'bg-yellow-50'}`}
                >
                  <CheckCircle
                    className={`h-5 w-5 ${customer.isActive ? 'text-green-600' : 'text-yellow-600'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Status</p>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant={getTypeVariant(customer.customerType)}>
                      {customer.customerType.charAt(0).toUpperCase() +
                        customer.customerType.slice(1)}
                    </Badge>
                    {!customer.isActive && (
                      <Badge variant="danger" dot>
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="border-b pb-0">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">
                  Sales Orders ({recentSalesOrders.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="overview" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      Contact Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Contact Person</p>
                          <p className="text-gray-900">
                            {customer.contactPerson || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="text-gray-900">{customer.phone || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="text-gray-900">{customer.email || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="text-gray-900">
                            {customer.address || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      Business Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Tax ID</p>
                          <p className="text-gray-900">{customer.taxId || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Credit Limit</p>
                          <p className="text-gray-900">
                            {formatCurrency(customer.creditLimit)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Credit Term</p>
                          <p className="text-gray-900">
                            {customer.creditTermDays
                              ? `${customer.creditTermDays} days`
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Payment Terms</p>
                          <p className="text-gray-900">
                            {customer.paymentTerms || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {customer.notes && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                    <p className="text-gray-600">{customer.notes}</p>
                  </div>
                )}

                {/* Status Breakdown */}
                {Object.keys(summary.statusBreakdown).length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Order Status Breakdown
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(summary.statusBreakdown).map(
                        ([status, count]) => (
                          <div key={status} className="flex items-center gap-2">
                            <Badge variant={getStatusVariant(status)} dot>
                              {status.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-gray-600">{count}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="mt-0">
                {recentSalesOrders.length > 0 ? (
                  <Table
                    columns={soColumns}
                    data={recentSalesOrders}
                    keyField="id"
                    onRowClick={(so) => router.push(`/sales/orders/${so.id}`)}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No sales orders found for this customer
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <Input
              label="Customer Code"
              value={editForm.code}
              onChange={(e) =>
                setEditForm({ ...editForm, code: e.target.value })
              }
              required
            />
            <Input
              label="Customer Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              required
            />
            <Input
              label="Contact Person"
              value={editForm.contactPerson}
              onChange={(e) =>
                setEditForm({ ...editForm, contactPerson: e.target.value })
              }
            />
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
            />
            <Input
              label="Tax ID"
              value={editForm.taxId}
              onChange={(e) =>
                setEditForm({ ...editForm, taxId: e.target.value })
              }
            />
            <Select
              label="Customer Type"
              options={customerTypes}
              value={editForm.customerType}
              onChange={(e) =>
                setEditForm({ ...editForm, customerType: e.target.value })
              }
            />
            <Input
              label="Credit Limit"
              type="number"
              value={editForm.creditLimit}
              onChange={(e) =>
                setEditForm({ ...editForm, creditLimit: e.target.value })
              }
            />
            <Input
              label="Credit Term (days)"
              type="number"
              value={editForm.creditTermDays}
              onChange={(e) =>
                setEditForm({ ...editForm, creditTermDays: e.target.value })
              }
            />
            <Input
              label="Payment Terms"
              value={editForm.paymentTerms}
              onChange={(e) =>
                setEditForm({ ...editForm, paymentTerms: e.target.value })
              }
            />
            <div className="md:col-span-2">
              <Input
                label="Address"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Notes"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete this customer? If the customer has
            related sales orders, it will be deactivated instead.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
