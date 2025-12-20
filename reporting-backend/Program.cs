using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using DevExpress.AspNetCore;
using DevExpress.AspNetCore.Reporting;
using DevExpress.XtraReports.Web.Extensions;
using ReportingBackend.Data;
using ReportingBackend.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers();

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

// Configure DevExpress Reporting services
builder.Services.AddDevExpressControls();
builder.Services.AddScoped<ReportStorageWebExtension, DatabaseReportStorage>();

// Configure DevExpress Reporting
builder.Services.ConfigureReportingServices(configurator =>
{
    configurator.ConfigureWebDocumentViewer(viewerConfigurator =>
    {
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
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Apply CORS policy
app.UseCors("AllowNextJS");

// Configure DevExpress middleware
app.UseDevExpressControls();

// Map controllers
app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
    .WithName("HealthCheck")
    .WithOpenApi();

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
