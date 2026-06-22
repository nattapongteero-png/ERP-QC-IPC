'use client';

import { useEffect, useState } from 'react';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

// Module-level cache. Because every ERP module has its own layout.tsx that
// renders <MainLayout/>, navigating between modules unmounts one layout subtree
// and mounts another — so MainLayout (and the Sidebar) remount on every
// cross-module navigation. Without a cache, each remount re-fetched
// /api/auth/session and flashed the full-screen loading spinner, which felt
// like a hard page reload. We keep the resolved user here (outside React) so a
// remount resolves synchronously from cache and never shows the spinner again
// for the rest of the SPA session.
let cachedUser: SessionUser | null = null;
let inFlight: Promise<SessionUser | null> | null = null;

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/session');
    const data = await res.json();
    if (data?.success && data?.data?.user) return data.data.user as SessionUser;
    return null;
  } catch {
    return null;
  }
}

export interface CachedSession {
  user: SessionUser | null;
  /** true only on the very first load (no cache yet). Remounts never reload. */
  isLoading: boolean;
  /** true when the session resolved to "no user" (caller should redirect). */
  unauthenticated: boolean;
}

/**
 * Returns the current user, served from an in-memory cache so that the
 * loading state appears at most once per SPA session — not on every
 * cross-module navigation that remounts MainLayout.
 */
export function useCachedSession(): CachedSession {
  const [user, setUser] = useState<SessionUser | null>(cachedUser);
  const [isLoading, setIsLoading] = useState(cachedUser === null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    // Cache hit — nothing to do; we already rendered with the user.
    if (cachedUser) {
      if (isLoading) setIsLoading(false);
      return;
    }

    // De-dupe concurrent mounts onto a single request.
    if (!inFlight) inFlight = fetchSession();

    inFlight
      .then((resolved) => {
        if (resolved) cachedUser = resolved;
        if (!active) return;
        setUser(resolved);
        setUnauthenticated(resolved === null);
        setIsLoading(false);
      })
      .finally(() => {
        inFlight = null;
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, isLoading, unauthenticated };
}

/** Clear the cache (e.g. on logout) so the next session is fetched fresh. */
export function clearCachedSession() {
  cachedUser = null;
  inFlight = null;
}
