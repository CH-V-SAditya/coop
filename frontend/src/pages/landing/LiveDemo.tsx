import { AlertTriangle, ArrowRight, Check, CornerDownLeft, Hash, Hourglass, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Status = 'draft' | 'in_progress' | 'blocked' | 'in_review' | 'completed'
type Stage = 'start' | 'thinking' | 'suggested' | 'dismissed' | 'blocked' | 'resumed' | 'review' | 'done'

type Task = { key: string; title: string; owner: string; initials: string; color: string; status: Status; progress: number; waitingOn?: string }

const INITIAL: Record<string, Task> = {
  qa: { key: 'REL-1', title: 'QA sign-off', owner: 'Meera', initials: 'MI', color: 'bg-sky-500', status: 'completed', progress: 100 },
  report: { key: 'REL-2', title: 'Consolidated report', owner: 'Ravi', initials: 'RK', color: 'bg-indigo-500', status: 'in_progress', progress: 60 },
  schedule: { key: 'REL-3', title: 'Deployment schedule', owner: 'Arjun', initials: 'AS', color: 'bg-amber-500', status: 'draft', progress: 0, waitingOn: 'REL-2' },
  approve: { key: 'REL-4', title: 'Approve go-live', owner: 'Kavya', initials: 'KN', color: 'bg-emerald-500', status: 'draft', progress: 0, waitingOn: 'REL-3' },
}

const CHIP: Record<Status, { label: string; cls: string }> = {
  draft: { label: 'Yet to start', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  in_progress: { label: 'In progress', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' },
  blocked: { label: 'Blocked', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  in_review: { label: 'In review', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  completed: { label: 'Done', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
}

type Msg = { who: string; initials: string; color: string; text: string }
const OPENING: Msg[] = [
  { who: 'Meera', initials: 'MI', color: 'bg-sky-500', text: 'QA is signed off. Over to you, Ravi.' },
  { who: 'Ravi', initials: 'RK', color: 'bg-indigo-500', text: "Thanks! Report's about 60% there." },
]
const RAVI_LINE = "Can't close the report until finance sends the revised Q3 figures."

type LogItem = { id: number; text: string; tone: 'neutral' | 'bad' | 'good' | 'ai' }

export function LiveDemo() {
  const [tasks, setTasks] = useState(INITIAL)
  const [stage, setStage] = useState<Stage>('start')
  const [messages, setMessages] = useState<Msg[]>(OPENING)
  const [log, setLog] = useState<LogItem[]>([{ id: 1, text: 'Meera moved REL-1 to Done', tone: 'good' }])
  const [flash, setFlash] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const nextId = useRef(2)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const addLog = (...items: Omit<LogItem, 'id'>[]) => setLog((l) => [...items.map((i) => ({ ...i, id: nextId.current++ })).reverse(), ...l].slice(0, 6))
  const patch = (id: string, change: Partial<Task>) => {
    setTasks((t) => ({ ...t, [id]: { ...t[id]!, ...change } }))
    setFlash(id)
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 700)
  }

  const send = () => {
    setMessages((m) => [...m, { who: 'Ravi', initials: 'RK', color: 'bg-indigo-500', text: RAVI_LINE }])
    setStage('thinking')
    timer.current = window.setTimeout(() => {
      setStage('suggested')
      addLog({ text: 'Coop flagged a possible blocker on REL-2', tone: 'ai' })
    }, 1500)
  }

  const confirm = () => {
    patch('report', { status: 'blocked' })
    setStage('blocked')
    addLog({ text: 'Ravi confirmed the blocker', tone: 'bad' }, { text: 'REL-2: In progress → Blocked', tone: 'bad' })
  }

  const dismiss = () => {
    setStage('dismissed')
    addLog({ text: 'Ravi dismissed the suggestion. Nothing changed.', tone: 'neutral' })
  }

  const resolve = () => {
    setMessages((m) => [...m, { who: 'Neha', initials: 'NB', color: 'bg-rose-500', text: 'Revised figures are in the shared drive. Sorry for the wait!' }])
    patch('report', { status: 'in_progress', progress: 85 })
    setStage('resumed')
    addLog({ text: 'Neha resolved the blocker', tone: 'good' }, { text: 'REL-2: Blocked → In progress', tone: 'neutral' })
  }

  const submit = () => {
    patch('report', { status: 'in_review', progress: 100 })
    setStage('review')
    addLog({ text: 'Ravi submitted REL-2 for review', tone: 'neutral' })
  }

  const accept = () => {
    patch('report', { status: 'completed' })
    setTasks((t) => ({ ...t, schedule: { ...t.schedule!, waitingOn: undefined } }))
    setStage('done')
    addLog({ text: 'Kavya accepted REL-2', tone: 'good' }, { text: 'REL-3 has everything it needs. Arjun can start.', tone: 'ai' })
  }

  const reset = () => {
    window.clearTimeout(timer.current)
    setTasks(INITIAL)
    setMessages(OPENING)
    setStage('start')
    setLog([{ id: nextId.current++, text: 'Meera moved REL-1 to Done', tone: 'good' }])
  }

  const done = Object.values(tasks).filter((t) => t.status === 'completed').length
  const summary =
    stage === 'blocked'
      ? `${done} of 4 done. The report is blocked on finance's Q3 figures, and the schedule and go-live are queued behind it.`
      : stage === 'done'
        ? `${done} of 4 done. The schedule is clear to start. Nothing is blocked.`
        : stage === 'review'
          ? `${done} of 4 done. The report is with Kavya for review.`
          : `${done} of 4 done. The report is moving (${tasks.report!.progress}%). Nothing is blocked.`

  return (
    <div className="grain relative grid overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_40px_100px_-40px_rgba(40,40,90,0.4)] lg:grid-cols-[1.1fr_1fr]">
      {/* ---------------------------------------------------- board side */}
      <div className="border-b border-line p-5 sm:p-7 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">Release 4.2 board</p>
          <button onClick={reset} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <RotateCcw className="size-3" /> Start over
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {Object.entries(tasks).map(([id, t]) => (
            <li
              key={id}
              className={cn(
                'rounded-xl border bg-surface p-3 transition-colors duration-300',
                t.status === 'blocked' ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/20' : 'border-line',
                flash === id && 'animate-pop',
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', t.color)}>{t.initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="mr-1.5 font-mono text-[11px] text-muted">{t.key}</span>
                    {t.title}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', CHIP[t.status].cls)}>
                    {t.status === 'blocked' && <AlertTriangle className="mr-0.5 inline size-2.5 -translate-y-px" />}
                    {CHIP[t.status].label}
                  </span>
                  {t.waitingOn ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted">
                      <Hourglass className="size-2.5" /> waits on {t.waitingOn}
                    </span>
                  ) : id === 'schedule' && t.status === 'draft' ? (
                    <span className="animate-pop text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">ready to start</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* manager summary */}
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent-soft/50 p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-accent uppercase">
            <Sparkles className="size-3" /> Status for management
          </p>
          <p key={summary} className="mt-1 animate-enter text-sm leading-snug">
            {summary}
          </p>
        </div>

        {/* history */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">History · can't be edited</p>
          <ol className="mt-2 space-y-1.5">
            {log.map((item) => (
              <li key={item.id} className="flex animate-enter items-center gap-2 text-xs">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    item.tone === 'bad' && 'bg-rose-500',
                    item.tone === 'good' && 'bg-emerald-500',
                    item.tone === 'ai' && 'bg-violet-500',
                    item.tone === 'neutral' && 'bg-zinc-400',
                  )}
                />
                <span className="text-muted">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ---------------------------------------------------- conversation side */}
      <div className="flex min-h-[520px] flex-col bg-surface-2/40 p-5 sm:p-7">
        <p className="flex items-center gap-1 text-sm font-semibold">
          <Hash className="size-4 text-muted" /> release-4-2
        </p>

        <div className="mt-4 flex-1 space-y-3" data-lenis-prevent>
          {messages.map((m, i) => (
            <div key={i} className="flex animate-enter gap-2.5">
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', m.color)}>{m.initials}</span>
              <div>
                <p className="text-xs font-semibold">{m.who}</p>
                <p className="text-sm leading-snug">{m.text}</p>
              </div>
            </div>
          ))}

          {stage === 'thinking' && (
            <div className="flex animate-fade items-center gap-2 pl-9 text-xs text-muted">
              <Sparkles className="size-3.5 animate-pulse text-violet-500" /> Coop is reading the thread…
            </div>
          )}

          {(stage === 'suggested' || stage === 'dismissed') && (
            <div className={cn('ml-9 animate-pop rounded-xl border border-violet-300/70 bg-surface p-3.5 shadow-sm dark:border-violet-900', stage === 'dismissed' && 'opacity-50')}>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-violet-600 uppercase dark:text-violet-400">
                <Sparkles className="size-3" /> Possible blocker · needs a human
              </p>
              <dl className="mt-2 grid grid-cols-[92px_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="text-muted">Blocker</dt>
                <dd className={cn('font-medium', stage === 'dismissed' && 'line-through')}>Revised Q3 figures from finance</dd>
                <dt className="text-muted">Affects</dt>
                <dd>REL-2 Consolidated report</dd>
                <dt className="text-muted">Type</dt>
                <dd>Missing information</dd>
                <dt className="text-muted">Who can fix it</dt>
                <dd>Neha (Finance)</dd>
                <dt className="text-muted">Knock-on</dt>
                <dd>REL-3 schedule, REL-4 go-live</dd>
              </dl>
              {stage === 'suggested' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={confirm} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition hover:brightness-110 active:scale-95">
                    <Check className="size-3.5" /> Yes, it's blocking me
                  </button>
                  <button onClick={dismiss} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2 active:scale-95">
                    <X className="size-3.5" /> Not really
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'dismissed' && (
            <p className="ml-9 animate-enter text-xs text-muted">
              Fine by Coop. Nothing on the board changed, because nobody confirmed it.{' '}
              <button onClick={() => setStage('suggested')} className="font-medium text-accent underline-offset-2 hover:underline">
                Try the other answer
              </button>
            </p>
          )}
        </div>

        {/* composer / next step */}
        <div className="mt-4">
          {stage === 'start' ? (
            <div className="rounded-xl border border-line bg-surface p-2.5">
              <p className="px-1 text-sm text-fg/90">{RAVI_LINE}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="px-1 text-[11px] text-muted">You're typing as Ravi</span>
                <button onClick={send} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg shadow-sm transition hover:brightness-110 active:scale-95">
                  Send <CornerDownLeft className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <NextStep stage={stage} onResolve={resolve} onSubmit={submit} onAccept={accept} onReset={reset} />
          )}
        </div>
      </div>
    </div>
  )
}

function NextStep({ stage, onResolve, onSubmit, onAccept, onReset }: { stage: Stage; onResolve: () => void; onSubmit: () => void; onAccept: () => void; onReset: () => void }) {
  const step = {
    blocked: { hint: 'A few hours later, finance comes through.', label: 'Neha sends the figures', run: onResolve },
    resumed: { hint: 'Ravi wraps up the report.', label: 'Submit for review', run: onSubmit },
    review: { hint: 'Kavya is the reviewer on this one.', label: 'Accept as Kavya', run: onAccept },
    done: { hint: 'The schedule just unlocked itself. Nobody had to chase anyone.', label: 'Play it again', run: onReset },
  }[stage as 'blocked' | 'resumed' | 'review' | 'done']

  if (!step) return <p className="text-center text-xs text-muted">Waiting on you…</p>
  return (
    <div className="flex animate-enter flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line p-3">
      <span className="text-xs text-muted">{step.hint}</span>
      <button onClick={step.run} className="flex items-center gap-1.5 rounded-lg bg-fg px-3 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 active:scale-95">
        {step.label} <ArrowRight className="size-3.5" />
      </button>
    </div>
  )
}
