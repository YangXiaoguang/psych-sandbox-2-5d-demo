import { HeartHandshake, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCurrentSandboxSnapshotPayload } from "../api/currentSandboxSnapshotApi";
import { buildCurrentSandboxInsight } from "../analysis/currentSandboxInsight";
import type { CurrentSandboxInsight } from "../analysis/currentSandboxInsight";
import type { LlmProviderConfig, SandboxEnvironment, SandboxObject } from "../types";
import type { LlmChatMessage } from "../llm/streamText";
import { streamLlmText } from "../llm/streamText";
import type { CurrentSandboxSnapshot } from "../analysis/currentSandboxSnapshot";
import {
  createSandboxSnapshotChatMessages,
  SANDBOX_DIALOGUE_SAFETY_NOTICE,
} from "../llm/sandboxPromptContext";
import { MarkdownText } from "./MarkdownText";

interface AiCompanionPanelProps {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  environment: SandboxEnvironment;
  llmProviders: LlmProviderConfig[];
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
  snapshot: CurrentSandboxSnapshot;
  insight: CurrentSandboxInsight;
  selectedName: string | null;
  objectNames: string[];
  centerObjectNames: string[];
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "talk-about-work",
    label: "看这个作品",
    prompt: "我想聊聊这个沙盘作品，可以先温和地陪我看看吗？",
  },
  {
    id: "process-review",
    label: "看结构",
    prompt: "请只基于当前沙盘状态，温和地帮我看看作品结构。",
  },
  {
    id: "selected-object",
    label: "聊选中",
    prompt: "这个选中的沙具让我有点在意，想从它开始聊聊。",
  },
  {
    id: "just-listen",
    label: "陪我聊",
    prompt: "先不要分析，只陪我聊聊。我可能还没有想清楚。",
  },
  {
    id: "summary-draft",
    label: "整理文字",
    prompt: "请把当前作品整理成一段中性的观察文字，方便我之后继续修改。",
  },
];

