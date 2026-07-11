import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { statusLabels, type ExportPayload } from '../../shared/types'

const reportHeaders = ['状态', '追溯码', '药品名称', '规格', '批号', '生产企业', '生产日期', '有效期', '数量', '扫描时间']

function addDetailWorksheet(workbook: ExcelJS.Workbook, title: string, results: ExportPayload['results']): void {
  const detail = workbook.addWorksheet(title)
  detail.addRow(reportHeaders)
  detail.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173D32' } }
  for (const item of results) {
    detail.addRow([
      statusLabels[item.status], item.traceCode, item.drugName, item.specification, item.batchNumber, item.manufacturer,
      item.productionDate, item.expiryDate, item.quantity, item.scannedAt ? new Date(item.scannedAt).toLocaleString('zh-CN') : ''
    ])
  }
  ;[12, 28, 24, 16, 18, 28, 15, 15, 10, 22].forEach((width, index) => { detail.getColumn(index + 1).width = width })
  detail.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function exportExcel(filePath: string, payload: ExportPayload): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'TraceMatch'
  const summary = workbook.addWorksheet('汇总')
  const rows: [string, string | number][] = [
    ['验收单号', payload.order.orderNumber], ['供应商', payload.order.supplier], ['操作员', payload.order.operator],
    ['创建时间', payload.order.createdAt], ['应到数量', payload.stats.expectedCount], ['扫描数量', payload.stats.scannedCount],
    ['匹配数量', payload.stats.matchedCount], ['未到货数量', payload.stats.missingCount], ['多到货数量', payload.stats.extraCount],
    ['重复扫码数量', payload.stats.duplicateCount]
  ]
  summary.addRows(rows)
  summary.getColumn(1).width = 18
  summary.getColumn(2).width = 38
  summary.getColumn(1).font = { bold: true }

  addDetailWorksheet(workbook, '异常明细', payload.results.filter((result) => result.status !== 1))
  addDetailWorksheet(workbook, '全部明细', payload.results)
  await workbook.xlsx.writeFile(filePath)
}

function findChineseFont(): string | null {
  // PDFKit cannot subset Windows TTC font collections such as msyh.ttc.
  const candidates = [
    path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', 'simhei.ttf')
  ]
  return candidates.find(fs.existsSync) ?? null
}

export async function exportPdf(filePath: string, payload: ExportPayload): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `${payload.order.orderNumber}-验收报告` } })
    const stream = fs.createWriteStream(filePath)
    document.pipe(stream)
    const font = findChineseFont()
    if (font) document.font(font)
    document.fontSize(19).fillColor('#17221D').text('药品追溯码到货比对验收报告')
    document.moveDown(0.35).fontSize(10).fillColor('#68756E').text(`${payload.order.orderNumber} / ${payload.order.supplier || '未填写供应商'} / 操作员 ${payload.order.operator}`)
    document.moveDown(1)
    const stats = [
      ['应到', payload.stats.expectedCount], ['扫描', payload.stats.scannedCount], ['匹配', payload.stats.matchedCount],
      ['未到货', payload.stats.missingCount], ['多到货', payload.stats.extraCount], ['重复扫码', payload.stats.duplicateCount]
    ] as const
    document.fontSize(10).fillColor('#17221D')
    stats.forEach(([label, value], index) => document.text(`${label}：${value}`, 42 + (index % 3) * 170, 108 + Math.floor(index / 3) * 22, { width: 160 }))

    const writeDetails = (title: string, items: ExportPayload['results'], startOnNewPage: boolean) => {
      if (startOnNewPage) document.addPage()
      document.fontSize(13).fillColor('#17221D').text(title)
      document.moveDown(0.5).fontSize(8)
      if (items.length === 0) {
        document.fillColor('#68756E').text('暂无记录')
        return
      }
      for (const item of items) {
        if (document.y > 760) {
          document.addPage()
          document.fontSize(13).fillColor('#17221D').text(`${title}（续）`)
          document.moveDown(0.5).fontSize(8)
        }
        document.fillColor(item.status === 1 ? '#17623B' : item.status === 3 ? '#B93A3A' : item.status === 2 ? '#C47A16' : '#9B7315')
          .text(statusLabels[item.status], 42, document.y, { width: 55, continued: true })
          .fillColor('#17221D').text(`  ${item.traceCode}  ${item.drugName || '—'}  ${item.batchNumber || '—'}`, { width: 490 })
        document.moveDown(0.25)
      }
    }
    document.y = 166
    writeDetails('异常明细', payload.results.filter((result) => result.status !== 1), false)
    writeDetails('全部记录', payload.results, true)
    document.end()
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}
