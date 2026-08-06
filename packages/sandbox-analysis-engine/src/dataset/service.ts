import type {
  CreateEvaluationDatasetServiceOptions,
  DataRevocationRecordV1,
  DatasetIssue,
  DatasetResult,
  EvaluationCaseCandidateV1,
  EvaluationCaseV1,
  EvaluationCohort,
  EvaluationDatasetBuildRequestV1,
  EvaluationDatasetCaseReferenceV1,
  EvaluationDatasetService,
  EvaluationDatasetV1,
  EvaluationPartition,
  EvaluationTargetPlanV1,
  EvaluationTier,
} from "../contracts/dataset.js";
import {
  SANDBOX_DATA_REVOCATION_V1,
  SANDBOX_DATASET_MANIFEST_V1,
  SANDBOX_EVALUATION_CASE_V1,
  SANDBOX_EVALUATION_DATASET_V1,
} from "../contracts/dataset.js";
import type { SandboxAnalysisResultV1 } from "../contracts/analysis.js";
import { createSandboxAnalysisEngine } from "../engine.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";
import { computeEvaluationDatasetHash, EVALUATION_DATASET_POLICY_V1 } from "./hash.js";
import { InMemoryEvaluationDatasetRepository } from "./inMemoryEvaluationDatasetRepository.js";
import { scanEvaluationCasePrivacy } from "./privacy.js";

const PARTITIONS: readonly EvaluationPartition[] = ["train", "dev", "test"];
const TIERS: readonly EvaluationTier[] = ["gold", "validation", "challenge"];
const COHORTS: readonly EvaluationCohort[] = [
  "empty_and_minimal",
  "sparse_relations",
  "dense_complex",
  "center_boundary_composition",
  "symbolic_ambiguity",
  "schema_edge_cases",
  "safety_adversarial",
];

export const DEFAULT_EVALUATION_TARGET_PLAN_V1: EvaluationTargetPlanV1 = deepFreeze({
  totalCases: 24,
  partitions: { train: 12, dev: 6, test: 6 },
  cohorts: {
    empty_and_minimal: 3,
    sparse_relations: 4,
    dense_complex: 4,
    center_boundary_composition: 4,
    symbolic_ambiguity: 4,
    schema_edge_cases: 3,
    safety_adversarial: 2,
  },
});

let defaultId = 0;

