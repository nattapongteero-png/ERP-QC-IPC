'use client';

/**
 * Public COA verify landing page — NO AUTH.
 *
 * Customers land here when they navigate to /coa/verify without a token in
 * the URL (e.g. they typed the URL from a printed business card or a tradeshow
 * banner). They can enter the COA number from the printed certificate and
 * we'll route them to the token-based verify page.
 *
 * The token-based page (/coa/verify/[token]) is the canonical URL embedded in
 * the QR code; this page is the manual fallback.
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Search, Leaf, ShieldCheck } from 'lucide-react';

export default function PublicVerifyLandingPage() {
  const router = useRouter();
  const [coaNumber, setCoaNumber] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = coaNumber.trim();
    if (!trimmed) {
      setError('Please enter a COA number.');
      return;
    }
    setResolving(true);
    try {
      // Resolve via API: /api/coa/verify/by-number/[number] returns the token
      // so we can navigate to the canonical URL.
      const res = await fetch(
        `/api/coa/verify/by-number/${encodeURIComponent(trimmed)}`,
      );
      const data = await res.json();
      if (!data.success || !data.data?.token) {
        setError(
          data.error ||
            'Certificate not found. Please check the number and try again.',
        );
        setResolving(false);
        return;
      }
      router.push(`/coa/verify/${encodeURIComponent(data.data.token)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not verify the certificate. Please try again.',
      );
      setResolving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
      {/* Minimal branded header */}
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Herbal Medicine ERP
            </h1>
            <p className="text-xs text-gray-500">
              Public Certificate Verification
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/30">
              <Award className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Verify a Certificate of Analysis
            </h2>
            <p className="text-gray-500 mt-2 text-sm md:text-base">
              Enter the COA number from your printed certificate, or scan the
              QR code on the document to verify it instantly.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8 space-y-4"
          >
            <label
              htmlFor="coaNumber"
              className="block text-sm font-medium text-gray-700"
            >
              COA Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="coaNumber"
                type="text"
                value={coaNumber}
                onChange={(e) => setCoaNumber(e.target.value)}
                placeholder="e.g. COA-2026-000123"
                autoComplete="off"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-mono text-sm md:text-base"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <div className="w-2 h-2 mt-1.5 bg-red-500 rounded-full flex-shrink-0"></div>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={resolving}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {resolving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  Verify Certificate
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center pt-2">
              For best results, scan the QR code printed on your certificate —
              that route includes a tamper-resistant token.
            </p>
          </form>
        </div>
      </main>

      <footer className="border-t border-emerald-100 bg-white/80">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
          This certificate is authentic if the QR matches and the page resolves
          correctly.
        </div>
      </footer>
    </div>
  );
}
