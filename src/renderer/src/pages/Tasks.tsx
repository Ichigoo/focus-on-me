import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Flame, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Project, TaskInput, TaskPriority, TaskWithStatus } from '@shared/types'
import { todayString } from '../lib/hooks'
import { playSound } from '../lib/sounds'
import { burstConfetti } from '../components/ConfettiBurst'
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  ProgressBar,
  Segmented,
  Toggle
} from '../components/ui'

// bit = 1 << Date.getDay() (bit0 = Sunday); rendered Monday-first in the UI only.
const WEEKDAYS: { bit: number; label: string }[] = [
  { bit: 1 << 1, label: 'Mon' },
  { bit: 1 << 2, label: 'Tue' },
  { bit: 1 << 3, label: 'Wed' },
  { bit: 1 << 4, label: 'Thu' },
  { bit: 1 << 5, label: 'Fri' },
  { bit: 1 << 6, label: 'Sat' },
  { bit: 1 << 0, label: 'Sun' }
]
const ALL_WEEKDAYS = WEEKDAYS.reduce((m, w) => m | w.bit, 0)

const priorityBorder = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--success)'
} as const

type Tab = 'today' | 'upcoming' | 'completed'
type PriorityFilter = 'all' | TaskPriority

interface TaskDraft {
  id?: number
  name: string
  repeat: boolean
  frequency: 'daily' | 'weekly'
  weekdays: number
  once_date: string
  hasTime: boolean
  time_hhmm: string
  priority: TaskPriority
  project_id: number | null
}

function isScheduledToday(task: TaskWithStatus, today: string): boolean {
  if (today < task.created_day) return false
  if (task.schedule_kind === 'daily') return true
  if (task.schedule_kind === 'weekly') {
    const dow = new Date(today + 'T00:00:00').getDay()
    return (task.weekdays & (1 << dow)) !== 0
  }
  return task.once_date === today || !!task.overdue
}

