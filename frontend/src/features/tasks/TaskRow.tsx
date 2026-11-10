import { AlertTriangle, CalendarClock, Hourglass } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge, ProgressBar, StatusBadge } from '@/components/ui'
import type { TaskStatus } from '@/lib/types'
import { cn, formatDate, isOverdue } from '@/lib/utils'

type RowTask = {
  id: string
  task_key: string
  title: string
  status: TaskStatus
  progress: number
  due_date: string | null
  unmet_dependency_count?: number
  open_blocker_count?: number
  owner_name?: string | null
}

/** Compact task line used in dashboards and related-task lists. */
export function TaskRow({ task, context, action }: { task: RowTask; context?: string; action?: ReactNode }) {
  const overdue = isOverdue(task.due_date, task.status)
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2">
      <Link to={`/tasks/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-16 shrink-0 font-mono text-xs text-muted">{task.task_key}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{task.title}</span>
          {(context || task.owner_name) && <span className="block truncate text-xs text-muted">{context ?? task.owner_name}</span>}
        </span>
        <span className="hidden w-24 shrink-0 sm:block">
          <ProgressBar value={task.progress} />
        </span>
        {!!task.unmet_dependency_count && task.status !== 'completed' && (
          <Badge className="bg-surface-2 text-muted" title="Waiting on prerequisites">
            <Hourglass className="size-3" /> {task.unmet_dependency_count}
          </Badge>
        )}
        {!!task.open_blocker_count && (
          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" title="Open blockers">
            <AlertTriangle className="size-3" /> {task.open_blocker_count}
          </Badge>
        )}
        {task.due_date && (
          <span className={cn('hidden shrink-0 items-center gap-1 text-xs md:flex', overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted')}>
            <CalendarClock className="size-3.5" />
            {formatDate(task.due_date)}
          </span>
        )}
        <StatusBadge status={task.status} />
      </Link>
      {action}
    </div>
  )
}
