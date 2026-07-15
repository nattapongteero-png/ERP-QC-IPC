/**
 * The PO lines belong under the order info, not behind their own tab.
 *
 * What was ordered is part of reading the order. Putting the lines on a
 * separate tab meant opening a PO showed a header with no goods on it, and
 * answering "what did we order?" cost a click every time.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/purchasing/orders/[id]/page.tsx');
const code = readFileSync(PAGE, 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('PO detail — lines under the order info', () => {
  it('renders the lines section on the overview tab', () => {
    expect(code).toMatch(/po-lines-section/);
    expect(code).toMatch(/activeTab === 'overview'[\s\S]{0,200}po-lines-section/);
  });

  it('no longer has a separate lines tab', () => {
    // The tab list must not offer a destination that no longer exists.
    expect(code).not.toMatch(/\{ id: 'lines'/);
  });

  it('drops the lines value from the tab union so a stale one cannot be set', () => {
    expect(code).toMatch(/useState<'overview' \| 'receiving' \| 'lots'>/);
  });

  it('keeps receiving and lots as their own tabs', () => {
    // Receiving is a separate act from reading the order — it stays put.
    expect(code).toMatch(/\{ id: 'receiving'/);
    expect(code).toMatch(/\{ id: 'lots'/);
  });

  it('shows the line count on the section heading', () => {
    // The count moved off the tab label, so it has to survive somewhere.
    expect(code).toMatch(/รายการสินค้า \(\{formatNumber\(lines\.length\)\}\)/);
  });

  it('keeps the add-line button behind the editable check', () => {
    // Moving the section must not make a posted PO look editable.
    expect(code).toMatch(/po-lines-section[\s\S]{0,400}isEditable &&/);
  });
});
