import { Bot, Cog, User } from 'lucide-react'
import { EVENT_LABELS, STATUS_META } from '@/lib/status'
import type { TaskDetail, TaskEvent } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

/** Immutable event history: every change to the task, who made it and why. */
export default function HistoryTimeline({ detail }: { detail: TaskDetail }) {
  const { events, people } = detail
  if (events.length === 0) return <p className="text-sm text-muted">No events yet.</p>

  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {events.map((e) => {
        const actor = e.actor_id ? (people[e.actor_id]?.full_name ?? people[e.actor_id]?.email ?? 'Someone') : null
        return (
          <li key={e.id} className="relative animate-fade">
            <span className="absolute top-1 -left-[21px] flex size-2.5 items-center justify-center rounded-full bg-surface ring-2 ring-line">
              <span className={`size-1.5 rounded-full ${e.to_status ? STATUS_META[e.to_status].dot : 'bg-muted'}`} />
            </span>
            <p className="text-sm leading-snug">
              <ActorIcon kind={e.actor_kind} />
              {e.actor_kind === 'system' ? <span className="text-muted">{describe(e)}</span> : (
                <>
                  <span className="font-medium">{actor ?? 'System'}</span> {describe(e)}
                </>
              )}
            </p>
            {e.reason && <p className="mt-0.5 text-xs text-muted italic">“{e.reason}”</p>}
            <time className="text-[11px] text-muted" dateTime={e.created_at} title={new Date(e.created_at).toLocaleString()}>
              {timeAgo(e.created_at)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}

function describe(e: TaskEvent) {
  const base = EVENT_LABELS[e.event_type] ?? e.event_type.replaceAll('_', ' ')
  const p = e.payload as Record<string, string | number | undefined>
  if ((e.event_type === 'status_changed' || e.event_type === 'reopened') && e.to_status)
    return `${base}: ${e.from_status ? STATUS_META[e.from_status].label : ''} → ${STATUS_META[e.to_status].label}`
  if (e.event_type === 'progress_updated') return `${base}: ${p.from}% → ${p.to}%`
  if (e.event_type.startsWith('blocker_') && p.title) return `${base}: “${p.title}”`
  if (e.event_type.startsWith('dependency_') && p.predecessor_title) return `${base}: ${p.predecessor_title}`
  return base
}

function ActorIcon({ kind }: { kind: TaskEvent['actor_kind'] }) {
  const Icon = kind === 'ai' || kind === 'agent' ? Bot : kind === 'system' ? Cog : User
  return <Icon className="mr-1 inline size-3 -translate-y-px text-muted" />
}
