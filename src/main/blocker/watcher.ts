import { execFile } from 'child_process'
import { blockedApps } from '../db/blockedApps'
import { settings } from '../db/repos'
import { showToast } from '../windows'

const POLL_MS = 3000

let interval: NodeJS.Timeout | null = null
let enabledExes = new Set<string>()
// Notify at most once per exe per session, and never retry kills that failed
// (elevated processes) so we don't spam access-denied every 3 seconds.
let notifiedThisSession = new Set<string>()
let failedThisSession = new Set<string>()

/** Re-read the enabled blocklist from the DB (called on any blocked-apps mutation). */
export function refreshBlocklist(): void {
  enabledExes = new Set(blockedApps.listEnabledExes())
}

function poll(): void {
  if (enabledExes.size === 0) return
  execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true }, (err, stdout) => {
    if (err || !interval) return
    const running = new Set<string>()
    for (const line of stdout.split('\n')) {
      // first CSV column: "name.exe"
      const m = line.match(/^"([^"]+)"/)
      if (m) running.add(m[1].toLowerCase())
    }
    for (const exe of enabledExes) {
      if (!running.has(exe) || failedThisSession.has(exe)) continue
      execFile('taskkill', ['/IM', exe, '/F'], { windowsHide: true }, (killErr) => {
        if (killErr) {
          // Elevated processes fail with access-denied; log once and stop retrying.
          failedThisSession.add(exe)
          console.warn(`[blocker] could not close ${exe}: ${killErr.message}`)
          return
        }
        if (!notifiedThisSession.has(exe)) {
          notifiedThisSession.add(exe)
          if (settings.getAll().notifyOnAppKill) {
            showToast({
              title: 'App blocked',
              body: `${exe} was closed to protect your focus session`,
              kind: 'block'
            })
          }
        }
      })
    }
  })
}

/** Start scanning (idempotent). Runs only during focus phases of a session. */
export function startBlocking(): void {
  if (interval) return
  refreshBlocklist()
  interval = setInterval(poll, POLL_MS)
  poll()
}

/** Pause scanning without clearing the per-session dedupe (used on breaks). */
export function pauseBlocking(): void {
  if (interval) clearInterval(interval)
  interval = null
}

/** Stop scanning and reset per-session state (used on session end / quit). */
export function stopBlocking(): void {
  pauseBlocking()
  notifiedThisSession = new Set()
  failedThisSession = new Set()
}
