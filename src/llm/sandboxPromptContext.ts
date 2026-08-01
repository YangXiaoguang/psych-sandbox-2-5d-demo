import type { CurrentSandboxSnapshotPolicyDto } from "../api/contracts";
import type { CurrentSandboxSnapshot } from "./currentSandboxSnapshot";
import type { LlmChatMessage } from "./streamText";

export const CURRENT_SNAPSHOT_ALLOWED_CONTEXT_NOTICE =
  "当前只允许使用 CurrentSandboxSnapshot。不要假设事件流、个人记忆、用户身份、授权上下文、截图或 API Key 存在。";

export const SANDBOX_DIALOGUE_SAFETY_NOTICE =
  "你是心理沙盘对话伙伴，不做诊断，不替代专业心理咨询或医疗建议；不要把沙具解释成固定象征，要优先使用温和、开放的问题。";

interface SandboxSnapshotChatMessageInput {
  systemInstructions: string[];
  snapshot: CurrentSandboxSnapshot;
  policy: CurrentSandboxSnapshotPolicyDto;
  userInput: string;
  history?: LlmChatMessage[];
  historyLimit?: number;
  summaryText?: string;
  extraRules?: string[];
}

export function createSandboxSnapshotChatMessages({
  systemInstructions,
  snapshot,
  policy,
  userInput,
  history = [],
  historyLimit = 10,
  summaryText,
  extraRules = [],
}: SandboxSnapshotChatMessageInput): LlmChatMessage[] {
  const system = [
    ...systemInstructions.map((line) => line.trim()).filter(Boolean),
    buildCurrentSnapshotPromptBlock({ snapshot, policy, summaryText, extraRules }),
  ].join("\n\n");

  return [
    { role: "system", content: system },
    ...sanitizeHistoryMessages(history, historyLimit),
    { role: "user", content: userInput.trim() },
  ];
}

export function buildCurrentSnapshotPromptBlock({
  snapshot,
  policy,
  summaryText,
  extraRules = [],
}: {
  snapshot: CurrentSandboxSnapshot;
  policy: CurrentSandboxSnapshotPolicyDto;
  summaryText?: string;
  extraRules?: string[];
}): string {
  return [
    CURRENT_SNAPSHOT_ALLOWED_CONTEXT_NOTICE,
    summaryText ? `当前沙盘摘要：${summaryText}` : null,
    `CurrentSandboxSnapshotPolicy JSON:\n${JSON.stringify(policy, null, 2)}`,
    `CurrentSandboxSnapshot JSON:\n${JSON.stringify(snapshot, null, 2)}`,
    ...extraRules.map((rule) => rule.trim()).filter(Boolean),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildCurrentSnapshotBrief(snapshot: CurrentSandboxSnapshot): string {
  const objectText =
    snapshot.objects.length > 0
      ? snapshot.objects
          .slice(0, 8)
          .map((object) => object.name)
          .join("、")
      : "当前沙盘为空";
  const gridText =
    snapshot.analysis.zoneCounts
      .filter((cell) => cell.count > 0)
      .slice(0, 5)
      .map((cell) => `${cell.label}${cell.count}`)
      .join("、") || "暂无明显区域分布";

  return `沙具：${objectText}。区域：${gridText}。中心${snapshot.analysis.centerCount}个，边界${snapshot.analysis.boundaryCount}个。环境：${snapshot.environment.weatherLabel} · ${snapshot.environment.lightLabel}。`;
}

function sanitizeHistoryMessages(messages: LlmChatMessage[], limit: number): LlmChatMessage[] {
  return messages
    .filter((message) => message.role !== "system" && message.content.trim())
    .slice(-Math.max(0, limit))
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}
