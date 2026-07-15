/**
 * One row per item must answer both questions at once:
 * "what did we order and what did it cost" AND "has it arrived".
 *
 * The PO detail had two tables over two tabs — รายการสินค้า (price) and
 * รับสินค้า (received/pending) — both built from the same `lines` array. So
 * checking a delivery against its price meant flipping between tabs and
 * matching rows by eye.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/purchasing/orders/[id]/page.tsx');
const raw = readFileSync(PAGE, 'utf-8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The linesColumns array body, so assertions can't be satisfied by receivingColumns. */
function linesColumnsBlock(): string {
  const start = code.indexOf('const linesColumns');
  const end = code.indexOf('const receivingColumns');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

describe('PO lines table — order and receipt in one row', () => {
  const block = linesColumnsBlock();

  it('shows received quantity alongside the price', () => {
    expect(block).toMatch(/dataField: 'receivedQty'/);
  });

  it('shows pending quantity alongside the price', () => {
    expect(block).toMatch(/dataField: 'pendingQty'/);
  });

  it('keeps the money columns on the same row', () => {
    // The merge must not cost the numbers it was built around.
    expect(block).toMatch(/dataField: 'unitPrice'/);
    expect(block).toMatch(/dataField: 'lineTotal'/);
  });

  it('labels the ordered quantity as ordered, not just "จำนวน"', () => {
    // With received/pending beside it, a bare "จำนวน" is ambiguous.
    expect(block).toMatch(/caption: 'สั่งซื้อ'/);
  });
});

describe('PO detail — number formatting', () => {
  it('formats no QUANTITY with toLocaleString', () => {
    // Project rule: SSR-unsafe and locale-dependent. Quantities and the
    // receiving summary tiles all used to call it.
    //
    // Date formatting is exempt — new Date(x).toLocaleString('th-TH') is the
    // supported way to render a Thai date, and the rule is about numbers.
    const numeric = Array.from(code.matchAll(/(\w[\w.?]*)\.toLocaleString\(/g))
      .map((m) => m[1])
      .filter((expr) => !/^new Date|Date\(/.test(expr));
    expect(numeric).toEqual([]);
  });

  it('formats the receiving summary tiles with formatNumber', () => {
    expect(code).toMatch(/formatNumber\(summary\.totalOrdered \|\| 0\)/);
    expect(code).toMatch(/formatNumber\(summary\.totalReceived \|\| 0\)/);
    expect(code).toMatch(/formatNumber\(summary\.totalPending \|\| 0\)/);
  });

  it('formats the merged quantity columns with formatNumber', () => {
    const block = linesColumnsBlock();
    expect(block).toMatch(/formatNumber\(cellInfo\.data\.receivedQty \|\| 0\)/);
    expect(block).toMatch(/formatNumber\(cellInfo\.data\.pendingQty \|\| 0\)/);
  });
});
