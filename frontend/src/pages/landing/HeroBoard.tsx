import { AlertTriangle, Check, Hourglass, Sparkles } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { HandNote } from './motion'

type Col = 0 | 1 | 2
type CardState = { col: Col; tone: 'idle' | 'active' | 'blocked' | 'waiting' | 'review' | 'done' }

const CARDS = [
  { id: 'qa', key: 'REL-1', title: 'QA sign-off', who: 'MI', color: 'bg-sky-500' },
  { id: 'report', key: 'REL-2', title: 'Consolidated report', who: 'RK', color: 'bg-indigo-500' },
  { id: 'schedule', key: 'REL-3', title: 'Deployment schedule', who: 'AS', color: 'bg-amber-500' },
  { id: 'approve', key: 'REL-4', title: 'Approve go-live', who: 'KN', color: 'bg-emerald-500' },
] as const

type Frame = { cards: Record<(typeof CARDS)[number]['id'], CardState>; note: string }

// Each frame is one "pose" of the board. The loop plays them like a flip-book.
const FRAMES: Frame[] = [
  {
    note: 'QA is on it. Everything else is lined up behind it.',
    cards: { qa: { col: 1, tone: 'active' }, report: { col: 0, tone: 'waiting' }, schedule: { col: 0, tone: 'waiting' }, approve: { col: 0, tone: 'waiting' } },
  },
  {
    note: 'QA signed off. Ravi can start the report.',
    cards: { qa: { col: 2, tone: 'done' }, report: { col: 1, tone: 'active' }, schedule: { col: 0, tone: 'waiting' }, approve: { col: 0, tone: 'waiting' } },
  },
  {
    note: 'Report is blocked: waiting on revised Q3 figures from finance.',
    cards: { qa: { col: 2, tone: 'done' }, report: { col: 1, tone: 'blocked' }, schedule: { col: 0, tone: 'waiting' }, approve: { col: 0, tone: 'waiting' } },
  },
  {
    note: 'Finance sent the numbers. Report is moving again.',
    cards: { qa: { col: 2, tone: 'done' }, report: { col: 1, tone: 'review' }, schedule: { col: 0, tone: 'waiting' }, approve: { col: 0, tone: 'waiting' } },
  },
  {
    note: 'Report accepted. Arjun is building the schedule.',
    cards: { qa: { col: 2, tone: 'done' }, report: { col: 2, tone: 'done' }, schedule: { col: 1, tone: 'active' }, approve: { col: 0, tone: 'waiting' } },
  },
  {
    note: '3 of 4 done. Go-live is with Kavya for approval.',
    cards: { qa: { col: 2, tone: 'done' }, report: { col: 2, tone: 'done' }, schedule: { col: 2, tone: 'done' }, approve: { col: 1, tone: 'review' } },
  },
]

const TONE: Record<CardState['tone'], { label: string; chip: string; card: string }> = {
  idle: { label: 'Ready', chip: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300', card: 'border-line' },
  waiting: { label: 'Waiting', chip: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300', card: 'border-line' },
  active: { label: 'In progress', chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300', card: 'border-indigo-300/70 dark:border-indigo-800' },
  blocked: { label: 'Blocked', chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', card: 'border-rose-400 dark:border-rose-700' },
  review: { label: 'In review', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', card: 'border-amber-300 dark:border-amber-800' },
  done: { label: 'Done', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', card: 'border-line opacity-80' },
}

const COLUMNS = ['Yet to start', 'In progress', 'Done']
const ROW = 74 // px per card slot

export function HeroBoard() {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 2300)
    return () => window.clearInterval(id)
  }, [])

  const current = FRAMES[frame]!
  // Stack cards in their column in a stable order.
  const slot: Record<string, number> = {}
  ;([0, 1, 2] as Col[]).forEach((col) => {
    CARDS.filter((c) => current.cards[c.id].col === col).forEach((c, i) => (slot[c.id] = i))
  })

  return (
    <div className="relative">
      <div className="grain relative overflow-hidden rounded-[22px] border border-line bg-surface p-3 shadow-[0_30px_80px_-30px_rgba(40,40,90,0.35)] sm:p-4">
        {/* window chrome */}
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 text-xs font-medium text-muted">Release 4.2 · Engineering</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {COLUMNS.map((c) => (
            <div key={c} className="rounded-xl bg-surface-2/70 px-2 pt-2 pb-1 text-[11px] font-semibold text-muted">
              {c}
            </div>
          ))}
        </div>

        {/* cards are absolutely positioned and jump between slots on stepped frames */}
        {/* no column ever holds more than three cards */}
        <div className="relative mt-2" style={{ height: ROW * 3 + 4 }}>
          {CARDS.map((card) => {
            const s = current.cards[card.id]
            const tone = TONE[s.tone]
            const style = {
              width: 'calc((100% - 1rem) / 3)',
              transform: `translate(calc(${s.col} * (100% + 0.5rem)), ${slot[card.id]! * ROW}px) rotate(${s.tone === 'blocked' ? -1.5 : 0}deg)`,
            } as CSSProperties
            return (
              <div key={card.id} style={style} className={cn('stop-move absolute top-0 left-0 rounded-lg border bg-surface p-2 shadow-sm', tone.card)}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[9px] text-muted">{card.key}</span>
                  <span className={cn('size-4 shrink-0 rounded-full text-center text-[7px] leading-4 font-bold text-white', card.color)}>{card.who}</span>
                </div>
                <p className="mt-1 truncate text-[11px] leading-tight font-medium sm:text-xs">{card.title}</p>
                <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded px-1 py-px text-[9px] font-semibold', tone.chip)}>
                  {s.tone === 'blocked' && <AlertTriangle className="size-2.5" />}
                  {s.tone === 'waiting' && <Hourglass className="size-2.5" />}
                  {s.tone === 'done' && <Check className="size-2.5" />}
                  {tone.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* what management sees, rewritten every frame */}
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent-soft/60 p-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-wider text-accent uppercase">What the manager sees</p>
            <p key={frame} className="animate-enter text-sm leading-snug">
              {current.note}
            </p>
          </div>
        </div>
      </div>

      {/* frame counter, like a film strip */}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
        {FRAMES.map((_, i) => (
          <span key={i} className={cn('h-1 rounded-full transition-all duration-300', i === frame ? 'w-6 bg-accent' : 'w-2 bg-line')} />
        ))}
      </div>

      {frame === 2 && (
        <div className="pointer-events-none absolute top-[42%] -right-3 hidden animate-pop sm:block lg:-right-10">
          <HandNote tilt={4} className="text-rose-500">
            ← said out loud,
            <br />
            not buried in chat
          </HandNote>
        </div>
      )}
    </div>
  )
}
