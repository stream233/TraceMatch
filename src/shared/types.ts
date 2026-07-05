export const ImportFields = {
  traceCode: '追溯码',
  drugName: '药品名称',
  specification: '规格',
  batchNumber: '批号',
  manufacturer: '生产企业',
  productionDate: '生产日期',
  expiryDate: '有效期',
  quantity: '数量',
  scannedAt: '扫描时间',
  supplier: '供应商',
  platformOrderNumber: '平台单号'
} as const

export type ImportKind = 'shipment' | 'scan'
export type TraceCodeStatus = 1 | 2 | 3 | 4
export type ResultFilter = 'all' | 'abnormal' | TraceCodeStatus

export interface AcceptanceOrder {
  id: number
  orderNumber: string
  supplier: string
  operator: string
  createdAt: string
  remark: string
  drugInfo?: string
}

export interface ShipmentItem {
  id?: number
  orderId: number
  traceCode: string
  drugName: string
  specification: string
  batchNumber: string
  manufacturer: string
  productionDate: string
  expiryDate: string
  quantity: number
}

export interface ScanRecord {
  id?: number
  orderId: number
  traceCode: string
  scannedAt: string | null
  sourceFile: string
}

export interface ComparisonResult {
  id?: number
  orderId: number
  traceCode: string
  drugName: string
  specification: string
  batchNumber: string
  manufacturer: string
  productionDate: string
  expiryDate: string
  quantity: number
  scannedAt: string | null
  status: TraceCodeStatus
}

export interface SummaryStats {
  expectedCount: number
  scannedCount: number
  matchedCount: number
  missingCount: number
  extraCount: number
  duplicateCount: number
}

export interface ImportTable {
  headers: string[]
  rows: Record<string, string>[]
  metadata: Record<string, string>
}

export interface PickedImport {
  path: string
  fileName: string
  table: ImportTable
}

export type FieldMapping = Record<string, string | null>

export interface OrderWorkspace {
  order: AcceptanceOrder
  shipments: ShipmentItem[]
  scans: ScanRecord[]
  results: ComparisonResult[]
  stats: SummaryStats
}

export interface SaveWorkspacePayload {
  orderId: number
  supplier?: string
  shipments: ShipmentItem[] | null
  scans: ScanRecord[] | null
  results: ComparisonResult[]
}

export interface ExportPayload {
  format: 'xlsx' | 'pdf'
  order: AcceptanceOrder
  stats: SummaryStats
  results: ComparisonResult[]
}

export interface ReleaseInfo {
  currentVersion: string
  latestVersion: string
  name: string
  body: string
  releasePageUrl: string
  downloadUrl: string
  hasUpdate: boolean
}

export interface AppSettings {
  pinAbnormalResults: boolean
}

export interface TraceMatchApi {
  app: {
    getVersion(): Promise<string>
    openExternal(url: string): Promise<void>
    copyText(text: string): Promise<void>
  }
  orders: {
    list(): Promise<AcceptanceOrder[]>
    create(input: Omit<AcceptanceOrder, 'id' | 'createdAt'>): Promise<AcceptanceOrder>
    delete(id: number): Promise<void>
    workspace(id: number): Promise<OrderWorkspace>
    save(payload: SaveWorkspacePayload): Promise<AcceptanceOrder[]>
  }
  imports: {
    pick(kind: ImportKind): Promise<PickedImport | null>
    shipments(table: ImportTable, mapping: FieldMapping, orderId: number): Promise<ShipmentItem[]>
    scans(table: ImportTable, mapping: FieldMapping, orderId: number, sourceFile: string): Promise<ScanRecord[]>
  }
  compare(shipments: ShipmentItem[], scans: ScanRecord[]): Promise<{ results: ComparisonResult[]; stats: SummaryStats }>
  exportReport(payload: ExportPayload): Promise<string | null>
  settings: {
    get(): Promise<AppSettings>
    update(settings: AppSettings): Promise<AppSettings>
  }
  update: {
    check(): Promise<ReleaseInfo>
  }
}

export const emptyStats = (): SummaryStats => ({
  expectedCount: 0,
  scannedCount: 0,
  matchedCount: 0,
  missingCount: 0,
  extraCount: 0,
  duplicateCount: 0
})

export const statusLabels: Record<TraceCodeStatus, string> = {
  1: '匹配',
  2: '未到货',
  3: '多到货',
  4: '重复扫码'
}
