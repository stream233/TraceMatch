using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using Microsoft.Data.Sqlite;
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
    private readonly UserSettingsService _userSettingsService;
    private readonly UpdateService _updateService;
    private AcceptanceOrder? _currentOrder;
    private IReadOnlyList<ShipmentItem>? _pendingShipments;
    private IReadOnlyList<ScanRecord>? _pendingScans;
    private IReadOnlyList<ComparisonResult>? _pendingResults;
    private string? _pendingSupplier;
    private bool _hasUnsavedRecords;
    private readonly HashSet<long> _unsavedOrderIds = new();
    private SummaryStats _stats = new();
    private string _orderNumber = GenerateOrderNumber();
    private string _supplier = string.Empty;
    private string _operator = "\u6d2a\u91d1\u4e3d";
    private string _remark = string.Empty;
    private string _statusMessage = "先新建验收单，然后导入平台发货数据和扫码文件。";

    public MainViewModel(AppDatabase database, AcceptanceRepository repository, FileImportService importService, ComparisonService comparisonService, ReportExportService reportExportService, UserSettingsService userSettingsService, UpdateService updateService)
    {
        _database = database;
        _repository = repository;
        _importService = importService;
        _comparisonService = comparisonService;
        _reportExportService = reportExportService;
        _userSettingsService = userSettingsService;
        _updateService = updateService;

        Orders = new ObservableCollection<AcceptanceOrder>();
        Results = new ObservableCollection<ComparisonResult>();
        CreateOrderCommand = new AsyncRelayCommand(CreateOrderAsync);
        DeleteOrderCommand = new AsyncRelayCommand(DeleteOrderAsync, () => CurrentOrder is not null);
        ImportShipmentCommand = new AsyncRelayCommand(ImportShipmentAsync, () => CurrentOrder is not null);
        ImportScanCommand = new AsyncRelayCommand(ImportScanAsync, () => CurrentOrder is not null);
        CompareCommand = new AsyncRelayCommand(CompareAsync, () => CurrentOrder is not null);
        SaveRecordsCommand = new AsyncRelayCommand(SaveRecordsAsync, () => CurrentOrder is not null && _hasUnsavedRecords);
        ExportExcelCommand = new RelayCommand(ExportExcel, () => CurrentOrder is not null && Results.Count > 0);
        ExportPdfCommand = new RelayCommand(ExportPdf, () => CurrentOrder is not null && Results.Count > 0);
        LoadCommand = new AsyncRelayCommand(LoadAsync);
        ShowAboutCommand = new RelayCommand(ShowAbout);
    }

    public ObservableCollection<AcceptanceOrder> Orders { get; }
    public ObservableCollection<ComparisonResult> Results { get; }
    public AsyncRelayCommand CreateOrderCommand { get; }
    public AsyncRelayCommand DeleteOrderCommand { get; }
    public AsyncRelayCommand ImportShipmentCommand { get; }
    public AsyncRelayCommand ImportScanCommand { get; }
    public AsyncRelayCommand CompareCommand { get; }
    public AsyncRelayCommand SaveRecordsCommand { get; }
    public RelayCommand ExportExcelCommand { get; }
    public RelayCommand ExportPdfCommand { get; }
    public AsyncRelayCommand LoadCommand { get; }
    public RelayCommand ShowAboutCommand { get; }

    public AcceptanceOrder? CurrentOrder
    {
        get => _currentOrder;
        set
        {
            if (SetProperty(ref _currentOrder, value))
            {
                RefreshCommandState();
                if (value is null)
                {
                    ClearPendingRecords();
                    ClearResultState();
                }
                else
                {
                    ClearPendingRecords();
                    LoadOrderFields(value);
                    _ = LoadOrderResultsAsync();
                }
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
        await ReloadOrdersAsync();
        CurrentOrder = null;
        ClearResultState();
        _ = CheckUpdateOnStartupAsync();
    }

    private async Task CreateOrderAsync()
    {
        await DiscardCurrentUnsavedOrderAsync();

        if (string.IsNullOrWhiteSpace(OrderNumber) || string.IsNullOrWhiteSpace(Operator))
        {
            MessageBox.Show("验收单号、操作员不能为空。", "新建验收单", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var orderNumber = OrderNumber.Trim();
        if (Orders.Any(x => string.Equals(x.OrderNumber, orderNumber, StringComparison.OrdinalIgnoreCase)))
        {
            orderNumber = GenerateOrderNumber();
            OrderNumber = orderNumber;
        }

        AcceptanceOrder order;
        try
        {
            order = await _repository.CreateOrderAsync(new AcceptanceOrder
            {
                OrderNumber = orderNumber,
                Supplier = Supplier.Trim(),
                Operator = Operator.Trim(),
                CreatedAt = DateTime.Now,
                Remark = Remark.Trim()
            });
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == 19)
        {
            OrderNumber = GenerateOrderNumber();
            MessageBox.Show("\u9a8c\u6536\u5355\u53f7\u5df2\u5b58\u5728\uff0c\u5df2\u4e3a\u4f60\u91cd\u65b0\u751f\u6210\u65b0\u5355\u53f7\uff0c\u8bf7\u518d\u70b9\u51fb\u65b0\u5efa\u9a8c\u6536\u5355\u3002", "\u65b0\u5efa\u9a8c\u6536\u5355", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        Orders.Insert(0, order);
        _unsavedOrderIds.Add(order.Id);
        CurrentOrder = order;
        OrderNumber = GenerateOrderNumber();
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
            ImportFields.ProductionDate,
            ImportFields.ExpiryDate,
            ImportFields.Quantity
        });
        if (mapping is null)
        {
            return;
        }

        var items = _importService.ToShipmentItems(table, mapping, CurrentOrder.Id);
        _pendingShipments = items;
        if (table.Metadata.TryGetValue(ImportFields.Supplier, out var importedSupplier) && !string.IsNullOrWhiteSpace(importedSupplier))
        {
            _pendingSupplier = importedSupplier.Trim();
            CurrentOrder.Supplier = _pendingSupplier;
            Supplier = _pendingSupplier;
        }
        Results.Clear();
        Stats = new SummaryStats { ExpectedCount = items.Select(x => x.TraceCode).Distinct(StringComparer.OrdinalIgnoreCase).Count() };
        SetUnsavedRecords(true);
        StatusMessage = $"已导入平台发货数据 {items.Count} 行。";
    }

    private async Task DeleteOrderAsync()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        var order = CurrentOrder;
        var result = MessageBox.Show(
            $"\u786e\u5b9a\u5220\u9664\u9a8c\u6536\u5355 {order.OrderNumber} \u5417\uff1f\u8be5\u64cd\u4f5c\u4f1a\u540c\u65f6\u5220\u9664\u53d1\u8d27\u6570\u636e\u3001\u626b\u7801\u8bb0\u5f55\u548c\u6bd4\u5bf9\u7ed3\u679c\u3002",
            "\u5220\u9664\u9a8c\u6536\u5355",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        await _repository.DeleteOrderAsync(order.Id);
        _unsavedOrderIds.Remove(order.Id);
        Orders.Remove(order);
        CurrentOrder = null;
        StatusMessage = "\u9a8c\u6536\u5355\u5df2\u5220\u9664\u3002";
    }

    private async Task DiscardCurrentUnsavedOrderAsync()
    {
        if (CurrentOrder is null || !_unsavedOrderIds.Contains(CurrentOrder.Id))
        {
            ClearPendingRecords();
            return;
        }

        var order = CurrentOrder;
        await _repository.DeleteOrderAsync(order.Id);
        _unsavedOrderIds.Remove(order.Id);
        Orders.Remove(order);
        CurrentOrder = null;
        ClearPendingRecords();
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
        _pendingScans = scans;
        SetUnsavedRecords(true);
        StatusMessage = $"已导入扫描记录 {scans.Count} 行，正在比对。";
        await CompareAsync();
    }

    private async Task CompareAsync()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        var shipments = _pendingShipments ?? await _repository.GetShipmentItemsAsync(CurrentOrder.Id);
        var scans = _pendingScans ?? await _repository.GetScanRecordsAsync(CurrentOrder.Id);
        var (results, stats) = _comparisonService.Compare(shipments, scans);
        _pendingResults = results;
        SetUnsavedRecords(_pendingShipments is not null || _pendingScans is not null);
        ReplaceResults(results);
        Stats = stats;
        StatusMessage = $"比对完成：匹配 {stats.MatchedCount}，未到货 {stats.MissingCount}，多到货 {stats.ExtraCount}，重复扫码 {stats.DuplicateCount}。";
        RefreshCommandState();
    }

    private async Task SaveRecordsAsync()
    {
        if (CurrentOrder is null)
        {
            return;
        }

        if (_pendingShipments is not null)
        {
            await _repository.ReplaceShipmentItemsAsync(CurrentOrder.Id, _pendingShipments);
        }

        if (_pendingScans is not null)
        {
            await _repository.ReplaceScanRecordsAsync(CurrentOrder.Id, _pendingScans);
        }

        if (_pendingResults is not null)
        {
            await _repository.SaveComparisonResultsAsync(CurrentOrder.Id, _pendingResults);
        }

        if (!string.IsNullOrWhiteSpace(_pendingSupplier))
        {
            await _repository.UpdateOrderSupplierAsync(CurrentOrder.Id, _pendingSupplier);
        }

        _unsavedOrderIds.Remove(CurrentOrder.Id);
        ClearPendingRecords();
        await ReloadOrdersAsync(CurrentOrder.Id);
        StatusMessage = "\u8bb0\u5f55\u5df2\u4fdd\u5b58\u3002";
    }

    private async Task ReloadOrdersAsync(long? selectedOrderId = null)
    {
        Orders.Clear();
        foreach (var order in await _repository.GetRecentOrdersAsync())
        {
            Orders.Add(order);
        }

        if (selectedOrderId is not null)
        {
            CurrentOrder = Orders.FirstOrDefault(order => order.Id == selectedOrderId.Value);
        }
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

    private void LoadOrderFields(AcceptanceOrder order)
    {
        OrderNumber = order.OrderNumber;
        Supplier = order.Supplier;
        Operator = order.Operator;
        Remark = order.Remark ?? string.Empty;
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

    private async Task CheckUpdateOnStartupAsync()
    {
        try
        {
            var release = await _updateService.CheckLatestAsync();
            if (release.HasUpdate)
            {
                new UpdateWindow(release) { Owner = Application.Current.MainWindow }.ShowDialog();
            }
        }
        catch
        {
            StatusMessage = "检查更新失败。";
        }
    }

    private void ShowAbout()
    {
        new AboutWindow(_updateService) { Owner = Application.Current.MainWindow }.ShowDialog();
    }

    private string? PickImportFile()
    {
        var dialog = new OpenFileDialog
        {
            Filter = "导入文件|*.csv;*.txt;*.xlsx;*.xlsm;*.xls;*.xml|CSV|*.csv|文本|*.txt|Excel|*.xlsx;*.xlsm;*.xls|XML|*.xml",
            Multiselect = false,
            InitialDirectory = _userSettingsService.LastImportDirectory
        };
        if (dialog.ShowDialog() != true)
        {
            return null;
        }

        var directory = Path.GetDirectoryName(dialog.FileName);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            _userSettingsService.LastImportDirectory = directory;
        }

        return dialog.FileName;
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
        foreach (var result in results
            .OrderByDescending(IsAbnormalResult)
            .ThenByDescending(x => x.ScannedAt ?? DateTime.MinValue)
            .ThenByDescending(x => x.Id))
        {
            Results.Add(result);
        }
        RefreshCommandState();
    }

    private static bool IsAbnormalResult(ComparisonResult result)
    {
        return result.Status != TraceCodeStatus.Matched;
    }

    private void ClearResultState()
    {
        Results.Clear();
        Stats = new SummaryStats();
        RefreshCommandState();
    }

    private void ClearPendingRecords()
    {
        _pendingShipments = null;
        _pendingScans = null;
        _pendingResults = null;
        _pendingSupplier = null;
        SetUnsavedRecords(false);
    }

    private void SetUnsavedRecords(bool value)
    {
        _hasUnsavedRecords = value;
        RefreshCommandState();
    }

    private void RefreshCommandState()
    {
        DeleteOrderCommand.RaiseCanExecuteChanged();
        ImportShipmentCommand.RaiseCanExecuteChanged();
        ImportScanCommand.RaiseCanExecuteChanged();
        CompareCommand.RaiseCanExecuteChanged();
        SaveRecordsCommand.RaiseCanExecuteChanged();
        ExportExcelCommand.RaiseCanExecuteChanged();
        ExportPdfCommand.RaiseCanExecuteChanged();
    }

    private static string GenerateOrderNumber()
    {
        return $"YS{DateTime.Now:yyyyMMddHHmmssff}";
    }
}
