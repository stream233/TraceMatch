# TraceMatch

TraceMatch 是一个面向 Windows 仓库验收场景的药品追溯码到货比对工具。当前主应用已在 `electron-rewrite` 分支重构为 Electron + React + TypeScript；原 WPF 源码暂时保留在仓库根目录，便于核对迁移前后的业务规则。

## 技术栈

- Electron 43
- React 19 + TypeScript
- electron-vite + Vite
- Node.js 内置 `node:sqlite`
- ExcelJS / SheetJS / PDFKit
- electron-builder + NSIS

## 已迁移功能

- 新建、切换和删除验收单
- 兼容原 `%LOCALAPPDATA%\TraceMatch\tracematch.db` 数据库
- 导入 CSV、TXT、XLSX、XLSM、XLS 和扫描设备 XML
- 兼容“码上放心”供应商/平台单号头部格式
- 字段自动识别、手动映射和首行预览
- 追溯码清洗、匹配、未到货、多到货和重复扫码识别
- 导入结果暂存，显式保存后再替换 SQLite 记录
- 状态筛选、全文搜索和追溯码复制
- 单击比对结果，在右侧查看完整药品与扫描信息
- 持久化显示设置，可选择是否将比对异常结果置顶
- 导出 Excel 异常明细和 PDF 验收报告
- GitHub Releases 更新检查；启动失败保持静默，手动检查提供下载页入口
- Windows NSIS 安装包构建

## 目录

```text
src/
├─ main/                 Electron 主进程、SQLite、文件导入、报告导出
├─ preload/              最小权限 IPC 桥
├─ renderer/             React 工作台
└─ shared/               主进程与渲染层共享类型
design/
└─ electron-visual-spec.md
```

## 开发

需要 Node.js 20.19+ 和 pnpm。

```powershell
pnpm install
pnpm dev
```

## 验证与构建

```powershell
pnpm typecheck
pnpm build
pnpm package:win
```

也可以使用发布脚本：

```powershell
.\publish.ps1
.\publish.ps1 -BuildInstaller
```

安装包输出到 `dist\TraceMatchSetup.exe`。

## 数据兼容

Electron 版本继续使用原数据库位置：

```text
%LOCALAPPDATA%\TraceMatch\tracematch.db
```

数据库表名、字段和状态值保持不变，因此无需转换旧数据。用户设置仍保存在同目录的 `settings.json`，并兼容原 WPF 版本的导入目录字段。

## 安全边界

- 渲染层启用上下文隔离和沙箱，关闭 Node.js 集成。
- preload 只暴露业务所需的窄接口，不向页面暴露原始 `ipcRenderer`。
- IPC 校验调用来源；外链仅允许打开 TraceMatch GitHub 仓库页面。
- 应用只加载本地打包内容，拒绝权限请求和新窗口导航。
