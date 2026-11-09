import { Link } from 'react-router'
import { EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  return (
    <div className="p-6">
      <EmptyState title="Page not found" action={<Link to="/dashboard" className="text-sm font-medium text-accent">Go to your dashboard</Link>}>
        The page you are looking for doesn't exist or you don't have access to it.
      </EmptyState>
    </div>
  )
}
