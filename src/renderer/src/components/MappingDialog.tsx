import { useMemo, useState } from 'react'
import { ImportFields, type FieldMapping, type ImportKind, type ImportTable } from '../../../shared/types'
import { Modal } from './Modal'

const aliases: Record<string, string[]> = {
  [ImportFields.traceCode]: ['追溯码', '码', '药品追溯码', '监管码', '条码'],
  [ImportFields.drugName]: ['药品名称', '品名', '商品名称', '通用名称'],
  [ImportFields.specification]: ['规格', '包装规格'],
  [ImportFields.batchNumber]: ['批号', '生产批号'],
  [ImportFields.manufacturer]: ['生产企业', '厂家', '生产厂家', '生产厂商'],
  [ImportFields.productionDate]: ['生产日期', '生产时间', '生产日期时间'],
  [ImportFields.expiryDate]: ['有效期', '有效期至', '失效日期'],
  [ImportFields.quantity]: ['数量', '件数', '发货数量'],
  [ImportFields.scannedAt]: ['扫描时间', '扫码时间', '时间']
}

function guess(headers: string[], field: string): string | null {
  return headers.find((header) => (aliases[field] ?? [field]).some((alias) => header.toLowerCase().includes(alias.toLowerCase()))) ?? null
}

interface Props {
  kind: ImportKind
  fileName: string
  table: ImportTable
  onClose(): void
  onConfirm(mapping: FieldMapping): Promise<void>
}

export function MappingDialog({ kind, fileName, table, onClose, onConfirm }: Props) {
  const fields = useMemo(() => kind === 'shipment'
    ? [ImportFields.traceCode, ImportFields.drugName, ImportFields.specification, ImportFields.batchNumber, ImportFields.manufacturer, ImportFields.productionDate, ImportFields.expiryDate, ImportFields.quantity]
    : [ImportFields.traceCode, ImportFields.scannedAt], [kind])
  const [mapping, setMapping] = useState<FieldMapping>(() => Object.fromEntries(fields.map((field) => [field, guess(table.headers, field)])))
  const confirm = async () => {
    if (!mapping[ImportFields.traceCode]) return
    await onConfirm(mapping)
    onClose()
  }
  return (
    <Modal title="字段映射" description={`${fileName} · ${table.rows.length} 行数据`} onClose={onClose}
      footer={<><button className="button button--ghost" onClick={onClose}>取消</button><button className="button button--primary" disabled={!mapping[ImportFields.traceCode]} onClick={() => void confirm()}>确认导入</button></>}>
      <div className="mapping-list">
        {fields.map((field) => (
          <label className="mapping-row" key={field}>
            <span className={field === ImportFields.traceCode ? 'required-label' : ''}>{field}{field === ImportFields.traceCode ? ' *' : ''}</span>
            <select value={mapping[field] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value || null }))}>
              <option value="">不导入</option>
              {table.headers.map((header) => <option value={header} key={header}>{header}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mapping-preview">
        <span>数据预览</span>
        <div>{table.headers.slice(0, 4).map((header) => <b key={header}>{header}</b>)}</div>
        <div>{table.headers.slice(0, 4).map((header) => <em key={header}>{table.rows[0]?.[header] || '—'}</em>)}</div>
      </div>
    </Modal>
  )
}
