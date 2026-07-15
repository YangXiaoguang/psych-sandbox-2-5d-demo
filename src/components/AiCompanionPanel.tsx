import { HeartHandshake, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LlmProviderConfig, SandboxAnalysis, SandboxEvent, SandboxObject } from "../types";
import type { LlmChatMessage } from "../llm/streamText";
import { streamLlmText } from "../llm/streamText";
import { MarkdownText } from "./MarkdownText";

interface AiCompanionPanelProps {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  llmProviders: LlmProviderConfig[];
  personalMemoryContext: string[];
  variant?: "default" | "focus";
}

interface CompanionMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

type CompanionMode = "idle" | "listening" | "thinking" | "speaking";

interface CompanionContext {
  chips: string[];
  activeCells: string[];
  recentEvents: SandboxEvent[];
  objectNames: string[];
  selectedName: string | null;
  centerObjectNames: string[];
  memoryNotes: string[];
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "talk-about-work",
    label: "聊聊这个作品",
    prompt: "我想聊聊这个沙盘作品，可以先温和地陪我看看吗？",
  },
  {
    id: "process-review",
    label: "回顾创作过程",
    prompt: "请帮我回顾刚才的创作过程，尽量中性、温柔一些。",
  },
  {
    id: "selected-object",
    label: "聊选中沙具",
    prompt: "这个选中的沙具让我有点在意，想从它开始聊聊。",
  },
  {
    id: "just-listen",
    label: "先陪我聊",
    prompt: "先不要分析，只陪我聊聊。我可能还没有想清楚。",
  },
  {
    id: "summary-draft",
    label: "整理一段文字",
    prompt: "请把当前作品整理成一段中性的观察文字，方便我之后继续修改。",
  },
];

export function AiCompanionPanel({
  objects,
  selectedObject,
  events,
  analysis,
  llmProviders,
  personalMemoryContext,
  variant = "default",
}: AiCompanionPanelProps): JSX.Element {
  const [messages, setMessages] = useState<CompanionMessage[]>(() => [
    {
      id: "assistant-welcome",
      role: "assistant",
      text:
        "我会安静地陪你看这个沙盘。你可以随便说说感受，也可以让我帮你从作品、沙具或创作顺序里整理线索。这里不会做诊断，只一起把体验说清楚。",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<CompanionMode>("idle");
  const [streamStatus, setStreamStatus] = useState("真实 LLM 未开始");
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatLogRef = useRef<HTMLElement | null>(null);

  const contextSummary = useMemo(
    () => buildContextSummary(objects, selectedObject, events, analysis, personalMemoryContext),
    [analysis, events, objects, personalMemoryContext, selectedObject],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const node = chatLogRef.current;
    if (!node) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      node.scrollTo({
        top: node.scrollHeight,
        behavior: mode === "speaking" ? "auto" : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, mode]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    abortRef.current?.abort();

    const assistantId = `assistant-${Date.now()}`;
    const history = messages;
    setDraft("");
    setMode("thinking");
    setStreamStatus("准备连接真实 LLM...");
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
      },
      {
        id: assistantId,
        role: "assistant",
        text: "",
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let remoteText = "";
      const result = await streamLlmText({
        providers: llmProviders,
        messages: buildCompanionMessages(trimmed, history, contextSummary),
        temperature: 0.72,
        maxTokens: 900,
        signal: controller.signal,
        onStatus: setStreamStatus,
        onToken: (token) => {
          remoteText += token;
          replaceAssistantMessage(assistantId, remoteText);
        },
      });
      if (result.emittedTokens === 0) {
        throw new Error("provider 返回了空的流式内容。");
      }
      setMode("speaking");
      timerRef.current = window.setTimeout(() => setMode("idle"), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStreamStatus(`真实 LLM 不可用，已回退本地模拟：${message}`);
      streamLocalCompanionReply(assistantId, createCompanionReply(trimmed, contextSummary));
    }
  };

  const replaceAssistantMessage = (messageId: string, text: string) => {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, text } : message)),
    );
  };

  const streamLocalCompanionReply = (messageId: string, text: string) => {
    let cursor = 0;
    setMode("speaking");
    timerRef.current = window.setInterval(() => {
      cursor += 3;
      replaceAssistantMessage(messageId, text.slice(0, cursor));
      if (cursor >= text.length) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => setMode("idle"), 500);
      }
    }, 32);
  };

  return (
    <div className={`ai-panel ${variant === "focus" ? "focus" : ""}`} aria-label="AI 伙伴面板">
      <section className="ai-hero">
        <CompanionPortrait mode={mode} />
        <div>
          <p className="eyebrow">AI Companion</p>
          <h2>沙盘伙伴</h2>
          <p>温柔陪伴、过程回顾、作品整理</p>
        </div>
      </section>

      <section className="ai-context-card" aria-label="当前沙盘上下文">
        <div className="section-title-row">
          <h2>当前上下文</h2>
          <span>{objects.length} 个沙具</span>
        </div>
        <div className="ai-context-grid">
          <ContextMetric label="选中" value={selectedObject?.name ?? "无"} />
          <ContextMetric label="中心" value={`${analysis.centerObjects.length}`} />
          <ContextMetric label="事件" value={`${events.length}`} />
        </div>
        <div className="ai-context-chips">
          {contextSummary.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </section>

      <section className="ai-quick-section" aria-label="快捷问题">
        <h2>可以这样开始</h2>
        <div className="ai-quick-list">
          {QUICK_PROMPTS.map((item) => (
            <button key={item.id} type="button" onClick={() => sendMessage(item.prompt)}>
              <Sparkles size={14} />
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section ref={chatLogRef} className="ai-chat-log" aria-label="对话内容" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={`ai-message ${message.role}`}>
            <span>{message.role === "assistant" ? "AI" : "你"}</span>
            <MarkdownText content={message.text || "正在组织语言..."} />
          </article>
        ))}
        {mode === "thinking" ? (
          <article className="ai-message assistant thinking">
            <span>AI</span>
            <p>我在轻轻整理你刚才的表达和沙盘里的线索...</p>
          </article>
        ) : null}
      </section>

      <p className="ai-stream-status">{streamStatus}</p>

      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(draft);
        }}
      >
        <label htmlFor="ai-companion-input">想和沙盘伙伴说些什么？</label>
        <div>
          <textarea
            id="ai-companion-input"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setMode(event.target.value ? "listening" : "idle");
            }}
            placeholder="可以说感受，也可以问：我想从这个沙具开始聊聊..."
            rows={3}
          />
          <button type="submit" aria-label="发送给 AI 伙伴">
            <Send size={16} />
          </button>
        </div>
      </form>

      <p className="ai-safety-note">
        <HeartHandshake size={14} />
        AI 伙伴只帮助整理和表达，不能替代专业心理咨询或医疗建议。
      </p>
    </div>
  );
}

