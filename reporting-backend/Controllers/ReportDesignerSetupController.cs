using System.Net.Mime;
using DevExpress.XtraReports.Web.ReportDesigner;
using DevExpress.XtraReports.Web.ReportDesigner.Services;
using Microsoft.AspNetCore.Mvc;

namespace ReportingBackend.Controllers;

/// <summary>
/// Controller for initializing the Report Designer with proper model configuration.
/// Based on AspNetCore.Reporting.BestPractices reference implementation.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ReportDesignerSetupController : ControllerBase
{
    private readonly ILogger<ReportDesignerSetupController> _logger;

    public ReportDesignerSetupController(ILogger<ReportDesignerSetupController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Builds and returns the Report Designer model configuration.
    /// </summary>
    [HttpPost("[action]")]
    public IActionResult GetReportDesignerModel(
        [FromForm] string? reportUrl,
        [FromServices] IReportDesignerModelBuilder reportDesignerModel,
        [FromServices] IReportDesignerClientSideModelGenerator modelGenerator)
    {
        try
        {
            _logger.LogInformation("Building designer model for report: {ReportUrl}", reportUrl ?? "new");

            // Configure data sources (can be extended for custom data sources)
            var dataSources = new Dictionary<string, object>();

            // Build the designer model
            reportDesignerModel
                .Report(reportUrl ?? string.Empty)
                .DataSources(dataSources)
                .DesignerUri("/DXXRD")      // Designer API endpoint
                .ViewerUri("/DXXRDV")       // Viewer API endpoint
                .QueryBuilderUri("/DXXQB")  // Query builder endpoint
                .BuildJsonModel();

            var model = reportDesignerModel.BuildModel();
            var modelJson = modelGenerator.GetJsonModelScript(model);

            _logger.LogInformation("Designer model built successfully");
            return Content(modelJson, MediaTypeNames.Application.Json);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build designer model for report: {ReportUrl}", reportUrl);
            return StatusCode(500, new { error = ex.Message, details = ex.ToString() });
        }
    }
}
