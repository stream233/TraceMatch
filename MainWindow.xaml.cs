using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Threading;
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
            new ReportExportService(),
            new UserSettingsService());
        DataContext = _viewModel;
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        _viewModel.LoadCommand.Execute(null);
    }

    private void TraceCodeTextBox_MouseDoubleClick(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (sender is not TextBox textBox || string.IsNullOrWhiteSpace(textBox.Text))
        {
            return;
        }

        Clipboard.SetText(textBox.Text);
        ShowCopiedTip(textBox);
        _viewModel.StatusMessage = $"已复制追溯码：{textBox.Text}";
        e.Handled = true;
    }

    private static void ShowCopiedTip(TextBox textBox)
    {
        var tip = new ToolTip
        {
            Content = "已复制",
            Placement = PlacementMode.MousePoint,
            PlacementTarget = textBox,
            StaysOpen = false,
            IsOpen = true
        };

        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.2) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            tip.IsOpen = false;
        };
        timer.Start();
    }
}
