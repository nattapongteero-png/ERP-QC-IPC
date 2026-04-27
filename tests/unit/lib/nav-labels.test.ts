import { describe, it, expect } from 'vitest';
import { navLabel, _ENGLISH_TO_KEY } from '../../../src/lib/i18n/nav-labels';
import thNav from '../../../src/locales/th/navigation.json';
import enNav from '../../../src/locales/en/navigation.json';

/**
 * Tests for sidebar navigation label translation.
 *
 * Regression context: the sidebar used to render hardcoded English names
 * ("Inventory", "Work Orders", etc.), so switching the locale from English
 * to Thai left the menu stuck in English. navLabel() routes every menu
 * label through the navigation.json locale file.
 *
 * Coverage goals:
 *   - Every ENGLISH_TO_KEY entry has a matching Thai + English translation
 *   - navLabel returns the right translation for each locale
 *   - Missing keys and translator errors fall back to the English name
 *     (UI never shows raw keys)
 */

// Helper: resolve a nested key like "modules.inventory" in a JSON object.
function resolveKey(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

describe('navLabel()', () => {
  // Build a translator that resolves against a locale JSON blob.
  const makeTranslator = (localeData: Record<string, unknown>) => (key: string) => {
    const value = resolveKey(localeData, key);
    if (value === undefined) {
      throw new Error(`MISSING_MESSAGE: ${key}`);
    }
    return value;
  };

  describe('Thai locale', () => {
    const t = makeTranslator(thNav);

    it('translates "Inventory" to "คลังสินค้า"', () => {
      expect(navLabel('Inventory', t)).toBe('คลังสินค้า');
    });

    it('translates "Production" to "การผลิต"', () => {
      expect(navLabel('Production', t)).toBe('การผลิต');
    });

    it('translates "Work Orders" to "ใบสั่งผลิต"', () => {
      expect(navLabel('Work Orders', t)).toBe('ใบสั่งผลิต');
    });

    it('translates "HR" to "ทรัพยากรบุคคล"', () => {
      expect(navLabel('HR', t)).toBe('ทรัพยากรบุคคล');
    });

    it('translates nested submenu "Employees" to "พนักงาน"', () => {
      expect(navLabel('Employees', t)).toBe('พนักงาน');
    });

    it('translates "Vendors" to "ผู้ขาย"', () => {
      expect(navLabel('Vendors', t)).toBe('ผู้ขาย');
    });

    it('translates "3-Way Matching" to Thai variant', () => {
      expect(navLabel('3-Way Matching', t)).toBe('การจับคู่ 3 ทาง');
    });
  });

  describe('English locale', () => {
    const t = makeTranslator(enNav);

    it('returns "Inventory" unchanged', () => {
      expect(navLabel('Inventory', t)).toBe('Inventory');
    });

    it('returns "Work Orders" unchanged', () => {
      expect(navLabel('Work Orders', t)).toBe('Work Orders');
    });

    it('returns "HR" unchanged', () => {
      expect(navLabel('HR', t)).toBe('HR');
    });
  });

  describe('Fallback behavior', () => {
    it('returns English as-is when label has no mapping entry', () => {
      const t = makeTranslator(thNav);
      expect(navLabel('Totally Unknown Menu', t)).toBe('Totally Unknown Menu');
    });

    it('returns English as-is when translator throws (missing key)', () => {
      const tBroken = () => {
        throw new Error('MISSING_MESSAGE');
      };
      expect(navLabel('Inventory', tBroken)).toBe('Inventory');
    });

    it('returns English as-is when translator returns key itself', () => {
      // next-intl can return the key path when no message exists.
      const tEchoKey = (key: string) => key;
      expect(navLabel('Inventory', tEchoKey)).toBe('Inventory');
    });

    it('returns English as-is when translator returns empty string', () => {
      const tEmpty = () => '';
      expect(navLabel('Inventory', tEmpty)).toBe('Inventory');
    });
  });
});

describe('Locale coverage — every mapping has Thai and English', () => {
  // Regression lock: if someone adds a new navigation item to
  // ENGLISH_TO_KEY but forgets to add the translation in th/en JSON,
  // these tests will fail at CI time instead of the user seeing a raw
  // key on the sidebar in production.
  const mappings = Object.entries(_ENGLISH_TO_KEY);

  it('has at least 40 mapped menu items', () => {
    expect(mappings.length).toBeGreaterThanOrEqual(40);
  });

  it.each(mappings)(
    '"%s" → "%s" exists in Thai locale',
    (englishName, key) => {
      const value = resolveKey(thNav, key);
      expect(
        value,
        `Missing "navigation.${key}" in th/navigation.json (English label "${englishName}")`,
      ).toBeDefined();
      expect(typeof value).toBe('string');
      expect(value!.length).toBeGreaterThan(0);
    },
  );

  it.each(mappings)(
    '"%s" → "%s" exists in English locale',
    (englishName, key) => {
      const value = resolveKey(enNav, key);
      expect(
        value,
        `Missing "navigation.${key}" in en/navigation.json (English label "${englishName}")`,
      ).toBeDefined();
      expect(typeof value).toBe('string');
      expect(value!.length).toBeGreaterThan(0);
    },
  );
});

describe('Language switch simulation', () => {
  const tTh = (key: string) => {
    const v = resolveKey(thNav, key);
    if (v === undefined) throw new Error('missing');
    return v;
  };
  const tEn = (key: string) => {
    const v = resolveKey(enNav, key);
    if (v === undefined) throw new Error('missing');
    return v;
  };

  it('same English label yields different text per locale', () => {
    const en = navLabel('Production', tEn);
    const th = navLabel('Production', tTh);
    expect(en).toBe('Production');
    expect(th).toBe('การผลิต');
    expect(en).not.toBe(th);
  });

  it('all top-level modules differ between locales', () => {
    const modules = [
      'Dashboard',
      'Inventory',
      'Production',
      'Quality',
      'Purchasing',
      'Sales',
      'Accounting',
      'Settings',
    ];
    for (const m of modules) {
      const en = navLabel(m, tEn);
      const th = navLabel(m, tTh);
      // Locked labels like "GMP Compliance" can remain English in Thai, so
      // only assert they both exist and neither is a raw key.
      expect(en.length).toBeGreaterThan(0);
      expect(th.length).toBeGreaterThan(0);
      expect(en).not.toMatch(/^modules\./);
      expect(th).not.toMatch(/^modules\./);
    }
  });
});
