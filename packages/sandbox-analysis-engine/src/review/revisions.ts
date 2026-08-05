import { SANDBOX_HYPOTHESIS_DRAFT_V1, type SandboxHypothesisDraftV1 } from "../contracts/hypothesis.js";
import type { ExpertFieldRevision, ReviewWorkflowIssue, ReviewWorkflowResult } from "../contracts/review.js";
import type { SandboxAnalysisResultV1 } from "../contracts/analysis.js";
import { hashCanonicalJson } from "../internal/sha256.js";

const HYPOTHESIS_FIELDS = new Set([
  "label", "confidence", "confidenceLevel", "supportingEvidenceIds", "contradictingEvidenceIds",
  "alternativeExplanations", "explanation", "questionsToVerify", "interpretiveLimit",
]);
const HYPOTHESIS_ARRAY_FIELDS = new Set(["supportingEvidenceIds", "contradictingEvidenceIds", "alternativeExplanations", "questionsToVerify"]);
const QUESTION_FIELDS = new Set(["text", "intent", "evidenceIds", "hypothesisIds"]);
const QUESTION_ARRAY_FIELDS = new Set(["evidenceIds", "hypothesisIds"]);

export function analysisToHypothesisDraft(analysis: SandboxAnalysisResultV1): SandboxHypothesisDraftV1 {
  return {
    schemaVersion: SANDBOX_HYPOTHESIS_DRAFT_V1,
    hypotheses: analysis.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      label: hypothesis.label,
      confidence: hypothesis.confidence,
      confidenceLevel: hypothesis.confidenceLevel,
      supportingEvidenceIds: [...hypothesis.supportingEvidenceIds],
      contradictingEvidenceIds: [...hypothesis.contradictingEvidenceIds],
      alternativeExplanations: [...hypothesis.alternativeExplanations],
      explanation: hypothesis.explanation,
      questionsToVerify: [...hypothesis.questionsToVerify],
      interpretiveLimit: hypothesis.interpretiveLimit,
    })),
    interviewQuestions: analysis.interviewQuestions.map((question) => ({
      id: question.id,
      text: question.text,
      intent: question.intent,
      leading: false,
      evidenceIds: [...question.evidenceIds],
      hypothesisIds: [...question.hypothesisIds],
    })),
    warnings: [...analysis.warnings],
  };
}

export function isAllowedRevisionPath(path: string): boolean {
  const tokens = parsePointer(path);
  if (!tokens || tokens.some(isDangerousToken)) return false;
  if (tokens[0] === "hypotheses") return isEditableCollectionPath(tokens, HYPOTHESIS_FIELDS, HYPOTHESIS_ARRAY_FIELDS);
  if (tokens[0] === "interviewQuestions") return isEditableCollectionPath(tokens, QUESTION_FIELDS, QUESTION_ARRAY_FIELDS);
  return false;
}

export function applyFieldRevisions(
  draft: SandboxHypothesisDraftV1,
  revisions: readonly ExpertFieldRevision[],
): ReviewWorkflowResult<{ readonly draft: SandboxHypothesisDraftV1; readonly appliedRevisions: readonly ExpertFieldRevision[] }> {
  const mutable = cloneJson(draft) as unknown as Record<string, unknown>;
  const applied: ExpertFieldRevision[] = [];

  for (let index = 0; index < revisions.length; index += 1) {
    const revision = revisions[index];
    if (!isAllowedRevisionPath(revision.path)) return failure("INVALID_REVISION", `/revisions/${index}/path`, `Revision path ${revision.path} is not editable.`);
    const tokens = parsePointer(revision.path)!;
    const target = locateTarget(mutable, tokens, revision.operation);
    if (!target.ok) return failure(target.code, `/revisions/${index}/path`, target.message);

    if ("previousValue" in revision && !sameCanonicalValue(revision.previousValue, target.previousValue)) {
      return failure("REVISION_CONFLICT", `/revisions/${index}/previousValue`, `Revision ${revision.path} was based on a stale value.`);
    }
    if ((revision.operation === "add" || revision.operation === "replace") && !("proposedValue" in revision)) {
      return failure("INVALID_REVISION", `/revisions/${index}/proposedValue`, `${revision.operation} requires proposedValue.`);
    }

    if (revision.operation === "remove") {
      if (Array.isArray(target.parent)) target.parent.splice(target.index, 1);
      else delete target.parent[target.key];
    } else if (Array.isArray(target.parent)) {
      if (revision.operation === "add") target.parent.splice(target.index, 0, cloneJson(revision.proposedValue));
      else target.parent[target.index] = cloneJson(revision.proposedValue);
    } else {
      target.parent[target.key] = cloneJson(revision.proposedValue);
    }

    applied.push({
      path: revision.path,
      operation: revision.operation,
      previousValue: cloneJson(target.previousValue),
      ...(revision.operation === "remove" ? {} : { proposedValue: cloneJson(revision.proposedValue) }),
      reason: revision.reason.trim(),
    });
  }

  return { ok: true, value: { draft: mutable as unknown as SandboxHypothesisDraftV1, appliedRevisions: applied } };
}

