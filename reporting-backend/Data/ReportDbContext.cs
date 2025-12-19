using Microsoft.EntityFrameworkCore;
using ReportingBackend.Data.Models;

namespace ReportingBackend.Data;

public class ReportDbContext : DbContext
{
    public ReportDbContext(DbContextOptions<ReportDbContext> options) : base(options)
    {
    }

    public DbSet<ReportCategory> ReportCategories => Set<ReportCategory>();
    public DbSet<ReportTemplate> ReportTemplates => Set<ReportTemplate>();
    public DbSet<ReportPermission> ReportPermissions => Set<ReportPermission>();
    public DbSet<ReportExecution> ReportExecutions => Set<ReportExecution>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ReportCategory configuration
        modelBuilder.Entity<ReportCategory>(entity =>
        {
            entity.ToTable("report_categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(500);

            entity.HasOne(e => e.Parent)
                .WithMany(e => e.Children)
                .HasForeignKey(e => e.ParentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.ParentId);
            entity.HasIndex(e => e.IsActive);
        });

        // ReportTemplate configuration
        modelBuilder.Entity<ReportTemplate>(entity =>
        {
            entity.ToTable("report_templates");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Code).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Definition).HasColumnType("LONGTEXT").IsRequired();
            entity.Property(e => e.DataSourceConfig).HasColumnType("TEXT");
            entity.Property(e => e.ParametersSchema).HasColumnType("TEXT");
            entity.Property(e => e.Thumbnail).HasColumnType("MEDIUMTEXT");

            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.IsPublished);
            entity.HasIndex(e => e.CreatedBy);

            entity.HasOne(e => e.Category)
                .WithMany(e => e.Templates)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ReportPermission configuration
        modelBuilder.Entity<ReportPermission>(entity =>
        {
            entity.ToTable("report_permissions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Role).HasMaxLength(50).IsRequired();

            entity.HasIndex(e => e.TemplateId);
            entity.HasIndex(e => e.Role);
            entity.HasIndex(e => new { e.TemplateId, e.Role }).IsUnique();

            entity.HasOne(e => e.Template)
                .WithMany(e => e.Permissions)
                .HasForeignKey(e => e.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ReportExecution configuration
        modelBuilder.Entity<ReportExecution>(entity =>
        {
            entity.ToTable("report_executions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Action).HasMaxLength(20).IsRequired();
            entity.Property(e => e.ExportFormat).HasMaxLength(20);
            entity.Property(e => e.Status).HasMaxLength(20).IsRequired();
            entity.Property(e => e.ErrorMessage).HasMaxLength(1000);
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.Parameters).HasColumnType("TEXT");

            entity.HasIndex(e => e.TemplateId);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ExecutedAt);

            entity.HasOne(e => e.Template)
                .WithMany(e => e.Executions)
                .HasForeignKey(e => e.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
