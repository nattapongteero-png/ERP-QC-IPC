'use client';

/**
 * SOP / GMP Assistant (RAG) — chat page
 *
 * Ask questions in natural language; answers are grounded in the ACTIVE
 * controlled documents and cite the document number + version used. Lives under
 * gmp/documents, whose layout already wraps MainLayout (do not re-wrap).
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TextArea } from 'devextreme-react/text-area';
import { DxButton } from '@/components/ui/dx-button';
import { ResponsivePageHeader } from '@/components/shared';
import { Bot, Send, FileText, Loader2, AlertTriangle, User } from 'lucide-react';
import type { SopAnswer, SopCitation } from '@/lib/services/sop-assistant.service';

interface ChatTurn {
  question: string;
  answer: SopAnswer | null; // null while loading
  error?: string;
}

export default function SopAssistantPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  async function ask() {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setLoading(true);
    setTurns((t) => [...t, { question, answer: null }]);

    try {
      const res = await fetch('/api/documents/sop-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTurns((t) => updateLast(t, { error: body?.error || `เกิดข้อผิดพลาด (${res.status})` }));
        return;
      }
      setTurns((t) => updateLast(t, { answer: (body?.data ?? body) as SopAnswer }));
    } catch {
      setTurns((t) => updateLast(t, { error: 'ไม่สามารถเชื่อมต่อบริการผู้ช่วยได้' }));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 16 }} data-testid="sop-assistant-page">
      <ResponsivePageHeader
        icon={Bot}
        title="ผู้ช่วย SOP / GMP"
        subtitle="ถาม-ตอบจากเอกสารควบคุมที่บังคับใช้ พร้อมอ้างอิงเลขเอกสาร"
      />

      <div
        data-testid="sop-chat-log"
        style={{
          marginTop: 16,
          minHeight: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {turns.length === 0 && (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: 40, fontSize: 14 }}>
            ลองถาม เช่น “ขั้นตอนการ recall ทำอย่างไร” หรือ “เกณฑ์การ release วัตถุดิบคืออะไร”
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i}>
            <Bubble role="user">{turn.question}</Bubble>

            {turn.answer === null && !turn.error && (
              <Bubble role="assistant">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
                  <Loader2 size={16} className="spin" /> กำลังค้นหาในเอกสาร…
                </span>
              </Bubble>
            )}

            {turn.error && (
              <Bubble role="assistant">
                <span style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={15} /> {turn.error}
                </span>
              </Bubble>
            )}

            {turn.answer && <AnswerBlock answer={turn.answer} onCite={(id) => router.push(`/gmp/documents/${id}`)} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <TextArea
            value={input}
            onValueChanged={(e) => setInput(e.value ?? '')}
            onKeyDown={(e) => onKeyDown(e.event as unknown as React.KeyboardEvent)}
            placeholder="พิมพ์คำถามเกี่ยวกับ SOP/GMP…"
            autoResizeEnabled
            minHeight={48}
            maxHeight={140}
            data-testid="sop-input"
          />
        </div>
        <DxButton
          icon="send"
          type="default"
          stylingMode="contained"
          disabled={loading || !input.trim()}
          onClick={ask}
          data-testid="sop-send-button"
          text="ถาม"
        />
      </div>
    </div>
  );
}

function updateLast(turns: ChatTurn[], patch: Partial<ChatTurn>): ChatTurn[] {
  if (turns.length === 0) return turns;
  const copy = [...turns];
  copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
  return copy;
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexDirection: isUser ? 'row-reverse' : 'row',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: isUser ? '#dbeafe' : '#dcfce7',
          color: isUser ? '#1d4ed8' : '#166534',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div
        style={{
          background: isUser ? '#eff6ff' : '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 14,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          maxWidth: '80%',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AnswerBlock({ answer, onCite }: { answer: SopAnswer; onCite: (id: number) => void }) {
  if (answer.aiUnavailable) {
    return (
      <Bubble role="assistant">
        <span style={{ color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} /> ระบบ AI ไม่พร้อมใช้งานขณะนี้ — กรุณาลองใหม่อีกครั้ง
        </span>
      </Bubble>
    );
  }

  return (
    <Bubble role="assistant">
      <div>{answer.answer}</div>
      {answer.citations.length > 0 && (
        <div
          data-testid="sop-citations"
          style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #d1d5db', display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {answer.citations.map((c: SopCitation) => (
            <button
              key={c.documentId}
              onClick={() => onCite(c.documentId)}
              data-testid={`sop-citation-${c.documentId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 999,
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                color: '#3730a3',
                cursor: 'pointer',
              }}
              title={c.title}
            >
              <FileText size={12} /> {c.documentNumber} {c.versionNumber}
            </button>
          ))}
        </div>
      )}
    </Bubble>
  );
}
