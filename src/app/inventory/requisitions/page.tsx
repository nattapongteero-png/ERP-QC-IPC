'use client';

/**
 * Material Requisitions Inbox
 *
 * Warehouse-facing list of pending material requisitions submitted by Production
 * (WO.requisitionStatus = 'requested' → 'approved').
 *
 * The "issuance plan" column applies `calculateIssuance` to round up to whole
 * Primary Units for items with weight-tracking enabled — so the operator knows
 * to pull e.g. "2 boxes" rather than "1,750 capsules" from the warehouse.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Package,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Scale,
  X,
  Filter,
} from 'lucide-react';
import {
  calculateIssuance,
  type UnitConfig,
} from '@/lib/utils/unit-conversion';

interface MaterialRow {
  materialId: number;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  itemUnit: string | null;
  secondaryUnit: string | null;
  conversionRate: number | string | null;
  weightUnit: string | null;
  secondaryToWeightRate: number | string | null;
  weightTrackingEnabled: boolean | number | null;
  status: string | null;
  onHand: number | string | null;
  releasedAvailable: number;
  stockAtApproval: number | string | null;
}

interface RequisitionRow {
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  productName: string | null;
  productCode: string | null;
  plannedQuantity: number;
  unit: string;
  requisitionStatus: 'requested' | 'approved';
  requestedBy: string | null;
  requestedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  materials: MaterialRow[];
}

const STATUS_OPTIONS = [
  { value: 'requested', label: 'รออนุมัติ (Requested)' },
  { value: 'approved', label: 'อนุมัติแล้ว (Approved)' },
  { value: 'all', label: 'ทั้งหมด' },
];

function formatDateTh(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

/**
 * Reduce a material row into a {needed, issuance, status} summary.
 * Returns null when the item is not weight-tracked or required fields are missing —
 * the caller should fall back to plain "plannedQty unit" display.
 */
function planIssuance(mat: MaterialRow): {
  puToIssue: number;
  actualIssuedSU: number;
  remainderSU: number;
  pu: string;
  su: string;
} | null {
  const tracked = !!mat.weightTrackingEnabled;
  const ratio1 = Number(mat.conversionRate);
  if (!tracked || !Number.isFinite(ratio1) || ratio1 <= 0) return null;
  if (!mat.secondaryUnit || !mat.itemUnit) return null;

  // plannedQuantity is in `unit` (BOM line unit). Coerce it to SU before issuance:
  // - if BOM unit == secondaryUnit → already SU
  // - if BOM unit == primaryUnit → multiply by ratio1
  // - otherwise: bail (we'd be guessing)
  let plannedSU: number;
  if (mat.unit === mat.secondaryUnit) {
    plannedSU = Number(mat.plannedQuantity);
  } else if (mat.unit === mat.itemUnit) {
    plannedSU = Number(mat.plannedQuantity) * ratio1;
  } else {
    return null;
  }
  if (!Number.isFinite(plannedSU) || plannedSU <= 0) return null;

  const config: UnitConfig = {
    primaryUnit: mat.itemUnit,
    secondaryUnit: mat.secondaryUnit,
    weightUnit: mat.weightUnit,
    conversionRate: ratio1,
    secondaryToWeightRate: Number(mat.secondaryToWeightRate) || null,
    weightTrackingEnabled: true,
  };

  try {
    const r = calculateIssuance(plannedSU, config);
    return {
      puToIssue: r.puToIssue,
      actualIssuedSU: r.actualIssuedSU,
      remainderSU: r.remainderSU,
      pu: mat.itemUnit,
      su: mat.secondaryUnit,
    };
  } catch {
    return null;
  }
}

/**
 * Stock-sufficiency check for one material row.
 *
 * releasedAvailable comes back from the API in PRIMARY unit (it sums
 * inventory_lots which are always stored in primary). plannedQuantity is
 * in the BOM line's own unit — could be primary, secondary, or weight.
 * Raw `available < planned` is wrong whenever those units differ: e.g.
 * 11.2 box of capsules vs planned 170,000 cap → 11.2 < 170000 reads as
 * "insufficient" even though 11.2 box = 1,120,000 cap is plenty.
 *
 * We coerce planned into primary unit using the conversion chain
 * (SU → PU via conversionRate; WU → SU → PU via secondaryToWeightRate
 * then conversionRate) and compare in primary.
 */
