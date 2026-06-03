/**
 * Lot Pattern service.
 *
 * Two configurable scopes — 'system' and 'vendor' — driving:
 *  - `generateSystemLot()` — composes a fresh internal lot number on
 *    demand for the "สร้าง" button on the lot-entry form (replaces the
 *    hard-coded `LOT-YYYYMMDD-NNN` in /inventory/lots/page.tsx).
 *  - `validateVendorLot()` — checks a vendor-supplied lot against an
 *    optional regex; returns OK / error message.
 *  - `getVendorHint()` — returns a placeholder string for the vendor
 *    input field.
 *
 * If no row exists for a scope, falls back to the legacy defaults so
 * existing behavior is unchanged until the tenant customizes.
 */
import { eq, like } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  DEFAULT_SYSTEM_PATTERN,
  DEFAULT_VENDOR_PATTERN,
  PATTERN_TYPES,
  type LotPatternType,
  type LotPatternInput,
  type LotDateFormat,
} from '../validation/lot-pattern';

export interface LotPatternRow {
  id: number;
  patternType: LotPatternType;
  prefix: string;
  separator: string;
  includeDate: boolean;
  dateFormat: LotDateFormat;
  sequenceType: 'random' | 'sequential';
  sequenceLength: number;
  sequenceStart: number;
  regexPattern: string | null;
  hintTh: string | null;
  hintEn: string | null;
  isActive: boolean;
  notes: string | null;
  updatedBy: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

function tables() {
  return {
    patterns: getTableRef('lotPatterns'),
    lots: getTableRef('inventoryLots'),
  };
}

function formatDateToken(format: LotDateFormat, now: Date = new Date()): string {
  const ad = now.getFullYear();
  const be = ad + 543;
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  switch (format) {
    case 'YYYYMMDD':    return `${ad}${mm}${dd}`;
    case 'YYMMDD':      return `${String(ad).slice(-2)}${mm}${dd}`;
    case 'BE-YYMMDD':   return `${String(be).slice(-2)}${mm}${dd}`;
    case 'BE-YYYYMMDD': return `${be}${mm}${dd}`;
    case 'YYYY-MM-DD':  return `${ad}-${mm}-${dd}`;
    case 'none':        return '';
    default:            return `${ad}${mm}${dd}`;
  }
}

function normalizeRow(row: any): LotPatternRow {
  return {
    id: row.id,
    patternType: row.patternType as LotPatternType,
    prefix: row.prefix ?? '',
    separator: row.separator ?? '-',
    includeDate: Boolean(row.includeDate),
    dateFormat: (row.dateFormat ?? 'YYYYMMDD') as LotDateFormat,
    sequenceType: (row.sequenceType ?? 'random') as 'random' | 'sequential',
    sequenceLength: Number(row.sequenceLength ?? 3),
    sequenceStart: Number(row.sequenceStart ?? 1),
    regexPattern: row.regexPattern ?? null,
    hintTh: row.hintTh ?? null,
    hintEn: row.hintEn ?? null,
    isActive: Boolean(row.isActive ?? true),
    notes: row.notes ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function synthesizeDefault(patternType: LotPatternType): LotPatternRow {
  const def = patternType === 'system' ? DEFAULT_SYSTEM_PATTERN : DEFAULT_VENDOR_PATTERN;
  return {
    id: 0,
    patternType,
    prefix: def.prefix,
    separator: def.separator,
    includeDate: def.includeDate,
    dateFormat: def.dateFormat,
    sequenceType: def.sequenceType,
    sequenceLength: def.sequenceLength,
    sequenceStart: def.sequenceStart,
    regexPattern: def.regexPattern ?? null,
    hintTh: def.hintTh ?? null,
    hintEn: def.hintEn ?? null,
    isActive: def.isActive,
    notes: def.notes ?? null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getPattern(patternType: LotPatternType): Promise<LotPatternRow> {
  return executeDbOperation(async (db) => {
    const t = tables();
    const rows = await db.select().from(t.patterns).where(eq(t.patterns.patternType, patternType)).limit(1);
    if (rows.length > 0) return normalizeRow(rows[0]);
    return synthesizeDefault(patternType);
  });
}

export async function listPatterns(): Promise<LotPatternRow[]> {
  return executeDbOperation(async (db) => {
    const t = tables();
    const rows = await db.select().from(t.patterns);
    const byType = new Map<string, any>(rows.map((r: any) => [r.patternType, r]));
    return PATTERN_TYPES.map((type) =>
      byType.has(type) ? normalizeRow(byType.get(type)) : synthesizeDefault(type),
    );
  });
}

export async function savePattern(input: LotPatternInput, userId: number | null = null): Promise<LotPatternRow> {
  return executeDbOperation(async (db) => {
    const t = tables();
    const existing = await db.select().from(t.patterns).where(eq(t.patterns.patternType, input.patternType)).limit(1);
    const now = getNow();
    const values = {
      patternType: input.patternType,
      prefix: input.prefix ?? '',
      separator: input.separator,
      includeDate: input.includeDate,
      dateFormat: input.dateFormat,
      sequenceType: input.sequenceType,
      sequenceLength: input.sequenceLength,
      sequenceStart: input.sequenceStart,
      regexPattern: input.regexPattern ?? null,
      hintTh: input.hintTh ?? null,
      hintEn: input.hintEn ?? null,
      isActive: input.isActive,
      notes: input.notes ?? null,
      updatedBy: userId,
    };
    if (existing.length > 0) {
      await db.update(t.patterns).set({ ...values, updatedAt: now }).where(eq(t.patterns.patternType, input.patternType));
    } else {
      await db.insert(t.patterns).values({ ...values, createdAt: now, updatedAt: now });
    }
    const rows = await db.select().from(t.patterns).where(eq(t.patterns.patternType, input.patternType)).limit(1);
    return normalizeRow(rows[0]);
  });
}

/** Compose a lot number using a pattern + a sequence/random number. */
export function composeLotNumber(pattern: LotPatternRow, seq: number, now: Date = new Date()): string {
  const sep = pattern.separator ?? '-';
  const seqStr = String(seq).padStart(pattern.sequenceLength, '0');
  const dateTok = pattern.includeDate ? formatDateToken(pattern.dateFormat, now) : '';
  const parts: string[] = [];
  if (pattern.prefix) parts.push(pattern.prefix);
  if (dateTok) parts.push(dateTok);
  parts.push(seqStr);
  return parts.join(sep);
}

/**
 * Generate the next system lot.
 * - 'random' → uniform random within the padded width.
 * - 'sequential' → scan existing inventoryLots.lotNumber matching prefix
 *   and pick the first free integer ≥ sequenceStart (gap-filling).
 */
export async function generateSystemLot(): Promise<string> {
  const pattern = await getPattern('system');
  if (pattern.sequenceType === 'random') {
    const max = 10 ** pattern.sequenceLength;
    const n = Math.floor(Math.random() * max);
    return composeLotNumber(pattern, n);
  }
  // sequential
  return executeDbOperation(async (db) => {
    const t = tables();
    const sep = pattern.separator ?? '-';
    const likeExpr = pattern.prefix ? `${pattern.prefix}${sep}%` : '%';
    const existing = await db
      .select({ lotNumber: t.lots.lotNumber })
      .from(t.lots)
      .where(like(t.lots.lotNumber, likeExpr));
    // Build a strict regex that anchors to the full prefix so a lot
    // matching a DIFFERENT prefix can't be miscounted (e.g. when an
    // empty/wide LIKE returns unrelated rows).
    const escSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escPrefix = (pattern.prefix || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixPart = pattern.prefix ? `^${escPrefix}${escSep}` : '^';
    const re = new RegExp(`${prefixPart}(?:\\d+${escSep})?(\\d{${pattern.sequenceLength}})$`);
    const used = new Set<number>();
    for (const row of existing) {
      const m = (row.lotNumber ?? '').match(re);
      if (m) used.add(parseInt(m[1], 10));
    }
    let candidate = Math.max(1, pattern.sequenceStart);
    while (used.has(candidate)) candidate += 1;
    return composeLotNumber(pattern, candidate);
  });
}

/** Preview a system lot without persisting. Uses sequenceStart by default. */
export function previewSystemLot(input: LotPatternInput, seq?: number): string {
  const pattern: LotPatternRow = {
    ...synthesizeDefault('system'),
    ...{
      prefix: input.prefix ?? '',
      separator: input.separator,
      includeDate: input.includeDate,
      dateFormat: input.dateFormat,
      sequenceType: input.sequenceType,
      sequenceLength: input.sequenceLength,
      sequenceStart: input.sequenceStart,
    },
  };
  const n = seq ?? pattern.sequenceStart;
  return composeLotNumber(pattern, n);
}

export interface VendorValidation {
  ok: boolean;
  error?: string;
}

export async function validateVendorLot(value: string): Promise<VendorValidation> {
  if (!value || !value.trim()) return { ok: true }; // optional field
  const pattern = await getPattern('vendor');
  if (!pattern.regexPattern || !pattern.regexPattern.trim()) return { ok: true };
  try {
    const re = new RegExp(pattern.regexPattern);
    return re.test(value)
      ? { ok: true }
      : { ok: false, error: `รูปแบบเลข Lot ผู้ขายไม่ตรงข้อกำหนด (ต้องตรงกับ: ${pattern.regexPattern})` };
  } catch {
    // Bad regex stored — fail open (don't block legit input).
    return { ok: true };
  }
}

export async function getVendorHint(locale: 'th' | 'en' = 'th'): Promise<{ hint: string; regex: string | null }> {
  const pattern = await getPattern('vendor');
  const hint = (locale === 'en' ? pattern.hintEn : pattern.hintTh) ?? (locale === 'en' ? 'Vendor Lot Number' : 'เลข Lot ผู้ขาย');
  return { hint, regex: pattern.regexPattern };
}
