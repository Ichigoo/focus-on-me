import { EventEmitter } from 'events'
import type { Method, Phase, Project, SoundKind, TimerMode, TimerState } from '@shared/types'
import { messages, sessions, settings } from '../db/repos'

/**
 * Single source of truth for the focus/pause cycle. Lives in the main process
 * so it keeps running while windows are hidden. Elapsed time is computed from
 * wall-clock timestamps, never tick counts, so sleep/lock can't corrupt it.
 *
 * Events:
 *  - 'state'  (TimerState)            — every tick and on any transition
 *  - 'phase'  (Phase, prev: Phase)    — phase changed (drives overlay windows)
 *  - 'sound'  (SoundKind)             — a chime should play (already filtered by settings)
 *  - 'session-started' / 'session-ended'
 */
export class TimerEngine extends EventEmitter {
  private status: TimerState['status'] = 'idle'
  private mode: TimerMode = 'pomodoro'
  private simpleDurationSec = 0 // countdown length; unused for other modes
  private taskName: string | null = null
  private phase: Phase = 'focus'
  private round = 1
  private project: Project | null = null
  private method: Method | null = null
  private sessionId: number | null = null
  private plannedSec = 0
  private segmentStartedMs = 0 // when the current running segment began
  private accumulatedMs = 0 // elapsed time in this phase before the current segment
  private intervalStartedSec = 0 // phase start, for the DB row
  private warned = false
  private autoPaused = false
  private pauseMessage: string | null = null
  private rotationIndex = 0
  private ticker: NodeJS.Timeout | null = null

  // ---------- public API ----------

  start(project: Project, method: Method, taskName: string | null = null): void {
    if (this.status !== 'idle') this.stop()
    this.project = project
    this.method = method
    this.mode = 'pomodoro'
    this.taskName = taskName
    this.sessionId = sessions.create(project.id, method.id)
    this.round = 1
    this.status = 'running'
    this.beginPhase('focus')
    this.ticker = setInterval(() => this.tick(), 500)
    this.emit('session-started')
    this.emitState()
  }

  /**
   * Single-phase session: a fixed countdown or an open-ended stopwatch.
   * `method` must be the hidden preset row matching the mode (sessions.method_id is NOT NULL).
   */
  startSimple(
    project: Project,
    method: Method,
    mode: 'countdown' | 'stopwatch',
    durationSec: number,
    taskName: string | null = null
  ): void {
    if (this.status !== 'idle') this.stop()
    this.project = project
    this.method = method
    this.mode = mode
    this.taskName = taskName
    this.simpleDurationSec = mode === 'countdown' ? Math.max(60, durationSec) : 0
    this.sessionId = sessions.create(project.id, method.id)
    this.round = 1
    this.status = 'running'
    this.beginPhase('focus')
    this.ticker = setInterval(() => this.tick(), 500)
    this.emit('session-started')
    this.emitState()
  }

  pauseResume(): void {
    if (this.status === 'running') {
      this.accumulatedMs += Date.now() - this.segmentStartedMs
      this.status = 'paused'
      this.autoPaused = false
    } else if (this.status === 'paused') {
      this.segmentStartedMs = Date.now()
      this.status = 'running'
      this.autoPaused = false
    }
    this.emitState()
  }

  /** System went to sleep or the screen locked: freeze tracked time. */
  autoPause(): void {
    if (this.status !== 'running') return
    this.accumulatedMs += Date.now() - this.segmentStartedMs
    this.status = 'paused'
    this.autoPaused = true
    this.emitState()
  }

  /** System woke or unlocked: resume only if we were the ones who paused. */
  autoResume(): void {
    if (this.status !== 'paused' || !this.autoPaused) return
    this.segmentStartedMs = Date.now()
    this.status = 'running'
    this.autoPaused = false
    this.emitState()
  }

  skipPause(): void {
    if (this.status === 'idle' || this.phase === 'focus') return
    this.completePhase(true)
  }

  /** Manually end the current focus phase early and jump straight into a break. */
  forcePause(): void {
    if (this.status === 'idle' || this.phase !== 'focus') return
    this.completePhase(true)
  }

  stop(): void {
    if (this.status === 'idle' || !this.sessionId) return
    // Record the partial interval for the current phase.
    const elapsed = this.elapsedSec()
    if (elapsed > 0) {
      sessions.addInterval(this.sessionId, this.phase, this.intervalStartedSec, this.plannedSec, elapsed, false)
    }
    // Stopping mid-focus counts as stopped early; stopping in a pause means the
    // focus work itself was completed.
    const status = this.phase === 'focus' && elapsed < this.plannedSec ? 'stopped' : 'completed'
    sessions.end(this.sessionId, status)
    this.reset()
    this.emit('session-ended')
    this.emitState()
  }

