import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { keys } from '@/lib/queries'
import type { GroupMember, Viewer } from '@/lib/types'
import { memberLabel } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  groupId: string
  members: GroupMember[]
  viewer: Viewer
  parent?: { id: string; title: string }
}


/** Structured task creation. New tasks always start as drafts (enforced by Postgres). */
export function NewTaskModal({ open, onClose, groupId, members, viewer, parent }: Props) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Without "assign" permission you can only take the task yourself.
  const assignable = viewer.permissions.canAssignTasks ? members : members.filter((m) => m.organisation_member_id === viewer.memberId)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const str = (k: string) => String(f.get(k) ?? '').trim() || null
    setLoading(true)
    setError(null)
    try {
      await api.post(`/groups/${groupId}/tasks`, {
        title: str('title'),
        description: str('description') ?? undefined,
        acceptance_criteria: str('acceptance_criteria') ?? undefined,
        owner_id: str('owner_id'),
        reviewer_id: str('reviewer_id'),
        priority: str('priority') ?? 'medium',
        due_date: str('due_date'),
        parent_task_id: parent?.id ?? null,
      })
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.board(groupId) }),
        qc.invalidateQueries({ queryKey: keys.myTasks }),
        parent ? qc.invalidateQueries({ queryKey: keys.task(parent.id) }) : null,
      ])
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={parent ? `New subtask of "${parent.title}"` : 'New task'} wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Title">
          <Input name="title" required maxLength={200} placeholder="Build the landing page hero section" autoFocus />
        </Field>
        <Field label="Description">
          <Textarea name="description" maxLength={10000} placeholder="Context, links, anything the owner needs to know." />
        </Field>
        <Field label="Definition of done" hint="How will the reviewer know this is complete?">
          <Textarea name="acceptance_criteria" maxLength={5000} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner" hint="Owner + no unfinished prerequisites = task can become ready.">
            <Select name="owner_id" defaultValue={viewer.permissions.canAssignTasks ? '' : (viewer.memberId ?? '')}>
              <option value="">Unassigned</option>
              {assignable.map((m) => (
                <option key={m.id} value={m.organisation_member_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reviewer" hint="Accepts the work. Group admins can always review.">
            <Select name="reviewer_id" defaultValue="">
              <option value="">Group admins</option>
              {members.map((m) => (
                <option key={m.id} value={m.organisation_member_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
          <Field label="Due date">
            <Input name="due_date" type="date" />
          </Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  )
}
