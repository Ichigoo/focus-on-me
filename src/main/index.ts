import { app, nativeTheme, powerMonitor } from 'electron'
import { openDb } from './db'
import { settings } from './db/repos'
import { engine } from './timer/engine'
import { registerIpc } from './ipc'
import { createTray, setTrayTooltip } from './tray'
import { rescheduleAdhan } from './adhan/scheduler'
import { rescheduleTasks } from './tasks/scheduler'
import {
  broadcast,
  closeOverlays,
  closeWidget,
  createMainWindow,
  createOverlays,
  createWidget,
  getMainWindow,
  hasOverlays,
  showMainWindow
} from './windows'
import type { TimerState } from '@shared/types'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    openDb()
    registerIpc()
    createTray()
    createMainWindow()

    // apply persisted launch-on-startup preference
    const prefs = settings.getAll()
    app.setLoginItemSettings({ openAtLogin: prefs.launchOnStartup })

    // ----- adhan -----
    rescheduleAdhan()

    // ----- tasks -----
    rescheduleTasks()

    // ----- theme -----
    nativeTheme.on('updated', () => broadcast('theme:dark', nativeTheme.shouldUseDarkColors))

    // ----- timer wiring -----
    function fmt(sec: number): string {
      const s = Math.max(0, Math.round(sec))
      const m = Math.floor(s / 60)
      const r = s % 60
      return `${m}:${String(r).padStart(2, '0')}`
    }

    engine.on('state', (state: TimerState) => {
      broadcast('timer:state', state)
      if (state.status === 'idle') {
        setTrayTooltip('Focus On Me')
      } else {
        const label =
          state.phase === 'focus' ? 'Focus' : state.phase === 'short_pause' ? 'Short break' : 'Long break'
        setTrayTooltip(`${label} · ${fmt(state.remainingSec)} · ${state.projectName}`)
      }
    })

    engine.on('sound', (kind) => broadcast('sound:play', kind))

    engine.on('session-started', () => {
      getMainWindow()?.hide()
      if (settings.getAll().widgetEnabled) createWidget()
    })

    engine.on('phase', (phase: string) => {
      if (phase === 'focus') {
        closeOverlays()
      } else {
        createOverlays()
      }
    })

    engine.on('session-ended', () => {
      closeOverlays()
      closeWidget()
      showMainWindow()
    })

    // ----- system sleep / lock: pause tracked time -----
    powerMonitor.on('suspend', () => engine.autoPause())
    powerMonitor.on('lock-screen', () => engine.autoPause())
    powerMonitor.on('resume', () => engine.autoResume())
    powerMonitor.on('unlock-screen', () => engine.autoResume())

    // keep overlays covering all displays if monitors change mid-pause
    const { screen } = require('electron') as typeof import('electron')
    screen.on('display-added', () => {
      if (hasOverlays()) createOverlays()
    })
    screen.on('display-removed', () => {
      if (hasOverlays()) createOverlays()
    })

    app.on('activate', () => showMainWindow())
  })

  // Tray app: don't quit when all windows are closed.
  app.on('window-all-closed', () => {
    /* keep running in tray */
  })

  app.on('before-quit', () => {
    engine.stop()
  })
}
