'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, CheckCircle, XCircle, Archive, Copy, Plus, DollarSign } from 'lucide-react';
import { ItemSearchDialog } from '@/components/ui/item-search-dialog';

interface BOMLine {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  itemType: string;
  quantity: number;
  unit: string;
  sequence: number;
  isOptional: boolean;
  notes: string;
}

interface BOMCostBreakdown {
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  costSource: string;
}

interface BOMCost {
  totalMaterialCost: number;
  costPerUnit: number;
  breakdown: BOMCostBreakdown[];
  currency: string;
}

interface BOMDetail {
  id: number;
  code: string;
  name: string;
  productId: number;
  productCode: string;
  productName: string;
  productUnit: string;
  version: string;
  status: string;
  batchSize: number;
  batchUnit: string;
  yieldTarget: number;
  lossAllowance: number;
  effectiveDate: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
  lines: BOMLine[];
}

export default function BOMDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bom, setBom] = useState<BOMDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    version: '',
    batchSize: '',
    batchUnit: '',
    yieldTarget: '',
    lossAllowance: '',
    effectiveDate: '',
    expiryDate: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Cost state
  const [bomCost, setBomCost] = useState<BOMCost | null>(null);
  const [loadingCost, setLoadingCost] = useState(false);

  // Copy dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyForm, setCopyForm] = useState({
    newCode: '',
    newVersion: '1.0',
    newName: '',
  });
  const [copying, setCopying] = useState(false);

  // Add line dialog state
  const [addLineDialogOpen, setAddLineDialogOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [newLine, setNewLine] = useState({
    itemId: 0,
    itemCode: '',
    itemName: '',
    itemUnit: '',
    quantity: '',
    isOptional: false,
    notes: '',
  });
  const [addingLine, setAddingLine] = useState(false);

  // Edit line dialog state
  const [editLineDialogOpen, setEditLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BOMLine | null>(null);
  const [editLineForm, setEditLineForm] = useState({
    quantity: '',
    isOptional: false,
    notes: '',
  });
  const [savingLine, setSavingLine] = useState(false);

  // Delete line dialog state
  const [deleteLineDialogOpen, setDeleteLineDialogOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<BOMLine | null>(null);
  const [deletingLine, setDeletingLine] = useState(false);

  useEffect(() => {
    fetchBOMDetail();
  }, [params.id]);

  useEffect(() => {
    if (bom?.id) {
      fetchBOMCost();
    }
  }, [bom?.id]);

  const fetchBOMCost = async () => {
    if (!bom) return;
    setLoadingCost(true);
    try {
      const response = await fetch(`/api/bom/${bom.id}/cost`);
      const result = await response.json();
      if (result.success) {
        setBomCost(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch BOM cost:', error);
    } finally {
      setLoadingCost(false);
    }
  };

  const fetchBOMDetail = async () => {
    try {
      const response = await fetch(`/api/bom/${params.id}`);
      const result = await response.json();
      if (result.success) {
        setBom(result.data);
        // Initialize edit form
        setEditForm({
          name: result.data.name || '',
          version: result.data.version || '',
          batchSize: result.data.batchSize?.toString() || '',
          batchUnit: result.data.batchUnit || '',
          yieldTarget: result.data.yieldTarget?.toString() || '',
          lossAllowance: result.data.lossAllowance?.toString() || '',
          effectiveDate: result.data.effectiveDate?.split('T')[0] || '',
          expiryDate: result.data.expiryDate?.split('T')[0] || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch BOM detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!bom) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/bom/${bom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          version: editForm.version,
          batchSize: parseFloat(editForm.batchSize) || null,
          batchUnit: editForm.batchUnit,
          yieldTarget: parseFloat(editForm.yieldTarget) || null,
          lossAllowance: parseFloat(editForm.lossAllowance) || null,
          effectiveDate: editForm.effectiveDate || null,
          expiryDate: editForm.expiryDate || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setEditDialogOpen(false);
        fetchBOMDetail();
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to update BOM:', error);
      // Network errors handled by global error handler
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bom) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/bom/${bom.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        router.push('/production/bom');
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to delete BOM:', error);
      // Network errors handled by global error handler
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleStatusChange = async () => {
    if (!bom || !newStatus) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/bom/${bom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        setStatusDialogOpen(false);
        setNewStatus('');
        fetchBOMDetail();
      }
      // API errors handled by global error handler
    } catch (error) {
      console.error('Failed to update status:', error);
      // Network errors handled by global error handler
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openStatusDialog = (status: string) => {
    setNewStatus(status);
    setStatusDialogOpen(true);
  };

  const handleCopy = async () => {
    if (!bom || !copyForm.newCode) return;
    setCopying(true);
    try {
      const response = await fetch(`/api/bom/${bom.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newCode: copyForm.newCode,
          newVersion: copyForm.newVersion || '1.0',
          newName: copyForm.newName || `${bom.name} (Copy)`,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setCopyDialogOpen(false);
        router.push(`/production/bom/${result.data.id}`);
      }
    } catch (error) {
      console.error('Failed to copy BOM:', error);
    } finally {
      setCopying(false);
    }
  };

  const handleSelectItem = (item: { id: number; code: string; nameTh: string; primaryUnit: string }) => {
    setNewLine({
      ...newLine,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh,
      itemUnit: item.primaryUnit,
    });
    setItemSearchOpen(false);
  };

  const handleAddLine = async () => {
    if (!bom || !newLine.itemId || !newLine.quantity) return;
    setAddingLine(true);
    try {
      const response = await fetch(`/api/bom/${bom.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: newLine.itemId,
          quantity: parseFloat(newLine.quantity),
          unit: newLine.itemUnit,
          isOptional: newLine.isOptional,
          notes: newLine.notes || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setAddLineDialogOpen(false);
        setNewLine({
          itemId: 0,
          itemCode: '',
          itemName: '',
          itemUnit: '',
          quantity: '',
          isOptional: false,
          notes: '',
        });
        fetchBOMDetail();
        fetchBOMCost();
      }
    } catch (error) {
      console.error('Failed to add line:', error);
    } finally {
      setAddingLine(false);
    }
  };

  const openEditLineDialog = (line: BOMLine) => {
    setEditingLine(line);
    setEditLineForm({
      quantity: line.quantity.toString(),
      isOptional: line.isOptional,
      notes: line.notes || '',
    });
    setEditLineDialogOpen(true);
  };

  const handleUpdateLine = async () => {
    if (!editingLine) return;
    setSavingLine(true);
    try {
      const response = await fetch(`/api/bom/lines/${editingLine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseFloat(editLineForm.quantity),
          isOptional: editLineForm.isOptional,
          notes: editLineForm.notes || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setEditLineDialogOpen(false);
        setEditingLine(null);
        fetchBOMDetail();
        fetchBOMCost();
      }
    } catch (error) {
      console.error('Failed to update line:', error);
    } finally {
      setSavingLine(false);
    }
  };

  const openDeleteLineDialog = (line: BOMLine) => {
    setLineToDelete(line);
    setDeleteLineDialogOpen(true);
  };

  const handleDeleteLine = async () => {
    if (!lineToDelete) return;
    setDeletingLine(true);
    try {
      const response = await fetch(`/api/bom/lines/${lineToDelete.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setDeleteLineDialogOpen(false);
        setLineToDelete(null);
        fetchBOMDetail();
        fetchBOMCost();
      }
    } catch (error) {
      console.error('Failed to delete line:', error);
    } finally {
      setDeletingLine(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const getItemTypeBadge = (type: string) => {
    const variants: Record<string, 'primary' | 'secondary' | 'warning' | 'default'> = {
      raw_material: 'primary',
      extract: 'secondary',
      excipient: 'warning',
      packaging: 'default',
    };
    return <Badge variant={variants[type] || 'default'}>{type?.replace('_', ' ') || 'N/A'}</Badge>;
  };

  const getStatusActions = () => {
    if (!bom) return [];
    const actions: { label: string; status: string; icon: any; variant: 'primary' | 'warning' | 'danger' }[] = [];

    switch (bom.status) {
      case 'draft':
        actions.push({ label: 'Activate', status: 'active', icon: CheckCircle, variant: 'primary' });
        break;
      case 'active':
        actions.push({ label: 'Approve', status: 'approved', icon: CheckCircle, variant: 'primary' });
        actions.push({ label: 'Set Obsolete', status: 'obsolete', icon: Archive, variant: 'warning' });
        break;
      case 'approved':
        actions.push({ label: 'Set Obsolete', status: 'obsolete', icon: Archive, variant: 'warning' });
        actions.push({ label: 'Revert to Active', status: 'active', icon: XCircle, variant: 'warning' });
        break;
      case 'obsolete':
        actions.push({ label: 'Reactivate', status: 'active', icon: CheckCircle, variant: 'primary' });
        break;
    }

    return actions;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!bom) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">BOM not found</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/production/bom')}>
            Back to List
          </Button>
        </div>
      </MainLayout>
    );
  }

  const statusActions = getStatusActions();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push('/production/bom')}>
                &larr; Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">{bom.code}</h1>
              <Badge variant={getStatusVariant(bom.status)}>
                {bom.status}
              </Badge>
            </div>
            <p className="text-gray-600 mt-1">{bom.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => router.push(`/production/work-orders/new?bomId=${bom.id}`)}>
              Create Work Order
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit BOM
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setCopyForm({
                    newCode: `${bom.code}-COPY`,
                    newVersion: '1.0',
                    newName: `${bom.name} (Copy)`,
                  });
                  setCopyDialogOpen(true);
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy BOM
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {statusActions.map((action) => (
                  <DropdownMenuItem key={action.status} onClick={() => openStatusDialog(action.status)}>
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {bom.status === 'draft' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete BOM
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Batch Size</p>
                <p className="text-2xl font-bold text-blue-600">{bom.batchSize?.toLocaleString() || 0}</p>
                <p className="text-xs text-gray-500">{bom.batchUnit}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Yield Target</p>
                <p className="text-2xl font-bold text-green-600">{bom.yieldTarget || '-'}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Loss Allowance</p>
                <p className="text-2xl font-bold text-yellow-600">{bom.lossAllowance || '-'}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Materials</p>
                <p className="text-2xl font-bold text-gray-600">{bom.lines?.length || 0}</p>
                <p className="text-xs text-gray-500">items</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-700 font-medium">Material Cost</p>
                </div>
                {loadingCost ? (
                  <div className="animate-pulse h-8 bg-green-200 rounded w-24 mx-auto"></div>
                ) : bomCost ? (
                  <>
                    <p className="text-2xl font-bold text-green-700">
                      {bomCost.totalMaterialCost.toLocaleString()} {bomCost.currency}
                    </p>
                    <p className="text-xs text-green-600">
                      {bomCost.costPerUnit.toLocaleString()} {bomCost.currency}/{bom.batchUnit}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-400">-</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Info */}
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Product Code</dt>
                  <dd className="font-medium">{bom.productCode}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Product Name</dt>
                  <dd className="font-medium">{bom.productName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Unit</dt>
                  <dd className="font-medium">{bom.productUnit}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Version</dt>
                  <dd className="font-medium">{bom.version}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle>Validity Period</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Effective Date</dt>
                  <dd className="font-medium">{formatDate(bom.effectiveDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Expiry Date</dt>
                  <dd className="font-medium">{formatDate(bom.expiryDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="font-medium">{formatDate(bom.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Updated</dt>
                  <dd className="font-medium">{formatDate(bom.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* BOM Lines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bill of Materials</CardTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddLineDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Material
            </Button>
          </CardHeader>
          <CardContent>
            <Table
              columns={[
                { key: 'sequence', title: '#' },
                { key: 'itemCode', title: 'Item Code' },
                { key: 'itemName', title: 'Item Name' },
                { key: 'itemType', title: 'Type' },
                { key: 'quantity', title: 'Quantity' },
                { key: 'unitCost', title: 'Unit Cost' },
                { key: 'totalCost', title: 'Total Cost' },
                { key: 'isOptional', title: 'Optional' },
                { key: 'actions', title: 'Actions' },
              ]}
              data={bom.lines || []}
              renderRow={(line) => {
                const costInfo = bomCost?.breakdown.find(b => b.itemId === line.itemId);
                return (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">{line.sequence}</td>
                    <td className="px-4 py-3 font-medium">{line.itemCode}</td>
                    <td className="px-4 py-3">{line.itemName}</td>
                    <td className="px-4 py-3">{getItemTypeBadge(line.itemType)}</td>
                    <td className="px-4 py-3">{line.quantity?.toLocaleString()} {line.unit}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {costInfo ? `${costInfo.unitCost.toLocaleString()} THB` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {costInfo ? `${costInfo.totalCost.toLocaleString()} THB` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {line.isOptional ?
                        <Badge variant="warning">Optional</Badge> :
                        <Badge variant="primary">Required</Badge>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditLineDialog(line)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openDeleteLineDialog(line)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }}
            />
            {(!bom.lines || bom.lines.length === 0) && (
              <p className="text-center text-gray-500 py-8">No materials defined for this BOM</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit BOM</DialogTitle>
            <DialogDescription>
              Update the BOM details. Material lines cannot be edited here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                <Input
                  value={editForm.version}
                  onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Unit</label>
                <Input
                  value={editForm.batchUnit}
                  onChange={(e) => setEditForm({ ...editForm, batchUnit: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
                <Input
                  type="number"
                  step="0.001"
                  value={editForm.batchSize}
                  onChange={(e) => setEditForm({ ...editForm, batchSize: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yield Target (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.yieldTarget}
                  onChange={(e) => setEditForm({ ...editForm, yieldTarget: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loss Allowance (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.lossAllowance}
                  onChange={(e) => setEditForm({ ...editForm, lossAllowance: e.target.value })}
                />
              </div>
              <div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DatePicker
                label="Effective Date"
                value={editForm.effectiveDate}
                onChange={(value) => setEditForm({ ...editForm, effectiveDate: value })}
                max={editForm.expiryDate || undefined}
                showQuickActions={false}
                size="sm"
              />
              <DatePicker
                label="Expiry Date"
                value={editForm.expiryDate}
                onChange={(value) => setEditForm({ ...editForm, expiryDate: value })}
                min={editForm.effectiveDate || undefined}
                showQuickActions={false}
                size="sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete BOM</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this BOM? This action cannot be undone.
              Only draft BOMs can be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete BOM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change BOM Status</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the status from &quot;{bom.status}&quot; to &quot;{newStatus}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleStatusChange} disabled={updatingStatus}>
              {updatingStatus ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy BOM Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy BOM</DialogTitle>
            <DialogDescription>
              Create a copy of this BOM with a new code. The copy will be created as a draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New BOM Code *</label>
              <Input
                value={copyForm.newCode}
                onChange={(e) => setCopyForm({ ...copyForm, newCode: e.target.value })}
                placeholder="Enter new BOM code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <Input
                value={copyForm.newVersion}
                onChange={(e) => setCopyForm({ ...copyForm, newVersion: e.target.value })}
                placeholder="1.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                value={copyForm.newName}
                onChange={(e) => setCopyForm({ ...copyForm, newName: e.target.value })}
                placeholder="Enter new BOM name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCopy} disabled={copying || !copyForm.newCode}>
              {copying ? 'Copying...' : 'Copy BOM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
            <DialogDescription>
              Add a new material/ingredient to this BOM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
              {newLine.itemId ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 border rounded bg-gray-50">
                    <p className="font-medium">{newLine.itemCode}</p>
                    <p className="text-sm text-gray-500">{newLine.itemName}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setItemSearchOpen(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setItemSearchOpen(true)} className="w-full">
                  Select Material
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <Input
                  type="number"
                  step="0.001"
                  value={newLine.quantity}
                  onChange={(e) => setNewLine({ ...newLine, quantity: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <Input
                  value={newLine.itemUnit}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isOptional"
                checked={newLine.isOptional}
                onChange={(e) => setNewLine({ ...newLine, isOptional: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="isOptional" className="text-sm text-gray-700">
                Optional material
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <Input
                value={newLine.notes}
                onChange={(e) => setNewLine({ ...newLine, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddLineDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddLine}
              disabled={addingLine || !newLine.itemId || !newLine.quantity}
            >
              {addingLine ? 'Adding...' : 'Add Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={itemSearchOpen}
        onOpenChange={setItemSearchOpen}
        onSelect={handleSelectItem}
        title="Select Material"
        showPrice="cost"
      />

      {/* Edit Line Dialog */}
      <Dialog open={editLineDialogOpen} onOpenChange={setEditLineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Material</DialogTitle>
            <DialogDescription>
              Update the quantity or settings for {editingLine?.itemCode}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 border rounded bg-gray-50">
              <p className="font-medium">{editingLine?.itemCode}</p>
              <p className="text-sm text-gray-500">{editingLine?.itemName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <Input
                  type="number"
                  step="0.001"
                  value={editLineForm.quantity}
                  onChange={(e) => setEditLineForm({ ...editLineForm, quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <Input
                  value={editingLine?.unit || ''}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsOptional"
                checked={editLineForm.isOptional}
                onChange={(e) => setEditLineForm({ ...editLineForm, isOptional: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="editIsOptional" className="text-sm text-gray-700">
                Optional material
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <Input
                value={editLineForm.notes}
                onChange={(e) => setEditLineForm({ ...editLineForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditLineDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateLine}
              disabled={savingLine || !editLineForm.quantity}
            >
              {savingLine ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Line Dialog */}
      <Dialog open={deleteLineDialogOpen} onOpenChange={setDeleteLineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Material</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {lineToDelete?.itemCode} ({lineToDelete?.itemName}) from this BOM?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteLineDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteLine} disabled={deletingLine}>
              {deletingLine ? 'Removing...' : 'Remove Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
