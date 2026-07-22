#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.STAGE_V2_QA_PORT ?? 5173);
const BASE_URL = process.env.STAGE_V2_QA_URL ?? `http://127.0.0.1:${PORT}/`;
const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "stage-v2-qa");
const DEFAULT_USER_ID = "local_user_default";

const STORAGE_KEYS = {
  authSession: "psych-sandbox-2-5d-demo.local-auth-session.v1",
  repositoryMode: "psych-sandbox-2-5d-demo.repository-mode.v1",
  sceneBase: "psych-sandbox-2-5d-demo.scene.v6",
  environmentBase: "psych-sandbox-2-5d-demo.environment.v1",
  layoutBase: "psych-sandbox-2-5d-demo.layout.v2",
};

const userScopedKey = (key, userId = DEFAULT_USER_ID) => `${key}.user.${encodeURIComponent(userId)}`;

const results = [];
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
};

let serverProcess = null;

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await ensureServer();
  await runStageV2Smoke();
  printSummary();
} catch (error) {
  results.push({ name: "qa runner", ok: false, detail: error instanceof Error ? error.message : String(error) });
  printSummary();
  process.exitCode = 1;
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}

async function runStageV2Smoke() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1800, height: 1100 },
      deviceScaleFactor: 1,
    });

    await context.addInitScript(
      ({ keys, userId }) => {
        const now = new Date().toISOString();
        localStorage.setItem(keys.repositoryMode, "localStorage");
        localStorage.setItem(
          keys.authSession,
          JSON.stringify({
            sessionId: "session_stage_v2_qa",
            userId,
            displayName: "Stage v2 QA",
            authMode: "guest",
            issuedAt: now,
            lastSeenAt: now,
          }),
        );
        localStorage.setItem(
          `${keys.environmentBase}.user.${encodeURIComponent(userId)}`,
          JSON.stringify({ weather: "rainy", light: "night" }),
        );
        localStorage.setItem(
          `${keys.layoutBase}.user.${encodeURIComponent(userId)}`,
          JSON.stringify({ rightPanelCollapsed: false, focusMode: false, assetDrawerOpen: false, aiDrawerOpen: false }),
        );
      },
      { keys: STORAGE_KEYS, userId: DEFAULT_USER_ID },
    );

    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") {
        diagnostics.consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown";
      diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${failure}`);
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await assertNoErrorOverlay(page, "initial load");

    await clickButtonByMatcher(page, /沙盘编辑/).catch(() => undefined);
    await clickButtonByMatcher(page, /Stage v2/);
    await page.waitForSelector(".stage-v2-shell", { timeout: 20_000 });
    const canvas = page.locator(".stage-v2-canvas-wrap canvas, canvas.stage-v2-canvas, .stage-v2-canvas canvas").first();
    await canvas.waitFor({ state: "visible", timeout: 20_000 });
    await delay(1200);

  await assertNoErrorOverlay(page, "stage v2 load");
  pushResult("Stage v2 shell renders", true);

  await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-initial.png") });

  await clickButtonByMatcher(page, /切换天气：雨天|雨/);
  await clickButtonByMatcher(page, /切换光照：黑夜|夜/);
  await page.waitForSelector(".product-shell.weather-rainy.light-night.night-mode", { timeout: 5000 });
  pushResult("Rainy night environment applies shell theme", true);

  const waterBefore = await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-water-before.png") });
  await delay(1000);
  const waterAfter = await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-water-after.png") });
  const waterDiff = byteDiff(waterBefore, waterAfter);
  pushResult("Ocean/weather animation changes frame", waterDiff > 1000, `byteDiff=${waterDiff}`);

  const dragResult = await tryDragObject(page, canvas);
  pushResult("Mouse drag moves a Stage v2 toy and writes scene state", dragResult.ok, dragResult.detail);

  const cameraResult = await tryMoveCamera(page, canvas);
  pushResult("Mouse can move the Stage v2 camera view", cameraResult.ok, cameraResult.detail);

  const zoomResult = await tryZoomCamera(page, canvas);
  pushResult("Mouse wheel zoom changes the Stage v2 camera view", zoomResult.ok, zoomResult.detail);

  const pngDownload = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    clickButtonByMatcher(page, /导出 PNG 截图|导出 Stage Engine v2 PNG 截图/),
  ]).then(([download]) => download);
  const pngPath = await pngDownload.path();
  pushResult("Stage v2 PNG export downloads an image", Boolean(pngPath), pngDownload.suggestedFilename());

  const jsonDownload = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    clickButtonByMatcher(page, /导出 JSON 快照/),
  ]).then(([download]) => download);
  const jsonPath = await jsonDownload.path();
  pushResult("JSON export still downloads a snapshot", Boolean(jsonPath), jsonDownload.suggestedFilename());

  await clickButtonByMatcher(page, /切换天气：晴天|晴/);
  await clickButtonByMatcher(page, /切换光照：白天|日/);
  await page.waitForSelector(".product-shell.weather-sunny.light-day:not(.night-mode)", { timeout: 5000 });
  pushResult("Sunny day environment applies shell theme", true);

  await clickButtonByMatcher(page, /Classic 2\.5D/);
  await page.waitForSelector(".sandbox-editor", { timeout: 10_000 });
  pushResult("Classic 2.5D fallback remains switchable", true);

  await assertNoErrorOverlay(page, "final state");
  pushResult("No browser console/page errors during smoke", diagnostics.consoleErrors.length === 0 && diagnostics.pageErrors.length === 0, [
    ...diagnostics.consoleErrors,
    ...diagnostics.pageErrors,
  ].join(" | "));

  } finally {
    await browser.close();
  }
}

async function clickButtonByMatcher(page, matcher) {
  const found = await page.evaluate(
    ({ source, flags }) => {
      const pattern = new RegExp(source, flags);
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((element) => {
        const label = element.getAttribute("aria-label") ?? "";
        const text = element.textContent ?? "";
        return pattern.test(`${label} ${text}`);
      });

      if (!button) {
        return false;
      }

      button.click();
      return true;
    },
    { source: matcher.source, flags: matcher.flags },
  );

  if (!found) {
    throw new Error(`Button not found: ${matcher}`);
  }

  await delay(120);
}

async function tryDragObject(page, canvas) {
  const before = await readScene(page);
  const box = await canvas.boundingBox();
  if (!box) {
    return { ok: false, detail: "canvas bounding box missing" };
  }

  const points = [
    [0.5, 0.55],
    [0.48, 0.5],
    [0.58, 0.45],
    [0.38, 0.58],
    [0.66, 0.62],
    [0.43, 0.42],
  ];

  for (const [xFactor, yFactor] of points) {
    const x = box.x + box.width * xFactor;
    const y = box.y + box.height * yFactor;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(x + 90, y + 24, { steps: 14 });
    await page.mouse.up({ button: "left" });
    await delay(450);

    const after = await readScene(page);
    const movement = findObjectMovement(before, after);
    if (movement) {
      return {
        ok: true,
        detail: `${movement.name ?? movement.objectId}: ${movement.dx.toFixed(1)}, ${movement.dy.toFixed(1)}`,
      };
    }
  }

  return { ok: false, detail: "no persisted object movement detected after candidate drags" };
}

async function tryMoveCamera(page, canvas) {
  const box = await canvas.boundingBox();
  if (!box) {
    return { ok: false, detail: "canvas bounding box missing" };
  }

  const before = await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-camera-before.png") });
  const x = box.x + box.width * 0.2;
  const y = box.y + box.height * 0.22;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(x + 130, y + 60, { steps: 16 });
  await page.mouse.up({ button: "left" });
  await delay(650);
  const after = await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-camera-after.png") });
  const diff = byteDiff(before, after);
  return { ok: diff > 1000, detail: `byteDiff=${diff}` };
}

async function tryZoomCamera(page, canvas) {
  const before = await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-zoom-before.png") });
  await canvas.hover();
  await page.mouse.wheel(0, -520);
  await delay(500);
  const after = await canvas.screenshot({ path: path.join(ARTIFACT_DIR, "stage-v2-zoom-after.png") });
  const diff = byteDiff(before, after);
  return { ok: diff > 1000, detail: `byteDiff=${diff}` };
}

async function readScene(page) {
  return page.evaluate(
    ({ keys, userId }) => {
      const scoped = localStorage.getItem(`${keys.sceneBase}.user.${encodeURIComponent(userId)}`);
      const fallback = localStorage.getItem(keys.sceneBase);
      return JSON.parse(scoped || fallback || "{\"objects\":[],\"events\":[]}");
    },
    { keys: STORAGE_KEYS, userId: DEFAULT_USER_ID },
  );
}

function findObjectMovement(before, after) {
  const beforeById = new Map((before.objects ?? []).map((object) => [object.id, object]));
  for (const object of after.objects ?? []) {
    const previous = beforeById.get(object.id);
    if (!previous) {
      continue;
    }
    const dx = Number(object.x) - Number(previous.x);
    const dy = Number(object.y) - Number(previous.y);
    if (Math.hypot(dx, dy) > 2) {
      return { objectId: object.id, name: object.name, dx, dy };
    }
  }
  return null;
}

async function assertNoErrorOverlay(page, label) {
  const overlayCount = await page.locator("vite-error-overlay, .vite-error-overlay").count();
  pushResult(`No Vite error overlay: ${label}`, overlayCount === 0, `overlayCount=${overlayCount}`);
}

function byteDiff(a, b) {
  const length = Math.min(a.length, b.length);
  let diff = Math.abs(a.length - b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      diff += 1;
    }
  }
  return diff;
}

function pushResult(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` - ${detail}` : ""}`);
}

