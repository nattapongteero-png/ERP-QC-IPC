using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using DevExpress.AspNetCore;
using DevExpress.AspNetCore.Reporting;
using DevExpress.XtraReports.Web.Extensions;
using DevExpress.XtraReports.Web.WebDocumentViewer;
using DevExpress.XtraReports.Services;
using ReportingBackend.Data;
using ReportingBackend.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddControllersWithViews();

// Configure CORS for Next.js frontend
var allowedOrigins = builder.Configuration["Cors:AllowedOrigins"]?.Split(',') ?? new[] { "http://localhost:3000" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowNextJS", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Configure MySQL database connection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

builder.Services.AddDbContext<ReportDbContext>(options =>
{
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

// Register custom services
builder.Services.AddScoped<JwtAuthenticationService>();

// Configure cache and storage cleaner settings (from Best Practices reference)
var cacheCleanerSettings = new CacheCleanerSettings(
    TimeSpan.FromMinutes(1),  // Check interval
    TimeSpan.FromSeconds(30), // Inactivity threshold
    TimeSpan.FromMinutes(2),  // Document inactivity
    TimeSpan.FromMinutes(2)   // Report inactivity
);
builder.Services.AddSingleton(cacheCleanerSettings);

var storageCleanerSettings = new StorageCleanerSettings(
    TimeSpan.FromMinutes(5),   // Check interval
    TimeSpan.FromMinutes(30),  // Document storage threshold
    TimeSpan.FromHours(12),    // Exported document threshold
    TimeSpan.FromHours(12),    // Report threshold
    TimeSpan.FromHours(12)     // Cache threshold
);
builder.Services.AddSingleton(storageCleanerSettings);

// Configure DevExpress Reporting services
builder.Services.AddDevExpressControls();
builder.Services.AddScoped<ReportStorageWebExtension, DatabaseReportStorage>();

// Register report provider (required for designer to work properly)
builder.Services.AddScoped<IReportProvider, CustomReportProvider>();

// Configure DevExpress Reporting
builder.Services.ConfigureReportingServices(configurator =>
{
    // Enable development mode for detailed error messages
    if (builder.Environment.IsDevelopment())
    {
        configurator.UseDevelopmentMode();
    }

    // Configure document viewer with file-based storage for better memory management
    var contentRootPath = builder.Environment.ContentRootPath;
    configurator.ConfigureWebDocumentViewer(viewerConfigurator =>
    {
        // Use file storage instead of in-memory for document caching
        viewerConfigurator.UseFileDocumentStorage(
            Path.Combine(contentRootPath, "ViewerStorages", "Documents"),
            StorageSynchronizationMode.InterThread);
        viewerConfigurator.UseFileExportedDocumentStorage(
            Path.Combine(contentRootPath, "ViewerStorages", "ExportedDocuments"),
            StorageSynchronizationMode.InterThread);
        viewerConfigurator.UseFileReportStorage(
            Path.Combine(contentRootPath, "ViewerStorages", "Reports"),
            StorageSynchronizationMode.InterThread);
        viewerConfigurator.UseCachedReportSourceBuilder();
    });

    configurator.ConfigureReportDesigner(designerConfigurator =>
    {
        designerConfigurator.RegisterDataSourceWizardConnectionStringsProvider<CustomConnectionStringProvider>();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    // Enable detailed exception pages for debugging
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Apply CORS policy
app.UseCors("AllowNextJS");

// Configure routing
app.UseRouting();

// Configure DevExpress middleware
app.UseDevExpressControls();

// Map controllers with default route pattern
app.MapControllers();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}"
);

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
    .WithName("HealthCheck")
    .WithOpenApi();

// Debug endpoint to list registered routes
app.MapGet("/debug/routes", (IEnumerable<EndpointDataSource> endpointSources) =>
{
    var routes = new List<object>();
    foreach (var source in endpointSources)
    {
        foreach (var endpoint in source.Endpoints)
        {
            if (endpoint is RouteEndpoint routeEndpoint)
            {
                routes.Add(new
                {
                    Pattern = routeEndpoint.RoutePattern.RawText,
                    DisplayName = endpoint.DisplayName,
                    Methods = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods
                });
            }
        }
    }
    return Results.Ok(routes);
});

// Report templates list endpoint (for DevExpress designer)
app.MapGet("/api/reports/templates", ([FromServices] ReportStorageWebExtension storage) =>
{
    var templates = storage.GetUrls();
    return Results.Ok(templates);
})
    .WithName("GetReportTemplates")
    .WithOpenApi();

// Report categories endpoint
app.MapGet("/api/reports/categories", async (ReportDbContext db) =>
{
    var categories = await db.ReportCategories
        .Where(c => c.IsActive)
        .OrderBy(c => c.SortOrder)
        .Select(c => new
        {
            c.Id,
            c.Name,
            c.Description,
            c.ParentId,
            c.SortOrder
        })
        .ToListAsync();
    return Results.Ok(categories);
})
    .WithName("GetReportCategories")
    .WithOpenApi();

app.Run();
