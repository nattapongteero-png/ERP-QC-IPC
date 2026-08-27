import * as React from 'react';
import thQuality from '@/locales/th/quality.json';
import thCommon from '@/locales/th/common.json';
import thProduction from '@/locales/th/production.json';
import thMasterData from '@/locales/th/masterData.json';
import enQuality from '@/locales/en/quality.json';
import enCommon from '@/locales/en/common.json';
import enProduction from '@/locales/en/production.json';
import enMasterData from '@/locales/en/masterData.json';

/**
 * Demo stand-in for next-intl.
 *
 * The real app wraps pages in a NextIntlClientProvider; the demo has no
 * server, so the bundles are imported directly and looked up the same way
 * `useTranslations(namespace)` would. Only the forms the screens here use are
 * implemented — `t(key, values)`, `t.has(key)` and `t.rich(key, { tag })`.
 *
 * Both locales are carried rather than Thai alone: a label that fits in Thai
 * can overflow in English, and a key missing from one bundle only shows up
 * when that language is on screen. The switcher in the shell flips between
 * them, so the demo can be reviewed in either.
 */
type Locale = 'th' | 'en';

const BUNDLES: Record<Locale, Record<string, unknown>> = {
  th: { quality: thQuality, common: thCommon, production: thProduction, masterData: thMasterData },
  en: { quality: enQuality, common: enCommon, production: enProduction, masterData: enMasterData },
};

/**
 * The active locale, held outside React so the shimmed switcher can set it
 * from anywhere in the tree, with subscribers re-rendering on the change.
 */
let currentLocale: Locale = 'th';
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => currentLocale;

export function setDemoLocale(next: Locale) {
  if (next === currentLocale) return;
  currentLocale = next;
  listeners.forEach((fn) => fn());
}

/** The shell's language switcher asks for the active locale. */
export function useLocale(): Locale {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function lookup(bundle: unknown, path: string): string | undefined {
  const found = path.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    bundle,
  );
  return typeof found === 'string' ? found : undefined;
}

const fill = (text: string, values?: Record<string, unknown>) =>
  values
    ? text.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m))
    : text;

export function useTranslations(namespace: string) {
  const locale = useLocale();
  // A namespace may be addressed as "masterData.ipcCriteria"; resolve the
  // bundle by its first segment, then walk the rest as part of the key path.
  const [root, ...rest] = namespace.split('.');
  const bundle = rest.length
    ? rest.reduce<unknown>(
        (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
        BUNDLES[locale][root],
      )
    : BUNDLES[locale][root];

  const t = (key: string, values?: Record<string, unknown>) =>
    fill(lookup(bundle, key) ?? key, values);

  /**
   * Whether a key exists. Callers use it to fall back to a raw value rather
   * than print the key itself — without it they crash on the missing method,
   * which took the whole demo down rather than one label.
   */
  t.has = (key: string) => lookup(bundle, key) != null;

  /**
   * Renders `<em>…</em>` / `<strong>…</strong>` through the render function the
   * caller passes, so the emphasis in the hint and the count in "will create"
   * come out as elements rather than literal angle brackets.
   */
  t.rich = (
    key: string,
    values?: Record<string, unknown>,
  ): React.ReactNode => {
    const raw = fill(lookup(bundle, key) ?? key, values);
    const parts = raw.split(/(<\/?[a-zA-Z]+>)/);
    const out: React.ReactNode[] = [];
    let tag: string | null = null;
    let buf = '';
    parts.forEach((part, i) => {
      const open = part.match(/^<([a-zA-Z]+)>$/);
      const close = part.match(/^<\/([a-zA-Z]+)>$/);
      if (open) { tag = open[1]; buf = ''; return; }
      if (close && tag) {
        const render = values?.[tag];
        out.push(
          typeof render === 'function'
            ? <React.Fragment key={i}>{(render as (c: React.ReactNode) => React.ReactNode)(buf)}</React.Fragment>
            : buf,
        );
        tag = null;
        return;
      }
      if (tag) buf += part;
      else if (part) out.push(<React.Fragment key={i}>{part}</React.Fragment>);
    });
    return <>{out}</>;
  };

  return t;
}
