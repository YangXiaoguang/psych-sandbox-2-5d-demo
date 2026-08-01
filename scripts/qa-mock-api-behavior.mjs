#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "mock-api-behavior-qa");
const ENTRY_PATH = path.join(ARTIFACT_DIR, "mock-api-behavior-entry.ts");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "mock-api-behavior-entry.mjs");
const REPORT_PATH = path.join(ARTIFACT_DIR, "mock-api-behavior-report.json");

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
  await assertStaticFiles();
  assertBehaviorReport(runtime.default);
  await writeFile(REPORT_PATH, `${JSON.stringify(runtime.default, null, 2)}\n`, "utf8");
  printSummary();
} catch (error) {
  results.push({
    name: "Mock API behavior QA runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

function buildRuntimeEntry() {
  return `
import { createDefaultAdminGovernance } from "../../src/admin/localAdminGovernance";
import { createMockApiAdapter } from "../../src/api/mockApiAdapter";
import { createDefaultLlmProviders, createDefaultPsychAgents } from "../../src/data/defaultAgents";
import { createDefaultManagedAssets } from "../../src/data/assets";
import {
  createDefaultPersonalData,
  createLocalPersonalUser,
  createSandtraySessionArchive,
  extractMemoryCandidatesFromSandtraySession,
} from "../../src/personal/localMemoryStore";
import { analyzeScene } from "../../src/utils/analysis";

const timestamp = "2026-08-02T00:00:00.000Z";
const personalSeed = createDefaultPersonalData();
const withStudent = createLocalPersonalUser(personalSeed, {
  displayName: "仓储样例学生",
  ageGroup: "teen",
  role: "student",
});
const withClient = createLocalPersonalUser(withStudent.data, {
  displayName: "仓储样例来访者",
  ageGroup: "adult",
  role: "client",
});
const managedAssets = createDefaultManagedAssets(timestamp).map((asset, index) => ({
  ...asset,
  updatedAt: new Date(Date.parse(timestamp) + index * 1000).toISOString(),
}));
const house = managedAssets.find((asset) => asset.assetId === "env_house");
const fish = managedAssets.find((asset) => asset.assetId === "animal_fish");
if (!house || !fish) {
  throw new Error("Missing seeded assets.");
}
const objects = [
  toObject(house, "obj_house_seed", 292, 172, 0),
  toObject(fish, "obj_fish_seed", 520, 420, 1),
];
const events = [
  {
    id: "event_add_house",
    type: "add",
    timestamp,
    objectId: "obj_house_seed",
    assetId: house.assetId,
    label: "新增沙具：房子",
  },
  {
    id: "event_move_fish",
    type: "move",
    timestamp: "2026-08-02T00:01:00.000Z",
    objectId: "obj_fish_seed",
    assetId: fish.assetId,
    label: "移动沙具：鱼",
  },
];
const analysis = analyzeScene(objects);
const basePersonalData = withClient.data;
const session = createSandtraySessionArchive({
  userId: basePersonalData.activeUserId,
  workspaceId: basePersonalData.workspaces.find((workspace) => workspace.userId === basePersonalData.activeUserId)?.workspaceId,
  title: "Mock API 行为样例沙盘",
  description: "用于验证分页、筛选、排序和当前沙盘 Snapshot 的本地样例。",
  objects,
  events,
  analysis,
  environment: { weather: "sunny", light: "day" },
});
const personalWithSession = {
  ...basePersonalData,
  sandtraySessions: [session, ...basePersonalData.sandtraySessions],
};
const { data: personalData } = extractMemoryCandidatesFromSandtraySession(personalWithSession, session);
const adminGovernance = createDefaultAdminGovernance(personalData);
const llmProviders = createDefaultLlmProviders(timestamp).map((provider) =>
  provider.id === "provider_deepseek"
    ? {
        ...provider,
        enabled: true,
        apiKey: "sk-mock-behavior-secret",
        updatedAt: "2026-08-02T00:02:00.000Z",
      }
    : provider,
);
const agents = createDefaultPsychAgents(timestamp);
const adapter = createMockApiAdapter({
  personalData,
  adminGovernance,
  managedAssets,
  llmProviders,
  agents,
  activeUserId: personalData.activeUserId,
});

const [
  usersPage,
  userQuery,
  studentUsers,
  invalidUsersPage,
  sortedAssets,
  animalAssets,
  riskAssets,
  waterAssetQuery,
  providers,
  jungAgents,
  sessionPage,
  memoryPage,
  snapshotResponse,
] = await Promise.all([
  adapter.queryUsers({ page: 1, pageSize: 2, sort: [{ field: "displayName", direction: "asc" }] }),
  adapter.queryUsers({ page: 1, pageSize: 5, query: "仓储样例学生" }),
  adapter.queryUsers({ page: 1, pageSize: 10, filters: { role: "student" } }),
  adapter.queryUsers({ page: 999, pageSize: 1 }),
  adapter.queryAssets({ page: 1, pageSize: 1, sort: [{ field: "updatedAt", direction: "desc" }] }),
  adapter.queryAssets({ page: 1, pageSize: 20, filters: { category: "动物" } }),
  adapter.queryAssets({ page: 1, pageSize: 20, filters: { riskTag: ["fantasy", "death"] } }),
  adapter.queryAssets({ page: 1, pageSize: 10, query: "水域" }),
  adapter.queryLlmProviders({ page: 1, pageSize: 20 }),
  adapter.queryAgents({ page: 1, pageSize: 5, query: "荣格" }),
  adapter.querySandtraySessions({ page: 1, pageSize: 5 }),
  adapter.queryMemoryCandidates({ page: 1, pageSize: 10, filters: { kind: "session_summary" } }),
  adapter.createCurrentSandboxSnapshot({
    environment: { weather: "rainy", light: "night" },
    objects,
    selectedObjectId: "obj_house_seed",
    generatedAt: "2026-08-02T00:03:00.000Z",
    snapshotId: "snapshot_mock_api_behavior",
  }),
]);

export default {
  authContext: adapter.createAuthContext(),
  usersPage,
  userQuery,
  studentUsers,
  invalidUsersPage,
  sortedAssets,
  animalAssets,
  riskAssets,
  waterAssetQuery,
  providers,
  jungAgents,
  sessionPage,
  memoryPage,
  snapshotResponse,
};

function toObject(asset, id, x, y, index) {
  return {
    id,
    assetId: asset.assetId,
    name: asset.name,
    category: asset.category,
    x,
    y,
    width: asset.defaultWidth,
    height: asset.defaultHeight,
    rotation: index === 0 ? -3 : 6,
    scale: index === 0 ? 1.2 : 0.92,
    createdAt: 1000 + index,
    riskTag: asset.riskTag,
    symbolicCandidates: asset.symbolicCandidates,
    anchor: asset.anchor,
    footprint: asset.footprint,
    thumbnailScale: asset.thumbnailScale,
    semanticTags: asset.semanticTags,
    modelRecipe: asset.modelRecipe,
  };
}
`;
}

async function assertStaticFiles() {
  const [adapter, contracts, packageJson, qualityGates] = await Promise.all([
    readProjectFile("src/api/mockApiAdapter.ts"),
    readProjectFile("src/api/contracts.ts"),
    readProjectFile("package.json"),
    readProjectFile("docs/quality-gates.md"),
  ]);

  assert("Mock adapter exposes all list queries", [
    "queryUsers",
    "queryWorkspaces",
    "queryAccessPolicies",
    "querySandtraySessions",
    "queryMemoryCandidates",
    "queryAssets",
    "queryLlmProviders",
    "queryAgents",
  ].every((method) => adapter.includes(method)));
  assert("Mock adapter applies query and filters", adapter.includes("applyFiltersAndQuery"));
  assert("Mock adapter returns PAGE_OUT_OF_RANGE", adapter.includes("PAGE_OUT_OF_RANGE"));
  assert("Mock adapter masks API keys", adapter.includes("maskApiKey(provider.apiKey)"));
  assert("Contracts define generic page response", contracts.includes("ApiPageResponseDto"));
  assert("Package exposes mock API QA command", packageJson.includes('"qa:mock-api"'));
  assert("Quality gates mention mock API QA command", qualityGates.includes("npm run qa:mock-api"));
}

function assertBehaviorReport(report) {
  assert("Auth context is local demo", report.authContext.authMode === "local_demo", report.authContext.authMode);
  assert("Auth context includes active user", typeof report.authContext.activeUserId === "string" && report.authContext.activeUserId.length > 0);
  assert("Auth context includes permissions", Array.isArray(report.authContext.permissions) && report.authContext.permissions.includes("users.read"));

  assertPage("usersPage", report.usersPage);
  assert("User page respects requested page size", report.usersPage.data.items.length === 2, String(report.usersPage.data.items.length));
  assert("User page exposes next page", report.usersPage.data.page.hasNextPage === true);
  assert("User page stable sort key follows request", report.usersPage.data.page.stableSortKey === "displayName", report.usersPage.data.page.stableSortKey);

  assertPage("userQuery", report.userQuery);
  assert("User query finds seeded student", report.userQuery.data.items.some((item) => item.displayName === "仓储样例学生"));
  assertPage("studentUsers", report.studentUsers);
  assert("Role filter returns student users only", report.studentUsers.data.items.length > 0 && report.studentUsers.data.items.every((item) => item.role === "student"));
  assert("Out of range page returns API error", report.invalidUsersPage.ok === false && report.invalidUsersPage.error.code === "PAGE_OUT_OF_RANGE");

  assertPage("sortedAssets", report.sortedAssets);
  assert("Asset sort by updatedAt desc returns latest asset", report.sortedAssets.data.items[0]?.assetId === "symbol_light", report.sortedAssets.data.items[0]?.assetId);
  assertPage("animalAssets", report.animalAssets);
  assert("Asset category filter returns animal assets only", report.animalAssets.data.items.length >= 4 && report.animalAssets.data.items.every((item) => item.category === "动物"));
  assertPage("riskAssets", report.riskAssets);
  assert("Array filter supports multiple risk tags", report.riskAssets.data.items.length > 0 && report.riskAssets.data.items.every((item) => ["fantasy", "death"].includes(item.riskTag)));
  assertPage("waterAssetQuery", report.waterAssetQuery);
  assert("Asset query finds water", report.waterAssetQuery.data.items.some((item) => item.assetId === "nature_water"));

  assertPage("providers", report.providers);
  const deepSeek = report.providers.data.items.find((item) => item.id === "provider_deepseek");
  assert("Provider page includes DeepSeek", Boolean(deepSeek));
  assert("Provider reports configured key", deepSeek.apiKeyConfigured === true);
  assert("Provider masks key preview", deepSeek.apiKeyPreview.includes("****") && !deepSeek.apiKeyPreview.includes("sk-mock-behavior-secret"), deepSeek.apiKeyPreview);

  assertPage("jungAgents", report.jungAgents);
  assert("Agent query finds Jungian companion", report.jungAgents.data.items.some((item) => item.id === "agent_jungian_companion"));

  assertPage("sessionPage", report.sessionPage);
  assert("Session query exposes archived sandbox summary", report.sessionPage.data.items[0]?.objectCount === 2, String(report.sessionPage.data.items[0]?.objectCount));
  assertPage("memoryPage", report.memoryPage);
  assert("Memory query exposes generated session summary", report.memoryPage.data.items.some((item) => item.kind === "session_summary"));

  assert("Snapshot response succeeds", report.snapshotResponse.ok === true, JSON.stringify(report.snapshotResponse));
  assert("Snapshot response keeps current schema", report.snapshotResponse.data.snapshot.schemaVersion === "sandbox.current-snapshot.v1");
  assert("Snapshot response preserves selected object", report.snapshotResponse.data.snapshot.selectedObjectId === "obj_house_seed");
  assert("Snapshot response excludes event flow by policy", report.snapshotResponse.data.policy.includesEvents === false);

  const serialized = JSON.stringify(report);
  assert("Behavior report does not leak raw API key", !serialized.includes("sk-mock-behavior-secret"));
  assert("Behavior report does not expose apiKey fields", !serialized.includes('"apiKey"') && !serialized.includes('"apiKeySecret"'));
}

function assertPage(name, response) {
  assert(`${name} succeeds`, response?.ok === true, JSON.stringify(response));
  assert(`${name} has items`, Array.isArray(response.data?.items));
  assert(`${name} has page metadata`, Boolean(response.data?.page));
  assert(`${name} page is one-based`, response.data.page.page >= 1, String(response.data.page.page));
}

async function readProjectFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

function printSummary() {
  const passed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);
  console.log(`\nMock API behavior QA: ${passed}/${results.length} checks passed`);
  failed.forEach((result) => console.log(`FAIL ${result.name}${result.detail ? ` - ${result.detail}` : ""}`));
  if (failed.length === 0) {
    console.log(`Report: ${path.relative(process.cwd(), REPORT_PATH)}`);
  }
}
