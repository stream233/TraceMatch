import fs from 'node:fs'
import path from 'node:path'
import iconv from 'iconv-lite'
import { parse } from 'csv-parse/sync'
import { XMLParser } from 'fast-xml-parser'
import * as XLSX from 'xlsx'
import {
  ImportFields,
  type FieldMapping,
  type ImportTable,
  type ScanRecord,
  type ShipmentItem
} from '../../shared/types'

const cleanTraceCode = (value?: string | null): string => (value ?? '').trim().replace(/\s+/gu, '')
const valueAt = (row: Record<string, string>, header: string | null | undefined): string => (header ? row[header] ?? '' : '')

function decodeText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return iconv.decode(buffer, 'gb18030')
  }
}

function detectDelimiter(header: string): string {
  return ['\t', ',', ';', '|']
    .map((delimiter) => ({ delimiter, count: header.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0].delimiter
}

function parseDelimited(lines: string[], delimiter: string, headers?: string[]): ImportTable {
  const records = parse(lines.join('\n'), {
    delimiter,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  }) as string[][]
  const resolvedHeaders = headers ?? (records.shift() ?? []).map((item) => String(item).trim())
  return {
    headers: resolvedHeaders,
    rows: records.map((values) => Object.fromEntries(resolvedHeaders.map((header, index) => [header, String(values[index] ?? '').trim()]))),
    metadata: {}
  }
}

function readText(filePath: string): ImportTable {
  const lines = decodeText(fs.readFileSync(filePath)).replace(/\r\n?/gu, '\n').split('\n').filter((line) => line.trim())
  if (lines.length === 0) return { headers: [], rows: [], metadata: {} }
  const delimiter = detectDelimiter(lines[0])
  const first = lines[0].replace(/^\uFEFF/u, '').trimStart()
  if (!first.startsWith('$')) return parseDelimited(lines, delimiter)

  const metadataValues = (parse([[first.slice(1)].join('')].join('\n'), { delimiter, relax_column_count: true }) as string[][])[0] ?? []
  const metadata: Record<string, string> = {}
  if (metadataValues[0]) metadata[ImportFields.supplier] = String(metadataValues[0]).trim()
  if (metadataValues[1]) metadata[ImportFields.platformOrderNumber] = String(metadataValues[1]).trim()
  const dataLines = lines.filter((line) => {
    const value = line.replace(/^\uFEFF/u, '').trimStart()
    return !value.startsWith('$') && !value.startsWith('#')
  })
  const table = parseDelimited(dataLines, delimiter, [
    ImportFields.traceCode,
    ImportFields.drugName,
    ImportFields.batchNumber,
    ImportFields.productionDate
  ])
  return { ...table, metadata }
}

function readExcel(filePath: string): ImportTable {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) return { headers: [], rows: [], metadata: {} }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: false })
  const headers = (matrix.shift() ?? []).map((value) => String(value).trim())
  return {
    headers,
    rows: matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()]))),
    metadata: {}
  }
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function findDataNodes(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return []
  const object = value as Record<string, unknown>
  const direct = object.Data
  if (direct) return asArray(direct as Record<string, unknown> | Record<string, unknown>[])
  return Object.values(object).flatMap(findDataNodes)
}

function readXml(filePath: string): ImportTable {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  const document = parser.parse(decodeText(fs.readFileSync(filePath))) as unknown
  const headers = [ImportFields.traceCode, ImportFields.scannedAt, 'CorpOrderID', 'Actor', 'FromCorpID', 'ToCorpID', 'AssCorpID']
  const rows = findDataNodes(document).map((node) => ({
    [ImportFields.traceCode]: String(node.Code ?? ''),
    [ImportFields.scannedAt]: String(node.ActDate ?? ''),
    CorpOrderID: String(node.CorpOrderID ?? ''),
    Actor: String(node.Actor ?? ''),
    FromCorpID: String(node.FromCorpID ?? ''),
    ToCorpID: String(node.ToCorpID ?? ''),
    AssCorpID: String(node.AssCorpID ?? '')
  }))
  return { headers, rows, metadata: {} }
}

export function readImportTable(filePath: string): ImportTable {
  const extension = path.extname(filePath).toLowerCase()
  if (['.xlsx', '.xlsm', '.xls'].includes(extension)) return readExcel(filePath)
  if (extension === '.xml') return readXml(filePath)
  if (extension === '.csv' || extension === '.txt') return readText(filePath)
  throw new Error(`不支持的文件格式：${extension}`)
}

export function toShipmentItems(table: ImportTable, mapping: FieldMapping, orderId: number): ShipmentItem[] {
  return table.rows.flatMap((row) => {
    const traceCode = cleanTraceCode(valueAt(row, mapping[ImportFields.traceCode]))
    if (!traceCode) return []
    const quantity = Number.parseFloat(valueAt(row, mapping[ImportFields.quantity]))
    return [{
      orderId,
      traceCode,
      drugName: valueAt(row, mapping[ImportFields.drugName]),
      specification: valueAt(row, mapping[ImportFields.specification]),
      batchNumber: valueAt(row, mapping[ImportFields.batchNumber]),
      manufacturer: valueAt(row, mapping[ImportFields.manufacturer]),
      productionDate: valueAt(row, mapping[ImportFields.productionDate]),
      expiryDate: valueAt(row, mapping[ImportFields.expiryDate]),
      quantity: Number.isFinite(quantity) ? quantity : 1
    }]
  })
}

export function toScanRecords(table: ImportTable, mapping: FieldMapping, orderId: number, sourceFile: string): ScanRecord[] {
  return table.rows.flatMap((row) => {
    const traceCode = cleanTraceCode(valueAt(row, mapping[ImportFields.traceCode]))
    if (!traceCode) return []
    const scannedAtValue = valueAt(row, mapping[ImportFields.scannedAt])
    const scannedAtDate = scannedAtValue ? new Date(scannedAtValue) : null
    return [{
      orderId,
      traceCode,
      scannedAt: scannedAtDate && !Number.isNaN(scannedAtDate.valueOf()) ? scannedAtDate.toISOString() : null,
      sourceFile: path.basename(sourceFile)
    }]
  })
}
