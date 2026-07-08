import { app, ipcMain, nativeTheme } from 'electron'
import type { AppSettings, Method, RangeFilter, SettingKey } from '@shared/types'
import { messages, methods, projects, sessions, settings } from './db/repos'
import { stats } from './db/stats'
import { engine } from './timer/engine'
import { broadcast, createWidget, getMainWindow, hideWidget, showMainWindow } from './windows'
import { rebuildMenu } from './tray'

export function registerIpc(): void {
  // ----- projects -----
  ipcMain.handle('projects:list', (_e, includeArchived: boolean) => projects.list(includeArchived))
  ipcMain.handle('projects:create', (_e, name: string, color: string) => projects.create(name, color))
  ipcMain.handle('projects:update', (_e, id: number, name: string, color: string) =>
    projects.update(id, name, color)
  )
  ipcMain.handle('projects:setArchived', (_e, id: number, archived: boolean) =>
    projects.setArchived(id, archived)
  )
  ipcMain.handle('projects:remove', (_e, id: number) => projects.remove(id))

  // ----- methods -----
  ipcMain.handle('methods:list', () => methods.list())
  ipcMain.handle('methods:create', (_e, m: Omit<Method, 'id' | 'is_preset'>) => methods.create(m))
  ipcMain.handle('methods:update', (_e, m: Omit<Method, 'is_preset'>) => methods.update(m))
  ipcMain.handle('methods:remove', (_e, id: number) => methods.remove(id))

  // ----- pause messages -----
  ipcMain.handle('messages:list', () => messages.list())
  ipcMain.handle('messages:create', (_e, text: string) => messages.create(text))
  ipcMain.handle('messages:update', (_e, id: number, text: string) => messages.update(id, text))
  ipcMain.handle('messages:setEnabled', (_e, id: number, enabled: boolean) => messages.setEnabled(id, enabled))
  ipcMain.handle('messages:remove', (_e, id: number) => messages.remove(id))
  ipcMain.handle('messages:move', (_e, id: number, dir: 'up' | 'down') => messages.move(id, dir))

  // ----- settings -----
  ipcMain.handle('settings:getAll', () => settings.getAll())
  ipcMain.handle('settings:set', (_e, key: SettingKey, value: AppSettings[SettingKey]) => {
    settings.set(key, value as never)
    if (key === 'launchOnStartup') {
      app.setLoginItemSettings({ openAtLogin: value === true })
    }
    const all = settings.getAll()
    broadcast('settings:changed', all)
    rebuildMenu()
  })

  // ----- session control -----
  ipcMain.handle('session:start', (_e, projectId: number, methodId: number) => {
    const project = projects.get(projectId)
    const method = methods.get(methodId)
    if (!project || !method) throw new Error('Unknown project or method')
    settings.set('lastProjectId', projectId)
    settings.set('lastMethodId', methodId)
    engine.start(project, method)
  })
  ipcMain.handle('session:pauseResume', () => engine.pauseResume())
  ipcMain.handle('session:skipPause', () => engine.skipPause())
  ipcMain.handle('session:forcePause', () => engine.forcePause())
  ipcMain.handle('session:stop', () => engine.stop())

  // ----- stats -----
  ipcMain.handle('stats:summary', (_e, range: RangeFilter) => stats.summary(range))
  ipcMain.handle('stats:daily', (_e, days: number) => stats.daily(days))
  ipcMain.handle('stats:perProject', (_e, range: RangeFilter) => stats.perProject(range))
  ipcMain.handle('stats:history', (_e, limit: number) => stats.history(limit))

  // ----- ui -----
  ipcMain.handle('ui:getTimerState', () => engine.getState())
  ipcMain.handle('ui:isDark', () => nativeTheme.shouldUseDarkColors)
  ipcMain.on('ui:openMain', () => {
    hideWidget()
    showMainWindow()
  })
  ipcMain.on('ui:showWidget', () => {
    getMainWindow()?.hide()
    createWidget()
  })

  // keep session rows consistent if the app crashed last run
  sessions.closeDangling()
}
