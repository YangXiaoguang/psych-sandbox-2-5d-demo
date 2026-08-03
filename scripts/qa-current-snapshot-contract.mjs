#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "current-snapshot-contract-qa");
const ENTRY_PATH = path.join(ARTIFACT_DIR, "entry.ts");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "entry.mjs");

const results = [];

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(ENTRY_PATH, buildRuntimeEntry(), "utf8");
  await esbuild.build({
    entryPoints: [ENTRY_PATH],
    outfile: BUNDLE_PATH,
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    logLevel: "silent",
  });

  const runtime = await import(pathToFileURL(BUNDLE_PATH).href);
  await assertRuntimeSnapshot(runtime.default);
  await assertStaticContractFiles();
  printSummary();
} catch (error) {
  results.push({
    name: "Current Snapshot contract QA runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

function buildRuntimeEntry() {
  return `
import {
  createCurrentSandboxSnapshotPayload,
  createCurrentSandboxSnapshotResponse,
} from "../../src/api/currentSandboxSnapshotApi";
import { buildCurrentSandboxInsight, CURRENT_SANDBOX_INSIGHT_SCHEMA } from "../../src/llm/currentSandboxInsight";
import { CURRENT_SANDBOX_SNAPSHOT_SCHEMA } from "../../src/llm/currentSandboxSnapshot";
import {
  assertVisualSupplementIsNotLlmInput,
  createSandboxVisualSupplementDescriptor,
  SANDBOX_VISUAL_SUPPLEMENT_SCHEMA,
} from "../../src/llm/sandboxVisualEvidence";

const sampleObject = {
  id: "obj_house_001",
  assetId: "env_house",
  name: "房子",
  category: "建筑与环境",
  x: 293,
  y: 170,
  width: 112,
  height: 76,
  rotation: -3,
  scale: 1.35,
  createdAt: 1000,
  riskTag: "normal",
  symbolicCandidates: ["家庭", "安全", "归属"],
  anchor: { x: 0.5, y: 0.78 },
  footprint: { kind: "wide", width: 1.2, depth: 0.9, height: 0.8 },
  thumbnailScale: 1,
  semanticTags: ["建筑", "容器", "安全感"],
  modelRecipe: { kind: "house" },
};

const request = {
  environment: { weather: "rainy", light: "night" },
  objects: [sampleObject],
  selectedObjectId: "obj_house_001",
  generatedAt: "2026-07-31T10:30:00+08:00",
  snapshotId: "snapshot_contract_qa",
};

const payload = createCurrentSandboxSnapshotPayload(request);
const visualSupplement = createSandboxVisualSupplementDescriptor({
  sourceSnapshotId: payload.snapshot.snapshotId,
  generatedAt: payload.snapshot.generatedAt,
  purpose: "qa_visual_alignment",
  renderer: "stage3d",
  captureArtifactId: "artifacts/visual-regression/latest/sandbox-stage-v2.png",
  imageDigest: "sha256:contract-placeholder",
});

export default {
  schema: CURRENT_SANDBOX_SNAPSHOT_SCHEMA,
  insightSchema: CURRENT_SANDBOX_INSIGHT_SCHEMA,
  visualSupplementSchema: SANDBOX_VISUAL_SUPPLEMENT_SCHEMA,
  payload,
  response: createCurrentSandboxSnapshotResponse(request),
  expectedInsight: buildCurrentSandboxInsight(payload.snapshot),
  visualSupplement,
  visualSupplementNotLlmInput: assertVisualSupplementIsNotLlmInput(visualSupplement),
};
`;
}

async function assertRuntimeSnapshot(runtime) {
  const { payload, response, schema, insightSchema, visualSupplementSchema, expectedInsight, visualSupplement, visualSupplementNotLlmInput } = runtime;
  assert("Runtime exports payload", Boolean(payload));
  assert("Runtime exports response", Boolean(response));
  assert("Schema constant remains stable", schema === "sandbox.current-snapshot.v1", schema);
  assert("Insight schema constant remains stable", insightSchema === "sandbox.current-insight.v1", insightSchema);
  assert("Visual supplement schema constant remains stable", visualSupplementSchema === "sandbox.visual-supplement.v1", visualSupplementSchema);

  assert("Response is successful", response.ok === true, JSON.stringify(response));
  assert("Response requestId is generated", typeof response.requestId === "string" && response.requestId.startsWith("req_"), response.requestId);
  assert("Response wraps the same snapshot schema", response.data.snapshot.schemaVersion === "sandbox.current-snapshot.v1");
  assert("Response wraps the same insight schema", response.data.insight.schemaVersion === "sandbox.current-insight.v1");

  const { snapshot, insight, policy } = payload;
  assert("Payload includes policy", Boolean(policy));
  assert("Payload includes versioned insight", Boolean(insight) && insight.schemaVersion === "sandbox.current-insight.v1");
  assert("Payload insight links to snapshot", insight.sourceSnapshotId === snapshot.snapshotId, insight.sourceSnapshotId);
  assert("Response insight matches payload insight", response.data.insight.sourceSnapshotId === payload.insight.sourceSnapshotId);
  assert("Policy excludes event flow", policy.includesEvents === false);
  assert("Policy excludes personal memory", policy.includesPersonalMemory === false);
  assert("Policy excludes user identity", policy.includesUserIdentity === false);
  assert("Policy excludes images", policy.includesImage === false);

  assert("Snapshot uses current_sandbox source", snapshot.source === "current_sandbox", snapshot.source);
  assert("Snapshot preserves deterministic id", snapshot.snapshotId === "snapshot_contract_qa", snapshot.snapshotId);
  assert("Snapshot preserves generatedAt", snapshot.generatedAt === "2026-07-31T10:30:00+08:00", snapshot.generatedAt);
  assert("Snapshot maps rainy night labels", snapshot.environment.weatherLabel === "雨天" && snapshot.environment.lightLabel === "黑夜");
  assert("Snapshot includes one object", snapshot.objects.length === 1, String(snapshot.objects.length));
  assert("Snapshot selectedObjectId is preserved", snapshot.selectedObjectId === "obj_house_001", String(snapshot.selectedObjectId));
  assert("Snapshot analysis counts objects", snapshot.analysis.totalObjects === 1, String(snapshot.analysis.totalObjects));
  assert("Snapshot analysis exposes summary text", typeof snapshot.analysis.summaryText === "string" && snapshot.analysis.summaryText.includes("当前沙盘共有 1 个沙具"));

  const object = snapshot.objects[0];
  assert("Snapshot object keeps name/category", object.name === "房子" && object.category === "建筑与环境");
  assert("Snapshot object has normalized coordinates", object.position.xNorm > 0 && object.position.xNorm <= 1 && object.position.yNorm > 0 && object.position.yNorm <= 1);
  assert("Snapshot object keeps transform", object.transform.rotationDeg === -3 && object.transform.scale === 1.35);
  assert("Snapshot object keeps footprint", object.footprint.kind === "wide" && object.footprint.width === 1.2);

  const forbiddenKeys = ["events", "eventFlow", "memory", "memories", "user", "userId", "auth", "consent", "scope", "image", "screenshot", "apiKey"];
  const snapshotKeys = collectKeys(snapshot);
  const leakedKeys = forbiddenKeys.filter((key) => snapshotKeys.has(key));
  assert("Snapshot contains no forbidden context keys", leakedKeys.length === 0, leakedKeys.join(", "));

  assert("Runtime exports expected derived insight", Boolean(expectedInsight));
  assert("Insight uses current schema", insight.schemaVersion === "sandbox.current-insight.v1", insight.schemaVersion);
  assert("Insight links to source snapshot", insight.sourceSnapshotId === snapshot.snapshotId, insight.sourceSnapshotId);
  assert("Insight excludes event flow", insight.guardrails.includesEvents === false);
  assert("Insight excludes personal memory", insight.guardrails.includesPersonalMemory === false);
  assert("Insight excludes identity", insight.guardrails.includesIdentity === false);
  assert("Insight excludes images", insight.guardrails.includesImage === false);
  assert("Insight produces observation material", Array.isArray(insight.observations) && insight.observations.length >= 3);
  assert("Insight produces suggested questions", Array.isArray(insight.suggestedQuestions) && insight.suggestedQuestions.length > 0);
  assert("Insight brief keeps non-diagnostic notice", insight.brief.includes("不构成诊断"), insight.brief);
  assert("Payload insight is deterministic", insight.brief === expectedInsight.brief && insight.observations.length === expectedInsight.observations.length);

  const insightKeys = collectKeys(insight);
  const leakedInsightKeys = forbiddenKeys.filter((key) => insightKeys.has(key));
  assert("Insight contains no forbidden context keys", leakedInsightKeys.length === 0, leakedInsightKeys.join(", "));

  assert("Visual supplement descriptor is generated", visualSupplement.schemaVersion === "sandbox.visual-supplement.v1");
  assert("Visual supplement links to snapshot", visualSupplement.sourceSnapshotId === snapshot.snapshotId, visualSupplement.sourceSnapshotId);
  assert("Visual supplement contains no image data", visualSupplement.policy.descriptorContainsImageData === false);
  assert("Visual supplement cannot be LLM input", visualSupplement.policy.mayBeSentToLlm === false && visualSupplementNotLlmInput === true);
  assert("Visual supplement cannot replace snapshot or insight", visualSupplement.policy.mayReplaceSnapshotOrInsight === false);
}

async function assertStaticContractFiles() {
  const [contracts, apiHelper, mockAdapter, promptContext, insightFile, visualEvidenceFile, structuredPanel, rightPanel, doc, analysisDoc] = await Promise.all([
    readProjectFile("src/api/contracts.ts"),
    readProjectFile("src/api/currentSandboxSnapshotApi.ts"),
    readProjectFile("src/api/mockApiAdapter.ts"),
    readProjectFile("src/llm/sandboxPromptContext.ts"),
    readProjectFile("src/llm/currentSandboxInsight.ts"),
    readProjectFile("src/llm/sandboxVisualEvidence.ts"),
    readProjectFile("src/components/StructuredDataPanel.tsx"),
    readProjectFile("src/components/RightPanel.tsx"),
    readProjectFile("docs/sandbox-llm-data-output-spec.md"),
    readProjectFile("docs/ai-analysis-layer-design.md"),
  ]);
  const [aiCompanionPanel, agentChatView] = await Promise.all([
    readProjectFile("src/components/AiCompanionPanel.tsx"),
    readProjectFile("src/components/AgentChatView.tsx"),
  ]);

  assert("Contracts declare request DTO", contracts.includes("BuildCurrentSandboxSnapshotRequestDto"));
  assert("Contracts declare response DTO", contracts.includes("CurrentSandboxSnapshotResponseDto"));
  assert("Contracts response DTO includes versioned insight", contracts.includes("insight: CurrentSandboxInsight"));
  assert("Contracts expose LLM snapshot endpoint", contracts.includes("/api/llm/current-sandbox-snapshot"));
  assert("Contracts include sample current snapshot report", contracts.includes("sampleCurrentSandboxSnapshot"));

  assert("API helper uses shared builder", apiHelper.includes("buildCurrentSandboxSnapshot(request)"));
  assert("API helper builds response insight", apiHelper.includes("buildCurrentSandboxInsight(snapshot)"));
  assert("API helper policy excludes events", apiHelper.includes("includesEvents: false"));
  assert("API helper policy excludes identity", apiHelper.includes("includesUserIdentity: false"));
  assert("API helper policy excludes images", apiHelper.includes("includesImage: false"));

  assert("Mock adapter exposes createCurrentSandboxSnapshot", mockAdapter.includes("createCurrentSandboxSnapshot("));
  assert("Mock adapter includes sample response", mockAdapter.includes("sampleCurrentSandboxSnapshot"));

  assert("Prompt context centralizes snapshot chat messages", promptContext.includes("createSandboxSnapshotChatMessages"));
  assert("Prompt context includes allowed-context notice", promptContext.includes("当前只允许使用 CurrentSandboxSnapshot"));
  assert("Prompt context does not serialize snapshot policy", !promptContext.includes("CurrentSandboxSnapshotPolicy JSON"));
  assert("Prompt context serializes current snapshot", promptContext.includes("CurrentSandboxSnapshot JSON"));
  assert("Prompt context serializes derived insight", promptContext.includes("CurrentSandboxInsight JSON"));
  assert("Prompt context provides shared summary helper", promptContext.includes("buildCurrentSnapshotBrief"));
  assert("Prompt context can reuse precomputed insight", promptContext.includes("insight?: CurrentSandboxInsight"));

  assert("Insight module declares schema", insightFile.includes("CURRENT_SANDBOX_INSIGHT_SCHEMA"));
  assert("Insight module exposes deterministic builder", insightFile.includes("buildCurrentSandboxInsight"));
  assert("Insight module documents no-diagnosis guardrail", insightFile.includes("不能作为诊断结论"));
  assert("Visual evidence module declares supplement schema", visualEvidenceFile.includes("SANDBOX_VISUAL_SUPPLEMENT_SCHEMA"));
  assert("Visual evidence module blocks LLM input", visualEvidenceFile.includes("mayBeSentToLlm: false") && visualEvidenceFile.includes("assertVisualSupplementIsNotLlmInput"));

  assert("Structured data panel uses API payload helper", structuredPanel.includes("createCurrentSandboxSnapshotPayload"));
  assert("Structured data panel copies raw snapshot JSON", structuredPanel.includes("JSON.stringify(snapshot, null, 2)"));
  assert("Right panel uses API payload helper for insight", rightPanel.includes("createCurrentSandboxSnapshotPayload"));
  assert("Right panel renders derived insight material", rightPanel.includes("buildCurrentSandboxInsight") && rightPanel.includes("AI 观察材料"));
  assert("AI companion uses API payload helper", aiCompanionPanel.includes("createCurrentSandboxSnapshotPayload"));
  assert("AI companion uses centralized snapshot prompt context", aiCompanionPanel.includes("createSandboxSnapshotChatMessages"));
  assert("AI companion passes derived insight into prompt context", aiCompanionPanel.includes("buildCurrentSandboxInsight") && aiCompanionPanel.includes("insight: context.insight"));
  assert("AI companion does not inline snapshot policy prompt", !aiCompanionPanel.includes("CurrentSandboxSnapshotPolicy JSON"));
  assert("Agent chat uses API payload helper", agentChatView.includes("createCurrentSandboxSnapshotPayload"));
  assert("Agent chat uses centralized snapshot prompt context", agentChatView.includes("createSandboxSnapshotChatMessages"));
  assert("Agent chat uses derived insight brief", agentChatView.includes("buildCurrentSandboxInsight") && agentChatView.includes("sceneInsight.brief"));
  assert("Agent chat does not inline snapshot policy prompt", !agentChatView.includes("CurrentSandboxSnapshotPolicy JSON"));

  assert("Doc states only current status is output", doc.includes("当前沙盘这一刻的完整状态"));
  assert("Doc excludes event flow", doc.includes("事件流") && doc.includes("不包含新增、移动、删除等历史过程"));
  assert("Doc excludes personal memory", doc.includes("个人记忆") && doc.includes("不包含长期记忆"));
  assert("Doc excludes authorization context", doc.includes("授权上下文"));
  assert("Doc excludes images", doc.includes("图片截图"));
  assert("Doc defines visual supplement as non-LLM evidence", doc.includes("SandboxVisualSupplementDescriptor") && doc.includes("mayBeSentToLlm"));
  assert("Analysis layer doc describes Snapshot to Insight pipeline", analysisDoc.includes("CurrentSandboxSnapshot") && analysisDoc.includes("CurrentSandboxInsight"));
  assert("Analysis layer doc rejects screenshot-first analysis", analysisDoc.includes("不应优先做") && analysisDoc.includes("看截图再分析"));
  assert("Analysis layer doc constrains visual supplement", analysisDoc.includes("SandboxVisualSupplementDescriptor") && analysisDoc.includes("不可作为 LLM 主输入"));
  await assertNoBypassedSnapshotBuilderImports();
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== "object") {
    return keys;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  Object.entries(value).forEach(([key, child]) => {
    keys.add(key);
    collectKeys(child, keys);
  });
  return keys;
}

async function readProjectFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

async function assertNoBypassedSnapshotBuilderImports() {
  const sourceFiles = await listSourceFiles(path.resolve(process.cwd(), "src"));
  const allowed = new Set([
    path.normalize("src/api/currentSandboxSnapshotApi.ts"),
    path.normalize("src/llm/currentSandboxSnapshot.ts"),
  ]);
  const bypasses = [];

  await Promise.all(
    sourceFiles.map(async (absolutePath) => {
      const relativePath = path.relative(process.cwd(), absolutePath);
      const normalized = path.normalize(relativePath);
      const content = await readFile(absolutePath, "utf8");
      if (!allowed.has(normalized) && content.includes("buildCurrentSandboxSnapshot")) {
        bypasses.push(relativePath);
      }
    }),
  );

  bypasses.sort();
  assert("No UI or LLM entry bypasses Snapshot API helper", bypasses.length === 0, bypasses.join(", "));
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(fullPath);
      }
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        return [fullPath];
      }
      return [];
    }),
  );
  return files.flat();
}

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail: String(detail ?? "") });
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

function printSummary() {
  for (const result of results) {
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
  }

  const passed = results.filter((result) => result.ok).length;
  const total = results.length;
  console.log(`Current Snapshot contract QA summary: ${passed}/${total} passed`);
}
