// src/components/dashboard/module-kpi-tabs.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import TabPanel from 'devextreme-react/tab-panel';
import { Card, CardContent } from '@/components/ui/card';
import { HRKpiSection } from './hr-kpi-section';
import { PurchaseKpiSection } from './purchase-kpi-section';
import { SalesKpiSection } from './sales-kpi-section';
import { VMIKpiSection } from './vmi-kpi-section';
import { GMPKpiSection } from './gmp-kpi-section';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  ShoppingCart,
  ShoppingBag,
  RefreshCw,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardModuleKpis } from '@/lib/services/dashboard.service';

interface ModuleKpiTabsProps {
  data: DashboardModuleKpis | null;
  isLoading: boolean;
}

interface TabItemData {
  id: string;
  title: string;
  icon: LucideIcon;
}

export function ModuleKpiTabs({ data, isLoading }: ModuleKpiTabsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const t = useTranslations('dashboard.moduleKpis');

  // Tab config rebuilds only when translator identity changes (i.e. on locale
  // switch). Stable reference on normal re-renders prevents DevExtreme from
  // re-mounting all 5 tabs each time the user clicks a different tab.
  const tabConfig: TabItemData[] = useMemo(
    () => [
      { id: 'hr', title: t('tabs.hr'), icon: Users },
      { id: 'purchase', title: t('tabs.purchase'), icon: ShoppingCart },
      { id: 'sales', title: t('tabs.sales'), icon: ShoppingBag },
      { id: 'vmi', title: t('tabs.vmi'), icon: RefreshCw },
      { id: 'gmp', title: t('tabs.gmp'), icon: Shield },
    ],
    [t],
  );

  // Render callbacks memoized so TabPanel's `itemTitleRender` / `itemRender`
  // props stay referentially stable across re-renders. Without this, every
  // parent re-render creates fresh function references — DevExtreme treats
  // that as "render props changed" and re-renders all tab titles + the
  // previous tab's body at the same moment as the new one, which is what
  // produced the ghosting/flicker when switching tabs.
  const renderTabTitle = useCallback((itemData: TabItemData) => {
    const Icon = itemData.icon;
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Icon className="h-4 w-4" />
        <span>{itemData.title}</span>
      </div>
    );
  }, []);

  const renderItem = useCallback(
    (itemData: TabItemData) => {
      if (!data) return null;
      switch (itemData.id) {
        case 'hr':
          return (
            <div className="p-4">
              <HRKpiSection data={data.hr} />
            </div>
          );
        case 'purchase':
          return (
            <div className="p-4">
              <PurchaseKpiSection data={data.purchase} />
            </div>
          );
        case 'sales':
          return (
            <div className="p-4">
              <SalesKpiSection data={data.sales} />
            </div>
          );
        case 'vmi':
          return (
            <div className="p-4">
              <VMIKpiSection data={data.vmi} />
            </div>
          );
        case 'gmp':
          return (
            <div className="p-4">
              <GMPKpiSection data={data.gmp} />
            </div>
          );
        default:
          return null;
      }
    },
    [data],
  );

  if (isLoading) {
    return (
      <Card elevation="raised">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex gap-4 border-b pb-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} width={100} height={32} />
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} height={120} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card
      title={t('cardTitle')}
      description={t('cardDescription')}
      elevation="raised"
    >
      <CardContent className="p-0">
        <TabPanel
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          loop={false}
          // animationEnabled=false kills the cross-fade transition so
          // outgoing and incoming tab panes don't overlap visually.
          animationEnabled={false}
          // deferRendering=true ensures each tab's body is only rendered on
          // first activation — prevents all 5 sections from being in the DOM
          // simultaneously, which contributed to the "ภาพซ้อน" ghost effect.
          deferRendering={true}
          swipeEnabled={false}
          className="module-kpi-tabs"
          items={tabConfig}
          itemTitleRender={renderTabTitle}
          itemRender={renderItem}
        />
      </CardContent>
    </Card>
  );
}
