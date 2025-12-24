'use client';

/**
 * Client Error Reporter (Development Only)
 *
 * Captures browser errors and forwards them to the server log.
 * This helps developers inspect client-side errors in the server console
 * when multiple testers are using the system.
 *
 * Captures:
 * - Uncaught JavaScript errors (window.onerror)
 * - Unhandled promise rejections
 * - React error boundaries
 * - Console errors (optional)
 */

import { useEffect, useCallback, useRef, Component, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface ClientError {
  type: 'error' | 'unhandledrejection' | 'react-error' | 'console-error';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  timestamp: string;
  userAgent?: string;
  pathname?: string;
}

// Only enable in development
const isDev = process.env.NODE_ENV === 'development';

// Error queue for batching
let errorQueue: ClientError[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

// Flush errors to server
async function flushErrors() {
  if (errorQueue.length === 0) return;

  const errors = [...errorQueue];
  errorQueue = [];

  try {
    await fetch('/api/dev/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errors),
    });
  } catch {
    // Silently fail - don't cause more errors
  }
}

// Queue an error and schedule flush
function queueError(error: ClientError) {
  if (!isDev) return;

  errorQueue.push(error);

  // Debounce flush
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushErrors, 500);
}

// Format error for reporting
function formatError(
  type: ClientError['type'],
  message: string,
  options: Partial<ClientError> = {}
): ClientError {
  return {
    type,
    message: String(message).substring(0, 2000),
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
    ...options,
    stack: options.stack?.substring(0, 5000),
    componentStack: options.componentStack?.substring(0, 2000),
  };
}

/**
 * Error Boundary for React errors
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class DevErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (!isDev) return;

    queueError(
      formatError('react-error', error.message, {
        stack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
      })
    );
  }

  render() {
    if (this.state.hasError) {
      // In dev, show error but allow recovery
      return (
        this.props.fallback || (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-red-800 font-semibold mb-2">Something went wrong</h2>
            <p className="text-red-600 text-sm mb-3">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to set up global error handlers
 */
function useGlobalErrorHandlers(pathname: string | null) {
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const handleError = useCallback((event: ErrorEvent) => {
    queueError(
      formatError('error', event.message, {
        url: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        pathname: pathnameRef.current || undefined,
      })
    );
  }, []);

  const handleRejection = useCallback((event: PromiseRejectionEvent) => {
    const error = event.reason;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    queueError(
      formatError('unhandledrejection', message, {
        stack,
        pathname: pathnameRef.current || undefined,
      })
    );
  }, []);

  useEffect(() => {
    if (!isDev || typeof window === 'undefined') return;

    // Set up global handlers
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Optional: Intercept console.error
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      // Call original
      originalConsoleError.apply(console, args);

      // Report to server (skip if it's from React internals)
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      // Skip React's internal hydration warnings and dev tool messages
      if (
        message.includes('Warning:') ||
        message.includes('ReactDOM.hydrate') ||
        message.includes('[HMR]') ||
        message.includes('[Fast Refresh]')
      ) {
        return;
      }

      queueError(
        formatError('console-error', message.substring(0, 1000), {
          pathname: pathnameRef.current || undefined,
        })
      );
    };

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
    };
  }, [handleError, handleRejection]);
}

/**
 * Client Error Reporter Component
 *
 * Wrap your app with this component to enable error forwarding to server logs.
 * Only active in development mode.
 */
export function ClientErrorReporter({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Set up global error handlers
  useGlobalErrorHandlers(pathname);

  // In production, just render children
  if (!isDev) {
    return <>{children}</>;
  }

  // In development, wrap with error boundary
  return <DevErrorBoundary>{children}</DevErrorBoundary>;
}

export default ClientErrorReporter;
