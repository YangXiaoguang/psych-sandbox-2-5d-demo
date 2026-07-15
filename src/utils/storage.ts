import { createDefaultManagedAssets, SANDBOX_ASSETS } from "../data/assets";
import { getToyAssetSpec } from "../data/toyAssetSpecs";
import { createDefaultLlmProviders, createDefaultPsychAgents } from "../data/defaultAgents";
import type {
  AgentConversation,
  LlmProviderConfig,
  ManagedAsset,
  PsychAgentProfile,
  SandboxEnvironment,
  SandboxEvent,
  SandboxLayoutPreferences,
  SandboxObject,
} from "../types";
import { DEFAULT_ENVIRONMENT, LIGHT_OPTIONS, WEATHER_OPTIONS } from "../data/environment";
import { DEFAULT_PERSONAL_USER_ID } from "../personal/types";

const STORAGE_KEY = "psych-sandbox-2-5d-demo.scene.v6";
const MANAGED_ASSETS_KEY = "psych-sandbox-2-5d-demo.managed-assets.v1";
const LLM_PROVIDERS_KEY = "psych-sandbox-2-5d-demo.llm-providers.v1";
const PSYCH_AGENTS_KEY = "psych-sandbox-2-5d-demo.psych-agents.v1";
const AGENT_CONVERSATIONS_KEY = "psych-sandbox-2-5d-demo.agent-conversations.v1";
const SANDBOX_ENVIRONMENT_KEY = "psych-sandbox-2-5d-demo.environment.v1";
const SANDBOX_LAYOUT_KEY = "psych-sandbox-2-5d-demo.layout.v1";

const DEFAULT_LAYOUT_PREFERENCES: SandboxLayoutPreferences = {
  rightPanelCollapsed: false,
  focusMode: false,
  assetDrawerOpen: false,
  aiDrawerOpen: false,
};

export interface StoredScene {
  objects: SandboxObject[];
  events: SandboxEvent[];
}

export function loadScene(): StoredScene | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredScene;
    if (!Array.isArray(parsed.objects) || !Array.isArray(parsed.events)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveScene(scene: StoredScene): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
}

export function loadSceneForUser(userId: string): StoredScene | null {
  return readJson<StoredScene>(userScopedKey(STORAGE_KEY, userId)) ?? (userId === DEFAULT_PERSONAL_USER_ID ? loadScene() : null);
}

export function saveSceneForUser(userId: string, scene: StoredScene): void {
  writeJson(userScopedKey(STORAGE_KEY, userId), scene);
  if (userId === DEFAULT_PERSONAL_USER_ID) {
    saveScene(scene);
  }
}

export function loadSandboxEnvironment(): SandboxEnvironment {
  const parsed = readJson<SandboxEnvironment>(SANDBOX_ENVIRONMENT_KEY);
  if (
    parsed &&
    WEATHER_OPTIONS.includes(parsed.weather) &&
    LIGHT_OPTIONS.includes(parsed.light)
  ) {
    return parsed;
  }
  return DEFAULT_ENVIRONMENT;
}

export function saveSandboxEnvironment(environment: SandboxEnvironment): void {
  writeJson(SANDBOX_ENVIRONMENT_KEY, environment);
}

export function loadSandboxEnvironmentForUser(userId: string): SandboxEnvironment {
  const parsed = readJson<SandboxEnvironment>(userScopedKey(SANDBOX_ENVIRONMENT_KEY, userId));
  if (
    parsed &&
    WEATHER_OPTIONS.includes(parsed.weather) &&
    LIGHT_OPTIONS.includes(parsed.light)
  ) {
    return parsed;
  }
  return userId === DEFAULT_PERSONAL_USER_ID ? loadSandboxEnvironment() : DEFAULT_ENVIRONMENT;
}

export function saveSandboxEnvironmentForUser(userId: string, environment: SandboxEnvironment): void {
  writeJson(userScopedKey(SANDBOX_ENVIRONMENT_KEY, userId), environment);
  if (userId === DEFAULT_PERSONAL_USER_ID) {
    saveSandboxEnvironment(environment);
  }
}

export function loadSandboxLayoutPreferences(): SandboxLayoutPreferences {
  const parsed = readJson<Partial<SandboxLayoutPreferences>>(SANDBOX_LAYOUT_KEY);
  return {
    ...DEFAULT_LAYOUT_PREFERENCES,
    ...(parsed ?? {}),
    rightPanelCollapsed: Boolean(parsed?.rightPanelCollapsed),
    focusMode: Boolean(parsed?.focusMode),
    assetDrawerOpen: Boolean(parsed?.assetDrawerOpen),
    aiDrawerOpen: Boolean(parsed?.aiDrawerOpen),
  };
}

export function saveSandboxLayoutPreferences(preferences: SandboxLayoutPreferences): void {
  writeJson(SANDBOX_LAYOUT_KEY, preferences);
}

