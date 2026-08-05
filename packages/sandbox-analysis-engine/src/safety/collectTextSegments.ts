import type { SandboxHypothesisDraftV1 } from "../contracts/hypothesis.js";
import type { SafetyTextSegmentV1 } from "../contracts/safety.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";

export function collectDraftTextSegments(draft: SandboxHypothesisDraftV1): readonly SafetyTextSegmentV1[] {
  const segments: SafetyTextSegmentV1[] = [];

  draft.hypotheses.forEach((hypothesis, hypothesisIndex) => {
    const path = `/hypotheses/${hypothesisIndex}`;
    const evidenceIds = uniqueSorted([
      ...hypothesis.supportingEvidenceIds,
      ...hypothesis.contradictingEvidenceIds,
    ]);
    const hypothesisIds = [hypothesis.id];

    segments.push(segment(`${path}/label`, "hypothesis_label", hypothesis.label, evidenceIds, hypothesisIds));
    segments.push(segment(`${path}/explanation`, "hypothesis_explanation", hypothesis.explanation, evidenceIds, hypothesisIds));
    hypothesis.alternativeExplanations.forEach((text, index) => {
      segments.push(segment(`${path}/alternativeExplanations/${index}`, "alternative_explanation", text, evidenceIds, hypothesisIds));
    });
    hypothesis.questionsToVerify.forEach((text, index) => {
      segments.push(segment(`${path}/questionsToVerify/${index}`, "verification_question", text, evidenceIds, hypothesisIds));
    });
    segments.push(segment(`${path}/interpretiveLimit`, "interpretive_limit", hypothesis.interpretiveLimit, evidenceIds, hypothesisIds));
  });

  draft.interviewQuestions.forEach((question, questionIndex) => {
    const path = `/interviewQuestions/${questionIndex}`;
    const evidenceIds = uniqueSorted(question.evidenceIds);
    const hypothesisIds = uniqueSorted(question.hypothesisIds);
    segments.push(segment(`${path}/text`, "interview_question", question.text, evidenceIds, hypothesisIds));
    segments.push(segment(`${path}/intent`, "question_intent", question.intent, evidenceIds, hypothesisIds));
  });

  draft.warnings.forEach((text, index) => {
    segments.push(segment(`/warnings/${index}`, "warning", text, [], []));
  });

  return deepFreeze(segments.sort((left, right) => compareStrings(left.path, right.path)));
}

function segment(
  path: string,
  role: SafetyTextSegmentV1["role"],
  text: string,
  evidenceIds: readonly string[],
  hypothesisIds: readonly string[],
): SafetyTextSegmentV1 {
  return {
    path,
    role,
    text,
    evidenceIds: [...evidenceIds],
    hypothesisIds: [...hypothesisIds],
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}
