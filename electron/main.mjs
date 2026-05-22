import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(homedir(), '.helios-app', 'data')

function ensureDataDir() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f172a',
    show: false,
  })

  win.once('ready-to-show', () => win.show())

  win.loadURL('http://localhost:5173').catch(() => {
    win.loadFile(join(__dirname, '../dist/index.html'))
  })
}

ipcMain.handle('save-readings', (_event, readings) => {
  ensureDataDir()
  const byDate = {}
  for (const r of readings) {
    const date = new Date(r.timestamp).toISOString().split('T')[0]
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(r)
  }
  for (const [date, dayReadings] of Object.entries(byDate)) {
    const filePath = join(dataDir, `${date}.json`)
    let existing = []
    if (existsSync(filePath)) {
      try { existing = JSON.parse(readFileSync(filePath, 'utf8')) } catch {}
    }
    writeFileSync(filePath, JSON.stringify([...existing, ...dayReadings]))
  }
  return true
})

ipcMain.handle('get-readings', (_event, date) => {
  ensureDataDir()
  const filePath = join(dataDir, `${date}.json`)
  if (!existsSync(filePath)) return []
  try { return JSON.parse(readFileSync(filePath, 'utf8')) } catch { return [] }
})

ipcMain.handle('get-dates', () => {
  ensureDataDir()
  return readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort()
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
