'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  Edit,
  ArrowLeft,
  Trash2,
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

  const getStatusVariant = (status: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'approved':
      case 'received':
        return 'success';
      case 'cancelled':
        return 'danger';
      case 'pending_approval':
        return 'warning';
      case 'partial':
        return 'info';
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
          <Button className="mt-4" onClick={() => router.push('/purchasing/vendors')}>
            Back to Vendors
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { vendor, recentPurchaseOrders, approvedItems, summary } = data;

  const poColumns = [
    { key: 'poNumber', header: 'PO Number' },
    {
      key: 'orderDate',
      header: 'Order Date',
      render: (po: PurchaseOrder) => formatDate(po.orderDate),
    },
    {
      key: 'expectedDate',
      header: 'Expected Date',
      render: (po: PurchaseOrder) => formatDate(po.expectedDate),
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      render: (po: PurchaseOrder) => formatCurrency(po.totalAmount, po.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (po: PurchaseOrder) => (
        <Badge variant={getStatusVariant(po.status)} dot>
          {po.status.replace('_', ' ')}
        </Badge>
      ),
    },
  ];

  const itemColumns = [
    { key: 'itemCode', header: 'Item Code', render: (item: ApprovedItem) => item.itemCode || '-' },
    { key: 'itemName', header: 'Item Name (TH)', render: (item: ApprovedItem) => item.itemName || '-' },
    { key: 'itemNameEn', header: 'Item Name (EN)', render: (item: ApprovedItem) => item.itemNameEn || '-' },
    {
      key: 'approvalDate',
      header: 'Approval Date',
      render: (item: ApprovedItem) => formatDate(item.approvalDate),
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (item: ApprovedItem) => formatDate(item.expiryDate),
    },
    {
      key: 'isPreferred',
      header: 'Preferred',
      render: (item: ApprovedItem) =>
        item.isPreferred ? (
          <Badge variant="success">Preferred</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={vendor.name}
          description={`รหัส: ${vendor.code}`}
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push('/purchasing/vendors')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button variant="secondary" onClick={() => setIsEditDialogOpen(true)} leftIcon={<Edit className="h-4 w-4" />}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => setIsDeleteDialogOpen(true)} leftIcon={<Trash2 className="h-4 w-4" />}>
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
                    <Badge variant={vendor.isApproved ? 'success' : 'warning'} dot>
                      {vendor.isApproved ? 'Approved' : 'Pending'}
                    </Badge>
                    {vendor.isVMI && <Badge variant="info">VMI</Badge>}
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
                <TabsTrigger value="orders">Purchase Orders ({recentPurchaseOrders.length})</TabsTrigger>
                <TabsTrigger value="items">Approved Items ({approvedItems.length})</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="overview" className="mt-0">
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
                </div>

                {/* Status Breakdown */}
                {Object.keys(summary.statusBreakdown).length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold text-gray-900 mb-4">Order Status Breakdown</h3>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(summary.statusBreakdown).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(status)} dot>
                            {status.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="mt-0">
                {recentPurchaseOrders.length > 0 ? (
                  <Table
                    columns={poColumns}
                    data={recentPurchaseOrders}
                    keyField="id"
                    onRowClick={(po) => router.push(`/purchasing/orders/${po.id}`)}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No purchase orders found for this vendor
                  </div>
                )}
              </TabsContent>

              <TabsContent value="items" className="mt-0">
                {approvedItems.length > 0 ? (
                  <Table columns={itemColumns} data={approvedItems} keyField="id" />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No approved items found for this vendor
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
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <Input
              label="Vendor Code"
              value={editForm.code}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              required
            />
            <Input
              label="Vendor Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
            <Input
              label="Contact Person"
              value={editForm.contactPerson}
              onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
            />
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <Input
              label="Tax ID"
              value={editForm.taxId}
              onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
            />
            <Input
              label="Lead Time (days)"
              type="number"
              value={editForm.leadTimeDays}
              onChange={(e) => setEditForm({ ...editForm, leadTimeDays: e.target.value })}
            />
            <Input
              label="Payment Terms"
              value={editForm.paymentTerms}
              onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
            />
            <div className="md:col-span-2">
              <Input
                label="Address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isApproved}
                  onChange={(e) => setEditForm({ ...editForm, isApproved: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Approved Vendor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isVMI}
                  onChange={(e) => setEditForm({ ...editForm, isVMI: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">VMI Vendor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsEditDialogOpen(false)}>
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
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete this vendor? If the vendor has related purchase orders,
            it will be deactivated instead.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
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
