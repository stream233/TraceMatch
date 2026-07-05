import { Building2, CalendarDays, ClipboardCopy, Package, Pill, ScanLine, X } from 'lucide-react'
import { statusLabels, type ComparisonResult } from '../../../shared/types'

interface Props {
  item: ComparisonResult
  onClose(): void
  onCopy(code: string): Promise<void>
}

interface DetailFieldProps {
  label: string
  value: string | number
}

function DetailField({ label, value }: DetailFieldProps) {
  return <div className="drug-detail__field"><span>{label}</span><strong>{value === '' ? '—' : value}</strong></div>
}

export function DrugDetailPanel({ item, onClose, onCopy }: Props) {
  return (
    <aside className={`drug-detail drug-detail--${item.status}`} aria-label="药品信息">
      <header className="drug-detail__header">
        <div>
          <span className="drug-detail__eyebrow"><Pill size={14} />药品信息</span>
          <h2>{item.drugName || '未识别药品'}</h2>
        </div>
        <button className="icon-button" type="button" aria-label="关闭药品信息" onClick={onClose}><X size={17} /></button>
      </header>

      <div className="drug-detail__body">
        <section className="drug-detail__identity">
          <span className={`status status--${item.status}`}>{statusLabels[item.status]}</span>
          <button type="button" className="drug-detail__code" onClick={() => void onCopy(item.traceCode)} title="复制追溯码">
            <span>追溯码</span><strong>{item.traceCode}</strong><ClipboardCopy size={14} />
          </button>
        </section>

        <section className="drug-detail__section">
          <h3><Package size={15} />药品属性</h3>
          <div className="drug-detail__grid">
            <DetailField label="规格" value={item.specification} />
            <DetailField label="批号" value={item.batchNumber} />
          </div>
          <div className="drug-detail__company"><Building2 size={15} /><div><span>生产企业</span><strong>{item.manufacturer || '—'}</strong></div></div>
        </section>

        <section className="drug-detail__section">
          <h3><CalendarDays size={15} />日期与数量</h3>
          <div className="drug-detail__grid">
            <DetailField label="生产日期" value={item.productionDate} />
            <DetailField label="有效期" value={item.expiryDate} />
            <DetailField label="数量" value={item.quantity} />
          </div>
        </section>

        <section className="drug-detail__scan">
          <ScanLine size={16} />
          <div><span>扫描时间</span><strong>{item.scannedAt ? new Date(item.scannedAt).toLocaleString('zh-CN', { hour12: false }) : '未扫描'}</strong></div>
        </section>
      </div>
    </aside>
  )
}
