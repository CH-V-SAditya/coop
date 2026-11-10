import { CheckCircle2, CircleDashed, Clock3, OctagonAlert, Sparkles, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TaskRow } from '@/components/TaskRow'
import { Card, EmptyState, ErrorNote, PageHeader, PageSkeleton } from '@/components/ui'
import { useMe, useMyTasks } from '@/lib/queries'
import type { MyTask } from '@/lib/types'
import { cn, isOverdue } from '@/lib/utils'

/** Personal task clearance dashboard: what's on my plate and how well I'm clearing it. */
export default function DashboardPage() {
  const { data: me } = useMe()
  const { data, isLoading, error } = useMyTasks()
  if (isLoading) return <PageSkeleton />

  const tasks = (data?.tasks ?? []).filter((t) => t.status !== 'cancelled')
  const groupName = Object.fromEntries((data?.groups ?? []).map((g) => [g.id, g.name]))
  const completed = tasks.filter((t) => t.status === 'completed')
  const active = tasks.filter((t) => t.status !== 'completed')
  const blocked = tasks.filter((t) => t.status === 'blocked')
  const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status))
  const withDue = completed.filter((t) => t.due_date && t.completed_at)
  const onTime = withDue.filter((t) => new Date(t.completed_at!) <= new Date(`${t.due_date}T23:59:59`))
  const clearance = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0

  const focus = active.filter((t) => ['in_progress', 'blocked', 'in_review'].includes(t.status))
  const upNext = active.filter((t) => t.status === 'ready' || t.status === 'draft')
  const firstName = me?.profile.full_name?.split(' ')[0]

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title={`Hello${firstName ? `, ${firstName}` : ''}`} subtitle="Your task clearance at a glance: only the work you own, never activity tracking." />
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={<Target className="size-4" />} label="Clearance" value={`${clearance}%`} hint={`${completed.length} of ${tasks.length} done`} />
        <Stat icon={<CircleDashed className="size-4" />} label="Active" value={active.length} hint="Not yet completed" />
        <Stat icon={<OctagonAlert className="size-4" />} label="Blocked" value={blocked.length} tone={blocked.length ? 'danger' : undefined} hint="Needs a decision" />
        <Stat icon={<Clock3 className="size-4" />} label="Overdue" value={overdue.length} tone={overdue.length ? 'warn' : undefined} hint="Past due date" />
        <Stat
          icon={<CheckCircle2 className="size-4" />}
          label="On time"
          value={withDue.length ? `${Math.round((onTime.length / withDue.length) * 100)}%` : '–'}
          hint="Completed by due date"
        />
      </div>

      <Card className="mt-4 flex items-start gap-3 border-dashed p-4">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">AI insights</span> (progress summaries, risk alerts and starting advice for your tasks) arrive with the AI
          layer in Phase 8–9.
        </p>
      </Card>

      {tasks.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No tasks assigned to you yet" action={<Link to="/groups" className="text-sm font-medium text-accent-ink">Browse your groups</Link>}>
            When a manager assigns you work, or you pick up a task, it shows up here.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Section title="Focus now" empty="Nothing in progress." tasks={focus} groupName={groupName} />
          <Section title="Up next" empty="Nothing queued." tasks={upNext} groupName={groupName} />
          <Section title="Recently completed" empty="Nothing completed yet." tasks={completed.slice(0, 8)} groupName={groupName} className="lg:col-span-2" />
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint: string; tone?: 'danger' | 'warn' }) {
  return (
    <Card className="p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'mt-2 text-2xl font-semibold tabular-nums',
          tone === 'danger' && 'text-rose-600 dark:text-rose-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted">{hint}</div>
    </Card>
  )
}

function Section({ title, tasks, empty, groupName, className }: { title: string; tasks: MyTask[]; empty: string; groupName: Record<string, string>; className?: string }) {
  return (
    <Card className={cn('p-2', className)}>
      <h2 className="px-3 pt-2 pb-1 text-sm font-semibold">{title}</h2>
      {tasks.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">{empty}</p>
      ) : (
        tasks.map((t) => <TaskRow key={t.id} task={t} context={groupName[t.group_id]} />)
      )}
    </Card>
  )
}
