#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = Number(process.env.UI_SHELL_QA_PORT ?? 5177);
const BASE_URL = process.env.UI_SHELL_QA_URL ?? `http://127.0.0.1:${PORT}/`;
const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "ui-shell-qa");
const DEFAULT_USER_ID = "local_user_default";

const STORAGE_KEYS = {
  authSession: "psych-sandbox-2-5d-demo.local-auth-session.v1",
  repositoryMode: "psych-sandbox-2-5d-demo.repository-mode.v1",
  environmentBase: "psych-sandbox-2-5d-demo.environment.v1",
  layoutBase: "psych-sandbox-2-5d-demo.layout.v2",
};

const results = [];
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
};
let serverProcess = null;

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await ensureServer();
  await runShellQa();
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

async function runShellQa() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1680, height: 980 },
      deviceScaleFactor: 1,
    });

    await context.addInitScript(
      ({ keys, userId }) => {
        const now = new Date().toISOString();
        localStorage.setItem(keys.repositoryMode, "localStorage");
        localStorage.setItem(
          keys.authSession,
          JSON.stringify({
            sessionId: "session_ui_shell_qa",
            userId,
            displayName: "UI QA",
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
        diagnostics.consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await assertNoErrorOverlay(page, "initial load");
    await clickByText(page, /Stage v2/);
    await page.waitForSelector(".stage-v2-shell", { timeout: 20_000 });
    await delay(1000);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "sandbox-night-desktop.png"), fullPage: true });
    const sandboxDesktop = await readSandboxShellMetrics(page);
    pushResult("Sandbox desktop has no horizontal document overflow", sandboxDesktop.scrollWidth <= sandboxDesktop.viewportWidth + 2, formatMetrics(sandboxDesktop));
    pushResult("Sandbox game navigation stays compact", sandboxDesktop.navHeight <= 80, `height=${sandboxDesktop.navHeight}`);
    pushResult("Sandbox floating HUD stays compact", sandboxDesktop.topbarHeight <= 72, `height=${sandboxDesktop.topbarHeight}`);
    pushResult("Sandbox HUD does not cover engine switch", !sandboxDesktop.topbarOverlapsModeSwitch, formatMetrics(sandboxDesktop));
    pushResult("Engine switch does not cover Stage v2 title", !sandboxDesktop.modeSwitchOverlapsStagePanelTop, formatMetrics(sandboxDesktop));

    await clickSelector(page, ".game-inventory-toggle");
    await page.waitForSelector(".game-side-drawer-left .asset-library", { timeout: 5000 });
    await delay(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "sandbox-backpack-night-desktop.png"), fullPage: true });
    const backpackDesktop = await readBackpackMetrics(page);
    pushResult("Backpack drawer fits desktop viewport", backpackDesktop.drawerFitsViewport, formatMetrics(backpackDesktop));
    pushResult("Backpack drawer hides stage mode switch", !backpackDesktop.modeSwitchVisible, formatMetrics(backpackDesktop));
    pushResult("Backpack cards keep names readable", backpackDesktop.cards.every((card) => card.nameReadable), formatMetrics(backpackDesktop.cards));
    pushResult("Backpack card badges do not cover names", backpackDesktop.cards.every((card) => !card.riskOverlapsName), formatMetrics(backpackDesktop.cards));
    await clickSelector(page, ".game-drawer-close");
    await page.waitForSelector(".game-side-drawer-left", { state: "detached", timeout: 5000 });
    await delay(250);

    await page.setViewportSize({ width: 1280, height: 820 });
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "sandbox-night-1280.png"), fullPage: true });
    const sandboxNarrow = await readSandboxShellMetrics(page);
    pushResult("Sandbox 1280px has no horizontal document overflow", sandboxNarrow.scrollWidth <= sandboxNarrow.viewportWidth + 2, formatMetrics(sandboxNarrow));
    pushResult("Sandbox 1280px navigation stays compact", sandboxNarrow.navHeight <= 80, `height=${sandboxNarrow.navHeight}`);
    pushResult("Sandbox 1280px HUD avoids Stage v2 title", !sandboxNarrow.topbarOverlapsStagePanelTop, formatMetrics(sandboxNarrow));

    await page.setViewportSize({ width: 1680, height: 980 });
    await delay(300);
    await clickByText(page, /进入沙盘全屏模式|全屏/);
    await page.waitForSelector(".product-shell.focus-mode", { timeout: 5000 });
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "sandbox-focus-night-desktop.png"), fullPage: true });
    const focusMetrics = await readSandboxShellMetrics(page);
    pushResult("Focus mode has no horizontal document overflow", focusMetrics.scrollWidth <= focusMetrics.viewportWidth + 2, formatMetrics(focusMetrics));
    pushResult("Focus mode floating HUD stays compact", focusMetrics.topbarHeight <= 64, `height=${focusMetrics.topbarHeight}`);
    pushResult("Focus mode lets Stage v2 fill the viewport", focusMetrics.stageHeight >= focusMetrics.viewportHeight - 48, formatMetrics(focusMetrics));
    pushResult("Focus mode HUD avoids Stage v2 title", !focusMetrics.topbarOverlapsStagePanelTop, formatMetrics(focusMetrics));
    await clickByText(page, /退出沙盘全屏模式|退出/);
    await page.waitForSelector(".product-shell:not(.focus-mode)", { timeout: 5000 });
    await delay(300);

    await page.setViewportSize({ width: 1680, height: 980 });
    await openGamePortal(page, /管理后台/);
    await page.waitForSelector(".admin-shell", { timeout: 10_000 });
    await delay(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin-night-desktop.png"), fullPage: true });
    const adminMetrics = await readGenericShellMetrics(page, ".app-navigation");
    pushResult("Admin desktop has no horizontal document overflow", adminMetrics.scrollWidth <= adminMetrics.viewportWidth + 2, formatMetrics(adminMetrics));
    pushResult("Admin navigation stays compact", adminMetrics.navHeight <= 82, `height=${adminMetrics.navHeight}`);

    await page.setViewportSize({ width: 1280, height: 820 });
    await delay(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin-night-1280.png"), fullPage: true });
    const adminNarrowMetrics = await readGenericShellMetrics(page, ".app-navigation");
    pushResult("Admin 1280px has no horizontal document overflow", adminNarrowMetrics.scrollWidth <= adminNarrowMetrics.viewportWidth + 2, formatMetrics(adminNarrowMetrics));
    pushResult("Admin 1280px navigation stays compact", adminNarrowMetrics.navHeight <= 90, `height=${adminNarrowMetrics.navHeight}`);

    pushResult(
      "No browser console/page errors during UI shell QA",
      diagnostics.consoleErrors.length === 0 && diagnostics.pageErrors.length === 0,
      [...diagnostics.consoleErrors, ...diagnostics.pageErrors].join(" | "),
    );
  } finally {
    await browser.close();
  }
}

