import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { MainLayout } from '@/components/layout/main-layout';
import { IPCCriteriaForm } from '@/components/master-data/IPCCriteriaForm';
import TestPanelsAdminPage from '@/app/quality/test-panels/page';
// The execution board, SOP execution and IPC screens are the application's own
// pages, running here against a frozen copy of one work order's API responses.
// A replica would drift from the app the first time either screen changed;
// this cannot.
import WorkOrderExecutionPage from '@/app/production/work-orders/[id]/execution/page';
import SopExecutionPage from '@/app/production/work-orders/[id]/sop-execution/page';
import IPCPage from '@/app/production/work-orders/[id]/ipc/page';
import WorkOrderDetailPage from '@/app/production/work-orders/[id]/page';
import QcEntryListPage from '@/app/quality/qc-entry/page';
import QcSampleDetailPage from '@/app/quality/qc-entry/[id]/page';
import { setDemoPath, setDemoNavigate } from './shims/next-navigation';
import { installMockApi } from './mock-api';
import './styles.css';

installMockApi();

// No retries: a demo should surface a broken mock immediately, not after 3 goes.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

type PageId =
  | 'criteria' | 'panels' | 'wo-exec' | 'wo-ipc' | 'wo-sop'
  | 'wo-ebmr' | 'qc-list' | 'qc-sample';

/**
 * The screens on offer.
 *
 * `path` is published to the sidebar so the real menu highlights the module the
 * screen belongs to — without it every item reads inactive and the shell looks
 * broken in the one place a reviewer is looking.
 */
const PAGES: { id: PageId; label: string; path: string }[] = [
  { id: 'wo-sop', label: 'SOP Execution', path: '/production/work-orders/142/sop-execution' },
  { id: 'wo-ipc', label: 'IPC — บันทึกผล', path: '/production/work-orders/142/ipc' },
  { id: 'wo-exec', label: 'ใบสั่งผลิต — ดำเนินการผลิต', path: '/production/work-orders/142/execution' },
  // ?tab=ebmr because the screen picks its opening tab out of the query, and a
  // reviewer sent here is coming for the batch record, not the overview.
  { id: 'wo-ebmr', label: 'ใบสั่งผลิต — eBMR', path: '/production/work-orders/142?tab=ebmr' },
  { id: 'qc-sample', label: 'บันทึกผล QC', path: '/quality/qc-entry/4' },
  { id: 'qc-list', label: 'รายการตัวอย่าง QC', path: '/quality/qc-entry' },
  { id: 'criteria', label: 'สร้างเกณฑ์ QC / IPC', path: '/master-data/ipc-criteria/new' },
  { id: 'panels', label: 'ชุดการทดสอบ', path: '/quality/test-panels' },
];

/** In-app links that should move the demo rather than pop an alert. */
const ROUTE_MAP: { match: RegExp; page: PageId }[] = [
  { match: /sop-execution/, page: 'wo-sop' },
  { match: /\/ipc(\?|$)/, page: 'wo-ipc' },
  { match: /\/execution(\?|$)/, page: 'wo-exec' },
  { match: /\/work-orders\/\d+\?tab=ebmr/, page: 'wo-ebmr' },
  { match: /\/work-orders\/\d+(\?|$)/, page: 'wo-ebmr' },
  { match: /qc-entry\/\d+/, page: 'qc-sample' },
  { match: /qc-entry/, page: 'qc-list' },
  { match: /ipc-criteria/, page: 'criteria' },
  { match: /test-panels/, page: 'panels' },
];

function Demo() {
  const [page, setPage] = React.useState<PageId>('wo-sop');

  const go = React.useCallback((id: PageId) => {
    setPage(id);
    setDemoPath(PAGES.find((p) => p.id === id)!.path);
  }, []);

  // Links rendered by the real components (sidebar, breadcrumbs, back buttons)
  // resolve through here, so navigation inside the demo behaves like the app
  // for the routes the demo actually has.
  React.useEffect(() => {
    setDemoNavigate((href) => {
      const hit = ROUTE_MAP.find((r) => r.match.test(href));
      if (!hit) return false;
      go(hit.page);
      return true;
    });
  }, [go]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* The criteria form raises toasts on save; without the provider it
          throws on mount. */}
      <ToastProvider>
        <MainLayout>
          {page === 'wo-exec' && (
            <div className="w-full overflow-y-auto">
              <WorkOrderExecutionPage />
            </div>
          )}
          {page === 'wo-ipc' && (
            <div className="w-full overflow-y-auto">
              <IPCPage />
            </div>
          )}
          {page === 'wo-ebmr' && (
            <div className="w-full overflow-y-auto">
              <WorkOrderDetailPage />
            </div>
          )}
          {page === 'wo-sop' && (
            <div className="w-full overflow-y-auto">
              <SopExecutionPage />
            </div>
          )}
          {page === 'qc-list' && (
            <div className="w-full overflow-y-auto">
              <QcEntryListPage />
            </div>
          )}
          {page === 'qc-sample' && (
            <div className="w-full overflow-y-auto">
              <QcSampleDetailPage />
            </div>
          )}
          {page === 'criteria' && (
            <div className="w-full overflow-y-auto">
              <IPCCriteriaForm mode="create" />
            </div>
          )}
          {page === 'panels' && (
            <div className="w-full overflow-y-auto">
              <TestPanelsAdminPage />
            </div>
          )}
        </MainLayout>

        {/* Screen picker. Bottom-right: a top banner covers the breadcrumb, and
            centring it puts it under the dialog's own footer buttons. */}
        <div className="no-print fixed bottom-4 right-4 z-[1500] flex flex-wrap items-center gap-1 rounded-full bg-white/95 p-1.5 pl-3 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            DEMO
          </span>
          {PAGES.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => go(p.id)}
              className={
                'rounded-full px-3 py-1.5 text-[12px] font-medium transition ' +
                (p.id === page ? 'bg-[#2f6fd0] text-white' : 'text-slate-600 hover:text-[#2f6fd0]')
              }
            >
              {p.label}
            </button>
          ))}
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
