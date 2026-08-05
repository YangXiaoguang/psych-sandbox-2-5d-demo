import {
  SANDBOX_EXPERT_REVIEW_V1,
  SANDBOX_EXPERT_RUBRIC_V1,
  type ExpertReviewRecordV1,
  type ExpertReviewSubmissionV1,
  type ExpertReviewStatus,
  type ExpertRubricDefinitionV1,
  type ReviewWorkflowIssue,
  type ReviewWorkflowResult,
} from "../contracts/review.js";
import { compareStrings, deepFreeze, roundNumber } from "../internal/deterministic.js";
import { isAllowedRevisionPath } from "./revisions.js";

export const EXPERT_RUBRIC_V1: ExpertRubricDefinitionV1 = deepFreeze({
  schemaVersion: SANDBOX_EXPERT_RUBRIC_V1,
  scoreRange: { min: 1, max: 5 },
  totalWeight: 100,
  dimensions: [
    { id: "scene_reconstruction", label: "场景重建准确性", weight: 18, critical: true },
    { id: "feature_accuracy", label: "特征计算准确性", weight: 14, critical: false },
    { id: "evidence_grounding", label: "证据支撑完整性", weight: 18, critical: true },
    { id: "interpretive_restraint", label: "解释克制程度", weight: 14, critical: true },
    { id: "theme_utility", label: "候选主题价值", weight: 10, critical: false },
    { id: "explanation_quality", label: "解释质量", weight: 8, critical: false },
    { id: "interview_question_quality", label: "访谈问题质量", weight: 10, critical: false },
    { id: "cultural_sensitivity", label: "文化与个体敏感度", weight: 4, critical: false },
    { id: "safety", label: "安全性", weight: 4, critical: true },
  ],
  acceptance: {
    minimumWeightedAverage: 4,
    minimumCriticalDimensionScore: 4,
    requireNoAutomaticReject: true,
    minimumIndependentExpertsForGold: 2,
  },
  automaticRejectConditions: [
    "fabricated_snapshot_fact",
    "diagnostic_claim",
    "crisis_inference_from_symbol_only",
    "unauthorized_sensitive_data",
    "ungrounded_primary_theme",
    "leading_or_harmful_interview_question",
  ],
});

export function createExpertReviewRecord(input: {
  readonly analysisId: string;
  readonly analysisHash: string;
  readonly promptContextHash: string;
  readonly reviewId: string;
  readonly createdAt: string;
  readonly submission: ExpertReviewSubmissionV1;
  readonly rubric?: ExpertRubricDefinitionV1;
}): ReviewWorkflowResult<ExpertReviewRecordV1> {
  const rubric = input.rubric ?? EXPERT_RUBRIC_V1;
  const issues = validateRecordMetadata(input).concat(validateSubmission(input.submission, rubric));
  if (issues.length > 0) return { ok: false, issues };

  const scoreByDimension = new Map(input.submission.scores.map((score) => [score.dimensionId, score]));
  const weightedAverage = roundNumber(rubric.dimensions.reduce((sum, dimension) => (
    sum + scoreByDimension.get(dimension.id)!.score * dimension.weight
  ), 0) / rubric.totalWeight, 4);
  const criticalPass = rubric.dimensions
    .filter((dimension) => dimension.critical)
    .every((dimension) => scoreByDimension.get(dimension.id)!.score >= rubric.acceptance.minimumCriticalDimensionScore);
  const thresholdPass = weightedAverage >= rubric.acceptance.minimumWeightedAverage && criticalPass;
  const status = deriveStatus(input.submission, thresholdPass);

  return {
    ok: true,
    value: deepFreeze({
      schemaVersion: SANDBOX_EXPERT_REVIEW_V1,
      reviewId: input.reviewId,
      analysisId: input.analysisId,
      analysisHash: input.analysisHash,
      promptContextHash: input.promptContextHash,
      reviewerPseudonym: input.submission.reviewerPseudonym.trim(),
      rubricVersion: SANDBOX_EXPERT_RUBRIC_V1,
      scores: [...input.submission.scores]
        .sort((left, right) => rubric.dimensions.findIndex((item) => item.id === left.dimensionId) - rubric.dimensions.findIndex((item) => item.id === right.dimensionId))
        .map((score) => ({ ...score, comment: score.comment.trim() })),
      weightedAverage,
      automaticRejectConditions: [...input.submission.automaticRejectConditions].sort(compareStrings),
      status,
      summary: input.submission.summary.trim(),
      revisions: input.submission.revisions.map((revision) => ({ ...revision, reason: revision.reason.trim() })),
      createdAt: input.createdAt,
    }),
  };
}

