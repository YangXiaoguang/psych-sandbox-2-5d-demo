# @psych-sandbox/analysis-engine

Framework-independent TypeScript contracts and ingestion runtime for digital psychological sandplay analysis.

Phase 1 includes:

- `sandbox.current-snapshot.v1` TypeScript contracts;
- JSON Schema for Snapshot, analysis result, and expert review;
- deterministic runtime validation with JSON Pointer issue paths;
- semantic consistency checks for IDs, references, counts, and depth order;
- explicit version migration registry;
- a small public engine facade.

Phase 1 does not generate psychological hypotheses. Reconstruction, feature extraction, LLM generation, safety gates, and expert workflow are delivered in later phases.

Phase 2 adds deterministic scene reconstruction, pairwise spatial relations, a versioned feature bundle, and an evidence graph. It still does not generate psychological hypotheses or call an LLM.

## Usage

```ts
import { createSandboxAnalysisEngine } from "@psych-sandbox/analysis-engine";

const engine = createSandboxAnalysisEngine();
const parsed = engine.parseSnapshot(jsonValue);

if (!parsed.ok) {
  console.log(parsed.issues);
} else {
  console.log(parsed.value.snapshotId);
}
```

## Deterministic reconstruction and features

```ts
const result = engine.analyzeDeterministically(jsonValue);

if (result.ok) {
  console.log(result.value.scene.objects);
  console.log(result.value.featureBundle.features);
  console.log(result.value.featureBundle.evidenceGraph);
}
```

The same validated Snapshot and algorithm version produce canonically ordered, precision-normalized, deeply frozen output. Ordering uses a locale-independent binary lexical comparator. Process features use only `createdOrder` and are explicitly marked as `weak`.

## Registering an explicit migration

```ts
engine.registerMigration({
  fromVersion: "sandbox.current-snapshot.legacy-approved",
  toVersion: "sandbox.current-snapshot.v1",
  description: "Approved legacy mapping",
  migrate(input) {
    return mapApprovedLegacySnapshot(input);
  },
});
```

Unversioned data is rejected. The engine does not infer or guess a historical schema.

## Published schemas

- `schemas/current-sandbox-snapshot.v1.schema.json`
- `schemas/sandbox-analysis-result.v1.schema.json`
- `schemas/expert-review.v1.schema.json`
- `schemas/reconstructed-scene.v1.schema.json`
- `schemas/evidence-graph.v1.schema.json`
- `schemas/feature-bundle.v1.schema.json`

The package has no dependency on React, Konva, Three.js, browser DOM APIs, or any LLM provider SDK.
