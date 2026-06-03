/**
 * Item Code Pattern service.
 *
 * Per-factory configurable code generation for items. Replaces the
 * hard-coded PREFIX_MAP that used to live in /api/items/next-code so each
 * tenant can adjust prefix / separator / padding / year insertion without
 * a code change. If no pattern row exists for a type, the service falls
 * back to DEFAULT_PATTERNS (which mirror the legacy hard-coded format) so
 * existing item codes (RM-0001, PK-0002, ...) keep working unchanged.
 */
import { eq, like } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  DEFAULT_PATTERNS,
  ITEM_TYPES,
  type ItemTypeCode,
  type ItemCodePatternInput,
  type YearFormat,
  type YearPosition,
} from '../validation/item-code-pattern';

export interface ItemCodePatternRow {
  id: number;
  itemType: ItemTypeCode;
  prefix: string;
  separator: string;
  padding: number;
  includeYear: boolean;
  yearFormat: YearFormat;
  yearPosition: YearPosition;
  sequenceStart: number;
  isActive: boolean;
  notes: string | null;
  updatedBy: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

function tables() {
  return {
    patterns: getTableRef('itemCodePatterns'),
    items: getTableRef('items'),
  };
}

function getYearToken(format: YearFormat, now: Date = new Date()): string {
  const ad = now.getFullYear();
  const be = ad + 543;
  switch (format) {
    case 'YY': return String(ad).slice(-2);
    case 'YYYY': return String(ad);
    case 'BE-YY': return String(be).slice(-2);
    case 'BE-YYYY': return String(be);
    default: return String(ad);
  }
}

/**
 * Compose a final code from pattern + sequence number.
 * Used for preview rendering AND inside generateNextCode.
 */
export function composeCode(
  pattern: Pick<ItemCodePatternRow, 'prefix' | 'separator' | 'padding' | 'includeYear' | 'yearFormat' | 'yearPosition'>,
  sequence: number,
  now: Date = new Date(),
): string {
  const seqStr = String(sequence).padStart(pattern.padding, '0');
  const sep = pattern.separator ?? '-';
  const yearToken = pattern.includeYear ? getYearToken(pattern.yearFormat, now) : null;

  if (!yearToken) return `${pattern.prefix}${sep}${seqStr}`;

  if (pattern.yearPosition === 'after_prefix') {
    return `${pattern.prefix}${sep}${yearToken}${sep}${seqStr}`;
  }
  // 'before_seq' = same effect when separator is '-': RM-2026-0001
  // (Position option exists for future extensions, e.g. prefix-seq-year.)
  return `${pattern.prefix}${sep}${yearToken}${sep}${seqStr}`;
}

/** Build a regex that matches existing codes for this pattern (used to find max sequence). */
function buildScanPattern(pattern: ItemCodePatternRow): { likeExpr: string; numberRegex: RegExp } {
  const sep = pattern.separator ?? '-';
  const escSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (pattern.includeYear) {
    // e.g. RM-2026-0001 or ม.2569.0001
    const yearLen = pattern.yearFormat === 'YYYY' || pattern.yearFormat === 'BE-YYYY' ? 4 : 2;
    const yearRe = `\\d{${yearLen}}`;
    return {
      likeExpr: `${pattern.prefix}${sep}%`,
      numberRegex: new RegExp(`^${escapeRegex(pattern.prefix)}${escSep}${yearRe}${escSep}(\\d+)$`),
    };
  }
  return {
    likeExpr: `${pattern.prefix}${sep}%`,
    numberRegex: new RegExp(`^${escapeRegex(pattern.prefix)}${escSep}(\\d+)$`),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the saved row OR a synthesized default if the tenant hasn't customised yet. */
export async function getPatternForType(itemType: ItemTypeCode): Promise<ItemCodePatternRow> {
  return executeDbOperation(async (db) => {
    const t = tables();
    const rows = await db.select().from(t.patterns).where(eq(t.patterns.itemType, itemType)).limit(1);
    if (rows.length > 0) return normalizeRow(rows[0]);
    return synthesizeDefaultRow(itemType);
  });
}

function normalizeRow(row: any): ItemCodePatternRow {
  return {
    id: row.id,
    itemType: row.itemType as ItemTypeCode,
    prefix: row.prefix,
    separator: row.separator ?? '-',
    padding: Number(row.padding ?? 4),
    includeYear: Boolean(row.includeYear),
    yearFormat: (row.yearFormat ?? 'YYYY') as YearFormat,
    yearPosition: (row.yearPosition ?? 'after_prefix') as YearPosition,
    sequenceStart: Number(row.sequenceStart ?? 1),
    isActive: Boolean(row.isActive ?? true),
    notes: row.notes ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function synthesizeDefaultRow(itemType: ItemTypeCode): ItemCodePatternRow {
  const def = DEFAULT_PATTERNS[itemType];
  return {
    id: 0,
    itemType,
    prefix: def.prefix,
    separator: def.separator,
    padding: def.padding,
    includeYear: def.includeYear,
    yearFormat: def.yearFormat,
    yearPosition: def.yearPosition,
    sequenceStart: def.sequenceStart,
    isActive: def.isActive,
    notes: def.notes ?? null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Returns one row per item type, synthesising defaults for unconfigured ones. */
export async function listPatterns(): Promise<ItemCodePatternRow[]> {
  return executeDbOperation(async (db) => {
    const t = tables();
    const rows = await db.select().from(t.patterns);
    const byType = new Map<string, any>(rows.map((r: any) => [r.itemType, r]));
    return ITEM_TYPES.map((type) => {
      const r = byType.get(type);
      return r ? normalizeRow(r) : synthesizeDefaultRow(type);
    });
  });
}

export async function savePattern(input: ItemCodePatternInput, userId: number | null = null): Promise<ItemCodePatternRow> {
  return executeDbOperation(async (db) => {
    const t = tables();
    const existing = await db.select().from(t.patterns).where(eq(t.patterns.itemType, input.itemType)).limit(1);
    const now = getNow();
    if (existing.length > 0) {
      await db.update(t.patterns).set({
        prefix: input.prefix,
        separator: input.separator,
        padding: input.padding,
        includeYear: input.includeYear,
        yearFormat: input.yearFormat,
        yearPosition: input.yearPosition,
        sequenceStart: input.sequenceStart,
        isActive: input.isActive,
        notes: input.notes ?? null,
        updatedBy: userId,
        updatedAt: now,
      }).where(eq(t.patterns.itemType, input.itemType));
    } else {
      await db.insert(t.patterns).values({
        itemType: input.itemType,
        prefix: input.prefix,
        separator: input.separator,
        padding: input.padding,
        includeYear: input.includeYear,
        yearFormat: input.yearFormat,
        yearPosition: input.yearPosition,
        sequenceStart: input.sequenceStart,
        isActive: input.isActive,
        notes: input.notes ?? null,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    const rows = await db.select().from(t.patterns).where(eq(t.patterns.itemType, input.itemType)).limit(1);
    return normalizeRow(rows[0]);
  });
}

/**
 * Resolve the next code for an item type using the configured pattern.
 * Scans existing items.code matching the prefix, finds the first free
 * slot starting at sequenceStart, returns the composed code.
 */
export async function generateNextCode(itemType: ItemTypeCode): Promise<string> {
  const pattern = await getPatternForType(itemType);
  return executeDbOperation(async (db) => {
    const t = tables();
    const { likeExpr, numberRegex } = buildScanPattern(pattern);
    const existing = await db.select({ code: t.items.code }).from(t.items).where(like(t.items.code, likeExpr));

    const used = new Set<number>();
    for (const row of existing) {
      const m = (row.code ?? '').match(numberRegex);
      if (m) used.add(parseInt(m[1], 10));
    }

    let candidate = Math.max(1, pattern.sequenceStart);
    while (used.has(candidate)) candidate += 1;

    return composeCode(pattern, candidate);
  });
}

/** Preview a code at the given sequence WITHOUT touching the DB — for live UI feedback. */
export function previewCode(input: ItemCodePatternInput, sequence: number = input.sequenceStart || 1): string {
  return composeCode(
    {
      prefix: input.prefix,
      separator: input.separator,
      padding: input.padding,
      includeYear: input.includeYear,
      yearFormat: input.yearFormat,
      yearPosition: input.yearPosition,
    },
    sequence,
  );
}
