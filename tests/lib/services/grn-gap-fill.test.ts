/**
 * The gap-fill boundary on a QC-approved (locked) GRN line.
 *
 * Lines signed before mfg/expiry were mandatory carry NULLs that nothing could
 * correct afterwards, so the dates were missing from the lot and from บันทึก QC
 * permanently. A locked line may now have a BLANK identity field completed — but
 * that opening must never become a way to amend an approved record, so these
 * tests pin the rule from both sides.
 */
import { describe, it, expect } from 'vitest';
import {
  isGapFillPatch,
  GRN_GAP_FILLABLE_FIELDS,
  GRN_LINE_EDITABLE_STATUSES,
} from '@/lib/services/goods-receipt.service';

/** A locked line that was signed without its dates. */
const BLANK_LINE = {
  id: 85,
  status: 'qc_approved',
  vendorLotNumber: null,
  batchNumber: null,
  manufacturingDate: null,
  expiryDate: null,
  actualQuantity: 11,
  expectedQuantity: 11,
};

/** A locked line that already has its identity recorded. */
const RECORDED_LINE = {
  ...BLANK_LINE,
  vendorLotNumber: 'V-123',
  manufacturingDate: '2026-06-01',
  expiryDate: '2028-06-01',
};

describe('isGapFillPatch — what a locked line WILL accept', () => {
  it('accepts filling both missing dates', () => {
    expect(isGapFillPatch(BLANK_LINE, { manufacturingDate: '2026-06-01', expiryDate: '2028-06-01' })).toBe(true);
  });

  it('accepts filling a single blank field', () => {
    expect(isGapFillPatch(BLANK_LINE, { manufacturingDate: '2026-06-01' })).toBe(true);
    expect(isGapFillPatch(BLANK_LINE, { vendorLotNumber: 'V-9' })).toBe(true);
    expect(isGapFillPatch(BLANK_LINE, { batchNumber: 'B-9' })).toBe(true);
  });

  it('ignores keys explicitly set to undefined', () => {
    expect(
      isGapFillPatch(BLANK_LINE, { manufacturingDate: '2026-06-01', actualQuantity: undefined }),
    ).toBe(true);
  });
});

describe('isGapFillPatch — what a locked line MUST refuse', () => {
  it('refuses overwriting a value that is already recorded', () => {
    expect(isGapFillPatch(RECORDED_LINE, { manufacturingDate: '2020-01-01' })).toBe(false);
    expect(isGapFillPatch(RECORDED_LINE, { vendorLotNumber: 'SOMETHING-ELSE' })).toBe(false);
  });

  it('refuses blanking a recorded value', () => {
    expect(isGapFillPatch(RECORDED_LINE, { manufacturingDate: null })).toBe(false);
    expect(isGapFillPatch(RECORDED_LINE, { vendorLotNumber: '' })).toBe(false);
  });

  it('refuses blanking an already-blank field (nothing to fill)', () => {
    expect(isGapFillPatch(BLANK_LINE, { manufacturingDate: null })).toBe(false);
    expect(isGapFillPatch(BLANK_LINE, { manufacturingDate: '' })).toBe(false);
  });

  it('refuses quantity changes — the whole point of the lock', () => {
    expect(isGapFillPatch(BLANK_LINE, { actualQuantity: 999 })).toBe(false);
  });

  it('refuses a legal fill smuggled in beside an illegal field', () => {
    expect(
      isGapFillPatch(BLANK_LINE, { manufacturingDate: '2026-06-01', actualQuantity: 999 }),
    ).toBe(false);
    expect(
      isGapFillPatch(BLANK_LINE, { expiryDate: '2028-06-01', varianceReason: 'because' }),
    ).toBe(false);
  });

  it('refuses an empty patch', () => {
    expect(isGapFillPatch(BLANK_LINE, {})).toBe(false);
    expect(isGapFillPatch(BLANK_LINE, { manufacturingDate: undefined })).toBe(false);
  });

  it('refuses fields outside the identity set even when blank on the line', () => {
    expect(isGapFillPatch({ ...BLANK_LINE, varianceReason: null }, { varianceReason: 'x' })).toBe(false);
    expect(isGapFillPatch({ ...BLANK_LINE, status: null }, { status: 'released_to_stock' })).toBe(false);
  });
});

describe('rule surface', () => {
  it('only lot-identity fields are gap fillable', () => {
    expect([...GRN_GAP_FILLABLE_FIELDS].sort()).toEqual(
      ['batchNumber', 'expiryDate', 'manufacturingDate', 'vendorLotNumber'].sort(),
    );
  });

  it('the freely-editable window ends before QC approval', () => {
    expect(GRN_LINE_EDITABLE_STATUSES).toEqual(['created', 'checklist_done', 'qc_pending']);
    expect(GRN_LINE_EDITABLE_STATUSES).not.toContain('qc_approved');
    expect(GRN_LINE_EDITABLE_STATUSES).not.toContain('released_to_stock');
  });
});