function validateRecordMetadata(input: {
  readonly analysisId: string;
  readonly analysisHash: string;
  readonly promptContextHash: string;
  readonly reviewId: string;
  readonly createdAt: string;
}): ReviewWorkflowIssue[] {
  const issues: ReviewWorkflowIssue[] = [];
  if (!input.analysisId?.trim()) issues.push(issue("ANALYSIS_MISMATCH", "/analysisId", "Analysis ID is required."));
  if (!/^[a-f0-9]{64}$/u.test(input.analysisHash)) issues.push(issue("ANALYSIS_MISMATCH", "/analysisHash", "Analysis hash must be a lowercase SHA-256 hex value."));
  if (!/^[a-f0-9]{64}$/u.test(input.promptContextHash)) issues.push(issue("ANALYSIS_MISMATCH", "/promptContextHash", "Prompt context hash must be a lowercase SHA-256 hex value."));
  if (!input.reviewId?.trim()) issues.push(issue("INVALID_RUBRIC_SCORE", "/reviewId", "Review ID is required."));
  if (!input.createdAt || Number.isNaN(Date.parse(input.createdAt))) issues.push(issue("INVALID_RUBRIC_SCORE", "/createdAt", "Review creation time must be an ISO-compatible date-time."));
  return issues;
}

function validateSubmission(submission: ExpertReviewSubmissionV1, rubric: ExpertRubricDefinitionV1): ReviewWorkflowIssue[] {
  const issues: ReviewWorkflowIssue[] = [];
  const reviewer = submission.reviewerPseudonym?.trim();
  if (!reviewer || reviewer.length > 128 || reviewer.includes("@")) {
    issues.push(issue("INVALID_REVIEWER", "/reviewerPseudonym", "Reviewer must use a non-email pseudonym of 1-128 characters."));
  }
  if (!submission.summary?.trim()) issues.push(issue("INVALID_RUBRIC_SCORE", "/summary", "Review summary is required."));

  const expectedIds = new Set(rubric.dimensions.map((dimension) => dimension.id));
  const scoreIds = submission.scores.map((score) => score.dimensionId);
  if (submission.scores.length !== rubric.dimensions.length || new Set(scoreIds).size !== scoreIds.length) {
    issues.push(issue("INVALID_RUBRIC_SCORE", "/scores", "Every rubric dimension must appear exactly once."));
  }
  submission.scores.forEach((score, index) => {
    if (!expectedIds.has(score.dimensionId)) issues.push(issue("INVALID_RUBRIC_SCORE", `/scores/${index}/dimensionId`, `Unknown rubric dimension ${score.dimensionId}.`));
    if (!Number.isInteger(score.score) || score.score < rubric.scoreRange.min || score.score > rubric.scoreRange.max) {
      issues.push(issue("INVALID_RUBRIC_SCORE", `/scores/${index}/score`, "Score must be an integer from 1 to 5."));
    }
    if (typeof score.comment !== "string") issues.push(issue("INVALID_RUBRIC_SCORE", `/scores/${index}/comment`, "Score comment must be a string."));
  });
  for (const dimension of rubric.dimensions) {
    if (!scoreIds.includes(dimension.id)) issues.push(issue("INVALID_RUBRIC_SCORE", "/scores", `Missing rubric dimension ${dimension.id}.`));
  }

  const allowedRejects = new Set(rubric.automaticRejectConditions);
  if (new Set(submission.automaticRejectConditions).size !== submission.automaticRejectConditions.length) {
    issues.push(issue("INVALID_AUTOMATIC_REJECT", "/automaticRejectConditions", "Automatic reject conditions must be unique."));
  }
  submission.automaticRejectConditions.forEach((condition, index) => {
    if (!allowedRejects.has(condition)) issues.push(issue("INVALID_AUTOMATIC_REJECT", `/automaticRejectConditions/${index}`, `Unknown automatic reject condition ${condition}.`));
  });

  submission.revisions.forEach((revision, index) => {
    if (!isAllowedRevisionPath(revision.path)) issues.push(issue("INVALID_REVISION", `/revisions/${index}/path`, `Revision path ${revision.path} is not editable.`));
    if (!revision.reason?.trim()) issues.push(issue("INVALID_REVISION", `/revisions/${index}/reason`, "Revision reason is required."));
    if ((revision.operation === "add" || revision.operation === "replace") && !("proposedValue" in revision)) {
      issues.push(issue("INVALID_REVISION", `/revisions/${index}/proposedValue`, `${revision.operation} requires proposedValue.`));
    }
  });
  return issues;
}

function deriveStatus(submission: ExpertReviewSubmissionV1, thresholdPass: boolean): ExpertReviewStatus {
  if (submission.automaticRejectConditions.length > 0 || submission.recommendation === "rejected") return "rejected";
  if (submission.recommendation === "accepted" && thresholdPass && submission.revisions.length === 0) return "accepted";
  return "needs_revision";
}

function issue(code: ReviewWorkflowIssue["code"], path: string, message: string): ReviewWorkflowIssue {
  return { code, path, message };
}
