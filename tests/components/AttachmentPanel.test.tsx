/**
 * AttachmentPanel — sanity tests
 * Audit Q3/Q4/Q5 reusable attachment UI
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AttachmentPanel } from '@/components/shared/AttachmentPanel';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('AttachmentPanel', () => {
  it('renders an empty state when there are no attachments', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    render(<AttachmentPanel moduleName="quality_test" entityId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/ยังไม่มีไฟล์แนบ/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/attachments?moduleName=quality_test&entityId=1',
    );
  });

  it('lists each returned attachment with its filename', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            fileName: 'COA_lot42.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            category: 'lab_result',
            description: null,
            uploadedAt: '2026-06-03T10:00:00Z',
          },
          {
            id: 2,
            fileName: 'label_photo.jpg',
            fileSize: 102400,
            mimeType: 'image/jpeg',
            category: 'photo',
            description: null,
            uploadedAt: '2026-06-03T10:05:00Z',
          },
        ],
      }),
    });

    render(<AttachmentPanel moduleName="quality_test" entityId={1} />);

    await waitFor(() => {
      expect(screen.getByText('COA_lot42.pdf')).toBeInTheDocument();
      expect(screen.getByText('label_photo.jpg')).toBeInTheDocument();
    });
    // count next to the title
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('hides upload + delete UI when readOnly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, fileName: 'x.pdf', fileSize: 100, mimeType: 'application/pdf', category: null, description: null, uploadedAt: '' },
        ],
      }),
    });

    render(<AttachmentPanel moduleName="quality_test" entityId={1} readOnly />);

    await waitFor(() => {
      expect(screen.getByText('x.pdf')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('attachments-upload')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('ลบ')).not.toBeInTheDocument();
  });

  it('restricts file picker to images when imagesOnly=true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    render(<AttachmentPanel moduleName="wo_packaging_integrity" entityId={1} imagesOnly />);

    await waitFor(() => screen.getByTestId('attachments-input'));
    const input = screen.getByTestId('attachments-input') as HTMLInputElement;
    expect(input.accept).toMatch(/image\//);
    expect(input.accept).not.toMatch(/pdf/);
  });
});
