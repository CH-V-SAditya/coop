import { Building2, ChevronsUpDown, LayoutDashboard, LogOut, Menu, Monitor, Moon, Sun, Users, X } from 'lucide-react'
import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Avatar, PageSkeleton } from '@/components/ui'
import { useGroups, useMe } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { useOrg } from '@/providers/org'
import { useTheme, type Theme } from '@/providers/theme'

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
    isActive ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
  )

export function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    // Close the mobile drawer whenever the route changes.
    setLastPath(location.pathname)
    setOpen(false)
  }

  return (
    <div className="flex min-h-dvh">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:hidden">
        <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Logo />
      </div>

      {open && <div className="fixed inset-0 z-40 animate-fade bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 ease-out md:sticky md:top-0 md:h-dvh md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </aside>

      <main className="min-w-0 flex-1 pt-14 md:pt-0">
        <Suspense fallback={<PageSkeleton />}>
          <div key={location.pathname} className="animate-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-6" />
      Coop
    </div>
  )
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const { active } = useOrg()
  const { data: groups } = useGroups(active?.organisation.id)

  return (
    <>
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 md:hidden" aria-label="Close menu">
          <X className="size-4" />
        </button>
      </div>

      <OrgSwitcher />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <NavLink to="/dashboard" className={navItem}>
          <LayoutDashboard className="size-4" /> My dashboard
        </NavLink>
        <NavLink to="/groups" end className={navItem}>
          <Users className="size-4" /> Groups
        </NavLink>

        {groups && groups.length > 0 && (
          <div className="pt-4">
            <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Your groups</p>
            {groups.map((g) => (
              <NavLink key={g.id} to={`/groups/${g.id}`} className={navItem}>
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-surface-2 text-[10px] font-semibold text-fg">
                  {g.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{g.name}</span>
                {g.task_blocked > 0 && (
                  <span className="ml-auto rounded bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300" title="Blocked tasks">
                    {g.task_blocked}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </>
  )
}

function OrgSwitcher() {
  const { memberships, active, setActiveOrgId } = useOrg()
  if (!active) return null
  return (
    <div className="px-3 pb-2">
      <label className="relative flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-sm transition-colors hover:bg-surface-2">
        <Building2 className="size-4 text-muted" />
        <span className="flex-1 truncate font-medium">{active.organisation.name}</span>
        {memberships.length > 1 && <ChevronsUpDown className="size-3.5 text-muted" />}
        {memberships.length > 1 && (
          <select
            aria-label="Switch organisation"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={active.organisation.id}
            onChange={(e) => setActiveOrgId(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.organisation.id} value={m.organisation.id}>
                {m.organisation.name}
              </option>
            ))}
          </select>
        )}
      </label>
    </div>
  )
}

const THEMES: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Theme">
      {THEMES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'flex flex-1 items-center justify-center rounded-md py-1.5 transition-all duration-150',
            theme === value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

function UserMenu() {
  const { data } = useMe()
  const { signOut } = useAuth()
  const profile = data?.profile
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1">
      <NavLink to="/profile" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-2">
        <Avatar name={profile?.full_name ?? profile?.email} src={profile?.avatar_url} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{profile?.full_name ?? 'Your profile'}</span>
          <span className="block truncate text-xs text-muted">{profile?.email}</span>
        </span>
      </NavLink>
      <button onClick={signOut} title="Sign out" className="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg">
        <LogOut className="size-4" />
      </button>
    </div>
  )
}

