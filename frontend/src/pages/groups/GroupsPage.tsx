import { useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldCheck, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, PageSkeleton, ProgressBar, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useGroups } from '@/lib/queries'
import { useOrg } from '@/providers/org'

export default function GroupsPage() {
  const { active } = useOrg()
  const orgId = active?.organisation.id
  const { data: groups, isLoading, error } = useGroups(orgId)
  const [params, setParams] = useSearchParams()
  const creating = params.has('create')
  const setCreating = (open: boolean) => setParams(open ? { create: '1' } : {}, { replace: true })

  if (isLoading) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Groups"
        subtitle={`Teams and departments in ${active?.organisation.name ?? 'your organisation'}. Each group works towards a common goal.`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New group
          </Button>
        }
      />
      <ErrorNote error={error} />

      {groups?.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="Create your first group"
          action={<Button onClick={() => setCreating(true)}>Create a group</Button>}
        >
          A group is a team working towards a goal, e.g. "Website launch". You'll be its admin and can invite people with roles.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups?.map((g, i) => {
            const pct = g.task_total ? Math.round((g.task_completed / g.task_total) * 100) : 0
            return (
              <Link key={g.id} to={`/groups/${g.id}`} className="animate-enter" style={{ animationDelay: `${i * 40}ms` }}>
                <Card className="flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{g.name}</h3>
                    {g.my_role === 'admin' && (
                      <Badge className="bg-accent-soft text-accent-ink">
                        <ShieldCheck className="size-3" /> Admin
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{g.goal ?? g.description ?? 'No goal set yet'}</p>
                  <div className="mt-4 space-y-2">
                    <ProgressBar value={pct} />
                    <div className="flex justify-between text-xs text-muted">
                      <span>
                        {g.task_completed}/{g.task_total} tasks done
                        {g.task_blocked > 0 && <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">{g.task_blocked} blocked</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {g.group_members?.[0]?.count ?? 0}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {orgId && <CreateGroupModal orgId={orgId} open={creating} onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateGroupModal({ orgId, open, onClose }: { orgId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      const group = await api.post<{ id: string }>(`/organisations/${orgId}/groups`, {
        name: String(f.get('name')),
        goal: String(f.get('goal') || '') || undefined,
        functional_role: String(f.get('functional_role') || '') || undefined,
      })
      await qc.invalidateQueries({ queryKey: keys.groups(orgId) })
      navigate(`/groups/${group.id}/members`)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a group">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Group name">
          <Input name="name" required minLength={2} maxLength={120} placeholder="Website launch" autoFocus />
        </Field>
        <Field label="Common goal" hint="What is this group trying to achieve? The AI will later break this goal into subtasks and assign them by role.">
          <Textarea name="goal" maxLength={4000} placeholder="Design, build and launch the new marketing website by 15 December." />
        </Field>
        <Field label="Your role in this group (optional)" hint="e.g. Manager, Product owner">
          <Input name="functional_role" maxLength={80} placeholder="Manager" />
        </Field>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create group
          </Button>
        </div>
      </form>
    </Modal>
  )
}
