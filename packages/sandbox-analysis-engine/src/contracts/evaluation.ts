import type { EvaluationDatasetV1, EvaluationPartition } from "./dataset.js";
import type { ReviewAnalysisSourceV1 } from "./review.js";
import type { CurrentSandboxSnapshotV1 } from "./snapshot.js";

export const SANDBOX_MODEL_EVALUATION_RUN_V1 = "sandbox.model-evaluation-run.v1" as const;
export const SANDBOX_BENCHMARK_REPORT_V1 = "sandbox.benchmark-report.v1" as const;
export const SANDBOX_EXPERT_AGREEMENT_V1 = "sandbox.expert-agreement.v1" as const;

export interface EvaluationModelIdentityV1 {
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly adapterVersion: string;
  readonly promptVersion: string;
  readonly knowledgeBaseVersion: string | null;
}

export interface EvaluationSubjectInputV1 {
  readonly caseId: string;
  readonly partition: EvaluationPartition;
  readonly runSeed: string;
  readonly snapshot: CurrentSandboxSnapshotV1;
}

export interface EvaluationSubjectPort {
  readonly identity: EvaluationModelIdentityV1;
  analyze(input: EvaluationSubjectInputV1): Promise<ReviewAnalysisSourceV1>;
}

export interface ObjectiveCaseMetricsV1 {
  readonly snapshotBinding: 0 | 1;
  readonly sceneReconstructionExact: 0 | 1;
  readonly deterministicFeaturesExact: 0 | 1;
  readonly evidenceTraceabilityRate: number;
  readonly interviewQuestionValidityRate: number;
  readonly safetyPass: 0 | 1;
  readonly automatedPsychologicalCorrectness: null;
}

export interface ModelEvaluationCaseResultV1 {
  readonly caseId: string;
  readonly status: "completed" | "failed";
  readonly outputHash: string | null;
  readonly output: ReviewAnalysisSourceV1 | null;
  readonly metrics: ObjectiveCaseMetricsV1 | null;
  readonly errors: readonly string[];
}

export interface ModelEvaluationRunV1 {
  readonly schemaVersion: typeof SANDBOX_MODEL_EVALUATION_RUN_V1;
  readonly runId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
  readonly runSeed: string;
  readonly model: EvaluationModelIdentityV1;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly caseResults: readonly ModelEvaluationCaseResultV1[];
  readonly limitations: readonly [
    "automated_metrics_do_not_score_psychological_truth",
    "candidate_themes_require_blind_expert_review"
  ];
}

export interface ExpertAgreementDimensionV1 {
  readonly dimensionId: string;
  readonly ratingPairs: number;
  readonly exactAgreementRate: number;
  readonly adjacentAgreementRate: number;
  readonly meanAbsoluteDifference: number;
  readonly quadraticWeightedKappa: number | null;
}

export interface ExpertAgreementReportV1 {
  readonly schemaVersion: typeof SANDBOX_EXPERT_AGREEMENT_V1;
  readonly datasetHash: string;
  readonly casesWithIndependentRatings: number;
  readonly dimensions: readonly ExpertAgreementDimensionV1[];
  readonly overall: Omit<ExpertAgreementDimensionV1, "dimensionId">;
  readonly disagreementCounts: Readonly<Record<"status" | "dimension_score" | "revision", number>>;
}

export interface BenchmarkRunSummaryV1 {
  readonly runId: string;
  readonly model: EvaluationModelIdentityV1;
  readonly completionRate: number;
  readonly snapshotBindingRate: number;
  readonly sceneReconstructionAccuracy: number;
  readonly deterministicFeatureAccuracy: number;
  readonly evidenceTraceabilityRate: number;
  readonly interviewQuestionValidityRate: number;
  readonly safetyPassRate: number;
  readonly objectiveCompositeScore: number;
  readonly rank: number;
}

export interface BenchmarkReportV1 {
  readonly schemaVersion: typeof SANDBOX_BENCHMARK_REPORT_V1;
  readonly reportId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
  readonly generatedAt: string;
  readonly runs: readonly BenchmarkRunSummaryV1[];
  readonly expertAgreement: ExpertAgreementReportV1;
  readonly metricWeights: {
    readonly snapshotBinding: 0.1;
    readonly sceneReconstruction: 0.2;
    readonly deterministicFeatures: 0.2;
    readonly evidenceTraceability: 0.2;
    readonly interviewQuestionValidity: 0.1;
    readonly safety: 0.2;
  };
  readonly limitations: readonly [
    "ranking_uses_objective_engineering_metrics_only",
    "psychological_quality_requires_blind_expert_review",
    "test_results_are_not_clinical_validation"
  ];
}

export type EvaluationIssueCode =
  | "DATASET_NOT_FROZEN"
  | "DATASET_HASH_MISMATCH"
  | "MODEL_IDENTITY_INVALID"
  | "MODEL_OUTPUT_INVALID"
  | "INCOMPATIBLE_RUNS";

export interface EvaluationIssue {
  readonly code: EvaluationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type EvaluationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly EvaluationIssue[] };

export interface BenchmarkRunner {
  run(dataset: EvaluationDatasetV1, subject: EvaluationSubjectPort, runSeed: string): Promise<EvaluationResult<ModelEvaluationRunV1>>;
  createReport(dataset: EvaluationDatasetV1, runs: readonly ModelEvaluationRunV1[]): EvaluationResult<BenchmarkReportV1>;
}

export interface CreateBenchmarkRunnerOptions {
  readonly clock?: { now(): string };
  readonly idGenerator?: { createId(prefix: string): string };
}
