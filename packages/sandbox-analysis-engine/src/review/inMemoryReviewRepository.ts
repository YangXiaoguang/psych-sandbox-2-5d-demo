import type {
  ExpertReviewRecordV1,
  ReviewAdjudicationRecordV1,
  ReviewRepositoryPort,
  RevisedAnalysisVersionV1,
} from "../contracts/review.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";

export class InMemoryReviewRepository implements ReviewRepositoryPort {
  readonly #reviews = new Map<string, ExpertReviewRecordV1>();
  readonly #revisions = new Map<string, RevisedAnalysisVersionV1>();
  readonly #adjudications = new Map<string, ReviewAdjudicationRecordV1>();

  async saveReview(review: ExpertReviewRecordV1): Promise<void> {
    this.#reviews.set(review.reviewId, immutableCopy(review));
  }

  async listReviews(analysisId: string): Promise<readonly ExpertReviewRecordV1[]> {
    return deepFreeze([...this.#reviews.values()]
      .filter((review) => review.analysisId === analysisId)
      .sort((left, right) => compareStrings(left.createdAt, right.createdAt) || compareStrings(left.reviewId, right.reviewId))
      .map((review) => immutableCopy(review)));
  }

  async saveRevision(version: RevisedAnalysisVersionV1): Promise<void> {
    this.#revisions.set(version.versionId, immutableCopy(version));
  }

  async listRevisions(analysisId: string): Promise<readonly RevisedAnalysisVersionV1[]> {
    return deepFreeze([...this.#revisions.values()]
      .filter((version) => version.analysisId === analysisId)
      .sort((left, right) => left.sequence - right.sequence || compareStrings(left.versionId, right.versionId))
      .map((version) => immutableCopy(version)));
  }

  async saveAdjudication(adjudication: ReviewAdjudicationRecordV1): Promise<void> {
    this.#adjudications.set(adjudication.analysisId, immutableCopy(adjudication));
  }

  async getAdjudication(analysisId: string): Promise<ReviewAdjudicationRecordV1 | null> {
    const adjudication = this.#adjudications.get(analysisId);
    return adjudication ? immutableCopy(adjudication) : null;
  }
}

function immutableCopy<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}
