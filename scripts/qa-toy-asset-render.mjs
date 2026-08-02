#!/usr/bin/env node

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts", "toy-asset-render-qa");
const SNAPSHOT_DIR = path.join(ARTIFACT_DIR, "sprites");
const ENTRY_PATH = path.join(ARTIFACT_DIR, "toy-asset-render-entry.ts");
const BUNDLE_PATH = path.join(ARTIFACT_DIR, "toy-asset-render-entry.js");
const HTML_PATH = path.join(ARTIFACT_DIR, "toy-asset-render.html");
const REPORT_PATH = path.join(ARTIFACT_DIR, "toy-asset-render-report.json");

const EXPECTED_CATEGORIES = ["人物", "动物", "建筑与环境", "自然元素", "特殊象征"];
const MIN_DEFAULT_ASSETS = 19;
const VERBOSE = process.env.TOY_ASSET_QA_VERBOSE === "1";
const results = [];
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
};

try {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(ENTRY_PATH, buildBrowserEntry(), "utf8");
  await esbuild.build({
    entryPoints: [ENTRY_PATH],
    outfile: BUNDLE_PATH,
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2020",
    sourcemap: false,
    logLevel: "silent",
  });
  await writeFile(HTML_PATH, buildHarnessHtml(), "utf8");

  const browserReport = await runBrowserHarness();
  await assertStaticSourceContracts();
  await assertToyReport(browserReport);
  await writeArtifactReport(browserReport);
  printSummary(browserReport);
} catch (error) {
  results.push({
    name: "Toy asset render QA runner",
    ok: false,
    detail: error instanceof Error ? error.stack ?? error.message : String(error),
  });
  printSummary();
  process.exitCode = 1;
}

function buildBrowserEntry() {
  return `
import { ASSET_CATEGORIES, SANDBOX_ASSETS } from "../../src/data/assets";
import { TOY_ASSET_SPECS } from "../../src/data/toyAssetSpecs";
import { renderToyAssetSprite } from "../../src/rendering/toyAssetRenderer";

window.__TOY_ASSET_RENDER_QA__ = { status: "running" };

run().catch((error) => {
  window.__TOY_ASSET_RENDER_QA__ = {
    status: "failed",
    error: error instanceof Error ? error.stack || error.message : String(error),
  };
});

async function run() {
  const rendered = [];

  for (const asset of SANDBOX_ASSETS) {
    const spec = TOY_ASSET_SPECS[asset.assetId];
    const sprite = await renderToyAssetSprite({
      assetId: asset.assetId,
      width: asset.defaultWidth,
      height: asset.defaultHeight,
      riskTag: asset.riskTag,
    });
    const metrics = await analyzeSprite(sprite.dataUrl);

    rendered.push({
      asset: {
        assetId: asset.assetId,
        name: asset.name,
        category: asset.category,
        defaultWidth: asset.defaultWidth,
        defaultHeight: asset.defaultHeight,
        riskTag: asset.riskTag,
        symbolicCandidates: asset.symbolicCandidates,
        semanticTags: asset.semanticTags,
        anchor: asset.anchor,
        footprint: asset.footprint,
        thumbnailScale: asset.thumbnailScale,
        modelRecipe: asset.modelRecipe,
      },
      spec,
      sprite: {
        width: sprite.width,
        height: sprite.height,
        anchorX: sprite.anchorX,
        anchorY: sprite.anchorY,
      },
      metrics,
      dataUrl: sprite.dataUrl,
    });
  }

  window.__TOY_ASSET_RENDER_QA__ = {
    status: "done",
    generatedAt: new Date().toISOString(),
    assetCount: SANDBOX_ASSETS.length,
    categories: ASSET_CATEGORIES,
    rendered,
  };
}

async function analyzeSprite(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let alphaPixels = 0;
  let solidPixels = 0;
  let edgeAlphaPixels = 0;
  let weightedX = 0;
  let weightedY = 0;
  let alphaWeight = 0;
  let hash = 2166136261;

  const stride = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 44));

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];

      if (alpha > 8) {
        alphaPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        weightedX += x * alpha;
        weightedY += y * alpha;
        alphaWeight += alpha;
        if (alpha > 120) {
          solidPixels += 1;
        }
        if (x <= 1 || y <= 1 || x >= canvas.width - 2 || y >= canvas.height - 2) {
          edgeAlphaPixels += 1;
        }
      }

      if (x % stride === 0 && y % stride === 0) {
        hash ^= red >> 3;
        hash = Math.imul(hash, 16777619);
        hash ^= green >> 3;
        hash = Math.imul(hash, 16777619);
        hash ^= blue >> 3;
        hash = Math.imul(hash, 16777619);
        hash ^= alpha >> 3;
        hash = Math.imul(hash, 16777619);
      }
    }
  }

  const hasBody = minX <= maxX && minY <= maxY;
  const boundsWidth = hasBody ? maxX - minX + 1 : 0;
  const boundsHeight = hasBody ? maxY - minY + 1 : 0;
  const pixelCount = canvas.width * canvas.height;

  return {
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    alphaPixels,
    solidPixels,
    opaqueRatio: Number((alphaPixels / pixelCount).toFixed(4)),
    solidRatio: Number((solidPixels / pixelCount).toFixed(4)),
    edgeAlphaRatio: alphaPixels > 0 ? Number((edgeAlphaPixels / alphaPixels).toFixed(4)) : 0,
    bounds: { minX, minY, maxX, maxY, width: boundsWidth, height: boundsHeight },
    boundsCoverageX: Number((boundsWidth / canvas.width).toFixed(4)),
    boundsCoverageY: Number((boundsHeight / canvas.height).toFixed(4)),
    alphaCenterX: alphaWeight > 0 ? Number((weightedX / alphaWeight / canvas.width).toFixed(4)) : 0,
    alphaCenterY: alphaWeight > 0 ? Number((weightedY / alphaWeight / canvas.height).toFixed(4)) : 0,
    sampleHash: (hash >>> 0).toString(16).padStart(8, "0"),
  };
}
`;
}

function buildHarnessHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Toy Asset Render QA</title>
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        background: #10212a;
        color: #f6efe2;
        font-family: system-ui, sans-serif;
      }
    </style>
  </head>
  <body>
    <main>Rendering toy asset QA snapshots...</main>
    <script src="./toy-asset-render-entry.js"></script>
  </body>
</html>`;
}

async function runBrowserHarness() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        diagnostics.consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));

    await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: "load" });
    await page.waitForFunction(
      () => {
        const report = window.__TOY_ASSET_RENDER_QA__;
        return report && report.status !== "running";
      },
      undefined,
      { timeout: 60_000 },
    );

    return await page.evaluate(() => window.__TOY_ASSET_RENDER_QA__);
  } finally {
    await browser.close();
  }
}

async function assertStaticSourceContracts() {
  const [renderer, stageRegistry, docs] = await Promise.all([
    readProjectFile("src/rendering/toyAssetRenderer.ts"),
    readProjectFile("src/stage3d/components/toys/toyRegistry.tsx"),
    readProjectFile("docs/scene-contracts.md"),
  ]);

  assert("Sprite renderer keeps a versioned cache key", renderer.includes("SPRITE_VERSION"));
  assert("Sprite renderer uses shared WebGL renderer", renderer.includes("sharedRenderer"));
  assert("Sprite renderer crops transparent pixels", renderer.includes("cropTransparentPixels"));
  assert("Sprite renderer keeps fallback only as explicit fallback", renderer.includes("buildFallback(group, riskTag)"));
  assert("Stage v2 uses toy registry boundary", stageRegistry.includes("renderToyModel("));
  assert("Scene contracts document ToyAssetSpec", docs.includes("ToyAssetSpec"));
  assert("Scene contracts document toy module boundary", docs.includes("Toy Module Boundary"));
}

async function assertToyReport(report) {
  assert("Browser harness completed", report?.status === "done", report?.error ?? JSON.stringify(report));
  assert("No browser console errors", diagnostics.consoleErrors.length === 0, diagnostics.consoleErrors.join("\n"));
  assert("No browser page errors", diagnostics.pageErrors.length === 0, diagnostics.pageErrors.join("\n"));
  assert("Default asset count is stable", report.assetCount >= MIN_DEFAULT_ASSETS, String(report.assetCount));

  const categories = new Set(report.categories ?? []);
  for (const category of EXPECTED_CATEGORIES) {
    assert(`Category exists: ${category}`, categories.has(category), [...categories].join(", "));
  }

  const seenAssetIds = new Set();
  const recipeKinds = new Set();
  const hashes = new Set();

  for (const item of report.rendered ?? []) {
    const { asset, spec, sprite, metrics } = item;
    const prefix = `${asset?.assetId ?? "unknown"} ${asset?.name ?? ""}`.trim();

    assert(`${prefix}: assetId is unique`, !seenAssetIds.has(asset.assetId), asset.assetId);
    seenAssetIds.add(asset.assetId);
    assert(`${prefix}: has matching ToyAssetSpec`, Boolean(spec) && spec.assetId === asset.assetId, JSON.stringify(spec));
    assert(`${prefix}: default asset does not use fallback recipe`, asset.modelRecipe.kind !== "fallback", JSON.stringify(asset.modelRecipe));
    assert(`${prefix}: spec and asset recipe match`, spec.modelRecipe.kind === asset.modelRecipe.kind, `${spec.modelRecipe.kind}/${asset.modelRecipe.kind}`);
    recipeKinds.add(asset.modelRecipe.kind);

    assert(`${prefix}: category is expected`, EXPECTED_CATEGORIES.includes(asset.category), asset.category);
    assert(`${prefix}: default dimensions are usable`, asset.defaultWidth >= 40 && asset.defaultHeight >= 40, `${asset.defaultWidth}x${asset.defaultHeight}`);
    assert(`${prefix}: symbolic candidates are descriptive`, Array.isArray(asset.symbolicCandidates) && asset.symbolicCandidates.length >= 3, JSON.stringify(asset.symbolicCandidates));
    assert(`${prefix}: semantic tags are descriptive`, Array.isArray(asset.semanticTags) && asset.semanticTags.length >= 3, JSON.stringify(asset.semanticTags));
    assert(`${prefix}: anchor stays inside lower body range`, inRange(asset.anchor.x, 0.32, 0.68) && inRange(asset.anchor.y, 0.62, 0.88), JSON.stringify(asset.anchor));
    assert(`${prefix}: thumbnail scale stays in safe range`, inRange(asset.thumbnailScale, 1.0, 1.36), String(asset.thumbnailScale));
    assert(`${prefix}: footprint dimensions are positive`, asset.footprint.width > 0 && asset.footprint.depth > 0 && asset.footprint.height > 0, JSON.stringify(asset.footprint));

    assert(`${prefix}: sprite dimensions are finite`, Number.isFinite(sprite.width) && Number.isFinite(sprite.height), JSON.stringify(sprite));
    assert(
      `${prefix}: sprite is large enough for clear thumbnails`,
      Math.max(sprite.width, sprite.height) >= 72 && Math.min(sprite.width, sprite.height) >= 42,
      `${sprite.width}x${sprite.height}`,
    );
    assert(`${prefix}: sprite anchor is inside rendered image`, inRange(sprite.anchorX, 0, sprite.width) && inRange(sprite.anchorY, 0, sprite.height), JSON.stringify(sprite));
    assert(`${prefix}: rendered PNG has visible alpha`, metrics.alphaPixels >= 900, JSON.stringify(metrics));
    assert(`${prefix}: rendered PNG has solid body pixels`, metrics.solidPixels >= 420, JSON.stringify(metrics));
    assert(`${prefix}: rendered body fills enough horizontal space`, metrics.boundsCoverageX >= 0.22, JSON.stringify(metrics));
    assert(`${prefix}: rendered body fills enough vertical space`, metrics.boundsCoverageY >= 0.22, JSON.stringify(metrics));
    assert(`${prefix}: crop does not cut through opaque edges`, metrics.edgeAlphaRatio <= 0.22, JSON.stringify(metrics));
    assert(`${prefix}: alpha center remains within composition`, inRange(metrics.alphaCenterX, 0.22, 0.78) && inRange(metrics.alphaCenterY, 0.18, 0.82), JSON.stringify(metrics));
    hashes.add(metrics.sampleHash);
  }

  assert("All reported assets were checked", seenAssetIds.size === report.assetCount, `${seenAssetIds.size}/${report.assetCount}`);
  assert("Default catalog keeps rich recipe variety", recipeKinds.size >= 15, [...recipeKinds].join(", "));
  assert("Rendered sprite snapshots are visually distinct", hashes.size >= 17, [...hashes].join(", "));
}

async function writeArtifactReport(report) {
  const serializable = {
    ...report,
    rendered: [],
    diagnostics,
  };

  for (const item of report.rendered ?? []) {
    const { dataUrl, ...rest } = item;
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,")) {
      const png = Buffer.from(dataUrl.split(",")[1], "base64");
      await writeFile(path.join(SNAPSHOT_DIR, `${item.asset.assetId}.png`), png);
    }
    serializable.rendered.push(rest);
  }

  await writeFile(REPORT_PATH, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");
}

async function readProjectFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

function inRange(value, min, max) {
  return typeof value === "number" && value >= min && value <= max;
}

function assert(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: ok ? "" : detail });
}

function printSummary(report) {
  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    if (!VERBOSE && result.ok) {
      continue;
    }
    const prefix = result.ok ? "[PASS]" : "[FAIL]";
    const detail = result.detail ? ` - ${result.detail}` : "";
    console.log(`${prefix} ${result.name}${detail}`);
  }

  if (!VERBOSE && failed.length === 0) {
    console.log(`[PASS] All toy asset render gates passed (${results.length}/${results.length})`);
  }

  if (report?.rendered?.length) {
    console.log(`\nToy asset render QA checked ${report.rendered.length} sprites.`);
  }
  console.log(`Artifacts: ${ARTIFACT_DIR}`);
  console.log(`Toy asset render QA: ${results.length - failed.length}/${results.length} gates passed`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
