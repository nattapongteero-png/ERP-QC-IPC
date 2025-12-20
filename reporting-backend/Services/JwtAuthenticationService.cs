using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ReportingBackend.Services;

/// <summary>
/// Service for validating JWT tokens from the Next.js frontend
/// </summary>
public class JwtAuthenticationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<JwtAuthenticationService> _logger;

    public JwtAuthenticationService(IConfiguration configuration, ILogger<JwtAuthenticationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Validate a JWT token and return the claims principal
    /// </summary>
    public ClaimsPrincipal? ValidateToken(string token)
    {
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("Empty token provided for validation");
            return null;
        }

        try
        {
            var secret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not configured");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = false, // Next.js doesn't set issuer by default
                ValidateAudience = false, // Next.js doesn't set audience by default
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwtToken)
            {
                _logger.LogWarning("Token is not a valid JWT");
                return null;
            }

            _logger.LogDebug("Token validated successfully for user {UserId}", GetUserId(principal));
            return principal;
        }
        catch (SecurityTokenExpiredException)
        {
            _logger.LogWarning("Token has expired");
            return null;
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "Token validation failed");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during token validation");
            return null;
        }
    }

    /// <summary>
    /// Get user ID from claims principal
    /// </summary>
    public int? GetUserId(ClaimsPrincipal? principal)
    {
        if (principal == null) return null;

        var userIdClaim = principal.FindFirst("userId")
            ?? principal.FindFirst(ClaimTypes.NameIdentifier)
            ?? principal.FindFirst("sub");

        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }

        return null;
    }

    /// <summary>
    /// Get user role from claims principal
    /// </summary>
    public string? GetUserRole(ClaimsPrincipal? principal)
    {
        if (principal == null) return null;

        var roleClaim = principal.FindFirst("role")
            ?? principal.FindFirst(ClaimTypes.Role);

        return roleClaim?.Value;
    }

    /// <summary>
    /// Get user email from claims principal
    /// </summary>
    public string? GetUserEmail(ClaimsPrincipal? principal)
    {
        if (principal == null) return null;

        var emailClaim = principal.FindFirst("email")
            ?? principal.FindFirst(ClaimTypes.Email);

        return emailClaim?.Value;
    }
}
