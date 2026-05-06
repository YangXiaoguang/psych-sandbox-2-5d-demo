import type { AdminGovernanceData } from "../admin/types";
import type { PersonalDataBundle } from "../personal/types";
import type {
  AgentConversation,
  SandboxEnvironment,
  SandboxLayoutPreferences,
  SandboxObject,
  SandboxEvent,
} from "../types";

export type RepositoryMode = "localStorage" | "api-ready";
export type RepositoryHealthTone = "ok" | "warn" | "risk";
export type RepositoryDomainKey =
  | "identity"
  | "workspace"
  | "access"
  | "sandtray"
  | "memory"
  | "conversation"
  | "asset"
  | "llm";

export interface StoredSceneState {
  objects: SandboxObject[];
  events: SandboxEvent[];
}

export interface UserDirectoryQuery {
  query: string;
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RepositoryDomainDefinition {
  key: RepositoryDomainKey;
  label: string;
  currentStore: string;
  futureApi: string;
  readModel: string;
  writeModel: string;
  migrationRisk: RepositoryHealthTone;
}

export interface RepositoryHealthMetric {
  label: string;
  value: string;
  tone: RepositoryHealthTone;
  detail: string;
}

export interface WorkspaceDirectoryRow {
  workspaceId: string;
  title: string;
  ownerUserId: string;
  ownerName: string;
  active: boolean;
  sessionCount: number;
  accessScopeSummary: string;
  updatedAt: string;
}

export interface SystemArchitectureReport {
  adapterName: string;
  mode: RepositoryMode;
  generatedAt: string;
  metrics: RepositoryHealthMetric[];
  domains: RepositoryDomainDefinition[];
  workspaces: WorkspaceDirectoryRow[];
  migrationSteps: string[];
}

export interface PersonalMemoryRepositoryPort {
  load(): PersonalDataBundle;
  save(data: PersonalDataBundle): void;
}

export interface AdminGovernanceRepositoryPort {
  load(personalData: PersonalDataBundle): AdminGovernanceData;
  save(data: AdminGovernanceData): void;
  normalize(data: AdminGovernanceData, personalData: PersonalDataBundle): AdminGovernanceData;
}

export interface SandboxWorkspaceRepositoryPort {
  loadScene(userId: string): StoredSceneState | null;
  saveScene(userId: string, scene: StoredSceneState): void;
  loadEnvironment(userId: string): SandboxEnvironment;
  saveEnvironment(userId: string, environment: SandboxEnvironment): void;
  loadLayout(userId: string): SandboxLayoutPreferences;
  saveLayout(userId: string, preferences: SandboxLayoutPreferences): void;
  loadAgentConversations(userId: string): AgentConversation[];
  saveAgentConversations(userId: string, conversations: AgentConversation[]): void;
}

export interface SystemRepositoryAdapter {
  adapterName: string;
  mode: RepositoryMode;
  personal: PersonalMemoryRepositoryPort;
  admin: AdminGovernanceRepositoryPort;
  workspace: SandboxWorkspaceRepositoryPort;
  buildReport(personalData: PersonalDataBundle, adminGovernance: AdminGovernanceData): SystemArchitectureReport;
}
