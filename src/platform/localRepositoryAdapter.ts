import {
  loadAdminGovernance,
  normalizeAdminGovernance,
  saveAdminGovernance,
} from "../admin/localAdminGovernance";
import type { AdminGovernanceData } from "../admin/types";
import { buildMockApiContractReport } from "../api/mockApiAdapter";
import {
  loadPersonalData,
  savePersonalData,
} from "../personal/localMemoryStore";
import type { PersonalDataBundle } from "../personal/types";
import {
  loadAgentConversationsForUser,
  loadSandboxEnvironmentForUser,
  loadSandboxLayoutPreferencesForUser,
  loadSceneForUser,
  saveAgentConversationsForUser,
  saveSandboxEnvironmentForUser,
  saveSandboxLayoutPreferencesForUser,
  saveSceneForUser,
} from "../utils/storage";
import type {
  RepositoryDomainDefinition,
  RepositoryHealthMetric,
  SystemRepositoryReportContext,
  SystemArchitectureReport,
  SystemRepositoryAdapter,
  WorkspaceDirectoryRow,
} from "./repositoryTypes";

const LOCAL_REPOSITORY_DOMAINS: RepositoryDomainDefinition[] = [
  {
    key: "identity",
    label: "身份与用户目录",
    currentStore: "personal-memory-os.accounts / profiles",
    futureApi: "GET /api/admin/users",
    readModel: "分页用户目录、画像详情、登录绑定摘要",
    writeModel: "用户状态、画像字段、注册登录绑定",
    migrationRisk: "warn",
  },
  {
    key: "workspace",
    label: "组织与工作区",
    currentStore: "personal-memory-os.workspaces",
    futureApi: "GET /api/workspaces",
    readModel: "工作区、成员、沙盘档案归属",
    writeModel: "工作区创建、授权范围、归档策略",
    migrationRisk: "warn",
  },
  {
    key: "access",
    label: "后台权限治理",
    currentStore: "admin-governance.accessPolicies",
    futureApi: "GET /api/admin/access-policies",
    readModel: "角色权限矩阵、审计日志、访问范围",
    writeModel: "角色调整、批量复核、权限策略导入",
    migrationRisk: "ok",
  },
  {
    key: "sandtray",
    label: "沙盘场景与作品",
    currentStore: "scene / sandtraySessions by user",
    futureApi: "GET /api/sandtray/sessions",
    readModel: "当前草稿、历史快照、事件流",
    writeModel: "自动保存、归档、恢复、PNG/JSON 导出",
    migrationRisk: "warn",
  },
  {
    key: "memory",
    label: "个人记忆与 Context Packet",
    currentStore: "memoryCandidates / blockRules",
    futureApi: "GET /api/memory/context-packet",
    readModel: "记忆候选、阻断规则、AI 可用上下文",
    writeModel: "确认、驳回、合并、屏蔽",
    migrationRisk: "ok",
  },
  {
    key: "conversation",
    label: "Agent 会话",
    currentStore: "agent-conversations by user",
    futureApi: "GET /api/agent/conversations",
    readModel: "会话列表、流式消息、Agent 归属",
    writeModel: "会话保存、消息追加、会话归档",
    migrationRisk: "warn",
  },
  {
    key: "asset",
    label: "沙具资产库",
    currentStore: "managed-assets",
    futureApi: "GET /api/assets",
    readModel: "300+ 沙具目录、标签、风险、模型配方",
    writeModel: "资产 CRUD、批量启停、健康检查",
    migrationRisk: "ok",
  },
  {
    key: "llm",
    label: "LLM 与 Agent 配置",
    currentStore: "llm-providers / psych-agents",
    futureApi: "GET /api/admin/llm-providers",
    readModel: "供应商配置、Agent 角色、调用状态",
    writeModel: "密钥配置、模型默认值、Agent 草拟",
    migrationRisk: "risk",
  },
];

export const localRepositoryAdapter: SystemRepositoryAdapter = {
  adapterName: "LocalStorageRepositoryAdapter.v1",
  mode: "localStorage",
  personal: {
    load: loadPersonalData,
    save: savePersonalData,
  },
  admin: {
    load: loadAdminGovernance,
    save: saveAdminGovernance,
    normalize: normalizeAdminGovernance,
  },
  workspace: {
    loadScene: loadSceneForUser,
    saveScene: saveSceneForUser,
    loadEnvironment: loadSandboxEnvironmentForUser,
    saveEnvironment: saveSandboxEnvironmentForUser,
    loadLayout: loadSandboxLayoutPreferencesForUser,
    saveLayout: saveSandboxLayoutPreferencesForUser,
    loadAgentConversations: loadAgentConversationsForUser,
    saveAgentConversations: saveAgentConversationsForUser,
  },
  buildReport: buildLocalRepositoryReport,
};

