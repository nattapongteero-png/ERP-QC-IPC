'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { Edit, Trash2, CheckCircle, Archive, Copy, DollarSign, ChevronDown, Settings, Lock, Shield } from 'lucide-react';
import { ItemSearchDialog } from '@/components/ui/item-search-dialog';
import { BOMAccessControlTab } from '@/components/bom/BOMAccessControlTab';
import type { BOMConfidentialityInfo } from '@/types/confidentiality';

interface BOMLine {
  id: number;
  itemId?: number;
  itemCode?: string;
  itemName?: string;
  itemUnit?: string;
  itemType?: string;
  quantity?: number;
  unit?: string;
  sequence: number;
  isOptional?: boolean;
  notes?: string;
  // Confidentiality fields
  isConfidential?: boolean;
  isHidden?: boolean;
  placeholder?: string;
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
  theoreticalYield: number;
  effectiveDate: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
  lines: BOMLine[];
  confidentialityInfo?: BOMConfidentialityInfo;
}

export default function BOMDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [bom, setBom] = useState<BOMDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'materials' | 'access'>('materials');
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    version: '',
    batchSize: 0,
    batchUnit: '',
    yieldTarget: 0,
    lossAllowance: 0,
    theoreticalYield: 0,
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
    quantity: 0,
    isOptional: false,
    notes: '',
  });
  const [addingLine, setAddingLine] = useState(false);

  // Edit line dialog state
  const [editLineDialogOpen, setEditLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BOMLine | null>(null);
  const [editLineForm, setEditLineForm] = useState({
    quantity: 0,
    isOptional: false,
    notes: '',
  });
  const [savingLine, setSavingLine] = useState(false);

  // Delete line dialog state
  const [deleteLineDialogOpen, setDeleteLineDialogOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<BOMLine | null>(null);
  const [deletingLine, setDeletingLine] = useState(false);

  // Invalidate BOM list cache when data changes
  const invalidateBomCache = () => {
    queryClient.invalidateQueries({ queryKey: ['bom-list'] });
    queryClient.invalidateQueries({ queryKey: ['bom-dashboard'] });
  };

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
          batchSize: result.data.batchSize || 0,
          batchUnit: result.data.batchUnit || '',
          yieldTarget: result.data.yieldTarget || 0,
          lossAllowance: result.data.lossAllowance || 0,
          theoreticalYield: result.data.theoreticalYield || 0,
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
          batchSize: editForm.batchSize || null,
          batchUnit: editForm.batchUnit,
          yieldTarget: editForm.yieldTarget || null,
          lossAllowance: editForm.lossAllowance || null,
          theoreticalYield: editForm.theoreticalYield || null,
          effectiveDate: editForm.effectiveDate || null,
          expiryDate: editForm.expiryDate || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setEditDialogOpen(false);
        fetchBOMDetail();
        invalidateBomCache();
      }
    } catch (error) {
      console.error('Failed to update BOM:', error);
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
        invalidateBomCache();
        router.push('/production/bom');
      }
    } catch (error) {
      console.error('Failed to delete BOM:', error);
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
        invalidateBomCache();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openStatusDialog = (status: string) => {
    setNewStatus(status);
    setStatusDialogOpen(true);
    setShowActionsMenu(false);
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
          quantity: newLine.quantity,
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
          quantity: 0,
          isOptional: false,
          notes: '',
        });
        fetchBOMDetail();
        fetchBOMCost();
        invalidateBomCache();
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
      quantity: line.quantity || 0,
      isOptional: line.isOptional || false,
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
          quantity: editLineForm.quantity,
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
        invalidateBomCache();
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
        invalidateBomCache();
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

  // Simplified BOM status workflow: draft → approved → obsolete
  const getStatusActions = () => {
    if (!bom) return [];
    const actions: { label: string; status: string; icon: typeof CheckCircle; variant: 'primary' | 'warning' | 'danger' }[] = [];

    switch (bom.status) {
      case 'draft':
        actions.push({ label: 'Approve for Production', status: 'approved', icon: CheckCircle, variant: 'primary' });
        break;
      case 'active':
        // Legacy status - allow transition to approved
        actions.push({ label: 'Approve for Production', status: 'approved', icon: CheckCircle, variant: 'primary' });
        actions.push({ label: 'Set Obsolete', status: 'obsolete', icon: Archive, variant: 'warning' });
        break;
      case 'approved':
        actions.push({ label: 'Set Obsolete', status: 'obsolete', icon: Archive, variant: 'warning' });
        break;
      case 'obsolete':
        actions.push({ label: 'Reactivate', status: 'approved', icon: CheckCircle, variant: 'primary' });
        break;
    }

    return actions;
  };

  // Grid columns for BOM lines
  const bomLinesColumns: DxDataGridColumn[] = [
    {
      dataField: 'sequence',
      caption: '#',
      width: 60,
      alignment: 'center',
    },
    {
      dataField: 'itemCode',
      caption: 'Item Code',
      width: 140,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400 italic">-</span>;
        }
        return (
          <div className="flex items-center gap-1">
            {line.isConfidential && (
              <span title="Confidential Item">
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              </span>
            )}
            <span className="font-medium">{line.itemCode}</span>
          </div>
        );
      },
    },
    {
      dataField: 'itemName',
      caption: 'Item Name',
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return (
            <div className="flex items-center gap-2 text-gray-400">
              <Lock className="h-4 w-4" />
              <span className="italic">{line.placeholder || '[Confidential Item]'}</span>
            </div>
          );
        }
        return <span>{line.itemName}</span>;
      },
    },
    {
      dataField: 'itemType',
      caption: 'Type',
      width: 120,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        return getItemTypeBadge(line.itemType || '');
      },
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 140,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        return <span>{line.quantity?.toLocaleString()} {line.unit}</span>;
      },
    },
    {
      dataField: 'unitCost',
      caption: 'Unit Cost',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        const costInfo = bomCost?.breakdown.find(b => b.itemId === line.itemId);
        return <span className="text-gray-600">{costInfo ? `${costInfo.unitCost.toLocaleString()} THB` : '-'}</span>;
      },
    },
    {
      dataField: 'totalCost',
      caption: 'Total Cost',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        const costInfo = bomCost?.breakdown.find(b => b.itemId === line.itemId);
        return <span className="font-medium text-green-700">{costInfo ? `${costInfo.totalCost.toLocaleString()} THB` : '-'}</span>;
      },
    },
    {
      dataField: 'isOptional',
      caption: 'Optional',
      width: 100,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        return line.isOptional ?
          <Badge variant="warning">Optional</Badge> :
          <Badge variant="primary">Required</Badge>;
      },
    },
    {
      dataField: 'actions',
      caption: 'Actions',
      width: 120,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        // Don't show actions for hidden lines
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <div className="flex gap-1">
            <DxButton
              icon="edit"
              type="normal"
              stylingMode="text"
              onClick={() => openEditLineDialog(line)}
              hint="Edit"
            />
            <DxButton
              icon="trash"
              type="danger"
              stylingMode="text"
              onClick={() => openDeleteLineDialog(line)}
              hint="Delete"
            />
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DxLoadIndicator />
      </div>
    );
  }

  if (!bom) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">BOM not found</p>
        <DxButton
          text="Back to List"
          type="normal"
          stylingMode="outlined"
          className="mt-4"
          onClick={() => router.push('/production/bom')}
        />
      </div>
    );
  }

  const statusActions = getStatusActions();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/production/bom')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{bom.code}</h1>
              {/* Status with dropdown for changing */}
              <div className="relative" ref={statusMenuRef}>
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  title="Click to change status"
                >
                  <Badge variant={getStatusVariant(bom.status)}>
                    {bom.status}
                  </Badge>
                  {statusActions.length > 0 && (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                {showStatusMenu && statusActions.length > 0 && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                    <div className="py-1">
                      <p className="px-4 py-2 text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Change Status
                      </p>
                      {statusActions.map((action) => (
                        <button
                          key={action.status}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-900"
                          onClick={() => {
                            openStatusDialog(action.status);
                            setShowStatusMenu(false);
                          }}
                        >
                          <action.icon className="h-4 w-4 text-gray-700" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-gray-600 mt-1">{bom.name}</p>
          </div>
          <div className="flex gap-2">
            <DxButton
              text="Configuration"
              icon="preferences"
              type="normal"
              stylingMode="outlined"
              onClick={() => router.push(`/production/bom/${bom.id}/configuration`)}
              hint="Configure rooms, equipment, SOP steps, and QC criteria"
            />
            <DxButton
              text="Create Work Order"
              type="default"
              onClick={() => router.push(`/production/work-orders/new?bomId=${bom.id}`)}
            />
            <div className="relative" ref={actionsMenuRef}>
              <DxButton
                icon="overflow"
                type="normal"
                stylingMode="outlined"
                hint="More actions"
                onClick={() => setShowActionsMenu(!showActionsMenu)}
              />
              {showActionsMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-50">
                  <div className="py-1">
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-900"
                      onClick={() => { setEditDialogOpen(true); setShowActionsMenu(false); }}
                    >
                      <Edit className="h-4 w-4 text-gray-700" />
                      Edit BOM
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-900"
                      onClick={() => {
                        setCopyForm({
                          newCode: `${bom.code}-COPY`,
                          newVersion: '1.0',
                          newName: `${bom.name} (Copy)`,
                        });
                        setCopyDialogOpen(true);
                        setShowActionsMenu(false);
                      }}
                    >
                      <Copy className="h-4 w-4 text-gray-700" />
                      Copy BOM
                    </button>
                    <div className="border-t my-1" />
                    {statusActions.map((action) => (
                      <button
                        key={action.status}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-900"
                        onClick={() => openStatusDialog(action.status)}
                      >
                        <action.icon className="h-4 w-4 text-gray-700" />
                        {action.label}
                      </button>
                    ))}
                    {bom.status === 'draft' && (
                      <>
                        <div className="border-t my-1" />
                        <button
                          className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                          onClick={() => { setDeleteDialogOpen(true); setShowActionsMenu(false); }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete BOM
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
                <p className="text-sm text-gray-600">Theoretical Yield</p>
                <p className="text-2xl font-bold text-purple-600">{bom.theoreticalYield?.toLocaleString() || '-'}</p>
                <p className="text-xs text-gray-500">{bom.productUnit}</p>
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
                  <div className="flex justify-center">
                    <DxLoadIndicator height={32} width={32} />
                  </div>
                ) : bomCost?.totalMaterialCost !== undefined ? (
                  <>
                    <p className="text-2xl font-bold text-green-700">
                      {bomCost.totalMaterialCost.toLocaleString()} {bomCost.currency}
                    </p>
                    <p className="text-xs text-green-600">
                      {bomCost.costPerUnit?.toLocaleString() || '0'} {bomCost.currency}/{bom.batchUnit}
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
                  <dd className="font-medium text-gray-900">{bom.productCode}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Product Name</dt>
                  <dd className="font-medium text-gray-900">{bom.productName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Unit</dt>
                  <dd className="font-medium text-gray-900">{bom.productUnit}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Version</dt>
                  <dd className="font-medium text-gray-900">{bom.version}</dd>
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
                  <dd className="font-medium text-gray-900">{formatDate(bom.effectiveDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Expiry Date</dt>
                  <dd className="font-medium text-gray-900">{formatDate(bom.expiryDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="font-medium text-gray-900">{formatDate(bom.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Updated</dt>
                  <dd className="font-medium text-gray-900">{formatDate(bom.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* BOM Content Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('materials')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'materials'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  data-testid="tab-materials"
                >
                  Bill of Materials
                  {bom.confidentialityInfo?.hasConfidentialItems && (
                    <span title="Contains confidential items">
                      <Lock className="inline-block ml-1.5 h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </button>
                {bom.confidentialityInfo?.userHasFullAccess && (
                  <button
                    onClick={() => setActiveTab('access')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'access'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    data-testid="tab-access-control"
                  >
                    <Shield className="inline-block mr-1.5 h-4 w-4" />
                    Access Control
                  </button>
                )}
              </div>

              {/* Actions for Materials tab */}
              {activeTab === 'materials' && (
                <DxButton
                  text="Add Material"
                  icon="plus"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => {
                    setNewLine({
                      itemId: 0,
                      itemCode: '',
                      itemName: '',
                      itemUnit: '',
                      quantity: 0,
                      isOptional: false,
                      notes: '',
                    });
                    setAddLineDialogOpen(true);
                  }}
                />
              )}
            </div>

            {/* Confidentiality info banner */}
            {activeTab === 'materials' && bom.confidentialityInfo?.hasConfidentialItems && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Lock className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  {bom.confidentialityInfo.userHasFullAccess ? (
                    <>
                      This BOM contains confidential items. You have full access to view all {bom.confidentialityInfo.totalLineCount} items.
                    </>
                  ) : (
                    <>
                      This BOM contains confidential items. Showing {bom.confidentialityInfo.visibleLineCount} of {bom.confidentialityInfo.totalLineCount} items.
                    </>
                  )}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {activeTab === 'materials' && (
              <DxDataGrid
                dataSource={bom.lines || []}
                keyExpr="id"
                columns={bomLinesColumns}
                showBorders
                rowAlternationEnabled
                noDataText="No materials defined for this BOM"
              />
            )}

            {activeTab === 'access' && bom.confidentialityInfo?.userHasFullAccess && (
              <BOMAccessControlTab
                bomId={bom.id}
                canManage={bom.confidentialityInfo.userHasFullAccess}
              />
            )}
          </CardContent>
        </Card>

      {/* Edit Dialog */}
      <DxPopup
        visible={editDialogOpen}
        onHiding={() => setEditDialogOpen(false)}
        title="Edit BOM"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500 mb-4">
            Update the BOM details. Material lines cannot be edited here.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <DxTextBox
              value={editForm.name}
              onValueChange={(value) => setEditForm({ ...editForm, name: value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <DxTextBox
                value={editForm.version}
                onValueChange={(value) => setEditForm({ ...editForm, version: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Unit</label>
              <DxTextBox
                value={editForm.batchUnit}
                onValueChange={(value) => setEditForm({ ...editForm, batchUnit: value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
              <DxNumberBox
                value={editForm.batchSize}
                onValueChange={(value) => setEditForm({ ...editForm, batchSize: value || 0 })}
                format="#,##0.###"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yield Target (%)</label>
              <DxNumberBox
                value={editForm.yieldTarget}
                onValueChange={(value) => setEditForm({ ...editForm, yieldTarget: value || 0 })}
                format="#,##0.#"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loss Allowance (%)</label>
              <DxNumberBox
                value={editForm.lossAllowance}
                onValueChange={(value) => setEditForm({ ...editForm, lossAllowance: value || 0 })}
                format="#,##0.#"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Theoretical Yield ({bom?.productUnit || 'unit'})
              </label>
              <DxNumberBox
                value={editForm.theoreticalYield}
                onValueChange={(value) => setEditForm({ ...editForm, theoreticalYield: value || 0 })}
                format="#,##0.###"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
              <DxDateBox
                value={editForm.effectiveDate}
                onValueChange={(value) => setEditForm({ ...editForm, effectiveDate: value || '' })}
                max={editForm.expiryDate || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <DxDateBox
                value={editForm.expiryDate}
                onValueChange={(value) => setEditForm({ ...editForm, expiryDate: value || '' })}
                min={editForm.effectiveDate || undefined}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setEditDialogOpen(false)}
            />
            <DxButton
              text={saving ? 'Saving...' : 'Save Changes'}
              type="default"
              onClick={handleSaveEdit}
              disabled={saving}
            />
          </div>
        </div>
      </DxPopup>

      {/* Delete Confirmation Dialog */}
      <DxPopup
        visible={deleteDialogOpen}
        onHiding={() => setDeleteDialogOpen(false)}
        title="Delete BOM"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete this BOM? This action cannot be undone.
            Only draft BOMs can be deleted.
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setDeleteDialogOpen(false)}
            />
            <DxButton
              text={deleting ? 'Deleting...' : 'Delete BOM'}
              type="danger"
              onClick={handleDelete}
              disabled={deleting}
            />
          </div>
        </div>
      </DxPopup>

      {/* Status Change Dialog */}
      <DxPopup
        visible={statusDialogOpen}
        onHiding={() => setStatusDialogOpen(false)}
        title="Change BOM Status"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            Are you sure you want to change the status from &quot;{bom.status}&quot; to &quot;{newStatus}&quot;?
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setStatusDialogOpen(false)}
            />
            <DxButton
              text={updatingStatus ? 'Updating...' : 'Confirm'}
              type="default"
              onClick={handleStatusChange}
              disabled={updatingStatus}
            />
          </div>
        </div>
      </DxPopup>

      {/* Copy BOM Dialog */}
      <DxPopup
        visible={copyDialogOpen}
        onHiding={() => setCopyDialogOpen(false)}
        title="Copy BOM"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            Create a copy of this BOM with a new code. The copy will be created as a draft.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New BOM Code *</label>
            <DxTextBox
              value={copyForm.newCode}
              onValueChange={(value) => setCopyForm({ ...copyForm, newCode: value })}
              placeholder="Enter new BOM code"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
            <DxTextBox
              value={copyForm.newVersion}
              onValueChange={(value) => setCopyForm({ ...copyForm, newVersion: value })}
              placeholder="1.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <DxTextBox
              value={copyForm.newName}
              onValueChange={(value) => setCopyForm({ ...copyForm, newName: value })}
              placeholder="Enter new BOM name"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setCopyDialogOpen(false)}
            />
            <DxButton
              text={copying ? 'Copying...' : 'Copy BOM'}
              type="default"
              onClick={handleCopy}
              disabled={copying || !copyForm.newCode}
            />
          </div>
        </div>
      </DxPopup>

      {/* Add Line Dialog */}
      <DxPopup
        visible={addLineDialogOpen}
        onHiding={() => setAddLineDialogOpen(false)}
        title="Add Material"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            Add a new material/ingredient to this BOM.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
            {newLine.itemId ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 border rounded bg-gray-50">
                  <p className="font-medium">{newLine.itemCode}</p>
                  <p className="text-sm text-gray-500">{newLine.itemName}</p>
                </div>
                <DxButton
                  text="Change"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setItemSearchOpen(true)}
                />
              </div>
            ) : (
              <DxButton
                text="Select Material"
                type="normal"
                stylingMode="outlined"
                onClick={() => setItemSearchOpen(true)}
                width="100%"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <DxNumberBox
                value={newLine.quantity}
                onValueChange={(value) => setNewLine({ ...newLine, quantity: value || 0 })}
                format="#,##0.###"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <DxTextBox
                value={newLine.itemUnit}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>
          <div>
            <DxCheckBox
              value={newLine.isOptional}
              onValueChange={(value) => setNewLine({ ...newLine, isOptional: value })}
              text="Optional material"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextBox
              value={newLine.notes}
              onValueChange={(value) => setNewLine({ ...newLine, notes: value })}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setAddLineDialogOpen(false)}
            />
            <DxButton
              text={addingLine ? 'Adding...' : 'Add Material'}
              type="default"
              onClick={handleAddLine}
              disabled={addingLine || !newLine.itemId || !newLine.quantity}
            />
          </div>
        </div>
      </DxPopup>

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={itemSearchOpen}
        onOpenChange={setItemSearchOpen}
        onSelect={handleSelectItem}
        title="Select Material"
        showPrice="cost"
        filterType="raw_material"
      />

      {/* Edit Line Dialog */}
      <DxPopup
        visible={editLineDialogOpen}
        onHiding={() => setEditLineDialogOpen(false)}
        title="Edit Material"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            Update the quantity or settings for {editingLine?.itemCode}.
          </p>
          <div className="p-3 border rounded bg-gray-50">
            <p className="font-medium">{editingLine?.itemCode}</p>
            <p className="text-sm text-gray-500">{editingLine?.itemName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <DxNumberBox
                value={editLineForm.quantity}
                onValueChange={(value) => setEditLineForm({ ...editLineForm, quantity: value || 0 })}
                format="#,##0.###"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <DxTextBox
                value={editingLine?.unit || ''}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>
          <div>
            <DxCheckBox
              value={editLineForm.isOptional}
              onValueChange={(value) => setEditLineForm({ ...editLineForm, isOptional: value })}
              text="Optional material"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <DxTextBox
              value={editLineForm.notes}
              onValueChange={(value) => setEditLineForm({ ...editLineForm, notes: value })}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setEditLineDialogOpen(false)}
            />
            <DxButton
              text={savingLine ? 'Saving...' : 'Save Changes'}
              type="default"
              onClick={handleUpdateLine}
              disabled={savingLine || !editLineForm.quantity}
            />
          </div>
        </div>
      </DxPopup>

      {/* Delete Line Dialog */}
      <DxPopup
        visible={deleteLineDialogOpen}
        onHiding={() => setDeleteLineDialogOpen(false)}
        title="Remove Material"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            Are you sure you want to remove {lineToDelete?.itemCode} ({lineToDelete?.itemName}) from this BOM?
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => setDeleteLineDialogOpen(false)}
            />
            <DxButton
              text={deletingLine ? 'Removing...' : 'Remove Material'}
              type="danger"
              onClick={handleDeleteLine}
              disabled={deletingLine}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
