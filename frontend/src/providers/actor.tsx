import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useState, type ReactNode } from 'react'
import { readActor, writeActor } from '@/lib/actor'

type ActorState = {
  /** Profile id of the person you are acting as, or null before choosing. */
  actorId: string | null
  /** Act as someone else (or nobody). Clears cached data so nothing leaks between people. */
  setActor: (id: string | null) => void
}

const ActorContext = createContext<ActorState | null>(null)

export function ActorProvider({ children }: { children: ReactNode }) {
  const [actorId, setActorId] = useState(readActor)
  const qc = useQueryClient()

  const setActor = (id: string | null) => {
    writeActor(id)
    qc.clear()
    setActorId(id)
  }

  return <ActorContext value={{ actorId, setActor }}>{children}</ActorContext>
}

export function useActor() {
  const ctx = use(ActorContext)
  if (!ctx) throw new Error('useActor must be used inside ActorProvider')
  return ctx
}
