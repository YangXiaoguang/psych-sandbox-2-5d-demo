import type { PersonalDataBundle } from "../personal/types";
import { createId } from "../utils/id";
import {
  ADMIN_GOVERNANCE_SCHEMA,
  ADMIN_GOVERNANCE_VERSION,
  type AdminAccessPolicy,
  type AdminAccessRole,
  type AdminAuditSeverity,
  type AdminGovernanceData,
  type AdminPermissionDefinition,
  type AdminPermissionKey,
  type AdminWorkspaceScope,
} from "./types";

const ADMIN_GOVERNANCE_KEY = "psych-sandbox-2-5d-demo.admin-governance.v1";

export const ADMIN_PERMISSION_DEFINITIONS: AdminPermissionDefinition[] = [
  { key: "users.read", label: "查看用户", description: "读取用户目录、画像和基本统计。", group: "用户" },
  { key: "users.write", label: "编辑用户", description: "调整用户画像、角色和状态。", group: "用户" },
  { key: "users.archive", label: "归档用户", description: "停用或恢复本地用户。", group: "用户" },
  { key: "users.import_export", label: "用户导入导出", description: "导出用户目录或导入权限策略。", group: "用户" },
  { key: "assets.manage", label: "管理沙具", description: "维护沙具资产库和可见性。", group: "资产" },
  { key: "llm.manage", label: "管理 LLM", description: "维护模型供应商与 API Key 配置。", group: "AI" },
  { key: "agents.manage", label: "管理 Agent", description: "创建、编辑和停用心理学家 Agent。", group: "AI" },
  { key: "memory.read", label: "查看记忆", description: "查看个人记忆候选和 Context Packet。", group: "记忆" },
  { key: "memory.export", label: "导出记忆", description: "导出个人档案、沙盘历史和记忆包。", group: "记忆" },
  { key: "audit.read", label: "查看审计", description: "查看用户与后台操作审计记录。", group: "系统" },
  { key: "system.import_export", label: "系统导入导出", description: "导出或导入管理后台配置。", group: "系统" },
];

export const ADMIN_ROLE_PERMISSIONS: Record<AdminAccessRole, AdminPermissionKey[]> = {
  owner: ADMIN_PERMISSION_DEFINITIONS.map((definition) => definition.key),
  admin: [
    "users.read",
    "users.write",
    "users.archive",
    "users.import_export",
    "assets.manage",
    "llm.manage",
    "agents.manage",
    "memory.read",
    "memory.export",
    "audit.read",
  ],
  operator: ["users.read", "users.write", "assets.manage", "agents.manage", "memory.read", "audit.read"],
  viewer: ["users.read", "memory.read", "audit.read"],
};

export function loadAdminGovernance(personalData: PersonalDataBundle): AdminGovernanceData {
  const parsed = readJson<AdminGovernanceData>(ADMIN_GOVERNANCE_KEY);
  if (!isAdminGovernanceData(parsed)) {
    const data = createDefaultAdminGovernance(personalData);
    saveAdminGovernance(data);
    return data;
  }
  return normalizeAdminGovernance(parsed, personalData);
}

export function saveAdminGovernance(data: AdminGovernanceData): void {
  writeJson(ADMIN_GOVERNANCE_KEY, data);
}

export function createDefaultAdminGovernance(personalData: PersonalDataBundle): AdminGovernanceData {
  const now = new Date().toISOString();
  const accessPolicies = personalData.accounts.map((account) =>
    createAccessPolicy(account.userId, account.userId === personalData.activeUserId ? "owner" : "viewer", now),
  );
  return {
    schema: ADMIN_GOVERNANCE_SCHEMA,
    version: ADMIN_GOVERNANCE_VERSION,
    accessPolicies,
    logs: [
      createAdminGovernanceLog({
        actorUserId: personalData.activeUserId,
        action: "admin_governance_initialized",
        resourceType: "system",
        detail: "已初始化本地后台权限治理模型，当前活跃用户被设为 Owner。",
        severity: "info",
        now,
      }),
    ],
  };
}

export function normalizeAdminGovernance(
  data: AdminGovernanceData,
  personalData: PersonalDataBundle,
): AdminGovernanceData {
  const now = new Date().toISOString();
  const existingByUserId = new Map(data.accessPolicies.map((policy) => [policy.userId, policy]));
  const normalizedPolicies = personalData.accounts.map((account) => {
    const existing = existingByUserId.get(account.userId);
    if (existing) {
      return normalizeAccessPolicy(existing);
    }
    return createAccessPolicy(account.userId, account.userId === personalData.activeUserId ? "owner" : "viewer", now);
  });

  const changed =
    normalizedPolicies.length !== data.accessPolicies.length ||
    normalizedPolicies.some((policy, index) => JSON.stringify(policy) !== JSON.stringify(data.accessPolicies[index]));

  if (!changed && data.schema === ADMIN_GOVERNANCE_SCHEMA && data.version === ADMIN_GOVERNANCE_VERSION) {
    return data;
  }

  return {
    schema: ADMIN_GOVERNANCE_SCHEMA,
    version: ADMIN_GOVERNANCE_VERSION,
    accessPolicies: normalizedPolicies,
    logs: data.logs.slice(0, 300),
  };
}

