import { createDefaultManagedAssets } from "../data/assets";
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

interface StoredScene {
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

export function loadManagedAssets(): ManagedAsset[] {
  const parsed = readJson<ManagedAsset[]>(MANAGED_ASSETS_KEY);
  return Array.isArray(parsed) ? parsed : createDefaultManagedAssets();
}

export function saveManagedAssets(assets: ManagedAsset[]): void {
  writeJson(MANAGED_ASSETS_KEY, assets);
}

export function resetManagedAssets(): ManagedAsset[] {
  const assets = createDefaultManagedAssets();
  saveManagedAssets(assets);
  return assets;
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
