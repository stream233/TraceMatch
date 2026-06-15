using System.Windows;
using TraceMatch.Services;

namespace TraceMatch.Views;

public partial class AboutWindow : Window
{
    private readonly UpdateService _updateService;

    public AboutWindow(UpdateService updateService)
    {
        InitializeComponent();
        _updateService = updateService;
        VersionText.Text = $"当前版本：{_updateService.GetCurrentVersion()}";
        StatusText.Text = string.Empty;
    }

    private async void CheckUpdate_Click(object sender, RoutedEventArgs e)
    {
        StatusText.Text = "正在检查更新...";
        try
        {
            var release = await _updateService.CheckLatestAsync();
            if (release.HasUpdate)
            {
                StatusText.Text = $"发现新版本：{release.LatestVersion}";
                new UpdateWindow(release) { Owner = this }.ShowDialog();
            }
            else
            {
                StatusText.Text = $"当前已是最新版本：{release.CurrentVersion}";
                MessageBox.Show(this, "当前已是最新版本。", "检查更新", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }
        catch
        {
            StatusText.Text = "GitHub API 访问受限或网络不可用。";
            var result = MessageBox.Show(
                this,
                "GitHub API 访问受限或网络不可用，无法自动检查更新。\n\n是否打开下载页面手动查看最新版本？",
                "检查更新",
                MessageBoxButton.YesNo,
                MessageBoxImage.Information);
            if (result == MessageBoxResult.Yes)
            {
                UpdateService.OpenUrl(UpdateService.LatestReleasePageUrl);
            }
        }
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }
}
