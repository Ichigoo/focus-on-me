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
}

export type SettingKey = keyof AppSettings

export interface TimerState {
  status: 'idle' | 'running' | 'paused'
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
  pauseMessage: string | null
  autoPaused: boolean // paused because the OS slept or locked
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

export type SoundKind = 'pause-start' | 'pause-end' | 'warning' | 'adhan'

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
    start: (projectId: number, methodId: number) => Promise<void>
    pauseResume: () => Promise<void>
    skipPause: () => Promise<void>
    forcePause: () => Promise<void>
    stop: () => Promise<void>
  }
  stats: {
    summary: (range: RangeFilter) => Promise<StatsSummary>
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
  }
  adhan: {
    searchLocation: (query: string) => Promise<AdhanLocation[]>
    test: () => void
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
  adhanEnabledPrayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }
}

export const PROJECT_COLORS = [
  '#37675C', // sage teal
  '#5B7DA8', // dusty blue
  '#8A6D3F', // warm sand
  '#7C6A9C', // muted violet
  '#A84B4B', // clay red
  '#4E8578', // soft green
  '#A8763F', // amber
  '#5F8FA8' // lake blue
]
