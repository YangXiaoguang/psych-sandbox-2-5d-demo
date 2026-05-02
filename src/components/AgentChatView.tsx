import { ClipboardList, MessageCirclePlus, MessageSquarePlus, ScrollText, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  AgentConversation,
  AgentMessage,
  LlmProviderConfig,
  PsychAgentProfile,
  SandboxAnalysis,
  SandboxEvent,
  SandboxObject,
} from "../types";
import type { LlmChatMessage } from "../llm/streamText";
import { streamLlmText } from "../llm/streamText";
import { createId } from "../utils/id";
import { AgentPortrait } from "./AgentPortrait";
import { MarkdownText } from "./MarkdownText";

interface AgentChatViewProps {
  agents: PsychAgentProfile[];
  llmProviders: LlmProviderConfig[];
  conversations: AgentConversation[];
  objects: SandboxObject[];
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  onConversationsChange: Dispatch<SetStateAction<AgentConversation[]>>;
}

export function AgentChatView({
  agents,
  llmProviders,
  conversations,
  objects,
  events,
  analysis,
  onConversationsChange,
}: AgentChatViewProps): JSX.Element {
  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled), [agents]);
  const [activeAgentId, setActiveAgentId] = useState(() => enabledAgents[0]?.id ?? "");
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState("真实 LLM 未开始");
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeAgent = enabledAgents.find((agent) => agent.id === activeAgentId) ?? enabledAgents[0] ?? null;
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const latestMessage = activeConversation?.messages[activeConversation.messages.length - 1];
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [conversations],
  );
  const sceneSummary = useMemo(() => buildSceneSummary(objects, events, analysis), [analysis, events, objects]);

  useEffect(() => {
    if (!activeAgent && enabledAgents[0]) {
      setActiveAgentId(enabledAgents[0].id);
    }
  }, [activeAgent, enabledAgents]);

  useEffect(() => {
    if (!activeConversation && conversations[0]) {
      setActiveConversationId(conversations[0].id);
      setActiveAgentId(conversations[0].agentId);
    }
  }, [activeConversation, conversations]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      block: "nearest",
      behavior: streamingMessageId ? "auto" : "smooth",
    });
  }, [activeConversationId, activeConversation?.messages.length, latestMessage?.text, streamingMessageId]);

  const createConversation = (agent: PsychAgentProfile | null) => {
    if (!agent) {
      return;
    }
    const now = new Date().toISOString();
    const conversation: AgentConversation = {
      id: createId("conversation"),
      agentId: agent.id,
      title: `与 ${agent.name} 的会话`,
      messages: [
        {
          id: createId("message"),
          role: "assistant",
          text: agent.openingMessage,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    onConversationsChange((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setActiveAgentId(agent.id);
  };

  const selectConversation = (conversation: AgentConversation) => {
    setActiveConversationId(conversation.id);
    setActiveAgentId(conversation.agentId);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    const agent = activeAgent;
    let conversation = activeConversation;
    if (!text || !agent || streamingMessageId) {
      return;
    }

    if (!conversation) {
      const now = new Date().toISOString();
      conversation = {
        id: createId("conversation"),
        agentId: agent.id,
        title: text.slice(0, 18) || `与 ${agent.name} 的会话`,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      setActiveConversationId(conversation.id);
      onConversationsChange((current) => [conversation as AgentConversation, ...current]);
    }

    const now = new Date().toISOString();
    const userMessage: AgentMessage = { id: createId("message"), role: "user", text, createdAt: now };
    const assistantMessage: AgentMessage = { id: createId("message"), role: "assistant", text: "", createdAt: now };
    const targetConversationId = conversation.id;
    const requestMessages = buildAgentMessages(agent, conversation.messages, text, sceneSummary);

    setDraft("");
    setStreamingMessageId(assistantMessage.id);
    setStreamStatus("准备连接真实 LLM...");
    onConversationsChange((current) =>
      current.map((item) =>
        item.id === targetConversationId
          ? {
              ...item,
              title: item.messages.length === 0 ? text.slice(0, 18) || item.title : item.title,
              messages: [...item.messages, userMessage, assistantMessage],
              updatedAt: now,
            }
          : item,
      ),
    );

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let remoteText = "";
      const result = await streamLlmText({
        providers: llmProviders,
        preferredProviderId: agent.providerId,
        messages: requestMessages,
        temperature: agent.temperature,
        signal: controller.signal,
        onStatus: setStreamStatus,
        onToken: (token) => {
          remoteText += token;
          replaceAssistantText(targetConversationId, assistantMessage.id, remoteText);
        },
      });

      if (result.emittedTokens === 0) {
        throw new Error("provider 返回了空的流式内容。");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = createAgentReply(agent, text, sceneSummary);
      setStreamStatus(`真实 LLM 不可用，已回退本地模拟：${message}`);
      streamLocalFallback(targetConversationId, assistantMessage.id, fallback);
      return;
    }

    setStreamingMessageId(null);
  };

  const replaceAssistantText = (conversationId: string, messageId: string, text: string) => {
    onConversationsChange((current) =>
      current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              messages: item.messages.map((message) => (message.id === messageId ? { ...message, text } : message)),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  const streamLocalFallback = (conversationId: string, messageId: string, text: string) => {
    let cursor = 0;
    timerRef.current = window.setInterval(() => {
      cursor += 3;
      replaceAssistantText(conversationId, messageId, text.slice(0, cursor));
      if (cursor >= text.length) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
        }
        setStreamingMessageId(null);
      }
    }, 34);
  };

  const appendDraft = (text: string) => {
    setDraft((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
  };

  const insertSceneSummary = () => {
    appendDraft(`请结合这个沙盘摘要继续和我探索：${sceneSummary}`);
  };

  const continueWithQuestion = () => {
    appendDraft("请基于刚才的对话，继续问我一个更具体、温和、开放的问题。");
  };

  const requestConversationSummary = () => {
    appendDraft("请把这次对话整理成一段温和、非诊断性的沙盘探索小结，并保留可以继续探索的问题。");
  };

  return (
    <main className="agent-chat-shell" aria-label="Agent 对话界面">
      <aside className="conversation-rail" aria-label="会话列表">
        <div className="rail-header">
          <div>
            <p className="eyebrow">Conversations</p>
            <h2>会话</h2>
          </div>
          <button type="button" className="small-icon-button" onClick={() => createConversation(activeAgent)} aria-label="新建会话">
            <MessageCirclePlus size={16} />
          </button>
        </div>
        <div className="agent-picker">
          {enabledAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={activeAgentId === agent.id ? "active" : ""}
              onClick={() => setActiveAgentId(agent.id)}
            >
              <AgentPortrait agent={agent} size="mini" />
              <span>{agent.name}</span>
            </button>
          ))}
        </div>
        <div className="conversation-list">
          {sortedConversations.map((conversation) => {
            const agent = agents.find((item) => item.id === conversation.agentId);
            return (
              <button
                key={conversation.id}
                type="button"
                className={activeConversationId === conversation.id ? "active" : ""}
                onClick={() => selectConversation(conversation)}
              >
                <strong>{conversation.title}</strong>
                <span>{agent?.name ?? "未知 Agent"}</span>
                <em>{new Date(conversation.updatedAt).toLocaleString()}</em>
              </button>
            );
          })}
          {sortedConversations.length === 0 ? <p className="empty-state">还没有会话，选择一个 Agent 开始。</p> : null}
        </div>
      </aside>

      <section className="agent-stage" aria-label="Agent 对话舞台">
        {activeAgent ? (
          <>
            <div className="agent-stage-hero">
              <AgentPortrait agent={activeAgent} size="hero" isSpeaking={Boolean(streamingMessageId)} />
              <div className="agent-title-card">
                <p className="eyebrow">Live Sandplay Dialogue</p>
                <h2>{activeAgent.name}</h2>
                <p>{activeAgent.description}</p>
                <span>{activeAgent.school}</span>
              </div>
            </div>

            <div className="agent-chat-log" aria-live="polite">
              {(activeConversation?.messages ?? []).map((message) => (
                <article
                  key={message.id}
                  className={`agent-message ${message.role} ${streamingMessageId === message.id ? "speaking" : ""}`}
                >
                  {message.role === "assistant" ? (
                    <AgentPortrait agent={activeAgent} size="message" isSpeaking={streamingMessageId === message.id} />
                  ) : null}
                  <div className="agent-message-body">
                    <span className="agent-message-speaker">
                      {message.role === "assistant" ? activeAgent.name : "你"}
                    </span>
                    <MarkdownText content={message.text || "正在组织语言..."} />
                  </div>
                  {message.role === "user" ? <span className="agent-user-avatar" aria-hidden="true">你</span> : null}
                </article>
              ))}
              {!activeConversation ? (
                <div className="agent-empty-chat">
                  <Sparkles size={18} />
                  <p>点击左侧“新建会话”，或直接输入一句话开始。若配置可用，会优先使用真实 LLM 流式输出。</p>
                </div>
              ) : null}
              <div ref={chatEndRef} className="agent-chat-end" aria-hidden="true" />
            </div>

            <p className="agent-stream-status">{streamStatus}</p>
            <div className="agent-compose-actions" aria-label="快捷对话动作">
              <button type="button" onClick={insertSceneSummary} disabled={Boolean(streamingMessageId)}>
                <ClipboardList size={14} />
                沙盘摘要
              </button>
              <button type="button" onClick={continueWithQuestion} disabled={Boolean(streamingMessageId)}>
                <MessageSquarePlus size={14} />
                继续追问
              </button>
              <button type="button" onClick={requestConversationSummary} disabled={Boolean(streamingMessageId)}>
                <ScrollText size={14} />
                生成小结
              </button>
            </div>
            <form
              className="agent-composer"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`和 ${activeAgent.name} 聊聊这个沙盘、一个梦、一个沙具，或此刻的感受...`}
                rows={3}
              />
              <button type="submit" aria-label="发送消息" disabled={!draft.trim() || Boolean(streamingMessageId)}>
                <Send size={17} />
              </button>
            </form>
          </>
        ) : (
          <div className="agent-empty-chat">
            <Sparkles size={18} />
            <p>暂无启用的 Agent，请到管理后台创建或启用一个 Agent。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function buildSceneSummary(objects: SandboxObject[], events: SandboxEvent[], analysis: SandboxAnalysis): string {
  const objectText = objects.length > 0 ? objects.slice(0, 8).map((object) => object.name).join("、") : "当前沙盘为空";
  const gridText =
    analysis.grid
      .filter((cell) => cell.count > 0)
      .slice(0, 5)
      .map((cell) => `${cell.label}${cell.count}`)
      .join("、") || "暂无明显区域分布";
  const recentEvent = events[events.length - 1]?.label ?? "暂无创作事件";
  return `沙具：${objectText}。区域：${gridText}。最近事件：${recentEvent}。`;
}

function buildAgentMessages(
  agent: PsychAgentProfile,
  history: AgentMessage[],
  userInput: string,
  sceneSummary: string,
): LlmChatMessage[] {
  const system = [
    agent.systemPrompt,
    `当前沙盘摘要：${sceneSummary}`,
    "重要边界：你是心理沙盘对话伙伴，不做诊断，不替代专业心理咨询或医疗建议。不要声称自己是真实历史人物本人，只能作为理论取向角色进行温和交流。",
    "回答风格：中文，温暖、简洁、开放式提问优先。每次回复先回应用户，再提出一个可继续探索的问题。",
  ].join("\n\n");
  const historyMessages: LlmChatMessage[] = history
    .filter((message) => message.text.trim())
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));

  return [
    { role: "system", content: system },
    ...historyMessages,
    { role: "user", content: userInput },
  ];
}

function createAgentReply(agent: PsychAgentProfile, input: string, sceneSummary: string): string {
  const isDreamLike = /梦|象征|意象|画面/.test(input) || agent.avatarStyle === "dream";
  const isProcess = /过程|刚才|顺序|回顾/.test(input);
  const isFeeling = /感受|情绪|难受|害怕|开心|压力/.test(input);

  if (isDreamLike) {
    return `我会先把它当作一个意象来陪你看，而不是急着解释。${sceneSummary} 如果这个画面像一场梦，你觉得最有生命力的部分在哪里？也许我们可以从那里开始，看看它想靠近什么，或正在守护什么。`;
  }

  if (isProcess) {
    return `我们可以温柔地回看创作过程。${sceneSummary} 我会建议先找一个“转折点”：哪一步之后，沙盘的气氛变了？这个变化不需要马上被解释，只要先被看见。`;
  }

  if (isFeeling) {
    return `谢谢你把感受带进来。${agent.name} 会先陪你停一下：这种感受更像靠近、躲开、紧绷，还是松了一点？${sceneSummary} 你也可以只选一个沙具，让它替你说一小句话。`;
  }

  return `我听见了。以${agent.school}的方式，我们可以先保持开放，不把沙具固定成某个含义。${sceneSummary} 如果你愿意，下一步可以说说：这里哪个位置最吸引你，哪个位置又让你有一点距离感？`;
}
