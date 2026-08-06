import type {
  BenchmarkReportV1,
  BenchmarkRunSummaryV1,
  CreateBenchmarkRunnerOptions,
  EvaluationIssue,
  EvaluationModelIdentityV1,
  EvaluationResult,
  BenchmarkRunner,
  ModelEvaluationRunV1,
} from "../contracts/evaluation.js";
import {
  SANDBOX_BENCHMARK_REPORT_V1,
  SANDBOX_MODEL_EVALUATION_RUN_V1,
} from "../contracts/evaluation.js";
import type { EvaluationDatasetV1 } from "../contracts/dataset.js";
import { computeEvaluationDatasetHash } from "../dataset/hash.js";
import { compareStrings, deepFreeze, roundNumber } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";
import { computeExpertAgreement, computeObjectiveCaseMetrics } from "./metrics.js";

const WEIGHTS = Object.freeze({
  snapshotBinding: 0.1,
  sceneReconstruction: 0.2,
  deterministicFeatures: 0.2,
  evidenceTraceability: 0.2,
  interviewQuestionValidity: 0.1,
  safety: 0.2,
} as const);
let defaultId = 0;

export function createBenchmarkRunner(options: CreateBenchmarkRunnerOptions = {}): BenchmarkRunner {
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const idGenerator = options.idGenerator ?? { createId: (prefix: string) => `${prefix}-${++defaultId}` };

  return {
    async run(dataset, subject, runSeed) {
      const datasetIssues = validateDataset(dataset);
      const identityIssues = validateModelIdentity(subject?.identity);
      if (!runSeed?.trim()) identityIssues.push(issue("MODEL_IDENTITY_INVALID", "/runSeed", "A reproducible run seed is required."));
      if (datasetIssues.length + identityIssues.length > 0) return { ok: false, issues: [...datasetIssues, ...identityIssues] };

      const startedAt = clock.now();
      const caseResults = [];
      for (const evaluationCase of [...dataset.cases].sort((left, right) => compareStrings(left.caseId, right.caseId))) {
        try {
          const output = await subject.analyze(deepFreeze({
            caseId: evaluationCase.caseId,
            partition: evaluationCase.partition,
            runSeed,
            snapshot: immutableCopy(evaluationCase.snapshot),
          }));
          caseResults.push(deepFreeze({
            caseId: evaluationCase.caseId,
            status: "completed" as const,
            outputHash: hashCanonicalJson(output),
            output: immutableCopy(output),
            metrics: computeObjectiveCaseMetrics(output, evaluationCase.finalAnalysis, evaluationCase.snapshotHash),
            errors: [] as string[],
          }));
        } catch (error) {
          caseResults.push(deepFreeze({
            caseId: evaluationCase.caseId,
            status: "failed" as const,
            outputHash: null,
            output: null,
            metrics: null,
            errors: [error instanceof Error ? error.message : String(error)],
          }));
        }
      }
      const value: ModelEvaluationRunV1 = deepFreeze({
        schemaVersion: SANDBOX_MODEL_EVALUATION_RUN_V1,
        runId: idGenerator.createId("model-run"),
        datasetId: dataset.manifest.datasetId,
        datasetVersion: dataset.manifest.datasetVersion,
        datasetHash: dataset.manifest.datasetHash,
        runSeed: runSeed.trim(),
        model: { ...subject.identity },
        startedAt,
        completedAt: clock.now(),
        caseResults,
        limitations: [
          "automated_metrics_do_not_score_psychological_truth",
          "candidate_themes_require_blind_expert_review",
        ],
      });
      return { ok: true, value };
    },

    createReport(dataset, runs) {
      const datasetIssues = validateDataset(dataset);
      if (datasetIssues.length > 0) return { ok: false, issues: datasetIssues };
      if (runs.length === 0 || runs.some((run) => (
        run.datasetId !== dataset.manifest.datasetId
        || run.datasetVersion !== dataset.manifest.datasetVersion
        || run.datasetHash !== dataset.manifest.datasetHash
      ))) {
        return failure("INCOMPATIBLE_RUNS", "/runs", "All runs must belong to the exact frozen dataset version and hash.");
      }
      const unsorted = runs.map(summarizeRun);
      const sorted = unsorted
        .sort((left, right) => right.objectiveCompositeScore - left.objectiveCompositeScore || compareStrings(left.runId, right.runId))
        .map((summary, index) => ({ ...summary, rank: index + 1 }));
      const value: BenchmarkReportV1 = deepFreeze({
        schemaVersion: SANDBOX_BENCHMARK_REPORT_V1,
        reportId: idGenerator.createId("benchmark-report"),
        datasetId: dataset.manifest.datasetId,
        datasetVersion: dataset.manifest.datasetVersion,
        datasetHash: dataset.manifest.datasetHash,
        generatedAt: clock.now(),
        runs: sorted,
        expertAgreement: computeExpertAgreement(dataset),
        metricWeights: WEIGHTS,
        limitations: [
          "ranking_uses_objective_engineering_metrics_only",
          "psychological_quality_requires_blind_expert_review",
          "test_results_are_not_clinical_validation",
        ],
      });
      return { ok: true, value };
    },
  };
}

