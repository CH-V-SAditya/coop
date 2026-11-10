import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, ErrorNote, Field, Input } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { AuthLayout, Divider, GoogleButton } from './AuthLayout'

export default function SignupPage() {
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(form.get('password')),
      options: {
        data: { full_name: String(form.get('full_name')).trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) return setError(error.message)
    // With email confirmation enabled there is no session yet.
    if (!data.session) setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle="One more step" footer={<Link to="/login" className="font-medium text-accent-ink">Back to sign in</Link>}>
        <div className="flex flex-col items-center gap-3 text-center text-sm">
          <MailCheck className="size-8 text-accent-ink" />
          <p>
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start coordinating work with your team"
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${params.size ? `?${params}` : ''}`} className="font-medium text-accent-ink">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required placeholder="Asha Rao" />
        </Field>
        <Field label="Work email">
          <Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