async function readSandboxShellMetrics(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
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
    const intersects = (a, b) => Boolean(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);
    const nav = box(".game-navigation");
    const topbar = box(".workspace-column .topbar");
    const modeSwitch = box(".stage-engine-mode-switch");
    const stagePanelTop = box(".stage-v2-panel-top");
    const stage = box(".stage-v2-shell");
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      navHeight: nav?.height ?? 0,
      topbarHeight: topbar?.height ?? 0,
      stageHeight: stage?.height ?? 0,
      topbarOverlapsModeSwitch: intersects(topbar, modeSwitch),
      topbarOverlapsStagePanelTop: intersects(topbar, stagePanelTop),
      modeSwitchOverlapsStagePanelTop: intersects(modeSwitch, stagePanelTop),
    };
  });
}

async function readGenericShellMetrics(page, navSelector) {
  return page.evaluate((selector) => {
    const nav = document.querySelector(selector);
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
    };
  }, navSelector);
}

async function readBackpackMetrics(page) {
  return page.evaluate(() => {
    const box = (selectorOrElement) => {
      const element =
        typeof selectorOrElement === "string" ? document.querySelector(selectorOrElement) : selectorOrElement;
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
    const intersects = (a, b) => Boolean(a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y);
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.02
      );
    };

    const drawer = box(".game-side-drawer-left");
    const modeSwitch = document.querySelector(".stage-engine-mode-switch");
    const modeSwitchBox = box(modeSwitch);
    const cards = Array.from(document.querySelectorAll(".game-side-drawer-left .asset-card"))
      .slice(0, 8)
      .map((card) => {
        const name = card.querySelector(".asset-card-name");
        const risk = card.querySelector(".risk-badge");
        const nameBox = box(name);
        const cardBox = box(card);
        const riskBox = box(risk);
        const nameStyle = name ? window.getComputedStyle(name) : null;
        const nameText = name?.textContent?.trim() ?? "";
        return {
          title: card.getAttribute("title") ?? "",
          nameText,
          nameColor: nameStyle?.color ?? "",
          nameHeight: nameBox?.height ?? 0,
          nameInsideCard: Boolean(nameBox && cardBox && nameBox.y >= cardBox.y && nameBox.bottom <= cardBox.bottom),
          nameReadable:
            nameText.length > 0 &&
            Boolean(nameBox && nameBox.height >= 18) &&
            Boolean(nameStyle && nameStyle.visibility !== "hidden" && Number(nameStyle.opacity) > 0.5) &&
            Boolean(nameBox && cardBox && nameBox.y >= cardBox.y && nameBox.bottom <= cardBox.bottom),
          riskOverlapsName: intersects(nameBox, riskBox),
        };
      });

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      drawer,
      drawerFitsViewport: Boolean(drawer && drawer.x >= 0 && drawer.right <= window.innerWidth + 1),
      modeSwitchVisible: isVisible(modeSwitch),
      modeSwitchIntersectsDrawer: intersects(modeSwitchBox, drawer),
      cards,
    };
  });
}

