#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CURRENT_SANDBOX_SNAPSHOT_V1,
  EVIDENCE_GRAPH_V1,
  FEATURE_ALGORITHM_V1,
  FEATURE_BUNDLE_V1,
  RECONSTRUCTED_SCENE_V1,
  SANDBOX_ANALYSIS_RESULT_V1,
  SANDBOX_EXPERT_REVIEW_V1,
  SANDBOX_HYPOTHESIS_DRAFT_V1,
  SANDBOX_HYPOTHESIS_PROMPT_V1,
  createSandboxAnalysisEngine,
} from "../packages/sandbox-analysis-engine/dist/index.js";

const root = process.cwd();
const artifactDir = path.join(root, "artifacts", "sandbox-analysis-engine-qa");
const entryPath = path.join(artifactDir, "current-app-snapshot-entry.ts");
const bundlePath = path.join(artifactDir, "current-app-snapshot-entry.mjs");
const results = [];

try {
  await mkdir(artifactDir, { recursive: true });
  await buildCurrentAppSnapshot();
  const runtime = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
  const snapshot = runtime.default;
  const engine = createSandboxAnalysisEngine();

  assert("Public API exposes current snapshot version", engine.currentSnapshotSchemaVersion === CURRENT_SANDBOX_SNAPSHOT_V1);
  assert("Public contracts expose analysis result version", SANDBOX_ANALYSIS_RESULT_V1 === "sandbox.analysis-result.v1");
  assert("Public contracts expose expert review version", SANDBOX_EXPERT_REVIEW_V1 === "sandbox.expert-review.v1");
  assert("Public contracts expose hypothesis draft version", SANDBOX_HYPOTHESIS_DRAFT_V1 === "sandbox.hypothesis-draft.v1");
  assert("Public contracts expose hypothesis prompt version", SANDBOX_HYPOTHESIS_PROMPT_V1 === "sandbox.hypothesis-prompt.v1");

  const validation = engine.validateSnapshot(snapshot);
  assert("Current app Snapshot validates in standalone package", validation.ok, formatIssues(validation.issues));
  assert("Current app Snapshot keeps object count", validation.ok && validation.value.objects.length === 1);

  const parsed = engine.parseSnapshot(snapshot);
  assert("Current v1 Snapshot parses without migration", parsed.ok && parsed.appliedMigrations.length === 0, parsed.ok ? "" : formatIssues(parsed.issues));

  const deterministic = engine.analyzeDeterministically(snapshot);
  assert("Current app Snapshot reconstructs deterministically", deterministic.ok && deterministic.value.scene.schemaVersion === RECONSTRUCTED_SCENE_V1);
  assert("Feature bundle exposes frozen algorithm version", deterministic.ok && deterministic.value.featureBundle.algorithmVersion === FEATURE_ALGORITHM_V1);
  assert("Feature bundle exposes current schema", deterministic.ok && deterministic.value.featureBundle.schemaVersion === FEATURE_BUNDLE_V1);
  assert("Evidence graph exposes current schema", deterministic.ok && deterministic.value.featureBundle.evidenceGraph.schemaVersion === EVIDENCE_GRAPH_V1);
  assert("Evidence graph keeps fact and feature layers", deterministic.ok && deterministic.value.featureBundle.evidenceGraph.nodes.some((node) => node.layer === "fact") && deterministic.value.featureBundle.evidenceGraph.nodes.some((node) => node.layer === "feature"));
  assert("Deterministic output is deeply frozen", deterministic.ok && Object.isFrozen(deterministic.value.scene.objects) && Object.isFrozen(deterministic.value.featureBundle.evidenceGraph));
  const deterministicRepeat = engine.analyzeDeterministically(structuredClone(snapshot));
  assert("Repeated deterministic output is byte stable", deterministic.ok && deterministicRepeat.ok && JSON.stringify(deterministic.value) === JSON.stringify(deterministicRepeat.value));

  const snowySnapshot = structuredClone(snapshot);
  snowySnapshot.environment.weather = "snowy";
  snowySnapshot.environment.weatherLabel = "降雪";
  const snowyResult = engine.validateSnapshot(snowySnapshot);
  assert("Snowy attachment-compatible weather validates", snowyResult.ok, formatIssues(snowyResult.issues));

  const extendedWeather = structuredClone(snapshot);
  extendedWeather.environment.weather = "misty";
  extendedWeather.environment.weatherLabel = "薄雾";
  const extendedWeatherResult = engine.validateSnapshot(extendedWeather);
  assert("Unknown future weather remains structurally valid", extendedWeatherResult.ok, formatIssues(extendedWeatherResult.issues));
  assert("Unknown future weather emits warning", extendedWeatherResult.issues.some((item) => item.severity === "warning" && item.path === "/environment/weather"));

  const missingSelection = structuredClone(snapshot);
  missingSelection.selectedObjectId = "missing-object";
  const missingSelectionResult = engine.validateSnapshot(missingSelection);
  assert("Missing selected object reference is rejected", !missingSelectionResult.ok && hasIssue(missingSelectionResult.issues, "REFERENCE_NOT_FOUND"));

  const invalidCount = structuredClone(snapshot);
  invalidCount.analysis.totalObjects = 99;
  const invalidCountResult = engine.validateSnapshot(invalidCount);
  assert("Inconsistent object count is rejected", !invalidCountResult.ok && hasIssue(invalidCountResult.issues, "COUNT_MISMATCH"));

  const unversioned = structuredClone(snapshot);
  delete unversioned.schemaVersion;
  const unversionedResult = engine.parseSnapshot(unversioned);
  assert("Unversioned data is rejected without guessing", !unversionedResult.ok && hasIssue(unversionedResult.issues, "MISSING_FIELD"));

  engine.registerMigration({
    fromVersion: "sandbox.current-snapshot.qa-v0",
    toVersion: CURRENT_SANDBOX_SNAPSHOT_V1,
    description: "QA-only explicit migration",
    migrate(input) {
      return { ...input, schemaVersion: CURRENT_SANDBOX_SNAPSHOT_V1 };
    },
  });
  const legacy = { ...structuredClone(snapshot), schemaVersion: "sandbox.current-snapshot.qa-v0" };
  const migrated = engine.migrateSnapshot(legacy);
  assert("Registered migration reaches current schema", migrated.ok && migrated.value.schemaVersion === CURRENT_SANDBOX_SNAPSHOT_V1);
  assert("Migration audit records applied step", migrated.ok && migrated.appliedMigrations.length === 1 && migrated.sourceVersion === "sandbox.current-snapshot.qa-v0");
  assert("Supported versions include registered source", engine.getSupportedSnapshotVersions().includes("sandbox.current-snapshot.qa-v0"));

  await assertSchemas();
  printSummary();
} catch (error) {
  results.push({
    name: "Sandbox analysis engine QA runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

async function buildCurrentAppSnapshot() {
  await writeFile(
    entryPath,
    `
import { createCurrentSandboxSnapshotPayload } from "../../src/api/currentSandboxSnapshotApi";

const object = {
  id: "obj_house_qa",
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
  symbolicCandidates: ["家庭", "安全"],
  anchor: { x: 0.5, y: 0.78 },
  footprint: { kind: "wide", width: 1.2, depth: 0.9, height: 0.8 },
  thumbnailScale: 1,
  semanticTags: ["建筑", "安全感"],
  modelRecipe: { kind: "house" },
};

export default createCurrentSandboxSnapshotPayload({
  environment: { weather: "rainy", light: "night" },
  objects: [object],
  selectedObjectId: object.id,
  generatedAt: "2026-08-05T10:00:00+08:00",
  snapshotId: "snapshot_analysis_engine_qa",
}).snapshot;
`,
    "utf8",
  );

  await esbuild.build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    logLevel: "silent",
  });
}

async function assertSchemas() {
  const schemaDirectory = path.join(root, "packages", "sandbox-analysis-engine", "schemas");
  const snapshotSchema = JSON.parse(await readFile(path.join(schemaDirectory, "current-sandbox-snapshot.v1.schema.json"), "utf8"));
  const analysisSchema = JSON.parse(await readFile(path.join(schemaDirectory, "sandbox-analysis-result.v1.schema.json"), "utf8"));
  const reviewSchema = JSON.parse(await readFile(path.join(schemaDirectory, "expert-review.v1.schema.json"), "utf8"));
  const sceneSchema = JSON.parse(await readFile(path.join(schemaDirectory, "reconstructed-scene.v1.schema.json"), "utf8"));
  const evidenceGraphSchema = JSON.parse(await readFile(path.join(schemaDirectory, "evidence-graph.v1.schema.json"), "utf8"));
  const featureBundleSchema = JSON.parse(await readFile(path.join(schemaDirectory, "feature-bundle.v1.schema.json"), "utf8"));
  const hypothesisDraftSchema = JSON.parse(await readFile(path.join(schemaDirectory, "sandbox-hypothesis-draft.v1.schema.json"), "utf8"));

  assert("Snapshot JSON Schema uses draft 2020-12", snapshotSchema.$schema === "https://json-schema.org/draft/2020-12/schema");
  assert("Snapshot JSON Schema locks current version", snapshotSchema.properties.schemaVersion.const === CURRENT_SANDBOX_SNAPSHOT_V1);
  assert("Snapshot JSON Schema excludes additional root fields", snapshotSchema.additionalProperties === false);
  assert("Analysis JSON Schema locks result version", analysisSchema.properties.schemaVersion.const === SANDBOX_ANALYSIS_RESULT_V1);
  assert("Analysis JSON Schema requires non-diagnostic guardrail", analysisSchema.properties.guardrails.properties.notDiagnosis.const === true);
  assert("Interview question schema forbids leading questions", analysisSchema.$defs.question.properties.leading.const === false);
  assert("Expert review JSON Schema locks rubric version", reviewSchema.properties.rubricVersion.const === "sandbox.analysis.expert-rubric.v1");
  assert("Expert review scores stay in 1-5 range", reviewSchema.properties.scores.items.properties.score.minimum === 1 && reviewSchema.properties.scores.items.properties.score.maximum === 5);
  assert("Reconstructed Scene JSON Schema locks version", sceneSchema.properties.schemaVersion.const === RECONSTRUCTED_SCENE_V1);
  assert("Reconstructed Scene JSON Schema documents preserved footprint policy", sceneSchema.$defs.object.properties.footprint.properties.measurementPolicy.const === "preserved-only");
  assert("Evidence Graph JSON Schema locks version", evidenceGraphSchema.properties.schemaVersion.const === EVIDENCE_GRAPH_V1);
  assert("Evidence Graph only permits Fact and Feature layers", evidenceGraphSchema.$defs.node.properties.layer.enum.join(",") === "fact,feature");
  assert("Feature Bundle JSON Schema locks version", featureBundleSchema.properties.schemaVersion.const === FEATURE_BUNDLE_V1);
  assert("Feature Bundle JSON Schema locks weak process inputs", featureBundleSchema.properties.processEvidence.properties.availableSignals.const.join(",") === "createdOrder");
  assert("Hypothesis Draft JSON Schema locks version", hypothesisDraftSchema.properties.schemaVersion.const === SANDBOX_HYPOTHESIS_DRAFT_V1);
  assert("Hypothesis Draft forbids fact or feature injection", hypothesisDraftSchema.additionalProperties === false && !("facts" in hypothesisDraftSchema.properties) && !("features" in hypothesisDraftSchema.properties));
  assert("Hypothesis Draft requires non-leading questions", hypothesisDraftSchema.$defs.question.properties.leading.const === false);
  assert("Analysis result accepts recursive JSON feature values", analysisSchema.$defs.feature.properties.value.$ref === "#/$defs/jsonValue");
}

function hasIssue(issues, code) {
  return issues.some((item) => item.code === code);
}

function formatIssues(issues) {
  return issues.map((item) => `${item.code}@${item.path}: ${item.message}`).join(" | ");
}

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

function printSummary() {
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
  }
  const passed = results.filter((result) => result.ok).length;
  console.log(`Sandbox analysis engine QA summary: ${passed}/${results.length} passed`);
}
