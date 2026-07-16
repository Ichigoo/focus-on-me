import pauseStartUrl from '../assets/sounds/pause-start.wav'
import pauseEndUrl from '../assets/sounds/pause-end.wav'
import warningUrl from '../assets/sounds/warning.wav'
import adhanUrl from '../assets/sounds/adhan.wav'
import taskReminderUrl from '../assets/sounds/task-reminder.wav'
import taskDoneUrl from '../assets/sounds/task-done.wav'
import type { SoundKind } from '@shared/types'

const urls: Record<SoundKind, string> = {
  'pause-start': pauseStartUrl,
  'pause-end': pauseEndUrl,
  warning: warningUrl,
  adhan: adhanUrl,
  'task-reminder': taskReminderUrl,
  'task-done': taskDoneUrl
}

/** Plays a sound directly in this window. Callers are responsible for respecting `masterMute`. */
export function playSound(kind: SoundKind, muted = false): void {
  if (muted) return
  const audio = new Audio(urls[kind])
  audio.volume = 0.7
  void audio.play().catch(() => {
    /* autoplay policies don't apply to app windows, but never crash on audio */
  })
}

/**
 * Call once in the window that owns audio playback (the main window — it stays
 * alive in the tray even while hidden). The main process only emits 'sound:play'
 * when the relevant toggle is on and master mute is off.
 */
export function installSoundPlayer(): () => void {
  return window.api.ui.onSound((kind) => playSound(kind))
}
