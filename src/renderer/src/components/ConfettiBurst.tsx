import { PROJECT_COLORS } from '@shared/types'

const COLORS = [...PROJECT_COLORS, 'var(--accent)', 'var(--pause)']

/** Fires a one-shot confetti burst from a screen point. Self-removing; no-op under reduced motion. */
export function burstConfetti(origin: { x: number; y: number }, options: { count?: number; scale?: number } = {}): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { count = 24, scale = 1 } = options

  const layer = document.createElement('div')
  layer.style.position = 'fixed'
  layer.style.inset = '0'
  layer.style.pointerEvents = 'none'
  layer.style.zIndex = '9999'
  document.body.appendChild(layer)

  let remaining = count
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const size = (4 + Math.random() * 3) * scale
    el.style.position = 'absolute'
    el.style.left = `${origin.x}px`
    el.style.top = `${origin.y}px`
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.borderRadius = Math.random() < 0.5 ? '9999px' : '2px'
    el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)]
    layer.appendChild(el)

    const angle = Math.random() * Math.PI * 2
    const distance = (60 + Math.random() * 90) * scale
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 20 * scale
    const rotate = (Math.random() - 0.5) * 720
    const duration = 500 + Math.random() * 400

    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotate}deg)`,
          opacity: 0
        }
      ],
      { duration, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }
    )
    anim.onfinish = (): void => {
      el.remove()
      remaining--
      if (remaining <= 0) layer.remove()
    }
  }
}
