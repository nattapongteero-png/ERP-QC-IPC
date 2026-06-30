/**
 * Vendor payment-terms dropdown options — single source of truth shared by the
 * vendor CREATE page (purchasing/vendors/new) and the vendor EDIT dialog
 * (purchasing/vendors/[id]). Previously the create page used a free-text box
 * while the edit dialog declared its own inline list, so the two forms offered
 * different choices (create: any text; edit: Cash/Net 7…Net 90). Keeping one
 * list here makes both forms present the same selectable options.
 *
 * NOTE: This is the vendor-facing list (includes Cash + Net 90). The PO/PR flow
 * uses the stricter canonical list in `payment-terms.ts` (COD + up to Net 60);
 * the two are intentionally separate — vendors record what a supplier offers,
 * while POs validate against the codes the purchasing flow accepts.
 */
export const VENDOR_PAYMENT_TERMS_OPTIONS: { value: string; text: string }[] = [
  { value: 'Cash', text: 'Cash' },
  { value: 'Net 7', text: 'Net 7 วัน' },
  { value: 'Net 15', text: 'Net 15 วัน' },
  { value: 'Net 30', text: 'Net 30 วัน' },
  { value: 'Net 45', text: 'Net 45 วัน' },
  { value: 'Net 60', text: 'Net 60 วัน' },
  { value: 'Net 90', text: 'Net 90 วัน' },
];
