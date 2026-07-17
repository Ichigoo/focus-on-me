import { useEffect, useState } from 'react'
import { Coffee, Droplets, Lightbulb, Minimize2, Pause, Play, Square, Target } from 'lucide-react'
import type { HistoryEntry, PomodoroConfig, Project, TimerMode } from '@shared/types'
import { useSettings, useTimerState, useTodayTasks } from '../lib/hooks'
import { fmtClock, fmtDuration, fmtTime, phaseLabel } from '../lib/format'
import { Button, Card, Segmented, Stepper } from '../components/ui'
import { TimerRing } from '../components/TimerRing'

export default function Start(): React.JSX.Element {
  const timer = useTimerState()
  const { tasks } = useTodayTasks()
  const [prefs] = useSettings()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [mode, setMode] = useState<TimerMode>('pomodoro')
  const [config, setConfig] = useState<PomodoroConfig | null>(null)
  const [countdownMin, setCountdownMin] = useState(30)
  const [currentTaskId, setCurrentTaskId] = useState<number | ''>('')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const running = timer.status !== 'idle'
  const pendingTasks = tasks.filter((t) => t.status === 'pending')

  useEffect(() => {
    void window.api.projects.list(false).then(setProjects)
  }, [])

  // refresh today's sessions whenever a session starts/ends
  useEffect(() => {
    void window.api.stats.history(50).then(setHistory)
  }, [timer.sessionId])

  // default to last used project + method-derived config once loaded
  useEffect(() => {
    if (prefs && projects.length > 0 && projectId === null) {
      const last = projects.find((p) => p.id === prefs.lastProjectId)
      setProjectId((last ?? projects[0]).id)
    }
    if (prefs && config === null) {
      void window.api.methods.list().then((methods) => {
        const last = methods.find((m) => m.id === prefs.lastMethodId) ?? methods[0]
        if (last) {
          setConfig({
            focusMin: Math.round(last.focus_sec / 60),
            shortMin: Math.round(last.short_pause_sec / 60),
            longMin: Math.round(last.long_pause_sec / 60),
            cycles: last.rounds_before_long
          })
        } else {
          setConfig({ focusMin: 25, shortMin: 5, longMin: 15, cycles: 4 })
        }
      })
    }
  }, [prefs, projects, projectId, config])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todaySessions = history.filter((h) => h.startedAt * 1000 >= todayStart.getTime())

  async function start(): Promise<void> {
    if (projectId === null) return
    const taskName = currentTaskId === '' ? null : (pendingTasks.find((t) => t.id === currentTaskId)?.name ?? null)
    if (mode === 'pomodoro') {
      if (!config) return
      await window.api.session.startPomodoro(projectId, config, taskName)
    } else {
      await window.api.session.startSimple(projectId, mode, mode === 'countdown' ? countdownMin * 60 : 0, taskName)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Focus Session</h1>
      <p className="mb-6 text-sm text-ink-muted">Enter deep work mode and eliminate all distractions</p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        {/* left: timer card */}
        {running ? (
          <ActiveCard />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-7 p-8">
            <Segmented
              options={[
                { value: 'countdown', label: 'Countdown' },
                { value: 'stopwatch', label: 'Stopwatch' },
                { value: 'pomodoro', label: 'Pomodoro' }
              ]}
              value={mode}
              onChange={setMode}
            />

            <TimerRing progress={0} size={240} stroke={4} color="var(--accent)">
              <div className="text-center">
                <p className="timer-digits text-[56px] text-ink">
                  {fmtClock(mode === 'pomodoro' ? (config?.focusMin ?? 25) * 60 : mode === 'countdown' ? countdownMin * 60 : 0)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">Ready</p>
                {mode === 'pomodoro' && config && (
                  <div className="mt-2 flex justify-center gap-1.5" aria-label={`${config.cycles} cycles`}>
                    {Array.from({ length: config.cycles }).map((_, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-line" />
                    ))}
                  </div>
                )}
              </div>
            </TimerRing>

            {mode === 'countdown' && (
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                Duration
                <Stepper
                  value={countdownMin}
                  display={`${countdownMin}m`}
                  label="duration"
                  onDecrement={() => setCountdownMin((v) => Math.max(5, v - 5))}
                  onIncrement={() => setCountdownMin((v) => Math.min(240, v + 5))}
                />
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-56"
              onClick={() => void start()}
              disabled={projectId === null}
            >
              <Play size={16} aria-hidden="true" /> Start Session
            </Button>
          </Card>
        )}

        {/* right column */}
        <div className="flex flex-col gap-4">
          {!running && (
            <Card className="p-5">
              <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">Project</h2>
              <div className="flex flex-wrap gap-2">
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
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">Current Task</h2>
            {running ? (
              <p className={`text-sm ${timer.taskName ? 'font-medium' : 'text-ink-muted'}`}>
                {timer.taskName ?? 'No task assigned to this session'}
              </p>
            ) : (
              <select
                aria-label="Current task"
                value={currentTaskId}
                onChange={(e) => setCurrentTaskId(e.target.value === '' ? '' : Number(e.target.value))}
                className="h-10 w-full cursor-pointer rounded-(--radius-btn) border border-line bg-surface-2 px-3 text-sm text-ink"
              >
                <option value="">No task selected</option>
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </Card>

          {!running && mode === 'pomodoro' && config && (
            <Card className="p-5">
              <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">
                Pomodoro Settings
              </h2>
              <div className="flex flex-col gap-2.5">
                <SettingRow label="Focus">
                  <Stepper
                    value={config.focusMin}
                    display={`${config.focusMin}m`}
                    label="focus minutes"
                    onDecrement={() => setConfig({ ...config, focusMin: Math.max(5, config.focusMin - 5) })}
                    onIncrement={() => setConfig({ ...config, focusMin: Math.min(120, config.focusMin + 5) })}
                  />
                </SettingRow>
                <SettingRow label="Short Break">
                  <Stepper
                    value={config.shortMin}
                    display={`${config.shortMin}m`}
                    label="short break minutes"
                    onDecrement={() => setConfig({ ...config, shortMin: Math.max(1, config.shortMin - 1) })}
                    onIncrement={() => setConfig({ ...config, shortMin: Math.min(30, config.shortMin + 1) })}
                  />
                </SettingRow>
                <SettingRow label="Long Break">
                  <Stepper
                    value={config.longMin}
                    display={`${config.longMin}m`}
                    label="long break minutes"
                    onDecrement={() => setConfig({ ...config, longMin: Math.max(5, config.longMin - 5) })}
                    onIncrement={() => setConfig({ ...config, longMin: Math.min(60, config.longMin + 5) })}
                  />
                </SettingRow>
                <SettingRow label="Cycles">
                  <Stepper
                    value={config.cycles}
                    label="cycles"
                    onDecrement={() => setConfig({ ...config, cycles: Math.max(2, config.cycles - 1) })}
                    onIncrement={() => setConfig({ ...config, cycles: Math.min(8, config.cycles + 1) })}
                  />
                </SettingRow>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">
              Today&apos;s Sessions
            </h2>
            {todaySessions.length === 0 && <p className="text-sm text-ink-muted">No sessions yet today.</p>}
            <ul className="flex flex-col gap-2">
              {todaySessions.slice(0, 5).map((s) => (
                <li key={s.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-medium">{s.projectName}</p>
                  <p className="text-xs text-ink-muted">
                    {fmtTime(s.startedAt)} · {fmtDuration(s.focusSec)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">Focus Tips</h2>
            <ul className="flex flex-col gap-2 text-sm text-ink-muted">
              <li className="flex items-center gap-2">
                <Droplets size={14} className="shrink-0 text-accent" aria-hidden="true" /> Stay hydrated during
                sessions
              </li>
              <li className="flex items-center gap-2">
                <Lightbulb size={14} className="shrink-0 text-accent" aria-hidden="true" /> Use the Pomodoro for best
                results
              </li>
              <li className="flex items-center gap-2">
                <Target size={14} className="shrink-0 text-accent" aria-hidden="true" /> Assign a task before starting
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      {children}
    </div>
  )
}

// ---------- active session card ----------

function ActiveCard(): React.JSX.Element {
  const timer = useTimerState()
  const isStopwatch = timer.mode === 'stopwatch'
  const progress = isStopwatch ? 0 : timer.plannedSec > 0 ? 1 - timer.remainingSec / timer.plannedSec : 0
  const isFocus = timer.phase === 'focus'
  const color = isFocus ? 'var(--accent)' : 'var(--pause)'

  return (
    <Card className="flex flex-col items-center justify-center gap-7 p-8">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: timer.projectColor }} aria-hidden="true" />
        {timer.projectName}
        {timer.methodName ? ` · ${timer.methodName}` : ''}
      </div>

      <TimerRing progress={progress} size={240} stroke={5} color={color}>
        <div className="text-center">
          <p className="mb-1 text-xs font-medium tracking-widest text-ink-muted uppercase">
            {isStopwatch ? 'Elapsed' : phaseLabel(timer.phase)}
            {timer.status === 'paused' && (timer.autoPaused ? ' · auto-paused' : ' · paused')}
          </p>
          <p className="timer-digits text-[52px] text-ink">{fmtClock(timer.remainingSec)}</p>
          {timer.mode === 'pomodoro' && (
            <div
              className="mt-2 flex justify-center gap-1.5"
              aria-label={`Round ${timer.round} of ${timer.roundsBeforeLong}`}
            >
              {Array.from({ length: timer.roundsBeforeLong }).map((_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < timer.round ? 'bg-accent' : 'bg-line'}`} />
              ))}
            </div>
          )}
        </div>
      </TimerRing>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="ghost" onClick={() => void window.api.session.pauseResume()}>
          {timer.status === 'paused' ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          {timer.status === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        {isFocus && timer.mode === 'pomodoro' && (
          <Button variant="ghost" onClick={() => void window.api.session.forcePause()}>
            <Coffee size={16} aria-hidden="true" />
            Take a break
          </Button>
        )}
        <Button variant="danger-ghost" onClick={() => void window.api.session.stop()}>
          <Square size={15} aria-hidden="true" />
          End session
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={() => window.api.ui.showWidget()}>
        <Minimize2 size={15} aria-hidden="true" />
        Switch to widget
      </Button>
    </Card>
  )
}
