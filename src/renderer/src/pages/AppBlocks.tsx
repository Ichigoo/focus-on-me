import { useEffect, useMemo, useState } from 'react'
import { AppWindow, Plus, Search, ShieldBan, Trash2 } from 'lucide-react'
import type { BlockedApp } from '@shared/types'
import { useSettings } from '../lib/hooks'
import { Card, ConfirmDialog, EmptyState, Toggle } from '../components/ui'

export default function AppBlocks(): React.JSX.Element {
  const [apps, setApps] = useState<BlockedApp[]>([])
  const [prefs, setPref] = useSettings()
  const [newExe, setNewExe] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<BlockedApp | null>(null)

  const reload = (): void => void window.api.blockedApps.list().then(setApps)
  useEffect(() => {
    reload()
    return window.api.blockedApps.onChanged(reload)
  }, [])

  const enabledCount = apps.filter((a) => a.enabled).length
  const blockingOn = prefs?.appBlockingEnabled ?? true

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return apps
    return apps.filter((a) => a.name.toLowerCase().includes(q) || a.exe.toLowerCase().includes(q))
  }, [apps, search])

  async function add(): Promise<void> {
    const exe = newExe.trim()
    if (!exe) return
    const res = await window.api.blockedApps.add(exe.replace(/\.exe$/i, ''), exe)
    if (!res.ok) {
      setError(res.reason ?? 'Could not add this app')
      return
    }
    setError('')
    setNewExe('')
    reload()
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">App Restrictions</h1>
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          Blocking
          <Toggle
            checked={blockingOn}
            onChange={(v) => setPref('appBlockingEnabled', v)}
            label="App blocking enabled"
          />
        </div>
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        Automatically terminate distracting processes during focus sessions
      </p>

      <div className="mb-5 flex items-center gap-3 rounded-(--radius-card) bg-accent-soft px-4 py-3 text-sm text-accent">
        <ShieldBan size={16} className="shrink-0" aria-hidden="true" />
        {blockingOn
          ? `${enabledCount} ${enabledCount === 1 ? 'app' : 'apps'} will be blocked when a focus session starts`
          : 'Blocking is turned off — no apps will be closed'}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={newExe}
          onChange={(e) => setNewExe(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder="Enter executable name — e.g. Discord.exe"
          aria-label="Executable name"
          className="h-11 min-w-0 flex-1 rounded-(--radius-btn) border border-line bg-surface px-4 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-muted/60"
        />
        <button
          aria-label="Add blocked app"
          onClick={() => void add()}
          className="btn-gradient flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-transform active:scale-95"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="relative mb-4">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search applications…"
          aria-label="Search applications"
          className="h-10 w-full rounded-(--radius-btn) border border-line bg-surface-2 pr-4 pl-10 text-sm text-ink placeholder:text-ink-muted/60"
        />
      </div>

      {visible.length === 0 && (
        <Card className="mb-4 p-6">
          <EmptyState
            title={apps.length === 0 ? 'No blocked apps yet' : 'No matches'}
            hint={apps.length === 0 ? 'Add an executable above — e.g. Discord.exe or steam.exe.' : undefined}
          />
        </Card>
      )}

      <div className="mb-5 flex flex-col gap-2.5">
        {visible.map((app) => (
          <Card key={app.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
              <AppWindow size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{app.name}</p>
              <p className="truncate font-mono text-xs text-ink-muted">{app.exe}</p>
            </div>
            <Toggle
              checked={!!app.enabled}
              onChange={(v) => void window.api.blockedApps.setEnabled(app.id, v).then(reload)}
              label={`Block ${app.name}`}
            />
            <button
              aria-label={`Remove ${app.name}`}
              onClick={() => setConfirmDelete(app)}
              className="cursor-pointer rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">How it works</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
          <li>• The process list is scanned every 3 seconds while a focus interval is running</li>
          <li>• Matched processes are closed and a desktop notification is shown</li>
          <li>• Restrictions lift automatically during breaks and when the session ends</li>
          <li>• Apps running as administrator can&apos;t be closed without elevated rights</li>
        </ul>
      </Card>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove blocked app?"
        body={`"${confirmDelete?.name}" will no longer be closed during focus sessions.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmDelete) {
            void window.api.blockedApps.remove(confirmDelete.id).then(() => {
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
