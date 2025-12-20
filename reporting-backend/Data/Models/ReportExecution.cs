using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReportingBackend.Data.Models;

[Table("report_executions")]
public class ReportExecution
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("template_id")]
    public int TemplateId { get; set; }

    [Required]
    [Column("user_id")]
    public int UserId { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("action")]
    public string Action { get; set; } = string.Empty; // 'view', 'export', 'print'

    [Column("parameters")]
    public string? Parameters { get; set; }

    [MaxLength(20)]
    [Column("export_format")]
    public string? ExportFormat { get; set; }

    [Column("executed_at")]
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

    [Column("duration_ms")]
    public int? DurationMs { get; set; }

    [Required]
    [MaxLength(20)]
    [Column("status")]
    public string Status { get; set; } = string.Empty; // 'success', 'error', 'cancelled'

    [MaxLength(1000)]
    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    [MaxLength(45)]
    [Column("ip_address")]
    public string? IpAddress { get; set; }

    // Navigation properties
    public virtual ReportTemplate Template { get; set; } = null!;
}
