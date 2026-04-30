'use client';

/**
 * Public COA verify portal — NO AUTH.
 *   /coa/verify/[token]
 *
 * Customers reach this page either by scanning the QR code on the printed
 * certificate (the QR encodes /api/coa/verify/[token] which the customer's
 * phone resolves into JSON OR the human-readable URL on this page) or by
 * typing the COA number on /coa/verify and being redirected here.
 *
 * The page is intentionally minimal — no sidebar, no auth wrapper, no
 * MainLayout. Renders three states:
 *   1. issued      → big green "Verified" check + read-only COA preview
 *   2. superseded  → amber banner pointing to the replacement + the original
 *                    record so receivers can compare
 *   3. not found / draft / revoked → 404 page with contact hint
 *
 * The PDF download button posts to /api/coa/verify/[token]/pdf which is
 * also no-auth and rate-limited.
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Award,
  Leaf,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Download,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface PublicCoaResult {
  sequence: number;
  testName: string;
  testNameTh: string | null;
  specification: string;
  result: string;
  resultUnit: string | null;
  conclusion: string;
}

interface PublicCoaSignature {
  role: string;
  userName: string | null;
  userTitle: string | null;
  signedAt: string;
  signatureMeaning: string | null;
}

interface PublicCoaView {
  coaNumber: string;
  status: 'draft' | 'review' | 'approved' | 'issued' | 'superseded' | 'revoked';
  conclusion: 'complies' | 'does_not_comply' | 'partial';
  productCode: string | null;
  productName: string | null;
  productNameEn: string | null;
  lotNumber: string;
  manufactureDate: string | null;
  expiryDate: string | null;
  issueDate: string;
  customerName: string | null;
  results: PublicCoaResult[];
  signatures: PublicCoaSignature[];
  supersededByCoaNumber: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'analyst':
      return 'Analyst';
    case 'reviewer':
      return 'Reviewer';
    case 'approver':
      return 'Approver';
    case 'qa_release':
      return 'QA Release';
    case 'qc_manager':
      return 'QC Manager';
    case 'qa_manager':
      return 'QA Manager';
    default:
      return role;
  }
}

function PublicHeader() {
  return (
    <header className="border-b border-emerald-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
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
  );
}

function PublicFooter({ verifiedAt }: { verifiedAt?: Date }) {
  return (
    <footer className="border-t border-emerald-100 bg-white/80 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 text-center space-y-1">
        {verifiedAt && (
          <p className="text-xs text-emerald-700 font-medium">
            Verified at {formatDateTime(verifiedAt.toISOString())}
          </p>
        )}
        <p className="text-xs text-gray-500">
          This certificate is authentic if the QR matches and the page resolves
          correctly.
        </p>
      </div>
    </footer>
  );
}

export default function PublicVerifyTokenPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [coa, setCoa] = useState<PublicCoaView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const verifiedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        setErrorMsg('Missing verification token.');
        return;
      }
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/coa/verify/${encodeURIComponent(token)}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) {
          setCoa(null);
          setErrorMsg(data.error || 'Certificate not found.');
        } else {
          setCoa(data.data as PublicCoaView);
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not verify the certificate. Please try again.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm">Verifying certificate…</p>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (errorMsg || !coa) {
    return <NotFoundView message={errorMsg} />;
  }

  if (coa.status === 'superseded') {
    return <SupersededView coa={coa} verifiedAt={verifiedAt} />;
  }

  if (coa.status !== 'issued') {
    return (
      <NotFoundView message="This certificate is no longer valid for verification." />
    );
  }

  return <IssuedView coa={coa} verifiedAt={verifiedAt} token={token} />;
}

// ---------------------------------------------------------------------------
// 404 / revoked / not-found
// ---------------------------------------------------------------------------
function NotFoundView({ message }: { message?: string | null }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex flex-col">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl text-center bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 md:p-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 mb-4 shadow-lg shadow-rose-500/30">
            <XCircle className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Certificate not found
          </h2>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            {message ||
              'We could not locate a valid Certificate of Analysis matching that QR code or number. The certificate may have been revoked or never issued.'}
          </p>
          <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">
            If you believe this is an error, please contact the issuing
            laboratory and provide the QR code or COA number printed on your
            document.
          </div>
          <a
            href="/coa/verify"
            className="inline-flex items-center gap-1.5 mt-6 text-emerald-700 hover:text-emerald-800 text-sm font-medium"
          >
            Try again with a COA number
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Superseded — show banner + read-only original
// ---------------------------------------------------------------------------
function SupersededView({
  coa,
  verifiedAt,
}: {
  coa: PublicCoaView;
  verifiedAt: Date;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 md:p-6 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-amber-100 flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold text-amber-900">
              This certificate has been superseded
            </h2>
            <p className="text-sm text-amber-800 mt-1">
              COA <span className="font-mono">{coa.coaNumber}</span> has been
              replaced by{' '}
              <span className="font-mono font-bold">
                {coa.supersededByCoaNumber || '(unknown)'}
              </span>
              . Please request the latest version from the issuing laboratory.
              The original record below is shown for reference only.
            </p>
          </div>
        </div>

        <CoaCard coa={coa} readonlyBadge="Superseded" />
      </main>
      <PublicFooter verifiedAt={verifiedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issued — main success state
// ---------------------------------------------------------------------------
function IssuedView({
  coa,
  verifiedAt,
  token,
}: {
  coa: PublicCoaView;
  verifiedAt: Date;
  token: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-10 space-y-6">
        {/* Verified banner */}
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 md:p-6 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg md:text-2xl font-bold text-emerald-900">
              Verified — This Certificate of Analysis is authentic
            </h2>
            <p className="text-sm md:text-base text-emerald-800 mt-1">
              Issued {formatDate(coa.issueDate)} for{' '}
              <span className="font-semibold">
                {coa.productName ||
                  coa.productNameEn ||
                  coa.productCode ||
                  'product'}
              </span>{' '}
              · Lot{' '}
              <span className="font-mono font-semibold">{coa.lotNumber}</span>
            </p>
          </div>
          <a
            href={`/api/coa/verify/${encodeURIComponent(token)}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition self-center"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </div>
        {/* Mobile download button */}
        <a
          href={`/api/coa/verify/${encodeURIComponent(token)}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="sm:hidden inline-flex w-full items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition"
        >
          <Download className="h-4 w-4" />
          Download official PDF
        </a>

        <CoaCard coa={coa} />
      </main>
      <PublicFooter verifiedAt={verifiedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// COA read-only card — used by both issued + superseded views
// ---------------------------------------------------------------------------
function CoaCard({
  coa,
  readonlyBadge,
}: {
  coa: PublicCoaView;
  readonlyBadge?: string;
}) {
  const conclusionPill =
    coa.conclusion === 'complies'
      ? {
          label: 'Complies with specifications',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <ShieldCheck className="h-4 w-4" />,
        }
      : coa.conclusion === 'does_not_comply'
        ? {
            label: 'Does not comply',
            className: 'bg-rose-50 text-rose-700 border-rose-200',
            icon: <XCircle className="h-4 w-4" />,
          }
        : {
            label: 'Partial / pending',
            className: 'bg-amber-50 text-amber-700 border-amber-200',
            icon: <AlertTriangle className="h-4 w-4" />,
          };

  return (
    <article className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
      {/* Header */}
      <header className="px-5 md:px-8 py-5 md:py-6 border-b border-gray-100 bg-gradient-to-br from-emerald-50/50 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <Award className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Certificate of Analysis
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 font-mono">
                {coa.coaNumber}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {readonlyBadge && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                {readonlyBadge}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${conclusionPill.className}`}
            >
              {conclusionPill.icon}
              {conclusionPill.label}
            </span>
          </div>
        </div>
      </header>

      {/* Product / lot grid */}
      <section className="px-5 md:px-8 py-5 md:py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-gray-100">
        <Field
          label="Product"
          value={coa.productName || coa.productNameEn || '—'}
        />
        <Field label="Product code" value={coa.productCode || '—'} mono />
        <Field label="Lot / Batch" value={coa.lotNumber || '—'} mono />
        <Field label="Customer" value={coa.customerName || '—'} />
        <Field
          label="Manufacture date"
          value={formatDate(coa.manufactureDate)}
        />
        <Field label="Expiry date" value={formatDate(coa.expiryDate)} />
        <Field label="Issue date" value={formatDate(coa.issueDate)} />
        <Field
          label="Status"
          value={coa.status.charAt(0).toUpperCase() + coa.status.slice(1)}
        />
      </section>

      {/* Test results */}
      <section className="px-5 md:px-8 py-5 md:py-6 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Test Results ({coa.results.length})
        </h4>
        {coa.results.length === 0 ? (
          <p className="text-sm text-gray-500">No test results recorded.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 md:-mx-8 px-5 md:px-8">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Specification
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {coa.results.map((r) => (
                  <tr key={r.sequence}>
                    <td className="px-3 py-2 text-gray-500">{r.sequence}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.testName}
                      {r.testNameTh && r.testNameTh !== r.testName && (
                        <span className="block text-xs text-gray-500 font-normal">
                          {r.testNameTh}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {r.specification}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {r.result}
                      {r.resultUnit ? ` ${r.resultUnit}` : ''}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.conclusion === 'conform' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Pass
                        </span>
                      ) : r.conclusion === 'non_conform' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          ✗ Fail
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                          N/A
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Signatures */}
      <section className="px-5 md:px-8 py-5 md:py-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Authorized Signatories
        </h4>
        {coa.signatures.length === 0 ? (
          <p className="text-sm text-gray-500">No signatures on record.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {coa.signatures.map((s, idx) => (
              <div
                key={idx}
                className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50"
              >
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wider">
                  {roleLabel(s.role)}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {s.userName || '—'}
                </p>
                {s.userTitle && (
                  <p className="text-xs text-gray-500">{s.userTitle}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(s.signedAt)}
                  {s.signatureMeaning ? ` · ${s.signatureMeaning}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-sm font-medium text-gray-900 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
