'use client';

/**
 * COA Template — Create New (Phase 5)
 *
 * Empty form variant of the template editor. Once saved, the user is
 * redirected to the list (or the edit page if they used "Save & continue").
 */
import { ResponsivePageHeader } from '@/components/shared';
import { CoaTemplateEditor } from '@/components/coa/CoaTemplateEditor';
import { Layout } from 'lucide-react';

export default function NewCoaTemplatePage() {
  return (
    <>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        <ResponsivePageHeader
          title="สร้างเทมเพลต COA"
          subtitle="ออกแบบเลย์เอาต์ใบรับรองคุณภาพ — Live preview ทางขวา"
          icon={Layout}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          breadcrumbs={[
            { label: 'Quality', href: '/quality' },
            { label: 'COA', href: '/quality/coa' },
            { label: 'Templates', href: '/quality/coa/templates' },
            { label: 'New' },
          ]}
        />
        <CoaTemplateEditor />
      </div>
    </>
  );
}
