import type { SandboxAnalysisResultV1 } from "./analysis.js";
import type { ReviewCaseBundleV1 } from "./review.js";
import type { CurrentSandboxSnapshotV1 } from "./snapshot.js";

export const SANDBOX_EVALUATION_CASE_V1 = "sandbox.evaluation-case.v1" as const;
export const SANDBOX_EVALUATION_DATASET_V1 = "sandbox.evaluation-dataset.v1" as const;
export const SANDBOX_DATASET_MANIFEST_V1 = "sandbox.evaluation-dataset-manifest.v1" as const;
export const SANDBOX_DATA_REVOCATION_V1 = "sandbox.data-revocation.v1" as const;

export type EvaluationPartition = "train" | "dev" | "test";
export type EvaluationTier = "gold" | "validation" | "challenge";
export type EvaluationCohort =
  | "empty_and_minimal"
  | "sparse_relations"
  | "dense_complex"
  | "center_boundary_composition"
  | "symbolic_ambiguity"
  | "schema_edge_cases"
  | "safety_adversarial";
export type DatasetAllowedPurpose = "evaluation" | "prompt_calibration" | "safety_research";
export type DatasetStatus = "collection_required" | "ready" | "frozen";

export interface EvaluationCaseGovernanceV1 {
  readonly sourceKind: "synthetic" | "deidentified_real";
  readonly sourceRecordPseudonym: string;
  readonly deidentified: true;
  readonly directIdentityPresent: false;
  readonly consentRecordId: string | null;
  readonly ethicsApprovalId: string | null;
  readonly allowedPurposes: readonly DatasetAllowedPurpose[];
  readonly trainingUseAllowed: false;
  readonly revocationSnapshotHash: string;
  readonly retentionUntil: string | null;
}

export interface EvaluationCaseCandidateV1 {
  readonly caseId: string;
  readonly sourceGroupId: string;
  readonly cohort: EvaluationCohort;
  readonly partition: EvaluationPartition;
  readonly tier: EvaluationTier;
  readonly challengeTags: readonly string[];
  readonly snapshot: CurrentSandboxSnapshotV1;
  readonly reviewBundle: ReviewCaseBundleV1;
  readonly governance: EvaluationCaseGovernanceV1;
}

export interface EvaluationCaseV1 extends EvaluationCaseCandidateV1 {
  readonly schemaVersion: typeof SANDBOX_EVALUATION_CASE_V1;
  readonly caseHash: string;
  readonly snapshotHash: string;
  readonly finalAnalysisHash: string;
  readonly finalAnalysis: SandboxAnalysisResultV1;
  readonly importedAt: string;
}

export interface EvaluationTargetPlanV1 {
  readonly totalCases: number;
  readonly partitions: Readonly<Record<EvaluationPartition, number>>;
  readonly cohorts: Readonly<Record<EvaluationCohort, number>>;
}

export interface EvaluationDatasetCaseReferenceV1 {
  readonly caseId: string;
  readonly caseHash: string;
  readonly snapshotHash: string;
  readonly sourceGroupId: string;
  readonly cohort: EvaluationCohort;
  readonly partition: EvaluationPartition;
  readonly tier: EvaluationTier;
  readonly finalAnalysisHash: string;
}

export interface EvaluationDatasetManifestV1 {
  readonly schemaVersion: typeof SANDBOX_DATASET_MANIFEST_V1;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly status: DatasetStatus;
  readonly datasetHash: string;
  readonly createdAt: string;
  readonly frozenAt: string | null;
  readonly targetPlan: EvaluationTargetPlanV1;
  readonly actualCounts: {
    readonly totalCases: number;
    readonly partitions: Readonly<Record<EvaluationPartition, number>>;
    readonly cohorts: Readonly<Record<EvaluationCohort, number>>;
    readonly tiers: Readonly<Record<EvaluationTier, number>>;
  };
  readonly cases: readonly EvaluationDatasetCaseReferenceV1[];
  readonly policy: {
    readonly expertLabeledCasesOnly: true;
    readonly goldRequiresAdjudication: true;
    readonly groupExclusivePartitions: true;
    readonly trainingUseAllowed: false;
    readonly testPartitionBlindUntilRun: true;
  };
}

export interface EvaluationDatasetV1 {
  readonly schemaVersion: typeof SANDBOX_EVALUATION_DATASET_V1;
  readonly manifest: EvaluationDatasetManifestV1;
  readonly cases: readonly EvaluationCaseV1[];
}

export interface EvaluationDatasetBuildRequestV1 {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly targetPlan: EvaluationTargetPlanV1;
  readonly freeze: boolean;
}

export interface DataRevocationRecordV1 {
  readonly schemaVersion: typeof SANDBOX_DATA_REVOCATION_V1;
  readonly revocationId: string;
  readonly snapshotHash: string;
  readonly removedCaseIds: readonly string[];
  readonly requestedByPseudonym: string;
  readonly reason: string;
  readonly revokedAt: string;
}

export type DatasetIssueCode =
  | "INVALID_CASE_METADATA"
  | "INVALID_GOVERNANCE"
  | "PRIVACY_SCAN_FAILED"
  | "SNAPSHOT_INVALID"
  | "SNAPSHOT_HASH_MISMATCH"
  | "REVIEW_BUNDLE_INVALID"
  | "GOLD_ADJUDICATION_REQUIRED"
  | "DUPLICATE_CASE"
  | "PARTITION_LEAKAGE"
  | "DATASET_PLAN_INVALID"
  | "DATASET_INCOMPLETE"
  | "DATASET_FROZEN"
  | "CASE_NOT_FOUND"
  | "REPOSITORY_ERROR";

export interface DatasetIssue {
  readonly code: DatasetIssueCode;
  readonly path: string;
  readonly message: string;
}

export type DatasetResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly DatasetIssue[] };

export interface EvaluationDatasetRepositoryPort {
  saveCase(value: EvaluationCaseV1): Promise<void>;
  listCases(): Promise<readonly EvaluationCaseV1[]>;
  removeCasesBySnapshotHash(snapshotHash: string): Promise<readonly string[]>;
  saveRevocation(value: DataRevocationRecordV1): Promise<void>;
  listRevocations(): Promise<readonly DataRevocationRecordV1[]>;
}

export interface EvaluationDatasetService {
  admitCase(candidate: EvaluationCaseCandidateV1): Promise<DatasetResult<EvaluationCaseV1>>;
  buildDataset(request: EvaluationDatasetBuildRequestV1): Promise<DatasetResult<EvaluationDatasetV1>>;
  revokeBySnapshotHash(snapshotHash: string, requestedByPseudonym: string, reason: string): Promise<DatasetResult<DataRevocationRecordV1>>;
  listRevocations(): Promise<DatasetResult<readonly DataRevocationRecordV1[]>>;
}

export interface CreateEvaluationDatasetServiceOptions {
  readonly repository?: EvaluationDatasetRepositoryPort;
  readonly clock?: { now(): string };
  readonly idGenerator?: { createId(prefix: string): string };
}
