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
import { useTranslations } from 'next-intl';
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
  { value: 'raw_material_lot', labelKey: 'qcEntry.new.sourceOptions.rawMaterialLot' },
  { value: 'work_order_batch', labelKey: 'qcEntry.new.sourceOptions.workOrderBatch' },
  { value: 'customer_return', labelKey: 'qcEntry.new.sourceOptions.customerReturn' },
  { value: 'stability', labelKey: 'qcEntry.new.sourceOptions.stability' },
  { value: 'purchased_herb', labelKey: 'qcEntry.new.sourceOptions.purchasedHerb' },
  { value: 'outgoing_shipment', labelKey: 'qcEntry.new.sourceOptions.outgoingShipment' },
  { value: 'other', labelKey: 'qcEntry.new.sourceOptions.other' },
];

const PURPOSE_OPTIONS = [
  { value: 'routine', labelKey: 'qcEntry.new.purposeOptions.routine' },
  { value: 'retest', labelKey: 'qcEntry.new.purposeOptions.retest' },
  { value: 'stability', labelKey: 'qcEntry.new.purposeOptions.stability' },
  { value: 'complaint', labelKey: 'qcEntry.new.purposeOptions.complaint' },
];

/** Per-test sampling mode shown in the sample-size table. */
const MODE_OPTIONS: { key: SampleMode; labelKey: string }[] = [
  { key: 'usp', labelKey: 'qcEntry.new.modeOptions.usp' },
  { key: 'sqrt', labelKey: 'qcEntry.new.modeOptions.sqrt' },
  { key: 'fixed', labelKey: 'qcEntry.new.modeOptions.fixed' },
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
  const t = useTranslations('quality');

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
  // sample-size table. Reset config so each product starts at the √n+1 plan.
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
            // Default to the pharmacopoeial √n+1 sampling plan (the standard the
            // QC team uses). Operators can switch a row to USP n or a fixed
            // count when a criterion calls for it.
            mode: 'sqrt',
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
      toast.error(t('qcEntry.new.toast.selectProduct'));
      return;
    }
    if (!receivedDate) {
      toast.error(t('qcEntry.new.toast.selectReceivedDate'));
      return;
    }
    // COA requires these dates to be complete — enforce them at the source so
    // a finished COA never shows "—" for Manufacture/Expiry.
    if (!manufactureDate) {
      toast.error(t('qcEntry.new.toast.requireManufactureDate'));
      return;
    }
    if (!expiryDate) {
      toast.error(t('qcEntry.new.toast.requireExpiryDate'));
      return;
    }
    // Retest date defaults to the expiry date when the operator leaves it blank
    // (herbal products are re-tested no later than expiry).
    const effectiveRetestDate = retestDate || expiryDate;
    if (exceedsStock) {
      toast.error(
        t('qcEntry.new.toast.exceedsStockTitle'),
        t('qcEntry.new.toast.exceedsStockDetail', { totalDraw, lotQty }),
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
          retestDate: effectiveRetestDate || null,
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
        toast.error(t('qcEntry.new.toast.registerFailed'), data.error || 'Unknown error');
        return;
      }
      toast.success(
        t('qcEntry.new.toast.registerSuccess'),
        t('qcEntry.new.toast.registerSuccessDetail', {
          sampleNumber: data.data?.sampleNumber || '',
          count: data.data?.testsSeeded ?? 0,
        }),
      );
      router.push(`/quality/qc-entry/${data.data?.sampleId}`);
    } catch (e) {
      toast.error(
        t('qcEntry.new.toast.registerFailed'),
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
          title={t('qcEntry.new.title')}
          subtitle={t('qcEntry.new.subtitle')}
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
              text={t('qcEntry.new.actions.cancel')}
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
              {t('qcEntry.new.sections.request')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxTextBox
                label={t('qcEntry.new.fields.requestedBy')}
                value={requestedBy}
                onValueChange={setRequestedBy}
                placeholder={t('qcEntry.new.placeholders.requestedBy')}
              />
              <DxSelectBox
                label={t('qcEntry.new.fields.purpose')}
                value={purpose}
                items={PURPOSE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                displayExpr="label"
                valueExpr="value"
                onValueChange={(v) => setPurpose(String(v ?? 'routine'))}
              />
            </div>
          </section>

          {/* Source */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {t('qcEntry.new.sections.source')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxSelectBox
                label={t('qcEntry.new.fields.sourceType')}
                value={sourceType}
                items={SOURCE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                displayExpr="label"
                valueExpr="value"
                onValueChange={(v) => setSourceType(String(v ?? ''))}
                required
              />
              <DxTextBox
                label={t('qcEntry.new.fields.sourceRef')}
                value={sourceRefText}
                onValueChange={setSourceRefText}
                placeholder={t('qcEntry.new.placeholders.sourceRef')}
              />
            </div>
          </section>

          {/* Product */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {t('qcEntry.new.sections.product')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <DxSelectBox
                  label={t('qcEntry.new.fields.product')}
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
                  noDataText={t('qcEntry.new.noProductInQuarantine')}
                />
                {productItems.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t('qcEntry.new.noLotInQuarantineHint')}
                  </p>
                )}
              </div>

              {productId && lotsForProduct.length > 1 && (
                <div className="md:col-span-2">
                  <DxSelectBox
                    label={t('qcEntry.new.selectLotLabel', { count: lotsForProduct.length })}
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
                    placeholder={t('qcEntry.new.placeholders.selectLot')}
                  />
                </div>
              )}

              {productId && lotsForProduct.length === 1 && selectedLotId && (
                <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs text-emerald-800">
                  {t('qcEntry.new.singleLotPrefix')}: <strong>{lotsForProduct[0].lotNumber}</strong> — {t('qcEntry.new.singleLotSuffix')}
                </div>
              )}

              <DxTextBox
                label={t('qcEntry.new.fields.lotNumber')}
                value={lotNumber}
                onValueChange={setLotNumber}
                placeholder={t('qcEntry.new.placeholders.lotNumber')}
                readOnly={selectedLotId != null}
              />
              <div className="grid grid-cols-2 gap-3">
                <DxNumberBox
                  label={t('qcEntry.new.fields.quantityRemaining')}
                  value={quantityReceived}
                  onValueChange={(v) => setQuantityReceived(v ?? null)}
                  readOnly={selectedLotId != null}
                />
                <DxTextBox
                  label={t('qcEntry.new.fields.unit')}
                  value={unit}
                  onValueChange={setUnit}
                  placeholder="kg, g, capsule..."
                  readOnly={selectedLotId != null}
                />
              </div>
              <DxDateBox
                label={t('qcEntry.new.fields.manufactureDate')}
                value={manufactureDate}
                onValueChange={(v) => setManufactureDate(v || '')}
                readOnly={selectedLotId != null}
              />
              <DxDateBox
                label={t('qcEntry.new.fields.expiryDate')}
                value={expiryDate}
                onValueChange={(v) => setExpiryDate(v || '')}
                readOnly={selectedLotId != null}
              />
              <div>
                <DxDateBox
                  label={t('qcEntry.new.fields.retestDate')}
                  value={retestDate}
                  onValueChange={(v) => setRetestDate(v || '')}
                />
                {!retestDate && expiryDate ? (
                  <p className="mt-1 text-[11px] text-gray-500">
                    {t('qcEntry.new.hints.retestDefaultsToExpiry')}
                  </p>
                ) : null}
              </div>
              <DxTextBox
                label={t('qcEntry.new.fields.storage')}
                value={storageConditions}
                onValueChange={setStorageConditions}
                placeholder={t('qcEntry.new.placeholders.storage')}
              />
            </div>
          </section>

          {/* Sample-size calc — only when a panel exists for the product */}
          {productId && panel.length > 0 && (
            <section data-testid="sample-size-section">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                {t('qcEntry.new.sections.sampleSize')}
              </h2>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2 font-medium">{t('qcEntry.new.sampleSizeTable.test')}</th>
                      <th className="text-left p-2 font-medium">{t('qcEntry.new.sampleSizeTable.method')}</th>
                      <th className="text-right p-2 font-medium w-28">{t('qcEntry.new.sampleSizeTable.sampleCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.map((row) => {
                      const cfg = testCfg[row.criteriaId] ?? {
                        selected: true,
                        mode: 'sqrt' as SampleMode,
                        fixedQty: row.criteriaSampleSize ?? 1,
                      };
                      const qty = computeSampleSize(row.criteriaSampleSize ?? 1, cfg, lotQty);
                      return (
                        <tr key={row.criteriaId} className="border-t border-gray-100">
                          <td className="p-2">
                            <label className="flex items-center gap-2">
                              <DxCheckBox
                                value={cfg.selected}
                                onValueChange={(v) =>
                                  updateCfg(row.criteriaId, { selected: Boolean(v) })
                                }
                              />
                              <span>
                                {row.criteriaNameTh || row.criteriaName || row.criteriaCode}
                                {row.criteriaCode && (
                                  <span className="text-xs text-gray-400 ml-1">
                                    ({row.criteriaCode})
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
                                  onClick={() => updateCfg(row.criteriaId, { mode: opt.key })}
                                  className={`px-2 py-1 text-xs rounded border ${
                                    cfg.mode === opt.key
                                      ? 'bg-cyan-600 text-white border-cyan-600'
                                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                  } ${!cfg.selected ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  {t(opt.labelKey)}
                                </button>
                              ))}
                              {cfg.mode === 'fixed' && cfg.selected && (
                                <input
                                  type="number"
                                  min={0}
                                  value={cfg.fixedQty}
                                  onChange={(e) =>
                                    updateCfg(row.criteriaId, {
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
                    {t('qcEntry.new.bufferLabel')}
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
                    <span className="text-gray-600">{t('qcEntry.new.totals.sampleSum')}</span>
                    <span className="font-mono" data-testid="test-sample-sum">
                      {testSampleSum}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Buffer</span>
                    <span className="font-mono">+{bufferQty}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-cyan-200 mt-1 pt-1">
                    <span>{t('qcEntry.new.totals.totalDraw')}</span>
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
              {t('qcEntry.new.sections.retainSample')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxNumberBox
                label={t('qcEntry.new.fields.retainQty')}
                value={retainSampleQty}
                onValueChange={(v) => setRetainSampleQty(v ?? null)}
                min={0}
              />
              <DxTextBox
                label={t('qcEntry.new.fields.retainStorage')}
                value={retainStorage}
                onValueChange={setRetainStorage}
                placeholder={t('qcEntry.new.placeholders.retainStorage')}
              />
            </div>
          </section>

          {/* Outgoing only — customer & SO */}
          {isOutgoing && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                {t('qcEntry.new.sections.customer')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DxSelectBox
                  label={t('qcEntry.new.fields.customer')}
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
                  placeholder={t('qcEntry.new.placeholders.salesOrderRef')}
                />
              </div>
            </section>
          )}

          {/* Receipt + notes */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {t('qcEntry.new.sections.receipt')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DxDateBox
                label={t('qcEntry.new.fields.receivedDate')}
                value={receivedDate}
                onValueChange={(v) => setReceivedDate(v || '')}
              />
            </div>
            <div className="mt-4">
              <DxTextArea
                label={t('qcEntry.new.fields.notes')}
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
                  {t('qcEntry.new.applyDefaultPanelLabel')}
                </label>
                <p className="text-xs text-cyan-700 mt-0.5">
                  {t('qcEntry.new.applyDefaultPanelHint')}
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
                {t('qcEntry.new.stockWarning', { totalDraw, unit, lotQty })}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <DxButton
              text={t('qcEntry.new.actions.cancel')}
              stylingMode="outlined"
              onClick={() => router.push('/quality/qc-entry')}
              disabled={submitting}
            />
            <DxButton
              text={submitting ? t('qcEntry.new.actions.saving') : t('qcEntry.new.actions.register')}
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
