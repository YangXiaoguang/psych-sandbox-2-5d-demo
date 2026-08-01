#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_SCENES = [
  "sandbox-day-sunny",
  "sandbox-day-cloudy",
  "sandbox-night-clear",
  "sandbox-night-rainy",
  "inventory-expanded",
  "right-panel-collapsed",
  "sandbox-insight-drawer",
  "sandbox-fullscreen",
  "sandbox-ai-drawer",
  "agent-chat",
  "personal-memory",
  "admin-users",
];

const REVIEW_CHECKLIST = [
  ["Stage composition", "The sand island is the dominant subject and the operation layer does not compete with it."],
  ["Sand material", "Yellow sand reads as tactile material with visible grain, dune relief, and non-dirty color."],
  ["Ocean motion", "Surrounding water has visible depth, soft current lines, glints, and shoreline life."],
  ["Toy readability", "Hero toys read as 3D miniatures with clear silhouettes, contact shadows, and symbolic identity."],
  ["Weather readability", "Sunny, cloudy, night, and rainy states change atmosphere without hiding toys or controls."],
  ["Fullscreen editing", "Fullscreen mode keeps asset/insight/AI entry points accessible without duplicate panels."],
  ["Theme contrast", "Night-mode text, buttons, chips, tables, inputs, placeholders, and disabled states remain legible."],
  ["Navigation integrity", "Sandbox, Agent, Personal Memory, and Admin views remain reachable after visual changes."],
];

try {
  const manifestPath = await resolveManifestPath();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const report = buildReport(manifestPath, manifest);
  const reportPath = path.join(path.dirname(manifestPath), "visual-review.md");
  await writeFile(reportPath, report, "utf8");

  const failures = collectFailures(manifest);
  console.log(`Visual review report: ${reportPath}`);
  if (failures.length > 0) {
    console.error("");
    console.error("Visual review gate failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}

async function resolveManifestPath() {
  if (process.env.VISUAL_REVIEW_MANIFEST) {
    return path.resolve(process.cwd(), process.env.VISUAL_REVIEW_MANIFEST);
  }

  const root = path.resolve(process.cwd(), "artifacts", "visual-regression");
  if (!existsSync(root)) {
    throw new Error("No visual-regression artifacts found. Run `npm run qa:visual-baseline` first.");
  }

  const entries = await readdir(root, { withFileTypes: true });
  const datedDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  for (const dir of datedDirs.reverse()) {
    const manifestPath = path.join(root, dir, "manifest.json");
    if (existsSync(manifestPath)) {
      return manifestPath;
    }
  }

  throw new Error("No visual baseline manifest found. Run `npm run qa:visual-baseline` first.");
}

function buildReport(manifestPath, manifest) {
  const failures = collectFailures(manifest);
  const artifactDir = manifest.artifactDir ?? path.dirname(manifestPath);
  const generatedAt = manifest.generatedAt ?? new Date().toISOString();
  const scenes = Array.isArray(manifest.scenes) ? manifest.scenes : [];
  const byScene = new Map(scenes.map((scene) => [scene.id, scene]));

  const lines = [
    "# Stage v2 Visual Review",
    "",
    `Generated: ${generatedAt}`,
    `Manifest: \`${path.relative(process.cwd(), manifestPath)}\``,
    `Artifacts: \`${path.relative(process.cwd(), artifactDir)}\``,
    "",
    "## Gate Summary",
    "",
    `- Required scenes: ${REQUIRED_SCENES.length}`,
    `- Captured scenes: ${scenes.length}`,
    `- Console errors: ${manifest.diagnostics?.consoleErrors?.length ?? 0}`,
    `- Page errors: ${manifest.diagnostics?.pageErrors?.length ?? 0}`,
    `- Request failures: ${manifest.diagnostics?.requestFailures?.length ?? 0}`,
    `- Gate result: ${failures.length === 0 ? "PASS" : "FAIL"}`,
    "",
    "## Scene Index",
    "",
    "| Scene | Status | Screenshot | Root box | Theme |",
    "|---|---|---|---|---|",
  ];

  for (const sceneId of REQUIRED_SCENES) {
    const scene = byScene.get(sceneId);
    if (!scene) {
      lines.push(`| \`${sceneId}\` | Missing | - | - | - |`);
      continue;
    }
    const rootBox = scene.rootBox
      ? `${scene.rootBox.width}x${scene.rootBox.height} @ ${scene.rootBox.x},${scene.rootBox.y}`
      : "missing";
    const screenshot = scene.file ? `[${scene.file}](./${scene.file})` : "-";
    lines.push(`| \`${sceneId}\` | Captured | ${screenshot} | ${rootBox} | \`${scene.shellClass ?? ""}\` |`);
  }

  lines.push(
    "",
    "## Review Checklist",
    "",
    "Use this list for human visual QA after opening the screenshots. Keep notes short and actionable.",
    "",
    "| Area | What To Check | Result | Notes |",
    "|---|---|---|---|",
  );

  for (const [area, check] of REVIEW_CHECKLIST) {
    lines.push(`| ${area} | ${check} | Pending |  |`);
  }

  lines.push("", "## Diagnostics", "");
  appendDiagnostic(lines, "Console errors", manifest.diagnostics?.consoleErrors);
  appendDiagnostic(lines, "Page errors", manifest.diagnostics?.pageErrors);
  appendDiagnostic(lines, "Request failures", manifest.diagnostics?.requestFailures);

  lines.push(
    "",
    "## Recommended Review Order",
    "",
    "1. Compare `sandbox-day-sunny` and `sandbox-fullscreen` first: they decide the main Stage v2 product quality.",
    "2. Check `sandbox-night-rainy`: this is the hardest readability state.",
    "3. Check `inventory-expanded` and `sandbox-ai-drawer`: these catch most drawer and text-overlap regressions.",
    "4. Finish with `agent-chat`, `personal-memory`, and `admin-users`: they catch global theme side effects.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function appendDiagnostic(lines, title, items) {
  lines.push(`### ${title}`, "");
  if (!Array.isArray(items) || items.length === 0) {
    lines.push("- None", "");
    return;
  }
  items.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
}

function collectFailures(manifest) {
  const failures = [];
  const scenes = Array.isArray(manifest.scenes) ? manifest.scenes : [];
  const sceneIds = new Set(scenes.map((scene) => scene.id));

  for (const requiredScene of REQUIRED_SCENES) {
    if (!sceneIds.has(requiredScene)) {
      failures.push(`Missing required scene: ${requiredScene}`);
    }
  }

  for (const scene of scenes) {
    if (!scene.rootBox || scene.rootBox.width < 24 || scene.rootBox.height < 24) {
      failures.push(`Scene has no visible root box: ${scene.id ?? "unknown"}`);
    }
  }

  const consoleErrors = manifest.diagnostics?.consoleErrors ?? [];
  const pageErrors = manifest.diagnostics?.pageErrors ?? [];
  if (consoleErrors.length > 0) {
    failures.push(`${consoleErrors.length} browser console error(s) captured`);
  }
  if (pageErrors.length > 0) {
    failures.push(`${pageErrors.length} page error(s) captured`);
  }

  return failures;
}
