import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, check } from "@/lib/http";

export const TASK_STATUSES = ["draft", "ready", "in_progress", "blocked", "in_review", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const BLOCKER_CATEGORIES = ["approval", "information", "dependency", "resource", "technical", "external", "other"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type GroupViewer = {
  userId: string;
  memberId: string | null; // organisation_members.id
  orgRole: "owner" | "admin" | "member" | null;
  isGroupAdmin: boolean;
  isGroupMember: boolean;
  functionalRole: string | null;
  permissions: {
    canCreateTasks: boolean;
    canScheduleTasks: boolean;
    canAssignTasks: boolean;
    canUploadContext: boolean;
  };
};

type GroupRow = {
  id: string;
  organisation_id: string;
  name: string;
  goal: string | null;
  description: string | null;
  members_can_upload_context: boolean;
};

/** Loads a group (404 if not visible under RLS) and the caller's rights in it. */
export async function getGroupWithViewer(supabase: SupabaseClient, groupId: string, userId: string) {
  const group = check(
    await supabase
      .from("groups")
      .select("id, organisation_id, name, goal, description, members_can_upload_context, created_at")
      .eq("id", groupId)
      .maybeSingle(),
  ) as GroupRow | null;
  if (!group) throw new ApiError(404, "Group not found");

  const [isAdminRes, meRes, orgMemberRes] = await Promise.all([
    supabase.rpc("is_group_admin", { p_group: groupId }),
    supabase.from("group_member_directory").select("*").eq("group_id", groupId).eq("user_id", userId).maybeSingle(),
    supabase
      .from("organisation_members")
      .select("id, role")
      .eq("organisation_id", group.organisation_id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const isGroupAdmin = Boolean(check(isAdminRes));
  const me = check(meRes) as Record<string, unknown> | null;
  const orgMember = check(orgMemberRes) as { id: string; role: GroupViewer["orgRole"] } | null;
  const flag = (key: string) => isGroupAdmin || Boolean(me?.[key]);

  const viewer: GroupViewer = {
    userId,
    memberId: orgMember?.id ?? null,
    orgRole: orgMember?.role ?? null,
    isGroupAdmin,
    isGroupMember: Boolean(me),
    functionalRole: (me?.functional_role as string | null) ?? null,
    permissions: {
      canCreateTasks: flag("can_create_tasks"),
      canScheduleTasks: flag("can_schedule_tasks"),
      canAssignTasks: flag("can_assign_tasks"),
      canUploadContext: flag("can_upload_context") || (Boolean(me) && group.members_can_upload_context),
    },
  };

  return { group, viewer };
}

type TransitionRule = {
  from_status: TaskStatus;
  to_status: TaskStatus;
  label: string;
  condition: string;
  allowed_actors: string[];
  requires_reason: boolean;
};

type TaskFacts = {
  status: TaskStatus;
  owner_id: string | null;
  reviewer_id: string | null;
  created_by: string | null;
  unmet_dependency_count: number;
};

/**
 * Which transitions should the UI offer this viewer? Display only: Postgres
 * (transition_task) re-validates every rule and is the source of truth.
 */
export function availableTransitions(
  rules: TransitionRule[],
  task: TaskFacts,
  viewer: GroupViewer,
  confirmedBlockers: number,
) {
  return rules
    .filter((r) => r.from_status === task.status)
    .filter((r) =>
      r.allowed_actors.some(
        (actor) =>
          (actor === "group_admin" && viewer.isGroupAdmin) ||
          (actor === "owner" && task.owner_id !== null && task.owner_id === viewer.memberId) ||
          (actor === "reviewer" && task.reviewer_id !== null && task.reviewer_id === viewer.memberId) ||
          (actor === "creator" && task.created_by === viewer.userId),
      ),
    )
    .map((r) => {
      let disabledReason: string | null = null;
      const needsReadiness = r.to_status === "ready" || (r.from_status === "ready" && r.to_status === "in_progress");
      if (needsReadiness && !task.owner_id) disabledReason = "Assign an owner first";
      else if (needsReadiness && task.unmet_dependency_count > 0)
        disabledReason = `Waiting on ${task.unmet_dependency_count} unfinished dependenc${task.unmet_dependency_count === 1 ? "y" : "ies"}`;
      else if (r.to_status === "blocked" && confirmedBlockers === 0) disabledReason = "Report and confirm a blocker first";
      else if (r.from_status === "blocked" && confirmedBlockers > 0) disabledReason = "Resolve confirmed blockers first";
      return {
        to: r.to_status,
        label: r.label,
        condition: r.condition,
        requiresReason: r.requires_reason,
        disabledReason,
      };
    });
}

/** Resolve display names for a set of user ids (profiles visible under RLS). */
export async function profileMap(supabase: SupabaseClient, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {} as Record<string, { full_name: string | null; email: string; avatar_url: string | null }>;
  const rows = check(await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", unique)) as {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }[];
  return Object.fromEntries(rows.map((r) => [r.id, { full_name: r.full_name, email: r.email, avatar_url: r.avatar_url }]));
}
