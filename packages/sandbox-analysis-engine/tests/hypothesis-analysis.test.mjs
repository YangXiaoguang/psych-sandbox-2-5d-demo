import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  SANDBOX_HYPOTHESIS_PROMPT_V1,
  buildHypothesisPromptContext,
  createSandboxAnalysisEngine,
  createSandboxHypothesisAnalyzer,
  hashCanonicalJson,
  sha256Hex,
} from "../dist/index.js";
import { createObject, createSnapshot } from "./fixtures.mjs";

const FEATURE_SPATIAL = "feature:scene:spatial-distribution";
const FEATURE_CATEGORY = "feature:scene:category-distribution";

function sceneSnapshot() {
  return createSnapshot([
    createObject({ id: "child", name: "儿童", category: "人物", xNorm: 0.5, yNorm: 0.5, createdOrder: 1, symbolicCandidates: ["成长"] }),
    createObject({ id: "tree", name: "树", category: "自然", xNorm: 0.25, yNorm: 0.45, createdOrder: 2, symbolicCandidates: ["生命力"] }),
    createObject({ id: "house", name: "房子", category: "建筑", xNorm: 0.74, yNorm: 0.32, createdOrder: 3, symbolicCandidates: ["家庭"] }),
  ], { snapshotId: "snapshot-phase-3", selectedObjectId: "child" });
}

function validDraft(overrides = {}) {
  return {
    schemaVersion: SANDBOX_HYPOTHESIS_DRAFT_V1,
    hypotheses: [{
      id: "hypothesis-balance",
      label: "围绕中心与归属的探索线索",
      confidence: 0.58,
      confidenceLevel: "medium",
      supportingEvidenceIds: [FEATURE_SPATIAL, FEATURE_CATEGORY],
      contradictingEvidenceIds: [],
      alternativeExplanations: ["当前布局也可能只是为了让不同沙具都清晰可见。"],
      explanation: "多个类别共同出现且主体接近中心，可作为询问当前作品组织方式的候选线索。",
      questionsToVerify: ["当你看向沙盘中心时，最先注意到什么？"],
      interpretiveLimit: "这是构图层面的候选主题，需要用户确认，不能据此推断人格或临床状态。",
      ...(overrides.hypothesis ?? {}),
    }],
    interviewQuestions: [{
      id: "question-center",
      text: "当你看向沙盘中心时，哪个部分最想让人先看到？",
      intent: "核实中心构图对创作者本人的意义。",
      leading: false,
      evidenceIds: [FEATURE_SPATIAL],
      hypothesisIds: ["hypothesis-balance"],
      ...(overrides.question ?? {}),
    }],
    warnings: [],
    ...overrides.root,
  };
}

function mockLlm(content, capture = {}) {
  return {
    async generateStructured(request) {
      capture.request = request;
      if (content instanceof Error) throw content;
      return { content, provider: "mock-provider", model: "mock-model" };
    },
  };
}

function analyzerFor(content, capture = {}, overrides = {}) {
  let sequence = 0;
  return createSandboxHypothesisAnalyzer({
    llm: mockLlm(content, capture),
    clock: { now: () => "2026-08-05T13:00:00.000Z" },
    idGenerator: { createId: (prefix) => `${prefix}-fixed-${++sequence}` },
    ...overrides,
  });
}

