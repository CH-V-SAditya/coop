import { useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Avatar, Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, PageSkeleton, Select, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useGroups, useMe, useOrgMembers } from '@/lib/queries'
import type { Person } from '@/lib/types'
import { useOrg } from '@/providers/org'

export default function ProfilePage() {
  const { data: me, isLoading } = useMe()
  if (isLoading || !me) return <PageSkeleton />
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <PageHeader title="Profile & team" subtitle="Your details, and the people in your organisation." />
      <ProfileForm />
      <OrganisationSection />
    </div>
  )
}

function ProfileForm() {
  const { data: me } = useMe()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const p = me!.profile

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const s = (k: string) => String(f.get(k) ?? '').trim()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.patch('/me', { full_name: s('full_name'), job_title: s('job_title') || null, bio: s('bio') || null, timezone: s('timezone') || 'UTC' })
      await qc.invalidateQueries({ queryKey: keys.me })
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={p.full_name ?? p.email} src={p.avatar_url} size="lg" />
        <div>
          <p className="font-semibold">{p.full_name ?? 'Unnamed'}</p>
          <p className="text-sm text-muted">{p.email}</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="full_name" defaultValue={p.full_name ?? ''} required maxLength={120} />
        </Field>
        <Field label="Job title">
          <Input name="job_title" defaultValue={p.job_title ?? ''} maxLength={120} placeholder="Backend engineer" />
        </Field>
        <Field label="About you" hint="Skills and experience help the AI suggest the right work for you." className="sm:col-span-2">
          <Textarea name="bio" defaultValue={p.bio ?? ''} maxLength={1000} rows={3} />
        </Field>
        <Field label="Time zone">
          <Input name="timezone" defaultValue={p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} maxLength={64} />
        </Field>
        <div className="flex items-end justify-end gap-3 sm:col-span-2">
          {saved && <span className="animate-fade text-sm text-emerald-600">Saved</span>}
          <ErrorNote error={error} />
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  )
}

function OrganisationSection() {
  const { active } = useOrg()
  const orgId = active?.organisation.id
  const isOrgAdmin = active?.role === 'owner' || active?.role === 'admin'
  const { data: members } = useOrgMembers(orgId)
  const [adding, setAdding] = useState(false)

  if (!active || !orgId) return null

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Building2 className="size-4 text-muted" /> {active.organisation.name}
          <Badge className="bg-surface-2 text-muted capitalize">{active.role}</Badge>
        </h2>
        <div className="flex gap-2">
          <Link to="/onboarding?new=1">
            <Button variant="ghost" size="sm">
              <Plus className="size-3.5" /> New organisation
            </Button>
          </Link>
          {isOrgAdmin && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <UserPlus className="size-3.5" /> Add person
            </Button>
          )}
        </div>
      </div>

      <Card className="divide-y divide-line">
        {(members ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.profile?.full_name ?? m.profile?.email} src={m.profile?.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.profile?.full_name ?? m.profile?.email}</p>
              <p className="truncate text-xs text-muted">
                {m.profile?.email}
                {m.profile?.job_title ? ` · ${m.profile.job_title}` : ''}
              </p>
            </div>
            <Badge className="bg-surface-2 text-muted capitalize">{m.role}</Badge>
          </div>
        ))}
      </Card>

      {isOrgAdmin && <AddPersonModal orgId={orgId} open={adding} onClose={() => setAdding(false)} />}
    </section>
  )
}

/** Prototype mode (no sign-in): create a person and add them to the organisation (and optionally a group). */
function AddPersonModal({ orgId, open, onClose }: { orgId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: groups } = useGroups(orgId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const close = () => {
    setError(null)
    onClose()
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const s = (k: string) => String(f.get(k) ?? '').trim() || undefined
    setLoading(true)
    setError(null)
    try {
      const person = await api.post<Person>('/people', { full_name: s('full_name'), email: s('email') ?? '', job_title: s('job_title') })
      const member = await api.post<{ id: string }>(`/organisations/${orgId}/members`, { user_id: person.id, role: s('org_role') })
      const groupId = s('group_id')
      if (groupId) {
        await api.post(`/groups/${groupId}/members`, { organisation_member_id: member.id, functional_role: s('functional_role') })
        await qc.invalidateQueries({ queryKey: keys.group(groupId) })
      }
      await Promise.all([qc.invalidateQueries({ queryKey: keys.orgMembers(orgId) }), qc.invalidateQueries({ queryKey: keys.people })])
      close()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Add a person to the organisation">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name">
          <Input name="full_name" required minLength={2} placeholder="Sam Rivera" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint="Optional">
            <Input name="email" type="email" placeholder="sam@company.com" />
          </Field>
          <Field label="Job title" hint="Optional">
            <Input name="job_title" placeholder="Backend engineer" />
          </Field>
          <Field label="Organisation role">
            <Select name="org_role" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Add to group (optional)">
            <Select name="group_id" defaultValue="">
              <option value="">No group</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Role in that group (optional)" hint="e.g. Database engineer. Empty = AI suggests one.">
          <Input name="functional_role" maxLength={80} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add person
          </Button>
        </div>
      </form>
    </Modal>
  )
}
