using System.IO;
using System.Text;
using System.Xml.Linq;
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
            ".xml" => ReadXml(path),
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
                    ProductionDate = Value(row, mapping[ImportFields.ProductionDate]),
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
        var lines = ReadAllLines(path)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();
        if (lines.Count == 0)
        {
            return new ImportTable();
        }

        var delimiter = DetectDelimiter(lines[0]);
        if (TrimControlPrefix(lines[0]).StartsWith('$'))
        {
            return ReadMasSafeShipmentText(lines, delimiter);
        }

        var headers = SplitLine(lines[0], delimiter).Select(h => h.Trim()).ToList();
        var rows = RowsFromDelimitedLines(lines.Skip(1), headers, delimiter);
        return new ImportTable { Headers = headers, Rows = rows };
    }

    private static ImportTable ReadMasSafeShipmentText(IReadOnlyList<string> lines, char delimiter)
    {
        var metadata = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var firstLineValues = SplitLine(TrimControlPrefix(lines[0]).TrimStart('$'), delimiter)
            .Select(value => value.Trim())
            .ToList();
        if (firstLineValues.Count > 0)
        {
            metadata[ImportFields.Supplier] = firstLineValues[0];
        }
        if (firstLineValues.Count > 1)
        {
            metadata[ImportFields.PlatformOrderNumber] = firstLineValues[1];
        }

        var headers = new[]
        {
            ImportFields.TraceCode,
            ImportFields.DrugName,
            ImportFields.BatchNumber,
            ImportFields.ProductionDate
        };

        var rows = RowsFromDelimitedLines(
            lines.Where(line =>
            {
                var value = TrimControlPrefix(line);
                return !value.StartsWith('$') && !value.StartsWith('#');
            }),
            headers,
            delimiter);
        return new ImportTable { Headers = headers, Rows = rows, Metadata = metadata };
    }

    private static ImportTable ReadXml(string path)
    {
        var document = XDocument.Load(path);
        var headers = new[]
        {
            ImportFields.TraceCode,
            ImportFields.ScannedAt,
            "CorpOrderID",
            "Actor",
            "FromCorpID",
            "ToCorpID",
            "AssCorpID"
        };

        var rows = document
            .Descendants("Data")
            .Select(element => new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [ImportFields.TraceCode] = (string?)element.Attribute("Code") ?? string.Empty,
                [ImportFields.ScannedAt] = (string?)element.Attribute("ActDate") ?? string.Empty,
                ["CorpOrderID"] = (string?)element.Attribute("CorpOrderID") ?? string.Empty,
                ["Actor"] = (string?)element.Attribute("Actor") ?? string.Empty,
                ["FromCorpID"] = (string?)element.Attribute("FromCorpID") ?? string.Empty,
                ["ToCorpID"] = (string?)element.Attribute("ToCorpID") ?? string.Empty,
                ["AssCorpID"] = (string?)element.Attribute("AssCorpID") ?? string.Empty
            })
            .ToList();

        return new ImportTable { Headers = headers, Rows = rows };
    }

    private static IReadOnlyList<Dictionary<string, string>> RowsFromDelimitedLines(IEnumerable<string> lines, IReadOnlyList<string> headers, char delimiter)
    {
        var rows = new List<Dictionary<string, string>>();
        foreach (var line in lines)
        {
            var values = SplitLine(line, delimiter).ToList();
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < headers.Count; i++)
            {
                dict[headers[i]] = i < values.Count ? values[i].Trim().Trim('"') : string.Empty;
            }
            rows.Add(dict);
        }

        return rows;
    }

    private static IReadOnlyList<string> ReadAllLines(string path)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var bytes = File.ReadAllBytes(path);
        var utf8 = new UTF8Encoding(false, true);
        try
        {
            return SplitLines(utf8.GetString(bytes));
        }
        catch (DecoderFallbackException)
        {
            return SplitLines(Encoding.GetEncoding("GB18030").GetString(bytes));
        }
    }

    private static IReadOnlyList<string> SplitLines(string text)
    {
        return text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
    }

    private static char DetectDelimiter(string header)
    {
        var candidates = new[] { '\t', ',', ';', '|' };
        return candidates
            .Select(delimiter => new { delimiter, count = header.Count(c => c == delimiter) })
            .OrderByDescending(x => x.count)
            .First().delimiter;
    }

    private static string TrimControlPrefix(string value)
    {
        return value.TrimStart('\uFEFF').TrimStart();
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
    public const string TraceCode = "\u8ffd\u6eaf\u7801";
    public const string DrugName = "\u836f\u54c1\u540d\u79f0";
    public const string Specification = "\u89c4\u683c";
    public const string BatchNumber = "\u6279\u53f7";
    public const string Manufacturer = "\u751f\u4ea7\u4f01\u4e1a";
    public const string ProductionDate = "\u751f\u4ea7\u65e5\u671f";
    public const string ExpiryDate = "\u6709\u6548\u671f";
    public const string Quantity = "\u6570\u91cf";
    public const string ScannedAt = "\u626b\u63cf\u65f6\u95f4";
    public const string Supplier = "\u4f9b\u5e94\u5546";
    public const string PlatformOrderNumber = "\u5e73\u53f0\u5355\u53f7";
}
