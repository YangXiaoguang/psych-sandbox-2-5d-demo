import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPERT_RUBRIC_V1,
  InMemoryReviewRepository,
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  createExpertReviewRecord,
  createExpertReviewWorkflow,
  createSandboxHypothesisAnalyzer,
  hashCanonicalJson,
} from "../dist/index.js";
import { createObject, createSnapshot } from "./fixtures.mjs";

const FEATURE_SPATIAL = "feature:scene:spatial-distribution";
const FEATURE_CATEGORY = "feature:scene:category-distribution";

function snapshot() {
  return createSnapshot([
    createObject({ id: "child", name: "儿童", category: "人物", xNorm: 0.5, yNorm: 0.5 }),
    createObject({ id: "tree", name: "树", category: "自然", xNorm: 0.25, yNorm: 0.45 }),
    createObject({ id: "house", name: "房子", category: "建筑", xNorm: 0.74, yNorm: 0.32 }),
  ], { snapshotId: "snapshot-review-phase-5" });
}

function draft() {
  return {
    schemaVersion: SANDBOX_HYPOTHESIS_DRAFT_V1,
    hypotheses: [{
      id: "hypothesis-organization",
      label: "围绕作品组织方式的探索线索",
      confidence: 0.58,
      confidenceLevel: "medium",
      supportingEvidenceIds: [FEATURE_SPATIAL, FEATURE_CATEGORY],
      contradictingEvidenceIds: [],
      alternativeExplanations: ["当前布局也可能只是为了让不同沙具清晰可见。"],
      explanation: "多个类别共同出现且主体接近中心，可作为询问作品组织方式的候选线索。",
      questionsToVerify: ["当你看向沙盘中心时，最先注意到什么？"],
      interpretiveLimit: "这是构图层面的候选主题，需要用户确认。",
    }],
    interviewQuestions: [{
      id: "question-center",
      text: "当你看向这个作品时，哪个部分最想让人先看到？",
      intent: "核实中心构图对创作者本人的意义。",
      leading: false,
      evidenceIds: [FEATURE_SPATIAL],
      hypothesisIds: ["hypothesis-organization"],
    }],
    warnings: [],
  };
}

