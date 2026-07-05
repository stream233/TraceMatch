import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, ImportKind } from '../shared/types'

interface SettingsFile {
  LastImportDirectory?: string
  LastShipmentImportDirectory?: string
  LastScanImportDirectory?: string
  lastImportDirectory?: string
  lastShipmentImportDirectory?: string
  lastScanImportDirectory?: string
  PinAbnormalResults?: boolean
  pinAbnormalResults?: boolean
}

export class UserSettings {
  private data: SettingsFile = {}

  constructor(private readonly filePath: string) {
    try {
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SettingsFile
    } catch {
      this.data = {}
    }
  }

  getImportDirectory(kind: ImportKind): string | undefined {
    const preferred = kind === 'shipment'
      ? this.data.LastShipmentImportDirectory ?? this.data.lastShipmentImportDirectory
      : this.data.LastScanImportDirectory ?? this.data.lastScanImportDirectory
    const fallback = this.data.LastImportDirectory ?? this.data.lastImportDirectory
    return [preferred, fallback].find((candidate) => candidate && fs.existsSync(candidate))
  }

  setImportDirectory(kind: ImportKind, directory: string): void {
    if (!fs.existsSync(directory)) return
    if (kind === 'shipment') this.data.LastShipmentImportDirectory = directory
    else this.data.LastScanImportDirectory = directory
    this.save()
  }

  getAppSettings(): AppSettings {
    return {
      pinAbnormalResults: this.data.PinAbnormalResults ?? this.data.pinAbnormalResults ?? false
    }
  }

  updateAppSettings(settings: AppSettings): AppSettings {
    this.data.PinAbnormalResults = settings.pinAbnormalResults
    delete this.data.pinAbnormalResults
    this.save()
    return this.getAppSettings()
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }
}
