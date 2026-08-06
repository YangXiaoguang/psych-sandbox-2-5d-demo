import type { EvaluationDatasetManifestV1, EvaluationDatasetV1 } from "./dataset.js";
import type {
  BenchmarkReportV1,
  EvaluationModelIdentityV1,
  EvaluationSubjectPort,
  ModelEvaluationRunV1,
} from "./evaluation.js";

export const SANDBOX_EVALUATION_JOB_V1 = "sandbox.evaluation-job.v1" as const;
export const SANDBOX_EVALUATION_JOB_EVENT_V1 = "sandbox.evaluation-job-event.v1" as const;
export const SANDBOX_EXPERIMENT_AUDIT_BUNDLE_V1 = "sandbox.experiment-audit-bundle.v1" as const;

export type EvaluationJobStatus = "queued" | "running" | "cancelling" | "succeeded" | "failed" | "cancelled";
export type EvaluationJobEventType =
  | "job_queued"
  | "job_started"
  | "job_resumed"
  | "case_completed"
  | "case_failed"
  | "cancel_requested"
  | "job_cancelled"
  | "retry_scheduled"
  | "job_succeeded"
  | "job_failed";

export interface EvaluationDatasetReferenceV1 {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
  readonly caseCount: number;
}

export interface EvaluationJobRequestV1 {
  readonly idempotencyKey: string;
  readonly dataset: EvaluationDatasetReferenceV1;
  readonly model: EvaluationModelIdentityV1;
  readonly runSeed: string;
  readonly maxAttempts: number;
  readonly acceptance: {
    readonly minimumCompletionRate: number;
  };
  readonly labels: Readonly<Record<string, string>>;
}

