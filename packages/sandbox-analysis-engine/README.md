# @psych-sandbox/analysis-engine

Framework-independent TypeScript contracts and ingestion runtime for digital psychological sandplay analysis.

Phase 1 includes:

- `sandbox.current-snapshot.v1` TypeScript contracts;
- JSON Schema for Snapshot, analysis result, and expert review;
- deterministic runtime validation with JSON Pointer issue paths;
- semantic consistency checks for IDs, references, counts, and depth order;
- explicit version migration registry;
- a small public engine facade.

Phase 2 adds deterministic scene reconstruction, pairwise spatial relations, a versioned feature bundle, and an evidence graph. It still does not generate psychological hypotheses or call an LLM.

Phase 3 adds a provider-neutral, evidence-constrained LLM adapter boundary. The model may draft candidate themes and non-leading interview questions, but it cannot create or rewrite facts and features. Runtime validation rejects unknown evidence, unsupported confidence, leading questions, diagnostic certainty, symbol-only crisis claims, and process claims that are not present in the Snapshot.

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

## Evidence-constrained hypothesis generation

```ts
import { createSandboxHypothesisAnalyzer } from "@psych-sandbox/analysis-engine";

const analyzer = createSandboxHypothesisAnalyzer({
  llm: {
    async generateStructured(request) {
      // Call a provider adapter outside this package and return parsed JSON or JSON text.
      return {
        content: await myAdapter.generate(request),
        provider: "my-provider",
        model: "my-model",
      };
    },
  },
});

const result = await analyzer.analyze(snapshot);
if (!result.ok) {
  console.log(result.stage, result.issues);
} else {
  console.log(result.value.hypotheses);
  console.log(result.value.interviewQuestions);
}
```

Only the Phase 2 scene, feature bundle, and evidence graph enter the prompt context. The raw Snapshot, user identity, personal memory, events, images, and API keys remain excluded. Provider SDKs, networking, retries, rate limits, and secret handling belong in external adapters.

## Published schemas

- `schemas/current-sandbox-snapshot.v1.schema.json`
- `schemas/sandbox-analysis-result.v1.schema.json`
- `schemas/expert-review.v1.schema.json`
- `schemas/reconstructed-scene.v1.schema.json`
- `schemas/evidence-graph.v1.schema.json`
- `schemas/feature-bundle.v1.schema.json`
- `schemas/sandbox-hypothesis-draft.v1.schema.json`

The package has no dependency on React, Konva, Three.js, browser DOM APIs, or any LLM provider SDK.
