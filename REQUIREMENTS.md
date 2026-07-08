# Focus On Me — App Requirements

## 1. Overview

A desktop app to help you focus using the Pomodoro technique or your own custom focus/pause methods. Pauses take over your screen with a custom motivational message, time is tracked per project, and a dashboard shows your progress. It also has an Adhan (prayer times) section: pick a location and get today's prayer times plus optional desktop notifications. Desktop (Windows) first, Android later.

> This document is kept in sync with the shipped app — it describes the current implementation, not just the original pre-build spec.

## 2. Core Decisions

| Area | Decision |
|---|---|
| Tech stack | Electron + React + TypeScript |
| Storage | Local SQLite only, no accounts |
| Platform v1 | Windows only |
| Pause behavior | Fullscreen always-on-top overlay, one-click skip, never blocks Ctrl+Alt+Del |
| Methods | Full cycles: focus / short pause / long pause / long pause every N rounds |
| During focus | App minimizes to tray + small always-on-top mini timer widget |
| Sounds | Gentle chimes for pause start/end + 1-min warning, all toggleable |

## 3. Functional Requirements

### 3.1 Focus Methods
- Built-in **Pomodoro** preset: 25min focus / 5min short pause / 15min long pause / long pause every 4 rounds.
- Custom methods: name, focus duration, short pause duration, long pause duration, rounds before long pause. Full CRUD.

