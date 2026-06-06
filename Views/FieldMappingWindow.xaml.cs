using System.Windows;
using System.Windows.Controls;
using TraceMatch.Models;

namespace TraceMatch.Views;

public partial class FieldMappingWindow : Window
{
    private readonly IReadOnlyList<string> _targetFields;
    private readonly Dictionary<string, ComboBox> _selectors = new();

    public FieldMappingWindow(IReadOnlyList<string> headers, IReadOnlyList<string> targetFields)
    {
        InitializeComponent();
        _targetFields = targetFields;
        Mapping = new FieldMapping();

        foreach (var field in targetFields)
        {
            var row = new Grid { Margin = new Thickness(0, 0, 0, 10) };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(130) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var label = new TextBlock
            {
                Text = field == "追溯码" ? $"{field} *" : field,
                VerticalAlignment = VerticalAlignment.Center,
                Foreground = field == "追溯码" ? System.Windows.Media.Brushes.DarkRed : System.Windows.Media.Brushes.Black
            };
            var selector = new ComboBox
            {
                Height = 32,
                ItemsSource = new[] { "" }.Concat(headers).ToList(),
                SelectedItem = GuessHeader(headers, field)
            };

            Grid.SetColumn(label, 0);
            Grid.SetColumn(selector, 1);
            row.Children.Add(label);
            row.Children.Add(selector);
            MappingPanel.Children.Add(row);
            _selectors[field] = selector;
        }
    }

    public FieldMapping Mapping { get; }

    private static string GuessHeader(IReadOnlyList<string> headers, string field)
    {
        var aliases = field switch
        {
            "追溯码" => new[] { "追溯码", "码", "药品追溯码", "监管码", "条码" },
            "药品名称" => new[] { "药品名称", "品名", "商品名称", "通用名称" },
            "规格" => new[] { "规格", "包装规格" },
            "批号" => new[] { "批号", "生产批号" },
            "生产企业" => new[] { "生产企业", "厂家", "生产厂家", "生产厂商" },
            "有效期" => new[] { "有效期", "有效期至", "失效日期" },
            "数量" => new[] { "数量", "件数", "发货数量" },
            "扫描时间" => new[] { "扫描时间", "扫码时间", "时间" },
            _ => new[] { field }
        };

        return headers.FirstOrDefault(header => aliases.Any(alias => header.Contains(alias, StringComparison.OrdinalIgnoreCase))) ?? "";
    }

    private void Ok_Click(object sender, RoutedEventArgs e)
    {
        foreach (var field in _targetFields)
        {
            Mapping[field] = _selectors[field].SelectedItem?.ToString();
        }

        if (string.IsNullOrWhiteSpace(Mapping["追溯码"]))
        {
            MessageBox.Show("必须映射追溯码字段。", "字段映射", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }
}
