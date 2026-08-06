import { computeEvaluationDatasetHash } from "../dataset/hash.js";
import {
  SANDBOX_EVALUATION_JOB_EVENT_V1,
  SANDBOX_EVALUATION_JOB_V1,
  SANDBOX_EXPERIMENT_AUDIT_BUNDLE_V1,
  type CreateExperimentAuditServiceOptions,
  type EvaluationRuntimeIssue,
  type EvaluationRuntimeResult,
  type ExperimentAuditBundleV1,
  type ExperimentAuditService,
} from "../contracts/runtime.js";
import type { EvaluationDatasetV1 } from "../contracts/dataset.js";
import { deepFreeze } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";
import { RuntimeRepositoryConflictError } from "./inMemoryEvaluationRuntimeRepository.js";

let defaultBundleId = 0;

export function createExperimentAuditService(
  options: CreateExperimentAuditServiceOptions,
): ExperimentAuditService {
  const repository = options.repository;
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const idGenerator = options.idGenerator ?? { createId: (prefix: string) => `${prefix}-${++defaultBundleId}` };

  return {
    async exportBundle(jobId, dataset) {
      try {
        const job = await repository.getJob(jobId);
        if (!job) return failure("JOB_NOT_FOUND", "/jobId", "Evaluation job was not found.");
        const datasetIssues = validateDatasetBinding(job, dataset);
        if (datasetIssues.length > 0) return { ok: false, issues: datasetIssues };
        if (!job.runId || !job.reportId || !["succeeded", "failed"].includes(job.status)) {
          return failure("AUDIT_INCOMPLETE", "/job", "A terminal job with a persisted run and report is required for export.");
        }
        const [events, run, report] = await Promise.all([
          repository.listJobEvents(jobId),
          repository.getRun(job.runId),
          repository.getReport(job.reportId),
        ]);
        if (!run || !report) {
          return failure("AUDIT_INCOMPLETE", "/artifacts", "The job's model run or benchmark report is missing.");
        }
        const exportedAt = clock.now();
        const base = {
          schemaVersion: SANDBOX_EXPERIMENT_AUDIT_BUNDLE_V1,
          bundleId: idGenerator.createId("experiment-audit-bundle"),
          exportedAt,
          datasetManifest: dataset.manifest,
          job,
          events,
          run,
          report,
          policy: AUDIT_POLICY,
        } as const;
        const integrity = componentHashes(base);
        const value = deepFreeze({
          ...base,
          integrity: {
            ...integrity,
            bundleHash: hashCanonicalJson({ ...base, integrity }),
          },
        }) as ExperimentAuditBundleV1;
        const verified = verify(value);
        return verified.ok ? { ok: true, value } : verified;
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    verifyBundle(input) {
      return verify(input);
    },

    async restoreBundle(input) {
      const verified = verify(input);
      if (!verified.ok) return verified;
      try {
        await repository.restoreAuditBundleArtifacts(verified.value);
        return verified;
      } catch (error) {
        return error instanceof RuntimeRepositoryConflictError
          ? failure("RESTORE_CONFLICT", "/bundle", error.message)
          : repositoryFailure(error);
      }
    },
  };
}

const AUDIT_POLICY = deepFreeze({
  includesRawDatasetCases: false,
  includesGoldAnalysis: false,
  includesApiKeys: false,
  includesDirectIdentity: false,
} as const);

function verify(input: unknown): EvaluationRuntimeResult<ExperimentAuditBundleV1> {
  try {
    return verifyUnchecked(input);
  } catch (error) {
    return failure(
      "AUDIT_INTEGRITY_FAILED",
      "/",
      `Audit bundle is structurally invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function verifyUnchecked(input: unknown): EvaluationRuntimeResult<ExperimentAuditBundleV1> {
  if (!isRecord(input)) return failure("AUDIT_INTEGRITY_FAILED", "/", "Audit bundle must be an object.");
  const bundle = input as unknown as ExperimentAuditBundleV1;
  const issues: EvaluationRuntimeIssue[] = [];
  if (bundle.schemaVersion !== SANDBOX_EXPERIMENT_AUDIT_BUNDLE_V1) push(issues, "/schemaVersion", "Unsupported audit bundle schema.");
  if (!nonEmpty(bundle.bundleId) || !validDate(bundle.exportedAt)) push(issues, "/bundleId", "Bundle ID and export time are required.");
  if (!isRecord(bundle.datasetManifest) || bundle.datasetManifest.status !== "frozen") push(issues, "/datasetManifest", "A frozen dataset manifest is required.");
  if (!isRecord(bundle.job) || bundle.job.schemaVersion !== SANDBOX_EVALUATION_JOB_V1) push(issues, "/job", "A versioned evaluation job is required.");
  if (!Array.isArray(bundle.events) || bundle.events.length === 0) push(issues, "/events", "A non-empty job event stream is required.");
  if (!isRecord(bundle.run) || !isRecord(bundle.report) || !isRecord(bundle.integrity)) push(issues, "/artifacts", "Run, report and integrity metadata are required.");
  if (!exactPolicy(bundle.policy)) push(issues, "/policy", "Audit privacy policy must exclude raw cases, Gold analysis, API keys and direct identity.");
  if (issues.length > 0) return { ok: false, issues };

  const expectedDatasetHash = computeEvaluationDatasetHash({
    datasetId: bundle.datasetManifest.datasetId,
    datasetVersion: bundle.datasetManifest.datasetVersion,
    targetPlan: bundle.datasetManifest.targetPlan,
    cases: bundle.datasetManifest.cases,
  });
  if (expectedDatasetHash !== bundle.datasetManifest.datasetHash) push(issues, "/datasetManifest/datasetHash", "Dataset manifest hash does not match its canonical content.");
  if (bundle.job.dataset.datasetId !== bundle.datasetManifest.datasetId
    || bundle.job.dataset.datasetVersion !== bundle.datasetManifest.datasetVersion
    || bundle.job.dataset.datasetHash !== bundle.datasetManifest.datasetHash
    || bundle.job.dataset.caseCount !== bundle.datasetManifest.actualCounts.totalCases) {
    push(issues, "/job/dataset", "Job is not bound to the included dataset manifest.");
  }
  if (bundle.job.runId !== bundle.run.runId || bundle.job.reportId !== bundle.report.reportId) push(issues, "/job", "Job artifact IDs do not match the included run and report.");
  for (const [path, artifact] of [["/run", bundle.run], ["/report", bundle.report]] as const) {
    if (artifact.datasetId !== bundle.datasetManifest.datasetId
      || artifact.datasetVersion !== bundle.datasetManifest.datasetVersion
      || artifact.datasetHash !== bundle.datasetManifest.datasetHash) {
      push(issues, path, "Artifact is not bound to the included dataset manifest.");
    }
  }
  if (hashCanonicalJson(bundle.run.model) !== hashCanonicalJson(bundle.job.model)) push(issues, "/run/model", "Run model identity does not match the job.");
  if (bundle.report.runs.length !== 1 || bundle.report.runs[0]?.runId !== bundle.run.runId) push(issues, "/report/runs", "Benchmark report must reference the included model run.");
  if (!validEvents(bundle)) push(issues, "/events", "Job event stream is not contiguous or bound to the job.");
  if (bundle.job.revision !== bundle.events.length - 1) push(issues, "/job/revision", "Job revision must equal the number of persisted state transitions.");
  if (!terminalEventMatches(bundle)) push(issues, "/events", "Final event does not match the terminal job status.");

  const base = {
    schemaVersion: bundle.schemaVersion,
    bundleId: bundle.bundleId,
    exportedAt: bundle.exportedAt,
    datasetManifest: bundle.datasetManifest,
    job: bundle.job,
    events: bundle.events,
    run: bundle.run,
    report: bundle.report,
    policy: bundle.policy,
  } as const;
  const expectedComponents = componentHashes(base);
  for (const key of Object.keys(expectedComponents) as (keyof typeof expectedComponents)[]) {
    if (bundle.integrity[key] !== expectedComponents[key]) push(issues, `/integrity/${key}`, `${key} does not match canonical content.`);
  }
  const expectedBundleHash = hashCanonicalJson({ ...base, integrity: expectedComponents });
  if (bundle.integrity.bundleHash !== expectedBundleHash) push(issues, "/integrity/bundleHash", "Bundle hash does not match canonical content.");
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: immutableCopy(bundle) };
}

function componentHashes(input: Pick<ExperimentAuditBundleV1, "datasetManifest" | "job" | "events" | "run" | "report">) {
  return deepFreeze({
    datasetManifestHash: hashCanonicalJson(input.datasetManifest),
    jobHash: hashCanonicalJson(input.job),
    eventsHash: hashCanonicalJson(input.events),
    runHash: hashCanonicalJson(input.run),
    reportHash: hashCanonicalJson(input.report),
  });
}

function validateDatasetBinding(job: ExperimentAuditBundleV1["job"], dataset: EvaluationDatasetV1): EvaluationRuntimeIssue[] {
  const issues: EvaluationRuntimeIssue[] = [];
  if (dataset?.manifest?.status !== "frozen"
    || dataset.manifest.datasetId !== job.dataset.datasetId
    || dataset.manifest.datasetVersion !== job.dataset.datasetVersion
    || dataset.manifest.datasetHash !== job.dataset.datasetHash
    || dataset.cases?.length !== job.dataset.caseCount) {
    issues.push(issue("DATASET_MISMATCH", "/dataset", "Export dataset does not match the job's frozen dataset reference."));
  }
  return issues;
}

function validEvents(bundle: ExperimentAuditBundleV1): boolean {
  let previousAttempt = 0;
  const eventIds = new Set<string>();
  return bundle.events.every((event, index) => {
    const attemptIsOrdered = event.attempt >= previousAttempt && event.attempt <= previousAttempt + 1;
    previousAttempt = event.attempt;
    const eventIdIsUnique = !eventIds.has(event.eventId);
    eventIds.add(event.eventId);
    return event.schemaVersion === SANDBOX_EVALUATION_JOB_EVENT_V1
    && event.jobId === bundle.job.jobId
    && event.sequence === index + 1
    && event.attempt >= 1
    && event.attempt <= bundle.job.attempt
    && attemptIsOrdered
    && eventIdIsUnique
    && validDate(event.occurredAt);
  });
}

function terminalEventMatches(bundle: ExperimentAuditBundleV1): boolean {
  const expected = bundle.job.status === "succeeded"
    ? "job_succeeded"
    : bundle.job.status === "failed"
      ? "job_failed"
      : bundle.job.status === "cancelled"
        ? "job_cancelled"
        : null;
  return expected !== null && bundle.events[bundle.events.length - 1]?.type === expected;
}

function exactPolicy(value: unknown): boolean {
  return isRecord(value)
    && value.includesRawDatasetCases === false
    && value.includesGoldAnalysis === false
    && value.includesApiKeys === false
    && value.includesDirectIdentity === false;
}

function immutableCopy<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T) as T;
}

function push(issues: EvaluationRuntimeIssue[], path: string, message: string): void {
  issues.push(issue("AUDIT_INTEGRITY_FAILED", path, message));
}

function failure<T>(code: EvaluationRuntimeIssue["code"], path: string, message: string): EvaluationRuntimeResult<T> {
  return { ok: false, issues: [issue(code, path, message)] };
}

function issue(code: EvaluationRuntimeIssue["code"], path: string, message: string): EvaluationRuntimeIssue {
  return { code, path, message };
}

function repositoryFailure<T>(error: unknown): EvaluationRuntimeResult<T> {
  return failure("RUNTIME_REPOSITORY_ERROR", "/repository", `Runtime repository failed: ${error instanceof Error ? error.message : String(error)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
