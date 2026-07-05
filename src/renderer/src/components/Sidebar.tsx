import { CircleHelp, FilePlus2, Search, Settings } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import type { AcceptanceOrder } from '../../../shared/types'

interface Props {
  orders: AcceptanceOrder[]
  currentId?: number
  onSelect(order: AcceptanceOrder): void
  onCreate(): void
  onSettings(): void
  onAbout(): void
}

export function Sidebar({ orders, currentId, onSelect, onCreate, onSettings, onAbout }: Props) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const visibleOrders = deferredQuery
    ? orders.filter((order) => `${order.orderNumber} ${order.supplier} ${order.drugInfo ?? ''}`.toLowerCase().includes(deferredQuery))
    : orders
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__mark">TM</span>
        <div><strong>TraceMatch</strong><small>到货比对</small></div>
      </div>
      <button className="new-order-button" type="button" onClick={onCreate}><FilePlus2 size={17} />新建验收单</button>
      <label className="sidebar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索验收单" /></label>
      <div className="sidebar-section-title"><span>最近验收</span><b>{orders.length}</b></div>
      <nav className="order-list" aria-label="验收单列表">
        {visibleOrders.map((order) => (
          <button className={`order-item${order.id === currentId ? ' is-active' : ''}`} type="button" key={order.id} onClick={() => onSelect(order)}>
            <span className="order-item__number">{order.orderNumber}</span>
            <span className="order-item__supplier">{order.supplier || '未填写供应商'}</span>
            <span className="order-item__meta">{new Date(order.createdAt).toLocaleDateString('zh-CN')} {order.drugInfo ? `· ${order.drugInfo}` : ''}</span>
          </button>
        ))}
        {visibleOrders.length === 0 ? <p className="sidebar-empty">没有匹配的验收单</p> : null}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-utility-button" type="button" onClick={onSettings}><Settings size={17} /><span>设置</span></button>
        <button className="sidebar-utility-button" type="button" onClick={onAbout}><CircleHelp size={17} /><span>关于与更新</span></button>
      </div>
    </aside>
  )
}
