'use client';

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { ResponsivePageHeader } from '@/components/shared';
import { LogIn, Check, AlertCircle, KeyRound, Link2, Loader2, ShieldCheck, Webhook, Building2 } from 'lucide-react';

interface SettingsView {
  baseUrl: string;
  companyKey: string;
  factoryName: string;
  callbackUrl: string;
  prStatusUrl: string;
  poSubmitUrl: string;
  poOwnerDecisionUrl: string;
  secretConfigured: boolean;
  source: {
    secret: 'db' | 'env' | 'none' | 'db-decrypt-failed';
    urls: 'base' | 'legacy' | 'env' | 'none';
    factory: 'db' | 'env' | 'none';
  };
}

const SECRET_SOURCE_LABEL: Record<string, string> = {
  db: 'ฐานข้อมูล',
  env: 'ENV (fallback)',
  none: 'ยังไม่ตั้งค่า',
  'db-decrypt-failed': 'ถอดรหัสค่าใน DB ไม่สำเร็จ (คีย์ไม่ตรง — กรุณากรอก Secret ใหม่)',
};

const URLS_SOURCE_LABEL: Record<string, string> = {
  base: 'สร้างจาก Base URL + Company Key',
  legacy: 'ค่า URL เดิม (ฐานข้อมูล)',
  env: 'ENV (fallback)',
  none: 'ยังไม่ตั้งค่า',
};

export default function MetaherbSsoSettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [companyKey, setCompanyKey] = useState('');
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
        setBaseUrl(data.data.baseUrl || '');
        setCompanyKey(data.data.companyKey || '');
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

  // Live preview of the endpoints that base + key will produce (client-side
  // mirror of buildMetaherbUrls — for display only).
  const previewUrls = (() => {
    const base = baseUrl.trim().replace(/\/+$/, '');
    const key = companyKey.trim();
    if (!base || !key) return null;
    return {
      callbackUrl: `${base}/api/sso/erp/callback/${key}`,
      prStatusUrl: `${base}/api/erp/pr-status/${key}`,
      poSubmitUrl: `${base}/api/erp/po-submit/${key}`,
      poOwnerDecisionUrl: `${base}/api/erp/po-owner-decision/${key}`,
    };
  })();

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: {
        baseUrl?: string;
        companyKey?: string;
        ssoSecret?: string;
      } = {};
      // Only send non-empty values so a stray save can't wipe a stored one.
      if (baseUrl.trim() !== '') body.baseUrl = baseUrl.trim();
      if (companyKey.trim() !== '') body.companyKey = companyKey.trim();
      // Only send the secret if the admin actually typed a new one.
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
          subtitle="กรอก Base URL + Company Key + Secret ที่ Metaherb ออกให้ — ระบบจะประกอบ URL ปลายทางทุกเส้นเอง และใช้ชื่อบริษัทจากหน้าตั้งค่าบริษัทอัตโนมัติ (เก็บในฐานข้อมูล แก้ได้โดยไม่ต้อง redeploy)"
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
                {/* Base URL */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Link2 className="h-4 w-4 text-gray-400" />
                    Base URL (โดเมน Metaherb)
                  </label>
                  <DxTextBox
                    value={baseUrl}
                    onValueChanged={(e) => setBaseUrl(e.value ?? '')}
                    placeholder="https://api.pomdevth.site"
                    inputAttr={{ 'data-testid': 'metaherb-base-url-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    ใส่แค่โดเมน ไม่ต้องมี path — ระบบจะประกอบ URL ปลายทางทั้งหมดให้เอง
                  </p>
                </div>

                {/* Company Key */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-gray-400" />
                    Company Key (รหัสบริษัท)
                  </label>
                  <DxTextBox
                    value={companyKey}
                    onValueChanged={(e) => setCompanyKey(e.value ?? '')}
                    placeholder="เช่น uat หรือ arjaro"
                    inputAttr={{ 'data-testid': 'metaherb-company-key-input' }}
                  />
                  <p className="text-xs text-gray-500">
                    รหัสบริษัทที่ Metaherb ออกให้ (segment ท้าย URL ทุกเส้น) — ต้องตรง ไม่งั้น Metaherb ตอบ 403
                    {view && (
                      <span className="ml-1">
                        · ที่มา URL: <b>{URLS_SOURCE_LABEL[view.source.urls]}</b>
                      </span>
                    )}
                  </p>
                </div>

                {/* Factory name is inherited from the company settings page
                    (/settings) — no separate entry here. Shown read-only so the
                    admin knows what name Metaherb will display. */}
                {view?.factoryName ? (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    ชื่อบริษัทที่ส่งให้ Metaherb (factory): <b className="text-gray-700">{view.factoryName}</b>
                    <span className="text-gray-400">— ดึงจากหน้า “ตั้งค่าบริษัท” อัตโนมัติ</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-amber-500" />
                    ยังไม่มีชื่อบริษัท — ไปกรอกที่หน้า “ตั้งค่าบริษัท” (/settings) ระบบจะนำมาใช้เป็นชื่อ factory ให้เอง
                  </p>
                )}

                {/* Derived endpoint preview (read-only) */}
                {previewUrls && (
                  <div
                    className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3"
                    data-testid="metaherb-url-preview"
                  >
                    <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                      <Webhook className="h-3.5 w-3.5 text-gray-400" />
                      URL ปลายทางที่ระบบจะใช้ (สร้างอัตโนมัติ)
                    </p>
                    <ul className="text-xs text-gray-500 space-y-0.5 break-all font-mono">
                      <li>Callback: {previewUrls.callbackUrl}</li>
                      <li>PR Status: {previewUrls.prStatusUrl}</li>
                      <li>PO Submit: {previewUrls.poSubmitUrl}</li>
                      <li>PO Owner Decision: {previewUrls.poOwnerDecisionUrl}</li>
                    </ul>
                  </div>
                )}

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
                            ? `ตั้งค่าแล้ว (${SECRET_SOURCE_LABEL[view.source.secret]})`
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
