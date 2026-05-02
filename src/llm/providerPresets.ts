import type { LlmProviderConfig, LlmProviderKind } from "../types";

export type LlmAdapterKind = "openai-compatible" | "anthropic" | "gemini";

export interface ProviderPreset {
  label: string;
  adapter: LlmAdapterKind;
  baseUrl: string;
  model: string;
  modelHints: string[];
}

export const PROVIDER_PRESETS: Record<LlmProviderKind, ProviderPreset> = {
  openai: {
    label: "OpenAI",
    adapter: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.4-mini",
    modelHints: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  },
  "openai-compatible": {
    label: "OpenAI Compatible",
    adapter: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.4-mini",
    modelHints: ["gpt-5.4-mini", "gpt-4.1-mini", "local-model"],
  },
  anthropic: {
    label: "Anthropic Claude",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    modelHints: ["claude-sonnet-4-5", "claude-opus-4-7", "claude-haiku-4-5"],
  },
  deepseek: {
    label: "DeepSeek",
    adapter: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    modelHints: ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-pro"],
  },
  qwen: {
    label: "通义千问",
    adapter: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    modelHints: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-max"],
  },
  minimax: {
    label: "MiniMax",
    adapter: "openai-compatible",
    baseUrl: "https://api.minimax.chat/v1",
    model: "MiniMax-M1",
    modelHints: ["MiniMax-M1", "abab6.5s-chat", "abab6.5g-chat"],
  },
  gemini: {
    label: "Google Gemini",
    adapter: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    modelHints: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  openrouter: {
    label: "OpenRouter",
    adapter: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.4-mini",
    modelHints: ["openai/gpt-5.4-mini", "anthropic/claude-sonnet-4.5", "deepseek/deepseek-chat"],
  },
  moonshot: {
    label: "Moonshot Kimi",
    adapter: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2-0905-preview",
    modelHints: ["kimi-k2-0905-preview", "moonshot-v1-8k", "moonshot-v1-32k"],
  },
  zhipu: {
    label: "智谱 GLM",
    adapter: "openai-compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.6",
    modelHints: ["glm-4.6", "glm-4.5", "glm-4-flash"],
  },
  siliconflow: {
    label: "SiliconFlow",
    adapter: "openai-compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3",
    modelHints: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen3-235B-A22B", "moonshotai/Kimi-K2-Instruct"],
  },
  groq: {
    label: "Groq",
    adapter: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    modelHints: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "deepseek-r1-distill-llama-70b"],
  },
  mistral: {
    label: "Mistral AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    modelHints: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  },
  together: {
    label: "Together AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    modelHints: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
  },
  xai: {
    label: "xAI",
    adapter: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4",
    modelHints: ["grok-4", "grok-3", "grok-3-mini"],
  },
};

export function getProviderPreset(kind: LlmProviderKind): ProviderPreset {
  return PROVIDER_PRESETS[kind];
}

export function getProviderLabel(kind: LlmProviderKind): string {
  return PROVIDER_PRESETS[kind]?.label ?? kind;
}

export function getAdapterKind(provider: LlmProviderConfig): LlmAdapterKind {
  return getProviderPreset(provider.provider).adapter;
}

export function ensureBaseUrl(provider: LlmProviderConfig): string {
  return provider.baseUrl.trim().replace(/\/+$/, "") || getProviderPreset(provider.provider).baseUrl;
}
