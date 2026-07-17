// Shared contract between main, preload, and renderers.

export interface Project {
  id: number
  name: string
  color: string
  archived: number // 0 | 1
  created_at: number // epoch seconds
  has_time: number // 0 | 1 — whether any focus time was logged against it
}

export interface Method {
  id: number
  name: string
  focus_sec: number
  short_pause_sec: number
  long_pause_sec: number
  rounds_before_long: number
  is_preset: number // 0 | 1
}

export interface PauseMessage {
  id: number
  text: string
  enabled: number // 0 | 1
  sort_order: number
}

export type SessionStatus = 'active' | 'completed' | 'stopped'
export type Phase = 'focus' | 'short_pause' | 'long_pause'
export type IntervalKind = Phase

export type ThemePreference = 'system' | 'light' | 'dark'

export interface AppSettings {
  soundPauseStart: boolean
  soundPauseEnd: boolean
  soundWarning: boolean
  masterMute: boolean
  randomizeMessages: boolean
  widgetEnabled: boolean
  launchOnStartup: boolean
  lastProjectId: number | null
  lastMethodId: number | null
  adhanLocation: AdhanLocation | null
  adhanMethod: AdhanMethodKey
  adhanMadhab: AdhanMadhab
  adhanNotificationsEnabled: boolean
  adhanSoundEnabled: boolean
  adhanEnabledPrayers: Record<PrayerName, boolean>
  taskRemindersEnabled: boolean
  soundTaskReminder: boolean
  themePreference: ThemePreference
  userName: string
  widgetAlwaysOnTop: boolean
  widgetOpacity: number // 0.4–1
  appBlockingEnabled: boolean
  notifyOnAppKill: boolean
}

export type SettingKey = keyof AppSettings

export interface TimerState {
  status: 'idle' | 'running' | 'paused'
  mode: 'pomodoro' | 'countdown' | 'stopwatch'
  phase: Phase
  round: number // 1-based focus round within the current cycle
  roundsBeforeLong: number
  remainingSec: number
  plannedSec: number
  sessionId: number | null
  projectId: number | null
  projectName: string
  projectColor: string
  methodName: string
  taskName: string | null // the task the user chose to work on, if any
  pauseMessage: string | null
  autoPaused: boolean // paused because the OS slept or locked
}

export interface PomodoroConfig {
  focusMin: number
  shortMin: number
  longMin: number
  cycles: number
}

export type RangeFilter = 'today' | 'week' | 'month' | 'all'

export interface StatsSummary {
  totalFocusSec: number
  sessionsCompleted: number
  pausesSkipped: number
  currentStreak: number
}

export interface DailyFocus {
  day: string // YYYY-MM-DD (local)
  focusMin: number
}

export interface ProjectTime {
  projectId: number
  name: string
  color: string
  focusSec: number
}

export interface HistoryEntry {
  id: number
  startedAt: number
  projectName: string
  projectColor: string
  methodName: string
  focusSec: number
  status: SessionStatus
}

export type SoundKind = 'pause-start' | 'pause-end' | 'warning' | 'adhan' | 'task-reminder' | 'task-done'

export interface ToastPayload {
  title: string
  body: string
  kind: 'task' | 'adhan' | 'block'
}

export interface AdhanLocation {
  lat: number
  lon: number
  label: string
}

export type AdhanMethodKey =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Tehran'
  | 'Turkey'

export type AdhanMadhab = 'Shafi' | 'Hanafi'

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export interface AdhanTimes {
  fajr: number
  sunrise: number
  dhuhr: number
  asr: number
  maghrib: number
  isha: number
}

export type TaskScheduleKind = 'daily' | 'weekly' | 'once'
export type TaskDayStatus = 'done' | 'ignored'
export type TaskPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: number
  name: string
  schedule_kind: TaskScheduleKind
  weekdays: number
  once_date: string | null
  time_hhmm: string | null
  archived: number
  created_at: number
  created_day: string
  priority: TaskPriority
  project_id: number | null
}

export type TaskInput = Pick<
  Task,
  'name' | 'schedule_kind' | 'weekdays' | 'once_date' | 'time_hhmm' | 'priority' | 'project_id'
>

export interface Subtask {
  id: number
  task_id: number
  name: string
  done: number // 0 | 1
  sort_order: number
}

export interface TaskWithStatus extends Task {
  status: TaskDayStatus | 'pending'
  streak: number
  overdue?: boolean
  projectName: string | null
  projectColor: string | null
  subtasks: Subtask[]
}

export interface BlockedApp {
  id: number
  name: string
  exe: string
  enabled: number // 0 | 1
  created_at: number
}

export type TimerMode = 'pomodoro' | 'countdown' | 'stopwatch'

export interface StatsSummaryExtended extends StatsSummary {
  avgSessionSec: number
  bestStreak: number
  productivityScore: number | null
  tasksDone: number
  tasksScheduled: number
}

export interface StatsTrend {
  focusSecCurrent: number
  focusSecPrevious: number
  sessionsCurrent: number
  sessionsPrevious: number
}

