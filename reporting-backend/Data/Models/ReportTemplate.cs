using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReportingBackend.Data.Models;

[Table("report_templates")]
public class ReportTemplate
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Column("category_id")]
    public int? CategoryId { get; set; }

    [Required]
    [Column("definition")]
    public string Definition { get; set; } = string.Empty;

    [Column("data_source_config")]
    public string? DataSourceConfig { get; set; }

    [Column("parameters_schema")]
    public string? ParametersSchema { get; set; }

    [Column("version")]
    public int Version { get; set; } = 1;

    [Column("is_published")]
    public bool IsPublished { get; set; } = false;

    [Column("is_system")]
    public bool IsSystem { get; set; } = false;

    [Column("thumbnail")]
    public string? Thumbnail { get; set; }

    [Required]
    [Column("created_by")]
    public int CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_by")]
    public int? UpdatedBy { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ReportCategory? Category { get; set; }
    public virtual ICollection<ReportPermission> Permissions { get; set; } = new List<ReportPermission>();
    public virtual ICollection<ReportExecution> Executions { get; set; } = new List<ReportExecution>();
}
