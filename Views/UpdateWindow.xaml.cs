using System.Windows;
using TraceMatch.Models;
using TraceMatch.Services;

namespace TraceMatch.Views;

public partial class UpdateWindow : Window
{
    private readonly ReleaseInfo _releaseInfo;

    public UpdateWindow(ReleaseInfo releaseInfo)
    {
        InitializeComponent();
        _releaseInfo = releaseInfo;
        ReleaseNameText.Text = string.IsNullOrWhiteSpace(releaseInfo.Name)
            ? "TraceMatch 更新"
            : releaseInfo.Name;
        CurrentVersionText.Text = releaseInfo.CurrentVersion;
        LatestVersionText.Text = releaseInfo.LatestVersion;
        ReleaseBodyText.Text = string.IsNullOrWhiteSpace(releaseInfo.Body)
            ? "暂无更新说明。"
            : releaseInfo.Body;
    }

    private void Download_Click(object sender, RoutedEventArgs e)
    {
        UpdateService.OpenUrl(_releaseInfo.DownloadUrl ?? _releaseInfo.ReleasePageUrl);
        DialogResult = true;
    }

    private void Later_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }
}
