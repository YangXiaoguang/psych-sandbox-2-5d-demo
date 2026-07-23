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
    await clickStageEngineMode(page, "stage3d");
    await page.waitForSelector(".stage-v2-shell", { timeout: 20_000 });
    await delay(1000);

    await captureShellScreenshot(page, "sandbox-night-desktop.png");
    const sandboxDesktop = await readSandboxShellMetrics(page);
    pushResult("Sandbox desktop has no horizontal document overflow", sandboxDesktop.scrollWidth <= sandboxDesktop.viewportWidth + 2, formatMetrics(sandboxDesktop));
    pushResult("Sandbox game navigation stays compact", sandboxDesktop.navHeight <= 80, `height=${sandboxDesktop.navHeight}`);
    pushResult("Sandbox floating HUD stays compact", sandboxDesktop.topbarHeight <= 72, `height=${sandboxDesktop.topbarHeight}`);
    pushResult("Sandbox ambient HUD stays narrow", sandboxDesktop.topbarWidth <= 430, formatMetrics(sandboxDesktop));
    pushResult("Sandbox exports live in the bottom dock", sandboxDesktop.outputDockButtons >= 3 && !sandboxDesktop.topbarExportVisible, formatMetrics(sandboxDesktop));
    pushResult(
      "Sandbox idle dock is compact and contextual",
      sandboxDesktop.toolbeltMode.includes("context-idle") &&
        sandboxDesktop.toolbeltWidth <= 920 &&
        sandboxDesktop.selectedActionButtons === 0 &&
        sandboxDesktop.hintsVisible &&
        /选择|移动画布/.test(sandboxDesktop.toolbeltStatusText),
      formatMetrics(sandboxDesktop),
    );
    pushResult("Sandbox side HUD entries stay compact", sandboxDesktop.sideHudEntriesCompact, formatMetrics(sandboxDesktop));
    pushResult("Sandbox side HUD entries hug viewport edges", sandboxDesktop.sideHudEntriesAtEdges, formatMetrics(sandboxDesktop));
    pushResult("Sandbox HUD does not cover engine switch", !sandboxDesktop.topbarOverlapsModeSwitch, formatMetrics(sandboxDesktop));
    pushResult("Engine switch does not cover Stage v2 title", !sandboxDesktop.modeSwitchOverlapsStagePanelTop, formatMetrics(sandboxDesktop));
    pushResult("Engine switch avoids the game toolbelt", !sandboxDesktop.modeSwitchOverlapsToolbelt, formatMetrics(sandboxDesktop));

    const selectedStageToy = await trySelectStageToy(page);
    await delay(300);
    const selectedDock = await readSandboxShellMetrics(page);
    if (selectedStageToy) {
      await captureShellScreenshot(page, "sandbox-selected-dock-night-desktop.png");
    }
    pushResult(
      "Sandbox selected dock promotes toy transform actions",
      selectedStageToy &&
        selectedDock.toolbeltMode.includes("context-selected") &&
        selectedDock.selectedActionButtons >= 6 &&
        selectedDock.selectedActionsWidth > selectedDock.outputActionsWidth &&
        selectedDock.outputDockButtons >= 3 &&
        /正在编辑/.test(selectedDock.toolbeltStatusText),
      formatMetrics(selectedDock),
    );

    await clickSelector(page, ".game-inventory-toggle");
    await page.waitForSelector(".game-side-drawer-left .asset-library", { timeout: 5000 });
    await delay(400);
    await captureShellScreenshot(page, "sandbox-backpack-night-desktop.png");
    const backpackDesktop = await readBackpackMetrics(page);
    pushResult("Backpack drawer fits desktop viewport", backpackDesktop.drawerFitsViewport, formatMetrics(backpackDesktop));
    pushResult("Backpack drawer opens as a stage sheet", backpackDesktop.drawerHasStageGutter, formatMetrics(backpackDesktop));
    pushResult("Backpack drawer hides stage mode switch", !backpackDesktop.modeSwitchVisible, formatMetrics(backpackDesktop));
    pushResult("Backpack cards keep names readable", backpackDesktop.cards.every((card) => card.nameReadable), formatMetrics(backpackDesktop.cards));
    pushResult("Backpack card badges do not cover names", backpackDesktop.cards.every((card) => !card.riskOverlapsName), formatMetrics(backpackDesktop.cards));
    await clickSelector(page, ".game-drawer-close");
    await page.waitForSelector(".game-side-drawer-left", { state: "detached", timeout: 5000 });
    await delay(250);

    await page.setViewportSize({ width: 1280, height: 820 });
    await delay(500);
    await captureShellScreenshot(page, "sandbox-night-1280.png");
    const sandboxNarrow = await readSandboxShellMetrics(page);
    pushResult("Sandbox 1280px has no horizontal document overflow", sandboxNarrow.scrollWidth <= sandboxNarrow.viewportWidth + 2, formatMetrics(sandboxNarrow));
    pushResult("Sandbox 1280px navigation stays compact", sandboxNarrow.navHeight <= 80, `height=${sandboxNarrow.navHeight}`);
    pushResult("Sandbox 1280px side HUD entries stay compact", sandboxNarrow.sideHudEntriesCompact, formatMetrics(sandboxNarrow));
    pushResult("Sandbox 1280px exports remain reachable", sandboxNarrow.outputDockButtons >= 3, formatMetrics(sandboxNarrow));
    pushResult("Sandbox 1280px HUD avoids Stage v2 title", !sandboxNarrow.topbarOverlapsStagePanelTop, formatMetrics(sandboxNarrow));

    await clickSelector(page, ".game-insight-toggle");
    await page.waitForSelector(".game-side-drawer-right .right-panel", { timeout: 5000 });
    await delay(400);
    await captureShellScreenshot(page, "sandbox-insight-night-1280.png");
    const insightNarrow = await readInsightDrawerMetrics(page);
    pushResult("Insight drawer fits 1280px viewport", insightNarrow.drawerFitsViewport, formatMetrics(insightNarrow));
    pushResult("Insight drawer opens as a stage sheet", insightNarrow.drawerHasStageGutter, formatMetrics(insightNarrow));
    pushResult("Insight drawer hides stage mode switch", !insightNarrow.modeSwitchVisible, formatMetrics(insightNarrow));
    pushResult("Insight drawer keeps secondary sections collapsed", insightNarrow.sections.every((section) => !section.open), formatMetrics(insightNarrow.sections));
    pushResult("Insight drawer heading remains readable", insightNarrow.headingReadable, formatMetrics(insightNarrow));
    await clickSelector(page, ".game-side-drawer-right .small-icon-button");
    await page.waitForSelector(".game-side-drawer-right", { state: "detached", timeout: 5000 });
    await delay(250);

    await page.setViewportSize({ width: 1680, height: 980 });
    await delay(300);
    await clickByText(page, /进入沙盘全屏模式|全屏/);
    await page.waitForSelector(".product-shell.focus-mode", { timeout: 5000 });
    await delay(500);
    await captureShellScreenshot(page, "sandbox-focus-night-desktop.png");
    const focusMetrics = await readSandboxShellMetrics(page);
    pushResult("Focus mode has no horizontal document overflow", focusMetrics.scrollWidth <= focusMetrics.viewportWidth + 2, formatMetrics(focusMetrics));
    pushResult("Focus mode floating HUD stays compact", focusMetrics.topbarHeight <= 64, `height=${focusMetrics.topbarHeight}`);
    pushResult("Focus mode exports remain reachable", focusMetrics.outputDockButtons >= 3, formatMetrics(focusMetrics));
    pushResult("Focus mode lets Stage v2 fill the viewport", focusMetrics.stageHeight >= focusMetrics.viewportHeight - 48, formatMetrics(focusMetrics));
    pushResult("Focus mode HUD avoids Stage v2 title", !focusMetrics.topbarOverlapsStagePanelTop, formatMetrics(focusMetrics));
    await clickByText(page, /退出沙盘全屏模式|退出/);
    await page.waitForSelector(".product-shell:not(.focus-mode)", { timeout: 5000 });
    await delay(300);

    await page.setViewportSize({ width: 1680, height: 980 });
    await openGamePortal(page, /管理后台/);
    await page.waitForSelector(".admin-shell", { timeout: 10_000 });
    await delay(400);
    await captureShellScreenshot(page, "admin-night-desktop.png");
    const adminMetrics = await readGenericShellMetrics(page, ".app-navigation");
    pushResult("Admin desktop has no horizontal document overflow", adminMetrics.scrollWidth <= adminMetrics.viewportWidth + 2, formatMetrics(adminMetrics));
    pushResult("Admin navigation stays compact", adminMetrics.navHeight <= 82, `height=${adminMetrics.navHeight}`);

    await page.setViewportSize({ width: 1280, height: 820 });
    await delay(400);
    await captureShellScreenshot(page, "admin-night-1280.png");
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
    const toolbelt = box(".sandbox-game-toolbelt");
    const selectedActions = box(".sandbox-game-toolbelt .selected-actions");
    const viewActions = box(".sandbox-game-toolbelt .view-actions");
    const outputActions = box(".sandbox-game-toolbelt .output-actions");
    const inventoryToggle = box(".game-inventory-toggle");
    const insightToggle = box(".game-insight-toggle");
    const visibleButtons = (selector) =>
      Array.from(document.querySelectorAll(selector)).filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
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
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      navHeight: nav?.height ?? 0,
      topbarWidth: topbar?.width ?? 0,
      topbarHeight: topbar?.height ?? 0,
      stageHeight: stage?.height ?? 0,
      toolbeltWidth: toolbelt?.width ?? 0,
      toolbeltMode: document.querySelector(".sandbox-game-toolbelt")?.className ?? "",
      toolbeltStatusText: document.querySelector(".toolbelt-status p")?.textContent?.trim() ?? "",
      viewActionButtons: visibleButtons(".sandbox-game-toolbelt .view-actions button").length,
      selectedActionButtons: visibleButtons(".sandbox-game-toolbelt .selected-actions button").length,
      outputDockButtons: visibleButtons(".sandbox-game-toolbelt .output-actions button").length,
      viewActionsWidth: viewActions?.width ?? 0,
      selectedActionsWidth: selectedActions?.width ?? 0,
      outputActionsWidth: outputActions?.width ?? 0,
      hintsVisible: isVisible(".sandbox-game-toolbelt .toolbelt-hints"),
      topbarExportVisible: isVisible(".workspace-column .export-hud"),
      inventoryToggle,
      insightToggle,
      sideHudEntriesCompact:
        Boolean(inventoryToggle && inventoryToggle.width <= 72 && inventoryToggle.height <= 86) &&
        Boolean(insightToggle && insightToggle.width <= 72 && insightToggle.height <= 86),
      sideHudEntriesAtEdges:
        Boolean(inventoryToggle && inventoryToggle.x <= 20) &&
        Boolean(insightToggle && insightToggle.right >= window.innerWidth - 20),
      topbarOverlapsModeSwitch: intersects(topbar, modeSwitch),
      topbarOverlapsStagePanelTop: intersects(topbar, stagePanelTop),
      modeSwitchOverlapsStagePanelTop: intersects(modeSwitch, stagePanelTop),
      modeSwitchOverlapsToolbelt: intersects(modeSwitch, toolbelt),
    };
  });
}

