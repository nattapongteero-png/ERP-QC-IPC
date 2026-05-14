'use client';

/**
 * useCurrentUser — fetch the logged-in session user via /api/auth/session.
 *
 * Used by pages that need to compare the logged-in user against a record's
 * operator (e.g. GMP dual-control: a step's operator cannot verify their
 * own work).
 *
 * Cached for 5 minutes — session doesn't change often within a WO session.
 */

import { useQuery } from '@tanstack/react-query';

export interface CurrentUser {
  id: number;
  email?: string;
  name: string;
  role?: string;
  /**
   * Permission codes computed from the user's role (e.g. 'production:clean_mark').
   * Populated by /api/auth/session — empty if the session endpoint has not been
   * updated yet, in which case callers should fall back to the role string.
   */
  permissions?: string[];
}

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (!data.success) throw new Error('Not authenticated');
      return data.data.user as CurrentUser;
    },
    staleTime: 5 * 60 * 1000,
  });
}
