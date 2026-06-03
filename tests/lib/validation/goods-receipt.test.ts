/**
 * Validation schema tests for Feature 020
 */
import { describe, it, expect } from 'vitest';
import {
  createGrnSchema,
  updateGrnLineSchema,
  signChecklistSchema,
  qaActionSchema,
  cancelGrnSchema,
  createChecklistTemplateSchema,
} from '@/lib/validation/goods-receipt';

describe('createGrnSchema', () => {
  it('accepts a valid PO source', () => {
    const ok = createGrnSchema.safeParse({
      sourceType: 'po',
      poId: 1,
      warehouseId: 1,
      receivedDate: '2026-06-03',
    });
    expect(ok.success).toBe(true);
  });

  it('accepts a valid WO source', () => {
    const ok = createGrnSchema.safeParse({
      sourceType: 'wo',
      woId: 5,
      warehouseId: 1,
      receivedDate: '2026-06-03',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects PO sourceType without poId', () => {
    const bad = createGrnSchema.safeParse({
      sourceType: 'po',
      warehouseId: 1,
      receivedDate: '2026-06-03',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects WO sourceType without woId', () => {
    const bad = createGrnSchema.safeParse({
      sourceType: 'wo',
      warehouseId: 1,
      receivedDate: '2026-06-03',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects mixed PO + WO IDs', () => {
    const bad = createGrnSchema.safeParse({
      sourceType: 'po',
      poId: 1,
      woId: 2,
      warehouseId: 1,
      receivedDate: '2026-06-03',
    });
    expect(bad.success).toBe(false);
  });
});

describe('updateGrnLineSchema', () => {
  it('accepts actual quantity update', () => {
    const ok = updateGrnLineSchema.safeParse({ actualQuantity: 99.5 });
    expect(ok.success).toBe(true);
  });

  it('rejects negative quantity', () => {
    const bad = updateGrnLineSchema.safeParse({ actualQuantity: -1 });
    expect(bad.success).toBe(false);
  });

  it('rejects expiry before manufacturing date', () => {
    const bad = updateGrnLineSchema.safeParse({
      manufacturingDate: '2026-12-01',
      expiryDate: '2026-06-01',
    });
    expect(bad.success).toBe(false);
  });

  it('accepts valid date ordering', () => {
    const ok = updateGrnLineSchema.safeParse({
      manufacturingDate: '2026-01-01',
      expiryDate: '2027-01-01',
    });
    expect(ok.success).toBe(true);
  });

  it('accepts only one of the two date fields', () => {
    const ok = updateGrnLineSchema.safeParse({ expiryDate: '2027-01-01' });
    expect(ok.success).toBe(true);
  });
});

describe('signChecklistSchema', () => {
  it('accepts a valid signed checklist', () => {
    const ok = signChecklistSchema.safeParse({
      items: [
        { templateItemId: 1, isPass: true },
        { templateItemId: 2, isPass: true, remarks: 'looks good' },
      ],
      signature: { password: 'pw' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an empty items array', () => {
    const bad = signChecklistSchema.safeParse({
      items: [],
      signature: { password: 'pw' },
    });
    expect(bad.success).toBe(false);
  });

  it('requires either password or PIN in signature', () => {
    const bad = signChecklistSchema.safeParse({
      items: [{ templateItemId: 1, isPass: true }],
      signature: {},
    });
    expect(bad.success).toBe(false);
  });

  it('accepts PIN-only signature', () => {
    const ok = signChecklistSchema.safeParse({
      items: [{ templateItemId: 1, isPass: true }],
      signature: { pin: '1234' },
    });
    expect(ok.success).toBe(true);
  });
});

describe('qaActionSchema', () => {
  it('accepts a release action without rejectionReason', () => {
    const ok = qaActionSchema.safeParse({
      action: 'release',
      signature: { password: 'pw' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a reject action without rejectionReason', () => {
    const bad = qaActionSchema.safeParse({
      action: 'reject',
      signature: { password: 'pw' },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a rejectionReason shorter than 10 chars', () => {
    const bad = qaActionSchema.safeParse({
      action: 'reject',
      rejectionReason: 'too short',
      signature: { password: 'pw' },
    });
    expect(bad.success).toBe(false);
  });

  it('accepts a valid reject action', () => {
    const ok = qaActionSchema.safeParse({
      action: 'reject',
      rejectionReason: 'Visual contamination detected on lot surface',
      signature: { password: 'pw' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects invalid action value', () => {
    const bad = qaActionSchema.safeParse({
      action: 'maybe',
      signature: { password: 'pw' },
    });
    expect(bad.success).toBe(false);
  });
});

describe('cancelGrnSchema', () => {
  it('requires reason ≥10 chars', () => {
    const bad = cancelGrnSchema.safeParse({ reason: 'short' });
    expect(bad.success).toBe(false);
    const ok = cancelGrnSchema.safeParse({ reason: 'Wrong PO selected by mistake' });
    expect(ok.success).toBe(true);
  });
});

describe('createChecklistTemplateSchema', () => {
  it('accepts a raw_material template with multiple items', () => {
    const ok = createChecklistTemplateSchema.safeParse({
      category: 'raw_material',
      items: [
        { label: 'COA matches', isMandatory: true, sortOrder: 1 },
        { label: 'Packaging intact', isMandatory: true, sortOrder: 2 },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an empty items array', () => {
    const bad = createChecklistTemplateSchema.safeParse({
      category: 'raw_material',
      items: [],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const bad = createChecklistTemplateSchema.safeParse({
      category: 'unknown',
      items: [{ label: 'x', isMandatory: true, sortOrder: 1 }],
    });
    expect(bad.success).toBe(false);
  });
});
