using DevExpress.DataAccess.ConnectionParameters;
using DevExpress.DataAccess.Web;

namespace ReportingBackend.Services;

/// <summary>
/// Provides connection strings for the DevExpress Report Designer data source wizard.
/// </summary>
public class CustomConnectionStringProvider : IDataSourceWizardConnectionStringsProvider
{
    private readonly IConfiguration _configuration;

    public CustomConnectionStringProvider(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public Dictionary<string, string> GetConnectionDescriptions()
    {
        // Return available connection strings for the designer
        return new Dictionary<string, string>
        {
            { "DefaultConnection", "MySQL Database (Herbal ERP)" }
        };
    }

    public DataConnectionParametersBase GetDataConnectionParameters(string name)
    {
        // Return the connection parameters for the specified connection name
        if (name == "DefaultConnection")
        {
            var connectionString = _configuration.GetConnectionString("DefaultConnection");
            return new MySqlConnectionParameters
            {
                ServerName = GetServerFromConnectionString(connectionString),
                DatabaseName = GetDatabaseFromConnectionString(connectionString),
                UserName = GetUserFromConnectionString(connectionString),
                Password = GetPasswordFromConnectionString(connectionString)
            };
        }

        throw new ArgumentException($"Unknown connection name: {name}");
    }

    private static string GetServerFromConnectionString(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "localhost";
        var parts = connectionString.Split(';');
        foreach (var part in parts)
        {
            var keyValue = part.Split('=');
            if (keyValue.Length == 2 && keyValue[0].Trim().Equals("Server", StringComparison.OrdinalIgnoreCase))
            {
                return keyValue[1].Trim();
            }
        }
        return "localhost";
    }

    private static string GetDatabaseFromConnectionString(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "";
        var parts = connectionString.Split(';');
        foreach (var part in parts)
        {
            var keyValue = part.Split('=');
            if (keyValue.Length == 2 && keyValue[0].Trim().Equals("Database", StringComparison.OrdinalIgnoreCase))
            {
                return keyValue[1].Trim();
            }
        }
        return "";
    }

    private static string GetUserFromConnectionString(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "";
        var parts = connectionString.Split(';');
        foreach (var part in parts)
        {
            var keyValue = part.Split('=');
            if (keyValue.Length == 2 &&
                (keyValue[0].Trim().Equals("User", StringComparison.OrdinalIgnoreCase) ||
                 keyValue[0].Trim().Equals("Uid", StringComparison.OrdinalIgnoreCase)))
            {
                return keyValue[1].Trim();
            }
        }
        return "";
    }

    private static string GetPasswordFromConnectionString(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString)) return "";
        var parts = connectionString.Split(';');
        foreach (var part in parts)
        {
            var keyValue = part.Split('=');
            if (keyValue.Length == 2 &&
                (keyValue[0].Trim().Equals("Password", StringComparison.OrdinalIgnoreCase) ||
                 keyValue[0].Trim().Equals("Pwd", StringComparison.OrdinalIgnoreCase)))
            {
                return keyValue[1].Trim();
            }
        }
        return "";
    }
}
