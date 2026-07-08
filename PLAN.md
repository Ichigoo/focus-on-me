# Focus On Me — Implementation Plan

## Context

Build the "Focus On Me" Windows desktop app from scratch per `REQUIREMENTS.md`: a Pomodoro/custom-method focus timer where the timer lives in the Electron main process, pauses take over every monitor with a fullscreen overlay + motivational message, time is tracked per project in local SQLite, and a dashboard shows stats. The working directory contains only the requirements file — everything is new. The app scaffolds directly into `C:\Users\PC\Desktop\Work\Focus On me` (package name `focus-on-me`).

The user additionally asked for the app's **visual design with dark mode** — specified below as a full token system (light + dark) and per-screen design direction, implemented as milestone 1.5 so every later milestone builds on the design system instead of retrofitting it.

## Stack & key technical choices

- **Scaffold**: `electron-vite` (React + TS template) — gives main/preload/renderer structure with HMR out of the box.
- **DB**: `node:sqlite` (`DatabaseSync`), built into the Node 24 runtime embedded in Electron 43 — replaced the planned better-sqlite3, which has no prebuilt binary for Electron 43's ABI and would have required Visual Studio to compile. Same synchronous API shape, zero native dependencies. DB file in `app.getPath('userData')`. Migrations via `PRAGMA user_version` + ordered SQL migration array.
- **Timer engine**: main-process class, one 1-second `setInterval`, state machine `idle → focus → short_pause/long_pause → focus …`. Uses `powerMonitor` (`suspend`/`resume`, `lock-screen`/`unlock-screen`) to auto-pause/resume. Elapsed time computed from timestamps (not tick counts) so drift/sleep can't corrupt tracked time.
- **Windows**:
  - Main window — SPA (react-router, hash routing): Start / Dashboard / Settings.
  - Mini widget — small frameless `alwaysOnTop` window, draggable via `-webkit-app-region: drag`.
  - Overlay — one frameless `BrowserWindow` per display (`screen.getAllDisplays()`), `fullscreen: true`, `alwaysOnTop` level `'screen-saver'`, `skipTaskbar`, `minimizable: false`; created on pause start, destroyed on pause end. `display-added`/`display-removed` handled while overlay is up. Never intercepts Ctrl+Alt+Del (OS guarantees this).
- **IPC**: single preload with `contextBridge.exposeInMainWorld('api', …)`; shared TS types in `src/shared/types.ts`. Commands: `startSession`, `pauseResume`, `skipPause`, `stopSession`, `getStats`, CRUD for projects/methods/messages, `getSettings`/`setSetting`. Events pushed to all renderers: `timer:tick` (1/s), `timer:phase-changed`.
- **UI**: Tailwind CSS v4, Recharts (bundled), bundled font (e.g. Inter via `@fontsource`), no CDN calls. Theme: `nativeTheme` follows system; sage/teal light + slate/teal dark per §4.
- **Sounds**: 3 bundled audio files (pause-start, pause-end, 1-min-warning chimes) played via `HTMLAudioElement` in whichever renderer is visible; toggles stored in `settings` table; master mute in tray menu.
- **Tray**: icon + context menu (open, mute, quit); tooltip updated each tick with countdown. Closing main window hides to tray instead of quitting.
- **Startup**: `app.setLoginItemSettings({ openAtLogin })`.
- **Packaging**: `electron-builder` NSIS target.

## Design system (light + dark)

Per REQUIREMENTS §4: sage green / soft teal on warm off-white; dark mode = deep slate + muted teal. Dark mode is a first-class theme designed in parallel (desaturated tonal variants, not inverted colors), following system via `nativeTheme` → `.dark` class on `<html>`, pushed to all three windows so main window, widget, and overlay always match.

**Implementation**: Tailwind CSS v4 `@theme` bound to semantic CSS variables defined once in `src/renderer/src/styles/theme.css` (`:root` = light, `.dark` = dark overrides). Components use only semantic tokens (`bg-surface`, `text-primary`, `text-accent`) — no raw hex in components.

