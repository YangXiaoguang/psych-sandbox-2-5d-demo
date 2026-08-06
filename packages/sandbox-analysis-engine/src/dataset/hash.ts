import type {
  EvaluationDatasetCaseReferenceV1,
  EvaluationTargetPlanV1,
} from "../contracts/dataset.js";
import { compareStrings } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";

export const EVALUATION_DATASET_POLICY_V1 = Object.freeze({
  expertLabeledCasesOnly: true,
  goldRequiresAdjudication: true,
  groupExclusivePartitions: true,
  trainingUseAllowed: false,
  testPartitionBlindUntilRun: true,
} as const);

export function computeEvaluationDatasetHash(input: {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly targetPlan: EvaluationTargetPlanV1;
  readonly cases: readonly EvaluationDatasetCaseReferenceV1[];
}): string {
  return hashCanonicalJson({
    datasetId: input.datasetId,
    datasetVersion: input.datasetVersion,
    targetPlan: input.targetPlan,
    cases: [...input.cases].sort((left, right) => compareStrings(left.caseId, right.caseId)),
    policy: EVALUATION_DATASET_POLICY_V1,
  });
}
