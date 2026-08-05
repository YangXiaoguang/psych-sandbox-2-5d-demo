import type { SandboxAnalysisResultV1 } from "../contracts/analysis.js";
import type {
  CreateExpertReviewWorkflowOptions,
  ExpertReviewRecordV1,
  ExpertReviewSubmissionV1,
  ExpertReviewWorkflow,
  ExpertRubricDefinitionV1,
  ReviewAdjudicationRecordV1,
  ReviewAdjudicationSubmissionV1,
  ReviewAnalysisSourceV1,
  ReviewCaseBundleV1,
  ReviewDisagreementV1,
  ReviewRepositoryPort,
  ReviewWorkflowIssue,
  ReviewWorkflowResult,
  RevisedAnalysisVersionV1,
} from "../contracts/review.js";
import {
  SANDBOX_REVISED_ANALYSIS_V1,
  SANDBOX_REVIEW_ADJUDICATION_V1,
  SANDBOX_REVIEW_CASE_BUNDLE_V1,
} from "../contracts/review.js";
import type { SafetyPolicy } from "../contracts/safety.js";
import { parseAndValidateHypothesisDraft } from "../hypotheses/validateDraft.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";
import { createSandboxSafetyPolicy } from "../safety/createSafetyPolicy.js";
import { InMemoryReviewRepository } from "./inMemoryReviewRepository.js";
import { analysisToHypothesisDraft, applyFieldRevisions } from "./revisions.js";
import { createExpertReviewRecord, EXPERT_RUBRIC_V1 } from "./rubric.js";

const SAFETY_REVIEW_WARNING = "该修订稿触发安全策略复核项，进入金标准前需要专家协调确认。";
let defaultReviewIdSequence = 0;

