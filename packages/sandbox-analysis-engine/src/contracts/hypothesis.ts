import type { SandboxAnalysisResultV1 } from "./analysis.js";
import type { EvidenceGraphNodeV1, FeatureBundleV1, JsonValue } from "./features.js";
import type { SnapshotMigration } from "./migration.js";
import type { ReconstructedSceneV1 } from "./scene.js";
import type { SafetyEvaluationReportV1, SafetyPolicy } from "./safety.js";

export const SANDBOX_HYPOTHESIS_DRAFT_V1 = "sandbox.hypothesis-draft.v1" as const;
export const SANDBOX_HYPOTHESIS_CONTEXT_V1 = "sandbox.hypothesis-context.v1" as const;
export const SANDBOX_HYPOTHESIS_PROMPT_V1 = "sandbox.hypothesis-prompt.v1" as const;
export const SANDBOX_ANALYSIS_ENGINE_VERSION = "0.4.0" as const;

export interface LlmMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface LlmStructuredRequest {
  readonly requestId: string;
  readonly promptVersion: typeof SANDBOX_HYPOTHESIS_PROMPT_V1;
  readonly messages: readonly LlmMessage[];
  readonly responseSchema: Readonly<Record<string, unknown>>;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface LlmStructuredResponse {
  readonly content: string | unknown;
  readonly provider: string;
  readonly model: string;
  readonly finishReason?: string;
}

export interface LlmPort {
  generateStructured(request: LlmStructuredRequest): Promise<LlmStructuredResponse>;
}

export interface ClockPort {
  now(): string;
}

export interface IdGeneratorPort {
  createId(prefix: string): string;
}

export interface AnalysisKnowledgeBase {
  readonly version: string;
  readonly guidance: readonly string[];
}

export interface KnowledgeBasePort {
  loadAnalysisGuidance(): Promise<AnalysisKnowledgeBase>;
}

export interface SandboxHypothesisDraftCandidateV1 {
  readonly id: string;
  readonly label: string;
  readonly confidence: number;
  readonly confidenceLevel: "low" | "medium" | "high";
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly alternativeExplanations: readonly string[];
  readonly explanation: string;
  readonly questionsToVerify: readonly string[];
  readonly interpretiveLimit: string;
}

export interface SandboxHypothesisDraftQuestionV1 {
  readonly id: string;
  readonly text: string;
  readonly intent: string;
  readonly leading: false;
  readonly evidenceIds: readonly string[];
  readonly hypothesisIds: readonly string[];
}

export interface SandboxHypothesisDraftV1 {
  readonly schemaVersion: typeof SANDBOX_HYPOTHESIS_DRAFT_V1;
  readonly hypotheses: readonly SandboxHypothesisDraftCandidateV1[];
  readonly interviewQuestions: readonly SandboxHypothesisDraftQuestionV1[];
  readonly warnings: readonly string[];
}

export interface HypothesisPromptFeatureV1 {
  readonly id: string;
  readonly scope: string;
  readonly kind: string;
  readonly label: string;
  readonly value: JsonValue;
  readonly fidelity: "deterministic" | "weak";
  readonly objectIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly interpretiveLimit: string;
}

export interface HypothesisPromptContextV1 {
  readonly schemaVersion: typeof SANDBOX_HYPOTHESIS_CONTEXT_V1;
  readonly sourceSnapshotId: string;
  readonly scene: {
    readonly objectCount: number;
    readonly selectedObjectId: string | null;
    readonly occupiedZones: readonly string[];
    readonly environment: ReconstructedSceneV1["environment"];
    readonly objects: readonly {
      readonly id: string;
      readonly name: string;
      readonly category: string;
      readonly riskTag: string;
      readonly zone: string;
      readonly selected: boolean;
    }[];
  };
  readonly processEvidence: FeatureBundleV1["processEvidence"];
  readonly evidence: readonly EvidenceGraphNodeV1[];
  readonly features: readonly HypothesisPromptFeatureV1[];
  readonly allowedEvidenceIds: readonly string[];
  readonly contextPolicy: {
    readonly includesRawSnapshot: false;
    readonly includesEvents: false;
    readonly includesPersonalMemory: false;
    readonly includesUserIdentity: false;
    readonly includesImages: false;
    readonly relationFeatureLimit: number;
    readonly includedRelationFeatures: number;
    readonly omittedRelationFeatures: number;
  };
}

export type HypothesisAnalysisIssueCode =
  | "INPUT_INVALID"
  | "KNOWLEDGE_BASE_ERROR"
  | "LLM_PORT_ERROR"
  | "LLM_OUTPUT_INVALID_JSON"
  | "LLM_OUTPUT_SCHEMA_INVALID"
  | "SAFETY_POLICY_ERROR"
  | "UNKNOWN_EVIDENCE_REFERENCE"
  | "UNKNOWN_HYPOTHESIS_REFERENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFIDENCE_MISMATCH"
  | "LEADING_QUESTION"
  | "FORBIDDEN_LANGUAGE"
  | "UNSUPPORTED_PROCESS_CLAIM"
  | "UNSUPPORTED_EVIDENCE_CLAIM"
  | "SYMBOLIC_OVERREACH";

export interface HypothesisAnalysisIssue {
  readonly code: HypothesisAnalysisIssueCode;
  readonly path: string;
  readonly message: string;
}

export type SandboxHypothesisAnalysisResult =
  | {
      readonly ok: true;
      readonly value: SandboxAnalysisResultV1;
      readonly promptContext: HypothesisPromptContextV1;
      readonly llm: LlmStructuredResponse;
      readonly safetyEvaluation: SafetyEvaluationReportV1;
    }
  | {
      readonly ok: false;
      readonly stage: "input" | "knowledge-base" | "llm" | "output" | "safety";
      readonly issues: readonly HypothesisAnalysisIssue[];
      readonly promptContext?: HypothesisPromptContextV1;
      readonly safetyEvaluation?: SafetyEvaluationReportV1;
    };

export interface CreateSandboxHypothesisAnalyzerOptions {
  readonly llm: LlmPort;
  readonly migrations?: readonly SnapshotMigration[];
  readonly clock?: ClockPort;
  readonly idGenerator?: IdGeneratorPort;
  readonly knowledgeBase?: KnowledgeBasePort;
  readonly safetyPolicy?: SafetyPolicy;
  readonly relationFeatureLimit?: number;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface AnalyzeSandboxHypothesesOptions {
  readonly relationFeatureLimit?: number;
}

export interface SandboxHypothesisAnalyzer {
  analyze(input: unknown, options?: AnalyzeSandboxHypothesesOptions): Promise<SandboxHypothesisAnalysisResult>;
}
