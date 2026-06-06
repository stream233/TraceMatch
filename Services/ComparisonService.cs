using TraceMatch.Models;

namespace TraceMatch.Services;

public sealed class ComparisonService
{
    public (IReadOnlyList<ComparisonResult> Results, SummaryStats Stats) Compare(
        IReadOnlyList<ShipmentItem> shipments,
        IReadOnlyList<ScanRecord> scans)
    {
        var shipmentByCode = shipments
            .GroupBy(x => x.TraceCode)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var scansByCode = scans
            .GroupBy(x => x.TraceCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        var results = new List<ComparisonResult>();
        foreach (var scan in scans.OrderByDescending(x => x.ScannedAt ?? DateTime.MinValue))
        {
            var duplicate = scansByCode[scan.TraceCode].Count > 1;
            if (duplicate)
            {
                results.Add(ToResult(scan, shipmentByCode.GetValueOrDefault(scan.TraceCode), TraceCodeStatus.Duplicate));
                continue;
            }

            results.Add(shipmentByCode.TryGetValue(scan.TraceCode, out var shipment)
                ? ToResult(scan, shipment, TraceCodeStatus.Matched)
                : ToResult(scan, null, TraceCodeStatus.Extra));
        }

        foreach (var shipment in shipments.Where(x => !scansByCode.ContainsKey(x.TraceCode)))
        {
            results.Add(new ComparisonResult
            {
                OrderId = shipment.OrderId,
                TraceCode = shipment.TraceCode,
                DrugName = shipment.DrugName,
                Specification = shipment.Specification,
                BatchNumber = shipment.BatchNumber,
                Manufacturer = shipment.Manufacturer,
                ExpiryDate = shipment.ExpiryDate,
                Quantity = shipment.Quantity,
                Status = TraceCodeStatus.Missing
            });
        }

        var stats = new SummaryStats
        {
            ExpectedCount = shipmentByCode.Count,
            ScannedCount = scans.Count,
            MatchedCount = results.Count(x => x.Status == TraceCodeStatus.Matched),
            MissingCount = results.Count(x => x.Status == TraceCodeStatus.Missing),
            ExtraCount = results.Count(x => x.Status == TraceCodeStatus.Extra),
            DuplicateCount = results.Count(x => x.Status == TraceCodeStatus.Duplicate)
        };

        return (results, stats);
    }

    private static ComparisonResult ToResult(ScanRecord scan, ShipmentItem? shipment, TraceCodeStatus status)
    {
        return new ComparisonResult
        {
            OrderId = scan.OrderId,
            TraceCode = scan.TraceCode,
            DrugName = shipment?.DrugName,
            Specification = shipment?.Specification,
            BatchNumber = shipment?.BatchNumber,
            Manufacturer = shipment?.Manufacturer,
            ExpiryDate = shipment?.ExpiryDate,
            Quantity = shipment?.Quantity ?? 0,
            ScannedAt = scan.ScannedAt,
            Status = status
        };
    }
}
