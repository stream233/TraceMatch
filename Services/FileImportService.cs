using System.IO;
using System.Text;
using ClosedXML.Excel;
using ExcelDataReader;
using TraceMatch.Models;

namespace TraceMatch.Services;

public sealed class FileImportService
{
    public ImportTable ReadTable(string path)
    {
        var extension = Path.GetExtension(path).ToLowerInvariant();
        return extension switch
        {
            ".xlsx" or ".xlsm" => ReadOpenXmlExcel(path),
            ".xls" => ReadBinaryExcel(path),
            ".csv" or ".txt" => ReadText(path),
            _ => throw new NotSupportedException($"Unsupported file format: {extension}")
        };
    }

    public IReadOnlyList<ShipmentItem> ToShipmentItems(ImportTable table, FieldMapping mapping, long orderId)
    {
        return table.Rows
            .Select(row =>
            {
                var code = TraceCodeCleaner.Clean(Value(row, mapping[ImportFields.TraceCode]));
                if (string.IsNullOrWhiteSpace(code))
                {
                    return null;
                }

                return new ShipmentItem
                {
                    OrderId = orderId,
                    TraceCode = code,
                    DrugName = Value(row, mapping[ImportFields.DrugName]),
                    Specification = Value(row, mapping[ImportFields.Specification]),
                    BatchNumber = Value(row, mapping[ImportFields.BatchNumber]),
                    Manufacturer = Value(row, mapping[ImportFields.Manufacturer]),
                    ExpiryDate = Value(row, mapping[ImportFields.ExpiryDate]),
                    Quantity = decimal.TryParse(Value(row, mapping[ImportFields.Quantity]), out var quantity) ? quantity : 1
                };
            })
            .Where(item => item is not null)
            .Cast<ShipmentItem>()
            .ToList();
    }

    public IReadOnlyList<ScanRecord> ToScanRecords(ImportTable table, FieldMapping mapping, long orderId, string sourceFile)
    {
        return table.Rows
            .Select(row =>
            {
                var code = TraceCodeCleaner.Clean(Value(row, mapping[ImportFields.TraceCode]));
                if (string.IsNullOrWhiteSpace(code))
                {
                    return null;
                }

                return new ScanRecord
                {
                    OrderId = orderId,
                    TraceCode = code,
                    ScannedAt = DateTime.TryParse(Value(row, mapping[ImportFields.ScannedAt]), out var scannedAt) ? scannedAt : null,
                    SourceFile = Path.GetFileName(sourceFile)
                };
            })
            .Where(record => record is not null)
            .Cast<ScanRecord>()
            .ToList();
    }

    private static ImportTable ReadOpenXmlExcel(string path)
    {
        using var workbook = new XLWorkbook(path);
        var sheet = workbook.Worksheets.First();
        var usedRange = sheet.RangeUsed();
        if (usedRange is null)
        {
            return new ImportTable();
        }

        var headers = usedRange.FirstRow().Cells().Select(c => c.GetString().Trim()).ToList();
        var rows = new List<Dictionary<string, string>>();
        foreach (var row in usedRange.RowsUsed().Skip(1))
        {
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < headers.Count; i++)
            {
                dict[headers[i]] = row.Cell(i + 1).GetFormattedString().Trim();
            }
            rows.Add(dict);
        }

        return new ImportTable { Headers = headers, Rows = rows };
    }

    private static ImportTable ReadBinaryExcel(string path)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        using var stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var reader = ExcelReaderFactory.CreateReader(stream);
        var headers = new List<string>();
        var rows = new List<Dictionary<string, string>>();
        var rowIndex = 0;

        while (reader.Read())
        {
            var values = Enumerable.Range(0, reader.FieldCount)
                .Select(i => reader.GetValue(i)?.ToString()?.Trim() ?? string.Empty)
                .ToList();

            if (rowIndex == 0)
            {
                headers = values;
                rowIndex++;
                continue;
            }

            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < headers.Count; i++)
            {
                row[headers[i]] = i < values.Count ? values[i] : string.Empty;
            }
            rows.Add(row);
            rowIndex++;
        }

        return new ImportTable { Headers = headers, Rows = rows };
    }

    private static ImportTable ReadText(string path)
    {
        var lines = File.ReadLines(path)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();
        if (lines.Count == 0)
        {
            return new ImportTable();
        }

        var delimiter = DetectDelimiter(lines[0]);
        var headers = SplitLine(lines[0], delimiter).Select(h => h.Trim()).ToList();
        var rows = new List<Dictionary<string, string>>();
        foreach (var line in lines.Skip(1))
        {
            var values = SplitLine(line, delimiter).ToList();
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < headers.Count; i++)
            {
                dict[headers[i]] = i < values.Count ? values[i].Trim().Trim('"') : string.Empty;
            }
            rows.Add(dict);
        }

        return new ImportTable { Headers = headers, Rows = rows };
    }

    private static char DetectDelimiter(string header)
    {
        var candidates = new[] { '\t', ',', ';', '|' };
        return candidates
            .Select(delimiter => new { delimiter, count = header.Count(c => c == delimiter) })
            .OrderByDescending(x => x.count)
            .First().delimiter;
    }

    private static IEnumerable<string> SplitLine(string line, char delimiter)
    {
        var result = new List<string>();
        var current = new List<char>();
        var inQuotes = false;

        foreach (var ch in line)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }

            if (ch == delimiter && !inQuotes)
            {
                result.Add(new string(current.ToArray()));
                current.Clear();
                continue;
            }

            current.Add(ch);
        }

        result.Add(new string(current.ToArray()));
        return result;
    }

    private static string? Value(IReadOnlyDictionary<string, string> row, string? header)
    {
        if (string.IsNullOrWhiteSpace(header))
        {
            return null;
        }

        return row.TryGetValue(header, out var value) ? value : null;
    }
}

public static class ImportFields
{
    public const string TraceCode = "追溯码";
    public const string DrugName = "药品名称";
    public const string Specification = "规格";
    public const string BatchNumber = "批号";
    public const string Manufacturer = "生产企业";
    public const string ExpiryDate = "有效期";
    public const string Quantity = "数量";
    public const string ScannedAt = "扫描时间";
}
