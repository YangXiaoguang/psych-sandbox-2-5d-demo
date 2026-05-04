import {
  Archive,
  Ban,
  Brain,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  FileArchive,
  Fingerprint,
  GitMerge,
  History,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getEnvironmentLabel } from "../data/environment";
import type { AgentConversation, SandboxAnalysis, SandboxEnvironment, SandboxEvent, SandboxObject } from "../types";
import {
  CONSENT_DEFINITIONS,
  type CommunicationPreferences,
  type ConsentRecord,
  type ConsentType,
  type CreatePersonalUserInput,
  type IdentityProfile,
  type MemoryCandidateStatus,
  type PersonalAgeGroup,
  type PersonalDataBundle,
  type PersonalMemoryCandidate,
  type PersonalRole,
  type SandtraySessionArchive,
} from "../personal/types";
import {
  buildPersonalContextPacket,
  createMemoryBlockRuleFromCandidate,
  createSandtraySessionArchive,
  extractMemoryCandidatesFromSandtraySession,
  exportPersonalArchive,
  getActiveAccount,
  getActivePreferences,
  getActiveProfile,
  getUserConsents,
  mergePersonalMemoryCandidates,
  markSandtrayArchiveRestored,
  recordPersonalAudit,
  updateMemoryBlockRule,
  updatePersonalMemoryCandidate,
} from "../personal/localMemoryStore";

interface PersonalCenterProps {
  personalData: PersonalDataBundle;
  objects: SandboxObject[];
  events: SandboxEvent[];
  conversations: AgentConversation[];
  analysis: SandboxAnalysis;
  environment: SandboxEnvironment;
  onPersonalDataChange: (data: PersonalDataBundle) => void;
  onCreateUser: (input: CreatePersonalUserInput) => void;
  onSwitchUser: (userId: string) => void;
  onRestoreSandtraySession: (session: SandtraySessionArchive) => void;
}

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

const TONE_LABELS: Record<CommunicationPreferences["preferredTone"], string> = {
  gentle: "温和陪伴",
  structured: "结构化梳理",
  direct: "直接清晰",
  playful: "轻松一点",
};

const REPLY_LENGTH_LABELS: Record<CommunicationPreferences["replyLength"], string> = {
  short: "简短",
  balanced: "适中",
  deep: "深入",
};

const USER_DIRECTORY_PAGE_SIZE = 12;
const SANDTRAY_ARCHIVE_PAGE_SIZE = 4;

const MEMORY_STATUS_LABELS: Record<MemoryCandidateStatus, string> = {
  candidate: "待确认",
  confirmed: "已确认",
  dismissed: "已忽略",
  retired: "已撤回",
};

