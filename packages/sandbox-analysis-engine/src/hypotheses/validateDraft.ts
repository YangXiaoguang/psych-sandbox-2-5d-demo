import {
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  type HypothesisAnalysisIssue,
  type HypothesisPromptContextV1,
  type SandboxHypothesisDraftCandidateV1,
  type SandboxHypothesisDraftQuestionV1,
  type SandboxHypothesisDraftV1,
} from "../contracts/hypothesis.js";

const FORBIDDEN_PATTERNS = [
  /诊断为|确诊|可以断定|毫无疑问|明确表明|证明(?:了)?|必然|一定说明/u,
  /抑郁症|焦虑症|人格障碍|精神分裂|自闭症|躁郁症|双相障碍/u,
  /自杀倾向|暴力倾向|危险人物|高危个体/u,
  /自伤风险|自我伤害|伤害他人|轻生风险|危机风险/u,
  /用户(?:一定|必然|显然|就是).{0,16}/u,
  /diagnosed with|proves? that|definitely means|suicidal tendency|violent tendency|suicide risk|self-harm risk/iu,
];

const UNSUPPORTED_PROCESS_PATTERNS = [
  /反复(?:移动|调整|摆放)|来回移动|频繁调整|犹豫|停留(?:了)?很久|最后(?:删除|移除)|撤销|重做/u,
  /repeatedly (?:moved|adjusted|placed)|hesitat(?:e|ed|ion)|dwell(?:ed)? for a long time|undo|redo/iu,
];

const LEADING_QUESTION_PATTERNS = [
  /是不是因为|是否说明|难道|你一定|你其实|这是否意味着你/u,
  /isn['’]t it because|doesn['’]t this mean|you must be|surely you/iu,
];

const MAX_LLM_OUTPUT_CHARACTERS = 200_000;

export type DraftValidationResult =
  | { readonly ok: true; readonly value: SandboxHypothesisDraftV1 }
  | { readonly ok: false; readonly issues: readonly HypothesisAnalysisIssue[] };

export function parseAndValidateHypothesisDraft(
  content: unknown,
  context: HypothesisPromptContextV1,
): DraftValidationResult {
  const parsed = parseContent(content);
  if (!parsed.ok) {
    return parsed;
  }
  const structuralIssues: HypothesisAnalysisIssue[] = [];
  const draft = readDraft(parsed.value, structuralIssues);
  if (!draft) {
    return { ok: false, issues: structuralIssues };
  }
  const semanticIssues = validateSemantics(draft, context);
  return semanticIssues.length > 0 ? { ok: false, issues: semanticIssues } : { ok: true, value: draft };
}

function parseContent(content: unknown): { ok: true; value: unknown } | { ok: false; issues: readonly HypothesisAnalysisIssue[] } {
  if (typeof content !== "string") {
    return { ok: true, value: content };
  }
  if (content.length > MAX_LLM_OUTPUT_CHARACTERS) {
    return { ok: false, issues: [issue("LLM_OUTPUT_SCHEMA_INVALID", "/", `LLM output exceeds ${MAX_LLM_OUTPUT_CHARACTERS} characters.`)] };
  }
  const trimmed = content.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, issues: [issue("LLM_OUTPUT_INVALID_JSON", "/", "LLM output is not valid JSON.")] };
  }
}

function readDraft(value: unknown, issues: HypothesisAnalysisIssue[]): SandboxHypothesisDraftV1 | null {
  if (!isRecord(value)) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", "/", "Draft must be an object."));
    return null;
  }
  rejectUnknownKeys(value, ["schemaVersion", "hypotheses", "interviewQuestions", "warnings"], "/", issues);
  if (value.schemaVersion !== SANDBOX_HYPOTHESIS_DRAFT_V1) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", "/schemaVersion", `Expected ${SANDBOX_HYPOTHESIS_DRAFT_V1}.`));
  }
  const hypotheses = readArray(value.hypotheses, "/hypotheses", issues, readCandidate, 5);
  const questions = readArray(value.interviewQuestions, "/interviewQuestions", issues, readQuestion, 10);
  const warnings = readStringArray(value.warnings, "/warnings", issues, false);
  if (issues.length > 0 || !hypotheses || !questions || !warnings) {
    return null;
  }
  return { schemaVersion: SANDBOX_HYPOTHESIS_DRAFT_V1, hypotheses, interviewQuestions: questions, warnings };
}

