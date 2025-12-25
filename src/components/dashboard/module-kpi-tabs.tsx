// src/components/dashboard/module-kpi-tabs.tsx
'use client';

import { useState } from 'react';
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

const tabConfig: TabItemData[] = [
  { id: 'hr', title: 'HR / Personnel', icon: Users },
  { id: 'purchase', title: 'Purchasing', icon: ShoppingCart },
  { id: 'sales', title: 'Sales', icon: ShoppingBag },
  { id: 'vmi', title: 'VMI', icon: RefreshCw },
  { id: 'gmp', title: 'GMP Compliance', icon: Shield },
];

export function ModuleKpiTabs({ data, isLoading }: ModuleKpiTabsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  const renderTabTitle = (itemData: TabItemData) => {
    const Icon = itemData.icon;
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Icon className="h-4 w-4" />
        <span>{itemData.title}</span>
      </div>
    );
  };

  const renderItem = (itemData: TabItemData) => {
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
  };

  return (
    <Card
      title="Module KPIs"
      description="ตัวชี้วัดประสิทธิภาพแยกตามโมดูล"
      elevation="raised"
    >
      <CardContent className="p-0">
        <TabPanel
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          loop={false}
          animationEnabled={true}
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
