'use client';

/**
 * COA Detail Page (Phase 4 + 6)
 *
 * Shows the full COA — header info, embedded preview iframe (HTML render
 * served by /api/quality/coa/[id]/pdf?type=html so it works without
 * Chromium), action buttons (Submit / Approve / Issue / Supersede / Revoke /
 * Download PDF), 2-tier signature panel.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Award, Eye } from 'lucide-react';
import { EntityAuditTrail } from '@/components/quality/EntityAuditTrail';

interface CoaTestResult {
  id: number;
  sequence: number;
  testName: string;
  testNameTh: string | null;
  testMethod: string | null;
  specification: string;
  result: string;
  resultUnit: string | null;
  conclusion: string;
}

interface CoaSignature {
  id: number;
  role: string;
  userId: number;
  userNameSnapshot: string | null;
  userTitleSnapshot: string | null;
  signedAt: string;
  signatureMeaning: string | null;
}

interface CoaDetail {
  id: number;
  coaNumber: string;
  sampleId: number;
  sampleNumber: string | null;
  productCode: string | null;
  productName: string | null;
  productNameEn: string | null;
  lotNumber: string;
  customerName: string | null;
  salesOrderRef: string | null;
  issueDate: string;
  expiryDate: string | null;
  retestDate: string | null;
  manufactureDate: string | null;
  conclusion: string;
  status: string;
  supersededBy: number | null;
  revokeReason: string | null;
  qrCodeToken: string;
  createdByName: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  printCount: number;
  results: CoaTestResult[];
  signatures: CoaSignature[];
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

function statusBadge(status: string): {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
} {
  switch (status) {
    case 'draft':
      return { variant: 'default', label: 'Draft' };
    case 'review':
      return { variant: 'warning', label: 'Review' };
    case 'approved':
      return { variant: 'info', label: 'Approved' };
    case 'issued':
      return { variant: 'success', label: 'Issued' };
    case 'superseded':
      return { variant: 'warning', label: 'Superseded' };
    case 'revoked':
      return { variant: 'danger', label: 'Revoked' };
    default:
      return { variant: 'default', label: status };
  }
}

export default function CoaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const coaId = Number(params.id);

  const [coa, setCoa] = useState<CoaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [supersedeOpen, setSupersedeOpen] = useState(false);
  const [supersedeId, setSupersedeId] = useState<number | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!coaId || !Number.isFinite(coaId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quality/coa/${coaId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load COA');
        return;
      }
      setCoa(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load COA');
    } finally {
      setLoading(false);
    }
  }, [coaId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleAction = useCallback(
    async (
      action:
        | 'submit_for_review'
        | 'approve'
        | 'issue'
        | 'supersede'
        | 'revoke',
      payload: Record<string, unknown> = {},
    ) => {
      if (!coa) return;
      setWorking(true);
      try {
        const res = await fetch(`/api/quality/coa/${coa.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || 'การดำเนินการล้มเหลว');
          return;
        }
        toast.success(data.message || 'สำเร็จ');
        await fetchDetail();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'การดำเนินการล้มเหลว');
      } finally {
        setWorking(false);
      }
    },
    [coa, toast, fetchDetail],
  );

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[40vh]">
          <DxLoadIndicator visible />
        </div>
      </>
    );
  }

  if (error || !coa) {
    return (
      <>
        <div className="p-6">
          <ResponsivePageHeader
            title="COA Not Found"
            subtitle={error || 'ไม่พบ COA ที่ต้องการ'}
            icon={Award}
            iconBgColor="bg-red-100"
            iconColor="text-red-600"
          />
          <div className="mt-4">
            <DxButton
              text="กลับ"
              icon="back"
              onClick={() => router.push('/quality/coa')}
            />
          </div>
        </div>
      </>
    );
  }

  const sb = statusBadge(coa.status);
  const canSubmit = coa.status === 'draft';
  const canApprove = coa.status === 'review';
  const canIssue = coa.status === 'approved';
  const canSupersede = coa.status === 'issued';
  const canRevoke = coa.status !== 'revoked' && coa.status !== 'superseded';
  const canDownloadOfficial = coa.status === 'issued';

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title={`COA ${coa.coaNumber}`}
          subtitle={
            coa.productCode
              ? `${coa.productCode} — ${coa.productName ?? ''}`
              : 'Certificate of Analysis'
          }
          icon={Award}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'COA', href: '/quality/coa' },
            { label: coa.coaNumber },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={sb.variant}>{sb.label}</Badge>
              <DxButton
                icon="back"
                text="กลับ"
                stylingMode="outlined"
                onClick={() => router.push('/quality/coa')}
              />
            </div>
          }
        />

        {/* Header info card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="COA Number" value={coa.coaNumber} mono />
            <Field label="Issue Date" value={formatDateTh(coa.issueDate)} />
            <Field label="Sample" value={coa.sampleNumber || `#${coa.sampleId}`} mono />
            <Field
              label="Conclusion"
              value={
                coa.conclusion === 'complies'
                  ? '✓ Complies'
                  : coa.conclusion === 'does_not_comply'
                    ? '✗ Does not comply'
                    : 'Partial'
              }
              color={
                coa.conclusion === 'complies'
                  ? 'text-emerald-600'
                  : coa.conclusion === 'does_not_comply'
                    ? 'text-red-600'
                    : 'text-amber-600'
              }
            />
            <Field label="Lot #" value={coa.lotNumber || '—'} mono />
            <Field label="Manufacture Date" value={formatDateTh(coa.manufactureDate)} />
            <Field label="Expiry Date" value={formatDateTh(coa.expiryDate)} />
            <Field label="Retest Date" value={formatDateTh(coa.retestDate)} />
            <Field label="Customer" value={coa.customerName || '—'} />
            <Field label="Sales Order" value={coa.salesOrderRef || '—'} />
            <Field label="Created by" value={coa.createdByName || '—'} />
            <Field
              label="Print count"
              value={String(coa.printCount)}
            />
          </div>

          {coa.revokeReason ? (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              <strong>Revocation reason:</strong> {coa.revokeReason}
            </div>
          ) : null}
        </div>

        {/* Action bar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {canSubmit && (
              <DxButton
                text="ส่งทบทวน (Submit for review)"
                icon="upload"
                type="default"
                onClick={() => handleAction('submit_for_review')}
                disabled={working}
              />
            )}
            {canApprove && (
              <DxButton
                text="อนุมัติ (Approve)"
                icon="check"
                type="success"
                onClick={() =>
                  handleAction('approve', { signatureMeaning: 'Approved' })
                }
                disabled={working}
              />
            )}
            {canIssue && (
              <DxButton
                text="ออก COA (Issue)"
                icon="export"
                type="success"
                onClick={() =>
                  handleAction('issue', { signatureMeaning: 'Released' })
                }
                disabled={working}
              />
            )}
            {canSupersede && (
              <DxButton
                text="แทนที่ด้วย COA ใหม่ (Supersede)"
                icon="refresh"
                stylingMode="outlined"
                onClick={() => setSupersedeOpen(true)}
                disabled={working}
              />
            )}
            {canRevoke && (
              <DxButton
                text="เพิกถอน (Revoke)"
                icon="close"
                type="danger"
                stylingMode="outlined"
                onClick={() => setRevokeOpen(true)}
                disabled={working}
              />
            )}

            <div className="flex-1" />

            <a
              href={`/api/quality/coa/${coa.id}/pdf?type=preview`}
              target="_blank"
              rel="noreferrer"
            >
              <DxButton
                text="ดู preview (PDF)"
                icon="doc"
                stylingMode="outlined"
              />
            </a>
            {canDownloadOfficial && (
              <a
                href={`/api/quality/coa/${coa.id}/pdf?type=official`}
                target="_blank"
                rel="noreferrer"
                download
              >
                <DxButton
                  text="ดาวน์โหลด PDF ทางการ"
                  icon="download"
                  type="default"
                />
              </a>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            ลายเซ็น (Signatures)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SignatureCard
              role="approver"
              roleLabel="ผู้อนุมัติ (Approver)"
              sigs={coa.signatures}
            />
            <SignatureCard
              role="qa_release"
              roleLabel="ผู้ปล่อย QA (QA Release)"
              sigs={coa.signatures}
            />
          </div>
        </div>

        {/* Embedded preview */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </h2>
            <a
              href={`/api/quality/coa/${coa.id}/pdf?type=html`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-600 hover:underline"
            >
              เปิดในแท็บใหม่
            </a>
          </div>
          <iframe
            title={`COA preview ${coa.coaNumber}`}
            src={`/api/quality/coa/${coa.id}/pdf?type=html`}
            className="w-full"
            style={{ minHeight: '900px', border: 'none' }}
          />
        </div>

        {/* Test results table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">
              ผลการทดสอบ (Snapshot — {coa.results.length} tests)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Test</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Spec</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Result</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {coa.results.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-sm">{r.sequence}</td>
                    <td className="px-3 py-2 text-sm font-medium">
                      {r.testName}
                      {r.testNameTh && r.testNameTh !== r.testName ? (
                        <span className="ml-1 text-xs text-gray-500">
                          / {r.testNameTh}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-sm">{r.testMethod || '—'}</td>
                    <td className="px-3 py-2 text-sm">{r.specification}</td>
                    <td className="px-3 py-2 text-sm">
                      {r.result}
                      {r.resultUnit ? ` ${r.resultUnit}` : ''}
                    </td>
                    <td className="px-3 py-2 text-center text-sm">
                      {r.conclusion === 'conform' ? (
                        <Badge variant="success">✓ Pass</Badge>
                      ) : r.conclusion === 'non_conform' ? (
                        <Badge variant="danger">✗ Fail</Badge>
                      ) : (
                        <Badge variant="default">N/A</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit trail (per-entity) */}
        <EntityAuditTrail entityType="coa_document" entityId={coa.id} />
      </div>

      {/* Revoke dialog */}
      <DxPopup
        visible={revokeOpen}
        onHidden={() => {
          setRevokeOpen(false);
          setRevokeReason('');
        }}
        title="เพิกถอน COA"
        width={520}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            กรุณาระบุเหตุผลที่เพิกถอน COA ฉบับนี้ — เหตุผลจะถูกบันทึกในประวัติ.
          </p>
          <DxTextArea
            value={revokeReason}
            onValueChange={setRevokeReason}
            placeholder="เช่น: พบข้อผิดพลาดในผลทดสอบ Test #5"
            height={120}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => setRevokeOpen(false)}
            />
            <DxButton
              text="ยืนยันการเพิกถอน"
              type="danger"
              onClick={async () => {
                if (!revokeReason.trim()) {
                  toast.error('ต้องระบุเหตุผล');
                  return;
                }
                await handleAction('revoke', { reason: revokeReason });
                setRevokeOpen(false);
                setRevokeReason('');
              }}
              disabled={working || !revokeReason.trim()}
            />
          </div>
        </div>
      </DxPopup>

      {/* Supersede dialog */}
      <DxPopup
        visible={supersedeOpen}
        onHidden={() => {
          setSupersedeOpen(false);
          setSupersedeId(null);
        }}
        title="แทนที่ COA ด้วยฉบับใหม่"
        width={520}
        height="auto"
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            ระบุ ID ของ COA ที่จะมาแทนที่ฉบับนี้ — สถานะจะเปลี่ยนเป็น &quot;superseded&quot;.
          </p>
          <DxNumberBox
            value={supersedeId}
            onValueChange={(v) => setSupersedeId(v)}
            placeholder="COA ID (ตัวเลข)"
            min={1}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <DxButton
              text="ยกเลิก"
              stylingMode="outlined"
              onClick={() => setSupersedeOpen(false)}
            />
            <DxButton
              text="ยืนยัน"
              type="default"
              onClick={async () => {
                if (!supersedeId) {
                  toast.error('ต้องระบุ COA ID');
                  return;
                }
                await handleAction('supersede', { supersededBy: supersedeId });
                setSupersedeOpen(false);
                setSupersedeId(null);
              }}
              disabled={working || !supersedeId}
            />
          </div>
        </div>
      </DxPopup>
    </>
  );
}