export function buildLocalRepositoryReport(
  personalData: PersonalDataBundle,
  adminGovernance: AdminGovernanceData,
  context: SystemRepositoryReportContext = {},
): SystemArchitectureReport {
  const activeUsers = personalData.accounts.filter((account) => account.status === "active").length;
  const disabledPolicies = adminGovernance.accessPolicies.filter((policy) => policy.status === "disabled").length;
  const reviewPolicies = adminGovernance.accessPolicies.filter((policy) => policy.status === "review_required").length;
  const workspaceRows = buildWorkspaceRows(personalData, adminGovernance);
  const metrics: RepositoryHealthMetric[] = [
    {
      label: "用户目录",
      value: String(personalData.accounts.length),
      tone: personalData.accounts.length > 1000 ? "warn" : "ok",
      detail: `${activeUsers} 个正常用户，当前仍使用浏览器本地分页。`,
    },
    {
      label: "工作区",
      value: String(workspaceRows.length),
      tone: "ok",
      detail: "已按 userId 形成工作区归属，后端迁移时可映射为 organization/workspace 表。",
    },
    {
      label: "权限策略",
      value: String(adminGovernance.accessPolicies.length),
      tone: reviewPolicies > 0 || disabledPolicies > 0 ? "warn" : "ok",
      detail: `${reviewPolicies} 条待复核，${disabledPolicies} 条停用。`,
    },
    {
      label: "沙盘档案",
      value: String(personalData.sandtraySessions.length),
      tone: personalData.sandtraySessions.length > 5000 ? "warn" : "ok",
      detail: "历史作品已经按 userId / workspaceId 建立归属字段。",
    },
    {
      label: "记忆候选",
      value: String(personalData.memoryCandidates.length),
      tone: "ok",
      detail: "Context Packet 可由服务端按授权范围重建。",
    },
    {
      label: "密钥存储",
      value: "本地",
      tone: "risk",
      detail: "生产版本必须迁移到服务端加密存储或托管密钥服务。",
    },
  ];

  return {
    adapterName: localRepositoryAdapter.adapterName,
    mode: localRepositoryAdapter.mode,
    generatedAt: new Date().toISOString(),
    metrics,
    domains: LOCAL_REPOSITORY_DOMAINS,
    workspaces: workspaceRows,
    apiContract: buildMockApiContractReport({
      personalData,
      adminGovernance,
      managedAssets: context.managedAssets,
      llmProviders: context.llmProviders,
      agents: context.agents,
      activeUserId: personalData.activeUserId,
    }),
    migrationSteps: [
      "将 PersonalDataBundle 拆分为 users / profiles / consents / workspaces / memories / audit_logs 表。",
      "将 AdminGovernanceData 迁移为 access_policies / admin_audit_logs，并保留 userId 外键。",
      "把沙盘草稿、环境、布局、Agent 会话改为按 userId + workspaceId 服务端分页查询。",
      "把 LLM API Key 从 localStorage 移到服务端加密存储，前端只保留 providerId 和模型选择。",
      "在仓储层实现同名 API Adapter，替换 localRepositoryAdapter 后保持组件调用不变。",
    ],
  };
}

function buildWorkspaceRows(
  personalData: PersonalDataBundle,
  adminGovernance: AdminGovernanceData,
): WorkspaceDirectoryRow[] {
  const accountByUserId = new Map(personalData.accounts.map((account) => [account.userId, account]));
  const sessionCounts = new Map<string, number>();
  personalData.sandtraySessions.forEach((session) => {
    const key = session.workspaceId ?? `user:${session.userId}`;
    sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
  });
  const policyByUserId = new Map(adminGovernance.accessPolicies.map((policy) => [policy.userId, policy]));

  return personalData.workspaces
    .map((workspace) => {
      const owner = accountByUserId.get(workspace.userId);
      const policy = policyByUserId.get(workspace.userId);
      return {
        workspaceId: workspace.workspaceId,
        title: workspace.title,
        ownerUserId: workspace.userId,
        ownerName: owner?.displayName ?? "未知用户",
        active: workspace.active,
        sessionCount: sessionCounts.get(workspace.workspaceId) ?? sessionCounts.get(`user:${workspace.userId}`) ?? 0,
        accessScopeSummary: policy ? `${policy.role} / ${policy.workspaceScope}` : "viewer / own",
        updatedAt: workspace.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
