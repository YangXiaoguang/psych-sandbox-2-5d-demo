import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specRoot = path.join(root, "specs", "sandbox-analysis");

const checks = [];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(specRoot, name), "utf8"));
}

function check(label, condition) {
  checks.push({ label, passed: Boolean(condition) });
  if (!condition) {
    throw new Error(`Sandbox analysis Phase 0 QA failed: ${label}`);
  }
}

const charter = readJson("engine-charter.v1.json");
const rubric = readJson("expert-rubric.v1.json");
const manifest = readJson("calibration-manifest.v1.json");

check("Engine charter version is frozen", charter.schemaVersion === "sandbox.analysis.engine-charter.v1" && charter.status === "phase-0-frozen");
check("Snapshot v1 is the first accepted input", charter.acceptedSnapshotSchemas.includes("sandbox.current-snapshot.v1"));
check("Fact, feature, hypothesis layers stay separated", JSON.stringify(charter.outputLayers) === JSON.stringify(["fact", "feature", "hypothesis"]));
check("Events remain excluded by default", charter.defaultContextPolicy.includeEvents === false);
check("Personal memory remains excluded by default", charter.defaultContextPolicy.includePersonalMemory === false);
check("Identity remains excluded by default", charter.defaultContextPolicy.includeUserIdentity === false);
check("Images remain excluded by default", charter.defaultContextPolicy.includeImage === false);
check("API keys remain excluded", charter.defaultContextPolicy.includeApiKeys === false);
check("Process fidelity is weak for snapshot-only input", charter.processEvidence.fidelity === "weak");
check("Created order is the only current process signal", JSON.stringify(charter.processEvidence.availableSignals) === JSON.stringify(["createdOrder"]));
check("Diagnosis is a forbidden claim", charter.forbiddenClaims.includes("medical-diagnosis"));
check("Symbol-only crisis inference is forbidden", charter.forbiddenClaims.includes("crisis-inference-from-symbol-only"));

const rubricWeight = rubric.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
const rubricIds = new Set(rubric.dimensions.map((dimension) => dimension.id));
check("Rubric weights sum to 100", rubricWeight === rubric.totalWeight && rubric.totalWeight === 100);
check("Rubric has unique dimensions", rubricIds.size === rubric.dimensions.length);
check("Rubric covers scene reconstruction", rubricIds.has("scene_reconstruction"));
check("Rubric covers evidence grounding", rubricIds.has("evidence_grounding"));
check("Rubric covers interpretive restraint", rubricIds.has("interpretive_restraint"));
check("Rubric covers interview quality", rubricIds.has("interview_question_quality"));
check("Rubric covers safety", rubricIds.has("safety"));
check("Gold data requires two experts", rubric.acceptance.minimumIndependentExpertsForGold >= 2);
check("Diagnostic claims trigger automatic rejection", rubric.automaticRejectConditions.includes("diagnostic_claim"));

const cohortCount = manifest.cohorts.reduce((sum, cohort) => sum + cohort.target, 0);
const partitionCount = Object.values(manifest.partitions).reduce((sum, count) => sum + count, 0);
check("Calibration target is 24 cases", manifest.targetCaseCount === 24);
check("Cohort targets sum to calibration target", cohortCount === manifest.targetCaseCount);
check("Dataset partitions sum to calibration target", partitionCount === manifest.targetCaseCount);
check("No expert labels are fabricated", manifest.status === "collection_required" && manifest.currentExpertLabeledCaseCount === 0);
check("Gold data requires adjudication", manifest.goldRequirements.requireAdjudication === true);
check("Repository rejects unapproved real snapshots", manifest.privacyPolicy.allowUnapprovedRealSnapshotsInRepository === false);

const requiredDocs = [
  "docs/sandbox-analysis-engine-charter.md",
  "docs/sandbox-analysis-engine-phase-4.md",
  "docs/sandbox-analysis-expert-rubric.md",
  "docs/sandbox-analysis-calibration-dataset.md",
];

for (const doc of requiredDocs) {
  check(`Required document exists: ${doc}`, fs.existsSync(path.join(root, doc)));
}

console.log(`Sandbox analysis Phase 0 specification QA: ${checks.length}/${checks.length} passed`);
