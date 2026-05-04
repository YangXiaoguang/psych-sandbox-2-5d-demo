import { createId } from "../utils/id";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../utils/analysis";
import {
  CONSENT_DEFINITIONS,
  DEFAULT_PERSONAL_USER_ID,
  PERSONAL_MEMORY_SCHEMA,
  PERSONAL_MEMORY_VERSION,
  type AuditResourceType,
  type CommunicationPreferences,
  type ConsentRecord,
  type CreatePersonalUserInput,
  type IdentityProfile,
  type PersonalAccount,
  type PersonalArchiveImportMode,
  type PersonalArchiveImportResult,
  type PersonalArchiveValidationReport,
  type PersonalArchiveValidationSummary,
  type PersonalAgeGroup,
  type PersonalAuditLog,
  type PersonalContextPacket,
  type PersonalDataBundle,
  type PersonalMemoryBlockRule,
  type PersonalMemoryCandidate,
  type PersonalRole,
  type SandtraySessionArchive,
  type UserWorkspace,
} from "./types";
import type { SandboxAnalysis, SandboxEnvironment, SandboxEvent, SandboxObject } from "../types";

const PERSONAL_DATA_KEY = "psych-sandbox-2-5d-demo.personal-memory-os.v1";

export function loadPersonalData(): PersonalDataBundle {
  const parsed = readJson<PersonalDataBundle>(PERSONAL_DATA_KEY);
  if (!isPersonalDataBundle(parsed)) {
    const data = createDefaultPersonalData();
    savePersonalData(data);
    return data;
  }

  return normalizePersonalData(parsed);
}

export function savePersonalData(data: PersonalDataBundle): void {
  writeJson(PERSONAL_DATA_KEY, normalizePersonalData(data));
}

export function createDefaultPersonalData(): PersonalDataBundle {
  const now = new Date().toISOString();
  const account = createPersonalAccount({
    userId: DEFAULT_PERSONAL_USER_ID,
    displayName: "本地来访者",
    localHandle: "local-default",
    now,
  });
  const profile = createIdentityProfile({
    userId: account.userId,
    displayName: account.displayName,
    ageGroup: "unknown",
    role: "demo",
    now,
  });
  const preferences = createCommunicationPreferences(account.userId, now);
  const workspaces = [createUserWorkspace(account.userId, "默认沙盘工作区", now)];
  const consents = createDefaultConsents(account.userId, now);
  const auditLogs = [
    createAuditLog({
      userId: account.userId,
      action: "personal_os_initialized",
      resourceType: "account",
      resourceId: account.userId,
      detail: "已初始化本地个人记忆 OS，并将旧版本地沙盘数据挂载到默认用户。",
      now,
    }),
  ];

  return {
    schema: PERSONAL_MEMORY_SCHEMA,
    version: PERSONAL_MEMORY_VERSION,
    activeUserId: account.userId,
    accounts: [account],
    profiles: [profile],
    preferences: [preferences],
    consents,
    workspaces,
    sandtraySessions: [],
    memoryCandidates: [],
    memoryBlockRules: [],
    auditLogs,
  };
}

export function createLocalPersonalUser(
  data: PersonalDataBundle,
  input: CreatePersonalUserInput,
): { data: PersonalDataBundle; userId: string } {
  const now = new Date().toISOString();
  const userId = createId("user");
  const displayName = input.displayName.trim() || "新的本地用户";
  const account = createPersonalAccount({
    userId,
    displayName,
    localHandle: `local-${data.accounts.length + 1}`,
    now,
  });
  const profile = createIdentityProfile({
    userId,
    displayName,
    ageGroup: input.ageGroup,
    role: input.role,
    now,
  });
  const nextData = normalizePersonalData({
    ...data,
    activeUserId: userId,
    accounts: [...data.accounts, account],
    profiles: [...data.profiles, profile],
    preferences: [...data.preferences, createCommunicationPreferences(userId, now)],
    consents: [...data.consents, ...createDefaultConsents(userId, now)],
    workspaces: [...data.workspaces, createUserWorkspace(userId, `${displayName}的沙盘工作区`, now)],
    sandtraySessions: data.sandtraySessions,
    memoryCandidates: data.memoryCandidates,
    memoryBlockRules: data.memoryBlockRules,
    auditLogs: [
      createAuditLog({
        userId,
        action: "local_user_created",
        resourceType: "account",
        resourceId: userId,
        detail: "已创建新的本地用户身份。当前版本不会创建生产级密码或云端账号。",
        now,
      }),
      ...data.auditLogs,
    ].slice(0, 200),
  });

  return { data: nextData, userId };
}

export function createSandtraySessionArchive(input: {
  userId: string;
  workspaceId?: string;
  title: string;
  description: string;
  objects: SandboxObject[];
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  environment: SandboxEnvironment;
}): SandtraySessionArchive {
  const now = new Date().toISOString();
  return {
    sessionId: createId("sandtray_session"),
    userId: input.userId,
    workspaceId: input.workspaceId,
    title: input.title.trim() || `沙盘作品 ${new Date(now).toLocaleString("zh-CN")}`,
    description: input.description.trim(),
    mode: "free_creation",
    status: "archived",
    snapshot: {
      snapshotId: createId("snapshot"),
      capturedAt: now,
      environment: input.environment,
      canvas: {
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        coordinateSystem: "konva-stage",
        zoneSystem: "3x3-center-boundary",
      },
      objects: input.objects,
      events: input.events,
      analysis: input.analysis,
    },
    featureSummary: buildSandtrayFeatureSummary(input.objects, input.events, input.analysis),
    createdAt: now,
    updatedAt: now,
    archivedAt: now,
  };
}

