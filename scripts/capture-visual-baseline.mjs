#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.VISUAL_BASELINE_PORT ?? 5178);
const BASE_URL = process.env.VISUAL_BASELINE_URL ?? `http://127.0.0.1:${PORT}/`;
const RUN_DATE = process.env.VISUAL_BASELINE_DATE ?? new Date().toISOString().slice(0, 10);
const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "visual-regression", RUN_DATE);
const DEFAULT_USER_ID = "local_user_default";

const STORAGE_KEYS = {
  authSession: "psych-sandbox-2-5d-demo.local-auth-session.v1",
  repositoryMode: "psych-sandbox-2-5d-demo.repository-mode.v1",
  environmentBase: "psych-sandbox-2-5d-demo.environment.v1",
  layoutBase: "psych-sandbox-2-5d-demo.layout.v2",
};

const scenes = [];
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
};

let serverProcess = null;

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await ensureServer();
  await captureVisualBaseline();
  await writeManifest();
  printSummary();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}

async function captureVisualBaseline() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1680, height: 980 },
      deviceScaleFactor: 1,
      acceptDownloads: true,
    });

    await context.addInitScript(
      ({ keys, userId }) => {
        const now = new Date().toISOString();
        localStorage.setItem(keys.repositoryMode, "localStorage");
        localStorage.setItem(
          keys.authSession,
          JSON.stringify({
            sessionId: "session_visual_baseline",
            userId,
            displayName: "Visual Baseline",
            authMode: "guest",
            issuedAt: now,
            lastSeenAt: now,
          }),
        );
        localStorage.setItem(
          `${keys.layoutBase}.user.${encodeURIComponent(userId)}`,
          JSON.stringify({
            assetPanelCollapsed: true,
            rightPanelCollapsed: true,
            focusMode: false,
            assetDrawerOpen: false,
            aiDrawerOpen: false,
          }),
        );
      },
      { keys: STORAGE_KEYS, userId: DEFAULT_USER_ID },
    );

    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") {
        const location = message.location();
        diagnostics.consoleErrors.push(`${message.text()} @ ${location.url || "unknown"}:${location.lineNumber}`);
      }
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
    });

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
    await assertNoErrorOverlay(page, "initial load");

    await openSandboxStage(page, { weather: "sunny", light: "day" });
    await captureScene(page, {
      id: "sandbox-day-sunny",
      description: "Stage v2 default premium sand island in sunny day mode.",
      requiredSelector: ".stage-v2-shell",
      environment: { weather: "sunny", light: "day" },
    });

    await openSandboxStage(page, { weather: "cloudy", light: "day" });
    await captureScene(page, {
      id: "sandbox-day-cloudy",
      description: "Stage v2 cloudy day readability and softer-shadow baseline.",
      requiredSelector: ".stage-v2-shell",
      environment: { weather: "cloudy", light: "day" },
    });

    await openSandboxStage(page, { weather: "sunny", light: "night" });
    await captureScene(page, {
      id: "sandbox-night-clear",
      description: "Stage v2 night mode with moon/star ambience and readable toys.",
      requiredSelector: ".stage-v2-shell",
      environment: { weather: "sunny", light: "night" },
    });

    await openSandboxStage(page, { weather: "rainy", light: "night" });
    await captureScene(page, {
      id: "sandbox-night-rainy",
      description: "Stage v2 most difficult atmosphere: rainy night with readable UI.",
      requiredSelector: ".stage-v2-shell",
      environment: { weather: "rainy", light: "night" },
    });

    await clickSelector(page, ".game-inventory-toggle");
    await waitForVisibleBox(page, ".game-side-drawer-left .asset-library");
    await captureScene(page, {
      id: "inventory-expanded",
      description: "Game backpack drawer with large toy thumbnails and readable names.",
      requiredSelector: ".game-side-drawer-left .asset-library",
      environment: { weather: "rainy", light: "night" },
    });
    await clickSelector(page, ".game-drawer-close");
    await page.waitForSelector(".game-side-drawer-left", { state: "detached", timeout: 5_000 });

    await captureScene(page, {
      id: "right-panel-collapsed",
      description: "Stage workspace with the insight panel collapsed and stage width preserved.",
      requiredSelector: ".stage-v2-shell",
      environment: { weather: "rainy", light: "night" },
    });

    await clickSelector(page, ".game-insight-toggle");
    await waitForVisibleBox(page, ".game-side-drawer-right .right-panel");
    await captureScene(page, {
      id: "sandbox-insight-drawer",
      description: "Insight drawer opened as a right-side stage sheet.",
      requiredSelector: ".game-side-drawer-right .right-panel",
      environment: { weather: "rainy", light: "night" },
    });
    await clickSelector(page, ".game-side-drawer-right .small-icon-button");
    await page.waitForSelector(".game-side-drawer-right", { state: "detached", timeout: 5_000 });

    await clickByText(page, /进入沙盘全屏模式|全屏/);
    await waitForVisibleBox(page, ".product-shell.focus-mode");
    await captureScene(page, {
      id: "sandbox-fullscreen",
      description: "Fullscreen Stage v2 editing surface with compact floating controls.",
      requiredSelector: ".product-shell.focus-mode .stage-v2-shell",
      environment: { weather: "rainy", light: "night" },
    });

    await clickSelector(page, ".ai-stage-companion");
    await waitForVisibleBox(page, "[data-testid='focus-ai-drawer']");
    await captureScene(page, {
      id: "sandbox-ai-drawer",
      description: "Fullscreen single AI companion drawer, no duplicated side panel.",
      requiredSelector: "[data-testid='focus-ai-drawer']",
      environment: { weather: "rainy", light: "night" },
    });

    await clickSelector(page, "[data-testid='focus-ai-drawer'] .small-icon-button");
    await page.waitForSelector("[data-testid='focus-ai-drawer']", { state: "detached", timeout: 5_000 });
    await clickByText(page, /退出沙盘全屏模式|退出/);
    await waitForVisibleBox(page, ".product-shell:not(.focus-mode)");

    await openGamePortal(page, /对话 Agent/, ".agent-chat-shell");
    await page.waitForSelector(".agent-chat-shell", { timeout: 10_000 });
    await captureScene(page, {
      id: "agent-chat",
      description: "Agent dialogue reading baseline with portrait, bubbles, and composer.",
      requiredSelector: ".agent-chat-shell",
    });

    await openGamePortal(page, /个人中心/, ".personal-shell");
    await page.waitForSelector(".personal-shell", { timeout: 10_000 });
    await captureScene(page, {
      id: "personal-memory",
      description: "Personal Memory OS baseline for profile, archive, consent, and context packet areas.",
      requiredSelector: ".personal-shell",
    });

    await openGamePortal(page, /管理后台/, ".admin-shell");
    await page.waitForSelector(".admin-shell", { timeout: 10_000 });
    await captureScene(page, {
      id: "admin-users",
      description: "Admin user management baseline for large-directory IA.",
      requiredSelector: ".admin-shell",
    });

    assertNoRuntimeErrors();
  } finally {
    await browser.close();
  }
}

