/** "25:00" or "1:05:00" for timers. */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

/** "2h 15m" / "45m" / "3m" for durations in stats. */
export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return s > 0 ? '<1m' : '0m'
}

export function fmtDate(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function fmtTime(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function phaseLabel(phase: 'focus' | 'short_pause' | 'long_pause'): string {
  return phase === 'focus' ? 'Focus' : phase === 'short_pause' ? 'Short break' : 'Long break'
}
