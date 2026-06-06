using System.Text.RegularExpressions;

namespace TraceMatch.Services;

public static partial class TraceCodeCleaner
{
    public static string Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return InvalidWhitespace().Replace(value.Trim(), string.Empty);
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex InvalidWhitespace();
}
