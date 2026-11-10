import { Navigate, useSearchParams } from 'react-router'
import { FullScreenSpinner } from '@/components/layout/guards'
import { ErrorNote } from '@/components/ui'
import { useAuth } from '@/providers/auth'

/**
 * Landing page for Google OAuth and email-confirmation links. supabase-js
 * exchanges the PKCE `?code=` automatically (detectSessionInUrl).
 */
export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const { session, loading } = useAuth()
  const next = params.get('next')
  const error = params.get('error_description') ?? params.get('error')

  if (error)
    return (
      <div className="mx-auto max-w-sm space-y-4 p-10">
        <ErrorNote error={error} />
        <a href="/login" className="text-sm font-medium text-accent-ink">
          Back to sign in
        </a>
      </div>
    )

  // getSession() resolves only after the code exchange, so `loading` covers it.
  if (loading) return <FullScreenSpinner />
  return <Navigate to={session ? (next?.startsWith('/') ? next : '/dashboard') : '/login'} replace />
}