function dueLabel(task: TaskWithStatus, today: string): string {
  if (task.schedule_kind !== 'once' || !task.once_date) return 'Today'
  const d = new Date(task.once_date + 'T00:00:00')
  const t = new Date(today + 'T00:00:00')
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Tasks(): React.JSX.Element {
  const [tasks, setTasks] = useState<TaskWithStatus[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tab, setTab] = useState<Tab>('today')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [quickName, setQuickName] = useState('')
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium')
  const [quickProject, setQuickProject] = useState<number | ''>('')
  const [draft, setDraft] = useState<TaskDraft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TaskWithStatus | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  const today = todayString()

  const reload = (): void => void window.api.tasks.list().then(setTasks)
  useEffect(() => {
    reload()
    void window.api.projects.list(false).then(setProjects)
    return window.api.tasks.onChanged(reload)
  }, [])

  const buckets = useMemo(() => {
    const todayList = tasks.filter((t) => isScheduledToday(t, today) && t.status !== 'done')
    const upcoming = tasks.filter((t) => !isScheduledToday(t, today) && t.status !== 'done')
    const completed = tasks.filter((t) => t.status === 'done')
    return { today: todayList, upcoming, completed }
  }, [tasks, today])

  const visible = buckets[tab].filter((t) => priorityFilter === 'all' || t.priority === priorityFilter)
  const pendingCount = buckets.today.length
  const completedCount = buckets.completed.length

  async function quickAdd(): Promise<void> {
    const name = quickName.trim()
    if (!name) return
    await window.api.tasks.create({
      name,
      schedule_kind: 'once',
      weekdays: ALL_WEEKDAYS,
      once_date: today,
      time_hhmm: null,
      priority: quickPriority,
      project_id: quickProject === '' ? null : quickProject
    })
    setQuickName('')
    reload()
  }

  async function toggleDone(task: TaskWithStatus, anchor: HTMLElement): Promise<void> {
    const wasDone = task.status === 'done'
    await window.api.tasks.setStatus(task.id, today, wasDone ? null : 'done')
    if (!wasDone) {
      const rect = anchor.getBoundingClientRect()
      burstConfetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      playSound('task-done', false)
    }
    reload()
  }

  function toggleExpanded(id: number): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ----- full edit form (kept from the original design) -----

  const buildInput = (d: TaskDraft): TaskInput =>
    d.repeat
      ? {
          name: d.name.trim(),
          schedule_kind: d.frequency,
          weekdays: d.frequency === 'weekly' ? d.weekdays : ALL_WEEKDAYS,
          once_date: null,
          time_hhmm: d.hasTime ? d.time_hhmm || null : null,
          priority: d.priority,
          project_id: d.project_id
        }
      : {
          name: d.name.trim(),
          schedule_kind: 'once',
          weekdays: ALL_WEEKDAYS,
          once_date: d.once_date || null,
          time_hhmm: d.hasTime ? d.time_hhmm || null : null,
          priority: d.priority,
          project_id: d.project_id
        }

  const validate = (d: TaskDraft): string | null => {
    if (!d.name.trim()) return 'Give the task a name.'
    if (d.repeat && d.frequency === 'weekly' && d.weekdays === 0) return 'Select at least one day.'
    if (!d.repeat && !d.once_date) return 'Choose a date.'
    if (d.hasTime && !d.time_hhmm) return 'Choose a time, or turn off the reminder.'
    return null
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    const msg = validate(draft)
    if (msg) return setError(msg)
    const input = buildInput(draft)
    if (draft.id) await window.api.tasks.update(draft.id, input)
    else await window.api.tasks.create(input)
    setDraft(null)
    setError('')
    reload()
  }

  const startEdit = (task: TaskWithStatus): void => {
    setDraft({
      id: task.id,
      name: task.name,
      repeat: task.schedule_kind !== 'once',
      frequency: task.schedule_kind === 'weekly' ? 'weekly' : 'daily',
      weekdays: task.weekdays || ALL_WEEKDAYS,
      once_date: task.once_date ?? '',
      hasTime: !!task.time_hhmm,
      time_hhmm: task.time_hhmm ?? '',
      priority: task.priority,
      project_id: task.project_id
    })
    setError('')
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Tasks</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {pendingCount} pending · {completedCount} completed
      </p>

      {/* quick add */}
      <div className="mb-5 flex items-center gap-2">
        <input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void quickAdd()}
          placeholder="Add a new task and press Enter…"
          aria-label="New task name"
          className="h-11 min-w-0 flex-1 rounded-(--radius-btn) border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-muted/60"
        />
        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
          aria-label="Priority"
          className="h-11 cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={quickProject}
          onChange={(e) => setQuickProject(e.target.value === '' ? '' : Number(e.target.value))}
          aria-label="Project"
          className="h-11 cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          aria-label="Add task"
          onClick={() => void quickAdd()}
          className="btn-gradient flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-transform active:scale-95"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      {/* tabs */}
      <div className="mb-3">
        <Segmented
          grow
          options={[
            { value: 'today', label: 'Today', count: buckets.today.length },
            { value: 'upcoming', label: 'Upcoming', count: buckets.upcoming.length },
            { value: 'completed', label: 'Completed', count: buckets.completed.length }
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* priority filter */}
      <div className="mb-4 flex gap-1.5">
        {(['all', 'high', 'medium', 'low'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            aria-pressed={priorityFilter === p}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              priorityFilter === p ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* task list */}
      {visible.length === 0 && (
        <Card className="p-6">
          <EmptyState
            title={tab === 'completed' ? 'Nothing completed yet' : 'No tasks here'}
            hint={tab === 'today' ? 'Add one above to start building a streak.' : undefined}
          />
        </Card>
      )}

      <div className="flex flex-col gap-2.5">
        {visible.map((task) => (
          <div key={task.id}>
            <TaskRow
              task={task}
              today={today}
              expanded={expanded.has(task.id)}
              onToggleExpand={() => toggleExpanded(task.id)}
              onToggleDone={(anchor) => void toggleDone(task, anchor)}
              onEdit={() => startEdit(task)}
              onDelete={() => setConfirmDelete(task)}
              onChanged={reload}
            />
            {/* inline edit form directly under the row being edited */}
            {draft?.id === task.id && (
              <div className="mt-2">
                <TaskForm
                  draft={draft}
                  setDraft={setDraft}
                  projects={projects}
                  error={error}
                  onSave={() => void save()}
                  onCancel={() => {
                    setDraft(null)
                    setError('')
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete task?"
        body={`"${confirmDelete?.name}" and its history will be removed permanently.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) {
            void window.api.tasks.remove(confirmDelete.id).then(() => {
              setConfirmDelete(null)
              reload()
            })
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

// ---------- task row with subtasks ----------

function TaskRow({
  task,
  today,
  expanded,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onChanged
}: {
  task: TaskWithStatus
  today: string
  expanded: boolean
  onToggleExpand: () => void
  onToggleDone: (anchor: HTMLElement) => void
  onEdit: () => void
  onDelete: () => void
  onChanged: () => void
}): React.JSX.Element {
  const [newSub, setNewSub] = useState('')
  const isDone = task.status === 'done'
  const doneSubs = task.subtasks.filter((s) => s.done).length
  const hasSubs = task.subtasks.length > 0
  const due = dueLabel(task, today)

  async function addSub(): Promise<void> {
    const name = newSub.trim()
    if (!name) return
    await window.api.subtasks.add(task.id, name)
    setNewSub('')
    onChanged()
  }

  return (
    <Card className="group border-l-3 px-4 py-3" style={{ borderLeftColor: priorityBorder[task.priority] }}>
      <div className="flex items-center gap-3">
        <button
          aria-label={isDone ? `Undo ${task.name}` : `Mark ${task.name} done`}
          aria-pressed={isDone}
          onClick={(e) => onToggleDone(e.currentTarget)}
          className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors duration-150 ${
            isDone
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-line text-transparent hover:border-accent/50'
          }`}
        >
          <Check size={13} aria-hidden="true" />
        </button>

        {hasSubs ? (
          <button
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.name}`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
          >
            {expanded ? (
              <ChevronDown size={14} className="shrink-0 text-ink-muted" aria-hidden="true" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-ink-muted" aria-hidden="true" />
            )}
            <span className={`truncate text-sm ${isDone ? 'text-ink-muted line-through' : 'font-medium'}`}>
              {task.name}
            </span>
          </button>
        ) : (
          <span className={`min-w-0 flex-1 truncate text-sm ${isDone ? 'text-ink-muted line-through' : 'font-medium'}`}>
            {task.name}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {task.streak > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs text-warning ${task.streak >= 3 ? 'flame-flicker' : ''}`}
            >
              <Flame size={12} aria-hidden="true" /> {task.streak}
            </span>
          )}
          {due !== 'Today' && <span className="text-xs text-ink-muted">{due}</span>}
          {task.overdue && <Chip tone="danger">overdue</Chip>}
          {task.projectName && (
            <Chip
              tone="neutral"
              style={task.projectColor ? { color: task.projectColor, background: `${task.projectColor}22` } : undefined}
            >
              {task.projectName}
            </Chip>
          )}
          {!hasSubs && (
            <button
              aria-label={`Add subtask to ${task.name}`}
              title="Add subtask"
              onClick={onToggleExpand}
              className="cursor-pointer rounded-lg p-1.5 text-ink-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-2 hover:text-ink"
            >
              <ListPlus size={14} aria-hidden="true" />
            </button>
          )}
          <button
            aria-label={`Edit ${task.name}`}
            onClick={onEdit}
            className="cursor-pointer rounded-lg p-1.5 text-ink-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-2 hover:text-ink"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            aria-label={`Delete ${task.name}`}
            onClick={onDelete}
            className="cursor-pointer rounded-lg p-1.5 text-ink-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {hasSubs && !expanded && (
        <div className="mt-2 ml-9 flex items-center gap-3">
          <ProgressBar fraction={doneSubs / task.subtasks.length} className="max-w-56" />
          <span className="shrink-0 text-[11px] text-ink-muted">
            {doneSubs}/{task.subtasks.length} subtasks
          </span>
        </div>
      )}

      {expanded && (
        <div className="mt-3 ml-9 flex flex-col gap-2">
          {task.subtasks.map((sub) => (
            <div key={sub.id} className="group/sub flex items-center gap-2.5">
              <button
                aria-label={sub.done ? `Undo ${sub.name}` : `Mark ${sub.name} done`}
                aria-pressed={!!sub.done}
                onClick={() => void window.api.subtasks.toggle(sub.id, !sub.done).then(onChanged)}
                className={`flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
                  sub.done
                    ? 'border-accent bg-accent text-accent-contrast'
                    : 'border-line text-transparent hover:border-accent/50'
                }`}
              >
                <Check size={10} aria-hidden="true" />
              </button>
              <span className={`min-w-0 flex-1 truncate text-[13px] ${sub.done ? 'text-ink-muted line-through' : ''}`}>
                {sub.name}
              </span>
              <button
                aria-label={`Delete subtask ${sub.name}`}
                onClick={() => void window.api.subtasks.remove(sub.id).then(onChanged)}
                className="cursor-pointer rounded p-1 text-ink-muted opacity-0 transition-all group-hover/sub:opacity-100 hover:text-danger"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}

          {hasSubs && (
            <div className="flex items-center gap-3">
              <ProgressBar fraction={hasSubs ? doneSubs / task.subtasks.length : 0} className="max-w-56" />
              <span className="shrink-0 text-[11px] text-ink-muted">
                {doneSubs}/{task.subtasks.length} subtasks
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addSub()}
              placeholder="+ Add subtask"
              aria-label={`Add subtask to ${task.name}`}
              className="h-8 w-64 rounded-lg border border-transparent bg-transparent px-2 text-[13px] text-ink placeholder:text-ink-muted/60 focus:border-line focus:bg-surface-2"
            />
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------- full edit form ----------

function TaskForm({
  draft,
  setDraft,
  projects,
  error,
  onSave,
  onCancel
}: {
  draft: TaskDraft
  setDraft: (d: TaskDraft) => void
  projects: Project[]
  error: string
  onSave: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="rounded-(--radius-card) border border-line bg-surface-2/50 p-4">
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-ink-muted">Name</span>
        <input
          autoFocus
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-9 w-full rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
          placeholder="e.g. Read for 20 minutes"
        />
      </label>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-muted">Priority</span>
          <select
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
            className="h-9 w-full cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-muted">Project</span>
          <select
            value={draft.project_id ?? ''}
            onChange={(e) => setDraft({ ...draft, project_id: e.target.value === '' ? null : Number(e.target.value) })}
            className="h-9 w-full cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Repeat</p>
          <p className="text-xs text-ink-muted">Off lets you pick a single date</p>
        </div>
        <Toggle checked={draft.repeat} onChange={(v) => setDraft({ ...draft, repeat: v })} label="Repeat" />
      </div>

      {draft.repeat ? (
        <div className="mb-3">
          <Segmented
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Specific days' }
            ]}
            value={draft.frequency}
            onChange={(v) => setDraft({ ...draft, frequency: v })}
          />
          {draft.frequency === 'weekly' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.bit}
                  aria-pressed={(draft.weekdays & w.bit) !== 0}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      weekdays: draft.weekdays & w.bit ? draft.weekdays & ~w.bit : draft.weekdays | w.bit
                    })
                  }
                  className={`h-9 w-12 cursor-pointer rounded-(--radius-btn) border text-sm transition-colors duration-150 ${
                    draft.weekdays & w.bit
                      ? 'border-accent bg-accent-soft font-medium text-ink'
                      : 'border-line bg-surface text-ink-muted hover:text-ink'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-ink-muted">Date</span>
          <input
            type="date"
            value={draft.once_date}
            onChange={(e) => setDraft({ ...draft, once_date: e.target.value })}
            className="h-9 w-full rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
          />
        </label>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Remind at a time</p>
          <p className="text-xs text-ink-muted">Get a notification when it&apos;s due</p>
        </div>
        <Toggle checked={draft.hasTime} onChange={(v) => setDraft({ ...draft, hasTime: v })} label="Remind at a time" />
      </div>
      {draft.hasTime && (
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-ink-muted">Time</span>
          <input
            type="time"
            value={draft.time_hhmm}
            onChange={(e) => setDraft({ ...draft, time_hhmm: e.target.value })}
            className="h-9 w-full rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
          />
        </label>
      )}

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onSave}>
          <Check size={15} aria-hidden="true" /> Save task
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
