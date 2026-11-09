import { AlertTriangle, Hourglass } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { HandNote, Reveal } from './motion'

type Part = 'status' | 'progress' | 'blocker' | 'dependency'

const PARTS: { id: Part; q: string; label: string; body: string; note: string }[] = [
  {
    id: 'status',
    q: 'Where is it?',
    label: 'Status',
    body: 'Draft, ready, in progress, blocked, in review, done. A task can only move along paths that make sense. Nobody jumps from draft straight to done.',
    note: 'one honest word',
  },
  {
    id: 'progress',
    q: 'How far along?',
    label: 'Progress',
    body: "Separate from status, because \"in progress\" at 10% and at 90% are very different conversations. The owner moves the slider; nobody guesses.",
    note: 'owner sets this',
  },
  {
    id: 'blocker',
    q: "What's in the way?",
    label: 'Blocker',
    body: "Something actually stopping the work right now, like an approval that hasn't come. It has an owner who can clear it, and it's visible to everyone it affects.",
    note: 'has a name + an owner',
  },
  {
    id: 'dependency',
    q: 'What does it wait for?',
    label: 'Dependency',
    body: "Work that has to finish first. That's not a problem, it's just the order of things. Coop holds the task back until its turn, then says so.",
    note: 'planned, not a problem',
  },
]

export function TaskAnatomy() {
  const [active, setActive] = useState<Part>('status')
  const [auto, setAuto] = useState(true)

  // Gently cycles until the visitor takes over.
  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => setActive((a) => PARTS[(PARTS.findIndex((p) => p.id === a) + 1) % PARTS.length]!.id), 3200)
    return () => window.clearInterval(id)
  }, [auto])

  const ring = (part: Part) =>
    cn('relative rounded-lg transition-all duration-300', active === part ? 'bg-accent-soft/70 ring-2 ring-accent ring-offset-4 ring-offset-surface' : 'opacity-70')
  const current = PARTS.find((p) => p.id === active)!

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <Reveal>
          <p className="text-sm font-semibold text-accent">The four questions</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Every task should answer four questions. <span className="italic text-muted">Most tools squash them into one.</span>
          </h2>
        </Reveal>

        <div className="mt-8 space-y-2" role="tablist" aria-label="Parts of a task">
          {PARTS.map((p, i) => (
            <Reveal key={p.id} delay={120 + i * 70}>
              <button
                role="tab"
                aria-selected={active === p.id}
                onClick={() => {
                  setAuto(false)
                  setActive(p.id)
                }}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-all duration-300',
                  active === p.id ? 'border-accent/40 bg-surface shadow-md' : 'border-transparent hover:bg-surface/60',
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{p.q}</span>
                  <span className={cn('text-xs font-medium', active === p.id ? 'text-accent' : 'text-muted')}>{p.label}</span>
                </div>
                <div className={cn('grid transition-all duration-500', active === p.id ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <p className="overflow-hidden text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* the sample task, with the active part circled */}
      <Reveal variant="stop" tilt={-1.2}>
        <div className="grain relative mx-auto max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-[0_30px_80px_-35px_rgba(40,40,90,0.4)]">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-mono">REL-2</span>
            <span>Engineering · Release 4.2</span>
          </div>
          <h3 className="mt-2 text-xl font-semibold">Consolidated report</h3>
          <p className="mt-1 text-sm text-muted">Owner: Ravi K. · Reviewer: Kavya N. · Due Friday</p>

          <div className="mt-6 space-y-5">
            <div className={ring('status')}>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                <span className="size-1.5 rounded-full bg-rose-500" /> Blocked
              </span>
            </div>
            <div className={ring('progress')}>
              <div className="flex justify-between text-xs">
                <span className="text-muted">Progress</span>
                <span className="font-semibold">60%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-3/5 rounded-full bg-accent" />
              </div>
            </div>
            <div className={ring('blocker')}>
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 text-sm dark:border-rose-900 dark:bg-rose-950/20">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                <span>
                  Revised Q3 figures from finance
                  <span className="block text-xs text-muted">Neha can clear this</span>
                </span>
              </div>
            </div>
            <div className={ring('dependency')}>
              <div className="flex items-center gap-2 text-sm">
                <Hourglass className="size-4 text-muted" />
                <span className="text-muted">After</span>
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">REL-1 QA sign-off ✓</span>
              </div>
            </div>
          </div>

          <div key={active} className="pointer-events-none absolute -right-2 -bottom-8 animate-pop sm:-right-12">
            <HandNote tilt={-5}>↖ {current.note}</HandNote>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
