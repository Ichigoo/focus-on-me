import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, TaskDayStatus, TaskWithStatus, TimerState } from '@shared/types'

export function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const IDLE_STATE: TimerState = {
  status: 'idle',
  mode: 'pomodoro',
  phase: 'focus',
  round: 1,
  roundsBeforeLong: 4,
  remainingSec: 0,
  plannedSec: 0,
  sessionId: null,
  projectId: null,
  projectName: '',
  projectColor: '#8B5CF6',
  methodName: '',
  taskName: null,
  pauseMessage: null,
  autoPaused: false
}

/** Subscribes to the main-process timer; also applies the initial snapshot. */
export function useTimerState(): TimerState {
  const [state, setState] = useState<TimerState>(IDLE_STATE)
  useEffect(() => {
    let mounted = true
    window.api.ui.getTimerState().then((s) => mounted && setState(s))
    const off = window.api.ui.onTimer((s) => setState(s))
    return () => {
      mounted = false
      off()
    }
  }, [])
  return state
}

/** Applies/removes the `.dark` class on <html> following the system theme. */
export function useTheme(): void {
  useEffect(() => {
    const apply = (dark: boolean): void => {
      document.documentElement.classList.toggle('dark', dark)
    }
    window.api.ui.isDark().then(apply)
    return window.api.ui.onTheme(apply)
  }, [])
}

/** Today's scheduled tasks, refetched on any tasks change (CRUD, midnight rollover, other windows). */
export function useTodayTasks(): {
  day: string
  tasks: TaskWithStatus[]
  loading: boolean
  setStatus: (taskId: number, status: TaskDayStatus | null) => Promise<void>
} {
  const [day, setDay] = useState(todayString())
  const [tasks, setTasks] = useState<TaskWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback((): Promise<void> => {
    const d = todayString()
    setDay(d)
    return window.api.tasks.listForDay(d).then((list) => {
      setTasks(list)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    void reload()
    return window.api.tasks.onChanged(() => void reload())
  }, [reload])

  const setStatus = useCallback(
    async (taskId: number, status: TaskDayStatus | null): Promise<void> => {
      const fresh = await window.api.tasks.setStatus(taskId, day, status)
      setTasks(fresh)
    },
    [day]
  )

  return { day, tasks, loading, setStatus }
}

export function useSettings(): [AppSettings | null, <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void] {
  const [prefs, setPrefs] = useState<AppSettings | null>(null)
  useEffect(() => {
    let mounted = true
    window.api.settings.getAll().then((s) => mounted && setPrefs(s))
    const off = window.api.ui.onSettingsChanged((s) => setPrefs(s))
    return () => {
      mounted = false
      off()
    }
  }, [])
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]): void => {
    setPrefs((p) => (p ? { ...p, [k]: v } : p))
    void window.api.settings.set(k, v)
  }
  return [prefs, set]
}
