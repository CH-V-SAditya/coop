import { useQueryClient } from '@tanstack/react-query'
import { Check, ShieldCheck, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { Avatar, Badge, Button, Card, Checkbox, ErrorNote, Field, Input, Modal, Select } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useOrgMembers } from '@/lib/queries'
import type { GroupDetail, GroupMember, Person } from '@/lib/types'

const PERMISSIONS = [
  ['can_create_tasks', 'Create tasks'],
  ['can_assign_tasks', 'Assign tasks to others'],
  ['can_schedule_tasks', 'Schedule & link tasks'],
  ['can_upload_context', 'Add context documents'],
] as const

export default function MembersPage() {
  const data = useOutletContext<GroupDetail>()
  const isAdmin = data.viewer.isGroupAdmin
  const [adding, setAdding] = useState(false)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Give every member a <span className="font-medium text-fg">role</span> (e.g. Frontend, Backend, Database). The AI will use roles to break the goal
          into subtasks and assign them. Leave it empty and the AI will suggest a role from the goal and context. You approve it.
        </p>
        {isAdmin && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Add people
          </Button>
        )}
      </div>

      <Card className="divide-y divide-line">
        {data.members.map((m) => (
          <MemberRow key={m.id} member={m} data={data} />
        ))}
      </Card>

      {isAdmin && <AddPeopleModal data={data} open={adding} onClose={() => setAdding(false)} />}
    </div>
  )
}

function MemberRow({ member, data }: { member: GroupMember; data: GroupDetail }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isAdmin = data.viewer.isGroupAdmin
  const isMe = member.user_id === data.viewer.userId
  const [role, setRole] = useState(member.functional_role ?? '')
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true)
    setError(null)
    try {
      await api.patch(`/groups/${data.group.id}/members/${member.id}`, body)
      await qc.invalidateQueries({ queryKey: keys.group(data.group.id) })
    } catch (err) {
      setError(err)
      setRole(member.functional_role ?? '')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm(isMe ? 'Leave this group?' : `Remove ${member.full_name ?? member.email} from the group?`)) return
    try {
      await api.del(`/groups/${data.group.id}/members/${member.id}`)
      if (isMe) navigate('/groups')
      else await qc.invalidateQueries({ queryKey: keys.group(data.group.id) })
      qc.invalidateQueries({ queryKey: keys.groups(data.group.organisation_id) })
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={member.full_name ?? member.email} src={member.avatar_url} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{member.full_name ?? member.email}</span>
            {isMe && <span className="text-xs text-muted">(you)</span>}
            {member.role === 'admin' && (
              <Badge className="bg-accent-soft text-accent-ink">
                <ShieldCheck className="size-3" /> Admin
              </Badge>
            )}
          </div>
          <span className="block truncate text-xs text-muted">{member.email}</span>
        </div>

        {isAdmin ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              patch({ functional_role: role.trim() || null })
            }}
          >
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role, or leave for AI" className="h-8 w-48 text-xs" maxLength={80} />
            {role !== (member.functional_role ?? '') && (
              <Button size="sm" type="submit" loading={saving}>
                <Check className="size-3.5" />
              </Button>
            )}
          </form>
        ) : (
          <RoleBadge member={member} />
        )}

        {isAdmin && !isMe && (
          <Select
            className="h-8 w-28 text-xs"
            value={member.role}
            onChange={(e) => patch({ role: e.target.value, ...(e.target.value === 'admin' ? allPerms(true) : {}) })}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
        )}
        {(isAdmin || isMe) && (
          <button onClick={remove} className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-rose-600" title={isMe ? 'Leave group' : 'Remove'}>
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {isAdmin && member.role !== 'admin' && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pl-11">
          {PERMISSIONS.map(([key, label]) => (
            <Checkbox key={key} label={label} checked={member[key]} disabled={saving} onChange={(e) => patch({ [key]: e.target.checked })} />
          ))}
        </div>
      )}
      {isAdmin && !member.functional_role && (
        <p className="flex items-center gap-1.5 pl-11 text-xs text-violet-600 dark:text-violet-400">
          <Sparkles className="size-3" /> No role yet. The AI will suggest one from the group's goal and context (Phase 8).
        </p>
      )}
      <ErrorNote error={error} />
    </div>
  )
}

