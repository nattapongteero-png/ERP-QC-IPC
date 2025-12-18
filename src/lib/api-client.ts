/**
 * Global API client that wraps fetch with automatic error handling
 * Errors are automatically reported to the ApiErrorContext
 */

interface ErrorDetails {
  message: string;
  stack?: string;
  name?: string;
  cause?: string;
  code?: string;
  path?: string;
  timestamp: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  debug?: ErrorDetails;
}

type ErrorCallback = (error: {
  error: string;
  debug?: ErrorDetails;
  url?: string;
  method?: string;
}) => void;

// Global error callback - will be set by the provider
let globalErrorCallback: ErrorCallback | null = null;

export function setGlobalErrorCallback(callback: ErrorCallback | null) {
  globalErrorCallback = callback;
}

export async function apiFetch<T = any>(
  url: string,
  options?: RequestInit & { skipErrorHandler?: boolean }
): Promise<ApiResponse<T>> {
  const { skipErrorHandler, ...fetchOptions } = options || {};
  const method = fetchOptions?.method || 'GET';

  try {
    const response = await fetch(url, fetchOptions);
    const data: ApiResponse<T> = await response.json();

    // If API returned an error, report it
    if (!data.success && !skipErrorHandler && globalErrorCallback) {
      globalErrorCallback({
        error: data.error || `Request failed with status ${response.status}`,
        debug: data.debug,
        url,
        method,
      });
    }

    return data;
  } catch (error) {
    // Network or parsing error
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    const errorDetails: ErrorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      path: url,
    } : {
      message: String(error),
      timestamp: new Date().toISOString(),
      path: url,
    };

    if (!skipErrorHandler && globalErrorCallback) {
      globalErrorCallback({
        error: errorMessage,
        debug: errorDetails,
        url,
        method,
      });
    }

    return {
      success: false,
      error: errorMessage,
      debug: errorDetails,
    };
  }
}

// Convenience methods
export const api = {
  get: <T = any>(url: string, options?: RequestInit & { skipErrorHandler?: boolean }) =>
    apiFetch<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, body: any, options?: RequestInit & { skipErrorHandler?: boolean }) =>
    apiFetch<T>(url, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    }),

  put: <T = any>(url: string, body: any, options?: RequestInit & { skipErrorHandler?: boolean }) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    }),

  patch: <T = any>(url: string, body: any, options?: RequestInit & { skipErrorHandler?: boolean }) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    }),

  delete: <T = any>(url: string, options?: RequestInit & { skipErrorHandler?: boolean }) =>
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
