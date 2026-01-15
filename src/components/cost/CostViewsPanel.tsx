'use client';

/**
 * Cost Views Panel Component
 * Feature: 014-unit-cost (US4 - Multiple Cost View Access)
 *
 * Displays all 5 cost views for an item:
 * - Weighted Average Cost (WAC)
 * - Standard Cost
 * - Last Purchase Cost (with date)
 * - Last Production Cost (with date)
 * - Full Absorption Cost (WAC + SG&A)
 *
 * Plus: Suggested selling price based on configurable target margin
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NumberBox } from 'devextreme-react/number-box';
import { DollarSign, TrendingUp } from 'lucide-react';
import type { ItemCostViews } from '@/types/unit-cost';

interface CostViewsPanelProps {
  itemId: number;
  className?: string;
  showSuggestedPrice?: boolean;
  defaultMarginPercent?: number;
}

interface CostViewsWithPrice extends ItemCostViews {
  suggestedPrice: number | null;
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

// Calculate suggested price client-side for real-time updates
function calculateSuggestedPrice(fullCost: number | null, marginPercent: number): number | null {
  if (fullCost === null || fullCost <= 0) return null;
  if (marginPercent >= 100 || marginPercent <= 0) return null;
  const marginFactor = 1 - marginPercent / 100;
  return Math.round((fullCost / marginFactor) * 100) / 100;
}

export function CostViewsPanel({
  itemId,
  className = '',
  showSuggestedPrice = true,
  defaultMarginPercent = 30,
}: CostViewsPanelProps) {
  const [marginPercent, setMarginPercent] = useState(defaultMarginPercent);

  const { data: costViews, isLoading, error } = useQuery<CostViewsWithPrice>({
    queryKey: ['item-cost-views', itemId, marginPercent],
    queryFn: async () => {
      const res = await fetch(`/api/cost/items/${itemId}/cost-views?margin=${marginPercent}`);
      if (!res.ok) throw new Error('Failed to fetch cost views');
      return res.json();
    },
    enabled: !!itemId,
    staleTime: 30000, // 30 seconds
  });

  // Calculate suggested price client-side for instant feedback when margin changes
  const suggestedPrice = useMemo(() => {
    if (!costViews?.fullCost) return null;
    return calculateSuggestedPrice(costViews.fullCost, marginPercent);
  }, [costViews?.fullCost, marginPercent]);

  if (isLoading) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`} data-testid="cost-views-panel-loading">
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

      {/* Suggested Price Section */}
      {showSuggestedPrice && costViews.fullCost && (
        <div className="mt-6 pt-4 border-t border-gray-200" data-testid="suggested-price-section">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-teal-600" />
            <h4 className="text-md font-semibold text-gray-700">Suggested Selling Price</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Margin Input */}
            <div data-testid="margin-input-container">
              <label className="block text-sm text-gray-600 mb-1">Target Margin %</label>
              <NumberBox
                value={marginPercent}
                onValueChanged={(e) => setMarginPercent(e.value ?? 30)}
                min={1}
                max={99}
                showSpinButtons
                format="#0'%'"
                width="100%"
              />
            </div>
            {/* Full Cost */}
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-sm text-gray-600">Full Absorption Cost</div>
              <div className="text-lg font-bold text-orange-700">{formatCurrency(costViews.fullCost)}</div>
            </div>
            {/* Suggested Price */}
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Suggested Price
              </div>
              <div className="text-xl font-bold text-teal-700" data-testid="suggested-price-value">
                {formatCurrency(suggestedPrice)}
              </div>
              <div className="text-xs text-gray-500">at {marginPercent}% margin</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400">
        On Hand: {costViews.onHand?.toLocaleString() || 0} units |
        Total Value: {formatCurrency(costViews.onHandValue)}
      </div>
    </div>
  );
}

export default CostViewsPanel;
