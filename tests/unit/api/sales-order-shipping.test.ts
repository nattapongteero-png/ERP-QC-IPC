/**
 * Freight, carrier and tracking on a sales order (list items 16, 17).
 *
 * Two rules are worth guarding:
 *
 *  1. Freight is money. A negative or non-numeric value must be REFUSED, not
 *     coerced to 0 — a silent 0 hides a data-entry error that ends up short-
 *     billing the customer, and a negative would be an unapproved credit.
 *
 *  2. Freight must stay OUT of totalAmount. Goods revenue and freight income
 *     post to different GL accounts; once added together they cannot be split
 *     apart again, and the accounting module has no way to know how much of a
 *     total was carriage.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const CREATE_API = strip('src/app/api/sales/orders/route.ts');
const PATCH_API = strip('src/app/api/sales/orders/[id]/route.ts');
const DETAIL_API = strip('src/app/api/sales/orders/[id]/detail/route.ts');
const NEW_PAGE = strip('src/app/sales/orders/new/page.tsx');
const DETAIL_PAGE = strip('src/app/sales/orders/[id]/page.tsx');
const SCHEMA = strip('src/lib/db/schema.ts');

describe('schema — both dialects carry the columns', () => {
  // getTableRef() resolves sqlite*/mysql* by name; a column on only one side
  // means the feature works in tests and throws in production, or vice versa.
  it('sqliteSalesOrders has shipping_cost, carrier, tracking_number', () => {
    const table = SCHEMA.slice(SCHEMA.indexOf('sqliteSalesOrders'));
    const body = table.slice(0, table.indexOf('});'));
    expect(body).toMatch(/shipping_cost/);
    expect(body).toMatch(/carrier/);
    expect(body).toMatch(/tracking_number/);
  });

  it('mysqlSalesOrders has the same three columns', () => {
    const table = SCHEMA.slice(SCHEMA.indexOf('mysqlSalesOrders'));
    const body = table.slice(0, table.indexOf('});'));
    expect(body).toMatch(/shipping_cost/);
    expect(body).toMatch(/carrier/);
    expect(body).toMatch(/tracking_number/);
  });

  it('freight defaults to 0, never null — money should not be unknown', () => {
    for (const name of ['sqliteSalesOrders', 'mysqlSalesOrders']) {
      const table = SCHEMA.slice(SCHEMA.indexOf(name));
      const body = table.slice(0, table.indexOf('});'));
      const line = body.split('\n').find((l) => l.includes('shipping_cost'));
      expect(line, `${name}.shipping_cost`).toMatch(/notNull\(\)\.default\(/);
    }
  });
});

describe('create — freight is validated, not coerced', () => {
  it('rejects a bad shipping cost instead of silently storing 0', () => {
    expect(CREATE_API).toMatch(/normalizeShippingCost/);
    expect(CREATE_API).toMatch(/freight === null/);
    expect(CREATE_API).toMatch(/ค่าขนส่งต้องเป็นตัวเลขและไม่ติดลบ/);
  });

  it('treats a negative freight as invalid', () => {
    expect(CREATE_API).toMatch(/n < 0/);
  });

  it('stores the validated number, not the raw body value', () => {
    expect(CREATE_API).toMatch(/shippingCost: freight/);
    expect(CREATE_API).not.toMatch(/shippingCost: shippingCost/);
  });

  it('does not fold freight into totalAmount', () => {
    // totalAmount is computed from the lines alone. Take the WHOLE statement —
    // up to the terminating newline — because the tempting bug is a trailing
    // `+ shippingCost` bolted onto the end of the reduce, which a slice that
    // stops at `}, 0)` would sail straight past.
    const from = CREATE_API.indexOf('const totalAmount');
    expect(from).toBeGreaterThan(-1);
    // Up to the `;` that closes the reduce — `}, 0);` or `}, 0) + x;` alike.
    const rest = CREATE_API.slice(from);
    const stmt = rest.slice(0, rest.indexOf(';', rest.indexOf('}, 0)')) + 1);
    expect(stmt).toMatch(/reduce/);
    expect(stmt).not.toMatch(/shippingCost|freight|carrier/);
  });

  it('records the freight on the audit trail', () => {
    // Money that changes without a trail is the thing GMP audits look for.
    expect(CREATE_API).toMatch(/newValue: \{[^}]*shippingCost: freight/);
  });
});

