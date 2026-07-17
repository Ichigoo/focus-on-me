import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useTheme } from './lib/hooks'
import { installSoundPlayer } from './lib/sounds'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Start from './pages/Start'
import Tasks from './pages/Tasks'
import AppBlocks from './pages/AppBlocks'
import Dashboard from './pages/Dashboard'
import Adhan from './pages/Adhan'
import Settings from './pages/Settings'

export default function App(): React.JSX.Element {
  useTheme()
  // The main window owns audio: it stays alive in the tray even when hidden.
  useEffect(() => installSoundPlayer(), [])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="page-glow min-w-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/focus" element={<Start />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/app-blocks" element={<AppBlocks />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/adhan" element={<Adhan />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
