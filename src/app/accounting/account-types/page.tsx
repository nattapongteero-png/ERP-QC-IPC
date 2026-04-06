'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingKPICardSkeleton,
} from '@/components/accounting';
import { Card, CardContent } from '@/components/ui/card';
import {
  Layers,
  CheckCircle2,
  FileText,
  FolderTree,
  ArrowRight,
} from 'lucide-react';

interface AccountTypeSummary {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  category: string;
  normalBalance: string;
  displayOrder: number;
  accountCount: number;
  activeCount: number;
  postableCount: number;
  groupCount: number;
}

async function fetchAccountTypeSummary(): Promise<AccountTypeSummary[]> {
  const res = await fetch('/api/accounting/gl-account-types/summary');
  if (!res.ok) throw new Error('Failed to fetch account type summary');
  const data = await res.json();
  return data.data || [];
}

const categoryConfig: Record<string, { color: string; bgColor: string; borderColor: string; label: string; labelTh: string }> = {
  asset: { color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', label: 'Assets', labelTh: 'สินทรัพย์' },
  liability: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', label: 'Liabilities', labelTh: 'หนี้สิน' },
  equity: { color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', label: 'Equity', labelTh: 'ส่วนของผู้ถือหุ้น' },
  revenue: { color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', label: 'Revenue', labelTh: 'รายได้' },
  expense: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Expenses', labelTh: 'ค่าใช้จ่าย' },
};

export default function AccountTypesPage() {
  const router = useRouter();

  const { data: types = [], isLoading, refetch } = useQuery({
    queryKey: ['gl-account-types-summary'],
    queryFn: fetchAccountTypeSummary,
  });

  const totals = useMemo(() => {
    return {
      types: types.length,
      accounts: types.reduce((sum, t) => sum + t.accountCount, 0),
      active: types.reduce((sum, t) => sum + t.activeCount, 0),
      postable: types.reduce((sum, t) => sum + t.postableCount, 0),
      groups: types.reduce((sum, t) => sum + t.groupCount, 0),
    };
  }, [types]);

  return (
    <div className="flex flex-col h-full">
      <AccountingPageHeader
        title="ประเภทบัญชี"
        subtitle="สรุปประเภทบัญชีและจำนวนบัญชีในแต่ละประเภท"
        icon="book"
        onRefresh={() => refetch()}
        breadcrumbs={[
          { label: 'Accounting', href: '/accounting' },
          { label: 'ประเภทบัญชี' },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <AccountingKPICardSkeleton key={i} />)
          ) : (
            <>
              <AccountingKPICard
                label="ประเภทบัญชีทั้งหมด"
                value={totals.types}
                icon="file-text"
                variant="info"
              />
              <AccountingKPICard
                label="จำนวนบัญชีทั้งหมด"
                value={totals.accounts}
                icon="wallet"
                variant="default"
              />
              <AccountingKPICard
                label="บัญชีที่ใช้งาน"
                value={totals.active}
                subtitle={`${totals.accounts > 0 ? Math.round((totals.active / totals.accounts) * 100) : 0}%`}
                icon="check-circle"
                variant="success"
              />
              <AccountingKPICard
                label="บัญชีที่บันทึกได้"
                value={totals.postable}
                subtitle={`กลุ่มบัญชี ${totals.groups}`}
                icon="receipt"
                variant="info"
              />
            </>
          )}
        </div>

        {/* Account Type Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-6">
                <div className="space-y-3 animate-pulse">
                  <div className="h-6 w-40 bg-gray-200 rounded" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-20 bg-gray-100 rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {types.map((type) => {
              const config = categoryConfig[type.category] || categoryConfig.asset;
              return (
                <Card
                  key={type.id}
                  className={`relative overflow-hidden border ${config.borderColor} hover:shadow-lg transition-all duration-200 cursor-pointer group`}
                  onClick={() => router.push(`/accounting/chart-of-accounts?typeId=${type.id}`)}
                >
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                            {type.code}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                            {type.normalBalance === 'debit' ? 'Debit' : 'Credit'}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mt-1">
                          {type.nameTh}
                        </h3>
                        <p className="text-sm text-gray-500">{type.nameEn}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>

                    {/* Stats Grid */}
                    <div className={`rounded-lg p-3 ${config.bgColor}`}>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Layers className={`h-3.5 w-3.5 ${config.color}`} />
                          </div>
                          <p className="text-xl font-bold text-gray-900">{type.accountCount}</p>
                          <p className="text-xs text-gray-500">ทั้งหมด</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <p className="text-xl font-bold text-gray-900">{type.postableCount}</p>
                          <p className="text-xs text-gray-500">บันทึกได้</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <FolderTree className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                          <p className="text-xl font-bold text-gray-900">{type.groupCount}</p>
                          <p className="text-xs text-gray-500">กลุ่มบัญชี</p>
                        </div>
                      </div>
                    </div>

                    {/* Category Badge */}
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.labelTh}
                      </span>
                      <span className="text-xs text-gray-400">
                        {type.activeCount === type.accountCount
                          ? 'ใช้งานทั้งหมด'
                          : `ใช้งาน ${type.activeCount}/${type.accountCount}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Summary Table */}
        {!isLoading && types.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  ตารางสรุป
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="px-5 py-3 text-left font-medium">รหัส</th>
                      <th className="px-5 py-3 text-left font-medium">ประเภทบัญชี</th>
                      <th className="px-5 py-3 text-left font-medium">หมวด</th>
                      <th className="px-5 py-3 text-center font-medium">ยอดปกติ</th>
                      <th className="px-5 py-3 text-center font-medium">บัญชีทั้งหมด</th>
                      <th className="px-5 py-3 text-center font-medium">ใช้งาน</th>
                      <th className="px-5 py-3 text-center font-medium">บันทึกได้</th>
                      <th className="px-5 py-3 text-center font-medium">กลุ่มบัญชี</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((type) => {
                      const config = categoryConfig[type.category] || categoryConfig.asset;
                      return (
                        <tr
                          key={type.id}
                          className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/accounting/chart-of-accounts?typeId=${type.id}`)}
                        >
                          <td className="px-5 py-3">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                              {type.code}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{type.nameTh}</p>
                              <p className="text-xs text-gray-500">{type.nameEn}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.bgColor} ${config.color}`}>
                              {config.labelTh}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              type.normalBalance === 'debit'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-green-50 text-green-700'
                            }`}>
                              {type.normalBalance === 'debit' ? 'เดบิต' : 'เครดิต'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center font-semibold">{type.accountCount}</td>
                          <td className="px-5 py-3 text-center text-green-600 font-medium">{type.activeCount}</td>
                          <td className="px-5 py-3 text-center text-blue-600 font-medium">{type.postableCount}</td>
                          <td className="px-5 py-3 text-center text-amber-600 font-medium">{type.groupCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-5 py-3" colSpan={4}>รวมทั้งหมด</td>
                      <td className="px-5 py-3 text-center">{totals.accounts}</td>
                      <td className="px-5 py-3 text-center text-green-600">{totals.active}</td>
                      <td className="px-5 py-3 text-center text-blue-600">{totals.postable}</td>
                      <td className="px-5 py-3 text-center text-amber-600">{totals.groups}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
