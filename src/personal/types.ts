import type {
  RiskTag,
  SandboxAnalysis,
  SandboxEnvironment,
  SandboxEvent,
  SandboxObject,
} from "../types";

export const PERSONAL_MEMORY_SCHEMA = "psych-sandbox-personal-memory-os";
export const PERSONAL_MEMORY_VERSION = 1;
export const DEFAULT_PERSONAL_USER_ID = "local_user_default";

export type PersonalAuthMode = "local_demo" | "external_provider";
export type PersonalAccountStatus = "active" | "archived";
export type PersonalAgeGroup = "child" | "teen" | "adult" | "elder" | "unknown";
export type PersonalRole = "client" | "student" | "parent" | "clinician" | "researcher" | "demo";
export type CommunicationTone = "gentle" | "structured" | "direct" | "playful";
export type ReplyLengthPreference = "short" | "balanced" | "deep";
export type ConsentType =
  | "service_usage"
  | "sandtray_archive"
  | "conversation_archive"
  | "long_term_memory"
  | "ai_personalization"
  | "export_archive";
export type AuditResourceType =
  | "account"
  | "profile"
  | "consent"
  | "workspace"
  | "scene"
  | "sandtray_session"
  | "memory_candidate"
  | "conversation"
  | "archive";
export type SandtrayArchiveMode = "free_creation" | "guided_theme" | "assessment" | "review";
export type SandtrayArchiveStatus = "draft" | "archived" | "restored";
export type MemoryCandidateKind =
  | "session_summary"
  | "theme_pattern"
  | "symbol_preference"
  | "spatial_pattern"
  | "process_note"
  | "environment_note";
export type MemoryCandidateStatus = "candidate" | "confirmed" | "dismissed" | "retired";

export interface PersonalAccount {
  userId: string;
  localHandle: string;
  displayName: string;
  authMode: PersonalAuthMode;
  status: PersonalAccountStatus;
  createdAt: string;
  lastActiveAt: string;
}

