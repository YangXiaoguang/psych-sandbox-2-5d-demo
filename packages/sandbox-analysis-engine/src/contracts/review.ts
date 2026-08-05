export const SANDBOX_EXPERT_REVIEW_V1 = "sandbox.expert-review.v1" as const;

export type ExpertReviewStatus = "accepted" | "rejected" | "needs_revision";

export interface ExpertDimensionScore {
  dimensionId: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

export interface ExpertFieldRevision {
  path: string;
  operation: "replace" | "remove" | "add";
  previousValue?: unknown;
  proposedValue?: unknown;
  reason: string;
}

export interface ExpertReviewRecordV1 {
  schemaVersion: typeof SANDBOX_EXPERT_REVIEW_V1;
  reviewId: string;
  analysisId: string;
  reviewerPseudonym: string;
  rubricVersion: "sandbox.analysis.expert-rubric.v1";
  scores: ExpertDimensionScore[];
  weightedAverage: number;
  automaticRejectConditions: string[];
  status: ExpertReviewStatus;
  summary: string;
  revisions: ExpertFieldRevision[];
  createdAt: string;
}
