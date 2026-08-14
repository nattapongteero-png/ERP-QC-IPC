import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';
import { installMockApi } from './mock-api';
import './styles.css';

installMockApi();

// No retries: a demo should surface a broken mock immediately, not after 3 goes.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Demo() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* The form raises toasts on save; without the provider it throws on mount. */}
      <ToastProvider>
      <div className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex items-center gap-3 px-6 pt-5 text-xs text-slate-500">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
              DEMO
            </span>
            <span>
              หน้าตัวอย่างสำหรับรีวิว UI — ข้อมูลเป็นชุดจำลอง กด CREATE แล้วไม่ได้บันทึกจริง
            </span>
          </div>
          <IPCCriteriaForm mode="create" />
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
