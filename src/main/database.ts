import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  AcceptanceOrder,
  ComparisonResult,
  OrderWorkspace,
  SaveWorkspacePayload,
  ScanRecord,
  ShipmentItem,
  SummaryStats,
  TraceCodeStatus
} from '../shared/types'
import { compareRecords } from './services/comparison'
import { acceptanceOrderNumberPrefix, nextAcceptanceOrderNumber } from '../shared/orderNumbers'

const schema = `
CREATE TABLE IF NOT EXISTS acceptance_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at TEXT NOT NULL,
  remark TEXT NULL
);
CREATE TABLE IF NOT EXISTS shipment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  trace_code TEXT NOT NULL,
  drug_name TEXT NULL,
  specification TEXT NULL,
  batch_number TEXT NULL,
  manufacturer TEXT NULL,
  production_date TEXT NULL,
  expiry_date TEXT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_shipment_order_code ON shipment_items(order_id, trace_code);
CREATE TABLE IF NOT EXISTS scan_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  trace_code TEXT NOT NULL,
  scanned_at TEXT NULL,
  source_file TEXT NULL,
  FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_scan_order_code ON scan_records(order_id, trace_code);
CREATE INDEX IF NOT EXISTS ix_scan_order_time ON scan_records(order_id, scanned_at DESC);
CREATE TABLE IF NOT EXISTS comparison_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  trace_code TEXT NOT NULL,
  drug_name TEXT NULL,
  specification TEXT NULL,
  batch_number TEXT NULL,
  manufacturer TEXT NULL,
  production_date TEXT NULL,
  expiry_date TEXT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  scanned_at TEXT NULL,
  status INTEGER NOT NULL,
  compared_at TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES acceptance_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_result_order_status ON comparison_results(order_id, status);
CREATE INDEX IF NOT EXISTS ix_result_order_time ON comparison_results(order_id, scanned_at DESC);
`

type Row = Record<string, unknown>

const asString = (value: unknown): string => (value == null ? '' : String(value))
const asOptionalString = (value: unknown): string | null => (value == null || value === '' ? null : String(value))

