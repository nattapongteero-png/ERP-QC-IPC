'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiErrorProvider, useApiErrors } from '@/contexts/api-error-context';
import { GlobalApiErrors } from '@/components/ui/global-api-errors';
import { DevExtremeProvider } from '@/components/providers/devextreme-provider';
import { ToastProvider } from '@/components/ui/toast';

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
            // Log validation errors if present
            if (data.errors && Array.isArray(data.errors)) {
              console.error('Validation Errors:', JSON.stringify(data.errors, null, 2));
            }
            if (data.debug) {
              console.error('Debug:', data.debug);
              if (data.debug.stack) {
                console.error('Stack Trace:\n', data.debug.stack);
              }
            }
            console.groupEnd();

            // Format error message with validation details
            let errorMessage = data.error;
            if (data.errors && Array.isArray(data.errors)) {
              const errorDetails = data.errors
                .map((e: { field?: string; message?: string }) =>
                  e.field ? `${e.field}: ${e.message}` : e.message || JSON.stringify(e)
                )
                .join(', ');
              errorMessage = `${data.error}: ${errorDetails}`;
            }

            addError({
              error: errorMessage,
              debug: data.debug,
              url,
              method,
              // Forward permission-denial metadata so the toast can render
              // an actionable hint (which permission to grant + where).
              missingPermissions: data.missingPermissions,
              userRole: data.userRole,
              actionHint: data.actionHint,
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
  // Create QueryClient on client side only to prevent hydration issues
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DevExtremeProvider>
          <ApiErrorProvider>
            <FetchInterceptor>{children}</FetchInterceptor>
            <GlobalApiErrors />
          </ApiErrorProvider>
        </DevExtremeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
