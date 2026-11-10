import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Link2, Plus, Send, ShieldAlert, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { NewTaskModal } from './NewTaskModal'
import { TaskRow } from './TaskRow'
import { Avatar, Badge, Button, Card, ErrorNote, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { useBoard } from '@/lib/queries'
import { BLOCKER_CATEGORIES, BLOCKER_STATUS_META } from '@/lib/status'
import type { Blocker, TaskDetail } from '@/lib/types'
import { timeAgo, memberLabel } from '@/lib/utils'
import { useTaskAction } from './useTaskAction'

function Panel({ title, icon, action, children, hint }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <Card className="p-2">
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {hint && <p className="px-3 pb-2 text-xs text-muted">{hint}</p>}
      {children}
    </Card>
  )
}

/* ------------------------------------------------------------------ Subtasks */

export function SubtasksPanel({ detail }: { detail: TaskDetail }) {
  const [open, setOpen] = useState(false)
  const done = detail.subtasks.filter((s) => s.status === 'completed').length
  if (detail.subtasks.length === 0 && !detail.can.createSubtask) return null

  return (
    <Panel
      title={`Subtasks${detail.subtasks.length ? ` · ${done}/${detail.subtasks.length}` : ''}`}
      action={
        detail.can.createSubtask && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> Add subtask
          </Button>
        )
      }
    >
      {detail.subtasks.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted">Break this task into smaller pieces that can be owned and updated independently.</p>
      ) : (
        detail.subtasks.map((s) => <TaskRow key={s.id} task={s} />)
      )}
      <NewTaskModal
        open={open}
        onClose={() => setOpen(false)}
        groupId={detail.group.id}
        members={detail.members}
        viewer={detail.viewer}
        parent={{ id: detail.task.id, title: detail.task.title }}
      />
    </Panel>
  )
}

/* ------------------------------------------------------------------ Dependencies */

export function DependenciesPanel({ detail }: { detail: TaskDetail }) {
  const { task, can } = detail
  const [adding, setAdding] = useState(false)
  const { run, pending, error } = useTaskAction(detail)

  const remove = (id: string) => run(`rm-${id}`, () => api.del(`/dependencies/${id}`))

  return (
    <Panel
      title="Dependencies"
      icon={<Link2 className="size-4 text-muted" />}
      hint="Finish-to-start: this task can't become ready until every prerequisite is completed."
      action={
        can.edit &&
        task.status !== 'cancelled' && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add prerequisite
          </Button>
        )
      }
    >
      <SubHeading icon={<ArrowDownToLine className="size-3" />}>Waiting on</SubHeading>
      {detail.dependencies.length === 0 ? (
        <p className="px-3 pb-2 text-sm text-muted">No prerequisites.</p>
      ) : (
        detail.dependencies.map(
          (d) =>
            d.task && (
              <TaskRow
                key={d.id}
                task={d.task}
                action={
                  can.edit && (
                    <button onClick={() => remove(d.id)} disabled={pending === `rm-${d.id}`} className="rounded p-1 text-muted hover:bg-surface hover:text-rose-600" title="Remove link">
                      <X className="size-3.5" />
                    </button>
                  )
                }
              />
            ),
        )
      )}

      {detail.dependents.length > 0 && (
        <>
          <SubHeading icon={<ArrowUpFromLine className="size-3" />}>Blocking these tasks until done</SubHeading>
          {detail.dependents.map((d) => d.task && <TaskRow key={d.id} task={d.task} />)}
        </>
      )}
      <div className="px-3 pb-2">
        <ErrorNote error={error} />
      </div>
      {adding && <AddDependencyModal detail={detail} onClose={() => setAdding(false)} />}
    </Panel>
  )
}

function SubHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <h3 className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{icon}{children}</h3>
}

