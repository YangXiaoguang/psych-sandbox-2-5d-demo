import type {
  HypothesisPromptContextV1,
  SandboxHypothesisDraftV1,
} from "./hypothesis.js";

export const SANDBOX_SAFETY_EVALUATION_V1 = "sandbox.safety-evaluation.v1" as const;
export const SANDBOX_CORE_SAFETY_POLICY_V1 = "sandbox.safety-policy.core.v1" as const;

export type SafetySeverity = "info" | "warning" | "high" | "critical";
export type SafetyAction = "allow" | "flag_for_review" | "block";
export type SafetyDecision = "allow" | "review" | "block";
export type SafetyFindingCategory =
  | "diagnostic_claim"
  | "crisis_inference"
  | "personality_certainty"
  | "unsupported_process_claim"
  | "leading_question"
  | "unsupported_object_claim"
  | "unsupported_spatial_claim"
  | "unsupported_semantic_claim"
  | "symbolic_overreach"
  | "evidence_conflict"
  | "custom";

export type SafetyTextRole =
  | "hypothesis_label"
  | "hypothesis_explanation"
  | "alternative_explanation"
  | "verification_question"
  | "interpretive_limit"
  | "interview_question"
  | "question_intent"
  | "warning";

export interface SafetyTextSegmentV1 {
  readonly path: string;
  readonly role: SafetyTextRole;
  readonly text: string;
  readonly evidenceIds: readonly string[];
  readonly hypothesisIds: readonly string[];
}

export interface SafetyRuleFindingDraft {
  readonly category: SafetyFindingCategory;
  readonly severity: SafetySeverity;
  readonly action: SafetyAction;
  readonly path: string;
  readonly matchedText: string;
  readonly message: string;
  readonly evidenceIds?: readonly string[];
  readonly hypothesisIds?: readonly string[];
}

export interface SafetyFindingV1 extends SafetyRuleFindingDraft {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly evidenceIds: readonly string[];
  readonly hypothesisIds: readonly string[];
}

export interface SafetyEvaluationInputV1 {
  readonly draft: SandboxHypothesisDraftV1;
  readonly promptContext: HypothesisPromptContextV1;
  readonly textSegments: readonly SafetyTextSegmentV1[];
}

export interface SafetyRule {
  readonly id: string;
  readonly version: string;
  evaluate(input: SafetyEvaluationInputV1): readonly SafetyRuleFindingDraft[];
}

export interface SafetyEvaluationReportV1 {
  readonly schemaVersion: typeof SANDBOX_SAFETY_EVALUATION_V1;
  readonly policyVersion: string;
  readonly decision: SafetyDecision;
  readonly maxSeverity: SafetySeverity;
  readonly evaluatedTextSegments: number;
  readonly findings: readonly SafetyFindingV1[];
  readonly summary: {
    readonly allowCount: number;
    readonly reviewCount: number;
    readonly blockCount: number;
  };
}

export interface SafetyPolicy {
  readonly version: string;
  readonly rules: readonly Pick<SafetyRule, "id" | "version">[];
  evaluate(draft: SandboxHypothesisDraftV1, promptContext: HypothesisPromptContextV1): SafetyEvaluationReportV1;
}

export interface CreateSafetyPolicyOptions {
  readonly version?: string;
  readonly rules?: readonly SafetyRule[];
  readonly ruleMode?: "append" | "replace";
}
