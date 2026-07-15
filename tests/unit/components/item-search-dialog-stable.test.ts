/**
 * The item picker must not re-fetch on every parent render.
 *
 * Callers pass filterType inline — production/bom/new does
 * filterType={['finished_goods', 'wip']} — which is a BRAND NEW array on every
 * parent render. When the dialog's useMemo/useCallback depended on that array,
 * every render missed the memo, re-ran the search effect, re-fetched, and
 * re-rendered: the list flickered and hammered /api/items for as long as it
 * stayed open.
 *
 * Source-level, deliberately: rendering this dialog needs the whole DevExtreme
 * widget stack, and mocking it away would leave the test asserting the mocks
 * rather than the dependency wiring that actually caused the bug. The two
 * behavioural facts below — a string key, and no raw array in any dep array —
 * are exactly what makes the flicker impossible.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILE = join(process.cwd(), 'src/components/ui/item-search-dialog.tsx');
const source = readFileSync(FILE, 'utf-8');

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const code = codeOnly(source);

/** Every dependency array in the file, as raw text. */
function depArrays(src: string): string[] {
  return Array.from(src.matchAll(/\}\s*,\s*\[([^\]]*)\]\s*\)/g)).map((m) => m[1]);
}

describe('ItemSearchDialog — stable against an inline filterType array', () => {
  it('flattens filterType to a string key', () => {
    // A string compares by value, so the memos hold across renders.
    expect(code).toMatch(/filterTypeKey/);
    expect(code).toMatch(/Array\.isArray\(filterType\)[\s\S]*?\.join\(','\)/);
  });

  it('derives the type list from the string key, not the raw prop', () => {
    expect(code).toMatch(/filterTypes\s*=\s*useMemo\(/);
    expect(code).toMatch(/\[filterTypeKey\]/);
  });

  it('never depends on the raw filterType array', () => {
    // The bug in one line: a fresh array in a dep array busts every memo below it.
    const offenders = depArrays(code).filter((deps) =>
      /\bfilterType\b/.test(deps) && !/filterTypes|filterTypeKey/.test(deps),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the search callback keyed on the stable list', () => {
    expect(depArrays(code).some((d) => /filterTypes/.test(d) && /excludeType/.test(d))).toBe(true);
  });

  it('still guards excludeIds by ref', () => {
    // Same class of bug, already worked around — it must not regress.
    expect(code).toMatch(/excludeIdsRef/);
  });

  it('sends one type per request, never a joined string', () => {
    // "finished_goods,wip" is not something /api/items understands: with a
    // multi-type filter the selected tab is authoritative.
    expect(code).toMatch(/filterTypes\.length === 1 \? filterTypes\[0\] : ''/);
  });
});
