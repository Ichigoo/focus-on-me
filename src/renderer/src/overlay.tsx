import React from 'react'
import ReactDOM from 'react-dom/client'
import { SkipForward } from 'lucide-react'
import { useTheme, useTimerState } from './lib/hooks'
import { fmtClock } from './lib/format'
import { TimerRing } from './components/TimerRing'
import './styles/theme.css'

function OverlayApp(): React.JSX.Element {
  useTheme()
  const timer = useTimerState()
  const isLong = timer.phase === 'long_pause'

  return (
    <div className="overlay-in relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-bg">
      {/* breathing gradient backdrop */}
      <div
        aria-hidden="true"
        className="breathing absolute h-[140vmin] w-[140vmin] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--overlay-to) 0%, transparent 65%)'
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        <p className="mb-6 text-sm font-medium tracking-[0.25em] text-ink-muted uppercase">
          {isLong ? 'Long break' : 'Short break'}
        </p>

        <p className="font-display mb-12 max-w-3xl text-[clamp(28px,4vw,44px)] leading-snug text-ink">
          {timer.pauseMessage ?? 'Time for a break'}
        </p>

        <TimerRing
          progress={timer.plannedSec > 0 ? 1 - timer.remainingSec / timer.plannedSec : 0}
          size={220}
          stroke={5}
          color="var(--pause)"
        >
          <span className="timer-digits text-[56px] text-ink">{fmtClock(timer.remainingSec)}</span>
        </TimerRing>

        <div className="mt-12 flex flex-col items-center gap-4">
          <button
            autoFocus
            onClick={() => void window.api.session.skipPause()}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-(--radius-btn) border border-line bg-surface/70 px-6 text-base text-ink backdrop-blur transition-all duration-150 hover:bg-surface active:scale-[0.98]"
          >
            <SkipForward size={17} aria-hidden="true" />
            Skip break
          </button>
          <button
            onClick={() => void window.api.session.stop()}
            className="cursor-pointer rounded-(--radius-btn) px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            End session
          </button>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
)
