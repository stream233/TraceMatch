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
        StatusText.Text = "可在这里检查 GitHub Releases 中的最新版本。";
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
            StatusText.Text = "检查更新失败。";
            MessageBox.Show(this, "检查更新失败，请稍后再试。", "检查更新", MessageBoxButton.OK, MessageBoxImage.Information);
        }
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }
}
