import path from 'node:path'
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type { AcceptanceOrder, AppSettings, ExportPayload, FieldMapping, ImportKind, ImportTable, SaveWorkspacePayload } from '../shared/types'
import { isApplicationExpired } from '../shared/availability'
import { TraceMatchDatabase } from './database'
import { compareRecords } from './services/comparison'
import { readImportTable, toScanRecords, toShipmentItems } from './services/importer'
import { exportExcel, exportPdf } from './services/reports'
import { checkForUpdates } from './services/updates'
import { UserSettings } from './settings'

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? ''
  const trusted = url.startsWith('file://') || url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')
  if (!trusted) throw new Error('拒绝来自未知页面的应用请求。')
}

const expiryAllowedChannels = new Set(['app:version', 'app:open-external', 'app:quit', 'update:check'])

function assertApplicationAvailable(channel: string): void {
  if (isApplicationExpired() && !expiryAllowedChannels.has(channel)) {
    throw new Error('当前版本不可用，请升级版本。')
  }
}

function handle<T extends unknown[], R>(channel: string, callback: (...args: T) => R | Promise<R>): void {
  ipcMain.handle(channel, async (event, ...args: T) => {
    assertTrustedSender(event)
    assertApplicationAvailable(channel)
    return callback(...args)
  })
}

export function registerIpc(database: TraceMatchDatabase, settings: UserSettings): void {
  handle('app:version', () => app.getVersion())
  handle('app:copy-text', (text: string) => clipboard.writeText(text.slice(0, 10_000)))
  handle('app:quit', () => app.quit())
  handle('app:open-external', async (url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.startsWith('/stream233/TraceMatch')) {
      throw new Error('只允许打开 TraceMatch 的 GitHub 页面。')
    }
    await shell.openExternal(url)
  })

  handle('orders:list', () => database.listOrders())
  handle('orders:search', (query: string) => database.searchOrders(query.slice(0, 200)))
  handle('orders:next-number', () => database.getNextOrderNumber())
  handle('orders:create', (input: Omit<AcceptanceOrder, 'id' | 'createdAt'>) => database.createOrder(input))
  handle('orders:delete', (id: number) => database.deleteOrder(id))
  handle('orders:workspace', (id: number) => database.getWorkspace(id))
  handle('orders:save', (payload: SaveWorkspacePayload) => database.saveWorkspace(payload))
  handle('settings:get', () => settings.getAppSettings())
  handle('settings:update', (value: AppSettings) => settings.updateAppSettings(value))

  handle('imports:pick', async (kind: ImportKind) => {
    const window = BrowserWindow.getFocusedWindow() ?? undefined
    const options: Electron.OpenDialogOptions = {
      title: kind === 'shipment' ? '导入平台发货数据' : '导入条码扫描数据',
      defaultPath: settings.getImportDirectory(kind),
      properties: ['openFile'],
      filters: [
        { name: '导入文件', extensions: ['csv', 'txt', 'xlsx', 'xlsm', 'xls', 'xml'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    settings.setImportDirectory(kind, path.dirname(filePath))
    return { path: filePath, fileName: path.basename(filePath), table: readImportTable(filePath) }
  })
  handle('imports:shipments', (table: ImportTable, mapping: FieldMapping, orderId: number) => toShipmentItems(table, mapping, orderId))
  handle('imports:scans', (table: ImportTable, mapping: FieldMapping, orderId: number, sourceFile: string) => toScanRecords(table, mapping, orderId, sourceFile))
  handle('compare:run', compareRecords)

  handle('report:export', async (payload: ExportPayload) => {
    const window = BrowserWindow.getFocusedWindow() ?? undefined
    const extension = payload.format === 'xlsx' ? 'xlsx' : 'pdf'
    const options: Electron.SaveDialogOptions = {
      title: payload.format === 'xlsx' ? '导出 Excel 验收报告' : '导出 PDF 验收报告',
      defaultPath: `${payload.order.orderNumber}-验收报告.${extension}`,
      filters: [{ name: payload.format === 'xlsx' ? 'Excel 报告' : 'PDF 报告', extensions: [extension] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    if (payload.format === 'xlsx') await exportExcel(result.filePath, payload)
    else await exportPdf(result.filePath, payload)
    return result.filePath
  })

  handle('update:check', checkForUpdates)
}
