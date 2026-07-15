/**
 * Every page must render inside exactly ONE MainLayout — no more, no less.
 *
 * Zero means the page shows with no left navigation and the user is stranded
 * (both report pages shipped that way). Two means two sidebars.
 *
 * The catch is that the two modules do it OPPOSITE ways:
 *   - purchasing/layout.tsx wraps MainLayout itself  -> pages must NOT
 *   - sales/layout.tsx only applies a theme          -> pages MUST
 *
 * That is exactly the kind of thing nobody remembers while adding a page, so
 * it is asserted here rather than trusted to a comment.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MODULES = [
  { dir: 'src/app/sales', layoutWraps: false },
  { dir: 'src/app/purchasing', layoutWraps: true },
];

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFiles(full));
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

const rel = (f: string) => f.replace(process.cwd(), '').replace(/\\/g, '/');
const wrapsMainLayout = (src: string) => /<MainLayout[\s>]/.test(src);
/** A page that only redirects has no chrome to show. */
const isRedirectOnly = (src: string) => /router\.replace\(/.test(src) && !wrapsMainLayout(src);

describe('MainLayout — exactly one per page', () => {
  for (const { dir, layoutWraps } of MODULES) {
    const layout = readFileSync(join(process.cwd(), dir, 'layout.tsx'), 'utf-8');

    it(`${dir}/layout.tsx ${layoutWraps ? 'wraps' : 'does not wrap'} MainLayout`, () => {
      // Pins the premise the page assertions below depend on. If this flips,
      // the pages must flip with it — and this test says so first.
      expect(wrapsMainLayout(layout)).toBe(layoutWraps);
    });

    if (layoutWraps) {
      it(`no page under ${dir} adds a second MainLayout`, () => {
        const doubled = pageFiles(join(process.cwd(), dir))
          .filter((f) => wrapsMainLayout(readFileSync(f, 'utf-8')))
          .map(rel);
        // Two nested MainLayouts render two sidebars.
        expect(doubled).toEqual([]);
      });
    } else {
      it(`every page under ${dir} wraps its own MainLayout`, () => {
        const missing = pageFiles(join(process.cwd(), dir))
          .filter((f) => {
            const src = readFileSync(f, 'utf-8');
            return !isRedirectOnly(src) && !wrapsMainLayout(src);
          })
          .map(rel);
        // Failing here means that page renders with no left menu.
        expect(missing).toEqual([]);
      });
    }
  }
});