export interface Api {
  projects: {
    list: (includeArchived: boolean) => Promise<Project[]>
    create: (name: string, color: string) => Promise<Project>
    update: (id: number, name: string, color: string) => Promise<void>
    setArchived: (id: number, archived: boolean) => Promise<void>
    remove: (id: number) => Promise<{ ok: boolean; reason?: string }>
  }
  methods: {
    list: () => Promise<Method[]>
    create: (m: Omit<Method, 'id' | 'is_preset'>) => Promise<Method>
    update: (m: Omit<Method, 'is_preset'>) => Promise<void>
    remove: (id: number) => Promise<{ ok: boolean; reason?: string }>
  }
  messages: {
    list: () => Promise<PauseMessage[]>
    create: (text: string) => Promise<PauseMessage>
    update: (id: number, text: string) => Promise<void>
    setEnabled: (id: number, enabled: boolean) => Promise<void>
    remove: (id: number) => Promise<void>
    move: (id: number, dir: 'up' | 'down') => Promise<void>
  }
  settings: {
    getAll: () => Promise<AppSettings>
    set: <K extends SettingKey>(key: K, value: AppSettings[K]) => Promise<void>
  }
  session: {
    start: (projectId: number, methodId: number, taskName?: string | null) => Promise<void>
    startPomodoro: (projectId: number, config: PomodoroConfig, taskName?: string | null) => Promise<void>
    startSimple: (
      projectId: number,
      mode: 'countdown' | 'stopwatch',
      durationSec: number,
      taskName?: string | null
    ) => Promise<void>
    pauseResume: () => Promise<void>
    skipPause: () => Promise<void>
    forcePause: () => Promise<void>
    stop: () => Promise<void>
  }
  stats: {
    summary: (range: RangeFilter) => Promise<StatsSummary>
    summaryExtended: (range: RangeFilter) => Promise<StatsSummaryExtended>
    trend: (range: RangeFilter) => Promise<StatsTrend>
    daily: (days: number) => Promise<DailyFocus[]>
    perProject: (range: RangeFilter) => Promise<ProjectTime[]>
    history: (limit: number) => Promise<HistoryEntry[]>
  }
  ui: {
    getTimerState: () => Promise<TimerState>
    isDark: () => Promise<boolean>
    openMain: () => void
    showWidget: () => void
    onTimer: (cb: (state: TimerState) => void) => () => void
    onTheme: (cb: (dark: boolean) => void) => () => void
    onSound: (cb: (kind: SoundKind) => void) => () => void
    onSettingsChanged: (cb: (settings: AppSettings) => void) => () => void
    onToast: (cb: (toast: ToastPayload) => void) => () => void
    getPendingToast: () => Promise<ToastPayload | null>
    closeToast: () => void
  }
  adhan: {
    searchLocation: (query: string) => Promise<AdhanLocation[]>
    test: () => void
  }
  tasks: {
    list: () => Promise<TaskWithStatus[]>
    create: (input: TaskInput) => Promise<Task>
    update: (id: number, input: TaskInput) => Promise<void>
    remove: (id: number) => Promise<void>
    listForDay: (day: string) => Promise<TaskWithStatus[]>
    setStatus: (taskId: number, day: string, status: TaskDayStatus | null) => Promise<TaskWithStatus[]>
    onChanged: (cb: () => void) => () => void
  }
  subtasks: {
    add: (taskId: number, name: string) => Promise<Subtask>
    toggle: (id: number, done: boolean) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  blockedApps: {
    list: () => Promise<BlockedApp[]>
    add: (name: string, exe: string) => Promise<{ ok: boolean; reason?: string }>
    setEnabled: (id: number, enabled: boolean) => Promise<void>
    remove: (id: number) => Promise<void>
    onChanged: (cb: () => void) => () => void
  }
  backup: {
    exportSettings: () => Promise<{ ok: boolean; reason?: string }>
    importSettings: () => Promise<{ ok: boolean; reason?: string }>
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  soundPauseStart: true,
  soundPauseEnd: true,
  soundWarning: true,
  masterMute: false,
  randomizeMessages: true,
  widgetEnabled: true,
  launchOnStartup: false,
  lastProjectId: null,
  lastMethodId: null,
  adhanLocation: null,
  adhanMethod: 'MuslimWorldLeague',
  adhanMadhab: 'Shafi',
  adhanNotificationsEnabled: false,
  adhanSoundEnabled: false,
  adhanEnabledPrayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  taskRemindersEnabled: true,
  soundTaskReminder: true,
  themePreference: 'dark',
  userName: '',
  widgetAlwaysOnTop: true,
  widgetOpacity: 1,
  appBlockingEnabled: true,
  notifyOnAppKill: true
}

export const PROJECT_COLORS = [
  '#8B5CF6', // violet
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#34D399', // emerald
  '#38BDF8', // sky
  '#F87171', // red
  '#A78BFA' // lavender
]
