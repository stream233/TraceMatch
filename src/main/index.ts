import path from 'node:path'
import { app, BrowserWindow, session, shell } from 'electron'
import { TraceMatchDatabase } from './database'
import { registerIpc } from './ipc'
import { UserSettings } from './settings'

let database: TraceMatchDatabase | null = null

function createWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'TraceMatch.ico')
    : path.join(app.getAppPath(), 'Assets', 'TraceMatch.ico')
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#F3F5F2',
    icon: iconPath,
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/stream233/TraceMatch')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL()
    if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(path.join(import.meta.dirname, '../renderer/index.html'))
  return mainWindow
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.tracematch.desktop')
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  const localAppData = process.env.LOCALAPPDATA ?? path.dirname(app.getPath('appData'))
  const dataDirectory = process.env.TRACEMATCH_DATA_DIR ?? path.join(localAppData, 'TraceMatch')
  database = new TraceMatchDatabase(path.join(dataDirectory, 'tracematch.db'))
  registerIpc(database, new UserSettings(path.join(dataDirectory, 'settings.json')))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  database?.close()
  database = null
})
