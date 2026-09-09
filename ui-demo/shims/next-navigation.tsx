import * as React from 'react';

/**
 * Router / path stubs.
 *
 * The sidebar highlights whatever `usePathname` returns, so the demo publishes
 * its current screen's path here — otherwise every menu item reads inactive
 * and the shell looks wrong in exactly the place the review is looking.
 *
 * The stored value carries the query string too, because one screen (the work
 * order detail) picks its opening tab out of `?tab=`. Path and query are split
 * apart again at the two hooks, the way Next.js hands them over: `usePathname`
 * never sees the query, `useSearchParams` never sees the path.
 */
let currentPath = '/production/work-orders/142/execution';
const listeners = new Set<() => void>();

export function setDemoPath(path: string) {
  if (path === currentPath) return;
  currentPath = path;
  listeners.forEach((fn) => fn());
}

function useFullPath() {
  return React.useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => currentPath,
    () => currentPath,
  );
}

export function usePathname() {
  return useFullPath().split('?')[0];
}

/** Set by the demo shell so in-app links move between demo screens. */
let navigate: ((href: string) => boolean) | null = null;
export function setDemoNavigate(fn: (href: string) => boolean) {
  navigate = fn;
}

export function useRouter() {
  const push = (href: string) => {
    // Handled links change screen; the rest are outside the review's scope and
    // say so rather than failing silently.
    if (navigate?.(href)) return;
    window.alert(`เดโม: ปุ่มนี้จะพาไปที่ ${href}`);
  };
  return { push, replace: push, back: () => {}, refresh: () => {}, prefetch: () => {} };
}

export function useParams() {
  // Read the id out of the screen's own path. The QC sample page asks for a
  // particular sample and the captured payloads are keyed by id, so a fixed
  // value would have it fetching a record the demo does not carry.
  const path = usePathname();
  const id = path.match(/\/(\d+)(?:\/|$)/)?.[1] ?? '142';
  return { id };
}

export function useSearchParams() {
  // A new object per render would restart every effect that lists it as a
  // dependency; the query string is the thing that actually changes.
  const query = useFullPath().split('?')[1] ?? '';
  return React.useMemo(() => new URLSearchParams(query), [query]);
}
