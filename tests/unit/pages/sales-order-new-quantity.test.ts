/**
 * Guards the "quantity stuck at 1" bug on the new sales order page.
 *
 * The lines grid renders its own NumberBox in cellRender and writes straight to
 * React state. Declaring <Editing mode="cell" allowUpdating={false} /> on the
 * same DataGrid put the grid's OWN (disabled) cell editor in front of those
 * inputs, so keystrokes were swallowed and the value snapped back to its
 * initial 1 — a new sales order could not be created at all.
 *
 * This is a source-level guard rather than a render test on purpose: the bug
 * was a single JSX prop, and a jsdom render of a DevExtreme grid would not
 * reproduce the native editor interception that caused it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/sales/orders/new/page.tsx');
const source = readFileSync(PAGE, 'utf-8');

/** Strip block and line comments so the explanation of the bug isn't matched. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('sales order lines grid — quantity must stay editable', () => {
  const code = codeOnly(source);

  it('does not declare an Editing element on the lines DataGrid', () => {
    // <Editing allowUpdating={false}> is what swallowed the typing.
    expect(code).not.toMatch(/<Editing\b/);
  });

  it('does not import Editing from devextreme data-grid', () => {
    expect(code).not.toMatch(/\bEditing,/);
  });

  it('still renders a NumberBox for the quantity cell', () => {
    // The fix must keep the custom editor — removing Editing is only correct
    // because the cell brings its own input.
    expect(code).toMatch(/renderQuantityCell/);
    expect(code).toMatch(/<NumberBox/);
  });

  it('wires the quantity NumberBox to the change handler', () => {
    // Without this the value would render but never persist.
    expect(code).toMatch(/onValueChanged=\{\(e\)\s*=>\s*handleLineQuantityChange/);
  });

  it('updates line state functionally so edits are not lost', () => {
    // setLines(prev => ...) — a stale closure here would reintroduce a
    // different flavour of the same "value snaps back" symptom.
    expect(code).toMatch(/const handleLineQuantityChange[\s\S]{0,200}setLines\(prev\s*=>/);
  });
});