function AddDependencyModal({ detail, onClose }: { detail: TaskDetail; onClose: () => void }) {
  const { data: board } = useBoard(detail.group.id)
  const { run, pending, error } = useTaskAction(detail)
  const linked = new Set([detail.task.id, ...detail.dependencies.map((d) => d.task?.id)])
  const candidates = (board ?? []).filter((t) => !linked.has(t.id) && t.status !== 'cancelled')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const predecessor_id = String(new FormData(e.currentTarget).get('predecessor_id'))
    const ok = await run('add-dep', () => api.post(`/tasks/${detail.task.id}/dependencies`, { predecessor_id }))
    if (ok) onClose()
  }

  return (
    <Modal open onClose={onClose} title="Add a prerequisite">
      <form onSubmit={submit} className="space-y-4">
        <Field label={`"${detail.task.title}" can start after…`} hint="Links that would create a cycle (A waits on B waits on A) are rejected.">
          <Select name="predecessor_id" required>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.task_key} · {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending === 'add-dep'} disabled={candidates.length === 0}>
            Add prerequisite
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ Blockers */

export function BlockersPanel({ detail }: { detail: TaskDetail }) {
  const { task } = detail
  const [reporting, setReporting] = useState(false)
  const open = detail.blockers.filter((b) => ['potential', 'reported', 'confirmed'].includes(b.status))
  const closed = detail.blockers.filter((b) => !open.includes(b))
  const canReport = (detail.viewer.isGroupMember || detail.viewer.isGroupAdmin) && task.status !== 'completed' && task.status !== 'cancelled'

  return (
    <Panel
      title={`Blockers${open.length ? ` · ${open.length} open` : ''}`}
      icon={<ShieldAlert className="size-4 text-muted" />}
      hint="A blocker is an actual impediment (not a dependency). Confirming one blocks the task; resolving the last one resumes it."
      action={
        canReport && (
          <Button size="sm" variant="secondary" onClick={() => setReporting(true)}>
            <AlertTriangle className="size-3.5" /> Report blocker
          </Button>
        )
      }
    >
      <div className="space-y-2 px-2 pb-2">
        {detail.blockers.length === 0 && <p className="px-1 py-2 text-sm text-muted">Nothing is blocking this task.</p>}
        {open.map((b) => (
          <BlockerItem key={b.id} blocker={b} detail={detail} />
        ))}
        {closed.length > 0 && (
          <details className="group px-1 pt-1">
            <summary className="cursor-pointer text-xs text-muted select-none hover:text-fg">{closed.length} resolved / dismissed</summary>
            <div className="mt-2 space-y-2">
              {closed.map((b) => (
                <BlockerItem key={b.id} blocker={b} detail={detail} />
              ))}
            </div>
          </details>
        )}
      </div>
      {reporting && <ReportBlockerModal detail={detail} onClose={() => setReporting(false)} />}
    </Panel>
  )
}

