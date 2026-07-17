import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger' | 'danger-ghost'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'btn-gradient text-accent-contrast hover:opacity-90 active:scale-[0.98] font-medium',
  soft: 'bg-accent-soft text-accent hover:opacity-85 active:scale-[0.98] font-medium',
  ghost:
    'border border-line bg-surface text-ink hover:bg-surface-2 active:scale-[0.98]',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.98] font-medium',
  'danger-ghost': 'text-danger hover:bg-danger/10 active:scale-[0.98]'
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}): React.JSX.Element {
  const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' }
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-(--radius-btn) transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 ${sizes[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  )
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

export function Card({
  children,
  className = '',
  style
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <div className={`card-shadow rounded-(--radius-card) border border-line bg-surface ${className}`} style={style}>
      {children}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-surface-2 border border-line'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  grow = false
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  grow?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`${grow ? 'flex w-full' : 'inline-flex'} rounded-xl border border-line bg-surface-2 p-1`}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
            grow ? 'flex-1' : ''
          } ${
            value === o.value ? 'bg-accent-soft text-accent font-medium' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 opacity-70">({o.count})</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- FocusSphere primitives ----------

export type ChipTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const chipToneClasses: Record<ChipTone, string> = {
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-surface-2 text-ink-muted'
}

export function Chip({
  tone = 'neutral',
  children,
  className = '',
  style
}: {
  tone?: ChipTone
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${chipToneClasses[tone]} ${className}`}
      style={style}
    >
      {children}
    </span>
  )
}

export function StatTile({
  icon,
  iconClassName = 'bg-accent-soft text-accent',
  value,
  label,
  sub,
  badge,
  badgeTone = 'success'
}: {
  icon: ReactNode
  iconClassName?: string
  value: string
  label: string
  sub?: string
  badge?: string
  badgeTone?: ChipTone
}): React.JSX.Element {
  return (
    <Card className="relative p-5">
      {badge && (
        <div className="absolute top-4 right-4">
          <Chip tone={badgeTone}>{badge}</Chip>
        </div>
      )}
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${iconClassName}`}>
        {icon}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-muted/70">{sub}</p>}
    </Card>
  )
}

export function Stepper({
  value,
  display,
  onDecrement,
  onIncrement,
  label
}: {
  value: number
  display?: string
  onDecrement: () => void
  onIncrement: () => void
  label: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button
        aria-label={`Decrease ${label}`}
        onClick={onDecrement}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-colors hover:text-ink"
      >
        −
      </button>
      <span className="min-w-10 text-center font-mono text-sm">{display ?? value}</span>
      <button
        aria-label={`Increase ${label}`}
        onClick={onIncrement}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-ink-muted transition-colors hover:text-ink"
      >
        +
      </button>
    </div>
  )
}

export function ProgressBar({
  fraction,
  className = ''
}: {
  fraction: number
  className?: string
}): React.JSX.Element {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element | null {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <Card className="w-96 p-6" >
        <div onClick={(e) => e.stopPropagation()}>
          <h2 className="mb-2 text-lg font-semibold">{title}</h2>
          <p className="mb-5 text-sm text-ink-muted">{body}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} autoFocus>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="font-display text-lg text-ink-muted">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted/70">{hint}</p>}
    </div>
  )
}
