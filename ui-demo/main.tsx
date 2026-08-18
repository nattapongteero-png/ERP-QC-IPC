import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';
import TestPanelsAdminPage from '@/app/quality/test-panels/page';
import { installMockApi } from './mock-api';
import './styles.css';

installMockApi();

// No retries: a demo should surface a broken mock immediately, not after 3 goes.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** The screens on offer. Add a page here and it appears in the switcher. */
const PAGES = [
  { id: 'criteria', label: 'QC & IPC Criteria', render: () => <IPCCriteriaForm mode="create" /> },
  { id: 'panels', label: 'ชุดการทดสอบ (Test Panels)', render: () => <TestPanelsAdminPage /> },
] as const;

function Demo() {
  const [page, setPage] = React.useState<(typeof PAGES)[number]['id']>('criteria');
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];

  return (
    <QueryClientProvider client={queryClient}>
      {/* The form raises toasts on save; without the provider it throws on mount. */}
      <ToastProvider>
      <div className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex flex-wrap items-center gap-3 px-6 pt-5 text-xs text-slate-500">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
              DEMO
            </span>
            <span>หน้าตัวอย่างสำหรับรีวิว UI — ข้อมูลเป็นชุดจำลอง กดบันทึกแล้วไม่ได้บันทึกจริง</span>
            <span className="ml-auto flex gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              {PAGES.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPage(p.id)}
                  className={
                    'rounded-full px-3 py-1 text-[12px] font-medium transition ' +
                    (p.id === page ? 'bg-[#2f6fd0] text-white' : 'text-slate-600 hover:text-[#2f6fd0]')
                  }
                >
                  {p.label}
                </button>
              ))}
            </span>
          </div>
          {current.render()}
        </div>
      </div>
      </ToastProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);
