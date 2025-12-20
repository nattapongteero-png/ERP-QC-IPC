using DevExpress.AspNetCore.Reporting.WebDocumentViewer;
using DevExpress.AspNetCore.Reporting.WebDocumentViewer.Native.Services;
using DevExpress.AspNetCore.Reporting.ReportDesigner;
using DevExpress.AspNetCore.Reporting.ReportDesigner.Native.Services;
using DevExpress.AspNetCore.Reporting.QueryBuilder;
using DevExpress.AspNetCore.Reporting.QueryBuilder.Native.Services;
using Microsoft.AspNetCore.Mvc;

namespace ReportingBackend.Controllers;

/// <summary>
/// Custom WebDocumentViewer controller for viewing reports
/// Required by DevExpress Reporting
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class CustomWebDocumentViewerController : WebDocumentViewerController
{
    public CustomWebDocumentViewerController(IWebDocumentViewerMvcControllerService controllerService)
        : base(controllerService)
    {
    }
}

/// <summary>
/// Custom ReportDesigner controller for designing reports
/// Required by DevExpress Reporting
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class CustomReportDesignerController : ReportDesignerController
{
    public CustomReportDesignerController(IReportDesignerMvcControllerService controllerService)
        : base(controllerService)
    {
    }
}

/// <summary>
/// Custom QueryBuilder controller for building data queries
/// Required by DevExpress Reporting
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class CustomQueryBuilderController : QueryBuilderController
{
    public CustomQueryBuilderController(IQueryBuilderMvcControllerService controllerService)
        : base(controllerService)
    {
    }
}
