import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, isRouteErrorResponse, Outlet, useRouteError } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RequireActor, RequireOrganisation } from '@/components/layout/guards'
import { PageSkeleton } from '@/components/ui'
import { OrgProvider } from '@/providers/org'

// Every page is code-split and loaded on demand (lazy loading).
const page = (loader: () => Promise<{ default: ComponentType }>) => {
  const Component = lazy(loader)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  )
}

function RootError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unknown error'
  return (
    <div className="mx-auto max-w-md space-y-2 p-10 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">{message}</p>
      <a href="/dashboard" className="text-sm font-medium text-accent-ink">
        Back to dashboard
      </a>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    errorElement: <RootError />,
    children: [
      // Public marketing page; CTAs lead to /welcome.
      { path: '/', element: page(() => import('@/features/landing/LandingPage')) },
      // Prototype mode (no sign-in): choose or create the person you act as.
      { path: '/welcome', element: page(() => import('@/features/people/ChoosePersonPage')) },
      {
        element: <RequireActor />,
        children: [
          {
            element: (
              <OrgProvider>
                <Outlet />
              </OrgProvider>
            ),
            children: [
              { path: '/onboarding', element: page(() => import('@/features/onboarding/OnboardingPage')) },
              {
                element: <RequireOrganisation />,
                children: [
                  {
                    element: <AppShell />,
                    children: [
                      { path: '/dashboard', element: page(() => import('@/features/dashboard/DashboardPage')) },
                      { path: '/groups', element: page(() => import('@/features/groups/GroupsPage')) },
                      {
                        path: '/groups/:groupId',
                        element: page(() => import('@/features/groups/GroupLayout')),
                        children: [
                          { index: true, element: page(() => import('@/features/groups/BoardPage')) },
                          { path: 'members', element: page(() => import('@/features/groups/MembersPage')) },
                        ],
                      },
                      { path: '/tasks/:taskId', element: page(() => import('@/features/tasks/TaskPage')) },
                      { path: '/profile', element: page(() => import('@/features/profile/ProfilePage')) },
                      { path: '*', element: page(() => import('@/features/not-found/NotFoundPage')) },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
