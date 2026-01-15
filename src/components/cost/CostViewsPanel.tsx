'use client';

/**
 * Cost Views Panel Component
 * Displays all 5 cost views for an item: WAC, Standard, Last Purchase, Production, Full Cost
 */

import { useQuery } from '@tanstack/react-query';
import type { ItemCostViews } from '@/types/unit-cost';

interface CostViewsPanelProps {
  itemId: number;
  className?: string;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CostViewsPanel({ itemId, className = '' }: CostViewsPanelProps) {
  const { data: costViews, isLoading, error } = useQuery<ItemCostViews>({
    queryKey: ['item-cost-views', itemId],
    queryFn: async () => {
      const res = await fetch(`/api/cost/items/${itemId}/cost-views`);
      if (!res.ok) throw new Error('Failed to fetch cost views');
      return res.json();
    },
    enabled: !!itemId,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="text-red-500">Failed to load cost views</div>
      </div>
    );
  }

  if (!costViews) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="text-gray-500">No cost data available</div>
      </div>
    );
  }

  const costCards = [
    {
      label: 'Weighted Avg Cost (WAC)',
      value: costViews.inventoryCost,
      description: 'Calculated from all receipts',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      isPrimary: true,
    },
    {
      label: 'Standard Cost',
      value: costViews.standardCost,
      description: 'Predefined standard',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
    },
    {
      label: 'Last Purchase',
      value: costViews.lastPurchaseCost,
      description: costViews.lastPurchaseDate ? formatDate(costViews.lastPurchaseDate) : 'Never',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      label: 'Last Production',
      value: costViews.lastProductionCost,
      description: costViews.lastProductionDate ? formatDate(costViews.lastProductionDate) : 'Never',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      label: 'Full Absorption Cost',
      value: costViews.fullCost,
      description: 'WAC + SG&A allocation',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
  ];

  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`} data-testid="cost-views-panel">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Cost Views</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {costCards.map((card) => (
          <div
            key={card.label}
            className={`p-4 rounded-lg border ${card.bgColor} ${card.borderColor}`}
            data-testid={`cost-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="text-sm text-gray-600 font-medium">{card.label}</div>
            <div className={`text-xl font-bold mt-1 ${card.isPrimary ? 'text-blue-700' : 'text-gray-800'}`}>
              {formatCurrency(card.value)}
            </div>
            <div className="text-xs text-gray-500 mt-1">{card.description}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-gray-400">
        On Hand: {costViews.onHand?.toLocaleString() || 0} units |
        Total Value: {formatCurrency(costViews.onHandValue)}
      </div>
    </div>
  );
}

export default CostViewsPanel;
