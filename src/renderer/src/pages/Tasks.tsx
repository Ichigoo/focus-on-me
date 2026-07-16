import { useEffect, useState } from 'react'
import { Check, Flame, Pencil, Plus, Trash2 } from 'lucide-react'
import type { TaskInput, TaskWithStatus } from '@shared/types'
import { Button, ConfirmDialog, EmptyState, SectionCard, Segmented, Toggle } from '../components/ui'

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

interface TaskDraft {
  id?: number
  name: string
  repeat: boolean
  frequency: 'daily' | 'weekly'
  weekdays: number
  once_date: string
  hasTime: boolean
  time_hhmm: string
}

const emptyDraft: TaskDraft = {
  name: '',
  repeat: true,
  frequency: 'daily',
  weekdays: ALL_WEEKDAYS,
  once_date: '',
  hasTime: false,
  time_hhmm: ''
}

function fmtShortDate(day: string): string {
  return new Date(day + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function scheduleSummary(task: TaskWithStatus): string {
  if (task.schedule_kind === 'daily') return 'Daily'
  if (task.schedule_kind === 'weekly') {
    if (task.weekdays === ALL_WEEKDAYS) return 'Daily'
    const labels = WEEKDAYS.filter((w) => task.weekdays & w.bit).map((w) => w.label)
    return labels.length ? labels.join(' · ') : 'No days selected'
  }
  return task.once_date ? `Once — ${fmtShortDate(task.once_date)}` : 'Once'
}

function statusLabel(task: TaskWithStatus): { text: string; tone: 'muted' | 'done' | 'ignored' | 'overdue' } {
  if (task.schedule_kind === 'once') {
    if (task.status === 'done') return { text: 'Completed', tone: 'done' }
    if (task.status === 'ignored') return { text: 'Missed', tone: 'ignored' }
    if (task.overdue) return { text: 'Overdue', tone: 'overdue' }
    return { text: 'Upcoming', tone: 'muted' }
  }
  if (task.status === 'done') return { text: 'Done today', tone: 'done' }
  if (task.status === 'ignored') return { text: 'Skipped today', tone: 'ignored' }
  return { text: 'Pending today', tone: 'muted' }
}

export default function Tasks(): React.JSX.Element {
  const [tasks, setTasks] = useState<TaskWithStatus[]>([])
  const [draft, setDraft] = useState<TaskDraft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TaskWithStatus | null>(null)
  const [error, setError] = useState('')

  const reload = (): void => void window.api.tasks.list().then(setTasks)
  useEffect(() => {
    reload()
    return window.api.tasks.onChanged(reload)
  }, [])

  const buildInput = (d: TaskDraft): TaskInput =>
    d.repeat
      ? {
          name: d.name.trim(),
          schedule_kind: d.frequency,
          weekdays: d.frequency === 'weekly' ? d.weekdays : ALL_WEEKDAYS,
          once_date: null,
          time_hhmm: d.hasTime ? d.time_hhmm || null : null
        }
      : {
          name: d.name.trim(),
          schedule_kind: 'once',
          weekdays: ALL_WEEKDAYS,
          once_date: d.once_date || null,
          time_hhmm: d.hasTime ? d.time_hhmm || null : null
        }

  const validate = (d: TaskDraft): string | null => {
    if (!d.name.trim()) return 'Give the task a name.'
    if (d.repeat && d.frequency === 'weekly' && d.weekdays === 0) return 'Select at least one day.'
    if (!d.repeat && !d.once_date) return 'Choose a date.'
    if (d.hasTime && !d.time_hhmm) return "Choose a time, or turn off the reminder."
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

  const remove = async (task: TaskWithStatus): Promise<void> => {
    await window.api.tasks.remove(task.id)
    setConfirmDelete(null)
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
      time_hhmm: task.time_hhmm ?? ''
    })
    setError('')
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display mb-8 text-3xl">Tasks</h1>
      <SectionCard title="Your tasks">
        <ul className="mb-4 flex flex-col divide-y divide-line/60">
          {tasks.map((task) => {
            const status = statusLabel(task)
            const toneClass =
              status.tone === 'done'
                ? 'text-accent'
                : status.tone === 'ignored'
                  ? 'text-ink-muted line-through'
                  : status.tone === 'overdue'
                    ? 'text-danger'
                    : 'text-ink-muted'
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{task.name}</p>
                  <p className="text-xs text-ink-muted">
                    {scheduleSummary(task)}
                    {task.time_hhmm ? ` · at ${task.time_hhmm}` : ''}
                    {' · '}
                    <span className={toneClass}>{status.text}</span>
                    {task.streak > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-pause">
                        <Flame size={12} aria-hidden="true" /> {task.streak}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`Edit ${task.name}`} onClick={() => startEdit(task)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={`Delete ${task.name}`} danger onClick={() => setConfirmDelete(task)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
        {tasks.length === 0 && !draft && (
          <EmptyState title="No tasks yet" hint="Add one below to start building a streak." />
        )}

        {draft ? (
          <TaskForm
            draft={draft}
            setDraft={setDraft}
            error={error}
            onSave={() => void save()}
            onCancel={() => {
              setDraft(null)
              setError('')
            }}
          />
        ) : (
          <Button size="sm" onClick={() => setDraft(emptyDraft)}>
            <Plus size={15} aria-hidden="true" /> Add task
          </Button>
        )}
      </SectionCard>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete task?"
        body={`"${confirmDelete?.name}" and its history will be removed permanently.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

function TaskForm({
  draft,
  setDraft,
  error,
  onSave,
  onCancel
}: {
  draft: TaskDraft
  setDraft: (d: TaskDraft) => void
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
          <p className="text-xs text-ink-muted">Get a notification when it's due</p>
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

function IconButton({
  label,
  danger = false,
  onClick,
  children
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 ${
        danger ? 'text-ink-muted hover:bg-danger/10 hover:text-danger' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
