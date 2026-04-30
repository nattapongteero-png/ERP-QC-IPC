'use client';

/**
 * QC Entry — Register New Sample
 *
 * Operator-facing form for registering a QC sample. Layout is mobile-first:
 * single-column on small screens, two-column on md+. Source-type drives the
 * "ref" field — outgoing_shipment surfaces customer + SO ref; work_order_batch
 * surfaces a free-text WO ref. The Apply Default Panel toggle (default ON)
 * seeds tests from qc_test_panels matching the chosen product.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { useToast } from '@/hooks/use-toast';
import { TestTube } from 'lucide-react';

const SOURCE_OPTIONS = [
  { value: 'raw_material_lot', label: 'วัตถุดิบเข้า (Raw material lot)' },
  { value: 'work_order_batch', label: 'ใบสั่งผลิต (Work order batch)' },
  { value: 'customer_return', label: 'คืนจากลูกค้า (Customer return)' },
  { value: 'stability', label: 'การศึกษาความคงตัว (Stability)' },
  { value: 'purchased_herb', label: 'ซื้อสมุนไพร (Purchased herb)' },
  { value: 'outgoing_shipment', label: 'ส่งออกให้ลูกค้า (Outgoing shipment / COA)' },
  { value: 'other', label: 'อื่นๆ (Other)' },
];

interface ProductOption {
  id: number;
  code: string;
  nameTh: string;
  nameEn?: string;
  category?: string | null;
  primaryUnit?: string;
}

interface CustomerOption {
  id: number;
  code: string;
  name: string;
}

export default function QcEntryNewPage() {
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Form state
  const [sourceType, setSourceType] = useState<string>('raw_material_lot');
  const [sourceRefText, setSourceRefText] = useState<string>('');
  const [productId, setProductId] = useState<number | null>(null);
  const [lotNumber, setLotNumber] = useState<string>('');
  const [manufactureDate, setManufactureDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [retestDate, setRetestDate] = useState<string>('');
  const [quantityReceived, setQuantityReceived] = useState<number | null>(null);
  const [unit, setUnit] = useState<string>('');
  const [storageConditions, setStorageConditions] = useState<string>('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [salesOrderRef, setSalesOrderRef] = useState<string>('');
  const [receivedDate, setReceivedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState<string>('');
  const [applyDefaultPanel, setApplyDefaultPanel] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/items?limit=500');
        const data = await res.json();
        if (data.success) {
          const items = data.data?.items || [];
          setProducts(items);
        }
      } catch {
        // Ignore — selectbox just stays empty.
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/customers?limit=500');
        const data = await res.json();
        if (data.success) {
          const items = data.data?.items || data.data || [];
          setCustomers(items);
        }
      } catch {
        // Ignore — customer selectbox stays empty.
      }
    })();
  }, []);

  const productItems = products.map((p) => ({
    id: p.id,
    label: `${p.code} — ${p.nameTh}${p.nameEn ? ' / ' + p.nameEn : ''}`,
    primaryUnit: p.primaryUnit,
  }));
  const customerItems = customers.map((c) => ({
    id: c.id,
    label: `${c.code} — ${c.name}`,
  }));

  const isOutgoing = sourceType === 'outgoing_shipment';

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('กรุณาเลือกสินค้า');
      return;
    }
    if (!receivedDate) {
      toast.error('กรุณาระบุวันที่รับตัวอย่าง');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/quality/qc-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          sourceType,
          sourceRefText: sourceRefText || null,
          lotNumber: lotNumber || null,
          manufactureDate: manufactureDate || null,
          expiryDate: expiryDate || null,
          retestDate: retestDate || null,
          quantityReceived: quantityReceived ?? null,
          unit: unit || null,
          storageConditions: storageConditions || null,
          customerId: isOutgoing ? customerId : null,
          salesOrderRef: isOutgoing ? salesOrderRef || null : null,
          receivedDate,
          notes: notes || null,
          applyDefaultPanel,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(
          'ลงทะเบียนไม่สำเร็จ',
          data.error || 'Unknown error',
        );
        return;
      }
      toast.success(
        'ลงทะเบียนสำเร็จ',
        `${data.data?.sampleNumber || ''} (seeded ${data.data?.testsSeeded ?? 0} tests)`,
      );
      router.push(`/quality/qc-entry/${data.data?.sampleId}`);
    } catch (e) {
      toast.error(
        'ลงทะเบียนไม่สำเร็จ',
        e instanceof Error ? e.message : 'Network error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-4xl">
        <ResponsivePageHeader
          title="ลงทะเบียนตัวอย่าง QC"
          subtitle="Register a new QC sample"
          icon={TestTube}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'QC Entry', href: '/quality/qc-entry' },
            { label: 'New' },
          ]}
          actions={
            <DxButton
              text="ยกเลิก"
              icon="back"
              stylingMode="outlined"
              onClick={() => router.push('/quality/qc-entry')}
            />
          }
        />

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 space-y-5">
          {/* Source */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ที่มาของตัวอย่าง / Source
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxSelectBox
                label="ประเภทแหล่งที่มา"
                value={sourceType}
                items={SOURCE_OPTIONS}
                displayExpr="label"
                valueExpr="value"
                onValueChange={(v) => setSourceType(String(v ?? ''))}
                required
              />
              <DxTextBox
                label="อ้างอิง (WO#, Lot#, ฯลฯ)"
                value={sourceRefText}
                onValueChange={setSourceRefText}
                placeholder="เช่น WO2604297175"
              />
            </div>
          </section>

          {/* Product */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ข้อมูลสินค้า / Product
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <DxSelectBox
                  label="สินค้า"
                  value={productId}
                  dataSource={productItems}
                  displayExpr="label"
                  valueExpr="id"
                  onValueChange={(v) => {
                    const next = v == null ? null : Number(v);
                    setProductId(next);
                    if (next) {
                      const p = products.find((x) => x.id === next);
                      if (p?.primaryUnit && !unit) setUnit(p.primaryUnit);
                    }
                  }}
                  searchEnabled
                  required
                />
              </div>
              <DxTextBox
                label="Lot Number"
                value={lotNumber}
                onValueChange={setLotNumber}
                placeholder="เช่น BG-2026-0070"
              />
              <div className="grid grid-cols-2 gap-3">
                <DxNumberBox
                  label="จำนวน"
                  value={quantityReceived}
                  onValueChange={(v) => setQuantityReceived(v ?? null)}
                />
                <DxTextBox
                  label="หน่วย"
                  value={unit}
                  onValueChange={setUnit}
                  placeholder="kg, g, capsule..."
                />
              </div>
              <DxDateBox
                label="วันที่ผลิต"
                value={manufactureDate}
                onValueChange={(v) => setManufactureDate(v || '')}
              />
              <DxDateBox
                label="วันหมดอายุ"
                value={expiryDate}
                onValueChange={(v) => setExpiryDate(v || '')}
              />
              <DxDateBox
                label="Retest date"
                value={retestDate}
                onValueChange={(v) => setRetestDate(v || '')}
              />
              <DxTextBox
                label="สภาพการเก็บ (Storage)"
                value={storageConditions}
                onValueChange={setStorageConditions}
                placeholder="เช่น ต่ำกว่า 30°C"
              />
            </div>
          </section>

          {/* Outgoing only — customer & SO */}
          {isOutgoing && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                ลูกค้า / Customer (สำหรับ COA)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DxSelectBox
                  label="ลูกค้า"
                  value={customerId}
                  dataSource={customerItems}
                  displayExpr="label"
                  valueExpr="id"
                  onValueChange={(v) => setCustomerId(v == null ? null : Number(v))}
                  searchEnabled
                  showClearButton
                />
                <DxTextBox
                  label="Sales Order ref"
                  value={salesOrderRef}
                  onValueChange={setSalesOrderRef}
                  placeholder="เช่น SO-2026-0042"
                />
              </div>
            </section>
          )}

          {/* Receipt + notes */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ข้อมูลการรับ / Receipt
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxDateBox
                label="วันที่รับตัวอย่าง"
                value={receivedDate}
                onValueChange={(v) => setReceivedDate(v || '')}
              />
            </div>
            <div className="mt-4">
              <DxTextArea
                label="หมายเหตุ"
                value={notes}
                onValueChange={setNotes}
                height={90}
              />
            </div>
            <div className="mt-4 flex items-start gap-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
              <DxCheckBox
                value={applyDefaultPanel}
                onValueChange={(v) => setApplyDefaultPanel(Boolean(v))}
              />
              <div className="flex-1">
                <label className="text-sm font-medium text-cyan-900">
                  ใส่ test panel มาตรฐานของสินค้านี้อัตโนมัติ
                </label>
                <p className="text-xs text-cyan-700 mt-0.5">
                  ระบบจะดึงรายการทดสอบจาก Test Panels master ของสินค้า/หมวดหมู่นี้
                  มาวางในตัวอย่างให้พร้อมบันทึกผล
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => router.push('/quality/qc-entry')}
              disabled={submitting}
            />
            <DxButton
              text={submitting ? 'กำลังบันทึก...' : 'ลงทะเบียน'}
              icon="save"
              type="default"
              onClick={handleSubmit}
              disabled={submitting || !productId}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
