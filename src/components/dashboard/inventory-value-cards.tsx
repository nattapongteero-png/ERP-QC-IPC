'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Boxes, Package, CalendarClock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber, formatBaht } from '@/lib/utils/number-format';
import { cn } from '@/lib/utils/cn';

export interface StockValue {
  items: number;
  lots: number;
  quantity: number;
  value: number;
  uncostedLots: number;
}

export interface ExpiringStock extends StockValue {
  expiredLots: number;
  expiredValue: number;
}

export interface InventoryValueKpis {
  finishedGoods: StockValue;
  rawMaterials: StockValue;
  packaging: StockValue;
  expiringSoon: ExpiringStock;
}

interface ValueCardProps {
  label: string;
  href: string;
  testId: string;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
  stock: StockValue;
  /** Rendered under the value line — e.g. the expiry breakdown. */
  footer?: React.ReactNode;
}

/**
 * One stock category: how many items, what it's worth.
 *
 * When some lots carry no unit cost, the baht figure is a floor rather than the
 * true value, and the card says so explicitly. Showing the number alone would
 * read as complete when it isn't — finished-goods lots are commonly uncosted
 * until their work order closes.
 */
function ValueCard({
  label,
  href,
  testId,
  icon,
  accent,
  iconBg,
  stock,
  footer,
}: ValueCardProps) {
  const t = useTranslations('dashboard');
  const hasUncosted = stock.uncostedLots > 0;

  return (
    <Link href={href} data-testid={testId} className="block rounded-xl">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {label}
            </span>
            <span className={cn('rounded-lg p-2', iconBg, accent)}>{icon}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span
              className="text-2xl font-bold tabular-nums"
              data-testid={`${testId}-value`}
            >
              {formatBaht(stock.value)}
            </span>
            <span
              className="text-sm text-muted-foreground tabular-nums"
              data-testid={`${testId}-items`}
            >
              {t('inventoryValue.itemsAndLots', {
                items: formatNumber(stock.items),
                lots: formatNumber(stock.lots),
              })}
            </span>
          </div>

          {footer}

          {hasUncosted && (
            <span
              className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500"
              data-testid={`${testId}-uncosted`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('inventoryValue.uncostedWarning', {
                count: formatNumber(stock.uncostedLots),
              })}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Stock on hand by category with baht values, plus expiry exposure.
 *
 * Values cover quarantine/under_test/released lots with quantity > 0. Rejected
 * and blocked lots are excluded — that stock is awaiting disposal and would
 * overstate the inventory balance.
 */
export function InventoryValueCards({
  data,
}: {
  data: InventoryValueKpis | null;
}) {
  const t = useTranslations('dashboard');

  if (!data) return null;

  const { expiringSoon } = data;
  const hasExpired = expiringSoon.expiredLots > 0;

  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      data-testid="inventory-value-cards"
    >
      <ValueCard
        label={t('inventoryValue.finishedGoods')}
        href="/inventory/lots?type=finished_goods"
        testId="inventory-value-fg"
        icon={<Boxes className="h-5 w-5" />}
        accent="text-green-600"
        iconBg="bg-green-100 dark:bg-green-950"
        stock={data.finishedGoods}
      />

      <ValueCard
        label={t('inventoryValue.rawMaterials')}
        href="/inventory/lots?type=raw_material"
        testId="inventory-value-rm"
        icon={<Package className="h-5 w-5" />}
        accent="text-blue-600"
        iconBg="bg-blue-100 dark:bg-blue-950"
        stock={data.rawMaterials}
      />

      <ValueCard
        label={t('inventoryValue.expiringSoon')}
        href="/inventory/lots?expiring=30"
        testId="inventory-value-expiring"
        icon={<CalendarClock className="h-5 w-5" />}
        accent="text-amber-600"
        iconBg="bg-amber-100 dark:bg-amber-950"
        stock={expiringSoon}
        footer={
          hasExpired ? (
            <span
              className="flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-500"
              data-testid="inventory-value-expiring-expired"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('inventoryValue.alreadyExpired', {
                lots: formatNumber(expiringSoon.expiredLots),
                value: formatBaht(expiringSoon.expiredValue),
              })}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
