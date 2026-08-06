import type {
  DataRevocationRecordV1,
  EvaluationCaseV1,
  EvaluationDatasetRepositoryPort,
} from "../contracts/dataset.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";

export class InMemoryEvaluationDatasetRepository implements EvaluationDatasetRepositoryPort {
  readonly #cases = new Map<string, EvaluationCaseV1>();
  readonly #revocations = new Map<string, DataRevocationRecordV1>();

  async saveCase(value: EvaluationCaseV1): Promise<void> {
    this.#cases.set(value.caseId, immutableCopy(value));
  }

  async listCases(): Promise<readonly EvaluationCaseV1[]> {
    return deepFreeze([...this.#cases.values()]
      .sort((left, right) => compareStrings(left.caseId, right.caseId))
      .map((value) => immutableCopy(value)));
  }

  async removeCasesBySnapshotHash(snapshotHash: string): Promise<readonly string[]> {
    const removed = [...this.#cases.values()]
      .filter((value) => value.snapshotHash === snapshotHash)
      .map((value) => value.caseId)
      .sort(compareStrings);
    removed.forEach((caseId) => this.#cases.delete(caseId));
    return deepFreeze(removed);
  }

  async saveRevocation(value: DataRevocationRecordV1): Promise<void> {
    this.#revocations.set(value.revocationId, immutableCopy(value));
  }

  async listRevocations(): Promise<readonly DataRevocationRecordV1[]> {
    return deepFreeze([...this.#revocations.values()]
      .sort((left, right) => compareStrings(left.revokedAt, right.revokedAt) || compareStrings(left.revocationId, right.revocationId))
      .map((value) => immutableCopy(value)));
  }
}

function immutableCopy<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T) as T;
}
