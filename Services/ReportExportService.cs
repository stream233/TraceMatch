using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TraceMatch.Models;

namespace TraceMatch.Services;

public sealed class ReportExportService
{
    public ReportExportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public void ExportExcel(string path, AcceptanceOrder order, SummaryStats stats, IReadOnlyList<ComparisonResult> results)
    {
        using var workbook = new XLWorkbook();
        var summary = workbook.Worksheets.Add("汇总");
        summary.Cell(1, 1).Value = "验收单号";
        summary.Cell(1, 2).Value = order.OrderNumber;
        summary.Cell(2, 1).Value = "供应商";
        summary.Cell(2, 2).Value = order.Supplier;
        summary.Cell(3, 1).Value = "操作员";
        summary.Cell(3, 2).Value = order.Operator;
        summary.Cell(4, 1).Value = "创建时间";
        summary.Cell(4, 2).Value = order.CreatedAt;

        var statRows = new[]
        {
            ("应到数量", stats.ExpectedCount),
            ("扫描数量", stats.ScannedCount),
            ("匹配数量", stats.MatchedCount),
            ("未到货数量", stats.MissingCount),
            ("多到货数量", stats.ExtraCount),
            ("重复扫码数量", stats.DuplicateCount)
        };
        for (var i = 0; i < statRows.Length; i++)
        {
            summary.Cell(i + 6, 1).Value = statRows[i].Item1;
            summary.Cell(i + 6, 2).Value = statRows[i].Item2;
        }
        summary.Columns().AdjustToContents();

        var detail = workbook.Worksheets.Add("异常明细");
        var headers = new[] { "状态", "追溯码", "药品名称", "规格", "批号", "生产企业", "生产日期", "有效期", "数量", "扫描时间" };
        for (var i = 0; i < headers.Length; i++)
        {
            detail.Cell(1, i + 1).Value = headers[i];
        }

        var abnormal = results.Where(x => x.Status != TraceCodeStatus.Matched).ToList();
        for (var rowIndex = 0; rowIndex < abnormal.Count; rowIndex++)
        {
            var row = abnormal[rowIndex];
            detail.Cell(rowIndex + 2, 1).Value = row.StatusText;
            detail.Cell(rowIndex + 2, 2).Value = row.TraceCode;
            detail.Cell(rowIndex + 2, 3).Value = row.DrugName;
            detail.Cell(rowIndex + 2, 4).Value = row.Specification;
            detail.Cell(rowIndex + 2, 5).Value = row.BatchNumber;
            detail.Cell(rowIndex + 2, 6).Value = row.Manufacturer;
            detail.Cell(rowIndex + 2, 7).Value = row.ProductionDate;
            detail.Cell(rowIndex + 2, 8).Value = row.ExpiryDate;
            detail.Cell(rowIndex + 2, 9).Value = row.Quantity;
            detail.Cell(rowIndex + 2, 10).Value = row.ScannedAt?.ToString("yyyy-MM-dd HH:mm:ss");
        }
        detail.Columns().AdjustToContents();
        workbook.SaveAs(path);
    }

    public void ExportPdf(string path, AcceptanceOrder order, SummaryStats stats, IReadOnlyList<ComparisonResult> results)
    {
        var abnormal = results.Where(x => x.Status != TraceCodeStatus.Matched).Take(300).ToList();
        Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(36);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Microsoft YaHei"));
                page.Header().Column(column =>
                {
                    column.Item().Text("药品追溯码到货比对验收报告").FontSize(20).Bold();
                    column.Item().Text($"{order.OrderNumber} / {order.Supplier} / {order.Operator}");
                });

                page.Content().Column(column =>
                {
                    column.Spacing(14);
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });
                        AddStat(table, "应到", stats.ExpectedCount);
                        AddStat(table, "扫描", stats.ScannedCount);
                        AddStat(table, "匹配", stats.MatchedCount);
                        AddStat(table, "未到货", stats.MissingCount);
                        AddStat(table, "多到货", stats.ExtraCount);
                        AddStat(table, "重复", stats.DuplicateCount);
                    });

                    column.Item().Text("异常明细").FontSize(14).Bold();
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(55);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });
                        AddHeader(table, "状态");
                        AddHeader(table, "追溯码");
                        AddHeader(table, "药品名称");
                        AddHeader(table, "批号");
                        AddHeader(table, "生产日期");
                        AddHeader(table, "有效期");
                        AddHeader(table, "扫描时间");
                        foreach (var item in abnormal)
                        {
                            AddCell(table, item.StatusText);
                            AddCell(table, item.TraceCode);
                            AddCell(table, item.DrugName ?? "");
                            AddCell(table, item.BatchNumber ?? "");
                            AddCell(table, item.ProductionDate ?? "");
                            AddCell(table, item.ExpiryDate ?? "");
                            AddCell(table, item.ScannedAt?.ToString("yyyy-MM-dd HH:mm") ?? "");
                        }
                    });
                });

                page.Footer().AlignRight().Text(x =>
                {
                    x.Span("生成时间 ");
                    x.Span(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
                });
            });
        }).GeneratePdf(path);
    }

    private static void AddStat(TableDescriptor table, string label, int value)
    {
        table.Cell().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Text(label).SemiBold();
        table.Cell().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Text(value.ToString());
    }

    private static void AddHeader(TableDescriptor table, string value)
    {
        table.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text(value).Bold();
    }

    private static void AddCell(TableDescriptor table, string value)
    {
        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(5).Text(value);
    }
}
