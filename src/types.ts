export type RiskTag = "normal" | "conflict" | "death" | "fantasy";
export type SandboxWeather = "sunny" | "cloudy" | "rainy";
export type SandboxLightMode = "day" | "night";

export interface SandboxEnvironment {
  weather: SandboxWeather;
  light: SandboxLightMode;
}

export type FootprintKind = "compact" | "wide" | "tall" | "flat";

export interface ToyAssetAnchor {
  x: number;
  y: number;
}

export interface ToyAssetFootprint {
  kind: FootprintKind;
  width: number;
  depth: number;
  height: number;
}

export type ToyModelRecipe =
  | { kind: "person"; cloth: string; skin: string; bodyScale: number; elder?: boolean }
  | { kind: "dog" }
  | { kind: "bird" }
  | { kind: "fish" }
  | { kind: "lion" }
  | { kind: "house" }
  | { kind: "bridge" }
  | { kind: "fence" }
  | { kind: "tower" }
  | { kind: "tree" }
  | { kind: "water" }
  | { kind: "rock" }
  | { kind: "sun" }
  | { kind: "monster" }
  | { kind: "robot" }
  | { kind: "skull" }
  | { kind: "light" }
  | { kind: "fallback" };

export interface ToyRenderProfile {
  viewHeight: number;
  targetWidth: number;
  targetHeight: number;
  yaw: number;
  shadowOpacity: number;
}

export interface ToyAssetSpec {
  assetId: string;
  anchor: ToyAssetAnchor;
  footprint: ToyAssetFootprint;
  thumbnailScale: number;
  semanticTags: string[];
  modelRecipe: ToyModelRecipe;
  render: ToyRenderProfile;
}

export type SandboxEventType =
  | "add"
  | "move"
  | "transform"
  | "delete"
  | "property_change"
  | "export"
  | "clear"
  | "select"
  | "seed";

export interface SandboxAsset {
  assetId: string;
  name: string;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
  symbolicCandidates: string[];
  riskTag: RiskTag;
  anchor: ToyAssetAnchor;
  footprint: ToyAssetFootprint;
  thumbnailScale: number;
  semanticTags: string[];
  modelRecipe: ToyModelRecipe;
}

export interface ManagedAsset extends SandboxAsset {
  isBuiltIn: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SandboxObject {
  id: string;
  assetId: string;
  name: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  createdAt: number;
  riskTag: RiskTag;
  symbolicCandidates: string[];
  anchor: ToyAssetAnchor;
  footprint: ToyAssetFootprint;
  thumbnailScale: number;
  semanticTags: string[];
  modelRecipe: ToyModelRecipe;
}

export interface SandboxEvent {
  id: string;
  type: SandboxEventType;
  timestamp: string;
  objectId?: string;
  assetId?: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface SandboxEventDraft {
  type: SandboxEventType;
  objectId?: string;
  assetId?: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface GridCellCount {
  id: string;
  label: string;
  count: number;
  objectIds: string[];
}

export interface SandboxAnalysis {
  totalObjects: number;
  riskCounts: Record<RiskTag, number>;
  categoryCounts: Record<string, number>;
  grid: GridCellCount[];
  centerObjects: string[];
  boundaryObjects: string[];
  depthOrder: string[];
}

export interface SandboxSnapshot {
  version: string;
  exportedAt: string;
  environment: SandboxEnvironment;
  canvas: {
    width: number;
    height: number;
    guides: string[];
  };
  objects: SandboxObject[];
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
}

export type LlmProviderKind =
  | "openai"
  | "openai-compatible"
  | "anthropic"
  | "deepseek"
  | "qwen"
  | "minimax"
  | "gemini"
  | "openrouter"
  | "moonshot"
  | "zhipu"
  | "siliconflow"
  | "groq"
  | "mistral"
  | "together"
  | "xai";

export interface LlmProviderConfig {
  id: string;
  name: string;
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AgentAvatarStyle = "sage" | "warm" | "analyst" | "dream" | "mentor";

export interface PsychAgentProfile {
  id: string;
  name: string;
  school: string;
  description: string;
  avatarStyle: AgentAvatarStyle;
  openingMessage: string;
  systemPrompt: string;
  providerId?: string;
  temperature: number;
  enabled: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
}

export interface AgentConversation {
  id: string;
  agentId: string;
  title: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}
