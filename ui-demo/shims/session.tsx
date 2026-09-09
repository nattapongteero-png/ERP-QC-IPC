/**
 * Session stub — the demo has no auth server, but MainLayout refuses to render
 * without a resolved user (and redirects to /login). One fixed operator keeps
 * the real sidebar, avatar and role-gated menu working.
 */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

const DEMO_USER: SessionUser = {
  id: 1,
  name: 'สมชาย ผลิตดี',
  email: 'production@herbal-erp.com',
  role: 'admin',
};

export function useCachedSession() {
  return { user: DEMO_USER, isLoading: false, unauthenticated: false };
}

export function clearCachedSession() {}
