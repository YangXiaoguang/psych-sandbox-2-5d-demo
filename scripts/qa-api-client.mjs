#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "api-client-qa");
const ENTRY_PATH = path.join(ARTIFACT_DIR, "api-client-entry.ts");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "api-client-entry.mjs");
const REPORT_PATH = path.join(ARTIFACT_DIR, "api-client-report.json");

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
  assertApiClientReport(runtime.default);
  await writeFile(REPORT_PATH, `${JSON.stringify(runtime.default, null, 2)}\n`, "utf8");
  printSummary();
} catch (error) {
  results.push({
    name: "API client QA runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

function buildRuntimeEntry() {
  return `
import { ApiClientError, createApiClient } from "../../src/api/client";

const authContext = {
  requestId: "auth_req_seed",
  actorUserId: "user_actor",
  activeUserId: "user_active",
  role: "admin",
  permissions: ["users.read", "assets.manage"],
  workspaceScope: "all",
  workspaceIds: ["workspace_a", "workspace_b"],
  authMode: "local_demo",
  issuedAt: "2026-08-02T00:00:00.000Z",
  expiresAt: "2026-08-02T08:00:00.000Z",
  timezone: "Asia/Shanghai",
  locale: "zh-CN",
};

const capturedRequests = [];
const successClient = createApiClient({
  baseUrl: " https://example.test/api/ ",
  timeoutMs: 5000,
  getAuthContext: () => authContext,
  fetchImpl: async (url, init) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    capturedRequests.push({
      url: String(url),
      method: init?.method,
      headers,
      body: typeof init?.body === "string" ? init.body : null,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        requestId: "server_req_success",
        data: { accepted: true, receivedBody: init?.body ? JSON.parse(String(init.body)) : null },
      }),
      { status: 200, headers: { "Content-Type": "application/json", "x-request-id": "server_req_success" } },
    );
  },
});

const successResponse = await successClient.request({
  method: "POST",
  path: "/admin/users",
  query: {
    query: "心理沙盘",
    page: 1,
    "filters[role]": "student",
    tags: ["sand", "memory"],
    empty: "",
    skipped: undefined,
  },
  body: { displayName: "测试用户", role: "student" },
});

const bearerDiagnostic = createApiClient({
  baseUrl: "https://example.test",
  timeoutMs: 3000,
  getAuthContext: () => authContext,
  getBearerToken: () => "token_contract",
  fetchImpl: async () => new Response(JSON.stringify({ ok: true, requestId: "ok", data: null })),
}).diagnostic();

const plainSuccess = await createApiClient({
  baseUrl: "https://plain.example",
  timeoutMs: 3000,
  fetchImpl: async () => new Response(JSON.stringify({ value: 42 }), { status: 200 }),
}).request({ method: "GET", path: "plain" });

const dtoError = await captureClientError(
  createApiClient({
    baseUrl: "https://error.example",
    timeoutMs: 3000,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: false,
          requestId: "server_req_forbidden",
          error: {
            code: "AUTH_FORBIDDEN",
            message: "Forbidden by contract",
            requestId: "server_req_forbidden",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
  }).request({ method: "GET", path: "/forbidden" }),
);

const mappedHttpError = await captureClientError(
  createApiClient({
    baseUrl: "https://missing.example",
    timeoutMs: 3000,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "missing resource" }), {
        status: 404,
        statusText: "Not Found",
        headers: { "x-request-id": "server_req_missing" },
      }),
  }).request({ method: "GET", path: "/missing" }),
);

const networkError = await captureClientError(
  createApiClient({
    baseUrl: "https://offline.example",
    timeoutMs: 3000,
    fetchImpl: async () => {
      throw new Error("network down");
    },
  }).request({ method: "GET", path: "/network" }),
);

const timeoutError = await captureClientError(
  createApiClient({
    baseUrl: "https://slow.example",
    timeoutMs: 5,
    fetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  }).request({ method: "GET", path: "/slow", timeoutMs: 5 }),
);

export default {
  successDiagnostic: successClient.diagnostic(),
  bearerDiagnostic,
  capturedRequest: capturedRequests[0],
  successResponse,
  plainSuccess,
  dtoError,
  mappedHttpError,
  networkError,
  timeoutError,
};

async function captureClientError(promise) {
  try {
    await promise;
    return { thrown: false };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        thrown: true,
        name: error.name,
        status: error.status,
        code: error.code,
        requestId: error.requestId,
        message: error.message,
      };
    }
    return {
      thrown: true,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
`;
}

async function assertStaticFiles() {
  const [client, packageJson, qualityGates, technicalSpec] = await Promise.all([
    readProjectFile("src/api/client.ts"),
    readProjectFile("package.json"),
    readProjectFile("docs/quality-gates.md"),
    readProjectFile("docs/development-and-technical-spec.md"),
  ]);

  assert("API client uses runtime-neutral timers", client.includes("globalThis.setTimeout") && client.includes("globalThis.clearTimeout"));
  assert("API client sends contract version header", client.includes('"X-Api-Contract-Version": "2026-05-06.v1"'));
  assert("API client sends auth context headers", client.includes('"X-Actor-User-ID"') && client.includes('"X-Active-User-ID"'));
  assert("API client maps HTTP status to catalog error", client.includes("mapHttpStatusToErrorCode"));
  assert("Package exposes API client QA command", packageJson.includes('"qa:api-client"'));
  assert("Quality gates mention API client QA command", qualityGates.includes("npm run qa:api-client"));
  assert("Technical spec mentions API client behavior QA", technicalSpec.includes("npm run qa:api-client"));
}

function assertApiClientReport(report) {
  assert("Success diagnostic normalizes base URL", report.successDiagnostic.baseUrl === "https://example.test/api", report.successDiagnostic.baseUrl);
  assert("Success diagnostic reports context auth", report.successDiagnostic.authHeaderStrategy === "context-headers", report.successDiagnostic.authHeaderStrategy);
  assert("Success diagnostic reports browser fetch availability", report.successDiagnostic.canUseBrowserFetch === true);
  assert("Bearer diagnostic prefers bearer strategy", report.bearerDiagnostic.authHeaderStrategy === "bearer", report.bearerDiagnostic.authHeaderStrategy);
  assert("Diagnostic exposes contract version header name", report.successDiagnostic.contractVersionHeader === "X-Api-Contract-Version");

  const request = report.capturedRequest;
  assert("Request was captured", Boolean(request));
  assert("Request method is preserved", request.method === "POST", request.method);
  const url = new URL(request.url);
  assert("Request URL joins base and path", url.origin === "https://example.test" && url.pathname === "/api/admin/users", request.url);
  assert("Request URL includes query", url.searchParams.get("query") === "心理沙盘", request.url);
  assert("Request URL includes scalar filters", url.searchParams.get("filters[role]") === "student", request.url);
  assert("Request URL includes array filters", url.searchParams.getAll("tags").join(",") === "sand,memory", request.url);
  assert("Request URL skips empty values", !url.searchParams.has("empty") && !url.searchParams.has("skipped"), request.url);

  assert("Request sends Accept header", request.headers.accept === "application/json", JSON.stringify(request.headers));
  assert("Request sends Content-Type for body", request.headers["content-type"] === "application/json", JSON.stringify(request.headers));
  assert("Request sends contract version", request.headers["x-api-contract-version"] === "2026-05-06.v1", JSON.stringify(request.headers));
  assert("Request sends generated request id", typeof request.headers["x-request-id"] === "string" && request.headers["x-request-id"].startsWith("req_"));
  assert("Request sends actor user header", request.headers["x-actor-user-id"] === "user_actor", JSON.stringify(request.headers));
  assert("Request sends active user header", request.headers["x-active-user-id"] === "user_active", JSON.stringify(request.headers));
  assert("Request sends role header", request.headers["x-auth-role"] === "admin", JSON.stringify(request.headers));
  assert("Request sends workspace scope header", request.headers["x-workspace-scope"] === "all", JSON.stringify(request.headers));
  assert("Request body is JSON", JSON.parse(request.body).displayName === "测试用户", request.body);

  assert("Success response returns API DTO", report.successResponse.ok === true && report.successResponse.requestId === "server_req_success");
  assert("Success response preserves parsed body", report.successResponse.data.receivedBody.role === "student");
  assert("Plain success is wrapped as API response", report.plainSuccess.ok === true && report.plainSuccess.data.value === 42);

  assert("DTO error throws ApiClientError", report.dtoError.thrown === true && report.dtoError.name === "ApiClientError");
  assert("DTO error preserves status and code", report.dtoError.status === 403 && report.dtoError.code === "AUTH_FORBIDDEN");
  assert("Mapped HTTP error maps 404", report.mappedHttpError.status === 404 && report.mappedHttpError.code === "RESOURCE_NOT_FOUND");
  assert("Mapped HTTP error preserves response request id", report.mappedHttpError.requestId === "server_req_missing", report.mappedHttpError.requestId);
  assert("Network error becomes internal API client error", report.networkError.status === 0 && report.networkError.code === "INTERNAL_ERROR");
  assert("Timeout becomes request timeout", report.timeoutError.status === 0 && report.timeoutError.code === "REQUEST_TIMEOUT", JSON.stringify(report.timeoutError));
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
  console.log(`\nAPI client QA: ${passed}/${results.length} checks passed`);
  failed.forEach((result) => console.log(`FAIL ${result.name}${result.detail ? ` - ${result.detail}` : ""}`));
  if (failed.length === 0) {
    console.log(`Report: ${path.relative(process.cwd(), REPORT_PATH)}`);
  }
}
