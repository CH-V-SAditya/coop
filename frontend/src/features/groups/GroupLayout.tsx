import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Target } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useParams } from 'react-router'
import { Button, ErrorNote, Field, Input, Modal, PageSkeleton, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useGroup } from '@/lib/queries'
import type { GroupDetail } from '@/lib/types'
import { cn } from '@/lib/utils'

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative px-1 pb-3 text-sm transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
    isActive ? 'font-medium text-fg after:bg-accent' : 'text-muted hover:text-fg after:bg-transparent',
  )

export default function GroupLayout() {
  const { groupId = '' } = useParams()
  const { data, isLoading, error } = useGroup(groupId)
  const [editing, setEditing] = useState(false)

  if (isLoading) return <PageSkeleton />
  if (error || !data)
    return (
      <div className="p-6">
        <ErrorNote error={error ?? 'Group not found'} />
      </div>
    )

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface px-6 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{data.organisation.name}</p>
            <h1 className="text-xl font-semibold tracking-tight">{data.group.name}</h1>
            <p className="mt-1 flex max-w-3xl items-start gap-1.5 text-sm text-muted">
              <Target className="mt-0.5 size-3.5 shrink-0" />
              {data.group.goal ?? 'No goal set yet.'}
            </p>
          </div>
          {data.viewer.isGroupAdmin && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit goal
            </Button>
          )}
        </div>
        <nav className="mt-5 flex gap-6">
          <NavLink to={`/groups/${groupId}`} end className={tab}>
            Board
          </NavLink>
          <NavLink to={`/groups/${groupId}/members`} className={tab}>
            Members · {data.members.length}
          </NavLink>
        </nav>
      </header>
      <div className="flex-1">
        <Outlet context={data} />
      </div>
      <EditGroupModal data={data} open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

function EditGroupModal({ data, open, onClose }: { data: GroupDetail; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      await api.patch(`/groups/${data.group.id}`, {
        name: String(f.get('name')),
        goal: String(f.get('goal') || '') || null,
        members_can_upload_context: f.get('members_can_upload_context') === 'on',
      })
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.group(data.group.id) }),
        qc.invalidateQueries({ queryKey: keys.groups(data.group.organisation_id) }),
      ])
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit group">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Group name">
          <Input name="name" defaultValue={data.group.name} required minLength={2} />
        </Field>
        <Field label="Common goal">
          <Textarea name="goal" defaultValue={data.group.goal ?? ''} rows={5} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="members_can_upload_context" defaultChecked={data.group.members_can_upload_context} className="mt-0.5 size-4" />
          <span>
            Let all members add context documents
            <span className="block text-xs text-muted">Off by default: only admins provide the goal's context, which keeps unrelated content out.</span>
          </span>
        </label>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
