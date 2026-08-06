import type { EvaluationDatasetV1 } from "../contracts/dataset.js";
import type { EvaluationSubjectPort } from "../contracts/evaluation.js";
import {
  SANDBOX_EVALUATION_JOB_EVENT_V1,
  SANDBOX_EVALUATION_JOB_V1,
  type CreateEvaluationJobOrchestratorOptions,
  type EvaluationJobEventType,
  type EvaluationJobEventV1,
  type EvaluationJobOrchestrator,
  type EvaluationJobRequestV1,
  type EvaluationJobV1,
  type EvaluationRuntimeIssue,
  type EvaluationRuntimeResult,
} from "../contracts/runtime.js";
import { createBenchmarkRunner } from "../evaluation/runner.js";
import { compareStrings, deepFreeze, roundNumber } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";
import {
  InMemoryEvaluationRuntimeRepository,
  RuntimeRepositoryConflictError,
} from "./inMemoryEvaluationRuntimeRepository.js";

const DEFAULT_LEASE_DURATION_MS = 60_000;
const MAX_LABELS = 20;
let defaultId = 0;

class CancellationRequestedSignal extends Error {}
class LeaseLostSignal extends Error {}

export function createEvaluationJobOrchestrator(
  options: CreateEvaluationJobOrchestratorOptions = {},
): EvaluationJobOrchestrator {
  const repository = options.repository ?? new InMemoryEvaluationRuntimeRepository();
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const idGenerator = options.idGenerator ?? { createId: (prefix: string) => `${prefix}-${++defaultId}` };
  const workerId = options.workerId?.trim() || `worker-${++defaultId}`;
  const leaseDurationMs = options.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 1_000) {
    throw new TypeError("leaseDurationMs must be an integer of at least 1000 milliseconds.");
  }

  const nextEvent = async (
    job: EvaluationJobV1,
    type: EvaluationJobEventType,
    detail: EvaluationJobEventV1["detail"],
  ): Promise<EvaluationJobEventV1> => {
    const events = await repository.listJobEvents(job.jobId);
    return deepFreeze({
      schemaVersion: SANDBOX_EVALUATION_JOB_EVENT_V1,
      eventId: idGenerator.createId("job-event"),
      jobId: job.jobId,
      sequence: events.length + 1,
      type,
      attempt: job.attempt,
      occurredAt: clock.now(),
      detail,
    });
  };

  const update = async (
    current: EvaluationJobV1,
    patch: Partial<EvaluationJobV1>,
    type: EvaluationJobEventType,
    detail: EvaluationJobEventV1["detail"],
  ): Promise<EvaluationJobV1> => {
    const value = deepFreeze({ ...current, ...patch, revision: current.revision + 1 });
    await repository.updateJob(value, await nextEvent(value, type, detail), current.revision);
    return value;
  };

  const failExecution = async (
    current: EvaluationJobV1,
    code: NonNullable<EvaluationJobV1["error"]>["code"],
    message: string,
    retryable: boolean,
    artifacts: { readonly runId?: string; readonly reportId?: string } = {},
  ): Promise<EvaluationJobV1> => {
    const occurredAt = clock.now();
    return update(current, {
      status: "failed",
      lease: null,
      runId: artifacts.runId ?? current.runId,
      reportId: artifacts.reportId ?? current.reportId,
      error: { code, message, retryable, occurredAt },
      completedAt: occurredAt,
    }, "job_failed", { code, retryable, runId: artifacts.runId ?? null, reportId: artifacts.reportId ?? null });
  };

  const completeCancellation = async (current: EvaluationJobV1, reason: string): Promise<EvaluationJobV1> => {
    if (current.status === "cancelled") return current;
    return update(current, {
      status: "cancelled",
      lease: null,
      completedAt: clock.now(),
    }, "job_cancelled", { reason });
  };

  return {
    async submit(request) {
      const normalized = normalizeRequest(request);
      if (!normalized.ok) return normalized;
      const requestHash = hashCanonicalJson(normalized.value);
      try {
        const existing = await repository.findJobByIdempotencyKey(normalized.value.idempotencyKey);
        if (existing) {
          return existing.requestHash === requestHash
            ? { ok: true, value: existing }
            : failure("IDEMPOTENCY_CONFLICT", "/idempotencyKey", "The idempotency key is already bound to different job parameters.");
        }
        const now = clock.now();
        const value: EvaluationJobV1 = deepFreeze({
          schemaVersion: SANDBOX_EVALUATION_JOB_V1,
          jobId: idGenerator.createId("evaluation-job"),
          idempotencyKey: normalized.value.idempotencyKey,
          requestHash,
          dataset: normalized.value.dataset,
          model: normalized.value.model,
          runSeed: normalized.value.runSeed,
          maxAttempts: normalized.value.maxAttempts,
          acceptance: normalized.value.acceptance,
          labels: normalized.value.labels,
          status: "queued",
          attempt: 1,
          revision: 0,
          progress: { totalCases: normalized.value.dataset.caseCount, processedCases: 0, completedCases: 0, failedCases: 0 },
          lease: null,
          runId: null,
          reportId: null,
          error: null,
          requestedAt: now,
          startedAt: null,
          completedAt: null,
          cancellationRequestedAt: null,
        });
        const event: EvaluationJobEventV1 = deepFreeze({
          schemaVersion: SANDBOX_EVALUATION_JOB_EVENT_V1,
          eventId: idGenerator.createId("job-event"),
          jobId: value.jobId,
          sequence: 1,
          type: "job_queued",
          attempt: value.attempt,
          occurredAt: now,
          detail: { datasetHash: value.dataset.datasetHash, model: value.model.model },
        });
        await repository.createJob(value, event);
        return { ok: true, value };
      } catch (error) {
        if (error instanceof RuntimeRepositoryConflictError) {
          try {
            const existing = await repository.findJobByIdempotencyKey(normalized.value.idempotencyKey);
            if (existing?.requestHash === requestHash) return { ok: true, value: existing };
          } catch {
            // Fall through to the stable conflict result.
          }
          return failure("IDEMPOTENCY_CONFLICT", "/idempotencyKey", error.message);
        }
        return repositoryFailure(error);
      }
    },

    async execute(jobId, dataset, subject) {
      try {
        let current = await repository.getJob(jobId);
        if (!current) return failure("JOB_NOT_FOUND", "/jobId", "Evaluation job was not found.");
        const bindingIssues = validateExecutionBindings(current, dataset, subject);
        if (bindingIssues.length > 0) return { ok: false, issues: bindingIssues };

        if (current.status === "cancelling") {
          return { ok: true, value: await completeCancellation(current, "Cancellation completed before execution resumed.") };
        }
        if (current.status === "queued") {
          const now = clock.now();
          current = await update(current, {
            status: "running",
            lease: { ownerId: workerId, expiresAt: addMilliseconds(now, leaseDurationMs) },
            startedAt: current.startedAt ?? now,
            completedAt: null,
          }, "job_started", { workerId });
        } else if (current.status === "running") {
          if (current.lease && Date.parse(current.lease.expiresAt) > Date.parse(clock.now())) {
            return failure("JOB_LEASED", "/lease", `Job is leased by ${current.lease.ownerId} until ${current.lease.expiresAt}.`);
          }
          const now = clock.now();
          current = await update(current, {
            lease: { ownerId: workerId, expiresAt: addMilliseconds(now, leaseDurationMs) },
          }, "job_resumed", { workerId, previousOwnerId: current.lease?.ownerId ?? null });
        } else {
          return failure("JOB_NOT_EXECUTABLE", "/status", `Job in status ${current.status} cannot be executed.`);
        }

        const runner = createBenchmarkRunner({
          clock,
          idGenerator,
          onCaseComplete: async (progress) => {
            const active = await repository.getJob(jobId);
            if (!active) throw new LeaseLostSignal("Job disappeared during execution.");
            if (active.status === "cancelling") throw new CancellationRequestedSignal("Cancellation requested.");
            if (active.status !== "running" || active.lease?.ownerId !== workerId) throw new LeaseLostSignal("Worker lease was lost.");
            const failedCases = active.progress.failedCases + (progress.status === "failed" ? 1 : 0);
            const completedCases = active.progress.completedCases + (progress.status === "completed" ? 1 : 0);
            const now = clock.now();
            current = await update(active, {
              progress: {
                totalCases: progress.totalCases,
                processedCases: progress.processedCases,
                completedCases,
                failedCases,
              },
              lease: { ownerId: workerId, expiresAt: addMilliseconds(now, leaseDurationMs) },
            }, progress.status === "completed" ? "case_completed" : "case_failed", {
              caseId: progress.caseId,
              processedCases: progress.processedCases,
              totalCases: progress.totalCases,
            });
          },
        });
        const runResult = await runner.run(dataset, subject, current.runSeed);
        current = await requireCurrentJob(repository, jobId);
        if (current.status === "cancelling") {
          return { ok: true, value: await completeCancellation(current, "Cancellation completed after the active model request.") };
        }
        if (!runResult.ok) {
          const message = runResult.issues.map((item) => `${item.code}: ${item.message}`).join(" | ");
          return { ok: true, value: await failExecution(current, "RUNTIME_INPUT_INVALID", message, false) };
        }

        await repository.saveRun(runResult.value);
        const reportResult = runner.createReport(dataset, [runResult.value]);
        if (!reportResult.ok) {
          const message = reportResult.issues.map((item) => `${item.code}: ${item.message}`).join(" | ");
          return { ok: true, value: await failExecution(current, "RUNTIME_INPUT_INVALID", message, false, { runId: runResult.value.runId }) };
        }
        await repository.saveReport(reportResult.value);
        const completionRate = runResult.value.caseResults.length > 0
          ? roundNumber(runResult.value.caseResults.filter((item) => item.status === "completed").length / runResult.value.caseResults.length)
          : 0;
        current = await requireCurrentJob(repository, jobId);
        if (completionRate < current.acceptance.minimumCompletionRate) {
          return { ok: true, value: await failExecution(
            current,
            "SUBJECT_COMPLETION_BELOW_THRESHOLD",
            `Completion rate ${completionRate} is below required ${current.acceptance.minimumCompletionRate}.`,
            true,
            { runId: runResult.value.runId, reportId: reportResult.value.reportId },
          ) };
        }
        const completedAt = clock.now();
        current = await update(current, {
          status: "succeeded",
          lease: null,
          runId: runResult.value.runId,
          reportId: reportResult.value.reportId,
          error: null,
          completedAt,
        }, "job_succeeded", { runId: runResult.value.runId, reportId: reportResult.value.reportId, completionRate });
        return { ok: true, value: current };
      } catch (error) {
        if (error instanceof CancellationRequestedSignal) {
          try {
            const current = await requireCurrentJob(repository, jobId);
            return { ok: true, value: await completeCancellation(current, "Cancellation requested during case execution.") };
          } catch (nested) {
            return repositoryFailure(nested);
          }
        }
        if (error instanceof LeaseLostSignal || error instanceof RuntimeRepositoryConflictError) {
          return failure("CONCURRENT_MODIFICATION", "/revision", error.message);
        }
        try {
          const current = await repository.getJob(jobId);
          if (current && ["running", "cancelling"].includes(current.status)) {
            if (current.status === "cancelling") return { ok: true, value: await completeCancellation(current, "Cancellation completed after interruption.") };
            return { ok: true, value: await failExecution(current, "EXECUTION_INTERRUPTED", errorMessage(error), true) };
          }
        } catch {
          // Return the original stable repository error below.
        }
        return repositoryFailure(error);
      }
    },

    async cancel(jobId, reason) {
      if (!reason?.trim()) return failure("INVALID_JOB_REQUEST", "/reason", "Cancellation reason is required.");
      try {
        const current = await repository.getJob(jobId);
        if (!current) return failure("JOB_NOT_FOUND", "/jobId", "Evaluation job was not found.");
        if (["succeeded", "failed", "cancelled"].includes(current.status)) return { ok: true, value: current };
        if (current.status === "cancelling") return { ok: true, value: current };
        if (current.status === "queued") {
          return { ok: true, value: await completeCancellation(current, reason.trim()) };
        }
        const now = clock.now();
        return { ok: true, value: await update(current, {
          status: "cancelling",
          cancellationRequestedAt: now,
        }, "cancel_requested", { reason: reason.trim() }) };
      } catch (error) {
        return mapRepositoryError(error);
      }
    },

    async retry(jobId) {
      try {
        const current = await repository.getJob(jobId);
        if (!current) return failure("JOB_NOT_FOUND", "/jobId", "Evaluation job was not found.");
        if (current.status !== "failed" || !current.error?.retryable || current.attempt >= current.maxAttempts) {
          return failure("JOB_NOT_RETRYABLE", "/status", "Only retryable failed jobs with remaining attempts can be queued again.");
        }
        const value = deepFreeze({
          ...current,
          status: "queued" as const,
          attempt: current.attempt + 1,
          revision: current.revision + 1,
          progress: { totalCases: current.dataset.caseCount, processedCases: 0, completedCases: 0, failedCases: 0 },
          lease: null,
          runId: null,
          reportId: null,
          error: null,
          startedAt: null,
          completedAt: null,
          cancellationRequestedAt: null,
        });
        await repository.updateJob(value, await nextEvent(value, "retry_scheduled", { previousAttempt: current.attempt }), current.revision);
        return { ok: true, value };
      } catch (error) {
        return mapRepositoryError(error);
      }
    },

    async getJob(jobId) {
      try {
        const value = await repository.getJob(jobId);
        return value ? { ok: true, value } : failure("JOB_NOT_FOUND", "/jobId", "Evaluation job was not found.");
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async listEvents(jobId) {
      try {
        const job = await repository.getJob(jobId);
        if (!job) return failure("JOB_NOT_FOUND", "/jobId", "Evaluation job was not found.");
        return { ok: true, value: await repository.listJobEvents(jobId) };
      } catch (error) {
        return repositoryFailure(error);
      }
    },
  };
}

function normalizeRequest(request: EvaluationJobRequestV1): EvaluationRuntimeResult<EvaluationJobRequestV1> {
  const issues: EvaluationRuntimeIssue[] = [];
  const idempotencyKey = request?.idempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length > 128 || idempotencyKey.includes("@")) issues.push(issue("INVALID_JOB_REQUEST", "/idempotencyKey", "A non-email idempotency key of 1-128 characters is required."));
  const dataset = request?.dataset;
  if (!dataset?.datasetId?.trim() || !dataset?.datasetVersion?.trim() || !/^[a-f0-9]{64}$/u.test(dataset?.datasetHash ?? "") || !Number.isInteger(dataset?.caseCount) || dataset.caseCount < 1) {
    issues.push(issue("INVALID_JOB_REQUEST", "/dataset", "Dataset ID, version, SHA-256 and positive case count are required."));
  }
  const modelFields = [request?.model?.provider, request?.model?.model, request?.model?.modelVersion, request?.model?.adapterVersion, request?.model?.promptVersion];
  if (modelFields.some((value) => !value?.trim())) issues.push(issue("INVALID_JOB_REQUEST", "/model", "Complete provider, model, model version, adapter version and prompt version are required."));
  if (!request?.runSeed?.trim()) issues.push(issue("INVALID_JOB_REQUEST", "/runSeed", "Run seed is required."));
  if (!Number.isInteger(request?.maxAttempts) || request.maxAttempts < 1 || request.maxAttempts > 5) issues.push(issue("INVALID_JOB_REQUEST", "/maxAttempts", "maxAttempts must be an integer from 1 to 5."));
  if (!Number.isFinite(request?.acceptance?.minimumCompletionRate) || request.acceptance.minimumCompletionRate < 0 || request.acceptance.minimumCompletionRate > 1) issues.push(issue("INVALID_JOB_REQUEST", "/acceptance/minimumCompletionRate", "Minimum completion rate must be between 0 and 1."));
  const labels = request?.labels ?? {};
  const entries = Object.entries(labels);
  if (entries.length > MAX_LABELS || entries.some(([key, value]) => !validLabel(key, value))) issues.push(issue("INVALID_JOB_REQUEST", "/labels", "Labels must be short non-sensitive string pairs and cannot contain identity, keys, tokens or secrets."));
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: deepFreeze({
    idempotencyKey,
    dataset: { datasetId: dataset.datasetId.trim(), datasetVersion: dataset.datasetVersion.trim(), datasetHash: dataset.datasetHash, caseCount: dataset.caseCount },
    model: {
      provider: request.model.provider.trim(), model: request.model.model.trim(), modelVersion: request.model.modelVersion.trim(),
      adapterVersion: request.model.adapterVersion.trim(), promptVersion: request.model.promptVersion.trim(),
      knowledgeBaseVersion: request.model.knowledgeBaseVersion?.trim() || null,
    },
    runSeed: request.runSeed.trim(),
    maxAttempts: request.maxAttempts,
    acceptance: { minimumCompletionRate: roundNumber(request.acceptance.minimumCompletionRate) },
    labels: Object.fromEntries(entries.sort(([left], [right]) => compareStrings(left, right)).map(([key, value]) => [key.trim(), value.trim()])),
  }) };
}

