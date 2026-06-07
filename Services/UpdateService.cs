using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using TraceMatch.Models;

namespace TraceMatch.Services;

public sealed class UpdateService
{
    private const string LatestReleaseUrl = "https://api.github.com/repos/stream233/TraceMatch/releases/latest";
    private static readonly Uri LatestReleaseUri = new(LatestReleaseUrl);
    private readonly HttpClient _httpClient;

    public UpdateService()
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("TraceMatch-Updater");
        _httpClient.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
    }

    public async Task<ReleaseInfo> CheckLatestAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync(LatestReleaseUri, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var dto = await JsonSerializer.DeserializeAsync<GitHubReleaseDto>(stream, cancellationToken: cancellationToken)
            ?? new GitHubReleaseDto();

        var currentVersion = GetCurrentVersion();
        var latestVersion = dto.TagName ?? string.Empty;
        var releasePageUrl = dto.HtmlUrl ?? "https://github.com/stream233/TraceMatch/releases/latest";

        return new ReleaseInfo
        {
            CurrentVersion = currentVersion,
            LatestVersion = latestVersion,
            Name = dto.Name,
            Body = dto.Body,
            ReleasePageUrl = releasePageUrl,
            DownloadUrl = SelectDownloadUrl(dto, releasePageUrl),
            HasUpdate = IsRemoteVersionNewer(latestVersion, currentVersion)
        };
    }

    public string GetCurrentVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var informationalVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            return informationalVersion.Split('+')[0].Trim();
        }

        var version = assembly.GetName().Version;
        return version is null
            ? "0.0.0"
            : $"{version.Major}.{version.Minor}.{Math.Max(version.Build, 0)}";
    }

    public static bool IsRemoteVersionNewer(string? remoteVersion, string? localVersion)
    {
        if (!TryParseVersion(remoteVersion, out var remote) || !TryParseVersion(localVersion, out var local))
        {
            return false;
        }

        return remote.CompareTo(local) > 0;
    }

    public static string? SelectDownloadUrl(GitHubReleaseDto release, string releasePageUrl)
    {
        var exactSetup = release.Assets.FirstOrDefault(asset =>
            string.Equals(asset.Name, "TraceMatchSetup.exe", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(asset.BrowserDownloadUrl));
        if (exactSetup is not null)
        {
            return exactSetup.BrowserDownloadUrl;
        }

        var firstExe = release.Assets.FirstOrDefault(asset =>
            asset.Name?.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) == true &&
            !string.IsNullOrWhiteSpace(asset.BrowserDownloadUrl));

        return firstExe?.BrowserDownloadUrl ?? releasePageUrl;
    }

    public static void OpenUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static bool TryParseVersion(string? value, out Version version)
    {
        version = new Version(0, 0, 0);
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalized = value.Trim();
        if (normalized.StartsWith('v') || normalized.StartsWith('V'))
        {
            normalized = normalized[1..];
        }

        var suffixIndex = normalized.IndexOfAny(new[] { '-', '+' });
        if (suffixIndex >= 0)
        {
            normalized = normalized[..suffixIndex];
        }

        return Version.TryParse(normalized, out version!);
    }
}