function Field({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-0.5 ${mono ? 'font-mono' : ''} ${
          color || 'text-gray-900'
        } font-medium`}
      >
        {value}
      </p>
    </div>
  );
}

function SignatureCard({
  role,
  roleLabel,
  sigs,
}: {
  role: string;
  roleLabel: string;
  sigs: CoaSignature[];
}) {
  const sig = sigs.find((s) => s.role === role);
  if (!sig) {
    return (
      <div className="border border-dashed border-gray-300 rounded p-3 bg-gray-50">
        <p className="text-xs text-gray-500 mb-1">{roleLabel}</p>
        <p className="text-sm text-gray-400">ยังไม่ลงนาม</p>
      </div>
    );
  }
  return (
    <div className="border border-emerald-200 rounded p-3 bg-emerald-50">
      <p className="text-xs text-emerald-700 mb-1">{roleLabel}</p>
      <p className="text-sm font-semibold text-gray-900">
        {sig.userNameSnapshot || `User #${sig.userId}`}
      </p>
      {sig.userTitleSnapshot ? (
        <p className="text-xs text-gray-500">{sig.userTitleSnapshot}</p>
      ) : null}
      <p className="text-xs text-gray-500 mt-1">
        {formatDateTh(sig.signedAt)} · {sig.signatureMeaning || '—'}
      </p>
    </div>
  );
}
