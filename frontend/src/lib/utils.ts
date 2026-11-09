import type { GroupMember } from './types'

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function initials(name?: string | null, fallback = '?') {
  const source = (name ?? '').trim()
  if (!source) return fallback
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || fallback
}

export function formatDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

export function timeAgo(value: string) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(-Math.round(seconds / size), unit)
  return 'just now'
}

/** Overdue = due date before today and not finished. */
export function isOverdue(due: string | null, status: string) {
  if (!due || status === 'completed' || status === 'cancelled') return false
  return new Date(`${due}T23:59:59`) < new Date()
}

/** 'Asha Rao · Frontend' */
export const memberLabel = (m: GroupMember) => `${m.full_name ?? m.email}${m.functional_role ? ` · ${m.functional_role}` : ''}`
