using System.Text;
using Microsoft.EntityFrameworkCore;
using ReportingBackend.Data;
using ReportingBackend.Data.Models;

namespace ReportingBackend.Services;

/// <summary>
/// Custom report storage that persists DevExpress report templates to MySQL database.
/// This class extends ReportStorageWebExtension when DevExpress packages are available.
/// For now, it provides the core storage functionality.
/// </summary>
public class DatabaseReportStorage
{
    private readonly ReportDbContext _db;
    private readonly ILogger<DatabaseReportStorage> _logger;

    public DatabaseReportStorage(ReportDbContext db, ILogger<DatabaseReportStorage> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Check if data can be set for a report URL
    /// </summary>
    public bool CanSetData(string url)
    {
        return true;
    }

    /// <summary>
    /// Check if the URL is a valid report template code
    /// </summary>
    public bool IsValidUrl(string url)
    {
        return _db.ReportTemplates.Any(r => r.Code == url);
    }

    /// <summary>
    /// Get report template definition by code
    /// </summary>
    public byte[] GetData(string url)
    {
        var template = _db.ReportTemplates.FirstOrDefault(r => r.Code == url);
        if (template == null)
        {
            _logger.LogWarning("Report template not found: {Url}", url);
            throw new InvalidOperationException($"Report template '{url}' not found");
        }
        return Encoding.UTF8.GetBytes(template.Definition);
    }

    /// <summary>
    /// Get all published report template URLs
    /// </summary>
    public Dictionary<string, string> GetUrls()
    {
        return _db.ReportTemplates
            .Where(r => r.IsPublished)
            .ToDictionary(r => r.Code, r => r.Name);
    }

    /// <summary>
    /// Save report template definition
    /// </summary>
    public void SetData(string definition, string url)
    {
        var template = _db.ReportTemplates.FirstOrDefault(r => r.Code == url);
        if (template == null)
        {
            throw new InvalidOperationException($"Report template '{url}' not found");
        }

        template.Definition = definition;
        template.Version += 1;
        template.UpdatedAt = DateTime.UtcNow;
        _db.SaveChanges();

        _logger.LogInformation("Report template '{Url}' saved, version {Version}", url, template.Version);
    }

    /// <summary>
    /// Create new report template
    /// </summary>
    public string SetNewData(string definition, string defaultUrl, int createdBy)
    {
        var code = GenerateUniqueCode(defaultUrl);

        var template = new ReportTemplate
        {
            Name = defaultUrl,
            Code = code,
            Definition = definition,
            Version = 1,
            IsPublished = false,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.ReportTemplates.Add(template);
        _db.SaveChanges();

        _logger.LogInformation("Report template '{Code}' created by user {UserId}", code, createdBy);
        return code;
    }

    /// <summary>
    /// Get report template by code
    /// </summary>
    public ReportTemplate? GetTemplate(string code)
    {
        return _db.ReportTemplates
            .Include(t => t.Category)
            .Include(t => t.Permissions)
            .FirstOrDefault(r => r.Code == code);
    }

    /// <summary>
    /// Get all published templates
    /// </summary>
    public List<ReportTemplate> GetPublishedTemplates()
    {
        return _db.ReportTemplates
            .Where(r => r.IsPublished)
            .Include(t => t.Category)
            .OrderBy(r => r.Category!.SortOrder)
            .ThenBy(r => r.Name)
            .ToList();
    }

    /// <summary>
    /// Get templates by category
    /// </summary>
    public List<ReportTemplate> GetTemplatesByCategory(int categoryId)
    {
        return _db.ReportTemplates
            .Where(r => r.CategoryId == categoryId && r.IsPublished)
            .OrderBy(r => r.Name)
            .ToList();
    }

    /// <summary>
    /// Generate a unique code from a base name
    /// </summary>
    private string GenerateUniqueCode(string baseName)
    {
        var code = baseName.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");

        // Remove any non-alphanumeric characters except hyphens
        code = System.Text.RegularExpressions.Regex.Replace(code, @"[^a-z0-9\-]", "");

        var counter = 1;
        var originalCode = code;
        while (_db.ReportTemplates.Any(r => r.Code == code))
        {
            code = $"{originalCode}-{counter++}";
        }
        return code;
    }
}
