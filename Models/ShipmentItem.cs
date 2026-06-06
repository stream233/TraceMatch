namespace TraceMatch.Models;

public sealed class ShipmentItem
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public string TraceCode { get; set; } = string.Empty;
    public string? DrugName { get; set; }
    public string? Specification { get; set; }
    public string? BatchNumber { get; set; }
    public string? Manufacturer { get; set; }
    public string? ProductionDate { get; set; }
    public string? ExpiryDate { get; set; }
    public decimal Quantity { get; set; } = 1;
}
