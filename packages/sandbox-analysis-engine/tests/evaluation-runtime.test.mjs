import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPERT_RUBRIC_V1,
  InMemoryEvaluationRuntimeRepository,
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  createEvaluationDatasetService,
  createEvaluationJobOrchestrator,
  createExperimentAuditService,
  createExpertReviewWorkflow,
  createSandboxHypothesisAnalyzer,
  hashCanonicalJson,
} from "../dist/index.js";
import { createObject, createSnapshot } from "./fixtures.mjs";

const MODEL = {
  provider: "mock",
  model: "runtime-exact",
  modelVersion: "1",
  adapterVersion: "1",
  promptVersion: "1",
  knowledgeBaseVersion: null,
};

function deterministicAdapters(prefix = "runtime") {
  let id = 0;
  let tick = 0;
  return {
    clock: { now: () => new Date(Date.UTC(2026, 7, 6, 5, 0, tick++)).toISOString() },
    idGenerator: { createId: (kind) => `${kind}-${prefix}-${++id}` },
  };
}

function jobRequest(dataset, overrides = {}) {
  return {
    idempotencyKey: overrides.idempotencyKey ?? "phase-7-runtime-job",
    dataset: {
      datasetId: dataset.manifest.datasetId,
      datasetVersion: dataset.manifest.datasetVersion,
      datasetHash: dataset.manifest.datasetHash,
      caseCount: dataset.cases.length,
    },
    model: overrides.model ?? MODEL,
    runSeed: "phase-7-seed",
    maxAttempts: overrides.maxAttempts ?? 2,
    acceptance: { minimumCompletionRate: overrides.minimumCompletionRate ?? 1 },
    labels: overrides.labels ?? { environment: "test", purpose: "benchmark" },
  };
}

test("submits idempotently and rejects key reuse or sensitive labels", async () => {
  const { dataset } = await frozenFixture("idempotent");
  const repository = new InMemoryEvaluationRuntimeRepository();
  const orchestrator = createEvaluationJobOrchestrator({ repository, ...deterministicAdapters("submit") });
  const first = await orchestrator.submit(jobRequest(dataset));
  const repeated = await orchestrator.submit(jobRequest(dataset));
  assert.equal(first.ok && repeated.ok, true);
  assert.equal(first.value.jobId, repeated.value.jobId);
  const conflict = await orchestrator.submit(jobRequest(dataset, { model: { ...MODEL, modelVersion: "2" } }));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.issues[0].code, "IDEMPOTENCY_CONFLICT");
  const secret = await orchestrator.submit(jobRequest(dataset, { idempotencyKey: "secret-label", labels: { apiKey: "sk-sensitive-value-123456" } }));
  assert.equal(secret.ok, false);
  assert.equal(secret.issues[0].code, "INVALID_JOB_REQUEST");
});

test("executes a frozen dataset with ordered progress events and persisted artifacts", async () => {
  const { dataset, source } = await frozenFixture("success");
  const repository = new InMemoryEvaluationRuntimeRepository();
  const orchestrator = createEvaluationJobOrchestrator({ repository, ...deterministicAdapters("success") });
  const submitted = await orchestrator.submit(jobRequest(dataset));
  const executed = await orchestrator.execute(submitted.value.jobId, dataset, exactSubject(source));
  assert.equal(executed.ok, true);
  assert.equal(executed.value.status, "succeeded");
  assert.deepEqual(executed.value.progress, { totalCases: 1, processedCases: 1, completedCases: 1, failedCases: 0 });
  assert.ok(await repository.getRun(executed.value.runId));
  assert.ok(await repository.getReport(executed.value.reportId));
  const events = await orchestrator.listEvents(executed.value.jobId);
  assert.deepEqual(events.value.map((event) => event.type), ["job_queued", "job_started", "case_completed", "job_succeeded"]);
  assert.deepEqual(events.value.map((event) => event.sequence), [1, 2, 3, 4]);
});

test("enforces exact dataset and subject bindings before execution", async () => {
  const { dataset, source } = await frozenFixture("binding");
  const orchestrator = createEvaluationJobOrchestrator(deterministicAdapters("binding"));
  const submitted = await orchestrator.submit(jobRequest(dataset));
  const altered = structuredClone(dataset);
  altered.manifest.datasetVersion = "other";
  const datasetMismatch = await orchestrator.execute(submitted.value.jobId, altered, exactSubject(source));
  assert.equal(datasetMismatch.ok, false);
  assert.equal(datasetMismatch.issues[0].code, "DATASET_MISMATCH");
  const subjectMismatch = await orchestrator.execute(submitted.value.jobId, dataset, exactSubject(source, { ...MODEL, model: "other" }));
  assert.equal(subjectMismatch.ok, false);
  assert.equal(subjectMismatch.issues[0].code, "SUBJECT_MISMATCH");
});

