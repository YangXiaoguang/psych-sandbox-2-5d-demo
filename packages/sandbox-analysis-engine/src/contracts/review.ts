import type { SandboxAnalysisResultV1 } from "./analysis.js";
import type { HypothesisPromptContextV1 } from "./hypothesis.js";
import type { SafetyPolicy } from "./safety.js";

export const SANDBOX_EXPERT_REVIEW_V1 = "sandbox.expert-review.v1" as const;
export const SANDBOX_REVISED_ANALYSIS_V1 = "sandbox.revised-analysis.v1" as const;
export const SANDBOX_REVIEW_ADJUDICATION_V1 = "sandbox.review-adjudication.v1" as const;
export const SANDBOX_REVIEW_CASE_BUNDLE_V1 = "sandbox.review-case-bundle.v1" as const;
export const SANDBOX_EXPERT_RUBRIC_V1 = "sandbox.analysis.expert-rubric.v1" as const;

export type ExpertReviewStatus = "accepted" | "rejected" | "needs_revision";
export type ReviewWorkflowIssueCode =
  | "ANALYSIS_MISMATCH"
  | "ANALYSIS_NOT_REVIEWABLE"
  | "INVALID_REVIEWER"
  | "INVALID_RUBRIC_SCORE"
  | "INVALID_AUTOMATIC_REJECT"
  | "INVALID_REVISION"
  | "REVISION_CONFLICT"
  | "REVISION_VALIDATION_FAILED"
  | "REVISION_SAFETY_BLOCKED"
  | "REVIEW_NOT_FOUND"
  | "INSUFFICIENT_INDEPENDENT_REVIEWERS"
  | "INVALID_ADJUDICATION"
  | "REPOSITORY_ERROR";

export interface ExpertRubricDimensionV1 {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly critical: boolean;
}

export interface ExpertRubricDefinitionV1 {
  readonly schemaVersion: typeof SANDBOX_EXPERT_RUBRIC_V1;
  readonly scoreRange: { readonly min: 1; readonly max: 5 };
  readonly totalWeight: 100;
  readonly dimensions: readonly ExpertRubricDimensionV1[];
  readonly acceptance: {
    readonly minimumWeightedAverage: number;
    readonly minimumCriticalDimensionScore: number;
    readonly requireNoAutomaticReject: true;
    readonly minimumIndependentExpertsForGold: number;
  };
  readonly automaticRejectConditions: readonly string[];
}

export interface ExpertDimensionScore {
  readonly dimensionId: string;
  readonly score: 1 | 2 | 3 | 4 | 5;
  readonly comment: string;
}

export interface ExpertFieldRevision {
  readonly path: string;
  readonly operation: "replace" | "remove" | "add";
  readonly previousValue?: unknown;
  readonly proposedValue?: unknown;
  readonly reason: string;
}

export interface ExpertReviewSubmissionV1 {
  readonly reviewerPseudonym: string;
  readonly scores: readonly ExpertDimensionScore[];
  readonly automaticRejectConditions: readonly string[];
  readonly recommendation: ExpertReviewStatus;
  readonly summary: string;
  readonly revisions: readonly ExpertFieldRevision[];
}

export interface ExpertReviewRecordV1 {
  readonly schemaVersion: typeof SANDBOX_EXPERT_REVIEW_V1;
  readonly reviewId: string;
  readonly analysisId: string;
  readonly analysisHash: string;
  readonly promptContextHash: string;
  readonly reviewerPseudonym: string;
  readonly rubricVersion: typeof SANDBOX_EXPERT_RUBRIC_V1;
  readonly scores: readonly ExpertDimensionScore[];
  readonly weightedAverage: number;
  readonly automaticRejectConditions: readonly string[];
  readonly status: ExpertReviewStatus;
  readonly summary: string;
  readonly revisions: readonly ExpertFieldRevision[];
  readonly createdAt: string;
}

export interface ReviewAnalysisSourceV1 {
  readonly analysis: SandboxAnalysisResultV1;
  readonly promptContext: HypothesisPromptContextV1;
}

