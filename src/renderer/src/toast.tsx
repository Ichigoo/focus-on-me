import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BellRing, ListChecks, MoonStar, ShieldBan, X } from 'lucide-react'
import type { ToastPayload } from '@shared/types'
import { useTheme } from './lib/hooks'
import './styles/theme.css'

const kindIcon = {
  task: ListChecks,
  adhan: MoonStar,
  block: ShieldBan
} as const

function ToastApp(): React.JSX.Element | null {
  useTheme()
  const [toast, setToast] = useState<ToastPayload | null>(null)

  useEffect(() => {
    // pull the payload that triggered this window, then listen for reuse
    void window.api.ui.getPendingToast().then((t) => t && setToast(t))
    return window.api.ui.onToast((t) => setToast(t))
  }, [])

  if (!toast) return null
  const Icon = kindIcon[toast.kind] ?? BellRing

  return (
    <div className="overlay-in card-shadow m-2 flex h-[92px] items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 select-none">
      <div className="btn-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
        <Icon size={19} className="text-white" aria-hidden="true" />
      </div>

      <button
        onClick={() => window.api.ui.openMain()}
        className="min-w-0 flex-1 cursor-pointer text-left"
        aria-label={`${toast.title}: ${toast.body} — open Focus On Me`}
      >
        <p className="truncate text-sm font-semibold text-ink">{toast.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">{toast.body}</p>
        <p className="mt-0.5 text-[10px] font-medium tracking-widest text-accent uppercase">Focus On Me</p>
      </button>

      <button
        aria-label="Dismiss notification"
        onClick={() => window.api.ui.closeToast()}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        style={{ marginTop: 10 }}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastApp />
  </React.StrictMode>
)
