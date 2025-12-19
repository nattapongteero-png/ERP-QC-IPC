'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxTabs, DxTabItem } from '@/components/ui/dx-tabs';
import { Badge } from '@/components/ui/badge';
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

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
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
  ): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'delivered':
      case 'shipped':
        return 'primary';
      case 'cancelled':
        return 'danger';
      case 'processing':
      case 'ready':
        return 'secondary';
      case 'confirmed':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getTypeVariant = (
    type: string
  ): 'primary' | 'secondary' | 'default' => {
    switch (type) {
      case 'hospital':
      case 'clinic':
        return 'primary';
      case 'pharmacy':
      case 'distributor':
        return 'secondary';
      case 'government':
      case 'traditional_medicine':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatCustomerType = (type: string): string => {
    const typeMap: Record<string, string> = {
      hospital: 'Hospital',
      clinic: 'Clinic',
      pharmacy: 'Pharmacy',
      distributor: 'Distributor',
      traditional_medicine: 'Traditional Medicine',
      spa_wellness: 'Spa & Wellness',
      government: 'Government',
      export: 'Export',
      other: 'Other',
    };
    return typeMap[type] || type;
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
          <DxButton
            text="Back to Customers"
            type="default"
            onClick={() => router.push('/sales/customers')}
            className="mt-4"
          />
        </div>
      </MainLayout>
    );
  }

  const { customer, recentSalesOrders, summary } = data;

  const tabs: DxTabItem[] = [
    { id: 0, text: 'Overview' },
    { id: 1, text: `Sales Orders (${recentSalesOrders.length})` },
  ];

  const soColumns: DxDataGridColumn[] = [
    { dataField: 'soNumber', caption: 'SO Number', width: 150 },
    {
      dataField: 'orderDate',
      caption: 'Order Date',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.orderDate),
    },
    {
      dataField: 'requiredDate',
      caption: 'Required Date',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.requiredDate),
    },
    {
      dataField: 'totalAmount',
      caption: 'Total Amount',
      width: 150,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.totalAmount, cellInfo.data.currency),
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={getStatusVariant(cellInfo.data.status)}>
          {cellInfo.data.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  const renderEditDialogContent = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Code <span className="text-red-500">*</span>
          </label>
          <DxTextBox
            value={editForm.code}
            onValueChange={(value) => setEditForm({ ...editForm, code: value })}
            placeholder="Enter customer code"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name <span className="text-red-500">*</span>
          </label>
          <DxTextBox
            value={editForm.name}
            onValueChange={(value) => setEditForm({ ...editForm, name: value })}
            placeholder="Enter customer name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Person
          </label>
          <DxTextBox
            value={editForm.contactPerson}
            onValueChange={(value) => setEditForm({ ...editForm, contactPerson: value })}
            placeholder="Enter contact person"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <DxTextBox
            value={editForm.phone}
            onValueChange={(value) => setEditForm({ ...editForm, phone: value })}
            placeholder="Enter phone number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <DxTextBox
            value={editForm.email}
            onValueChange={(value) => setEditForm({ ...editForm, email: value })}
            placeholder="Enter email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tax ID
          </label>
          <DxTextBox
            value={editForm.taxId}
            onValueChange={(value) => setEditForm({ ...editForm, taxId: value })}
            placeholder="Enter tax ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Type
          </label>
          <DxSelectBox
            items={customerTypes}
            value={editForm.customerType}
            onValueChange={(value) => setEditForm({ ...editForm, customerType: value })}
            valueExpr="value"
            displayExpr="label"
            placeholder="Select customer type"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Limit
          </label>
          <DxTextBox
            value={editForm.creditLimit}
            onValueChange={(value) => setEditForm({ ...editForm, creditLimit: value })}
            placeholder="Enter credit limit"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Term (days)
          </label>
          <DxTextBox
            value={editForm.creditTermDays}
            onValueChange={(value) => setEditForm({ ...editForm, creditTermDays: value })}
            placeholder="Enter credit term days"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Terms
          </label>
          <DxTextBox
            value={editForm.paymentTerms}
            onValueChange={(value) => setEditForm({ ...editForm, paymentTerms: value })}
            placeholder="Enter payment terms"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <DxTextBox
            value={editForm.address}
            onValueChange={(value) => setEditForm({ ...editForm, address: value })}
            placeholder="Enter address"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <DxTextBox
            value={editForm.notes}
            onValueChange={(value) => setEditForm({ ...editForm, notes: value })}
            placeholder="Enter notes"
          />
        </div>
        <div className="md:col-span-2">
          <DxCheckBox
            value={editForm.isActive}
            onValueChange={(value) => setEditForm({ ...editForm, isActive: value })}
            text="Active"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <DxButton
          text="Cancel"
          type="normal"
          stylingMode="outlined"
          onClick={() => setIsEditDialogOpen(false)}
        />
        <DxButton
          text={isSaving ? 'Saving...' : 'Save Changes'}
          type="success"
          onClick={handleSave}
          disabled={isSaving}
        />
      </div>
    </div>
  );

  const renderDeleteDialogContent = () => (
    <div className="space-y-4">
      <p className="text-gray-600">
        Are you sure you want to delete this customer? If the customer has
        related sales orders, it will be deactivated instead.
      </p>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <DxButton
          text="Cancel"
          type="normal"
          stylingMode="outlined"
          onClick={() => setIsDeleteDialogOpen(false)}
        />
        <DxButton
          text={isSaving ? 'Deleting...' : 'Delete'}
          type="danger"
          onClick={handleDelete}
          disabled={isSaving}
        />
      </div>
    </div>
  );

  const renderOverviewTab = () => (
    <>
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
                  <Badge variant={getStatusVariant(status)}>
                    {status.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={customer.name}
          description={`รหัส: ${customer.code}`}
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
                text="Edit"
                icon="edit"
                type="default"
                onClick={() => setIsEditDialogOpen(true)}
              />
              <DxButton
                text="Delete"
                icon="trash"
                type="danger"
                onClick={() => setIsDeleteDialogOpen(true)}
              />
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
                      {formatCustomerType(customer.customerType)}
                    </Badge>
                    {!customer.isActive && (
                      <Badge variant="danger">
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
          <CardHeader className="border-b pb-0">
            <DxTabs
              items={tabs}
              selectedIndex={activeTabIndex}
              onSelectedIndexChange={setActiveTabIndex}
            />
          </CardHeader>

          <CardContent className="pt-6">
            {activeTabIndex === 0 && renderOverviewTab()}

            {activeTabIndex === 1 && (
              recentSalesOrders.length > 0 ? (
                <DxDataGrid
                  dataSource={recentSalesOrders}
                  keyExpr="id"
                  columns={soColumns}
                  showBorders
                  height={400}
                  onRowClick={(e) => {
                    if (e.data) {
                      router.push(`/sales/orders/${e.data.id}`);
                    }
                  }}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No sales orders found for this customer
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <DxPopup
        visible={isEditDialogOpen}
        onHiding={() => setIsEditDialogOpen(false)}
        title="Edit Customer"
        width={700}
        height="auto"
        showCloseButton
      >
        {renderEditDialogContent()}
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxPopup
        visible={isDeleteDialogOpen}
        onHiding={() => setIsDeleteDialogOpen(false)}
        title="Delete Customer"
        width={450}
        height="auto"
        showCloseButton
      >
        {renderDeleteDialogContent()}
      </DxPopup>
    </MainLayout>
  );
}
