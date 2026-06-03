'use client';

/**
 * Reusable Back Button
 *
 * Renders a small "← Label" link that navigates to a parent path.
 * Use at the top of any list/detail page to give users a one-click way
 * back to the parent index.
 *
 * Usage:
 *   <BackButton href="/master-data" label="Master Data" />
 *
 * For just "history back" without a known parent:
 *   <BackButton onBack={() => router.back()} label="ย้อนกลับ" />
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  href?: string;
  label?: string;
  onBack?: () => void;
  className?: string;
}

export function BackButton({
  href,
  label = 'ย้อนกลับ',
  onBack,
  className = '',
}: BackButtonProps) {
  const baseClass =
    'inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-2';
  const cls = `${baseClass} ${className}`.trim();

  if (onBack) {
    return (
      <button type="button" onClick={onBack} className={cls}>
        <ArrowLeft className="w-4 h-4" />
        {label}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls}>
        <ArrowLeft className="w-4 h-4" />
        {label}
      </Link>
    );
  }
  return null;
}
