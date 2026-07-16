import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Check,
  Clock,
  Flame,
  Moon,
  PartyPopper,
  Settings as SettingsIcon,
  SkipForward,
  Timer
} from 'lucide-react'
import type { TaskWithStatus } from '@shared/types'
import { useSettings, useTimerState, useTodayTasks } from '../lib/hooks'
import { playSound } from '../lib/sounds'
import { burstConfetti } from '../components/ConfettiBurst'
import { Card, EmptyState } from '../components/ui'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home(): React.JSX.Element {
  const { tasks, loading, setStatus } = useTodayTasks()
  const [prefs] = useSettings()
  const timer = useTimerState()
  const muted = prefs?.masterMute ?? false

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const actionedCount = tasks.filter((t) => t.status !== 'pending').length
  const allDone = tasks.length > 0 && actionedCount === tasks.length && doneCount > 0

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

  const handleSkip = (task: TaskWithStatus): void => {
    void setStatus(task.id, task.status === 'ignored' ? null : 'ignored')
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display mb-1 text-3xl">{greeting()}</h1>
      <p className="mb-8 text-sm text-ink-muted">Here&apos;s what&apos;s on today.</p>

      {timer.status !== 'idle' && (
        <NavLink
          to="/focus"
          className="mb-6 flex items-center justify-between gap-3 rounded-(--radius-card) border border-accent/30 bg-accent-soft px-4 py-3 text-sm transition-transform duration-150 hover:scale-[1.005]"
        >
          <span className="font-medium text-ink">
            {timer.phase === 'focus' ? 'Focus session in progress' : 'On a break'} · {timer.projectName}
          </span>
          <span className="font-medium text-accent">Open →</span>
        </NavLink>
      )}

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-semibold">Today&apos;s tasks</h2>

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
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onDone={handleDone} onSkip={handleSkip} />
            ))}
          </ul>
        )}

        {allDone && (
          <div ref={celebrationRef} className="mt-6 rounded-(--radius-card) bg-accent-soft px-4 py-6 text-center">
            <PartyPopper size={28} className="mx-auto mb-2 text-accent" aria-hidden="true" />
            <p className="font-display text-xl text-ink">All done for today</p>
            <p className="mt-1 text-sm text-ink-muted">Nice work — every task is handled.</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ShortcutCard to="/focus" label="Focus" icon={Timer} />
        <ShortcutCard to="/dashboard" label="Dashboard" icon={BarChart3} />
        <ShortcutCard to="/adhan" label="Adhan" icon={Moon} />
        <ShortcutCard to="/settings" label="Settings" icon={SettingsIcon} />
      </div>
    </div>
  )
}

function TaskRow({
  task,
  onDone,
  onSkip
}: {
  task: TaskWithStatus
  onDone: (task: TaskWithStatus, anchor: HTMLElement) => void
  onSkip: (task: TaskWithStatus) => void
}): React.JSX.Element {
  const isDone = task.status === 'done'
  const isIgnored = task.status === 'ignored'

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        aria-label={isDone ? `Undo ${task.name}` : `Mark ${task.name} done`}
        aria-pressed={isDone}
        onClick={(e) => onDone(task, e.currentTarget)}
        className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          isDone ? 'border-accent bg-accent text-accent-contrast' : 'border-line text-transparent hover:border-accent/50'
        }`}
      >
        <Check size={18} aria-hidden="true" />
      </button>

      <div className={`min-w-0 flex-1 ${isIgnored ? 'text-ink-muted line-through' : ''}`}>
        <p className="truncate text-sm font-medium">{task.name}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {task.time_hhmm && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden="true" /> {task.time_hhmm}
            </span>
          )}
          {task.overdue && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">overdue</span>}
          {task.streak > 0 && (
            <span className={`inline-flex items-center gap-1 text-pause ${task.streak >= 3 ? 'flame-flicker' : ''}`}>
              <Flame size={12} aria-hidden="true" /> {task.streak}
            </span>
          )}
        </div>
      </div>

      {!isDone && (
        <button
          aria-label={isIgnored ? `Undo skip for ${task.name}` : `Skip ${task.name}`}
          aria-pressed={isIgnored}
          onClick={() => onSkip(task)}
          className={`shrink-0 cursor-pointer rounded-(--radius-btn) px-2.5 py-1.5 text-xs transition-colors duration-150 ${
            isIgnored ? 'bg-surface-2 text-ink-muted' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <SkipForward size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

function ShortcutCard({
  to,
  label,
  icon: Icon
}: {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}): React.JSX.Element {
  return (
    <NavLink to={to}>
      <Card className="flex flex-col items-center gap-2 p-5 text-center transition-transform duration-150 hover:scale-[1.02]">
        <Icon size={22} className="text-accent" />
        <span className="text-sm font-medium text-ink">{label}</span>
      </Card>
    </NavLink>
  )
}