export function upsertAdminAccessPolicy(
  data: AdminGovernanceData,
  input: {
    actorUserId: string;
    userId: string;
    patch: Partial<Pick<AdminAccessPolicy, "role" | "status" | "workspaceScope" | "deniedPermissions" | "note" | "lastReviewedAt">>;
    detail: string;
    severity?: AdminAuditSeverity;
  },
): AdminGovernanceData {
  const now = new Date().toISOString();
  const existing = data.accessPolicies.find((policy) => policy.userId === input.userId);
  const nextPolicy = normalizeAccessPolicy({
    ...(existing ?? createAccessPolicy(input.userId, "viewer", now)),
    ...input.patch,
    updatedAt: now,
  });
  const nextPolicies = existing
    ? data.accessPolicies.map((policy) => (policy.userId === input.userId ? nextPolicy : policy))
    : [nextPolicy, ...data.accessPolicies];
  return appendAdminGovernanceLog(
    {
      ...data,
      accessPolicies: nextPolicies,
    },
    {
      actorUserId: input.actorUserId,
      targetUserId: input.userId,
      action: "access_policy_updated",
      resourceType: "access_policy",
      detail: input.detail,
      severity: input.severity ?? "info",
    },
  );
}

export function appendAdminGovernanceLog(
  data: AdminGovernanceData,
  input: {
    actorUserId: string;
    targetUserId?: string;
    action: string;
    resourceType: "access_policy" | "user_directory" | "bulk_import" | "bulk_export" | "system";
    detail: string;
    severity?: AdminAuditSeverity;
  },
): AdminGovernanceData {
  return {
    ...data,
    logs: [
      createAdminGovernanceLog({
        ...input,
        severity: input.severity ?? "info",
        now: new Date().toISOString(),
      }),
      ...data.logs,
    ].slice(0, 300),
  };
}

export function getEffectivePermissions(policy: AdminAccessPolicy): AdminPermissionKey[] {
  if (policy.status !== "active") {
    return [];
  }
  const denied = new Set(policy.deniedPermissions);
  return ADMIN_ROLE_PERMISSIONS[policy.role].filter((permission) => !denied.has(permission));
}

function createAccessPolicy(userId: string, role: AdminAccessRole, now: string): AdminAccessPolicy {
  const workspaceScope: AdminWorkspaceScope = role === "owner" || role === "admin" ? "all" : role === "operator" ? "assigned" : "own";
  return {
    userId,
    role,
    status: "active",
    workspaceScope,
    deniedPermissions: [],
    note: "",
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: now,
  };
}

function createAdminGovernanceLog(input: {
  actorUserId: string;
  targetUserId?: string;
  action: string;
  resourceType: "access_policy" | "user_directory" | "bulk_import" | "bulk_export" | "system";
  detail: string;
  severity: AdminAuditSeverity;
  now: string;
}) {
  return {
    id: createId("admin_log"),
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    action: input.action,
    resourceType: input.resourceType,
    detail: input.detail,
    severity: input.severity,
    createdAt: input.now,
  };
}

function normalizeAccessPolicy(policy: AdminAccessPolicy): AdminAccessPolicy {
  return {
    ...policy,
    status: ["active", "disabled", "review_required"].includes(policy.status) ? policy.status : "review_required",
    role: ["owner", "admin", "operator", "viewer"].includes(policy.role) ? policy.role : "viewer",
    workspaceScope: ["all", "assigned", "own"].includes(policy.workspaceScope) ? policy.workspaceScope : "own",
    deniedPermissions: policy.deniedPermissions.filter((permission) =>
      ADMIN_PERMISSION_DEFINITIONS.some((definition) => definition.key === permission),
    ),
    note: policy.note ?? "",
  };
}

function isAdminGovernanceData(value: unknown): value is AdminGovernanceData {
  if (!value || typeof value !== "object") {
    return false;
  }
  const data = value as Partial<AdminGovernanceData>;
  return (
    data.schema === ADMIN_GOVERNANCE_SCHEMA &&
    data.version === ADMIN_GOVERNANCE_VERSION &&
    Array.isArray(data.accessPolicies) &&
    Array.isArray(data.logs)
  );
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