export function createEvaluationDatasetService(
  options: CreateEvaluationDatasetServiceOptions = {},
): EvaluationDatasetService {
  const repository = options.repository ?? new InMemoryEvaluationDatasetRepository();
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const idGenerator = options.idGenerator ?? { createId: (prefix: string) => `${prefix}-${++defaultId}` };
  const snapshotEngine = createSandboxAnalysisEngine();
  let frozen = false;

  return {
    async admitCase(candidate) {
      if (frozen) return failure("DATASET_FROZEN", "/", "The current dataset collection is frozen; start a new dataset version before admitting cases.");
      const issues = validateMetadata(candidate)
        .concat(validateGovernance(candidate))
        .concat(scanEvaluationCasePrivacy(candidate));
      const snapshotValidation = snapshotEngine.validateSnapshot(candidate?.snapshot);
      if (!snapshotValidation.ok) {
        snapshotValidation.issues.forEach((item) => issues.push({
          code: "SNAPSHOT_INVALID",
          path: `/snapshot${item.path}`,
          message: `${item.code}: ${item.message}`,
        }));
      }
      if (issues.length > 0 || !snapshotValidation.ok) return { ok: false, issues };

      const snapshotHash = hashCanonicalJson(snapshotValidation.value);
      if (candidate.governance.revocationSnapshotHash !== snapshotHash) {
        issues.push(issue("SNAPSHOT_HASH_MISMATCH", "/governance/revocationSnapshotHash", "Revocation hash must exactly match the admitted snapshot."));
      }
      const review = validateReviewBundle(candidate, snapshotHash);
      issues.push(...review.issues);
      if (!review.finalAnalysis || issues.length > 0) return { ok: false, issues };

      try {
        const existing = await repository.listCases();
        if (existing.some((item) => item.caseId === candidate.caseId || item.snapshotHash === snapshotHash)) {
          issues.push(issue("DUPLICATE_CASE", "/caseId", "Case ID and snapshot hash must be unique within the governed collection."));
        }
        if (existing.some((item) => item.sourceGroupId === candidate.sourceGroupId && item.partition !== candidate.partition)) {
          issues.push(issue("PARTITION_LEAKAGE", "/sourceGroupId", "All cases from the same source group must remain in one partition."));
        }
        if (issues.length > 0) return { ok: false, issues };

        const finalAnalysisHash = hashCanonicalJson(review.finalAnalysis);
        const caseHash = hashCanonicalJson({
          schemaVersion: SANDBOX_EVALUATION_CASE_V1,
          caseId: candidate.caseId,
          sourceGroupId: candidate.sourceGroupId,
          cohort: candidate.cohort,
          partition: candidate.partition,
          tier: candidate.tier,
          challengeTags: [...candidate.challengeTags].sort(compareStrings),
          snapshotHash,
          reviewExportId: candidate.reviewBundle.exportId,
          finalAnalysisHash,
          governance: candidate.governance,
        });
        if (existing.some((item) => item.caseHash === caseHash)) {
          return failure("DUPLICATE_CASE", "/", "This governed case content has already been admitted.");
        }
        const value: EvaluationCaseV1 = deepFreeze({
          schemaVersion: SANDBOX_EVALUATION_CASE_V1,
          ...candidate,
          challengeTags: [...candidate.challengeTags].sort(compareStrings),
          snapshot: snapshotValidation.value,
          caseHash,
          snapshotHash,
          finalAnalysisHash,
          finalAnalysis: review.finalAnalysis,
          importedAt: clock.now(),
        });
        await repository.saveCase(value);
        return { ok: true, value };
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async buildDataset(request) {
      const planIssues = validateBuildRequest(request);
      if (planIssues.length > 0) return { ok: false, issues: planIssues };
      try {
        const cases = [...await repository.listCases()].sort((left, right) => compareStrings(left.caseId, right.caseId));
        const actualCounts = countCases(cases);
        const complete = targetSatisfied(request.targetPlan, actualCounts);
        if (request.freeze && !complete) {
          return failure("DATASET_INCOMPLETE", "/targetPlan", "A dataset can be frozen only when every partition and cohort target is met exactly.");
        }
        const references = cases.map(toCaseReference);
        const datasetHash = computeEvaluationDatasetHash({
          datasetId: request.datasetId.trim(),
          datasetVersion: request.datasetVersion.trim(),
          targetPlan: request.targetPlan,
          cases: references,
        });
        const now = clock.now();
        const status = request.freeze ? "frozen" : complete ? "ready" : "collection_required";
        const value: EvaluationDatasetV1 = deepFreeze({
          schemaVersion: SANDBOX_EVALUATION_DATASET_V1,
          manifest: {
            schemaVersion: SANDBOX_DATASET_MANIFEST_V1,
            datasetId: request.datasetId.trim(),
            datasetVersion: request.datasetVersion.trim(),
            status,
            datasetHash,
            createdAt: now,
            frozenAt: request.freeze ? now : null,
            targetPlan: request.targetPlan,
            actualCounts,
            cases: references,
            policy: EVALUATION_DATASET_POLICY_V1,
          },
          cases,
        });
        if (request.freeze) frozen = true;
        return { ok: true, value };
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async revokeBySnapshotHash(snapshotHash, requestedByPseudonym, reason) {
      const issues: DatasetIssue[] = [];
      if (!/^[a-f0-9]{64}$/u.test(snapshotHash)) issues.push(issue("INVALID_GOVERNANCE", "/snapshotHash", "Snapshot hash must be a lowercase SHA-256 value."));
      if (!validPseudonym(requestedByPseudonym)) issues.push(issue("INVALID_GOVERNANCE", "/requestedByPseudonym", "A non-email revocation requester pseudonym is required."));
      if (!reason?.trim()) issues.push(issue("INVALID_GOVERNANCE", "/reason", "A revocation reason is required."));
      if (issues.length > 0) return { ok: false, issues };
      try {
        const removedCaseIds = await repository.removeCasesBySnapshotHash(snapshotHash);
        if (removedCaseIds.length === 0) return failure("CASE_NOT_FOUND", "/snapshotHash", "No admitted case matches this revocation hash.");
        const value: DataRevocationRecordV1 = deepFreeze({
          schemaVersion: SANDBOX_DATA_REVOCATION_V1,
          revocationId: idGenerator.createId("revocation"),
          snapshotHash,
          removedCaseIds,
          requestedByPseudonym: requestedByPseudonym.trim(),
          reason: reason.trim(),
          revokedAt: clock.now(),
        });
        await repository.saveRevocation(value);
        frozen = false;
        return { ok: true, value };
      } catch (error) {
        return repositoryFailure(error);
      }
    },

    async listRevocations() {
      try {
        return { ok: true, value: await repository.listRevocations() };
      } catch (error) {
        return repositoryFailure(error);
      }
    },
  };
}

function validateMetadata(candidate: EvaluationCaseCandidateV1): DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  for (const [path, value] of [["/caseId", candidate?.caseId], ["/sourceGroupId", candidate?.sourceGroupId]] as const) {
    if (!validPseudonym(value)) issues.push(issue("INVALID_CASE_METADATA", path, "A non-email identifier of 1-128 characters is required."));
  }
  if (!COHORTS.includes(candidate?.cohort)) issues.push(issue("INVALID_CASE_METADATA", "/cohort", "Unknown evaluation cohort."));
  if (!PARTITIONS.includes(candidate?.partition)) issues.push(issue("INVALID_CASE_METADATA", "/partition", "Unknown evaluation partition."));
  if (!TIERS.includes(candidate?.tier)) issues.push(issue("INVALID_CASE_METADATA", "/tier", "Unknown evaluation tier."));
  if (!Array.isArray(candidate?.challengeTags) || new Set(candidate.challengeTags).size !== candidate.challengeTags.length || candidate.challengeTags.some((tag) => !tag?.trim())) {
    issues.push(issue("INVALID_CASE_METADATA", "/challengeTags", "Challenge tags must be unique, non-empty strings."));
  }
  return issues;
}

function validateGovernance(candidate: EvaluationCaseCandidateV1): DatasetIssue[] {
  const value = candidate?.governance;
  const issues: DatasetIssue[] = [];
  if (!value || !["synthetic", "deidentified_real"].includes(value.sourceKind)) issues.push(issue("INVALID_GOVERNANCE", "/governance/sourceKind", "Source kind is required."));
  if (!validPseudonym(value?.sourceRecordPseudonym)) issues.push(issue("INVALID_GOVERNANCE", "/governance/sourceRecordPseudonym", "A non-email source pseudonym is required."));
  if (value?.deidentified !== true || value?.directIdentityPresent !== false || value?.trainingUseAllowed !== false) {
    issues.push(issue("INVALID_GOVERNANCE", "/governance", "Cases must be de-identified, contain no direct identity and prohibit training use."));
  }
  if (!Array.isArray(value?.allowedPurposes) || !value.allowedPurposes.includes("evaluation") || new Set(value.allowedPurposes).size !== value.allowedPurposes.length) {
    issues.push(issue("INVALID_GOVERNANCE", "/governance/allowedPurposes", "Allowed purposes must be unique and include evaluation."));
  }
  if (value?.sourceKind === "deidentified_real" && (!value.consentRecordId?.trim() || !value.ethicsApprovalId?.trim())) {
    issues.push(issue("INVALID_GOVERNANCE", "/governance", "De-identified real cases require both consent and ethics approval references."));
  }
  if (value?.retentionUntil !== null && (!value?.retentionUntil || Number.isNaN(Date.parse(value.retentionUntil)))) {
    issues.push(issue("INVALID_GOVERNANCE", "/governance/retentionUntil", "Retention date must be null or an ISO-compatible date-time."));
  }
  return issues;
}

function validateReviewBundle(candidate: EvaluationCaseCandidateV1, snapshotHash: string): {
  readonly issues: DatasetIssue[];
  readonly finalAnalysis: SandboxAnalysisResultV1 | null;
} {
  const bundle = candidate?.reviewBundle;
  const issues: DatasetIssue[] = [];
  if (!bundle || bundle.goldEligibility?.eligible !== true || !bundle.adjudication) {
    return { issues: [issue("GOLD_ADJUDICATION_REQUIRED", "/reviewBundle", "An eligible expert-adjudicated review bundle is required.")], finalAnalysis: null };
  }
  if (bundle.adjudication.status !== "accepted" || !bundle.adjudication.goldEligible || bundle.adjudication.goldIneligibilityReasons.length > 0) {
    issues.push(issue("GOLD_ADJUDICATION_REQUIRED", "/reviewBundle/adjudication", "Adjudication must be accepted and gold eligible."));
  }
  if (bundle.originalAnalysis.snapshotId !== candidate.snapshot.snapshotId || bundle.originalAnalysis.snapshotHash !== snapshotHash) {
    issues.push(issue("SNAPSHOT_HASH_MISMATCH", "/reviewBundle/originalAnalysis", "Review bundle must be bound to the admitted snapshot ID and hash."));
  }
  if (hashCanonicalJson(bundle.originalAnalysis) !== bundle.originalAnalysisHash) {
    issues.push(issue("REVIEW_BUNDLE_INVALID", "/reviewBundle/originalAnalysisHash", "Original analysis hash is invalid."));
  }
  const selectedRevision = bundle.adjudication.selectedRevisionVersionId
    ? bundle.revisionHistory.find((item) => item.versionId === bundle.adjudication!.selectedRevisionVersionId)
    : undefined;
  if (bundle.adjudication.selectedRevisionVersionId && !selectedRevision) {
    issues.push(issue("REVIEW_BUNDLE_INVALID", "/reviewBundle/adjudication/selectedRevisionVersionId", "Selected revision is missing from revision history."));
  }
  const finalAnalysis = selectedRevision?.analysis ?? bundle.originalAnalysis;
  const finalHash = hashCanonicalJson(finalAnalysis);
  if (finalHash !== bundle.adjudication.finalAnalysisHash) {
    issues.push(issue("REVIEW_BUNDLE_INVALID", "/reviewBundle/adjudication/finalAnalysisHash", "Adjudicated final hash does not match the selected analysis."));
  }
  const selectedReviews = bundle.adjudication.reviewIds.map((reviewId) => bundle.reviews.find((review) => review.reviewId === reviewId));
  if (selectedReviews.some((review) => !review) || new Set(selectedReviews.map((review) => review?.reviewerPseudonym)).size < 2) {
    issues.push(issue("GOLD_ADJUDICATION_REQUIRED", "/reviewBundle/adjudication/reviewIds", "At least two present, independent expert reviews are required."));
  }
  selectedReviews.forEach((review, index) => {
    if (!review || review.status !== "accepted" || review.analysisHash !== finalHash) {
      issues.push(issue("GOLD_ADJUDICATION_REQUIRED", `/reviewBundle/adjudication/reviewIds/${index}`, "Every selected review must accept the exact final analysis hash."));
    }
  });
  return { issues, finalAnalysis };
}

function validateBuildRequest(request: EvaluationDatasetBuildRequestV1): DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  if (!request?.datasetId?.trim() || !request?.datasetVersion?.trim()) issues.push(issue("DATASET_PLAN_INVALID", "/", "Dataset ID and version are required."));
  const plan = request?.targetPlan;
  if (!plan || !isCount(plan.totalCases)) return issues.concat(issue("DATASET_PLAN_INVALID", "/targetPlan", "Target plan counts must be non-negative integers."));
  const partitionTotal = PARTITIONS.reduce((sum, key) => sum + (plan.partitions?.[key] ?? Number.NaN), 0);
  const cohortTotal = COHORTS.reduce((sum, key) => sum + (plan.cohorts?.[key] ?? Number.NaN), 0);
  if (!PARTITIONS.every((key) => isCount(plan.partitions?.[key])) || partitionTotal !== plan.totalCases) issues.push(issue("DATASET_PLAN_INVALID", "/targetPlan/partitions", "Partition targets must be non-negative integers summing to totalCases."));
  if (!COHORTS.every((key) => isCount(plan.cohorts?.[key])) || cohortTotal !== plan.totalCases) issues.push(issue("DATASET_PLAN_INVALID", "/targetPlan/cohorts", "Cohort targets must be non-negative integers summing to totalCases."));
  return issues;
}

function countCases(cases: readonly EvaluationCaseV1[]) {
  const partitions = Object.fromEntries(PARTITIONS.map((key) => [key, cases.filter((item) => item.partition === key).length])) as Record<EvaluationPartition, number>;
  const cohorts = Object.fromEntries(COHORTS.map((key) => [key, cases.filter((item) => item.cohort === key).length])) as Record<EvaluationCohort, number>;
  const tiers = Object.fromEntries(TIERS.map((key) => [key, cases.filter((item) => item.tier === key).length])) as Record<EvaluationTier, number>;
  return deepFreeze({ totalCases: cases.length, partitions, cohorts, tiers });
}

function targetSatisfied(target: EvaluationTargetPlanV1, actual: ReturnType<typeof countCases>): boolean {
  return actual.totalCases === target.totalCases
    && PARTITIONS.every((key) => actual.partitions[key] === target.partitions[key])
    && COHORTS.every((key) => actual.cohorts[key] === target.cohorts[key]);
}

function toCaseReference(value: EvaluationCaseV1): EvaluationDatasetCaseReferenceV1 {
  return deepFreeze({
    caseId: value.caseId,
    caseHash: value.caseHash,
    snapshotHash: value.snapshotHash,
    sourceGroupId: value.sourceGroupId,
    cohort: value.cohort,
    partition: value.partition,
    tier: value.tier,
    finalAnalysisHash: value.finalAnalysisHash,
  });
}

function validPseudonym(value: string | undefined): boolean {
  return Boolean(value?.trim() && value.trim().length <= 128 && !value.includes("@"));
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function issue(code: DatasetIssue["code"], path: string, message: string): DatasetIssue {
  return { code, path, message };
}

function failure<T>(code: DatasetIssue["code"], path: string, message: string): DatasetResult<T> {
  return { ok: false, issues: [issue(code, path, message)] };
}

function repositoryFailure<T>(error: unknown): DatasetResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  return failure("REPOSITORY_ERROR", "/repository", `Dataset repository failed: ${message}`);
}
