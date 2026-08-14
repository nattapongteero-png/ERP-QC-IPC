/** Router stub — the demo has one screen, so navigation only needs to not crash. */
export function useRouter() {
  return {
    push: (href: string) => window.alert(`เดโม: ปุ่มนี้จะพาไปที่ ${href}`),
    replace: () => {},
    back: () => {},
    refresh: () => {},
    prefetch: () => {},
  };
}
export function usePathname() {
  return '/master-data/ipc-criteria/new';
}
export function useSearchParams() {
  return new URLSearchParams();
}
