import { CalendarDays, UserRound } from 'lucide-react'
import type { AcceptanceOrder } from '../../../shared/types'

interface Props {
  order: AcceptanceOrder | null
  dirty: boolean
}

export function WorkspaceHeader({ order, dirty }: Props) {
  if (!order) {
    return <header className="workspace-header workspace-header--empty"><div><h1>到货比对工作台</h1><p>从左侧新建或选择一个验收单。</p></div></header>
  }
  return (
    <header className="workspace-header">
      <div className="workspace-title">
        <div className="workspace-title__line"><h1>{order.orderNumber}</h1>{dirty ? <span className="unsaved-dot">有未保存更改</span> : null}</div>
        <p>{order.supplier || '未填写供应商'}{order.remark ? ` · ${order.remark}` : ''}</p>
      </div>
      <div className="workspace-meta">
        <span><UserRound size={15} />操作员 {order.operator}</span>
        <span><CalendarDays size={15} />{new Date(order.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>
    </header>
  )
}
