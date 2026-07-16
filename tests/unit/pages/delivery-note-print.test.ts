/**
 * The printed delivery note must carry the lot number and its expiry.
 *
 * That is the whole point of item 15: the customer checks those two on arrival,
 * and a recall traces back through them. A note without them is paper that
 * proves nothing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const DOC = strip('src/components/sales/DeliveryNotePrintDocument.tsx');
const PAGE = strip('src/app/sales/deliveries/page.tsx');

describe('delivery note — printed document', () => {
  it('prints the lot number and expiry columns', () => {
    expect(DOC).toMatch(/เลข Lot/);
    expect(DOC).toMatch(/วันหมดอายุ/);
    expect(DOC).toMatch(/l\.lotNumber/);
    expect(DOC).toMatch(/l\.expiryDate/);
  });

  it('marks an expired lot on the paper, not only on screen', () => {
    // The customer reads the printout, not our register.
    expect(DOC).toMatch(/days < 0/);
    expect(DOC).toMatch(/\(หมดอายุ\)/);
  });

  it('carries no prices — a delivery note is not a money document', () => {
    // Prices/VAT belong on the invoice; a note proves what was handed over.
    expect(DOC).not.toMatch(/unitPrice|vatRate|ภาษีมูลค่าเพิ่ม|ราคา\/หน่วย/);
  });

  it('identifies the customer and the order it fulfils', () => {
    expect(DOC).toMatch(/customerName/);
    expect(DOC).toMatch(/soNumber/);
  });

  it('has signature blocks for both sides', () => {
    // A delivery note without a receiver signature proves nothing on dispute.
    expect(DOC).toMatch(/ผู้ส่งสินค้า/);
    expect(DOC).toMatch(/ผู้รับสินค้า/);
  });

  it('is hidden on screen until the browser print flow', () => {
    expect(DOC).toMatch(/print-only/);
  });

  it('survives a missing company block', () => {
    // The goods still have to leave with paperwork.
    expect(DOC).toMatch(/\.catch\(/);
  });

  it('formats quantities through the shared helper', () => {
    expect(DOC).toMatch(/formatNumber\(l\.quantity\)/);
    expect(DOC).not.toMatch(/toLocaleString\(\)/);
  });
});

describe('delivery register — print action', () => {
  it('fetches the whole note before printing', () => {
    // A grid row is ONE line; a note can cover several lots. Printing from the
    // row would hand the customer paperwork missing half the goods.
    expect(PAGE).toMatch(/\/api\/sales\/deliveries\/\$\{encodeURIComponent\(deliveryNumber\)\}/);
  });

  it('stops the print click from opening the sales order', () => {
    // The row click navigates away; printing must not.
    expect(PAGE).toMatch(/stopPropagation\(\)/);
  });

  it('waits for the document to render before calling print', () => {
    // window.print() on the same tick would print an empty page.
    expect(PAGE).toMatch(/requestAnimationFrame\([\s\S]{0,80}window\.print\(\)/);
  });

  it('renders the print document only while printing', () => {
    expect(PAGE).toMatch(/printNote && <DeliveryNotePrintDocument/);
  });
});
