'use client';

/**
 * Quotation detail / status page (ใบเสนอราคา).
 *
 * Shows the full quotation with its lines, lets the user advance the status
 * (ส่งแล้ว / ตอบรับ / ปฏิเสธ) via PATCH, print an A4 offer, and convert an
 * accepted quotation into a sales order. Conversion is disabled once the
 * quotation is already converted; the backend also rejects it with a Thai
 * message when no line is linked to an inventory item — that message is shown
 * verbatim.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Button } from 'devextreme-react/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { formatNumber } from '@/lib/utils/number-format';
import {
  FileText,
  Building2,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { QuotationPrintDocument } from '@/components/sales/QuotationPrintDocument';
import type { QuotationWithLines, QuotationStatus } from '@/types/quotation';

const STATUS_META: Record<QuotationStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'ร่าง', variant: 'default' },
  sent: { label: 'ส่งแล้ว', variant: 'info' },
  accepted: { label: 'ตอบรับ', variant: 'success' },
  rejected: { label: 'ปฏิเสธ', variant: 'danger' },
  expired: { label: 'หมดอายุ', variant: 'warning' },
  converted: { label: 'แปลงแล้ว', variant: 'primary' },
};

function formatThaiDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('sales');
  const id = String(params?.id ?? '');

  const [quotation, setQuotation] = useState<QuotationWithLines | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales/quotations/${id}`);
      const json = await res.json();
      if (json.success) setQuotation(json.data);
      else toast.error(json.error || 'ไม่พบใบเสนอราคา');
    } catch (e) {
      console.error('Failed to fetch quotation:', e);
      toast.error('ไม่สามารถโหลดใบเสนอราคาได้');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  const updateStatus = useCallback(async (status: QuotationStatus) => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/sales/quotations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('อัปเดตสถานะแล้ว', STATUS_META[status].label);
        await fetchData();
      } else {
        toast.error(json.error || 'ไม่สามารถอัปเดตสถานะได้');
      }
    } catch (e) {
      console.error('Failed to update status:', e);
      toast.error('ไม่สามารถอัปเดตสถานะได้');
    } finally {
      setIsBusy(false);
    }
  }, [id, toast, fetchData]);

  const handleConvert = useCallback(async () => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/sales/quotations/${id}/convert`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success('แปลงเป็นใบสั่งขายแล้ว');
        router.push(`/sales/orders/${json.data.soId}`);
      } else {
        // The backend returns a Thai message (e.g. no item-linked lines) — show
        // it as-is so the user knows exactly why the conversion was refused.
        toast.error(json.error || 'ไม่สามารถแปลงเป็นใบสั่งขายได้');
      }
    } catch (e) {
      console.error('Failed to convert quotation:', e);
      toast.error('ไม่สามารถแปลงเป็นใบสั่งขายได้');
    } finally {
      setIsBusy(false);
    }
  }, [id, toast, router]);

  const handlePrint = useCallback(() => {
    setPrinting(true);
    // Let React paint the hidden document before handing off to the browser.
    requestAnimationFrame(() => {
      window.print();
      setPrinting(false);
    });
  }, []);

  const lineColumns: DxDataGridColumn[] = [
    { dataField: 'rowNo', caption: '#', width: 60, alignment: 'center', allowSorting: false },
    { dataField: 'itemCode', caption: 'รหัสสินค้า', width: 130 },
    { dataField: 'description', caption: 'รายละเอียด', minWidth: 220 },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 110,
      alignment: 'right',
      cellRender: (c) => (
        <span className="tabular-nums">
          {formatNumber(Number(c.data.quantity))} {String(c.data.unit ?? '')}
        </span>
      ),
    },
    {
      dataField: 'unitPrice',
      caption: 'ราคา/หน่วย',
      width: 130,
      alignment: 'right',
      cellRender: (c) => (
        <span className="tabular-nums">{formatNumber(Number(c.data.unitPrice))}</span>
      ),
    },
    {
      dataField: 'totalPrice',
      caption: 'จำนวนเงิน',
      width: 140,
      alignment: 'right',
      cellRender: (c) => {
        const amount =
          Number(c.data.totalPrice) ||
          Number(c.data.quantity) * Number(c.data.unitPrice);
        return <span className="tabular-nums font-medium">{formatNumber(amount)} บาท</span>;
      },
    },
  ];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 text-gray-500">กำลังโหลด...</div>
      </MainLayout>
    );
  }

  if (!quotation) {
    return (
      <MainLayout>
        <div className="p-6">
          <p className="text-gray-500">ไม่พบใบเสนอราคา</p>
          <Button
            text="กลับ"
            icon="back"
            stylingMode="outlined"
            onClick={() => router.push('/sales/quotations')}
          />
        </div>
      </MainLayout>
    );
  }

  const meta = STATUS_META[quotation.status] ?? { label: quotation.status, variant: 'default' as const };
  const isConverted = quotation.status === 'converted';
  const lineRows = quotation.lines.map((l, i) => ({ ...l, rowNo: i + 1 }));

  return (
    <MainLayout>
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              text="กลับ"
              icon="back"
              stylingMode="text"
              onClick={() => router.push('/sales/quotations')}
              elementAttr={{ 'data-testid': 'qt-detail-back-btn' }}
            />
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-gray-900" data-testid="qt-detail-number">
                    {quotation.quotationNumber}
                  </h1>
                  <Badge variant={meta.variant} className="whitespace-nowrap">
                    {meta.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">{quotation.customerName}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {quotation.status === 'draft' && (
              <Button
                text={t(`quotationNew.editTitle`)}
                icon="edit"
                stylingMode="outlined"
                onClick={() => router.push(`/sales/quotations/new?edit=${quotation.id}`)}
                elementAttr={{ 'data-testid': 'qt-edit-btn' }}
              />
            )}
            <Button
              text="พิมพ์"
              icon="print"
              stylingMode="outlined"
              onClick={handlePrint}
              elementAttr={{ 'data-testid': 'qt-print-btn' }}
            />
            <Button
              text="แปลงเป็นใบสั่งขาย"
              icon="exportxlsx"
              type="success"
              onClick={handleConvert}
              // Only an ACCEPTED quotation may convert (list item 20). A draft/sent
              // offer the customer hasn't agreed to must be accepted first.
              disabled={isBusy || isConverted || quotation.status !== 'accepted'}
              hint={
                isConverted
                  ? 'ใบเสนอราคานี้ถูกแปลงแล้ว'
                  : quotation.status !== 'accepted'
                    ? 'ต้องกด "ตอบรับ" ก่อนจึงจะแปลงเป็นใบสั่งขายได้'
                    : undefined
              }
              elementAttr={{ 'data-testid': 'qt-convert-btn' }}
            />
          </div>
        </div>

        {/* Status action bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-sm text-gray-500 mr-2">เปลี่ยนสถานะ:</span>
            {/* Each status button disappears once it no longer applies (list
                item 20: the "ตอบรับ" button stayed after accepting). Only offer a
                transition that moves the quotation forward from where it is. */}
            {quotation.status === 'draft' && (
              <Button
                text="ส่งแล้ว"
                icon="email"
                stylingMode="outlined"
                onClick={() => updateStatus('sent')}
                disabled={isBusy}
                elementAttr={{ 'data-testid': 'qt-status-sent-btn' }}
              />
            )}
            {(quotation.status === 'draft' || quotation.status === 'sent') && (
              <Button
                text="ตอบรับ"
                icon="check"
                type="success"
                stylingMode="outlined"
                onClick={() => updateStatus('accepted')}
                disabled={isBusy}
                elementAttr={{ 'data-testid': 'qt-status-accepted-btn' }}
              />
            )}
            {(quotation.status === 'draft' || quotation.status === 'sent') && (
              <Button
                text="ปฏิเสธ"
                icon="close"
                type="danger"
                stylingMode="outlined"
                onClick={() => updateStatus('rejected')}
                disabled={isBusy}
                elementAttr={{ 'data-testid': 'qt-status-rejected-btn' }}
              />
            )}
            {quotation.soId && (
              <Button
                text="ดูใบสั่งขาย"
                icon="arrowright"
                stylingMode="text"
                onClick={() => router.push(`/sales/orders/${quotation.soId}`)}
                elementAttr={{ 'data-testid': 'qt-view-so-btn' }}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lines */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">รายการสินค้า/บริการ</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DxDataGrid
                  dataSource={lineRows as Record<string, unknown>[]}
                  columns={lineColumns}
                  keyExpr="id"
                  paging={false}
                  sorting={false}
                  noDataText="ไม่มีรายการ"
                  elementAttr={{ 'data-testid': 'qt-detail-lines-grid' }}
                />
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                  <div className="w-full max-w-xs flex justify-between items-center">
                    <span className="text-sm text-gray-500">ยอดรวมทั้งสิ้น</span>
                    <span
                      className="text-2xl font-bold text-green-600 tabular-nums"
                      data-testid="qt-detail-total"
                    >
                      {formatNumber(Number(quotation.totalAmount))} บาท
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {quotation.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">หมายเหตุ</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Details sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  ลูกค้า
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-500">ชื่อลูกค้า</p>
                  <p className="font-medium text-gray-900">{quotation.customerName}</p>
                </div>
                {quotation.customerContact && (
                  <div>
                    <p className="text-gray-500">ผู้ติดต่อ</p>
                    <p className="text-gray-900">{quotation.customerContact}</p>
                  </div>
                )}
                {quotation.customerAddress && (
                  <div>
                    <p className="text-gray-500">ที่อยู่</p>
                    <p className="text-gray-900 whitespace-pre-wrap">{quotation.customerAddress}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  รายละเอียด
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">วันที่</span>
                  <span className="text-gray-900">{formatThaiDate(quotation.quotationDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ใช้ได้ถึง</span>
                  <span className="text-gray-900">{formatThaiDate(quotation.validUntil)}</span>
                </div>
                {quotation.paymentTerms && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      เงื่อนไขการชำระ
                    </span>
                    <span className="text-gray-900 text-right">{quotation.paymentTerms}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden on screen; the global @media print rules reveal .print-only. */}
      {printing && <QuotationPrintDocument quotation={quotation} />}
    </MainLayout>
  );
}
