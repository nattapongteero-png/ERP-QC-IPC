/**
 * Matching Dialog Component (T071)
 * Displays unmatched payments for manual matching
 */

'use client';

import { useState, useEffect } from 'react';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import { TextArea } from 'devextreme-react/text-area';
import DataGrid, { Column, Selection } from 'devextreme-react/data-grid';
import type { BankStatementLine, UnmatchedPayment } from '@/types/bank-reconciliation';

interface MatchingDialogProps {
  visible: boolean;
  statementLine: BankStatementLine | null;
  bankAccountId: number;
  onClose: () => void;
  onMatch: (lineId: number, entityType: string, entityId: number, notes?: string) => Promise<void>;
}

export function MatchingDialog({
  visible,
  statementLine,
  bankAccountId,
  onClose,
  onMatch,
}: MatchingDialogProps) {
  const [payments, setPayments] = useState<UnmatchedPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<UnmatchedPayment | null>(null);
  const [notes, setNotes] = useState('');
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    if (visible && bankAccountId) {
      fetchPayments();
    }
  }, [visible, bankAccountId]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/accounting/bank-reconciliation/unmatched-payments?bankAccountId=${bankAccountId}`
      );
      const result = await response.json();
      if (result.success) {
        setPayments(result.data);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!statementLine || !selectedPayment) return;

    setMatching(true);
    try {
      const entityType = selectedPayment.type === 'payment' ? 'ap_payment' : 'ar_receipt';
      await onMatch(statementLine.id, entityType, selectedPayment.id, notes || undefined);
      handleClose();
    } catch (error) {
      console.error('Error matching:', error);
    } finally {
      setMatching(false);
    }
  };

  const handleClose = () => {
    setSelectedPayment(null);
    setNotes('');
    onClose();
  };

  const handleSelectionChanged = (e: any) => {
    const selected = e.selectedRowsData?.[0] as UnmatchedPayment;
    setSelectedPayment(selected || null);
  };

  const formatAmount = (cellData: any) => {
    const amount = cellData.value as number;
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  const formatDate = (cellData: any) => {
    const date = cellData.value;
    if (!date) return '';
    return new Date(date).toLocaleDateString('th-TH');
  };

  // Filter payments by amount similarity
  const filteredPayments = statementLine
    ? payments.filter((p) => {
        const lineAmount = statementLine.amount;
        const diff = Math.abs(p.amount - lineAmount);
        const tolerance = lineAmount * 0.1; // 10% tolerance
        return diff <= tolerance;
      })
    : payments;

  return (
    <Popup
      visible={visible}
      onHiding={handleClose}
      title="จับคู่รายการในใบแจ้งยอด"
      width={900}
      height={600}
      showCloseButton={true}
      data-testid="matching-dialog"
    >
      <div className="p-4 h-full flex flex-col">
        {statementLine && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">รายการในใบแจ้งยอด</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">วันที่:</span>{' '}
                {new Date(statementLine.transactionDate).toLocaleDateString('th-TH')}
              </div>
              <div>
                <span className="text-gray-500">จำนวนเงิน:</span>{' '}
                <span
                  className={
                    statementLine.transactionType === 'debit' ? 'text-red-600' : 'text-green-600'
                  }
                >
                  {statementLine.transactionType === 'debit' ? '-' : '+'}
                  {statementLine.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">รายละเอียด:</span> {statementLine.description}
              </div>
            </div>
          </div>
        )}

        <div className="mb-2">
          <h4 className="font-medium text-gray-900">
            รายการชำระเงินที่ใช้ได้
            {filteredPayments.length !== payments.length && (
              <span className="text-sm text-gray-500 ml-2">
                (แสดง {filteredPayments.length} จาก {payments.length} รายการที่มีจำนวนเงินใกล้เคียง)
              </span>
            )}
          </h4>
        </div>

        <div className="flex-1 overflow-auto mb-4">
          <DataGrid
            dataSource={filteredPayments}
            keyExpr="id"
            showBorders={true}
            rowAlternationEnabled={true}
            height={280}
            onSelectionChanged={handleSelectionChanged}
            noDataText={loading ? 'กำลังโหลด...' : 'ไม่พบรายการชำระเงินที่ยังไม่จับคู่'}
            data-testid="payments-grid"
          >
            <Selection mode="single" />
            <Column dataField="documentNumber" caption="เลขที่เอกสาร" width={140} />
            <Column dataField="date" caption="วันที่" width={100} cellRender={formatDate} />
            <Column
              dataField="amount"
              caption="จำนวนเงิน"
              width={120}
              alignment="right"
              cellRender={formatAmount}
            />
            <Column dataField="vendorOrCustomerName" caption="ผู้ขาย/ลูกค้า" />
            <Column dataField="reference" caption="อ้างอิง" width={120} />
            <Column dataField="type" caption="ประเภท" width={80} />
          </DataGrid>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">หมายเหตุ (ไม่บังคับ)</label>
          <TextArea
            value={notes}
            onValueChanged={(e) => setNotes(e.value || '')}
            height={60}
            placeholder="เพิ่มหมายเหตุเกี่ยวกับการจับคู่นี้..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button text="ยกเลิก" onClick={handleClose} />
          <Button
            text={matching ? 'กำลังจับคู่...' : 'จับคู่รายการที่เลือก'}
            type="success"
            stylingMode="contained"
            onClick={handleMatch}
            disabled={!selectedPayment || matching}
            data-testid="confirm-match-btn"
          />
        </div>
      </div>
    </Popup>
  );
}
