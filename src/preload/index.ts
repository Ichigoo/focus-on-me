import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppSettings, SoundKind, TimerState } from '@shared/types'

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
    start: (projectId, methodId) => ipcRenderer.invoke('session:start', projectId, methodId),
    pauseResume: () => ipcRenderer.invoke('session:pauseResume'),
    skipPause: () => ipcRenderer.invoke('session:skipPause'),
    forcePause: () => ipcRenderer.invoke('session:forcePause'),
    stop: () => ipcRenderer.invoke('session:stop')
  },
  stats: {
    summary: (range) => ipcRenderer.invoke('stats:summary', range),
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
    onSettingsChanged: on<AppSettings>('settings:changed')
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
  }
}

contextBridge.exposeInMainWorld('api', api)