function readCandidate(value: unknown, path: string, issues: HypothesisAnalysisIssue[]): SandboxHypothesisDraftCandidateV1 | null {
  if (!isRecord(value)) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, "Hypothesis must be an object."));
    return null;
  }
  const keys = ["id", "label", "confidence", "confidenceLevel", "supportingEvidenceIds", "contradictingEvidenceIds", "alternativeExplanations", "explanation", "questionsToVerify", "interpretiveLimit"];
  rejectUnknownKeys(value, keys, path, issues);
  const id = readString(value.id, `${path}/id`, issues);
  const label = readString(value.label, `${path}/label`, issues);
  const confidence = readNumber(value.confidence, `${path}/confidence`, issues, 0, 1);
  const confidenceLevel = readEnum(value.confidenceLevel, ["low", "medium", "high"] as const, `${path}/confidenceLevel`, issues);
  const supportingEvidenceIds = readStringArray(value.supportingEvidenceIds, `${path}/supportingEvidenceIds`, issues, true);
  const contradictingEvidenceIds = readStringArray(value.contradictingEvidenceIds, `${path}/contradictingEvidenceIds`, issues, false);
  const alternativeExplanations = readStringArray(value.alternativeExplanations, `${path}/alternativeExplanations`, issues, true);
  const explanation = readString(value.explanation, `${path}/explanation`, issues);
  const questionsToVerify = readStringArray(value.questionsToVerify, `${path}/questionsToVerify`, issues, true);
  const interpretiveLimit = readString(value.interpretiveLimit, `${path}/interpretiveLimit`, issues);
  if ([id, label, confidence, confidenceLevel, supportingEvidenceIds, contradictingEvidenceIds, alternativeExplanations, explanation, questionsToVerify, interpretiveLimit].some((item) => item === null)) {
    return null;
  }
  return { id: id!, label: label!, confidence: confidence!, confidenceLevel: confidenceLevel!, supportingEvidenceIds: supportingEvidenceIds!, contradictingEvidenceIds: contradictingEvidenceIds!, alternativeExplanations: alternativeExplanations!, explanation: explanation!, questionsToVerify: questionsToVerify!, interpretiveLimit: interpretiveLimit! };
}

function readQuestion(value: unknown, path: string, issues: HypothesisAnalysisIssue[]): SandboxHypothesisDraftQuestionV1 | null {
  if (!isRecord(value)) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, "Question must be an object."));
    return null;
  }
  rejectUnknownKeys(value, ["id", "text", "intent", "leading", "evidenceIds", "hypothesisIds"], path, issues);
  const id = readString(value.id, `${path}/id`, issues);
  const text = readString(value.text, `${path}/text`, issues);
  const intent = readString(value.intent, `${path}/intent`, issues);
  if (value.leading !== false) {
    issues.push(issue("LEADING_QUESTION", `${path}/leading`, "Interview questions must explicitly set leading to false."));
  }
  const evidenceIds = readStringArray(value.evidenceIds, `${path}/evidenceIds`, issues, true);
  const hypothesisIds = readStringArray(value.hypothesisIds, `${path}/hypothesisIds`, issues, true);
  if ([id, text, intent, evidenceIds, hypothesisIds].some((item) => item === null) || value.leading !== false) {
    return null;
  }
  return { id: id!, text: text!, intent: intent!, leading: false, evidenceIds: evidenceIds!, hypothesisIds: hypothesisIds! };
}

function validateSemantics(draft: SandboxHypothesisDraftV1, context: HypothesisPromptContextV1): HypothesisAnalysisIssue[] {
  const issues: HypothesisAnalysisIssue[] = [];
  const evidenceById = new Map(context.evidence.map((node) => [node.id, node]));
  const hypothesisIds = new Set<string>();
  draft.hypotheses.forEach((hypothesis, index) => {
    const path = `/hypotheses/${index}`;
    if (hypothesisIds.has(hypothesis.id)) {
      issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", `${path}/id`, `Duplicate hypothesis ID ${hypothesis.id}.`));
    }
    hypothesisIds.add(hypothesis.id);
    validateEvidenceIds(hypothesis.supportingEvidenceIds, `${path}/supportingEvidenceIds`, evidenceById, issues);
    validateEvidenceIds(hypothesis.contradictingEvidenceIds, `${path}/contradictingEvidenceIds`, evidenceById, issues);
    const expectedLevel = confidenceLevel(hypothesis.confidence);
    if (hypothesis.confidenceLevel !== expectedLevel) {
      issues.push(issue("CONFIDENCE_MISMATCH", `${path}/confidenceLevel`, `Confidence ${hypothesis.confidence} requires level ${expectedLevel}.`));
    }
    if (hypothesis.confidenceLevel !== "low" && new Set(hypothesis.supportingEvidenceIds).size < 2) {
      issues.push(issue("INSUFFICIENT_EVIDENCE", `${path}/supportingEvidenceIds`, "Medium and high confidence hypotheses require at least two distinct supporting evidence IDs."));
    }
    if (hypothesis.supportingEvidenceIds.length === 1 && evidenceById.get(hypothesis.supportingEvidenceIds[0])?.kind === "object.semantic-metadata" && hypothesis.confidenceLevel !== "low") {
      issues.push(issue("INSUFFICIENT_EVIDENCE", `${path}/confidenceLevel`, "A single symbolic metadata item can only support a low-confidence interview lead."));
    }
    validateLanguage([hypothesis.label, hypothesis.explanation, ...hypothesis.alternativeExplanations, ...hypothesis.questionsToVerify, hypothesis.interpretiveLimit], path, issues);
    hypothesis.questionsToVerify.forEach((question, questionIndex) => {
      if (LEADING_QUESTION_PATTERNS.some((pattern) => pattern.test(question))) {
        issues.push(issue("LEADING_QUESTION", `${path}/questionsToVerify/${questionIndex}`, "Verification question wording appears leading or presupposes an interpretation."));
      }
    });
  });

  const questionIds = new Set<string>();
  draft.interviewQuestions.forEach((question, index) => {
    const path = `/interviewQuestions/${index}`;
    if (questionIds.has(question.id)) {
      issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", `${path}/id`, `Duplicate question ID ${question.id}.`));
    }
    questionIds.add(question.id);
    validateEvidenceIds(question.evidenceIds, `${path}/evidenceIds`, evidenceById, issues);
    question.hypothesisIds.forEach((hypothesisId, idIndex) => {
      if (!hypothesisIds.has(hypothesisId)) {
        issues.push(issue("UNKNOWN_HYPOTHESIS_REFERENCE", `${path}/hypothesisIds/${idIndex}`, `Unknown hypothesis ID ${hypothesisId}.`));
      }
    });
    if (LEADING_QUESTION_PATTERNS.some((pattern) => pattern.test(question.text))) {
      issues.push(issue("LEADING_QUESTION", `${path}/text`, "Question wording appears leading or presupposes an interpretation."));
    }
    validateLanguage([question.text, question.intent], path, issues);
  });
  validateLanguage(draft.warnings, "/warnings", issues);
  return issues;
}

