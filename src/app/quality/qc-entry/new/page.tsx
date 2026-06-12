'use client';

/**
 * QC Entry — Register New Sample (+ Sample Requisition)
 *
 * Operator-facing form for registering a QC sample AND drawing the sample qty
 * from the source quarantine lot in one submission. Mirrors the QC Entry guide:
 *
 *   1. ผู้ขอเบิก / Request — requester + purpose (routine/retest/stability/complaint)
 *   2. Source — type + ref; auto-derived from the picked lot's PO#/GRN link
 *   3. Product + quarantine lot — autofills lot#, dates, qty, unit
 *   4. Sample-size calc — per test-panel row choose USP n / √(lotQty)+1 / fixed,
 *      add a buffer %, and the total draw is validated against lot stock
 *   5. Retain sample — separate qty stored in the Retain Sample warehouse
 *
 * On submit the service decrements the source lot by (sampleQty + retainSampleQty)
 * via inventory_transactions and seeds the default test panel.
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { useToast } from '@/hooks/use-toast';
import { TestTube, AlertTriangle } from 'lucide-react';

const SOURCE_OPTIONS = [
  { value: 'raw_material_lot', label: 'วัตถุดิบเข้า (Raw material lot)' },
  { value: 'work_order_batch', label: 'ใบสั่งผลิต (Work order batch)' },
  { value: 'customer_return', label: 'คืนจากลูกค้า (Customer return)' },
  { value: 'stability', label: 'การศึกษาความคงตัว (Stability)' },
  { value: 'purchased_herb', label: 'ซื้อสมุนไพร (Purchased herb)' },
  { value: 'outgoing_shipment', label: 'ส่งออกให้ลูกค้า (Outgoing shipment / COA)' },
  { value: 'other', label: 'อื่นๆ (Other)' },
];

const PURPOSE_OPTIONS = [
  { value: 'routine', label: 'Routine QC — ทดสอบรับเข้าปกติ' },
  { value: 'retest', label: 'Retest — ทดสอบซ้ำหลัง deviation' },
  { value: 'stability', label: 'Stability — ติดตามความคงตัว' },
  { value: 'complaint', label: 'Complaint — ตรวจสอบเรื่องร้องเรียน' },
];

/** Per-test sampling mode shown in the sample-size table. */
const MODE_OPTIONS: { key: SampleMode; label: string }[] = [
  { key: 'usp', label: 'USP (n ตามมาตรฐาน)' },
  { key: 'sqrt', label: '√n + 1 (ตามจำนวน lot)' },
  { key: 'fixed', label: 'กำหนดเอง' },
];

type SampleMode = 'usp' | 'sqrt' | 'fixed';

interface ProductOption {
  id: number;
  code: string;
  nameTh: string;
  nameEn?: string;
  category?: string | null;
  primaryUnit?: string;
  storageCondition?: string | null;
}

interface CustomerOption {
  id: number;
  code: string;
  name: string;
}

/** Quarantine inventory lot — minimum fields needed to auto-fill the QC form. */
interface QuarantineLot {
  id: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  lotNumber: string;
  quantity: number | string;
  unit: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  /** PO# carried from goods receipt — drives sourceRef/sourceType auto-derive. */
  poNumber?: string | null;
  sourceGrnLineId?: number | null;
}

interface PanelRow {
  criteriaId: number;
  criteriaCode: string | null;
  criteriaName: string | null;
  criteriaNameTh: string | null;
  criteriaSampleSize: number | null;
}

/** Per-test sampling config keyed by criteriaId. */
interface TestCfg {
  selected: boolean;
  mode: SampleMode;
  fixedQty: number;
}

/** USP / √n / fixed sample-size formula (mirrors the QC Entry guide). */
function computeSampleSize(uspSize: number, cfg: TestCfg, lotQty: number): number {
  if (!cfg.selected) return 0;
  if (cfg.mode === 'usp') return uspSize;
  if (cfg.mode === 'sqrt') return lotQty > 0 ? Math.ceil(Math.sqrt(lotQty) + 1) : 0;
  if (cfg.mode === 'fixed') return Math.max(0, Number(cfg.fixedQty) || 0);
  return uspSize;
}