async function openSandboxStage(page, environment) {
  await setEnvironment(page, environment);
  await openGamePortal(page, /沙盘编辑/, ".stage-engine-mode-switch");
  await clickStageEngineMode(page, "stage3d");
  await waitForVisibleBox(page, ".stage-v2-shell", 20_000);
  const canvas = page.locator(".stage-v2-canvas-wrap canvas, canvas.stage-v2-canvas, .stage-v2-canvas canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForSelector(`.product-shell.weather-${environment.weather}.light-${environment.light}`, { timeout: 10_000 });
  await delay(900);
}

async function setEnvironment(page, environment) {
  await page.evaluate(
    ({ keys, userId, value }) => {
      localStorage.setItem(`${keys.environmentBase}.user.${encodeURIComponent(userId)}`, JSON.stringify(value));
    },
    { keys: STORAGE_KEYS, userId: DEFAULT_USER_ID, value: environment },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
}

async function captureScene(page, scene) {
  await assertNoErrorOverlay(page, scene.id);
  await waitForVisibleBox(page, scene.requiredSelector);
  await delay(250);
  const metrics = await readSceneMetrics(page, scene.requiredSelector);
  if (!metrics.rootVisible) {
    throw new Error(`${scene.id}: required selector is not visible: ${scene.requiredSelector}`);
  }
  if (metrics.scrollWidth > metrics.viewportWidth + 2) {
    throw new Error(`${scene.id}: horizontal overflow ${metrics.scrollWidth} > ${metrics.viewportWidth}`);
  }
  const file = `${scene.id}.png`;
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, file),
    fullPage: false,
    timeout: 60_000,
  });
  scenes.push({
    ...scene,
    file,
    viewport: { width: metrics.viewportWidth, height: metrics.viewportHeight },
    rootBox: metrics.rootBox,
    shellClass: metrics.shellClass,
    capturedAt: new Date().toISOString(),
  });
  console.log(`[CAPTURED] ${scene.id} -> ${file}`);
}

