import {
  Archive,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Eye,
  Info,
  KeyRound,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Workflow,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROLE_PERMISSIONS,
  appendAdminGovernanceLog,
  createDefaultAdminGovernance,
  getEffectivePermissions,
  upsertAdminAccessPolicy,
} from "../admin/localAdminGovernance";
import type {
  AdminAccessPolicy,
  AdminAccessRole,
  AdminAccessStatus,
  AdminGovernanceData,
  AdminPermissionKey,
  AdminWorkspaceScope,
} from "../admin/types";
import { loadLocalAuthIdentities } from "../auth/localAuth";
import { ASSET_CATEGORIES, RISK_LABELS } from "../data/assets";
import { createDefaultLlmProviders, createDefaultPsychAgents } from "../data/defaultAgents";
import { getToyAssetSpec } from "../data/toyAssetSpecs";
import { getProviderLabel, getProviderPreset, PROVIDER_PRESETS } from "../llm/providerPresets";
import { getUserConsents, recordPersonalAudit } from "../personal/localMemoryStore";
import type {
  ConsentType,
  IdentityProfile,
  PersonalAccount,
  PersonalAccountStatus,
  PersonalAgeGroup,
  PersonalDataBundle,
  PersonalRole,
} from "../personal/types";
import { REPOSITORY_MODE_OPTIONS } from "../platform/repositoryAdapterRegistry";
import type { RepositoryMode, SystemArchitectureReport } from "../platform/repositoryTypes";
import type {
  AgentAvatarStyle,
  LlmProviderConfig,
  LlmProviderKind,
  ManagedAsset,
  PsychAgentProfile,
  RiskTag,
  ToyModelRecipe,
} from "../types";
import { createId } from "../utils/id";
import { AgentPortrait } from "./AgentPortrait";
import { AssetPreview } from "./AssetPreview";
import { RiskTagBadge } from "./RiskTagBadge";

type AdminTab = "users" | "access" | "system" | "assets" | "llm" | "agents";
type ToyRecipeKind = ToyModelRecipe["kind"];
type UserAuthFilter = "all" | "bound" | "guest";
type UserStatusFilter = "all" | PersonalAccountStatus;
type AssetStatusFilter = "all" | "enabled" | "disabled" | "deleted";
type AssetOriginFilter = "all" | "builtin" | "custom";
type AssetViewMode = "table" | "grid";
type AssetSortKey = "updatedAt" | "name" | "category" | "riskTag" | "status";
type ConfigStatusTone = "ok" | "warn" | "error";
type UserDetailTab = "overview" | "edit" | "access" | "audit";

interface AdminDashboardProps {
  personalData: PersonalDataBundle;
  adminGovernance: AdminGovernanceData;
  repositoryReport: SystemArchitectureReport;
  repositoryMode: RepositoryMode;
  managedAssets: ManagedAsset[];
  llmProviders: LlmProviderConfig[];
  agents: PsychAgentProfile[];
  onPersonalDataChange: (data: PersonalDataBundle) => void;
  onAdminGovernanceChange: (data: AdminGovernanceData) => void;
  onRepositoryModeChange: (mode: RepositoryMode) => void;
  onManagedAssetsChange: (assets: ManagedAsset[]) => void;
  onLlmProvidersChange: (providers: LlmProviderConfig[]) => void;
  onAgentsChange: (agents: PsychAgentProfile[]) => void;
  onResetAssets: () => void;
}

interface AdminConfigBackup {
  schema: "psych-sandbox-admin-config";
  version: 1 | 2;
  exportedAt: string;
  adminGovernance?: AdminGovernanceData;
  managedAssets: ManagedAsset[];
  llmProviders: LlmProviderConfig[];
  agents: PsychAgentProfile[];
}

interface AdminUserDirectoryExport {
  schema: "psych-sandbox-admin-user-directory";
  version: 1;
  exportedAt: string;
  accounts: Array<Pick<PersonalAccount, "userId" | "localHandle" | "displayName" | "status" | "createdAt" | "lastActiveAt">>;
  profiles: IdentityProfile[];
  accessPolicies: AdminAccessPolicy[];
  authBindings: Array<{ userId: string; email: string; status: string; lastLoginAt?: string }>;
}

const RISK_OPTIONS: RiskTag[] = ["normal", "conflict", "death", "fantasy"];
const MODEL_KINDS: ToyRecipeKind[] = [
  "person",
  "dog",
  "bird",
  "fish",
  "lion",
  "house",
  "bridge",
  "fence",
  "tower",
  "tree",
  "water",
  "rock",
  "sun",
  "monster",
  "robot",
  "skull",
  "light",
  "fallback",
];
const PROVIDER_KINDS = Object.keys(PROVIDER_PRESETS) as LlmProviderKind[];
const AVATAR_STYLES: AgentAvatarStyle[] = ["warm", "dream", "analyst", "sage", "mentor"];
const USER_PAGE_SIZE = 50;

const AGE_GROUP_LABELS: Record<PersonalAgeGroup, string> = {
  child: "儿童",
  teen: "青少年",
  adult: "成人",
  elder: "长者",
  unknown: "未指定",
};

const ROLE_LABELS: Record<PersonalRole, string> = {
  client: "来访者",
  student: "学生",
  parent: "家长",
  clinician: "咨询师",
  researcher: "研究者",
  demo: "本地原型",
};

const ACCOUNT_STATUS_LABELS: Record<PersonalAccountStatus, string> = {
  active: "正常",
  archived: "归档",
};

const CONSENT_LABELS: Record<ConsentType, string> = {
  service_usage: "使用本地沙盘服务",
  sandtray_archive: "保存沙盘作品",
  conversation_archive: "保存 AI 对话记录",
  long_term_memory: "长期记忆候选",
  ai_personalization: "AI 个性化上下文",
  export_archive: "导出个人档案",
};

const ADMIN_ACCESS_ROLE_LABELS: Record<AdminAccessRole, string> = {
  owner: "所有者",
  admin: "管理员",
  operator: "运营人员",
  viewer: "只读观察",
};

const ADMIN_ACCESS_STATUS_LABELS: Record<AdminAccessStatus, string> = {
  active: "可用",
  disabled: "停用",
  review_required: "待复核",
};

const ADMIN_WORKSPACE_SCOPE_LABELS: Record<AdminWorkspaceScope, string> = {
  all: "全部工作区",
  assigned: "指定工作区",
  own: "仅本人工作区",
};

const ADMIN_ACCESS_ROLE_ORDER: AdminAccessRole[] = ["owner", "admin", "operator", "viewer"];

interface UserAdminRow {
  account: PersonalAccount;
  profile: IdentityProfile | null;
  accessPolicy: AdminAccessPolicy;
  authEmail?: string;
  authStatus: "bound" | "guest";
  workspaceCount: number;
  sessionCount: number;
  memoryCount: number;
  confirmedMemoryCount: number;
  consentGranted: number;
  consentTotal: number;
  lastAuditAt?: string;
}

