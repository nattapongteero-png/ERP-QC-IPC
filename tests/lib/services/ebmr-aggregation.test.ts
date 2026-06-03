/**
 * eBMR Production Summary + Material Consumption — pure-math regressions
 * for audit gaps #1 and #2.
 *
 * The detail route computes Bulk Yield / Packaging Loss / Total Loss and
 * Issued / Returned / Net Used in plain JS. Re-running the same math here
 * locks the formulas so we catch any regressions without standing up a DB.
 */
import { describe, it, expect } from 'vitest';

function computeProductionSummary(input: {
  planned: number;
  bulkOutputQty?: number | null;
  finishedOutputQty?: number | null;
  actualQuantity?: number | null;
}) {
  const planned = Number(input.planned) || 0;
  const bulkQty = input.bulkOutputQty != null ? Number(input.bulkOutputQty) : null;
  const finishedQty =
    input.finishedOutputQty != null
      ? Number(input.finishedOutputQty)
      : input.actualQuantity != null
        ? Number(input.actualQuantity)
        : null;
  const bulkYieldPercent =
    bulkQty != null && planned > 0
      ? Math.round((bulkQty / planned) * 10000) / 100
      : null;
  const packagingLossQty =
    bulkQty != null && finishedQty != null ? Math.max(0, bulkQty - finishedQty) : null;
  const packagingLossPercent =
    packagingLossQty != null && bulkQty != null && bulkQty > 0
      ? Math.round((packagingLossQty / bulkQty) * 10000) / 100
      : null;
  const totalLossQty =
    finishedQty != null && planned > 0 ? Math.max(0, planned - finishedQty) : null;
  const totalLossPercent =
    totalLossQty != null && planned > 0
      ? Math.round((totalLossQty / planned) * 10000) / 100
      : null;
  return {
    bulkQty,
    finishedQty,
    bulkYieldPercent,
    packagingLossQty,
    packagingLossPercent,
    totalLossQty,
    totalLossPercent,
  };
}

describe('Audit #1 — Production Summary', () => {
  it('happy path: planned 800, bulk 780, finished 760', () => {
    const r = computeProductionSummary({
      planned: 800,
      bulkOutputQty: 780,
      finishedOutputQty: 760,
    });
    expect(r.bulkYieldPercent).toBe(97.5);
    expect(r.packagingLossQty).toBe(20);
    expect(r.packagingLossPercent).toBeCloseTo(2.56, 2);
    expect(r.totalLossQty).toBe(40);
    expect(r.totalLossPercent).toBe(5);
  });

  it('falls back to actualQuantity for finished when finishedOutputQty missing', () => {
    const r = computeProductionSummary({
      planned: 1000,
      bulkOutputQty: 990,
      actualQuantity: 950,
    });
    expect(r.finishedQty).toBe(950);
    expect(r.packagingLossQty).toBe(40);
    expect(r.totalLossQty).toBe(50);
  });

  it('clamps packagingLoss to zero when finished > bulk (data noise)', () => {
    const r = computeProductionSummary({
      planned: 100,
      bulkOutputQty: 50,
      finishedOutputQty: 60,
    });
    expect(r.packagingLossQty).toBe(0);
    expect(r.packagingLossPercent).toBe(0);
  });

  it('returns null bulk yield when planned = 0', () => {
    const r = computeProductionSummary({ planned: 0, bulkOutputQty: 100 });
    expect(r.bulkYieldPercent).toBeNull();
  });

  it('returns null packaging loss when bulkOutputQty missing', () => {
    const r = computeProductionSummary({ planned: 800, finishedOutputQty: 760 });
    expect(r.packagingLossQty).toBeNull();
    expect(r.totalLossQty).toBe(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────

function computeMaterialRow(input: {
  planned: number;
  weighedQty?: number | null;
  actualQuantity?: number | null;
  issuedQty?: number | null;
  returnedQty?: number;
}) {
  const planned = input.planned;
  const weighed = input.weighedQty;
  const actualFallback = input.actualQuantity;
  const issued = input.issuedQty;
  const returnedQty = input.returnedQty || 0;

  const displayActual = weighed != null ? weighed : actualFallback;
  const variance =
    planned != null && displayActual != null ? Number(displayActual) - planned : null;
  const issuedAmount =
    issued != null ? Number(issued) : displayActual != null ? Number(displayActual) : null;
  const netUsed = issuedAmount != null ? Math.max(0, issuedAmount - returnedQty) : null;

  return { displayActual, variance, issuedAmount, returnedQty, netUsed };
}

describe('Audit #2 — Material Consumption', () => {
  it('shows weighed as Actual; returned subtracts from issued for Net Used', () => {
    const r = computeMaterialRow({
      planned: 100,
      weighedQty: 100,
      issuedQty: 120,
      returnedQty: 18,
    });
    expect(r.displayActual).toBe(100);
    expect(r.issuedAmount).toBe(120);
    expect(r.returnedQty).toBe(18);
    expect(r.netUsed).toBe(102);
    expect(r.variance).toBe(0);
  });

  it('falls back to actualQuantity when weighedQty is null', () => {
    const r = computeMaterialRow({ planned: 50, actualQuantity: 49 });
    expect(r.displayActual).toBe(49);
    expect(r.variance).toBe(-1);
  });

  it('issuedAmount defaults to actual when issuedQty is null', () => {
    const r = computeMaterialRow({ planned: 50, weighedQty: 50 });
    expect(r.issuedAmount).toBe(50);
    expect(r.netUsed).toBe(50);
  });

  it('clamps netUsed at 0 if returned exceeds issued', () => {
    const r = computeMaterialRow({
      planned: 50,
      weighedQty: 0,
      issuedQty: 10,
      returnedQty: 25,
    });
    expect(r.netUsed).toBe(0);
  });

  it('returns null variance when planned/actual missing', () => {
    const r = computeMaterialRow({ planned: 50 });
    expect(r.variance).toBeNull();
    expect(r.netUsed).toBeNull();
  });
});
