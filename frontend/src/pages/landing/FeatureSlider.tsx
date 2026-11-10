import { ArrowLeft, ArrowRight, Bot, Check, Eye, History, Link2, ShieldAlert, Users } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from './motion'

type Feature = { icon: ReactNode; title: string; body: string; tag?: string; art: ReactNode }

const FEATURES: Feature[] = [
  {
    icon: <ShieldAlert className="size-4" />,
    title: 'Blockers get said out loud',
    body: "When something's stuck, it gets a name, an owner and a way out. Not a thumbs-up emoji on a message nobody scrolled back to.",
    art: (
      <div className="space-y-1.5">
        {[
          ['Reported', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'],
          ['Confirmed', 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'],
          ['Resolved', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'],
        ].map(([label, cls], i) => (
          <div key={label} className="flex items-center gap-2" style={{ marginLeft: i * 14 }}>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', cls)}>{label}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <Link2 className="size-4" />,
    title: 'Work knows what comes first',
    body: "Link a task to the one it depends on. It waits until that's done, then tells its owner they're up. Loops get caught before they're saved.",
    art: (
      <div className="flex items-center gap-1.5 text-[10px] font-medium">
        <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">QA</span>
        <ArrowRight className="size-3 text-muted" />
        <span className="rounded-md bg-accent-soft px-2 py-1 text-accent-ink">Report</span>
        <ArrowRight className="size-3 text-muted" />
        <span className="rounded-md border border-dashed border-line px-2 py-1 text-muted">Schedule</span>
      </div>
    ),
  },
  {
    icon: <Users className="size-4" />,
    title: 'Roles the AI can work with',
    body: "Tag people as Frontend, Database, Finance, whatever fits. Coop uses those roles to split a goal into pieces. Leave one blank and it'll suggest one for you to approve.",
    art: (
      <div className="flex flex-wrap gap-1.5 text-[10px] font-medium">
        <span className="rounded-full bg-surface-2 px-2 py-1">Asha · Frontend</span>
        <span className="rounded-full bg-surface-2 px-2 py-1">Dev · Backend</span>
        <span className="flex items-center gap-1 rounded-full border border-dashed border-accent/60 px-2 py-1 text-accent-ink">
          Sam · role?
        </span>
      </div>
    ),
  },
  {
    icon: <History className="size-4" />,
    title: 'A history nobody can rewrite',
    body: 'Every status change is written down with who did it and why. When someone asks "when did this slip?", the answer takes five seconds.',
    art: (
      <ol className="space-y-1 border-l border-line pl-3 text-[10px]">
        <li className="text-muted">Mon · Ravi started the report</li>
        <li className="text-muted">Tue · Blocked on finance figures</li>
        <li className="font-medium">Wed · Unblocked, back in progress</li>
      </ol>
    ),
  },
  {
    icon: <Check className="size-4" />,
    title: '60% done and blocked are both true',
    body: "Status, progress, blockers and dependencies are kept apart, on purpose. You never have to pick one word that's half right.",
    art: (
      <div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-medium">Consolidated report</span>
          <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">Blocked</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-3/5 rounded-full bg-accent" />
        </div>
        <p className="mt-1 text-right text-[10px] text-muted">60%</p>
      </div>
    ),
  },
  {
    icon: <Eye className="size-4" />,
    title: 'Managers see work, not people',
    body: 'The manager view shows tasks and how they moved. No keystroke counts, no "last seen", no screenshots. Trust goes further than tracking.',
    art: (
      <div className="grid grid-cols-3 gap-1">
        {['bg-emerald-400', 'bg-emerald-400', 'bg-accent/70', 'bg-rose-400', 'bg-zinc-300 dark:bg-zinc-700', 'bg-zinc-300 dark:bg-zinc-700'].map((c, i) => (
          <span key={i} className={cn('h-4 rounded', c)} />
        ))}
      </div>
    ),
  },
  {
    icon: <Bot className="size-4" />,
    title: 'Bring your own AI',
    tag: 'Coming later',
    body: "Already pay for a model your team likes? You'll be able to plug it in, per person or per group. Coop keeps the rules, your agent does the legwork.",
    art: (
      <div className="flex items-center gap-2 text-[10px] font-medium">
        <span className="rounded-md border border-line px-2 py-1">Your agent</span>
        <ArrowRight className="size-3 text-muted" />
        <span className="rounded-md bg-accent-soft px-2 py-1 text-accent-ink">Coop rules</span>
        <ArrowRight className="size-3 text-muted" />
        <span className="rounded-md border border-line px-2 py-1">Board</span>
      </div>
    ),
  },
]

export function FeatureSlider() {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const [progress, setProgress] = useState(0)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = () => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 0)
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft > max - 8 })
  }

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const step = (dir: 1 | -1) => {
    const el = track.current
    const card = el?.querySelector<HTMLElement>('[data-card]')
    if (el && card) el.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: 'smooth' })
  }

  // Mouse drag-to-scroll (touch already scrolls natively).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !track.current) return
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false }
    track.current.style.scrollSnapType = 'none'
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !track.current) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) drag.current.moved = true
    track.current.scrollLeft = drag.current.left - dx
  }
  const endDrag = () => {
    if (!track.current) return
    track.current.style.scrollSnapType = ''
    drag.current = null
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <Reveal>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Small, stubborn ideas
              <br />
              <span className="italic text-muted">about how work should move.</span>
            </h2>
          </Reveal>
        </div>
        <div className="flex gap-2">
          <button onClick={() => step(-1)} disabled={edges.start} aria-label="Previous" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface transition hover:-translate-x-0.5 hover:border-accent/50 disabled:opacity-30">
            <ArrowLeft className="size-4" />
          </button>
          <button onClick={() => step(1)} disabled={edges.end} aria-label="Next" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface transition hover:translate-x-0.5 hover:border-accent/50 disabled:opacity-30">
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={track}
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1)
          if (e.key === 'ArrowLeft') step(-1)
        }}
        tabIndex={0}
        role="region"
        aria-label="Features"
        className="no-scrollbar -mx-4 flex cursor-grab snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 select-none active:cursor-grabbing sm:-mx-6 sm:px-6"
      >
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} variant="stop" delay={i * 90} className="shrink-0 snap-start">
            <article
              data-card
              className={cn(
                'group flex h-full w-[290px] flex-col rounded-[22px] border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1.5 hover:rotate-0 hover:border-accent/40 hover:shadow-xl sm:w-[330px]'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-accent-ink shadow-sm ring-1 ring-line transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  {f.icon}
                </span>
                {f.tag && <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[10px] font-medium text-muted">{f.tag}</span>}
              </div>
              <h3 className="mt-5 text-lg leading-snug font-semibold">{f.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{f.body}</p>
              <div className="mt-6 rounded-xl border border-line bg-surface p-3.5">{f.art}</div>
            </article>
          </Reveal>
        ))}
      </div>

      <div className="mx-auto mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${Math.max(12, progress * 100)}%` }} />
      </div>
    </div>
  )
}
