/**
 * Attachment API Integration Tests
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock authentication
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => Promise.resolve({ userId: 1, role: 'admin' })),
  hasPermission: vi.fn(() => true),
}));

// Mock attachment service
vi.mock('@/lib/services/attachment-service', () => ({
  getAttachments: vi.fn(),
  getAttachmentById: vi.fn(),
  getAttachmentFileData: vi.fn(),
  createAttachment: vi.fn(),
  updateAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

import { GET, POST } from '@/app/api/attachments/route';
import { DELETE } from '@/app/api/attachments/[id]/route';
import { GET as DOWNLOAD } from '@/app/api/attachments/[id]/download/route';
import {
  getAttachments,
  getAttachmentFileData,
  createAttachment,
  deleteAttachment,
  type Attachment,
} from '@/lib/services/attachment-service';

describe('Attachments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/attachments', () => {
    it('should return attachments for valid moduleName and entityId', async () => {
      const mockAttachments: Attachment[] = [
        {
          id: 1,
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          description: null,
          category: 'evidence',
          uploadedBy: 1,
          uploadedByName: 'Test User',
          uploadedAt: '2024-12-23T10:00:00Z',
          updatedAt: '2024-12-23T10:00:00Z',
        },
      ];
      vi.mocked(getAttachments).mockResolvedValue(mockAttachments);

      const request = new NextRequest(
        'http://localhost/api/attachments?moduleName=capa&entityId=1'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].fileName).toBe('test.pdf');
    });

    it('should return error for invalid module name', async () => {
      const request = new NextRequest(
        'http://localhost/api/attachments?moduleName=invalid&entityId=1'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/attachments', () => {
    it('should create attachment with valid data', async () => {
      const mockCreated: Attachment = {
        id: 1,
        moduleName: 'capa',
        entityId: 1,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        description: null,
        category: null,
        uploadedBy: 1,
        uploadedByName: 'Test User',
        uploadedAt: '2024-12-23T10:00:00Z',
        updatedAt: '2024-12-23T10:00:00Z',
      };
      vi.mocked(createAttachment).mockResolvedValue(mockCreated);

      const request = new NextRequest('http://localhost/api/attachments', {
        method: 'POST',
        body: JSON.stringify({
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileData: Buffer.from('test').toString('base64'),
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.fileName).toBe('test.pdf');
    });

    it('should reject invalid file type', async () => {
      const request = new NextRequest('http://localhost/api/attachments', {
        method: 'POST',
        body: JSON.stringify({
          moduleName: 'capa',
          entityId: 1,
          fileName: 'test.exe',
          fileSize: 1024,
          mimeType: 'application/x-msdownload',
          fileData: Buffer.from('test').toString('base64'),
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid file type');
    });
  });

  describe('GET /api/attachments/[id]/download', () => {
    it('should return file for download', async () => {
      vi.mocked(getAttachmentFileData).mockResolvedValue({
        data: Buffer.from('test content'),
        fileName: 'test.pdf',
        fileSize: 12,
        mimeType: 'application/pdf',
      });

      const request = new NextRequest(
        'http://localhost/api/attachments/1/download'
      );
      const response = await DOWNLOAD(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
    });

    it('should return inline for preview when requested', async () => {
      vi.mocked(getAttachmentFileData).mockResolvedValue({
        data: Buffer.from('test content'),
        fileName: 'test.pdf',
        fileSize: 12,
        mimeType: 'application/pdf',
      });

      const request = new NextRequest(
        'http://localhost/api/attachments/1/download?inline=1'
      );
      const response = await DOWNLOAD(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toBe('inline');
    });
  });

  describe('DELETE /api/attachments/[id]', () => {
    it('should delete attachment successfully', async () => {
      vi.mocked(deleteAttachment).mockResolvedValue();

      const request = new NextRequest('http://localhost/api/attachments/1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(deleteAttachment).toHaveBeenCalledWith(1, 1);
    });
  });
});
