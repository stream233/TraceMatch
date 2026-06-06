namespace TraceMatch.Models;

public sealed class AcceptanceOrder
{
    public long Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string Supplier { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string? Remark { get; set; }
    public string? DrugInfo { get; set; }

    public string DisplayName
    {
        get
        {
            var parts = new[] { OrderNumber, Supplier, DrugInfo }
                .Where(value => !string.IsNullOrWhiteSpace(value));
            return string.Join(" / ", parts);
        }
    }
}
