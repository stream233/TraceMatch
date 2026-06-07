namespace TraceMatch.Models;

public sealed class ReleaseInfo
{
    public string CurrentVersion { get; set; } = string.Empty;
    public string LatestVersion { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? Body { get; set; }
    public string? ReleasePageUrl { get; set; }
    public string? DownloadUrl { get; set; }
    public bool HasUpdate { get; set; }
}
