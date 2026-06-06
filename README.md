# TraceMatch

TraceMatch 是一个 Windows 桌面端药品追溯码到货比对工具，用于仓库在离线扫码后，将扫码设备导出的追溯码文件与“码上放心”等平台下载的上游出库数据进行本地比对，判断实际到货是否与发货数据一致。

当前版本是 MVP，重点完成批量导入、字段映射、追溯码清洗、SQLite 持久化、批量比对、结果展示和 Excel/PDF 验收报告导出。不包含自动下载、上传、ERP 集成或平台接口对接。

## 技术栈

- C#
- .NET 8
- WPF
- SQLite
- MVVM
- Microsoft.Data.Sqlite
- ClosedXML
- ExcelDataReader
- QuestPDF

## 核心功能

- 新建验收单：验收单号、操作员、创建时间、备注；供应商可由平台发货文件自动识别。
- 导入平台发货数据：支持 CSV、TXT、XLSX、XLS，兼容“$供应商,单号 + 明细 + #”格式的码上放心 TXT。
- 导入扫码设备文件：支持 CSV、TXT、XLSX、XLS、XML，兼容扫码机导出的 `PurchaseWareHouseIn` XML。
- 导入时支持字段映射，适配平台文件字段名变化。
- 自动清洗追溯码中的空格、换行符、制表符等无效字符。
- 使用 SQLite 保存验收单、平台发货码、扫描记录和比对结果。
- 扫描文件导入后可自动批量比对。
- 导入和比对结果先保存在当前界面，点击“保存”后才写入 SQLite。
- 主界面展示应到、扫描、匹配、未到货、多到货、重复扫码统计。
- 结果表格按扫描时间倒序显示，并用颜色标识状态。
- 支持导出 Excel 和 PDF 验收报告，包含汇总统计与异常明细。

## 比对规则

| 状态 | 规则 | 界面颜色 |
| --- | --- | --- |
| 匹配 | 平台发货数据中存在该追溯码，且扫码文件中只出现一次 | 绿色 |
| 多到货 | 扫码文件中存在该追溯码，但平台发货数据中不存在 | 红色 |
| 未到货 | 平台发货数据中存在该追溯码，但扫码文件中没有 | 橙色 |
| 重复扫码 | 扫码文件中同一追溯码出现多次 | 黄色 |

## 导入字段

平台发货数据建议包含以下字段：

- 追溯码
- 药品名称
- 规格
- 批号
- 生产企业
- 生产日期
- 有效期
- 数量

码上放心 TXT 固定格式按以下列读取：

- 第 1 列：追溯码
- 第 2 列：药品名称
- 第 3 列：批号
- 第 4 列：生产日期

扫描设备导出文件至少需要包含：

- 追溯码

可选字段：

- 扫描时间

导入时会弹出字段映射窗口。只要文件有表头，即使字段名不是完全一致，也可以手动选择对应列。

## 数据库

数据库文件保存位置：

```text
%LOCALAPPDATA%\TraceMatch\tracematch.db
```

建表 SQL 位于：

```text
Database/schema.sql
```

主要数据表：

- `acceptance_orders`：验收单
- `shipment_items`：平台发货追溯码
- `scan_records`：扫码设备扫描记录
- `comparison_results`：比对结果

## 项目结构

```text
TraceMatch
├─ App.xaml
├─ MainWindow.xaml
├─ TraceMatch.csproj
├─ Converters
│  └─ StatusBrushConverter.cs
├─ Data
│  ├─ AppDatabase.cs
│  └─ AcceptanceRepository.cs
├─ Database
│  └─ schema.sql
├─ Models
│  ├─ AcceptanceOrder.cs
│  ├─ ShipmentItem.cs
│  ├─ ScanRecord.cs
│  ├─ ComparisonResult.cs
│  ├─ SummaryStats.cs
│  ├─ ImportModels.cs
│  └─ TraceCodeStatus.cs
├─ Services
│  ├─ FileImportService.cs
│  ├─ TraceCodeCleaner.cs
│  ├─ ComparisonService.cs
│  └─ ReportExportService.cs
├─ ViewModels
│  ├─ MainViewModel.cs
│  ├─ ViewModelBase.cs
│  ├─ RelayCommand.cs
│  └─ AsyncRelayCommand.cs
└─ Views
   ├─ FieldMappingWindow.xaml
   └─ FieldMappingWindow.xaml.cs
```

## 运行方式

需要安装 .NET 8 SDK。

```powershell
dotnet restore
dotnet build
dotnet run
```

也可以在 Visual Studio 2022 中打开 `TraceMatch.csproj` 后直接运行。

## 使用流程

1. 启动软件。
2. 填写验收单号、操作员、备注；供应商可以先留空。
3. 点击“新建验收单”。
4. 点击“导入平台发货数据”，选择 CSV、TXT 或 Excel 文件。
5. 在字段映射窗口中选择平台文件列名；如果平台 TXT 文件头包含供应商，软件会自动回填验收单供应商。
6. 点击“导入扫描文件”，选择扫码设备导出的文件。
7. 在字段映射窗口中选择追溯码列，可选扫描时间列。
8. 软件自动比对并展示统计与结果明细。
9. 点击“保存”将本次导入和比对结果写入本机 SQLite。
10. 点击“导出 Excel”或“导出 PDF”生成验收报告。

## 当前限制

- XML 扫码文件已支持 `<Data Code="..." ActDate="...">` 结构；其他 XML 结构可继续扩展映射规则。
- PDF 报告异常明细最多输出前 300 条，Excel 报告输出全部异常明细。
- 旧版 `.xls` 通过 ExcelDataReader 支持读取，但实际文件质量取决于导出来源。
- 当前未做用户权限、自动更新、平台登录、自动下载、上传或 ERP 集成。

## 验证

当前项目已通过构建：

```powershell
dotnet build
```

构建结果：0 警告，0 错误。
