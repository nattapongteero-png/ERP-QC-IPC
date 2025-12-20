/**
 * Reporting Backend Proxy API Route
 * Proxies all requests to the ASP.NET Core reporting backend
 * This eliminates the need for CORS and exposes a single API URL to the frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Internal reporting backend URL (Docker internal network or localhost for dev)
const REPORTING_BACKEND_URL = process.env.REPORTING_BACKEND_URL || 'http://localhost:5000';

// Timeout for proxy requests (60 seconds for large report exports)
const PROXY_TIMEOUT = 60000;

/**
 * Get JWT token from cookies or authorization header
 */
async function getAuthToken(request: NextRequest): Promise<string | null> {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fall back to cookies
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('token') || cookieStore.get('auth_token');
    return tokenCookie?.value || null;
  } catch {
    return null;
  }
}

/**
 * Build headers for the proxied request
 */
function buildProxyHeaders(request: NextRequest, token: string | null): Headers {
  const headers = new Headers();

  // Forward content-type
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  // Forward accept header
  const accept = request.headers.get('accept');
  if (accept) {
    headers.set('Accept', accept);
  }

  // Add authorization if token exists
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Add X-Forwarded headers for the backend to know the original request
  headers.set('X-Forwarded-Host', request.headers.get('host') || '');
  headers.set('X-Forwarded-Proto', request.nextUrl.protocol.replace(':', ''));

  return headers;
}

/**
 * Handle the proxy request
 */
async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>
): Promise<NextResponse> {
  const { path } = await params;
  const pathString = path.join('/');

  // Build the target URL
  const url = new URL(request.url);
  const targetUrl = `${REPORTING_BACKEND_URL}/${pathString}${url.search}`;

  try {
    const token = await getAuthToken(request);
    const headers = buildProxyHeaders(request, token);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT);

    // Get request body if present
    let body: BodyInit | null = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await request.text();
      } else if (contentType?.includes('multipart/form-data')) {
        body = await request.arrayBuffer();
      } else {
        body = await request.text();
      }
    }

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Get response body
    const responseContentType = response.headers.get('content-type');
    let responseBody: ArrayBuffer | string;

    if (
      responseContentType?.includes('application/json') ||
      responseContentType?.includes('text/')
    ) {
      responseBody = await response.text();
    } else {
      // Binary content (PDF, Excel, etc.)
      responseBody = await response.arrayBuffer();
    }

    // Build response headers
    const responseHeaders = new Headers();

    // Forward important headers
    const headersToForward = [
      'content-type',
      'content-disposition',
      'content-length',
      'cache-control',
      'etag',
      'last-modified',
    ];

    headersToForward.forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Reporting proxy error for ${targetUrl}:`, error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout', message: 'The reporting backend did not respond in time' },
          { status: 504 }
        );
      }

      // Connection refused or network error
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        return NextResponse.json(
          {
            error: 'Service unavailable',
            message: 'The reporting backend is not available. Please try again later.',
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Proxy error', message: 'Failed to connect to reporting backend' },
      { status: 502 }
    );
  }
}

// HTTP method handlers
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context.params);
}
