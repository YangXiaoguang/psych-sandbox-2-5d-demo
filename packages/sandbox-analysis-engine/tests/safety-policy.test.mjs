import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  buildHypothesisPromptContext,
  createSandboxAnalysisEngine,
  createSandboxSafetyPolicy,
} from "../dist/index.js";
import { createObject, createSnapshot } from "./fixtures.mjs";

const FEATURE_SPATIAL = "feature:scene:spatial-distribution";
const FEATURE_CATEGORY = "feature:scene:category-distribution";

function context() {
  const snapshot = createSnapshot([
    createObject({ id: "child", name: "儿童", category: "人物", xNorm: 0.5, yNorm: 0.5, symbolicCandidates: ["成长"] }),
    createObject({ id: "tree", name: "树", category: "自然", xNorm: 0.25, yNorm: 0.45, symbolicCandidates: ["生命力"] }),
    createObject({ id: "house", name: "房子", category: "建筑", xNorm: 0.74, yNorm: 0.32, symbolicCandidates: ["家庭"] }),
  ], { snapshotId: "snapshot-safety" });
  const deterministic = createSandboxAnalysisEngine().analyzeDeterministically(snapshot);
  assert.equal(deterministic.ok, true);
  return buildHypothesisPromptContext(deterministic.value);
}

function validDraft() {
  return {
    schemaVersion: SANDBOX_HYPOTHESIS_DRAFT_V1,
    hypotheses: [{
      id: "hypothesis-1",
      label: "当前作品的组织线索",
      confidence: 0.58,
      confidenceLevel: "medium",
      supportingEvidenceIds: [FEATURE_SPATIAL, FEATURE_CATEGORY],
      contradictingEvidenceIds: [],
      alternativeExplanations: ["当前布局也可能只是为了保持画面清晰。"],
      explanation: "多个类别共同出现，可作为询问作品组织方式的候选线索。",
      questionsToVerify: ["你会怎样描述这个作品的组织方式？"],
      interpretiveLimit: "这是描述性候选主题，需要用户确认。",
    }],
    interviewQuestions: [{
      id: "question-1",
      text: "当你看向这个作品时，最先注意到什么？",
      intent: "了解创作者当前注意到的画面部分。",
      leading: false,
      evidenceIds: [FEATURE_SPATIAL],
      hypothesisIds: ["hypothesis-1"],
    }],
    warnings: [],
  };
}

function withCorpusText(base, item) {
  const draft = structuredClone(base);
  switch (item.target) {
    case "label": draft.hypotheses[0].label = item.text; break;
    case "explanation": draft.hypotheses[0].explanation = item.text; break;
    case "verificationQuestion": draft.hypotheses[0].questionsToVerify[0] = item.text; break;
    case "question": draft.interviewQuestions[0].text = item.text; break;
    case "warning": draft.warnings = [item.text]; break;
    default: throw new Error(`Unknown corpus target ${item.target}`);
  }
  return draft;
}

const corpus = JSON.parse(await readFile(new URL("./red-team/safety-corpus.v1.json", import.meta.url), "utf8"));

for (const item of corpus.cases) {
  test(`red-team ${item.id}: ${item.expected}`, () => {
    const report = createSandboxSafetyPolicy().evaluate(withCorpusText(validDraft(), item), context());
    assert.equal(report.decision, item.expected);
    if (item.category) assert.equal(report.findings.some((finding) => finding.category === item.category), true);
  });
}

test("blocks unsupported spatial and semantic claims and records exact paths", () => {
  const draft = validDraft();
  draft.hypotheses[0].confidence = 0.25;
  draft.hypotheses[0].confidenceLevel = "low";
  draft.hypotheses[0].supportingEvidenceIds = ["fact:object:child:semantics"];
  draft.hypotheses[0].explanation = "房子位于中心，表达了家庭主题。";
  const report = createSandboxSafetyPolicy().evaluate(draft, context());
  assert.equal(report.decision, "block");
  assert.equal(report.findings.some((finding) => finding.category === "unsupported_object_claim"), true);
  assert.equal(report.findings.some((finding) => finding.category === "unsupported_spatial_claim"), true);
  assert.equal(report.findings.some((finding) => finding.category === "unsupported_semantic_claim"), true);
  assert.equal(report.findings.every((finding) => finding.path.startsWith("/")), true);
});

