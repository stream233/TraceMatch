namespace TraceMatch.Models;

public sealed class ImportTable
{
    public IReadOnlyList<string> Headers { get; init; } = Array.Empty<string>();
    public IReadOnlyList<Dictionary<string, string>> Rows { get; init; } = Array.Empty<Dictionary<string, string>>();
    public IReadOnlyDictionary<string, string> Metadata { get; init; } = new Dictionary<string, string>();
}

public sealed class FieldMapping
{
    public Dictionary<string, string?> Columns { get; } = new(StringComparer.OrdinalIgnoreCase);

    public string? this[string targetField]
    {
        get => Columns.TryGetValue(targetField, out var value) ? value : null;
        set => Columns[targetField] = value;
    }
}
