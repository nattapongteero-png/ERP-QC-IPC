'use client';

import { useCallback } from 'react';

// Import DevExpress Report Designer styles
import 'devextreme/dist/css/dx.light.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.common.css';
import '@devexpress/analytics-core/dist/css/dx-analytics.light.css';
import '@devexpress/analytics-core/dist/css/dx-querybuilder.css';
import 'devexpress-reporting/dist/css/dx-webdocumentviewer.css';
import 'devexpress-reporting/dist/css/dx-reportdesigner.css';
import 'ace-builds/css/ace.css';

// Import DevExpress Report Designer component and options
import DxReportDesigner, {
  RequestOptions,
  Callbacks,
} from 'devexpress-reporting-react/dx-report-designer';

interface ReportDesignerClientProps {
  reportUrl: string;
  backendUrl: string;
  onReady?: () => void;
  onSaving?: () => void;
  onSaved?: () => void;
  onError?: (error: string) => void;
  onComponentAdded?: () => void;
}

export default function ReportDesignerClient({
  reportUrl,
  backendUrl,
  onReady,
  onSaving,
  onSaved,
  onError,
  onComponentAdded,
}: ReportDesignerClientProps) {
  const handleBeforeRender = useCallback(() => {
    console.log('Report Designer: BeforeRender');
  }, []);

  const handleReportOpened = useCallback(() => {
    console.log('Report Designer: Report Opened');
    onReady?.();
  }, [onReady]);

  const handleReportSaving = useCallback(() => {
    console.log('Report Designer: Report Saving');
    onSaving?.();
  }, [onSaving]);

  const handleReportSaved = useCallback(() => {
    console.log('Report Designer: Report Saved');
    onSaved?.();
  }, [onSaved]);

  const handleComponentAdded = useCallback(() => {
    console.log('Report Designer: Component Added');
    onComponentAdded?.();
  }, [onComponentAdded]);

  const handleCustomizeToolbox = useCallback(() => {
    console.log('Report Designer: Customizing Toolbox');
  }, []);

  const handleOnServerError = useCallback((args: { Error?: { message?: string } }) => {
    console.error('Report Designer: Server Error', args);
    const errorMessage = args?.Error?.message || 'Server error occurred';
    onError?.(errorMessage);
  }, [onError]);

  return (
    <DxReportDesigner
      reportUrl={reportUrl}
      height="100%"
      width="100%"
    >
      <RequestOptions
        host={backendUrl}
        getDesignerModelAction="api/ReportDesignerSetup/GetReportDesignerModel"
      />
      <Callbacks
        BeforeRender={handleBeforeRender}
        ReportOpened={handleReportOpened}
        ReportSaving={handleReportSaving}
        ReportSaved={handleReportSaved}
        ComponentAdded={handleComponentAdded}
        CustomizeToolbox={handleCustomizeToolbox}
        OnServerError={handleOnServerError}
      />
    </DxReportDesigner>
  );
}