test("generates an auditable result while keeping deterministic facts and features authoritative", async () => {
  const capture = {};
  const snapshot = sceneSnapshot();
  const deterministic = createSandboxAnalysisEngine().analyzeDeterministically(snapshot);
  assert.equal(deterministic.ok, true);

  const result = await analyzerFor(validDraft(), capture, {
    knowledgeBase: { async loadAnalysisGuidance() { return { version: "kb-test-v1", guidance: ["象征意义只能用于开放式核实。"] }; } },
  }).analyze(snapshot);

  assert.equal(result.ok, true);
  assert.equal(result.value.analysisId, "analysis-fixed-2");
  assert.equal(result.value.generatedAt, "2026-08-05T13:00:00.000Z");
  assert.equal(result.value.knowledgeBaseVersion, "kb-test-v1");
  assert.deepEqual(result.value.features, deterministic.value.featureBundle.features.map((feature) => ({
    id: feature.id,
    kind: feature.kind,
    label: feature.label,
    value: feature.value,
    ...(feature.unit ? { unit: feature.unit } : {}),
    fidelity: feature.fidelity,
    evidenceIds: [...feature.evidenceIds],
  })));
  assert.equal(result.value.hypotheses[0].status, "candidate");
  assert.equal(result.value.guardrails.notDiagnosis, true);
  assert.equal(result.value.evidence.every((item) => item.sourcePaths.length > 0), true);
  assert.equal(typeof result.value.features.find((item) => item.id === FEATURE_SPATIAL)?.value, "object");
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(capture.request.promptVersion, SANDBOX_HYPOTHESIS_PROMPT_V1);
  assert.equal(capture.request.responseSchema.additionalProperties, false);
  assert.equal(capture.request.messages[1].content.includes("includesPersonalMemory\":false"), true);
  assert.equal("rawSnapshot" in result.promptContext, false);
});

test("accepts JSON inside a fenced model response", async () => {
  const result = await analyzerFor(`\`\`\`json\n${JSON.stringify(validDraft())}\n\`\`\``).analyze(sceneSnapshot());
  assert.equal(result.ok, true);
});

test("rejects malformed JSON and LLM adapter failures", async () => {
  const malformed = await analyzerFor("{not-json").analyze(sceneSnapshot());
  assert.equal(malformed.ok, false);
  assert.equal(malformed.issues[0].code, "LLM_OUTPUT_INVALID_JSON");

  const failed = await analyzerFor(new Error("provider unavailable")).analyze(sceneSnapshot());
  assert.equal(failed.ok, false);
  assert.equal(failed.stage, "llm");
  assert.equal(failed.issues[0].code, "LLM_PORT_ERROR");
});

test("rejects any model attempt to inject or rewrite facts and features", async () => {
  const result = await analyzerFor(validDraft({ root: { features: [{ id: "fake" }] } })).analyze(sceneSnapshot());
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((current) => current.code === "LLM_OUTPUT_SCHEMA_INVALID" && current.path === "/features"), true);
});

test("rejects unknown evidence and hypothesis references", async () => {
  const unknownEvidence = await analyzerFor(validDraft({ hypothesis: { supportingEvidenceIds: ["feature:missing", FEATURE_CATEGORY] } })).analyze(sceneSnapshot());
  assert.equal(unknownEvidence.ok, false);
  assert.equal(unknownEvidence.issues.some((current) => current.code === "UNKNOWN_EVIDENCE_REFERENCE"), true);

  const unknownHypothesis = await analyzerFor(validDraft({ question: { hypothesisIds: ["hypothesis-missing"] } })).analyze(sceneSnapshot());
  assert.equal(unknownHypothesis.ok, false);
  assert.equal(unknownHypothesis.issues.some((current) => current.code === "UNKNOWN_HYPOTHESIS_REFERENCE"), true);
});

test("enforces confidence bands and the minimum independent evidence rule", async () => {
  const insufficient = await analyzerFor(validDraft({ hypothesis: { supportingEvidenceIds: [FEATURE_SPATIAL] } })).analyze(sceneSnapshot());
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.issues.some((current) => current.code === "INSUFFICIENT_EVIDENCE"), true);

  const mismatch = await analyzerFor(validDraft({ hypothesis: { confidence: 0.2, confidenceLevel: "medium" } })).analyze(sceneSnapshot());
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.issues.some((current) => current.code === "CONFIDENCE_MISMATCH"), true);
});