function plannedInPrimary(mat: MaterialRow): number {
  const planned = Number(mat.plannedQuantity);
  if (!Number.isFinite(planned)) return 0;

  const ratio1 = Number(mat.conversionRate);
  const ratio2 = Number(mat.secondaryToWeightRate);

  if (mat.unit === mat.itemUnit) return planned;
  if (mat.unit === mat.secondaryUnit && ratio1 > 0) return planned / ratio1;
  if (mat.unit === mat.weightUnit && ratio1 > 0 && ratio2 > 0) {
    return planned / ratio2 / ratio1;
  }
  // Unknown unit pairing — fall back to raw value rather than guess.
  return planned;
}

function isInsufficient(mat: MaterialRow): boolean {
  return Number(mat.releasedAvailable) < plannedInPrimary(mat);
}

export default function MaterialRequisitionsInboxPage() {
  const toast = useToast();
  const [rows, setRows] = useState<RequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>('');     // YYYY-MM-DD
  const [insufficientOnly, setInsufficientOnly] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [approving, setApproving] = useState<Set<number>>(new Set());

  // Date preset helpers — set BOTH from/to so a chip shows the active range.
  const setDatePreset = (preset: 'today' | 'last7' | 'last30' | 'thisMonth') => {
    const today = new Date();
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (preset === 'today') {
      const s = ymd(today);
      setDateFrom(s); setDateTo(s);
    } else if (preset === 'last7') {
      const from = new Date(today); from.setDate(from.getDate() - 6);
      setDateFrom(ymd(from)); setDateTo(ymd(today));
    } else if (preset === 'last30') {
      const from = new Date(today); from.setDate(from.getDate() - 29);
      setDateFrom(ymd(from)); setDateTo(ymd(today));
    } else if (preset === 'thisMonth') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(ymd(from)); setDateTo(ymd(today));
    }
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setInsufficientOnly(false);
  };

  // Count active filters (status defaults to 'all', so only non-default counts)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== 'all') n++;
    if (search.trim()) n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    if (insufficientOnly) n++;
    return n;
  }, [statusFilter, search, dateFrom, dateTo, insufficientOnly]);

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      // Always load ALL statuses so the KPI cards reflect true totals; the
      // status dropdown / clickable cards filter the list on the client.
      const res = await fetch(`/api/inventory/requisitions?status=all`);
      const data = await res.json();
      if (data.success) {
        setRows((data.data ?? []) as RequisitionRow[]);
      } else {
        toast.error('โหลดข้อมูลใบเบิกไม่สำเร็จ', data.error || '');
      }
    } catch (err) {
      toast.error('โหลดข้อมูลใบเบิกไม่สำเร็จ', String(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Build the date window once (inclusive on both ends, full day on the
    // "to" date so something requested at 17:00 still shows when "to" is
    // the same day).
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.requisitionStatus !== statusFilter) return false;
      if (q) {
        const matchesSearch =
          r.woNumber.toLowerCase().includes(q) ||
          r.batchNumber.toLowerCase().includes(q) ||
          (r.productName ?? '').toLowerCase().includes(q) ||
          (r.productCode ?? '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (fromTs !== null || toTs !== null) {
        if (!r.requestedAt) return false; // can't include records with no timestamp
        const ts = new Date(r.requestedAt).getTime();
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
      }
      if (insufficientOnly) {
        if (!r.materials.some(isInsufficient)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search, dateFrom, dateTo, insufficientOnly]);

  const stats = useMemo(() => {
    const requested = rows.filter((r) => r.requisitionStatus === 'requested').length;
    const approved = rows.filter((r) => r.requisitionStatus === 'approved').length;
    const insufficient = rows.filter((r) =>
      r.materials.some(isInsufficient)
    ).length;
    return { requested, approved, insufficient };
  }, [rows]);

  const toggle = (woId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId);
      else next.add(woId);
      return next;
    });

  const approve = async (woId: number) => {
    setApproving((prev) => new Set(prev).add(woId));
    try {
      const res = await fetch(`/api/production/work-orders/${woId}/requisition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        const issued = (data.data?.issued ?? []) as { itemCode: string; puToIssue: number; pu: string; suIssued: number; su: string }[];
        if (issued.length > 0) {
          const lines = issued
            .map((i) => `• ${i.itemCode}: ปล่อย ${i.puToIssue.toLocaleString()} ${i.pu} (= ${i.suIssued.toLocaleString()} ${i.su})`)
            .join('\n');
          toast.success('อนุมัติและปล่อยของแล้ว', lines);
        } else {
          toast.success('อนุมัติใบเบิกสำเร็จ');
        }
        await fetchRequisitions();
      } else {
        toast.error('อนุมัติไม่สำเร็จ', data.error || '');
      }
    } catch (err) {
      toast.error('อนุมัติไม่สำเร็จ', String(err));
    } finally {
      setApproving((prev) => {
        const next = new Set(prev);
        next.delete(woId);
        return next;
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <ResponsivePageHeader
          title="ใบเบิกวัตถุดิบ"
          subtitle="รายการใบเบิกที่ฝ่ายผลิตส่งมา — คลังตรวจสอบและอนุมัติ"
          icon={ClipboardList}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="รออนุมัติ"
            value={stats.requested}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
            onClick={() => { setStatusFilter('requested'); setInsufficientOnly(false); }}
          />
          <StatCard
            label="อนุมัติแล้ว"
            value={stats.approved}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
            onClick={() => { setStatusFilter('approved'); setInsufficientOnly(false); }}
          />
          <StatCard
            label="วัตถุดิบไม่พอ"
            value={stats.insufficient}
            icon={AlertTriangle}
            iconColor={stats.insufficient > 0 ? 'text-red-500' : 'text-gray-400'}
            accentColor={stats.insufficient > 0 ? 'border-red-500' : 'border-gray-300'}
            onClick={() => { setStatusFilter('all'); setInsufficientOnly(true); }}
          />
        </div>

        <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-3">
          {/* Row 1: status + search + refresh */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-56">
              <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
              <DxSelectBox
                items={STATUS_OPTIONS}
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as string)}
                valueExpr="value"
                displayExpr="label"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-500 mb-1">ค้นหา</label>
              <DxTextBox
                value={search}
                onValueChange={(v) => setSearch(String(v ?? ''))}
                placeholder="WO / Batch / Product"
              />
            </div>
            <DxButton
              text="รีเฟรช"
              icon="refresh"
              type="normal"
              stylingMode="outlined"
              onClick={fetchRequisitions}
            />
          </div>

          {/* Row 2: date range + quick presets */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-44">
              <label className="block text-xs text-gray-500 mb-1">ขอเบิกตั้งแต่</label>
              <DxDateBox
                value={dateFrom}
                onValueChange={(v) => setDateFrom(v ?? '')}
                placeholder="วันที่เริ่ม"
                showClearButton
              />
            </div>
            <div className="w-44">
              <label className="block text-xs text-gray-500 mb-1">ถึง</label>
              <DxDateBox
                value={dateTo}
                onValueChange={(v) => setDateTo(v ?? '')}
                placeholder="วันที่สิ้นสุด"
                showClearButton
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-400">ด่วน:</span>
              <button
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                onClick={() => setDatePreset('today')}
              >วันนี้</button>
              <button
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                onClick={() => setDatePreset('last7')}
              >7 วันล่าสุด</button>
              <button
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                onClick={() => setDatePreset('last30')}
              >30 วัน</button>
              <button
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                onClick={() => setDatePreset('thisMonth')}
              >เดือนนี้</button>
            </div>
            <div className="flex-1" />
            {/* Insufficient toggle */}
            <button
              onClick={() => setInsufficientOnly(!insufficientOnly)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                insufficientOnly
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              เฉพาะ stock ไม่พอ
            </button>
          </div>

          {/* Row 3: Active filter chips + clear all (only when filters are set) */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">ตัวกรองที่ใช้:</span>
              {statusFilter !== 'requested' && (
                <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  สถานะ: {STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}
                  <button onClick={() => setStatusFilter('requested')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {search.trim() && (
                <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  ค้นหา: &quot;{search}&quot;
                  <button onClick={() => setSearch('')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  วันที่: {dateFrom || '…'} ถึง {dateTo || '…'}
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }}><X className="h-3 w-3" /></button>
                </span>
              )}
              {insufficientOnly && (
                <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                  Stock ไม่พอ
                  <button onClick={() => setInsufficientOnly(false)}><X className="h-3 w-3" /></button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
              >ล้างทั้งหมด</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            กำลังโหลด...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-gray-400" />
            ไม่พบใบเบิกในเงื่อนไขที่เลือก
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((req) => {
              const isOpen = expanded.has(req.workOrderId);
              const insufficient = req.materials.some(isInsufficient);
              return (
                <div
                  key={req.workOrderId}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => toggle(req.workOrderId)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{req.woNumber}</div>
                        <div className="text-xs text-gray-500">Batch {req.batchNumber}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-900">{req.productName ?? '—'}</div>
                        <div className="text-xs text-gray-500">{req.productCode ?? ''}</div>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div>ขอเบิกโดย: {req.requestedBy ?? '—'}</div>
                        <div>{formatDateTh(req.requestedAt)}</div>
                      </div>
                      <div className="flex items-center gap-2 justify-start md:justify-end">
                        {insufficient && (
                          <Badge variant="danger" dot>
                            <AlertTriangle className="h-3 w-3 mr-1" /> ไม่พอ
                          </Badge>
                        )}
                        <Badge
                          variant={req.requisitionStatus === 'approved' ? 'success' : 'warning'}
                          dot
                        >
                          {req.requisitionStatus === 'approved'
                            ? 'อนุมัติแล้ว'
                            : 'รออนุมัติ'}
                        </Badge>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-xs text-gray-500 uppercase">
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 pr-3">รหัสสินค้า</th>
                              <th className="text-left py-2 px-3">ชื่อวัตถุดิบ</th>
                              <th className="text-right py-2 px-3">จำนวนที่ต้องการ</th>
                              <th className="text-right py-2 px-3">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <Scale className="h-3.5 w-3.5" /> จำนวนที่ต้องจ่าย
                                </div>
                              </th>
                              <th className="text-right py-2 pl-3">คงเหลือในคลัง</th>
                            </tr>
                          </thead>
                          <tbody>
                            {req.materials.map((mat) => {
                              const plan = planIssuance(mat);
                              const need = Number(mat.plannedQuantity);
                              const have = Number(mat.releasedAvailable);
                              // Compare in primary unit — have is already
                              // primary; coerce planned via plannedInPrimary()
                              // so the colour matches the badge logic.
                              const enough = have >= plannedInPrimary(mat);
                              const ratio1 = Number(mat.conversionRate);
                              const haveSU =
                                plan && Number.isFinite(ratio1) && ratio1 > 0
                                  ? have * ratio1
                                  : null;
                              return (
                                <tr
                                  key={mat.materialId}
                                  className="border-b border-gray-100 last:border-b-0"
                                >
                                  <td className="py-2 pr-3 font-medium text-gray-900">
                                    {mat.itemCode}
                                  </td>
                                  <td className="py-2 px-3 text-gray-700">{mat.itemName}</td>
                                  <td className="py-2 px-3 text-right">
                                    <span className="font-medium">
                                      {need.toLocaleString()}
                                    </span>{' '}
                                    <span className="text-gray-500">{mat.unit}</span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {plan ? (
                                      <div>
                                        <span className="font-semibold text-emerald-700">
                                          {plan.puToIssue.toLocaleString()} {plan.pu}
                                        </span>
                                        {plan.remainderSU > 0 && (
                                          <div className="text-xs text-amber-700">
                                            เหลือหน้างาน{' '}
                                            {plan.remainderSU.toLocaleString()} {plan.su}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-emerald-700">
                                        {need.toLocaleString()} {mat.unit}
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className={`py-2 pl-3 text-right ${
                                      enough ? 'text-gray-700' : 'text-red-600 font-semibold'
                                    }`}
                                  >
                                    <div>
                                      {have.toLocaleString()}{' '}
                                      <span className="text-gray-500 text-xs">
                                        {mat.itemUnit}
                                      </span>
                                    </div>
                                    {haveSU != null && plan && (
                                      <div className="text-xs text-gray-500">
                                        = {haveSU.toLocaleString()} {plan.su}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {req.requisitionStatus === 'requested' && (
                        <div className="flex items-center justify-end mt-4 gap-2">
                          <DxButton
                            text={approving.has(req.workOrderId) ? 'กำลังอนุมัติ...' : 'อนุมัติใบเบิก'}
                            icon="check"
                            type="success"
                            stylingMode="contained"
                            disabled={approving.has(req.workOrderId) || insufficient}
                            onClick={() => approve(req.workOrderId)}
                          />
                          {insufficient && (
                            <span className="text-xs text-red-600">
                              วัตถุดิบไม่พอ — ไม่สามารถอนุมัติได้
                            </span>
                          )}
                        </div>
                      )}

                      {req.requisitionStatus === 'approved' && (
                        <div className="flex items-center justify-end mt-4 text-xs text-gray-500">
                          อนุมัติโดย {req.approvedBy ?? '—'} · {formatDateTh(req.approvedAt)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
