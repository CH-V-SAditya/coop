export type TaskStatus = 'draft' | 'ready' | 'in_progress' | 'blocked' | 'in_review' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type BlockerStatus = 'potential' | 'reported' | 'confirmed' | 'resolved' | 'dismissed'
export type BlockerCategory = 'approval' | 'information' | 'dependency' | 'resource' | 'technical' | 'external' | 'other'
export type OrgRole = 'owner' | 'admin' | 'member'
export type GroupRole = 'admin' | 'member'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  job_title: string | null
  bio: string | null
  timezone: string | null
}

export type Organisation = { id: string; name: string; slug: string; task_key_prefix: string }

export type Membership = {
  id: string
  role: OrgRole
  title: string | null
  organisation: Organisation
}

export type Me = { profile: Profile; memberships: Membership[] }

export type GroupSummary = {
  id: string
  name: string
  goal: string | null
  description: string | null
  my_role: GroupRole | null
  group_members: { count: number }[]
  task_total: number
  task_completed: number
  task_blocked: number
}

export type GroupMember = {
  id: string // group_members.id
  group_id: string
  organisation_member_id: string
  user_id: string
  role: GroupRole
  functional_role: string | null
  role_source: 'admin' | 'ai' | 'self' | null
  can_create_tasks: boolean
  can_schedule_tasks: boolean
  can_assign_tasks: boolean
  can_upload_context: boolean
  full_name: string | null
  email: string
  avatar_url: string | null
  job_title: string | null
}

export type Viewer = {
  userId: string
  memberId: string | null
  orgRole: OrgRole | null
  isGroupAdmin: boolean
  isGroupMember: boolean
  functionalRole: string | null
  permissions: { canCreateTasks: boolean; canScheduleTasks: boolean; canAssignTasks: boolean; canUploadContext: boolean }
}

export type GroupDetail = {
  group: { id: string; organisation_id: string; name: string; goal: string | null; description: string | null; members_can_upload_context: boolean }
  organisation: { id: string; name: string; task_key_prefix: string }
  members: GroupMember[]
  viewer: Viewer
}

export type BoardTask = {
  id: string
  task_key: string
  task_number: number
  title: string
  status: TaskStatus
  progress: number
  priority: Priority
  due_date: string | null
  owner_id: string | null
  owner_name: string | null
  owner_avatar_url: string | null
  owner_user_id: string | null
  reviewer_id: string | null
  parent_task_id: string | null
  unmet_dependency_count: number
  open_blocker_count: number
  subtask_count: number
  version: number
}

export type RelatedTask = {
  id: string
  task_key: string
  title: string
  status: TaskStatus
  progress: number
  owner_name: string | null
  due_date: string | null
  unmet_dependency_count: number
}

export type Blocker = {
  id: string
  title: string
  description: string | null
  category: BlockerCategory
  status: BlockerStatus
  source: 'manual' | 'ai_inferred'
  suggested_resolution: string | null
  downstream_impact: string | null
  resolution_note: string | null
  reported_by: string | null
  created_at: string
  confirmed_at: string | null
  resolved_at: string | null
}

export type TaskEvent = {
  id: number
  event_type: string
  actor_id: string | null
  actor_kind: 'user' | 'system' | 'ai' | 'agent'
  from_status: TaskStatus | null
  to_status: TaskStatus | null
  reason: string | null
  payload: Record<string, unknown>
  created_at: string
}

export type Comment = { id: string; author_id: string | null; body: string; created_at: string }

export type TransitionOption = {
  to: TaskStatus
  label: string
  condition: string
  requiresReason: boolean
  disabledReason: string | null
}

export type TaskDetail = {
  task: BoardTask & {
    group_id: string
    organisation_id: string
    description: string | null
    acceptance_criteria: string | null
    start_date: string | null
    estimate_hours: number | null
    created_by: string | null
    created_at: string
    started_at: string | null
    submitted_at: string | null
    completed_at: string | null
    status_changed_at: string
    reviewer_name: string | null
    risk_level: string | null
    ai_summary: string | null
  }
  group: { id: string; name: string; organisation_id: string }
  parent: RelatedTask | null
  dependencies: { id: string; type: string; task: RelatedTask | null }[]
  dependents: { id: string; type: string; task: RelatedTask | null }[]
  blockers: Blocker[]
  events: TaskEvent[]
  comments: Comment[]
  subtasks: RelatedTask[]
  members: GroupMember[]
  people: Record<string, { full_name: string | null; email: string; avatar_url: string | null }>
  viewer: Viewer
  transitions: TransitionOption[]
  can: { edit: boolean; assign: boolean; manageBlockers: boolean; updateProgress: boolean; createSubtask: boolean; delete: boolean }
}

export type MyTask = {
  id: string
  task_key: string
  title: string
  status: TaskStatus
  progress: number
  priority: Priority
  due_date: string | null
  group_id: string
  completed_at: string | null
  unmet_dependency_count: number
  open_blocker_count: number
}

export type OrgMember = {
  id: string
  role: OrgRole
  title: string | null
  user_id: string
  profile: { full_name: string | null; email: string | null; avatar_url: string | null; job_title: string | null } | null
}

/** Prototype mode (no sign-in): a person you can act as. */
export type Person = {
  id: string
  full_name: string | null
  email: string | null
  job_title: string | null
  avatar_url: string | null
  created_at: string
}
