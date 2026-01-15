/**
 * UI Test Utilities
 * Feature: 014-unit-cost
 *
 * Shared utilities for UI component testing with React Testing Library.
 * Provides QueryClient setup, fetch mocking, and render helpers.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// ============================================
// QueryClient Factory
// ============================================

/**
 * Create a QueryClient configured for testing
 * - Disables retries for faster test failures
 * - Disables garbage collection time for predictable behavior
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================
// Render Helpers
// ============================================

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

/**
 * Render a component with all necessary providers
 * - QueryClientProvider for data fetching
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// ============================================
// Fetch Mock Types
// ============================================

export interface MockApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface MockPaginatedData<T = unknown> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FetchMockHandler = (url: string, options?: RequestInit) => Promise<Response> | Response;

export interface FetchMockConfig {
  [urlPattern: string]: {
    data: unknown;
    ok?: boolean;
    status?: number;
  };
}

// ============================================
// Fetch Mock Factory
// ============================================

/**
 * Create a paginated API response structure
 * This matches the actual API response format: { success: true, data: { items: [...], total, page, limit, totalPages } }
 */
export function createPaginatedResponse<T>(
  items: T[],
  options: { page?: number; limit?: number; total?: number } = {}
): MockApiResponse<MockPaginatedData<T>> {
  const { page = 1, limit = 1000, total = items.length } = options;
  return {
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Create a single item API response
 */
export function createSingleResponse<T>(data: T): MockApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(error: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create a fetch mock function from a configuration object
 *
 * @example
 * const fetchMock = createFetchMock({
 *   '/api/vendors': { data: createPaginatedResponse(mockVendors) },
 *   '/api/items': { data: createPaginatedResponse(mockItems) },
 * });
 * global.fetch = vi.fn(fetchMock);
 */
export function createFetchMock(config: FetchMockConfig): FetchMockHandler {
  return (url: string, _options?: RequestInit) => {
    // Find matching handler by checking if URL contains the pattern
    for (const [pattern, handler] of Object.entries(config)) {
      if (url.includes(pattern)) {
        const { data, ok = true, status = 200 } = handler;
        return Promise.resolve(
          new Response(
            JSON.stringify(data),
            {
              status: ok ? status : (status || 400),
              headers: { 'Content-Type': 'application/json' },
              ok,
            } as ResponseInit
          )
        );
      }
    }

    // Default: return empty success response
    return Promise.resolve(
      new Response(
        JSON.stringify({ success: true, data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  };
}

/**
 * Setup fetch mock with common handlers
 * Merges provided handlers with default empty responses
 */
export function setupFetchMock(handlers: FetchMockConfig): void {
  const fetchMock = createFetchMock(handlers);
  global.fetch = vi.fn().mockImplementation(fetchMock);
}

/**
 * Clear fetch mock and restore original
 */
export function clearFetchMock(): void {
  if (global.fetch && typeof (global.fetch as ReturnType<typeof vi.fn>).mockClear === 'function') {
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  }
}

// ============================================
// Common Test Assertions
// ============================================

/**
 * Assert that fetch was called with a specific URL pattern
 */
export function expectFetchCalledWith(urlPattern: string): void {
  const calls = vi.mocked(global.fetch).mock.calls;
  const matchingCall = calls.find(([url]) =>
    typeof url === 'string' && url.includes(urlPattern)
  );
  if (!matchingCall) {
    throw new Error(`Expected fetch to be called with URL containing "${urlPattern}". Calls: ${calls.map(c => c[0]).join(', ')}`);
  }
}

/**
 * Get all fetch call URLs for debugging
 */
export function getFetchCallUrls(): string[] {
  return vi.mocked(global.fetch).mock.calls
    .map(([url]) => typeof url === 'string' ? url : String(url));
}

// ============================================
// Regression Test Helpers
// ============================================

/**
 * Test that API response structure is correctly handled
 * This catches the common bug where data.data is used instead of data.data.items
 */
export function assertPaginatedResponseStructure<T>(response: MockApiResponse<MockPaginatedData<T>>): void {
  // Correct: response.data.items should be an array
  if (!Array.isArray(response.data.items)) {
    throw new Error('response.data.items should be an array');
  }

  // Common bug: response.data should NOT be treated as an array
  if (Array.isArray(response.data)) {
    throw new Error('response.data should NOT be an array - use response.data.items');
  }

  // Verify pagination fields exist
  if (typeof response.data.total !== 'number') {
    throw new Error('response.data.total should be a number');
  }
  if (typeof response.data.page !== 'number') {
    throw new Error('response.data.page should be a number');
  }
}

// ============================================
// Wait Helpers
// ============================================

/**
 * Wait for a condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// ============================================
// Re-exports for convenience
// ============================================

export { vi } from 'vitest';
export { screen, waitFor, fireEvent, within } from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