async function source() {
  let id = 0;
  const analyzer = createSandboxHypothesisAnalyzer({
    llm: { async generateStructured() { return { content: draft(), provider: "mock", model: "mock-v1" }; } },
    clock: { now: () => "2026-08-05T14:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-source-${++id}` },
  });
  const result = await analyzer.analyze(snapshot());
  assert.equal(result.ok, true);
  return { analysis: result.value, promptContext: result.promptContext };
}

function scores(value = 5, overrides = {}) {
  return EXPERT_RUBRIC_V1.dimensions.map((dimension) => ({
    dimensionId: dimension.id,
    score: overrides[dimension.id] ?? value,
    comment: `${dimension.label}复核完成。`,
  }));
}

function submission(reviewerPseudonym, overrides = {}) {
  return {
    reviewerPseudonym,
    scores: scores(5),
    automaticRejectConditions: [],
    recommendation: "accepted",
    summary: "场景、证据与访谈问题均已逐项复核。",
    revisions: [],
    ...overrides,
  };
}

function workflow(repository = new InMemoryReviewRepository()) {
  let id = 0;
  return createExpertReviewWorkflow({
    repository,
    clock: { now: () => "2026-08-05T15:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-test-${++id}` },
  });
}

test("computes rubric status in the trusted core instead of accepting a claimed status", () => {
  const result = createExpertReviewRecord({
    analysisId: "analysis-1",
    analysisHash: "a".repeat(64),
    promptContextHash: "b".repeat(64),
    reviewId: "review-1",
    createdAt: "2026-08-05T15:00:00.000Z",
    submission: submission("expert-a", { scores: scores(3), recommendation: "accepted" }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.weightedAverage, 3);
  assert.equal(result.value.status, "needs_revision");
  assert.equal(Object.isFrozen(result.value.scores), true);
});

test("validates every rubric dimension, reviewer pseudonyms and automatic rejection conditions", () => {
  const result = createExpertReviewRecord({
    analysisId: "analysis-1",
    analysisHash: "b".repeat(64),
    promptContextHash: "c".repeat(64),
    reviewId: "review-1",
    createdAt: "2026-08-05T15:00:00.000Z",
    submission: submission("expert@example.com", {
      scores: scores(5).slice(1),
      automaticRejectConditions: ["not-a-condition"],
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === "INVALID_REVIEWER"), true);
  assert.equal(result.issues.some((issue) => issue.code === "INVALID_RUBRIC_SCORE"), true);
  assert.equal(result.issues.some((issue) => issue.code === "INVALID_AUTOMATIC_REJECT"), true);
});

test("binds an expert review to one exact analysis hash and rejects duplicate independent reviews", async () => {
  const input = await source();
  const service = workflow();
  const first = await service.submitExpertReview(input, submission("expert-a"));
  assert.equal(first.ok, true);
  assert.equal(first.value.analysisHash, hashCanonicalJson(input.analysis));
  assert.equal(first.value.promptContextHash, hashCanonicalJson(input.promptContext));
  const duplicate = await service.submitExpertReview(input, submission("expert-a"));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.issues[0].code, "INVALID_REVIEWER");
});

test("rejects prompt contexts whose evidence or deterministic features were altered", async () => {
  const input = await source();
  const promptContext = structuredClone(input.promptContext);
  promptContext.features[0].value = "tampered";
  const result = await workflow().submitExpertReview({ analysis: input.analysis, promptContext }, submission("expert-a"));
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === "ANALYSIS_MISMATCH" && issue.path.startsWith("/promptContext/features/")), true);
});

test("does not permit expert revisions to rewrite deterministic facts or features", async () => {
  const input = await source();
  const result = await workflow().submitExpertReview(input, submission("expert-a", {
    recommendation: "needs_revision",
    revisions: [{ path: "/features/0/value", operation: "replace", proposedValue: 99, reason: "尝试改写特征" }],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === "INVALID_REVISION"), true);
});

test("applies a safe field revision without mutating the original analysis", async () => {
  const input = await source();
  const originalHash = hashCanonicalJson(input.analysis);
  const originalFeaturesHash = hashCanonicalJson(input.analysis.features);
  const service = workflow();
  const review = await service.submitExpertReview(input, submission("expert-a", {
    recommendation: "needs_revision",
    revisions: [{
      path: "/hypotheses/0/explanation",
      operation: "replace",
      previousValue: input.analysis.hypotheses[0].explanation,
      proposedValue: "多个类别共同出现，可先邀请创作者描述其个人组织逻辑，不预设象征含义。",
      reason: "进一步降低解释确定性。",
    }],
  }));
  assert.equal(review.ok, true);
  assert.equal(review.value.status, "needs_revision");

  const revised = await service.applyExpertRevision(input, review.value.reviewId);
  assert.equal(revised.ok, true);
  assert.equal(revised.value.analysis.hypotheses[0].explanation.includes("不预设"), true);
  assert.equal(revised.value.baseAnalysisHash, originalHash);
  assert.notEqual(revised.value.revisedAnalysisHash, originalHash);
  assert.equal(hashCanonicalJson(revised.value.analysis.features), originalFeaturesHash);
  assert.equal(hashCanonicalJson(input.analysis), originalHash);
  assert.equal(Object.isFrozen(revised.value.analysis), true);
});

test("rejects stale, unknown-evidence and unsafe revisions", async () => {
  const input = await source();

  const staleService = workflow();
  const staleReview = await staleService.submitExpertReview(input, submission("expert-stale", {
    recommendation: "needs_revision",
    revisions: [{ path: "/hypotheses/0/label", operation: "replace", previousValue: "旧标题", proposedValue: "新标题", reason: "标题修订" }],
  }));
  const stale = await staleService.applyExpertRevision(input, staleReview.value.reviewId);
  assert.equal(stale.ok, false);
  assert.equal(stale.issues[0].code, "REVISION_CONFLICT");

  const evidenceService = workflow();
  const evidenceReview = await evidenceService.submitExpertReview(input, submission("expert-evidence", {
    recommendation: "needs_revision",
    revisions: [{ path: "/hypotheses/0/supportingEvidenceIds/0", operation: "replace", proposedValue: "fact:missing", reason: "错误证据" }],
  }));
  const evidence = await evidenceService.applyExpertRevision(input, evidenceReview.value.reviewId);
  assert.equal(evidence.ok, false);
  assert.equal(evidence.issues.some((issue) => issue.code === "REVISION_VALIDATION_FAILED"), true);

  const unsafeService = workflow();
  const unsafeReview = await unsafeService.submitExpertReview(input, submission("expert-unsafe", {
    recommendation: "needs_revision",
    revisions: [{ path: "/hypotheses/0/explanation", operation: "replace", proposedValue: "这个布局证明用户患有焦虑症。", reason: "不安全修订" }],
  }));
  const unsafe = await unsafeService.applyExpertRevision(input, unsafeReview.value.reviewId);
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.issues.some((issue) => issue.code === "REVISION_VALIDATION_FAILED" || issue.code === "REVISION_SAFETY_BLOCKED"), true);
});

test("requires two independent accepted reviews before an adjudicated version becomes gold", async () => {
  const input = await source();
  const service = workflow();
  const reviewA = await service.submitExpertReview(input, submission("expert-a"));
  const reviewB = await service.submitExpertReview(input, submission("expert-b"));
  assert.equal(reviewA.ok && reviewB.ok, true);

  const adjudication = await service.adjudicate(input, {
    adjudicatorPseudonym: "expert-c",
    reviewIds: [reviewA.value.reviewId, reviewB.value.reviewId],
    status: "accepted",
    rationale: "两位独立专家均确认该版本满足量表与安全要求。",
  });
  assert.equal(adjudication.ok, true);
  assert.equal(adjudication.value.goldEligible, true);
  assert.deepEqual(adjudication.value.goldIneligibilityReasons, []);

  const bundle = await service.exportCaseBundle(input);
  assert.equal(bundle.ok, true);
  assert.equal(bundle.value.goldEligibility.eligible, true);
  assert.equal(bundle.value.reviews.length, 2);
  assert.equal(Object.isFrozen(bundle.value.reviews), true);
});

test("records disagreements but never promotes rejected or mismatched reviews to gold", async () => {
  const input = await source();
  const service = workflow();
  const accepted = await service.submitExpertReview(input, submission("expert-a"));
  const rejected = await service.submitExpertReview(input, submission("expert-b", {
    scores: scores(5, { safety: 1 }),
    recommendation: "rejected",
    automaticRejectConditions: ["diagnostic_claim"],
  }));
  const adjudication = await service.adjudicate(input, {
    adjudicatorPseudonym: "expert-c",
    reviewIds: [accepted.value.reviewId, rejected.value.reviewId],
    status: "accepted",
    rationale: "保留分歧供研究，不作为金标准。",
  });
  assert.equal(adjudication.ok, true);
  assert.equal(adjudication.value.goldEligible, false);
  assert.equal(adjudication.value.goldIneligibilityReasons.includes("selected_review_not_accepted"), true);
  assert.equal(adjudication.value.goldIneligibilityReasons.includes("automatic_reject_present"), true);
  assert.equal(adjudication.value.disagreements.some((item) => item.kind === "status"), true);
  assert.equal(adjudication.value.disagreements.some((item) => item.kind === "dimension_score" && item.dimensionId === "safety"), true);
});

test("supports revision re-review while requiring accepted reviews to match the selected final hash", async () => {
  const original = await source();
  const service = workflow();
  const revisionReview = await service.submitExpertReview(original, submission("expert-editor", {
    recommendation: "needs_revision",
    revisions: [{
      path: "/interviewQuestions/0/text",
      operation: "replace",
      proposedValue: "如果愿意，你会从作品的哪个部分开始介绍？",
      reason: "把问题调整得更开放。",
    }],
  }));
  const revised = await service.applyExpertRevision(original, revisionReview.value.reviewId);
  assert.equal(revised.ok, true);
  const revisedSource = { analysis: revised.value.analysis, promptContext: original.promptContext };
  const reviewA = await service.submitExpertReview(revisedSource, submission("expert-a"));
  const reviewB = await service.submitExpertReview(revisedSource, submission("expert-b"));
  const adjudication = await service.adjudicate(original, {
    adjudicatorPseudonym: "expert-c",
    reviewIds: [reviewA.value.reviewId, reviewB.value.reviewId],
    status: "accepted",
    selectedRevisionVersionId: revised.value.versionId,
    rationale: "修订稿经两名独立专家复核后接受。",
  });
  assert.equal(adjudication.ok, true);
  assert.equal(adjudication.value.goldEligible, true);
  assert.equal(adjudication.value.finalAnalysisHash, revised.value.revisedAnalysisHash);
});

test("enforces independent adjudication and reports missing adjudication on export", async () => {
  const input = await source();
  const service = workflow();
  const reviewA = await service.submitExpertReview(input, submission("expert-a"));
  const reviewB = await service.submitExpertReview(input, submission("expert-b"));
  const invalid = await service.adjudicate(input, {
    adjudicatorPseudonym: "expert-a",
    reviewIds: [reviewA.value.reviewId, reviewB.value.reviewId],
    status: "accepted",
    rationale: "不独立的仲裁。",
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.issues[0].code, "INVALID_ADJUDICATION");

  const fresh = await workflow().exportCaseBundle(input);
  assert.equal(fresh.ok, true);
  assert.deepEqual(fresh.value.goldEligibility.reasons, ["missing_adjudication"]);
});

test("rejects historical analyses without a Phase 4 safety report", async () => {
  const generated = await source();
  const analysis = structuredClone(generated.analysis);
  delete analysis.safetyEvaluation;
  const result = await workflow().submitExpertReview({ analysis, promptContext: generated.promptContext }, submission("expert-a"));
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === "ANALYSIS_NOT_REVIEWABLE"), true);
});

test("maps repository failures to a stable workflow error", async () => {
  const input = await source();
  const broken = {
    async saveReview() {},
    async listReviews() { throw new Error("database unavailable"); },
    async saveRevision() {},
    async listRevisions() { return []; },
    async saveAdjudication() {},
    async getAdjudication() { return null; },
  };
  const result = await workflow(broken).submitExpertReview(input, submission("expert-a"));
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "REPOSITORY_ERROR");
  assert.match(result.issues[0].message, /database unavailable/);
});

test("rejects an internally inconsistent custom rubric at construction", () => {
  const invalidRubric = structuredClone(EXPERT_RUBRIC_V1);
  invalidRubric.dimensions[0].weight = 99;
  assert.throws(() => createExpertReviewWorkflow({ rubric: invalidRubric }), /rubric is invalid/i);
});
