import type { LlmProviderConfig } from "../types";
import { ensureBaseUrl, getAdapterKind, getProviderLabel } from "./providerPresets";

export type LlmChatRole = "system" | "user" | "assistant";

export interface LlmChatMessage {
  role: LlmChatRole;
  content: string;
}

export interface LlmStreamRequest {
  providers: LlmProviderConfig[];
  preferredProviderId?: string;
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onStatus?: (status: string) => void;
}

export interface LlmStreamResult {
  provider: LlmProviderConfig;
  emittedTokens: number;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    text?: string;
  }>;
}

interface AnthropicStreamChunk {
  delta?: {
    type?: string;
    text?: string;
  };
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export async function streamLlmText({
  providers,
  preferredProviderId,
  messages,
  temperature = 0.72,
  maxTokens = 1200,
  signal,
  onToken,
  onStatus,
}: LlmStreamRequest): Promise<LlmStreamResult> {
  const candidates = resolveProviderCandidates(providers, preferredProviderId);
  const errors: string[] = [];

  if (candidates.length === 0) {
    throw new Error("没有可用的 LLM 配置：请启用一个 provider 并填写 API Key。");
  }

  for (const provider of candidates) {
    try {
      onStatus?.(`正在连接 ${provider.name || getProviderLabel(provider.provider)}...`);
      const emittedTokens = await streamProviderText({
        provider,
        messages,
        temperature,
        maxTokens,
        signal,
        onToken,
      });
      onStatus?.(`已通过 ${provider.name || getProviderLabel(provider.provider)} 完成回复`);
      return { provider, emittedTokens };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name || provider.provider}: ${message}`);
      if (signal?.aborted) {
        throw new Error("用户已停止当前流式回复。");
      }
    }
  }

  throw new Error(`所有 LLM provider 调用失败：${errors.join("；")}`);
}

function resolveProviderCandidates(
  providers: LlmProviderConfig[],
  preferredProviderId?: string,
): LlmProviderConfig[] {
  const available = providers.filter((provider) => provider.enabled && provider.apiKey.trim());
  const preferred = available.find((provider) => provider.id === preferredProviderId);
  return preferred
    ? [preferred, ...available.filter((provider) => provider.id !== preferred.id)]
    : available;
}

async function streamProviderText({
  provider,
  messages,
  temperature,
  maxTokens,
  signal,
  onToken,
}: {
  provider: LlmProviderConfig;
  messages: LlmChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onToken: (token: string) => void;
}): Promise<number> {
  const adapter = getAdapterKind(provider);
  if (adapter === "anthropic") {
    return streamAnthropicText({ provider, messages, temperature, maxTokens, signal, onToken });
  }
  if (adapter === "gemini") {
    return streamGeminiText({ provider, messages, temperature, maxTokens, signal, onToken });
  }
  return streamOpenAiCompatibleText({ provider, messages, temperature, maxTokens, signal, onToken });
}

async function streamOpenAiCompatibleText({
  provider,
  messages,
  temperature,
  maxTokens,
  signal,
  onToken,
}: {
  provider: LlmProviderConfig;
  messages: LlmChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onToken: (token: string) => void;
}): Promise<number> {
  const response = await fetch(`${ensureBaseUrl(provider)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model.trim(),
      messages: normalizeChatMessages(messages),
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
  });
  await assertOk(response, provider);

  let emitted = 0;
  for await (const event of readSseData(response)) {
    if (event === "[DONE]") {
      break;
    }
    const parsed = parseJsonObject<OpenAiStreamChunk>(event);
    const token = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.text ?? "";
    if (typeof token === "string" && token) {
      emitted += 1;
      onToken(token);
    }
  }
  return emitted;
}

async function streamAnthropicText({
  provider,
  messages,
  temperature,
  maxTokens,
  signal,
  onToken,
}: {
  provider: LlmProviderConfig;
  messages: LlmChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onToken: (token: string) => void;
}): Promise<number> {
  const { system, conversation } = toAnthropicMessages(messages);
  const response = await fetch(`${ensureBaseUrl(provider)}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: provider.model.trim(),
      max_tokens: maxTokens,
      temperature,
      stream: true,
      system,
      messages: conversation,
    }),
    signal,
  });
  await assertOk(response, provider);

  let emitted = 0;
  for await (const event of readSseData(response)) {
    const parsed = parseJsonObject<AnthropicStreamChunk>(event);
    const delta = parsed?.delta;
    const token =
      delta?.type === "text_delta"
        ? delta.text
        : typeof delta?.text === "string"
          ? delta.text
          : "";
    if (token) {
      emitted += 1;
      onToken(token);
    }
  }
  return emitted;
}

async function streamGeminiText({
  provider,
  messages,
  temperature,
  maxTokens,
  signal,
  onToken,
}: {
  provider: LlmProviderConfig;
  messages: LlmChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onToken: (token: string) => void;
}): Promise<number> {
  const { system, contents } = toGeminiContents(messages);
  const url = `${ensureBaseUrl(provider)}/models/${encodeURIComponent(provider.model.trim())}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey.trim())}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
    signal,
  });
  await assertOk(response, provider);

  let emitted = 0;
  for await (const event of readSseData(response)) {
    const parsed = parseJsonObject<GeminiStreamChunk>(event);
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
      continue;
    }
    for (const part of parts) {
      if (typeof part?.text === "string" && part.text) {
        emitted += 1;
        onToken(part.text);
      }
    }
  }
  return emitted;
}

async function assertOk(response: Response, provider: LlmProviderConfig): Promise<void> {
  if (response.ok) {
    return;
  }
  const text = await response.text().catch(() => "");
  const detail = text ? `：${text.slice(0, 320)}` : "";
  throw new Error(`${provider.name || provider.provider} 返回 HTTP ${response.status}${detail}`);
}

async function* readSseData(response: Response): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error("浏览器没有收到可读取的流式响应。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      for (const data of extractSseData(event)) {
        yield data;
      }
    }
  }

  buffer += decoder.decode();
  for (const data of extractSseData(buffer)) {
    yield data;
  }
}

function extractSseData(event: string): string[] {
  return event
    .split(/\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
}

function parseJsonObject<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeChatMessages(messages: LlmChatMessage[]): LlmChatMessage[] {
  return messages
    .map((message) => ({ ...message, content: message.content.trim() }))
    .filter((message) => message.content.length > 0);
}

function toAnthropicMessages(messages: LlmChatMessage[]): {
  system: string;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system" || !message.content.trim()) {
      continue;
    }
    if (conversation.length === 0 && message.role === "assistant") {
      continue;
    }
    const role = message.role === "assistant" ? "assistant" : "user";
    const previous = conversation[conversation.length - 1];
    if (previous?.role === role) {
      previous.content = `${previous.content}\n\n${message.content.trim()}`;
    } else {
      conversation.push({ role, content: message.content.trim() });
    }
  }

  if (conversation.length === 0) {
    conversation.push({ role: "user", content: "请开始对话。" });
  }
  return { system, conversation };
}

function toGeminiContents(messages: LlmChatMessage[]): {
  system: string;
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const message of messages) {
    if (message.role === "system" || !message.content.trim()) {
      continue;
    }
    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];
    if (contents.length === 0 && role === "model") {
      continue;
    }
    if (previous?.role === role) {
      previous.parts.push({ text: message.content.trim() });
    } else {
      contents.push({ role, parts: [{ text: message.content.trim() }] });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "请开始对话。" }] });
  }
  return { system, contents };
}
