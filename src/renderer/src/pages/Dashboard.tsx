import { useEffect, useState } from 'react'
import { Activity, Award, Clock, Timer } from 'lucide-react'
import type {
  DailyFocus,
  HistoryEntry,
  ProjectTime,
  RangeFilter,
  StatsSummaryExtended,
  StatsTrend
} from '@shared/types'
import { fmtDate, fmtDuration, fmtTime } from '../lib/format'
import { Card, Chip, EmptyState, Segmented, StatTile } from '../components/ui'
import FocusAreaChart from '../components/FocusAreaChart'
import Heatmap from '../components/Heatmap'
import { useTimerState } from '../lib/hooks'

const RANGES: { value: RangeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' }
]

const rangeSubline: Record<RangeFilter, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  all: 'All time'
}

function trendBadge(current: number, previous: number): string | undefined {
  if (previous <= 0) return undefined
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return undefined
  return `${pct > 0 ? '+' : ''}${pct}% vs last`
}

export default function Dashboard(): React.JSX.Element {
  const [range, setRange] = useState<RangeFilter>('month')
  const [summary, setSummary] = useState<StatsSummaryExtended | null>(null)
  const [trend, setTrend] = useState<StatsTrend | null>(null)
  const [chartRange, setChartRange] = useState<'week' | 'month'>('week')
  const [daily, setDaily] = useState<DailyFocus[]>([])
  const [heatData, setHeatData] = useState<DailyFocus[]>([])
  const [perProject, setPerProject] = useState<ProjectTime[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const timer = useTimerState()

  useEffect(() => {
    void window.api.stats.summaryExtended(range).then(setSummary)
    void window.api.stats.trend(range).then(setTrend)
    void window.api.stats.perProject(range).then(setPerProject)
    // refresh when a session ends while the page is open
  }, [range, timer.sessionId])

  useEffect(() => {
    void window.api.stats.daily(chartRange === 'week' ? 7 : 30).then(setDaily)
  }, [chartRange, timer.sessionId])

  useEffect(() => {
    void window.api.stats.history(50).then(setHistory)
    void window.api.stats.daily(70).then(setHeatData)
  }, [timer.sessionId])

  // this month vs the heatmap window
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const thisMonthMin = heatData.filter((d) => d.day.startsWith(monthPrefix)).reduce((s, d) => s + d.focusMin, 0)

  const maxProjectSec = Math.max(1, ...perProject.map((p) => p.focusSec))

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </div>
      <p className="mb-6 text-sm text-ink-muted">Track your productivity trends and session history</p>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          icon={<Clock size={16} aria-hidden="true" />}
          value={summary ? fmtDuration(summary.totalFocusSec) : '—'}
          label="Total Focus Time"
          sub={rangeSubline[range]}
        />
        <StatTile
          icon={<Activity size={16} aria-hidden="true" />}
          iconClassName="bg-success/15 text-success"
          value={summary ? String(summary.sessionsCompleted) : '—'}
          label="Total Sessions"
          badge={trendBadge(trend?.sessionsCurrent ?? 0, trend?.sessionsPrevious ?? 0)}
          badgeTone="success"
        />
        <StatTile
          icon={<Timer size={16} aria-hidden="true" />}
          value={summary && summary.avgSessionSec > 0 ? fmtDuration(summary.avgSessionSec) : '—'}
          label="Avg Session Length"
        />
        <StatTile
          icon={<Award size={16} aria-hidden="true" />}
          iconClassName="bg-warning/15 text-warning"
          value={summary ? `${summary.bestStreak} days` : '—'}
          label="Best Streak"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Focus Time</h2>
            <Segmented
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' }
              ]}
              value={chartRange}
              onChange={setChartRange}
            />
          </div>
          <FocusAreaChart data={daily} height={220} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">By Category</h2>
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

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-ink-muted">Productivity Score</p>
            <p
              className="text-3xl font-semibold"
              title="Weighted blend of focus volume (vs a 4h/day target), completed sessions, and completed tasks"
            >
              {summary?.productivityScore != null ? `${summary.productivityScore}%` : '—'}
            </p>
            <p className="mt-3 text-xs text-ink-muted">Current Streak</p>
            <p className="text-2xl font-semibold">
              {summary?.currentStreak ?? 0} <span className="text-sm font-normal text-ink-muted">days</span>
            </p>
            {summary && summary.bestStreak > 0 && (
              <p className="mt-1 text-xs text-warning">🔥 Personal record: {summary.bestStreak} days</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold">Activity Heatmap</h2>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Heatmap data={heatData} />
          <div>
            <p className="text-xs text-ink-muted">This month</p>
            <p className="text-xl font-semibold">{fmtDuration(thisMonthMin * 60)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Session History</h2>
        {history.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Your finished sessions will appear here." />
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 border-l-2 py-2 pl-3"
                style={{ borderColor: h.projectColor }}
              >
                <span className="w-28 shrink-0 text-xs text-ink-muted">
                  {fmtDate(h.startedAt)} · {fmtTime(h.startedAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.projectName}</span>
                <span className="hidden text-xs text-ink-muted sm:inline">{h.methodName}</span>
                <Chip tone={h.status === 'completed' ? 'accent' : 'neutral'}>
                  {h.status === 'completed' ? 'Completed' : 'Stopped early'}
                </Chip>
                <span className="w-16 shrink-0 text-right font-mono text-xs">{fmtDuration(h.focusSec)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