test("blocks symbolic certainty when semantic metadata is the only evidence", () => {
  const draft = validDraft();
  draft.hypotheses[0].confidence = 0.25;
  draft.hypotheses[0].confidenceLevel = "low";
  draft.hypotheses[0].supportingEvidenceIds = ["fact:object:child:semantics"];
  draft.hypotheses[0].explanation = "成长这个词意味着用户内心存在转变需求。";
  const report = createSandboxSafetyPolicy().evaluate(draft, context());
  assert.equal(report.findings.some((finding) => finding.category === "symbolic_overreach"), true);
});

test("blocks evidence used on both sides and reviews disconnected interview evidence", () => {
  const conflict = validDraft();
  conflict.hypotheses[0].contradictingEvidenceIds = [FEATURE_SPATIAL];
  const blocked = createSandboxSafetyPolicy().evaluate(conflict, context());
  assert.equal(blocked.decision, "block");
  assert.equal(blocked.findings.some((finding) => finding.category === "evidence_conflict" && finding.action === "block"), true);

  const disconnected = validDraft();
  disconnected.interviewQuestions[0].evidenceIds = ["fact:object:child:semantics"];
  const reviewed = createSandboxSafetyPolicy().evaluate(disconnected, context());
  assert.equal(reviewed.decision, "review");
  assert.equal(reviewed.summary.reviewCount, 1);
});

test("supports versioned custom policies and fails closed when a rule throws", () => {
  const custom = {
    id: "organization.no-secret",
    version: "2026.08",
    evaluate(input) {
      return input.textSegments.filter((segment) => segment.text.includes("秘密")).map((segment) => ({
        category: "custom",
        severity: "warning",
        action: "flag_for_review",
        path: segment.path,
        matchedText: "秘密",
        message: "Organization policy requires review.",
      }));
    },
  };
  const draft = validDraft();
  draft.warnings = ["包含秘密一词。"];
  const report = createSandboxSafetyPolicy({ version: "org.policy.v1", rules: [custom] }).evaluate(draft, context());
  assert.equal(report.policyVersion, "org.policy.v1");
  assert.equal(report.decision, "review");
  assert.equal(Object.isFrozen(report.findings), true);

  const failed = createSandboxSafetyPolicy({ ruleMode: "replace", rules: [{
    id: "broken",
    version: "1",
    evaluate() { throw new Error("rule unavailable"); },
  }] }).evaluate(validDraft(), context());
  assert.equal(failed.decision, "block");
  assert.equal(failed.findings[0].severity, "critical");

  const invalidResult = createSandboxSafetyPolicy({ ruleMode: "replace", rules: [{
    id: "invalid-result",
    version: "1",
    evaluate() { return null; },
  }] }).evaluate(validDraft(), context());
  assert.equal(invalidResult.decision, "block");
  assert.match(invalidResult.findings[0].message, /failed closed/);

  const invalidFinding = createSandboxSafetyPolicy({ ruleMode: "replace", rules: [{
    id: "invalid-finding",
    version: "1",
    evaluate() { return [{ category: "not-real", severity: "warning", action: "allow", path: "bad", matchedText: 1, message: "" }]; },
  }] }).evaluate(validDraft(), context());
  assert.equal(invalidFinding.decision, "block");
  assert.equal(invalidFinding.findings[0].severity, "critical");
});

test("rejects duplicate rule IDs and an empty replacement policy", () => {
  const rule = { id: "duplicate", version: "1", evaluate: () => [] };
  assert.throws(() => createSandboxSafetyPolicy({ rules: [rule, rule] }), /Duplicate safety rule/);
  assert.throws(() => createSandboxSafetyPolicy({ ruleMode: "replace", rules: [] }), /at least one rule/);
  assert.throws(() => createSandboxSafetyPolicy({ version: "" }), /version must be non-empty/);
});
