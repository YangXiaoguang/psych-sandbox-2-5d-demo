export const ADMIN_GOVERNANCE_SCHEMA = "psych-sandbox-admin-governance";
export const ADMIN_GOVERNANCE_VERSION = 1;

export type AdminAccessRole = "owner" | "admin" | "operator" | "viewer";
export type AdminAccessStatus = "active" | "disabled" | "review_required";
export type AdminWorkspaceScope = "all" | "assigned" | "own";
export type AdminAuditSeverity = "info" | "warning" | "critical";
export type AdminPermissionKey =
  | "users.read"
  | "users.write"
  | "users.archive"
  | "users.import_export"
  | "assets.manage"
  | "llm.manage"
  | "agents.manage"
  | "memory.read"
  | "memory.export"
  | "audit.read"
  | "system.import_export";

export interface AdminPermissionDefinition {
  key: AdminPermissionKey;
  label: string;
  description: string;
  group: "用户" | "资产" | "AI" | "记忆" | "系统";
}

export interface AdminAccessPolicy {
  userId: string;
  role: AdminAccessRole;
  status: AdminAccessStatus;
  workspaceScope: AdminWorkspaceScope;
  deniedPermissions: AdminPermissionKey[];
  note: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export interface AdminGovernanceLog {
  id: string;
  actorUserId: string;
  targetUserId?: string;
  action: string;
  resourceType: "access_policy" | "user_directory" | "bulk_import" | "bulk_export" | "system";
  detail: string;
  severity: AdminAuditSeverity;
  createdAt: string;
}

export interface AdminGovernanceData {
  schema: typeof ADMIN_GOVERNANCE_SCHEMA;
  version: typeof ADMIN_GOVERNANCE_VERSION;
  accessPolicies: AdminAccessPolicy[];
  logs: AdminGovernanceLog[];
  exportedAt?: string;
}
