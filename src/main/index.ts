import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { PassDatabase } from './db'
import { AttendanceService } from './attendance'
import { SettingsService } from './settings'
import { PinService } from './pin'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | undefined

async function createWindow(): Promise<void> {
  const db = new PassDatabase()
  await db.initialize()
  const settings = new SettingsService(db)
  const pin = new PinService(db)
  const attendance = new AttendanceService(db, settings, pin)
  registerIpc(db, attendance, settings, pin)

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === 'media'))
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media')

  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 760, minHeight: 540,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  mainWindow.on('closed', () => { mainWindow = undefined })
}

app.whenReady().then(createWindow).catch(error => {
  console.error('PASS failed to start:', error)
  app.quit()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!mainWindow) void createWindow() })
