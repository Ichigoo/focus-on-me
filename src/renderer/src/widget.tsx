import React from 'react'
import ReactDOM from 'react-dom/client'
import { Coffee, Maximize2, Pause, Play } from 'lucide-react'
import { useTheme, useTimerState } from './lib/hooks'
import { fmtClock, phaseLabel } from './lib/format'
import { TimerRing } from './components/TimerRing'
import './styles/theme.css'

function WidgetApp(): React.JSX.Element {
  useTheme()
  const timer = useTimerState()
  const isFocus = timer.phase === 'focus'
  const color = isFocus ? 'var(--accent)' : 'var(--pause)'
  const progress = timer.plannedSec > 0 ? 1 - timer.remainingSec / timer.plannedSec : 0

  return (
    <div
      className="card-shadow flex h-[68px] w-[252px] items-center gap-3 rounded-full border border-line bg-surface px-3 select-none m-1"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <TimerRing progress={progress} size={46} stroke={4} color={color}>
        <span className="h-2 w-2 rounded-full" style={{ background: timer.projectColor }} aria-hidden="true" />
      </TimerRing>

      <div className="min-w-0 flex-1">
        <p className="timer-digits text-[26px] leading-none text-ink">{fmtClock(timer.remainingSec)}</p>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted">
          {timer.status === 'paused' ? 'Paused · ' : `${phaseLabel(timer.phase)} · `}
          {timer.projectName} · {timer.round}/{timer.roundsBeforeLong}
        </p>
      </div>

      <div className="flex shrink-0 gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          aria-label={timer.status === 'paused' ? 'Resume' : 'Pause'}
          onClick={() => void window.api.session.pauseResume()}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {timer.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
        </button>
        {isFocus && (
          <button
            aria-label="Take a break"
            onClick={() => void window.api.session.forcePause()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Coffee size={14} />
          </button>
        )}
        <button
          aria-label="Open main window"
          onClick={() => window.api.ui.openMain()}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WidgetApp />
  </React.StrictMode>
)
