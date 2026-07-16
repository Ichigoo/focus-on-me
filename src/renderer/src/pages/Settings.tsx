import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import type { Method, PauseMessage, Project } from '@shared/types'
import { PROJECT_COLORS } from '@shared/types'
import { useSettings } from '../lib/hooks'
import { Button, ConfirmDialog, EmptyState, SectionCard, Toggle } from '../components/ui'

export default function Settings(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display mb-8 text-3xl">Settings</h1>
      <div className="flex flex-col gap-6">
        <MethodsSection />
        <ProjectsSection />
        <MessagesSection />
        <SoundsSection />
        <TasksSection />
        <GeneralSection />
      </div>
    </div>
  )
}

// ---------------- methods ----------------

interface MethodDraft {
  id?: number
  name: string
  focusMin: string
  shortMin: string
  longMin: string
  rounds: string
}

const emptyMethodDraft: MethodDraft = { name: '', focusMin: '25', shortMin: '5', longMin: '15', rounds: '4' }

function MethodsSection(): React.JSX.Element {
  const [methods, setMethods] = useState<Method[]>([])
  const [draft, setDraft] = useState<MethodDraft | null>(null)
  const [error, setError] = useState('')

  const reload = (): void => void window.api.methods.list().then(setMethods)
  useEffect(reload, [])

  const save = async (): Promise<void> => {
    if (!draft) return
    const name = draft.name.trim()
    const focus = Number(draft.focusMin)
    const short = Number(draft.shortMin)
    const long = Number(draft.longMin)
    const rounds = Number(draft.rounds)
    if (!name) return setError('Give the method a name.')
    if (!(focus > 0 && short > 0 && long > 0 && rounds >= 1)) {
      return setError('Durations must be positive numbers and rounds at least 1.')
    }
    const payload = {
      name,
      focus_sec: Math.round(focus * 60),
      short_pause_sec: Math.round(short * 60),
      long_pause_sec: Math.round(long * 60),
      rounds_before_long: Math.round(rounds)
    }
    if (draft.id) await window.api.methods.update({ id: draft.id, ...payload })
    else await window.api.methods.create(payload)
    setDraft(null)
    setError('')
    reload()
  }

  const remove = async (id: number): Promise<void> => {
    const res = await window.api.methods.remove(id)
    if (!res.ok && res.reason) setError(res.reason)
    else setError('')
    reload()
  }

  return (
    <SectionCard title="Focus methods">
      <ul className="mb-4 flex flex-col divide-y divide-line/60">
        {methods.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm font-medium">
                {m.name}
                {m.is_preset ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">preset</span> : null}
              </p>
              <p className="text-xs text-ink-muted">
                {Math.round(m.focus_sec / 60)} min focus · {Math.round(m.short_pause_sec / 60)} min short ·{' '}
                {Math.round(m.long_pause_sec / 60)} min long · long break every {m.rounds_before_long} rounds
              </p>
            </div>
            {!m.is_preset && (
              <div className="flex shrink-0 gap-1">
                <IconButton
                  label={`Edit ${m.name}`}
                  onClick={() =>
                    setDraft({
                      id: m.id,
                      name: m.name,
                      focusMin: String(Math.round(m.focus_sec / 60)),
                      shortMin: String(Math.round(m.short_pause_sec / 60)),
                      longMin: String(Math.round(m.long_pause_sec / 60)),
                      rounds: String(m.rounds_before_long)
                    })
                  }
                >
                  <Pencil size={16} />
                </IconButton>
                <IconButton label={`Delete ${m.name}`} danger onClick={() => void remove(m.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="rounded-(--radius-card) border border-line bg-surface-2/50 p-4">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm">
              <span className="mb-1 block text-ink-muted">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-9 w-full rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
                placeholder="e.g. Deep work 50/10"
              />
            </label>
            <NumberField label="Focus (min)" value={draft.focusMin} onChange={(v) => setDraft({ ...draft, focusMin: v })} />
            <NumberField label="Short break (min)" value={draft.shortMin} onChange={(v) => setDraft({ ...draft, shortMin: v })} />
            <NumberField label="Long break (min)" value={draft.longMin} onChange={(v) => setDraft({ ...draft, longMin: v })} />
            <NumberField label="Rounds before long" value={draft.rounds} onChange={(v) => setDraft({ ...draft, rounds: v })} />
          </div>
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => void save()}>
              <Check size={15} aria-hidden="true" /> Save method
            </Button>
            <Button size="sm" onClick={() => { setDraft(null); setError('') }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <Button size="sm" onClick={() => setDraft(emptyMethodDraft)}>
            <Plus size={15} aria-hidden="true" /> Add method
          </Button>
        </>
      )}
    </SectionCard>
  )
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-ink-muted">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
      />
    </label>
  )
}

// ---------------- projects ----------------

function ProjectsSection(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [draft, setDraft] = useState<{ id?: number; name: string; color: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  const [error, setError] = useState('')

  const reload = (): void => void window.api.projects.list(true).then(setProjects)
  useEffect(reload, [])

  const save = async (): Promise<void> => {
    if (!draft || !draft.name.trim()) return setError('Give the project a name.')
    if (draft.id) await window.api.projects.update(draft.id, draft.name, draft.color)
    else await window.api.projects.create(draft.name, draft.color)
    setDraft(null)
    setError('')
    reload()
  }

  const remove = async (p: Project): Promise<void> => {
    const res = await window.api.projects.remove(p.id)
    if (!res.ok && res.reason) setError(res.reason)
    setConfirmDelete(null)
    reload()
  }

  return (
    <SectionCard title="Projects">
      <ul className="mb-4 flex flex-col divide-y divide-line/60">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className={`flex items-center gap-2.5 text-sm ${p.archived ? 'opacity-50' : ''}`}>
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden="true" />
              {p.name}
              {p.archived ? <span className="text-xs text-ink-muted">(archived)</span> : null}
            </span>
            <div className="flex shrink-0 gap-1">
              <IconButton label={`Edit ${p.name}`} onClick={() => setDraft({ id: p.id, name: p.name, color: p.color })}>
                <Pencil size={16} />
              </IconButton>
              {p.has_time ? (
                <IconButton
                  label={p.archived ? `Restore ${p.name}` : `Archive ${p.name}`}
                  onClick={() => {
                    void window.api.projects.setArchived(p.id, !p.archived).then(reload)
                  }}
                >
                  {p.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </IconButton>
              ) : (
                <IconButton label={`Delete ${p.name}`} danger onClick={() => setConfirmDelete(p)}>
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="rounded-(--radius-card) border border-line bg-surface-2/50 p-4">
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-ink-muted">Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-9 w-full rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
              placeholder="e.g. Thesis"
            />
          </label>
          <span className="mb-1 block text-sm text-ink-muted">Color</span>
          <div className="mb-3 flex gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                aria-pressed={draft.color === c}
                onClick={() => setDraft({ ...draft, color: c })}
                className={`h-7 w-7 cursor-pointer rounded-full transition-transform ${
                  draft.color === c ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => void save()}>
              <Check size={15} aria-hidden="true" /> Save project
            </Button>
            <Button size="sm" onClick={() => { setDraft(null); setError('') }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <Button size="sm" onClick={() => setDraft({ name: '', color: PROJECT_COLORS[0] })}>
            <Plus size={15} aria-hidden="true" /> Add project
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete project?"
        body={`"${confirmDelete?.name}" has no logged time and will be removed permanently.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </SectionCard>
  )
}

// ---------------- pause messages ----------------

function MessagesSection(): React.JSX.Element {
  const [messages, setMessages] = useState<PauseMessage[]>([])
  const [newText, setNewText] = useState('')
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const [prefs, setPref] = useSettings()

  const reload = (): void => void window.api.messages.list().then(setMessages)
  useEffect(reload, [])

  const add = async (): Promise<void> => {
    if (!newText.trim()) return
    await window.api.messages.create(newText)
    setNewText('')
    reload()
  }

  return (
    <SectionCard title="Break messages">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-(--radius-card) bg-surface-2/60 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Randomize messages</p>
          <p className="text-xs text-ink-muted">Off shows messages in order instead.</p>
        </div>
        {prefs && <Toggle checked={prefs.randomizeMessages} onChange={(v) => setPref('randomizeMessages', v)} label="Randomize messages" />}
      </div>

      <ul className="mb-4 flex flex-col divide-y divide-line/60">
        {messages.map((m, i) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <Toggle
              checked={m.enabled === 1}
              onChange={(v) => void window.api.messages.setEnabled(m.id, v).then(reload)}
              label={`Enable "${m.text}"`}
            />
            {editing?.id === m.id ? (
              <input
                value={editing.text}
                autoFocus
                onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void window.api.messages.update(m.id, editing.text).then(() => {
                      setEditing(null)
                      reload()
                    })
                  }
                  if (e.key === 'Escape') setEditing(null)
                }}
                className="h-8 flex-1 rounded-(--radius-btn) border border-line bg-surface px-2 text-sm"
              />
            ) : (
              <span className={`flex-1 text-sm ${m.enabled ? '' : 'text-ink-muted line-through'}`}>{m.text}</span>
            )}
            <div className="flex shrink-0 gap-0.5">
              {editing?.id === m.id ? (
                <>
                  <IconButton
                    label="Save message"
                    onClick={() =>
                      void window.api.messages.update(m.id, editing.text).then(() => {
                        setEditing(null)
                        reload()
                      })
                    }
                  >
                    <Check size={16} />
                  </IconButton>
                  <IconButton label="Cancel edit" onClick={() => setEditing(null)}>
                    <X size={16} />
                  </IconButton>
                </>
              ) : (
                <>
                  <IconButton label="Move up" disabled={i === 0} onClick={() => void window.api.messages.move(m.id, 'up').then(reload)}>
                    <ChevronUp size={16} />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={i === messages.length - 1}
                    onClick={() => void window.api.messages.move(m.id, 'down').then(reload)}
                  >
                    <ChevronDown size={16} />
                  </IconButton>
                  <IconButton label={`Edit message`} onClick={() => setEditing({ id: m.id, text: m.text })}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={`Delete message`} danger onClick={() => void window.api.messages.remove(m.id).then(reload)}>
                    <Trash2 size={16} />
                  </IconButton>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {messages.length === 0 && <EmptyState title="No messages" hint="Add one below — it shows on the break screen." />}

      <div className="flex gap-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder="e.g. Water the plants"
          className="h-10 flex-1 rounded-(--radius-btn) border border-line bg-surface px-3 text-sm"
        />
        <Button size="md" onClick={() => void add()} disabled={!newText.trim()}>
          <Plus size={15} aria-hidden="true" /> Add
        </Button>
      </div>
    </SectionCard>
  )
}

// ---------------- sounds ----------------

function SoundsSection(): React.JSX.Element {
  const [prefs, setPref] = useSettings()
  if (!prefs) return <SectionCard title="Sounds">…</SectionCard>
  const rows: { key: 'soundPauseStart' | 'soundPauseEnd' | 'soundWarning' | 'masterMute'; label: string; hint: string }[] = [
    { key: 'soundPauseStart', label: 'Break starts', hint: 'Gentle chime when a break begins' },
    { key: 'soundPauseEnd', label: 'Break ends', hint: 'Chime when focus resumes' },
    { key: 'soundWarning', label: '1-minute warning', hint: 'Soft ping one minute before a break' },
    { key: 'masterMute', label: 'Mute all sounds', hint: 'Overrides the toggles above' }
  ]
  return (
    <SectionCard title="Sounds">
      <ul className="flex flex-col divide-y divide-line/60">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-xs text-ink-muted">{r.hint}</p>
            </div>
            <Toggle checked={prefs[r.key]} onChange={(v) => setPref(r.key, v)} label={r.label} />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

// ---------------- tasks ----------------

function TasksSection(): React.JSX.Element {
  const [prefs, setPref] = useSettings()
  if (!prefs) return <SectionCard title="Task reminders">…</SectionCard>
  return (
    <SectionCard title="Task reminders">
      <ul className="flex flex-col divide-y divide-line/60">
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Task reminders</p>
            <p className="text-xs text-ink-muted">Desktop notification when a timed task is due</p>
          </div>
          <Toggle
            checked={prefs.taskRemindersEnabled}
            onChange={(v) => setPref('taskRemindersEnabled', v)}
            label="Task reminders"
          />
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Reminder sound</p>
            <p className="text-xs text-ink-muted">Play a chime alongside the notification</p>
          </div>
          <Toggle
            checked={prefs.soundTaskReminder}
            onChange={(v) => setPref('soundTaskReminder', v)}
            label="Reminder sound"
          />
        </li>
      </ul>
    </SectionCard>
  )
}

// ---------------- general ----------------

function GeneralSection(): React.JSX.Element {
  const [prefs, setPref] = useSettings()
  if (!prefs) return <SectionCard title="General">…</SectionCard>
  return (
    <SectionCard title="General">
      <ul className="flex flex-col divide-y divide-line/60">
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Mini timer widget</p>
            <p className="text-xs text-ink-muted">Small floating timer while you focus</p>
          </div>
          <Toggle checked={prefs.widgetEnabled} onChange={(v) => setPref('widgetEnabled', v)} label="Mini timer widget" />
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Launch on startup</p>
            <p className="text-xs text-ink-muted">Start Focus On Me when you sign in to Windows</p>
          </div>
          <Toggle checked={prefs.launchOnStartup} onChange={(v) => setPref('launchOnStartup', v)} label="Launch on startup" />
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-ink-muted">Follows your Windows light/dark setting</p>
          </div>
          <span className="text-sm text-ink-muted">System</span>
        </li>
      </ul>
    </SectionCard>
  )
}

// ---------------- shared ----------------

function IconButton({
  label,
  danger = false,
  disabled = false,
  onClick,
  children
}: {
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30 ${
        danger ? 'text-ink-muted hover:bg-danger/10 hover:text-danger' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
