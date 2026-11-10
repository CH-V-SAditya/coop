import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Avatar, Button, ErrorNote, Field, Input, Skeleton } from '@/components/ui'
import { api } from '@/lib/api'
import { keys, usePeople } from '@/lib/queries'
import type { Person } from '@/lib/types'
import { useActor } from '@/providers/actor'

/**
 * Prototype mode (no sign-in): pick the person you are, or add yourself.
 * Everything you do afterwards is done as that person, with their permissions.
 */
export default function ChoosePersonPage() {
  const { data: people, isLoading, error } = usePeople()
  const { actorId, setActor } = useActor()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const next = params.get('next')
  const go = (id: string) => {
    setActor(id)
    navigate(next && next.startsWith('/') && next !== '/welcome' ? next : '/dashboard', { replace: true })
  }

  const showForm = adding || (!isLoading && !error && people?.length === 0)

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-16">
      <Link to="/" className="absolute top-5 left-5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg">
        <ArrowLeft className="size-4" /> Back to home
      </Link>
      <div className="w-full max-w-md animate-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="mb-4 size-10" />
          <h1 className="text-2xl font-semibold tracking-tight">{showForm ? 'Add yourself' : 'Who are you?'}</h1>
          <p className="mt-1 text-sm text-muted">Sign-in is switched off while Coop is being built. Pick a person to work as.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-2 shadow-sm">
          {isLoading && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}
          {error && (
            <div className="p-4">
              <ErrorNote error={error} />
            </div>
          )}

          {showForm ? (
            <NewPersonForm onCreated={(p) => go(p.id)} onCancel={people?.length ? () => setAdding(false) : undefined} />
          ) : (
            <>
              <ul className="max-h-[22rem] overflow-y-auto">
                {people?.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => go(p.id)}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <Avatar name={p.full_name ?? p.email} src={p.avatar_url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.full_name ?? p.email}
                          {p.id === actorId && <span className="ml-2 text-xs font-normal text-accent-ink">current</span>}
                        </span>
                        <span className="block truncate text-xs text-muted">{p.job_title ?? p.email ?? 'No details yet'}</span>
                      </span>
                      <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {!isLoading && !error && (
                <div className="border-t border-line p-2">
                  <Button variant="ghost" className="w-full" onClick={() => setAdding(true)}>
                    <UserPlus className="size-4" /> Someone else? Add yourself
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NewPersonForm({ onCreated, onCancel }: { onCreated: (p: Person) => void; onCancel?: () => void }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    try {
      const person = await api.post<Person>('/people', {
        full_name: String(form.get('full_name')),
        email: String(form.get('email') ?? ''),
        job_title: String(form.get('job_title') ?? ''),
      })
      await qc.invalidateQueries({ queryKey: keys.people })
      onCreated(person)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4">
      <Field label="Your name">
        <Input name="full_name" required minLength={2} autoFocus placeholder="Priya Sharma" />
      </Field>
      <Field label="Email" hint="Optional. Used to tell people apart.">
        <Input name="email" type="email" placeholder="priya@company.com" />
      </Field>
      <Field label="Job title" hint="Optional">
        <Input name="job_title" placeholder="Product manager" />
      </Field>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Back
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={loading}>
          Continue
        </Button>
      </div>
    </form>
  )
}
