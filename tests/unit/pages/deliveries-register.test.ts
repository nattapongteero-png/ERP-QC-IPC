/**
 * The delivery register must make an expired lot impossible to miss.
 *
 * On UAT right now, 5 of 20 delivery lines shipped from lots already past their
 * expiry date. Nobody knew, because there was no screen. A number on a card
 * would repeat that mistake more quietly — shipping expired stock is a GMP
 * failure, so it gets a banner and the date itself is coloured.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/sales/deliveries/page.tsx');
const raw = readFileSync(PAGE, 'utf-8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SIDEBAR = readFileSync(join(process.cwd(), 'src/components/layout/sidebar.tsx'), 'utf-8');

describe('delivery register — expired lots', () => {
  it('warns when stock shipped from an expired lot', () => {
    expect(code).toMatch(/expired-lot-warning/);
    expect(code).toMatch(/expiredLines > 0/);
  });

  it('colours the expiry date itself, not just a count', () => {
    // Someone reading a row must see it there, without cross-checking today's
    // date in their head.
    expect(code).toMatch(/days < 0/);
    expect(code).toMatch(/rose-50/);
    expect(code).toMatch(/หมดอายุ/);
  });

  it('marks lots expiring within 30 days differently from expired ones', () => {
    // Amber is "use it soon", red is "this should not have gone out".
    expect(code).toMatch(/days <= 30/);
    expect(code).toMatch(/amber-50/);
  });
});

describe('delivery register — wiring', () => {
  it('shows the lot number and expiry as columns', () => {
    // Items 13/15: a delivery note is not printable without them.
    expect(code).toMatch(/dataField: 'lotNumber'/);
    expect(code).toMatch(/dataField: 'expiryDate'/);
  });

  it('reads the register API, not the per-order one', () => {
    // /api/sales/orders/[id]/deliveries cannot answer "what shipped this week".
    expect(code).toMatch(/\/api\/sales\/deliveries\?/);
  });

  it('counts documents and lines separately', () => {
    // One delivery number can cover several lots.
    expect(code).toMatch(/summary\.documents|s\?\.documents/);
    expect(code).toMatch(/s\?\.lines/);
  });

  it('exports the lot and expiry to Excel', () => {
    expect(code).toMatch(/'เลข Lot'/);
    expect(code).toMatch(/'วันหมดอายุ'/);
  });

  it('formats quantities through the shared helper', () => {
    // Project rule: no raw numbers.
    expect(code).toMatch(/formatNumber\(Number\(c\.data\.quantity\)\)/);
    expect(code).not.toMatch(/toLocaleString\(/);
  });

  it('wraps MainLayout, since the sales layout does not', () => {
    // The sales report shipped without this and rendered with no left menu.
    expect(code).toMatch(/<MainLayout>/);
  });

  it('is reachable from the sidebar', () => {
    // A page nobody can navigate to is a page nobody uses.
    expect(SIDEBAR).toMatch(/href: '\/sales\/deliveries'/);
  });
});
