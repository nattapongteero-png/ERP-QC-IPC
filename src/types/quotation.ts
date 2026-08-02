/**
 * Quotation (ใบเสนอราคา) domain types — list items 1a–1d.
 *
 * The quotation is the first document in the sales flow. Once accepted it can be
 * converted into a sales order (soId is stamped on convert).
 */

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface QuotationLineInput {
  id?: number;
  itemId?: number;
  itemCode?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes?: string;
}

export interface QuotationLine extends QuotationLineInput {
  id: number;
  quotationId: number;
  totalPrice: number;
}

export interface QuotationCreate {
  customerId?: number | null;
  customerName: string;
  customerContact?: string | null;
  customerAddress?: string | null;
  quotationDate?: string | null;
  validUntil?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  vatInclusive?: boolean;
  lines: QuotationLineInput[];
}

export interface QuotationUpdate {
  customerId?: number | null;
  customerName?: string;
  customerContact?: string | null;
  customerAddress?: string | null;
  status?: QuotationStatus;
  quotationDate?: string | null;
  validUntil?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  customerId?: number | null;
  customerName: string;
  customerContact?: string | null;
  customerAddress?: string | null;
  status: QuotationStatus;
  quotationDate?: string | null;
  validUntil?: string | null;
  totalAmount: number;
  vatInclusive?: boolean | null;
  currency: string;
  paymentTerms?: string | null;
  notes?: string | null;
  soId?: number | null;
  createdBy?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface QuotationWithLines extends Quotation {
  lines: QuotationLine[];
}
