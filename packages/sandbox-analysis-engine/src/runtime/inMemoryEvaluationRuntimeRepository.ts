import type {
  EvaluationJobEventV1,
  EvaluationJobV1,
  EvaluationRuntimeRepositoryPort,
  ExperimentAuditBundleV1,
} from "../contracts/runtime.js";
import type { BenchmarkReportV1, ModelEvaluationRunV1 } from "../contracts/evaluation.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";

export class RuntimeRepositoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeRepositoryConflictError";
  }
}

export class InMemoryEvaluationRuntimeRepository implements EvaluationRuntimeRepositoryPort {
  readonly #jobs = new Map<string, EvaluationJobV1>();
  readonly #jobByIdempotency = new Map<string, string>();
  readonly #events = new Map<string, EvaluationJobEventV1[]>();
  readonly #runs = new Map<string, ModelEvaluationRunV1>();
  readonly #reports = new Map<string, BenchmarkReportV1>();

  async createJob(job: EvaluationJobV1, event: EvaluationJobEventV1): Promise<void> {
    if (this.#jobs.has(job.jobId) || this.#jobByIdempotency.has(job.idempotencyKey)) {
      throw new RuntimeRepositoryConflictError("Job ID or idempotency key already exists.");
    }
    if (job.revision !== 0 || event.sequence !== 1 || event.jobId !== job.jobId) {
      throw new RuntimeRepositoryConflictError("Initial job revision or event sequence is invalid.");
    }
    this.#jobs.set(job.jobId, immutableCopy(job));
    this.#jobByIdempotency.set(job.idempotencyKey, job.jobId);
    this.#events.set(job.jobId, [immutableCopy(event)]);
  }

  async updateJob(job: EvaluationJobV1, event: EvaluationJobEventV1, expectedRevision: number): Promise<void> {
    const current = this.#jobs.get(job.jobId);
    const events = this.#events.get(job.jobId);
    if (!current || !events) throw new RuntimeRepositoryConflictError("Job does not exist.");
    if (current.revision !== expectedRevision || job.revision !== expectedRevision + 1) {
      throw new RuntimeRepositoryConflictError(`Expected revision ${expectedRevision}, found ${current.revision}.`);
    }
    if (event.jobId !== job.jobId || event.sequence !== events.length + 1 || event.attempt !== job.attempt) {
      throw new RuntimeRepositoryConflictError("Job event is not the next event in the stream.");
    }
    this.#jobs.set(job.jobId, immutableCopy(job));
    events.push(immutableCopy(event));
  }

  async getJob(jobId: string): Promise<EvaluationJobV1 | null> {
    const value = this.#jobs.get(jobId);
    return value ? immutableCopy(value) : null;
  }

  async findJobByIdempotencyKey(idempotencyKey: string): Promise<EvaluationJobV1 | null> {
    const jobId = this.#jobByIdempotency.get(idempotencyKey);
    if (!jobId) return null;
    const value = this.#jobs.get(jobId);
    return value ? immutableCopy(value) : null;
  }

  async listJobEvents(jobId: string): Promise<readonly EvaluationJobEventV1[]> {
    return deepFreeze((this.#events.get(jobId) ?? [])
      .slice()
      .sort((left, right) => left.sequence - right.sequence || compareStrings(left.eventId, right.eventId))
      .map((value) => immutableCopy(value)));
  }

  async saveRun(run: ModelEvaluationRunV1): Promise<void> {
    saveImmutable(this.#runs, run.runId, run, "Model run");
  }

  async getRun(runId: string): Promise<ModelEvaluationRunV1 | null> {
    const value = this.#runs.get(runId);
    return value ? immutableCopy(value) : null;
  }

  async saveReport(report: BenchmarkReportV1): Promise<void> {
    saveImmutable(this.#reports, report.reportId, report, "Benchmark report");
  }

  async getReport(reportId: string): Promise<BenchmarkReportV1 | null> {
    const value = this.#reports.get(reportId);
    return value ? immutableCopy(value) : null;
  }

  async restoreAuditBundleArtifacts(bundle: ExperimentAuditBundleV1): Promise<void> {
    if (this.#jobs.has(bundle.job.jobId) || this.#jobByIdempotency.has(bundle.job.idempotencyKey)) {
      throw new RuntimeRepositoryConflictError("Audit bundle job or idempotency key already exists.");
    }
    if (this.#runs.has(bundle.run.runId) || this.#reports.has(bundle.report.reportId)) {
      throw new RuntimeRepositoryConflictError("Audit bundle run or report already exists.");
    }
    const expectedSequences = bundle.events.every((event, index) => event.sequence === index + 1 && event.jobId === bundle.job.jobId);
    if (!expectedSequences) throw new RuntimeRepositoryConflictError("Audit bundle event stream is not contiguous.");

    this.#jobs.set(bundle.job.jobId, immutableCopy(bundle.job));
    this.#jobByIdempotency.set(bundle.job.idempotencyKey, bundle.job.jobId);
    this.#events.set(bundle.job.jobId, bundle.events.map((value) => immutableCopy(value)));
    this.#runs.set(bundle.run.runId, immutableCopy(bundle.run));
    this.#reports.set(bundle.report.reportId, immutableCopy(bundle.report));
  }
}

function saveImmutable<T>(store: Map<string, T>, id: string, value: T, label: string): void {
  const existing = store.get(id);
  if (existing && hashCanonicalJson(existing) !== hashCanonicalJson(value)) {
    throw new RuntimeRepositoryConflictError(`${label} ID already contains different content.`);
  }
  if (!existing) store.set(id, immutableCopy(value));
}

function immutableCopy<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T) as T;
}
