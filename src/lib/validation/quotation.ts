/**
 * Zod validation for quotations (ใบเสนอราคา) — list items 1a–1d.
 */
import { z } from 'zod';

export const quotationStatusSchema = z.enum([
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
]);

export const quotationLineCreateSchema = z.object({
  id: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
  itemCode: z.string().max(100).optional(),
  description: z.string().min(1, 'ต้องระบุรายละเอียด'),
  quantity: z.number().positive('จำนวนต้องมากกว่า 0'),
  unit: z.string().min(1, 'ต้องระบุหน่วยนับ'),
  unitPrice: z.number().min(0, 'ราคาต้องไม่ติดลบ'),
  notes: z.string().optional(),
});

export const quotationCreateSchema = z.object({
  customerId: z.number().int().positive().optional().nullable(),
  customerName: z.string().min(1, 'ต้องระบุชื่อลูกค้า'),
  customerContact: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  quotationDate: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(quotationLineCreateSchema).min(1, 'ต้องมีอย่างน้อย 1 รายการ'),
});

export const quotationUpdateSchema = z.object({
  customerId: z.number().int().positive().optional().nullable(),
  customerName: z.string().min(1).optional(),
  customerContact: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  status: quotationStatusSchema.optional(),
  quotationDate: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;
export type QuotationUpdateInput = z.infer<typeof quotationUpdateSchema>;
