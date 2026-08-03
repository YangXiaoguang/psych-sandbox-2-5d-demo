#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "api-contract");
const ENTRY_PATH = path.join(ARTIFACT_DIR, "api-contract-entry.ts");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "api-contract-entry.mjs");
const REPORT_PATH = path.join(ARTIFACT_DIR, "api-contract-report.json");
const SUMMARY_PATH = path.join(ARTIFACT_DIR, "api-contract-summary.md");
const EXPECTED_VERSION = "2026-05-06.v1";

const REQUIRED_ENDPOINTS = [
  "GET /api/admin/users",
  "PATCH /api/admin/users/:userId",
  "POST /api/auth/register",
  "POST /api/auth/login",
  "GET /api/workspaces",
  "GET /api/admin/access-policies",
  "PATCH /api/admin/access-policies/:userId",
  "GET /api/sandtray/sessions",
  "POST /api/sandtray/sessions/:sessionId/snapshots",
  "POST /api/llm/current-sandbox-snapshot",
  "GET /api/memory/candidates",
  "PATCH /api/memory/candidates/:memoryId",
  "GET /api/assets",
  "POST /api/assets",
  "GET /api/admin/llm-providers",
  "PATCH /api/admin/llm-providers/:providerId",
  "GET /api/admin/agents",
  "POST /api/admin/agents",
  "POST /api/tasks",
];

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
  const report = runtime.default;
  await assertStaticContractFiles();
  assertContractReport(report);
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(SUMMARY_PATH, buildSummaryMarkdown(report), "utf8");
  printSummary(report);
} catch (error) {
  results.push({
    name: "API contract export runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

function buildRuntimeEntry() {
  return `
import { createDefaultAdminGovernance } from "../../src/admin/localAdminGovernance";
import { buildMockApiContractReport } from "../../src/api/mockApiAdapter";
import { createDefaultLlmProviders, createDefaultPsychAgents } from "../../src/data/defaultAgents";
import { createDefaultManagedAssets } from "../../src/data/assets";
import { createDefaultPersonalData, createLocalPersonalUser } from "../../src/personal/localMemoryStore";

const seedTime = "2026-08-02T00:00:00.000Z";
const secondaryTime = "2026-08-02T00:05:00.000Z";
const personalSeed = createDefaultPersonalData();
const firstAdded = createLocalPersonalUser(personalSeed, {
  displayName: "样例学生",
  ageGroup: "teen",
  role: "student",
}).data;
const personalData = createLocalPersonalUser(firstAdded, {
  displayName: "样例来访者",
  ageGroup: "adult",
  role: "client",
}).data;
const adminGovernance = createDefaultAdminGovernance(personalData);
const managedAssets = createDefaultManagedAssets(seedTime);
const llmProviders = createDefaultLlmProviders(seedTime).map((provider) =>
  provider.id === "provider_deepseek"
    ? {
        ...provider,
        enabled: true,
        apiKey: "sk-contract-example-secret",
        updatedAt: secondaryTime,
      }
    : provider,
);
const agents = createDefaultPsychAgents(seedTime);

export default buildMockApiContractReport({
  personalData,
  adminGovernance,
  managedAssets,
  llmProviders,
  agents,
  activeUserId: personalData.activeUserId,
});
`;
}

async function assertStaticContractFiles() {
  const [contracts, adapter, client, docs] = await Promise.all([
    readProjectFile("src/api/contracts.ts"),
    readProjectFile("src/api/mockApiAdapter.ts"),
    readProjectFile("src/api/client.ts"),
    readProjectFile("docs/development-and-technical-spec.md"),
  ]);

  assert("Contracts declare stable version", contracts.includes(`API_CONTRACT_VERSION = "${EXPECTED_VERSION}"`));
  assert("Contracts expose endpoint catalog", contracts.includes("API_ENDPOINT_CONTRACTS"));
  assert("Contracts expose error catalog", contracts.includes("API_ERROR_CATALOG"));
  assert("Mock adapter exposes report builder", adapter.includes("buildMockApiContractReport"));
  assert("Mock adapter masks LLM provider keys", adapter.includes("apiKeyPreview: maskApiKey(provider.apiKey)"));
  assert("API client keeps typed response shape", client.includes("ApiResponseDto"));
  assert("Technical spec documents API contract", docs.includes("### 12.3 API 契约"));
}

function assertContractReport(report) {
  assert("Report object exists", Boolean(report) && typeof report === "object");
  assert("Report version is stable", report.version === EXPECTED_VERSION, report.version);
  assert("Report adapter name is present", report.adapterName === "FrontendMockApiAdapter.v1", report.adapterName);
  assert("Report generatedAt is ISO-like", typeof report.generatedAt === "string" && report.generatedAt.includes("T"), report.generatedAt);

  assert("Pagination min is one", report.pagination?.minPageSize === 1, JSON.stringify(report.pagination));
  assert("Pagination default is usable", report.pagination?.defaultPageSize >= 20, JSON.stringify(report.pagination));
  assert("Pagination max supports large lists", report.pagination?.maxPageSize >= 100, JSON.stringify(report.pagination));

  const errorCodes = new Set(report.errors?.map((item) => item.code));
  assert("Error catalog contains unique codes", errorCodes.size === report.errors?.length, JSON.stringify(report.errors));
  assert("Error catalog includes auth, validation and async task codes", ["AUTH_REQUIRED", "VALIDATION_FAILED", "TASK_ACCEPTED"].every((code) => errorCodes.has(code)));

  const endpointKeys = new Set(report.endpoints?.map((endpoint) => `${endpoint.method} ${endpoint.path}`));
  assert("Endpoint catalog contains unique method/path pairs", endpointKeys.size === report.endpoints?.length);
  const missingEndpoints = REQUIRED_ENDPOINTS.filter((key) => !endpointKeys.has(key));
  assert("Endpoint catalog covers required v1 paths", missingEndpoints.length === 0, missingEndpoints.join(", "));
  report.endpoints.forEach((endpoint) => {
    const key = `${endpoint.method} ${endpoint.path}`;
    assert(`Endpoint ${key} has DTO names`, Boolean(endpoint.requestDto) && Boolean(endpoint.responseDto));
    assert(`Endpoint ${key} has migration priority`, ["p0", "p1", "p2"].includes(endpoint.migrationPriority), endpoint.migrationPriority);
    assert(`Endpoint ${key} has valid error references`, endpoint.errors.every((code) => errorCodes.has(code)), endpoint.errors.join(", "));
  });

  assertPage("sampleUserPage", report.sampleUserPage);
  assertPage("sampleWorkspacePage", report.sampleWorkspacePage);
  assertPage("sampleAssetPage", report.sampleAssetPage);
  assertPage("sampleLlmProviderPage", report.sampleLlmProviderPage);
  assertPage("sampleMemoryPage", report.sampleMemoryPage, { allowEmpty: true });

  assert("Sample users include multiple local identities", report.sampleUserPage.data.items.length >= 3, String(report.sampleUserPage.data.items.length));
  assert("Sample assets include managed catalog records", report.sampleAssetPage.data.items.length >= 5, String(report.sampleAssetPage.data.items.length));
  assert("Sample LLM providers expose masked fields", report.sampleLlmProviderPage.data.items.some((item) => item.apiKeyConfigured && item.apiKeyPreview.includes("****")));

  const reportKeys = collectKeys(report);
  const forbiddenKeys = ["apiKey", "apiKeySecret", "password"];
  const leakedKeys = forbiddenKeys.filter((key) => reportKeys.has(key));
  assert("Report does not expose secret-bearing keys", leakedKeys.length === 0, leakedKeys.join(", "));
  const serialized = JSON.stringify(report);
  assert("Report does not contain sample plaintext API key", !serialized.includes("sk-contract-example-secret"));

  const snapshotResponse = report.sampleCurrentSandboxSnapshot;
  assert("Sample current snapshot response is successful", snapshotResponse?.ok === true, JSON.stringify(snapshotResponse));
  assert("Sample current snapshot schema is current", snapshotResponse.data.snapshot.schemaVersion === "sandbox.current-snapshot.v1");
  assert("Sample current insight schema is current", snapshotResponse.data.insight.schemaVersion === "sandbox.current-insight.v1");
  assert("Sample current insight links to snapshot", snapshotResponse.data.insight.sourceSnapshotId === snapshotResponse.data.snapshot.snapshotId);
  assert("Sample current snapshot policy excludes event flow", snapshotResponse.data.policy.includesEvents === false);

  assert("Auth context exposes active user", typeof report.authContext?.activeUserId === "string" && report.authContext.activeUserId.length > 0);
  assert("Auth context exposes effective permissions", Array.isArray(report.authContext?.permissions) && report.authContext.permissions.length > 0);
}

function assertPage(name, response, options = {}) {
  assert(`${name} is successful`, response?.ok === true, JSON.stringify(response));
  assert(`${name} has page metadata`, Boolean(response.data?.page));
  assert(`${name} page starts at one`, response.data.page.page === 1, String(response.data.page.page));
  assert(`${name} pageSize respects protocol`, response.data.page.pageSize <= 100, String(response.data.page.pageSize));
  assert(`${name} has items array`, Array.isArray(response.data.items));
  if (!options.allowEmpty) {
    assert(`${name} has sample rows`, response.data.items.length > 0, String(response.data.items.length));
  }
}

function buildSummaryMarkdown(report) {
  const p0 = report.endpoints.filter((endpoint) => endpoint.migrationPriority === "p0").length;
  const p1 = report.endpoints.filter((endpoint) => endpoint.migrationPriority === "p1").length;
  const p2 = report.endpoints.filter((endpoint) => endpoint.migrationPriority === "p2").length;
  return `# API Contract Export

- Version: ${report.version}
- Adapter: ${report.adapterName}
- Generated At: ${report.generatedAt}
- Endpoint Count: ${report.endpoints.length}
- Migration Priority: P0 ${p0} / P1 ${p1} / P2 ${p2}
- Error Codes: ${report.errors.length}
- Sample Users: ${report.sampleUserPage.data.page.total}
- Sample Assets: ${report.sampleAssetPage.data.page.total}
- Sample LLM Providers: ${report.sampleLlmProviderPage.data.page.total}

Generated files:

- \`api-contract-report.json\`
- \`api-contract-summary.md\`

Security note: the report only exposes provider key readiness and masked previews. It must never include plaintext API keys or passwords.
`;
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

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

function printSummary(report) {
  const passed = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);
  console.log(`\nAPI contract export QA: ${passed}/${results.length} checks passed`);
  failed.forEach((result) => console.log(`FAIL ${result.name}${result.detail ? ` - ${result.detail}` : ""}`));
  if (report && failed.length === 0) {
    console.log(`Report: ${path.relative(process.cwd(), REPORT_PATH)}`);
    console.log(`Summary: ${path.relative(process.cwd(), SUMMARY_PATH)}`);
  }
}