function CompanionPortrait({ mode }: { mode: CompanionMode }): JSX.Element {
  return (
    <div className={`ai-companion-portrait ${mode}`} aria-hidden="true">
      <span className="ai-portrait-glow" />
      <span className="ai-portrait-head">
        <span className="ai-portrait-ear left" />
        <span className="ai-portrait-ear right" />
        <span className="ai-portrait-eye left" />
        <span className="ai-portrait-eye right" />
        <span className="ai-portrait-smile" />
      </span>
    </div>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="ai-context-metric">
      <strong>{value}</strong>
      <em>{label}</em>
    </span>
  );
}

function buildContextSummary(
  objects: SandboxObject[],
  selectedObject: SandboxObject | null,
  events: SandboxEvent[],
  analysis: SandboxAnalysis,
  personalMemoryContext: string[],
): CompanionContext {
  const activeCells = analysis.grid
    .filter((cell) => cell.count > 0)
    .map((cell) => `${cell.label}${cell.count}`);
  const objectNames = objects.map((object) => object.name);
  const centerObjectIds = new Set(analysis.centerObjects);
  const centerObjectNames = objects.filter((object) => centerObjectIds.has(object.id)).map((object) => object.name);
  const chips = [
    selectedObject ? `正在引用: ${selectedObject.name}` : "未选中沙具",
    objects.length > 0 ? `对象: ${objectNames.slice(0, 4).join("、")}` : "空沙盘",
    activeCells.length > 0 ? `区域: ${activeCells.slice(0, 3).join(" / ")}` : "区域未形成集中",
    personalMemoryContext.length > 0 ? `确认记忆: ${personalMemoryContext.length}` : "暂无确认记忆",
    events.length > 0 ? `最近事件: ${events[events.length - 1]?.label ?? "无"}` : "暂无事件",
  ];

  return {
    chips,
    activeCells,
    recentEvents: events.slice(-5),
    objectNames,
    selectedName: selectedObject?.name ?? null,
    centerObjectNames,
    memoryNotes: personalMemoryContext,
  };
}