### Color tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#F6F4EE` warm off-white | `#0F1717` deep slate-teal | window background |
| `--surface` | `#FFFFFF` | `#182220` | cards |
| `--surface-2` | `#EEEBE2` | `#202C2A` | inset/hover surfaces |
| `--border` | `#E3DFD3` | `#2A3835` | hairlines, dividers |
| `--text` | `#243230` | `#E6EFEA` | primary text (≥12:1) |
| `--text-muted` | `#5F6E68` | `#9DB2A9` | secondary text (≥4.5:1) |
| `--accent` | `#37675C` deep sage-teal | `#6FBFAD` muted teal | focus phase, primary buttons, rings, charts |
| `--accent-soft` | `#DCE9E2` | `#1E332F` | accent tints (chips, chart fills, progress track) |
| `--pause` | `#8A6D3F` warm sand | `#D6B98C` soft sand | pause phase color (rest = warm, distinct from focus teal without red/green conflict) |
| `--danger` | `#A84B4B` | `#D08C8C` | destructive (delete, end session) |

Primary buttons: `--accent` bg + white/near-black text (≥4.5:1 both themes). Phase color (teal vs sand) tints the timer ring, widget, and overlay so the current phase is recognizable at a glance — always paired with a text label, never color alone.

### Typography (bundled via `@fontsource`, zero CDN)

- **Display — Lora** (serif): pause-overlay messages, dashboard greeting, empty states. The single characterful voice of the app — calm, humane, editorial.
- **UI/body — Inter**: everything else; weights 400/500/600.
- **Timer numerals — Inter 200 (light)** with `font-variant-numeric: tabular-nums` (no layout shift as digits tick). Main timer ~96px, widget ~28px, overlay countdown ~72px.
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 72 / 96. Body 16px, line-height 1.5.

### Shape, icons, motion

- Radius: cards 16px, buttons/inputs 10px, widget pill fully rounded. Shadows barely-there in light (`0 1px 3px rgb(36 50 48 / .06)`), replaced by 1px `--border` outlines in dark.
- Icons: **Lucide** (`lucide-react`), 1.5px stroke, 20px default — one family everywhere, no emoji.
- Motion: 150–250ms ease-out micro-interactions; overlay entrance 500ms fade + slight scale; timer ring animates via stroke-dashoffset (transform/opacity only). All motion behind `prefers-reduced-motion`.
- **Signature element**: the "breathing" pause overlay — a slow (8s loop) radial gradient that gently brightens/dims behind the message, like a breathing exercise cue. This is the one memorable moment; everything else stays quiet.

### Per-screen direction

