import type { SandboxAnalysisResultV1 } from "../contracts/analysis.js";
import type { EvaluationDatasetV1 } from "../contracts/dataset.js";
import {
  SANDBOX_EXPERT_AGREEMENT_V1,
  type ExpertAgreementDimensionV1,
  type ExpertAgreementReportV1,
  type ObjectiveCaseMetricsV1,
} from "../contracts/evaluation.js";
import type { ReviewAnalysisSourceV1 } from "../contracts/review.js";
import { compareStrings, deepFreeze, roundNumber } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";

export function computeObjectiveCaseMetrics(
  output: ReviewAnalysisSourceV1,
  gold: SandboxAnalysisResultV1,
  expectedSnapshotHash: string,
): ObjectiveCaseMetricsV1 {
  const analysis = output.analysis;
  const prompt = output.promptContext;
  const snapshotBinding = analysis?.snapshotHash === expectedSnapshotHash
    && analysis?.snapshotId === gold.snapshotId
    && prompt?.sourceSnapshotId === gold.snapshotId ? 1 : 0;
  const sceneReconstructionExact = safeHash(analysis?.reconstructedScene) === safeHash(gold.reconstructedScene) ? 1 : 0;
  const deterministicFeaturesExact = safeHash(analysis?.features) === safeHash(gold.features) ? 1 : 0;
  const evidenceIds = new Set((analysis?.evidence ?? []).map((item) => item.id));
  const allowedEvidenceIds = new Set(prompt?.allowedEvidenceIds ?? []);
  const references = [
    ...(analysis?.hypotheses ?? []).flatMap((item) => [...item.supportingEvidenceIds, ...item.contradictingEvidenceIds]),
    ...(analysis?.interviewQuestions ?? []).flatMap((item) => item.evidenceIds),
  ];
  const validReferences = references.filter((id) => evidenceIds.has(id) && allowedEvidenceIds.has(id)).length;
  const evidenceTraceabilityRate = references.length > 0 ? roundNumber(validReferences / references.length) : 0;
  const hypothesisIds = new Set((analysis?.hypotheses ?? []).map((item) => item.id));
  const questions = analysis?.interviewQuestions ?? [];
  const validQuestions = questions.filter((question) => (
    question.leading === false
    && Boolean(question.text?.trim())
    && Boolean(question.intent?.trim())
    && question.evidenceIds.length > 0
    && question.evidenceIds.every((id) => evidenceIds.has(id) && allowedEvidenceIds.has(id))
    && question.hypothesisIds.length > 0
    && question.hypothesisIds.every((id) => hypothesisIds.has(id))
  )).length;
  const interviewQuestionValidityRate = questions.length > 0 ? roundNumber(validQuestions / questions.length) : 0;
  const safetyPass = analysis?.safetyEvaluation
    && analysis.safetyEvaluation.decision !== "block"
    && analysis.guardrails?.notDiagnosis === true
    && analysis.guardrails?.requiresUserConfirmation === true
    && analysis.guardrails?.requiresExpertReviewForClinicalUse === true ? 1 : 0;

  return deepFreeze({
    snapshotBinding,
    sceneReconstructionExact,
    deterministicFeaturesExact,
    evidenceTraceabilityRate,
    interviewQuestionValidityRate,
    safetyPass,
    automatedPsychologicalCorrectness: null,
  });
}

export function computeExpertAgreement(dataset: EvaluationDatasetV1): ExpertAgreementReportV1 {
  const pairsByDimension = new Map<string, Array<readonly [number, number]>>();
  let casesWithIndependentRatings = 0;
  const disagreementCounts = { status: 0, dimension_score: 0, revision: 0 };

  for (const evaluationCase of dataset.cases) {
    const adjudication = evaluationCase.reviewBundle.adjudication;
    if (!adjudication) continue;
    const reviews = adjudication.reviewIds
      .map((reviewId) => evaluationCase.reviewBundle.reviews.find((review) => review.reviewId === reviewId))
      .filter((review): review is NonNullable<typeof review> => Boolean(review));
    if (reviews.length < 2) continue;
    casesWithIndependentRatings += 1;
    for (let left = 0; left < reviews.length; left += 1) {
      for (let right = left + 1; right < reviews.length; right += 1) {
        const rightScores = new Map(reviews[right].scores.map((score) => [score.dimensionId, score.score]));
        reviews[left].scores.forEach((score) => {
          const other = rightScores.get(score.dimensionId);
          if (other === undefined) return;
          const pairs = pairsByDimension.get(score.dimensionId) ?? [];
          pairs.push([score.score, other]);
          pairsByDimension.set(score.dimensionId, pairs);
        });
      }
    }
    adjudication.disagreements.forEach((item) => { disagreementCounts[item.kind] += 1; });
  }

  const dimensions = [...pairsByDimension.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([dimensionId, pairs]) => summarizePairs(dimensionId, pairs));
  const allPairs = [...pairsByDimension.values()].flat();
  return deepFreeze({
    schemaVersion: SANDBOX_EXPERT_AGREEMENT_V1,
    datasetHash: dataset.manifest.datasetHash,
    casesWithIndependentRatings,
    dimensions,
    overall: omitDimensionId(summarizePairs("overall", allPairs)),
    disagreementCounts,
  });
}

function summarizePairs(dimensionId: string, pairs: readonly (readonly [number, number])[]): ExpertAgreementDimensionV1 {
  if (pairs.length === 0) {
    return { dimensionId, ratingPairs: 0, exactAgreementRate: 0, adjacentAgreementRate: 0, meanAbsoluteDifference: 0, quadraticWeightedKappa: null };
  }
  const absoluteDifferences = pairs.map(([left, right]) => Math.abs(left - right));
  return {
    dimensionId,
    ratingPairs: pairs.length,
    exactAgreementRate: roundNumber(absoluteDifferences.filter((value) => value === 0).length / pairs.length),
    adjacentAgreementRate: roundNumber(absoluteDifferences.filter((value) => value <= 1).length / pairs.length),
    meanAbsoluteDifference: roundNumber(absoluteDifferences.reduce((sum, value) => sum + value, 0) / pairs.length),
    quadraticWeightedKappa: quadraticWeightedKappa(pairs),
  };
}

function quadraticWeightedKappa(pairs: readonly (readonly [number, number])[]): number | null {
  if (pairs.length === 0) return null;
  const leftCounts = [0, 0, 0, 0, 0];
  const rightCounts = [0, 0, 0, 0, 0];
  let observed = 0;
  pairs.forEach(([left, right]) => {
    leftCounts[left - 1] += 1;
    rightCounts[right - 1] += 1;
    observed += ((left - right) ** 2) / 16;
  });
  observed /= pairs.length;
  let expected = 0;
  for (let left = 1; left <= 5; left += 1) {
    for (let right = 1; right <= 5; right += 1) {
      expected += (leftCounts[left - 1] / pairs.length)
        * (rightCounts[right - 1] / pairs.length)
        * (((left - right) ** 2) / 16);
    }
  }
  if (expected === 0) return observed === 0 ? 1 : null;
  return roundNumber(1 - observed / expected);
}

function omitDimensionId(value: ExpertAgreementDimensionV1): Omit<ExpertAgreementDimensionV1, "dimensionId"> {
  const { dimensionId: _dimensionId, ...rest } = value;
  return rest;
}

function safeHash(value: unknown): string {
  try {
    return hashCanonicalJson(value);
  } catch {
    return "invalid";
  }
}
