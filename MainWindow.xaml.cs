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
            new UserSettingsService(),
            new UpdateService());
        DataContext = _viewModel;
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        if (ShowUpgradeRequiredIfExpired())
        {
            Application.Current.Shutdown();
            return;
        }

        _viewModel.LoadCommand.Execute(null);
    }

    private static bool ShowUpgradeRequiredIfExpired()
    {
        var expiryDate = new DateTime(2027, 12, 31);
        if (DateTime.Now.Date <= expiryDate)
        {
            return false;
        }

        var result = MessageBox.Show(
            "\u5f53\u524d\u7248\u672c\u5df2\u8fc7\u671f\uff0c\u8f6f\u4ef6\u5df2\u505c\u6b62\u4f7f\u7528\u3002\n\n\u8bf7\u5347\u7ea7\u5230\u6700\u65b0\u7248\u672c\u540e\u7ee7\u7eed\u4f7f\u7528\u3002\u70b9\u51fb\u201c\u662f\u201d\u6253\u5f00\u4e0b\u8f7d\u9875\u9762\uff0c\u70b9\u51fb\u201c\u5426\u201d\u9000\u51fa\u8f6f\u4ef6\u3002",
            "\u5fc5\u987b\u5347\u7ea7",
            MessageBoxButton.YesNo,
            MessageBoxImage.Error);

        if (result == MessageBoxResult.Yes)
        {
            UpdateService.OpenUrl("https://github.com/stream233/TraceMatch/releases/latest");
        }

        return true;
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
