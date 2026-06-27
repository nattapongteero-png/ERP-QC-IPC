'use client';

/**
 * Materials table for a requisition — shared by the (refactored) list's detail
 * view and the requisition detail page so the issuance-plan / on-hand display
 * stays identical. Pure presentational; takes the materials and a translate fn.
 */
import { Scale } from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';
import { planIssuance, plannedInPrimary, type MaterialRow } from './_lib';

interface MaterialsTableProps {
  materials: MaterialRow[];
  /** useTranslations('inventory') from the caller (next-intl Translator). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any, values?: any) => string;
}

export function RequisitionMaterialsTable({ materials, t }: MaterialsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 uppercase">
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-3">{t('requisitions.table.itemCode')}</th>
            <th className="text-left py-2 px-3">{t('requisitions.table.materialName')}</th>
            <th className="text-right py-2 px-3">{t('requisitions.table.quantityNeeded')}</th>
            <th className="text-right py-2 px-3">
              <div className="inline-flex items-center gap-1 justify-end">
                <Scale className="h-3.5 w-3.5" /> {t('requisitions.table.quantityToIssue')}
              </div>
            </th>
            <th className="text-right py-2 pl-3">{t('requisitions.table.onHand')}</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((mat) => {
            const plan = planIssuance(mat);
            const need = Number(mat.plannedQuantity);
            const have = Number(mat.releasedAvailable);
            // Compare in primary unit — have is already primary; coerce planned
            // via plannedInPrimary() so the colour matches the badge logic.
            const enough = have >= plannedInPrimary(mat);
            const ratio1 = Number(mat.conversionRate);
            const haveSU = plan && Number.isFinite(ratio1) && ratio1 > 0 ? have * ratio1 : null;
            return (
              <tr key={mat.materialId} className="border-b border-gray-100 last:border-b-0">
                <td className="py-2 pr-3 font-medium text-gray-900">{mat.itemCode}</td>
                <td className="py-2 px-3 text-gray-700">{mat.itemName}</td>
                <td className="py-2 px-3 text-right">
                  <span className="font-medium">{formatNumber(need)}</span>{' '}
                  <span className="text-gray-500">{mat.unit}</span>
                </td>
                <td className="py-2 px-3 text-right">
                  {plan ? (
                    <div>
                      <span className="font-semibold text-emerald-700">
                        {formatNumber(plan.puToIssue)} {plan.pu}
                      </span>
                      {plan.remainderSU > 0 && (
                        <div className="text-xs text-amber-700">
                          {t('requisitions.table.remainderOnSite', {
                            qty: formatNumber(plan.remainderSU),
                            unit: plan.su,
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="font-semibold text-emerald-700">
                      {formatNumber(need)} {mat.unit}
                    </span>
                  )}
                </td>
                <td className={`py-2 pl-3 text-right ${enough ? 'text-gray-700' : 'text-red-600 font-semibold'}`}>
                  <div>
                    {formatNumber(have)} <span className="text-gray-500 text-xs">{mat.itemUnit}</span>
                  </div>
                  {haveSU != null && plan && (
                    <div className="text-xs text-gray-500">
                      = {formatNumber(haveSU)} {plan.su}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
