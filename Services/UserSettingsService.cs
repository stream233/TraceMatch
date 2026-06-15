using System.IO;
using System.Text.Json;

namespace TraceMatch.Services;

public sealed class UserSettingsService
{
    private readonly string _settingsPath;
    private UserSettings _settings;

    public UserSettingsService()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TraceMatch");
        Directory.CreateDirectory(dir);
        _settingsPath = Path.Combine(dir, "settings.json");
        _settings = LoadSettings();
    }

    public string? LastShipmentImportDirectory
    {
        get => GetValidDirectory(_settings.LastShipmentImportDirectory) ?? GetValidDirectory(_settings.LastImportDirectory);
        set
        {
            if (string.IsNullOrWhiteSpace(value) || !Directory.Exists(value))
            {
                return;
            }

            _settings.LastShipmentImportDirectory = value;
            SaveSettings();
        }
    }

    public string? LastScanImportDirectory
    {
        get => GetValidDirectory(_settings.LastScanImportDirectory) ?? GetValidDirectory(_settings.LastImportDirectory);
        set
        {
            if (string.IsNullOrWhiteSpace(value) || !Directory.Exists(value))
            {
                return;
            }

            _settings.LastScanImportDirectory = value;
            SaveSettings();
        }
    }

    private UserSettings LoadSettings()
    {
        if (!File.Exists(_settingsPath))
        {
            return new UserSettings();
        }

        try
        {
            var json = File.ReadAllText(_settingsPath);
            return JsonSerializer.Deserialize<UserSettings>(json) ?? new UserSettings();
        }
        catch
        {
            return new UserSettings();
        }
    }

    private void SaveSettings()
    {
        var json = JsonSerializer.Serialize(_settings, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_settingsPath, json);
    }

    private static string? GetValidDirectory(string? directory)
    {
        return Directory.Exists(directory) ? directory : null;
    }

    private sealed class UserSettings
    {
        public string? LastImportDirectory { get; set; }
        public string? LastShipmentImportDirectory { get; set; }
        public string? LastScanImportDirectory { get; set; }
    }
}