function buildCompanionMessages(
  prompt: string,
  history: CompanionMessage[],
  context: CompanionContext,
): LlmChatMessage[] {
  const system = [
    "你是数字心理沙盘 Demo 中的 AI 沙盘伙伴。你要温暖、简洁、非评判地陪用户整理体验。",
    "你不能做诊断，不能替代专业心理咨询或医疗建议。不要给出固定象征解释，要用开放式问题帮助用户表达。引用已确认记忆时必须说明它只是用户确认过的参考线索。",
    `当前沙盘上下文：${contextToText(context)}`,
  ].join("\n\n");
  const historyMessages: LlmChatMessage[] = history
    .filter((message) => message.text.trim())
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));

  return [
    { role: "system", content: system },
    ...historyMessages,
    { role: "user", content: prompt },
  ];
}

function contextToText(context: CompanionContext): string {
  const regionText = context.activeCells.length > 0 ? context.activeCells.join("、") : "暂无明显区域集中";
  const objectText =
    context.objectNames.length > 0 ? context.objectNames.slice(0, 10).join("、") : "当前没有沙具";
  const centerText =
    context.centerObjectNames.length > 0 ? context.centerObjectNames.join("、") : "中心区域暂时没有明显对象";
  const recentText =
    context.recentEvents.length > 0 ? context.recentEvents.map((event) => event.label).join("；") : "暂无事件";
  const memoryText =
    context.memoryNotes.length > 0
      ? `已确认个人记忆：${context.memoryNotes.join("；")}。`
      : "已确认个人记忆：暂无。";
  return `对象：${objectText}。区域：${regionText}。中心：${centerText}。最近事件：${recentText}。${memoryText}`;
}

function createCompanionReply(prompt: string, context: CompanionContext): string {
  const normalized = prompt.toLowerCase();
  const regionText = context.activeCells.length > 0 ? context.activeCells.join("、") : "目前还没有明显集中的区域";
  const recentText =
    context.recentEvents.length > 0
      ? context.recentEvents.map((event) => event.label).join("；")
      : "现在还没有太多创作事件";
  const objectText =
    context.objectNames.length > 0 ? context.objectNames.slice(0, 8).join("、") : "现在沙盘里还没有放入沙具";
  const centerText =
    context.centerObjectNames.length > 0 ? context.centerObjectNames.join("、") : "中心区域暂时没有明显对象";
  const memoryText =
    context.memoryNotes.length > 0
      ? `你确认过的一些线索包括：${context.memoryNotes.slice(0, 2).join("；")}。我会把它当作参考，不当作结论。`
      : "";

  if (normalized.includes("不要分析") || normalized.includes("陪我聊")) {
    return "好，我们先不急着解释。你可以只说一个很小的感觉，比如这个沙盘让你更靠近、想躲开，还是只是有点说不清。我会跟着你的节奏来。";
  }

  if (normalized.includes("过程") || normalized.includes("回顾")) {
    return `我先帮你轻轻回看过程：最近的创作轨迹里有这些动作：${recentText}。如果你愿意，我们可以从“最想改动的一步”或“最有感觉的一步”开始聊。`;
  }

  if (normalized.includes("中心") || normalized.includes("区域") || normalized.includes("位置")) {
    return `我看到当前区域线索是：${regionText}；中心附近主要有：${centerText}。我们可以先不解释它们，只观察这些位置带来的感觉：中心像是稳定、被看见，还是有一点压力？`;
  }

  if (normalized.includes("对象") || normalized.includes("列表") || normalized.includes("有什么")) {
    return `现在作品里可以看到：${objectText}。如果要温柔地开始，我会建议先挑一个“最吸引你”或“最不想碰”的沙具，而不是一次解释全部。`;
  }

  if (normalized.includes("整理") || normalized.includes("文字") || normalized.includes("总结")) {
    return `我整理一版中性草稿：当前作品里包含${objectText}，沙具分布主要出现在${regionText}，中心附近有${centerText}。${memoryText}这些位置和对象可以作为继续讨论的线索，但不代表固定含义。你可以在这个基础上补充：哪些沙具让你感觉亲近，哪些让你感觉有距离。`;
  }

  if (normalized.includes("选中") || normalized.includes("沙具")) {
    return context.selectedName
      ? `正在引用：${context.selectedName}。我们可以先不判断它象征什么，只看看它在这里像是在靠近谁、保护谁，或和谁保持距离。你放下它的时候，身体里比较明显的感觉是什么？`
      : "现在还没有选中具体沙具。你可以点一下画布里的某个沙具，我会把它作为当前话题；也可以直接告诉我你最在意哪一个。";
  }

  return `我在这里。${memoryText}当前作品的一个温和线索是：${regionText}。我们可以先从你的感受开始，而不是从解释开始。看着这个沙盘时，你最先注意到的是哪个位置或哪个沙具？`;
}
