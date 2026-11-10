import Lenis from 'lenis'
import { createContext, use, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Smooth (delayed) scroll */

type Layer = { el: HTMLElement; speed: number }
type ScrollApi = {
  scrollTo: (target: string) => void
  scrolled: boolean
  register: (layer: Layer) => () => void
}
const ScrollContext = createContext<ScrollApi>({ scrollTo: () => {}, scrolled: false, register: () => () => {} })

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Lenis gives the page its weighted, slightly delayed scroll. Performance notes:
 * - Parallax layers are moved by writing `transform` straight onto each element.
 *   (Writing a CSS variable on <html> every frame forces a full-page restyle.)
 * - React state only changes when the nav crosses its threshold, not per frame.
 * Destroyed on unmount so the app pages keep native scrolling.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const layers = useRef(new Set<Layer>())
  const scrolledRef = useRef(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const onScroll = (y: number) => {
      if (!reduced) {
        for (const { el, speed } of layers.current) el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`
      }
      const next = y > 24
      if (next !== scrolledRef.current) {
        scrolledRef.current = next
        setScrolled(next)
      }
    }

    if (reduced) {
      const native = () => onScroll(window.scrollY)
      window.addEventListener('scroll', native, { passive: true })
      return () => window.removeEventListener('scroll', native)
    }

    const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9, autoRaf: true, anchors: { offset: -72 } })
    lenisRef.current = lenis
    lenis.on('scroll', (l: Lenis) => onScroll(l.scroll))
    return () => {
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  const api: ScrollApi = {
    scrolled,
    scrollTo: (target) => {
      if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, duration: 1.4 })
      else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
    },
    register: (layer) => {
      layers.current.add(layer)
      return () => layers.current.delete(layer)
    },
  }

  return <ScrollContext value={api}>{children}</ScrollContext>
}

export const useSmoothScroll = () => use(ScrollContext)

/* ------------------------------------------------------------------ Reveal on scroll */

type RevealProps = {
  children: ReactNode
  /** rise = lift in; stop = paper card settling at a tilt; pop = sticker pop; fade = slow fade */
  variant?: 'rise' | 'stop' | 'pop' | 'fade'
  delay?: number
  /** Resting rotation (deg) for stop/pop variants, so cards land slightly askew. */
  tilt?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
}

export function Reveal({ children, variant = 'rise', delay = 0, tilt = 0, as: Tag = 'div', className, style }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={cn('reveal', `reveal-${variant}`, shown && 'is-shown', className)}
      style={{ ...style, '--d': `${delay}ms`, '--r': `${tilt}deg` } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

/** Moves at a different speed than the page while scrolling (negative = drifts up). */
export function Parallax({ speed, className, children }: { speed: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { register } = useSmoothScroll()

  useEffect(() => {
    if (!ref.current) return
    return register({ el: ref.current, speed })
  }, [register, speed])

  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  )
}

/** Handwritten margin note, the kind you'd scribble on a printed plan. */
export function HandNote({ children, className, tilt = -3 }: { children: ReactNode; className?: string; tilt?: number }) {
  return (
    <span className={cn('sway inline-block font-hand text-xl leading-tight text-accent-ink', className)} style={{ '--r': `${tilt}deg` } as CSSProperties}>
      {children}
    </span>
  )
}
