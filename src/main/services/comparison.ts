import { emptyStats, type ComparisonResult, type ScanRecord, type ShipmentItem } from '../../shared/types'

const normalize = (value: string): string => value.toLocaleLowerCase('zh-CN')

export function compareRecords(shipments: ShipmentItem[], scans: ScanRecord[]): { results: ComparisonResult[]; stats: ReturnType<typeof emptyStats> } {
  const shipmentByCode = new Map<string, ShipmentItem>()
  for (const shipment of shipments) {
    const key = normalize(shipment.traceCode)
    if (!shipmentByCode.has(key)) shipmentByCode.set(key, shipment)
  }
  const scansByCode = new Map<string, ScanRecord[]>()
  for (const scan of scans) {
    const key = normalize(scan.traceCode)
    scansByCode.set(key, [...(scansByCode.get(key) ?? []), scan])
  }

  const results: ComparisonResult[] = [...scans]
    .sort((a, b) => (b.scannedAt ?? '').localeCompare(a.scannedAt ?? ''))
    .map((scan) => {
      const shipment = shipmentByCode.get(normalize(scan.traceCode))
      const duplicate = (scansByCode.get(normalize(scan.traceCode))?.length ?? 0) > 1
      return {
        orderId: scan.orderId,
        traceCode: scan.traceCode,
        drugName: shipment?.drugName ?? '',
        specification: shipment?.specification ?? '',
        batchNumber: shipment?.batchNumber ?? '',
        manufacturer: shipment?.manufacturer ?? '',
        productionDate: shipment?.productionDate ?? '',
        expiryDate: shipment?.expiryDate ?? '',
        quantity: shipment?.quantity ?? 0,
        scannedAt: scan.scannedAt,
        status: duplicate ? 4 : shipment ? 1 : 3
      }
    })

  for (const shipment of shipments) {
    if (!scansByCode.has(normalize(shipment.traceCode))) {
      results.push({ ...shipment, scannedAt: null, status: 2 })
    }
  }

  results.sort((a, b) => {
    const abnormalDelta = Number(a.status === 1) - Number(b.status === 1)
    return abnormalDelta || (b.scannedAt ?? '').localeCompare(a.scannedAt ?? '') || (b.id ?? 0) - (a.id ?? 0)
  })

  const stats = emptyStats()
  stats.expectedCount = shipmentByCode.size
  stats.scannedCount = scans.length
  stats.matchedCount = results.filter((item) => item.status === 1).length
  stats.missingCount = results.filter((item) => item.status === 2).length
  stats.extraCount = results.filter((item) => item.status === 3).length
  stats.duplicateCount = results.filter((item) => item.status === 4).length
  return { results, stats }
}
