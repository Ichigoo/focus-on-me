import { BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { join } from 'path'
import { settings } from './db/repos'
import icon from '../../resources/icon.png?asset'

function themeBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#0D0D12' : '#F7F6FB'
}

const DEV_URL = process.env['ELECTRON_RENDERER_URL']

function load(win: BrowserWindow, page: 'index' | 'widget' | 'overlay' | 'toast', query = ''): void {
  if (DEV_URL) {
    win.loadURL(`${DEV_URL}/${page === 'index' ? '' : page + '.html'}${query}`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`), query ? { search: query } : undefined)
  }
}

const preload = join(__dirname, '../preload/index.js')

// ---------- main window ----------

let mainWindow: BrowserWindow | null = null
let quitting = false

export function setQuitting(): void {
  quitting = true
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 740,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    icon,
    backgroundColor: themeBackground(),
    webPreferences: { preload, sandbox: false }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  load(mainWindow, 'index')
  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function showMainWindow(): void {
  const win = createMainWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// ---------- mini widget ----------

let widget: BrowserWindow | null = null

export function createWidget(): void {
  if (widget && !widget.isDestroyed()) {
    widget.show()
    return
  }
  const { workArea } = screen.getPrimaryDisplay()
  const alwaysOnTop = settings.getAll().widgetAlwaysOnTop
  widget = new BrowserWindow({
    width: 260,
    height: 76,
    x: workArea.x + workArea.width - 280,
    y: workArea.y + 20,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: { preload, sandbox: false }
  })
  if (alwaysOnTop) {
    widget.setAlwaysOnTop(true, 'screen-saver')
    widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  widget.on('ready-to-show', () => widget?.show())
  load(widget, 'widget')
}

export function closeWidget(): void {
  if (widget && !widget.isDestroyed()) widget.destroy()
  widget = null
}

export function hideWidget(): void {
  if (widget && !widget.isDestroyed()) widget.hide()
}

// ---------- pause overlays (one per display) ----------

let overlays: BrowserWindow[] = []

export function createOverlays(): void {
  closeOverlays()
  overlays = screen.getAllDisplays().map((display, i) => {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      skipTaskbar: true,
      show: false,
      backgroundColor: themeBackground(),
      webPreferences: { preload, sandbox: false }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setBounds(display.bounds)
    win.setFullScreen(true)
    win.on('ready-to-show', () => win.show())
    load(win, 'overlay', `?display=${i}`)
    return win
  })
}

export function closeOverlays(): void {
  for (const win of overlays) {
    if (!win.isDestroyed()) win.destroy()
  }
  overlays = []
}

export function hasOverlays(): boolean {
  return overlays.some((w) => !w.isDestroyed())
}

// ---------- toast notifications (app-styled, replaces native Notification) ----------

let toast: BrowserWindow | null = null
let toastTimer: NodeJS.Timeout | null = null
let pendingToast: unknown = null

const TOAST_W = 380
const TOAST_H = 108
const TOAST_MS = 6000

export function showToast(payload: { title: string; body: string; kind: string }): void {
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => hideToast(), TOAST_MS)

  if (toast && !toast.isDestroyed()) {
    toast.webContents.send('toast:show', payload)
    toast.showInactive()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()
  pendingToast = payload
  toast = new BrowserWindow({
    width: TOAST_W,
    height: TOAST_H,
    x: workArea.x + workArea.width - TOAST_W - 16,
    y: workArea.y + workArea.height - TOAST_H - 16,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: { preload, sandbox: false }
  })
  toast.setAlwaysOnTop(true, 'screen-saver')
  toast.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // The renderer pulls the payload via toast:getPending once React has mounted
  // (pushing on did-finish-load races the listener registration).
  toast.webContents.on('did-finish-load', () => {
    if (toast && !toast.isDestroyed()) toast.showInactive()
  })
  load(toast, 'toast')
}

/** One-shot pull for the toast renderer after it mounts. */
export function consumePendingToast(): unknown {
  const p = pendingToast
  pendingToast = null
  return p
}

export function hideToast(): void {
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = null
  pendingToast = null
  if (toast && !toast.isDestroyed()) toast.destroy()
  toast = null
}

// ---------- broadcast helpers ----------

export function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}
