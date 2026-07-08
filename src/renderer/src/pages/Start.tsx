import { useEffect, useMemo, useState } from 'react'
import { Coffee, Minimize2, Pause, Play, Square } from 'lucide-react'
import type { Method, Project } from '@shared/types'
import { useSettings, useTimerState } from '../lib/hooks'
import { fmtClock, phaseLabel } from '../lib/format'
import { Button, Card } from '../components/ui'
import { TimerRing } from '../components/TimerRing'

export default function Start(): React.JSX.Element {
  const timer = useTimerState()
  return timer.status === 'idle' ? <IdleStart /> : <ActiveSession />
}

function IdleStart(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [prefs] = useSettings()
  const [projectId, setProjectId] = useState<number | null>(null)
  const [methodId, setMethodId] = useState<number | null>(null)

  useEffect(() => {
    void window.api.projects.list(false).then(setProjects)
    void window.api.methods.list().then(setMethods)
  }, [])

  // default to last used project/method once everything has loaded
  useEffect(() => {
    if (prefs && projects.length > 0 && projectId === null) {
      const last = projects.find((p) => p.id === prefs.lastProjectId)
      setProjectId((last ?? projects[0]).id)
    }
    if (prefs && methods.length > 0 && methodId === null) {
      const last = methods.find((m) => m.id === prefs.lastMethodId)
      setMethodId((last ?? methods[0]).id)
    }
  }, [prefs, projects, methods, projectId, methodId])

  const method = useMemo(() => methods.find((m) => m.id === methodId), [methods, methodId])

  const start = (): void => {
    if (projectId !== null && methodId !== null) void window.api.session.start(projectId, methodId)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-10 px-8 py-12">
      <div className="text-center">
        <p className="timer-digits text-[96px] text-ink">{fmtClock(method?.focus_sec ?? 25 * 60)}</p>
        <p className="mt-2 text-sm text-ink-muted">
          {method
            ? `${Math.round(method.focus_sec / 60)} min focus · ${Math.round(method.short_pause_sec / 60)} min break · long break every ${method.rounds_before_long} rounds`
            : ''}
        </p>
      </div>

      <Card className="w-full p-6">
        <label className="mb-2 block text-sm font-medium text-ink-muted">Project</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              aria-pressed={projectId === p.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150 ${
                projectId === p.id
                  ? 'border-accent bg-accent-soft text-ink font-medium'
                  : 'border-line bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
              {p.name}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-ink-muted">No projects yet — add one in Settings.</p>
          )}
        </div>

        <label htmlFor="method" className="mb-2 block text-sm font-medium text-ink-muted">
          Method
        </label>
        <select
          id="method"
          value={methodId ?? ''}
          onChange={(e) => setMethodId(Number(e.target.value))}
          className="h-10 w-full cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-3 text-sm text-ink"
        >
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {Math.round(m.focus_sec / 60)}/{Math.round(m.short_pause_sec / 60)}/
              {Math.round(m.long_pause_sec / 60)} · every {m.rounds_before_long}
            </option>
          ))}
        </select>
      </Card>

      <Button variant="primary" size="lg" className="w-64" onClick={start} disabled={projectId === null || methodId === null}>
        Start focusing
      </Button>
    </div>
  )
}

function ActiveSession(): React.JSX.Element {
  const timer = useTimerState()
  const progress = timer.plannedSec > 0 ? 1 - timer.remainingSec / timer.plannedSec : 0
  const isFocus = timer.phase === 'focus'
  const color = isFocus ? 'var(--accent)' : 'var(--pause)'

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-8 px-8 py-12">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: timer.projectColor }} aria-hidden="true" />
        {timer.projectName} · {timer.methodName}
      </div>

      <TimerRing progress={progress} size={320} stroke={8} color={color}>
        <div className="text-center">
          <p className="mb-1 text-sm font-medium tracking-widest text-ink-muted uppercase">
            {phaseLabel(timer.phase)}
            {timer.status === 'paused' && (timer.autoPaused ? ' · auto-paused' : ' · paused')}
          </p>
          <p className="timer-digits text-[72px] text-ink">{fmtClock(timer.remainingSec)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Round {timer.round}/{timer.roundsBeforeLong}
          </p>
        </div>
      </TimerRing>

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={() => void window.api.session.pauseResume()}>
          {timer.status === 'paused' ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          {timer.status === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        {isFocus && (
          <Button variant="ghost" size="lg" onClick={() => void window.api.session.forcePause()}>
            <Coffee size={18} aria-hidden="true" />
            Take a break
          </Button>
        )}
        <Button variant="danger-ghost" size="lg" onClick={() => void window.api.session.stop()}>
          <Square size={16} aria-hidden="true" />
          End session
        </Button>
      </div>

      <Button variant="ghost" onClick={() => window.api.ui.showWidget()}>
        <Minimize2 size={16} aria-hidden="true" />
        Switch to widget
      </Button>
    </div>
  )
}
