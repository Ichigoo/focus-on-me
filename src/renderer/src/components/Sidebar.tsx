import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  House,
  Timer,
  ListChecks,
  ShieldBan,
  BarChart3,
  Moon,
  Settings as SettingsIcon,
  Monitor,
  Sun,
  MoonStar
} from 'lucide-react'
import { useSettings, useTimerState } from '../lib/hooks'
import type { ThemePreference } from '@shared/types'

const navItems = [
  { to: '/', label: 'Home', icon: House },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/app-blocks', label: 'App Blocks', icon: ShieldBan },
  { to: '/dashboard', label: 'Analytics', icon: BarChart3 },
  { to: '/adhan', label: 'Adhan', icon: Moon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
]

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark']
const themeIcon = { system: Monitor, light: Sun, dark: MoonStar }
const themeLabel = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }

export default function Sidebar(): React.JSX.Element {
  const [prefs, setPref] = useSettings()
  const timer = useTimerState()
  const [streak, setStreak] = useState(0)

  // refresh streak when a session ends (sessionId transitions)
  useEffect(() => {
    let mounted = true
    window.api.stats.summary('all').then((s) => mounted && setStreak(s.currentStreak))
    return () => {
      mounted = false
    }
  }, [timer.sessionId])

  const name = prefs?.userName?.trim() || ''
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '☺'
  const theme = prefs?.themePreference ?? 'dark'
  const ThemeIcon = themeIcon[theme]

  function cycleTheme(): void {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setPref('themePreference', next)
  }

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="btn-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Timer size={20} className="text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Focus On Me</p>
          <p className="truncate text-[11px] text-ink-muted">Deep Work Platform</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              }`
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name || 'Set your name'}</p>
          <p className="truncate text-[11px] text-ink-muted">
            {streak > 0 ? `${streak}-day streak 🔥` : 'Start a streak today'}
          </p>
        </div>
        <button
          aria-label={`Theme: ${themeLabel[theme]} — click to change`}
          title={themeLabel[theme]}
          onClick={cycleTheme}
          className="cursor-pointer rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ThemeIcon size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
