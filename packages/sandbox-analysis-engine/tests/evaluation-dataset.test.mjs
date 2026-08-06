import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPERT_RUBRIC_V1,
  InMemoryEvaluationDatasetRepository,
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  computeEvaluationDatasetHash,
  createBenchmarkRunner,
  createEvaluationDatasetService,
  createExpertReviewWorkflow,
  createSandboxHypothesisAnalyzer,
  hashCanonicalJson,
} from "../dist/index.js";
import { createObject, createSnapshot } from "./fixtures.mjs";

const FEATURE_SPATIAL = "feature:scene:spatial-distribution";
const FEATURE_CATEGORY = "feature:scene:category-distribution";

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
      explanation: "多个类别共同出现，可作为询问作品组织方式的候选线索。",
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

function oneCasePlan(cohort = "sparse_relations", partition = "test") {
  return {
    totalCases: 1,
    partitions: { train: partition === "train" ? 1 : 0, dev: partition === "dev" ? 1 : 0, test: partition === "test" ? 1 : 0 },
    cohorts: {
      empty_and_minimal: cohort === "empty_and_minimal" ? 1 : 0,
      sparse_relations: cohort === "sparse_relations" ? 1 : 0,
      dense_complex: cohort === "dense_complex" ? 1 : 0,
      center_boundary_composition: cohort === "center_boundary_composition" ? 1 : 0,
      symbolic_ambiguity: cohort === "symbolic_ambiguity" ? 1 : 0,
      schema_edge_cases: cohort === "schema_edge_cases" ? 1 : 0,
      safety_adversarial: cohort === "safety_adversarial" ? 1 : 0,
    },
  };
}

function expertScores(value = 5) {
  return EXPERT_RUBRIC_V1.dimensions.map((dimension) => ({
    dimensionId: dimension.id,
    score: value,
    comment: `${dimension.label}复核完成。`,
  }));
}

