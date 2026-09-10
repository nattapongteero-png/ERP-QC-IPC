import * as React from 'react';
import { getDemoActor, subscribeDemoActor } from '../mock-api';

/**
 * Session stub — the demo has no auth server, but MainLayout refuses to render
 * without a resolved user (and redirects to /login).
 *
 * Who it returns is switchable, because GMP forbids verifying your own work:
 * with one fixed person the SOP screen correctly refuses to let the operator
 * sign off, and the reviewer hits a wall that looks like a broken button. The
 * switch in the demo bar is how they get to be the second person.
 */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

const EMAILS: Record<number, string> = {
  1: 'production@herbal-erp.com',
  3: 'qc@herbal-erp.com',
};

export function useCachedSession() {
  const actor = React.useSyncExternalStore(subscribeDemoActor, getDemoActor, getDemoActor);
  const user: SessionUser = {
    id: actor.id,
    name: actor.name,
    email: EMAILS[actor.id] ?? 'demo@herbal-erp.com',
    role: 'admin',
  };
  return { user, isLoading: false, unauthenticated: false };
}

export function clearCachedSession() {}
