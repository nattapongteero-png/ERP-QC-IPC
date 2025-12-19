'use client';

import { useEffect } from 'react';
import { ApiErrorProvider, useApiErrors } from '@/contexts/api-error-context';
import { GlobalApiErrors } from '@/components/ui/global-api-errors';
import { DevExtremeProvider } from '@/components/providers/devextreme-provider';

// Component that intercepts fetch calls
function FetchInterceptor({ children }: { children: React.ReactNode }) {
  const { addError } = useApiErrors();

  useEffect(() => {
    // Store the original fetch
    const originalFetch = window.fetch;

    // Override fetch with our interceptor
    window.fetch = async function (...args) {
      const [input, init] = args;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';

      // Only intercept API calls
      if (!url.startsWith('/api/')) {
        return originalFetch.apply(this, args);
      }

      // Skip error logging for auth endpoints (401 is expected when not logged in)
      const isAuthEndpoint = url.startsWith('/api/auth/');

      try {
        const response = await originalFetch.apply(this, args);

        // Clone the response so we can read the body
        const clonedResponse = response.clone();

        try {
          const data = await clonedResponse.json();

          // Check if the API returned an error
          // Skip auth endpoints (401 is expected) and auth-related errors (session expired/not logged in)
          const isAuthError = data.error === 'Please login to continue' ||
                              data.error === 'Session expired' ||
                              data.error === 'Unauthorized';

          if (!data.success && data.error && !isAuthEndpoint && !isAuthError) {
            console.group('🚨 API Error');
            console.error('URL:', url);
            console.error('Method:', method);
            console.error('Error:', data.error);
            if (data.debug) {
              console.error('Debug:', data.debug);
              if (data.debug.stack) {
                console.error('Stack Trace:\n', data.debug.stack);
              }
            }
            console.groupEnd();

            addError({
              error: data.error,
              debug: data.debug,
              url,
              method,
            });
          }
        } catch {
          // Response is not JSON, ignore
        }

        return response;
      } catch (error) {
        // Ignore AbortError - these are expected when requests are cancelled
        // (e.g., dialog closes, new search starts, component unmounts)
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        // Network error
        const errorMessage = error instanceof Error ? error.message : 'Network error';
        addError({
          error: errorMessage,
          debug: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            timestamp: new Date().toISOString(),
            path: url,
          } : {
            message: String(error),
            timestamp: new Date().toISOString(),
            path: url,
          },
          url,
          method,
        });
        throw error;
      }
    };

    // Cleanup: restore original fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, [addError]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DevExtremeProvider>
      <ApiErrorProvider>
        <FetchInterceptor>{children}</FetchInterceptor>
        <GlobalApiErrors />
      </ApiErrorProvider>
    </DevExtremeProvider>
  );
}