function isEditableCollectionPath(tokens: readonly string[], fields: ReadonlySet<string>, arrayFields: ReadonlySet<string>): boolean {
  if (tokens.length === 2) return isIndex(tokens[1], true);
  if (tokens.length === 3) return isIndex(tokens[1], false) && fields.has(tokens[2]);
  if (tokens.length === 4) return isIndex(tokens[1], false) && arrayFields.has(tokens[2]) && isIndex(tokens[3], true);
  return false;
}

function locateTarget(root: Record<string, unknown>, tokens: readonly string[], operation: ExpertFieldRevision["operation"]):
  | { ok: true; parent: Record<string, unknown> | unknown[]; key: string; index: number; previousValue: unknown }
  | { ok: false; code: "INVALID_REVISION" | "REVISION_CONFLICT"; message: string } {
  let current: unknown = root;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    if (Array.isArray(current)) {
      const itemIndex = parseIndex(token, current.length, false);
      if (itemIndex === null || itemIndex >= current.length) return { ok: false, code: "REVISION_CONFLICT", message: `Revision parent ${token} does not exist.` };
      current = current[itemIndex];
    } else if (isRecord(current) && token in current) {
      current = current[token];
    } else {
      return { ok: false, code: "REVISION_CONFLICT", message: `Revision parent ${token} does not exist.` };
    }
  }
  if (!Array.isArray(current) && !isRecord(current)) return { ok: false, code: "INVALID_REVISION", message: "Revision target parent is not editable." };
  const key = tokens[tokens.length - 1];
  if (Array.isArray(current)) {
    const itemIndex = parseIndex(key, current.length, operation === "add");
    if (itemIndex === null || (operation !== "add" && itemIndex >= current.length)) return { ok: false, code: "REVISION_CONFLICT", message: `Revision target ${key} does not exist.` };
    return { ok: true, parent: current, key, index: itemIndex, previousValue: current[itemIndex] };
  }
  if (operation !== "add" && !(key in current)) return { ok: false, code: "REVISION_CONFLICT", message: `Revision target ${key} does not exist.` };
  return { ok: true, parent: current, key, index: -1, previousValue: current[key] };
}

function parsePointer(path: string): string[] | null {
  if (typeof path !== "string" || !path.startsWith("/") || path === "/") return null;
  try {
    return path.slice(1).split("/").map((token) => {
      if (/~(?![01])/u.test(token)) throw new Error("invalid escape");
      return token.replace(/~1/gu, "/").replace(/~0/gu, "~");
    });
  } catch {
    return null;
  }
}

function isDangerousToken(token: string): boolean {
  return token === "__proto__" || token === "prototype" || token === "constructor";
}

function isIndex(value: string, allowAppend: boolean): boolean {
  return (allowAppend && value === "-") || /^(?:0|[1-9]\d*)$/u.test(value);
}

function parseIndex(value: string, length: number, allowAppend: boolean): number | null {
  if (allowAppend && value === "-") return length;
  if (!isIndex(value, false)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  try {
    return hashCanonicalJson(left) === hashCanonicalJson(right);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(code: ReviewWorkflowIssue["code"], path: string, message: string): ReviewWorkflowResult<never> {
  return { ok: false, issues: [{ code, path, message }] };
}