export interface RevisedAnalysisVersionV1 {
  readonly schemaVersion: typeof SANDBOX_REVISED_ANALYSIS_V1;
  readonly versionId: string;
  readonly analysisId: string;
  readonly sequence: number;
  readonly parentVersionId: string | null;
  readonly reviewId: string;
  readonly reviewerPseudonym: string;
  readonly baseAnalysisHash: string;
  readonly revisedAnalysisHash: string;
  readonly appliedRevisions: readonly ExpertFieldRevision[];
  readonly analysis: SandboxAnalysisResultV1;
  readonly createdAt: string;
}

export interface ReviewDisagreementV1 {
  readonly kind: "status" | "dimension_score" | "revision";
  readonly dimensionId?: string;
  readonly reviewIds: readonly string[];
  readonly detail: string;
}

export interface ReviewAdjudicationSubmissionV1 {
  readonly adjudicatorPseudonym: string;
  readonly reviewIds: readonly string[];
  readonly status: ExpertReviewStatus;
  readonly selectedRevisionVersionId?: string;
  readonly rationale: string;
}

export interface ReviewAdjudicationRecordV1 {
  readonly schemaVersion: typeof SANDBOX_REVIEW_ADJUDICATION_V1;
  readonly adjudicationId: string;
  readonly analysisId: string;
  readonly adjudicatorPseudonym: string;
  readonly reviewIds: readonly string[];
  readonly status: ExpertReviewStatus;
  readonly selectedRevisionVersionId: string | null;
  readonly finalAnalysisHash: string;
  readonly disagreements: readonly ReviewDisagreementV1[];
  readonly goldEligible: boolean;
  readonly goldIneligibilityReasons: readonly string[];
  readonly rationale: string;
  readonly createdAt: string;
}

export interface ReviewCaseBundleV1 {
  readonly schemaVersion: typeof SANDBOX_REVIEW_CASE_BUNDLE_V1;
  readonly exportId: string;
  readonly analysisId: string;
  readonly exportedAt: string;
  readonly originalAnalysisHash: string;
  readonly originalAnalysis: SandboxAnalysisResultV1;
  readonly reviews: readonly ExpertReviewRecordV1[];
  readonly revisionHistory: readonly RevisedAnalysisVersionV1[];
  readonly adjudication: ReviewAdjudicationRecordV1 | null;
  readonly goldEligibility: {
    readonly eligible: boolean;
    readonly reasons: readonly string[];
  };
}

export interface ReviewWorkflowIssue {
  readonly code: ReviewWorkflowIssueCode;
  readonly path: string;
  readonly message: string;
}

export type ReviewWorkflowResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ReviewWorkflowIssue[] };

export interface ReviewRepositoryPort {
  saveReview(review: ExpertReviewRecordV1): Promise<void>;
  listReviews(analysisId: string): Promise<readonly ExpertReviewRecordV1[]>;
  saveRevision(version: RevisedAnalysisVersionV1): Promise<void>;
  listRevisions(analysisId: string): Promise<readonly RevisedAnalysisVersionV1[]>;
  saveAdjudication(adjudication: ReviewAdjudicationRecordV1): Promise<void>;
  getAdjudication(analysisId: string): Promise<ReviewAdjudicationRecordV1 | null>;
}

export interface ExpertReviewWorkflow {
  submitExpertReview(source: ReviewAnalysisSourceV1, submission: ExpertReviewSubmissionV1): Promise<ReviewWorkflowResult<ExpertReviewRecordV1>>;
  applyExpertRevision(source: ReviewAnalysisSourceV1, reviewId: string, parentVersionId?: string): Promise<ReviewWorkflowResult<RevisedAnalysisVersionV1>>;
  adjudicate(source: ReviewAnalysisSourceV1, submission: ReviewAdjudicationSubmissionV1): Promise<ReviewWorkflowResult<ReviewAdjudicationRecordV1>>;
  exportCaseBundle(source: ReviewAnalysisSourceV1): Promise<ReviewWorkflowResult<ReviewCaseBundleV1>>;
}

export interface CreateExpertReviewWorkflowOptions {
  readonly repository?: ReviewRepositoryPort;
  readonly rubric?: ExpertRubricDefinitionV1;
  readonly safetyPolicy?: SafetyPolicy;
  readonly clock?: { now(): string };
  readonly idGenerator?: { createId(prefix: string): string };
}
