using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;
using TraceMatch.Models;

namespace TraceMatch.Converters;

public sealed class StatusBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        return value switch
        {
            TraceCodeStatus.Matched => new SolidColorBrush(Color.FromRgb(36, 133, 82)),
            TraceCodeStatus.Extra => new SolidColorBrush(Color.FromRgb(196, 46, 46)),
            TraceCodeStatus.Missing => new SolidColorBrush(Color.FromRgb(219, 126, 38)),
            TraceCodeStatus.Duplicate => new SolidColorBrush(Color.FromRgb(178, 146, 22)),
            _ => Brushes.Gray
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