export interface EvaluationJobErrorV1 {
  readonly code:
    | "RUNTIME_INPUT_INVALID"
    | "SUBJECT_COMPLETION_BELOW_THRESHOLD"
    | "EXECUTION_INTERRUPTED"
    | "LEASE_LOST";
  readonly message: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface EvaluationJobV1 {
  readonly schemaVersion: typeof SANDBOX_EVALUATION_JOB_V1;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly dataset: EvaluationDatasetReferenceV1;
  readonly model: EvaluationModelIdentityV1;
  readonly runSeed: string;
  readonly maxAttempts: number;
  readonly acceptance: EvaluationJobRequestV1["acceptance"];
  readonly labels: Readonly<Record<string, string>>;
  readonly status: EvaluationJobStatus;
  readonly attempt: number;
  readonly revision: number;
  readonly progress: {
    readonly totalCases: number;
    readonly processedCases: number;
    readonly completedCases: number;
    readonly failedCases: number;
  };
  readonly lease: {
    readonly ownerId: string;
    readonly expiresAt: string;
  } | null;
  readonly runId: string | null;
  readonly reportId: string | null;
  readonly error: EvaluationJobErrorV1 | null;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly cancellationRequestedAt: string | null;
}

export interface EvaluationJobEventV1 {
  readonly schemaVersion: typeof SANDBOX_EVALUATION_JOB_EVENT_V1;
  readonly eventId: string;
  readonly jobId: string;
  readonly sequence: number;
  readonly type: EvaluationJobEventType;
  readonly attempt: number;
  readonly occurredAt: string;
  readonly detail: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ExperimentAuditBundleV1 {
  readonly schemaVersion: typeof SANDBOX_EXPERIMENT_AUDIT_BUNDLE_V1;
  readonly bundleId: string;
  readonly exportedAt: string;
  readonly datasetManifest: EvaluationDatasetManifestV1;
  readonly job: EvaluationJobV1;
  readonly events: readonly EvaluationJobEventV1[];
  readonly run: ModelEvaluationRunV1;
  readonly report: BenchmarkReportV1;
  readonly integrity: {
    readonly datasetManifestHash: string;
    readonly jobHash: string;
    readonly eventsHash: string;
    readonly runHash: string;
    readonly reportHash: string;
    readonly bundleHash: string;
  };
  readonly policy: {
    readonly includesRawDatasetCases: false;
    readonly includesGoldAnalysis: false;
    readonly includesApiKeys: false;
    readonly includesDirectIdentity: false;
  };
}

export interface EvaluationRuntimeRepositoryPort {
  createJob(job: EvaluationJobV1, event: EvaluationJobEventV1): Promise<void>;
  updateJob(job: EvaluationJobV1, event: EvaluationJobEventV1, expectedRevision: number): Promise<void>;
  getJob(jobId: string): Promise<EvaluationJobV1 | null>;
  findJobByIdempotencyKey(idempotencyKey: string): Promise<EvaluationJobV1 | null>;
  listJobEvents(jobId: string): Promise<readonly EvaluationJobEventV1[]>;
  saveRun(run: ModelEvaluationRunV1): Promise<void>;
  getRun(runId: string): Promise<ModelEvaluationRunV1 | null>;
  saveReport(report: BenchmarkReportV1): Promise<void>;
  getReport(reportId: string): Promise<BenchmarkReportV1 | null>;
  restoreAuditBundleArtifacts(bundle: ExperimentAuditBundleV1): Promise<void>;
}

export type EvaluationRuntimeIssueCode =
  | "INVALID_JOB_REQUEST"
  | "IDEMPOTENCY_CONFLICT"
  | "JOB_NOT_FOUND"
  | "JOB_NOT_EXECUTABLE"
  | "JOB_NOT_RETRYABLE"
  | "JOB_LEASED"
  | "CONCURRENT_MODIFICATION"
  | "DATASET_MISMATCH"
  | "SUBJECT_MISMATCH"
  | "AUDIT_INCOMPLETE"
  | "AUDIT_INTEGRITY_FAILED"
  | "RESTORE_CONFLICT"
  | "RUNTIME_REPOSITORY_ERROR";

export interface EvaluationRuntimeIssue {
  readonly code: EvaluationRuntimeIssueCode;
  readonly path: string;
  readonly message: string;
}

export type EvaluationRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly EvaluationRuntimeIssue[] };

export interface EvaluationJobOrchestrator {
  submit(request: EvaluationJobRequestV1): Promise<EvaluationRuntimeResult<EvaluationJobV1>>;
  execute(jobId: string, dataset: EvaluationDatasetV1, subject: EvaluationSubjectPort): Promise<EvaluationRuntimeResult<EvaluationJobV1>>;
  cancel(jobId: string, reason: string): Promise<EvaluationRuntimeResult<EvaluationJobV1>>;
  retry(jobId: string): Promise<EvaluationRuntimeResult<EvaluationJobV1>>;
  getJob(jobId: string): Promise<EvaluationRuntimeResult<EvaluationJobV1>>;
  listEvents(jobId: string): Promise<EvaluationRuntimeResult<readonly EvaluationJobEventV1[]>>;
}

export interface ExperimentAuditService {
  exportBundle(jobId: string, dataset: EvaluationDatasetV1): Promise<EvaluationRuntimeResult<ExperimentAuditBundleV1>>;
  verifyBundle(input: unknown): EvaluationRuntimeResult<ExperimentAuditBundleV1>;
  restoreBundle(input: unknown): Promise<EvaluationRuntimeResult<ExperimentAuditBundleV1>>;
}

export interface RuntimeClockPort {
  now(): string;
}

export interface RuntimeIdGeneratorPort {
  createId(prefix: string): string;
}

export interface CreateEvaluationJobOrchestratorOptions {
  readonly repository?: EvaluationRuntimeRepositoryPort;
  readonly clock?: RuntimeClockPort;
  readonly idGenerator?: RuntimeIdGeneratorPort;
  readonly workerId?: string;
  readonly leaseDurationMs?: number;
}

export interface CreateExperimentAuditServiceOptions {
  readonly repository: EvaluationRuntimeRepositoryPort;
  readonly clock?: RuntimeClockPort;
  readonly idGenerator?: RuntimeIdGeneratorPort;
}