function validateExecutionBindings(job: EvaluationJobV1, dataset: EvaluationDatasetV1, subject: EvaluationSubjectPort): EvaluationRuntimeIssue[] {
  const issues: EvaluationRuntimeIssue[] = [];
  if (dataset?.manifest?.datasetId !== job.dataset.datasetId || dataset?.manifest?.datasetVersion !== job.dataset.datasetVersion || dataset?.manifest?.datasetHash !== job.dataset.datasetHash || dataset?.cases?.length !== job.dataset.caseCount) {
    issues.push(issue("DATASET_MISMATCH", "/dataset", "Execution dataset does not match the job's frozen dataset reference."));
  }
  if (hashCanonicalJson(subject?.identity) !== hashCanonicalJson(job.model)) {
    issues.push(issue("SUBJECT_MISMATCH", "/model", "Evaluation subject identity does not match the submitted job."));
  }
  return issues;
}

function validLabel(key: string, value: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[_-]/gu, "");
  return Boolean(key.trim() && value.trim() && key.length <= 64 && value.length <= 128)
    && !/(apikey|token|password|secret|email|userid|phone)/u.test(normalizedKey)
    && !/@/u.test(value)
    && !/\b(?:sk|api|token)[-_][A-Za-z0-9_-]{12,}\b/iu.test(value);
}

