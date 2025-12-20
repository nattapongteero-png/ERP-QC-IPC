# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["ReportingBackend.csproj", "./"]
COPY ["NuGet.config", "./"]
RUN dotnet restore

# Copy source code and build
COPY . .
RUN dotnet build -c Release -o /app/build
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install dependencies:
# - wget: for health checks
# - libfontconfig1: required for Skia font rendering
# - libfreetype6: required for Skia font rendering
# - libx11-6: required for Skia graphics
RUN apt-get update && apt-get install -y \
    wget \
    libfontconfig1 \
    libfreetype6 \
    libx11-6 \
    && rm -rf /var/lib/apt/lists/*

# Copy published application
COPY --from=build /app/publish .

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000
# Set to Development for debugging, change to Production for deployment
ENV ASPNETCORE_ENVIRONMENT=Development

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget -qO- http://localhost:5000/health | grep -q "healthy" || exit 1

# Entry point
ENTRYPOINT ["dotnet", "ReportingBackend.dll"]
