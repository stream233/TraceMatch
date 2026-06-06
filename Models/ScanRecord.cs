namespace TraceMatch.Models;

public sealed class ScanRecord
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public string TraceCode { get; set; } = string.Empty;
    public DateTime? ScannedAt { get; set; }
    public string? SourceFile { get; set; }
}
