'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from 'devextreme-react/button';
import { TextArea } from 'devextreme-react/text-area';
import { CheckBox } from 'devextreme-react/check-box';
import {
  Shirt,
  Hand,
  ShieldCheck,
  Sparkles,
  Footprints,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { ElectronicSignatureDialog } from '@/components/shared/ElectronicSignatureDialog';

export interface GowningChecklistData {
  gownClean: boolean;
  glovesOn: boolean;
  maskOn: boolean;
  hairnetOn: boolean;
  shoeCoverOn: boolean;
  handsSanitized: boolean;
  notes?: string;
}

export interface GowningFormProps {
  workOrderNumber: string;
  productName?: string;
  initialData?: Partial<GowningChecklistData>;
  status: 'not_started' | 'pending' | 'performed' | 'verified' | 'rejected';
  performerName?: string;
  performedAt?: string;
  verifierName?: string;
  verifiedAt?: string;
  onPerform: (data: GowningChecklistData, password: string) => Promise<{ success: boolean; error?: string }>;
  onVerify: (approved: boolean, password: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  isPerformer?: boolean;
  isVerifier?: boolean;
  readOnly?: boolean;
}

const CHECKLIST_ITEMS = [
  { key: 'gownClean' as const, icon: Shirt },
  { key: 'glovesOn' as const, icon: Hand },
  { key: 'maskOn' as const, icon: ShieldCheck },
  { key: 'hairnetOn' as const, icon: Sparkles },
  { key: 'shoeCoverOn' as const, icon: Footprints },
  { key: 'handsSanitized' as const, icon: Droplets },
];

/**
 * Gowning / Attire Verification Form (per-batch).
 * Mirrors LineClearanceForm but for PPE/gowning items, fully i18n.
 */
export function GowningForm({
  workOrderNumber,
  productName,
  initialData,
  status,
  performerName,
  performedAt,
  verifierName,
  verifiedAt,
  onPerform,
  onVerify,
  isPerformer = true,
  isVerifier = false,
  readOnly = false,
}: GowningFormProps) {
  const t = useTranslations('production');
  const [data, setData] = useState<GowningChecklistData>({
    gownClean: initialData?.gownClean ?? false,
    glovesOn: initialData?.glovesOn ?? false,
    maskOn: initialData?.maskOn ?? false,
    hairnetOn: initialData?.hairnetOn ?? false,
    shoeCoverOn: initialData?.shoeCoverOn ?? false,
    handsSanitized: initialData?.handsSanitized ?? false,
    notes: initialData?.notes ?? '',
  });

  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signAction, setSignAction] = useState<'perform' | 'verify_approve' | 'verify_reject'>('perform');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const allChecked =
    data.gownClean && data.glovesOn && data.maskOn && data.hairnetOn && data.shoeCoverOn && data.handsSanitized;

  const onItem = useCallback((key: keyof GowningChecklistData, value: boolean) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSign = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        if (signAction === 'perform') return await onPerform(data, password);
        return await onVerify(signAction === 'verify_approve', password, verifyNotes || undefined);
      } finally {
        setIsLoading(false);
      }
    },
    [signAction, data, verifyNotes, onPerform, onVerify]
  );

  const meaning =
    signAction === 'perform'
      ? t('gowning.meaning.perform')
      : signAction === 'verify_approve'
      ? t('gowning.meaning.approve')
      : t('gowning.meaning.reject');

  const statusBadge = () => {
    const map: Record<string, { cls: string; Icon: typeof Clock; key: string }> = {
      not_started: { cls: 'bg-gray-100 text-gray-700', Icon: Clock, key: 'notStarted' },
      pending: { cls: 'bg-amber-100 text-amber-700', Icon: Clock, key: 'pending' },
      performed: { cls: 'bg-blue-100 text-blue-700', Icon: UserCheck, key: 'performed' },
      verified: { cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2, key: 'verified' },
      rejected: { cls: 'bg-red-100 text-red-700', Icon: AlertCircle, key: 'rejected' },
    };
    const s = map[status] ?? map.not_started;
    const Icon = s.Icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.cls}`}>
        <Icon className="h-4 w-4" />
        {t(`gowning.status.${s.key}`)}
      </span>
    );
  };

  const canPerform = !readOnly && isPerformer && (status === 'not_started' || status === 'pending' || status === 'rejected');
  const canVerify = !readOnly && isVerifier && status === 'performed';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-sky-50 to-sky-100/40 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <Shirt className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('gowning.title')}</h3>
              <p className="text-sm text-gray-600">
                {t('gowning.workOrder')}: <span className="font-medium">{workOrderNumber}</span>
                {productName && <span className="ml-2">• {productName}</span>}
              </p>
            </div>
          </div>
          {statusBadge()}
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {CHECKLIST_ITEMS.map((item) => {
            const Icon = item.icon;
            const isChecked = data[item.key] as boolean;
            const isDisabled = readOnly || !canPerform;
            return (
              <div
                key={item.key}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isChecked ? 'border-sky-200 bg-sky-50' : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isDisabled ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-sky-100' : 'bg-gray-100'}`}>
                    <Icon className={`h-5 w-5 ${isChecked ? 'text-sky-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <CheckBox value={isChecked} onValueChange={(v) => onItem(item.key, v ?? false)} disabled={isDisabled} />
                      <label className="font-medium text-gray-900">{t(`gowning.items.${item.key}.label`)}</label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-7">{t(`gowning.items.${item.key}.description`)}</p>
                  </div>
                  {isChecked && <CheckCircle2 className="h-5 w-5 text-sky-500 flex-shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('gowning.notes')}</label>
          <TextArea
            value={data.notes}
            onValueChange={(value) => setData((prev) => ({ ...prev, notes: value }))}
            placeholder={t('gowning.notesPlaceholder')}
            height={80}
            disabled={readOnly || !canPerform}
          />
        </div>

        {(performerName || verifierName) && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">{t('gowning.signatures')}</h4>
            <div className="space-y-2 text-sm">
              {performerName && (
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-sky-600" />
                  <span className="text-gray-600">{t('gowning.performedBy')}:</span>
                  <span className="font-medium text-gray-900">{performerName}</span>
                  {performedAt && <span className="text-gray-500">• {new Date(performedAt).toLocaleString('th-TH')}</span>}
                </div>
              )}
              {verifierName && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-gray-600">{t('gowning.verifiedBy')}:</span>
                  <span className="font-medium text-gray-900">{verifierName}</span>
                  {verifiedAt && <span className="text-gray-500">• {new Date(verifiedAt).toLocaleString('th-TH')}</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {canVerify && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('gowning.verifyNotes')}</label>
            <TextArea value={verifyNotes} onValueChange={setVerifyNotes} placeholder={t('gowning.verifyNotesPlaceholder')} height={80} />
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {canPerform && !allChecked && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                {t('gowning.allRequired')}
              </span>
            )}
            {canVerify && (
              <span className="flex items-center gap-1.5 text-sky-600">
                <UserCheck className="h-4 w-4" />
                {t('gowning.reviewPrompt')}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {canPerform && (
              <Button
                text={isLoading ? t('gowning.signing') : t('gowning.signComplete')}
                type="success"
                stylingMode="contained"
                icon="check"
                onClick={() => { setSignAction('perform'); setShowSignDialog(true); }}
                disabled={!allChecked || isLoading}
              />
            )}
            {canVerify && (
              <>
                <Button text={t('gowning.reject')} type="danger" stylingMode="outlined" icon="close"
                  onClick={() => { setSignAction('verify_reject'); setShowSignDialog(true); }} disabled={isLoading} />
                <Button text={t('gowning.approve')} type="success" stylingMode="contained" icon="check"
                  onClick={() => { setSignAction('verify_approve'); setShowSignDialog(true); }} disabled={isLoading} />
              </>
            )}
          </div>
        </div>
      </div>

      <ElectronicSignatureDialog
        visible={showSignDialog}
        title={signAction === 'perform' ? t('gowning.title') : signAction === 'verify_approve' ? t('gowning.approve') : t('gowning.reject')}
        action={signAction}
        meaning={meaning}
        onSign={handleSign}
        onCancel={() => setShowSignDialog(false)}
        isLoading={isLoading}
      />
    </div>
  );
}

export default GowningForm;
