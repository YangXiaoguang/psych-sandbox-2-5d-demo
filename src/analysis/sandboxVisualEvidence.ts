export const SANDBOX_VISUAL_SUPPLEMENT_SCHEMA = "sandbox.visual-supplement.v1";

export type SandboxVisualSupplementPurpose =
  | "qa_visual_alignment"
  | "renderer_consistency_check"
  | "human_review_reference";

export interface SandboxVisualSupplementPolicy {
  derivedFromCurrentSnapshotRequired: true;
  descriptorContainsImageData: false;
  mayBeSentToLlm: false;
  mayReplaceSnapshotOrInsight: false;
  requiresHumanReview: true;
  note: string;
}

export interface SandboxVisualSupplementDescriptor {
  schemaVersion: typeof SANDBOX_VISUAL_SUPPLEMENT_SCHEMA;
  sourceSnapshotId: string;
  generatedAt: string;
  purpose: SandboxVisualSupplementPurpose;
  renderer: "classic2d" | "stage3d" | "unknown";
  captureArtifactId?: string;
  imageDigest?: string;
  policy: SandboxVisualSupplementPolicy;
  allowedUses: string[];
  prohibitedUses: string[];
}

export interface CreateSandboxVisualSupplementDescriptorInput {
  sourceSnapshotId: string;
  generatedAt: string;
  purpose: SandboxVisualSupplementPurpose;
  renderer?: "classic2d" | "stage3d" | "unknown";
  captureArtifactId?: string;
  imageDigest?: string;
}

export function createSandboxVisualSupplementDescriptor({
  sourceSnapshotId,
  generatedAt,
  purpose,
  renderer = "unknown",
  captureArtifactId,
  imageDigest,
}: CreateSandboxVisualSupplementDescriptorInput): SandboxVisualSupplementDescriptor {
  return {
    schemaVersion: SANDBOX_VISUAL_SUPPLEMENT_SCHEMA,
    sourceSnapshotId,
    generatedAt,
    purpose,
    renderer,
    captureArtifactId,
    imageDigest,
    policy: {
      derivedFromCurrentSnapshotRequired: true,
      descriptorContainsImageData: false,
      mayBeSentToLlm: false,
      mayReplaceSnapshotOrInsight: false,
      requiresHumanReview: true,
      note:
        "视觉补充证据只用于本地 QA 或人工复核，不能作为 LLM 主输入；LLM 分析仍必须以 CurrentSandboxSnapshot 和 CurrentSandboxInsight 为准。",
    },
    allowedUses: [
      "对比渲染结果是否与结构化 snapshot 一致",
      "辅助人工检查沙具是否被遮挡、丢失或显示异常",
      "辅助视觉回归记录，不进入心理分析上下文",
    ],
    prohibitedUses: [
      "作为 LLM 主输入",
      "替代 CurrentSandboxSnapshot",
      "替代 CurrentSandboxInsight",
      "从截图推断用户身份、情绪或诊断结论",
    ],
  };
}

export function assertVisualSupplementIsNotLlmInput(descriptor: SandboxVisualSupplementDescriptor): true {
  if (descriptor.policy.mayBeSentToLlm || descriptor.policy.mayReplaceSnapshotOrInsight) {
    throw new Error("Sandbox visual supplement must not be used as LLM input or replace Snapshot/Insight.");
  }
  return true;
}
