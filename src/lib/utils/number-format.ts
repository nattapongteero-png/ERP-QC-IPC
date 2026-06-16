/**
 * Locale-safe number formatting.
 *
 * Why not `Number.toLocaleString()`? On the server (Node in Docker) the default
 * locale is often "C"/POSIX, which omits thousands separators — so SSR renders
 * "1000" while the browser renders "1,000", and Next.js keeps the (comma-less)
 * server value to avoid a hydration mismatch. These helpers insert the comma
 * with a regex instead, so the output is identical on server and client.
 *
 * Decimals are shown AS-IS (no forced trailing zeros): 1000 → "1,000",
 * 1000.5 → "1,000.5", 1000.034 → "1,000.034". Use formatMoney() when you want
 * fixed 2-decimal currency display.
 */

/** Insert thousands separators into an already-stringified integer part. */
function withThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a number with comma thousands separators, keeping whatever decimals
 * the value actually has (capped at `maxDecimals` to avoid float noise).
 * Returns '' for null/undefined and '-' is left to the caller.
 */
export function formatNumber(
  value: number | string | null | undefined,
  maxDecimals = 4,
): string {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  const neg = num < 0;
  // Round to maxDecimals, then drop trailing zeros so 1000.00 → "1,000".
  const rounded = Math.abs(num).toFixed(maxDecimals);
  const trimmed = rounded.includes('.')
    ? rounded.replace(/\.?0+$/, '')
    : rounded;
  const [intPart, decPart] = trimmed.split('.');
  const out = withThousands(intPart) + (decPart ? '.' + decPart : '');
  return (neg ? '-' : '') + out;
}

/**
 * Format as fixed-decimal money (default 2 dp) with comma separators.
 * 1000 → "1,000.00", 1163.0341 → "1,163.03".
 */
export function formatMoney(
  value: number | string | null | undefined,
  decimals = 2,
): string {
  const num = Number(value);
  if (value === null || value === undefined || value === '' || isNaN(num)) {
    return (0).toFixed(decimals);
  }
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const out = withThousands(intPart) + (decPart ? '.' + decPart : '');
  return (neg ? '-' : '') + out;
}
