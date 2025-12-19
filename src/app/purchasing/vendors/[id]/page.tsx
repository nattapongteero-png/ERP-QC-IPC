'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
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
  Clock,
  CreditCard,
  ShoppingCart,
  Package,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  isApproved: boolean;
  isVMI: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  orderDate: string | null;
  expectedDate: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
}

interface ApprovedItem {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  itemNameEn: string | null;
  approvalDate: string | null;
  expiryDate: string | null;
  isPreferred: boolean;
}

interface Summary {
  totalOrders: number;
  totalAmount: number;
  approvedItemsCount: number;
  statusBreakdown: Record<string, number>;
}

interface VendorDetail {
  vendor: Vendor;
  recentPurchaseOrders: PurchaseOrder[];
  approvedItems: ApprovedItem[];
  summary: Summary;
}

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<VendorDetail | null>(null);
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
    leadTimeDays: '',
    paymentTerms: '',
    isApproved: false,
    isVMI: false,
    isActive: true,
  });

  const fetchVendorDetail = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vendors/${resolvedParams.id}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        const v = result.data.vendor;
        setEditForm({
          code: v.code || '',
          name: v.name || '',
          contactPerson: v.contactPerson || '',
          phone: v.phone || '',
          email: v.email || '',
          address: v.address || '',
          taxId: v.taxId || '',
          leadTimeDays: v.leadTimeDays?.toString() || '',
          paymentTerms: v.paymentTerms || '',
          isApproved: v.isApproved || false,
          isVMI: v.isVMI || false,
          isActive: v.isActive ?? true,
        });
      } else {
        console.error('Failed to fetch vendor:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch vendor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/vendors/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          leadTimeDays: editForm.leadTimeDays ? parseInt(editForm.leadTimeDays) : null,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setIsEditDialogOpen(false);
        fetchVendorDetail();
      } else {
        alert(result.error || 'Failed to update vendor');
      }
    } catch (error) {
      console.error('Failed to update vendor:', error);
      alert('Failed to update vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/vendors/${resolvedParams.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();

      if (result.success) {
        router.push('/purchasing/vendors');
      } else {
        alert(result.error || 'Failed to delete vendor');
      }
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      alert('Failed to delete vendor');
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

  const getStatusVariant = (status: string): 'primary' | 'danger' | 'secondary' | 'default' => {
    switch (status) {
      case 'approved':
      case 'received':
        return 'primary';
      case 'cancelled':
        return 'danger';
      case 'pending_approval':
        return 'secondary';
      case 'partial':
        return 'secondary';
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
          <h2 className="text-xl font-semibold text-gray-900">Vendor not found</h2>
          <p className="text-gray-500 mt-2">The requested vendor could not be found.</p>
          <DxButton
            text="Back to Vendors"
            type="default"
            onClick={() => router.push('/purchasing/vendors')}
            className="mt-4"
          />
        </div>
      </MainLayout>
    );
  }

  const { vendor, recentPurchaseOrders, approvedItems, summary } = data;

  const tabs: DxTabItem[] = [
    { id: 0, text: 'Overview' },
    { id: 1, text: `Purchase Orders (${recentPurchaseOrders.length})` },
    { id: 2, text: `Approved Items (${approvedItems.length})` },
  ];

  const poColumns: DxDataGridColumn[] = [
    { dataField: 'poNumber', caption: 'PO Number', width: 150 },
    {
      dataField: 'orderDate',
      caption: 'Order Date',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.orderDate),
    },
    {
      dataField: 'expectedDate',
      caption: 'Expected Date',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.expectedDate),
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

  const itemColumns: DxDataGridColumn[] = [
    { dataField: 'itemCode', caption: 'Item Code', width: 120 },
    { dataField: 'itemName', caption: 'Item Name (TH)' },
    { dataField: 'itemNameEn', caption: 'Item Name (EN)' },
    {
      dataField: 'approvalDate',
      caption: 'Approval Date',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.approvalDate),
    },
    {
      dataField: 'expiryDate',
      caption: 'Expiry Date',
      width: 120,
      cellRender: (cellInfo) => formatDate(cellInfo.data.expiryDate),
    },
    {
      dataField: 'isPreferred',
      caption: 'Preferred',
      width: 100,
      cellRender: (cellInfo) =>
        cellInfo.data.isPreferred ? (
          <Badge variant="primary">Preferred</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ];

  const renderEditDialogContent = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vendor Code <span className="text-red-500">*</span>
          </label>
          <DxTextBox
            value={editForm.code}
            onValueChange={(value) => setEditForm({ ...editForm, code: value })}
            placeholder="Enter vendor code"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vendor Name <span className="text-red-500">*</span>
          </label>
          <DxTextBox
            value={editForm.name}
            onValueChange={(value) => setEditForm({ ...editForm, name: value })}
            placeholder="Enter vendor name"
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
            Lead Time (days)
          </label>
          <DxTextBox
            value={editForm.leadTimeDays}
            onValueChange={(value) => setEditForm({ ...editForm, leadTimeDays: value })}
            placeholder="Enter lead time"
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
        <div className="md:col-span-2 flex gap-6">
          <DxCheckBox
            value={editForm.isApproved}
            onValueChange={(value) => setEditForm({ ...editForm, isApproved: value })}
            text="Approved Vendor"
          />
          <DxCheckBox
            value={editForm.isVMI}
            onValueChange={(value) => setEditForm({ ...editForm, isVMI: value })}
            text="VMI Vendor"
          />
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
        Are you sure you want to delete this vendor? If the vendor has related purchase orders,
        it will be deactivated instead.
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Contact Information</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Contact Person</p>
              <p className="text-gray-900">{vendor.contactPerson || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="text-gray-900">{vendor.phone || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-900">{vendor.email || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Address</p>
              <p className="text-gray-900">{vendor.address || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Business Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Business Information</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Tax ID</p>
              <p className="text-gray-900">{vendor.taxId || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Lead Time</p>
              <p className="text-gray-900">{vendor.leadTimeDays ? `${vendor.leadTimeDays} days` : '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Payment Terms</p>
              <p className="text-gray-900">{vendor.paymentTerms || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      {Object.keys(summary.statusBreakdown).length > 0 && (
        <div className="md:col-span-2 mt-6 pt-6 border-t">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status Breakdown</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <Badge variant={getStatusVariant(status)}>
                  {status.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-gray-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={vendor.name}
          description={`รหัส: ${vendor.code}`}
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
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Total Orders</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{summary.totalOrders}</p>
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
                  <p className="text-xs sm:text-sm text-gray-500">Total Amount</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Approved Items</p>
                  <p className="text-lg sm:text-xl font-semibold text-gray-900">{summary.approvedItemsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${vendor.isApproved ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  <CheckCircle className={`h-5 w-5 ${vendor.isApproved ? 'text-green-600' : 'text-yellow-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Status</p>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant={vendor.isApproved ? 'primary' : 'secondary'}>
                      {vendor.isApproved ? 'Approved' : 'Pending'}
                    </Badge>
                    {vendor.isVMI && <Badge variant="default">VMI</Badge>}
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
              recentPurchaseOrders.length > 0 ? (
                <DxDataGrid
                  dataSource={recentPurchaseOrders}
                  keyExpr="id"
                  columns={poColumns}
                  showBorders
                  height={400}
                  onRowClick={(e) => {
                    if (e.data) {
                      router.push(`/purchasing/orders/${e.data.id}`);
                    }
                  }}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No purchase orders found for this vendor
                </div>
              )
            )}

            {activeTabIndex === 2 && (
              approvedItems.length > 0 ? (
                <DxDataGrid
                  dataSource={approvedItems}
                  keyExpr="id"
                  columns={itemColumns}
                  showBorders
                  height={400}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No approved items found for this vendor
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
        title="Edit Vendor"
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
        title="Delete Vendor"
        width={450}
        height="auto"
        showCloseButton
      >
        {renderDeleteDialogContent()}
      </DxPopup>
    </MainLayout>
  );
}
