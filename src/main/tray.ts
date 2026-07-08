import { app, Menu, nativeImage, Tray } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import { settings } from './db/repos'
import { showMainWindow, setQuitting, broadcast } from './windows'

let tray: Tray | null = null

export function createTray(): Tray {
  const image = nativeImage.createFromPath(trayIcon)
  tray = new Tray(image)
  tray.setToolTip('Focus On Me')
  tray.on('click', () => showMainWindow())
  rebuildMenu()
  return tray
}

export function rebuildMenu(): void {
  if (!tray) return
  const prefs = settings.getAll()
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Focus On Me', click: () => showMainWindow() },
      {
        label: 'Mute sounds',
        type: 'checkbox',
        checked: prefs.masterMute,
        click: (item) => {
          settings.set('masterMute', item.checked)
          broadcast('settings:changed', settings.getAll())
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          setQuitting()
          app.quit()
        }
      }
    ])
  )
}

export function setTrayTooltip(text: string): void {
  tray?.setToolTip(text)
}
