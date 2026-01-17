'use client';

import Link from 'next/link';
import { useReportLanguage } from '@/contexts/report-language-context';

export interface DrillDownLinkProps {
  value: number;
  accountCode: string;
  fromDate: string;
  toDate: string;
  className?: string;
}

export function DrillDownLink({ value, accountCode, fromDate, toDate, className = '' }: DrillDownLinkProps) {
  const { formatCurrency } = useReportLanguage();

  if (value === 0) {
    return <span className={`text-gray-400 ${className}`}>-</span>;
  }

  const href = `/accounting/gl-accounts/${accountCode}?from=${fromDate}&to=${toDate}`;

  return (
    <Link
      href={href}
      className={`text-blue-600 hover:text-blue-800 hover:underline font-medium ${className}`}
    >
      {formatCurrency(value)}
    </Link>
  );
}
