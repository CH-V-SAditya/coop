import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, isRouteErrorResponse, Navigate, Outlet, useRouteError } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RequireGuest, RequireOrganisation } from '@/components/layout/guards'
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
      <a href="/dashboard" className="text-sm font-medium text-accent">
        Back to dashboard
      </a>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    errorElement: <RootError />,
    children: [
      {
        element: <RequireGuest />,
        children: [
          { path: '/login', element: page(() => import('@/pages/auth/LoginPage')) },
          { path: '/signup', element: page(() => import('@/pages/auth/SignupPage')) },
        ],
      },
      { path: '/auth/callback', element: page(() => import('@/pages/auth/AuthCallbackPage')) },
      {
        element: <RequireAuth />,
        children: [
          {
            element: (
              <OrgProvider>
                <Outlet />
              </OrgProvider>
            ),
            children: [
              { path: '/invite/:token', element: page(() => import('@/pages/InvitePage')) },
              { path: '/onboarding', element: page(() => import('@/pages/OnboardingPage')) },
              {
                element: <RequireOrganisation />,
                children: [
                  {
                    element: <AppShell />,
                    children: [
                      { path: '/', element: <Navigate to="/dashboard" replace /> },
                      { path: '/dashboard', element: page(() => import('@/pages/DashboardPage')) },
                      { path: '/groups', element: page(() => import('@/pages/groups/GroupsPage')) },
                      {
                        path: '/groups/:groupId',
                        element: page(() => import('@/pages/groups/GroupLayout')),
                        children: [
                          { index: true, element: page(() => import('@/pages/groups/BoardPage')) },
                          { path: 'members', element: page(() => import('@/pages/groups/MembersPage')) },
                        ],
                      },
                      { path: '/tasks/:taskId', element: page(() => import('@/pages/task/TaskPage')) },
                      { path: '/profile', element: page(() => import('@/pages/ProfilePage')) },
                      { path: '*', element: page(() => import('@/pages/NotFoundPage')) },
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
