import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Mock devextreme/ui/notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

import notify from 'devextreme/ui/notify';
import {
  handleApiError,
  handleValidationErrors,
  showSuccess,
  showWarning,
  showInfo,
} from '@/lib/hr/error-handler';

describe('HR Error Handler Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('shows error notification with Error message', () => {
      const error = new Error('Failed to save data');
      handleApiError(error, 'Default message');

      expect(notify).toHaveBeenCalledWith('Failed to save data', 'error', 5000);
    });

    it('shows error notification with string error', () => {
      handleApiError('Something went wrong', 'Default message');

      expect(notify).toHaveBeenCalledWith('Something went wrong', 'error', 5000);
    });

    it('shows default message when error is unknown type', () => {
      handleApiError({ code: 500 }, 'Default error message');

      expect(notify).toHaveBeenCalledWith('Default error message', 'error', 5000);
    });

    it('uses default message when no message provided', () => {
      handleApiError(null);

      expect(notify).toHaveBeenCalledWith('เกิดข้อผิดพลาด', 'error', 5000);
    });

    it('handles undefined error', () => {
      handleApiError(undefined, 'Server error');

      expect(notify).toHaveBeenCalledWith('Server error', 'error', 5000);
    });
  });

  describe('handleValidationErrors', () => {
    it('shows validation errors with field info', () => {
      const errors = [
        { field: 'code', message: 'รหัสต้องไม่ว่าง' },
        { field: 'name', message: 'ชื่อต้องไม่ว่าง' },
      ];

      handleValidationErrors(errors);

      expect(notify).toHaveBeenCalledWith(
        'ข้อมูลไม่ถูกต้อง:\ncode: รหัสต้องไม่ว่าง\nname: ชื่อต้องไม่ว่าง',
        'error',
        5000
      );
    });

    it('shows single validation error correctly', () => {
      const errors = [{ field: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' }];

      handleValidationErrors(errors);

      expect(notify).toHaveBeenCalledWith(
        'ข้อมูลไม่ถูกต้อง:\nemail: รูปแบบอีเมลไม่ถูกต้อง',
        'error',
        5000
      );
    });

    it('handles empty errors array', () => {
      handleValidationErrors([]);

      expect(notify).toHaveBeenCalledWith('ข้อมูลไม่ถูกต้อง:\n', 'error', 5000);
    });
  });

  describe('showSuccess', () => {
    it('shows success notification with message', () => {
      showSuccess('บันทึกสำเร็จ');

      expect(notify).toHaveBeenCalledWith('บันทึกสำเร็จ', 'success', 3000);
    });

    it('shows success with custom message', () => {
      showSuccess('สร้างตำแหน่งใหม่สำเร็จ');

      expect(notify).toHaveBeenCalledWith('สร้างตำแหน่งใหม่สำเร็จ', 'success', 3000);
    });
  });

  describe('showWarning', () => {
    it('shows warning notification with message', () => {
      showWarning('กรุณาระบุข้อมูล');

      expect(notify).toHaveBeenCalledWith('กรุณาระบุข้อมูล', 'warning', 3000);
    });

    it('shows warning with custom message', () => {
      showWarning('ระบบจะหมดอายุใน 30 วัน');

      expect(notify).toHaveBeenCalledWith('ระบบจะหมดอายุใน 30 วัน', 'warning', 3000);
    });
  });

  describe('showInfo', () => {
    it('shows info notification with message', () => {
      showInfo('กำลังโหลดข้อมูล');

      expect(notify).toHaveBeenCalledWith('กำลังโหลดข้อมูล', 'info', 3000);
    });

    it('shows info with custom message', () => {
      showInfo('อัปเดตข้อมูลแล้ว');

      expect(notify).toHaveBeenCalledWith('อัปเดตข้อมูลแล้ว', 'info', 3000);
    });
  });
});
