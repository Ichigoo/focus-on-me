import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'danger-ghost'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-contrast hover:opacity-90 active:scale-[0.98] font-medium',
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

export function Card({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={`card-shadow rounded-(--radius-card) border border-line bg-surface ${className}`}>
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
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <div className="inline-flex rounded-(--radius-btn) border border-line bg-surface-2 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
            value === o.value ? 'bg-surface text-ink card-shadow font-medium' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
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