describe('patch — tracking is fillable after the goods leave', () => {
  it('exists as PATCH, since tracking is unknown at create time', () => {
    expect(PATCH_API).toMatch(/export async function PATCH/);
  });

  it('applies the same freight rule as create', () => {
    expect(PATCH_API).toMatch(/n < 0/);
    expect(PATCH_API).toMatch(/ค่าขนส่งต้องเป็นตัวเลขและไม่ติดลบ/);
  });

  it('will not let a generic patch move status, quantities or prices', () => {
    // Those carry stock and GL effects and have their own flows.
    const updates = PATCH_API.slice(PATCH_API.indexOf('const updates'));
    expect(updates).not.toMatch(/updates\.status|updates\.totalAmount|updates\.quantity/);
  });

  it('only writes fields the caller actually sent', () => {
    // 'in body' rather than truthiness: '' must clear a wrong tracking number,
    // and 0 must be a storable freight.
    expect(PATCH_API).toMatch(/'shippingCost' in body/);
    expect(PATCH_API).toMatch(/'carrier' in body/);
    expect(PATCH_API).toMatch(/'trackingNumber' in body/);
  });

  it('404s on an order that does not exist', () => {
    expect(PATCH_API).toMatch(/notFoundResponse/);
  });

  it('audits the old and new values', () => {
    expect(PATCH_API).toMatch(/oldValue:/);
    expect(PATCH_API).toMatch(/newValue: updates/);
  });

  it('is behind sales:write', () => {
    expect(PATCH_API).toMatch(/\['sales:write'\]/);
  });
});

describe('read path', () => {
  it('detail API returns the three fields — the UI cannot show what it never gets', () => {
    expect(DETAIL_API).toMatch(/shippingCost: salesOrders\.shippingCost/);
    expect(DETAIL_API).toMatch(/carrier: salesOrders\.carrier/);
    expect(DETAIL_API).toMatch(/trackingNumber: salesOrders\.trackingNumber/);
  });

  it('summary.totalAmount still excludes freight', () => {
    const summary = DETAIL_API.slice(DETAIL_API.indexOf('summary: {'));
    const block = summary.slice(0, summary.indexOf('},'));
    expect(block).not.toMatch(/shippingCost/);
  });
});

describe('create form', () => {
  it('sends the three fields', () => {
    expect(NEW_PAGE).toMatch(/shippingCost: form\.shippingCost/);
    expect(NEW_PAGE).toMatch(/carrier: form\.carrier/);
    expect(NEW_PAGE).toMatch(/trackingNumber: form\.trackingNumber/);
  });

  it('shows goods and freight as separate lines, then a grand total', () => {
    // A single blended number would hide which part is carriage.
    expect(NEW_PAGE).toMatch(/data-testid="so-goods-amount"/);
    expect(NEW_PAGE).toMatch(/data-testid="so-shipping-amount"/);
    expect(NEW_PAGE).toMatch(/data-testid="so-grand-total"/);
  });

  it('grand total is goods + freight, computed for display only', () => {
    expect(NEW_PAGE).toMatch(/totalAmount \+ \(form\.shippingCost \|\| 0\)/);
  });

  it('will not accept a negative freight in the box either', () => {
    const box = NEW_PAGE.slice(NEW_PAGE.indexOf('so-shipping-cost-input') - 400);
    expect(box.slice(0, 400)).toMatch(/min=\{0\}/);
  });
});

describe('detail page — where tracking actually gets typed', () => {
  it('shows the shipping panel even with nothing shipped yet', () => {
    // The tracking number arrives exactly when the deliveries grid is empty.
    const tab = DETAIL_PAGE.slice(DETAIL_PAGE.indexOf('renderShippingTab'));
    const panelAt = tab.indexOf('so-shipping-panel');
    const emptyCheckAt = tab.indexOf('deliveries.length === 0');
    expect(panelAt).toBeGreaterThan(-1);
    expect(panelAt).toBeLessThan(emptyCheckAt);
  });

  it('PATCHes rather than POSTing a new order', () => {
    expect(DETAIL_PAGE).toMatch(/method: 'PATCH'/);
  });

  it('re-reads from the server after saving', () => {
    // Local patching would show a value the GL never received.
    const save = DETAIL_PAGE.slice(DETAIL_PAGE.indexOf('handleSaveShipping'));
    expect(save.slice(0, 1200)).toMatch(/await fetchSODetail\(\)/);
  });

  it('seeds the edit form from stored data, not stale form state', () => {
    const seed = DETAIL_PAGE.slice(DETAIL_PAGE.indexOf('handleStartEditShipping'));
    expect(seed.slice(0, 500)).toMatch(/data\?\.salesOrder\.shippingCost/);
  });

  it('formats freight through the shared currency helper', () => {
    expect(DETAIL_PAGE).toMatch(/formatCurrency\(Number\(so\.shippingCost \|\| 0\)/);
  });
});
