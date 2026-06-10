'use client';

import { useCallback, useRef } from 'react';

// Import DevExpress Report Designer styles.
// NOTE: do NOT import a second full DevExtreme base theme (e.g. dx.light.css)
// here — the app already loads dx.material.teal.light globally. Two full themes
// collide in the bundled CSS and collapse dropdown option lists on Chrome.
// Only analytics/reporting-specific CSS belongs here.
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

// Import ActionId for toolbar customization
import { ActionId } from 'devexpress-reporting/dx-reportdesigner';

interface ReportDesignerClientProps {
  reportUrl: string;
  backendUrl: string;
  onReady?: () => void;
  onSaving?: () => void;
  onSaved?: () => void;
  onError?: (error: string) => void;
  onComponentAdded?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DesignerRef = any;

export default function ReportDesignerClient({
  reportUrl,
  backendUrl,
  onReady,
  onSaving,
  onSaved,
  onError,
  onComponentAdded,
}: ReportDesignerClientProps) {
  // Store designer instance reference
  const designerRef = useRef<DesignerRef>(null);

  const handleBeforeRender = useCallback((args: { designerModel?: DesignerRef }) => {
    console.log('Report Designer: BeforeRender');
    // Store designer reference for later use
    if (args?.designerModel) {
      designerRef.current = args.designerModel;
    }
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

  // Customize menu actions to add useful toolbar buttons
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCustomizeMenuActions = useCallback(({ sender, args }: { sender: any; args: any }) => {
    console.log('Report Designer: Customizing Menu Actions', { sender, args });

    // Safety check - ensure args has required methods
    if (!args || typeof args.GetById !== 'function' || !Array.isArray(args.Actions)) {
      console.warn('Report Designer: CustomizeMenuActions - invalid args structure');
      return;
    }

    // Make common actions more visible in toolbar
    try {
      const newReportAction = args.GetById(ActionId.NewReport);
      if (newReportAction) {
        newReportAction.visible = true;
      }

      const openReportAction = args.GetById(ActionId.OpenReport);
      if (openReportAction) {
        openReportAction.visible = true;
      }
    } catch (e) {
      console.warn('Report Designer: Could not modify built-in actions', e);
    }

    // Add custom toolbar actions
    try {
      // Add "Data Source" action - opens data source wizard
      args.Actions.push({
        id: 'customDataSource',
        text: 'Data Source',
        imageClassName: 'dxrd-image-add-datasource',
        container: 'toolbar',
        visible: true,
        clickAction: () => {
          const designer = designerRef.current;
          if (designer?.OpenDataSourceWizard) {
            designer.OpenDataSourceWizard();
          } else {
            console.log('Data Source: Use Field List panel → Right-click → Add Data Source');
          }
        },
      });

      // Add "Parameters" action - opens parameters panel
      args.Actions.push({
        id: 'customParameters',
        text: 'Parameters',
        imageClassName: 'dxrd-image-parameters',
        container: 'toolbar',
        visible: true,
        clickAction: () => {
          const designer = designerRef.current;
          if (designer?.ShowParametersPanel) {
            designer.ShowParametersPanel();
          } else {
            console.log('Parameters: Use Field List panel → Parameters node');
          }
        },
      });

      // Add "Script Editor" toggle action
      args.Actions.push({
        id: 'customScriptEditor',
        text: 'Scripts',
        imageClassName: 'dxrd-image-scripts',
        container: 'toolbar',
        visible: true,
        clickAction: () => {
          const designer = designerRef.current;
          if (designer?.ToggleScriptEditor) {
            designer.ToggleScriptEditor();
          } else if (designer?.GetButtonStorage) {
            try {
              const buttonStorage = designer.GetButtonStorage();
              const scriptAction = buttonStorage?.['ToggleScriptEditor'] ||
                                   buttonStorage?.['ScriptEditor'];
              if (scriptAction) {
                scriptAction();
              }
            } catch {
              console.log('Script Editor: Available in View menu');
            }
          }
        },
      });

      // Add "Help" action
      args.Actions.push({
        id: 'customHelp',
        text: 'Help',
        imageClassName: 'dx-icon-help',
        container: 'toolbar',
        visible: true,
        clickAction: () => {
          window.open('https://docs.devexpress.com/XtraReports/2162/web-reporting', '_blank');
        },
      });

      console.log('Report Designer: Menu actions customized', args.Actions.length, 'total actions');
    } catch (e) {
      console.warn('Report Designer: Could not add custom actions', e);
    }
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
          CustomizeMenuActions={handleCustomizeMenuActions}
          OnServerError={handleOnServerError}
        />
      </DxReportDesigner>
    </div>
  );
}
