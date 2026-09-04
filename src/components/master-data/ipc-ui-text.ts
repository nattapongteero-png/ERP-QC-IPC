import { useLocale } from 'next-intl';
import EN from '@/locales/en/ipcCriteriaText.json';

/**
 * The English twin of a Thai label on the QC & IPC criteria screens.
 *
 * Keyed by the Thai text itself rather than by an invented slug. There are
 * ~600 of these across 37 components, and with slugs every one is a chance for
 * the key and the thing it labels to drift apart — a renamed field whose key
 * still says the old name, or worse, a key that quietly resolves to the wrong
 * sentence. Keyed by the text, a lookup either finds its twin or falls back to
 * the Thai that is right there in the source. It cannot show the wrong words.
 *
 * The fallback is why this is safe to roll out in pieces: a string with no
 * translation yet reads exactly as it does today.
 *
 * This is for screen text only. Values that get *stored* — a sampling point
 * named "จุดที่ 1", a payload default — must not pass through here, or an
 * English session would write English into the record.
 */
const TABLE = EN as Record<string, string>;

export function useUiText(): (th: string) => string {
  const english = useLocale() === 'en';
  return (th: string) => (english && TABLE[th]) || th;
}
