'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge, getStatusVariant } from '@/components/ui/badge';
import { Edit, Trash2, CheckCircle, Archive, Copy, DollarSign, ChevronDown, Settings, Lock, Shield } from 'lucide-react';
import { ItemSearchDialog } from '@/components/ui/item-search-dialog';
import { BOMAccessControlTab, ConfidentialityBanner } from '@/components/bom';
import { formatNumber, formatMoney } from '@/lib/utils/number-format';
import { useToast } from '@/hooks/use-toast';
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
  fillWeightMg: number | null;
  // Product master-data strength (from the item's "ความแรง") — used to seed
  // the fill-weight field when the BOM has no value of its own.
  productStrengthValue?: number | string | null;
  productStrengthUnit?: string | null;
  productUnitWeightMg?: number | string | null;
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
  const t = useTranslations('production');
  const toast = useToast();

  // Use translation for page title
  const pageTitle = t('bomDetail.title');
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
    fillWeightMg: 0,
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
    unitOptions: [] as string[],
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
          batchSize: Number(result.data.batchSize) || 0,
          batchUnit: result.data.batchUnit || '',
          yieldTarget: Number(result.data.yieldTarget) || 0,
          lossAllowance: Number(result.data.lossAllowance) || 0,
          theoreticalYield: Number(result.data.theoreticalYield) || 0,
          // Auto-seed fill weight from the product item's strength ("ความแรง")
          // when the BOM has no value yet, so the operator doesn't start at 0.
          fillWeightMg:
            Number(result.data.fillWeightMg) ||
            Number(result.data.productStrengthValue) ||
            0,
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
          fillWeightMg: editForm.fillWeightMg || null,
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
        toast.success('คัดลอก BOM สำเร็จ', `สร้าง ${copyForm.newCode} เป็นฉบับร่างแล้ว`);
        router.push(`/production/bom/${result.data.id}`);
      } else {
        // Surface the real reason (most often: the new code already exists) —
        // previously this only console.error'd, so the dialog just sat there
        // and the user thought "copy doesn't work".
        toast.error('คัดลอก BOM ไม่สำเร็จ', result.error || 'รหัส BOM อาจซ้ำกับที่มีอยู่แล้ว — ลองเปลี่ยนรหัสใหม่');
      }
    } catch (error) {
      console.error('Failed to copy BOM:', error);
      toast.error('คัดลอก BOM ไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setCopying(false);
    }
  };

  const handleSelectItem = (item: { id: number; code: string; nameTh: string; primaryUnit: string; secondaryUnit?: string | null; weightUnit?: string | null }) => {
    const unitOpts = [item.primaryUnit];
    if (item.secondaryUnit && item.secondaryUnit !== item.primaryUnit) {
      unitOpts.push(item.secondaryUnit);
    }
    if (item.weightUnit && !unitOpts.includes(item.weightUnit)) {
      unitOpts.push(item.weightUnit);
    }
    setNewLine({
      ...newLine,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh,
      itemUnit: item.primaryUnit,
      unitOptions: unitOpts,
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
          unitOptions: [],
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
      quantity: Number(line.quantity) || 0,
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
        actions.push({ label: 'อนุมัติเพื่อผลิต', status: 'approved', icon: CheckCircle, variant: 'primary' });
        break;
      case 'active':
        // Legacy status - allow transition to approved
        actions.push({ label: 'อนุมัติเพื่อผลิต', status: 'approved', icon: CheckCircle, variant: 'primary' });
        actions.push({ label: 'ตั้งเป็นเลิกใช้', status: 'obsolete', icon: Archive, variant: 'warning' });
        break;
      case 'approved':
        actions.push({ label: 'ตั้งเป็นเลิกใช้', status: 'obsolete', icon: Archive, variant: 'warning' });
        break;
      case 'obsolete':
        actions.push({ label: 'เปิดใช้งานอีกครั้ง', status: 'approved', icon: CheckCircle, variant: 'primary' });
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
      caption: 'รหัสสินค้า',
      width: 180,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400 italic">-</span>;
        }
        return (
          <div className="flex items-center gap-1 flex-nowrap">
            {line.isConfidential && (
              <span title="รายการลับ" className="shrink-0">
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              </span>
            )}
            <span className="font-medium whitespace-nowrap font-mono text-sm">{line.itemCode}</span>
          </div>
        );
      },
    },
    {
      dataField: 'itemName',
      caption: 'ชื่อสินค้า',
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return (
            <div className="flex items-center gap-2 text-gray-400">
              <Lock className="h-4 w-4" />
              <span className="italic">{line.placeholder || '[รายการลับ]'}</span>
            </div>
          );
        }
        return <span>{line.itemName}</span>;
      },
    },
    {
      dataField: 'itemType',
      caption: 'ประเภท',
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
      caption: 'จำนวน',
      width: 140,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        return <span>{formatNumber(line.quantity)} {line.unit}</span>;
      },
    },
    {
      dataField: 'unitCost',
      caption: 'ต้นทุนต่อหน่วย',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        const costInfo = bomCost?.breakdown?.find(b => b.itemId === line.itemId);
        return <span className="text-gray-600">{costInfo ? `${formatMoney(costInfo.unitCost)} THB` : '-'}</span>;
      },
    },
    {
      dataField: 'totalCost',
      caption: 'ต้นทุนรวม',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        const costInfo = bomCost?.breakdown?.find(b => b.itemId === line.itemId);
        return <span className="font-medium text-green-700">{costInfo ? `${formatMoney(costInfo.totalCost)} THB` : '-'}</span>;
      },
    },
    {
      dataField: 'isOptional',
      caption: 'ทางเลือก',
      width: 100,
      cellRender: (cellInfo) => {
        const line = cellInfo.data as BOMLine;
        if (line.isHidden) {
          return <span className="text-gray-400">-</span>;
        }
        return line.isOptional ?
          <Badge variant="warning">ไม่บังคับ</Badge> :
          <Badge variant="primary">จำเป็น</Badge>;
      },
    },
    {
      dataField: 'actions',
      caption: 'การดำเนินการ',
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
              hint="แก้ไข"
            />
            <DxButton
              icon="trash"
              type="danger"
              stylingMode="text"
              onClick={() => openDeleteLineDialog(line)}
              hint="ลบ"
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
        <p className="text-gray-500">ไม่พบ BOM</p>
        <DxButton
          text="กลับไปหน้ารายการ"
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
                text="กลับ"
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
                  title="คลิกเพื่อเปลี่ยนสถานะ"
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
                        เปลี่ยนสถานะ
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
              text="การตั้งค่า"
              icon="preferences"
              type="normal"
              stylingMode="outlined"
              onClick={() => router.push(`/production/bom/${bom.id}/configuration`)}
              hint="กำหนดห้อง อุปกรณ์ ขั้นตอน SOP และเกณฑ์ QC"
            />
            <DxButton
              text="สร้างใบสั่งผลิต"
              type="default"
              onClick={() => router.push(`/production/work-orders/new?bomId=${bom.id}`)}
            />
            <div className="relative" ref={actionsMenuRef}>
              <DxButton
                icon="overflow"
                type="normal"
                stylingMode="outlined"
                hint="การดำเนินการเพิ่มเติม"
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
                      แก้ไข BOM
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
                      คัดลอก BOM
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
                          ลบ BOM
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
          <Card className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">ขนาดชุดผลิต</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(bom.batchSize) || 0}</p>
                <p className="text-xs text-gray-500">{bom.batchUnit}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200 border-l-4 border-l-violet-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">ผลผลิตตามทฤษฎี</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(bom.theoreticalYield) || '-'}</p>
                <p className="text-xs text-gray-500">{bom.productUnit}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">เป้าหมายผลผลิต</p>
                <p className="text-2xl font-bold text-gray-900">{bom.yieldTarget || '-'}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">เผื่อการสูญเสีย</p>
                <p className="text-2xl font-bold text-gray-900">{bom.lossAllowance || '-'}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200 border-l-4 border-l-gray-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">วัตถุดิบ</p>
                <p className="text-2xl font-bold text-gray-900">{bom.lines?.length || 0}</p>
                <p className="text-xs text-gray-500">รายการ</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200 border-l-4 border-l-teal-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="h-4 w-4 text-teal-500" />
                  <p className="text-sm text-gray-500 font-medium">ต้นทุนวัตถุดิบ</p>
                </div>
                {loadingCost ? (
                  <div className="flex justify-center">
                    <DxLoadIndicator height={32} width={32} />
                  </div>
                ) : bomCost?.totalMaterialCost !== undefined ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatMoney(bomCost.totalMaterialCost)} {bomCost.currency}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatMoney(bomCost.costPerUnit) || '0'} {bomCost.currency}/{bom.batchUnit}
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
              <CardTitle>ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">รหัสสินค้า</dt>
                  <dd className="font-medium text-gray-900">{bom.productCode}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">ชื่อสินค้า</dt>
                  <dd className="font-medium text-gray-900">{bom.productName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">หน่วย</dt>
                  <dd className="font-medium text-gray-900">{bom.productUnit}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">เวอร์ชัน</dt>
                  <dd className="font-medium text-gray-900">{bom.version}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle>ระยะเวลาที่มีผลบังคับใช้</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">วันที่มีผลบังคับใช้</dt>
                  <dd className="font-medium text-gray-900">{formatDate(bom.effectiveDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">วันที่หมดอายุ</dt>
                  <dd className="font-medium text-gray-900">{formatDate(bom.expiryDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">สร้างเมื่อ</dt>
                  <dd className="font-medium text-gray-900">{formatDate(bom.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">อัปเดตเมื่อ</dt>
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
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-emerald-700'
                  }`}
                  data-testid="tab-materials"
                >
                  สูตรส่วนประกอบ (BOM)
                  {bom.confidentialityInfo?.hasConfidentialItems && (
                    <span title="มีรายการลับ">
                      <Lock className="inline-block ml-1.5 h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </button>
                {bom.confidentialityInfo?.userHasFullAccess && (
                  <button
                    onClick={() => setActiveTab('access')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'access'
                        ? 'border-emerald-500 text-emerald-700'
                        : 'border-transparent text-gray-500 hover:text-emerald-700'
                    }`}
                    data-testid="tab-access-control"
                  >
                    <Shield className="inline-block mr-1.5 h-4 w-4" />
                    การควบคุมการเข้าถึง
                  </button>
                )}
              </div>

              {/* Actions for Materials tab */}
              {activeTab === 'materials' && (
                <DxButton
                  text="เพิ่มวัตถุดิบ"
                  icon="plus"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => {
                    setNewLine({
                      itemId: 0,
                      itemCode: '',
                      itemName: '',
                      itemUnit: '',
                      unitOptions: [],
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
            {activeTab === 'materials' && bom.confidentialityInfo && (
              <ConfidentialityBanner
                confidentialityInfo={bom.confidentialityInfo}
                className="mt-4"
              />
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
                noDataText="ยังไม่มีวัตถุดิบใน BOM นี้"
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
        title="แก้ไข BOM"
        width={500}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500 mb-4">
            แก้ไขรายละเอียด BOM — ไม่สามารถแก้ไขรายการวัตถุดิบที่นี่ได้
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
            <DxTextBox
              value={editForm.name}
              onValueChange={(value) => setEditForm({ ...editForm, name: value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวอร์ชัน</label>
              <DxTextBox
                value={editForm.version}
                onValueChange={(value) => setEditForm({ ...editForm, version: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยชุดผลิต</label>
              <DxTextBox
                value={editForm.batchUnit}
                onValueChange={(value) => setEditForm({ ...editForm, batchUnit: value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ขนาดชุดผลิต</label>
              <DxNumberBox
                value={editForm.batchSize}
                onValueChange={(value) => setEditForm({ ...editForm, batchSize: value || 0 })}
                format="#,##0.###"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เป้าหมายผลผลิต (%)</label>
              <DxNumberBox
                value={editForm.yieldTarget}
                onValueChange={(value) => setEditForm({ ...editForm, yieldTarget: value || 0 })}
                format="#,##0.#"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เผื่อการสูญเสีย (%)</label>
              <DxNumberBox
                value={editForm.lossAllowance}
                onValueChange={(value) => setEditForm({ ...editForm, lossAllowance: value || 0 })}
                format="#,##0.#"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ผลผลิตตามทฤษฎี ({bom?.productUnit || 'หน่วย'})
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                น้ำหนักต่อหน่วยย่อย (mg/capsule)
              </label>
              <DxNumberBox
                value={editForm.fillWeightMg}
                onValueChange={(value) => setEditForm({ ...editForm, fillWeightMg: value || 0 })}
                format="#,##0.####"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                ใช้คำนวณ Bulk Yield จากน้ำหนักที่ชั่งได้ — เช่น 600 mg/capsule (API 500 + Excipient 100)
              </p>
            </div>
            <div>
              {/* Placeholder for grid balance — keep empty to preserve 2-column layout */}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่มีผลบังคับใช้</label>
              <DxDateBox
                value={editForm.effectiveDate}
                onValueChange={(value) => setEditForm({ ...editForm, effectiveDate: value || '' })}
                max={editForm.expiryDate || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่หมดอายุ</label>
              <DxDateBox
                value={editForm.expiryDate}
                onValueChange={(value) => setEditForm({ ...editForm, expiryDate: value || '' })}
                min={editForm.effectiveDate || undefined}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setEditDialogOpen(false)}
            />
            <DxButton
              text={saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
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
        title="ลบ BOM"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            คุณแน่ใจหรือไม่ว่าต้องการลบ BOM นี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            ลบได้เฉพาะ BOM ที่เป็นฉบับร่างเท่านั้น
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setDeleteDialogOpen(false)}
            />
            <DxButton
              text={deleting ? 'กำลังลบ...' : 'ลบ BOM'}
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
        title="เปลี่ยนสถานะ BOM"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนสถานะจาก &quot;{bom.status}&quot; เป็น &quot;{newStatus}&quot;?
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setStatusDialogOpen(false)}
            />
            <DxButton
              text={updatingStatus ? 'กำลังอัปเดต...' : 'ยืนยัน'}
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
        title="คัดลอก BOM"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-sm text-emerald-900 leading-relaxed">
            <p className="font-semibold mb-0.5">คัดลอก BOM นี้เป็นสูตรใหม่</p>
            <p className="text-xs text-emerald-800">
              จะสร้าง BOM ใหม่ที่มี<strong>วัตถุดิบและสูตรเหมือนต้นฉบับทุกอย่าง</strong> โดยตั้งสถานะเป็น
              <strong> ฉบับร่าง (draft)</strong> ให้แก้ไขต่อได้ — ต้นฉบับไม่ถูกแตะต้อง ใช้เมื่อต้องการทำเวอร์ชันใหม่หรือสูตรใกล้เคียง
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัส BOM ใหม่ *</label>
            <DxTextBox
              value={copyForm.newCode}
              onValueChange={(value) => setCopyForm({ ...copyForm, newCode: value })}
              placeholder="เช่น BOM-FG-0001-V2"
            />
            <p className="text-xs text-gray-500 mt-1">ต้องไม่ซ้ำกับรหัส BOM ที่มีอยู่</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เวอร์ชัน</label>
            <DxTextBox
              value={copyForm.newVersion}
              onValueChange={(value) => setCopyForm({ ...copyForm, newVersion: value })}
              placeholder="1.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ BOM</label>
            <DxTextBox
              value={copyForm.newName}
              onValueChange={(value) => setCopyForm({ ...copyForm, newName: value })}
              placeholder="ชื่อสูตรใหม่"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setCopyDialogOpen(false)}
            />
            <DxButton
              text={copying ? 'กำลังคัดลอก...' : 'คัดลอก BOM'}
              type="success"
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
        title="เพิ่มวัตถุดิบ"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            เพิ่มวัตถุดิบ/ส่วนผสมใหม่ลงใน BOM นี้
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วัตถุดิบ *</label>
            {newLine.itemId ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 border border-emerald-100 rounded-lg bg-emerald-50/60">
                  <p className="font-medium text-[#064E3B]">{newLine.itemCode}</p>
                  <p className="text-sm text-[#4B7163]">{newLine.itemName}</p>
                </div>
                <DxButton
                  text="เปลี่ยน"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setItemSearchOpen(true)}
                />
              </div>
            ) : (
              <DxButton
                text="เลือกวัตถุดิบ"
                type="normal"
                stylingMode="outlined"
                onClick={() => setItemSearchOpen(true)}
                width="100%"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#065F46] mb-1">จำนวน *</label>
              <DxNumberBox
                value={newLine.quantity}
                onValueChange={(value) => setNewLine({ ...newLine, quantity: value || 0 })}
                format="#,##0.###"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
              {newLine.unitOptions.length > 1 ? (
                <DxSelectBox
                  value={newLine.itemUnit}
                  onValueChange={(value) => setNewLine({ ...newLine, itemUnit: value })}
                  items={newLine.unitOptions.map(u => ({ value: u, label: u }))}
                  width="100%"
                />
              ) : (
                <DxTextBox
                  value={newLine.itemUnit}
                  readOnly
                />
              )}
            </div>
          </div>
          <div>
            <DxCheckBox
              value={newLine.isOptional}
              onValueChange={(value) => setNewLine({ ...newLine, isOptional: value })}
              text="วัตถุดิบทางเลือก"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <DxTextBox
              value={newLine.notes}
              onValueChange={(value) => setNewLine({ ...newLine, notes: value })}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setAddLineDialogOpen(false)}
            />
            <DxButton
              text={addingLine ? 'กำลังเพิ่ม...' : 'เพิ่มวัตถุดิบ'}
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
        title="เลือกวัตถุดิบ"
        showPrice="cost"
        excludeType="finished_goods"
        allowCreate
      />

      {/* Edit Line Dialog */}
      <DxPopup
        visible={editLineDialogOpen}
        onHiding={() => setEditLineDialogOpen(false)}
        title="แก้ไขวัตถุดิบ"
        width={450}
        height="auto"
        showCloseButton
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-500">
            แก้ไขจำนวนหรือการตั้งค่าสำหรับ {editingLine?.itemCode}
          </p>
          <div className="p-3 border rounded bg-gray-50">
            <p className="font-medium">{editingLine?.itemCode}</p>
            <p className="text-sm text-gray-500">{editingLine?.itemName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#065F46] mb-1">จำนวน *</label>
              <DxNumberBox
                value={editLineForm.quantity}
                onValueChange={(value) => setEditLineForm({ ...editLineForm, quantity: value || 0 })}
                format="#,##0.###"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
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
              text="วัตถุดิบทางเลือก"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <DxTextBox
              value={editLineForm.notes}
              onValueChange={(value) => setEditLineForm({ ...editLineForm, notes: value })}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setEditLineDialogOpen(false)}
            />
            <DxButton
              text={savingLine ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
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
        title="นำวัตถุดิบออก"
        width={400}
        height="auto"
        showCloseButton
      >
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            คุณแน่ใจหรือไม่ว่าต้องการนำ {lineToDelete?.itemCode} ({lineToDelete?.itemName}) ออกจาก BOM นี้?
          </p>
          <div className="flex justify-end gap-2">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setDeleteLineDialogOpen(false)}
            />
            <DxButton
              text={deletingLine ? 'กำลังนำออก...' : 'นำวัตถุดิบออก'}
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
