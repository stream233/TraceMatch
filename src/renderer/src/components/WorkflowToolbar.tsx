import { FileDown, FileSpreadsheet, RefreshCcw, Save, ScanBarcode, Truck } from 'lucide-react'

interface Props {
  disabled: boolean
  busy: boolean
  dirty: boolean
  hasResults: boolean
  onImportShipment(): void
  onImportScan(): void
  onCompare(): void
  onSave(): void
  onExport(format: 'xlsx' | 'pdf'): void
}

export function WorkflowToolbar(props: Props) {
  return (
    <section className="workflow-toolbar" aria-label="验收工作流">
      <div className="workflow-primary">
        <button className="button button--primary" disabled={props.disabled || props.busy} onClick={props.onImportShipment}><Truck size={16} />导入发货数据</button>
        <button className="button button--secondary" disabled={props.disabled || props.busy} onClick={props.onImportScan}><ScanBarcode size={16} />导入扫描数据</button>
        <span className="toolbar-divider" />
        <button className="button button--quiet" disabled={props.disabled || props.busy} onClick={props.onCompare}><RefreshCcw size={16} />重新比对</button>
        <button className="button button--save" disabled={props.disabled || props.busy || !props.dirty} onClick={props.onSave}><Save size={16} />保存记录</button>
      </div>
      <div className="workflow-export">
        <button className="button button--quiet" disabled={!props.hasResults || props.busy} onClick={() => props.onExport('xlsx')}><FileSpreadsheet size={16} />导出 Excel</button>
        <button className="button button--quiet" disabled={!props.hasResults || props.busy} onClick={() => props.onExport('pdf')}><FileDown size={16} />导出 PDF</button>
      </div>
    </section>
  )
}
