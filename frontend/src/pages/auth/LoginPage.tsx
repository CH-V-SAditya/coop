import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, ErrorNote, Field, Input } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { AuthLayout, Divider, GoogleButton } from './AuthLayout'

export default function LoginPage() {
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    })
    // On success the auth listener updates the session and the guard redirects to `next`.
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to coordinate your team's work"
      footer={
        <>
          New to Coop?{' '}
          <Link to={`/signup${params.size ? `?${params}` : ''}`} className="font-medium text-accent-ink">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required minLength={6} />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