export function extractMemoryCandidatesFromSandtraySession(
  data: PersonalDataBundle,
  session: SandtraySessionArchive,
): { data: PersonalDataBundle; createdCount: number } {
  const existingKeys = new Set(data.memoryCandidates.map((candidate) => buildMemoryCandidateKey(candidate)));
  const candidates = buildMemoryCandidatesForSession(session).filter(
    (candidate) => !existingKeys.has(buildMemoryCandidateKey(candidate)),
  );

  if (candidates.length === 0) {
    return { data, createdCount: 0 };
  }

  return {
    data: {
      ...data,
      memoryCandidates: [...candidates, ...data.memoryCandidates].slice(0, 2000),
    },
    createdCount: candidates.length,
  };
}

export function updatePersonalMemoryCandidate(
  data: PersonalDataBundle,
  memoryId: string,
  patch: Partial<
    Pick<
      PersonalMemoryCandidate,
      "status" | "includeInAgentContext" | "title" | "summary" | "tags" | "evidence" | "confidence"
    >
  >,
): PersonalDataBundle {
  const now = new Date().toISOString();
  return {
    ...data,
    memoryCandidates: data.memoryCandidates.map((candidate) => {
      if (candidate.memoryId !== memoryId) {
        return candidate;
      }

      const nextStatus = patch.status ?? candidate.status;
      return {
        ...candidate,
        ...patch,
        updatedAt: now,
        editedAt:
          patch.title !== undefined ||
          patch.summary !== undefined ||
          patch.tags !== undefined ||
          patch.evidence !== undefined
            ? now
            : candidate.editedAt,
        confirmedAt: nextStatus === "confirmed" ? now : candidate.confirmedAt,
        dismissedAt: nextStatus === "dismissed" ? now : nextStatus === "confirmed" ? undefined : candidate.dismissedAt,
        retiredAt: nextStatus === "retired" ? now : nextStatus === "confirmed" ? undefined : candidate.retiredAt,
      };
    }),
  };
}

export function mergePersonalMemoryCandidates(
  data: PersonalDataBundle,
  targetMemoryId: string,
  sourceMemoryIds: string[],
): PersonalDataBundle {
  const now = new Date().toISOString();
  const target = data.memoryCandidates.find((candidate) => candidate.memoryId === targetMemoryId);
  const sources = data.memoryCandidates.filter((candidate) => sourceMemoryIds.includes(candidate.memoryId));

  if (!target || sources.length === 0) {
    return data;
  }

  const mergedEvidence = uniqueText([...target.evidence, ...sources.flatMap((candidate) => candidate.evidence)]).slice(0, 10);
  const mergedTags = uniqueText([...target.tags, ...sources.flatMap((candidate) => candidate.tags)]).slice(0, 10);
  const mergedIds = uniqueText([
    ...(target.mergedFromMemoryIds ?? []),
    ...sources.map((candidate) => candidate.memoryId),
    ...sources.flatMap((candidate) => candidate.mergedFromMemoryIds ?? []),
  ]);
  const sourceSummaries = sources
    .map((candidate) => candidate.summary)
    .filter((summary) => summary && summary !== target.summary)
    .slice(0, 2);
  const mergedSummary =
    sourceSummaries.length > 0
      ? `${target.summary} 相关补充：${sourceSummaries.join("；")}`
      : target.summary;

  return {
    ...data,
    memoryCandidates: data.memoryCandidates.map((candidate) => {
      if (candidate.memoryId === targetMemoryId) {
        return {
          ...candidate,
          summary: mergedSummary,
          evidence: mergedEvidence,
          tags: mergedTags,
          confidence: Math.max(candidate.confidence, ...sources.map((source) => source.confidence)),
          mergedFromMemoryIds: mergedIds,
          updatedAt: now,
          editedAt: now,
        };
      }

      if (sourceMemoryIds.includes(candidate.memoryId)) {
        return {
          ...candidate,
          status: "retired",
          includeInAgentContext: false,
          retiredAt: now,
          updatedAt: now,
        };
      }

      return candidate;
    }),
  };
}

export function createMemoryBlockRuleFromCandidate(
  data: PersonalDataBundle,
  candidate: PersonalMemoryCandidate,
): PersonalDataBundle {
  const now = new Date().toISOString();
  const matchText = normalizeBlockText(candidate.tags[0] ?? candidate.title);
  const existingRule = data.memoryBlockRules.find(
    (rule) => rule.userId === candidate.userId && rule.matchText === matchText,
  );
  const nextRules = existingRule
    ? data.memoryBlockRules.map((rule) =>
        rule.ruleId === existingRule.ruleId
          ? {
              ...rule,
              active: true,
              updatedAt: now,
              disabledAt: undefined,
            }
          : rule,
      )
    : [
        {
          ruleId: createId("memory_rule"),
          userId: candidate.userId,
          label: `不再使用：${candidate.tags[0] ?? candidate.title}`,
          matchText,
          sourceMemoryId: candidate.memoryId,
          active: true,
          createdAt: now,
          updatedAt: now,
        },
        ...data.memoryBlockRules,
      ];

  return {
    ...data,
    memoryBlockRules: nextRules.slice(0, 500),
  };
}

