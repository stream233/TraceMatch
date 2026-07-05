import { useCallback, useEffect, useState } from 'react'
import { emptyStats, type AcceptanceOrder, type ComparisonResult, type ScanRecord, type ShipmentItem, type SummaryStats } from '../../../shared/types'

export function useTraceMatch() {
  const [orders, setOrders] = useState<AcceptanceOrder[]>([])
  const [currentOrder, setCurrentOrder] = useState<AcceptanceOrder | null>(null)
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [scans, setScans] = useState<ScanRecord[]>([])
  const [pendingShipments, setPendingShipments] = useState<ShipmentItem[] | null>(null)
  const [pendingScans, setPendingScans] = useState<ScanRecord[] | null>(null)
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [stats, setStats] = useState<SummaryStats>(emptyStats)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('正在读取本地验收数据…')

  const run = useCallback(async <T,>(task: () => Promise<T>, message?: string): Promise<T | null> => {
    setBusy(true)
    if (message) setStatus(message)
    try {
      return await task()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setStatus(`操作失败：${detail}`)
      window.alert(`操作失败\n\n${detail}`)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const loadWorkspace = useCallback(async (order: AcceptanceOrder) => {
    const workspace = await run(() => window.traceMatch.orders.workspace(order.id), `正在载入 ${order.orderNumber}…`)
    if (!workspace) return false
    setCurrentOrder(workspace.order)
    setShipments(workspace.shipments)
    setScans(workspace.scans)
    setPendingShipments(null)
    setPendingScans(null)
    setResults(workspace.results)
    setStats(workspace.stats)
    setDirty(false)
    setStatus(`当前验收单：${workspace.order.orderNumber}`)
    return true
  }, [run])

  useEffect(() => {
    let cancelled = false
    void window.traceMatch.orders.list().then(async (items) => {
      if (cancelled) return
      setOrders(items)
      if (items[0]) await loadWorkspace(items[0])
      else setStatus('新建验收单后，即可导入发货数据和扫描数据。')
    }).catch((error) => {
      if (!cancelled) setStatus(`数据库载入失败：${error instanceof Error ? error.message : String(error)}`)
    })
    return () => { cancelled = true }
  }, [loadWorkspace])

  const selectOrder = useCallback(async (order: AcceptanceOrder) => {
    if (order.id === currentOrder?.id) return
    if (dirty && !window.confirm('当前验收单有未保存的导入结果。切换后将放弃这些更改，是否继续？')) return
    await loadWorkspace(order)
  }, [currentOrder?.id, dirty, loadWorkspace])

  const createOrder = useCallback(async (input: Omit<AcceptanceOrder, 'id' | 'createdAt'>) => {
    if (dirty && !window.confirm('当前验收单有未保存的导入结果。新建后将放弃这些更改，是否继续？')) return null
    const order = await run(() => window.traceMatch.orders.create(input), '正在新建验收单…')
    if (!order) return null
    const nextOrders = [order, ...orders]
    setOrders(nextOrders)
    setCurrentOrder(order)
    setShipments([])
    setScans([])
    setPendingShipments(null)
    setPendingScans(null)
    setResults([])
    setStats(emptyStats())
    setDirty(false)
    setStatus('验收单已创建，请先导入平台发货数据。')
    return order
  }, [dirty, orders, run])

  const deleteOrder = useCallback(async (order?: AcceptanceOrder) => {
    const target = order ?? currentOrder
    if (!target) return
    if (!window.confirm(`确定删除验收单 ${target.orderNumber} 吗？\n\n发货数据、扫描记录和比对结果会同时删除。`)) return
    const deletedId = target.id
    const done = await run(() => window.traceMatch.orders.delete(deletedId), '正在删除验收单…')
    if (done === null) return
    const nextOrders = orders.filter((item) => item.id !== deletedId)
    setOrders(nextOrders)
    if (deletedId !== currentOrder?.id) {
      setStatus(`验收单 ${target.orderNumber} 已删除。`)
      return
    }
    setCurrentOrder(null)
    setShipments([])
    setScans([])
    setResults([])
    setStats(emptyStats())
    setDirty(false)
    if (nextOrders[0]) await loadWorkspace(nextOrders[0])
    else setStatus('验收单已删除。')
  }, [currentOrder, loadWorkspace, orders, run])

  const setImportedShipments = useCallback((items: ShipmentItem[], supplier?: string) => {
    setPendingShipments(items)
    setResults([])
    setStats({ ...emptyStats(), expectedCount: new Set(items.map((item) => item.traceCode.toLowerCase())).size })
    setDirty(true)
    if (supplier && currentOrder) setCurrentOrder({ ...currentOrder, supplier })
    setStatus(`已暂存平台发货数据 ${items.length} 行，请继续导入扫描数据。`)
  }, [currentOrder])

  const setImportedScans = useCallback(async (items: ScanRecord[]) => {
    setPendingScans(items)
    const sourceShipments = pendingShipments ?? shipments
    const compared = await run(() => window.traceMatch.compare(sourceShipments, items), '扫描数据已导入，正在比对…')
    if (!compared) return
    setResults(compared.results)
    setStats(compared.stats)
    setDirty(true)
    setStatus(`比对完成：匹配 ${compared.stats.matchedCount}，未到货 ${compared.stats.missingCount}，多到货 ${compared.stats.extraCount}，重复扫码 ${compared.stats.duplicateCount}。`)
  }, [pendingShipments, run, shipments])

  const compare = useCallback(async () => {
    if (!currentOrder) return
    const compared = await run(
      () => window.traceMatch.compare(pendingShipments ?? shipments, pendingScans ?? scans),
      '正在重新比对…'
    )
    if (!compared) return
    setResults(compared.results)
    setStats(compared.stats)
    setDirty(pendingShipments !== null || pendingScans !== null)
    setStatus(`比对完成：共发现 ${compared.stats.missingCount + compared.stats.extraCount + compared.stats.duplicateCount} 条异常记录。`)
  }, [currentOrder, pendingScans, pendingShipments, run, scans, shipments])

  const save = useCallback(async () => {
    if (!currentOrder || !dirty) return
    const nextOrders = await run(() => window.traceMatch.orders.save({
      orderId: currentOrder.id,
      supplier: currentOrder.supplier,
      shipments: pendingShipments,
      scans: pendingScans,
      results
    }), '正在保存记录…')
    if (!nextOrders) return
    setOrders(nextOrders)
    setShipments(pendingShipments ?? shipments)
    setScans(pendingScans ?? scans)
    setPendingShipments(null)
    setPendingScans(null)
    setDirty(false)
    setStatus('记录已保存到本地 SQLite 数据库。')
  }, [currentOrder, dirty, pendingScans, pendingShipments, results, run, scans, shipments])

  return {
    orders, currentOrder, shipments: pendingShipments ?? shipments, scans: pendingScans ?? scans,
    results, stats, dirty, busy, status, setStatus, selectOrder, createOrder, deleteOrder,
    setImportedShipments, setImportedScans, compare, save
  }
}
