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
const SANDBOX_ASSET_DRAG_MIME = "application/x-sandbox-asset";
const STAGE_V2_CANVAS_SELECTOR = ".stage-v2-canvas-wrap canvas, canvas.stage-v2-canvas, .stage-v2-canvas canvas";

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
  step: "boot",
};

let serverProcess = null;

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await ensureServer();
  await runStageV2Smoke();
  printSummary();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  results.push({ name: "qa runner", ok: false, detail: `[${diagnostics.step}] ${message}` });
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
        const location = message.location();
        diagnostics.consoleErrors.push(
          `[${diagnostics.step}] ${message.text()} @ ${location.url || "unknown"}:${location.lineNumber}:${location.columnNumber}`,
        );
      }
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown";
      diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${failure}`);
    });

    markQaStep("load app");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
    await assertNoErrorOverlay(page, "initial load");

    markQaStep("open sandbox");
    await clickButtonByMatcher(page, /沙盘编辑/).catch(() => undefined);
    await clickStageEngineMode(page, "stage3d");
    await waitForVisibleBox(page, ".stage-v2-shell", 20_000);
    await waitForVisibleBox(page, STAGE_V2_CANVAS_SELECTOR, 20_000);
    await delay(1200);

  await assertNoErrorOverlay(page, "stage v2 load");
  pushResult("Stage v2 shell renders", true);

  const initialInteraction = await readStageInteraction(page);
  pushResult(
    "Stage v2 interaction HUD renders",
    /移动沙盘视角|已选中/.test(initialInteraction.text),
    initialInteraction.text,
  );

  await captureLocator(page, STAGE_V2_CANVAS_SELECTOR, "stage-v2-initial.png");

  await clickButtonByMatcher(page, /切换天气：雨天|雨/);
  await clickButtonByMatcher(page, /切换光照：黑夜|夜/);
  await waitForShellEnvironment(page, { weather: "rainy", light: "night", nightMode: true });
  pushResult("Rainy night environment applies shell theme", true);

  const waterBefore = await captureLocator(page, STAGE_V2_CANVAS_SELECTOR, "stage-v2-water-before.png");
  await delay(1000);
  const waterAfter = await captureLocator(page, STAGE_V2_CANVAS_SELECTOR, "stage-v2-water-after.png");
  const waterDiff = byteDiff(waterBefore, waterAfter);
  pushResult("Ocean/weather animation changes frame", waterDiff > 1000, `byteDiff=${waterDiff}`);

  markQaStep("place toy from backpack");
  const placementResult = await tryPlaceAssetFromBackpack(page, STAGE_V2_CANVAS_SELECTOR);
  pushResult("Backpack drag drops a new toy onto Stage v2", placementResult.ok, placementResult.detail);
  pushResult(
    "Backpack drag exposes Stage v2 placement state",
    placementResult.modeSeen,
    placementResult.modeDetail ?? "placement HUD state not observed",
  );
  pushResult("Backpack drop records an add event", placementResult.eventRecorded, placementResult.eventDetail);

  markQaStep("drag toy");
  const dragResult = await tryDragObject(page, STAGE_V2_CANVAS_SELECTOR);
  pushResult("Mouse drag moves a Stage v2 toy and writes scene state", dragResult.ok, dragResult.detail);
  pushResult(
    "Toy drag exposes Stage v2 interaction state",
    dragResult.modeSeen,
    dragResult.modeDetail ?? "drag HUD state not observed",
  );

  markQaStep("selected toy transforms");
  const transformResult = await tryTransformSelectedToy(page, dragResult.objectId);
  pushResult("Stage v2 selected toy exposes transform toolbelt", transformResult.selectionActive, transformResult.selectionDetail);
  pushResult("Stage v2 toolbelt rotates the selected toy", transformResult.rotationOk, transformResult.rotationDetail);
  pushResult("Stage v2 toolbelt scales the selected toy", transformResult.scaleOk, transformResult.scaleDetail);
  pushResult("Stage v2 toolbelt duplicates the selected toy", transformResult.duplicateOk, transformResult.duplicateDetail);
  pushResult("Stage v2 toolbelt deletes the selected toy", transformResult.deleteOk, transformResult.deleteDetail);

  markQaStep("pan camera");
  const cameraResult = await tryMoveCamera(page, STAGE_V2_CANVAS_SELECTOR);
  pushResult("Mouse can move the Stage v2 camera view", cameraResult.ok, cameraResult.detail);
  pushResult("Mouse pan exposes Stage v2 interaction state", cameraResult.modeSeen, cameraResult.modeDetail);

  markQaStep("rotate camera");
  const rotateResult = await tryRotateCamera(page, STAGE_V2_CANVAS_SELECTOR);
  pushResult("Mouse right-drag rotates the Stage v2 viewing angle", rotateResult.ok, rotateResult.detail);
  pushResult("Right-drag exposes Stage v2 rotation state", rotateResult.modeSeen, rotateResult.modeDetail);
  pushResult("Right-drag camera rotation does not move toys", rotateResult.sceneStable, rotateResult.sceneDetail);

  markQaStep("zoom camera");
  const zoomResult = await tryZoomCamera(page, STAGE_V2_CANVAS_SELECTOR);
  pushResult("Mouse wheel zoom changes the Stage v2 camera view", zoomResult.ok, zoomResult.detail);
  pushResult("Mouse wheel exposes Stage v2 zoom state", zoomResult.modeSeen, zoomResult.modeDetail);

  markQaStep("export png");
  const pngDownload = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    clickButtonByMatcher(page, /导出 PNG 截图|导出 Stage Engine v2 PNG 截图/),
  ]).then(([download]) => download);
  const pngPath = await pngDownload.path();
  pushResult("Stage v2 PNG export downloads an image", Boolean(pngPath), pngDownload.suggestedFilename());

  markQaStep("export json");
  const jsonDownload = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    clickButtonByMatcher(page, /导出 JSON 快照/),
  ]).then(([download]) => download);
  const jsonPath = await jsonDownload.path();
  pushResult("JSON export still downloads a snapshot", Boolean(jsonPath), jsonDownload.suggestedFilename());

  markQaStep("switch environment");
  await clickButtonByMatcher(page, /切换天气：晴天|晴/);
  await clickButtonByMatcher(page, /切换光照：白天|日/);
  await waitForShellEnvironment(page, { weather: "sunny", light: "day", nightMode: false });
  pushResult("Sunny day environment applies shell theme", true);

  markQaStep("switch classic");
  await clickStageEngineMode(page, "classic");
  await waitForVisibleBox(page, ".sandbox-editor", 10_000);
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
      const isVisibleForClick = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 2 &&
          rect.height > 2 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0.01
        );
      };
      const buttons = Array.from(document.querySelectorAll("button"));
      const candidates = buttons.filter((element) => {
        const label = element.getAttribute("aria-label") ?? "";
        const text = element.textContent ?? "";
        return pattern.test(`${label} ${text}`);
      });
      const button = candidates.find(isVisibleForClick) ?? candidates.find((element) => element instanceof HTMLElement);

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

async function clickStageEngineMode(page, mode) {
  await waitForSelectorAttached(page, ".stage-engine-mode-switch button", 10_000);
  await delay(500);
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
  await delay(120);
}

async function tryDragObject(page, canvas) {
  const before = await readScene(page);
  const box = await readVisibleElementBox(page, canvas);
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

  let modeSeen = false;
  let modeDetail = "";

  for (const [xFactor, yFactor] of points) {
    const x = box.x + box.width * xFactor;
    const y = box.y + box.height * yFactor;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(x + 90, y + 24, { steps: 14 });
    const interaction = await readStageInteraction(page);
    if (/正在移动/.test(interaction.text) || /is-stage-drag-toy/.test(interaction.className)) {
      modeSeen = true;
      modeDetail = interaction.text || interaction.className;
    }
    await page.mouse.up({ button: "left" });
    await delay(450);

    const after = await readScene(page);
    const movement = findObjectMovement(before, after);
    if (movement) {
      return {
        ok: true,
        detail: `${movement.name ?? movement.objectId}: ${movement.dx.toFixed(1)}, ${movement.dy.toFixed(1)}`,
        modeSeen,
        modeDetail,
        objectId: movement.objectId,
        objectName: movement.name ?? movement.objectId,
      };
    }
  }

  return { ok: false, detail: "no persisted object movement detected after candidate drags", modeSeen, modeDetail, objectId: null };
}

async function tryTransformSelectedToy(page, targetObjectId) {
  const emptyResult = {
    selectionActive: false,
    selectionDetail: "no dragged object id available",
    rotationOk: false,
    rotationDetail: "skipped",
    scaleOk: false,
    scaleDetail: "skipped",
    duplicateOk: false,
    duplicateDetail: "skipped",
    deleteOk: false,
    deleteDetail: "skipped",
  };

  if (!targetObjectId) {
    return emptyResult;
  }

  const sceneBefore = await readScene(page);
  const targetBefore = (sceneBefore.objects ?? []).find((object) => object.id === targetObjectId);
  if (!targetBefore) {
    return {
      ...emptyResult,
      selectionDetail: `target object missing from scene: ${targetObjectId}`,
    };
  }

  const selectionStatus = await readToolbeltStatus(page);
  const selectionActive =
    /正在编辑/.test(selectionStatus.text) &&
    (selectionStatus.text.includes(targetBefore.name ?? "") || /旋转\s+\d+°/.test(selectionStatus.text));

  if (!selectionActive) {
    return {
      ...emptyResult,
      selectionActive: false,
      selectionDetail: selectionStatus.text || "selected toolbelt text missing",
    };
  }

  await clickToolbeltButtonByMatcher(page, /向右旋转 .* 15 度|右转/);
  await delay(220);
  const sceneAfterRotate = await readScene(page);
  const rotated = (sceneAfterRotate.objects ?? []).find((object) => object.id === targetObjectId);
  const expectedRotation = normalizeQaRotation(Number(targetBefore.rotation ?? 0) + 15);
  const rotationOk = Boolean(rotated) && Math.abs(normalizeQaRotation(Number(rotated.rotation ?? 0)) - expectedRotation) < 0.1;
  const rotationEvent = findEvent(sceneAfterRotate, {
    objectId: targetObjectId,
    type: "property_change",
    labelIncludes: "快捷工具旋转沙具",
  });

  await clickToolbeltButtonByMatcher(page, /放大 .+|放大/);
  await delay(220);
  const sceneAfterScale = await readScene(page);
  const scaled = (sceneAfterScale.objects ?? []).find((object) => object.id === targetObjectId);
  const previousScale = Number(rotated?.scale ?? targetBefore.scale ?? 1);
  const expectedScale = Number(Math.min(2.4, previousScale + 0.1).toFixed(2));
  const scaleOk = Boolean(scaled) && Math.abs(Number(scaled.scale ?? 1) - expectedScale) < 0.005;
  const scaleEvent = findEvent(sceneAfterScale, {
    objectId: targetObjectId,
    type: "property_change",
    labelIncludes: "快捷工具缩放沙具",
  });

  const idsBeforeDuplicate = new Set((sceneAfterScale.objects ?? []).map((object) => object.id));
  await clickToolbeltButtonByMatcher(page, /复制 .+|复制/);
  await delay(260);
  const sceneAfterDuplicate = await readScene(page);
  const duplicate = (sceneAfterDuplicate.objects ?? []).find((object) => !idsBeforeDuplicate.has(object.id));
  const duplicateOk =
    Boolean(duplicate) &&
    duplicate?.assetId === targetBefore.assetId &&
    Math.abs(Number(duplicate?.x ?? 0) - Number(scaled?.x ?? targetBefore.x ?? 0) - 34) <= 1.5;
  const duplicateEvent = duplicate
    ? findEvent(sceneAfterDuplicate, {
        objectId: duplicate.id,
        type: "add",
        labelIncludes: "复制沙具",
      })
    : null;

  if (!duplicate) {
    return {
      selectionActive,
      selectionDetail: selectionStatus.text,
      rotationOk: rotationOk && Boolean(rotationEvent),
      rotationDetail: rotated
        ? `${targetBefore.name}: ${Math.round(Number(targetBefore.rotation ?? 0))}° -> ${Math.round(Number(rotated.rotation ?? 0))}°`
        : "target missing after rotate",
      scaleOk: scaleOk && Boolean(scaleEvent),
      scaleDetail: scaled
        ? `${targetBefore.name}: ${previousScale.toFixed(2)}x -> ${Number(scaled.scale ?? 0).toFixed(2)}x`
        : "target missing after scale",
      duplicateOk: false,
      duplicateDetail: "no duplicated object created",
      deleteOk: false,
      deleteDetail: "skipped because duplicate was not created",
    };
  }

  await clickToolbeltButtonByMatcher(page, new RegExp(`删除\\s+${escapeRegExp(duplicate.name ?? targetBefore.name ?? "")}`));
  await delay(260);
  const sceneAfterDelete = await readScene(page);
  const duplicateStillExists = (sceneAfterDelete.objects ?? []).some((object) => object.id === duplicate.id);
  const originalStillExists = (sceneAfterDelete.objects ?? []).some((object) => object.id === targetObjectId);
  const deleteEvent = findEvent(sceneAfterDelete, {
    objectId: duplicate.id,
    type: "delete",
    labelIncludes: "删除沙具",
  });

  return {
    selectionActive,
    selectionDetail: selectionStatus.text,
    rotationOk: rotationOk && Boolean(rotationEvent),
    rotationDetail: rotated
      ? `${targetBefore.name}: ${Math.round(Number(targetBefore.rotation ?? 0))}° -> ${Math.round(Number(rotated.rotation ?? 0))}°`
      : "target missing after rotate",
    scaleOk: scaleOk && Boolean(scaleEvent),
    scaleDetail: scaled
      ? `${targetBefore.name}: ${previousScale.toFixed(2)}x -> ${Number(scaled.scale ?? 0).toFixed(2)}x`
      : "target missing after scale",
    duplicateOk: duplicateOk && Boolean(duplicateEvent),
    duplicateDetail: duplicate
      ? `${duplicate.name ?? duplicate.assetId}: copied from ${targetBefore.name ?? targetBefore.assetId}`
      : "no duplicated object created",
    deleteOk: !duplicateStillExists && originalStillExists && Boolean(deleteEvent),
    deleteDetail: duplicateStillExists
      ? `${duplicate.name ?? duplicate.id} still exists`
      : originalStillExists
        ? `deleted duplicate ${duplicate.name ?? duplicate.id}; original remains`
        : "original object was unexpectedly deleted",
  };
}

async function tryMoveCamera(page, canvas) {
  const box = await readVisibleElementBox(page, canvas);
  if (!box) {
    return { ok: false, detail: "canvas bounding box missing" };
  }

  const before = await captureLocator(page, canvas, "stage-v2-camera-before.png");
  const x = box.x + box.width * 0.2;
  const y = box.y + box.height * 0.22;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(x + 130, y + 60, { steps: 16 });
  const interaction = await readStageInteraction(page);
  await page.mouse.up({ button: "left" });
  await delay(650);
  const after = await captureLocator(page, canvas, "stage-v2-camera-after.png");
  const diff = byteDiff(before, after);
  return {
    ok: diff > 1000,
    detail: `byteDiff=${diff}`,
    modeSeen: /正在平移/.test(interaction.text) || /is-stage-pan/.test(interaction.className),
    modeDetail: interaction.text || interaction.className,
  };
}

async function tryRotateCamera(page, canvas) {
  const box = await readVisibleElementBox(page, canvas);
  if (!box) {
    return {
      ok: false,
      detail: "canvas bounding box missing",
      modeSeen: false,
      modeDetail: "",
      sceneStable: false,
      sceneDetail: "canvas bounding box missing",
    };
  }

  const sceneBefore = await readScene(page);
  const before = await captureLocator(page, canvas, "stage-v2-rotate-before.png");
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.24;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x - 170, y + 18, { steps: 18 });
  const interaction = await readStageInteraction(page);
  await page.mouse.up({ button: "right" });
  await delay(650);
  const after = await captureLocator(page, canvas, "stage-v2-rotate-after.png");
  const sceneAfter = await readScene(page);
  const diff = byteDiff(before, after);
  const mutation = findObjectMutation(sceneBefore, sceneAfter);

  return {
    ok: diff > 1000,
    detail: `byteDiff=${diff}`,
    modeSeen: /正在转动/.test(interaction.text) || /is-stage-rotate/.test(interaction.className),
    modeDetail: interaction.text || interaction.className,
    sceneStable: !mutation,
    sceneDetail: mutation ?? "toy transforms unchanged",
  };
}

async function tryZoomCamera(page, canvas) {
  const box = await readVisibleElementBox(page, canvas);
  if (!box) {
    return {
      ok: false,
      detail: "canvas bounding box missing",
      modeSeen: false,
      modeDetail: "",
    };
  }

  const before = await captureLocator(page, canvas, "stage-v2-zoom-before.png");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -520);
  await delay(100);
  const interaction = await readStageInteraction(page);
  await delay(420);
  const after = await captureLocator(page, canvas, "stage-v2-zoom-after.png");
  const diff = byteDiff(before, after);
  return {
    ok: diff > 1000,
    detail: `byteDiff=${diff}`,
    modeSeen: /正在缩放/.test(interaction.text) || /is-stage-zoom/.test(interaction.className),
    modeDetail: interaction.text || interaction.className,
  };
}

async function tryPlaceAssetFromBackpack(page, canvas) {
  const before = await readScene(page);
  const beforeObjectIds = new Set((before.objects ?? []).map((object) => object.id));

  await ensureAssetBackpackOpen(page);
  await waitForVisibleAssetCard(page, "opening asset backpack");
  const box = await readVisibleElementBox(page, canvas);
  if (!box) {
    return {
      ok: false,
      detail: "canvas bounding box missing",
      modeSeen: false,
      modeDetail: "",
      eventRecorded: false,
      eventDetail: "canvas bounding box missing",
    };
  }

  const dropPoint = {
    x: Math.round(box.x + box.width * 0.31),
    y: Math.round(box.y + box.height * 0.42),
  };

  const dragStart = await page.evaluate(
    ({ mime, point }) => {
      const card = document.querySelector("article.asset-card[data-asset-id]");
      const canvas = document.querySelector(".stage-v2-canvas-wrap canvas, canvas.stage-v2-canvas");
      if (!(card instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
        return { ok: false, detail: "asset card or stage canvas missing" };
      }

      card.scrollIntoView({ block: "center", inline: "center" });
      const assetId = card.dataset.assetId ?? "";
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(mime, assetId);
      dataTransfer.effectAllowed = "copy";
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      canvas.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          dataTransfer,
        }),
      );
      canvas.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          dataTransfer,
        }),
      );

      return {
        ok: Boolean(assetId),
        assetId,
        detail: `${card.textContent ?? ""}`.replace(/\s+/g, " ").trim(),
      };
    },
    { mime: SANDBOX_ASSET_DRAG_MIME, point: dropPoint },
  );

  if (!dragStart.ok || !dragStart.assetId) {
    return {
      ok: false,
      detail: dragStart.detail ?? "asset dragstart failed",
      modeSeen: false,
      modeDetail: "",
      eventRecorded: false,
      eventDetail: "dragstart failed",
    };
  }

  await delay(160);
  const interaction = await readStageInteraction(page);

  const dropResult = await page.evaluate(
    ({ assetId, mime, point }) => {
      const card = document.querySelector(`article.asset-card[data-asset-id="${CSS.escape(assetId)}"]`);
      const canvas = document.querySelector(".stage-v2-canvas-wrap canvas, canvas.stage-v2-canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        return { ok: false, detail: "stage canvas missing" };
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.setData(mime, assetId);
      dataTransfer.effectAllowed = "copy";
      canvas.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          dataTransfer,
        }),
      );
      card?.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
      return { ok: true };
    },
    { assetId: dragStart.assetId, mime: SANDBOX_ASSET_DRAG_MIME, point: dropPoint },
  );

  if (!dropResult.ok) {
    return {
      ok: false,
      detail: dropResult.detail ?? "drop failed",
      modeSeen: /正在放置/.test(interaction.text) || /is-stage-place-asset/.test(interaction.className),
      modeDetail: interaction.text || interaction.className,
      eventRecorded: false,
      eventDetail: "drop failed",
    };
  }

  await delay(500);
  await closeAssetBackpack(page);
  const after = await readScene(page);
  const addedObject = (after.objects ?? []).find((object) => !beforeObjectIds.has(object.id));
  const addEvent = (after.events ?? []).find(
    (event) => event.type === "add" && event.assetId === dragStart.assetId && event.objectId === addedObject?.id,
  );

  return {
    ok: Boolean(addedObject),
    detail: addedObject
      ? `${addedObject.name ?? addedObject.assetId}: x=${Number(addedObject.x).toFixed(1)}, y=${Number(addedObject.y).toFixed(1)}`
      : `no new object after dropping ${dragStart.assetId}`,
    modeSeen: /正在放置/.test(interaction.text) || /is-stage-place-asset/.test(interaction.className),
    modeDetail: interaction.text || interaction.className,
    eventRecorded: Boolean(addEvent),
    eventDetail: addEvent?.label ?? `missing add event for ${dragStart.assetId}`,
  };
}

async function ensureAssetBackpackOpen(page) {
  if (await hasVisibleAssetCard(page)) {
    return;
  }

  const toggled = await page.evaluate(() => {
    const prioritySelectors = [
      ".game-inventory-toggle",
      "button[aria-label*='打开全屏沙具库']",
      "button[aria-label*='打开沙具背包']",
    ];

    for (const selector of prioritySelectors) {
      const button = document.querySelector(selector);
      if (button instanceof HTMLElement && button.offsetParent !== null) {
        button.click();
        return { ok: true, detail: selector };
      }
    }

    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((element) => {
      const label = element.getAttribute("aria-label") ?? "";
      const text = element.textContent ?? "";
      return element instanceof HTMLElement && element.offsetParent !== null && /打开沙具背包|打开全屏沙具库|沙具库|背包/.test(`${label} ${text}`);
    });
    if (!(button instanceof HTMLElement)) {
      return { ok: false, detail: "no visible backpack toggle" };
    }
    button.click();
    return { ok: true, detail: button.getAttribute("aria-label") ?? button.textContent ?? "matched button" };
  });

  if (!toggled.ok) {
    throw new Error(`Could not open asset backpack: ${toggled.detail}`);
  }
  await waitForVisibleAssetCard(page, `opening asset backpack via ${toggled.detail}`);
}

async function hasVisibleAssetCard(page) {
  return Boolean(await readVisibleElementBox(page, "article.asset-card[data-asset-id]").catch(() => null));
}

async function waitForVisibleAssetCard(page, label) {
  const deadline = Date.now() + 18_000;
  let lastState = null;

  while (Date.now() < deadline) {
    if (await hasVisibleAssetCard(page)) {
      return;
    }

    lastState = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("article.asset-card[data-asset-id]"));
      const visibleCards = cards.filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
      const library = document.querySelector(".asset-library");
      const drawer = document.querySelector(".game-side-drawer-left, .focus-asset-drawer");
      const emptyState = document.querySelector(".asset-library .empty-state, .asset-library .empty-category");
      const activeShelf = document.querySelector(".asset-shelf-rail button.active")?.getAttribute("aria-label") ?? "";
      return {
        cardCount: cards.length,
        visibleCardCount: visibleCards.length,
        libraryVisible: library instanceof HTMLElement && library.offsetParent !== null,
        drawerVisible: drawer instanceof HTMLElement && drawer.offsetParent !== null,
        emptyText: emptyState?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        activeShelf,
      };
    });

    await delay(250);
  }

  throw new Error(`Asset backpack opened but no visible asset card after ${label}: ${JSON.stringify(lastState)}`);
}

async function closeAssetBackpack(page) {
  await page
    .evaluate(() => {
      const closeButton = document.querySelector(".game-drawer-close, .focus-drawer-scrim");
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
        return true;
      }
      return false;
    })
    .catch(() => false);
  await delay(160);
}

async function captureLocator(page, selector, filename) {
  const box = await readVisibleElementBox(page, selector);
  if (!box) {
    throw new Error(`Cannot capture ${filename}: visible box missing for ${selector}`);
  }

  return page.screenshot({
    path: path.join(ARTIFACT_DIR, filename),
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
    },
  });
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

function findObjectMutation(before, after) {
  const beforeById = new Map((before.objects ?? []).map((object) => [object.id, object]));
  for (const object of after.objects ?? []) {
    const previous = beforeById.get(object.id);
    if (!previous) {
      return `new object appeared during camera rotation: ${object.name ?? object.id}`;
    }

    const moved =
      Math.abs(Number(object.x ?? 0) - Number(previous.x ?? 0)) > 0.1 ||
      Math.abs(Number(object.y ?? 0) - Number(previous.y ?? 0)) > 0.1;
    const rotated = Math.abs(Number(object.rotation ?? 0) - Number(previous.rotation ?? 0)) > 0.1;
    const scaled = Math.abs(Number(object.scale ?? 1) - Number(previous.scale ?? 1)) > 0.005;
    if (moved || rotated || scaled) {
      return `${object.name ?? object.id} changed while rotating camera`;
    }
  }

  const afterIds = new Set((after.objects ?? []).map((object) => object.id));
  for (const object of before.objects ?? []) {
    if (!afterIds.has(object.id)) {
      return `object disappeared during camera rotation: ${object.name ?? object.id}`;
    }
  }

  return null;
}

async function readStageInteraction(page) {
  return page.evaluate(() => {
    const shell = document.querySelector(".stage-v2-shell");
    const hud = document.querySelector(".stage-v2-interaction-hud");
    return {
      className: shell?.className ?? "",
      text: hud?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    };
  });
}

async function readToolbeltStatus(page) {
  return page.evaluate(() => {
    const toolbelt = document.querySelector(".sandbox-game-toolbelt");
    return {
      className: toolbelt?.className ?? "",
      text: toolbelt?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    };
  });
}

async function clickToolbeltButtonByMatcher(page, matcher) {
  const found = await page.evaluate(
    ({ source, flags }) => {
      const pattern = new RegExp(source, flags);
      const toolbelt = document.querySelector(".sandbox-game-toolbelt");
      if (!(toolbelt instanceof HTMLElement)) {
        return false;
      }

      const buttons = Array.from(toolbelt.querySelectorAll("button"));
      const button = buttons.find((element) => {
        const label = element.getAttribute("aria-label") ?? "";
        const title = element.getAttribute("title") ?? "";
        const text = element.textContent ?? "";
        return pattern.test(`${label} ${title} ${text}`);
      });

      if (!(button instanceof HTMLElement) || button.hasAttribute("disabled")) {
        return false;
      }

      button.click();
      return true;
    },
    { source: matcher.source, flags: matcher.flags },
  );

  if (!found) {
    throw new Error(`Toolbelt button not found: ${matcher}`);
  }

  await delay(120);
}

function findEvent(scene, { objectId, type, labelIncludes }) {
  return [...(scene.events ?? [])].reverse().find((event) => {
    return (
      event.objectId === objectId &&
      event.type === type &&
      (labelIncludes ? String(event.label ?? "").includes(labelIncludes) : true)
    );
  });
}

function normalizeQaRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForShellEnvironment(page, { weather, light, nightMode }) {
  const deadline = Date.now() + 5_000;
  let lastState = null;

  while (Date.now() < deadline) {
    lastState = await page.evaluate(() => {
      const shell = document.querySelector(".product-shell");
      return {
        className: shell instanceof HTMLElement ? shell.className : "",
        exists: Boolean(shell),
      };
    });

    if (
      lastState.className.includes(`weather-${weather}`) &&
      lastState.className.includes(`light-${light}`) &&
      lastState.className.includes("night-mode") === nightMode
    ) {
      return;
    }

    await delay(120);
  }

  throw new Error(`Shell environment did not become ${weather}/${light}: ${JSON.stringify(lastState)}`);
}

async function waitForVisibleBox(page, selector, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let lastState = null;

  while (Date.now() < deadline) {
    const box = await readVisibleElementBox(page, selector);
    if (box) {
      return box;
    }

    lastState = await readSelectorState(page, selector);
    await delay(120);
  }

  throw new Error(`Could not find visible box for ${selector}: ${JSON.stringify(lastState)}`);
}

async function waitForSelectorAttached(page, selector, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let count = 0;

  while (Date.now() < deadline) {
    count = await page.evaluate((targetSelector) => document.querySelectorAll(targetSelector).length, selector);
    if (count > 0) {
      return;
    }

    await delay(120);
  }

  throw new Error(`Could not find attached selector ${selector}: count=${count}`);
}

async function readVisibleElementBox(page, selector) {
  return page.evaluate((targetSelector) => {
    const elements = Array.from(document.querySelectorAll(targetSelector));
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        rect.width > 2 &&
        rect.height > 2 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.01;

      if (visible) {
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      }
    }

    return null;
  }, selector);
}

async function readSelectorState(page, selector) {
  return page.evaluate((targetSelector) => {
    const elements = Array.from(document.querySelectorAll(targetSelector));
    return {
      selector: targetSelector,
      count: elements.length,
      samples: elements.slice(0, 4).map((element) => {
        if (!(element instanceof HTMLElement)) {
          return { elementType: element.constructor.name };
        }

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          tagName: element.tagName.toLowerCase(),
          className: element.className,
          text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }),
    };
  }, selector);
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

function markQaStep(step) {
  diagnostics.step = step;
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
