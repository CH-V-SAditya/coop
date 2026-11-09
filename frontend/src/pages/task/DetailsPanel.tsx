import { useState, type ReactNode } from 'react'
import { Avatar, Card, ErrorNote, Input, ProgressBar, Select } from '@/components/ui'
import { api } from '@/lib/api'
import type { TaskDetail } from '@/lib/types'
import { formatDate, isOverdue, memberLabel } from '@/lib/utils'
import { useTaskAction } from './useTaskAction'

export function DetailsPanel({ detail }: { detail: TaskDetail }) {
  const { task, can, members } = detail
  const { run, error } = useTaskAction(detail)
  const finished = task.status === 'completed' || task.status === 'cancelled'

  const update = (field: string, value: unknown) => run(field, () => api.patch(`/tasks/${task.id}`, { [field]: value, expected_version: task.version }))
  const nameOf = (memberId: string | null) => {
    const m = members.find((x) => x.organisation_member_id === memberId)
    return m ? memberLabel(m) : null
  }

  return (
    <Card className="divide-y divide-line">
      <div className="space-y-4 p-4">
        <Row label="Owner">
          {can.edit && can.assign && !finished ? (
            <Select className="h-8 text-xs" value={task.owner_id ?? ''} onChange={(e) => update('owner_id', e.target.value || null)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.organisation_member_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </Select>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              {task.owner_id && <Avatar name={task.owner_name} src={task.owner_avatar_url} size="sm" />}
              {nameOf(task.owner_id) ?? 'Unassigned'}
            </span>
          )}
        </Row>
        <Row label="Reviewer">
          {can.edit && !finished ? (
            <Select className="h-8 text-xs" value={task.reviewer_id ?? ''} onChange={(e) => update('reviewer_id', e.target.value || null)}>
              <option value="">Group admins</option>
              {members.map((m) => (
                <option key={m.id} value={m.organisation_member_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </Select>
          ) : (
            <span className="text-sm">{nameOf(task.reviewer_id) ?? 'Group admins'}</span>
          )}
        </Row>
        <Row label="Priority">
          {can.edit && !finished ? (
            <Select className="h-8 text-xs" value={task.priority} onChange={(e) => update('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          ) : (
            <span className="text-sm capitalize">{task.priority}</span>
          )}
        </Row>
        <Row label="Start date">
          {can.edit && !finished ? (
            <Input key={`s-${task.start_date}`} type="date" className="h-8 text-xs" defaultValue={task.start_date ?? ''} onBlur={(e) => e.target.value !== (task.start_date ?? '') && update('start_date', e.target.value || null)} />
          ) : (
            <span className="text-sm">{formatDate(task.start_date) ?? '–'}</span>
          )}
        </Row>
        <Row label="Due date">
          {can.edit && !finished ? (
            <Input key={`d-${task.due_date}`} type="date" className="h-8 text-xs" defaultValue={task.due_date ?? ''} onBlur={(e) => e.target.value !== (task.due_date ?? '') && update('due_date', e.target.value || null)} />
          ) : (
            <span className={isOverdue(task.due_date, task.status) ? 'text-sm font-medium text-rose-600' : 'text-sm'}>{formatDate(task.due_date) ?? '–'}</span>
          )}
        </Row>
        <ErrorNote error={error} />
      </div>

      <ProgressEditor key={task.progress} detail={detail} disabled={!can.updateProgress || finished} />

      <div className="space-y-1.5 p-4 text-xs text-muted">
        <Stamp label="Created" value={task.created_at} />
        <Stamp label="Started" value={task.started_at} />
        <Stamp label="Submitted for review" value={task.submitted_at} />
        <Stamp label="Completed" value={task.completed_at} />
      </div>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  )
}

function Stamp({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-fg">{new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
    </div>
  )
}

/** Progress (how much work is done) is deliberately separate from status. */
function ProgressEditor({ detail, disabled }: { detail: TaskDetail; disabled: boolean }) {
  const { task } = detail
  const [value, setValue] = useState(task.progress)
  const { run, pending, error } = useTaskAction(detail)

  const commit = () => {
    if (value !== task.progress) run('progress', () => api.patch(`/tasks/${task.id}`, { progress: value, expected_version: task.version }))
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Progress</span>
        <span className="text-sm font-semibold tabular-nums">{value}%</span>
      </div>
      {disabled ? (
        <ProgressBar value={task.progress} />
      ) : (
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={pending === 'progress'}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          className="w-full accent-[var(--accent)]"
          aria-label="Progress"
        />
      )}
      <p className="text-[11px] text-muted">Separate from status: a task can be 60% done and still blocked.</p>
      <ErrorNote error={error} />
    </div>
  )
}
