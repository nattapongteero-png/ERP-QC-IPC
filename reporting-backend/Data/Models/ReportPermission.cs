using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ReportingBackend.Data.Models;

[Table("report_permissions")]
public class ReportPermission
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("template_id")]
    public int TemplateId { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("role")]
    public string Role { get; set; } = string.Empty;

    [Column("can_view")]
    public bool CanView { get; set; } = true;

    [Column("can_design")]
    public bool CanDesign { get; set; } = false;

    [Column("can_export")]
    public bool CanExport { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual ReportTemplate Template { get; set; } = null!;
}
