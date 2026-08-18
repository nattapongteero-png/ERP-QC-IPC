import * as React from 'react';
import th from '@/locales/th/quality.json';

/**
 * Demo stand-in for next-intl.
 *
 * The real app wraps pages in a NextIntlClientProvider; the demo has no
 * server, so the Thai bundle is imported directly and looked up the same way
 * `useTranslations(namespace)` would. Only the two forms the QC screens use
 * are implemented — `t(key, values)` and `t.rich(key, { tag })`.
 */
const BUNDLES: Record<string, unknown> = { quality: th };

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
  const bundle = BUNDLES[namespace];

  const t = (key: string, values?: Record<string, unknown>) =>
    fill(lookup(bundle, key) ?? key, values);

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
