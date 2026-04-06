/**
 * eBMR Print Functionality - Structural Tests
 *
 * Verifies print infrastructure:
 * 1. CSS has @media print rules for eBMR
 * 2. Main layout has no-print classes on sidebar/header
 * 3. WO detail page has correct print structure
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');

describe('eBMR Print Infrastructure', () => {
  describe('globals.css print rules', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf-8');

    it('has @media print block', () => {
      expect(css).toContain('@media print');
    });

    it('has print-only class (hidden by default, shown in print)', () => {
      expect(css).toContain('.print-only');
      // Should be hidden by default
      expect(css).toMatch(/\.print-only\s*\{[^}]*display:\s*none\s*!important/);
    });

    it('has no-print class rule in @media print', () => {
      expect(css).toContain('.no-print');
    });

    it('forces #ebmr-content display in print', () => {
      expect(css).toContain('#ebmr-content');
      expect(css).toMatch(/#ebmr-content\s*\{[^}]*display:\s*block\s*!important/);
    });

    it('has A4 page size', () => {
      expect(css).toContain('size: A4');
    });

    it('has page margins', () => {
      expect(css).toMatch(/margin:\s*15mm/);
    });

    it('removes sidebar padding in print', () => {
      expect(css).toContain('.lg\\:pl-64');
      expect(css).toContain('padding-left: 0');
    });

    it('removes height constraints on main content', () => {
      expect(css).toContain('main#main-content');
      expect(css).toContain('height: auto');
      expect(css).toContain('overflow: visible');
    });

    it('has table styling for print', () => {
      expect(css).toContain('#ebmr-content table');
      expect(css).toContain('border-collapse: collapse');
      expect(css).toContain('page-break-inside: avoid');
    });

    it('has zebra stripes for print tables', () => {
      expect(css).toContain('nth-child(even)');
    });

    it('repeats table headers on each page', () => {
      expect(css).toContain('display: table-header-group');
    });

    it('has signature section page-break', () => {
      expect(css).toContain('#ebmr-signatures');
      expect(css).toContain('page-break-before: always');
    });

    it('has print header and footer CSS', () => {
      expect(css).toContain('.ebmr-print-header');
      expect(css).toContain('.ebmr-print-footer');
    });
  });

  describe('main-layout.tsx print classes', () => {
    const layout = fs.readFileSync(path.join(ROOT, 'src/components/layout/main-layout.tsx'), 'utf-8');

    it('has no-print on desktop sidebar', () => {
      expect(layout).toContain('lg:block lg:fixed lg:inset-y-0 lg:z-50 no-print');
    });

    it('has no-print on mobile overlay', () => {
      expect(layout).toContain('lg:hidden no-print');
    });

    it('has no-print on mobile header', () => {
      expect(layout).toContain('sticky top-0 z-30 no-print');
    });
  });

  describe('WO detail page print structure', () => {
    const page = fs.readFileSync(
      path.join(ROOT, 'src/app/production/work-orders/[id]/page.tsx'),
      'utf-8'
    );

    it('has no-print on page header', () => {
      expect(page).toContain('flex items-center justify-between no-print');
    });

    it('has no-print on summary cards', () => {
      expect(page).toContain('grid-cols-5 gap-4 no-print');
    });

    it('has no-print on tabs wrapper', () => {
      expect(page).toMatch(/<div className="no-print">\s*<DxTabs/);
    });

    it('has no-print on tab 0 content', () => {
      expect(page).toContain('grid-cols-2 gap-6 no-print');
    });

    it('has no-print on tab 1 (Execution) wrapper', () => {
      expect(page).toMatch(/<div className="no-print">\s*<ExecutionDashboard/);
    });

    it('has no-print on tab 2 (Materials) card', () => {
      expect(page).toContain('<Card className="no-print">');
    });

    it('eBMR content always renders with conditional hidden class', () => {
      // Should NOT use conditional rendering for eBMR
      expect(page).not.toContain('{activeTabIndex === 4 && (');
      // Should use hidden class approach
      expect(page).toContain("activeTabIndex !== 4 ? 'hidden' : ''");
      expect(page).toContain('id="ebmr-content"');
    });

    it('has print-only document header with company name', () => {
      expect(page).toContain('print-only ebmr-print-header');
      expect(page).toContain('เมตะเฮิร์บ');
      expect(page).toContain('Metaherb Co., Ltd.');
    });

    it('has print-only footer', () => {
      expect(page).toContain('print-only ebmr-print-footer');
      expect(page).toContain('Herbal Medicine ERP');
    });

    it('has signature section with id for page-break', () => {
      expect(page).toContain('id="ebmr-signatures"');
    });

    it('print button calls window.print()', () => {
      expect(page).toContain("text=\"Print eBMR\"");
      expect(page).toContain('window.print()');
    });
  });
});
