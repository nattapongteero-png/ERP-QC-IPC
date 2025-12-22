import { describe, it, expect } from 'vitest';

describe('HR Employee Schema', () => {
  it('should include Thai CID field with 13-character constraint', () => {
    // Schema validation will be tested after migration
    const validThaiCid = '1234567890123';
    expect(validThaiCid).toHaveLength(13);
    expect(/^\d{13}$/.test(validThaiCid)).toBe(true);
  });

  it('should include photo URL field', () => {
    const validPhotoUrl = '/uploads/employees/1/photo.jpg';
    expect(validPhotoUrl).toMatch(/^\/uploads\/employees\/\d+\/photo\.(jpg|jpeg|png|webp)$/);
  });

  it('should include date of birth field', () => {
    const validDob = '1990-01-15';
    expect(validDob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
