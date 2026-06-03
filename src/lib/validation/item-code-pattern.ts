/**
 * Item Code Pattern — validation schemas.
 *
 * Each tenant can configure how item codes are generated per item type
 * (raw_material, packaging, wip, finished_goods, extract, consumable).
 */
import { z } from 'zod';

export const ITEM_TYPES = [
  'raw_material',
  'packaging',
  'wip',
  'finished_goods',
  'extract',
  'consumable',
] as const;

export const YEAR_FORMATS = ['YY', 'YYYY', 'BE-YY', 'BE-YYYY'] as const;
export const YEAR_POSITIONS = ['after_prefix', 'before_seq'] as const;
export const SEPARATORS = ['-', '_', '/', '.', ''] as const;

export type ItemTypeCode = typeof ITEM_TYPES[number];
export type YearFormat = typeof YEAR_FORMATS[number];
export type YearPosition = typeof YEAR_POSITIONS[number];

export const itemCodePatternSchema = z.object({
  itemType: z.enum(ITEM_TYPES),
  prefix: z.string().trim().min(1, 'prefix is required').max(20),
  separator: z.string().max(5).default('-'),
  padding: z.number().int().min(2).max(10).default(4),
  includeYear: z.boolean().default(false),
  yearFormat: z.enum(YEAR_FORMATS).default('YYYY'),
  yearPosition: z.enum(YEAR_POSITIONS).default('after_prefix'),
  sequenceStart: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});

export type ItemCodePatternInput = z.infer<typeof itemCodePatternSchema>;

export const updateItemCodePatternSchema = itemCodePatternSchema.partial().extend({
  itemType: z.enum(ITEM_TYPES), // updating requires identifying the type
});

export const DEFAULT_PATTERNS: Record<ItemTypeCode, Omit<ItemCodePatternInput, 'itemType'>> = {
  raw_material:   { prefix: 'RM',  separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix', sequenceStart: 1, isActive: true, notes: null },
  packaging:      { prefix: 'PK',  separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix', sequenceStart: 1, isActive: true, notes: null },
  wip:            { prefix: 'WIP', separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix', sequenceStart: 1, isActive: true, notes: null },
  finished_goods: { prefix: 'FG',  separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix', sequenceStart: 1, isActive: true, notes: null },
  extract:        { prefix: 'EX',  separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix', sequenceStart: 1, isActive: true, notes: null },
  consumable:     { prefix: 'CN',  separator: '-', padding: 4, includeYear: false, yearFormat: 'YYYY', yearPosition: 'after_prefix', sequenceStart: 1, isActive: true, notes: null },
};

export const ITEM_TYPE_LABELS_TH: Record<ItemTypeCode, string> = {
  raw_material:   'วัตถุดิบ',
  packaging:      'บรรจุภัณฑ์',
  wip:            'งานระหว่างทำ',
  finished_goods: 'สินค้าสำเร็จรูป',
  extract:        'สารสกัด',
  consumable:     'วัสดุสิ้นเปลือง',
};

export const ITEM_TYPE_LABELS_EN: Record<ItemTypeCode, string> = {
  raw_material:   'Raw Material',
  packaging:      'Packaging',
  wip:            'Work in Process',
  finished_goods: 'Finished Goods',
  extract:        'Extract',
  consumable:     'Consumable',
};
