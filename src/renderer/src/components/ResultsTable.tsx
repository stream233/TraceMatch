import { ArrowDown, ArrowDownUp, ArrowUp, Barcode, ClipboardCopy, Search, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useMemo, useState, type KeyboardEvent } from 'react'
import { statusLabels, type ComparisonResult, type ResultFilter, type TraceCodeStatus } from '../../../shared/types'
import { DrugDetailPanel } from './DrugDetailPanel'

interface Props {
  results: ComparisonResult[]
  pinAbnormalResults: boolean
  onStatus(message: string): void
}

const filters: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'abnormal', label: '仅异常' }, { value: 1, label: '匹配' },
  { value: 2, label: '未到货' }, { value: 3, label: '多到货' }, { value: 4, label: '重复扫码' }
]

type SortKey = 'status' | 'traceCode' | 'drugName' | 'specification' | 'batchNumber' | 'manufacturer' | 'productionDate' | 'expiryDate' | 'quantity' | 'scannedAt'
type SortDirection = 'asc' | 'desc'

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'status', label: '状态' }, { key: 'traceCode', label: '追溯码' }, { key: 'drugName', label: '药品名称' },
  { key: 'specification', label: '规格' }, { key: 'batchNumber', label: '批号' }, { key: 'manufacturer', label: '生产企业' },
  { key: 'productionDate', label: '生产日期' }, { key: 'expiryDate', label: '有效期' }, { key: 'quantity', label: '数量', numeric: true },
  { key: 'scannedAt', label: '扫描时间' }
]

function compareResults(left: ComparisonResult, right: ComparisonResult, key: SortKey): number {
  if (key === 'status' || key === 'quantity') return left[key] - right[key]
  return (left[key] ?? '').localeCompare(right[key] ?? '', 'zh-CN', { numeric: true, sensitivity: 'base' })
}

export function ResultsTable({ results, pinAbnormalResults, onStatus }: Props) {
  const [filter, setFilter] = useState<ResultFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedResult, setSelectedResult] = useState<ComparisonResult | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const visible = useMemo(() => results
    .filter((item) => {
      const matchesFilter = filter === 'all' || (filter === 'abnormal' ? item.status !== 1 : item.status === filter)
      if (!matchesFilter) return false
      if (!deferredQuery) return true
      return `${item.traceCode} ${item.drugName} ${item.batchNumber} ${item.manufacturer}`.toLowerCase().includes(deferredQuery)
    })
    .sort((a, b) => {
      if (sort) {
        const comparison = compareResults(a, b, sort.key)
        return sort.direction === 'asc' ? comparison : -comparison
      }
      if (pinAbnormalResults) {
        const abnormalOrder = Number(a.status === 1) - Number(b.status === 1)
        if (abnormalOrder !== 0) return abnormalOrder
      }
      return (b.scannedAt ?? '').localeCompare(a.scannedAt ?? '') || (b.id ?? 0) - (a.id ?? 0)
    }), [deferredQuery, filter, pinAbnormalResults, results, sort])

  const toggleSort = (key: SortKey) => {
    setSort((current) => current?.key === key && current.direction === 'asc'
      ? { key, direction: 'desc' }
      : { key, direction: 'asc' })
  }

  const handleSortKeyDown = (event: KeyboardEvent<HTMLTableCellElement>, key: SortKey) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleSort(key)
  }

  const copyCode = async (code: string) => {
    await window.traceMatch.app.copyText(code)
    onStatus(`已复制追溯码：${code}`)
  }

  return (
    <section className="results-panel">
      <header className="results-controls">
        <div className="filter-tabs" role="tablist" aria-label="结果筛选">
          <SlidersHorizontal size={15} />
          {filters.map((item) => <button type="button" role="tab" aria-selected={filter === item.value} className={filter === item.value ? 'is-active' : ''} onClick={() => setFilter(item.value)} key={item.label}>{item.label}</button>)}
        </div>
        <label className="result-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索追溯码、药品、批号或企业" /><span>{visible.length} 条</span></label>
      </header>
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((column) => {
            const isSorted = sort?.key === column.key
            const SortIcon = !isSorted ? ArrowDownUp : sort.direction === 'asc' ? ArrowUp : ArrowDown
            const directionLabel = isSorted ? (sort.direction === 'asc' ? '升序' : '降序') : '未排序'
            return <th key={column.key} className={`is-sortable${column.numeric ? ' number-cell' : ''}${isSorted ? ' is-sorted' : ''}`}
              aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} tabIndex={0}
              title={`双击按${column.label}${isSorted ? `切换为${sort.direction === 'asc' ? '降序' : '升序'}` : '升序'}排列`}
              onDoubleClick={() => toggleSort(column.key)} onKeyDown={(event) => handleSortKeyDown(event, column.key)}>
              <span className={`table-sort-label${column.numeric ? ' table-sort-label--number' : ''}`}>{column.label}<SortIcon size={13} aria-label={directionLabel} /></span>
            </th>
          })}</tr></thead>
          <tbody>
            {visible.map((item, index) => (
              <tr className={`${item.status === 1 ? '' : 'is-abnormal'}${selectedResult === item ? ' is-selected' : ''}`}
                key={`${item.traceCode}-${item.scannedAt ?? 'missing'}-${index}`} tabIndex={0} title="点击查看药品信息"
                onClick={() => setSelectedResult(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedResult(item)
                  }
                }}>
                <td><span className={`status status--${item.status}`}>{statusLabels[item.status as TraceCodeStatus]}</span></td>
                <td><button className="code-button" title="点击复制追溯码" onClick={(event) => { event.stopPropagation(); void copyCode(item.traceCode) }}>{item.traceCode}<ClipboardCopy size={13} /></button></td>
                <td>{item.drugName || '—'}</td><td>{item.specification || '—'}</td><td>{item.batchNumber || '—'}</td><td>{item.manufacturer || '—'}</td>
                <td>{item.productionDate || '—'}</td><td>{item.expiryDate || '—'}</td><td className="number-cell">{item.quantity}</td>
                <td>{item.scannedAt ? new Date(item.scannedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? <div className="table-empty"><Barcode size={28} /><strong>{results.length === 0 ? '暂无比对结果' : '没有符合筛选条件的记录'}</strong><span>{results.length === 0 ? '导入发货数据和扫描数据后，结果会显示在这里。' : '调整状态筛选或搜索条件。'}</span></div> : null}
      </div>
      {selectedResult ? <DrugDetailPanel item={selectedResult} onClose={() => setSelectedResult(null)} onCopy={copyCode} /> : null}
    </section>
  )
}
