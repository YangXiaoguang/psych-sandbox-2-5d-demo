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

Phase 4 adds a versioned, composable safety policy. Core rules separate allow, expert-review, and block decisions; detect diagnostic/crisis certainty, unsupported process and evidence claims, leading questions, symbolic overreach, and evidence conflicts; and emit a schema-valid audit report. Custom rules can be appended or used as a complete replacement policy, with fail-closed behavior on rule errors.

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

An analyzer created by v0.4.0 evaluates the validated draft with the core safety policy before assembling a successful result. A blocked draft returns `stage: "safety"`. Review findings remain available in `result.safetyEvaluation` and `result.value.safetyEvaluation`.

## Extending the safety policy

```ts
import { createSandboxHypothesisAnalyzer, createSandboxSafetyPolicy } from "@psych-sandbox/analysis-engine";

const safetyPolicy = createSandboxSafetyPolicy({
  version: "organization.safety.v1",
  ruleMode: "append",
  rules: [organizationSafetyRule],
});

const analyzer = createSandboxHypothesisAnalyzer({ llm, safetyPolicy });
```

Every finding records its rule/version, severity, action, JSON Pointer path, matched text, evidence IDs, and hypothesis IDs. Safety policy exceptions fail closed instead of silently bypassing the gate.

Only the Phase 2 scene, feature bundle, and evidence graph enter the prompt context. The raw Snapshot, user identity, personal memory, events, images, and API keys remain excluded. Provider SDKs, networking, retries, rate limits, and secret handling belong in external adapters.

## Published schemas

- `schemas/current-sandbox-snapshot.v1.schema.json`
- `schemas/sandbox-analysis-result.v1.schema.json`
- `schemas/expert-review.v1.schema.json`
- `schemas/reconstructed-scene.v1.schema.json`
- `schemas/evidence-graph.v1.schema.json`
- `schemas/feature-bundle.v1.schema.json`
- `schemas/sandbox-hypothesis-draft.v1.schema.json`
- `schemas/safety-evaluation.v1.schema.json`

The package has no dependency on React, Konva, Three.js, browser DOM APIs, or any LLM provider SDK.
