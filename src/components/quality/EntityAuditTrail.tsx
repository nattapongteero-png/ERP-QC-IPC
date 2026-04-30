'use client';

/**
 * EntityAuditTrail — read-only audit-trail panel embeddable on entity detail
 * pages (QC sample detail, COA detail, etc.).
 *
 * Pulls from /api/quality/audit-trail/entity/{type}/{id} which aggregates
 * audit_trail + signatures + prints + verify-log + OOS rows for that entity.
 * Authenticated users with view access to the parent entity see this.
 *
 * Intentionally compact and accordion-style so it can sit at the bottom of
 * an existing detail page without overwhelming the primary workflow.
 */

import { useEffect, useState, useCallback } from 'react';
import { ScrollText, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuditRow {
  rowKey: string;
  source: string;
  timestamp: string;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: number | null;
  entityRef: string | null;
  details: string;
  detailsJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface Props {
  entityType: 'qc_sample' | 'coa_document' | 'material_return' | 'wo_sop_execution';
  entityId: number;
  /** Default-collapsed unless this is the only audit view on the page. */
  defaultOpen?: boolean;
  /** Title override (Thai/English bilingual). */
  title?: string;
  /** Max rows to fetch (server caps at 500). */
  limit?: number;
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function actionBadge(action: string): { variant: BadgeVariant; label: string } {
  switch (action) {
    case 'create':
      return { variant: 'info', label: 'Create' };
    case 'update':
      return { variant: 'default', label: 'Update' };
    case 'delete':
      return { variant: 'danger', label: 'Delete' };
    case 'sign':
      return { variant: 'info', label: 'Sign' };
    case 'approve':
      return { variant: 'success', label: 'Approve' };
    case 'release':
      return { variant: 'success', label: 'Release' };
    case 'verify':
      return { variant: 'info', label: 'Verify' };
    case 'print':
      return { variant: 'default', label: 'Print' };
    case 'investigate':
      return { variant: 'warning', label: 'Investigate' };
    default:
      return { variant: 'default', label: action };
  }
}

export function EntityAuditTrail({
  entityType,
  entityId,
  defaultOpen = false,
  title,
  limit = 200,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!entityId || !Number.isFinite(entityId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quality/audit-trail/entity/${entityType}/${entityId}?limit=${limit}`,
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load audit trail');
        return;
      }
      setRows(data.data?.items || []);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, limit]);

  useEffect(() => {
    if (open && !loaded && !loading) {
      fetchAudit();
    }
  }, [open, loaded, loading, fetchAudit]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-700">
            {title || 'Audit Trail / เส้นทางตรวจสอบ'}
          </h2>
          {loaded && (
            <span className="text-xs text-gray-500">
              ({rows.length} events)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                fetchAudit();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  fetchAudit();
                }
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 inline-flex items-center"
              title="Refresh"
              aria-label="Refresh audit trail"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </span>
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {loading && !loaded ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Loading audit trail…
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-rose-700">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No tracked events for this record yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((r) => {
                    const ab = actionBadge(r.action);
                    const isOpen = expandedRow === r.rowKey;
                    return (
                      <EntityAuditRow
                        key={r.rowKey}
                        row={r}
                        ab={ab}
                        isOpen={isOpen}
                        onToggle={() =>
                          setExpandedRow(isOpen ? null : r.rowKey)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntityAuditRow({
  row: r,
  ab,
  isOpen,
  onToggle,
}: {
  row: AuditRow;
  ab: { variant: BadgeVariant; label: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-emerald-50/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-gray-400">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap font-mono text-gray-700">
          {formatTimestamp(r.timestamp)}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {r.userName || '—'}
            </span>
            {r.userRole && (
              <span className="text-xs text-gray-500">{r.userRole}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <Badge variant={ab.variant}>{ab.label}</Badge>
          {r.actionLabel && r.actionLabel !== r.action && (
            <span className="ml-1 text-xs font-mono text-gray-500">
              {r.actionLabel}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-gray-700 max-w-md truncate">
          {r.details || '—'}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">
          {r.ipAddress ?? '—'}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-50/50">
          <td colSpan={6} className="px-6 py-3">
            <div className="text-xs text-gray-700 mb-2">
              <span className="font-mono text-gray-500">
                source = {r.source}
                {r.userAgent
                  ? ` · ua = ${String(r.userAgent).slice(0, 100)}`
                  : ''}
              </span>
            </div>
            {r.detailsJson && (
              <pre className="text-xs font-mono bg-white border border-gray-200 rounded-md p-3 overflow-x-auto max-h-60">
                {JSON.stringify(r.detailsJson, null, 2)}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default EntityAuditTrail;
