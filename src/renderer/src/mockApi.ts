import {
  emptyStats,
  type AcceptanceOrder,
  type ComparisonResult,
  type ScanRecord,
  type ShipmentItem,
  type TraceMatchApi
} from '../../shared/types'
import { nextAcceptanceOrderNumber } from '../../shared/orderNumbers'

const order: AcceptanceOrder = {
  id: 1,
  orderNumber: 'YS20260704142638',
  supplier: '国药控股',
  operator: '211',
  createdAt: '2026-07-04T14:26:38.000Z',
  remark: '7 月第一批到货',
  drugInfo: '阿莫西林胶囊'
}

const statuses = [2, 3, 4, 4, 1, 1, 1, 1] as const
const names = ['阿莫西林胶囊', '布洛芬缓释胶囊', '盐酸二甲双胍片', '盐酸二甲双胍片', '维生素 C 片', '蒙脱石散', '氯雷他定片', '头孢克肟颗粒']
const results: ComparisonResult[] = statuses.map((status, index) => ({
  orderId: 1,
  traceCode: `836200001917${String(4300 + index).padStart(4, '0')}`,
  drugName: names[index],
  specification: index % 2 ? '0.3g×20片' : '0.25g×24粒',
  batchNumber: `P20260${7 + index}A`,
  manufacturer: index % 2 ? '华北制药股份有限公司' : '国药集团工业有限公司',
  productionDate: '2026-02-18',
  expiryDate: '2028-01-31',
  quantity: status === 3 ? 0 : 1,
  scannedAt: status === 2 ? null : `2026-07-04T06:${String(36 - index).padStart(2, '0')}:12.000Z`,
  status
}))
const resultSearchText = results.map((item) => `${item.traceCode} ${item.batchNumber}`).join(' ')

let orders = [order]
let appSettings = { pinAbnormalResults: true }

export function installMockApi(): void {
  const api: TraceMatchApi = {
    app: { getVersion: async () => '1.0.9-dev', openExternal: async () => undefined, copyText: async () => undefined },
    orders: {
      list: async () => orders,
      search: async (query) => {
        const normalized = query.trim().toLowerCase()
        if (!normalized) return orders
        return orders.filter((item) => `${item.orderNumber} ${item.supplier} ${item.drugInfo ?? ''} ${item.id === order.id ? resultSearchText : ''}`.toLowerCase().includes(normalized))
      },
      nextNumber: async () => nextAcceptanceOrderNumber(orders.map((item) => item.orderNumber)),
      create: async (input) => {
        const created: AcceptanceOrder = { ...input, id: Date.now(), createdAt: new Date().toISOString() }
        orders = [created, ...orders]
        return created
      },
      delete: async (id) => { orders = orders.filter((item) => item.id !== id) },
      workspace: async (id) => {
        const selected = orders.find((item) => item.id === id) ?? order
        return {
          order: selected,
          shipments: [] as ShipmentItem[],
          scans: [] as ScanRecord[],
          results: selected.id === 1 ? results : [],
          stats: selected.id === 1
            ? { expectedCount: 7, scannedCount: 7, matchedCount: 4, missingCount: 1, extraCount: 1, duplicateCount: 2 }
            : emptyStats()
        }
      },
      save: async () => orders
    },
    imports: {
      pick: async () => null,
      shipments: async () => [],
      scans: async () => []
    },
    compare: async () => ({ results, stats: { expectedCount: 7, scannedCount: 7, matchedCount: 4, missingCount: 1, extraCount: 1, duplicateCount: 2 } }),
    exportReport: async () => null,
    settings: {
      get: async () => appSettings,
      update: async (settings) => { appSettings = settings; return appSettings }
    },
    update: { check: async () => ({ currentVersion: '1.0.9-dev', latestVersion: '1.0.9', name: 'TraceMatch 1.0.9', body: '', releasePageUrl: '', downloadUrl: '', hasUpdate: false }) }
  }
  window.traceMatch = api
}
