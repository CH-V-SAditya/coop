import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, GitBranch, Hourglass, Info, Plus } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Link, useOutletContext } from 'react-router'
import { NewTaskModal } from '@/features/tasks/NewTaskModal'
import { Avatar, Badge, Button, ErrorNote, ProgressBar, Skeleton, StatusBadge } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useBoard } from '@/lib/queries'
import { ALLOWED_TRANSITIONS, KANBAN_COLUMNS, PRIORITY_META, STATUS_META } from '@/lib/status'
import type { BoardTask, GroupDetail } from '@/lib/types'
import { cn, formatDate, isOverdue } from '@/lib/utils'

type Filter = 'all' | 'mine' | 'blocked'

export default function BoardPage() {
  const data = useOutletContext<GroupDetail>()
  const groupId = data.group.id
  const { data: tasks, isLoading, error } = useBoard(groupId)
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const visible = (tasks ?? []).filter(
    (t) =>
      t.status !== 'cancelled' &&
      (filter === 'all' || (filter === 'mine' && t.owner_user_id === data.viewer.userId) || (filter === 'blocked' && (t.status === 'blocked' || t.open_blocker_count > 0))),
  )

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 5000)
  }

  const onDrop = async (columnId: string) => {
    setOverCol(null)
    const task = tasks?.find((t) => t.id === dragId)
    setDragId(null)
    const column = KANBAN_COLUMNS.find((c) => c.id === columnId)
    if (!task || !column || column.statuses.includes(task.status)) return

    const move = ALLOWED_TRANSITIONS[task.status].find((t) => column.dropTargets.includes(t.to))
    if (!move) {
      const hint =
        task.status === 'in_progress' && column.id === 'done'
          ? 'Submit the task for review first. A reviewer accepts it into Done.'
          : `A ${STATUS_META[task.status].label.toLowerCase()} task can't move to "${column.title}" directly.`
      return flash(hint)
    }
    if (move.requiresReason) return flash('This move needs a reason. Open the task to do it.')

    // Optimistic update; Postgres has the final say.
    const key = keys.board(groupId)
    const previous = qc.getQueryData<BoardTask[]>(key)
    qc.setQueryData<BoardTask[]>(key, (old) => old?.map((t) => (t.id === task.id ? { ...t, status: move.to } : t)))
    try {
      await api.post(`/tasks/${task.id}/transition`, { to: move.to, expected_version: task.version })
    } catch (err) {
      qc.setQueryData(key, previous)
      flash(err instanceof Error ? err.message : 'Move failed')
    } finally {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: keys.myTasks })
      qc.invalidateQueries({ queryKey: keys.task(task.id) })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-sm">
          {(
            [
              ['all', data.viewer.isGroupAdmin ? "Everyone's tasks" : 'All tasks'],
              ['mine', 'My tasks'],
              ['blocked', 'Blocked'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn('rounded-md px-3 py-1.5 transition-all', filter === value ? 'bg-surface font-medium text-fg shadow-sm' : 'text-muted hover:text-fg')}
            >
              {label}
            </button>
          ))}
        </div>
        {data.viewer.permissions.canCreateTasks && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New task
          </Button>
        )}
      </div>

      {notice && (
        <div className="mb-4 flex animate-enter items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="size-4 shrink-0" /> {notice}
        </div>
      )}
      <ErrorNote error={error} />

      <div className="grid gap-4 lg:grid-cols-3">
        {KANBAN_COLUMNS.map((col) => {
          const items = visible.filter((t) => col.statuses.includes(t.status))
          return (
            <section
              key={col.id}
              onDragOver={(e: DragEvent) => {
                if (!dragId) return
                e.preventDefault()
                setOverCol(col.id)
              }}
              onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
              onDrop={() => onDrop(col.id)}
              className={cn(
                'flex min-h-64 flex-col rounded-xl border bg-surface-2/50 p-2 transition-colors duration-150',
                overCol === col.id ? 'border-accent/60 bg-accent-soft/40' : 'border-transparent',
              )}
            >
              <header className="flex items-center justify-between px-2 py-2">
                <h2 className="text-sm font-semibold">{col.title}</h2>
                <span className="rounded-full bg-surface px-2 text-xs font-medium text-muted tabular-nums">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </>
                ) : items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted">No tasks</p>
                ) : (
                  items.map((t) => (
                    <TaskCard key={t.id} task={t} dragging={dragId === t.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      <NewTaskModal open={creating} onClose={() => setCreating(false)} groupId={groupId} members={data.members} viewer={data.viewer} />
    </div>
  )
}

function TaskCard({ task, dragging, onDragStart, onDragEnd }: { task: BoardTask; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const overdue = isOverdue(task.due_date, task.status)
  const waiting = task.unmet_dependency_count > 0 && (task.status === 'draft' || task.status === 'ready')
  return (
    <Link
      to={`/tasks/${task.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'block animate-pop cursor-grab rounded-lg border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing',
        dragging && 'rotate-1 opacity-50',
        task.status === 'blocked' && 'border-l-2 border-l-rose-500',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">{task.task_key}</span>
        <StatusBadge status={task.status} />
      </div>
      <p className="mt-1.5 text-sm leading-snug font-medium">{task.title}</p>
      {task.progress > 0 && <ProgressBar value={task.progress} className="mt-2.5" />}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={cn('text-[11px] font-medium', PRIORITY_META[task.priority].tone)}>{PRIORITY_META[task.priority].label}</span>
        {waiting && (
          <Badge className="bg-surface-2 text-muted" title="Waiting on unfinished prerequisites">
            <Hourglass className="size-3" /> Waiting
          </Badge>
        )}
        {task.open_blocker_count > 0 && (
          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" title="Open blockers">
            <AlertTriangle className="size-3" /> {task.open_blocker_count}
          </Badge>
        )}
        {task.subtask_count > 0 && (
          <Badge className="bg-surface-2 text-muted" title="Subtasks">
            <GitBranch className="size-3" /> {task.subtask_count}
          </Badge>
        )}
        {task.due_date && (
          <span className={cn('flex items-center gap-1 text-[11px]', overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted')}>
            <CalendarClock className="size-3" /> {formatDate(task.due_date)}
          </span>
        )}
        <span className="ml-auto" title={task.owner_name ?? 'Unassigned'}>
          {task.owner_id ? <Avatar name={task.owner_name} src={task.owner_avatar_url} size="sm" /> : <span className="text-[11px] text-muted">Unassigned</span>}
        </span>
      </div>
    </Link>
  )
}
