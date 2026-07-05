import { AlertTriangle, Barcode, CheckCircle2, CircleDashed, CopyX, PackageCheck } from 'lucide-react'
import type { SummaryStats } from '../../../shared/types'

interface Props { stats: SummaryStats }

export function StatsStrip({ stats }: Props) {
  const items = [
    { label: '应到', value: stats.expectedCount, tone: 'neutral', icon: PackageCheck },
    { label: '扫描', value: stats.scannedCount, tone: 'neutral', icon: Barcode },
    { label: '匹配', value: stats.matchedCount, tone: 'matched', icon: CheckCircle2 },
    { label: '未到货', value: stats.missingCount, tone: 'missing', icon: CircleDashed },
    { label: '多到货', value: stats.extraCount, tone: 'extra', icon: AlertTriangle },
    { label: '重复扫码', value: stats.duplicateCount, tone: 'duplicate', icon: CopyX }
  ]
  return (
    <section className="stats-strip" aria-label="比对统计">
      {items.map((item) => <div className={`stat stat--${item.tone}`} key={item.label}><item.icon size={18} /><div><span>{item.label}</span><strong>{item.value.toLocaleString('zh-CN')}</strong></div></div>)}
    </section>
  )
}