function BlockerItem({ blocker: b, detail }: { blocker: Blocker; detail: TaskDetail }) {
  const { run, pending, error } = useTaskAction(detail)
  const meta = BLOCKER_STATUS_META[b.status]
  const isOpen = ['potential', 'reported', 'confirmed'].includes(b.status)
  const manage = detail.can.manageBlockers
  const isReporter = b.reported_by === detail.viewer.userId
  const reporter = b.reported_by ? detail.people[b.reported_by] : null
  const category = BLOCKER_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category

  const act = (action: 'confirm' | 'resolve' | 'dismiss') => {
    const note = action === 'confirm' ? undefined : (prompt(action === 'resolve' ? 'How was it resolved? (optional)' : 'Why is this not a blocker? (optional)') ?? undefined)
    run(action, () => api.post(`/blockers/${b.id}/${action}`, { note }))
  }

  return (
    <div className={`animate-enter rounded-lg border p-3 ${b.status === 'confirmed' ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{b.title}</span>
        <Badge className={meta.tone} title={meta.hint}>
          {meta.label}
        </Badge>
        <Badge className="bg-surface-2 text-muted">{category}</Badge>
        {b.source === 'ai_inferred' && <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">AI</Badge>}
      </div>
      {b.description && <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted">{b.description}</p>}
      {b.downstream_impact && (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-fg">Downstream impact:</span> {b.downstream_impact}
        </p>
      )}
      {b.resolution_note && <p className="mt-1 text-xs text-muted italic">“{b.resolution_note}”</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted">
          {reporter ? `${reporter.full_name ?? reporter.email}, ` : ''}
          {timeAgo(b.created_at)}
        </span>
        {isOpen && (
          <div className="ml-auto flex gap-1">
            {manage && b.status !== 'confirmed' && (
              <Button size="sm" variant="secondary" loading={pending === 'confirm'} onClick={() => act('confirm')}>
                Confirm
              </Button>
            )}
            {(manage || isReporter) && (
              <Button size="sm" variant="secondary" loading={pending === 'resolve'} onClick={() => act('resolve')}>
                <CheckCircle2 className="size-3.5" /> Resolve
              </Button>
            )}
            {manage && (
              <Button size="sm" variant="ghost" loading={pending === 'dismiss'} onClick={() => act('dismiss')}>
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
      <ErrorNote error={error} />
    </div>
  )
}

function ReportBlockerModal({ detail, onClose }: { detail: TaskDetail; onClose: () => void }) {
  const { run, pending, error } = useTaskAction(detail)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const s = (k: string) => String(f.get(k) ?? '').trim() || undefined
    const ok = await run('report', () =>
      api.post(`/tasks/${detail.task.id}/blockers`, {
        title: s('title'),
        category: s('category'),
        description: s('description'),
        downstream_impact: s('downstream_impact'),
        resolution_owner_id: s('resolution_owner_id') ?? null,
      }),
    )
    if (ok) onClose()
  }

  return (
    <Modal open onClose={onClose} title="Report a blocker">
      <form onSubmit={submit} className="space-y-4">
        <Field label="What is blocking you?">
          <Input name="title" required maxLength={200} placeholder="QA assessment review pending" autoFocus />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue="approval">
            {BLOCKER_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Details">
          <Textarea name="description" rows={3} placeholder="I can't finish the consolidated report until the QA assessment is reviewed." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who can resolve it? (optional)">
            <Select name="resolution_owner_id" defaultValue="">
              <option value="">Not sure</option>
              {detail.members.map((m) => (
                <option key={m.id} value={m.organisation_member_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Downstream impact (optional)">
            <Input name="downstream_impact" placeholder="Deployment scheduling" />
          </Field>
        </div>
        <p className="text-xs text-muted">The task owner or a group admin confirms it. Once confirmed, the task is marked blocked.</p>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending === 'report'}>
            Report blocker
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ Comments */

export function CommentsPanel({ detail }: { detail: TaskDetail }) {
  const { run, pending, error } = useTaskAction(detail)
  const [body, setBody] = useState('')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!body.trim()) return
    const ok = await run('comment', () => api.post(`/tasks/${detail.task.id}/comments`, { body }))
    if (ok) setBody('')
  }

  return (
    <Panel title={`Discussion${detail.comments.length ? ` · ${detail.comments.length}` : ''}`} hint="Later, the AI will read these comments and suggest updates (e.g. a possible blocker) for a human to confirm.">
      <div className="space-y-4 px-3 pb-3">
        {detail.comments.map((c) => {
          const who = c.author_id ? detail.people[c.author_id] : null
          return (
            <div key={c.id} className="flex animate-enter gap-3">
              <Avatar name={who?.full_name ?? who?.email} src={who?.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium">{who?.full_name ?? who?.email ?? 'Former member'}</span>{' '}
                  <span className="text-muted">{timeAgo(c.created_at)}</span>
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          )
        })}
        {detail.viewer.isGroupMember || detail.viewer.isGroupAdmin ? (
          <form onSubmit={submit} className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="min-h-0"
              placeholder="Share an update, ask a question…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
              }}
            />
            <Button type="submit" loading={pending === 'comment'} disabled={!body.trim()} title="Send (Ctrl+Enter)">
              <Send className="size-4" />
            </Button>
          </form>
        ) : null}
        <ErrorNote error={error} />
      </div>
    </Panel>
  )
}