export default function QcEntryNewPage() {
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [quarantineLots, setQuarantineLots] = useState<QuarantineLot[]>([]);
  const [panel, setPanel] = useState<PanelRow[]>([]);
  const [testCfg, setTestCfg] = useState<Record<number, TestCfg>>({});

  // Form state
  const [requestedBy, setRequestedBy] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('routine');
  const [sourceType, setSourceType] = useState<string>('raw_material_lot');
  const [sourceRefText, setSourceRefText] = useState<string>('');
  const [productId, setProductId] = useState<number | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
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
  const [bufferPct, setBufferPct] = useState<number>(20);
  const [retainSampleQty, setRetainSampleQty] = useState<number | null>(null);
  const [retainStorage, setRetainStorage] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/items?limit=500');
        const data = await res.json();
        if (data.success) setProducts(data.data?.items || []);
      } catch {
        /* selectbox stays empty */
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/inventory/lots?status=quarantine&limit=500');
        const data = await res.json();
        if (data.success) {
          setQuarantineLots((data.data?.items || []) as QuarantineLot[]);
        }
      } catch {
        /* empty list = no products available */
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/customers?limit=500');
        const data = await res.json();
        if (data.success) setCustomers(data.data?.items || data.data || []);
      } catch {
        /* customer selectbox stays empty */
      }
    })();
  }, []);

  // Load the default test panel whenever the product changes — drives the
  // sample-size table. Reset config so each product starts at USP defaults.
  useEffect(() => {
    if (!productId) {
      setPanel([]);
      setTestCfg({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/quality/test-panels?productId=${productId}&isActive=true`,
        );
        const data = await res.json();
        if (cancelled) return;
        const rows = (data.success ? data.data?.items || [] : []) as PanelRow[];
        setPanel(rows);
        const cfg: Record<number, TestCfg> = {};
        for (const r of rows) {
          cfg[r.criteriaId] = {
            selected: true,
            mode: 'usp',
            fixedQty: r.criteriaSampleSize ?? 1,
          };
        }
        setTestCfg(cfg);
      } catch {
        if (!cancelled) {
          setPanel([]);
          setTestCfg({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Only show products that have at least one lot in quarantine status.
  const productItems = useMemo(() => {
    const itemIdsWithQuarantine = new Set(quarantineLots.map((l) => l.itemId));
    return products
      .filter((p) => itemIdsWithQuarantine.has(p.id))
      .map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.nameTh}${p.nameEn ? ' / ' + p.nameEn : ''}`,
        primaryUnit: p.primaryUnit,
      }));
  }, [products, quarantineLots]);

  const lotsForProduct = productId
    ? quarantineLots.filter((l) => l.itemId === productId)
    : [];

  const lotItems = lotsForProduct.map((l) => ({
    id: l.id,
    label: `${l.lotNumber} — ${Number(l.quantity).toLocaleString()} ${l.unit}${l.expiryDate ? ` (exp ${String(l.expiryDate).slice(0, 10)})` : ''}`,
  }));

  const customerItems = customers.map((c) => ({
    id: c.id,
    label: `${c.code} — ${c.name}`,
  }));

  /** Apply a lot's data into the form fields + auto-derive sourceType/ref. */
  const applyLotToForm = (lot: QuarantineLot | null) => {
    if (!lot) {
      setSelectedLotId(null);
      setLotNumber('');
      setQuantityReceived(null);
      setManufactureDate('');
      setExpiryDate('');
      return;
    }
    setSelectedLotId(lot.id);
    setLotNumber(lot.lotNumber || '');
    setQuantityReceived(Number(lot.quantity));
    setUnit(lot.unit || '');
    setManufactureDate(lot.manufacturingDate ? String(lot.manufacturingDate).slice(0, 10) : '');
    setExpiryDate(lot.expiryDate ? String(lot.expiryDate).slice(0, 10) : '');
    // Auto-derive source ref + type from the lot's origin reference.
    const ref = (lot.poNumber || '').trim();
    if (ref && !sourceRefText.trim()) setSourceRefText(ref);
    if (ref.startsWith('WO-') || ref.startsWith('WO')) {
      setSourceType('work_order_batch');
    } else if (ref.startsWith('PO-') || ref.startsWith('PO')) {
      setSourceType('raw_material_lot');
    }
  };

  const isOutgoing = sourceType === 'outgoing_shipment';
  const lotQty = quantityReceived ?? 0;

  // Computed sample sizes per selected test + buffer + total.
  const computedTests = useMemo(
    () =>
      panel
        .filter((t) => testCfg[t.criteriaId]?.selected)
        .map((t) => {
          const cfg = testCfg[t.criteriaId];
          return {
            ...t,
            mode: cfg.mode,
            fixedQty: cfg.fixedQty,
            computedQty: computeSampleSize(t.criteriaSampleSize ?? 1, cfg, lotQty),
          };
        }),
    [panel, testCfg, lotQty],
  );

  const testSampleSum = computedTests.reduce((s, t) => s + t.computedQty, 0);
  const bufferQty = Math.ceil((testSampleSum * bufferPct) / 100);
  const totalSampleQty = testSampleSum + bufferQty;
  const retainQty = retainSampleQty ?? 0;
  const totalDraw = totalSampleQty + retainQty;
  const exceedsStock = selectedLotId != null && lotQty > 0 && totalDraw > lotQty;

  const updateCfg = (criteriaId: number, patch: Partial<TestCfg>) => {
    setTestCfg((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], ...patch },
    }));
  };

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('กรุณาเลือกสินค้า');
      return;
    }
    if (!receivedDate) {
      toast.error('กรุณาระบุวันที่รับตัวอย่าง');
      return;
    }
    if (exceedsStock) {
      toast.error(
        'จำนวนที่ต้องเบิกเกินคงเหลือใน lot',
        `ต้องเบิก ${totalDraw} แต่คงเหลือ ${lotQty}`,
      );
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
          requestedBy: requestedBy || null,
          purpose: purpose || null,
          notes: notes || null,
          applyDefaultPanel,
          // Sample requisition — service decrements the source lot.
          sourceLotId: selectedLotId,
          sampleQty: totalSampleQty > 0 ? totalSampleQty : null,
          retainSampleQty: retainQty > 0 ? retainQty : null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('ลงทะเบียนไม่สำเร็จ', data.error || 'Unknown error');
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
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-4xl" data-testid="qc-new-form">
        <ResponsivePageHeader
          title="ลงทะเบียน + ขอเบิกตัวอย่าง QC"
          subtitle="เบิก lot กักกัน → ตัดสต็อก + ลงทะเบียนตัวอย่างในใบเดียว"
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
          {/* Request */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ผู้ขอเบิก / Request
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxTextBox
                label="ผู้ขอเบิก"
                value={requestedBy}
                onValueChange={setRequestedBy}
                placeholder="ชื่อผู้ขอเบิกตัวอย่าง"
              />
              <DxSelectBox
                label="วัตถุประสงค์"
                value={purpose}
                items={PURPOSE_OPTIONS}
                displayExpr="label"
                valueExpr="value"
                onValueChange={(v) => setPurpose(String(v ?? 'routine'))}
              />
            </div>
          </section>

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
                label="อ้างอิง (PO#, WO#, Lot#, ฯลฯ)"
                value={sourceRefText}
                onValueChange={setSourceRefText}
                placeholder="เช่น PO-2569-0438"
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
                  label="สินค้า (เฉพาะที่มี lot สถานะกักกัน)"
                  value={productId}
                  dataSource={productItems}
                  displayExpr="label"
                  valueExpr="id"
                  onValueChange={(v) => {
                    const next = v == null ? null : Number(v);
                    setProductId(next);
                    applyLotToForm(null);
                    if (!next) {
                      setStorageConditions('');
                      return;
                    }
                    const p = products.find((x) => x.id === next);
                    if (p?.storageCondition) setStorageConditions(p.storageCondition);
                    if (p?.primaryUnit && !unit) setUnit(p.primaryUnit);
                    const matchingLots = quarantineLots.filter((l) => l.itemId === next);
                    if (matchingLots.length === 1) applyLotToForm(matchingLots[0]);
                  }}
                  searchEnabled
                  required
                  noDataText="ไม่มีสินค้าในสถานะกักกัน"
                />
                {productItems.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ยังไม่มี lot ในสถานะ &quot;กักกัน&quot; — กรุณาตรวจสอบที่ /inventory
                  </p>
                )}
              </div>

              {productId && lotsForProduct.length > 1 && (
                <div className="md:col-span-2">
                  <DxSelectBox
                    label={`เลือก Lot (${lotsForProduct.length} lots ในสถานะกักกัน)`}
                    value={selectedLotId}
                    dataSource={lotItems}
                    displayExpr="label"
                    valueExpr="id"
                    onValueChange={(v) => {
                      const next = v == null ? null : Number(v);
                      const lot = next ? lotsForProduct.find((l) => l.id === next) : null;
                      applyLotToForm(lot ?? null);
                    }}
                    required
                    placeholder="กรุณาเลือก lot"
                  />
                </div>
              )}

              {productId && lotsForProduct.length === 1 && selectedLotId && (
                <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs text-emerald-800">
                  Lot เดียวในสถานะกักกัน: <strong>{lotsForProduct[0].lotNumber}</strong> — ดึงข้อมูลให้อัตโนมัติ
                </div>
              )}

              <DxTextBox
                label="Lot Number"
                value={lotNumber}
                onValueChange={setLotNumber}
                placeholder="เช่น BG-2026-0070"
                readOnly={selectedLotId != null}
              />
              <div className="grid grid-cols-2 gap-3">
                <DxNumberBox
                  label="จำนวนคงเหลือใน lot"
                  value={quantityReceived}
                  onValueChange={(v) => setQuantityReceived(v ?? null)}
                  readOnly={selectedLotId != null}
                />
                <DxTextBox
                  label="หน่วย"
                  value={unit}
                  onValueChange={setUnit}
                  placeholder="kg, g, capsule..."
                  readOnly={selectedLotId != null}
                />
              </div>
              <DxDateBox
                label="วันที่ผลิต"
                value={manufactureDate}
                onValueChange={(v) => setManufactureDate(v || '')}
                readOnly={selectedLotId != null}
              />
              <DxDateBox
                label="วันหมดอายุ"
                value={expiryDate}
                onValueChange={(v) => setExpiryDate(v || '')}
                readOnly={selectedLotId != null}
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

          {/* Sample-size calc — only when a panel exists for the product */}
          {productId && panel.length > 0 && (
            <section data-testid="sample-size-section">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                คำนวณจำนวนสุ่ม / Sample size
              </h2>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2 font-medium">ทดสอบ</th>
                      <th className="text-left p-2 font-medium">วิธีคำนวณ</th>
                      <th className="text-right p-2 font-medium w-28">จำนวนสุ่ม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.map((t) => {
                      const cfg = testCfg[t.criteriaId] ?? {
                        selected: true,
                        mode: 'usp' as SampleMode,
                        fixedQty: t.criteriaSampleSize ?? 1,
                      };
                      const qty = computeSampleSize(t.criteriaSampleSize ?? 1, cfg, lotQty);
                      return (
                        <tr key={t.criteriaId} className="border-t border-gray-100">
                          <td className="p-2">
                            <label className="flex items-center gap-2">
                              <DxCheckBox
                                value={cfg.selected}
                                onValueChange={(v) =>
                                  updateCfg(t.criteriaId, { selected: Boolean(v) })
                                }
                              />
                              <span>
                                {t.criteriaNameTh || t.criteriaName || t.criteriaCode}
                                {t.criteriaCode && (
                                  <span className="text-xs text-gray-400 ml-1">
                                    ({t.criteriaCode})
                                  </span>
                                )}
                              </span>
                            </label>
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {MODE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  disabled={!cfg.selected}
                                  onClick={() => updateCfg(t.criteriaId, { mode: opt.key })}
                                  className={`px-2 py-1 text-xs rounded border ${
                                    cfg.mode === opt.key
                                      ? 'bg-cyan-600 text-white border-cyan-600'
                                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                  } ${!cfg.selected ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                              {cfg.mode === 'fixed' && cfg.selected && (
                                <input
                                  type="number"
                                  min={0}
                                  value={cfg.fixedQty}
                                  onChange={(e) =>
                                    updateCfg(t.criteriaId, {
                                      fixedQty: Number(e.target.value),
                                    })
                                  }
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono">{qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Buffer + totals */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 whitespace-nowrap">
                    Buffer (เผื่อทดสอบซ้ำ)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bufferPct}
                    onChange={(e) => setBufferPct(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12 text-right">{bufferPct}%</span>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">รวมจำนวนสุ่ม</span>
                    <span className="font-mono" data-testid="test-sample-sum">
                      {testSampleSum}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Buffer</span>
                    <span className="font-mono">+{bufferQty}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-cyan-200 mt-1 pt-1">
                    <span>ต้องเบิกทดสอบรวม</span>
                    <span className="font-mono" data-testid="total-sample-qty">
                      {totalSampleQty} {unit}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Retain sample */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ตัวอย่างคงคลัง / Retain sample
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxNumberBox
                label="จำนวน retain"
                value={retainSampleQty}
                onValueChange={(v) => setRetainSampleQty(v ?? null)}
                min={0}
              />
              <DxTextBox
                label="ที่เก็บ / Storage location"
                value={retainStorage}
                onValueChange={setRetainStorage}
                placeholder="เช่น WH-RETAIN-01"
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

          {/* Stock-exceeded warning */}
          {exceedsStock && (
            <div
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
              data-testid="stock-warning"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                จำนวนที่ต้องเบิก ({totalDraw} {unit}) เกินคงเหลือใน lot ({lotQty} {unit}) —
                ลดจำนวนสุ่ม / buffer / retain
              </span>
            </div>
          )}

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
              disabled={submitting || !productId || exceedsStock}
            />
          </div>
        </div>
      </div>
    </>
  );
}