- **Start screen**: single centered column, no nav clutter. Big idle timer preview (method's focus duration), project picker as color-dotted chips, method dropdown card, one primary CTA "Start focusing". Left rail: three icon+label nav items (Focus / Dashboard / Settings) with active indicator.
- **Focus state (main window hidden)** — **mini widget**: compact pill (~220×64), `--surface` bg with subtle ring-progress arc in phase color, tabular countdown, project color dot + name, round badge "2/4". Draggable everywhere except the two buttons (pause/resume, stop).
- **Pause overlay**: full-bleed breathing gradient (dark: `#0F1717 → #1E332F`; light: `#F6F4EE → #DCE9E2`), pause-type label (eyebrow, small caps), Lora message at ~40px centered, 72px countdown with thin ring, ghost "Skip pause" button (instant, single click), quiet "End session" text link bottom-center in `--danger`. 500ms fade-in.
- **Dashboard**: 12-col card grid — 4 stat tiles (total hours, streak, sessions, pauses skipped) with tabular numerals; daily-minutes Recharts bar/area chart in `--accent` with `--accent-soft` fill and low-contrast gridlines; time-per-project list with color dots + duration bars; history table below. Filter segmented control (Today/Week/Month/All).
- **Settings**: sectioned rounded cards (Methods, Projects, Messages, Sounds, General), inline CRUD rows with edit/delete icon buttons, toggle switches in `--accent`. Destructive actions confirmed and styled `--danger`, visually separated.

### Design quality floor

Contrast ≥4.5:1 body text in **both** themes (verify dark independently); visible focus rings (`--accent`, 2px); all interactive targets ≥40px; keyboard reachable everywhere incl. overlay ("Skip" gets initial focus); toggles/states never rely on color alone.

## Data model (from spec, implemented verbatim)

```
projects(id, name, color, archived, created_at)
methods(id, name, focus_min, short_pause_min, long_pause_min, rounds_before_long, is_preset)
pause_messages(id, text, enabled, sort_order)
sessions(id, project_id, method_id, started_at, ended_at, status)      -- completed | stopped
intervals(id, session_id, kind, started_at, planned_sec, actual_sec, skipped)
settings(key, value)
```
Seed: Pomodoro preset (25/5/15, long every 4, `is_preset=1`, not deletable) + ~6 default pause messages.

## File layout

```
src/
  main/
    index.ts            # app lifecycle, tray, window mgmt
    db/ (schema.ts, migrations.ts, repos: projects.ts, methods.ts, messages.ts, sessions.ts, stats.ts)
    timer/engine.ts     # state machine + powerMonitor hooks
    windows/ (main.ts, widget.ts, overlay.ts)
    ipc.ts              # ipcMain handlers, wires engine+repos
  preload/index.ts
  shared/types.ts       # IPC contract, entities, timer state
  renderer/
    src/ (App.tsx, routes: Start, Dashboard, Settings; widget.html entry; overlay.html entry)
    assets/sounds/, fonts
```
Widget and overlay are separate Vite HTML entries sharing the renderer codebase.

## Milestones (build in this order, verify each before next)

1. **Scaffold**: electron-vite React-TS project, Tailwind, tray icon + menu, main window opens, close-to-tray. `npm run dev` works.
   - **1.5 Design system**: `theme.css` with all tokens above (light + dark), Tailwind `@theme` mapping, `@fontsource` Inter + Lora, Lucide icons, `nativeTheme` → `.dark` class sync across windows, base components (Button, Card, Chip, Toggle, SegmentedControl, timer numeral style). Verify both themes side by side before building screens.
2. **Data layer**: schema + migration runner, all repos, seed data, typed IPC for full CRUD + settings. Verify with a throwaway settings page listing projects.
3. **Timer engine + session flow**: engine state machine (incl. round counter, long pause every N, partial-time recording on stop, powerMonitor auto-pause), Start screen (project picker remembering last used, method picker, live timer view), pause/resume/stop controls, main window hides to tray on focus start.
4. **Pause overlay**: per-display fullscreen windows, countdown, pause type, message rotation/randomize from enabled messages, instant "Skip pause" (advances round counter per §3.3) and "End session" buttons, fade-in, calm gradient.
5. **Mini widget + sounds**: draggable always-on-top widget (remaining time, project, round "2/4", toggleable in settings), tray tooltip countdown, three chimes with individual toggles + master mute.
6. **Dashboard**: stats repo queries (time per project with today/week/month/all filters, focus minutes per day chart via Recharts, current streak, totals, pauses skipped, session history table).
7. **Settings & polish**: CRUD UIs for methods/projects (archive-not-delete once time logged)/messages (enable/disable, reorder), sound + widget + randomize + launch-on-startup toggles, system theme, then `electron-builder` NSIS installer build.

## Verification

- After each milestone: run `npm run dev` and exercise the new surface manually.
- Add a dev-only "Test" method (e.g. 0.2 min focus / 0.1 min pauses / long every 2) so full cycles, overlay, chimes, skip-advances-round, and long-pause-after-N can be observed in under a minute. Store durations as **seconds** internally to make this possible; UI edits in minutes.
- Timer correctness: start a session, lock the screen (Win+L), unlock — confirm timer paused/resumed and `intervals.actual_sec` reflects only unlocked time.
- Multi-monitor overlay: verify on the actual display setup; simulate display add/remove if possible.
- Dashboard numbers cross-checked against `sessions`/`intervals` rows via direct SQLite query.
- Theme: flip Windows system theme while the app runs — main window, widget, and overlay must all switch; spot-check dark-mode contrast of muted text, chart gridlines, and borders (don't infer from light mode).
- Final: `npm run build` + install the NSIS installer, confirm packaged app runs (native module rebuilt correctly) and launch-on-startup works.

## Out of scope (per spec)

No export/import, no accounts/sync, Windows only.
