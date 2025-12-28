/**
 * DocumentAttachment Component Tests
 * Tests the document attachment component with audit log viewing capability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DocumentAttachment } from '@/components/ui/document-attachment';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock data
const mockAttachments = [
  {
    id: 1,
    moduleName: 'template-items',
    entityId: 123,
    fileName: 'test-document.pdf',
    fileSize: 1024000,
    mimeType: 'application/pdf',
    description: 'Test PDF document',
    category: 'report',
    uploadedBy: 1,
    uploadedByName: 'Test User',
    uploadedAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    moduleName: 'template-items',
    entityId: 123,
    fileName: 'photo.jpg',
    fileSize: 512000,
    mimeType: 'image/jpeg',
    description: 'Photo attachment',
    category: 'photo',
    uploadedBy: 1,
    uploadedByName: 'Test User',
    uploadedAt: '2024-01-16T14:00:00Z',
    updatedAt: '2024-01-16T14:00:00Z',
  },
];

describe('DocumentAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockAttachments }),
    });
  });

  it('renders without crashing', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('displays attachments list', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
  });

  it('shows correct attachment count', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows upload button when not readonly', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
        readOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
  });

  it('hides upload button in readonly mode', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
        readOnly={true}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });
  });

  it('displays custom title', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
        title="Test Attachments"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Attachments')).toBeInTheDocument();
    });
  });

  it('has history button for each attachment', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      // History buttons should be present for each attachment
      const historyButtons = screen.getAllByTitle('ประวัติการเปลี่ยนแปลง');
      expect(historyButtons.length).toBe(2); // One for each attachment
    });
  });

  it('shows download button for each attachment', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      const downloadButtons = screen.getAllByTitle('Download');
      expect(downloadButtons.length).toBe(2);
    });
  });

  it('handles empty attachments', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No attachments yet')).toBeInTheDocument();
    });
  });

  it('shows file size in human readable format', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      // 1024000 bytes = 1000.0 KB
      expect(screen.getByText(/1000\.0 KB/)).toBeInTheDocument();
      // 512000 bytes = 500.0 KB
      expect(screen.getByText(/500\.0 KB/)).toBeInTheDocument();
    });
  });

  it('displays category labels in Thai', async () => {
    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('รายงาน')).toBeInTheDocument(); // report
      expect(screen.getByText('รูปภาพ')).toBeInTheDocument(); // photo
    });
  });

  it('opens audit log dialog when history button clicked', async () => {
    // Mock audit log fetch
    mockFetch.mockImplementation((url: string) => {
      // Handle audit log requests - modifiers and actions are query params, not paths
      if (url.includes('/api/audit-logs') && url.includes('getModifiers=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        });
      }
      if (url.includes('/api/audit-logs') && url.includes('getActions=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        });
      }
      if (url.includes('/api/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [], total: 0 }),
        });
      }
      // Handle attachments request
      if (url.includes('/api/attachments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockAttachments }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
    });

    render(
      <DocumentAttachment
        moduleName="template-items"
        entityId={123}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    });

    // Click history button on first attachment
    const historyButtons = screen.getAllByTitle('ประวัติการเปลี่ยนแปลง');
    fireEvent.click(historyButtons[0]);

    // Audit log dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/ประวัติเอกสารแนบ #1/)).toBeInTheDocument();
    });
  });
});
