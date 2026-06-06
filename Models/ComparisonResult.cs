namespace TraceMatch.Models;

public sealed class ComparisonResult
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public string TraceCode { get; set; } = string.Empty;
    public string? DrugName { get; set; }
    public string? Specification { get; set; }
    public string? BatchNumber { get; set; }
    public string? Manufacturer { get; set; }
    public string? ExpiryDate { get; set; }
    public decimal Quantity { get; set; }
    public DateTime? ScannedAt { get; set; }
    public TraceCodeStatus Status { get; set; }
    public string StatusText => Status switch
    {
        TraceCodeStatus.Matched => "匹配",
        TraceCodeStatus.Missing => "未到货",
        TraceCodeStatus.Extra => "多到货",
        TraceCodeStatus.Duplicate => "重复扫码",
        _ => "未知"
    };
}
