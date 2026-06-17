/**
 * Matching Exceptions List Page (T118)
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import DataGrid, {
  Column,
  Paging,
  Toolbar,
  Item,
  SearchPanel,
} from 'devextreme-react/data-grid';
import type { MatchingSummary } from '@/types/matching';

interface Exception {
  id: number;
  matchingResultId: number;
  exceptionType: string;
  varianceAmount: number;
  variancePct: number;
  status: string;
  resolutionAction: string | null;
  resolutionNotes: string | null;
  resolvedBy: number | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  // Context joined from matching result (invoice / PO / vendor)
  invoiceNumber: string | null;
  poNumber: string | null;
  vendorName: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const exceptionTypeLabels: Record<string, string> = {
  over_quantity: 'ปริมาณเกิน',
  under_quantity: 'ปริมาณขาด',
  over_price: 'ราคาเกิน',
  under_price: 'ราคาต่ำกว่า',
  quantity_variance: 'ผลต่างปริมาณ',
  price_variance: 'ผลต่างราคา',
  amount_variance: 'ผลต่างจำนวนเงิน',
  missing_grn: 'ไม่มีใบรับสินค้า',
  missing_po: 'ไม่มีใบสั่งซื้อ',
  partial_receipt: 'รับสินค้าบางส่วน',
};

export default function MatchingExceptionsPage() {
  const t = useTranslations('accounting');
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [summary, setSummary] = useState<MatchingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewComments, setReviewComments] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [exceptionsRes, summaryRes] = await Promise.all([
        fetch('/api/accounting/matching/exceptions'),
        fetch('/api/accounting/matching'),
      ]);

      const exceptionsData = await exceptionsRes.json();
      const summaryData = await summaryRes.json();

      if (exceptionsData.success) {
        setExceptions(exceptionsData.data);
      }
      if (summaryData.success) {
        setSummary(summaryData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (exception: Exception, action: 'approve' | 'reject') => {
    setSelectedException(exception);
    setReviewAction(action);
    setReviewComments('');
    setShowReviewDialog(true);
  };

  const submitReview = async () => {
    if (!selectedException) return;

    setActionLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/matching/exceptions/${selectedException.id}/${reviewAction}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: reviewComments }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setShowReviewDialog(false);
        await fetchData();
      } else {
        alert(result.error || `Failed to ${reviewAction} exception`);
      }
    } catch (error) {
      console.error('Error reviewing exception:', error);
      alert(`Failed to ${reviewAction} exception`);
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatus = (cellData: any) => {
    const status = cellData.value as string;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const renderExceptionType = (cellData: any) => {
    const type = cellData.value as string;
    return exceptionTypeLabels[type] || type;
  };

  const renderVariance = (cellData: any) => {
    const value = Number(cellData.value || 0);
    const isNegative = value < 0;
    return (
      <span className={isNegative ? 'text-red-600' : 'text-green-600'}>
        {value.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </span>
    );
  };

  const renderActions = (cellData: any) => {
    const exception = cellData.data as Exception;
    if (exception.status !== 'pending') return null;

    return (
      <div className="flex gap-1">
        <Button
          icon="check"
          hint="อนุมัติ"
          stylingMode="text"
          type="success"
          onClick={() => handleReview(exception, 'approve')}
        />
        <Button
          icon="close"
          hint="ปฏิเสธ"
          stylingMode="text"
          type="danger"
          onClick={() => handleReview(exception, 'reject')}
        />
      </div>
    );
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('page.title')}
          </h1>
          <p className="text-gray-600">
            ตรวจสอบและแก้ไขรายการผิดปกติจากการจับคู่ 3 ทาง
          </p>
        </div>

        {/* Dashboard Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">จับคู่วันนี้</div>
              <div className="text-2xl font-bold text-green-600">
                {summary.totalMatchedToday}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-500">รายการผิดปกติวันนี้</div>
              <div className="text-2xl font-bold text-red-600">
                {summary.totalExceptionsToday}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500">รอตรวจสอบ</div>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.pendingExceptions}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500">จับคู่เดือนนี้</div>
              <div className="text-2xl font-bold text-blue-600">
                {summary.matchedThisMonth}
              </div>
            </div>
          </div>
        )}

        {/* Exceptions Grid */}
        <div className="bg-white rounded-lg shadow">
          <DataGrid
            dataSource={exceptions}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            allowColumnResizing={true}
            data-testid="exceptions-grid"
          >
            <SearchPanel visible={true} placeholder="ค้นหารายการผิดปกติ..." />
            <Paging defaultPageSize={20} />
            <Toolbar>
              <Item location="before">
                <span className="text-lg font-medium">รายการผิดปกติ</span>
              </Item>
              <Item location="after">
                <Button
                  text="รีเฟรช"
                  icon="refresh"
                  stylingMode="outlined"
                  onClick={fetchData}
                />
              </Item>
            </Toolbar>

            <Column dataField="id" caption="รหัส" width={80} />
            <Column
              dataField="invoiceNumber"
              caption="เลขใบแจ้งหนี้"
              width={150}
              cellRender={(cell: any) => cell.value || '-'}
            />
            <Column
              dataField="poNumber"
              caption="เลขใบสั่งซื้อ"
              width={150}
              cellRender={(cell: any) => cell.value || '-'}
            />
            <Column
              dataField="vendorName"
              caption="ผู้ขาย"
              width={180}
              cellRender={(cell: any) => cell.value || '-'}
            />
            <Column
              dataField="exceptionType"
              caption="ประเภท"
              width={150}
              cellRender={renderExceptionType}
            />
            <Column
              dataField="varianceAmount"
              caption="ผลต่าง"
              width={120}
              alignment="right"
              cellRender={renderVariance}
            />
            <Column
              dataField="variancePct"
              caption="ผลต่าง %"
              width={100}
              alignment="right"
              format="#0.00'%'"
            />
            <Column
              dataField="status"
              caption="สถานะ"
              width={100}
              alignment="center"
              cellRender={renderStatus}
            />
            <Column
              dataField="resolvedByName"
              caption="แก้ไขโดย"
              width={150}
            />
            <Column
              dataField="resolutionNotes"
              caption="หมายเหตุ"
              width={200}
            />
            <Column
              caption="การดำเนินการ"
              width={100}
              alignment="center"
              cellRender={renderActions}
            />
          </DataGrid>
        </div>

        {/* Review Dialog */}
        <Popup
          visible={showReviewDialog}
          onHiding={() => setShowReviewDialog(false)}
          title={reviewAction === 'approve' ? 'อนุมัติรายการผิดปกติ' : 'ปฏิเสธรายการผิดปกติ'}
          width={400}
          height="auto"
          showCloseButton={true}
        >
          <div className="p-4">
            {selectedException && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                {(selectedException.invoiceNumber || selectedException.poNumber) && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="text-sm text-gray-500">เลขใบแจ้งหนี้</div>
                      <div className="font-medium">{selectedException.invoiceNumber || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">เลขใบสั่งซื้อ</div>
                      <div className="font-medium">{selectedException.poNumber || '-'}</div>
                    </div>
                    {selectedException.vendorName && (
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">ผู้ขาย</div>
                        <div className="font-medium">{selectedException.vendorName}</div>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-sm text-gray-500">ประเภทรายการผิดปกติ</div>
                <div className="font-medium">
                  {exceptionTypeLabels[selectedException.exceptionType] ||
                    selectedException.exceptionType}
                </div>
                <div className="text-sm text-gray-500 mt-2">ผลต่าง</div>
                <div className="font-medium">
                  {Number(selectedException.varianceAmount || 0).toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  ({Number(selectedException.variancePct || 0).toFixed(2)}%)
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ความคิดเห็น
              </label>
              <TextArea
                value={reviewComments}
                onValueChanged={(e) => setReviewComments(e.value || '')}
                height={100}
                placeholder="กรอกความคิดเห็น..."
                data-testid="review-comments-input"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button text="ยกเลิก" onClick={() => setShowReviewDialog(false)} />
              <Button
                text={
                  actionLoading
                    ? 'กำลังดำเนินการ...'
                    : reviewAction === 'approve'
                    ? 'อนุมัติ'
                    : 'ปฏิเสธ'
                }
                type={reviewAction === 'approve' ? 'success' : 'danger'}
                stylingMode="contained"
                onClick={submitReview}
                disabled={actionLoading}
                data-testid="submit-review-btn"
              />
            </div>
          </div>
        </Popup>
      </div>
  );
}