async function createGoldFixture(suffix = "a", overrides = {}) {
  const snapshot = createSnapshot([
    createObject({ id: `child-${suffix}`, name: "儿童", xNorm: 0.5, yNorm: 0.5 }),
    createObject({ id: `tree-${suffix}`, name: "树", category: "自然", xNorm: 0.25, yNorm: 0.45 }),
  ], { snapshotId: `snapshot-phase-6-${suffix}` });
  let analysisId = 0;
  const analyzer = createSandboxHypothesisAnalyzer({
    llm: { async generateStructured() { return { content: draft(), provider: "mock", model: "mock-v1" }; } },
    clock: { now: () => "2026-08-06T01:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-${suffix}-${++analysisId}` },
  });
  const analysisResult = await analyzer.analyze(snapshot);
  assert.equal(analysisResult.ok, true);
  const source = { analysis: analysisResult.value, promptContext: analysisResult.promptContext };
  let workflowId = 0;
  const workflow = createExpertReviewWorkflow({
    clock: { now: () => "2026-08-06T02:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-${suffix}-${++workflowId}` },
  });
  const submit = async (reviewerPseudonym) => workflow.submitExpertReview(source, {
    reviewerPseudonym,
    scores: expertScores(),
    automaticRejectConditions: [],
    recommendation: "accepted",
    summary: "盲法复核完成，场景、证据、措辞和安全边界均符合要求。",
    revisions: [],
  });
  const reviewA = await submit(`expert-${suffix}-a`);
  const reviewB = await submit(`expert-${suffix}-b`);
  assert.equal(reviewA.ok && reviewB.ok, true);
  const adjudication = await workflow.adjudicate(source, {
    adjudicatorPseudonym: `expert-${suffix}-c`,
    reviewIds: [reviewA.value.reviewId, reviewB.value.reviewId],
    status: "accepted",
    rationale: "两位独立专家均接受同一分析版本。",
  });
  assert.equal(adjudication.ok, true);
  const bundle = await workflow.exportCaseBundle(source);
  assert.equal(bundle.ok, true);
  const snapshotHash = hashCanonicalJson(snapshot);
  return {
    source,
    candidate: {
      caseId: `case-${suffix}`,
      sourceGroupId: overrides.sourceGroupId ?? `source-group-${suffix}`,
      cohort: overrides.cohort ?? "sparse_relations",
      partition: overrides.partition ?? "test",
      tier: overrides.tier ?? "gold",
      challengeTags: overrides.challengeTags ?? ["baseline"],
      snapshot,
      reviewBundle: bundle.value,
      governance: {
        sourceKind: overrides.sourceKind ?? "synthetic",
        sourceRecordPseudonym: `source-${suffix}`,
        deidentified: true,
        directIdentityPresent: false,
        consentRecordId: overrides.consentRecordId ?? null,
        ethicsApprovalId: overrides.ethicsApprovalId ?? null,
        allowedPurposes: ["evaluation"],
        trainingUseAllowed: false,
        revocationSnapshotHash: snapshotHash,
        retentionUntil: null,
      },
    },
  };
}

function datasetService(repository = new InMemoryEvaluationDatasetRepository()) {
  let id = 0;
  return createEvaluationDatasetService({
    repository,
    clock: { now: () => "2026-08-06T03:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-test-${++id}` },
  });
}

async function frozenDataset(suffix = "benchmark") {
  const fixture = await createGoldFixture(suffix);
  const service = datasetService();
  assert.equal((await service.admitCase(fixture.candidate)).ok, true);
  const built = await service.buildDataset({
    datasetId: "phase-6-benchmark",
    datasetVersion: "1.0.0",
    targetPlan: oneCasePlan(),
    freeze: true,
  });
  assert.equal(built.ok, true);
  return { fixture, dataset: built.value, service };
}

test("admits only immutable expert-adjudicated cases bound to the exact snapshot", async () => {
  const fixture = await createGoldFixture("admit");
  const result = await datasetService().admitCase(fixture.candidate);
  assert.equal(result.ok, true);
  assert.equal(result.value.snapshotHash, hashCanonicalJson(fixture.candidate.snapshot));
  assert.equal(result.value.finalAnalysisHash, result.value.reviewBundle.adjudication.finalAnalysisHash);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(result.value.governance.trainingUseAllowed, false);
});

test("rejects non-gold bundles, altered snapshots and mismatched revocation hashes", async () => {
  const fixture = await createGoldFixture("tamper");
  const nonGold = structuredClone(fixture.candidate);
  nonGold.reviewBundle.goldEligibility.eligible = false;
  assert.equal((await datasetService().admitCase(nonGold)).issues[0].code, "GOLD_ADJUDICATION_REQUIRED");

  const tampered = structuredClone(fixture.candidate);
  tampered.snapshot.environment.weather = "rainy";
  const result = await datasetService().admitCase(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((item) => item.code === "SNAPSHOT_HASH_MISMATCH"), true);
});

test("blocks direct identity, token-like secrets and real cases without consent governance", async () => {
  const fixture = await createGoldFixture("privacy");
  const leaked = structuredClone(fixture.candidate);
  leaked.directIdentity = "person@example.com";
  leaked.secret = "sk-this-is-a-secret-key";
  const privacy = await datasetService().admitCase(leaked);
  assert.equal(privacy.ok, false);
  assert.equal(privacy.issues.filter((item) => item.code === "PRIVACY_SCAN_FAILED").length >= 2, true);

  const real = structuredClone(fixture.candidate);
  real.governance.sourceKind = "deidentified_real";
  const governance = await datasetService().admitCase(real);
  assert.equal(governance.ok, false);
  assert.equal(governance.issues.some((item) => item.code === "INVALID_GOVERNANCE"), true);
});

test("prevents duplicate cases and source-group leakage across partitions", async () => {
  const first = await createGoldFixture("group-a", { sourceGroupId: "family-cluster-1", partition: "train" });
  const second = await createGoldFixture("group-b", { sourceGroupId: "family-cluster-1", partition: "test" });
  const service = datasetService();
  assert.equal((await service.admitCase(first.candidate)).ok, true);
  assert.equal((await service.admitCase(first.candidate)).issues[0].code, "DUPLICATE_CASE");
  const leakage = await service.admitCase(second.candidate);
  assert.equal(leakage.ok, false);
  assert.equal(leakage.issues.some((item) => item.code === "PARTITION_LEAKAGE"), true, JSON.stringify(leakage.issues));
});

test("reports collection gaps and freezes only a target-complete dataset", async () => {
  const fixture = await createGoldFixture("freeze");
  const service = datasetService();
  assert.equal((await service.admitCase(fixture.candidate)).ok, true);
  const partial = await service.buildDataset({ datasetId: "phase-6", datasetVersion: "0.1", targetPlan: { ...oneCasePlan(), totalCases: 2, partitions: { train: 0, dev: 0, test: 2 }, cohorts: { ...oneCasePlan().cohorts, sparse_relations: 2 } }, freeze: false });
  assert.equal(partial.ok, true);
  assert.equal(partial.value.manifest.status, "collection_required");
  const invalidFreeze = await service.buildDataset({ datasetId: "phase-6", datasetVersion: "0.1", targetPlan: partial.value.manifest.targetPlan, freeze: true });
  assert.equal(invalidFreeze.ok, false);
  assert.equal(invalidFreeze.issues[0].code, "DATASET_INCOMPLETE");
  const frozen = await service.buildDataset({ datasetId: "phase-6", datasetVersion: "1.0", targetPlan: oneCasePlan(), freeze: true });
  assert.equal(frozen.ok, true);
  assert.equal(frozen.value.manifest.status, "frozen");
  assert.equal((await service.admitCase(await createGoldFixture("late").then((value) => value.candidate))).issues[0].code, "DATASET_FROZEN");
});

test("honors snapshot-hash revocation even after freeze and records a tombstone", async () => {
  const { fixture, service } = await frozenDataset("revoke");
  const revoked = await service.revokeBySnapshotHash(hashCanonicalJson(fixture.candidate.snapshot), "privacy-officer", "Consent withdrawn.");
  assert.equal(revoked.ok, true);
  assert.deepEqual(revoked.value.removedCaseIds, [fixture.candidate.caseId]);
  const tombstones = await service.listRevocations();
  assert.equal(tombstones.ok, true);
  assert.equal(tombstones.value.length, 1);
  const rebuilt = await service.buildDataset({ datasetId: "phase-6-benchmark", datasetVersion: "1.0.1", targetPlan: oneCasePlan(), freeze: false });
  assert.equal(rebuilt.value.manifest.status, "collection_required");
});

test("keeps dataset hashes deterministic and independent from build timestamps", async () => {
  const fixture = await createGoldFixture("hash");
  const service = datasetService();
  await service.admitCase(fixture.candidate);
  const request = { datasetId: "stable", datasetVersion: "1", targetPlan: oneCasePlan(), freeze: false };
  const first = await service.buildDataset(request);
  const second = await service.buildDataset(request);
  assert.equal(first.value.manifest.datasetHash, second.value.manifest.datasetHash);
  assert.equal(first.value.manifest.datasetHash, computeEvaluationDatasetHash({ datasetId: "stable", datasetVersion: "1", targetPlan: oneCasePlan(), cases: first.value.manifest.cases }));
});

test("runs a blind model subject without exposing review bundles or final analyses", async () => {
  const { fixture, dataset } = await frozenDataset("blind");
  let observedInput;
  const runner = createBenchmarkRunner({ clock: { now: () => "2026-08-06T04:00:00.000Z" }, idGenerator: { createId: () => "model-run-blind" } });
  const result = await runner.run(dataset, {
    identity: { provider: "mock", model: "exact", modelVersion: "1", adapterVersion: "1", promptVersion: "1", knowledgeBaseVersion: null },
    async analyze(input) { observedInput = input; return fixture.source; },
  }, "seed-42");
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(observedInput).sort(), ["caseId", "partition", "runSeed", "snapshot"]);
  assert.equal("finalAnalysis" in observedInput, false);
  assert.deepEqual(result.value.caseResults[0].metrics, {
    snapshotBinding: 1,
    sceneReconstructionExact: 1,
    deterministicFeaturesExact: 1,
    evidenceTraceabilityRate: 1,
    interviewQuestionValidityRate: 1,
    safetyPass: 1,
    automatedPsychologicalCorrectness: null,
  });
});

test("records model failures and scores invalid engineering output without scoring psychological truth", async () => {
  const { fixture, dataset } = await frozenDataset("metrics");
  const runner = createBenchmarkRunner();
  const failed = await runner.run(dataset, {
    identity: { provider: "mock", model: "failure", modelVersion: "1", adapterVersion: "1", promptVersion: "1", knowledgeBaseVersion: null },
    async analyze() { throw new Error("provider unavailable"); },
  }, "seed");
  assert.equal(failed.value.caseResults[0].status, "failed");
  assert.match(failed.value.caseResults[0].errors[0], /unavailable/);

  const brokenSource = structuredClone(fixture.source);
  brokenSource.analysis.reconstructedScene.objectCount = 999;
  brokenSource.analysis.features = [];
  brokenSource.analysis.evidence = [];
  delete brokenSource.analysis.safetyEvaluation;
  const scored = await runner.run(dataset, {
    identity: { provider: "mock", model: "broken", modelVersion: "1", adapterVersion: "1", promptVersion: "1", knowledgeBaseVersion: null },
    async analyze() { return brokenSource; },
  }, "seed");
  const metrics = scored.value.caseResults[0].metrics;
  assert.equal(metrics.sceneReconstructionExact, 0);
  assert.equal(metrics.deterministicFeaturesExact, 0);
  assert.equal(metrics.evidenceTraceabilityRate, 0);
  assert.equal(metrics.safetyPass, 0);
  assert.equal(metrics.automatedPsychologicalCorrectness, null);
});

test("creates a reproducible benchmark ranking and expert agreement report", async () => {
  const { fixture, dataset } = await frozenDataset("report");
  let id = 0;
  const runner = createBenchmarkRunner({ clock: { now: () => "2026-08-06T05:00:00.000Z" }, idGenerator: { createId: (prefix) => `${prefix}-${++id}` } });
  const identity = (model) => ({ provider: "mock", model, modelVersion: "1", adapterVersion: "1", promptVersion: "1", knowledgeBaseVersion: null });
  const good = await runner.run(dataset, { identity: identity("good"), async analyze() { return fixture.source; } }, "seed");
  const badSource = structuredClone(fixture.source);
  badSource.analysis.reconstructedScene.objectCount = 100;
  badSource.analysis.features = [];
  const bad = await runner.run(dataset, { identity: identity("bad"), async analyze() { return badSource; } }, "seed");
  const report = runner.createReport(dataset, [bad.value, good.value]);
  assert.equal(report.ok, true);
  assert.equal(report.value.runs[0].model.model, "good");
  assert.equal(report.value.runs[0].rank, 1);
  assert.equal(report.value.expertAgreement.casesWithIndependentRatings, 1);
  assert.equal(report.value.expertAgreement.overall.exactAgreementRate, 1);
  assert.equal(report.value.expertAgreement.overall.quadraticWeightedKappa, 1);
  assert.match(report.value.limitations[1], /psychological_quality/);
});

test("rejects unfrozen, tampered and incompatible evaluation inputs", async () => {
  const fixture = await createGoldFixture("reject-run");
  const service = datasetService();
  await service.admitCase(fixture.candidate);
  const ready = await service.buildDataset({ datasetId: "ready", datasetVersion: "1", targetPlan: oneCasePlan(), freeze: false });
  const runner = createBenchmarkRunner();
  const subject = { identity: { provider: "mock", model: "m", modelVersion: "1", adapterVersion: "1", promptVersion: "1", knowledgeBaseVersion: null }, async analyze() { return fixture.source; } };
  assert.equal((await runner.run(ready.value, subject, "seed")).issues[0].code, "DATASET_NOT_FROZEN");

  const { dataset } = await frozenDataset("tampered-dataset");
  const tampered = structuredClone(dataset);
  tampered.manifest.datasetHash = "0".repeat(64);
  assert.equal((await runner.run(tampered, subject, "seed")).issues[0].code, "DATASET_HASH_MISMATCH");
  const good = await runner.run(dataset, subject, "seed");
  const incompatible = structuredClone(good.value);
  incompatible.datasetHash = "1".repeat(64);
  assert.equal(runner.createReport(dataset, [incompatible]).issues[0].code, "INCOMPATIBLE_RUNS");
});

test("maps dataset repository failures to a stable error", async () => {
  const fixture = await createGoldFixture("repository");
  const broken = {
    async saveCase() {},
    async listCases() { throw new Error("database unavailable"); },
    async removeCasesBySnapshotHash() { return []; },
    async saveRevocation() {},
    async listRevocations() { return []; },
  };
  const result = await datasetService(broken).admitCase(fixture.candidate);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, "REPOSITORY_ERROR");
  assert.match(result.issues[0].message, /database unavailable/);
});
