'use client';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { ResponsivePageHeader } from '@/components/shared';
import { LogIn, Check, AlertCircle, KeyRound, Link2, Loader2, ShieldCheck, Webhook, Building2 } from 'lucide-react';

interface SettingsView {
  callbackUrl: string;
  prStatusUrl: string;
  poSubmitUrl: string;
  factoryName: string;
  secretConfigured: boolean;
  source: {
    secret: 'db' | 'env' | 'none';
    callback: 'db' | 'env' | 'none';
    prStatus: 'db' | 'env' | 'none';
    poSubmit: 'db' | 'env' | 'derived' | 'none';
    factory: 'db' | 'env' | 'none';
  };
}

const SOURCE_LABEL: Record<string, string> = {
  db: 'ฐานข้อมูล',
  env: 'ENV (fallback)',
  derived: 'อนุมานจาก PR Status URL',
  none: 'ยังไม่ตั้งค่า',
  'db-decrypt-failed': 'ถอดรหัสค่าใน DB ไม่สำเร็จ (คีย์ไม่ตรง — กรุณากรอก Secret ใหม่)',
};

export default function MetaherbSsoSettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [prStatusUrl, setPrStatusUrl] = useState('');
  const [poSubmitUrl, setPoSubmitUrl] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/metaherb-sso');
      const data = await res.json();
      if (data.success) {
        setView(data.data);
        setCallbackUrl(data.data.callbackUrl || '');
        setPrStatusUrl(data.data.prStatusUrl || '');
        setPoSubmitUrl(data.data.poSubmitUrl || '');
        setFactoryName(data.data.factoryName || '');
      } else {
        setMessage({ type: 'error', text: data.error || 'โหลดการตั้งค่าไม่สำเร็จ' });
      }
    } catch {
      setMessage({ type: 'error', text: 'โหลดการตั้งค่าไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: {
        callbackUrl?: string;
        prStatusUrl?: string;
        poSubmitUrl?: string;
        factoryName?: string;
        ssoSecret?: string;
      } = {};
      // Only send a non-empty callback so a stray save can't wipe a stored one.
      if (callbackUrl.trim() !== '') body.callbackUrl = callbackUrl.trim();
      // Same for the PR-status webhook URL.
      if (prStatusUrl.trim() !== '') body.prStatusUrl = prStatusUrl.trim();
      // PO-submit URL: only persist when the admin actually edited it away from
      // the loaded (possibly derived) value, so a plain save doesn't pin the
      // auto-derived URL and break the derive-from-pr-status fallback.
      if (poSubmitUrl.trim() !== '' && poSubmitUrl.trim() !== (view?.poSubmitUrl || '')) {
        body.poSubmitUrl = poSubmitUrl.trim();
      }
      // Factory name: send when non-empty.
      if (factoryName.trim() !== '') body.factoryName = factoryName.trim();
      // Only send the secret if the admin actually typed a new one — leaving it
      // blank keeps the stored secret unchanged.
      if (secret.trim() !== '') body.ssoSecret = secret.trim();

      const res = await fetch('/api/settings/metaherb-sso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'บันทึกการตั้งค่าแล้ว' });
        setSecret('');
        await load();
      } else {
        setMessage({ type: 'error', text: data.error || 'บันทึกไม่สำเร็จ' });
      }
    } catch {
      setMessage({ type: 'error', text: 'บันทึกไม่สำเร็จ' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6" data-testid="metaherb-sso-settings">
        <ResponsivePageHeader
          title="ตั้งค่า Metaherb SSO"
          subtitle="กำหนด Secret และ Callback URL สำหรับปุ่ม “เข้าสู่ Metaherb” (เก็บในฐานข้อมูล แก้ได้โดยไม่ต้อง redeploy)"
          icon={LogIn}
        />

        {message && (
          <div
            data-testid="metaherb-sso-message"
            className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ค่าจาก Metaherb (ออกให้ตอน onboarding)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                กำลังโหลด...
              </div>
            ) : (
              <>
                {/* Callback URL */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Link2 className="h-4 w-4 text-gray-400" />
                    Callback URL
                  </label>
                  <DxTextBox
                    value={callbackUrl}
                    onValueChanged={(e) => setCallbackUrl(e.value ?? '')}
                    placeholder="https://api.pomdevth.site/api/sso/erp/callback/<company>"
                    inputAttr={{ 'data-testid': 'metaherb-callback-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    URL มีรหัสบริษัทอยู่ในตัวแล้ว (เช่น …/callback/arjaro) — paste ทั้ง URL
                    {view && (
                      <span className="ml-1">
                        · ที่มา: <b>{SOURCE_LABEL[view.source.callback]}</b>
                      </span>
                    )}
                  </p>
                </div>

                {/* PR Status Webhook URL (outbound) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Webhook className="h-4 w-4 text-gray-400" />
                    PR Status Webhook URL
                  </label>
                  <DxTextBox
                    value={prStatusUrl}
                    onValueChanged={(e) => setPrStatusUrl(e.value ?? '')}
                    placeholder="https://api.pomdevth.site/api/erp/pr-status/<company>"
                    inputAttr={{ 'data-testid': 'metaherb-pr-status-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    ระบบจะ POST สถานะ PR (อนุมัติ/ปฏิเสธ/แปลงเป็น PO/ยกเลิก) กลับไป Metaherb ที่ URL นี้ — มีรหัสบริษัทอยู่ในตัว (เช่น …/pr-status/arjaro)
                    {view && (
                      <span className="ml-1">
                        · ที่มา: <b>{SOURCE_LABEL[view.source.prStatus]}</b>
                      </span>
                    )}
                  </p>
                </div>

                {/* PO Submit Webhook URL (outbound) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Webhook className="h-4 w-4 text-gray-400" />
                    PO Submit Webhook URL
                  </label>
                  <DxTextBox
                    value={poSubmitUrl}
                    onValueChanged={(e) => setPoSubmitUrl(e.value ?? '')}
                    placeholder="https://api.pomdevth.site/api/erp/po-submit/<company>"
                    inputAttr={{ 'data-testid': 'metaherb-po-submit-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    ตอนกด “ส่งอนุมัติ” PO ที่มาจาก Metaherb ระบบจะ POST ใบ PO ไปเข้าคิวอนุมัติฝั่ง Metaherb ที่ URL นี้ — เว้นว่างได้ ระบบจะอนุมานจาก PR Status URL ให้ (เปลี่ยน …/pr-status/ เป็น …/po-submit/)
                    {view && (
                      <span className="ml-1">
                        · ที่มา: <b>{SOURCE_LABEL[view.source.poSubmit]}</b>
                      </span>
                    )}
                  </p>
                </div>

                {/* Factory name (our company name sent in po-submit) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    ชื่อโรงงาน/บริษัทของเรา (factory)
                  </label>
                  <DxTextBox
                    value={factoryName}
                    onValueChanged={(e) => setFactoryName(e.value ?? '')}
                    placeholder="เช่น บริษัท ... จำกัด"
                    inputAttr={{ 'data-testid': 'metaherb-factory-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    ชื่อนี้จะถูกส่งไปกับใบ PO (ฟิลด์ factory) เพื่อให้ Metaherb แสดงในคิว admin ว่าใบ PO มาจากโรงงานใด
                    {view && (
                      <span className="ml-1">
                        · ที่มา: <b>{SOURCE_LABEL[view.source.factory]}</b>
                      </span>
                    )}
                  </p>
                </div>

                {/* SSO secret */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-gray-400" />
                    SSO Secret
                  </label>
                  <DxTextBox
                    value={secret}
                    mode="password"
                    onValueChanged={(e) => setSecret(e.value ?? '')}
                    placeholder={
                      view?.secretConfigured
                        ? '•••••••• (ตั้งไว้แล้ว — เว้นว่างเพื่อคงค่าเดิม)'
                        : 'วาง SSO secret ที่ Metaherb ออกให้'
                    }
                    inputAttr={{ 'data-testid': 'metaherb-secret-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    เก็บแบบเข้ารหัส (AES-256-GCM) ในฐานข้อมูล ไม่แสดงค่าเดิมกลับมา
                    {view && (
                      <span className="ml-1">
                        · สถานะ:{' '}
                        <b>
                          {view.secretConfigured
                            ? `ตั้งค่าแล้ว (${SOURCE_LABEL[view.source.secret]})`
                            : 'ยังไม่ตั้งค่า'}
                        </b>
                      </span>
                    )}
                  </p>
                </div>

                <div className="pt-2">
                  <DxButton
                    text={saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    type="default"
                    stylingMode="contained"
                    disabled={saving}
                    onClick={handleSave}
                    data-testid="metaherb-save-button"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