### 3.2 Sessions
- Start a session by picking a **project** + a **method**.
- Cycles run automatically: focus → pause → focus → … with a long pause every N rounds.
- Can pause/resume or stop early; partial focus time still gets recorded.
- While focusing: main window hides to tray; a draggable, always-on-top mini widget shows time remaining, project, and round (e.g. "2/4"). Tray icon tooltip also shows the countdown.
- **Force pause ("Take a break")**: a button (in the main window's session view and in the mini widget, focus phase only) that ends the current focus phase early and jumps straight into a break — same transition the timer would make naturally, just triggered on demand.
- **Switching between widget and main window** is explicit and one-directional per action: opening the main window from the widget hides the widget; a "Switch to widget" button in the main window hides the main window and brings the widget back. They're never both visible at once.
- **System sleep/lock**: the timer auto-pauses the instant the OS sleeps or locks, and resumes on wake/unlock, so tracked time reflects actual focus time.

### 3.3 Pause Overlay
- **Purpose**: the pause is a genuine, healthy break (eyes off screen, stretch, a message like "look away for 20 seconds") — not a friction/anti-cheat screen. It exists so you actually notice and take the break instead of ignoring a small notification. Skipping stays effortless by design.
- Fullscreen frameless window on **every connected monitor**, blocking interaction with everything behind it (covers taskbar too).
- Displays: countdown, pause type (short/long), a custom message, and a visible **"Skip pause"** button (instant, single click, no delay or hold-to-confirm).
- Also has an "End session" button.
- Escape/Alt-Tab do not dismiss it; Ctrl+Alt+Del always remains available.
- **Skipping a short pause still advances the round counter** — the long pause still triggers after N rounds regardless of which short pauses were skipped.

### 3.4 Pause Messages
- User-managed list of messages (add/edit/delete/enable-disable), e.g. "Do 5 pushups," "Drink some water."
- Toggle: **randomize** enabled messages per pause, or rotate them in order.
- Ships with sensible default messages.

### 3.5 Projects
- CRUD: name + accent color; archive (not delete) once time has been logged against it.
- Project picker on session start screen, remembers last used project.

### 3.6 Dashboard
- **Time per project**: Today / This week / This month / All-time filters.
- **Daily activity chart**: focus minutes per day.
- **Streaks & totals**: current streak of consecutive focus days, total focus hours, sessions completed, pauses skipped.
- **Session history log**: date, project, method, focus time, completed vs. stopped early.

### 3.7 Sounds & Notifications
- Soft chime at pause start, pause end, and ~1 minute before a pause begins.
- Each sound individually toggleable; master mute in the tray menu.

### 3.8 Settings
- Manage methods, projects, pause messages, sound toggles.
- "Launch on startup" toggle.
- Mini-widget on/off toggle.
- Theme: follows system (light/dark) by default.
- Adhan location, calculation method, madhab, and notification toggles live on the dedicated Adhan page (§3.9) rather than the Settings page, since they need the location search UI alongside them.

### 3.9 Adhan (Prayer Times)
- **Location**: search a city by name (free-text, via a geocoding lookup) and select it; stored as lat/lon + display label. No location set → empty state prompting to search.
- **Calculation method**: choose among the standard presets (Muslim World League, Egyptian, Karachi, Umm al-Qura, Dubai, Moonsighting Committee, ISNA/North America, Kuwait, Qatar, Singapore, Tehran, Turkey). Default: Muslim World League.
- **Madhab**: Shafi (earlier Asr) or Hanafi (later Asr).
- **Today's times**: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, computed client-side and refreshed periodically; the next upcoming prayer is highlighted with a live countdown, rolling over to tomorrow's Fajr once Isha has passed.
- **Notifications**: master on/off toggle, an independent "play sound" toggle (a synthesized chime, not a real vocal Adhan recording), and per-prayer on/off toggles (Fajr/Dhuhr/Asr/Maghrib/Isha — Sunrise is informational only, no notification). Notification scheduling runs in the main process so it fires even if all windows are hidden.
- **Test notification**: a button that fires an immediate preview notification + chime on demand, regardless of the toggles above, so the alert can be previewed without waiting for a real prayer time.

## 4. Design Direction
- Clean, modern, relaxing: sage green / soft teal accents on warm off-white; dark mode uses deep slate + muted teal.
- Large, calm timer typography (bundled fonts, no external CDN calls).
- Pause overlay: dimmed calm gradient background, large centered message, gentle fade-in animation.
- Minimal chrome, rounded cards, no visual clutter.

## 5. Technical Architecture

- **Stack**: Electron + Vite (`electron-vite`) + React + TypeScript, Tailwind CSS, `electron-builder` (NSIS installer).
- **Database**: Node's built-in `node:sqlite` (`DatabaseSync`) in the main process; file stored in `app.getPath('userData')`. No third-party SQLite driver.
- **Timer engine**: `TimerEngine` (`src/main/timer/engine.ts`) runs in the **main process** as the single source of truth, computing elapsed time from wall-clock timestamps (not tick counts) so sleep/lock can't corrupt it; pushes `state`/`phase`/`sound` events to renderers over IPC.
- **Windows** (`src/main/windows.ts`):
  - Main window — start screen, dashboard, Adhan, settings (client-side routed SPA); stays alive hidden in the tray (owns audio playback) rather than closing.
  - Mini widget — small frameless always-on-top timer; shown/hidden explicitly, never simultaneously with the main window.
  - Overlay — one `BrowserWindow` per display, created via `screen.getAllDisplays()` when a pause starts, recreated if displays change mid-pause.
- **IPC**: typed API via `contextBridge` (preload script), namespaced by domain — `projects:*`, `methods:*`, `messages:*`, `settings:*`, `session:*` (`start`/`pauseResume`/`skipPause`/`forcePause`/`stop`), `stats:*`, `ui:*`, `adhan:*` (`searchLocation`, `test`). `timer:state`, `theme:dark`, `sound:play`, `settings:changed` events are broadcast to renderers.
- **Charts**: Recharts (bundled, no external requests).
- **Sounds**: bundled, synthesized (not recorded) WAV chimes — pause-start, pause-end, warning, adhan — generated by `scripts/gen-sounds.mjs`; played in the main window's renderer on a `sound:play` broadcast.
- **Prayer times**: the `adhan` npm library (pure JS, no runtime deps) wrapped in `src/shared/prayerTimes.ts`, used both by the main-process notification scheduler and the renderer's live display — no duplicated calculation logic.
- **Location search**: proxied through the main process (`src/main/adhan/geocode.ts`) to the free Open-Meteo Geocoding API, since the renderer's CSP blocks direct external fetches.

### Data Model (SQLite)
```
projects(id, name, color, archived, created_at)
methods(id, name, focus_sec, short_pause_sec, long_pause_sec, rounds_before_long, is_preset)
pause_messages(id, text, enabled, sort_order)
sessions(id, project_id, method_id, started_at, ended_at, status)   -- status: active | completed | stopped
intervals(id, session_id, kind, started_at, planned_sec, actual_sec, skipped)  -- kind: focus | short_pause | long_pause
settings(key, value)   -- generic key-value store (JSON-encoded values), typed as `AppSettings` in shared/types.ts:
                        --   sound toggles, masterMute, randomizeMessages, widgetEnabled, launchOnStartup,
                        --   lastProjectId/lastMethodId, adhanLocation, adhanMethod, adhanMadhab,
                        --   adhanNotificationsEnabled, adhanSoundEnabled, adhanEnabledPrayers
```
No dedicated Adhan tables — location/method/madhab/notification prefs live in `settings`; prayer times themselves are computed on demand (not stored).

## 6. Build Milestones

All shipped:

1. ✅ Scaffold: Electron + Vite + React + TS, tray icon/menu, main window running.
2. ✅ Data layer: SQLite schema/migrations, typed IPC API, seed Pomodoro preset + default messages.
3. ✅ Timer engine + session flow: main-process state machine (idle → focus → pause → …), start screen with project/method pickers, manual pause/stop/force-pause.
4. ✅ Pause overlay: multi-monitor fullscreen windows, countdown, message rotation/randomize, skip & end-session buttons.
5. ✅ Mini widget + sounds: floating timer, tray tooltip countdown, chimes with toggles, explicit widget ⇄ main window switching.
6. ✅ Dashboard: stats queries + charts + history log.
7. ✅ Settings & polish: methods/projects/messages CRUD UIs, theme, launch-on-startup, then package a Windows installer.
8. ✅ Adhan section: location search, prayer-time calculation, today's-times display with countdown, notification scheduling + synthesized chime, test-notification button.

## 7. Explicitly Out of Scope for v1
- **Data backup/export/import**: local-only SQLite with no export path in v1. Accepted risk — revisit if data loss becomes a real concern.
- Any account system, cloud sync, or multi-device support.

## 8. Future (Post-v1)
- Android companion app (likely React Native/Capacitor to reuse logic), with local-first data plus optional sync.
- Revisit data backup/export if v1 local-only storage proves risky.