test("allows symbolic metadata only as a low-confidence lead when used alone", async () => {
  const semanticEvidenceId = "fact:object:child:semantics";
  const medium = await analyzerFor(validDraft({ hypothesis: { supportingEvidenceIds: [semanticEvidenceId] } })).analyze(sceneSnapshot());
  assert.equal(medium.ok, false);
  assert.equal(medium.issues.some((current) => current.code === "INSUFFICIENT_EVIDENCE"), true);

  const low = await analyzerFor(validDraft({ hypothesis: { confidence: 0.25, confidenceLevel: "low", supportingEvidenceIds: [semanticEvidenceId] } })).analyze(sceneSnapshot());
  assert.equal(low.ok, true);
});

test("rejects leading questions, diagnostic certainty, and unsupported process claims", async () => {
  const leading = await analyzerFor(validDraft({ question: { text: "是不是因为你害怕失去，所以把房子放在这里？" } })).analyze(sceneSnapshot());
  assert.equal(leading.ok, false);
  assert.equal(leading.issues.some((current) => current.code === "LEADING_QUESTION"), true);

  const diagnosis = await analyzerFor(validDraft({ hypothesis: { explanation: "这个布局证明了用户患有焦虑症。" } })).analyze(sceneSnapshot());
  assert.equal(diagnosis.ok, false);
  assert.equal(diagnosis.issues.some((current) => current.code === "FORBIDDEN_LANGUAGE"), true);

  const process = await analyzerFor(validDraft({ hypothesis: { explanation: "用户反复移动房子，显示出犹豫。" } })).analyze(sceneSnapshot());
  assert.equal(process.ok, false);
  assert.equal(process.issues.some((current) => current.code === "UNSUPPORTED_PROCESS_CLAIM"), true);

  const unsafeWarning = await analyzerFor(validDraft({ root: { warnings: ["该用户存在自伤风险。"] } })).analyze(sceneSnapshot());
  assert.equal(unsafeWarning.ok, false);
  assert.equal(unsafeWarning.issues.some((current) => current.code === "FORBIDDEN_LANGUAGE"), true);
});

test("deterministically limits pair relations while preserving all non-relation features", () => {
  const snapshot = createSnapshot([
    createObject({ id: "a", xNorm: 0.1, yNorm: 0.1 }),
    createObject({ id: "b", xNorm: 0.2, yNorm: 0.2 }),
    createObject({ id: "c", xNorm: 0.7, yNorm: 0.7 }),
    createObject({ id: "d", xNorm: 0.9, yNorm: 0.9 }),
  ]);
  const deterministic = createSandboxAnalysisEngine().analyzeDeterministically(snapshot);
  assert.equal(deterministic.ok, true);
  const context = buildHypothesisPromptContext(deterministic.value, 2);
  assert.equal(context.contextPolicy.includedRelationFeatures, 2);
  assert.equal(context.contextPolicy.omittedRelationFeatures, 4);
  assert.equal(context.features.filter((feature) => feature.scope === "relation").length, 2);
  assert.equal(context.features.some((feature) => feature.id === FEATURE_SPATIAL), true);
  assert.equal(Object.isFrozen(context.features), true);
  assert.equal(buildHypothesisPromptContext(deterministic.value, Number.NaN).contextPolicy.relationFeatureLimit, 48);
});

test("canonical hashing is stable and uses the SHA-256 standard", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("沙盘"), createHash("sha256").update("沙盘").digest("hex"));
  assert.equal(sha256Hex("\ud800"), createHash("sha256").update("\ud800").digest("hex"));
  assert.equal(hashCanonicalJson({ b: 2, a: 1 }), hashCanonicalJson({ a: 1, b: 2 }));
  assert.equal(hashCanonicalJson(sceneSnapshot()), hashCanonicalJson(structuredClone(sceneSnapshot())));
});

test("invalid snapshots never reach the LLM port", async () => {
  const capture = {};
  const snapshot = sceneSnapshot();
  snapshot.analysis.totalObjects = 99;
  const result = await analyzerFor(validDraft(), capture).analyze(snapshot);
  assert.equal(result.ok, false);
  assert.equal(result.stage, "input");
  assert.equal(result.issues[0].code, "INPUT_INVALID");
  assert.equal(capture.request, undefined);
});
