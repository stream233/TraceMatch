import { Database, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppSettings, FieldMapping, ImportKind, PickedImport, ReleaseInfo } from '../../shared/types'
import { AboutDialog } from './components/AboutDialog'
import { CreateOrderDialog } from './components/CreateOrderDialog'
import { MappingDialog } from './components/MappingDialog'
import { Modal } from './components/Modal'
import { ResultsTable } from './components/ResultsTable'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { StatsStrip } from './components/StatsStrip'
import { WorkflowToolbar } from './components/WorkflowToolbar'
import { WorkspaceHeader } from './components/WorkspaceHeader'
import { useTraceMatch } from './hooks/useTraceMatch'

interface MappingRequest { kind: ImportKind; picked: PickedImport }

export default function App() {
  const store = useTraceMatch()
  const [newOrderNumber, setNewOrderNumber] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>({ pinAbnormalResults: true })
  const [mappingRequest, setMappingRequest] = useState<MappingRequest | null>(null)
  const [startupRelease, setStartupRelease] = useState<ReleaseInfo | null>(null)

  useEffect(() => {
    let active = true
    void window.traceMatch.settings.get().then((settings) => {
      if (active) setAppSettings(settings)
    }).catch(() => {
      // Keep safe defaults when the settings file cannot be read.
    })
    void window.traceMatch.update.check().then((release) => {
      if (active && release.hasUpdate) setStartupRelease(release)
    }).catch(() => {
      // Startup update failures intentionally stay silent. Manual checks in About explain the failure.
    })
    return () => { active = false }
  }, [])

  const beginImport = async (kind: ImportKind) => {
    if (!store.currentOrder) return
    const picked = await window.traceMatch.imports.pick(kind).catch((error) => {
      window.alert(`无法读取导入文件\n\n${error instanceof Error ? error.message : String(error)}`)
      return null
    })
    if (picked) setMappingRequest({ kind, picked })
  }

  const confirmMapping = async (mapping: FieldMapping) => {
    if (!mappingRequest || !store.currentOrder) return
    const { kind, picked } = mappingRequest
    if (kind === 'shipment') {
      const items = await window.traceMatch.imports.shipments(picked.table, mapping, store.currentOrder.id)
      store.setImportedShipments(items, picked.table.metadata['供应商'])
    } else {
      const items = await window.traceMatch.imports.scans(picked.table, mapping, store.currentOrder.id, picked.path)
      await store.setImportedScans(items)
    }
  }

  const exportReport = async (format: 'xlsx' | 'pdf') => {
    if (!store.currentOrder || store.results.length === 0) return
    try {
      const filePath = await window.traceMatch.exportReport({ format, order: store.currentOrder, stats: store.stats, results: store.results })
      if (filePath) store.setStatus(`${format === 'xlsx' ? 'Excel' : 'PDF'} 报告已导出：${filePath}`)
    } catch (error) {
      window.alert(`报告导出失败\n\n${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const saveSettings = async (settings: AppSettings) => {
    try {
      const saved = await window.traceMatch.settings.update(settings)
      setAppSettings(saved)
      store.setStatus(saved.pinAbnormalResults ? '已开启：比对异常结果置顶。' : '已关闭：比对结果按扫描时间显示。')
      return true
    } catch (error) {
      window.alert(`设置保存失败\n\n${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  const openCreateDialog = async () => {
    try {
      setNewOrderNumber(await store.getNextOrderNumber())
    } catch (error) {
      window.alert(`无法生成验收单号\n\n${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar orders={store.orders} currentId={store.currentOrder?.id} onSearch={store.searchOrders} onSelect={(order) => void store.selectOrder(order)} onDelete={(order) => void store.deleteOrder(order)} onCreate={() => void openCreateDialog()} onSettings={() => setShowSettings(true)} onAbout={() => setShowAbout(true)} />
      <main className="workspace">
        <WorkspaceHeader order={store.currentOrder} dirty={store.dirty} />
        <WorkflowToolbar disabled={!store.currentOrder} busy={store.busy} dirty={store.dirty} hasResults={store.results.length > 0}
          onImportShipment={() => void beginImport('shipment')} onImportScan={() => void beginImport('scan')}
          onCompare={() => void store.compare()} onSave={() => void store.save()} onExport={(format) => void exportReport(format)} />
        <StatsStrip stats={store.stats} />
        <ResultsTable results={store.results} pinAbnormalResults={appSettings.pinAbnormalResults} onStatus={store.setStatus} />
        <footer className="status-bar">
          <span className="status-bar__message">{store.busy ? <LoaderCircle className="is-spinning" size={14} /> : <ShieldCheck size={14} />}{store.status}</span>
          <span><Database size={14} />本地 SQLite{store.dirty ? ' · 待保存' : ' · 已同步'}</span>
        </footer>
      </main>

      {newOrderNumber ? <CreateOrderDialog initialOrderNumber={newOrderNumber} onClose={() => setNewOrderNumber(null)} onCreate={store.createOrder} /> : null}
      {showSettings ? <SettingsDialog settings={appSettings} onClose={() => setShowSettings(false)} onSave={saveSettings} /> : null}
      {showAbout ? <AboutDialog onClose={() => setShowAbout(false)} /> : null}
      {mappingRequest ? <MappingDialog kind={mappingRequest.kind} fileName={mappingRequest.picked.fileName} table={mappingRequest.picked.table}
        onClose={() => setMappingRequest(null)} onConfirm={confirmMapping} /> : null}
      {startupRelease ? <Modal title="发现 TraceMatch 新版本" description={`${startupRelease.currentVersion} → ${startupRelease.latestVersion}`} width="small" onClose={() => setStartupRelease(null)}
        footer={<><button className="button button--ghost" onClick={() => setStartupRelease(null)}>稍后处理</button><button className="button button--primary" onClick={() => void window.traceMatch.app.openExternal(startupRelease.downloadUrl)}>打开下载页</button></>}>
        <p className="release-copy">{startupRelease.name || '新版本已发布'}</p>
        <p className="release-notes">{startupRelease.body?.slice(0, 360) || '请打开下载页面查看版本说明。'}</p>
      </Modal> : null}
    </div>
  )
}