export function loadSandboxLayoutPreferencesForUser(userId: string): SandboxLayoutPreferences {
  const parsed = readJson<Partial<SandboxLayoutPreferences>>(userScopedKey(SANDBOX_LAYOUT_KEY, userId));
  if (!parsed && userId === DEFAULT_PERSONAL_USER_ID) {
    return loadSandboxLayoutPreferences();
  }
  return {
    ...DEFAULT_LAYOUT_PREFERENCES,
    ...(parsed ?? {}),
    rightPanelCollapsed: Boolean(parsed?.rightPanelCollapsed),
    focusMode: Boolean(parsed?.focusMode),
    assetDrawerOpen: Boolean(parsed?.assetDrawerOpen),
    aiDrawerOpen: Boolean(parsed?.aiDrawerOpen),
  };
}

export function saveSandboxLayoutPreferencesForUser(userId: string, preferences: SandboxLayoutPreferences): void {
  writeJson(userScopedKey(SANDBOX_LAYOUT_KEY, userId), preferences);
  if (userId === DEFAULT_PERSONAL_USER_ID) {
    saveSandboxLayoutPreferences(preferences);
  }
}

export function loadManagedAssets(): ManagedAsset[] {
  const parsed = readJson<ManagedAsset[]>(MANAGED_ASSETS_KEY);
  return Array.isArray(parsed) ? reconcileManagedAssets(parsed) : createDefaultManagedAssets();
}

export function saveManagedAssets(assets: ManagedAsset[]): void {
  writeJson(MANAGED_ASSETS_KEY, assets);
}

export function resetManagedAssets(): ManagedAsset[] {
  const assets = createDefaultManagedAssets();
  saveManagedAssets(assets);
  return assets;
}

function reconcileManagedAssets(assets: ManagedAsset[]): ManagedAsset[] {
  const now = new Date().toISOString();
  const defaultsById = new Map(SANDBOX_ASSETS.map((asset) => [asset.assetId, asset]));
  const reconciled = assets.map((asset) => {
    const builtIn = defaultsById.get(asset.assetId);

    if (builtIn) {
      return {
        ...asset,
        isBuiltIn: true,
        enabled: typeof asset.enabled === "boolean" ? asset.enabled : true,
        createdAt: asset.createdAt || now,
        updatedAt: asset.updatedAt || now,
        anchor: builtIn.anchor,
        footprint: builtIn.footprint,
        thumbnailScale: builtIn.thumbnailScale,
        semanticTags: builtIn.semanticTags,
        modelRecipe: builtIn.modelRecipe,
      };
    }

    const spec = getToyAssetSpec(asset.assetId, asset.riskTag);
    return {
      ...asset,
      isBuiltIn: Boolean(asset.isBuiltIn),
      enabled: typeof asset.enabled === "boolean" ? asset.enabled : true,
      createdAt: asset.createdAt || now,
      updatedAt: asset.updatedAt || now,
      anchor: asset.anchor ?? spec.anchor,
      footprint: asset.footprint ?? spec.footprint,
      thumbnailScale: asset.thumbnailScale ?? spec.thumbnailScale,
      semanticTags: Array.isArray(asset.semanticTags) && asset.semanticTags.length > 0 ? asset.semanticTags : spec.semanticTags,
      modelRecipe: asset.modelRecipe ?? spec.modelRecipe,
    };
  });

  const existingIds = new Set(reconciled.map((asset) => asset.assetId));
  createDefaultManagedAssets(now).forEach((asset) => {
    if (!existingIds.has(asset.assetId)) {
      reconciled.push(asset);
    }
  });

  return reconciled;
}

export function loadLlmProviders(): LlmProviderConfig[] {
  const parsed = readJson<LlmProviderConfig[]>(LLM_PROVIDERS_KEY);
  return Array.isArray(parsed) ? parsed : createDefaultLlmProviders();
}

export function saveLlmProviders(providers: LlmProviderConfig[]): void {
  writeJson(LLM_PROVIDERS_KEY, providers);
}

export function loadPsychAgents(): PsychAgentProfile[] {
  const parsed = readJson<PsychAgentProfile[]>(PSYCH_AGENTS_KEY);
  return Array.isArray(parsed) ? parsed : createDefaultPsychAgents();
}

export function savePsychAgents(agents: PsychAgentProfile[]): void {
  writeJson(PSYCH_AGENTS_KEY, agents);
}

export function loadAgentConversations(): AgentConversation[] {
  const parsed = readJson<AgentConversation[]>(AGENT_CONVERSATIONS_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveAgentConversations(conversations: AgentConversation[]): void {
  writeJson(AGENT_CONVERSATIONS_KEY, conversations);
}

export function loadAgentConversationsForUser(userId: string): AgentConversation[] {
  const parsed = readJson<AgentConversation[]>(userScopedKey(AGENT_CONVERSATIONS_KEY, userId));
  if (Array.isArray(parsed)) {
    return parsed;
  }
  return userId === DEFAULT_PERSONAL_USER_ID ? loadAgentConversations() : [];
}

export function saveAgentConversationsForUser(userId: string, conversations: AgentConversation[]): void {
  writeJson(userScopedKey(AGENT_CONVERSATIONS_KEY, userId), conversations);
  if (userId === DEFAULT_PERSONAL_USER_ID) {
    saveAgentConversations(conversations);
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function userScopedKey(baseKey: string, userId: string): string {
  return `${baseKey}.user.${encodeURIComponent(userId)}`;
}