export interface IdentityProfile {
  userId: string;
  displayName: string;
  ageGroup: PersonalAgeGroup;
  role: PersonalRole;
  timezone: string;
  preferredLanguage: "zh-CN" | "en-US";
  guardianName?: string;
  clinicianName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationPreferences {
  userId: string;
  preferredTone: CommunicationTone;
  replyLength: ReplyLengthPreference;
  prefersVisualExplanation: boolean;
  sensitiveTopics: string[];
  doNotRememberTopics: string[];
  updatedAt: string;
}

export interface ConsentScope {
  canStoreRawConversation: boolean;
  canStoreSandtraySnapshot: boolean;
  canStoreExtractedMemory: boolean;
  canUseForPersonalization: boolean;
  canUseInReports: boolean;
  canExportArchive: boolean;
}

export interface ConsentRecord {
  consentId: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  scope: ConsentScope;
  reason: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface UserWorkspace {
  workspaceId: string;
  userId: string;
  title: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalAuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: AuditResourceType;
  resourceId?: string;
  detail: string;
  createdAt: string;
}

export interface SandtrayFeatureSummary {
  objectCount: number;
  eventCount: number;
  categoryDistribution: Record<string, number>;
  riskDistribution: Record<RiskTag, number>;
  zoneDistribution: Record<string, number>;
  centerCount: number;
  boundaryCount: number;
  firstPlacedAsset?: string;
  lastChangedObject?: string;
  dominantCategories: string[];
  dominantZones: string[];
}

export interface SandtrayArchivedSnapshot {
  snapshotId: string;
  capturedAt: string;
  environment: SandboxEnvironment;
  canvas: {
    width: number;
    height: number;
    coordinateSystem: "konva-stage";
    zoneSystem: "3x3-center-boundary";
  };
  objects: SandboxObject[];
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
}

export interface SandtraySessionArchive {
  sessionId: string;
  userId: string;
  workspaceId?: string;
  title: string;
  description: string;
  mode: SandtrayArchiveMode;
  status: SandtrayArchiveStatus;
  snapshot: SandtrayArchivedSnapshot;
  featureSummary: SandtrayFeatureSummary;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
  restoredAt?: string;
}

export interface PersonalMemoryCandidate {
  memoryId: string;
  userId: string;
  sourceSessionId?: string;
  sourceSnapshotId?: string;
  kind: MemoryCandidateKind;
  status: MemoryCandidateStatus;
  title: string;
  summary: string;
  evidence: string[];
  tags: string[];
  confidence: number;
  includeInAgentContext: boolean;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  dismissedAt?: string;
  retiredAt?: string;
}

export interface PersonalDataBundle {
  schema: typeof PERSONAL_MEMORY_SCHEMA;
  version: typeof PERSONAL_MEMORY_VERSION;
  activeUserId: string;
  accounts: PersonalAccount[];
  profiles: IdentityProfile[];
  preferences: CommunicationPreferences[];
  consents: ConsentRecord[];
  workspaces: UserWorkspace[];
  sandtraySessions: SandtraySessionArchive[];
  memoryCandidates: PersonalMemoryCandidate[];
  auditLogs: PersonalAuditLog[];
  exportedAt?: string;
}

export interface CreatePersonalUserInput {
  displayName: string;
  ageGroup: PersonalAgeGroup;
  role: PersonalRole;
}

export interface ConsentDefinition {
  type: ConsentType;
  title: string;
  description: string;
  defaultGranted: boolean;
  scope: ConsentScope;
}

export const CONSENT_DEFINITIONS: ConsentDefinition[] = [
  {
    type: "service_usage",
    title: "使用本地沙盘服务",
    description: "允许系统在当前浏览器中保存必要的本地工作状态，例如当前用户、布局和操作审计。",
    defaultGranted: true,
    scope: {
      canStoreRawConversation: false,
      canStoreSandtraySnapshot: true,
      canStoreExtractedMemory: false,
      canUseForPersonalization: false,
      canUseInReports: false,
      canExportArchive: true,
    },
  },
  {
    type: "sandtray_archive",
    title: "保存沙盘作品与事件流",
    description: "允许把沙盘对象、环境、九宫格分析和操作事件保存到该用户的本地工作区。",
    defaultGranted: true,
    scope: {
      canStoreRawConversation: false,
      canStoreSandtraySnapshot: true,
      canStoreExtractedMemory: true,
      canUseForPersonalization: true,
      canUseInReports: true,
      canExportArchive: true,
    },
  },
  {
    type: "conversation_archive",
    title: "保存 AI 对话记录",
    description: "允许保存与沙盘伙伴或 Agent 的对话，用于之后回顾和生成会话摘要。",
    defaultGranted: true,
    scope: {
      canStoreRawConversation: true,
      canStoreSandtraySnapshot: false,
      canStoreExtractedMemory: true,
      canUseForPersonalization: true,
      canUseInReports: true,
      canExportArchive: true,
    },
  },
  {
    type: "long_term_memory",
    title: "长期记忆候选",
    description: "允许系统把用户确认过的偏好、目标或沙盘表达习惯保存为长期记忆。第一版只建立授权边界，不自动写入。",
    defaultGranted: false,
    scope: {
      canStoreRawConversation: false,
      canStoreSandtraySnapshot: false,
      canStoreExtractedMemory: true,
      canUseForPersonalization: true,
      canUseInReports: false,
      canExportArchive: true,
    },
  },
  {
    type: "ai_personalization",
    title: "AI 个性化上下文",
    description: "允许 Agent 在回答前读取被授权的个人资料、偏好和沙盘摘要。不会绕过具体 LLM 配置。",
    defaultGranted: false,
    scope: {
      canStoreRawConversation: false,
      canStoreSandtraySnapshot: false,
      canStoreExtractedMemory: false,
      canUseForPersonalization: true,
      canUseInReports: false,
      canExportArchive: false,
    },
  },
  {
    type: "export_archive",
    title: "导出个人档案",
    description: "允许用户把当前本地个人资料、授权、审计摘要和工作区索引导出为 JSON，方便迁移和备份。",
    defaultGranted: true,
    scope: {
      canStoreRawConversation: false,
      canStoreSandtraySnapshot: false,
      canStoreExtractedMemory: false,
      canUseForPersonalization: false,
      canUseInReports: false,
      canExportArchive: true,
    },
  },
];