export function updateMemoryBlockRule(
  data: PersonalDataBundle,
  ruleId: string,
  patch: Partial<Pick<PersonalMemoryBlockRule, "active" | "label" | "matchText">>,
): PersonalDataBundle {
  const now = new Date().toISOString();
  return {
    ...data,
    memoryBlockRules: data.memoryBlockRules.map((rule) =>
      rule.ruleId === ruleId
        ? {
            ...rule,
            ...patch,
            matchText: patch.matchText ? normalizeBlockText(patch.matchText) : rule.matchText,
            updatedAt: now,
            disabledAt: patch.active === false ? now : patch.active === true ? undefined : rule.disabledAt,
          }
        : rule,
    ),
  };
}

export function getConfirmedMemoryContext(data: PersonalDataBundle, userId: string): string[] {
  return buildPersonalContextPacket(data, userId).promptLines;
}

export function buildPersonalContextPacket(
  data: PersonalDataBundle,
  userId: string,
  maxItems = 8,
): PersonalContextPacket {
  const consents = getUserConsents(data, userId);
  const canUseForPersonalization = consents.some(
    (consent) => consent.consentType === "ai_personalization" && consent.granted,
  );
  const sourceSessions = new Map(data.sandtraySessions.map((session) => [session.sessionId, session]));
  const activeBlockRules = data.memoryBlockRules.filter((rule) => rule.userId === userId && rule.active);
  const eligibleCandidates = data.memoryCandidates
    .filter(
      (candidate) =>
        candidate.userId === userId &&
        candidate.status === "confirmed" &&
        candidate.includeInAgentContext,
    )
    .filter((candidate) => !activeBlockRules.some((rule) => memoryCandidateMatchesText(candidate, rule.matchText)));
  const blockedMemoryCount = data.memoryCandidates.filter(
    (candidate) =>
      candidate.userId === userId &&
      candidate.status === "confirmed" &&
      candidate.includeInAgentContext &&
      activeBlockRules.some((rule) => memoryCandidateMatchesText(candidate, rule.matchText)),
  ).length;
  const selectedCandidates = eligibleCandidates
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, maxItems);
  const items = selectedCandidates.map((candidate) => {
    const source = candidate.sourceSessionId ? sourceSessions.get(candidate.sourceSessionId) : undefined;
    return {
      memoryId: candidate.memoryId,
      title: candidate.title,
      summary: candidate.summary,
      reason: buildContextPacketReason(candidate, source),
      sourceSessionId: candidate.sourceSessionId,
      sourceSessionTitle: source?.title,
      sourceArchivedAt: source?.archivedAt,
      evidence: candidate.evidence,
      tags: candidate.tags,
      confidence: candidate.confidence,
      updatedAt: candidate.updatedAt,
    };
  });
  const blockedReasons = canUseForPersonalization
    ? []
    : ["AI 个性化上下文授权未开启，已确认记忆不会注入 Agent。"];

  return {
    userId,
    builtAt: new Date().toISOString(),
    enabled: canUseForPersonalization,
    blockedReasons,
    blockedMemoryCount,
    activeBlockRules: activeBlockRules.map((rule) => ({
      ruleId: rule.ruleId,
      label: rule.label,
      matchText: rule.matchText,
    })),
    maxItems,
    items: canUseForPersonalization ? items : [],
    promptLines: canUseForPersonalization
      ? items.map((item) => `${item.title}：${item.summary}（来源：${item.sourceSessionTitle ?? "未关联历史作品"}；原因：${item.reason}）`)
      : [],
  };
}

export function markSandtrayArchiveRestored(
  data: PersonalDataBundle,
  sessionId: string,
): PersonalDataBundle {
  const now = new Date().toISOString();
  return {
    ...data,
    sandtraySessions: data.sandtraySessions.map((session) =>
      session.sessionId === sessionId
        ? {
            ...session,
            status: "restored",
            restoredAt: now,
            updatedAt: now,
          }
        : session,
    ),
  };
}

export function getActiveAccount(data: PersonalDataBundle): PersonalAccount {
  return data.accounts.find((account) => account.userId === data.activeUserId) ?? data.accounts[0];
}

export function getActiveProfile(data: PersonalDataBundle): IdentityProfile {
  const account = getActiveAccount(data);
  return (
    data.profiles.find((profile) => profile.userId === account.userId) ??
    createIdentityProfile({
      userId: account.userId,
      displayName: account.displayName,
      ageGroup: "unknown",
      role: "demo",
      now: new Date().toISOString(),
    })
  );
}

export function getActivePreferences(data: PersonalDataBundle): CommunicationPreferences {
  const userId = getActiveAccount(data).userId;
  return data.preferences.find((preferences) => preferences.userId === userId) ?? createCommunicationPreferences(userId);
}

