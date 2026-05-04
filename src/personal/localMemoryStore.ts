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
  type PersonalAgeGroup,
  type PersonalAuditLog,
  type PersonalDataBundle,
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
  patch: Partial<Pick<PersonalMemoryCandidate, "status" | "includeInAgentContext">>,
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
        confirmedAt: nextStatus === "confirmed" ? now : candidate.confirmedAt,
        dismissedAt: nextStatus === "dismissed" ? now : nextStatus === "confirmed" ? undefined : candidate.dismissedAt,
        retiredAt: nextStatus === "retired" ? now : nextStatus === "confirmed" ? undefined : candidate.retiredAt,
      };
    }),
  };
}

export function getConfirmedMemoryContext(data: PersonalDataBundle, userId: string): string[] {
  return data.memoryCandidates
    .filter(
      (candidate) =>
        candidate.userId === userId &&
        candidate.status === "confirmed" &&
        candidate.includeInAgentContext,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
    .map((candidate) => `${candidate.title}：${candidate.summary}`);
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
