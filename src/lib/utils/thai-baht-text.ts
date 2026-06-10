/**
 * Convert a number to Thai baht text (อ่านจำนวนเงินเป็นข้อความภาษาไทย).
 *
 * Standard for Thai financial documents (ใบสั่งซื้อ, ใบกำกับภาษี, ใบเสร็จ):
 * "หนึ่งพันห้าร้อยบาทถ้วน", "สองบาทห้าสิบสตางค์".
 *
 * Handles:
 *  - units up to ล้าน and beyond (recursively groups every 6 digits)
 *  - the เอ็ด rule (1 in the units place after another digit → "เอ็ด")
 *  - the ยี่ rule (2 in the tens place → "ยี่สิบ")
 *  - the สิบ rule (1 in the tens place → "สิบ", not "หนึ่งสิบ")
 *  - satang (2 decimal places); 0 satang → "ถ้วน"
 *
 * Examples:
 *   thaiBahtText(0)        → "ศูนย์บาทถ้วน"
 *   thaiBahtText(1)        → "หนึ่งบาทถ้วน"
 *   thaiBahtText(21)       → "ยี่สิบเอ็ดบาทถ้วน"
 *   thaiBahtText(535000)   → "ห้าแสนสามหมื่นห้าพันบาทถ้วน"
 *   thaiBahtText(1234.50)  → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
 */

const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** Read an integer string of length 1..6 into Thai words. */
function readGroup(group: string): string {
  let result = '';
  const len = group.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(group[i]);
    const place = len - i - 1; // 0 = units ... 5 = แสน
    if (digit === 0) continue;

    if (place === 0 && digit === 1 && len > 1) {
      // 1 in the units place after at least one higher digit → เอ็ด
      result += 'เอ็ด';
    } else if (place === 1 && digit === 1) {
      // 1 in the tens place → สิบ (not หนึ่งสิบ)
      result += 'สิบ';
    } else if (place === 1 && digit === 2) {
      // 2 in the tens place → ยี่สิบ
      result += 'ยี่สิบ';
    } else {
      result += THAI_DIGITS[digit] + THAI_PLACES[place];
    }
  }
  return result;
}

/** Read a non-negative integer (as string) into Thai words. */
function readInteger(intStr: string): string {
  // strip leading zeros
  intStr = intStr.replace(/^0+/, '');
  if (intStr === '') return THAI_DIGITS[0]; // ศูนย์

  // Split into 6-digit groups from the right; each group separated by "ล้าน".
  const groups: string[] = [];
  for (let end = intStr.length; end > 0; end -= 6) {
    groups.unshift(intStr.slice(Math.max(0, end - 6), end));
  }

  let result = '';
  for (let i = 0; i < groups.length; i++) {
    const groupText = readGroup(groups[i]);
    if (groupText === '') continue;
    result += groupText;
    const remaining = groups.length - i - 1;
    if (remaining > 0) {
      // each remaining group adds one "ล้าน"
      result += 'ล้าน'.repeat(remaining);
    }
  }
  return result || THAI_DIGITS[0];
}

export function thaiBahtText(amount: number): string {
  if (!isFinite(amount)) return '';

  const negative = amount < 0;
  const abs = Math.abs(amount);

  // Round to 2 decimals to avoid floating-point dust (e.g. 1.005 → 1.00)
  const rounded = Math.round(abs * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  let text = '';
  if (baht === 0 && satang === 0) {
    text = 'ศูนย์บาทถ้วน';
  } else {
    if (baht > 0) {
      text += readInteger(String(baht)) + 'บาท';
    }
    if (satang > 0) {
      // satang is 1..99 — same reader, treated as its own integer
      text += readInteger(String(satang)) + 'สตางค์';
    } else {
      text += 'ถ้วน';
    }
  }

  return (negative ? 'ลบ' : '') + text;
}

export default thaiBahtText;
