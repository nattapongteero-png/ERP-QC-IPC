using System.ComponentModel.Design;
using DevExpress.XtraReports.Services;
using DevExpress.XtraReports.UI;
using DevExpress.XtraReports.Web.Extensions;

namespace ReportingBackend.Services;

/// <summary>
/// Custom report provider that loads reports from the database storage.
/// Based on AspNetCore.Reporting.BestPractices reference implementation.
/// </summary>
public class CustomReportProvider : IReportProvider
{
    private readonly ReportStorageWebExtension _reportStorage;
    private readonly ILogger<CustomReportProvider> _logger;

    public CustomReportProvider(
        ReportStorageWebExtension reportStorage,
        ILogger<CustomReportProvider> logger)
    {
        _reportStorage = reportStorage;
        _logger = logger;
    }

    public XtraReport GetReport(string id, ReportProviderContext context)
    {
        _logger.LogInformation("Loading report: {ReportId}", id);

        try
        {
            // Handle empty/new report case
            if (string.IsNullOrEmpty(id) || id == "new")
            {
                _logger.LogInformation("Creating new blank report");
                var newReport = new XtraReport();
                var container = (IServiceContainer)newReport;
                container.AddService(typeof(IReportProvider), this);
                return newReport;
            }

            // Load report from storage
            var reportLayoutBytes = _reportStorage.GetData(id);
            using var ms = new MemoryStream(reportLayoutBytes);
            var report = XtraReport.FromXmlStream(ms);

            // Register this provider as a service on the report
            // This allows sub-reports to be loaded using the same provider
            var serviceContainer = (IServiceContainer)report;
            serviceContainer.AddService(typeof(IReportProvider), this);

            _logger.LogInformation("Report loaded successfully: {ReportId}", id);
            return report;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load report: {ReportId}", id);
            throw;
        }
    }
}