function validateEvidenceIds(ids: readonly string[], path: string, evidenceById: ReadonlyMap<string, unknown>, issues: HypothesisAnalysisIssue[]): void {
  ids.forEach((id, index) => {
    if (!evidenceById.has(id)) {
      issues.push(issue("UNKNOWN_EVIDENCE_REFERENCE", `${path}/${index}`, `Evidence ID ${id} is not present in the provided Phase 2 context.`));
    }
  });
}

function validateLanguage(values: readonly string[], path: string, issues: HypothesisAnalysisIssue[]): void {
  values.forEach((value, index) => {
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value))) {
      issues.push(issue("FORBIDDEN_LANGUAGE", `${path}/text/${index}`, "Output contains diagnostic, crisis, or certainty language."));
    }
    if (UNSUPPORTED_PROCESS_PATTERNS.some((pattern) => pattern.test(value))) {
      issues.push(issue("UNSUPPORTED_PROCESS_CLAIM", `${path}/text/${index}`, "Snapshot-only analysis cannot claim movement, deletion, hesitation, dwell, undo, or redo behavior."));
    }
  });
}

function confidenceLevel(confidence: number): "low" | "medium" | "high" {
  return confidence < 0.4 ? "low" : confidence < 0.75 ? "medium" : "high";
}

function readArray<T>(value: unknown, path: string, issues: HypothesisAnalysisIssue[], reader: (item: unknown, itemPath: string, issues: HypothesisAnalysisIssue[]) => T | null, maxItems: number): T[] | null {
  if (!Array.isArray(value) || value.length > maxItems) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, `Expected an array with at most ${maxItems} items.`));
    return null;
  }
  const items = value.map((item, index) => reader(item, `${path}/${index}`, issues));
  return items.some((item) => item === null) ? null : items as T[];
}

function readString(value: unknown, path: string, issues: HypothesisAnalysisIssue[]): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, "Expected a non-empty string."));
    return null;
  }
  return value;
}

function readNumber(value: unknown, path: string, issues: HypothesisAnalysisIssue[], minimum: number, maximum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, `Expected a finite number from ${minimum} to ${maximum}.`));
    return null;
  }
  return value;
}

function readEnum<T extends string>(value: unknown, values: readonly T[], path: string, issues: HypothesisAnalysisIssue[]): T | null {
  if (typeof value !== "string" || !values.includes(value as T)) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, `Expected one of ${values.join(", ")}.`));
    return null;
  }
  return value as T;
}

function readStringArray(value: unknown, path: string, issues: HypothesisAnalysisIssue[], requireItem: boolean): string[] | null {
  if (!Array.isArray(value) || (requireItem && value.length === 0) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, `Expected ${requireItem ? "a non-empty" : "an"} array of non-empty strings.`));
    return null;
  }
  if (new Set(value).size !== value.length) {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", path, "Array values must be unique."));
    return null;
  }
  return value as string[];
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: HypothesisAnalysisIssue[]): void {
  Object.keys(value).filter((key) => !allowed.includes(key)).forEach((key) => {
    issues.push(issue("LLM_OUTPUT_SCHEMA_INVALID", `${path === "/" ? "" : path}/${key}`, `Unexpected property ${key}.`));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(code: HypothesisAnalysisIssue["code"], path: string, message: string): HypothesisAnalysisIssue {
  return { code, path, message };
}