const allPerms = (v: boolean) => Object.fromEntries(PERMISSIONS.map(([k]) => [k, v]))

function RoleBadge({ member }: { member: GroupMember }) {
  if (!member.functional_role) return <Badge className="bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Role pending</Badge>
  return (
    <Badge className="bg-surface-2 text-fg" title={member.role_source === 'ai' ? 'Suggested by AI, approved by an admin' : 'Set by an admin'}>
      {member.role_source === 'ai' && <Sparkles className="size-3 text-violet-500" />}
      {member.functional_role}
    </Badge>
  )
}

function AddPeopleModal({ data, open, onClose }: { data: GroupDetail; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const orgId = data.group.organisation_id
  const { data: orgMembers } = useOrgMembers(open ? orgId : undefined)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const inGroup = new Set(data.members.map((m) => m.organisation_member_id))
  const candidates = (orgMembers ?? []).filter((m) => !inGroup.has(m.id))
  const activeMode = mode === 'existing' && orgMembers && candidates.length === 0 ? 'new' : mode

  const close = () => {
    setError(null)
    onClose()
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const groupRole = String(f.get('group_role'))
    const admin = groupRole === 'admin'
    setLoading(true)
    setError(null)
    try {
      let organisationMemberId = String(f.get('organisation_member_id') ?? '')
      if (activeMode === 'new') {
        // Prototype mode (no sign-in): create the person, add them to the organisation, then to the group.
        const person = await api.post<Person>('/people', {
          full_name: String(f.get('full_name')),
          email: String(f.get('email') ?? ''),
          job_title: String(f.get('job_title') ?? ''),
        })
        const orgMember = await api.post<{ id: string }>(`/organisations/${orgId}/members`, { user_id: person.id })
        organisationMemberId = orgMember.id
      }
      await api.post(`/groups/${data.group.id}/members`, {
        organisation_member_id: organisationMemberId,
        role: groupRole,
        functional_role: String(f.get('functional_role') ?? '').trim() || undefined,
        ...Object.fromEntries(PERMISSIONS.map(([k]) => [k, admin || f.get(k) === 'on'])),
      })
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.group(data.group.id) }),
        qc.invalidateQueries({ queryKey: keys.orgMembers(orgId) }),
        qc.invalidateQueries({ queryKey: keys.people }),
      ])
      close()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title={`Add people to ${data.group.name}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-sm">
          {(
            [
              ['existing', 'From organisation'],
              ['new', 'New person'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => setMode(value)}
              className={`flex-1 rounded-md py-1.5 transition-all ${activeMode === value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:bg-surface/60 hover:text-fg'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeMode === 'existing' ? (
          <Field label="Person">
            <Select name="organisation_member_id" required>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.profile?.full_name ?? m.profile?.email}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input name="full_name" required minLength={2} placeholder="Sam Rivera" autoFocus />
            </Field>
            <Field label="Email" hint="Optional">
              <Input name="email" type="email" placeholder="sam@company.com" />
            </Field>
            <Field label="Job title" hint="Optional">
              <Input name="job_title" placeholder="Backend engineer" />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role in this group" hint="Used by the AI to assign subtasks. Empty = AI suggests one.">
            <Input name="functional_role" maxLength={80} placeholder="e.g. Frontend developer" />
          </Field>
          <Field label="Access">
            <Select name="group_role" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin (manager)</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {PERMISSIONS.map(([key, label]) => (
            <Checkbox key={key} name={key} label={label} />
          ))}
        </div>

        {activeMode === 'existing' && orgMembers && candidates.length === 0 && (
          <p className="text-xs text-muted">Everyone in the organisation is already in this group.</p>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add to group
          </Button>
        </div>
      </form>
    </Modal>
  )
}
