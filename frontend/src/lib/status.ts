import type { BlockerCategory, BlockerStatus, Priority, TaskStatus } from './types'

export const STATUS_META: Record<TaskStatus, { label: string; tone: string; dot: string }> = {
  draft: { label: 'Draft', tone: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', dot: 'bg-zinc-400' },
  ready: { label: 'Ready', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300', dot: 'bg-sky-500' },
  in_progress: { label: 'In progress', tone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300', dot: 'bg-indigo-500' },
  blocked: { label: 'Blocked', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', dot: 'bg-rose-500' },
  in_review: { label: 'In review', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', dot: 'bg-amber-500' },
  completed: { label: 'Completed', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', tone: 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-900 dark:text-zinc-500', dot: 'bg-zinc-300' },
}

export const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  low: { label: 'Low', tone: 'text-zinc-500' },
  medium: { label: 'Medium', tone: 'text-sky-600 dark:text-sky-400' },
  high: { label: 'High', tone: 'text-amber-600 dark:text-amber-400' },
  urgent: { label: 'Urgent', tone: 'text-rose-600 dark:text-rose-400' },
}

export const BLOCKER_STATUS_META: Record<BlockerStatus, { label: string; tone: string; hint: string }> = {
  potential: { label: 'Potential', tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300', hint: 'Inferred by AI, needs human confirmation' },
  reported: { label: 'Reported', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', hint: 'Reported by a person, awaiting confirmation' },
  confirmed: { label: 'Confirmed', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', hint: 'Validated, task is blocked' },
  resolved: { label: 'Resolved', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', hint: 'No longer blocking' },
  dismissed: { label: 'Dismissed', tone: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400', hint: 'Not a real blocker' },
}

export const BLOCKER_CATEGORIES: { value: BlockerCategory; label: string }[] = [
  { value: 'approval', label: 'Waiting for approval' },
  { value: 'information', label: 'Missing information' },
  { value: 'dependency', label: 'Another task / team' },
  { value: 'resource', label: 'People, tools or budget' },
  { value: 'technical', label: 'Technical problem' },
  { value: 'external', label: 'External party' },
  { value: 'other', label: 'Other' },
]

/** The three Kanban columns requested; each card still shows its precise status. */
export const KANBAN_COLUMNS: { id: 'todo' | 'doing' | 'done'; title: string; statuses: TaskStatus[]; dropTargets: TaskStatus[] }[] = [
  { id: 'todo', title: 'Yet to start', statuses: ['draft', 'ready'], dropTargets: ['ready'] },
  { id: 'doing', title: 'In progress', statuses: ['in_progress', 'blocked', 'in_review'], dropTargets: ['in_progress', 'in_review'] },
  { id: 'done', title: 'Done', statuses: ['completed'], dropTargets: ['completed'] },
]

/** Mirror of task_status_transitions (display only; Postgres enforces it). */
export const ALLOWED_TRANSITIONS: Record<TaskStatus, { to: TaskStatus; requiresReason: boolean }[]> = {
  draft: [{ to: 'ready', requiresReason: false }, { to: 'cancelled', requiresReason: true }],
  ready: [{ to: 'in_progress', requiresReason: false }, { to: 'cancelled', requiresReason: true }],
  in_progress: [
    { to: 'blocked', requiresReason: false },
    { to: 'in_review', requiresReason: false },
    { to: 'cancelled', requiresReason: true },
  ],
  blocked: [{ to: 'in_progress', requiresReason: false }, { to: 'cancelled', requiresReason: true }],
  in_review: [
    { to: 'completed', requiresReason: false },
    { to: 'in_progress', requiresReason: true },
    { to: 'cancelled', requiresReason: true },
  ],
  completed: [{ to: 'in_progress', requiresReason: true }],
  cancelled: [],
}

export const EVENT_LABELS: Record<string, string> = {
  created: 'created the task',
  status_changed: 'changed status',
  reopened: 'reopened the task',
  progress_updated: 'updated progress',
  owner_changed: 'changed the owner',
  reviewer_changed: 'changed the reviewer',
  details_updated: 'edited details',
  dependency_added: 'added a prerequisite',
  dependency_removed: 'removed a prerequisite',
  dependency_satisfied: 'All prerequisites done. Task is eligible to start.',
  dependency_reopened: 'A prerequisite was reopened',
  blocker_reported: 'reported a blocker',
  blocker_confirmed: 'confirmed a blocker',
  blocker_resolved: 'resolved a blocker',
  blocker_dismissed: 'dismissed a blocker',
  comment_added: 'commented',
  evidence_added: 'added evidence',
}
