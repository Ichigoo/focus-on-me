import { Notification } from 'electron'
import { computePrayerTimes, PRAYER_LABELS, PRAYER_ORDER } from '@shared/prayerTimes'
import { settings } from '../db/repos'
import { broadcast } from '../windows'

let timers: NodeJS.Timeout[] = []

function clearAll(): void {
  timers.forEach(clearTimeout)
  timers = []
}

function fireAdhan(label: string, playSound: boolean): void {
  if (Notification.isSupported()) {
    new Notification({ title: 'Adhan', body: `${label} — time to pray` }).show()
  }
  if (playSound) broadcast('sound:play', 'adhan')
}

/** Fires an immediate preview notification + chime, regardless of current settings. */
export function testAdhan(): void {
  fireAdhan('Test', true)
}

/** Recomputes today's prayer times from current settings and (re)arms notification timers. */
export function rescheduleAdhan(): void {
  clearAll()
  const prefs = settings.getAll()
  if (!prefs.adhanNotificationsEnabled || !prefs.adhanLocation) return

  const location = prefs.adhanLocation
  const times = computePrayerTimes(location, prefs.adhanMethod, prefs.adhanMadhab, new Date())
  const now = Date.now()

  for (const name of PRAYER_ORDER) {
    if (!prefs.adhanEnabledPrayers[name]) continue
    const at = times[name]
    if (at <= now) continue
    const delay = at - now
    timers.push(
      setTimeout(() => fireAdhan(PRAYER_LABELS[name], settings.getAll().adhanSoundEnabled), delay)
    )
  }

  // recompute for the next day shortly after local midnight
  const midnight = new Date()
  midnight.setHours(24, 0, 5, 0)
  timers.push(setTimeout(() => rescheduleAdhan(), midnight.getTime() - now))
}
