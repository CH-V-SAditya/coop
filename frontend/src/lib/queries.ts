import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { api } from './api'
import type { BoardTask, GroupDetail, GroupSummary, Invitation, Me, MyTask, OrgMember, TaskDetail } from './types'

export const keys = {
  me: ['me'] as const,
  myTasks: ['my-tasks'] as const,
  groups: (orgId: string) => ['groups', orgId] as const,
  group: (groupId: string) => ['group', groupId] as const,
  board: (groupId: string) => ['board', groupId] as const,
  task: (taskId: string) => ['task', taskId] as const,
  orgMembers: (orgId: string) => ['org-members', orgId] as const,
  invitations: (orgId: string) => ['invitations', orgId] as const,
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.get<Me>('/me') })

export const useMyTasks = () =>
  useQuery({ queryKey: keys.myTasks, queryFn: () => api.get<{ tasks: MyTask[]; groups: { id: string; name: string }[] }>('/me/tasks') })

export const useGroups = (orgId?: string) =>
  useQuery({
    queryKey: keys.groups(orgId ?? ''),
    queryFn: () => api.get<GroupSummary[]>(`/organisations/${orgId}/groups`),
    enabled: Boolean(orgId),
  })

export const useGroup = (groupId: string) =>
  useQuery({ queryKey: keys.group(groupId), queryFn: () => api.get<GroupDetail>(`/groups/${groupId}`) })

export const useBoard = (groupId: string) =>
  useQuery({ queryKey: keys.board(groupId), queryFn: () => api.get<BoardTask[]>(`/groups/${groupId}/tasks`) })

export const useTask = (taskId: string) =>
  useQuery({ queryKey: keys.task(taskId), queryFn: () => api.get<TaskDetail>(`/tasks/${taskId}`) })

export const useOrgMembers = (orgId?: string) =>
  useQuery({
    queryKey: keys.orgMembers(orgId ?? ''),
    queryFn: () => api.get<OrgMember[]>(`/organisations/${orgId}/members`),
    enabled: Boolean(orgId),
  })

export const useInvitations = (orgId?: string, enabled = true) =>
  useQuery({
    queryKey: keys.invitations(orgId ?? ''),
    queryFn: () => api.get<Invitation[]>(`/organisations/${orgId}/invitations`),
    enabled: Boolean(orgId) && enabled,
  })

/**
 * A mutation that invalidates the given query keys on success.
 * Every write goes to the backend; Postgres decides whether it is allowed.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: QueryKey[] | ((vars: TVars, result: TResult) => QueryKey[]),
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      const list = typeof invalidate === 'function' ? invalidate(vars, result) : invalidate
      await Promise.all(list.map((queryKey) => qc.invalidateQueries({ queryKey })))
    },
  })
}
