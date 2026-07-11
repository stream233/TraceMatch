import { CircleHelp, FilePlus2, FolderOpen, Search, Settings, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { AcceptanceOrder } from '../../../shared/types'

interface OrderContextMenu {
  order: AcceptanceOrder
  x: number
  y: number
}

interface Props {
  orders: AcceptanceOrder[]
  currentId?: number
  onSearch(query: string): Promise<AcceptanceOrder[]>
  onSelect(order: AcceptanceOrder): void
  onDelete(order: AcceptanceOrder): void
  onCreate(): void
  onSettings(): void
  onAbout(): void
}

export function Sidebar({ orders, currentId, onSearch, onSelect, onDelete, onCreate, onSettings, onAbout }: Props) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AcceptanceOrder[]>([])
  const [searching, setSearching] = useState(false)
  const [contextMenu, setContextMenu] = useState<OrderContextMenu | null>(null)
  const deferredQuery = useDeferredValue(query.trim())
  const visibleOrders = deferredQuery ? searchResults : orders

  useEffect(() => {
    if (!deferredQuery) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    void onSearch(deferredQuery)
      .then((items) => {
        if (!cancelled) setSearchResults(items)
      })
      .catch(() => {
        if (!cancelled) setSearchResults([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => { cancelled = true }
  }, [deferredQuery, onSearch, orders])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  const openContextMenu = (order: AcceptanceOrder, x: number, y: number) => {
    setContextMenu({
      order,
      x: Math.max(8, Math.min(x, window.innerWidth - 184)),
      y: Math.max(8, Math.min(y, window.innerHeight - 104))
    })
  }

  const handleContextMenu = (event: MouseEvent, order: AcceptanceOrder) => {
    event.preventDefault()
    openContextMenu(order, event.clientX, event.clientY)
  }

  const handleOrderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, order: AcceptanceOrder) => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    openContextMenu(order, bounds.right - 4, bounds.top + 18)
  }

  return (
    <aside className="sidebar">
      <button className="new-order-button" type="button" onClick={onCreate}><FilePlus2 size={17} />新建验收单</button>
      <label className="sidebar-search"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" aria-label="搜索验收单号、追溯码或批号" /></label>
      <div className="sidebar-section-title"><span>{deferredQuery ? '搜索结果' : '最近验收'}</span><b>{searching ? '…' : visibleOrders.length}</b></div>
      <nav className="order-list" aria-label="验收单列表">
        {visibleOrders.map((order) => (
          <div className={`order-item${order.id === currentId ? ' is-active' : ''}`} key={order.id} onContextMenu={(event) => handleContextMenu(event, order)}>
            <button className="order-item__select" type="button" aria-haspopup="menu" onClick={() => onSelect(order)} onKeyDown={(event) => handleOrderKeyDown(event, order)}>
              <span className="order-item__number">{order.orderNumber}</span>
              <span className="order-item__supplier">{order.supplier || '未填写供应商'}</span>
              <span className="order-item__meta">{new Date(order.createdAt).toLocaleDateString('zh-CN')} {order.drugInfo ? `· ${order.drugInfo}` : ''}</span>
            </button>
            <button className="order-item__delete" type="button" title="删除验收记录" aria-label={`删除验收记录 ${order.orderNumber}`} onClick={() => onDelete(order)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {visibleOrders.length === 0 ? <p className="sidebar-empty">没有匹配的验收单</p> : null}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-utility-button" type="button" onClick={onSettings}><Settings size={17} /><span>设置</span></button>
        <button className="sidebar-utility-button" type="button" onClick={onAbout}><CircleHelp size={17} /><span>关于与更新</span></button>
      </div>
      {contextMenu ? createPortal(
        <div className="order-context-menu" role="menu" aria-label={`${contextMenu.order.orderNumber} 操作`} style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => { onSelect(contextMenu.order); setContextMenu(null) }}><FolderOpen size={15} />打开验收记录</button>
          <button className="is-danger" type="button" role="menuitem" onClick={() => { onDelete(contextMenu.order); setContextMenu(null) }}><Trash2 size={15} />删除验收记录</button>
        </div>,
        document.body
      ) : null}
    </aside>
  )
}
