import { useEffect, useState } from 'react'
import type { AppSettings, TimerState } from '@shared/types'

const IDLE_STATE: TimerState = {
  status: 'idle',
  phase: 'focus',
  round: 1,
  roundsBeforeLong: 4,
  remainingSec: 0,
  plannedSec: 0,
  sessionId: null,
  projectId: null,
  projectName: '',
  projectColor: '#37675C',
  methodName: '',
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
