import { createContext, use, useState, type ReactNode } from 'react'
import { useMe } from '@/lib/queries'
import type { Membership } from '@/lib/types'

const STORAGE_KEY = 'coop-active-org'

type OrgState = {
  memberships: Membership[]
  active: Membership | null
  setActiveOrgId: (id: string) => void
}

const OrgContext = createContext<OrgState | null>(null)

/** Tracks which organisation the user is working in (remembered per browser). */
export function OrgProvider({ children }: { children: ReactNode }) {
  const { data } = useMe()
  const [preferred, setPreferred] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const memberships = data?.memberships ?? []
  const active = memberships.find((m) => m.organisation.id === preferred) ?? memberships[0] ?? null

  const setActiveOrgId = (id: string) => {
    setPreferred(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }

  return <OrgContext value={{ memberships, active, setActiveOrgId }}>{children}</OrgContext>
}

export function useOrg() {
  const ctx = use(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}