function printSummary() {
  const failed = results.filter((result) => !result.ok);
  console.log("");
  console.log(`Stage v2 QA: ${results.length - failed.length}/${results.length} gates passed`);
  console.log(`Artifacts: ${ARTIFACT_DIR}`);
  if (diagnostics.requestFailures.length > 0) {
    console.log("Request failures:");
    diagnostics.requestFailures.forEach((failure) => console.log(`- ${failure}`));
  }
  if (failed.length > 0) {
    console.log("Failed gates:");
    failed.forEach((result) => console.log(`- ${result.name}${result.detail ? `: ${result.detail}` : ""}`));
    process.exitCode = 1;
  }
}

async function ensureServer() {
  if (await isServerReady(BASE_URL)) {
    console.log(`Using existing dev server: ${BASE_URL}`);
    return;
  }

  console.log(`Starting Vite dev server on ${BASE_URL}`);
  serverProcess = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    {
      cwd: process.cwd(),
      env: { ...process.env, BROWSER: "none" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  serverProcess.stdout?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.log(`[vite] ${text}`);
    }
  });
  serverProcess.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.error(`[vite] ${text}`);
    }
  });

  const started = await waitForServer(BASE_URL, 20_000);
  if (!started) {
    throw new Error(`Vite server did not become ready at ${BASE_URL}`);
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerReady(url)) {
      return true;
    }
    await delay(350);
  }
  return false;
}

async function isServerReady(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
