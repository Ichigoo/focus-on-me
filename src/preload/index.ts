import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppSettings, SoundKind, TimerState, ToastPayload } from '@shared/types'

function on<T>(channel: string): (cb: (payload: T) => void) => () => void {
  return (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api: Api = {
  projects: {
    list: (includeArchived) => ipcRenderer.invoke('projects:list', includeArchived),
    create: (name, color) => ipcRenderer.invoke('projects:create', name, color),
    update: (id, name, color) => ipcRenderer.invoke('projects:update', id, name, color),
    setArchived: (id, archived) => ipcRenderer.invoke('projects:setArchived', id, archived),
    remove: (id) => ipcRenderer.invoke('projects:remove', id)
  },
  methods: {
    list: () => ipcRenderer.invoke('methods:list'),
    create: (m) => ipcRenderer.invoke('methods:create', m),
    update: (m) => ipcRenderer.invoke('methods:update', m),
    remove: (id) => ipcRenderer.invoke('methods:remove', id)
  },
  messages: {
    list: () => ipcRenderer.invoke('messages:list'),
    create: (text) => ipcRenderer.invoke('messages:create', text),
    update: (id, text) => ipcRenderer.invoke('messages:update', id, text),
    setEnabled: (id, enabled) => ipcRenderer.invoke('messages:setEnabled', id, enabled),
    remove: (id) => ipcRenderer.invoke('messages:remove', id),
    move: (id, dir) => ipcRenderer.invoke('messages:move', id, dir)
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  },
  session: {
    start: (projectId, methodId, taskName) => ipcRenderer.invoke('session:start', projectId, methodId, taskName),
    startPomodoro: (projectId, config, taskName) =>
      ipcRenderer.invoke('session:startPomodoro', projectId, config, taskName),
    startSimple: (projectId, mode, durationSec, taskName) =>
      ipcRenderer.invoke('session:startSimple', projectId, mode, durationSec, taskName),
    pauseResume: () => ipcRenderer.invoke('session:pauseResume'),
    skipPause: () => ipcRenderer.invoke('session:skipPause'),
    forcePause: () => ipcRenderer.invoke('session:forcePause'),
    stop: () => ipcRenderer.invoke('session:stop')
  },
  stats: {
    summary: (range) => ipcRenderer.invoke('stats:summary', range),
    summaryExtended: (range) => ipcRenderer.invoke('stats:summaryExtended', range),
    trend: (range) => ipcRenderer.invoke('stats:trend', range),
    daily: (days) => ipcRenderer.invoke('stats:daily', days),
    perProject: (range) => ipcRenderer.invoke('stats:perProject', range),
    history: (limit) => ipcRenderer.invoke('stats:history', limit)
  },
  ui: {
    getTimerState: () => ipcRenderer.invoke('ui:getTimerState'),
    isDark: () => ipcRenderer.invoke('ui:isDark'),
    openMain: () => ipcRenderer.send('ui:openMain'),
    showWidget: () => ipcRenderer.send('ui:showWidget'),
    onTimer: on<TimerState>('timer:state'),
    onTheme: on<boolean>('theme:dark'),
    onSound: on<SoundKind>('sound:play'),
    onSettingsChanged: on<AppSettings>('settings:changed'),
    onToast: on<ToastPayload>('toast:show'),
    getPendingToast: () => ipcRenderer.invoke('toast:getPending'),
    closeToast: () => ipcRenderer.send('ui:closeToast')
  },
  adhan: {
    searchLocation: (query) => ipcRenderer.invoke('adhan:searchLocation', query),
    test: () => ipcRenderer.send('adhan:test')
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, input) => ipcRenderer.invoke('tasks:update', id, input),
    remove: (id) => ipcRenderer.invoke('tasks:remove', id),
    listForDay: (day) => ipcRenderer.invoke('tasks:listForDay', day),
    setStatus: (taskId, day, status) => ipcRenderer.invoke('tasks:setStatus', taskId, day, status),
    onChanged: on<void>('tasks:changed')
  },
  subtasks: {
    add: (taskId, name) => ipcRenderer.invoke('subtasks:add', taskId, name),
    toggle: (id, done) => ipcRenderer.invoke('subtasks:toggle', id, done),
    remove: (id) => ipcRenderer.invoke('subtasks:remove', id)
  },
  blockedApps: {
    list: () => ipcRenderer.invoke('blockedApps:list'),
    add: (name, exe) => ipcRenderer.invoke('blockedApps:add', name, exe),
    setEnabled: (id, enabled) => ipcRenderer.invoke('blockedApps:setEnabled', id, enabled),
    remove: (id) => ipcRenderer.invoke('blockedApps:remove', id),
    onChanged: on<void>('blockedApps:changed')
  },
  backup: {
    exportSettings: () => ipcRenderer.invoke('backup:exportSettings'),
    importSettings: () => ipcRenderer.invoke('backup:importSettings')
  }
}

contextBridge.exposeInMainWorld('api', api)