async function clickByText(page, matcher) {
  const found = await page.evaluate(
    ({ source, flags }) => {
      const pattern = new RegExp(source, flags);
      const controls = Array.from(document.querySelectorAll("button, summary"));
      const control = controls.find((element) => {
        const label = element.getAttribute("aria-label") ?? "";
        const text = element.textContent ?? "";
        return pattern.test(`${label} ${text}`);
      });
      if (!control) return false;
      control.click();
      return true;
    },
    { source: matcher.source, flags: matcher.flags },
  );

  if (!found) {
    throw new Error(`Could not find control matching ${matcher}`);
  }
}

async function clickSelector(page, selector) {
  const found = await page.evaluate((targetSelector) => {
    const control = document.querySelector(targetSelector);
    if (!(control instanceof HTMLElement)) return false;
    control.click();
    return true;
  }, selector);

  if (!found) {
    throw new Error(`Could not find control matching selector ${selector}`);
  }
}

async function openGamePortal(page, matcher) {
  await page.evaluate(() => {
    const menu = document.querySelector(".game-portal-menu");
    if (menu) {
      menu.open = true;
    }
  });
  await clickByText(page, matcher);
}

async function assertNoErrorOverlay(page, label) {
  const overlay = page.locator("vite-error-overlay");
  if ((await overlay.count()) > 0) {
    throw new Error(`Vite error overlay present after ${label}`);
  }
}

async function ensureServer() {
  if (process.env.UI_SHELL_QA_URL) {
    return;
  }

  const probe = await fetch(BASE_URL).then(
    (response) => response.ok,
    () => false,
  );
  if (probe) {
    return;
  }

  serverProcess = spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
    cwd: process.cwd(),
    stdio: "ignore",
    env: process.env,
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await fetch(BASE_URL).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      return;
    }
    await delay(250);
  }

  throw new Error(`Dev server did not start at ${BASE_URL}`);
}

function pushResult(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function printSummary() {
  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  for (const result of results) {
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
  }
  console.log(`UI shell QA summary: ${passed}/${results.length} passed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

function formatMetrics(metrics) {
  return JSON.stringify(metrics);
}
