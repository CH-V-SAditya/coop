import { ArrowRight, ChevronRight, Hourglass, Pencil, Trash2 } from 'lucide-react'
import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageSkeleton, Skeleton, StatusBadge, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { useTask } from '@/lib/queries'
import { PRIORITY_META, STATUS_META } from '@/lib/status'
import type { TaskDetail, TransitionOption } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DetailsPanel } from './DetailsPanel'
import { BlockersPanel, CommentsPanel, DependenciesPanel, SubtasksPanel } from './TaskPanels'
import { useTaskAction } from './useTaskAction'

// History can be long; load it on demand.
const HistoryTimeline = lazy(() => import('./HistoryTimeline'))

export default function TaskPage() {
  const { taskId = '' } = useParams()
  const { data, isLoading, error } = useTask(taskId)

  if (isLoading) return <PageSkeleton />
  if (error || !data)
    return (
      <div className="p-6">
        <ErrorNote error={error ?? 'Task not found'} />
      </div>
    )

  return <TaskView key={data.task.id} detail={data} />
}

function TaskView({ detail }: { detail: TaskDetail }) {
  const { task } = detail
  const waiting = task.unmet_dependency_count > 0 && (task.status === 'draft' || task.status === 'ready')

  return (
    <div className="mx-auto max-w-6xl p-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to={`/groups/${detail.group.id}`} className="hover:text-fg">
          {detail.group.name}
        </Link>
        {detail.parent && (
          <>
            <ChevronRight className="size-3.5" />
            <Link to={`/tasks/${detail.parent.id}`} className="hover:text-fg">
              {detail.parent.task_key}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="font-mono text-fg">{task.task_key}</span>
      </nav>

      <TitleBlock detail={detail} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <Badge className={cn('bg-surface-2', PRIORITY_META[task.priority].tone)}>{PRIORITY_META[task.priority].label} priority</Badge>
        {waiting && (
          <Badge className="bg-surface-2 text-muted">
            <Hourglass className="size-3" /> Waiting on {task.unmet_dependency_count} prerequisite{task.unmet_dependency_count > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <TransitionBar detail={detail} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <DescriptionCard detail={detail} />
          <SubtasksPanel detail={detail} />
          <DependenciesPanel detail={detail} />
          <BlockersPanel detail={detail} />
          <CommentsPanel detail={detail} />
        </div>
        <aside className="space-y-6">
          <DetailsPanel detail={detail} />
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">History</h2>
            <Suspense fallback={<Skeleton className="h-32" />}>
              <HistoryTimeline detail={detail} />
            </Suspense>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function TitleBlock({ detail }: { detail: TaskDetail }) {
  const { task, can } = detail
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const { run, pending, error } = useTaskAction(detail)

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const title = String(new FormData(e.currentTarget).get('title')).trim()
    if (title && title !== task.title) {
      const ok = await run('title', () => api.patch(`/tasks/${task.id}`, { title, expected_version: task.version }))
      if (!ok) return
    }
    setEditing(false)
  }

  const remove = async () => {
    if (!confirm(`Delete ${task.task_key}? This cannot be undone.`)) return
    const ok = await run('delete', () => api.del(`/tasks/${task.id}`))
    if (ok) navigate(`/groups/${detail.group.id}`, { replace: true })
  }

  return (
    <div>
      {editing ? (
        <form onSubmit={save} className="flex gap-2">
          <Input name="title" defaultValue={task.title} autoFocus maxLength={200} className="text-lg font-semibold" />
          <Button type="submit" loading={pending === 'title'}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="group flex items-start gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
          {can.edit && (
            <button onClick={() => setEditing(true)} className="mt-1.5 rounded p-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg" title="Rename">
              <Pencil className="size-4" />
            </button>
          )}
          {can.delete && (
            <button onClick={remove} className="mt-1.5 ml-auto rounded p-1 text-muted hover:text-rose-600" title="Delete task">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  )
}

/** The lifecycle actions this person may take now (Postgres re-validates every one). */
function TransitionBar({ detail }: { detail: TaskDetail }) {
  const { task, transitions } = detail
  const { run, pending, error } = useTaskAction(detail)
  const [needsReason, setNeedsReason] = useState<TransitionOption | null>(null)

  const go = (t: TransitionOption, reason?: string) =>
    run(t.to, () => api.post(`/tasks/${task.id}/transition`, { to: t.to, reason, expected_version: task.version }))

  if (transitions.length === 0) return null
  const forward = transitions.filter((t) => t.to !== 'cancelled')
  const cancel = transitions.find((t) => t.to === 'cancelled')

  return (
    <Card className="mt-5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {forward.map((t, i) => (
          <span key={t.to} title={t.disabledReason ?? t.condition}>
            <Button
              size="sm"
              variant={i === 0 && !t.disabledReason ? 'primary' : 'secondary'}
              disabled={Boolean(t.disabledReason)}
              loading={pending === t.to}
              onClick={() => (t.requiresReason ? setNeedsReason(t) : go(t))}
            >
              {t.label}
              <ArrowRight className="size-3.5 opacity-60" />
              <span className="text-xs opacity-75">{STATUS_META[t.to].label}</span>
            </Button>
          </span>
        ))}
        {cancel && (
          <Button size="sm" variant="ghost" className="ml-auto hover:text-rose-600" onClick={() => setNeedsReason(cancel)}>
            Cancel task
          </Button>
        )}
      </div>
      {forward.some((t) => t.disabledReason) && (
        <p className="mt-2 text-xs text-muted">{forward.find((t) => t.disabledReason)?.disabledReason}</p>
      )}
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>

      <Modal open={Boolean(needsReason)} onClose={() => setNeedsReason(null)} title={needsReason?.label ?? ''}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const reason = String(new FormData(e.currentTarget).get('reason')).trim()
            if (needsReason && (await go(needsReason, reason))) setNeedsReason(null)
          }}
        >
          <Field label="Reason" hint="Recorded permanently in the task's history.">
            <Textarea name="reason" required autoFocus maxLength={2000} />
          </Field>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setNeedsReason(null)}>
              Back
            </Button>
            <Button type="submit" variant={needsReason?.to === 'cancelled' ? 'danger' : 'primary'} loading={Boolean(pending)}>
              {needsReason?.label}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

function DescriptionCard({ detail }: { detail: TaskDetail }) {
  const { task, can } = detail
  const [editing, setEditing] = useState(false)
  const { run, pending, error } = useTaskAction(detail)

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const ok = await run('desc', () =>
      api.patch(`/tasks/${task.id}`, {
        description: String(f.get('description')).trim() || null,
        acceptance_criteria: String(f.get('acceptance_criteria')).trim() || null,
        expected_version: task.version,
      }),
    )
    if (ok) setEditing(false)
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Description</h2>
        {can.edit && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <Textarea name="description" defaultValue={task.description ?? ''} rows={6} />
          <Field label="Definition of done">
            <Textarea name="acceptance_criteria" defaultValue={task.acceptance_criteria ?? ''} rows={3} />
          </Field>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending === 'desc'}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 text-sm leading-relaxed">
          <p className={cn('whitespace-pre-wrap', !task.description && 'text-muted')}>{task.description || 'No description yet.'}</p>
          {task.acceptance_criteria && (
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Definition of done</h3>
              <p className="whitespace-pre-wrap">{task.acceptance_criteria}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