export function getUserConsents(data: PersonalDataBundle, userId: string): ConsentRecord[] {
  const existing = data.consents.filter((consent) => consent.userId === userId);
  const missing = CONSENT_DEFINITIONS.filter(
    (definition) => !existing.some((consent) => consent.consentType === definition.type),
  );
  return [
    ...existing,
    ...missing.map((definition) => createConsentRecord(userId, definition.type, new Date().toISOString())),
  ];
}

export function recordPersonalAudit(
  data: PersonalDataBundle,
  input: {
    userId?: string;
    action: string;
    resourceType: AuditResourceType;
    resourceId?: string;
    detail: string;
  },
): PersonalDataBundle {
  const now = new Date().toISOString();
  return {
    ...data,
    auditLogs: [
      createAuditLog({
        userId: input.userId ?? data.activeUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        detail: input.detail,
        now,
      }),
      ...data.auditLogs,
    ].slice(0, 240),
  };
}

export function switchActivePersonalUser(data: PersonalDataBundle, userId: string): PersonalDataBundle {
  const now = new Date().toISOString();
  return recordPersonalAudit(
    normalizePersonalData({
      ...data,
      activeUserId: userId,
      accounts: data.accounts.map((account) =>
        account.userId === userId ? { ...account, lastActiveAt: now } : account,
      ),
    }),
    {
      userId,
      action: "local_user_switched",
      resourceType: "account",
      resourceId: userId,
      detail: "已切换当前本地用户，沙盘与对话状态会进入该用户的本地命名空间。",
    },
  );
}

