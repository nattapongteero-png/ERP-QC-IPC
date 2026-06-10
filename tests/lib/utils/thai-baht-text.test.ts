import { describe, it, expect } from 'vitest';
import { thaiBahtText } from '@/lib/utils/thai-baht-text';

describe('thaiBahtText', () => {
  it('reads zero', () => {
    expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
  });

  it('reads single digits', () => {
    expect(thaiBahtText(1)).toBe('หนึ่งบาทถ้วน');
    expect(thaiBahtText(5)).toBe('ห้าบาทถ้วน');
  });

  it('applies the สิบ / เอ็ด / ยี่ rules in the tens place', () => {
    expect(thaiBahtText(10)).toBe('สิบบาทถ้วน');
    expect(thaiBahtText(11)).toBe('สิบเอ็ดบาทถ้วน');
    expect(thaiBahtText(20)).toBe('ยี่สิบบาทถ้วน');
    expect(thaiBahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน');
  });

  it('reads hundreds with เอ็ด on trailing 1', () => {
    expect(thaiBahtText(100)).toBe('หนึ่งร้อยบาทถ้วน');
    expect(thaiBahtText(101)).toBe('หนึ่งร้อยเอ็ดบาทถ้วน');
  });

  it('reads the PO example total', () => {
    expect(thaiBahtText(535000)).toBe('ห้าแสนสามหมื่นห้าพันบาทถ้วน');
  });

  it('reads millions', () => {
    expect(thaiBahtText(1000000)).toBe('หนึ่งล้านบาทถ้วน');
    expect(thaiBahtText(2000001)).toBe('สองล้านเอ็ดบาทถ้วน');
    expect(thaiBahtText(1234567)).toBe(
      'หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทถ้วน',
    );
  });

  it('reads satang (decimals)', () => {
    expect(thaiBahtText(1234.5)).toBe('หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์');
    expect(thaiBahtText(25.25)).toBe('ยี่สิบห้าบาทยี่สิบห้าสตางค์');
    expect(thaiBahtText(0.5)).toBe('ห้าสิบสตางค์');
  });

  it('rounds to 2 decimal places (satang)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754 → must still read 30 สตางค์
    expect(thaiBahtText(0.1 + 0.2)).toBe('สามสิบสตางค์');
    expect(thaiBahtText(1.999)).toBe('สองบาทถ้วน');
  });

  it('prefixes ลบ for negative amounts', () => {
    expect(thaiBahtText(-5)).toBe('ลบห้าบาทถ้วน');
  });
});