export function PersonalCenter({
  personalData,
  objects,
  events,
  conversations,
  analysis,
  environment,
  onPersonalDataChange,
  onCreateUser,
  onSwitchUser,
  onRestoreSandtraySession,
}: PersonalCenterProps): JSX.Element {
  const activeAccount = getActiveAccount(personalData);
  const activeProfile = getActiveProfile(personalData);
  const preferences = getActivePreferences(personalData);
  const consents = getUserConsents(personalData, activeAccount.userId);
  const activeWorkspace = personalData.workspaces.find((workspace) => workspace.userId === activeAccount.userId);
  const canArchiveSandtray = consents.some((consent) => consent.consentType === "sandtray_archive" && consent.granted);
  const canConfirmLongTermMemory = consents.some((consent) => consent.consentType === "long_term_memory" && consent.granted);
  const canUseMemoryInAgent = consents.some((consent) => consent.consentType === "ai_personalization" && consent.granted);
  const activeAuditLogs = personalData.auditLogs.filter((log) => log.userId === activeAccount.userId).slice(0, 8);
  const grantedCount = consents.filter((consent) => consent.granted).length;
  const [newUserName, setNewUserName] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState<PersonalAgeGroup>("unknown");
  const [newRole, setNewRole] = useState<PersonalRole>("client");
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PersonalRole | "all">("all");
  const [ageFilter, setAgeFilter] = useState<PersonalAgeGroup | "all">("all");
  const [userPage, setUserPage] = useState(1);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [archiveDescription, setArchiveDescription] = useState("");
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archivePage, setArchivePage] = useState(1);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryDraftTitle, setMemoryDraftTitle] = useState("");
  const [memoryDraftSummary, setMemoryDraftSummary] = useState("");
  const [memoryDraftTags, setMemoryDraftTags] = useState("");

  const directoryUsers = useMemo(
    () =>
      personalData.accounts
        .map((account) => {
          const profile = personalData.profiles.find((item) => item.userId === account.userId);
          const role = profile?.role ?? "demo";
          const ageGroup = profile?.ageGroup ?? "unknown";
          return {
            userId: account.userId,
            displayName: profile?.displayName ?? account.displayName,
            localHandle: account.localHandle,
            role,
            ageGroup,
            lastActiveAt: account.lastActiveAt,
          };
        })
        .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt)),
    [personalData.accounts, personalData.profiles],
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = userQuery.trim().toLowerCase();
    return directoryUsers.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          user.displayName,
          user.localHandle,
          user.userId,
          ROLE_LABELS[user.role],
          AGE_GROUP_LABELS[user.ageGroup],
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesAge = ageFilter === "all" || user.ageGroup === ageFilter;
      return matchesQuery && matchesRole && matchesAge;
    });
  }, [ageFilter, directoryUsers, roleFilter, userQuery]);
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USER_DIRECTORY_PAGE_SIZE));
  const currentUserPage = Math.min(userPage, totalUserPages);
  const pagedUsers = filteredUsers.slice(
    (currentUserPage - 1) * USER_DIRECTORY_PAGE_SIZE,
    currentUserPage * USER_DIRECTORY_PAGE_SIZE,
  );

  useEffect(() => {
    setUserPage(1);
  }, [ageFilter, roleFilter, userQuery, personalData.accounts.length]);

  const sandtrayArchives = useMemo(
    () =>
      personalData.sandtraySessions
        .filter((session) => session.userId === activeAccount.userId)
        .sort((a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt)),
    [activeAccount.userId, personalData.sandtraySessions],
  );
  const filteredArchives = useMemo(() => {
    const normalizedQuery = archiveQuery.trim().toLowerCase();
    return sandtrayArchives.filter((session) => {
      if (!normalizedQuery) {
        return true;
      }
      return [
        session.title,
        session.description,
        getEnvironmentLabel(session.snapshot.environment),
        ...session.featureSummary.dominantCategories,
        ...session.featureSummary.dominantZones,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [archiveQuery, sandtrayArchives]);
  const totalArchivePages = Math.max(1, Math.ceil(filteredArchives.length / SANDTRAY_ARCHIVE_PAGE_SIZE));
  const currentArchivePage = Math.min(archivePage, totalArchivePages);
  const pagedArchives = filteredArchives.slice(
    (currentArchivePage - 1) * SANDTRAY_ARCHIVE_PAGE_SIZE,
    currentArchivePage * SANDTRAY_ARCHIVE_PAGE_SIZE,
  );
  const activeMemoryCandidates = useMemo(
    () =>
      personalData.memoryCandidates
        .filter((candidate) => candidate.userId === activeAccount.userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [activeAccount.userId, personalData.memoryCandidates],
  );
  const confirmedMemoryCount = activeMemoryCandidates.filter((candidate) => candidate.status === "confirmed").length;
  const agentContextMemoryCount = activeMemoryCandidates.filter(
    (candidate) => candidate.status === "confirmed" && candidate.includeInAgentContext,
  ).length;
  const filteredMemoryCandidates = useMemo(() => {
    const normalizedQuery = memoryQuery.trim().toLowerCase();
    return activeMemoryCandidates.filter((candidate) => {
      if (!normalizedQuery) {
        return true;
      }
      return [
        candidate.title,
        candidate.summary,
        MEMORY_STATUS_LABELS[candidate.status],
        ...candidate.tags,
        ...candidate.evidence,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeMemoryCandidates, memoryQuery]);
  const contextPacket = useMemo(
    () => buildPersonalContextPacket(personalData, activeAccount.userId),
    [activeAccount.userId, personalData],
  );
  const contextSourceCount = useMemo(
    () => new Set(contextPacket.items.map((item) => item.sourceSessionId).filter(Boolean)).size,
    [contextPacket.items],
  );
  const visibleBlockRules = useMemo(
    () =>
      personalData.memoryBlockRules
        .filter((rule) => rule.userId === activeAccount.userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8),
    [activeAccount.userId, personalData.memoryBlockRules],
  );

  useEffect(() => {
    setArchivePage(1);
  }, [archiveQuery, sandtrayArchives.length]);

  const dataDomains = useMemo(
    () => [
      {
        icon: <FileArchive size={18} />,
        label: "历史档案",
        value: `${sandtrayArchives.length}`,
        detail: "已沉淀为可回溯的沙盘会话",
      },
      {
        icon: <Archive size={18} />,
        label: "当前沙盘",
        value: `${objects.length}`,
        detail: `${events.length} 条事件已进入用户命名空间`,
      },
      {
        icon: <Brain size={18} />,
        label: "记忆候选",
        value: `${confirmedMemoryCount}/${activeMemoryCandidates.length}`,
        detail: `${contextPacket.items.length} 条当前进入 Context Packet`,
      },
      {
        icon: <ShieldCheck size={18} />,
        label: "AI 会话",
        value: `${conversations.length}`,
        detail: "Agent 对话按当前用户隔离保存",
      },
      {
        icon: <CheckCircle2 size={18} />,
        label: "授权项",
        value: `${grantedCount}/${consents.length}`,
        detail: "长期记忆默认需要额外确认",
      },
      {
        icon: <Fingerprint size={18} />,
        label: "中心对象",
        value: `${analysis.centerObjects.length}`,
        detail: "用于后续沙盘记忆摘要，不等于诊断",
      },
    ],
    [
      analysis.centerObjects.length,
      activeMemoryCandidates.length,
      consents.length,
      contextPacket.items.length,
      conversations.length,
      events.length,
      confirmedMemoryCount,
      grantedCount,
      objects.length,
      sandtrayArchives.length,
    ],
  );

  const updateProfile = (patch: Partial<IdentityProfile>) => {
    const now = new Date().toISOString();
    onPersonalDataChange({
      ...personalData,
      accounts: personalData.accounts.map((account) =>
        account.userId === activeAccount.userId && patch.displayName
          ? { ...account, displayName: patch.displayName, lastActiveAt: now }
          : account,
      ),
      profiles: personalData.profiles.map((profile) =>
        profile.userId === activeAccount.userId ? { ...profile, ...patch, updatedAt: now } : profile,
      ),
    });
  };

  const updatePreferences = (patch: Partial<CommunicationPreferences>) => {
    const now = new Date().toISOString();
    onPersonalDataChange({
      ...personalData,
      preferences: personalData.preferences.map((item) =>
        item.userId === activeAccount.userId ? { ...item, ...patch, updatedAt: now } : item,
      ),
    });
  };

  const updateConsent = (consentType: ConsentType, granted: boolean) => {
    const now = new Date().toISOString();
    const definition = CONSENT_DEFINITIONS.find((item) => item.type === consentType);
    const nextData = {
      ...personalData,
      consents: personalData.consents.map((consent) =>
        consent.userId === activeAccount.userId && consent.consentType === consentType
          ? {
              ...consent,
              granted,
              updatedAt: now,
              revokedAt: granted ? undefined : now,
            }
          : consent,
      ),
    };
    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: granted ? "consent_granted" : "consent_revoked",
        resourceType: "consent",
        resourceId: consentType,
        detail: `${granted ? "开启" : "关闭"}授权：${definition?.title ?? consentType}`,
      }),
    );
  };

  const handleCreateUser = () => {
    onCreateUser({
      displayName: newUserName.trim() || "新的本地用户",
      ageGroup: newAgeGroup,
      role: newRole,
    });
    setNewUserName("");
    setNewAgeGroup("unknown");
    setNewRole("client");
    setCreatePanelOpen(false);
    setUserPage(1);
  };

  const handleExportArchive = () => {
    exportPersonalArchive(personalData);
    onPersonalDataChange(
      recordPersonalAudit(personalData, {
        action: "personal_archive_exported",
        resourceType: "archive",
        detail: "已导出本地个人档案 JSON。该文件只下载到本机，没有上传到第三方。",
      }),
    );
  };

  const handleSaveCurrentSandtrayArchive = () => {
    if (!canArchiveSandtray) {
      return;
    }
    const session = createSandtraySessionArchive({
      userId: activeAccount.userId,
      workspaceId: activeWorkspace?.workspaceId,
      title: archiveTitle,
      description: archiveDescription,
      objects,
      events,
      analysis,
      environment,
    });
    const nextData = {
      ...personalData,
      sandtraySessions: [session, ...personalData.sandtraySessions],
    };
    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: "sandtray_session_archived",
        resourceType: "sandtray_session",
        resourceId: session.sessionId,
        detail: `已保存沙盘会话档案：${session.title}`,
      }),
    );
    setArchiveTitle("");
    setArchiveDescription("");
    setArchivePage(1);
  };

  const handleRestoreArchive = (session: SandtraySessionArchive) => {
    onPersonalDataChange(
      recordPersonalAudit(markSandtrayArchiveRestored(personalData, session.sessionId), {
        action: "sandtray_session_restored",
        resourceType: "sandtray_session",
        resourceId: session.sessionId,
        detail: `已从历史档案恢复到沙盘编辑器：${session.title}`,
      }),
    );
    onRestoreSandtraySession(session);
  };

  const handleExportSandtrayArchive = (session: SandtraySessionArchive) => {
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `psych-sandtray-session-${session.archivedAt.slice(0, 10)}-${session.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExtractMemoryCandidates = (session: SandtraySessionArchive) => {
    const result = extractMemoryCandidatesFromSandtraySession(personalData, session);
    onPersonalDataChange(
      recordPersonalAudit(result.data, {
        action: "memory_candidates_extracted",
        resourceType: "memory_candidate",
        resourceId: session.sessionId,
        detail:
          result.createdCount > 0
            ? `已从历史作品提取 ${result.createdCount} 条候选记忆：${session.title}`
            : `该历史作品暂无新的候选记忆：${session.title}`,
      }),
    );
  };

  const handleUpdateMemoryCandidate = (
    candidate: PersonalMemoryCandidate,
    patch: Partial<Pick<PersonalMemoryCandidate, "status" | "includeInAgentContext">>,
    detail: string,
  ) => {
    onPersonalDataChange(
      recordPersonalAudit(updatePersonalMemoryCandidate(personalData, candidate.memoryId, patch), {
        action: "memory_candidate_updated",
        resourceType: "memory_candidate",
        resourceId: candidate.memoryId,
        detail,
      }),
    );
  };

  const handleStartEditMemory = (candidate: PersonalMemoryCandidate) => {
    setEditingMemoryId(candidate.memoryId);
    setMemoryDraftTitle(candidate.title);
    setMemoryDraftSummary(candidate.summary);
    setMemoryDraftTags(candidate.tags.join("、"));
  };

  const handleCancelEditMemory = () => {
    setEditingMemoryId(null);
    setMemoryDraftTitle("");
    setMemoryDraftSummary("");
    setMemoryDraftTags("");
  };

  const handleSaveMemoryEdit = (candidate: PersonalMemoryCandidate) => {
    const tags = parseMemoryTags(memoryDraftTags);
    const nextData = updatePersonalMemoryCandidate(personalData, candidate.memoryId, {
      title: memoryDraftTitle.trim() || candidate.title,
      summary: memoryDraftSummary.trim() || candidate.summary,
      tags: tags.length > 0 ? tags : candidate.tags,
    });

    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: "memory_candidate_edited",
        resourceType: "memory_candidate",
        resourceId: candidate.memoryId,
        detail: `已编辑记忆：${memoryDraftTitle.trim() || candidate.title}`,
      }),
    );
    handleCancelEditMemory();
  };

  const handleMergeSimilarMemories = (candidate: PersonalMemoryCandidate) => {
    const similarCandidates = getSimilarMemoryCandidates(candidate, activeMemoryCandidates).slice(0, 3);
    if (similarCandidates.length === 0) {
      return;
    }
    const nextData = mergePersonalMemoryCandidates(
      personalData,
      candidate.memoryId,
      similarCandidates.map((item) => item.memoryId),
    );
    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: "memory_candidates_merged",
        resourceType: "memory_candidate",
        resourceId: candidate.memoryId,
        detail: `已将 ${similarCandidates.length} 条相似记忆合并到：${candidate.title}`,
      }),
    );
  };

  const handleBlockSimilarMemories = (candidate: PersonalMemoryCandidate) => {
    const nextData = createMemoryBlockRuleFromCandidate(personalData, candidate);
    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: "memory_rule_created",
        resourceType: "memory_rule",
        resourceId: candidate.memoryId,
        detail: `已建立屏蔽规则，不再向 Agent 注入类似记忆：${candidate.tags[0] ?? candidate.title}`,
      }),
    );
  };

  const handleToggleMemoryRule = (ruleId: string, active: boolean, label: string) => {
    const nextData = updateMemoryBlockRule(personalData, ruleId, { active });
    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: active ? "memory_rule_enabled" : "memory_rule_disabled",
        resourceType: "memory_rule",
        resourceId: ruleId,
        detail: `${active ? "已启用" : "已停用"}记忆屏蔽规则：${label}`,
      }),
    );
  };

  return (
    <main className="personal-shell" aria-label="个人中心">
      <section className="personal-hero">
        <div>
          <p className="eyebrow">Personal Memory OS</p>
          <h2>个人中心</h2>
          <p>
            管理本地身份、授权边界、沙盘工作区和个人记忆准备状态。当前版本是本地原型，后续可平滑迁移到真实账号与后端。
          </p>
        </div>
        <div className="personal-hero-card" aria-label="当前用户">
          <span>
            <UserRound size={19} />
          </span>
          <div>
            <strong>{activeProfile.displayName}</strong>
            <em>
              {ROLE_LABELS[activeProfile.role]} · {AGE_GROUP_LABELS[activeProfile.ageGroup]}
            </em>
          </div>
        </div>
      </section>

      <section className="personal-layout">
        <aside className="admin-card personal-identity-rail" aria-label="本地用户">
          <div className="admin-card-header">
            <div>
              <p className="eyebrow">Local Directory</p>
              <h3>用户目录</h3>
            </div>
            <span className="personal-directory-count">{personalData.accounts.length}</span>
          </div>

          <section className="personal-current-user-card" aria-label="当前用户">
            <div>
              <span>
                <UserRound size={17} />
              </span>
              <div>
                <strong>{activeProfile.displayName}</strong>
                <em>
                  当前用户 · {ROLE_LABELS[activeProfile.role]} · {AGE_GROUP_LABELS[activeProfile.ageGroup]}
                </em>
              </div>
            </div>
            <p>{activeAccount.localHandle}</p>
          </section>

          <section className="personal-directory-tools" aria-label="用户检索">
            <label className="personal-user-search">
              <Search size={15} />
              <input
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="搜索姓名、ID、角色..."
              />
            </label>
            <div className="personal-filter-row">
              <label>
                <SlidersHorizontal size={14} />
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
                <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as PersonalAgeGroup | "all")}>
                  <option value="all">全部年龄</option>
                  {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="personal-directory-meta">
              <span>
                显示 {filteredUsers.length} / {personalData.accounts.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setUserQuery("");
                  setRoleFilter("all");
                  setAgeFilter("all");
                }}
              >
                重置
              </button>
            </div>
          </section>

          <div className="personal-directory-list" aria-label="用户列表">
            {pagedUsers.length > 0 ? (
              pagedUsers.map((user) => (
                <button
                  key={user.userId}
                  type="button"
                  className={user.userId === activeAccount.userId ? "active" : ""}
                  onClick={() => onSwitchUser(user.userId)}
                >
                  <span>
                    <UserRound size={16} />
                  </span>
                  <strong>{user.displayName}</strong>
                  <em>
                    {ROLE_LABELS[user.role]} · {AGE_GROUP_LABELS[user.ageGroup]} · {user.localHandle}
                  </em>
                </button>
              ))
            ) : (
              <div className="personal-directory-empty">
                <span>
                  <UserRound size={16} />
                </span>
                <strong>没有匹配用户</strong>
                <em>调整搜索关键词或筛选条件。</em>
              </div>
            )}
          </div>

          <div className="personal-directory-pager" aria-label="用户分页">
            <button
              type="button"
              onClick={() => setUserPage((current) => Math.max(1, current - 1))}
              disabled={currentUserPage <= 1}
              aria-label="上一页用户"
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              {currentUserPage} / {totalUserPages}
            </span>
            <button
              type="button"
              onClick={() => setUserPage((current) => Math.min(totalUserPages, current + 1))}
              disabled={currentUserPage >= totalUserPages}
              aria-label="下一页用户"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <button
            className="personal-create-toggle"
            type="button"
            onClick={() => setCreatePanelOpen((current) => !current)}
          >
            <Plus size={15} />
            {createPanelOpen ? "收起新增" : "新增本地用户"}
          </button>

          {createPanelOpen ? (
            <div className="personal-create-box">
              <h4>
                <Plus size={15} />
                新建用户档案
              </h4>
              <label>
                显示名称
                <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="例如：小明 / 我自己" />
              </label>
              <label>
                年龄段
                <select value={newAgeGroup} onChange={(event) => setNewAgeGroup(event.target.value as PersonalAgeGroup)}>
                  {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                角色
                <select value={newRole} onChange={(event) => setNewRole(event.target.value as PersonalRole)}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={handleCreateUser}>
                <Plus size={15} />
                创建并进入
              </button>
            </div>
          ) : null}

          <p className="personal-local-note">
            <KeyRound size={14} />
            万级用户应迁移到服务端目录检索、分页和权限系统；当前本地版采用分页渲染，避免一次性堆叠全部用户。
          </p>
        </aside>

        <section className="personal-main-column">
          <div className="personal-status-grid" aria-label="个人数据概览">
            {dataDomains.map((item) => (
              <article key={item.label} className="personal-status-card">
                <span>{item.icon}</span>
                <div>
                  <strong>{item.value}</strong>
                  <em>{item.label}</em>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>

          <section className="admin-card personal-sandtray-archive-card" aria-label="沙盘会话档案">
            <div className="admin-card-header">
              <div>
                <p className="eyebrow">Sandtray Session Archive</p>
                <h3>沙盘会话档案</h3>
              </div>
              <span className="personal-pill">{sandtrayArchives.length} 个历史作品</span>
            </div>
            <div className="personal-archive-body">
              <section className="personal-archive-composer" aria-label="保存当前沙盘">
                <div>
                  <h4>
                    <FileArchive size={15} />
                    保存当前作品
                  </h4>
                  <p>
                    将当前沙盘对象、事件流、环境、九宫格统计和风险分布沉淀为该用户的历史档案。
                  </p>
                </div>
                <label>
                  档案标题
                  <input
                    value={archiveTitle}
                    onChange={(event) => setArchiveTitle(event.target.value)}
                    placeholder={`沙盘作品 ${new Date().toLocaleDateString("zh-CN")}`}
                  />
                </label>
                <label>
                  用户叙述 / 备注
                  <textarea
                    value={archiveDescription}
                    onChange={(event) => setArchiveDescription(event.target.value)}
                    placeholder="可以记录这个作品的主题、创作背景或当下感受。"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveCurrentSandtrayArchive}
                  disabled={!canArchiveSandtray || objects.length === 0}
                >
                  <FileArchive size={15} />
                  保存到历史档案
                </button>
                {!canArchiveSandtray ? (
                  <p className="personal-archive-warning">请先在授权设置中开启“保存沙盘作品与事件流”。</p>
                ) : null}
              </section>

              <section className="personal-archive-list-panel" aria-label="历史作品列表">
                <div className="personal-archive-toolbar">
                  <label>
                    <Search size={15} />
                    <input
                      value={archiveQuery}
                      onChange={(event) => setArchiveQuery(event.target.value)}
                      placeholder="搜索标题、备注、天气、分类或区域..."
                    />
                  </label>
                  <span>
                    显示 {filteredArchives.length} / {sandtrayArchives.length}
                  </span>
                </div>

                <div className="personal-archive-list">
                  {pagedArchives.length > 0 ? (
                    pagedArchives.map((session) => (
                      <article key={session.sessionId} className="personal-archive-item">
                        <div className="personal-archive-item-head">
                          <div>
                            <strong>{session.title}</strong>
                            <time>
                              <CalendarClock size={13} />
                              {new Date(session.archivedAt).toLocaleString("zh-CN")}
                            </time>
                          </div>
                          <span>{getEnvironmentLabel(session.snapshot.environment)}</span>
                        </div>
                        {session.description ? <p>{session.description}</p> : null}
                        <div className="personal-archive-metrics">
                          <span>{session.featureSummary.objectCount} 沙具</span>
                          <span>{session.featureSummary.eventCount} 事件</span>
                          <span>{session.featureSummary.centerCount} 中心</span>
                          <span>{session.featureSummary.boundaryCount} 边界</span>
                        </div>
                        <div className="personal-archive-chips">
                          {session.featureSummary.dominantCategories.slice(0, 3).map((category) => (
                            <span key={category}>{category}</span>
                          ))}
                          {session.featureSummary.dominantZones.slice(0, 3).map((zone) => (
                            <span key={zone}>{zone}</span>
                          ))}
                        </div>
                        <div className="personal-archive-actions">
                          <button type="button" onClick={() => handleExtractMemoryCandidates(session)}>
                            <Sparkles size={14} />
                            提取候选
                          </button>
                          <button type="button" onClick={() => handleRestoreArchive(session)}>
                            <RotateCcw size={14} />
                            恢复到沙盘
                          </button>
                          <button type="button" onClick={() => handleExportSandtrayArchive(session)}>
                            <Download size={14} />
                            导出
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="personal-archive-empty">
                      <FileArchive size={20} />
                      <strong>暂无历史作品</strong>
                      <p>保存当前沙盘后，会在这里形成可检索、可恢复的个人沙盘档案。</p>
                    </div>
                  )}
                </div>

                <div className="personal-archive-pager" aria-label="历史作品分页">
                  <button
                    type="button"
                    onClick={() => setArchivePage((current) => Math.max(1, current - 1))}
                    disabled={currentArchivePage <= 1}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span>
                    {currentArchivePage} / {totalArchivePages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setArchivePage((current) => Math.min(totalArchivePages, current + 1))}
                    disabled={currentArchivePage >= totalArchivePages}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </section>
            </div>
          </section>

          <section className="admin-card personal-profile-card" aria-label="基础资料">
            <div className="admin-card-header">
              <div>
                <p className="eyebrow">Identity Profile</p>
                <h3>基础资料</h3>
              </div>
              <button className="admin-config-actions-button" type="button" onClick={handleExportArchive}>
                <Download size={15} />
                导出档案
              </button>
            </div>
            <div className="admin-form">
              <div className="form-grid-2">
                <label>
                  显示名称
                  <input value={activeProfile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} />
                </label>
                <label>
                  时区
                  <input value={activeProfile.timezone} onChange={(event) => updateProfile({ timezone: event.target.value })} />
                </label>
                <label>
                  年龄段
                  <select value={activeProfile.ageGroup} onChange={(event) => updateProfile({ ageGroup: event.target.value as PersonalAgeGroup })}>
                    {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  角色
                  <select value={activeProfile.role} onChange={(event) => updateProfile({ role: event.target.value as PersonalRole })}>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  监护人 / 重要支持者
                  <input value={activeProfile.guardianName ?? ""} onChange={(event) => updateProfile({ guardianName: event.target.value })} />
                </label>
                <label>
                  咨询师 / 陪伴者
                  <input value={activeProfile.clinicianName ?? ""} onChange={(event) => updateProfile({ clinicianName: event.target.value })} />
                </label>
              </div>
              <label>
                个人备注
                <textarea
                  value={activeProfile.notes ?? ""}
                  onChange={(event) => updateProfile({ notes: event.target.value })}
                  placeholder="可以记录当前服务场景、需要注意的边界或用户主动补充的信息。"
                />
              </label>
              <div className="form-grid-2">
                <label>
                  AI 沟通语气
                  <select
                    value={preferences.preferredTone}
                    onChange={(event) =>
                      updatePreferences({ preferredTone: event.target.value as CommunicationPreferences["preferredTone"] })
                    }
                  >
                    {Object.entries(TONE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  回复长度
                  <select
                    value={preferences.replyLength}
                    onChange={(event) =>
                      updatePreferences({ replyLength: event.target.value as CommunicationPreferences["replyLength"] })
                    }
                  >
                    {Object.entries(REPLY_LENGTH_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={preferences.prefersVisualExplanation}
                  onChange={(event) => updatePreferences({ prefersVisualExplanation: event.target.checked })}
                />
                偏好图像化解释与沙盘结构提示
              </label>
            </div>
          </section>

          <section className="admin-card personal-consent-card" aria-label="授权设置">
            <div className="admin-card-header">
              <div>
                <p className="eyebrow">Consent & Scope</p>
                <h3>授权与使用边界</h3>
              </div>
              <span className="personal-pill">{grantedCount} 项已开启</span>
            </div>
            <div className="personal-consent-list">
              {consents.map((consent) => {
                const definition = CONSENT_DEFINITIONS.find((item) => item.type === consent.consentType);
                return (
                  <label key={consent.consentId} className="personal-consent-row">
                    <input
                      type="checkbox"
                      checked={consent.granted}
                      onChange={(event) => updateConsent(consent.consentType, event.target.checked)}
                    />
                    <span>
                      <strong>{definition?.title ?? consent.consentType}</strong>
                      <em>{definition?.description ?? consent.reason}</em>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="admin-card personal-governance-panel" aria-label="记忆治理状态">
          <div className="admin-card-header">
            <div>
              <p className="eyebrow">Memory Governance</p>
              <h3>记忆准备状态</h3>
            </div>
          </div>
          <div className="personal-governance-body">
            <section>
              <h4>
                <CheckCircle2 size={15} />
                当前已完成
              </h4>
              <ul>
                <li>本地用户身份与工作区隔离</li>
                <li>沙盘作品按用户命名空间保存</li>
                <li>Agent 会话按用户命名空间保存</li>
                <li>授权项与审计日志可见</li>
              </ul>
            </section>
            <section className="personal-context-packet-card">
              <div className="personal-memory-header">
                <h4>
                  <Sparkles size={15} />
                  Context Packet 预览
                </h4>
                <span>{contextPacket.enabled ? "可注入" : "未启用"}</span>
              </div>
              <div className="personal-context-stats">
                <span>
                  <strong>{contextPacket.items.length}</strong>
                  <em>将被使用</em>
                </span>
                <span>
                  <strong>{agentContextMemoryCount}</strong>
                  <em>已勾选</em>
                </span>
                <span>
                  <strong>{contextSourceCount}</strong>
                  <em>来源作品</em>
                </span>
                <span>
                  <strong>{contextPacket.blockedMemoryCount}</strong>
                  <em>被屏蔽</em>
                </span>
              </div>
              {contextPacket.blockedReasons.length > 0 ? (
                <div className="personal-context-blocked">
                  {contextPacket.blockedReasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              ) : null}
              <div className="personal-context-packet-list">
                {contextPacket.items.length > 0 ? (
                  contextPacket.items.map((item) => {
                    const sourceSession = item.sourceSessionId
                      ? sandtrayArchives.find((session) => session.sessionId === item.sourceSessionId)
                      : undefined;
                    return (
                      <article key={item.memoryId} className="personal-context-packet-item">
                        <div>
                          <strong>{item.title}</strong>
                          <span>{Math.round(item.confidence * 100)}%</span>
                        </div>
                        <p>{item.summary}</p>
                        <em>{item.reason}</em>
                        <div className="personal-context-source">
                          <span>
                            来源：{item.sourceSessionTitle ?? "未关联历史作品"}
                            {item.sourceArchivedAt ? ` · ${new Date(item.sourceArchivedAt).toLocaleDateString("zh-CN")}` : ""}
                          </span>
                          {sourceSession ? (
                            <button type="button" onClick={() => handleRestoreArchive(sourceSession)}>
                              <RotateCcw size={13} />
                              恢复来源
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="personal-memory-empty">
                    <Sparkles size={17} />
                    <strong>暂无可注入记忆</strong>
                    <span>确认候选记忆，并开启 Agent 注入后，会在这里显示将被 AI 使用的上下文。</span>
                  </div>
                )}
              </div>
              <details className="personal-context-raw">
                <summary>查看将注入 Agent 的文本</summary>
                <pre>
                  {contextPacket.promptLines.length > 0
                    ? contextPacket.promptLines.join("\n")
                    : "当前没有可注入的 Context Packet 文本。"}
                </pre>
              </details>
            </section>
            <section className="personal-memory-candidates-card">
              <div className="personal-memory-header">
                <h4>
                  <Brain size={15} />
                  记忆候选
                </h4>
                <span>
                  {confirmedMemoryCount} / {activeMemoryCandidates.length}
                </span>
              </div>
              <p>
                候选记忆只来自已保存的沙盘档案。确认前不会进入长期记忆；开启 AI 个性化后，才可选择注入 Agent 上下文。
              </p>
              <label className="personal-memory-search">
                <Search size={14} />
                <input
                  value={memoryQuery}
                  onChange={(event) => setMemoryQuery(event.target.value)}
                  placeholder="搜索候选、标签、证据..."
                />
              </label>
              {!canConfirmLongTermMemory ? (
                <p className="personal-memory-warning">要确认长期记忆，请先开启“长期记忆候选”授权。</p>
              ) : null}
              {!canUseMemoryInAgent ? (
                <p className="personal-memory-warning">要注入 Agent，请先开启“AI 个性化上下文”授权。</p>
              ) : null}
              <div className="personal-memory-candidate-list">
                {filteredMemoryCandidates.length > 0 ? (
                  filteredMemoryCandidates.slice(0, 8).map((candidate) => {
                    const isEditing = editingMemoryId === candidate.memoryId;
                    const similarCandidates = getSimilarMemoryCandidates(candidate, activeMemoryCandidates);
                    return (
                      <article key={candidate.memoryId} className={`personal-memory-candidate ${candidate.status}`}>
                        <div>
                          <strong>{candidate.title}</strong>
                          <span>{MEMORY_STATUS_LABELS[candidate.status]}</span>
                        </div>
                        {isEditing ? (
                          <div className="personal-memory-editor">
                            <label>
                              标题
                              <input
                                value={memoryDraftTitle}
                                onChange={(event) => setMemoryDraftTitle(event.target.value)}
                              />
                            </label>
                            <label>
                              记忆文本
                              <textarea
                                value={memoryDraftSummary}
                                onChange={(event) => setMemoryDraftSummary(event.target.value)}
                              />
                            </label>
                            <label>
                              标签
                              <input
                                value={memoryDraftTags}
                                onChange={(event) => setMemoryDraftTags(event.target.value)}
                                placeholder="用顿号、逗号或空格分隔"
                              />
                            </label>
                          </div>
                        ) : (
                          <>
                            <p>{candidate.summary}</p>
                            <div className="personal-memory-evidence">
                              {candidate.evidence.slice(0, 2).map((item) => (
                                <em key={item}>{item}</em>
                              ))}
                              {candidate.mergedFromMemoryIds?.length ? (
                                <em>已合并 {candidate.mergedFromMemoryIds.length} 条</em>
                              ) : null}
                            </div>
                            <div className="personal-memory-tags">
                              {candidate.tags.slice(0, 4).map((tag) => (
                                <span key={tag}>{tag}</span>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="personal-memory-actions">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={() => handleSaveMemoryEdit(candidate)}>
                                <Save size={14} />
                                保存
                              </button>
                              <button type="button" onClick={handleCancelEditMemory}>
                                <XCircle size={14} />
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              {candidate.status !== "confirmed" ? (
                                <button
                                  type="button"
                                  disabled={!canConfirmLongTermMemory}
                                  onClick={() =>
                                    handleUpdateMemoryCandidate(
                                      candidate,
                                      { status: "confirmed", includeInAgentContext: canUseMemoryInAgent },
                                      `已确认候选记忆：${candidate.title}`,
                                    )
                                  }
                                >
                                  <CheckCircle2 size={14} />
                                  确认
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateMemoryCandidate(
                                      candidate,
                                      { status: "retired", includeInAgentContext: false },
                                      `已撤回长期记忆：${candidate.title}`,
                                    )
                                  }
                                >
                                  <RotateCcw size={14} />
                                  撤回
                                </button>
                              )}
                              <button type="button" onClick={() => handleStartEditMemory(candidate)}>
                                <Pencil size={14} />
                                编辑
                              </button>
                              <button
                                type="button"
                                disabled={similarCandidates.length === 0 || candidate.status === "retired"}
                                onClick={() => handleMergeSimilarMemories(candidate)}
                              >
                                <GitMerge size={14} />
                                合并{similarCandidates.length > 0 ? ` ${Math.min(similarCandidates.length, 3)}` : ""}
                              </button>
                              <button
                                type="button"
                                disabled={candidate.status === "retired"}
                                onClick={() => handleBlockSimilarMemories(candidate)}
                              >
                                <Ban size={14} />
                                屏蔽此类
                              </button>
                              <button
                                type="button"
                                disabled={candidate.status === "confirmed" || candidate.status === "retired"}
                                onClick={() =>
                                  handleUpdateMemoryCandidate(
                                    candidate,
                                    { status: "dismissed", includeInAgentContext: false },
                                    `已忽略候选记忆：${candidate.title}`,
                                  )
                                }
                              >
                                <XCircle size={14} />
                                忽略
                              </button>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={candidate.status === "confirmed" && candidate.includeInAgentContext}
                                  disabled={candidate.status !== "confirmed" || !canUseMemoryInAgent}
                                  onChange={(event) =>
                                    handleUpdateMemoryCandidate(
                                      candidate,
                                      { includeInAgentContext: event.target.checked },
                                      `${event.target.checked ? "已允许" : "已停止"}注入 Agent 上下文：${candidate.title}`,
                                    )
                                  }
                                />
                                Agent
                              </label>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="personal-memory-empty">
                    <Sparkles size={17} />
                    <strong>暂无候选记忆</strong>
                    <span>先保存一个历史作品，再在档案卡片中点击“提取候选”。</span>
                  </div>
                )}
              </div>
              <div className="personal-memory-rules">
                <div>
                  <strong>屏蔽规则</strong>
                  <span>{visibleBlockRules.filter((rule) => rule.active).length} 项启用</span>
                </div>
                {visibleBlockRules.length > 0 ? (
                  visibleBlockRules.map((rule) => (
                    <article key={rule.ruleId} className={rule.active ? "active" : ""}>
                      <span>
                        <strong>{rule.label}</strong>
                        <em>匹配：{rule.matchText}</em>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleMemoryRule(rule.ruleId, !rule.active, rule.label)}
                      >
                        {rule.active ? "停用" : "启用"}
                      </button>
                    </article>
                  ))
                ) : (
                  <p>还没有屏蔽规则。点击候选记忆里的“屏蔽此类”，可阻止相似记忆进入 Context Packet。</p>
                )}
              </div>
            </section>
            <section>
              <h4>
                <Brain size={15} />
                下一阶段
              </h4>
              <ul>
                <li>跨会话记忆聚合与冲突提示</li>
                <li>用户可编辑的记忆 Dashboard</li>
                <li>Context Packet 可视化预览</li>
                <li>服务端同步和权限策略</li>
              </ul>
            </section>
            <section className="personal-workspace-card">
              <h4>
                <Archive size={15} />
                当前工作区
              </h4>
              <strong>{activeWorkspace?.title ?? "默认工作区"}</strong>
              <p>{activeWorkspace?.description ?? "本地沙盘工作区"}</p>
            </section>
            <section>
              <h4>
                <History size={15} />
                审计日志
              </h4>
              <div className="personal-audit-list">
                {activeAuditLogs.length > 0 ? (
                  activeAuditLogs.map((log) => (
                    <article key={log.id}>
                      <strong>{log.detail}</strong>
                      <time>{new Date(log.createdAt).toLocaleString("zh-CN")}</time>
                    </article>
                  ))
                ) : (
                  <p>暂无该用户的审计记录。</p>
                )}
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}

function parseMemoryTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[、,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

function getSimilarMemoryCandidates(
  candidate: PersonalMemoryCandidate,
  candidates: PersonalMemoryCandidate[],
): PersonalMemoryCandidate[] {
  const tagSet = new Set(candidate.tags);
  return candidates
    .filter((item) => item.memoryId !== candidate.memoryId)
    .filter((item) => item.status !== "dismissed" && item.status !== "retired")
    .map((item) => {
      const sharedTags = item.tags.filter((tag) => tagSet.has(tag)).length;
      const sameKind = item.kind === candidate.kind ? 1 : 0;
      const sameSource = item.sourceSessionId && item.sourceSessionId === candidate.sourceSessionId ? 1 : 0;
      return { item, score: sharedTags * 2 + sameKind + sameSource };
    })
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .map(({ item }) => item);
}
