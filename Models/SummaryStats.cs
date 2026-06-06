namespace TraceMatch.Models;

public sealed class SummaryStats
{
    public int ExpectedCount { get; set; }
    public int ScannedCount { get; set; }
    public int MatchedCount { get; set; }
    public int MissingCount { get; set; }
    public int ExtraCount { get; set; }
    public int DuplicateCount { get; set; }
}