export function exportPersonalArchive(data: PersonalDataBundle): void {
  const exportedAt = new Date().toISOString();
  const fileName = `psych-sandbox-personal-archive-${exportedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ ...normalizePersonalData(data), exportedAt }, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function validatePersonalArchivePayload(payload: unknown): PersonalArchiveValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const migrationNotes: string[] = [];

  if (!payload || typeof payload !== "object") {
    return createArchiveValidationReport({
      valid: false,
      errors: ["文件内容不是可识别的 JSON 对象。"],
      warnings,
      migrationNotes,
    });
  }

  const record = payload as Partial<PersonalDataBundle> & Record<string, unknown>;
  const schema = typeof record.schema === "string" ? record.schema : undefined;
  const version = typeof record.version === "number" ? record.version : undefined;
  const exportedAt = typeof record.exportedAt === "string" ? record.exportedAt : undefined;

  if (schema !== PERSONAL_MEMORY_SCHEMA) {
    errors.push("档案 schema 不匹配，可能不是当前沙盘系统导出的个人数据包。");
  }

  if (version === undefined) {
    errors.push("档案缺少 version 字段，无法判断迁移策略。");
  } else if (version > PERSONAL_MEMORY_VERSION) {
    errors.push(`档案版本 ${version} 高于当前支持版本 ${PERSONAL_MEMORY_VERSION}，请先升级应用后再导入。`);
  } else if (version < PERSONAL_MEMORY_VERSION) {
    migrationNotes.push(`检测到旧版本档案 v${version}，导入时会按当前 v${PERSONAL_MEMORY_VERSION} 结构补齐缺失字段。`);
  }

  const requiredArrays: Array<keyof Pick<
    PersonalDataBundle,
    | "accounts"
    | "profiles"
    | "preferences"
    | "consents"
    | "workspaces"
    | "sandtraySessions"
    | "memoryCandidates"
    | "memoryBlockRules"
    | "auditLogs"
  >> = [
    "accounts",
    "profiles",
    "preferences",
    "consents",
    "workspaces",
    "sandtraySessions",
    "memoryCandidates",
    "memoryBlockRules",
    "auditLogs",
  ];

  requiredArrays.forEach((key) => {
    if (!Array.isArray(record[key])) {
      if (key === "sandtraySessions" || key === "memoryCandidates" || key === "memoryBlockRules") {
        warnings.push(`档案缺少 ${key}，导入时会按空列表处理。`);
      } else {
        errors.push(`档案缺少必要数组字段：${key}。`);
      }
    }
  });

  const accounts = Array.isArray(record.accounts) ? (record.accounts as PersonalAccount[]) : [];
  if (accounts.length === 0) {
    errors.push("档案中没有用户账号，不能作为个人数据包导入。");
  }

  const activeUserId = typeof record.activeUserId === "string" ? record.activeUserId : accounts[0]?.userId;
  if (activeUserId && accounts.length > 0 && !accounts.some((account) => account.userId === activeUserId)) {
    warnings.push("activeUserId 不在账号列表中，导入时会自动切换到档案中的第一个用户。");
  }

  addDuplicateWarnings(warnings, "用户", accounts.map((account) => account.userId));
  addDuplicateWarnings(
    warnings,
    "沙盘会话",
    Array.isArray(record.sandtraySessions)
      ? (record.sandtraySessions as SandtraySessionArchive[]).map((session) => session.sessionId)
      : [],
  );
  addDuplicateWarnings(
    warnings,
    "记忆候选",
    Array.isArray(record.memoryCandidates)
      ? (record.memoryCandidates as PersonalMemoryCandidate[]).map((candidate) => candidate.memoryId)
      : [],
  );

  if (errors.length > 0) {
    return createArchiveValidationReport({
      valid: false,
      schema,
      version,
      exportedAt,
      activeUserId,
      errors,
      warnings,
      migrationNotes,
      summary: summarizeArchiveLikePayload(record),
    });
  }

  const data = normalizePersonalData({
    schema: PERSONAL_MEMORY_SCHEMA,
    version: PERSONAL_MEMORY_VERSION,
    activeUserId: activeUserId ?? accounts[0].userId,
    accounts,
    profiles: Array.isArray(record.profiles) ? (record.profiles as IdentityProfile[]) : [],
    preferences: Array.isArray(record.preferences) ? (record.preferences as CommunicationPreferences[]) : [],
    consents: Array.isArray(record.consents) ? (record.consents as ConsentRecord[]) : [],
    workspaces: Array.isArray(record.workspaces) ? (record.workspaces as UserWorkspace[]) : [],
    sandtraySessions: Array.isArray(record.sandtraySessions)
      ? (record.sandtraySessions as SandtraySessionArchive[])
      : [],
    memoryCandidates: Array.isArray(record.memoryCandidates)
      ? (record.memoryCandidates as PersonalMemoryCandidate[])
      : [],
    memoryBlockRules: Array.isArray(record.memoryBlockRules)
      ? (record.memoryBlockRules as PersonalMemoryBlockRule[])
      : [],
    auditLogs: Array.isArray(record.auditLogs) ? (record.auditLogs as PersonalAuditLog[]) : [],
    exportedAt,
  });

  const normalizedSummary = summarizePersonalData(data);
  const rawSummary = summarizeArchiveLikePayload(record);
  if (rawSummary.profiles !== normalizedSummary.profiles) {
    migrationNotes.push("已为缺失基础资料的用户补齐默认 Identity Profile。");
  }
  if (rawSummary.workspaces !== normalizedSummary.workspaces) {
    migrationNotes.push("已为缺失工作区的用户补齐默认沙盘工作区。");
  }

  return createArchiveValidationReport({
    valid: true,
    schema,
    version,
    exportedAt,
    activeUserId: data.activeUserId,
    errors,
    warnings,
    migrationNotes,
    summary: normalizedSummary,
    data,
  });
}

export function importPersonalArchive(
  currentData: PersonalDataBundle,
  incomingData: PersonalDataBundle,
  mode: PersonalArchiveImportMode,
): PersonalArchiveImportResult {
  const importedAt = new Date().toISOString();
  const incoming = normalizePersonalData(incomingData);
  const nextData =
    mode === "replace"
      ? incoming
      : normalizePersonalData({
          ...currentData,
          activeUserId: currentData.accounts.some((account) => account.userId === currentData.activeUserId)
            ? currentData.activeUserId
            : incoming.activeUserId,
          accounts: mergeByKey(currentData.accounts, incoming.accounts, (account) => account.userId),
          profiles: mergeByKey(currentData.profiles, incoming.profiles, (profile) => profile.userId),
          preferences: mergeByKey(currentData.preferences, incoming.preferences, (preference) => preference.userId),
          consents: mergeByKey(
            currentData.consents,
            incoming.consents,
            (consent) => `${consent.userId}:${consent.consentType}`,
          ),
          workspaces: mergeByKey(currentData.workspaces, incoming.workspaces, (workspace) => workspace.workspaceId),
          sandtraySessions: mergeByKey(
            currentData.sandtraySessions,
            incoming.sandtraySessions,
            (session) => session.sessionId,
          ),
          memoryCandidates: mergeByKey(
            currentData.memoryCandidates,
            incoming.memoryCandidates,
            (candidate) => candidate.memoryId,
          ),
          memoryBlockRules: mergeByKey(
            currentData.memoryBlockRules,
            incoming.memoryBlockRules,
            (rule) => rule.ruleId,
          ),
          auditLogs: mergeByKey(currentData.auditLogs, incoming.auditLogs, (log) => log.id).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
          exportedAt: incoming.exportedAt,
        });

  const auditedData = recordPersonalAudit(nextData, {
    userId: mode === "replace" ? nextData.activeUserId : currentData.activeUserId,
    action: mode === "replace" ? "personal_archive_imported_replace" : "personal_archive_imported_merge",
    resourceType: "archive",
    detail:
      mode === "replace"
        ? `已用导入档案替换本地 Personal Memory OS：${incoming.accounts.length} 个用户，${incoming.sandtraySessions.length} 个历史作品。`
        : `已合并导入个人档案：${incoming.accounts.length} 个用户，${incoming.sandtraySessions.length} 个历史作品。`,
  });
  const report = validatePersonalArchivePayload(auditedData);
  return {
    mode,
    importedAt,
    data: auditedData,
    report: {
      ...report,
      migrationNotes: [
        `${mode === "replace" ? "替换" : "合并"}导入已完成，所有数据仍只保存在当前浏览器 localStorage。`,
        ...report.migrationNotes,
      ],
    },
  };
}

function createArchiveValidationReport(input: {
  valid: boolean;
  schema?: string;
  version?: number;
  exportedAt?: string;
  activeUserId?: string;
  errors: string[];
  warnings: string[];
  migrationNotes: string[];
  summary?: PersonalArchiveValidationSummary;
  data?: PersonalDataBundle;
}): PersonalArchiveValidationReport {
  return {
    valid: input.valid,
    schema: input.schema,
    version: input.version,
    exportedAt: input.exportedAt,
    activeUserId: input.activeUserId,
    errors: input.errors,
    warnings: input.warnings,
    migrationNotes: input.migrationNotes,
    summary: input.summary ?? createEmptyArchiveSummary(),
    data: input.data,
  };
}

function summarizePersonalData(data: PersonalDataBundle): PersonalArchiveValidationSummary {
  return {
    accounts: data.accounts.length,
    profiles: data.profiles.length,
    workspaces: data.workspaces.length,
    sandtraySessions: data.sandtraySessions.length,
    memoryCandidates: data.memoryCandidates.length,
    memoryBlockRules: data.memoryBlockRules.length,
    auditLogs: data.auditLogs.length,
  };
}

function summarizeArchiveLikePayload(payload: Record<string, unknown>): PersonalArchiveValidationSummary {
  return {
    accounts: Array.isArray(payload.accounts) ? payload.accounts.length : 0,
    profiles: Array.isArray(payload.profiles) ? payload.profiles.length : 0,
    workspaces: Array.isArray(payload.workspaces) ? payload.workspaces.length : 0,
    sandtraySessions: Array.isArray(payload.sandtraySessions) ? payload.sandtraySessions.length : 0,
    memoryCandidates: Array.isArray(payload.memoryCandidates) ? payload.memoryCandidates.length : 0,
    memoryBlockRules: Array.isArray(payload.memoryBlockRules) ? payload.memoryBlockRules.length : 0,
    auditLogs: Array.isArray(payload.auditLogs) ? payload.auditLogs.length : 0,
  };
}

function createEmptyArchiveSummary(): PersonalArchiveValidationSummary {
  return {
    accounts: 0,
    profiles: 0,
    workspaces: 0,
    sandtraySessions: 0,
    memoryCandidates: 0,
    memoryBlockRules: 0,
    auditLogs: 0,
  };
}

function addDuplicateWarnings(warnings: string[], label: string, ids: string[]): void {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  ids.filter(Boolean).forEach((id) => {
    if (seen.has(id)) {
      duplicateIds.add(id);
    }
    seen.add(id);
  });

  if (duplicateIds.size > 0) {
    warnings.push(`${label}存在 ${duplicateIds.size} 个重复 ID，导入时会以后出现的数据为准。`);
  }
}

function mergeByKey<T>(current: T[], incoming: T[], getKey: (item: T) => string): T[] {
  const merged = new Map<string, T>();
  current.forEach((item) => {
    const key = getKey(item);
    if (key) {
      merged.set(key, item);
    }
  });
  incoming.forEach((item) => {
    const key = getKey(item);
    if (key) {
      merged.set(key, item);
    }
  });
  return Array.from(merged.values());
}

function normalizePersonalData(data: PersonalDataBundle): PersonalDataBundle {
  if (data.accounts.length === 0) {
    return createDefaultPersonalData();
  }

  const fallback = data.accounts[0].userId;
  const activeUserId = data.accounts.some((account) => account.userId === data.activeUserId)
    ? data.activeUserId
    : fallback;
  const now = new Date().toISOString();
  const userIds = new Set(data.accounts.map((account) => account.userId));
  const profiles = [...data.profiles];
  const preferences = [...data.preferences];
  const consents = [...data.consents];
  const workspaces = [...data.workspaces];
  const sandtraySessions = Array.isArray(data.sandtraySessions) ? [...data.sandtraySessions] : [];
  const memoryCandidates = Array.isArray(data.memoryCandidates) ? [...data.memoryCandidates] : [];
  const memoryBlockRules = Array.isArray(data.memoryBlockRules) ? [...data.memoryBlockRules] : [];

  data.accounts.forEach((account) => {
    if (!profiles.some((profile) => profile.userId === account.userId)) {
      profiles.push(
        createIdentityProfile({
          userId: account.userId,
          displayName: account.displayName,
          ageGroup: "unknown",
          role: "demo",
          now,
        }),
      );
    }
    if (!preferences.some((preference) => preference.userId === account.userId)) {
      preferences.push(createCommunicationPreferences(account.userId, now));
    }
    CONSENT_DEFINITIONS.forEach((definition) => {
      if (!consents.some((consent) => consent.userId === account.userId && consent.consentType === definition.type)) {
        consents.push(createConsentRecord(account.userId, definition.type, now));
      }
    });
    if (!workspaces.some((workspace) => workspace.userId === account.userId)) {
      workspaces.push(createUserWorkspace(account.userId, `${account.displayName}的沙盘工作区`, now));
    }
  });

  return {
    schema: PERSONAL_MEMORY_SCHEMA,
    version: PERSONAL_MEMORY_VERSION,
    activeUserId,
    accounts: data.accounts,
    profiles: profiles.filter((profile) => userIds.has(profile.userId)),
    preferences: preferences.filter((preference) => userIds.has(preference.userId)),
    consents: consents.filter((consent) => userIds.has(consent.userId)),
    workspaces: workspaces.filter((workspace) => userIds.has(workspace.userId)),
    sandtraySessions: sandtraySessions.filter((session) => userIds.has(session.userId)).slice(0, 1000),
    memoryCandidates: memoryCandidates
      .filter((candidate) => userIds.has(candidate.userId))
      .slice(0, 2000),
    memoryBlockRules: memoryBlockRules.filter((rule) => userIds.has(rule.userId)).slice(0, 500),
    auditLogs: data.auditLogs.slice(0, 240),
    exportedAt: data.exportedAt,
  };
}

function buildMemoryCandidatesForSession(session: SandtraySessionArchive): PersonalMemoryCandidate[] {
  const now = new Date().toISOString();
  const base = {
    userId: session.userId,
    sourceSessionId: session.sessionId,
    sourceSnapshotId: session.snapshot.snapshotId,
    status: "candidate" as const,
    includeInAgentContext: false,
    createdAt: now,
    updatedAt: now,
  };
  const summary = session.featureSummary;
  const objectNames = session.snapshot.objects.map((object) => object.name);
  const topCategories = summary.dominantCategories.slice(0, 3);
  const topZones = summary.dominantZones.slice(0, 3);
  const riskText = Object.entries(summary.riskDistribution)
    .filter(([, count]) => count > 0)
    .map(([risk, count]) => `${risk}:${count}`)
    .join("、");
  const recentEvents = session.snapshot.events.slice(-4).map((event) => event.label);
  const environmentText = `${session.snapshot.environment.weather === "rainy" ? "雨天" : session.snapshot.environment.weather === "cloudy" ? "阴天" : "晴天"} · ${session.snapshot.environment.light === "night" ? "黑夜" : "白天"}`;
  const candidates: PersonalMemoryCandidate[] = [];

  candidates.push({
    ...base,
    memoryId: createId("memory"),
    kind: "session_summary",
    title: `作品回顾：${session.title}`,
    summary: `这次作品包含 ${summary.objectCount} 个沙具，主要对象有 ${objectNames.slice(0, 8).join("、") || "暂无"}；中心 ${summary.centerCount} 个，边界 ${summary.boundaryCount} 个。`,
    evidence: [
      `档案时间：${new Date(session.archivedAt).toLocaleString("zh-CN")}`,
      `环境：${environmentText}`,
      `风险分布：${riskText || "以常规标签为主"}`,
    ],
    tags: ["作品摘要", "沙盘档案"],
    confidence: 0.72,
  });

  if (topCategories.length > 0) {
    candidates.push({
      ...base,
      memoryId: createId("memory"),
      kind: "theme_pattern",
      title: "可能反复出现的沙具主题",
      summary: `本次作品中较突出的类别是 ${topCategories.join("、")}。这只是观察线索，需由用户确认是否具有个人意义。`,
      evidence: topCategories.map((category) => `${category}：${summary.categoryDistribution[category] ?? 0} 个`),
      tags: ["主题线索", ...topCategories],
      confidence: 0.62,
    });
  }

  if (topZones.length > 0) {
    candidates.push({
      ...base,
      memoryId: createId("memory"),
      kind: "spatial_pattern",
      title: "空间摆放线索",
      summary: `对象集中出现在 ${topZones.join("、")}，中心区域有 ${summary.centerCount} 个对象。此线索只用于后续提问，不代表固定解释。`,
      evidence: topZones,
      tags: ["空间分布", "九宫格"],
      confidence: 0.58,
    });
  }

  if (summary.firstPlacedAsset || summary.lastChangedObject || recentEvents.length > 0) {
    candidates.push({
      ...base,
      memoryId: createId("memory"),
      kind: "process_note",
      title: "创作过程线索",
      summary: `创作可从“最先放置：${summary.firstPlacedAsset ?? "未记录"}”和“最近变化：${summary.lastChangedObject ?? "未记录"}”继续回看。`,
      evidence: recentEvents.length > 0 ? recentEvents : ["暂无详细事件"],
      tags: ["过程回顾", "事件流"],
      confidence: 0.56,
    });
  }

  candidates.push({
    ...base,
    memoryId: createId("memory"),
    kind: "environment_note",
    title: "环境选择线索",
    summary: `该作品保存在 ${environmentText} 环境下。后续可询问用户这种天气和光照是否贴合当时感受。`,
    evidence: [`天气光照：${environmentText}`],
    tags: ["环境", session.snapshot.environment.weather, session.snapshot.environment.light],
    confidence: 0.48,
  });

  return candidates;
}

function buildMemoryCandidateKey(candidate: PersonalMemoryCandidate): string {
  return [candidate.userId, candidate.sourceSessionId ?? "", candidate.kind, candidate.title].join("::");
}

function normalizeBlockText(value: string): string {
  return value.trim().toLowerCase();
}

function memoryCandidateMatchesText(candidate: PersonalMemoryCandidate, matchText: string): boolean {
  if (!matchText) {
    return false;
  }
  return [candidate.title, candidate.summary, ...candidate.tags]
    .join(" ")
    .toLowerCase()
    .includes(matchText);
}

function uniqueText(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildContextPacketReason(
  candidate: PersonalMemoryCandidate,
  source?: SandtraySessionArchive,
): string {
  const sourceText = source
    ? `来自历史作品“${source.title}”`
    : "来自用户确认的本地记忆";
  const confidenceText = `${Math.round(candidate.confidence * 100)}% 置信度`;
  return `${sourceText}，状态已确认，已允许注入 Agent，上下文按最近更新时间优先；${confidenceText}。`;
}

function buildSandtrayFeatureSummary(
  objects: SandboxObject[],
  events: SandboxEvent[],
  analysis: SandboxAnalysis,
): SandtraySessionArchive["featureSummary"] {
  const zoneDistribution = Object.fromEntries(analysis.grid.map((cell) => [cell.label, cell.count]));
  const dominantCategories = Object.entries(analysis.categoryCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 4)
    .map(([category]) => category);
  const dominantZones = analysis.grid
    .filter((cell) => cell.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((cell) => `${cell.label}${cell.count}`);
  const addEvents = events.filter((event) => event.type === "add");
  const changedEvent = [...events].reverse().find((event) => event.objectId);
  const firstPlacedAssetId = addEvents[0]?.assetId;
  const firstPlacedAsset = firstPlacedAssetId
    ? objects.find((object) => object.assetId === firstPlacedAssetId)?.name
    : undefined;
  const lastChangedObject = changedEvent?.objectId
    ? objects.find((object) => object.id === changedEvent.objectId)?.name
    : undefined;

  return {
    objectCount: objects.length,
    eventCount: events.length,
    categoryDistribution: analysis.categoryCounts,
    riskDistribution: analysis.riskCounts,
    zoneDistribution,
    centerCount: analysis.centerObjects.length,
    boundaryCount: analysis.boundaryObjects.length,
    firstPlacedAsset,
    lastChangedObject,
    dominantCategories,
    dominantZones,
  };
}

function createPersonalAccount({
  userId,
  displayName,
  localHandle,
  now = new Date().toISOString(),
}: {
  userId: string;
  displayName: string;
  localHandle: string;
  now?: string;
}): PersonalAccount {
  return {
    userId,
    localHandle,
    displayName,
    authMode: "local_demo",
    status: "active",
    createdAt: now,
    lastActiveAt: now,
  };
}

function createIdentityProfile({
  userId,
  displayName,
  ageGroup,
  role,
  now = new Date().toISOString(),
}: {
  userId: string;
  displayName: string;
  ageGroup: PersonalAgeGroup;
  role: PersonalRole;
  now?: string;
}): IdentityProfile {
  return {
    userId,
    displayName,
    ageGroup,
    role,
    timezone: "Asia/Shanghai",
    preferredLanguage: "zh-CN",
    createdAt: now,
    updatedAt: now,
  };
}

function createCommunicationPreferences(userId: string, now = new Date().toISOString()): CommunicationPreferences {
  return {
    userId,
    preferredTone: "gentle",
    replyLength: "balanced",
    prefersVisualExplanation: true,
    sensitiveTopics: [],
    doNotRememberTopics: [],
    updatedAt: now,
  };
}

function createUserWorkspace(userId: string, title: string, now = new Date().toISOString()): UserWorkspace {
  return {
    workspaceId: createId("workspace"),
    userId,
    title,
    description: "个人沙盘作品、AI 对话和记忆候选的本地工作区。",
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

function createDefaultConsents(userId: string, now = new Date().toISOString()): ConsentRecord[] {
  return CONSENT_DEFINITIONS.map((definition) => createConsentRecord(userId, definition.type, now));
}

function createConsentRecord(
  userId: string,
  consentType: ConsentRecord["consentType"],
  now = new Date().toISOString(),
): ConsentRecord {
  const definition = CONSENT_DEFINITIONS.find((item) => item.type === consentType) ?? CONSENT_DEFINITIONS[0];
  return {
    consentId: createId("consent"),
    userId,
    consentType,
    granted: definition.defaultGranted,
    scope: definition.scope,
    reason: definition.description,
    createdAt: now,
    updatedAt: now,
  };
}

function createAuditLog({
  userId,
  action,
  resourceType,
  resourceId,
  detail,
  now = new Date().toISOString(),
}: {
  userId: string;
  action: string;
  resourceType: AuditResourceType;
  resourceId?: string;
  detail: string;
  now?: string;
}): PersonalAuditLog {
  return {
    id: createId("audit"),
    userId,
    action,
    resourceType,
    resourceId,
    detail,
    createdAt: now,
  };
}

function isPersonalDataBundle(value: unknown): value is PersonalDataBundle {
  if (!value || typeof value !== "object") {
    return false;
  }
  const data = value as Partial<PersonalDataBundle>;
  return (
    data.schema === PERSONAL_MEMORY_SCHEMA &&
    data.version === PERSONAL_MEMORY_VERSION &&
    typeof data.activeUserId === "string" &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.profiles) &&
    Array.isArray(data.preferences) &&
    Array.isArray(data.consents) &&
    Array.isArray(data.workspaces) &&
    Array.isArray(data.auditLogs)
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