export class TraceMatchDatabase {
  private readonly db: DatabaseSync

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath)
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(schema)
    this.ensureColumn('shipment_items', 'production_date', 'TEXT NULL')
    this.ensureColumn('comparison_results', 'production_date', 'TEXT NULL')
  }

  close(): void {
    this.db.close()
  }

  listOrders(): AcceptanceOrder[] {
    const rows = this.db.prepare(`
      SELECT o.id, o.order_number, o.supplier, o.operator, o.created_at, o.remark,
             (SELECT drug_name FROM shipment_items s WHERE s.order_id = o.id AND drug_name IS NOT NULL AND drug_name <> '' LIMIT 1) AS drug_info
      FROM acceptance_orders o
      ORDER BY datetime(o.created_at) DESC, o.id DESC
      LIMIT 200
    `).all() as Row[]
    return rows.map(this.mapOrder)
  }

  searchOrders(query: string): AcceptanceOrder[] {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return this.listOrders()

    const escapedQuery = normalizedQuery.replace(/[\\%_]/g, '\\$&')
    const pattern = `%${escapedQuery}%`
    const rows = this.db.prepare(`
      SELECT o.id, o.order_number, o.supplier, o.operator, o.created_at, o.remark,
             (SELECT drug_name FROM shipment_items s WHERE s.order_id = o.id AND drug_name IS NOT NULL AND drug_name <> '' LIMIT 1) AS drug_info
      FROM acceptance_orders o
      WHERE o.order_number LIKE ? ESCAPE '\\'
         OR o.supplier LIKE ? ESCAPE '\\'
         OR EXISTS (
           SELECT 1 FROM shipment_items s
           WHERE s.order_id = o.id
             AND (s.trace_code LIKE ? ESCAPE '\\'
               OR s.batch_number LIKE ? ESCAPE '\\'
               OR s.drug_name LIKE ? ESCAPE '\\')
         )
         OR EXISTS (
           SELECT 1 FROM scan_records s
           WHERE s.order_id = o.id AND s.trace_code LIKE ? ESCAPE '\\'
         )
         OR EXISTS (
           SELECT 1 FROM comparison_results r
           WHERE r.order_id = o.id
             AND (r.trace_code LIKE ? ESCAPE '\\'
               OR r.batch_number LIKE ? ESCAPE '\\'
               OR r.drug_name LIKE ? ESCAPE '\\')
         )
      ORDER BY datetime(o.created_at) DESC, o.id DESC
      LIMIT 200
    `).all(...Array(9).fill(pattern)) as Row[]
    return rows.map(this.mapOrder)
  }

  getNextOrderNumber(date = new Date()): string {
    const prefix = acceptanceOrderNumberPrefix(date)
    const rows = this.db.prepare(`
      SELECT order_number FROM acceptance_orders
      WHERE order_number LIKE ?
    `).all(`${prefix}%`) as Row[]
    return nextAcceptanceOrderNumber(rows.map((row) => asString(row.order_number)), date)
  }

  createOrder(input: Omit<AcceptanceOrder, 'id' | 'createdAt'>): AcceptanceOrder {
    const createdAt = new Date().toISOString()
    const result = this.db.prepare(`
      INSERT INTO acceptance_orders(order_number, supplier, operator, created_at, remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.orderNumber.trim(), input.supplier.trim(), input.operator.trim(), createdAt, input.remark.trim())
    return {
      id: Number(result.lastInsertRowid),
      orderNumber: input.orderNumber.trim(),
      supplier: input.supplier.trim(),
      operator: input.operator.trim(),
      createdAt,
      remark: input.remark.trim()
    }
  }

  deleteOrder(orderId: number): void {
    this.db.prepare('DELETE FROM acceptance_orders WHERE id = ?').run(orderId)
  }

  getWorkspace(orderId: number): OrderWorkspace {
    const orderRow = this.db.prepare(`
      SELECT id, order_number, supplier, operator, created_at, remark
      FROM acceptance_orders WHERE id = ?
    `).get(orderId) as Row | undefined
    if (!orderRow) throw new Error('验收单不存在或已被删除。')

    const shipments = (this.db.prepare(`
      SELECT id, order_id, trace_code, drug_name, specification, batch_number, manufacturer, production_date, expiry_date, quantity
      FROM shipment_items WHERE order_id = ?
    `).all(orderId) as Row[]).map(this.mapShipment)
    const scans = (this.db.prepare(`
      SELECT id, order_id, trace_code, scanned_at, source_file
      FROM scan_records WHERE order_id = ? ORDER BY datetime(scanned_at) DESC, id DESC
    `).all(orderId) as Row[]).map(this.mapScan)
    let results = (this.db.prepare(`
      SELECT id, order_id, trace_code, drug_name, specification, batch_number, manufacturer, production_date, expiry_date, quantity, scanned_at, status
      FROM comparison_results WHERE order_id = ?
      ORDER BY status = 1, datetime(scanned_at) DESC, id DESC
    `).all(orderId) as Row[]).map(this.mapResult)

    const compared = compareRecords(shipments, scans)
    if (results.length === 0 && (shipments.length > 0 || scans.length > 0)) results = compared.results
    const stats = results.length > 0 ? this.statsFromResults(results) : compared.stats
    return { order: this.mapOrder(orderRow), shipments, scans, results, stats }
  }

  saveWorkspace(payload: SaveWorkspacePayload): AcceptanceOrder[] {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      if (payload.shipments) {
        this.db.prepare('DELETE FROM shipment_items WHERE order_id = ?').run(payload.orderId)
        const insert = this.db.prepare(`
          INSERT INTO shipment_items(order_id, trace_code, drug_name, specification, batch_number, manufacturer, production_date, expiry_date, quantity)
          VALUES (@orderId, @traceCode, @drugName, @specification, @batchNumber, @manufacturer, @productionDate, @expiryDate, @quantity)
        `)
        for (const item of payload.shipments) insert.run(item as unknown as Record<string, string | number | null>)
      }
      if (payload.scans) {
        this.db.prepare('DELETE FROM scan_records WHERE order_id = ?').run(payload.orderId)
        const insert = this.db.prepare(`
          INSERT INTO scan_records(order_id, trace_code, scanned_at, source_file)
          VALUES (@orderId, @traceCode, @scannedAt, @sourceFile)
        `)
        for (const item of payload.scans) insert.run(item as unknown as Record<string, string | number | null>)
      }

      this.db.prepare('DELETE FROM comparison_results WHERE order_id = ?').run(payload.orderId)
      const insertResult = this.db.prepare(`
        INSERT INTO comparison_results(order_id, trace_code, drug_name, specification, batch_number, manufacturer, production_date, expiry_date, quantity, scanned_at, status, compared_at)
        VALUES (@orderId, @traceCode, @drugName, @specification, @batchNumber, @manufacturer, @productionDate, @expiryDate, @quantity, @scannedAt, @status, @comparedAt)
      `)
      const comparedAt = new Date().toISOString()
      for (const result of payload.results) insertResult.run({ ...result, comparedAt } as unknown as Record<string, string | number | null>)
      if (payload.supplier != null) {
        this.db.prepare('UPDATE acceptance_orders SET supplier = ? WHERE id = ?').run(payload.supplier.trim(), payload.orderId)
      }
      this.db.exec('COMMIT;')
    } catch (error) {
      this.db.exec('ROLLBACK;')
      throw error
    }
    return this.listOrders()
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!columns.some((item) => item.name.toLowerCase() === column.toLowerCase())) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }

  private statsFromResults(results: ComparisonResult[]): SummaryStats {
    return {
      expectedCount: results.filter((item) => item.status === 1 || item.status === 2 || item.status === 4).length,
      scannedCount: results.filter((item) => item.status === 1 || item.status === 3 || item.status === 4).length,
      matchedCount: results.filter((item) => item.status === 1).length,
      missingCount: results.filter((item) => item.status === 2).length,
      extraCount: results.filter((item) => item.status === 3).length,
      duplicateCount: results.filter((item) => item.status === 4).length
    }
  }

  private mapOrder = (row: Row): AcceptanceOrder => ({
    id: Number(row.id),
    orderNumber: asString(row.order_number),
    supplier: asString(row.supplier),
    operator: asString(row.operator),
    createdAt: asString(row.created_at),
    remark: asString(row.remark),
    drugInfo: asString(row.drug_info) || undefined
  })

  private mapShipment = (row: Row): ShipmentItem => ({
    id: Number(row.id), orderId: Number(row.order_id), traceCode: asString(row.trace_code), drugName: asString(row.drug_name),
    specification: asString(row.specification), batchNumber: asString(row.batch_number), manufacturer: asString(row.manufacturer),
    productionDate: asString(row.production_date), expiryDate: asString(row.expiry_date), quantity: Number(row.quantity ?? 1)
  })

  private mapScan = (row: Row): ScanRecord => ({
    id: Number(row.id), orderId: Number(row.order_id), traceCode: asString(row.trace_code),
    scannedAt: asOptionalString(row.scanned_at), sourceFile: asString(row.source_file)
  })

  private mapResult = (row: Row): ComparisonResult => ({
    id: Number(row.id), orderId: Number(row.order_id), traceCode: asString(row.trace_code), drugName: asString(row.drug_name),
    specification: asString(row.specification), batchNumber: asString(row.batch_number), manufacturer: asString(row.manufacturer),
    productionDate: asString(row.production_date), expiryDate: asString(row.expiry_date), quantity: Number(row.quantity ?? 0),
    scannedAt: asOptionalString(row.scanned_at), status: Number(row.status) as TraceCodeStatus
  })
}
