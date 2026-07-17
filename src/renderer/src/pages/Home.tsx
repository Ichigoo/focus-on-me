import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Check, CheckCircle2, Clock, Flame, MoonStar, PartyPopper, Play } from 'lucide-react'
import type { TaskWithStatus } from '@shared/types'
import { computePrayerTimes, PRAYER_LABELS, PRAYER_ORDER } from '@shared/prayerTimes'
import { useSettings, useTimerState, useTodayTasks } from '../lib/hooks'
import { fmtClock, fmtDuration, phaseLabel } from '../lib/format'
import { playSound } from '../lib/sounds'
import { burstConfetti } from '../components/ConfettiBurst'
import { Card, Chip, EmptyState } from '../components/ui'
import { TimerRing } from '../components/TimerRing'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const priorityTone = { high: 'danger', medium: 'warning', low: 'success' } as const

export default function Home(): React.JSX.Element {
  const { tasks, loading, setStatus } = useTodayTasks()
  const [prefs] = useSettings()
  const timer = useTimerState()
  const navigate = useNavigate()
  const muted = prefs?.masterMute ?? false

  const [focusTodaySec, setFocusTodaySec] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    let mounted = true
    void window.api.stats.summary('today').then((s) => mounted && setFocusTodaySec(s.totalFocusSec))
    void window.api.stats.summary('all').then((s) => mounted && setStreak(s.currentStreak))
    return () => {
      mounted = false
    }
  }, [timer.sessionId])

  const todo = tasks.filter((t) => t.status === 'pending')
  const done = tasks.filter((t) => t.status === 'done')
  const actionedCount = tasks.filter((t) => t.status !== 'pending').length
  const allDone = tasks.length > 0 && actionedCount === tasks.length && done.length > 0

  // next prayer (only when an Adhan location is configured)
  const nextPrayer = useMemo(() => {
    if (!prefs?.adhanLocation) return null
    const now = Date.now()
    for (const dayOffset of [0, 1]) {
      const date = new Date()
      date.setDate(date.getDate() + dayOffset)
      const times = computePrayerTimes(prefs.adhanLocation, prefs.adhanMethod, prefs.adhanMadhab, date)
      for (const name of PRAYER_ORDER) {
        if (times[name] > now) {
          return { label: PRAYER_LABELS[name], at: times[name] }
        }
      }
    }
    return null
  }, [prefs, timer.sessionId])

  const celebratedForDay = useRef<string | null>(null)
  const celebrationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!allDone) return
    const key = new Date().toDateString()
    if (celebratedForDay.current === key) return
    celebratedForDay.current = key
    const rect = celebrationRef.current?.getBoundingClientRect()
    burstConfetti(
      {
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      },
      { count: 48, scale: 1.4 }
    )
  }, [allDone])

  const handleDone = (task: TaskWithStatus, anchor: HTMLElement): void => {
    const wasDone = task.status === 'done'
    void setStatus(task.id, wasDone ? null : 'done')
    if (!wasDone) {
      const rect = anchor.getBoundingClientRect()
      burstConfetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      playSound('task-done', muted)
    }
  }

  const name = prefs?.userName?.trim()
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const running = timer.status !== 'idle'
  const progress =
    running && timer.mode !== 'stopwatch' && timer.plannedSec > 0 ? 1 - timer.remainingSec / timer.plannedSec : 0
  const ringColor = running && timer.phase !== 'focus' ? 'var(--pause)' : 'var(--accent)'

  function nextPrayerText(): string | null {
    if (!nextPrayer) return null
    const minutes = Math.max(1, Math.round((nextPrayer.at - Date.now()) / 60000))
    if (minutes < 90) return `${nextPrayer.label} in ${minutes}m`
    return `${nextPrayer.label} at ${new Date(nextPrayer.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-8 py-8">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="shrink-0 text-sm text-ink-muted">{today}</p>
      </div>

      {/* hero clock */}
      <div className="mb-8 flex flex-col items-center gap-6">
        <TimerRing progress={progress} size={230} stroke={4} color={ringColor}>
          <div className="text-center">
            <p className="timer-digits text-[54px] text-ink">
              {running ? fmtClock(timer.remainingSec) : fmtClock(25 * 60)}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {running
                ? timer.mode === 'stopwatch'
                  ? 'Elapsed'
                  : `${phaseLabel(timer.phase)}${timer.status === 'paused' ? ' · paused' : ''}`
                : 'Ready when you are'}
            </p>
          </div>
        </TimerRing>

        <button
          onClick={() => navigate('/focus')}
          className="btn-gradient flex cursor-pointer items-center gap-2 rounded-(--radius-btn) px-8 py-3 text-base font-medium text-white transition-transform active:scale-[0.98]"
        >
          <Play size={17} aria-hidden="true" />
          {running ? 'Open session' : 'Start Focus'}
        </button>

        {/* today at a glance */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="text-accent" aria-hidden="true" />
            {fmtDuration(focusTodaySec)} today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flame size={14} className="text-warning" aria-hidden="true" />
            {streak > 0 ? `${streak}-day streak` : 'No streak yet'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
            {todo.length === 0 ? 'All tasks done' : `${todo.length} ${todo.length === 1 ? 'task' : 'tasks'} left`}
          </span>
          {nextPrayer && (
            <span className="inline-flex items-center gap-1.5">
              <MoonStar size={14} className="text-accent" aria-hidden="true" />
              {nextPrayerText()}
            </span>
          )}
        </div>
      </div>

      {/* today's tasks */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Today&apos;s Tasks</h2>
          <NavLink to="/tasks" className="text-xs font-medium text-accent hover:underline">
            View all →
          </NavLink>
        </div>

        {!loading && tasks.length === 0 && (
          <>
            <EmptyState title="No tasks for today" />
            <NavLink to="/tasks" className="mt-1 block text-center text-sm font-medium text-accent hover:underline">
              Create your first task →
            </NavLink>
          </>
        )}

        {tasks.length > 0 && (
          <ul className="flex flex-col divide-y divide-line/60">
            {[...todo, ...done].map((task) => (
              <TaskRow key={task.id} task={task} onDone={handleDone} />
            ))}
          </ul>
        )}

        {allDone && (
          <div ref={celebrationRef} className="mt-4 rounded-(--radius-card) bg-accent-soft px-4 py-5 text-center">
            <PartyPopper size={26} className="mx-auto mb-2 text-accent" aria-hidden="true" />
            <p className="text-lg font-semibold text-ink">All done for today</p>
            <p className="mt-1 text-sm text-ink-muted">Nice work — every task is handled.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function TaskRow({
  task,
  onDone
}: {
  task: TaskWithStatus
  onDone: (task: TaskWithStatus, anchor: HTMLElement) => void
}): React.JSX.Element {
  const isDone = task.status === 'done'
  const isIgnored = task.status === 'ignored'

  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        aria-label={isDone ? `Undo ${task.name}` : `Mark ${task.name} done`}
        aria-pressed={isDone}
        onClick={(e) => onDone(task, e.currentTarget)}
        className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          isDone ? 'border-accent bg-accent text-accent-contrast' : 'border-line text-transparent hover:border-accent/50'
        }`}
      >
        <Check size={13} aria-hidden="true" />
      </button>

      <p
        className={`min-w-0 flex-1 truncate text-sm ${
          isDone || isIgnored ? 'text-ink-muted line-through' : 'font-medium'
        }`}
      >
        {task.name}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {task.streak > 0 && (
          <span
            className={`inline-flex items-center gap-1 text-xs text-warning ${task.streak >= 3 ? 'flame-flicker' : ''}`}
          >
            <Flame size={12} aria-hidden="true" /> {task.streak}
          </span>
        )}
        {task.overdue && <Chip tone="danger">overdue</Chip>}
        <Chip tone={priorityTone[task.priority]}>{task.priority}</Chip>
        {task.time_hhmm && <span className="text-xs text-ink-muted">{task.time_hhmm}</span>}
      </div>
    </li>
  )
}
