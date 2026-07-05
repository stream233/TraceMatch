import { contextBridge, ipcRenderer } from 'electron'
import type { TraceMatchApi } from '../shared/types'

const api: TraceMatchApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    copyText: (text) => ipcRenderer.invoke('app:copy-text', text)
  },
  orders: {
    list: () => ipcRenderer.invoke('orders:list'),
    search: (query) => ipcRenderer.invoke('orders:search', query),
    nextNumber: () => ipcRenderer.invoke('orders:next-number'),
    create: (input) => ipcRenderer.invoke('orders:create', input),
    delete: (id) => ipcRenderer.invoke('orders:delete', id),
    workspace: (id) => ipcRenderer.invoke('orders:workspace', id),
    save: (payload) => ipcRenderer.invoke('orders:save', payload)
  },
  imports: {
    pick: (kind) => ipcRenderer.invoke('imports:pick', kind),
    shipments: (table, mapping, orderId) => ipcRenderer.invoke('imports:shipments', table, mapping, orderId),
    scans: (table, mapping, orderId, sourceFile) => ipcRenderer.invoke('imports:scans', table, mapping, orderId, sourceFile)
  },
  compare: (shipments, scans) => ipcRenderer.invoke('compare:run', shipments, scans),
  exportReport: (payload) => ipcRenderer.invoke('report:export', payload),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings)
  },
  update: {
    check: () => ipcRenderer.invoke('update:check')
  }
}

contextBridge.exposeInMainWorld('traceMatch', api)