async function requireCurrentJob(repository: NonNullable<CreateEvaluationJobOrchestratorOptions["repository"]>, jobId: string): Promise<EvaluationJobV1> {
  const value = await repository.getJob(jobId);
  if (!value) throw new LeaseLostSignal("Job disappeared during execution.");
  return value;
}

function addMilliseconds(iso: string, milliseconds: number): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) throw new TypeError("Runtime clock must return an ISO-compatible date-time.");
  return new Date(parsed + milliseconds).toISOString();
}

function mapRepositoryError<T>(error: unknown): EvaluationRuntimeResult<T> {
  return error instanceof RuntimeRepositoryConflictError
    ? failure("CONCURRENT_MODIFICATION", "/revision", error.message)
    : repositoryFailure(error);
}

function repositoryFailure<T>(error: unknown): EvaluationRuntimeResult<T> {
  return failure("RUNTIME_REPOSITORY_ERROR", "/repository", `Runtime repository failed: ${errorMessage(error)}`);
}

function failure<T>(code: EvaluationRuntimeIssue["code"], path: string, message: string): EvaluationRuntimeResult<T> {
  return { ok: false, issues: [issue(code, path, message)] };
}

function issue(code: EvaluationRuntimeIssue["code"], path: string, message: string): EvaluationRuntimeIssue {
  return { code, path, message };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
