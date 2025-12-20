using DevExpress.AspNetCore.Reporting.WebDocumentViewer;
using DevExpress.AspNetCore.Reporting.WebDocumentViewer.Native.Services;
using DevExpress.AspNetCore.Reporting.ReportDesigner;
using DevExpress.AspNetCore.Reporting.ReportDesigner.Native.Services;
using DevExpress.AspNetCore.Reporting.QueryBuilder;
using DevExpress.AspNetCore.Reporting.QueryBuilder.Native.Services;
using Microsoft.AspNetCore.Mvc;

namespace ReportingBackend.Controllers;

/// <summary>
/// WebDocumentViewer controller for viewing reports
/// The base class defines [Route("DXXRDV")] attribute
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class CustomViewerController : WebDocumentViewerController
{
    public CustomViewerController(IWebDocumentViewerMvcControllerService controllerService)
        : base(controllerService)
    {
    }
}

/// <summary>
/// ReportDesigner controller for designing reports
/// The base class defines [Route("DXXRD")] attribute
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class CustomDesignerController : ReportDesignerController
{
    public CustomDesignerController(IReportDesignerMvcControllerService controllerService)
        : base(controllerService)
    {
    }
}

/// <summary>
/// QueryBuilder controller for building data queries
/// The base class defines [Route("DXXQB")] attribute
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class CustomQueryBuilderController : QueryBuilderController
{
    public CustomQueryBuilderController(IQueryBuilderMvcControllerService controllerService)
        : base(controllerService)
    {
    }
}
