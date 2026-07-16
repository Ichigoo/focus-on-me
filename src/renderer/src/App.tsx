import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { House, Timer, ListChecks, BarChart3, Moon, Settings as SettingsIcon } from 'lucide-react'
import { useTheme } from './lib/hooks'
import { installSoundPlayer } from './lib/sounds'
import Home from './pages/Home'
import Start from './pages/Start'
import Tasks from './pages/Tasks'
import Dashboard from './pages/Dashboard'
import Adhan from './pages/Adhan'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Home', icon: House },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/adhan', label: 'Adhan', icon: Moon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
]

export default function App(): React.JSX.Element {
  useTheme()
  // The main window owns audio: it stays alive in the tray even when hidden.
  useEffect(() => installSoundPlayer(), [])

  return (
    <div className="flex h-screen">
      <nav className="flex w-20 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-6">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-accent">
          <Timer size={20} className="text-accent-contrast" aria-hidden="true" />
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex w-16 cursor-pointer flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors duration-150 ${
                isActive ? 'bg-accent-soft text-accent font-medium' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/focus" element={<Start />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/adhan" element={<Adhan />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
