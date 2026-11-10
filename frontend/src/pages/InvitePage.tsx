import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MailOpen } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Badge, Button, ErrorNote, Spinner } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, useMe } from '@/lib/queries'
import { formatDate } from '@/lib/utils'
import { useOrg } from '@/providers/org'

type Preview = {
  organisation_name: string
  group_name: string | null
  email: string
  functional_role: string | null
  invited_by_name: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
}

export default function InvitePage() {
  const { token = '' } = useParams()
  const { data: me } = useMe()
  const { setActiveOrgId } = useOrg()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<Preview>(`/invitations/${token}`),
  })

  const accept = async () => {
    setAccepting(true)
    setError(null)
    try {
      const res = await api.post<{ organisation_id: string; group_id: string | null }>(`/invitations/${token}/accept`)
      setActiveOrgId(res.organisation_id)
      await qc.invalidateQueries({ queryKey: keys.me })
      navigate(res.group_id ? `/groups/${res.group_id}` : '/dashboard', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setAccepting(false)
    }
  }

  const wrongAccount = data && me && data.email.toLowerCase() !== me.profile.email.toLowerCase()

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md animate-enter rounded-2xl border border-line bg-surface p-8 shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : loadError || !data ? (
          <ErrorNote error={loadError ?? 'Invitation not found'} />
        ) : (
          <div className="space-y-5">
            <MailOpen className="size-8 text-accent-ink" />
            <div>
              <h1 className="text-xl font-semibold">
                Join {data.group_name ? `${data.group_name} at ` : ''}
                {data.organisation_name}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {data.invited_by_name ?? 'A teammate'} invited <strong>{data.email}</strong>. Expires {formatDate(data.expires_at)}.
              </p>
            </div>
            {data.functional_role && (
              <p className="text-sm">
                Your role in the group: <Badge className="bg-accent-soft text-accent-ink">{data.functional_role}</Badge>
              </p>
            )}
            {data.status !== 'pending' ? (
              <ErrorNote error={`This invitation is ${data.status}.`} />
            ) : wrongAccount ? (
              <ErrorNote error={`You're signed in as ${me?.profile.email}. Sign in as ${data.email} to accept.`} />
            ) : (
              <>
                <ErrorNote error={error} />
                <Button className="w-full" onClick={accept} loading={accepting}>
                  Accept invitation
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