function summarizeRun(run: ModelEvaluationRunV1): BenchmarkRunSummaryV1 {
  const completed = run.caseResults.filter((item) => item.status === "completed" && item.metrics);
  const average = (selector: (metrics: NonNullable<(typeof completed)[number]["metrics"]>) => number) => (
    completed.length > 0 ? roundNumber(completed.reduce((sum, item) => sum + selector(item.metrics!), 0) / completed.length) : 0
  );
  const summary = {
    runId: run.runId,
    model: run.model,
    completionRate: run.caseResults.length > 0 ? roundNumber(completed.length / run.caseResults.length) : 0,
    snapshotBindingRate: average((metrics) => metrics.snapshotBinding),
    sceneReconstructionAccuracy: average((metrics) => metrics.sceneReconstructionExact),
    deterministicFeatureAccuracy: average((metrics) => metrics.deterministicFeaturesExact),
    evidenceTraceabilityRate: average((metrics) => metrics.evidenceTraceabilityRate),
    interviewQuestionValidityRate: average((metrics) => metrics.interviewQuestionValidityRate),
    safetyPassRate: average((metrics) => metrics.safetyPass),
  };
  return {
    ...summary,
    objectiveCompositeScore: roundNumber(
      summary.completionRate * (
        summary.snapshotBindingRate * WEIGHTS.snapshotBinding
        + summary.sceneReconstructionAccuracy * WEIGHTS.sceneReconstruction
        + summary.deterministicFeatureAccuracy * WEIGHTS.deterministicFeatures
        + summary.evidenceTraceabilityRate * WEIGHTS.evidenceTraceability
        + summary.interviewQuestionValidityRate * WEIGHTS.interviewQuestionValidity
        + summary.safetyPassRate * WEIGHTS.safety
      ),
    ),
    rank: 0,
  };
}

function validateDataset(dataset: EvaluationDatasetV1): EvaluationIssue[] {
  const issues: EvaluationIssue[] = [];
  if (dataset?.manifest?.status !== "frozen" || !dataset.manifest.frozenAt) {
    issues.push(issue("DATASET_NOT_FROZEN", "/manifest/status", "Model evaluation requires an explicitly frozen dataset."));
    return issues;
  }
  const recomputed = computeEvaluationDatasetHash({
    datasetId: dataset.manifest.datasetId,
    datasetVersion: dataset.manifest.datasetVersion,
    targetPlan: dataset.manifest.targetPlan,
    cases: dataset.manifest.cases,
  });
  if (recomputed !== dataset.manifest.datasetHash) issues.push(issue("DATASET_HASH_MISMATCH", "/manifest/datasetHash", "Dataset manifest hash does not match its governed contents."));
  if (dataset.cases.length !== dataset.manifest.cases.length || dataset.cases.some((value, index) => {
    const reference = dataset.manifest.cases[index];
    return !reference || value.caseId !== reference.caseId || value.caseHash !== reference.caseHash || hashCanonicalJson(value.finalAnalysis) !== reference.finalAnalysisHash;
  })) {
    issues.push(issue("DATASET_HASH_MISMATCH", "/cases", "Dataset payload does not match its sorted manifest references."));
  }
  return issues;
}

function validateModelIdentity(identity: EvaluationModelIdentityV1 | undefined): EvaluationIssue[] {
  const issues: EvaluationIssue[] = [];
  const required: Array<keyof Omit<EvaluationModelIdentityV1, "knowledgeBaseVersion">> = ["provider", "model", "modelVersion", "adapterVersion", "promptVersion"];
  required.forEach((key) => {
    if (!identity?.[key]?.trim()) issues.push(issue("MODEL_IDENTITY_INVALID", `/model/${key}`, `${key} is required for reproducibility.`));
  });
  return issues;
}

function issue(code: EvaluationIssue["code"], path: string, message: string): EvaluationIssue {
  return { code, path, message };
}

function failure<T>(code: EvaluationIssue["code"], path: string, message: string): EvaluationResult<T> {
  return { ok: false, issues: [issue(code, path, message)] };
}

function immutableCopy<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T) as T;
}
