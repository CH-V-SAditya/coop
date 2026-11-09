import { useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button, ErrorNote, Field, Input } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useMe } from '@/lib/queries'
import type { Organisation } from '@/lib/types'
import { useOrg } from '@/providers/org'

/** First-run: create an organisation. `?new=1` lets existing users create another one. */
export default function OnboardingPage() {
  const { data: me } = useMe()
  const { setActiveOrgId } = useOrg()
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const hasOrg = Boolean(me?.memberships.length)
  if (hasOrg && !params.has('new') && !loading) return <Navigate to="/dashboard" replace />

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('name'))
    setLoading(true)
    setError(null)
    try {
      const org = await api.post<Organisation>('/organisations', { name })
      setActiveOrgId(org.id)
      await qc.invalidateQueries({ queryKey: keys.me })
      navigate('/groups?create=1', { replace: true })
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md animate-enter">
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Building2 className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{hasOrg ? 'Create another organisation' : 'Set up your organisation'}</h1>
        <p className="mt-2 text-sm text-muted">
          An organisation holds your groups (engineering, operations, finance, a project team…). You'll be its owner. Were you invited?
          Open the invitation link from your teammate instead.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Organisation name">
            <Input name="name" required minLength={2} maxLength={120} placeholder="Acme Labs" autoFocus />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" className="w-full" loading={loading}>
            Create organisation
          </Button>
          {hasOrg && (
            <Link to="/dashboard" className="block text-center text-sm text-muted hover:text-fg">
              Cancel
            </Link>
          )}
        </form>
      </div>
    </div>
  )
}