export function AdminDashboard({
  personalData,
  adminGovernance,
  repositoryReport,
  repositoryMode,
  managedAssets,
  llmProviders,
  agents,
  onPersonalDataChange,
  onAdminGovernanceChange,
  onRepositoryModeChange,
  onManagedAssetsChange,
  onLlmProvidersChange,
  onAgentsChange,
  onResetAssets,
}: AdminDashboardProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [configStatus, setConfigStatus] = useState<{ tone: ConfigStatusTone; text: string } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const exportAdminConfig = () => {
    const exportedAt = new Date().toISOString();
    downloadJsonFile(`psych-sandbox-admin-config-${exportedAt.slice(0, 10)}.json`, {
      schema: "psych-sandbox-admin-config",
      version: 2,
      exportedAt,
      adminGovernance,
      managedAssets,
      llmProviders,
      agents,
    } satisfies AdminConfigBackup);
    setConfigStatus({ tone: "ok", text: "已导出本地配置 JSON，包含权限治理、沙具、LLM 与 Agent 配置。" });
  };

  const importAdminConfig = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAdminConfigBackup(parsed)) {
        throw new Error("文件结构不符合 psych-sandbox-admin-config v1/v2。");
      }
      onManagedAssetsChange(parsed.managedAssets);
      onLlmProvidersChange(parsed.llmProviders);
      onAgentsChange(parsed.agents);
      if (parsed.adminGovernance) {
        onAdminGovernanceChange(parsed.adminGovernance);
      }
      setConfigStatus({
        tone: "ok",
        text: `已导入 ${parsed.managedAssets.length} 个沙具、${parsed.llmProviders.length} 个 LLM 配置、${parsed.agents.length} 个 Agent${parsed.adminGovernance ? "和权限治理配置" : ""}。`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConfigStatus({ tone: "error", text: `导入失败：${message}` });
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const resetAdminConfig = () => {
    onResetAssets();
    onLlmProvidersChange(createDefaultLlmProviders());
    onAgentsChange(createDefaultPsychAgents());
    onAdminGovernanceChange(createDefaultAdminGovernance(personalData));
    setConfigStatus({ tone: "warn", text: "已恢复本地默认权限治理、沙具、LLM 与 Agent 配置。" });
  };

  return (
    <main className="admin-shell" aria-label="管理后台">
      <section className="admin-hero">
        <div className="admin-hero-copy">
          <div className="admin-title-line">
            <div>
              <p className="eyebrow">Local Admin Console</p>
              <h2>管理后台</h2>
            </div>
            <button
              type="button"
              className="admin-help-toggle"
              aria-expanded={isHelpOpen}
              onClick={() => setIsHelpOpen((value) => !value)}
            >
              <Info size={14} />
              说明
            </button>
          </div>
          <div className="admin-summary-chips" aria-label="管理后台状态">
            <span>本地 Demo</span>
            <span>用户目录</span>
            <span>沙具资产</span>
            <span>LLM / Agent 配置</span>
            <span>不发送密钥</span>
          </div>
          {isHelpOpen ? (
            <div className="admin-help-popover" role="note">
              <strong>本地管理控制台</strong>
              <p>用于管理用户目录、沙具资产、权限审计、LLM 厂商配置和心理学家 Agent。当前 Demo 只保存到浏览器本地，不会向第三方发送 API Key、沙盘内容或对话内容。</p>
            </div>
          ) : null}
        </div>
        <div className="admin-hero-controls">
          <div className="admin-config-actions" aria-label="本地配置导入导出">
            <button type="button" onClick={exportAdminConfig}>
              <Download size={15} />
              导出配置
            </button>
            <button type="button" onClick={() => importInputRef.current?.click()}>
              <Upload size={15} />
              导入配置
            </button>
            <button type="button" onClick={resetAdminConfig}>
              <RefreshCcw size={15} />
              恢复默认
            </button>
            <input
              ref={importInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json"
              onChange={(event) => {
                void importAdminConfig(event.target.files?.[0] ?? null);
              }}
            />
          </div>
          {configStatus ? (
            <p className={`admin-config-status ${configStatus.tone}`} role="status">
              {configStatus.text}
            </p>
          ) : null}
          <div className="admin-tabbar" role="tablist" aria-label="管理类型">
            <TabButton id="users" label="用户管理" activeTab={activeTab} onSelect={setActiveTab} icon={<Users size={16} />} />
            <TabButton id="access" label="权限审计" activeTab={activeTab} onSelect={setActiveTab} icon={<ShieldCheck size={16} />} />
            <TabButton id="system" label="系统架构" activeTab={activeTab} onSelect={setActiveTab} icon={<Workflow size={16} />} />
            <TabButton id="assets" label="沙具资产" activeTab={activeTab} onSelect={setActiveTab} icon={<Boxes size={16} />} />
            <TabButton id="llm" label="LLM 配置" activeTab={activeTab} onSelect={setActiveTab} icon={<KeyRound size={16} />} />
            <TabButton id="agents" label="Agent 配置" activeTab={activeTab} onSelect={setActiveTab} icon={<Bot size={16} />} />
          </div>
        </div>
      </section>

      {activeTab === "users" ? (
        <UserAdminPanel
          personalData={personalData}
          adminGovernance={adminGovernance}
          onPersonalDataChange={onPersonalDataChange}
          onAdminGovernanceChange={onAdminGovernanceChange}
        />
      ) : null}
      {activeTab === "access" ? (
        <AdminAccessPanel
          personalData={personalData}
          adminGovernance={adminGovernance}
          onAdminGovernanceChange={onAdminGovernanceChange}
        />
      ) : null}
      {activeTab === "system" ? (
        <SystemArchitecturePanel
          report={repositoryReport}
          repositoryMode={repositoryMode}
          onRepositoryModeChange={onRepositoryModeChange}
        />
      ) : null}
      {activeTab === "assets" ? (
        <AssetAdminPanel
          assets={managedAssets}
          onAssetsChange={onManagedAssetsChange}
          onResetAssets={onResetAssets}
        />
      ) : null}
      {activeTab === "llm" ? (
        <LlmAdminPanel providers={llmProviders} onProvidersChange={onLlmProvidersChange} />
      ) : null}
      {activeTab === "agents" ? (
        <AgentAdminPanel
          agents={agents}
          providers={llmProviders}
          onAgentsChange={onAgentsChange}
        />
      ) : null}
    </main>
  );
}

function TabButton({
  id,
  label,
  activeTab,
  onSelect,
  icon,
}: {
  id: AdminTab;
  label: string;
  activeTab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  icon: JSX.Element;
}): JSX.Element {
  return (
    <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => onSelect(id)}>
      {icon}
      {label}
    </button>
  );
}

function UserAdminPanel({
  personalData,
  adminGovernance,
  onPersonalDataChange,
  onAdminGovernanceChange,
}: {
  personalData: PersonalDataBundle;
  adminGovernance: AdminGovernanceData;
  onPersonalDataChange: (data: PersonalDataBundle) => void;
  onAdminGovernanceChange: (data: AdminGovernanceData) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PersonalRole | "all">("all");
  const [ageFilter, setAgeFilter] = useState<PersonalAgeGroup | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [authFilter, setAuthFilter] = useState<UserAuthFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState(() => personalData.activeUserId);
  const [detailTab, setDetailTab] = useState<UserDetailTab | null>(null);

  const authIdentities = useMemo(() => loadLocalAuthIdentities(), [personalData.accounts.length, personalData.activeUserId]);
  const authByUserId = useMemo(
    () => new Map(authIdentities.map((identity) => [identity.userId, identity])),
    [authIdentities],
  );

  const directoryRows = useMemo<UserAdminRow[]>(() => {
    const profileByUserId = new Map(personalData.profiles.map((profile) => [profile.userId, profile]));
    const sessionsByUserId = countByUser(personalData.sandtraySessions);
    const workspacesByUserId = countByUser(personalData.workspaces);
    const memoriesByUserId = countByUser(personalData.memoryCandidates);
    const confirmedMemoriesByUserId = countByUser(
      personalData.memoryCandidates.filter((candidate) => candidate.status === "confirmed"),
    );
    const lastAuditByUserId = new Map<string, string>();
    personalData.auditLogs.forEach((log) => {
      if (!lastAuditByUserId.has(log.userId)) {
        lastAuditByUserId.set(log.userId, log.createdAt);
      }
    });

    return personalData.accounts
      .map((account) => {
        const profile = profileByUserId.get(account.userId) ?? null;
        const accessPolicy = getAccessPolicyForUser(adminGovernance, account.userId);
        const authIdentity = authByUserId.get(account.userId);
        const consents = getUserConsents(personalData, account.userId);
        return {
          account,
          profile,
          accessPolicy,
          authEmail: authIdentity?.email,
          authStatus: authIdentity ? ("bound" as const) : ("guest" as const),
          workspaceCount: workspacesByUserId.get(account.userId) ?? 0,
          sessionCount: sessionsByUserId.get(account.userId) ?? 0,
          memoryCount: memoriesByUserId.get(account.userId) ?? 0,
          confirmedMemoryCount: confirmedMemoriesByUserId.get(account.userId) ?? 0,
          consentGranted: consents.filter((consent) => consent.granted).length,
          consentTotal: consents.length,
          lastAuditAt: lastAuditByUserId.get(account.userId),
        };
      })
      .sort((a, b) => new Date(b.account.lastActiveAt).getTime() - new Date(a.account.lastActiveAt).getTime());
  }, [adminGovernance.accessPolicies, authByUserId, personalData]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return directoryRows.filter((row) => {
      const profile = row.profile;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          row.account.displayName,
          row.account.localHandle,
          row.account.userId,
          row.authEmail ?? "",
          ADMIN_ACCESS_ROLE_LABELS[row.accessPolicy.role],
          ADMIN_ACCESS_STATUS_LABELS[row.accessPolicy.status],
          profile?.displayName ?? "",
          profile ? ROLE_LABELS[profile.role] : "",
          profile ? AGE_GROUP_LABELS[profile.ageGroup] : "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || profile?.role === roleFilter;
      const matchesAge = ageFilter === "all" || profile?.ageGroup === ageFilter;
      const matchesStatus = statusFilter === "all" || row.account.status === statusFilter;
      const matchesAuth = authFilter === "all" || row.authStatus === authFilter;
      return matchesQuery && matchesRole && matchesAge && matchesStatus && matchesAuth;
    });
  }, [ageFilter, authFilter, directoryRows, query, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / USER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * USER_PAGE_SIZE, currentPage * USER_PAGE_SIZE);
  const selectedRow =
    directoryRows.find((row) => row.account.userId === selectedUserId) ??
    filteredRows[0] ??
    directoryRows[0] ??
    null;
  const selectedConsents = selectedRow ? getUserConsents(personalData, selectedRow.account.userId) : [];
  const selectedAudits = selectedRow
    ? personalData.auditLogs.filter((log) => log.userId === selectedRow.account.userId).slice(0, 6)
    : [];
  const activeCount = directoryRows.filter((row) => row.account.status === "active").length;
  const archivedCount = directoryRows.filter((row) => row.account.status === "archived").length;
  const authBoundCount = directoryRows.filter((row) => row.authStatus === "bound").length;
  const authGuestCount = directoryRows.filter((row) => row.authStatus === "guest").length;
  const totalSessionCount = directoryRows.reduce((total, row) => total + row.sessionCount, 0);
  const hasNoSecondaryFilters = query.trim() === "" && roleFilter === "all" && ageFilter === "all";

  useEffect(() => {
    setPage(1);
  }, [ageFilter, authFilter, query, roleFilter, statusFilter]);

  useEffect(() => {
    if (directoryRows.length > 0 && !directoryRows.some((row) => row.account.userId === selectedUserId)) {
      setSelectedUserId(directoryRows[0].account.userId);
    }
  }, [directoryRows, selectedUserId]);

  const updateAccountStatus = (userId: string, status: PersonalAccountStatus) => {
    const now = new Date().toISOString();
    const target = personalData.accounts.find((account) => account.userId === userId);
    if (!target || target.status === status) {
      return;
    }

    const nextData = recordPersonalAudit(
      {
        ...personalData,
        accounts: personalData.accounts.map((account) =>
          account.userId === userId ? { ...account, status, lastActiveAt: now } : account,
        ),
      },
      {
        userId,
        action: status === "archived" ? "admin_user_archived" : "admin_user_activated",
        resourceType: "account",
        resourceId: userId,
        detail: `管理后台已将用户状态调整为：${ACCOUNT_STATUS_LABELS[status]}。`,
      },
    );
    onPersonalDataChange(nextData);
  };

  const updateProfile = (userId: string, patch: Partial<Pick<IdentityProfile, "role" | "ageGroup">>) => {
    const now = new Date().toISOString();
    const nextData = recordPersonalAudit(
      {
        ...personalData,
        profiles: personalData.profiles.map((profile) =>
          profile.userId === userId ? { ...profile, ...patch, updatedAt: now } : profile,
        ),
      },
      {
        userId,
        action: "admin_profile_updated",
        resourceType: "profile",
        resourceId: userId,
        detail: "管理后台更新了用户画像字段。",
      },
    );
    onPersonalDataChange(nextData);
  };

  const updateAccessPolicy = (
    userId: string,
    patch: Partial<Pick<AdminAccessPolicy, "role" | "status" | "workspaceScope" | "note" | "lastReviewedAt">>,
    detail: string,
  ) => {
    onAdminGovernanceChange(
      upsertAdminAccessPolicy(adminGovernance, {
        actorUserId: personalData.activeUserId,
        userId,
        patch,
        detail,
      }),
    );
  };

  const resetUserFilters = () => {
    setQuery("");
    setRoleFilter("all");
    setAgeFilter("all");
    setStatusFilter("all");
    setAuthFilter("all");
  };

  const applyQuickView = (view: "all" | "active" | "archived" | "bound" | "guest") => {
    resetUserFilters();
    if (view === "active" || view === "archived") {
      setStatusFilter(view);
    }
    if (view === "bound" || view === "guest") {
      setAuthFilter(view);
    }
  };

  const openUserDetail = (userId: string, tab: UserDetailTab) => {
    setSelectedUserId(userId);
    setDetailTab(tab);
  };

  const toggleAccountArchive = (row: UserAdminRow) => {
    const nextStatus: PersonalAccountStatus = row.account.status === "archived" ? "active" : "archived";
    const actionLabel = nextStatus === "archived" ? "归档" : "恢复";
    if (!window.confirm(`确认${actionLabel}用户「${row.account.displayName}」吗？`)) {
      return;
    }
    updateAccountStatus(row.account.userId, nextStatus);
  };

  return (
    <section className="user-admin-layout" aria-label="用户管理">
      <aside className="admin-card user-filter-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">User Directory</p>
            <h3>用户检索</h3>
          </div>
          <span className="user-directory-total">{directoryRows.length}</span>
        </header>
        <div className="user-filter-body">
          <label className="user-search-field" aria-label="搜索用户">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="姓名、邮箱、handle、userId..."
            />
          </label>
          <div className="user-view-list" aria-label="快捷视图">
            <button type="button" className={hasNoSecondaryFilters && statusFilter === "all" && authFilter === "all" ? "active" : ""} onClick={() => applyQuickView("all")}>
              全部用户
              <span>{directoryRows.length}</span>
            </button>
            <button type="button" className={hasNoSecondaryFilters && statusFilter === "active" && authFilter === "all" ? "active" : ""} onClick={() => applyQuickView("active")}>
              正常用户
              <span>{activeCount}</span>
            </button>
            <button type="button" className={hasNoSecondaryFilters && statusFilter === "archived" && authFilter === "all" ? "active" : ""} onClick={() => applyQuickView("archived")}>
              归档用户
              <span>{archivedCount}</span>
            </button>
            <button type="button" className={hasNoSecondaryFilters && authFilter === "bound" && statusFilter === "all" ? "active" : ""} onClick={() => applyQuickView("bound")}>
              已绑定邮箱
              <span>{authBoundCount}</span>
            </button>
            <button type="button" className={hasNoSecondaryFilters && authFilter === "guest" && statusFilter === "all" ? "active" : ""} onClick={() => applyQuickView("guest")}>
              本地账号
              <span>{authGuestCount}</span>
            </button>
          </div>
          <div className="user-filter-grid">
            <label>
              <span>角色</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as PersonalRole | "all")}>
                <option value="all">全部角色</option>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>年龄段</span>
              <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as PersonalAgeGroup | "all")}>
                <option value="all">全部年龄段</option>
                {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>状态</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}>
                <option value="all">全部状态</option>
                <option value="active">正常</option>
                <option value="archived">归档</option>
              </select>
            </label>
            <label>
              <span>登录绑定</span>
              <select value={authFilter} onChange={(event) => setAuthFilter(event.target.value as UserAuthFilter)}>
                <option value="all">全部账号</option>
                <option value="bound">已绑定邮箱</option>
                <option value="guest">本地/未绑定</option>
              </select>
            </label>
          </div>
          <div className="user-admin-note">
            <Database size={15} />
            <span>按万级用户目录设计：列表分页、条件过滤、详情侧栏分离；当前数据仍保存在 localStorage，后续可替换为服务端查询接口。</span>
          </div>
        </div>
      </aside>

      <section className="admin-card user-directory-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Account Control</p>
            <h3>用户目录</h3>
          </div>
          <span className="user-result-count">
            {filteredRows.length} / {directoryRows.length}
          </span>
        </header>
        <div className="user-stat-strip" aria-label="用户统计">
          <QuickStatButton icon={<Users size={14} />} value={directoryRows.length} label="全部" active={hasNoSecondaryFilters && statusFilter === "all" && authFilter === "all"} onClick={() => applyQuickView("all")} />
          <QuickStatButton icon={<UserCheck size={14} />} value={activeCount} label="正常" active={hasNoSecondaryFilters && statusFilter === "active" && authFilter === "all"} onClick={() => applyQuickView("active")} />
          <QuickStatButton icon={<Archive size={14} />} value={archivedCount} label="归档" active={hasNoSecondaryFilters && statusFilter === "archived" && authFilter === "all"} onClick={() => applyQuickView("archived")} />
          <QuickStatButton icon={<KeyRound size={14} />} value={authBoundCount} label="邮箱绑定" active={hasNoSecondaryFilters && authFilter === "bound" && statusFilter === "all"} onClick={() => applyQuickView("bound")} />
          <QuickStatButton icon={<Boxes size={14} />} value={totalSessionCount} label="沙盘档案" />
        </div>
        <div className="user-table-wrap">
          <table className="user-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>身份</th>
                <th>状态</th>
                <th>后台权限</th>
                <th>登录</th>
                <th>沙盘</th>
                <th>记忆</th>
                <th>最近活跃</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="user-empty-state">没有匹配的用户，请调整筛选条件。</div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.account.userId} className={selectedRow?.account.userId === row.account.userId ? "selected" : ""}>
                    <td>
                      <button type="button" className="user-name-button" onClick={() => openUserDetail(row.account.userId, "overview")}>
                        <span>{getUserInitial(row.account.displayName)}</span>
                        <strong>{row.account.displayName}</strong>
                        <em>{row.authEmail ?? row.account.localHandle}</em>
                      </button>
                    </td>
                    <td>
                      {row.profile ? (
                        <span className="user-identity-stack">
                          <strong>{ROLE_LABELS[row.profile.role]}</strong>
                          <em>{AGE_GROUP_LABELS[row.profile.ageGroup]}</em>
                        </span>
                      ) : (
                        <span className="user-muted">未补齐</span>
                      )}
                    </td>
                    <td>
                      <span className={`user-status-pill ${row.account.status}`}>{ACCOUNT_STATUS_LABELS[row.account.status]}</span>
                    </td>
                    <td>
                      <span className={`access-role-pill ${row.accessPolicy.role}`}>{ADMIN_ACCESS_ROLE_LABELS[row.accessPolicy.role]}</span>
                    </td>
                    <td>
                      <span className={`user-auth-pill ${row.authStatus}`}>{row.authStatus === "bound" ? "邮箱" : "本地"}</span>
                    </td>
                    <td>{row.sessionCount}</td>
                    <td>
                      {row.confirmedMemoryCount}/{row.memoryCount}
                    </td>
                    <td>{formatDateTime(row.account.lastActiveAt)}</td>
                    <td>
                      <div className="user-row-actions" aria-label={`${row.account.displayName} 的操作`}>
                        <button type="button" onClick={() => openUserDetail(row.account.userId, "overview")} aria-label="查看详情" title="查看详情">
                          <Eye size={15} />
                        </button>
                        <button type="button" onClick={() => openUserDetail(row.account.userId, "edit")} aria-label="编辑用户" title="编辑用户">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => openUserDetail(row.account.userId, "access")} aria-label="权限设置" title="权限设置">
                          <ShieldCheck size={15} />
                        </button>
                        <button
                          type="button"
                          className={row.account.status === "archived" ? "" : "danger"}
                          onClick={() => toggleAccountArchive(row)}
                          aria-label={row.account.status === "archived" ? "恢复用户" : "归档用户"}
                          title={row.account.status === "archived" ? "恢复用户" : "归档用户"}
                        >
                          {row.account.status === "archived" ? <Undo2 size={15} /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="user-pagination">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span>
            第 {currentPage} / {totalPages} 页 · 每页 {USER_PAGE_SIZE}
          </span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
            <ChevronRight size={16} />
          </button>
        </footer>
      </section>

      {detailTab && selectedRow ? (
        <div className="user-detail-overlay" role="presentation" onClick={() => setDetailTab(null)}>
          <aside
            className="admin-card user-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedRow.account.displayName} 的用户详情`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-card-header user-detail-drawer-header">
              <div>
                <p className="eyebrow">Profile Detail</p>
                <h3>用户详情</h3>
              </div>
              <button type="button" className="small-icon-button" onClick={() => setDetailTab(null)} aria-label="关闭用户详情">
                <X size={16} />
              </button>
            </header>
            <div className="user-detail-body">
              <section className="user-detail-hero">
                <span>
                  <UserRound size={23} />
                </span>
                <div>
                  <strong>{selectedRow.account.displayName}</strong>
                  <em>{selectedRow.authEmail ?? selectedRow.account.localHandle}</em>
                  <code>{selectedRow.account.userId}</code>
                </div>
                <b className={`user-status-pill ${selectedRow.account.status}`}>
                  {ACCOUNT_STATUS_LABELS[selectedRow.account.status]}
                </b>
              </section>

              <nav className="user-detail-tabs" aria-label="用户详情分区">
                <button type="button" className={detailTab === "overview" ? "active" : ""} onClick={() => setDetailTab("overview")}>
                  概览
                </button>
                <button type="button" className={detailTab === "edit" ? "active" : ""} onClick={() => setDetailTab("edit")}>
                  编辑
                </button>
                <button type="button" className={detailTab === "access" ? "active" : ""} onClick={() => setDetailTab("access")}>
                  权限
                </button>
                <button type="button" className={detailTab === "audit" ? "active" : ""} onClick={() => setDetailTab("audit")}>
                  审计
                </button>
              </nav>

              {detailTab === "overview" ? (
                <>
                  <section className="user-detail-metrics">
                    <span>
                      <strong>{selectedRow.sessionCount}</strong>
                      沙盘档案
                    </span>
                    <span>
                      <strong>{selectedRow.memoryCount}</strong>
                      记忆候选
                    </span>
                    <span>
                      <strong>{selectedRow.consentGranted}/{selectedRow.consentTotal}</strong>
                      授权项
                    </span>
                  </section>
                  <section className="user-detail-card">
                    <h4>
                      <ShieldCheck size={15} />
                      授权边界
                    </h4>
                    <ul className="user-consent-list">
                      {selectedConsents.map((consent) => (
                        <li key={consent.consentId}>
                          <span className={consent.granted ? "granted" : "revoked"}>{consent.granted ? "开启" : "关闭"}</span>
                          <strong>{CONSENT_LABELS[consent.consentType]}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}

              {detailTab === "edit" ? (
                <section className="user-detail-form">
                  <label>
                    <span>用户状态</span>
                    <select
                      value={selectedRow.account.status}
                      onChange={(event) =>
                        updateAccountStatus(selectedRow.account.userId, event.target.value as PersonalAccountStatus)
                      }
                    >
                      <option value="active">正常</option>
                      <option value="archived">归档</option>
                    </select>
                  </label>
                  <label>
                    <span>角色</span>
                    <select
                      value={selectedRow.profile?.role ?? "demo"}
                      onChange={(event) => updateProfile(selectedRow.account.userId, { role: event.target.value as PersonalRole })}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>年龄段</span>
                    <select
                      value={selectedRow.profile?.ageGroup ?? "unknown"}
                      onChange={(event) =>
                        updateProfile(selectedRow.account.userId, { ageGroup: event.target.value as PersonalAgeGroup })
                      }
                    >
                      {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              ) : null}

              {detailTab === "access" ? (
                <section className="user-detail-form">
                  <label>
                    <span>后台角色</span>
                    <select
                      value={selectedRow.accessPolicy.role}
                      onChange={(event) =>
                        updateAccessPolicy(
                          selectedRow.account.userId,
                          { role: event.target.value as AdminAccessRole },
                          `用户后台角色调整为：${ADMIN_ACCESS_ROLE_LABELS[event.target.value as AdminAccessRole]}。`,
                        )
                      }
                    >
                      {ADMIN_ACCESS_ROLE_ORDER.map((role) => (
                        <option key={role} value={role}>
                          {ADMIN_ACCESS_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>权限状态</span>
                    <select
                      value={selectedRow.accessPolicy.status}
                      onChange={(event) =>
                        updateAccessPolicy(
                          selectedRow.account.userId,
                          { status: event.target.value as AdminAccessStatus },
                          `用户权限状态调整为：${ADMIN_ACCESS_STATUS_LABELS[event.target.value as AdminAccessStatus]}。`,
                        )
                      }
                    >
                      <option value="active">可用</option>
                      <option value="review_required">待复核</option>
                      <option value="disabled">停用</option>
                    </select>
                  </label>
                  <label>
                    <span>工作区范围</span>
                    <select
                      value={selectedRow.accessPolicy.workspaceScope}
                      onChange={(event) =>
                        updateAccessPolicy(
                          selectedRow.account.userId,
                          { workspaceScope: event.target.value as AdminWorkspaceScope },
                          `用户工作区范围调整为：${ADMIN_WORKSPACE_SCOPE_LABELS[event.target.value as AdminWorkspaceScope]}。`,
                        )
                      }
                    >
                      <option value="all">全部工作区</option>
                      <option value="assigned">指定工作区</option>
                      <option value="own">仅本人工作区</option>
                    </select>
                  </label>
                </section>
              ) : null}

              {detailTab === "audit" ? (
                <section className="user-detail-card">
                  <h4>
                    <Clock3 size={15} />
                    最近审计
                  </h4>
                  <div className="user-audit-mini">
                    {selectedAudits.length === 0 ? (
                      <p>暂无审计记录。</p>
                    ) : (
                      selectedAudits.map((log) => (
                        <article key={log.id}>
                          <strong>{log.detail}</strong>
                          <time>{formatDateTime(log.createdAt)}</time>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function QuickStatButton({
  icon,
  value,
  label,
  active,
  onClick,
}: {
  icon: JSX.Element;
  value: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`${active ? "active" : ""} ${onClick ? "" : "static"}`.trim()}
      onClick={onClick}
      aria-disabled={!onClick}
      tabIndex={onClick ? undefined : -1}
    >
      {icon}
      <strong>{value}</strong>
      <em>{label}</em>
    </button>
  );
}

function AdminAccessPanel({
  personalData,
  adminGovernance,
  onAdminGovernanceChange,
}: {
  personalData: PersonalDataBundle;
  adminGovernance: AdminGovernanceData;
  onAdminGovernanceChange: (data: AdminGovernanceData) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminAccessRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminAccessStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState(() => personalData.activeUserId);
  const [importStatus, setImportStatus] = useState<{ tone: ConfigStatusTone; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const authIdentities = useMemo(() => loadLocalAuthIdentities(), [personalData.accounts.length, personalData.activeUserId]);
  const authByUserId = useMemo(
    () => new Map(authIdentities.map((identity) => [identity.userId, identity])),
    [authIdentities],
  );
  const rows = useMemo(() => {
    const profileByUserId = new Map(personalData.profiles.map((profile) => [profile.userId, profile]));
    return personalData.accounts.map((account) => {
      const accessPolicy = getAccessPolicyForUser(adminGovernance, account.userId);
      const permissions = getEffectivePermissions(accessPolicy);
      return {
        account,
        profile: profileByUserId.get(account.userId) ?? null,
        accessPolicy,
        authEmail: authByUserId.get(account.userId)?.email,
        permissionCount: permissions.length,
      };
    });
  }, [adminGovernance, authByUserId, personalData.accounts, personalData.profiles]);
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          row.account.displayName,
          row.account.localHandle,
          row.account.userId,
          row.authEmail ?? "",
          row.profile?.displayName ?? "",
          ADMIN_ACCESS_ROLE_LABELS[row.accessPolicy.role],
          ADMIN_ACCESS_STATUS_LABELS[row.accessPolicy.status],
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || row.accessPolicy.role === roleFilter;
      const matchesStatus = statusFilter === "all" || row.accessPolicy.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, rows, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / USER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * USER_PAGE_SIZE, currentPage * USER_PAGE_SIZE);
  const selectedRow =
    rows.find((row) => row.account.userId === selectedUserId) ??
    filteredRows[0] ??
    rows[0] ??
    null;
  const roleCounts = ADMIN_ACCESS_ROLE_ORDER.map((role) => ({
    role,
    count: rows.filter((row) => row.accessPolicy.role === role).length,
  }));
  const reviewCount = rows.filter((row) => row.accessPolicy.status === "review_required").length;
  const disabledCount = rows.filter((row) => row.accessPolicy.status === "disabled").length;
  const selectedPermissions = selectedRow ? getEffectivePermissions(selectedRow.accessPolicy) : [];

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, statusFilter]);

  useEffect(() => {
    if (rows.length > 0 && !rows.some((row) => row.account.userId === selectedUserId)) {
      setSelectedUserId(rows[0].account.userId);
    }
  }, [rows, selectedUserId]);

  const updatePolicy = (
    userId: string,
    patch: Partial<Pick<AdminAccessPolicy, "role" | "status" | "workspaceScope" | "deniedPermissions" | "note" | "lastReviewedAt">>,
    detail: string,
  ) => {
    onAdminGovernanceChange(
      upsertAdminAccessPolicy(adminGovernance, {
        actorUserId: personalData.activeUserId,
        userId,
        patch,
        detail,
      }),
    );
  };

  const bulkPatchPolicies = (
    patch: Partial<Pick<AdminAccessPolicy, "role" | "status" | "workspaceScope" | "deniedPermissions" | "lastReviewedAt">>,
    detail: string,
  ) => {
    const targetIds = new Set(filteredRows.map((row) => row.account.userId));
    if (targetIds.size === 0) {
      setImportStatus({ tone: "warn", text: "当前筛选结果为空，未执行批量操作。" });
      return;
    }
    const now = new Date().toISOString();
    const nextGovernance = appendAdminGovernanceLog(
      {
        ...adminGovernance,
        accessPolicies: adminGovernance.accessPolicies.map((policy) =>
          targetIds.has(policy.userId) ? { ...policy, ...patch, updatedAt: now } : policy,
        ),
      },
      {
        actorUserId: personalData.activeUserId,
        action: "access_policy_bulk_updated",
        resourceType: "access_policy",
        detail,
        severity: "warning",
      },
    );
    onAdminGovernanceChange(nextGovernance);
    setImportStatus({ tone: "ok", text: detail });
  };

  const exportUserDirectory = () => {
    const exportedAt = new Date().toISOString();
    const payload: AdminUserDirectoryExport = {
      schema: "psych-sandbox-admin-user-directory",
      version: 1,
      exportedAt,
      accounts: personalData.accounts.map(({ userId, localHandle, displayName, status, createdAt, lastActiveAt }) => ({
        userId,
        localHandle,
        displayName,
        status,
        createdAt,
        lastActiveAt,
      })),
      profiles: personalData.profiles,
      accessPolicies: adminGovernance.accessPolicies,
      authBindings: authIdentities.map(({ userId, email, status, lastLoginAt }) => ({ userId, email, status, lastLoginAt })),
    };
    downloadJsonFile(`psych-sandbox-user-directory-${exportedAt.slice(0, 10)}.json`, payload);
    onAdminGovernanceChange(
      appendAdminGovernanceLog(adminGovernance, {
        actorUserId: personalData.activeUserId,
        action: "user_directory_exported",
        resourceType: "bulk_export",
        detail: `已导出 ${payload.accounts.length} 个用户和 ${payload.accessPolicies.length} 条权限策略。`,
        severity: "info",
      }),
    );
    setImportStatus({ tone: "ok", text: "已导出用户目录 JSON，不包含密码哈希。" });
  };

  const importAccessPolicies = async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAdminUserDirectoryExport(parsed)) {
        throw new Error("文件不是 psych-sandbox-admin-user-directory v1。");
      }
      const knownUserIds = new Set(personalData.accounts.map((account) => account.userId));
      let imported = 0;
      let skipped = 0;
      const now = new Date().toISOString();
      const incomingByUserId = new Map(parsed.accessPolicies.map((policy) => [policy.userId, policy]));
      const nextPolicies = adminGovernance.accessPolicies.map((policy) => {
        const incoming = incomingByUserId.get(policy.userId);
        if (!incoming || !knownUserIds.has(policy.userId)) {
          return policy;
        }
        imported += 1;
        return {
          ...policy,
          role: incoming.role,
          status: incoming.status,
          workspaceScope: incoming.workspaceScope,
          deniedPermissions: incoming.deniedPermissions,
          note: incoming.note,
          updatedAt: now,
          lastReviewedAt: incoming.lastReviewedAt,
        };
      });
      skipped = parsed.accessPolicies.length - imported;
      onAdminGovernanceChange(
        appendAdminGovernanceLog(
          {
            ...adminGovernance,
            accessPolicies: nextPolicies,
          },
          {
            actorUserId: personalData.activeUserId,
            action: "access_policy_imported",
            resourceType: "bulk_import",
            detail: `已导入 ${imported} 条权限策略，跳过 ${skipped} 条未知用户策略。`,
            severity: "warning",
          },
        ),
      );
      setImportStatus({ tone: "ok", text: `已导入 ${imported} 条权限策略，跳过 ${skipped} 条未知用户策略。` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportStatus({ tone: "error", text: `导入失败：${message}` });
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="access-admin-layout" aria-label="权限审计">
      <section className="admin-card access-policy-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Access Control</p>
            <h3>权限策略</h3>
          </div>
          <span className="user-result-count">{filteredRows.length}</span>
        </header>
        <div className="access-toolbar">
          <label className="user-search-field" aria-label="搜索权限策略">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户、邮箱、角色..." />
          </label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as AdminAccessRole | "all")}>
            <option value="all">全部角色</option>
            {ADMIN_ACCESS_ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {ADMIN_ACCESS_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminAccessStatus | "all")}>
            <option value="all">全部状态</option>
            <option value="active">可用</option>
            <option value="review_required">待复核</option>
            <option value="disabled">停用</option>
          </select>
        </div>
        <div className="access-summary-grid">
          {roleCounts.map(({ role, count }) => (
            <span key={role}>
              <strong>{count}</strong>
              {ADMIN_ACCESS_ROLE_LABELS[role]}
            </span>
          ))}
          <span className="warn">
            <strong>{reviewCount}</strong>
            待复核
          </span>
          <span className="warn">
            <strong>{disabledCount}</strong>
            已停用
          </span>
        </div>
        <div className="access-bulk-actions">
          <button
            type="button"
            onClick={() => bulkPatchPolicies({ status: "review_required" }, `已将当前筛选的 ${filteredRows.length} 个用户标记为待复核。`)}
          >
            标记待复核
          </button>
          <button
            type="button"
            onClick={() =>
              bulkPatchPolicies(
                { role: "viewer", workspaceScope: "own", deniedPermissions: [] },
                `已将当前筛选的 ${filteredRows.length} 个用户调整为只读观察。`,
              )
            }
          >
            批量只读
          </button>
          <button type="button" onClick={exportUserDirectory}>
            <Download size={14} />
            导出用户目录
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            <Upload size={14} />
            导入权限策略
          </button>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json"
            onChange={(event) => {
              void importAccessPolicies(event.target.files?.[0] ?? null);
            }}
          />
        </div>
        {importStatus ? <p className={`admin-config-status ${importStatus.tone}`}>{importStatus.text}</p> : null}
        <div className="user-table-wrap">
          <table className="user-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>后台角色</th>
                <th>范围</th>
                <th>状态</th>
                <th>权限数</th>
                <th>复核</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.account.userId} className={selectedRow?.account.userId === row.account.userId ? "selected" : ""}>
                  <td>
                    <button type="button" className="user-name-button" onClick={() => setSelectedUserId(row.account.userId)}>
                      <span>{getUserInitial(row.account.displayName)}</span>
                      <strong>{row.account.displayName}</strong>
                      <em>{row.authEmail ?? row.account.localHandle}</em>
                    </button>
                  </td>
                  <td>
                    <span className={`access-role-pill ${row.accessPolicy.role}`}>{ADMIN_ACCESS_ROLE_LABELS[row.accessPolicy.role]}</span>
                  </td>
                  <td>{ADMIN_WORKSPACE_SCOPE_LABELS[row.accessPolicy.workspaceScope]}</td>
                  <td>
                    <span className={`access-status-pill ${row.accessPolicy.status}`}>
                      {ADMIN_ACCESS_STATUS_LABELS[row.accessPolicy.status]}
                    </span>
                  </td>
                  <td>{row.permissionCount}</td>
                  <td>{row.accessPolicy.lastReviewedAt ? formatDateTime(row.accessPolicy.lastReviewedAt) : "未复核"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="user-pagination">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span>
            第 {currentPage} / {totalPages} 页 · 每页 {USER_PAGE_SIZE}
          </span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
            <ChevronRight size={16} />
          </button>
        </footer>
      </section>

      <aside className="admin-card access-detail-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Selected Policy</p>
            <h3>策略详情</h3>
          </div>
        </header>
        {selectedRow ? (
          <div className="user-detail-body">
            <section className="user-detail-hero">
              <span>
                <ShieldCheck size={22} />
              </span>
              <div>
                <strong>{selectedRow.account.displayName}</strong>
                <em>{selectedRow.authEmail ?? selectedRow.account.localHandle}</em>
                <code>{selectedRow.account.userId}</code>
              </div>
            </section>
            <section className="user-detail-form">
              <label>
                <span>后台角色</span>
                <select
                  value={selectedRow.accessPolicy.role}
                  onChange={(event) =>
                    updatePolicy(
                      selectedRow.account.userId,
                      { role: event.target.value as AdminAccessRole },
                      `后台角色调整为：${ADMIN_ACCESS_ROLE_LABELS[event.target.value as AdminAccessRole]}。`,
                    )
                  }
                >
                  {ADMIN_ACCESS_ROLE_ORDER.map((role) => (
                    <option key={role} value={role}>
                      {ADMIN_ACCESS_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>策略状态</span>
                <select
                  value={selectedRow.accessPolicy.status}
                  onChange={(event) =>
                    updatePolicy(
                      selectedRow.account.userId,
                      { status: event.target.value as AdminAccessStatus },
                      `权限策略状态调整为：${ADMIN_ACCESS_STATUS_LABELS[event.target.value as AdminAccessStatus]}。`,
                    )
                  }
                >
                  <option value="active">可用</option>
                  <option value="review_required">待复核</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
              <label>
                <span>工作区范围</span>
                <select
                  value={selectedRow.accessPolicy.workspaceScope}
                  onChange={(event) =>
                    updatePolicy(
                      selectedRow.account.userId,
                      { workspaceScope: event.target.value as AdminWorkspaceScope },
                      `工作区范围调整为：${ADMIN_WORKSPACE_SCOPE_LABELS[event.target.value as AdminWorkspaceScope]}。`,
                    )
                  }
                >
                  <option value="all">全部工作区</option>
                  <option value="assigned">指定工作区</option>
                  <option value="own">仅本人工作区</option>
                </select>
              </label>
              <label>
                <span>管理备注</span>
                <textarea
                  value={selectedRow.accessPolicy.note}
                  onChange={(event) =>
                    updatePolicy(selectedRow.account.userId, { note: event.target.value }, "更新权限策略备注。")
                  }
                  rows={3}
                  placeholder="记录授权原因、复核结论或服务边界..."
                />
              </label>
              <button
                type="button"
                className="access-review-button"
                onClick={() =>
                  updatePolicy(selectedRow.account.userId, { status: "active", lastReviewedAt: new Date().toISOString() }, "已完成权限策略复核。")
                }
              >
                <ShieldCheck size={15} />
                标记已复核
              </button>
            </section>
            <section className="user-detail-card">
              <h4>有效权限</h4>
              <div className="permission-chip-list">
                {selectedPermissions.map((permission) => (
                  <span key={permission}>{getPermissionLabel(permission)}</span>
                ))}
                {selectedPermissions.length === 0 ? <em>当前策略无可用后台权限。</em> : null}
              </div>
            </section>
          </div>
        ) : (
          <div className="user-empty-state">暂无权限策略。</div>
        )}
      </aside>

      <aside className="admin-card access-matrix-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Permission Matrix</p>
            <h3>权限矩阵</h3>
          </div>
        </header>
        <div className="permission-matrix">
          {ADMIN_ACCESS_ROLE_ORDER.map((role) => (
            <article key={role}>
              <h4>{ADMIN_ACCESS_ROLE_LABELS[role]}</h4>
              <div>
                {ADMIN_ROLE_PERMISSIONS[role].map((permission) => (
                  <span key={permission}>{getPermissionLabel(permission)}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <section className="user-detail-card">
          <h4>
            <Clock3 size={15} />
            管理员审计
          </h4>
          <div className="governance-log-list">
            {adminGovernance.logs.slice(0, 8).map((log) => (
              <article key={log.id} className={log.severity}>
                <strong>{log.detail}</strong>
                <time>{formatDateTime(log.createdAt)}</time>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

function SystemArchitecturePanel({
  report,
  repositoryMode,
  onRepositoryModeChange,
}: {
  report: SystemArchitectureReport;
  repositoryMode: RepositoryMode;
  onRepositoryModeChange: (mode: RepositoryMode) => void;
}): JSX.Element {
  const riskCount = report.domains.filter((domain) => domain.migrationRisk === "risk").length;
  const warnCount = report.domains.filter((domain) => domain.migrationRisk === "warn").length;
  const okCount = report.domains.filter((domain) => domain.migrationRisk === "ok").length;
  const apiContract = report.apiContract;
  const p0Endpoints = apiContract.endpoints.filter((endpoint) => endpoint.migrationPriority === "p0").length;
  const paginatedEndpoints = apiContract.endpoints.filter((endpoint) => endpoint.paginated).length;
  const writeEndpoints = apiContract.endpoints.filter((endpoint) => endpoint.method !== "GET").length;

  return (
    <section className="system-architecture-layout" aria-label="系统架构与后端适配">
      <section className="admin-card system-map-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Repository Adapter</p>
            <h3>后端适配边界</h3>
          </div>
          <div className="repository-mode-control">
            <span className={`repository-mode-pill ${report.mode}`}>{report.adapterName}</span>
            <select
              value={repositoryMode}
              onChange={(event) => onRepositoryModeChange(event.target.value as RepositoryMode)}
              aria-label="切换仓储适配模式"
            >
              {REPOSITORY_MODE_OPTIONS.map((option) => (
                <option key={option.mode} value={option.mode}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </header>
        <div className="repository-mode-options" aria-label="仓储适配模式说明">
          {REPOSITORY_MODE_OPTIONS.map((option) => (
            <article key={option.mode} className={`${option.tone} ${repositoryMode === option.mode ? "active" : ""}`}>
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </article>
          ))}
        </div>
        <div className="system-health-grid">
          {report.metrics.map((metric) => (
            <article key={metric.label} className={metric.tone}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <p>{metric.detail}</p>
            </article>
          ))}
        </div>
        <div className="repository-risk-strip">
          <span>
            <strong>{okCount}</strong>
            可直接迁移
          </span>
          <span>
            <strong>{warnCount}</strong>
            需服务端分页
          </span>
          <span className="risk">
            <strong>{riskCount}</strong>
            高敏数据
          </span>
        </div>
        <div className="api-contract-strip" aria-label="真实后端前置契约状态">
          <article>
            <span>Contract</span>
            <strong>{apiContract.version}</strong>
            <p>{apiContract.adapterName}</p>
          </article>
          <article>
            <span>Auth Context</span>
            <strong>{apiContract.authContext.role}</strong>
            <p>{apiContract.authContext.workspaceScope} · {apiContract.authContext.permissions.length} 项权限</p>
          </article>
          <article>
            <span>Pagination</span>
            <strong>{apiContract.pagination.defaultPageSize}/{apiContract.pagination.maxPageSize}</strong>
            <p>{paginatedEndpoints} 个分页接口</p>
          </article>
          <article>
            <span>Priority</span>
            <strong>{p0Endpoints}</strong>
            <p>P0 后端首批接口</p>
          </article>
          <article>
            <span>Write DTO</span>
            <strong>{writeEndpoints}</strong>
            <p>写操作契约</p>
          </article>
        </div>
        <section className="backend-diagnostic-panel" aria-label="后端接入诊断">
          <header>
            <div>
              <p className="eyebrow">Backend Adapter Diagnostic</p>
              <h4>后端接入诊断</h4>
            </div>
            <span className={`repository-risk-pill ${report.backend.remoteReady ? "ok" : "warn"}`}>
              {report.backend.remoteReady ? "Remote Ready" : "Local Fallback"}
            </span>
          </header>
          <div className="backend-diagnostic-summary">
            <span>
              <strong>{report.backend.modeLabel}</strong>
              当前模式
            </span>
            <span>
              <strong>{report.backend.transport}</strong>
              Transport
            </span>
            <span>
              <strong>{report.backend.p0EndpointCount}</strong>
              P0 接口
            </span>
            <span>
              <strong>{report.backend.mockRoundTrip ? "通过" : "待测"}</strong>
              Mock Roundtrip
            </span>
          </div>
          <div className="backend-check-grid">
            {report.backend.checks.map((check) => (
              <article key={check.label} className={check.status}>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>
          <p className="backend-base-url">
            <span>Base URL</span>
            <code>{report.backend.baseUrl}</code>
            <span>{report.backend.authStrategy}</span>
            <span>{report.backend.writeStrategy}</span>
          </p>
          <ol className="backend-next-steps">
            {report.backend.nextSteps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>
        <div className="repository-domain-table-wrap">
          <table className="repository-domain-table">
            <thead>
              <tr>
                <th>数据域</th>
                <th>当前存储</th>
                <th>后端接口</th>
                <th>读模型</th>
                <th>写模型</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody>
              {report.domains.map((domain) => (
                <tr key={domain.key}>
                  <td>
                    <strong>{domain.label}</strong>
                  </td>
                  <td>{domain.currentStore}</td>
                  <td>
                    <code>{domain.futureApi}</code>
                  </td>
                  <td>{domain.readModel}</td>
                  <td>{domain.writeModel}</td>
                  <td>
                    <span className={`repository-risk-pill ${domain.migrationRisk}`}>
                      {domain.migrationRisk === "ok" ? "低" : domain.migrationRisk === "warn" ? "中" : "高"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="api-contract-panel">
          <header>
            <div>
              <p className="eyebrow">API DTO Contract</p>
              <h4>真实后端前置契约</h4>
            </div>
            <span>{apiContract.errors.length} 个错误码</span>
          </header>
          <div className="api-endpoint-grid">
            {apiContract.endpoints.map((endpoint) => (
              <article key={`${endpoint.method}:${endpoint.path}`}>
                <div className="api-endpoint-head">
                  <span className={`api-endpoint-method ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                  <strong className="api-endpoint-path">{endpoint.path}</strong>
                </div>
                <p>{endpoint.summary}</p>
                <footer>
                  <span>{endpoint.responseDto}</span>
                  <span>{endpoint.auth}</span>
                  <span>{endpoint.migrationPriority.toUpperCase()}</span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </section>

      <aside className="admin-card workspace-directory-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Workspace Registry</p>
            <h3>组织 / 工作区</h3>
          </div>
          <span className="user-result-count">{report.workspaces.length}</span>
        </header>
        <div className="workspace-directory-list">
          {report.workspaces.length === 0 ? (
            <p className="user-empty-state">暂无工作区。</p>
          ) : (
            report.workspaces.map((workspace) => (
              <article key={workspace.workspaceId}>
                <div>
                  <strong>{workspace.title}</strong>
                  <span className={workspace.active ? "active" : "disabled"}>{workspace.active ? "启用" : "停用"}</span>
                </div>
                <p>{workspace.ownerName}</p>
                <footer>
                  <span>{workspace.sessionCount} 个沙盘档案</span>
                  <span>{workspace.accessScopeSummary}</span>
                </footer>
              </article>
            ))
          )}
        </div>
      </aside>

      <aside className="admin-card migration-plan-panel">
        <header className="admin-card-header">
          <div>
            <p className="eyebrow">Migration Plan</p>
            <h3>服务端迁移步骤</h3>
          </div>
        </header>
        <ol className="migration-step-list">
          {report.migrationSteps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <section className="system-contract-card">
          <h4>接口替换约定</h4>
          <p>
            当前 App 已通过 <code>localRepositoryAdapter</code> 读取个人档案、权限治理、沙盘草稿、环境、布局和 Agent 会话。
            本阶段新增 <code>FrontendMockApiAdapter</code> 和 DTO 契约，后续接入真实后端时优先实现同名 API Adapter，并保持组件 props 不变。
          </p>
          <time>报告生成：{formatDateTime(report.generatedAt)}</time>
        </section>
      </aside>
    </section>
  );
}

function AssetAdminPanel({
  assets,
  onAssetsChange,
  onResetAssets,
}: {
  assets: ManagedAsset[];
  onAssetsChange: (assets: ManagedAsset[]) => void;
  onResetAssets: () => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState(() => assets[0]?.assetId ?? "");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskTag | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>("all");
  const [originFilter, setOriginFilter] = useState<AssetOriginFilter>("all");
  const [viewMode, setViewMode] = useState<AssetViewMode>("table");
  const [sortKey, setSortKey] = useState<AssetSortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const selected = assets.find((asset) => asset.assetId === selectedId) ?? assets[0] ?? null;
  const selectedAssetSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);
  const categories = useMemo(
    () =>
      Array.from(new Set([...ASSET_CATEGORIES, ...assets.map((asset) => asset.category), "自定义"]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    [assets],
  );
  const filteredAssets = useMemo(
    () =>
      assets
        .filter((asset) =>
          matchesAssetFilters(asset, {
            query,
            categoryFilter,
            riskFilter,
            statusFilter,
            originFilter,
          }),
        )
        .sort((a, b) => compareAssets(a, b, sortKey, sortDirection)),
    [assets, categoryFilter, originFilter, query, riskFilter, sortDirection, sortKey, statusFilter],
  );
  const pageSize = viewMode === "table" ? 50 : 48;
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedAssets = filteredAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const enabledCount = assets.filter((asset) => asset.enabled && !asset.deletedAt).length;
  const hiddenCount = assets.filter((asset) => !asset.enabled || asset.deletedAt).length;
  const issueCount = assets.reduce((total, asset) => total + getAssetIssueCount(asset, assets), 0);
  const pageAllSelected = pagedAssets.length > 0 && pagedAssets.every((asset) => selectedAssetSet.has(asset.assetId));

  useEffect(() => {
    if (assets.length > 0 && !assets.some((asset) => asset.assetId === selectedId)) {
      setSelectedId(assets[0].assetId);
    }
  }, [assets, selectedId]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, originFilter, query, riskFilter, statusFilter, viewMode]);

  useEffect(() => {
    const assetIds = new Set(assets.map((asset) => asset.assetId));
    setSelectedAssetIds((current) => current.filter((assetId) => assetIds.has(assetId)));
  }, [assets]);

  const updateAssetById = (assetId: string, patch: Partial<ManagedAsset>) => {
    const updatedAt = new Date().toISOString();
    onAssetsChange(
      assets.map((asset) => (asset.assetId === assetId ? { ...asset, ...patch, updatedAt } : asset)),
    );
  };

  const updateAsset = (patch: Partial<ManagedAsset>) => {
    if (selected) {
      updateAssetById(selected.assetId, patch);
    }
  };

  const addAsset = () => {
    const now = new Date().toISOString();
    const assetId = createId("asset");
    const spec = getToyAssetSpec(assetId, "normal");
    const asset: ManagedAsset = {
      assetId,
      name: "新沙具",
      category: "自定义",
      defaultWidth: 82,
      defaultHeight: 82,
      symbolicCandidates: ["待定义"],
      riskTag: "normal",
      anchor: spec.anchor,
      footprint: spec.footprint,
      thumbnailScale: spec.thumbnailScale,
      semanticTags: ["自定义"],
      modelRecipe: { kind: "fallback" },
      isBuiltIn: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    onAssetsChange([asset, ...assets]);
    setSelectedId(asset.assetId);
    setDetailOpen(true);
  };

  const markDeleted = () => {
    if (!selected) {
      return;
    }
    markAssetsDeleted([selected.assetId]);
  };

  const restoreAsset = () => updateAsset({ enabled: true, deletedAt: undefined });
  const bulkTargets = selectedAssetIds;

  const updateManyAssets = (assetIds: string[], patch: Partial<ManagedAsset>) => {
    if (assetIds.length === 0) {
      return;
    }
    const updatedAt = new Date().toISOString();
    const targetSet = new Set(assetIds);
    onAssetsChange(
      assets.map((asset) => (targetSet.has(asset.assetId) ? { ...asset, ...patch, updatedAt } : asset)),
    );
  };

  const markAssetsDeleted = (assetIds: string[]) => {
    updateManyAssets(assetIds, { enabled: false, deletedAt: new Date().toISOString() });
  };

  const restoreAssets = (assetIds: string[]) => {
    updateManyAssets(assetIds, { enabled: true, deletedAt: undefined });
  };

  const toggleAssetSelection = (assetId: string, checked: boolean) => {
    setSelectedAssetIds((current) =>
      checked ? Array.from(new Set([...current, assetId])) : current.filter((id) => id !== assetId),
    );
  };

  const togglePageSelection = (checked: boolean) => {
    const pageIds = pagedAssets.map((asset) => asset.assetId);
    setSelectedAssetIds((current) =>
      checked
        ? Array.from(new Set([...current, ...pageIds]))
        : current.filter((assetId) => !pageIds.includes(assetId)),
    );
  };

  const changeSort = (key: AssetSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "updatedAt" ? "desc" : "asc");
    }
  };

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
    setOriginFilter("all");
    setSelectedAssetIds([]);
  };

  const openAssetDetail = (assetId: string) => {
    setSelectedId(assetId);
    setDetailOpen(true);
  };

  return (
    <section className="asset-admin-layout">
      <aside className="admin-card asset-filter-panel" aria-label="沙具筛选">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Asset Filters</p>
            <h3>筛选与统计</h3>
          </div>
        </div>
        <div className="asset-filter-body">
          <label className="asset-search-field">
            搜索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名称 / ID / 标签 / 象征词"
            />
          </label>
          <label>
            分类
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">全部分类</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            风险标签
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskTag | "all")}>
              <option value="all">全部风险</option>
              {RISK_OPTIONS.map((riskTag) => (
                <option key={riskTag} value={riskTag}>
                  {RISK_LABELS[riskTag]}
                </option>
              ))}
            </select>
          </label>
          <label>
            状态
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AssetStatusFilter)}>
              <option value="all">全部状态</option>
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
              <option value="deleted">已隐藏/删除</option>
            </select>
          </label>
          <label>
            来源
            <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value as AssetOriginFilter)}>
              <option value="all">全部来源</option>
              <option value="builtin">内置</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <div className="asset-stat-grid" aria-label="资产统计">
            <AssetStat label="总数" value={assets.length} />
            <AssetStat label="启用" value={enabledCount} />
            <AssetStat label="隐藏" value={hiddenCount} />
            <AssetStat label="问题" value={issueCount} tone={issueCount > 0 ? "warn" : "ok"} />
          </div>
          <div className="asset-category-pills" aria-label="快速分类">
            <button type="button" className={categoryFilter === "all" ? "active" : ""} onClick={() => setCategoryFilter("all")}>
              全部
            </button>
            {categories.slice(0, 9).map((category) => (
              <button
                key={category}
                type="button"
                className={categoryFilter === category ? "active" : ""}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <button type="button" className="asset-clear-filters" onClick={clearFilters}>
            清除筛选
          </button>
        </div>
      </aside>

      <section className="admin-card asset-catalog-panel" aria-label="沙具资产目录">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Asset Catalog</p>
            <h3>沙具目录</h3>
          </div>
          <div className="admin-actions">
            <button type="button" className="icon-button" onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}>
              {viewMode === "table" ? "网格" : "表格"}
            </button>
            <button type="button" className="small-icon-button" onClick={addAsset} aria-label="新增沙具">
              <Plus size={16} />
            </button>
            <button type="button" className="small-icon-button" onClick={onResetAssets} aria-label="恢复默认沙具目录">
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>
        <div className="asset-catalog-toolbar">
          <div className="asset-toolbar-main">
            <span className="asset-result-count">
              显示 {filteredAssets.length} / {assets.length} 个沙具
            </span>
            <label>
              排序
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as AssetSortKey)}>
                <option value="updatedAt">更新时间</option>
                <option value="name">名称</option>
                <option value="category">分类</option>
                <option value="riskTag">风险</option>
                <option value="status">状态</option>
              </select>
            </label>
            <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}>
              {sortDirection === "asc" ? "升序" : "降序"}
            </button>
          </div>
          {bulkTargets.length > 0 ? (
            <div className="asset-bulk-bar" aria-live="polite">
              <strong>{selectedAssetIds.length > 0 ? selectedAssetIds.length : 1} 个已选择</strong>
              <button type="button" onClick={() => updateManyAssets(bulkTargets, { enabled: true, deletedAt: undefined })}>
                启用
              </button>
              <button type="button" onClick={() => updateManyAssets(bulkTargets, { enabled: false })}>
                停用
              </button>
              <button type="button" onClick={() => markAssetsDeleted(bulkTargets)}>
                隐藏
              </button>
              <button type="button" onClick={() => restoreAssets(bulkTargets)}>
                恢复
              </button>
              <select
                aria-label="批量设置风险标签"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    updateManyAssets(bulkTargets, { riskTag: event.target.value as RiskTag });
                    event.target.value = "";
                  }
                }}
              >
                <option value="">批量风险</option>
                {RISK_OPTIONS.map((riskTag) => (
                  <option key={riskTag} value={riskTag}>
                    {RISK_LABELS[riskTag]}
                  </option>
                ))}
              </select>
              {selectedAssetIds.length > 0 ? (
                <button type="button" onClick={() => setSelectedAssetIds([])}>
                  取消选择
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {viewMode === "table" ? (
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      onChange={(event) => togglePageSelection(event.target.checked)}
                      aria-label="选择当前页沙具"
                    />
                  </th>
                  <th>预览</th>
                  <th>
                    <button type="button" onClick={() => changeSort("name")}>
                      名称
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => changeSort("category")}>
                      分类
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => changeSort("riskTag")}>
                      风险
                    </button>
                  </th>
                  <th>模型</th>
                  <th>
                    <button type="button" onClick={() => changeSort("status")}>
                      状态
                    </button>
                  </th>
                  <th>问题</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedAssets.map((asset) => (
                  <tr key={asset.assetId} className={selected?.assetId === asset.assetId ? "active" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedAssetSet.has(asset.assetId)}
                        onChange={(event) => toggleAssetSelection(asset.assetId, event.target.checked)}
                        aria-label={`选择 ${asset.name}`}
                      />
                    </td>
                    <td>
                      <AssetPreview asset={asset} />
                    </td>
                    <td>
                      <button type="button" className="asset-name-button" onClick={() => openAssetDetail(asset.assetId)}>
                        <strong>{asset.name}</strong>
                        <em>{asset.assetId}</em>
                      </button>
                    </td>
                    <td>{asset.category}</td>
                    <td>
                      <RiskTagBadge riskTag={asset.riskTag} />
                    </td>
                    <td>{asset.modelRecipe.kind}</td>
                    <td>
                      <AssetStatusPill asset={asset} />
                    </td>
                    <td>
                      <span className={getAssetIssueCount(asset, assets) > 0 ? "asset-issue-count warn" : "asset-issue-count"}>
                        {getAssetIssueCount(asset, assets)}
                      </span>
                    </td>
                    <td>
                      <div className="asset-row-actions" aria-label={`${asset.name} 操作`}>
                        <button type="button" onClick={() => openAssetDetail(asset.assetId)} aria-label={`查看并编辑 ${asset.name}`}>
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateAssetById(asset.assetId, {
                              enabled: !asset.enabled,
                              deletedAt: !asset.enabled ? undefined : asset.deletedAt,
                            })
                          }
                          aria-label={asset.enabled ? `停用 ${asset.name}` : `启用 ${asset.name}`}
                        >
                          <ShieldCheck size={14} />
                        </button>
                        {asset.deletedAt || !asset.enabled ? (
                          <button type="button" onClick={() => restoreAssets([asset.assetId])} aria-label={`恢复 ${asset.name}`}>
                            <Undo2 size={14} />
                          </button>
                        ) : (
                          <button type="button" onClick={() => markAssetsDeleted([asset.assetId])} aria-label={`隐藏 ${asset.name}`}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="asset-admin-grid-view">
            {pagedAssets.map((asset) => (
              <article key={asset.assetId} className={selected?.assetId === asset.assetId ? "active" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedAssetSet.has(asset.assetId)}
                    onChange={(event) => toggleAssetSelection(asset.assetId, event.target.checked)}
                  />
                  选择
                </label>
                <AssetPreview asset={asset} />
                <button type="button" onClick={() => openAssetDetail(asset.assetId)}>
                  <strong>{asset.name}</strong>
                  <em>{asset.category}</em>
                </button>
                <div>
                  <RiskTagBadge riskTag={asset.riskTag} />
                  <AssetStatusPill asset={asset} />
                </div>
              </article>
            ))}
          </div>
        )}

        {filteredAssets.length === 0 ? <p className="empty-state">没有符合筛选条件的沙具。</p> : null}

        <div className="asset-pagination">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
            上一页
          </button>
          <span>
            第 {currentPage} / {totalPages} 页
          </span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>
            下一页
          </button>
        </div>
      </section>

      {detailOpen && selected ? (
        <button
          className="asset-detail-scrim"
          type="button"
          aria-label="关闭沙具详情"
          onClick={() => setDetailOpen(false)}
        />
      ) : null}

      <aside className={`admin-card asset-detail-panel asset-detail-drawer ${detailOpen && selected ? "open" : ""}`} aria-label="沙具详情">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Asset Detail</p>
            <h3>{selected ? selected.name : "请选择沙具"}</h3>
          </div>
          {selected ? (
            <div className="admin-actions">
              <button type="button" className="small-icon-button" onClick={() => setDetailOpen(false)} aria-label="关闭沙具详情">
                <X size={16} />
              </button>
              {selected.deletedAt || !selected.enabled ? (
                <button type="button" className="icon-button" onClick={restoreAsset}>
                  <Undo2 size={15} />
                  恢复
                </button>
              ) : (
                <button type="button" className="icon-button danger" onClick={markDeleted}>
                  <Trash2 size={15} />
                  删除
                </button>
              )}
            </div>
          ) : null}
        </div>
        {selected ? (
          <div className="admin-form">
            <div className="asset-detail-preview">
              <AssetPreview asset={selected} />
              <div>
                <strong>{selected.assetId}</strong>
                <span>{selected.isBuiltIn ? "内置资产" : "自定义资产"}</span>
                <AssetStatusPill asset={selected} />
              </div>
            </div>
            <AssetHealthList asset={selected} allAssets={assets} />
            <label>
              名称
              <input value={selected.name} onChange={(event) => updateAsset({ name: event.target.value })} />
            </label>
            <label>
              分类
              <input list="asset-category-options" value={selected.category} onChange={(event) => updateAsset({ category: event.target.value })} />
              <datalist id="asset-category-options">
                {[...ASSET_CATEGORIES, "自定义"].map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <div className="form-grid-2">
              <label>
                宽度
                <input type="number" min={24} value={selected.defaultWidth} onChange={(event) => updateAsset({ defaultWidth: Number(event.target.value) })} />
              </label>
              <label>
                高度
                <input type="number" min={24} value={selected.defaultHeight} onChange={(event) => updateAsset({ defaultHeight: Number(event.target.value) })} />
              </label>
            </div>
            <div className="form-grid-2">
              <label>
                风险标签
                <select value={selected.riskTag} onChange={(event) => updateAsset({ riskTag: event.target.value as RiskTag })}>
                  {RISK_OPTIONS.map((riskTag) => (
                    <option key={riskTag} value={riskTag}>
                      {RISK_LABELS[riskTag]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                模型模板
                <select
                  value={selected.modelRecipe.kind}
                  onChange={(event) => updateAsset(createModelPatch(event.target.value as ToyRecipeKind))}
                >
                  {MODEL_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              象征候选
              <textarea value={selected.symbolicCandidates.join("\n")} onChange={(event) => updateAsset({ symbolicCandidates: splitLines(event.target.value) })} />
            </label>
            <label>
              语义标签
              <textarea value={selected.semanticTags.join("\n")} onChange={(event) => updateAsset({ semanticTags: splitLines(event.target.value) })} />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={selected.enabled && !selected.deletedAt} onChange={(event) => updateAsset({ enabled: event.target.checked, deletedAt: event.target.checked ? undefined : new Date().toISOString() })} />
              在沙具库中启用
            </label>
            <div className="asset-meta-block">
              <span>创建：{formatDateTime(selected.createdAt)}</span>
              <span>更新：{formatDateTime(selected.updatedAt)}</span>
              <span>
                尺寸：{selected.defaultWidth} × {selected.defaultHeight}
              </span>
              <span>
                足迹：{selected.footprint.kind} / {selected.footprint.width}×{selected.footprint.depth}
              </span>
            </div>
          </div>
        ) : (
          <p className="empty-state">暂无沙具。</p>
        )}
      </aside>
    </section>
  );
}

function AssetStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "ok" | "warn";
}): JSX.Element {
  return (
    <span className={`asset-stat ${tone}`}>
      <strong>{value}</strong>
      <em>{label}</em>
    </span>
  );
}

function AssetStatusPill({ asset }: { asset: ManagedAsset }): JSX.Element {
  const isDeleted = Boolean(asset.deletedAt);
  const label = isDeleted ? "已隐藏" : asset.enabled ? "启用" : "停用";
  const className = isDeleted ? "deleted" : asset.enabled ? "enabled" : "";
  return <span className={`asset-status-pill ${className}`}>{label}</span>;
}

function AssetHealthList({
  asset,
  allAssets,
}: {
  asset: ManagedAsset;
  allAssets: ManagedAsset[];
}): JSX.Element {
  const issues = getAssetIssues(asset, allAssets);
  return (
    <div className={`asset-health ${issues.length > 0 ? "warn" : "ok"}`}>
      <strong>{issues.length > 0 ? `发现 ${issues.length} 个配置问题` : "资产配置完整"}</strong>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p>基础字段、语义标签与渲染配置都可用。</p>
      )}
    </div>
  );
}

function matchesAssetFilters(
  asset: ManagedAsset,
  filters: {
    query: string;
    categoryFilter: string;
    riskFilter: RiskTag | "all";
    statusFilter: AssetStatusFilter;
    originFilter: AssetOriginFilter;
  },
): boolean {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const searchText = [
    asset.assetId,
    asset.name,
    asset.category,
    asset.riskTag,
    asset.modelRecipe.kind,
    ...asset.symbolicCandidates,
    ...asset.semanticTags,
  ]
    .join(" ")
    .toLowerCase();
  const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
  const matchesCategory = filters.categoryFilter === "all" || asset.category === filters.categoryFilter;
  const matchesRisk = filters.riskFilter === "all" || asset.riskTag === filters.riskFilter;
  const matchesOrigin =
    filters.originFilter === "all" ||
    (filters.originFilter === "builtin" && asset.isBuiltIn) ||
    (filters.originFilter === "custom" && !asset.isBuiltIn);
  const matchesStatus =
    filters.statusFilter === "all" ||
    (filters.statusFilter === "enabled" && asset.enabled && !asset.deletedAt) ||
    (filters.statusFilter === "disabled" && !asset.enabled && !asset.deletedAt) ||
    (filters.statusFilter === "deleted" && Boolean(asset.deletedAt));
  return matchesQuery && matchesCategory && matchesRisk && matchesOrigin && matchesStatus;
}

function compareAssets(
  a: ManagedAsset,
  b: ManagedAsset,
  sortKey: AssetSortKey,
  direction: "asc" | "desc",
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (sortKey === "updatedAt") {
    return multiplier * a.updatedAt.localeCompare(b.updatedAt);
  }
  if (sortKey === "status") {
    return multiplier * getAssetStatusText(a).localeCompare(getAssetStatusText(b), "zh-Hans-CN");
  }
  return multiplier * String(a[sortKey]).localeCompare(String(b[sortKey]), "zh-Hans-CN");
}

function getAssetStatusText(asset: ManagedAsset): string {
  if (asset.deletedAt) {
    return "hidden";
  }
  return asset.enabled ? "enabled" : "disabled";
}

function getAssetIssueCount(asset: ManagedAsset, allAssets: ManagedAsset[]): number {
  return getAssetIssues(asset, allAssets).length;
}

function getAssetIssues(asset: ManagedAsset, allAssets: ManagedAsset[]): string[] {
  const issues: string[] = [];
  if (!asset.name.trim()) {
    issues.push("名称为空");
  }
  if (!asset.assetId.trim()) {
    issues.push("assetId 为空");
  }
  if (allAssets.filter((item) => item.assetId === asset.assetId).length > 1) {
    issues.push("assetId 重复");
  }
  if (!asset.category.trim()) {
    issues.push("分类为空");
  }
  if (asset.defaultWidth < 24 || asset.defaultHeight < 24) {
    issues.push("默认尺寸过小");
  }
  if (asset.symbolicCandidates.length === 0) {
    issues.push("缺少象征候选词");
  }
  if (asset.semanticTags.length === 0) {
    issues.push("缺少语义标签");
  }
  if (!asset.modelRecipe?.kind) {
    issues.push("缺少模型模板");
  }
  return issues;
}

function countByUser<T extends { userId: string }>(items: T[]): Map<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item.userId, (counts.get(item.userId) ?? 0) + 1));
  return counts;
}

function getAccessPolicyForUser(adminGovernance: AdminGovernanceData, userId: string): AdminAccessPolicy {
  const existing = adminGovernance.accessPolicies.find((policy) => policy.userId === userId);
  if (existing) {
    return existing;
  }
  const now = new Date().toISOString();
  return {
    userId,
    role: "viewer",
    status: "review_required",
    workspaceScope: "own",
    deniedPermissions: [],
    note: "系统自动补齐的临时权限策略，请复核。",
    createdAt: now,
    updatedAt: now,
  };
}

function getPermissionLabel(permission: AdminPermissionKey): string {
  return ADMIN_PERMISSION_DEFINITIONS.find((definition) => definition.key === permission)?.label ?? permission;
}

function getUserInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "人";
}

function formatDateTime(value: string): string {
  if (!value) {
    return "未知";
  }
  return new Date(value).toLocaleString();
}

function ProviderReadinessPill({
  provider,
  status,
}: {
  provider: LlmProviderConfig;
  status?: { tone: ConfigStatusTone; text: string };
}): JSX.Element {
  const readiness = status
    ? { tone: status.tone, label: status.tone === "ok" ? "已测试" : status.tone === "error" ? "异常" : "需处理" }
    : getProviderReadiness(provider);
  return <span className={`status-pill ${readiness.tone}`}>{readiness.label}</span>;
}

function getProviderReadiness(provider: LlmProviderConfig): { tone: ConfigStatusTone; label: string } {
  if (!provider.enabled) {
    return { tone: "warn", label: "停用" };
  }
  if (!provider.apiKey.trim() || !provider.baseUrl.trim() || !provider.model.trim()) {
    return { tone: "warn", label: "待补全" };
  }
  return { tone: "ok", label: "可调用" };
}

function validateProviderForBrowserStreaming(provider: LlmProviderConfig): { tone: ConfigStatusTone; text: string } {
  const issues: string[] = [];
  if (!provider.enabled) {
    issues.push("配置未启用");
  }
  if (!provider.apiKey.trim()) {
    issues.push("缺少 API Key");
  }
  if (!provider.model.trim()) {
    issues.push("缺少模型名");
  }
  try {
    const url = new URL(provider.baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      issues.push("Base URL 必须使用 http 或 https");
    }
  } catch {
    issues.push("Base URL 格式无效");
  }

  if (issues.length > 0) {
    return {
      tone: "warn",
      text: `配置未就绪：${issues.join("、")}。`,
    };
  }

  return {
    tone: "ok",
    text: `配置完整：${getProviderLabel(provider.provider)} / ${provider.model}。真实流式调用将在对话时发送请求；若遇到 CORS 或网络限制会自动回退。`,
  };
}

function LlmAdminPanel({
  providers,
  onProvidersChange,
}: {
  providers: LlmProviderConfig[];
  onProvidersChange: (providers: LlmProviderConfig[]) => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState(() => providers[0]?.id ?? "");
  const [testStatus, setTestStatus] = useState<Record<string, { tone: ConfigStatusTone; text: string }>>({});
  const selected = providers.find((provider) => provider.id === selectedId) ?? providers[0] ?? null;

  useEffect(() => {
    if (providers.length > 0 && !providers.some((provider) => provider.id === selectedId)) {
      setSelectedId(providers[0].id);
    }
  }, [providers, selectedId]);

  const updateProvider = (patch: Partial<LlmProviderConfig>) => {
    if (!selected) {
      return;
    }
    const updatedAt = new Date().toISOString();
    onProvidersChange(
      providers.map((provider) => (provider.id === selected.id ? { ...provider, ...patch, updatedAt } : provider)),
    );
  };

  const addProvider = () => {
    const now = new Date().toISOString();
    const provider: LlmProviderConfig = {
      id: createId("provider"),
      name: "新 LLM 配置",
      provider: "openai-compatible",
      baseUrl: "",
      model: "",
      apiKey: "",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    onProvidersChange([provider, ...providers]);
    setSelectedId(provider.id);
  };

  const removeProvider = () => {
    if (!selected) {
      return;
    }
    onProvidersChange(providers.filter((provider) => provider.id !== selected.id));
  };

  const testSelectedProvider = () => {
    if (!selected) {
      return;
    }

    const result = validateProviderForBrowserStreaming(selected);
    setTestStatus((current) => ({
      ...current,
      [selected.id]: result,
    }));
  };

  return (
    <section className="admin-grid two-col">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Providers</p>
            <h3>LLM 厂商配置</h3>
          </div>
          <button type="button" className="small-icon-button" onClick={addProvider} aria-label="新增 LLM 配置">
            <Plus size={16} />
          </button>
        </div>
        <p className="admin-note">发送对话时会优先使用启用且已配置 API Key 的 provider 进行浏览器直连流式调用；若被 CORS、网络或密钥问题阻断，会自动回退本地模拟。生产环境建议改为后端代理保存密钥。</p>
        <div className="admin-list">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`admin-list-row ${selected?.id === provider.id ? "active" : ""}`}
              onClick={() => setSelectedId(provider.id)}
            >
              <span className="provider-dot" />
              <span>
                <strong>{provider.name}</strong>
                <em>
                  {getProviderLabel(provider.provider)} · {provider.model || "未设置模型"} · {maskKey(provider.apiKey)}
                </em>
              </span>
              <ProviderReadinessPill provider={provider} status={testStatus[provider.id]} />
            </button>
          ))}
        </div>
      </div>
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Edit Provider</p>
            <h3>{selected ? selected.name : "请选择配置"}</h3>
          </div>
          {selected ? (
            <div className="admin-actions">
              <button type="button" className="icon-button" onClick={testSelectedProvider}>
                <ShieldCheck size={15} />
                连接测试
              </button>
              <button type="button" className="icon-button danger" onClick={removeProvider}>
                <Trash2 size={15} />
                删除
              </button>
            </div>
          ) : null}
        </div>
        {selected ? (
          <div className="admin-form">
            <div className="provider-readiness-card">
              <ProviderReadinessPill provider={selected} status={testStatus[selected.id]} />
              <span>{testStatus[selected.id]?.text ?? "尚未测试。当前测试会做浏览器直连前的配置检查，不会发送 API Key。"}</span>
            </div>
            <label>
              配置名称
              <input value={selected.name} onChange={(event) => updateProvider({ name: event.target.value })} />
            </label>
            <label>
              厂商
              <select
                value={selected.provider}
                onChange={(event) => {
                  const provider = event.target.value as LlmProviderKind;
                  const preset = getProviderPreset(provider);
                  updateProvider({ provider, baseUrl: preset.baseUrl, model: preset.model });
                }}
              >
                {PROVIDER_KINDS.map((provider) => (
                  <option key={provider} value={provider}>
                    {getProviderLabel(provider)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Base URL
              <input value={selected.baseUrl} onChange={(event) => updateProvider({ baseUrl: event.target.value })} />
            </label>
            <label>
              模型
              <input list="llm-model-hints" value={selected.model} onChange={(event) => updateProvider({ model: event.target.value })} />
              <datalist id="llm-model-hints">
                {getProviderPreset(selected.provider).modelHints.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
            <div className="model-hint-grid" aria-label="常用模型">
              {getProviderPreset(selected.provider).modelHints.slice(0, 6).map((model) => (
                <button key={model} type="button" onClick={() => updateProvider({ model })}>
                  {model}
                </button>
              ))}
            </div>
            <label>
              API Key
              <input
                type="password"
                value={selected.apiKey}
                onChange={(event) =>
                  updateProvider({
                    apiKey: event.target.value,
                    enabled: event.target.value.trim() ? true : selected.enabled,
                  })
                }
              />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={selected.enabled} onChange={(event) => updateProvider({ enabled: event.target.checked })} />
              启用该配置
            </label>
          </div>
        ) : (
          <p className="empty-state">暂无 LLM 配置。</p>
        )}
      </div>
    </section>
  );
}

function AgentAdminPanel({
  agents,
  providers,
  onAgentsChange,
}: {
  agents: PsychAgentProfile[];
  providers: LlmProviderConfig[];
  onAgentsChange: (agents: PsychAgentProfile[]) => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState(() => agents[0]?.id ?? "");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftText, setDraftText] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;

  useEffect(() => {
    if (agents.length > 0 && !agents.some((agent) => agent.id === selectedId)) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const updateAgent = (patch: Partial<PsychAgentProfile>) => {
    if (!selected) {
      return;
    }
    const updatedAt = new Date().toISOString();
    onAgentsChange(agents.map((agent) => (agent.id === selected.id ? { ...agent, ...patch, updatedAt } : agent)));
  };

  const addAgent = () => {
    const now = new Date().toISOString();
    const agent: PsychAgentProfile = {
      id: createId("agent"),
      name: "新的沙盘 Agent",
      school: "整合支持取向",
      description: "以温和、非评判的方式陪伴用户整理沙盘体验。",
      avatarStyle: "warm",
      openingMessage: "我会陪你慢慢看这个沙盘。你可以从最有感觉的地方开始。",
      systemPrompt: "你是一个心理沙盘对话伙伴，不做诊断，不替代专业咨询，只帮助用户表达和整理体验。",
      providerId: providers[0]?.id,
      temperature: 0.7,
      enabled: true,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    onAgentsChange([agent, ...agents]);
    setSelectedId(agent.id);
  };

  const removeAgent = () => {
    if (!selected) {
      return;
    }
    onAgentsChange(agents.filter((agent) => agent.id !== selected.id));
  };

  const draftAgent = () => {
    const source = draftPrompt.trim() || "创建一个温暖、支持、适合沙盘结束后对话的心理陪伴 Agent";
    const profile = buildDraftProfile(source, providers[0]?.id);
    const response = `我会把这个 Agent 草拟为：${profile.name}。\n\n定位：${profile.school}\n\n描述：${profile.description}\n\n开场白：${profile.openingMessage}\n\n系统提示词已经生成并填入右侧表单，你可以继续手动调整。`;
    let cursor = 0;

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    setDraftText("");
    setIsDrafting(true);
    timerRef.current = window.setInterval(() => {
      cursor += 4;
      setDraftText(response.slice(0, cursor));
      if (cursor >= response.length) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
        }
        setIsDrafting(false);
        upsertDraftAgent(profile);
      }
    }, 28);
  };

  const upsertDraftAgent = (profile: PsychAgentProfile) => {
    if (selected) {
      const updatedAt = new Date().toISOString();
      onAgentsChange(agents.map((agent) => (agent.id === selected.id ? { ...agent, ...profile, id: selected.id, isBuiltIn: agent.isBuiltIn, createdAt: agent.createdAt, updatedAt } : agent)));
    } else {
      onAgentsChange([profile, ...agents]);
      setSelectedId(profile.id);
    }
  };

  return (
    <section className="admin-grid agent-admin-grid">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Agents</p>
            <h3>心理学家 Agent</h3>
          </div>
          <button type="button" className="small-icon-button" onClick={addAgent} aria-label="新增 Agent">
            <Plus size={16} />
          </button>
        </div>
        <div className="admin-list">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`admin-list-row ${selected?.id === agent.id ? "active" : ""}`}
              onClick={() => setSelectedId(agent.id)}
            >
              <AgentPortrait agent={agent} size="mini" />
              <span>
                <strong>{agent.name}</strong>
                <em>
                  {agent.school} · {agent.enabled ? "启用" : "停用"}
                </em>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Configure</p>
            <h3>{selected ? selected.name : "请选择 Agent"}</h3>
          </div>
          {selected ? (
            <button type="button" className="icon-button danger" onClick={removeAgent}>
              <Trash2 size={15} />
              删除
            </button>
          ) : null}
        </div>
        {selected ? (
          <div className="admin-form">
            <label>
              名称
              <input value={selected.name} onChange={(event) => updateAgent({ name: event.target.value })} />
            </label>
            <label>
              理论取向
              <input value={selected.school} onChange={(event) => updateAgent({ school: event.target.value })} />
            </label>
            <label>
              描述
              <textarea value={selected.description} onChange={(event) => updateAgent({ description: event.target.value })} />
            </label>
            <div className="form-grid-2">
              <label>
                头像风格
                <select value={selected.avatarStyle} onChange={(event) => updateAgent({ avatarStyle: event.target.value as AgentAvatarStyle })}>
                  {AVATAR_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                关联 LLM
                <select value={selected.providerId ?? ""} onChange={(event) => updateAgent({ providerId: event.target.value || undefined })}>
                  <option value="">本地模拟</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              开场白
              <textarea value={selected.openingMessage} onChange={(event) => updateAgent({ openingMessage: event.target.value })} />
            </label>
            <label>
              系统提示词
              <textarea className="tall-textarea" value={selected.systemPrompt} onChange={(event) => updateAgent({ systemPrompt: event.target.value })} />
            </label>
            <label>
              温度 {selected.temperature.toFixed(2)}
              <input type="range" min={0} max={1} step={0.01} value={selected.temperature} onChange={(event) => updateAgent({ temperature: Number(event.target.value) })} />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={selected.enabled} onChange={(event) => updateAgent({ enabled: event.target.checked })} />
              启用该 Agent
            </label>
          </div>
        ) : (
          <p className="empty-state">暂无 Agent。</p>
        )}
      </div>

      <div className="admin-card agent-draft-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">AI Draft</p>
            <h3>用对话草拟 Agent</h3>
          </div>
          <button type="button" className="icon-button" onClick={draftAgent} disabled={isDrafting}>
            <Sparkles size={15} />
            草拟
          </button>
        </div>
        <div className="admin-form">
          <label>
            描述你想创建的 Agent
            <textarea
              className="tall-textarea"
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder="例如：我想要一个荣格取向、温柔、善于提问梦和象征的 Agent..."
            />
          </label>
        </div>
        <div className="draft-output" aria-live="polite">
          {draftText || "输入一段自然语言描述后，点击“草拟”，系统会用本地模拟流式输出生成配置草稿。"}
        </div>
      </div>
    </section>
  );
}

function createRecipe(kind: ToyRecipeKind): ToyModelRecipe {
  if (kind === "person") {
    return { kind: "person", cloth: "#5fb4e4", skin: "#e0a778", bodyScale: 1 };
  }
  return { kind };
}

function createModelPatch(kind: ToyRecipeKind): Pick<
  ManagedAsset,
  "anchor" | "footprint" | "modelRecipe" | "thumbnailScale"
> {
  const spec = getToyAssetSpec(getSpecAssetId(kind), "normal");
  return {
    anchor: spec.anchor,
    footprint: spec.footprint,
    modelRecipe: kind === "person" ? createRecipe(kind) : spec.modelRecipe,
    thumbnailScale: spec.thumbnailScale,
  };
}

function getSpecAssetId(kind: ToyRecipeKind): string {
  const ids: Record<ToyRecipeKind, string> = {
    person: "person_adult",
    dog: "animal_dog",
    bird: "animal_bird",
    fish: "animal_fish",
    lion: "animal_lion",
    house: "env_house",
    bridge: "env_bridge",
    fence: "env_fence",
    tower: "env_tower",
    tree: "nature_tree",
    water: "nature_water",
    rock: "nature_rock",
    sun: "nature_sun",
    monster: "symbol_monster",
    robot: "symbol_robot",
    skull: "symbol_skull",
    light: "symbol_light",
    fallback: "fallback",
  };
  return ids[kind];
}

function splitLines(value: string): string[] {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function maskKey(apiKey: string): string {
  if (!apiKey) {
    return "未配置 key";
  }
  return apiKey.length <= 8 ? "••••••" : `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function isAdminConfigBackup(value: unknown): value is AdminConfigBackup {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schema === "psych-sandbox-admin-config" &&
    (value.version === 1 || value.version === 2) &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.managedAssets) &&
    Array.isArray(value.llmProviders) &&
    Array.isArray(value.agents) &&
    (value.adminGovernance === undefined || isAdminGovernanceBackup(value.adminGovernance))
  );
}

function isAdminGovernanceBackup(value: unknown): value is AdminGovernanceData {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schema === "psych-sandbox-admin-governance" &&
    value.version === 1 &&
    Array.isArray(value.accessPolicies) &&
    Array.isArray(value.logs)
  );
}

function isAdminUserDirectoryExport(value: unknown): value is AdminUserDirectoryExport {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schema === "psych-sandbox-admin-user-directory" &&
    value.version === 1 &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.profiles) &&
    Array.isArray(value.authBindings) &&
    Array.isArray(value.accessPolicies) &&
    value.accessPolicies.every(isAdminAccessPolicyExport)
  );
}

function isAdminAccessPolicyExport(value: unknown): value is AdminAccessPolicy {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.userId === "string" &&
    (value.role === "owner" || value.role === "admin" || value.role === "operator" || value.role === "viewer") &&
    (value.status === "active" || value.status === "disabled" || value.status === "review_required") &&
    (value.workspaceScope === "all" || value.workspaceScope === "assigned" || value.workspaceScope === "own") &&
    Array.isArray(value.deniedPermissions)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildDraftProfile(prompt: string, providerId?: string): PsychAgentProfile {
  const now = new Date().toISOString();
  const isJung = /荣格|象征|原型|梦/.test(prompt);
  const isFreud = /弗洛伊德|精神分析|潜意识|防御|冲突/.test(prompt);
  const name = isJung ? "象征探索伙伴" : isFreud ? "动力倾听伙伴" : "温暖沙盘伙伴";
  const school = isJung ? "分析心理学取向" : isFreud ? "精神分析取向" : "整合支持取向";
  const avatarStyle: AgentAvatarStyle = isJung ? "dream" : isFreud ? "analyst" : "warm";

  return {
    id: createId("agent"),
    name,
    school,
    description: `根据“${prompt.slice(0, 52)}”草拟的沙盘对话 Agent，适合温和陪伴用户整理作品、情绪和意象线索。`,
    avatarStyle,
    openingMessage: "我会陪你慢慢看这个沙盘。你可以从最有感觉的地方开始，也可以只说一句现在的感受。",
    systemPrompt: `你是一个${school}的心理沙盘对话伙伴。用户希望：${prompt}。你不能诊断，不能替代专业咨询；你需要用温柔、开放、非评判的语言进行流式回应。`,
    providerId,
    temperature: isFreud ? 0.64 : 0.74,
    enabled: true,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  };
}
