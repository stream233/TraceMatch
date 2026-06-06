using System.Windows;
using TraceMatch.Data;
using TraceMatch.Services;
using TraceMatch.ViewModels;

namespace TraceMatch;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;

    public MainWindow()
    {
        InitializeComponent();
        var database = new AppDatabase();
        var repository = new AcceptanceRepository(database);
        _viewModel = new MainViewModel(
            database,
            repository,
            new FileImportService(),
            new ComparisonService(),
            new ReportExportService());
        DataContext = _viewModel;
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        _viewModel.LoadCommand.Execute(null);
    }
}
