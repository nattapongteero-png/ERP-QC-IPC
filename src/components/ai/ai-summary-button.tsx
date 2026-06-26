'use client';

/**
 * AiSummaryButton — reusable "summarize with AI" button + result panel.
 *
 * Drop into any detail page. Give it the GET endpoint that returns
 * { summary: string | null, aiUnavailable: boolean }; it fetches on click and
 * renders the summary inline. Degrades gracefully when AI is unavailable.
 *
 *   <AiSummaryButton endpoint={`/api/gmp/capa/${id}/summary`} />
 */
import { useState } from 'react';
import { Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

interface AiSummaryResponse {
  summary: string | null;
  aiUnavailable: boolean;
}

interface AiSummaryButtonProps {
  /** GET endpoint returning { summary, aiUnavailable } (optionally wrapped in {data}). */
  endpoint: string;
  label?: string;
  className?: string;
}

export function AiSummaryButton({ endpoint, label = 'สรุปด้วย AI', className }: AiSummaryButtonProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setSummary(null);
    setUnavailable(false);
    try {
      const res = await fetch(endpoint);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `เกิดข้อผิดพลาด (${res.status})`);
        return;
      }
      const data = (body?.data ?? body) as AiSummaryResponse;
      if (data.aiUnavailable || !data.summary) {
        setUnavailable(true);
      } else {
        setSummary(data.summary);
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อบริการ AI ได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className} data-testid="ai-summary">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        data-testid="ai-summary-button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid #c7d2fe',
          background: '#fff',
          color: '#4338ca',
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
        {loading ? 'กำลังสรุป…' : label}
      </button>

      {summary && (
        <div
          data-testid="ai-summary-result"
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 10,
            border: '1px solid #c7d2fe',
            background: '#eef2ff',
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4338ca', fontWeight: 600, marginBottom: 6 }}>
            <Sparkles size={15} /> สรุปโดย AI
          </div>
          <div>{summary}</div>
        </div>
      )}

      {unavailable && (
        <div
          data-testid="ai-summary-unavailable"
          style={{ marginTop: 10, padding: 12, borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: 13 }}
        >
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          ระบบ AI ไม่พร้อมใช้งานขณะนี้ — กรุณาลองใหม่ภายหลัง
        </div>
      )}

      {error && (
        <div
          data-testid="ai-summary-error"
          role="alert"
          style={{ marginTop: 10, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}
        >
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {error}
        </div>
      )}
    </div>
  );
}
