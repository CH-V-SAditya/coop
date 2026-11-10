import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keys } from '@/lib/queries'
import type { TaskDetail } from '@/lib/types'

/**
 * Runs a task mutation, tracks pending/error state, and refreshes every view
 * that the task engine may have changed (task, board, dashboard, neighbours).
 */
export function useTaskAction(detail: TaskDetail) {
  const qc = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setPending(label)
    setError(null)
    try {
      await fn()
      return true
    } catch (err) {
      setError(err)
      return false
    } finally {
      setPending(null)
      const neighbours = [...detail.dependents, ...detail.dependencies].map((d) => d.task?.id).filter(Boolean) as string[]
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.task(detail.task.id) }),
        qc.invalidateQueries({ queryKey: keys.board(detail.group.id) }),
        qc.invalidateQueries({ queryKey: keys.myTasks }),
        qc.invalidateQueries({ queryKey: keys.groups(detail.group.organisation_id) }),
        ...neighbours.map((id) => qc.invalidateQueries({ queryKey: keys.task(id) })),
        detail.task.parent_task_id ? qc.invalidateQueries({ queryKey: keys.task(detail.task.parent_task_id) }) : null,
      ])
    }
  }

  return { run, pending, error, setError }
}
