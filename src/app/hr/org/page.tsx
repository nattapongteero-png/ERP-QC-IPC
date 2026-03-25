'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { DxTabs } from '@/components/ui/dx-tabs';
import type { DxTabItem } from '@/components/ui/dx-tabs';
import { OrgChartTree } from '@/components/hr';
import { OrgChartDiagram } from '@/components/hr';
import { Network } from 'lucide-react';

const tabItems: DxTabItem[] = [
  { id: 0, text: 'Tree View', icon: 'hierarchy' },
  { id: 1, text: 'Diagram View', icon: 'chart' },
];

export default function OrgPage() {
  const t = useTranslations('hr');
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={t('page.title')}
        subtitle="Organization Structure"
        icon={Network}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Organization' },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          <DxTabs
            items={tabItems}
            selectedIndex={activeTab}
            onSelectedIndexChange={(idx) => setActiveTab(idx)}
          />
          <div className="p-4">
            {activeTab === 0 ? (
              <OrgChartTree height={600} editable />
            ) : (
              <OrgChartDiagram height={600} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
