using System.Collections.ObjectModel;
using System.Windows;
using Microsoft.Win32;
using TraceMatch.Data;
using TraceMatch.Models;
using TraceMatch.Services;
using TraceMatch.Views;

namespace TraceMatch.ViewModels;

public sealed class MainViewModel : ViewModelBase
{
    private readonly AppDatabase _database;
    private readonly AcceptanceRepository _repository;
    private readonly FileImportService _importService;
    private readonly ComparisonService _comparisonService;
    private readonly ReportExportService _reportExportService;
    private AcceptanceOrder? _currentOrder;
    private SummaryStats _stats = new();
    private string _orderNumber = $"YS{DateTime.Now:yyyyMMddHHmm}";
    private string _supplier = string.Empty;
    private string _operator = Environment.UserName;
    private string _remark = string.Empty;
    private string _statusMessage = "先新建验收单，然后导入平台发货数据和扫码文件。";

    public MainViewModel(AppDatabase database, AcceptanceRepository repository, FileImportService importService, ComparisonService comparisonService, ReportExportService reportExportService)
    {
        _database = database;
        _repository = repository;
        _importService = importService;
        _comparisonService = comparisonService;
        _reportExportService = reportExportService;

        Orders = new ObservableCollection<AcceptanceOrder>();
        Results = new ObservableCollection<ComparisonResult>();
        CreateOrderCommand = new AsyncRelayCommand(CreateOrderAsync);
        ImportShipmentCommand = new AsyncRelayCommand(ImportShipmentAsync, () => CurrentOrder is not null);
        ImportScanCommand = new AsyncRelayCommand(ImportScanAsync, () => CurrentOrder is not null);
        CompareCommand = new AsyncRelayCommand(CompareAsync, () => CurrentOrder is not null);
        ExportExcelCommand = new RelayCommand(ExportExcel, () => CurrentOrder is not null && Results.Count > 0);
        ExportPdfCommand = new RelayCommand(ExportPdf, () => CurrentOrder is not null && Results.Count > 0);
        LoadCommand = new AsyncRelayCommand(LoadAsync);
    }

    public ObservableCollection<AcceptanceOrder> Orders { get; }
    public ObservableCollection<ComparisonResult> Results { get; }
    public AsyncRelayCommand CreateOrderCommand { get; }
    public AsyncRelayCommand ImportShipmentCommand { get; }
    public AsyncRelayCommand ImportScanCommand { get; }
    public AsyncRelayCommand CompareCommand { get; }
    public RelayCommand ExportExcelCommand { get; }
    public RelayCommand ExportPdfCommand { get; }
    public AsyncRelayCommand LoadCommand { get; }

    public AcceptanceOrder? CurrentOrder
    {
        get => _currentOrder;
        set
        {
            if (SetProperty(ref _currentOrder, value))
            {
                RefreshCommandState();
                _ = LoadOrderResultsAsync();
            }
        }
    }

    public SummaryStats Stats
    {
        get => _stats;
        set => SetProperty(ref _stats, value);
    }

    public string OrderNumber
    {
        get => _orderNumber;
        set => SetProperty(ref _orderNumber, value);
    }

    public string Supplier
    {
        get => _supplier;
        set => SetProperty(ref _supplier, value);
    }

    public string Operator
    {
        get => _operator;
        set => SetProperty(ref _operator, value);
    }

    public string Remark
    {
        get => _remark;
        set => SetProperty(ref _remark, value);
    }

    public string StatusMessage
    {
        get => _statusMessage;
        set => SetProperty(ref _statusMessage, value);
    }

    public async Task LoadAsync()
    {
        await _database.InitializeAsync();
        Orders.Clear();
        foreach (var order in await _repository.GetRecentOrdersAsync())
        {
            Orders.Add(order);
        }

        CurrentOrder ??= Orders.FirstOrDefault();
    }

