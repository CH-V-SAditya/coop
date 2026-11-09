import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorNote, Spinner } from '@/components/ui'
import { isAuthConfigured } from '@/lib/supabase'
import { useMe } from '@/lib/queries'
import { useAuth } from '@/providers/auth'

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

/** Signed-in users only. Remembers where they were going. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (!isAuthConfigured) return <SetupNotice />
  if (loading) return <FullScreenSpinner />
  if (!session) {
    const next = location.pathname + location.search
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

/** Signed-out users only (login / signup). */
export function RequireGuest() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (session) {
    const next = new URLSearchParams(location.search).get('next')
    return <Navigate to={next && next.startsWith('/') ? next : '/dashboard'} replace />
  }
  return <Outlet />
}

/** Users must belong to an organisation before using the workspace. */
export function RequireOrganisation() {
  const { data, isLoading, error } = useMe()
  if (isLoading) return <FullScreenSpinner />
  if (error)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorNote error={error} />
      </div>
    )
  if (!data?.memberships.length) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg space-y-3 p-10 text-sm">
      <h1 className="text-lg font-semibold">Coop is not configured yet</h1>
      <p className="text-muted">
        Copy <code>frontend/.env.example</code> to <code>frontend/.env.local</code> and set <code>VITE_SUPABASE_URL</code>,{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> and <code>VITE_API_URL</code>. See the README for the full setup.
      </p>
    </div>
  )
}
