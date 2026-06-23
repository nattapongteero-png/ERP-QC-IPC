'use client';

/**
 * Material Withdrawal — Pending queue (MERGED).
 *
 * The pending approval queue is now part of the main list page
 * (/material-withdrawal), which can filter by สถานะ='รออนุมัติ' and approve
 * in-place from the detail dialog. This route now just redirects there
 * (pre-filtered to pending) so old links / bookmarks keep working.
 *
 * Feature: 018-material-withdrawal-approval
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MaterialWithdrawalPendingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/material-withdrawal?status=pending');
  }, [router]);
  return (
    <div className="p-6 text-center text-gray-500">
      กำลังนำไปยังหน้าขอเบิกเพิ่ม (นอก BOM)…
    </div>
  );
}
