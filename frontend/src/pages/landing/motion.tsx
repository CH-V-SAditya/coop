import Lenis from 'lenis'
import { createContext, use, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Smooth (delayed) scroll */

type ScrollApi = { scrollTo: (target: string) => void; scrolled: boolean }
const ScrollContext = createContext<ScrollApi>({ scrollTo: () => {}, scrolled: false })

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Lenis gives the page its weighted, slightly delayed scroll. It also feeds the
 * smoothed scroll position into the CSS variable --ls, which drives parallax.
 * Destroyed on unmount so the app pages keep native scrolling.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const onScroll = (y: number) => {
      root.style.setProperty('--ls', y.toFixed(1))
      setScrolled((prev) => (prev !== y > 24 ? y > 24 : prev))
    }

    if (prefersReducedMotion()) {
      const native = () => onScroll(window.scrollY)
      window.addEventListener('scroll', native, { passive: true })
      return () => {
        window.removeEventListener('scroll', native)
        root.style.removeProperty('--ls')
      }
    }

    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, autoRaf: true, anchors: { offset: -72 } })
    lenisRef.current = lenis
    lenis.on('scroll', (l: Lenis) => onScroll(l.scroll))
    return () => {
      lenis.destroy()
      lenisRef.current = null
      root.style.removeProperty('--ls')
    }
  }, [])

  const scrollTo = (target: string) => {
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, duration: 1.4 })
    else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
  }

  return <ScrollContext value={{ scrollTo, scrolled }}>{children}</ScrollContext>
}

export const useSmoothScroll = () => use(ScrollContext)

/* ------------------------------------------------------------------ Reveal on scroll */

type RevealProps = {
  children: ReactNode
  /** rise = smooth; stop = stop-motion frames; pop = sticker pop; fade = slow fade */
  variant?: 'rise' | 'stop' | 'pop' | 'fade'
  delay?: number
  /** Resting rotation (deg) for stop/pop variants, so stickers land slightly askew. */
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

/** Moves at a different speed than the page while scrolling (negative = slower/up). */
export function Parallax({ speed, className, children }: { speed: number; className?: string; children: ReactNode }) {
  return (
    <div className={cn('parallax', className)} style={{ '--speed': speed } as CSSProperties}>
      {children}
    </div>
  )
}

/** Handwritten margin note, the kind you'd scribble on a printed plan. */
export function HandNote({ children, className, tilt = -3 }: { children: ReactNode; className?: string; tilt?: number }) {
  return (
    <span className={cn('boil inline-block font-hand text-xl leading-tight text-accent', className)} style={{ '--r': `${tilt}deg` } as CSSProperties}>
      {children}
    </span>
  )
}
