'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DocumentAttachment } from '@/components/ui/document-attachment';

interface LotDetail {
  id: number;
  lotNumber: string;
  batchNumber: string | null;
  itemId: number;
  warehouseId: number;
  locationId: number | null;
  quantity: number;
  reservedQuantity: number;
  unit: string;
  status: string;
  qcDisposition: string | null;
  qcDispositionReason: string | null;
  countedQuantity: number | null;
  countVarianceReason: string | null;
  cost: number | null;
  vendorLotNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  vendorId: number | null;
  poNumber: string | null;
  coaNumber: string | null;
  createdAt: string;
  updatedAt: string;
  itemCode: string;
  itemNameTh: string;
  itemNameEn: string;
  itemType: string;
  itemCategory: string;
  warehouseName: string;
  warehouseCode: string;
  vendor: {
    id: number;
    code: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
  } | null;
  transactions: Array<{
    id: number;
    transactionType: string;
    quantity: number;
    unit: string;
    referenceType: string | null;
    referenceNumber: string | null;
    reason: string | null;
    performedBy: number | null;
    performedByName: string | null;
    createdAt: string;
  }>;
  qcTests: Array<{
    id: number;
    sampleNumber: string | null;
    testType: string;
    status: string;
    result: string | null;
    testedBy: number | null;
    testedByName: string | null;
    testDate: string | null;
    createdAt: string;
  }>;
  qcSamples: Array<{
    id: number;
    sampleNumber: string;
    sourceType: string;
    status: string;
    lotNumber: string | null;
    receivedDate: string | null;
    receivedByName: string | null;
    flagForQcManager: boolean;
    notes: string | null;
    testTotal: number;
    testPass: number;
    testFail: number;
    testPending: number;
  }>;
  relatedWorkOrders: Array<{
    id: number;
    woNumber: string;
    productId: number;
    status: string;
    plannedQuantity: number;
    actualQuantity: number | null;
    plannedStartDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
  }>;
  daysUntilExpiry: number | null;
  expiryStatus: string;
  availableQuantity: number;
}

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('inventory');
  const [lot, setLot] = useState<LotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'documents' | 'transactions' | 'qc' | 'traceability'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    batchNumber: '',
    vendorLotNumber: '',
    quantity: 0,
    cost: 0,
    manufacturingDate: '',
    expiryDate: '',
    coaNumber: '',
  });
  const [statusLoading, setStatusLoading] = useState(false);
  // QC Flow item 6: two-step release state
  const [actionError, setActionError] = useState('');
  const [showReleasePanel, setShowReleasePanel] = useState(false);
  const [countedQty, setCountedQty] = useState<number | null>(null);
  const [varianceReason, setVarianceReason] = useState('');

  useEffect(() => {
    fetchLotDetail();
  }, [params.id]);

  const fetchLotDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/inventory/lots/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setLot(data.data);
        setEditForm({
          batchNumber: data.data.batchNumber || '',
          vendorLotNumber: data.data.vendorLotNumber || '',
          quantity: Number(data.data.quantity) || 0,
          cost: Number(data.data.cost) || 0,
          manufacturingDate: data.data.manufacturingDate || '',
          expiryDate: data.data.expiryDate || '',
          coaNumber: data.data.coaNumber || '',
        });
      } else {
        setError(data.error || 'Failed to fetch lot detail');
      }
    } catch (err) {
      setError('Failed to fetch lot detail');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lot) return;

    try {
      setStatusLoading(true);
      const response = await fetch(`/api/inventory/lots/${lot.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (data.success) {
        fetchLotDetail();
      }
    } catch {
      // Network errors handled by global error handler
    } finally {
      setStatusLoading(false);
    }
  };

  // QC Flow item 6 — Step 1: QC quality disposition
  const handleQcDisposition = async (decision: 'approved' | 'rejected') => {
    if (!lot) return;
    setActionError('');
    let reason: string | undefined;
    if (decision === 'rejected') {
      reason = window.prompt('ระบุเหตุผลการปฏิเสธคุณภาพ (QC):') || undefined;
      if (!reason) return;
    }
    try {
      setStatusLoading(true);
      const response = await fetch(`/api/inventory/lots/${lot.id}/qc-disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await response.json();
      if (data.success) {
        fetchLotDetail();
      } else {
        setActionError(data.error || 'ไม่สามารถบันทึกการตัดสินคุณภาพได้');
      }
    } catch {
      setActionError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setStatusLoading(false);
    }
  };

  // QC Flow item 6 — Step 2: Warehouse physical count + release
  const handleReleaseWithCount = async () => {
    if (!lot) return;
    setActionError('');
    if (countedQty === null || Number.isNaN(countedQty) || countedQty < 0) {
      setActionError('กรุณากรอกจำนวนที่นับจริง');
      return;
    }
    const variance = countedQty - Number(lot.quantity);
    if (variance !== 0 && !varianceReason.trim()) {
      setActionError(`จำนวนที่นับจริง (${countedQty}) ไม่ตรงกับระบบ (${Number(lot.quantity)}) — กรุณาระบุเหตุผลของส่วนต่าง`);
      return;
    }
    try {
      setStatusLoading(true);
      const response = await fetch(`/api/inventory/lots/${lot.id}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedQuantity: countedQty, varianceReason }),
      });
      const data = await response.json();
      if (data.success) {
        setShowReleasePanel(false);
        setCountedQty(null);
        setVarianceReason('');
        fetchLotDetail();
      } else {
        setActionError(data.error || 'ไม่สามารถปล่อยเข้าคลังได้');
      }
    } catch {
      setActionError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lot) return;

    try {
      const response = await fetch(`/api/inventory/lots/${lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (data.success) {
        setIsEditing(false);
        fetchLotDetail();
      }
    } catch {
      // Network errors handled by global error handler
    }
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'released': return 'success';
      case 'quarantine': return 'warning';
      case 'under_test': return 'warning';
      case 'rejected': return 'danger';
      case 'blocked': return 'danger';
      default: return 'default';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'receive': 'รับเข้า',
      'issue': 'เบิกออก',
      'transfer': 'โอนย้าย',
      'adjust': 'ปรับยอด',
      'scrap': 'ตัดทิ้ง',
      'return': 'คืน',
    };
    return labels[type] || type;
  };

  const getQcStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'passed': return 'success';
      case 'failed': return 'danger';
      case 'pending': return 'warning';
      case 'in_progress': return 'warning';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Transaction table columns
  const transactionColumns: DxDataGridColumn[] = [
    {
      dataField: 'createdAt',
      caption: 'วันที่/เวลา',
      width: 160,
      cellRender: (cellInfo) => formatDateTime(cellInfo.data.createdAt)
    },
    {
      dataField: 'transactionType',
      caption: 'ประเภท',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={
          cellInfo.data.transactionType === 'receive' || cellInfo.data.transactionType === 'return' ? 'success' :
          cellInfo.data.transactionType === 'issue' || cellInfo.data.transactionType === 'scrap' ? 'danger' :
          'default'
        }>
          {getTransactionTypeLabel(cellInfo.data.transactionType)}
        </Badge>
      )
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 130,
      cellRender: (cellInfo) => (
        <span className={
          cellInfo.data.transactionType === 'receive' || cellInfo.data.transactionType === 'return' ? 'text-green-600' :
          cellInfo.data.transactionType === 'issue' || cellInfo.data.transactionType === 'scrap' ? 'text-red-600' : ''
        }>
          {cellInfo.data.transactionType === 'receive' || cellInfo.data.transactionType === 'return' ? '+' : '-'}
          {cellInfo.data.quantity.toLocaleString()} {cellInfo.data.unit}
        </span>
      )
    },
    {
      dataField: 'referenceNumber',
      caption: 'อ้างอิง',
      cellRender: (cellInfo) => cellInfo.data.referenceType && cellInfo.data.referenceNumber ? (
        <span className="text-emerald-600">{cellInfo.data.referenceType}: {cellInfo.data.referenceNumber}</span>
      ) : '-'
    },
    { dataField: 'reason', caption: 'เหตุผล', cellRender: (cellInfo) => cellInfo.data.reason || '-' },
    { dataField: 'performedByName', caption: 'ดำเนินการโดย', width: 130, cellRender: (cellInfo) => cellInfo.data.performedByName || '-' },
  ];

  // QC tests table columns
  const qcTestColumns: DxDataGridColumn[] = [
    { dataField: 'testName', caption: 'ชื่อการทดสอบ', width: 160, cellRender: (cellInfo) => <span className="font-medium">{cellInfo.data.testName || cellInfo.data.sampleNumber || '-'}</span> },
    { dataField: 'testType', caption: 'ประเภท', width: 100, cellRender: (cellInfo) => {
      const typeLabels: Record<string, string> = { incoming: 'รับเข้า', in_process: 'ระหว่างผลิต', final: 'ขั้นสุดท้าย' };
      return <span className="text-xs">{typeLabels[cellInfo.data.testType] || cellInfo.data.testType}</span>;
    }},
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 90,
      cellRender: (cellInfo) => <Badge variant={getQcStatusVariant(cellInfo.data.status)}>{cellInfo.data.status}</Badge>
    },
    { dataField: 'numericResult', caption: 'ผลลัพธ์', width: 120, cellRender: (cellInfo) => {
      const d = cellInfo.data;
      if (d.numericResult != null) {
        return <span className="font-medium">{Number(d.numericResult).toFixed(2)}{d.specUnit ? ` ${d.specUnit}` : ''}</span>;
      }
      return <span>{d.result || '-'}</span>;
    }},
    { dataField: 'specMinValue', caption: 'ช่วงข้อกำหนด', width: 130, cellRender: (cellInfo) => {
      const d = cellInfo.data;
      if (d.specMinValue != null && d.specMaxValue != null) {
        return <span className="text-xs text-gray-600">{Number(d.specMinValue).toFixed(2)} - {Number(d.specMaxValue).toFixed(2)}{d.specUnit ? ` ${d.specUnit}` : ''}</span>;
      }
      if (d.specSpecification) return <span className="text-xs text-gray-600">{d.specSpecification}</span>;
      return <span className="text-gray-400">-</span>;
    }},
    { dataField: 'disposition', caption: 'การจัดการ', width: 110, cellRender: (cellInfo) => {
      const d = cellInfo.data.disposition;
      if (!d) return <span className="text-gray-400">-</span>;
      const colors: Record<string, string> = { accept: 'bg-green-100 text-green-800', reject: 'bg-red-100 text-red-800', rework: 'bg-amber-100 text-amber-800', pending: 'bg-gray-100 text-gray-600' };
      return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[d] || 'bg-gray-100 text-gray-600'}`}>{d}</span>;
    }},
    { dataField: 'testedByName', caption: 'ทดสอบโดย', width: 120, cellRender: (cellInfo) => cellInfo.data.testedByName || '-' },
    { dataField: 'approvedByName', caption: 'อนุมัติโดย', width: 120, cellRender: (cellInfo) => cellInfo.data.approvedByName || '-' },
    { dataField: 'testDate', caption: 'วันที่ทดสอบ', width: 110, cellRender: (cellInfo) => formatDate(cellInfo.data.testDate) },
    { dataField: 'notes', caption: 'หมายเหตุ', cellRender: (cellInfo) => cellInfo.data.notes ? <span className="text-xs text-gray-600 truncate block max-w-[200px]" title={cellInfo.data.notes}>{cellInfo.data.notes}</span> : '-' },
  ];

  // Work orders table columns
  const workOrderColumns: DxDataGridColumn[] = [
    {
      dataField: 'woNumber',
      caption: 'เลขที่ใบสั่งผลิต',
      cellRender: (cellInfo) => <span className="font-medium text-emerald-600 cursor-pointer hover:underline">{cellInfo.data.woNumber}</span>
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: (cellInfo) => (
        <Badge variant={
          cellInfo.data.status === 'completed' ? 'success' :
          cellInfo.data.status === 'in_progress' ? 'warning' :
          'default'
        }>{cellInfo.data.status}</Badge>
      )
    },
    { dataField: 'plannedQuantity', caption: 'จำนวนตามแผน', width: 120, cellRender: (cellInfo) => cellInfo.data.plannedQuantity?.toLocaleString() || '-' },
    { dataField: 'actualQuantity', caption: 'จำนวนจริง', width: 120, cellRender: (cellInfo) => cellInfo.data.actualQuantity?.toLocaleString() || '-' },
    { dataField: 'startDate', caption: 'วันที่เริ่ม', width: 130, cellRender: (cellInfo) => formatDate(cellInfo.data.actualStartDate || cellInfo.data.plannedStartDate) },
    { dataField: 'actualEndDate', caption: 'วันที่เสร็จ', width: 140, cellRender: (cellInfo) => formatDate(cellInfo.data.actualEndDate) },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (error || !lot) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-red-500 mb-4">{error || 'ไม่พบล็อต'}</p>
          <DxButton
            text="กลับไปหน้ารายการล็อต"
            type="default"
            onClick={() => router.push('/inventory/lots')}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DxButton
                text="กลับ"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/inventory/lots')}
              />
              <h1 className="text-2xl font-bold text-gray-900">{t('lots.detail.pageTitle')}: {lot.lotNumber}</h1>
              <Badge variant={getStatusVariant(lot.status)}>{lot.status}</Badge>
            </div>
            <p className="text-gray-500 mt-1">รายละเอียดสินค้าคงคลังตามล็อต/แบตช์</p>
          </div>
          <div className="flex gap-2">
            {/* QC Flow item 6 — Step 1: QC quality disposition (role: QC) */}
            {(lot.status === 'quarantine' || lot.status === 'under_test') &&
              lot.qcDisposition !== 'approved' && (
                <>
                  <DxButton
                    text="QC: อนุมัติคุณภาพ"
                    icon="check"
                    type="success"
                    data-testid="qc-approve-btn"
                    onClick={() => handleQcDisposition('approved')}
                    disabled={statusLoading}
                  />
                  <DxButton
                    text="QC: ปฏิเสธ"
                    icon="close"
                    type="danger"
                    data-testid="qc-reject-btn"
                    onClick={() => handleQcDisposition('rejected')}
                    disabled={statusLoading}
                  />
                </>
              )}
            {/* QC Flow item 6 — Step 2: Warehouse count + release (role: คลัง) */}
            {(lot.status === 'quarantine' || lot.status === 'under_test') &&
              lot.qcDisposition === 'approved' && (
                <DxButton
                  text="ฝ่ายคลัง: ตรวจนับ & ปล่อยเข้าคลัง"
                  icon="check"
                  type="success"
                  data-testid="warehouse-release-btn"
                  onClick={() => {
                    setActionError('');
                    setCountedQty(Number(lot.quantity));
                    setShowReleasePanel((v) => !v);
                  }}
                  disabled={statusLoading}
                />
              )}
            {lot.status === 'released' && (
              <DxButton
                text="ระงับการใช้งาน"
                type="normal"
                stylingMode="outlined"
                onClick={() => handleStatusChange('blocked')}
                disabled={statusLoading}
              />
            )}
            {lot.status === 'blocked' && (
              <DxButton
                text="ยกเลิกการระงับ"
                type="success"
                onClick={() => handleStatusChange('released')}
                disabled={statusLoading}
              />
            )}
          </div>
        </div>

        {/* QC Flow item 6 — release workflow status + panel */}
        {actionError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="lot-action-error">
            {actionError}
          </div>
        )}
        {(lot.status === 'quarantine' || lot.status === 'under_test') && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">ขั้นตอนการปล่อยเข้าคลัง (GMP): </span>
            {lot.qcDisposition === 'approved' ? (
              <>1) QC อนุมัติคุณภาพแล้ว ✓ &nbsp;→&nbsp; 2) รอฝ่ายคลังตรวจนับจำนวนจริงแล้วกดปล่อยเข้าคลัง</>
            ) : (
              <>1) รอ QC อนุมัติคุณภาพก่อน &nbsp;→&nbsp; 2) ฝ่ายคลังตรวจนับจำนวนจริงแล้วปล่อยเข้าคลัง</>
            )}
          </div>
        )}
        {showReleasePanel && lot.qcDisposition === 'approved' && (
          <Card className="border-green-300">
            <CardHeader>
              <CardTitle>ฝ่ายคลัง: ตรวจนับจำนวนจริงก่อนปล่อยเข้าคลัง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">จำนวนในระบบ</label>
                  <p className="font-medium">{Number(lot.quantity).toLocaleString()} {lot.unit}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">จำนวนที่นับจริง *</label>
                  <input
                    type="number"
                    data-testid="counted-qty-input"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    value={countedQty ?? ''}
                    onChange={(e) => setCountedQty(e.target.value === '' ? null : parseFloat(e.target.value))}
                    min="0"
                    step="0.001"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">
                    เหตุผลส่วนต่าง {countedQty !== null && countedQty !== Number(lot.quantity) ? '*' : '(ถ้ามี)'}
                  </label>
                  <DxTextBox
                    value={varianceReason}
                    onValueChange={(value) => setVarianceReason(value)}
                  />
                </div>
              </div>
              {countedQty !== null && countedQty !== Number(lot.quantity) && (
                <p className="mt-2 text-sm text-amber-700">
                  ส่วนต่าง: {(countedQty - Number(lot.quantity)).toLocaleString()} {lot.unit} — ระบบจะปรับยอดตามจำนวนที่นับจริงและบันทึกรายการปรับยอด
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <DxButton
                  text="ยืนยันปล่อยเข้าคลัง"
                  type="success"
                  data-testid="confirm-release-btn"
                  onClick={handleReleaseWithCount}
                  disabled={statusLoading}
                />
                <DxButton
                  text="ยกเลิก"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => { setShowReleasePanel(false); setActionError(''); }}
                  disabled={statusLoading}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">จำนวนทั้งหมด</p>
                  <p className="text-2xl font-bold text-gray-900">{lot.quantity.toLocaleString()} {lot.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 border-l-4 border-l-emerald-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">พร้อมใช้งาน</p>
                  <p className="text-2xl font-bold text-gray-900">{lot.availableQuantity.toLocaleString()} {lot.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">จองไว้</p>
                  <p className="text-2xl font-bold text-gray-900">{lot.reservedQuantity.toLocaleString()} {lot.unit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 border-l-4 border-l-violet-500 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">ต้นทุนรวม</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ฿{((lot.quantity || 0) * (lot.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {lot.cost && lot.cost > 0 && (
                    <p className="text-xs text-gray-500">@฿{lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}/{lot.unit}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white border border-gray-200 border-l-4 rounded-[14px] shadow-[0_6px_20px_rgba(6,78,59,0.06)] ${
            lot.expiryStatus === 'expired' || lot.expiryStatus === 'critical' ? 'border-l-rose-500' :
            lot.expiryStatus === 'warning' ? 'border-l-amber-500' :
            'border-l-gray-500'
          }`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <svg className={`w-6 h-6 ${
                  lot.expiryStatus === 'expired' || lot.expiryStatus === 'critical' ? 'text-rose-500' :
                  lot.expiryStatus === 'warning' ? 'text-amber-500' : 'text-gray-500'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm text-gray-500">จำนวนวันก่อนหมดอายุ</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {lot.daysUntilExpiry !== null ? (
                      lot.daysUntilExpiry < 0 ? `หมดอายุแล้ว ${Math.abs(lot.daysUntilExpiry)} วัน` : `${lot.daysUntilExpiry} วัน`
                    ) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'info', label: 'ข้อมูลล็อต' },
              { id: 'documents', label: 'เอกสาร' },
              { id: 'transactions', label: 'ประวัติการเคลื่อนไหว' },
              { id: 'qc', label: 'การทดสอบ QC' },
              { id: 'traceability', label: 'การสอบกลับ' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Item Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>ข้อมูลสินค้า</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">รหัสสินค้า</label>
                      <p className="font-medium">{lot.itemCode}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">ประเภท</label>
                      <p className="font-medium">{lot.itemType}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">ชื่อสินค้า (ไทย)</label>
                    <p className="font-medium">{lot.itemNameTh}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">ชื่อสินค้า (อังกฤษ)</label>
                    <p className="font-medium">{lot.itemNameEn}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">หมวดหมู่</label>
                      <p className="font-medium">{lot.itemCategory || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">หน่วย</label>
                      <p className="font-medium">{lot.unit}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lot Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>รายละเอียดล็อต</CardTitle>
                {!isEditing ? (
                  <DxButton
                    text="แก้ไข"
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setIsEditing(true)}
                  />
                ) : (
                  <div className="flex gap-2">
                    <DxButton
                      text="ยกเลิก"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setIsEditing(false)}
                    />
                    <DxButton
                      text="บันทึก"
                      type="success"
                      onClick={handleSave}
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">หมายเลขล็อต</label>
                      <p className="font-medium">{lot.lotNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">หมายเลขล็อตของผู้ขาย</label>
                      {isEditing ? (
                        <DxTextBox
                          value={editForm.vendorLotNumber}
                          onValueChange={(value) => setEditForm({ ...editForm, vendorLotNumber: value })}
                        />
                      ) : (
                        <p className="font-medium">{lot.vendorLotNumber || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">หมายเลขแบตช์</label>
                      {isEditing ? (
                        <DxTextBox
                          value={editForm.batchNumber}
                          onValueChange={(value) => setEditForm({ ...editForm, batchNumber: value })}
                        />
                      ) : (
                        <p className="font-medium">{lot.batchNumber || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">หมายเลข COA</label>
                      {isEditing ? (
                        <DxTextBox
                          value={editForm.coaNumber}
                          onValueChange={(value) => setEditForm({ ...editForm, coaNumber: value })}
                        />
                      ) : (
                        <p className="font-medium">{lot.coaNumber || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">จำนวน</label>
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          value={editForm.quantity || ''}
                          onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.001"
                        />
                      ) : (
                        <p className="font-medium">{Number(lot.quantity).toLocaleString()} {lot.unit}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">หน่วย</label>
                      <p className="font-medium">{lot.unit}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">ต้นทุนต่อหน่วย</label>
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          value={editForm.cost || ''}
                          onChange={(e) => setEditForm({ ...editForm, cost: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      ) : (
                        <p className="font-medium">
                          {lot.cost && Number(lot.cost) > 0
                            ? `฿${Number(lot.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : '-'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">วันที่ผลิต</label>
                      {isEditing ? (
                        <DxDateBox
                          value={editForm.manufacturingDate}
                          onValueChange={(value) => setEditForm({ ...editForm, manufacturingDate: value || '' })}
                          max={editForm.expiryDate ? new Date(editForm.expiryDate) : undefined}
                        />
                      ) : (
                        <p className="font-medium">{formatDate(lot.manufacturingDate)}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">วันที่หมดอายุ</label>
                      {isEditing ? (
                        <DxDateBox
                          value={editForm.expiryDate}
                          onValueChange={(value) => setEditForm({ ...editForm, expiryDate: value || '' })}
                          min={editForm.manufacturingDate ? new Date(editForm.manufacturingDate) : undefined}
                        />
                      ) : (
                        <p className="font-medium">{formatDate(lot.expiryDate)}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">วันที่รับเข้า</label>
                      <p className="font-medium">{formatDate(lot.receivedDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">เลขที่ใบสั่งซื้อ</label>
                      <p className="font-medium">{lot.poNumber || '-'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Location */}
            <Card>
              <CardHeader>
                <CardTitle>สถานที่จัดเก็บ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">รหัสคลัง</label>
                      <p className="font-medium">{lot.warehouseCode}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">ชื่อคลัง</label>
                      <p className="font-medium">{lot.warehouseName}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vendor Information */}
            <Card>
              <CardHeader>
                <CardTitle>ข้อมูลผู้ขาย</CardTitle>
              </CardHeader>
              <CardContent>
                {lot.vendor ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">รหัสผู้ขาย</label>
                        <p className="font-medium">{lot.vendor.code}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">ชื่อผู้ขาย</label>
                        <p className="font-medium">{lot.vendor.name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">ผู้ติดต่อ</label>
                        <p className="font-medium">{lot.vendor.contactPerson || '-'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">โทรศัพท์</label>
                        <p className="font-medium">{lot.vendor.phone || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">อีเมล</label>
                      <p className="font-medium">{lot.vendor.email || '-'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">ไม่มีข้อมูลผู้ขาย</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* FR-057: COA/MSDS Document Attachments */}
            <DocumentAttachment
              moduleName="inventory_lot"
              entityId={lot.id}
              title="เอกสารแนบ (COA, MSDS, Specification)"
              categories={['coa', 'msds', 'specification', 'certificate', 'lab_result', 'photo', 'other']}
              showPreview
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <CardTitle>ประวัติการเคลื่อนไหว</CardTitle>
            </CardHeader>
            <CardContent>
              <DxDataGrid
                dataSource={lot.transactions}
                keyExpr="id"
                columns={transactionColumns}
                showBorders
                height={400}
                noDataText="ไม่พบรายการเคลื่อนไหว"
              />
            </CardContent>
          </Card>
        )}

        {activeTab === 'qc' && (
          <div className="space-y-6">
            {/* Primary: LIMS QC samples (QC Entry) linked to this lot */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>QC (ระบบ QC Entry)</CardTitle>
                  <p className="text-sm text-gray-500">ตัวอย่าง QC ที่ผูกกับ lot นี้ — คลิกหมายเลขตัวอย่างเพื่อเปิดใน QC Entry</p>
                </div>
                <DxButton
                  text="บันทึก QC (QC Entry)"
                  icon="plus"
                  type="default"
                  onClick={() =>
                    router.push(
                      `/quality/qc-entry/new?sourceLotId=${lot.id}&productId=${lot.itemId}&lotNumber=${encodeURIComponent(lot.lotNumber)}`,
                    )
                  }
                />
              </CardHeader>
              <CardContent>
                <DxDataGrid
                  dataSource={lot.qcSamples}
                  keyExpr="id"
                  showBorders
                  height={320}
                  noDataText="ยังไม่มีตัวอย่าง QC สำหรับ lot นี้ (สร้างจากปุ่มด้านบน หรือระบบจะสร้างให้อัตโนมัติเมื่อรับของผ่าน GRN)"
                  columns={[
                    {
                      dataField: 'sampleNumber',
                      caption: 'หมายเลขตัวอย่าง',
                      width: 160,
                      cellRender: (c) => (
                        <span
                          className="font-medium text-emerald-600 cursor-pointer hover:underline"
                          onClick={() => router.push(`/quality/qc-entry/${c.data.id}`)}
                        >
                          {c.data.sampleNumber}
                        </span>
                      ),
                    },
                    {
                      dataField: 'sourceType',
                      caption: 'แหล่งที่มา',
                      width: 130,
                      cellRender: (c) => {
                        const m: Record<string, string> = {
                          raw_material_lot: 'วัตถุดิบ',
                          work_order_batch: 'ผลิต (WO)',
                          customer_return: 'รับคืน',
                          purchased_herb: 'สมุนไพรซื้อ',
                          outgoing_shipment: 'ส่งออก',
                          stability: 'Stability',
                        };
                        return <span className="text-xs">{m[c.data.sourceType] || c.data.sourceType}</span>;
                      },
                    },
                    {
                      dataField: 'status',
                      caption: 'สถานะ',
                      width: 110,
                      cellRender: (c) => <Badge variant={getQcStatusVariant(c.data.status)}>{c.data.status}</Badge>,
                    },
                    {
                      caption: 'ผลทดสอบ',
                      width: 150,
                      cellRender: (c) => {
                        const d = c.data;
                        if (!d.testTotal) return <span className="text-gray-400">ยังไม่มีรายการ</span>;
                        return (
                          <span className="text-sm">
                            <span className="text-green-600">{d.testPass} ผ่าน</span>
                            {d.testFail > 0 && <span className="text-red-600"> / {d.testFail} ไม่ผ่าน</span>}
                            {d.testPending > 0 && <span className="text-amber-600"> / {d.testPending} รอ</span>}
                            <span className="text-gray-400"> (จาก {d.testTotal})</span>
                          </span>
                        );
                      },
                    },
                    {
                      dataField: 'receivedDate',
                      caption: 'วันที่รับ',
                      width: 110,
                      cellRender: (c) => formatDate(c.data.receivedDate),
                    },
                    {
                      dataField: 'receivedByName',
                      caption: 'ผู้รับ',
                      width: 130,
                      cellRender: (c) => c.data.receivedByName || '-',
                    },
                    {
                      dataField: 'flagForQcManager',
                      caption: 'แจ้ง QC',
                      width: 90,
                      cellRender: (c) =>
                        c.data.flagForQcManager ? (
                          <span className="text-amber-600 text-xs font-medium">ต้องตรวจ</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        ),
                    },
                  ]}
                />
              </CardContent>
            </Card>

            {/* Legacy quality_tests — shown only when present */}
            {lot.qcTests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>QC Tests (ระบบเดิม)</CardTitle>
                </CardHeader>
                <CardContent>
                  <DxDataGrid
                    dataSource={lot.qcTests}
                    keyExpr="id"
                    columns={qcTestColumns}
                    showBorders
                    height={280}
                    noDataText="ไม่พบการทดสอบ QC"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'traceability' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>การสอบกลับไปข้างหน้า</CardTitle>
                <p className="text-sm text-gray-500">ใบสั่งผลิตและสินค้าสำเร็จรูปที่ใช้ล็อตนี้</p>
              </CardHeader>
              <CardContent>
                <DxDataGrid
                  dataSource={lot.relatedWorkOrders}
                  keyExpr="id"
                  columns={workOrderColumns}
                  showBorders
                  height={300}
                  noDataText="ไม่พบใบสั่งผลิตที่เกี่ยวข้อง"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>การสอบกลับย้อนหลัง</CardTitle>
                <p className="text-sm text-gray-500">วัตถุดิบต้นทางและผู้ขายสำหรับล็อตนี้</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-100 rounded-full">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">ผู้ขาย: {lot.vendor?.name || 'ไม่ทราบ'}</p>
                        <p className="text-sm text-gray-500">ใบสั่งซื้อ: {lot.poNumber || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-full">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">COA: {lot.coaNumber || 'ไม่มี'}</p>
                        <p className="text-sm text-gray-500">ใบรับรองผลการวิเคราะห์</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Information */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>สร้างเมื่อ: {formatDateTime(lot.createdAt)}</span>
              <span>อัปเดตล่าสุด: {formatDateTime(lot.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