test("prevents concurrent workers from executing an actively leased job", async () => {
  const { dataset, source } = await frozenFixture("lease");
  const repository = new InMemoryEvaluationRuntimeRepository();
  const adapters = deterministicAdapters("lease");
  const workerA = createEvaluationJobOrchestrator({ repository, ...adapters, workerId: "worker-a" });
  const workerB = createEvaluationJobOrchestrator({ repository, ...adapters, workerId: "worker-b" });
  const submitted = await workerA.submit(jobRequest(dataset));
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const firstExecution = workerA.execute(submitted.value.jobId, dataset, {
    identity: MODEL,
    async analyze() { entered(); await gate; return source; },
  });
  await started;
  const competing = await workerB.execute(submitted.value.jobId, dataset, exactSubject(source));
  assert.equal(competing.ok, false);
  assert.equal(competing.issues[0].code, "JOB_LEASED");
  release();
  assert.equal((await firstExecution).value.status, "succeeded");
});

test("recovers an expired worker lease while preventing the stale worker from committing", async () => {
  const { dataset, source } = await frozenFixture("lease-recovery");
  const repository = new InMemoryEvaluationRuntimeRepository();
  let now = Date.parse("2026-08-06T05:00:00.000Z");
  const clock = { now: () => new Date(now).toISOString() };
  let id = 0;
  const idGenerator = { createId: (prefix) => `${prefix}-recovery-${++id}` };
  const workerA = createEvaluationJobOrchestrator({ repository, clock, idGenerator, workerId: "worker-a", leaseDurationMs: 1_000 });
  const workerB = createEvaluationJobOrchestrator({ repository, clock, idGenerator, workerId: "worker-b", leaseDurationMs: 1_000 });
  const submitted = await workerA.submit(jobRequest(dataset));
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const staleExecution = workerA.execute(submitted.value.jobId, dataset, {
    identity: MODEL,
    async analyze() { entered(); await gate; return source; },
  });
  await started;
  now += 2_000;
  const recovered = await workerB.execute(submitted.value.jobId, dataset, exactSubject(source));
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value.status, "succeeded");
  release();
  const stale = await staleExecution;
  assert.equal(stale.ok, false);
  assert.equal(stale.issues[0].code, "CONCURRENT_MODIFICATION");
  assert.equal((await workerB.listEvents(submitted.value.jobId)).value.some((event) => event.type === "job_resumed"), true);
});

test("cooperatively cancels after the active model request without persisting partial output", async () => {
  const { dataset, source } = await frozenFixture("cancel");
  const repository = new InMemoryEvaluationRuntimeRepository();
  const orchestrator = createEvaluationJobOrchestrator({ repository, ...deterministicAdapters("cancel") });
  const submitted = await orchestrator.submit(jobRequest(dataset));
  const executed = await orchestrator.execute(submitted.value.jobId, dataset, {
    identity: MODEL,
    async analyze() {
      const cancelled = await orchestrator.cancel(submitted.value.jobId, "Operator stopped the benchmark.");
      assert.equal(cancelled.value.status, "cancelling");
      return source;
    },
  });
  assert.equal(executed.value.status, "cancelled");
  assert.equal(executed.value.runId, null);
  assert.deepEqual((await orchestrator.listEvents(executed.value.jobId)).value.map((event) => event.type), [
    "job_queued", "job_started", "cancel_requested", "job_cancelled",
  ]);
});

test("retries a completion-threshold failure with a fresh attempt", async () => {
  const { dataset, source } = await frozenFixture("retry");
  const repository = new InMemoryEvaluationRuntimeRepository();
  const orchestrator = createEvaluationJobOrchestrator({ repository, ...deterministicAdapters("retry") });
  const submitted = await orchestrator.submit(jobRequest(dataset));
  const failed = await orchestrator.execute(submitted.value.jobId, dataset, {
    identity: MODEL,
    async analyze() { throw new Error("transient provider error"); },
  });
  assert.equal(failed.value.status, "failed");
  assert.equal(failed.value.error.retryable, true);
  const retried = await orchestrator.retry(failed.value.jobId);
  assert.equal(retried.value.status, "queued");
  assert.equal(retried.value.attempt, 2);
  const recovered = await orchestrator.execute(retried.value.jobId, dataset, exactSubject(source));
  assert.equal(recovered.value.status, "succeeded");
  assert.equal((await orchestrator.retry(recovered.value.jobId)).issues[0].code, "JOB_NOT_RETRYABLE");
});