  getState(): TimerState {
    return {
      status: this.status,
      mode: this.mode,
      phase: this.phase,
      round: this.round,
      roundsBeforeLong: this.method?.rounds_before_long ?? 4,
      // Stopwatch counts up: remainingSec carries the elapsed time instead.
      remainingSec:
        this.mode === 'stopwatch' ? Math.floor(this.elapsedSec()) : Math.max(0, this.plannedSec - this.elapsedSec()),
      plannedSec: this.plannedSec,
      sessionId: this.sessionId,
      projectId: this.project?.id ?? null,
      projectName: this.project?.name ?? '',
      projectColor: this.project?.color ?? '#8B5CF6',
      methodName: this.method?.name ?? '',
      taskName: this.taskName,
      pauseMessage: this.pauseMessage,
      autoPaused: this.autoPaused
    }
  }

  // ---------- internals ----------

  private elapsedSec(): number {
    if (this.status === 'idle') return 0
    const running = this.status === 'running' ? Date.now() - this.segmentStartedMs : 0
    return (this.accumulatedMs + running) / 1000
  }

  private beginPhase(phase: Phase): void {
    this.phase = phase
    this.accumulatedMs = 0
    this.segmentStartedMs = Date.now()
    this.intervalStartedSec = Math.floor(Date.now() / 1000)
    this.warned = false
    const m = this.method!
    if (this.mode === 'pomodoro') {
      this.plannedSec =
        phase === 'focus' ? m.focus_sec : phase === 'short_pause' ? m.short_pause_sec : m.long_pause_sec
    } else {
      this.plannedSec = this.simpleDurationSec // 0 for stopwatch
    }
    this.pauseMessage = phase === 'focus' ? null : this.pickMessage()
  }

  private pickMessage(): string {
    const enabled = messages.listEnabled()
    if (enabled.length === 0) return 'Time for a break'
    const prefs = settings.getAll()
    if (prefs.randomizeMessages) {
      return enabled[Math.floor(Math.random() * enabled.length)].text
    }
    const msg = enabled[this.rotationIndex % enabled.length]
    this.rotationIndex++
    return msg.text
  }

  private tick(): void {
    if (this.status !== 'running') return
    if (this.mode === 'stopwatch') {
      // Open-ended: never auto-completes, just report elapsed time.
      this.emitState()
      return
    }
    const remaining = this.plannedSec - this.elapsedSec()
    // 1-minute warning before an upcoming pause (only meaningful for focus phases
    // long enough that the warning isn't immediate noise).
    if (this.phase === 'focus' && !this.warned && this.plannedSec > 90 && remaining <= 60 && remaining > 0) {
      this.warned = true
      this.playSound('warning')
    }
    if (remaining <= 0) {
      this.completePhase(false)
    } else {
      this.emitState()
    }
  }

  private completePhase(skipped: boolean): void {
    const sessionId = this.sessionId!
    const m = this.method!
    const prev = this.phase
    const actual = Math.min(this.elapsedSec(), this.plannedSec)
    sessions.addInterval(sessionId, prev, this.intervalStartedSec, this.plannedSec, actual, skipped)

    // Simple modes have a single focus phase: finishing it ends the session.
    if (this.mode !== 'pomodoro') {
      sessions.end(sessionId, 'completed')
      this.reset()
      this.playSound('pause-end')
      this.emit('session-ended')
      this.emitState()
      return
    }

    if (prev === 'focus') {
      const next: Phase = this.round % m.rounds_before_long === 0 ? 'long_pause' : 'short_pause'
      this.beginPhase(next)
      this.playSound('pause-start')
    } else {
      // A skipped short pause still advances the round; after a long pause the
      // cycle starts over.
      this.round = prev === 'long_pause' ? 1 : this.round + 1
      this.beginPhase('focus')
      this.playSound('pause-end')
    }
    // Phase changes always resume the clock (a manual pause doesn't survive a transition).
    this.status = 'running'
    this.autoPaused = false
    this.emit('phase', this.phase, prev)
    this.emitState()
  }

  private playSound(kind: SoundKind): void {
    const prefs = settings.getAll()
    if (prefs.masterMute) return
    if (kind === 'warning' && !prefs.soundWarning) return
    if (kind === 'pause-start' && !prefs.soundPauseStart) return
    if (kind === 'pause-end' && !prefs.soundPauseEnd) return
    this.emit('sound', kind)
  }

  private reset(): void {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
    this.status = 'idle'
    this.mode = 'pomodoro'
    this.simpleDurationSec = 0
    this.taskName = null
    this.phase = 'focus'
    this.round = 1
    this.project = null
    this.method = null
    this.sessionId = null
    this.plannedSec = 0
    this.accumulatedMs = 0
    this.pauseMessage = null
    this.autoPaused = false
  }

  private emitState(): void {
    this.emit('state', this.getState())
  }
}

export const engine = new TimerEngine()
