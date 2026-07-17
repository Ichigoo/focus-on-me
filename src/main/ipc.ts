import { app, dialog, ipcMain, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import type {
  AppSettings,
  Method,
  PomodoroConfig,
  RangeFilter,
  SettingKey,
  TaskDayStatus,
  TaskInput
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { messages, methods, projects, sessions, settings } from './db/repos'
import { stats } from './db/stats'
import { tasksRepo } from './db/tasks'
import { blockedApps } from './db/blockedApps'
import { refreshBlocklist } from './blocker/watcher'
import { engine } from './timer/engine'
import {
  broadcast,
  consumePendingToast,
  createWidget,
  getMainWindow,
  hideToast,
  hideWidget,
  showMainWindow
} from './windows'
import { rebuildMenu } from './tray'
import { searchLocation } from './adhan/geocode'
import { rescheduleAdhan, testAdhan } from './adhan/scheduler'
import { rescheduleTasks } from './tasks/scheduler'

function tasksMutated(): void {
  broadcast('tasks:changed')
  rescheduleTasks()
}

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
    if (key === 'themePreference') {
      nativeTheme.themeSource = value as AppSettings['themePreference']
    }
    const all = settings.getAll()
    broadcast('settings:changed', all)
    rebuildMenu()
    if (key.startsWith('adhan')) rescheduleAdhan()
    if (key.startsWith('task')) rescheduleTasks()
  })

  // ----- adhan -----
  ipcMain.handle('adhan:searchLocation', (_e, query: string) => searchLocation(query))
  ipcMain.on('adhan:test', () => testAdhan())

  // ----- tasks -----
  ipcMain.handle('tasks:list', () => tasksRepo.list())
  ipcMain.handle('tasks:create', (_e, input: TaskInput) => {
    const task = tasksRepo.create(input)
    tasksMutated()
    return task
  })
  ipcMain.handle('tasks:update', (_e, id: number, input: TaskInput) => {
    tasksRepo.update(id, input)
    tasksMutated()
  })
  ipcMain.handle('tasks:remove', (_e, id: number) => {
    tasksRepo.remove(id)
    tasksMutated()
  })
  ipcMain.handle('tasks:listForDay', (_e, day: string) => tasksRepo.listForDay(day))
  ipcMain.handle('tasks:setStatus', (_e, taskId: number, day: string, status: TaskDayStatus | null) => {
    const result = tasksRepo.setStatus(taskId, day, status)
    tasksMutated()
    return result
  })

  // ----- subtasks -----
  ipcMain.handle('subtasks:add', (_e, taskId: number, name: string) => {
    const sub = tasksRepo.addSubtask(taskId, name)
    tasksMutated()
    return sub
  })
  ipcMain.handle('subtasks:toggle', (_e, id: number, done: boolean) => {
    tasksRepo.toggleSubtask(id, done)
    tasksMutated()
  })
  ipcMain.handle('subtasks:remove', (_e, id: number) => {
    tasksRepo.removeSubtask(id)
    tasksMutated()
  })

  // ----- blocked apps -----
  function blockedAppsMutated(): void {
    refreshBlocklist()
    broadcast('blockedApps:changed')
  }
  ipcMain.handle('blockedApps:list', () => blockedApps.list())
  ipcMain.handle('blockedApps:add', (_e, name: string, exe: string) => {
    const result = blockedApps.add(name, exe)
    if (result.ok) blockedAppsMutated()
    return result
  })
  ipcMain.handle('blockedApps:setEnabled', (_e, id: number, enabled: boolean) => {
    blockedApps.setEnabled(id, enabled)
    blockedAppsMutated()
  })
  ipcMain.handle('blockedApps:remove', (_e, id: number) => {
    blockedApps.remove(id)
    blockedAppsMutated()
  })

  // ----- backup -----
  ipcMain.handle('backup:exportSettings', async () => {
    const win = getMainWindow()
    if (!win) return { ok: false, reason: 'No window' }
    const res = await dialog.showSaveDialog(win, {
      title: 'Export settings',
      defaultPath: 'focus-on-me-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, reason: 'canceled' }
    try {
      writeFileSync(res.filePath, JSON.stringify(settings.getAll(), null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  })
  ipcMain.handle('backup:importSettings', async () => {
    const win = getMainWindow()
    if (!win) return { ok: false, reason: 'No window' }
    const res = await dialog.showOpenDialog(win, {
      title: 'Import settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return { ok: false, reason: 'canceled' }
    try {
      const raw = JSON.parse(readFileSync(res.filePaths[0], 'utf-8')) as Record<string, unknown>
      // Apply only known keys whose primitive type matches the default's.
      for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
        if (!(key in raw)) continue
        const def = DEFAULT_SETTINGS[key]
        const val = raw[key]
        const sameType =
          def === null || val === null ? true : typeof val === typeof def
        if (sameType) settings.set(key, val as never)
      }
      const all = settings.getAll()
      nativeTheme.themeSource = all.themePreference
      app.setLoginItemSettings({ openAtLogin: all.launchOnStartup })
      broadcast('settings:changed', all)
      rebuildMenu()
      rescheduleAdhan()
      rescheduleTasks()
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  })

  // ----- session control -----
  ipcMain.handle('session:start', (_e, projectId: number, methodId: number, taskName?: string | null) => {
    const project = projects.get(projectId)
    const method = methods.get(methodId)
    if (!project || !method) throw new Error('Unknown project or method')
    settings.set('lastProjectId', projectId)
    settings.set('lastMethodId', methodId)
    engine.start(project, method, taskName ?? null)
  })
  ipcMain.handle(
    'session:startPomodoro',
    (_e, projectId: number, config: PomodoroConfig, taskName?: string | null) => {
      const project = projects.get(projectId)
      if (!project) throw new Error('Unknown project')
      const method = methods.findOrCreateAuto(
        Math.round(config.focusMin * 60),
        Math.round(config.shortMin * 60),
        Math.round(config.longMin * 60),
        Math.round(config.cycles)
      )
      settings.set('lastProjectId', projectId)
      settings.set('lastMethodId', method.id)
      engine.start(project, method, taskName ?? null)
    }
  )
  ipcMain.handle(
    'session:startSimple',
    (_e, projectId: number, mode: 'countdown' | 'stopwatch', durationSec: number, taskName?: string | null) => {
      const project = projects.get(projectId)
      const method = methods.getByKind(mode)
      if (!project || !method) throw new Error('Unknown project or timer mode')
      settings.set('lastProjectId', projectId)
      engine.startSimple(project, method, mode, durationSec, taskName ?? null)
    }
  )
  ipcMain.handle('session:pauseResume', () => engine.pauseResume())
  ipcMain.handle('session:skipPause', () => engine.skipPause())
  ipcMain.handle('session:forcePause', () => engine.forcePause())
  ipcMain.handle('session:stop', () => engine.stop())

  // ----- stats -----
  ipcMain.handle('stats:summary', (_e, range: RangeFilter) => stats.summary(range))
  ipcMain.handle('stats:summaryExtended', (_e, range: RangeFilter) => stats.summaryExtended(range))
  ipcMain.handle('stats:trend', (_e, range: RangeFilter) => stats.trend(range))
  ipcMain.handle('stats:daily', (_e, days: number) => stats.daily(days))
  ipcMain.handle('stats:perProject', (_e, range: RangeFilter) => stats.perProject(range))
  ipcMain.handle('stats:history', (_e, limit: number) => stats.history(limit))

  // ----- ui -----
  ipcMain.handle('ui:getTimerState', () => engine.getState())
  ipcMain.handle('ui:isDark', () => nativeTheme.shouldUseDarkColors)
  ipcMain.on('ui:openMain', () => {
    hideToast()
    hideWidget()
    showMainWindow()
  })
  ipcMain.on('ui:showWidget', () => {
    getMainWindow()?.hide()
    createWidget()
  })
  ipcMain.on('ui:closeToast', () => hideToast())
  ipcMain.handle('toast:getPending', () => consumePendingToast())

  // keep session rows consistent if the app crashed last run
  sessions.closeDangling()
}
