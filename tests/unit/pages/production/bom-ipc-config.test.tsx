/**
 * Unit Tests: BOM IPC Configuration
 * Tests the BOM Configuration page with IPC criteria section
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: '1' }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'th',
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { useQuery } from '@tanstack/react-query';
const mockUseQuery = useQuery as any;

describe('BOM Configuration Page - IPC Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('validates BOM configuration page component exists', async () => {
    const mod = await import('@/app/production/bom/[id]/configuration/page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('validates BOM IPC API route exports', async () => {
    const route = await import('@/app/api/production/bom/[id]/ipc/route');
    expect(route.GET).toBeDefined();
    expect(route.POST).toBeDefined();
    expect(route.PUT).toBeDefined();
    expect(route.DELETE).toBeDefined();
  });
});
