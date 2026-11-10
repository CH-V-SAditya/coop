import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorNote, Spinner } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { useMe } from '@/lib/queries'
import { useActor } from '@/providers/actor'

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

/** Prototype mode (no sign-in): you must pick who you are acting as. Remembers where you were going. */
export function RequireActor() {
  const { actorId } = useActor()
  const location = useLocation()
  if (!actorId) {
    const next = location.pathname + location.search
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

/** People must belong to an organisation before using the workspace. */
export function RequireOrganisation() {
  const { data, isLoading, error } = useMe()
  const { setActor } = useActor()
  // The remembered person no longer exists (e.g. the database was reset): choose again.
  const personGone = error instanceof ApiError && (error.status === 404 || error.code === 'NO_ACTOR')
  useEffect(() => {
    if (personGone) setActor(null)
  }, [personGone, setActor])

  if (isLoading || personGone) return <FullScreenSpinner />
  if (error)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorNote error={error} />
      </div>
    )
  if (!data?.memberships.length) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
