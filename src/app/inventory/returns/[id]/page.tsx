'use client';

/**
 * Material Return Detail (Phase 4)
 *
 * Warehouse staff lands here to inspect a return before approving/rejecting.
 * Mirrors design §6.2:
 *   - Source/Receipt info card (header)
 *   - Lines table (Item / Source Lot / Issued / Used / Return / Variance ...)
 *   - Approve / Reject (only when status='submitted')
 *     - Approve → confirmation prompt → POST {action:'approve'}
 *     - Reject  → DxPopup with required reason → POST {action:'reject', reason}
 *   - After approval: show created lot numbers + deviation links
 *   - Print summary (window.print)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup, DxConfirmDialog } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowDownToLine,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface ReturnDetailLine {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  sourceLot: {
    id: number;
    lotNumber: string;
    quantityRemaining: number;
    warehouseId: number;
    expiryDate: string | null;
  } | null;
  returnedLot: {
    id: number;
    lotNumber: string;
    status: string;
    quantity: number;
  } | null;
  issuedQty: number;
  issuedUnit: string;
  usedQty: number;
  usedUnit: string;
  returnQty: number;
  returnUnit: string;
  expectedVarianceQty: number | null;
  varianceQty: number;
  variancePct: number;
  varianceReason: string;
  varianceExplanation: string | null;
  isOutsideTolerance: boolean;
  returnContainerLabel: string | null;
  returnContainerType: string | null;
  notes: string | null;
  deviation: {
    id: number;
    deviationNumber: string;
    severity: string;
    status: string;
  } | null;
}

interface ReturnDetail {
  id: number;
  returnNumber: string;
  workOrderId: number | null;
  woNumber: string | null;
  receivingWarehouseId: number;
  warehouseName: string | null;
  status: string;
  returnDate: string;
  returnedBy: number;
  returnedByName: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ReturnDetailLine[];
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

function statusInfo(status: string) {
  switch (status) {
    case 'submitted':
      return { variant: 'warning' as const, label: 'รออนุมัติ' };
    case 'received':
      return { variant: 'success' as const, label: 'อนุมัติแล้ว' };
    case 'rejected':
      return { variant: 'danger' as const, label: 'ปฏิเสธ' };
    default:
      return { variant: 'default' as const, label: status };
  }
}

export default function MaterialReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const returnId = Number(params.id);
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!Number.isFinite(returnId)) {
      setError('Invalid return ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load return detail');
        setDetail(null);
      } else {
        setDetail(data.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('อนุมัติไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        const newLotCount = data.data?.newLots?.length ?? 0;
        const devCount = data.data?.deviationsCreated?.length ?? 0;
        toast.success(
          'อนุมัติสำเร็จ',
          `สร้าง lot ใหม่ ${newLotCount} รายการ${devCount > 0 ? ` · เปิด deviation ${devCount} รายการ` : ''}`,
        );
        await fetchDetail();
      }
    } catch (e) {
      toast.error('อนุมัติไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    } finally {
      setApproving(false);
      setShowApproveConfirm(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('กรุณาระบุเหตุผล', 'เหตุผลในการปฏิเสธจำเป็นต้องระบุ');
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/inventory/returns/${returnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('ปฏิเสธไม่สำเร็จ', data.error || 'Unknown error');
      } else {
        toast.success('ปฏิเสธสำเร็จ', 'รายการคืนถูกปฏิเสธแล้ว');
        setShowRejectDialog(false);
        setRejectReason('');
        await fetchDetail();
      }
    } catch (e) {
      toast.error('ปฏิเสธไม่สำเร็จ', e instanceof Error ? e.message : 'Network error');
    } finally {
      setRejecting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <DxLoadIndicator />
        </div>
      </MainLayout>
    );
  }

  if (error || !detail) {
    return (
      <MainLayout>
        <div className="flex flex-col gap-5 p-4 md:p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-red-800">ไม่สามารถโหลดข้อมูลได้</p>
              <p className="text-sm text-red-700">{error || 'Material return not found'}</p>
            </div>
            <DxButton
              text="กลับ"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/inventory/returns')}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  const sInfo = statusInfo(detail.status);
  const canAct = detail.status === 'submitted';

  // Aggregate created lots/deviations across lines for the post-approval banner.
  const createdLots = detail.lines.filter((l) => l.returnedLot).map((l) => l.returnedLot!);
  const linkedDeviations = detail.lines.filter((l) => l.deviation).map((l) => l.deviation!);

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'วัตถุดิบ',
      minWidth: 200,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs text-gray-500">{cell.data.itemCode}</p>
          <p className="font-medium text-gray-900">{cell.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'sourceLot.lotNumber',
      caption: 'Source Lot',
      width: 160,
      cellRender: (cell) =>
        cell.data.sourceLot ? (
          <span className="font-mono text-sm">{cell.data.sourceLot.lotNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      dataField: 'issuedQty',
      caption: 'Issued',
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span>
          {Number(cell.data.issuedQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-xs text-gray-500">{cell.data.issuedUnit}</span>
        </span>
      ),
    },
    {
      dataField: 'usedQty',
      caption: 'Used',
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span>
          {Number(cell.data.usedQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-xs text-gray-500">{cell.data.usedUnit}</span>
        </span>
      ),
    },
    {
      dataField: 'returnQty',
      caption: 'Return',
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span className="font-medium text-emerald-700">
          {Number(cell.data.returnQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-xs text-gray-500">{cell.data.returnUnit}</span>
        </span>
      ),
    },
    {
      dataField: 'varianceQty',
      caption: 'Variance qty',
      width: 110,
      alignment: 'right',
      cellRender: (cell) => (
        <span>
          {Number(cell.data.varianceQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
      ),
    },
    {
      dataField: 'variancePct',
      caption: 'Variance %',
      width: 100,
      alignment: 'right',
      cellRender: (cell) => {
        const outside = cell.data.isOutsideTolerance;
        return (
          <span
            className={
              'font-medium ' + (outside ? 'text-red-600' : 'text-gray-700')
            }
          >
            {Number(cell.data.variancePct).toFixed(2)}%
          </span>
        );
      },
    },
    {
      dataField: 'varianceReason',
      caption: 'Reason',
      width: 140,
      cellRender: (cell) => <span className="text-sm capitalize">{String(cell.data.varianceReason).replace(/_/g, ' ')}</span>,
    },
    {
      dataField: 'isOutsideTolerance',
      caption: 'Outside tol?',
      width: 110,
      alignment: 'center',
      cellRender: (cell) =>
        cell.data.isOutsideTolerance ? (
          <Badge variant="danger">เกิน tolerance</Badge>
        ) : (
          <Badge variant="success">OK</Badge>
        ),
    },
    {
      dataField: 'returnContainerLabel',
      caption: 'Container',
      minWidth: 160,
      cellRender: (cell) => (
        <div>
          <p className="font-mono text-xs">{cell.data.returnContainerLabel || '—'}</p>
          {cell.data.returnContainerType && (
            <p className="text-xs text-gray-500 capitalize">{cell.data.returnContainerType}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full print:p-0">
        <div className="print:hidden">
          <ResponsivePageHeader
            title={`Material Return ${detail.returnNumber}`}
            subtitle={
              detail.woNumber ? `WO #${detail.woNumber}` : 'No work order linked'
            }
            icon={ArrowDownToLine}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-600"
            breadcrumbs={[
              { label: 'Inventory', href: '/inventory' },
              { label: 'Returns', href: '/inventory/returns' },
              { label: detail.returnNumber },
            ]}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <DxButton
                  text="กลับ"
                  icon="back"
                  stylingMode="outlined"
                  onClick={() => router.push('/inventory/returns')}
                />
                <DxButton
                  text="พิมพ์"
                  icon="print"
                  stylingMode="outlined"
                  onClick={handlePrint}
                />
                {canAct && (
                  <>
                    <DxButton
                      text="ปฏิเสธ"
                      icon="close"
                      type="danger"
                      stylingMode="outlined"
                      onClick={() => {
                        setRejectReason('');
                        setShowRejectDialog(true);
                      }}
                      disabled={approving || rejecting}
                    />
                    <DxButton
                      text="อนุมัติและรับเข้า"
                      icon="check"
                      type="success"
                      onClick={() => setShowApproveConfirm(true)}
                      disabled={approving || rejecting}
                    />
                  </>
                )}
              </div>
            }
          />
        </div>

        {/* Print-only header */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">{detail.returnNumber}</h1>
          <p className="text-sm">
            {detail.woNumber ? `WO #${detail.woNumber}` : ''} · {formatDateTh(detail.returnDate)}
          </p>
        </div>

        {/* Header info card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">สถานะ</p>
              <div className="mt-1">
                <Badge variant={sInfo.variant}>{sInfo.label}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">วันที่คืน</p>
              <p className="mt-1 text-sm font-medium">{formatDateTh(detail.returnDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">ผู้คืน</p>
              <p className="mt-1 text-sm font-medium">{detail.returnedByName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">คลังรับ</p>
              <p className="mt-1 text-sm font-medium">{detail.warehouseName || '—'}</p>
            </div>
            {detail.approvedAt && (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">วันที่อนุมัติ</p>
                  <p className="mt-1 text-sm font-medium">{formatDateTh(detail.approvedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">ผู้อนุมัติ</p>
                  <p className="mt-1 text-sm font-medium">{detail.approvedByName || '—'}</p>
                </div>
              </>
            )}
          </div>
          {detail.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide">หมายเหตุ</p>
              <p className="mt-1 text-sm">{detail.notes}</p>
            </div>
          )}
          {detail.rejectionReason && (
            <div className="mt-4 pt-4 border-t border-red-100 bg-red-50 -mx-4 -mb-4 md:-mx-6 md:-mb-6 px-4 md:px-6 py-3 rounded-b-xl">
              <p className="text-xs text-red-700 uppercase tracking-wide font-semibold">
                เหตุผลการปฏิเสธ
              </p>
              <p className="mt-1 text-sm text-red-900">{detail.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Post-approval results */}
        {detail.status === 'received' && createdLots.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-emerald-900">สร้าง lot ใหม่แล้ว</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {createdLots.map((lot) => (
                    <span
                      key={lot.id}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-emerald-300 rounded text-xs"
                    >
                      <span className="font-mono font-medium">{lot.lotNumber}</span>
                      <span className="text-gray-600">
                        {Number(lot.quantity).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </span>
                      <Badge variant={lot.status === 'released' ? 'success' : 'warning'}>
                        {lot.status}
                      </Badge>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {linkedDeviations.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">มี Deviation ที่เกี่ยวข้อง</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {linkedDeviations.map((dev) => (
                    <a
                      key={dev.id}
                      href={`/quality/deviations/${dev.id}`}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-amber-300 rounded text-xs hover:bg-amber-100 transition"
                    >
                      <span className="font-mono font-medium">{dev.deviationNumber}</span>
                      <Badge variant={dev.severity === 'major' ? 'danger' : 'warning'}>
                        {dev.severity}
                      </Badge>
                      <span className="text-gray-600">{dev.status}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lines table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">
              รายการที่คืน ({detail.lines.length})
            </h2>
          </div>
          <DxDataGrid
            dataSource={detail.lines}
            keyExpr="id"
            columns={lineColumns}
            sorting
            pageSize={50}
            height="auto"
            noDataText="ไม่มีรายการ"
          />
        </div>
      </div>

      {/* Approve confirmation */}
      <DxConfirmDialog
        visible={showApproveConfirm}
        title="ยืนยันการอนุมัติ"
        message={
          'ระบบจะสร้าง lot ใหม่ตามจำนวนที่คืน และอาจเปิด Deviation อัตโนมัติหาก variance เกิน tolerance ดำเนินการต่อหรือไม่?'
        }
        confirmText={approving ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
        confirmType="success"
        cancelText="ยกเลิก"
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />

      {/* Reject dialog with required reason */}
      <DxPopup
        visible={showRejectDialog}
        onHiding={() => {
          if (!rejecting) setShowRejectDialog(false);
        }}
        title="ปฏิเสธการคืนวัตถุดิบ"
        width={480}
        height="auto"
        showCloseButton
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700">
            กรุณาระบุเหตุผลที่ปฏิเสธ — ผู้ปฏิบัติงานจะเห็นข้อความนี้
          </p>
          <DxTextArea
            value={rejectReason}
            onValueChanged={(e) => setRejectReason(String(e.value || ''))}
            placeholder="เหตุผลในการปฏิเสธ..."
            height={100}
          />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => setShowRejectDialog(false)}
              disabled={rejecting}
            />
            <DxButton
              text={rejecting ? 'กำลังปฏิเสธ...' : 'ยืนยันปฏิเสธ'}
              type="danger"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            />
          </div>
        </div>
      </DxPopup>
    </MainLayout>
  );
}

