/**
 * The convert dialog must let the buyer pick a vendor PER LINE.
 *
 * A PR can list items from several companies, and each company gets its own PO.
 * Before this, the dialog offered a single header vendor and every line was
 * forced onto it — the split the backend now performs would never be reachable
 * from the UI.
 *
 * Source-level guard: the behaviour is wiring (state -> request body -> routing),
 * and a jsdom render of the DevExtreme popup would assert far less than it costs.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/purchasing/requisitions/[id]/page.tsx');
const source = readFileSync(PAGE, 'utf-8');

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('PR convert dialog — per-line vendor', () => {
  const code = codeOnly(source);

  it('keeps a lineVendors state keyed by line id', () => {
    // [\s\S] rather than the /s flag: tsconfig targets below es2018.
    expect(code).toMatch(/lineVendors[\s\S]*?useState<Record<number, number>>/);
  });

  it('renders a vendor picker for each PR line', () => {
    expect(code).toMatch(/line-vendor-select-/);
    expect(code).toMatch(/pr\?\.lines\s*\?\?\s*\[\]\)\.map/);
  });

  it('sends lineVendors to the convert API', () => {
    // Without this the backend falls back to one vendor for everything.
    expect(code).toMatch(/lineVendors\s*\}\s*:\s*\{\}/);
  });

  it('only sends lineVendors when the buyer actually picked some', () => {
    expect(code).toMatch(/Object\.keys\(lineVendors\)\.length\s*>\s*0/);
  });

  it('goes to the PO list when the split produced more than one PO', () => {
    // Jumping into the first PO would hide the others.
    expect(code).toMatch(/pos\.length\s*>\s*1/);
    expect(code).toMatch(/router\.push\('\/purchasing\/orders'\)/);
  });

  it('blocks the convert only when a line would have no vendor at all', () => {
    // A header vendor OR a line vendor is enough — blocking on the header
    // alone is what made mixed-vendor PRs unconvertible.
    expect(code).toMatch(/linesMissingVendor/);
    expect(code).toMatch(/!vendorId\s*&&\s*linesMissingVendor\.length\s*>\s*0/);
  });

  it('tells the buyer how many POs will be created before converting', () => {
    expect(code).toMatch(/plannedPoCount/);
    expect(code).toMatch(/planned-po-count/);
  });

  it('counts planned POs as distinct vendors across the lines', () => {
    expect(code).toMatch(/new Set\(/);
  });

  it('leaves Metaherb PRs as a single PO', () => {
    // The whole Metaherb PR belongs to Metaherb — no per-line split.
    expect(code).toMatch(/isMetaherbPR\s*\?\s*1/);
  });

  it('formats the counts with the shared number formatter', () => {
    // Project rule: every displayed number carries thousand separators.
    expect(code).toMatch(/formatNumber\(plannedPoCount\)/);
    expect(code).toMatch(/from '@\/lib\/utils\/number-format'/);
  });
});
