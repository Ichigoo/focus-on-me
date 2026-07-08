import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Clock, Flame, CircleCheck, SkipForward } from 'lucide-react'
import type { DailyFocus, HistoryEntry, ProjectTime, RangeFilter, StatsSummary } from '@shared/types'
import { fmtDate, fmtDuration, fmtTime } from '../lib/format'
import { Card, EmptyState, Segmented } from '../components/ui'
import { useTimerState } from '../lib/hooks'

const RANGES: { value: RangeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' }
]

export default function Dashboard(): React.JSX.Element {
  const [range, setRange] = useState<RangeFilter>('week')
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [daily, setDaily] = useState<DailyFocus[]>([])
  const [perProject, setPerProject] = useState<ProjectTime[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const timer = useTimerState()

  useEffect(() => {
    void window.api.stats.summary(range).then(setSummary)
    void window.api.stats.perProject(range).then(setPerProject)
    // refresh when a session ends while the dashboard is open
  }, [range, timer.sessionId])

  useEffect(() => {
    void window.api.stats.daily(30).then(setDaily)
    void window.api.stats.history(50).then(setHistory)
  }, [timer.sessionId])

  const maxProjectSec = Math.max(1, ...perProject.map((p) => p.focusSec))

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Your progress</h1>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={<Clock size={18} aria-hidden="true" />}
          label="Focus time"
          value={summary ? fmtDuration(summary.totalFocusSec) : '—'}
        />
        <StatTile
          icon={<Flame size={18} aria-hidden="true" />}
          label="Day streak"
          value={summary ? String(summary.currentStreak) : '—'}
        />
        <StatTile
          icon={<CircleCheck size={18} aria-hidden="true" />}
          label="Sessions completed"
          value={summary ? String(summary.sessionsCompleted) : '—'}
        />
        <StatTile
          icon={<SkipForward size={18} aria-hidden="true" />}
          label="Breaks skipped"
          value={summary ? String(summary.pausesSkipped) : '—'}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="mb-4 text-sm font-medium text-ink-muted">Focus minutes · last 30 days</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d: string) => d.slice(8)}
                  tick={{ fontSize: 11, fill: 'var(--ink-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--line)' }}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--ink-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent-soft)', opacity: 0.5 }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    color: 'var(--ink)',
                    fontSize: 13
                  }}
                  formatter={(v) => [`${v} min`, 'Focus']}
                  labelFormatter={(d) => d}
                />
                <Bar dataKey="focusMin" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-ink-muted">Time per project</h2>
          {perProject.length === 0 ? (
            <EmptyState title="No focus time yet" hint="Start a session to see your projects here." />
          ) : (
            <ul className="flex flex-col gap-3">
              {perProject.map((p) => (
                <li key={p.projectId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                      {p.name}
                    </span>
                    <span className="text-ink-muted">{fmtDuration(p.focusSec)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(p.focusSec / maxProjectSec) * 100}%`, background: p.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-medium text-ink-muted">Session history</h2>
        {history.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Your finished sessions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-muted">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Project</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 pr-4 font-medium">Focus time</th>
                  <th className="pb-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-line/50 last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-ink-muted">
                      {fmtDate(h.startedAt)} · {fmtTime(h.startedAt)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: h.projectColor }}
                          aria-hidden="true"
                        />
                        {h.projectName}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-ink-muted">{h.methodName}</td>
                    <td className="py-2.5 pr-4">{fmtDuration(h.focusSec)}</td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.status === 'completed' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'
                        }`}
                      >
                        {h.status === 'completed' ? 'Completed' : 'Stopped early'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: string
}): React.JSX.Element {
  return (
    <Card className="p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon}
      </div>
      <p className="timer-digits text-3xl font-normal">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </Card>
  )
}
