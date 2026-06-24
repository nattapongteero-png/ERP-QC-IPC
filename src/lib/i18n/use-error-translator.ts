'use client';

/**
 * useErrorTranslator — translate server/API error messages to the active locale
 * for display in toasts and dialogs.
 *
 * WHY: API/service code returns English error strings (e.g. "Invalid password.
 * Please re-enter your password to sign.", "Work order not found"). We must NOT
 * change those API responses (they're part of the contract and used elsewhere),
 * so translation happens purely on the client at display time.
 *
 * HOW: a returned `translate(message)` function matches the raw English message
 * against (1) exact known phrases, then (2) common patterns ("X not found",
 * "X is required", "ALREADY_PROCESSED…"). On no match it returns the original
 * string unchanged — so nothing ever breaks, untranslated errors just stay in
 * English instead of disappearing.
 *
 * Usage:
 *   const translateError = useErrorTranslator();
 *   toast.error(translateError(err.message));
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

export function useErrorTranslator() {
  const t = useTranslations('common.apiErrors');

  return useCallback(
    (message?: string | null): string => {
      if (!message) return t('validationFailed');
      const raw = String(message).trim();
      const lower = raw.toLowerCase();

      // ── 1. Exact / contains matches for the high-traffic messages ──
      if (lower.includes('invalid password')) return t('invalidPassword');
      if (lower.includes('already been processed') || lower.includes('already_processed'))
        return t('alreadyProcessed');
      if (lower.includes('not_pending') || lower.includes('not pending'))
        return t('notPending');
      if (
        lower.includes('verifier') &&
        (lower.includes('different') || lower.includes('same') || lower.includes('cannot be the'))
      )
        return t('verifierSameAsPerformer');
      if (lower.includes('temperature or humidity')) return t('tempHumidityRequired');
      if (lower.includes('thai cid already') || lower.includes('already registered'))
        return t('thaiCidExists');
      if (lower.includes('thai cid') || lower.includes('checksum')) return t('invalidThaiCid');
      if (lower.includes('insufficient') && lower.includes('stock'))
        return t('insufficientStock');
      if (
        lower.includes('permission') ||
        lower.includes('unauthorized') ||
        lower.includes('not allowed') ||
        lower.includes('access denied') ||
        lower.includes('forbidden')
      )
        return t('permissionDenied');
      if (lower.includes('sign') && lower.includes('fail')) return t('signFailed');

      // ── 2. Pattern families ──
      if (/\bnot found\b/.test(lower)) return t('notFound');
      if (/\b(is|are)\s+required\b/.test(lower) || lower.includes('required'))
        return t('required');
      if (/\balready\s+(exists|registered)\b/.test(lower)) return t('alreadyExists');
      if (lower.includes('validation failed')) return t('validationFailed');

      // ── 3. No known mapping → show the original message untouched ──
      return raw;
    },
    [t],
  );
}
