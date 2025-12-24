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
import { usePathname, useSearchParams } from 'next/navigation';

interface ClientError {
  type: 'error' | 'unhandledrejection' | 'react-error' | 'console-error';
  message: string;
  errorName?: string;
  stack?: string;
  url?: string;
  fullUrl?: string;
  referrer?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  timestamp: string;
  userAgent?: string;
  pathname?: string;
  searchParams?: string;
  // Additional context
  viewport?: { width: number; height: number };
  activeElement?: string;
  documentTitle?: string;
  networkStatus?: string;
  sessionId?: string;
  reactVersion?: string;
  // DOM context for hydration errors
  domContext?: string;
}

// Only enable in development
const isDev = process.env.NODE_ENV === 'development';

// Session ID for tracking errors from same browser session
const sessionId = typeof window !== 'undefined'
  ? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  : '';

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
  flushTimeout = setTimeout(flushErrors, 300);
}

// Get active element description
function getActiveElementInfo(): string {
  try {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';

    let info = el.tagName.toLowerCase();
    if (el.id) info += `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      info += `.${el.className.split(' ').slice(0, 3).join('.')}`;
    }
    return info.substring(0, 100);
  } catch {
    return 'unknown';
  }
}

// Get DOM context around error (for hydration issues)
function getDomContext(): string {
  try {
    const root = document.getElementById('__next') || document.body;
    const children = Array.from(root.children).slice(0, 5);
    return children.map(child => {
      let desc = child.tagName.toLowerCase();
      if (child.id) desc += `#${child.id}`;
      if (child.className && typeof child.className === 'string') {
        desc += `.${child.className.split(' ')[0]}`;
      }
      return desc;
    }).join(' > ');
  } catch {
    return '';
  }
}

// Get React version if available
function getReactVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.React?.version) return win.React.version;
    // Try to find from React DevTools
    if (win.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers) {
      const renderer = win.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.get(1);
      if (renderer?.version) return renderer.version;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Parse component stack to extract component names
function parseComponentStack(stack: string | undefined): string {
  if (!stack) return '';

  // Extract component names from stack
  const componentNames: string[] = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    // Match patterns like "at ComponentName" or "in ComponentName"
    const match = line.match(/(?:at|in)\s+([A-Z][a-zA-Z0-9_]*)/);
    if (match && match[1]) {
      componentNames.push(match[1]);
    }
  }

  // Return unique component chain
  const unique = [...new Set(componentNames)];
  return unique.length > 0 ? unique.join(' → ') : stack;
}

// Format error for reporting
function formatError(
  type: ClientError['type'],
  message: string,
  options: Partial<ClientError> = {}
): ClientError {
  const isWindow = typeof window !== 'undefined';
  const isDocument = typeof document !== 'undefined';

  return {
    type,
    message: String(message).substring(0, 3000),
    errorName: options.errorName,
    timestamp: new Date().toISOString(),
    sessionId,
    // URL info
    fullUrl: isWindow ? window.location.href : undefined,
    pathname: isWindow ? window.location.pathname : undefined,
    searchParams: isWindow ? window.location.search : undefined,
    referrer: isDocument ? document.referrer : undefined,
    // Browser info
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    networkStatus: typeof navigator !== 'undefined'
      ? (navigator.onLine ? 'online' : 'offline')
      : undefined,
    // Viewport
    viewport: isWindow ? {
      width: window.innerWidth,
      height: window.innerHeight,
    } : undefined,
    // Document context
    documentTitle: isDocument ? document.title : undefined,
    activeElement: isDocument ? getActiveElementInfo() : undefined,
    domContext: isDocument ? getDomContext() : undefined,
    // React info
    reactVersion: getReactVersion(),
    // Error details
    ...options,
    stack: options.stack?.substring(0, 8000),
    componentStack: options.componentStack
      ? parseComponentStack(options.componentStack) + '\n\n[Raw Stack]\n' + options.componentStack.substring(0, 3000)
      : undefined,
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
  errorInfo?: React.ErrorInfo;
}

class DevErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    if (!isDev) return;

    queueError(
      formatError('react-error', error.message, {
        errorName: error.name,
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
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg max-w-4xl mx-auto">
            <h2 className="text-red-800 font-semibold mb-2">Something went wrong</h2>
            <p className="text-red-600 text-sm mb-3 font-mono">{this.state.error?.message}</p>
            {this.state.errorInfo?.componentStack && (
              <details className="mb-3">
                <summary className="text-red-700 text-sm cursor-pointer hover:underline">
                  Component Stack
                </summary>
                <pre className="text-xs text-red-600 bg-red-100 p-2 mt-2 rounded overflow-auto max-h-40">
                  {parseComponentStack(this.state.errorInfo.componentStack)}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                Reload Page
              </button>
            </div>
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
function useGlobalErrorHandlers(pathname: string | null, searchParams: string | null) {
  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);
  pathnameRef.current = pathname;
  searchParamsRef.current = searchParams;

  const handleError = useCallback((event: ErrorEvent) => {
    queueError(
      formatError('error', event.message, {
        errorName: event.error?.name,
        url: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        pathname: pathnameRef.current || undefined,
        searchParams: searchParamsRef.current || undefined,
      })
    );
  }, []);

  const handleRejection = useCallback((event: PromiseRejectionEvent) => {
    const error = event.reason;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnhandledRejection';

    queueError(
      formatError('unhandledrejection', message, {
        errorName,
        stack,
        pathname: pathnameRef.current || undefined,
        searchParams: searchParamsRef.current || undefined,
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
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack}`;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      // Skip React's internal hydration warnings and dev tool messages
      if (
        message.includes('Warning:') ||
        message.includes('ReactDOM.hydrate') ||
        message.includes('[HMR]') ||
        message.includes('[Fast Refresh]') ||
        message.includes('Download the React DevTools')
      ) {
        return;
      }

      // Extract error name if it's an Error object
      const firstArg = args[0];
      const errorName = firstArg instanceof Error ? firstArg.name : undefined;
      const stack = firstArg instanceof Error ? firstArg.stack : undefined;

      queueError(
        formatError('console-error', message.substring(0, 2000), {
          errorName,
          stack,
          pathname: pathnameRef.current || undefined,
          searchParams: searchParamsRef.current || undefined,
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
 * Inner component that uses hooks
 */
function ErrorReporterInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsStr = searchParams?.toString() || null;

  // Set up global error handlers
  useGlobalErrorHandlers(pathname, searchParamsStr);

  return <>{children}</>;
}

/**
 * Client Error Reporter Component
 *
 * Wrap your app with this component to enable error forwarding to server logs.
 * Only active in development mode.
 */
export function ClientErrorReporter({ children }: { children: ReactNode }) {
  // In production, just render children
  if (!isDev) {
    return <>{children}</>;
  }

  // In development, wrap with error boundary and reporter
  return (
    <DevErrorBoundary>
      <ErrorReporterInner>{children}</ErrorReporterInner>
    </DevErrorBoundary>
  );
}

export default ClientErrorReporter;