export function AiCompanionPanel({
  objects,
  selectedObject,
  environment,
  llmProviders,
  variant = "default",
}: AiCompanionPanelProps): JSX.Element {
  const [messages, setMessages] = useState<CompanionMessage[]>(() => [
    {
      id: "assistant-welcome",
      role: "assistant",
      text:
        "我在这里陪你看这个沙盘。可以说感受，也可以让我整理当前画面；这里不会做诊断。",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<CompanionMode>("idle");
  const [streamStatus, setStreamStatus] = useState("真实 LLM 未开始");
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatLogRef = useRef<HTMLElement | null>(null);

  const contextSummary = useMemo(
    () =>
      buildContextSummary({
        objects,
        selectedObject,
        environment,
        generatedAt: new Date().toISOString(),
      }),
    [environment, objects, selectedObject],
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
          <p>陪你看画面、整理表达</p>
        </div>
      </section>

      <section className="ai-context-card" aria-label="当前沙盘上下文">
        <div className="section-title-row">
          <h2>沙盘信号</h2>
          <span>{objects.length} 个沙具</span>
        </div>
        <div className="ai-context-grid">
          <ContextMetric label="选中" value={selectedObject?.name ?? "无"} />
          <ContextMetric label="中心" value={`${contextSummary.snapshot.analysis.centerCount}`} />
          <ContextMetric label="区域" value={`${contextSummary.activeCells.length}`} />
        </div>
        <div className="ai-context-chips">
          {contextSummary.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </section>

      <section className="ai-quick-section" aria-label="快捷问题">
        <h2>轻轻开始</h2>
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

function buildContextSummary({
  objects,
  selectedObject,
  environment,
  generatedAt,
}: {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  environment: SandboxEnvironment;
  generatedAt: string;
}): CompanionContext {
  const { snapshot } = createCurrentSandboxSnapshotPayload({
    objects,
    environment,
    selectedObjectId: selectedObject?.id ?? null,
    generatedAt,
  });
  const activeCells = snapshot.analysis.zoneCounts
    .filter((cell) => cell.count > 0)
    .map((cell) => `${cell.label}${cell.count}`);
  const insight = buildCurrentSandboxInsight(snapshot);
  const objectNames = snapshot.objects.map((object) => object.name);
  const centerObjectNames = snapshot.objects
    .filter((object) => object.position.inCenter)
    .map((object) => object.name);
  const themeText =
    insight.themeCandidates
      .slice(0, 3)
      .map((theme) => theme.theme)
      .join("、") || "主题待浮现";
  const observationText = insight.observations.find((observation) => observation.kind !== "environment")?.title ?? "等待更多摆放线索";
  const chips = [
    selectedObject ? `正在引用: ${selectedObject.name}` : "未选中沙具",
    objects.length > 0 ? `观察: ${observationText}` : "空沙盘",
    `主题候选: ${themeText}`,
    activeCells.length > 0 ? `区域: ${activeCells.slice(0, 3).join(" / ")}` : "区域未形成集中",
    `环境: ${snapshot.environment.weatherLabel} · ${snapshot.environment.lightLabel}`,
  ];

  return {
    chips,
    activeCells,
    snapshot,
    insight,
    objectNames,
    selectedName: selectedObject?.name ?? null,
    centerObjectNames,
  };
}

function buildCompanionMessages(
  prompt: string,
  history: CompanionMessage[],
  context: CompanionContext,
): LlmChatMessage[] {
  const historyMessages: LlmChatMessage[] = history
    .filter((message) => message.text.trim())
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));

  return createSandboxSnapshotChatMessages({
    systemInstructions: [
      "你是数字心理沙盘 Demo 中的 AI 沙盘伙伴。你要温暖、简洁、非评判地陪用户整理体验。",
      SANDBOX_DIALOGUE_SAFETY_NOTICE,
    ],
    snapshot: context.snapshot,
    insight: context.insight,
    history: historyMessages,
    historyLimit: 8,
    summaryText: context.insight.brief,
    extraRules: [
      "优先基于 CurrentSandboxInsight.brief 和 suggestedQuestions 进行回应；避免默认复述完整沙具列表，除非用户明确要求。",
    ],
    userInput: prompt,
  });
}

function contextToText(context: CompanionContext): string {
  return context.insight.brief;
}

function createCompanionReply(prompt: string, context: CompanionContext): string {
  const normalized = prompt.toLowerCase();
  const regionText = context.activeCells.length > 0 ? context.activeCells.join("、") : "目前还没有明显集中的区域";
  const objectText =
    context.objectNames.length > 0 ? context.objectNames.slice(0, 8).join("、") : "现在沙盘里还没有放入沙具";
  const centerText =
    context.centerObjectNames.length > 0 ? context.centerObjectNames.join("、") : "中心区域暂时没有明显对象";
  const environmentText = `${context.snapshot.environment.weatherLabel} · ${context.snapshot.environment.lightLabel}`;
  const insightBrief = context.insight.brief;
  const leadingQuestion =
    context.insight.suggestedQuestions[0]?.text ?? "看着这个沙盘时，你最先注意到的是哪个位置或哪个沙具？";
  const themeText =
    context.insight.themeCandidates
      .slice(0, 3)
      .map((theme) => theme.theme)
      .join("、") || "还没有明显主题候选";

  if (normalized.includes("不要分析") || normalized.includes("陪我聊")) {
    return "好，我们先不急着解释。你可以只说一个很小的感觉，比如这个沙盘让你更靠近、想躲开，还是只是有点说不清。我会跟着你的节奏来。";
  }

  if (normalized.includes("过程") || normalized.includes("回顾")) {
    return `第一版里我先只看当前沙盘状态，不展开事件流。现在能看到的观察材料是：${contextToText(context)} 如果你愿意，我们可以从此刻最有感觉的位置开始，而不是先回溯过程。`;
  }

  if (normalized.includes("中心") || normalized.includes("区域") || normalized.includes("位置")) {
    return `我看到当前区域线索是：${regionText}；中心附近主要有：${centerText}。${insightBrief} 我们可以先不解释它们，只观察这些位置带来的感觉：中心像是稳定、被看见，还是有一点压力？`;
  }

  if (normalized.includes("对象") || normalized.includes("列表") || normalized.includes("有什么")) {
    return `现在作品里可以看到：${objectText}。如果要温柔地开始，我会建议先挑一个“最吸引你”或“最不想碰”的沙具，而不是一次解释全部。`;
  }

  if (normalized.includes("整理") || normalized.includes("文字") || normalized.includes("总结")) {
    return `我整理一版中性草稿：当前作品处于${environmentText}环境。${insightBrief} 可暂时作为主题候选的词有：${themeText}。这些词只是继续讨论的线索，不代表固定含义。你可以在这个基础上补充：哪些沙具让你感觉亲近，哪些让你感觉有距离。`;
  }

  if (normalized.includes("选中") || normalized.includes("沙具")) {
    return context.selectedName
      ? `正在引用：${context.selectedName}。我们可以先不判断它象征什么，只看看它在这里像是在靠近谁、保护谁，或和谁保持距离。${leadingQuestion}`
      : "现在还没有选中具体沙具。你可以点一下画布里的某个沙具，我会把它作为当前话题；也可以直接告诉我你最在意哪一个。";
  }

  return `我在这里。${insightBrief} 我们可以先从你的感受开始，而不是从解释开始。${leadingQuestion}`;
}
