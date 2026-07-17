import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyFocus } from '@shared/types'

function weekdayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
}

function shortLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Violet gradient area chart of daily focus minutes (FocusSphere style). */
export default function FocusAreaChart({
  data,
  height = 200
}: {
  data: DailyFocus[]
  height?: number
}): React.JSX.Element {
  const gradientId = useId()
  const useWeekday = data.length <= 8
  const chartData = data.map((d) => ({
    ...d,
    label: useWeekday ? weekdayLabel(d.day) : shortLabel(d.day),
    focusH: Math.round((d.focusMin / 60) * 10) / 10
  }))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--line)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={46}
            tickFormatter={(v: number) => `${v}h`}
          />
          <Tooltip
            cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.3 }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              color: 'var(--ink)',
              fontSize: 12
            }}
            labelStyle={{ color: 'var(--ink-muted)' }}
            formatter={(value) => [`${Number(value)}h`, 'Focus']}
          />
          <Area
            type="monotone"
            dataKey="focusH"
            stroke="var(--accent)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