async function readSceneMetrics(page, rootSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    };
    const rootBox = rectOf(root);
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      rootBox,
      rootVisible: Boolean(rootBox && rootBox.width > 24 && rootBox.height > 24),
      shellClass: document.querySelector(".product-shell")?.className ?? "",
    };
  }, rootSelector);
}

async function writeManifest() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    artifactDir: ARTIFACT_DIR,
    sceneCount: scenes.length,
    scenes,
    diagnostics: {
      consoleErrors: diagnostics.consoleErrors,
      pageErrors: diagnostics.pageErrors,
      requestFailures: diagnostics.requestFailures,
    },
  };
  await writeFile(path.join(ARTIFACT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function assertNoRuntimeErrors() {
  const errors = [...diagnostics.consoleErrors, ...diagnostics.pageErrors];
  if (errors.length > 0) {
    throw new Error(`Browser runtime errors during visual baseline capture:\n${errors.join("\n")}`);
  }
}

async function assertNoErrorOverlay(page, label) {
  const overlayCount = await page.locator("vite-error-overlay, .vite-error-overlay").count();
  if (overlayCount > 0) {
    throw new Error(`${label}: Vite error overlay present`);
  }
}

async function openGamePortal(page, matcher, readySelector) {
  if (readySelector && (await isVisible(page, readySelector))) {
    return;
  }

  await clickByText(page, matcher);
  await delay(250);
}

async function isVisible(page, selector) {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0.02
    );
  }, selector);
}

async function clickByText(page, matcher) {
  const found = await page.evaluate(
    ({ source, flags }) => {
      const pattern = new RegExp(source, flags);
      const candidates = Array.from(document.querySelectorAll("button, a, summary"));
      const element = candidates.find((candidate) => {
        const label = candidate.getAttribute("aria-label") ?? "";
        const text = candidate.textContent ?? "";
        return pattern.test(`${label} ${text}`);
      });
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      element.click();
      return true;
    },
    { source: matcher.source, flags: matcher.flags },
  );

  if (!found) {
    throw new Error(`Clickable text not found: ${matcher}`);
  }

  await delay(140);
}

async function clickSelector(page, selector) {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  const clicked = await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    element.click();
    return true;
  }, selector);
  if (!clicked) {
    throw new Error(`Clickable selector not found: ${selector}`);
  }
  await delay(180);
}

async function clickStageEngineMode(page, mode) {
  await page.waitForSelector(".stage-engine-mode-switch button", { state: "attached", timeout: 10_000 });
  const found = await page.evaluate((targetMode) => {
    const buttons = Array.from(document.querySelectorAll(".stage-engine-mode-switch button"));
    const button = buttons.find((element) => {
      const text = element.textContent ?? "";
      return targetMode === "stage3d" ? /Stage v2/.test(text) : /Classic 2\.5D/.test(text);
    });

    if (!(button instanceof HTMLElement)) {
      return false;
    }

    button.click();
    return true;
  }, mode);

  if (!found) {
    throw new Error(`Stage engine mode button not found: ${mode}`);
  }

  await page.waitForFunction(
    (targetMode) => {
      const activeText = document.querySelector(".stage-engine-mode-switch button.active")?.textContent ?? "";
      return targetMode === "stage3d" ? /Stage v2/.test(activeText) : /Classic 2\.5D/.test(activeText);
    },
    mode,
    { timeout: 5_000 },
  );
  await delay(160);
}

async function waitForVisibleBox(page, selector, timeout = 10_000) {
  await page.waitForFunction(
    (targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 24 &&
        rect.height > 24 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.01
      );
    },
    selector,
    { timeout },
  );
}

function printSummary() {
  console.log("");
  console.log(`Visual baseline captured ${scenes.length} scenes`);
  console.log(`Artifacts: ${ARTIFACT_DIR}`);
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
