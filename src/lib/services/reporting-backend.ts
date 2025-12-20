/**
 * Reporting Backend Service
 * Handles communication with the ASP.NET Core reporting backend
 * with JWT token forwarding for authenticated requests
 */

import { cookies } from 'next/headers';

const REPORTING_BACKEND_URL = process.env.NEXT_PUBLIC_REPORTING_BACKEND_URL || 'http://localhost:5000';

export interface ReportingBackendOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ReportingBackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Get the JWT token from cookies
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('token') || cookieStore.get('auth_token');
    return tokenCookie?.value || null;
  } catch {
    // Running in client context - try localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token') || localStorage.getItem('auth_token');
    }
    return null;
  }
}

/**
 * Make an authenticated request to the reporting backend
 */
export async function fetchReportingBackend<T = unknown>(
  endpoint: string,
  options: ReportingBackendOptions = {}
): Promise<ReportingBackendResponse<T>> {
  const { method = 'GET', body, headers = {}, timeout = 30000 } = options;

  try {
    // Get JWT token
    const token = await getAuthToken();

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add Authorization header if token exists
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Build URL
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${REPORTING_BACKEND_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Make request
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    let data: T | undefined;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('text/')) {
      data = (await response.text()) as unknown as T;
    }

    if (!response.ok) {
      return {
        success: false,
        error: (data as { message?: string })?.message || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          status: 408,
        };
      }
      return {
        success: false,
        error: error.message,
        status: 500,
      };
    }
    return {
      success: false,
      error: 'Unknown error occurred',
      status: 500,
    };
  }
}

/**
 * Get report definition from the backend
 */
export async function getReportDefinition(reportCode: string): Promise<ReportingBackendResponse<string>> {
  return fetchReportingBackend<string>(`/api/reports/${reportCode}/definition`);
}

/**
 * Save report definition to the backend
 */
export async function saveReportDefinition(
  reportCode: string,
  definition: string
): Promise<ReportingBackendResponse<{ version: number }>> {
  return fetchReportingBackend<{ version: number }>(`/api/reports/${reportCode}/definition`, {
    method: 'PUT',
    body: { definition },
  });
}

/**
 * Get report preview URL with authentication
 */
export function getReportPreviewUrl(reportCode: string, parameters?: Record<string, unknown>): string {
  let url = `${REPORTING_BACKEND_URL}/api/reports/${reportCode}/preview`;

  if (parameters && Object.keys(parameters).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) => {
      searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    url += `?${searchParams.toString()}`;
  }

  return url;
}

/**
 * Get report export URL with authentication
 */
export function getReportExportUrl(
  reportCode: string,
  format: 'pdf' | 'xlsx' | 'docx' | 'csv' | 'rtf' | 'html',
  parameters?: Record<string, unknown>
): string {
  let url = `${REPORTING_BACKEND_URL}/api/reports/${reportCode}/export/${format}`;

  if (parameters && Object.keys(parameters).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) => {
      searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    url += `?${searchParams.toString()}`;
  }

  return url;
}

/**
 * Export report with authentication (returns blob)
 */
export async function exportReport(
  reportCode: string,
  format: 'pdf' | 'xlsx' | 'docx' | 'csv' | 'rtf' | 'html',
  parameters?: Record<string, unknown>
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const token = await getAuthToken();
    const url = getReportExportUrl(reportCode, format, parameters);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return {
        success: false,
        error: `Export failed with status ${response.status}`,
      };
    }

    const blob = await response.blob();

    // Extract filename from Content-Disposition header if available
    const contentDisposition = response.headers.get('content-disposition');
    let filename = `${reportCode}.${format}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    return { success: true, blob, filename };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Get available data sources from the backend
 */
export async function getDataSources(): Promise<ReportingBackendResponse<Array<{
  name: string;
  type: string;
  endpoint: string;
}>>> {
  return fetchReportingBackend('/api/datasources');
}

/**
 * Test data source connection
 */
export async function testDataSource(
  endpoint: string,
  parameters?: Record<string, unknown>
): Promise<ReportingBackendResponse<{ connected: boolean; rowCount?: number }>> {
  return fetchReportingBackend('/api/datasources/test', {
    method: 'POST',
    body: { endpoint, parameters },
  });
}
