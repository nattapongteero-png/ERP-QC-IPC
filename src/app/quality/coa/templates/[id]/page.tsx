'use client';

/**
 * COA Template — Edit (Phase 5)
 *
 * Loads the template by id and feeds its values into the shared
 * CoaTemplateEditor component. Falls back to "Not found" with a back button
 * when the id is invalid or missing.
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { CoaTemplateEditor } from '@/components/coa/CoaTemplateEditor';
import type {
  CoaTemplate,
} from '@/lib/services/coa.service';
import { Layout } from 'lucide-react';

export default function EditCoaTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('quality');
  const id = Number(params?.id);
  const [template, setTemplate] = useState<CoaTemplate | null>(null);
  const [siblings, setSiblings] = useState<CoaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError('Invalid template id');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/quality/coa/templates/${id}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Failed to load template');
          return;
        }
        const tpl = data.data as CoaTemplate;
        setTemplate(tpl);
        // Load same-category templates so we can warn when toggling default
        const catParam = tpl.productCategory
          ? `?productCategory=${encodeURIComponent(tpl.productCategory)}`
          : '';
        try {
          const sibRes = await fetch(`/api/quality/coa/templates${catParam}`);
          const sibData = await sibRes.json();
          if (sibData.success) {
            setSiblings(
              ((sibData.data?.items as CoaTemplate[]) || []).filter(
                (t) => t.id !== id,
              ),
            );
          }
        } catch {
          /* ignore — non-fatal */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[40vh]">
          <DxLoadIndicator visible />
        </div>
      </>
    );
  }

  if (error || !template) {
    return (
      <>
        <div className="p-6">
          <ResponsivePageHeader
            title="Template Not Found"
            subtitle={error || t('coa.templates.detail.notFound')}
            icon={Layout}
            iconBgColor="bg-red-100"
            iconColor="text-red-600"
          />
          <div className="mt-4">
            <DxButton
              text={t('coa.templates.detail.back')}
              icon="back"
              onClick={() => router.push('/quality/coa/templates')}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title={t('coa.templates.detail.title', { name: template.name })}
          subtitle={
            template.productCategory
              ? t('coa.templates.detail.subtitle', {
                  category: template.productCategory,
                })
              : 'Global default template'
          }
          icon={Layout}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'COA', href: '/quality/coa' },
            { label: 'Templates', href: '/quality/coa/templates' },
            { label: template.name },
          ]}
        />
        <CoaTemplateEditor
          templateId={template.id}
          initialValue={{
            name: template.name,
            productCategory: template.productCategory,
            isDefault: template.isDefault,
            isActive: template.isActive,
            headerLogoPath: template.headerLogoPath,
            headerHtml: template.headerHtml,
            footerHtml: template.footerHtml,
            signatoryRoles: template.signatoryRoles,
            showStorageConditions: template.showStorageConditions,
            showExpiryDate: template.showExpiryDate,
            showRetestDate: template.showRetestDate,
            showQrVerify: template.showQrVerify,
            language: template.language,
          }}
          otherDefaultsForCategory={siblings}
        />
      </div>
    </>
  );
}