export function createExpertReviewWorkflow(
  options: CreateExpertReviewWorkflowOptions = {},
): ExpertReviewWorkflow {
  const repository = options.repository ?? new InMemoryReviewRepository();
  const rubric = options.rubric ?? EXPERT_RUBRIC_V1;
  assertRubric(rubric);
  const safetyPolicy = options.safetyPolicy ?? createSandboxSafetyPolicy();
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const idGenerator = options.idGenerator ?? {
    createId(prefix: string) {
      const randomUuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
      defaultReviewIdSequence += 1;
      return randomUuid
        ? `${prefix}-${randomUuid}`
        : `${prefix}-${Date.now().toString(36)}-${defaultReviewIdSequence.toString(36)}`;
    },
  };

  return {
    async submitExpertReview(source, submission) {
      const sourceIssues = validateSource(source, safetyPolicy);
      if (sourceIssues.length > 0) return { ok: false, issues: sourceIssues };
      const analysisHash = hashCanonicalJson(source.analysis);
      const promptContextHash = hashCanonicalJson(source.promptContext);
      try {
        const existing = await repository.listReviews(source.analysis.analysisId);
        if (existing.some((review) => review.reviewerPseudonym === submission.reviewerPseudonym.trim() && review.analysisHash === analysisHash)) {
          return failure("INVALID_REVIEWER", "/reviewerPseudonym", "The same expert cannot independently review the same analysis version twice.");
        }
        const record = createExpertReviewRecord({
          analysisId: source.analysis.analysisId,
          analysisHash,
          promptContextHash,
          reviewId: idGenerator.createId("review"),
          createdAt: clock.now(),
          submission,
          rubric,
        });
        if (!record.ok) return record;
        await repository.saveReview(record.value);
        return record;
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async applyExpertRevision(source, reviewId, parentVersionId) {
      const sourceIssues = validateSource(source, safetyPolicy);
      if (sourceIssues.length > 0) return { ok: false, issues: sourceIssues };
      try {
        const [reviews, versions] = await Promise.all([
          repository.listReviews(source.analysis.analysisId),
          repository.listRevisions(source.analysis.analysisId),
        ]);
        const review = reviews.find((item) => item.reviewId === reviewId);
        if (!review) return failure("REVIEW_NOT_FOUND", "/reviewId", `Review ${reviewId} was not found for this analysis.`);
        if (review.status !== "needs_revision" || review.revisions.length === 0) {
          return failure("INVALID_REVISION", "/reviewId", "Only a needs_revision review with field revisions can create a revised version.");
        }

        const parent = parentVersionId ? versions.find((version) => version.versionId === parentVersionId) : undefined;
        if (parentVersionId && !parent) return failure("INVALID_REVISION", "/parentVersionId", `Revision version ${parentVersionId} was not found.`);
        const baseAnalysis = parent?.analysis ?? source.analysis;
        if (review.analysisHash !== hashCanonicalJson(baseAnalysis)) {
          return failure("REVISION_CONFLICT", "/reviewId", "The review does not target the selected base analysis version.");
        }
        if (review.promptContextHash !== hashCanonicalJson(source.promptContext)) {
          return failure("REVISION_CONFLICT", "/reviewId", "The review does not target the supplied prompt context.");
        }

        const applied = applyFieldRevisions(analysisToHypothesisDraft(baseAnalysis), review.revisions);
        if (!applied.ok) return applied;
        const validated = parseAndValidateHypothesisDraft(applied.value.draft, source.promptContext);
        if (!validated.ok) {
          return {
            ok: false,
            issues: validated.issues.map((item) => ({
              code: "REVISION_VALIDATION_FAILED" as const,
              path: item.path,
              message: `${item.code}: ${item.message}`,
            })),
          };
        }
        const safetyEvaluation = evaluateSafety(safetyPolicy, validated.value, source);
        if (!safetyEvaluation.ok) return safetyEvaluation;
        if (safetyEvaluation.value.decision === "block") {
          return {
            ok: false,
            issues: safetyEvaluation.value.findings.map((finding) => ({
              code: "REVISION_SAFETY_BLOCKED" as const,
              path: finding.path,
              message: `${finding.ruleId}: ${finding.message}`,
            })),
          };
        }

        const revisedAnalysis = rebuildAnalysis(baseAnalysis, validated.value, safetyEvaluation.value);
        const version: RevisedAnalysisVersionV1 = deepFreeze({
          schemaVersion: SANDBOX_REVISED_ANALYSIS_V1,
          versionId: idGenerator.createId("revision"),
          analysisId: source.analysis.analysisId,
          sequence: Math.max(0, ...versions.map((item) => item.sequence)) + 1,
          parentVersionId: parent?.versionId ?? null,
          reviewId: review.reviewId,
          reviewerPseudonym: review.reviewerPseudonym,
          baseAnalysisHash: hashCanonicalJson(baseAnalysis),
          revisedAnalysisHash: hashCanonicalJson(revisedAnalysis),
          appliedRevisions: applied.value.appliedRevisions,
          analysis: revisedAnalysis,
          createdAt: clock.now(),
        });
        await repository.saveRevision(version);
        return { ok: true, value: version };
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async adjudicate(source, submission) {
      const sourceIssues = validateSource(source, safetyPolicy);
      if (sourceIssues.length > 0) return { ok: false, issues: sourceIssues };
      const submissionIssues = validateAdjudicationSubmission(submission);
      if (submissionIssues.length > 0) return { ok: false, issues: submissionIssues };
      try {
        const [allReviews, versions] = await Promise.all([
          repository.listReviews(source.analysis.analysisId),
          repository.listRevisions(source.analysis.analysisId),
        ]);
        const reviewById = new Map(allReviews.map((review) => [review.reviewId, review]));
        const reviews = submission.reviewIds.map((id) => reviewById.get(id));
        const missingIndex = reviews.findIndex((review) => !review);
        if (missingIndex >= 0) return failure("REVIEW_NOT_FOUND", `/reviewIds/${missingIndex}`, `Review ${submission.reviewIds[missingIndex]} was not found.`);
        const selectedReviews = reviews as ExpertReviewRecordV1[];
        const reviewers = new Set(selectedReviews.map((review) => review.reviewerPseudonym));
        if (reviewers.size < rubric.acceptance.minimumIndependentExpertsForGold) {
          return failure("INSUFFICIENT_INDEPENDENT_REVIEWERS", "/reviewIds", `At least ${rubric.acceptance.minimumIndependentExpertsForGold} independent experts are required.`);
        }
        if (reviewers.has(submission.adjudicatorPseudonym.trim())) {
          return failure("INVALID_ADJUDICATION", "/adjudicatorPseudonym", "The adjudicator must be independent from the selected reviewers.");
        }

        const selectedVersion = submission.selectedRevisionVersionId
          ? versions.find((version) => version.versionId === submission.selectedRevisionVersionId)
          : undefined;
        if (submission.selectedRevisionVersionId && !selectedVersion) {
          return failure("INVALID_ADJUDICATION", "/selectedRevisionVersionId", `Revision ${submission.selectedRevisionVersionId} was not found.`);
        }
        const finalAnalysis = selectedVersion?.analysis ?? source.analysis;
        const finalHash = hashCanonicalJson(finalAnalysis);
        const disagreements = detectDisagreements(selectedReviews);
        const goldIneligibilityReasons = determineGoldIneligibility({
          submission,
          reviews: selectedReviews,
          finalAnalysis,
          finalHash,
          promptContextHash: hashCanonicalJson(source.promptContext),
          minimumExperts: rubric.acceptance.minimumIndependentExpertsForGold,
        });
        const record: ReviewAdjudicationRecordV1 = deepFreeze({
          schemaVersion: SANDBOX_REVIEW_ADJUDICATION_V1,
          adjudicationId: idGenerator.createId("adjudication"),
          analysisId: source.analysis.analysisId,
          adjudicatorPseudonym: submission.adjudicatorPseudonym.trim(),
          reviewIds: [...submission.reviewIds],
          status: submission.status,
          selectedRevisionVersionId: selectedVersion?.versionId ?? null,
          finalAnalysisHash: finalHash,
          disagreements,
          goldEligible: goldIneligibilityReasons.length === 0,
          goldIneligibilityReasons,
          rationale: submission.rationale.trim(),
          createdAt: clock.now(),
        });
        await repository.saveAdjudication(record);
        return { ok: true, value: record };
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async exportCaseBundle(source) {
      const sourceIssues = validateSource(source, safetyPolicy);
      if (sourceIssues.length > 0) return { ok: false, issues: sourceIssues };
      try {
        const [reviews, revisionHistory, adjudication] = await Promise.all([
          repository.listReviews(source.analysis.analysisId),
          repository.listRevisions(source.analysis.analysisId),
          repository.getAdjudication(source.analysis.analysisId),
        ]);
        const reasons = adjudication?.goldIneligibilityReasons ?? ["missing_adjudication"];
        const bundle: ReviewCaseBundleV1 = deepFreeze({
          schemaVersion: SANDBOX_REVIEW_CASE_BUNDLE_V1,
          exportId: idGenerator.createId("review-export"),
          analysisId: source.analysis.analysisId,
          exportedAt: clock.now(),
          originalAnalysisHash: hashCanonicalJson(source.analysis),
          originalAnalysis: source.analysis,
          reviews,
          revisionHistory,
          adjudication,
          goldEligibility: {
            eligible: adjudication?.goldEligible ?? false,
            reasons,
          },
        });
        return { ok: true, value: bundle };
      } catch (error) {
        return repositoryFailure(error);
      }
    },
  };
}

function validateSource(source: ReviewAnalysisSourceV1, safetyPolicy: SafetyPolicy): ReviewWorkflowIssue[] {
  const issues: ReviewWorkflowIssue[] = [];
  if (!source?.analysis?.analysisId || source?.promptContext?.sourceSnapshotId !== source?.analysis?.snapshotId) {
    issues.push({ code: "ANALYSIS_MISMATCH", path: "/promptContext/sourceSnapshotId", message: "Prompt context and analysis must reference the same snapshot." });
  }
  if (!source?.analysis?.safetyEvaluation || !["allow", "review"].includes(source?.analysis?.safetyEvaluation?.decision)) {
    issues.push({ code: "ANALYSIS_NOT_REVIEWABLE", path: "/analysis/safetyEvaluation", message: "Phase 5 accepts only Phase 4 safety-evaluated, non-blocked analyses." });
  }
  if (!source?.analysis || !source?.promptContext) return issues;

  const draft = analysisToHypothesisDraft(source.analysis);
  const validated = parseAndValidateHypothesisDraft(draft, source.promptContext);
  if (!validated.ok) {
    validated.issues.forEach((item) => issues.push({
      code: "ANALYSIS_MISMATCH",
      path: item.path,
      message: `Source analysis is inconsistent with its prompt context: ${item.code}: ${item.message}`,
    }));
  } else {
    try {
      const currentSafety = safetyPolicy.evaluate(validated.value, source.promptContext);
      if (!currentSafety || currentSafety.decision === "block" || !Array.isArray(currentSafety.findings)) {
        issues.push({ code: "ANALYSIS_NOT_REVIEWABLE", path: "/analysis/safetyEvaluation", message: "The source analysis does not pass the current Phase 4 safety policy." });
      }
    } catch (error) {
      issues.push({ code: "ANALYSIS_NOT_REVIEWABLE", path: "/analysis/safetyEvaluation", message: `Safety policy failed closed: ${errorMessage(error)}` });
    }
  }
  issues.push(...validateContextConsistency(source));
  return issues;
}

function assertRubric(rubric: ExpertRubricDefinitionV1): void {
  const ids = rubric.dimensions.map((dimension) => dimension.id);
  const weights = rubric.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (
    rubric.totalWeight !== 100
    || weights !== rubric.totalWeight
    || rubric.dimensions.length === 0
    || new Set(ids).size !== ids.length
    || rubric.dimensions.some((dimension) => !dimension.id.trim() || dimension.weight <= 0)
    || rubric.acceptance.minimumWeightedAverage < rubric.scoreRange.min
    || rubric.acceptance.minimumWeightedAverage > rubric.scoreRange.max
    || rubric.acceptance.minimumCriticalDimensionScore < rubric.scoreRange.min
    || rubric.acceptance.minimumCriticalDimensionScore > rubric.scoreRange.max
    || rubric.acceptance.minimumIndependentExpertsForGold < 2
    || new Set(rubric.automaticRejectConditions).size !== rubric.automaticRejectConditions.length
  ) {
    throw new Error("Expert rubric is invalid: weights, dimensions, thresholds, expert minimum and reject conditions must be internally consistent.");
  }
}

function validateContextConsistency(source: ReviewAnalysisSourceV1): ReviewWorkflowIssue[] {
  const issues: ReviewWorkflowIssue[] = [];
  const { analysis, promptContext } = source;
  const contextObjectIds = promptContext.scene.objects.map((object) => object.id);
  if (
    promptContext.scene.objectCount !== analysis.reconstructedScene.objectCount
    || hashCanonicalJson(contextObjectIds) !== hashCanonicalJson(analysis.reconstructedScene.objectIds)
    || promptContext.scene.selectedObjectId !== analysis.reconstructedScene.selectedObjectId
    || hashCanonicalJson(promptContext.scene.occupiedZones) !== hashCanonicalJson(analysis.reconstructedScene.occupiedZones)
  ) {
    issues.push({ code: "ANALYSIS_MISMATCH", path: "/promptContext/scene", message: "Prompt context scene summary does not match the analysis." });
  }
  if (hashCanonicalJson(promptContext.processEvidence) !== hashCanonicalJson(analysis.processEvidence)) {
    issues.push({ code: "ANALYSIS_MISMATCH", path: "/promptContext/processEvidence", message: "Prompt context process evidence does not match the analysis." });
  }

  const allowedIds = [...promptContext.allowedEvidenceIds];
  const contextEvidenceIds = promptContext.evidence.map((item) => item.id);
  if (new Set(allowedIds).size !== allowedIds.length || hashCanonicalJson(allowedIds) !== hashCanonicalJson(contextEvidenceIds)) {
    issues.push({ code: "ANALYSIS_MISMATCH", path: "/promptContext/allowedEvidenceIds", message: "Allowed evidence IDs must exactly match the ordered prompt evidence IDs." });
  }
  const analysisEvidenceById = new Map(analysis.evidence.map((item) => [item.id, item]));
  promptContext.evidence.forEach((item, index) => {
    const expected = analysisEvidenceById.get(item.id);
    if (!expected || expected.layer !== item.layer || expected.kind !== item.kind || expected.description !== item.label || hashCanonicalJson(expected.objectIds) !== hashCanonicalJson(item.objectIds)) {
      issues.push({ code: "ANALYSIS_MISMATCH", path: `/promptContext/evidence/${index}`, message: `Prompt evidence ${item.id} does not match the analysis evidence graph.` });
    }
  });
  const analysisFeaturesById = new Map(analysis.features.map((item) => [item.id, item]));
  promptContext.features.forEach((item, index) => {
    const expected = analysisFeaturesById.get(item.id);
    if (!expected || expected.kind !== item.kind || expected.label !== item.label || expected.fidelity !== item.fidelity || hashCanonicalJson(expected.value) !== hashCanonicalJson(item.value) || hashCanonicalJson(expected.evidenceIds) !== hashCanonicalJson(item.evidenceIds)) {
      issues.push({ code: "ANALYSIS_MISMATCH", path: `/promptContext/features/${index}`, message: `Prompt feature ${item.id} does not match the deterministic analysis feature.` });
    }
  });
  return issues;
}

function validateAdjudicationSubmission(submission: ReviewAdjudicationSubmissionV1): ReviewWorkflowIssue[] {
  const issues: ReviewWorkflowIssue[] = [];
  const adjudicator = submission.adjudicatorPseudonym?.trim();
  if (!adjudicator || adjudicator.length > 128 || adjudicator.includes("@")) {
    issues.push({ code: "INVALID_ADJUDICATION", path: "/adjudicatorPseudonym", message: "Adjudicator must use a non-email pseudonym of 1-128 characters." });
  }
  if (!submission.rationale?.trim()) issues.push({ code: "INVALID_ADJUDICATION", path: "/rationale", message: "Adjudication rationale is required." });
  if (submission.reviewIds.length < 2 || new Set(submission.reviewIds).size !== submission.reviewIds.length) {
    issues.push({ code: "INVALID_ADJUDICATION", path: "/reviewIds", message: "Adjudication requires at least two unique review IDs." });
  }
  return issues;
}

function evaluateSafety(
  policy: SafetyPolicy,
  draft: Parameters<SafetyPolicy["evaluate"]>[0],
  source: ReviewAnalysisSourceV1,
): ReviewWorkflowResult<ReturnType<SafetyPolicy["evaluate"]>> {
  try {
    const report = policy.evaluate(draft, source.promptContext);
    if (!report || !["allow", "review", "block"].includes(report.decision) || !Array.isArray(report.findings)) {
      throw new Error("Safety policy returned an invalid evaluation report.");
    }
    return { ok: true, value: report };
  } catch (error) {
    return failure("REVISION_SAFETY_BLOCKED", "/analysis/safetyEvaluation", `Safety policy failed closed: ${errorMessage(error)}`);
  }
}

function rebuildAnalysis(
  base: SandboxAnalysisResultV1,
  draft: Parameters<SafetyPolicy["evaluate"]>[0],
  safetyEvaluation: ReturnType<SafetyPolicy["evaluate"]>,
): SandboxAnalysisResultV1 {
  const statusById = new Map(base.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis.status]));
  const warnings = [...draft.warnings];
  if (safetyEvaluation.decision === "review" && !warnings.includes(SAFETY_REVIEW_WARNING)) warnings.push(SAFETY_REVIEW_WARNING);
  return deepFreeze({
    ...base,
    hypotheses: draft.hypotheses.map((hypothesis) => ({
      ...hypothesis,
      status: statusById.get(hypothesis.id) ?? "candidate",
      supportingEvidenceIds: [...hypothesis.supportingEvidenceIds],
      contradictingEvidenceIds: [...hypothesis.contradictingEvidenceIds],
      alternativeExplanations: [...hypothesis.alternativeExplanations],
      questionsToVerify: [...hypothesis.questionsToVerify],
    })),
    interviewQuestions: draft.interviewQuestions.map((question) => ({
      ...question,
      evidenceIds: [...question.evidenceIds],
      hypothesisIds: [...question.hypothesisIds],
    })),
    warnings,
    safetyEvaluation,
  });
}

function detectDisagreements(reviews: readonly ExpertReviewRecordV1[]): readonly ReviewDisagreementV1[] {
  const disagreements: ReviewDisagreementV1[] = [];
  if (new Set(reviews.map((review) => review.status)).size > 1) {
    disagreements.push({ kind: "status", reviewIds: reviews.map((review) => review.reviewId), detail: "Experts assigned different review statuses." });
  }
  const dimensionIds = [...new Set(reviews.flatMap((review) => review.scores.map((score) => score.dimensionId)))].sort(compareStrings);
  dimensionIds.forEach((dimensionId) => {
    const scored = reviews.map((review) => ({ reviewId: review.reviewId, score: review.scores.find((item) => item.dimensionId === dimensionId)?.score }));
    const numericScores = scored.flatMap((item) => item.score === undefined ? [] : [item.score]);
    if (numericScores.length > 1 && Math.max(...numericScores) - Math.min(...numericScores) >= 2) {
      disagreements.push({ kind: "dimension_score", dimensionId, reviewIds: scored.map((item) => item.reviewId), detail: `Dimension ${dimensionId} differs by at least two points.` });
    }
  });
  const revisionSignatures = new Set(reviews.map((review) => hashCanonicalJson(review.revisions)));
  if (revisionSignatures.size > 1 && reviews.some((review) => review.revisions.length > 0)) {
    disagreements.push({ kind: "revision", reviewIds: reviews.map((review) => review.reviewId), detail: "Experts proposed different field revisions." });
  }
  return deepFreeze(disagreements);
}

function determineGoldIneligibility(input: {
  readonly submission: ReviewAdjudicationSubmissionV1;
  readonly reviews: readonly ExpertReviewRecordV1[];
  readonly finalAnalysis: SandboxAnalysisResultV1;
  readonly finalHash: string;
  readonly promptContextHash: string;
  readonly minimumExperts: number;
}): string[] {
  const reasons: string[] = [];
  if (input.submission.status !== "accepted") reasons.push("adjudication_not_accepted");
  if (new Set(input.reviews.map((review) => review.reviewerPseudonym)).size < input.minimumExperts) reasons.push("insufficient_independent_reviewers");
  if (input.reviews.some((review) => review.status !== "accepted")) reasons.push("selected_review_not_accepted");
  if (input.reviews.some((review) => review.automaticRejectConditions.length > 0)) reasons.push("automatic_reject_present");
  if (input.reviews.some((review) => review.analysisHash !== input.finalHash)) reasons.push("review_does_not_match_final_analysis");
  if (input.reviews.some((review) => review.promptContextHash !== input.promptContextHash)) reasons.push("review_does_not_match_prompt_context");
  if (!input.finalAnalysis.safetyEvaluation) reasons.push("missing_safety_evaluation");
  else if (input.finalAnalysis.safetyEvaluation.decision === "block") reasons.push("safety_blocked");
  return [...new Set(reasons)].sort(compareStrings);
}

function failure<T>(code: ReviewWorkflowIssue["code"], path: string, message: string): ReviewWorkflowResult<T> {
  return { ok: false, issues: [{ code, path, message }] };
}

function repositoryFailure(error: unknown): ReviewWorkflowResult<never> {
  return failure("REPOSITORY_ERROR", "/repository", errorMessage(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
