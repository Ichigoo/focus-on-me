import { useEffect, useMemo, useState } from 'react'
import { Bell, MapPin, Search } from 'lucide-react'
import type { AdhanLocation, AdhanMadhab, AdhanMethodKey, AdhanTimes, PrayerName } from '@shared/types'
import { computePrayerTimes, METHOD_LABELS, PRAYER_LABELS, PRAYER_ORDER } from '@shared/prayerTimes'
import { fmtDuration, fmtTime } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { Button, EmptyState, SectionCard, Toggle } from '../components/ui'

export default function Adhan(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display mb-8 text-3xl">Adhan</h1>
      <div className="flex flex-col gap-6">
        <LocationSection />
        <TimesSection />
        <NotificationsSection />
      </div>
    </div>
  )
}

// ---------------- location ----------------

function LocationSection(): React.JSX.Element {
  const [prefs, setPref] = useSettings()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdhanLocation[]>([])
  const [searching, setSearching] = useState(false)
  const [editing, setEditing] = useState(false)

  const showSearch = editing || !prefs?.adhanLocation

  useEffect(() => {
    if (!showSearch || query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      void window.api.adhan
        .searchLocation(query)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [query, showSearch])

  if (!prefs) return <SectionCard title="Location">…</SectionCard>

  const select = (loc: AdhanLocation): void => {
    setPref('adhanLocation', loc)
    setEditing(false)
    setQuery('')
    setResults([])
  }

  return (
    <SectionCard title="Location">
      {!showSearch && prefs.adhanLocation ? (
        <div className="flex items-center justify-between gap-3 rounded-(--radius-card) bg-surface-2/60 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <MapPin size={16} className="text-accent" aria-hidden="true" />
            {prefs.adhanLocation.label}
          </span>
          <Button size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a city…"
              className="h-10 w-full rounded-(--radius-btn) border border-line bg-surface pr-3 pl-9 text-sm"
            />
          </div>
          {searching && <p className="text-sm text-ink-muted">Searching…</p>}
          {!searching && results.length > 0 && (
            <ul className="flex flex-col divide-y divide-line/60 rounded-(--radius-card) border border-line">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => select(r)}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <MapPin size={14} className="text-ink-muted" aria-hidden="true" />
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-ink-muted">No matches.</p>
          )}
          {prefs.adhanLocation && (
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                setEditing(false)
                setQuery('')
                setResults([])
              }}
            >
              Cancel
            </Button>
          )}
        </>
      )}

      {prefs.adhanLocation && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">Calculation method</span>
            <select
              value={prefs.adhanMethod}
              onChange={(e) => setPref('adhanMethod', e.target.value as AdhanMethodKey)}
              className="h-9 w-full cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-2 text-sm"
            >
              {(Object.keys(METHOD_LABELS) as AdhanMethodKey[]).map((k) => (
                <option key={k} value={k}>
                  {METHOD_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">Madhab (Asr calculation)</span>
            <select
              value={prefs.adhanMadhab}
              onChange={(e) => setPref('adhanMadhab', e.target.value as AdhanMadhab)}
              className="h-9 w-full cursor-pointer rounded-(--radius-btn) border border-line bg-surface px-2 text-sm"
            >
              <option value="Shafi">Shafi (earlier Asr)</option>
              <option value="Hanafi">Hanafi (later Asr)</option>
            </select>
          </label>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------- times ----------------

interface NextPrayer {
  name: PrayerName
  at: number
  tomorrow: boolean
}

function TimesSection(): React.JSX.Element {
  const [prefs] = useSettings()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  const location = prefs?.adhanLocation ?? null
  const method = prefs?.adhanMethod
  const madhab = prefs?.adhanMadhab

  const computed = useMemo((): { times: AdhanTimes; next: NextPrayer } | null => {
    if (!location || !method || !madhab) return null
    const now = new Date()
    const today = computePrayerTimes(location, method, madhab, now)
    const upcoming = PRAYER_ORDER.find((name) => today[name] > now.getTime())
    if (upcoming) return { times: today, next: { name: upcoming, at: today[upcoming], tomorrow: false } }
    const tomorrowDate = new Date(now)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = computePrayerTimes(location, method, madhab, tomorrowDate)
    return { times: today, next: { name: 'fajr', at: tomorrow.fajr, tomorrow: true } }
    // `tick` deliberately forces a recompute against the current wall-clock time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, method, madhab, tick])

  if (!location) {
    return (
      <SectionCard title="Today's times">
        <EmptyState title="No location set" hint="Search for a city above to see prayer times." />
      </SectionCard>
    )
  }
  if (!computed) return <SectionCard title="Today's times">…</SectionCard>

  const { times, next } = computed
  const countdownSec = Math.max(0, Math.round((next.at - Date.now()) / 1000))

  return (
    <SectionCard title="Today's times">
      <ul className="flex flex-col divide-y divide-line/60">
        <li className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-sm text-ink-muted">Sunrise</span>
          <span className="timer-digits text-sm text-ink">{fmtTime(times.sunrise / 1000)}</span>
        </li>
        {PRAYER_ORDER.map((name) => {
          const isNext = !next.tomorrow && next.name === name
          return (
            <li
              key={name}
              className={`-mx-2 flex items-center justify-between gap-3 rounded-(--radius-btn) px-2 py-2.5 ${
                isNext ? 'bg-accent-soft' : ''
              }`}
            >
              <span className={`text-sm ${isNext ? 'font-medium text-accent' : 'text-ink-muted'}`}>
                {PRAYER_LABELS[name]}
              </span>
              <span className={`timer-digits text-sm ${isNext ? 'font-medium text-accent' : 'text-ink'}`}>
                {fmtTime(times[name] / 1000)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-sm text-ink-muted">
        {next.tomorrow ? 'Fajr tomorrow' : PRAYER_LABELS[next.name]} in {fmtDuration(countdownSec)}
      </p>
    </SectionCard>
  )
}

// ---------------- notifications ----------------

function NotificationsSection(): React.JSX.Element {
  const [prefs, setPref] = useSettings()
  if (!prefs) return <SectionCard title="Notifications">…</SectionCard>

  return (
    <SectionCard title="Notifications">
      <ul className="flex flex-col divide-y divide-line/60">
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Adhan notifications</p>
            <p className="text-xs text-ink-muted">Get a desktop notification at each prayer time</p>
          </div>
          <Toggle
            checked={prefs.adhanNotificationsEnabled}
            onChange={(v) => setPref('adhanNotificationsEnabled', v)}
            label="Adhan notifications"
          />
        </li>
        <li className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">Play sound</p>
            <p className="text-xs text-ink-muted">Also play a chime alongside the notification</p>
          </div>
          <Toggle checked={prefs.adhanSoundEnabled} onChange={(v) => setPref('adhanSoundEnabled', v)} label="Play sound" />
        </li>
      </ul>

      <p className="mt-4 mb-2 text-sm font-medium">Prayers to notify for</p>
      <ul className="flex flex-col divide-y divide-line/60">
        {PRAYER_ORDER.map((name) => (
          <li key={name} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm">{PRAYER_LABELS[name]}</span>
            <Toggle
              checked={prefs.adhanEnabledPrayers[name]}
              onChange={(v) => setPref('adhanEnabledPrayers', { ...prefs.adhanEnabledPrayers, [name]: v })}
              label={`Notify for ${PRAYER_LABELS[name]}`}
            />
          </li>
        ))}
      </ul>

      <Button size="sm" className="mt-4" onClick={() => window.api.adhan.test()}>
        <Bell size={15} aria-hidden="true" /> Send test notification
      </Button>
    </SectionCard>
  )
}