async function trySelectStageToy(page) {
  const canvas = page.locator(".stage-v2-canvas-wrap canvas, canvas.stage-v2-canvas, .stage-v2-canvas canvas").first();
  const box = await canvas.boundingBox();
  if (!box) {
    return false;
  }

  const candidates = [
    [0.5, 0.5],
    [0.46, 0.48],
    [0.56, 0.53],
    [0.38, 0.54],
    [0.66, 0.48],
    [0.58, 0.39],
    [0.42, 0.62],
  ];

  for (const [xRatio, yRatio] of candidates) {
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await delay(220);
    const selected = await page.evaluate(() => Boolean(document.querySelector(".sandbox-game-toolbelt.has-selection")));
    if (selected) {
      return true;
    }
  }

  return false;
}

async function captureShellScreenshot(page, filename) {
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, filename),
    fullPage: false,
    timeout: 60_000,
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
      drawerHasStageGutter: Boolean(drawer && drawer.x >= 10 && drawer.bottom <= window.innerHeight - 10),
      modeSwitchVisible: isVisible(modeSwitch),
      modeSwitchIntersectsDrawer: intersects(modeSwitchBox, drawer),
      cards,
    };
  });
}

async function readInsightDrawerMetrics(page) {
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

    const drawer = box(".game-side-drawer-right");
    const heading = document.querySelector(".game-side-drawer-right .panel-header h1");
    const headingBox = box(heading);
    const headingStyle = heading ? window.getComputedStyle(heading) : null;
    const sections = Array.from(document.querySelectorAll(".game-side-drawer-right .insight-section")).map((section) => ({
      open: section.hasAttribute("open"),
      summaryHeight: box(section.querySelector("summary"))?.height ?? 0,
      label: section.querySelector("summary")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
    }));

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      drawer,
      drawerFitsViewport: Boolean(drawer && drawer.x >= 0 && drawer.right <= window.innerWidth + 1),
      drawerHasStageGutter: Boolean(drawer && drawer.right <= window.innerWidth - 10 && drawer.bottom <= window.innerHeight - 10),
      modeSwitchVisible: isVisible(document.querySelector(".stage-engine-mode-switch")),
      headingText: heading?.textContent?.trim() ?? "",
      headingReadable:
        Boolean(headingBox && headingBox.height >= 24) &&
        Boolean(headingStyle && headingStyle.visibility !== "hidden" && Number(headingStyle.opacity) > 0.5),
      sections,
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

async function clickStageEngineMode(page, mode) {
  await page.waitForSelector(".stage-engine-mode-switch button", { state: "visible", timeout: 10_000 });
  await delay(500);
  const found = await page.evaluate((targetMode) => {
    const buttons = Array.from(document.querySelectorAll(".stage-engine-mode-switch button"));
    const button = buttons.find((element) => {
      const text = element.textContent ?? "";
      return targetMode === "stage3d" ? /Stage v2/.test(text) : /Classic 2\.5D/.test(text);
    });
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  }, mode);

  if (!found) {
    throw new Error(`Could not find stage engine mode button: ${mode}`);
  }

  await page
    .waitForFunction(
      (targetMode) => {
        const activeText = document.querySelector(".stage-engine-mode-switch button.active")?.textContent ?? "";
        return targetMode === "stage3d" ? /Stage v2/.test(activeText) : /Classic 2\.5D/.test(activeText);
      },
      mode,
      { timeout: 5_000 },
    )
    .catch(() => undefined);
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