test("exports, verifies and restores a privacy-minimized tamper-evident audit bundle", async () => {
  const { dataset, source } = await frozenFixture("audit");
  const repository = new InMemoryEvaluationRuntimeRepository();
  const adapters = deterministicAdapters("audit");
  const orchestrator = createEvaluationJobOrchestrator({ repository, ...adapters });
  const submitted = await orchestrator.submit(jobRequest(dataset));
  const executed = await orchestrator.execute(submitted.value.jobId, dataset, exactSubject(source));
  const audit = createExperimentAuditService({ repository, ...adapters });
  const exported = await audit.exportBundle(executed.value.jobId, dataset);
  assert.equal(exported.ok, true);
  assert.equal(exported.value.policy.includesRawDatasetCases, false);
  assert.equal("snapshot" in exported.value.datasetManifest.cases[0], false);
  assert.equal("reviewBundle" in exported.value.datasetManifest.cases[0], false);
  assert.equal(audit.verifyBundle(exported.value).ok, true);

  const tampered = structuredClone(exported.value);
  tampered.job.labels.environment = "tampered";
  const invalid = audit.verifyBundle(tampered);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.issues.some((item) => item.code === "AUDIT_INTEGRITY_FAILED"), true);
  assert.equal(audit.verifyBundle({ schemaVersion: "sandbox.experiment-audit-bundle.v1", job: { schemaVersion: "sandbox.evaluation-job.v1" } }).ok, false);

  const restoredRepository = new InMemoryEvaluationRuntimeRepository();
  const restoredAudit = createExperimentAuditService({ repository: restoredRepository, ...deterministicAdapters("restore") });
  const restored = await restoredAudit.restoreBundle(exported.value);
  assert.equal(restored.ok, true);
  assert.equal((await restoredRepository.getJob(executed.value.jobId)).status, "succeeded");
  assert.equal((await restoredAudit.restoreBundle(exported.value)).issues[0].code, "RESTORE_CONFLICT");
});

function exactSubject(source, identity = MODEL) {
  return { identity, async analyze() { return source; } };
}

async function frozenFixture(suffix) {
  const snapshot = createSnapshot([
    createObject({ id: `child-${suffix}`, name: "儿童", xNorm: 0.5, yNorm: 0.5 }),
    createObject({ id: `tree-${suffix}`, name: "树", category: "自然", xNorm: 0.25, yNorm: 0.45 }),
  ], { snapshotId: `snapshot-phase-7-${suffix}` });
  const draft = {
    schemaVersion: SANDBOX_HYPOTHESIS_DRAFT_V1,
    hypotheses: [{
      id: "hypothesis-organization",
      label: "围绕作品组织方式的探索线索",
      confidence: 0.58,
      confidenceLevel: "medium",
      supportingEvidenceIds: ["feature:scene:spatial-distribution", "feature:scene:category-distribution"],
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
      evidenceIds: ["feature:scene:spatial-distribution"],
      hypothesisIds: ["hypothesis-organization"],
    }],
    warnings: [],
  };
  let id = 0;
  const analyzer = createSandboxHypothesisAnalyzer({
    llm: { async generateStructured() { return { content: draft, provider: "mock", model: "mock-v1" }; } },
    clock: { now: () => "2026-08-06T01:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-${suffix}-${++id}` },
  });
  const analysis = await analyzer.analyze(snapshot);
  assert.equal(analysis.ok, true);
  const source = { analysis: analysis.value, promptContext: analysis.promptContext };
  const workflow = createExpertReviewWorkflow({
    clock: { now: () => "2026-08-06T02:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-${suffix}-${++id}` },
  });
  const reviewInput = (expert) => ({
    reviewerPseudonym: expert,
    scores: EXPERT_RUBRIC_V1.dimensions.map((dimension) => ({ dimensionId: dimension.id, score: 5, comment: `${dimension.label}复核完成。` })),
    automaticRejectConditions: [], recommendation: "accepted", summary: "盲法复核完成。", revisions: [],
  });
  const reviewA = await workflow.submitExpertReview(source, reviewInput(`expert-${suffix}-a`));
  const reviewB = await workflow.submitExpertReview(source, reviewInput(`expert-${suffix}-b`));
  const adjudication = await workflow.adjudicate(source, {
    adjudicatorPseudonym: `expert-${suffix}-c`, reviewIds: [reviewA.value.reviewId, reviewB.value.reviewId],
    status: "accepted", rationale: "两位独立专家均接受同一分析版本。",
  });
  assert.equal(adjudication.ok, true);
  const bundle = await workflow.exportCaseBundle(source);
  const service = createEvaluationDatasetService({
    clock: { now: () => "2026-08-06T03:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-${suffix}-${++id}` },
  });
  const admitted = await service.admitCase({
    caseId: `case-${suffix}`, sourceGroupId: `source-group-${suffix}`, cohort: "sparse_relations", partition: "test",
    tier: "gold", challengeTags: ["runtime"], snapshot, reviewBundle: bundle.value,
    governance: {
      sourceKind: "synthetic", sourceRecordPseudonym: `source-${suffix}`, deidentified: true, directIdentityPresent: false,
      consentRecordId: null, ethicsApprovalId: null, allowedPurposes: ["evaluation"], trainingUseAllowed: false,
      revocationSnapshotHash: hashCanonicalJson(snapshot), retentionUntil: null,
    },
  });
  assert.equal(admitted.ok, true);
  const targetPlan = {
    totalCases: 1,
    partitions: { train: 0, dev: 0, test: 1 },
    cohorts: { empty_and_minimal: 0, sparse_relations: 1, dense_complex: 0, center_boundary_composition: 0, symbolic_ambiguity: 0, schema_edge_cases: 0, safety_adversarial: 0 },
  };
  const built = await service.buildDataset({ datasetId: `phase-7-${suffix}`, datasetVersion: "1.0.0", targetPlan, freeze: true });
  assert.equal(built.ok, true);
  return { dataset: built.value, source };
}