    private async Task CreateOrderAsync()
    {
        if (string.IsNullOrWhiteSpace(OrderNumber) || string.IsNullOrWhiteSpace(Supplier) || string.IsNullOrWhiteSpace(Operator))
        {
            MessageBox.Show("验收单号、供应商、操作员不能为空。", "新建验收单", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var order = await _repository.CreateOrderAsync(new AcceptanceOrder
        {
            OrderNumber = OrderNumber.Trim(),
            Supplier = Supplier.Trim(),
            Operator = Operator.Trim(),
            CreatedAt = DateTime.Now,
            Remark = Remark.Trim()
        });

        Orders.Insert(0, order);
        CurrentOrder = order;
        OrderNumber = $"YS{DateTime.Now:yyyyMMddHHmm}";
        Remark = string.Empty;
        StatusMessage = "验收单已创建，可以导入发货数据。";
    }

    private async Task ImportShipmentAsync()
    {
        var path = PickImportFile();
        if (path is null || CurrentOrder is null)
        {
            return;
        }

        var table = _importService.ReadTable(path);
        var mapping = ShowMapping(table, new[]
        {
            ImportFields.TraceCode,
            ImportFields.DrugName,
            ImportFields.Specification,
            ImportFields.BatchNumber,
            ImportFields.Manufacturer,
            ImportFields.ExpiryDate,
            ImportFields.Quantity
        });
        if (mapping is null)
        {
            return;
        }

        var items = _importService.ToShipmentItems(table, mapping, CurrentOrder.Id);
        await _repository.ReplaceShipmentItemsAsync(CurrentOrder.Id, items);
        Results.Clear();
        Stats = new SummaryStats { ExpectedCount = items.Select(x => x.TraceCode).Distinct(StringComparer.OrdinalIgnoreCase).Count() };
        StatusMessage = $"已导入平台发货数据 {items.Count} 行。";
    }

    private async Task ImportScanAsync()
    {
        var path = PickImportFile();
        if (path is null || CurrentOrder is null)
        {
            return;
        }

        var table = _importService.ReadTable(path);
        var mapping = ShowMapping(table, new[] { ImportFields.TraceCode, ImportFields.ScannedAt });
        if (mapping is null)
        {
            return;
        }

        var scans = _importService.ToScanRecords(table, mapping, CurrentOrder.Id, path);
        await _repository.ReplaceScanRecordsAsync(CurrentOrder.Id, scans);
        StatusMessage = $"已导入扫描记录 {scans.Count} 行，正在比对。";
        await CompareAsync();
    }

    private async Task CompareAsync()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        var shipments = await _repository.GetShipmentItemsAsync(CurrentOrder.Id);
        var scans = await _repository.GetScanRecordsAsync(CurrentOrder.Id);
        var (results, stats) = _comparisonService.Compare(shipments, scans);
        await _repository.SaveComparisonResultsAsync(CurrentOrder.Id, results);
        ReplaceResults(results);
        Stats = stats;
        StatusMessage = $"比对完成：匹配 {stats.MatchedCount}，未到货 {stats.MissingCount}，多到货 {stats.ExtraCount}，重复扫码 {stats.DuplicateCount}。";
        RefreshCommandState();
    }

    private async Task LoadOrderResultsAsync()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        var results = await _repository.GetComparisonResultsAsync(CurrentOrder.Id);
        ReplaceResults(results);
        Stats = new SummaryStats
        {
            ExpectedCount = results.Count(x => x.Status is TraceCodeStatus.Matched or TraceCodeStatus.Missing or TraceCodeStatus.Duplicate),
            ScannedCount = results.Count(x => x.Status is TraceCodeStatus.Matched or TraceCodeStatus.Extra or TraceCodeStatus.Duplicate),
            MatchedCount = results.Count(x => x.Status == TraceCodeStatus.Matched),
            MissingCount = results.Count(x => x.Status == TraceCodeStatus.Missing),
            ExtraCount = results.Count(x => x.Status == TraceCodeStatus.Extra),
            DuplicateCount = results.Count(x => x.Status == TraceCodeStatus.Duplicate)
        };
        StatusMessage = $"当前验收单：{CurrentOrder.OrderNumber}";
    }

    private void ExportExcel()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        var dialog = new SaveFileDialog
        {
            Filter = "Excel 报告|*.xlsx",
            FileName = $"{CurrentOrder.OrderNumber}-验收报告.xlsx"
        };
        if (dialog.ShowDialog() == true)
        {
            _reportExportService.ExportExcel(dialog.FileName, CurrentOrder, Stats, Results.ToList());
            StatusMessage = $"Excel 报告已导出：{dialog.FileName}";
        }
    }

    private void ExportPdf()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        var dialog = new SaveFileDialog
        {
            Filter = "PDF 报告|*.pdf",
            FileName = $"{CurrentOrder.OrderNumber}-验收报告.pdf"
        };
        if (dialog.ShowDialog() == true)
        {
            _reportExportService.ExportPdf(dialog.FileName, CurrentOrder, Stats, Results.ToList());
            StatusMessage = $"PDF 报告已导出：{dialog.FileName}";
        }
    }

    private static string? PickImportFile()
    {
        var dialog = new OpenFileDialog
        {
            Filter = "导入文件|*.csv;*.txt;*.xlsx;*.xlsm;*.xls;*.xml|CSV|*.csv|文本|*.txt|Excel|*.xlsx;*.xlsm;*.xls|XML|*.xml",
            Multiselect = false
        };
        return dialog.ShowDialog() == true ? dialog.FileName : null;
    }

    private static FieldMapping? ShowMapping(ImportTable table, IReadOnlyList<string> targetFields)
    {
        if (table.Headers.Count == 0)
        {
            MessageBox.Show("文件没有可识别的表头。", "字段映射", MessageBoxButton.OK, MessageBoxImage.Warning);
            return null;
        }

        var window = new FieldMappingWindow(table.Headers, targetFields);
        return window.ShowDialog() == true ? window.Mapping : null;
    }

    private void ReplaceResults(IEnumerable<ComparisonResult> results)
    {
        Results.Clear();
        foreach (var result in results)
        {
            Results.Add(result);
        }
        RefreshCommandState();
    }

    private void RefreshCommandState()
    {
        ImportShipmentCommand.RaiseCanExecuteChanged();
        ImportScanCommand.RaiseCanExecuteChanged();
        CompareCommand.RaiseCanExecuteChanged();
        ExportExcelCommand.RaiseCanExecuteChanged();
        ExportPdfCommand.RaiseCanExecuteChanged();
    }
}
