import type { DailyFocus } from '@shared/types'

const LEVELS = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4']

function level(focusMin: number): number {
  if (focusMin <= 0) return 0
  if (focusMin < 30) return 1
  if (focusMin < 90) return 2
  if (focusMin < 180) return 3
  return 4
}

/**
 * GitHub-style activity heatmap: one column per week, Monday-first rows.
 * Expects `data` in ascending day order (as returned by stats.daily).
 */
export default function Heatmap({ data }: { data: DailyFocus[] }): React.JSX.Element {
  const byDay = new Map(data.map((d) => [d.day, d.focusMin]))

  // Build a Monday-aligned grid ending today.
  const cells: { day: string; min: number }[][] = []
  const last = new Date()
  const first = new Date(`${data[0]?.day ?? last.toISOString().slice(0, 10)}T00:00:00`)
  // rewind to Monday
  const start = new Date(first)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

  let week: { day: string; min: number }[] = []
  for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    week.push({ day: key, min: byDay.get(key) ?? -1 })
    if (week.length === 7) {
      cells.push(week)
      week = []
    }
  }
  if (week.length > 0) cells.push(week)

  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div>
      <div className="flex gap-1">
        <div className="mr-1 flex flex-col gap-1">
          {dayLetters.map((l, i) => (
            <span key={i} className="flex h-5 w-3 items-center text-[9px] text-ink-muted">
              {l}
            </span>
          ))}
        </div>
        {cells.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((cell) => (
              <div
                key={cell.day}
                title={
                  cell.min >= 0
                    ? `${cell.day} · ${Math.floor(cell.min / 60)}h ${cell.min % 60}m focus`
                    : cell.day
                }
                className={`h-5 w-5 rounded-[5px] ${cell.min >= 0 ? LEVELS[level(cell.min)] : 'bg-transparent'}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
        Less
        {LEVELS.map((c) => (
          <span key={c} className={`h-3 w-3 rounded-[4px] ${c}`} />
        ))}
        More
      </div>
    </div>
  )
}
