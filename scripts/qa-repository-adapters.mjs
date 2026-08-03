#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "repository-adapter-qa");
const ENTRY_PATH = path.join(ARTIFACT_DIR, "repository-adapter-entry.ts");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "repository-adapter-entry.mjs");
const REPORT_PATH = path.join(ARTIFACT_DIR, "repository-adapter-report.json");
const EXPECTED_API_VERSION = "2026-05-06.v1";
const EXPECTED_MODES = ["localStorage", "mockApi", "remoteApi"];
const EXPECTED_DOMAIN_KEYS = ["identity", "workspace", "access", "sandtray", "memory", "conversation", "asset", "llm", "task"];

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
  await assertStaticRepositoryFiles();
  assertRuntimeReports(runtime.default);
  await writeFile(REPORT_PATH, `${JSON.stringify(runtime.default, null, 2)}\n`, "utf8");
  printSummary();
} catch (error) {
  results.push({
    name: "Repository adapter QA runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

function buildRuntimeEntry() {
  return `
import { createDefaultAdminGovernance } from "../../src/admin/localAdminGovernance";
import { createDefaultLlmProviders, createDefaultPsychAgents } from "../../src/data/defaultAgents";
import { createDefaultManagedAssets } from "../../src/data/assets";
import { createDefaultPersonalData, createLocalPersonalUser } from "../../src/personal/localMemoryStore";
import { getSystemRepositoryAdapter, REPOSITORY_MODE_OPTIONS, isRepositoryMode } from "../../src/platform/repositoryAdapterRegistry";

const timestamp = "2026-08-02T00:00:00.000Z";
const personalSeed = createDefaultPersonalData();
const personalData = createLocalPersonalUser(
  createLocalPersonalUser(personalSeed, {
    displayName: "仓储样例学生",
    ageGroup: "teen",
    role: "student",
  }).data,
  {
    displayName: "仓储样例来访者",
    ageGroup: "adult",
    role: "client",
  },
).data;
const adminGovernance = createDefaultAdminGovernance(personalData);
const context = {
  managedAssets: createDefaultManagedAssets(timestamp),
  llmProviders: createDefaultLlmProviders(timestamp),
  agents: createDefaultPsychAgents(timestamp),
};
const modes = ["localStorage", "mockApi", "remoteApi"].filter(isRepositoryMode);
const reports = modes.map((mode) => {
  const adapter = getSystemRepositoryAdapter(mode);
  return adapter.buildReport(personalData, adminGovernance, context);
});

export default {
  options: REPOSITORY_MODE_OPTIONS,
  reports,
};
`;
}

async function assertStaticRepositoryFiles() {
  const [registry, localAdapter, apiAdapter, types, packageJson, qualityGates] = await Promise.all([
    readProjectFile("src/platform/repositoryAdapterRegistry.ts"),
    readProjectFile("src/platform/localRepositoryAdapter.ts"),
    readProjectFile("src/platform/apiRepositoryAdapter.ts"),
    readProjectFile("src/platform/repositoryTypes.ts"),
    readProjectFile("package.json"),
    readProjectFile("docs/quality-gates.md"),
  ]);

  assert("Registry declares localStorage mode", registry.includes('mode: "localStorage"'));
  assert("Registry declares mockApi mode", registry.includes('mode: "mockApi"'));
  assert("Registry declares remoteApi mode", registry.includes('mode: "remoteApi"'));
  assert("Registry exposes mode guard", registry.includes("isRepositoryMode"));
  assert("Local adapter builds API contract report", localAdapter.includes("buildMockApiContractReport"));
  assert("API adapter uses shared API client", apiAdapter.includes("createApiClient"));
  assert("API adapter keeps remote placeholder explicit", apiAdapter.includes("RemoteApiRepositoryAdapter.placeholder.v1"));
  assert("Repository report type includes backend diagnostics", types.includes("BackendAdapterReport"));
  assert("Package exposes repository QA command", packageJson.includes('"qa:repository"'));
  assert("Quality gates mention repository QA command", qualityGates.includes("npm run qa:repository"));
}

function assertRuntimeReports(runtime) {
  assert("Runtime exports repository options", Array.isArray(runtime.options));
  assert("Runtime exports repository reports", Array.isArray(runtime.reports));
  const optionModes = runtime.options.map((option) => option.mode);
  const reportModes = runtime.reports.map((report) => report.mode);

  EXPECTED_MODES.forEach((mode) => {
    assert(`Mode option exists: ${mode}`, optionModes.includes(mode), optionModes.join(", "));
    assert(`Mode report exists: ${mode}`, reportModes.includes(mode), reportModes.join(", "));
  });

  assert("All repository mode options are enabled for demo switching", runtime.options.every((option) => option.enabled === true));

  const reportByMode = new Map(runtime.reports.map((report) => [report.mode, report]));
  assertReportShape(reportByMode.get("localStorage"), {
    mode: "localStorage",
    adapterName: "LocalStorageRepositoryAdapter.v1",
    transport: "localStorage",
    remoteReady: false,
    mockRoundTrip: false,
  });
  assertReportShape(reportByMode.get("mockApi"), {
    mode: "mockApi",
    adapterName: "MockApiRepositoryAdapter.v1",
    transport: "mock-api",
    remoteReady: false,
    mockRoundTrip: true,
  });
  assertReportShape(reportByMode.get("remoteApi"), {
    mode: "remoteApi",
    adapterName: "RemoteApiRepositoryAdapter.placeholder.v1",
    transport: "http",
    remoteReady: false,
    mockRoundTrip: true,
  });
}

function assertReportShape(report, expectation) {
  assert(`${expectation.mode} report exists`, Boolean(report));
  assert(`${expectation.mode} adapter name is stable`, report.adapterName === expectation.adapterName, report.adapterName);
  assert(`${expectation.mode} backend transport is correct`, report.backend.transport === expectation.transport, report.backend.transport);
  assert(`${expectation.mode} remoteReady flag is correct`, report.backend.remoteReady === expectation.remoteReady, String(report.backend.remoteReady));
  assert(`${expectation.mode} mockRoundTrip flag is correct`, report.backend.mockRoundTrip === expectation.mockRoundTrip, String(report.backend.mockRoundTrip));
  assert(`${expectation.mode} generatedAt is present`, typeof report.generatedAt === "string" && report.generatedAt.includes("T"), report.generatedAt);
  assert(`${expectation.mode} has health metrics`, Array.isArray(report.metrics) && report.metrics.length >= 6, String(report.metrics?.length ?? 0));
  assert(`${expectation.mode} has workspace rows`, Array.isArray(report.workspaces) && report.workspaces.length >= 1, String(report.workspaces?.length ?? 0));
  assert(`${expectation.mode} has migration steps`, Array.isArray(report.migrationSteps) && report.migrationSteps.length >= 5, String(report.migrationSteps?.length ?? 0));
  assert(`${expectation.mode} API contract version is stable`, report.apiContract.version === EXPECTED_API_VERSION, report.apiContract.version);
  assert(`${expectation.mode} API endpoints are present`, report.apiContract.endpoints.length >= 19, String(report.apiContract.endpoints.length));
  assert(`${expectation.mode} API service boundaries are present`, report.apiContract.serviceBoundaries.length >= 10, String(report.apiContract.serviceBoundaries.length));
  assert(`${expectation.mode} API sample user page is valid`, report.apiContract.sampleUserPage.ok && report.apiContract.sampleUserPage.data.items.length >= 3);
  assert(`${expectation.mode} API sample asset page is valid`, report.apiContract.sampleAssetPage.ok && report.apiContract.sampleAssetPage.data.items.length >= 5);
  assert(`${expectation.mode} backend checks are present`, Array.isArray(report.backend.checks) && report.backend.checks.length >= 3, String(report.backend.checks?.length ?? 0));
  assert(`${expectation.mode} backend service boundary count is aligned`, report.backend.serviceBoundaryCount === report.apiContract.serviceBoundaries.length, String(report.backend.serviceBoundaryCount));
  assert(`${expectation.mode} backend-required boundary count is present`, report.backend.backendRequiredBoundaryCount >= 1, String(report.backend.backendRequiredBoundaryCount));

  const domainKeys = new Set(report.domains.map((domain) => domain.key));
  const missingDomains = EXPECTED_DOMAIN_KEYS.filter((key) => !domainKeys.has(key));
  assert(`${expectation.mode} report covers required domains`, missingDomains.length === 0, missingDomains.join(", "));

  const serialized = JSON.stringify(report);
  assert(`${expectation.mode} report does not leak raw secret keys`, !serialized.includes('"apiKey"') && !serialized.includes('"apiKeySecret"'));
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
  console.log(`\nRepository adapter QA: ${passed}/${results.length} checks passed`);
  failed.forEach((result) => console.log(`FAIL ${result.name}${result.detail ? ` - ${result.detail}` : ""}`));
  if (failed.length === 0) {
    console.log(`Report: ${path.relative(process.cwd(), REPORT_PATH)}`);
  }
}
