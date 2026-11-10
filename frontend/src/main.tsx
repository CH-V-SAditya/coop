import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ApiError } from '@/lib/api'
import { ActorProvider } from '@/providers/actor'
import { ThemeProvider } from '@/providers/theme'
import { router } from '@/router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for a minute; every write invalidates exactly what it changed.
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      // Don't hammer the API for errors a retry can't fix.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ActorProvider>
          <RouterProvider router={router} />
        </ActorProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
